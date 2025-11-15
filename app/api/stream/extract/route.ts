/**
 * Stream Extract API - Cheerio-Based Extraction
 * 
 * Uses the proven Cheerio method from VIDSRC-PRO-SUCCESS.md
 * GET /api/stream/extract?tmdbId=550&type=movie
 * GET /api/stream/extract?tmdbId=1396&type=tv&season=1&episode=1
 */

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

function caesarDecode(str: string, shift: number): string {
  return str.split('').map((char) => {
    const code = char.charCodeAt(0);
    if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
    }
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
    }
    return char;
  }).join('');
}

function resolvePlaceholders(url: string): string {
  return url
    .replace(/\{v1\}/g, 'shadowlandschronicles.com')
    .replace(/\{v2\}/g, 'shadowlandschronicles.com')
    .replace(/\{v3\}/g, 'shadowlandschronicles.com')
    .replace(/\{v4\}/g, 'shadowlandschronicles.com')
    .replace(/\{s1\}/g, 'shadowlandschronicles.com');
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse parameters
    const tmdbId = searchParams.get('tmdbId') || '';
    const type = searchParams.get('type') as 'movie' | 'tv';
    const season = searchParams.get('season') ? parseInt(searchParams.get('season')!) : undefined;
    const episode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!) : undefined;

    // Validate parameters
    if (!tmdbId) {
      return NextResponse.json(
        { error: 'Invalid or missing tmdbId' },
        { status: 400 }
      );
    }

    if (!type || !['movie', 'tv'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid or missing type (must be "movie" or "tv")' },
        { status: 400 }
      );
    }

    if (type === 'tv' && (!season || !episode)) {
      return NextResponse.json(
        { error: 'Season and episode required for TV shows' },
        { status: 400 }
      );
    }

    // Cheerio-based extraction (proven method from VIDSRC-PRO-SUCCESS.md)
    console.log('[EXTRACT] Start - Using Cheerio method');
    
    const embedUrl = `https://vidsrc.xyz/embed/${type}/${tmdbId}${type === 'tv' ? `/${season}/${episode}` : ''}`;
    console.log('[EXTRACT] Embed:', embedUrl);
    
    // Step 1: Extract data-hash using Cheerio
    const embedHtml = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }).then(r => r.text());
    
    const $embed = cheerio.load(embedHtml);
    let dataHash = $embed('[data-hash]').first().attr('data-hash');
    
    // Fallback: search in scripts if not found in attributes
    if (!dataHash) {
      const scripts = $embed('script');
      for (let i = 0; i < scripts.length; i++) {
        const content = $embed(scripts[i]).html();
        if (content) {
          const match = content.match(/data-hash=["']([^"']+)["']/);
          if (match) {
            dataHash = match[1];
            break;
          }
        }
      }
    }
    
    if (!dataHash) {
      return NextResponse.json({ error: 'data-hash not found' }, { status: 404 });
    }
    
    console.log('[EXTRACT] Hash:', dataHash.substring(0, 50) + '...');
    
    // Step 2: Get RCP page and extract ProRCP iframe src using Cheerio
    const rcpHtml = await fetch(`https://cloudnestra.com/rcp/${dataHash}`, {
      headers: { 
        'Referer': 'https://vidsrc-embed.ru/', 
        'Origin': 'https://vidsrc-embed.ru',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }).then(r => r.text());
    
    // Try to extract iframe src from JavaScript
    const srcMatch = rcpHtml.match(/src:\s*['"]([^'"]+)['"]/);
    if (!srcMatch) {
      return NextResponse.json({ error: 'ProRCP iframe not found' }, { status: 404 });
    }
    
    const proRcpUrl = `https://cloudnestra.com${srcMatch[1]}`;
    console.log('[EXTRACT] ProRCP:', proRcpUrl.substring(0, 80) + '...');
    
    // Step 3: Get ProRCP page and extract hidden div using Cheerio
    const proRcpHtml = await fetch(proRcpUrl, {
      headers: { 
        'Referer': 'https://vidsrc-embed.ru/', 
        'Origin': 'https://vidsrc-embed.ru',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }).then(r => r.text());
    
    const $proRcp = cheerio.load(proRcpHtml);
    
    // Extract hidden div with display:none and substantial content
    let divId = '';
    let encoded = '';
    
    $proRcp('div').each((_i, elem) => {
      const $elem = $proRcp(elem);
      const style = $elem.attr('style');
      const id = $elem.attr('id');
      const content = $elem.html();
      
      // Look for hidden divs with display:none and content > 500 chars
      if (style && style.includes('display:none') && id && content && content.length > 500) {
        divId = id;
        encoded = content.trim();
        return false; // Stop iteration
      }
    });
    
    if (!encoded || !divId) {
      return NextResponse.json({ error: 'Hidden div not found' }, { status: 404 });
    }
    
    console.log('[EXTRACT] Div ID:', divId);
    console.log('[EXTRACT] Encoded preview:', encoded.substring(0, 100));
    
    // Try base64 decode first (URL-safe)
    let decoded = '';
    try {
      const base64 = encoded.replace(/_/g, '/').replace(/-/g, '+');
      decoded = Buffer.from(base64, 'base64').toString('utf-8');
      console.log('[EXTRACT] Base64 decoded:', decoded.substring(0, 100));
    } catch (e) {
      // Fallback to Caesar if base64 fails
      decoded = caesarDecode(encoded, 3);
      console.log('[EXTRACT] Caesar decoded:', decoded.substring(0, 100));
    }
    
    const resolved = resolvePlaceholders(decoded).split(' or ')[0];
    console.log('[EXTRACT] Final URL:', resolved);
    
    if (!resolved.startsWith('http')) {
      return NextResponse.json({ error: 'Decoded URL invalid: ' + resolved.substring(0, 50) }, { status: 500 });
    }
    
    console.log('[EXTRACT] Success');
    
    const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(resolved)}&referer=${encodeURIComponent('https://vidsrc-embed.ru/')}&origin=${encodeURIComponent('https://vidsrc-embed.ru')}`;
    
    return NextResponse.json({
      success: true,
      streamUrl: proxiedUrl,
      url: proxiedUrl,
      provider: 'vidsrc-simple',
      requiresProxy: true,
    });

  } catch (error) {
    console.error('Stream extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract stream' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
