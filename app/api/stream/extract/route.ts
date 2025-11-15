/**
 * Stream Extract API - Simple Pure Fetch Extraction
 * 
 * Simplified extraction without heavy dependencies
 * GET /api/stream/extract?tmdbId=550&type=movie
 * GET /api/stream/extract?tmdbId=1396&type=tv&season=1&episode=1
 */

import { NextRequest, NextResponse } from 'next/server';

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

    // Simple extraction
    console.log('[EXTRACT] Start');
    
    const embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}${type === 'tv' ? `/${season}/${episode}` : ''}`;
    console.log('[EXTRACT] Embed:', embedUrl);
    
    const embedHtml = await fetch(embedUrl).then(r => r.text());
    const hashMatch = embedHtml.match(/data-hash=["']([^"']+)["']/);
    if (!hashMatch) return NextResponse.json({ error: 'No hash' }, { status: 404 });
    
    console.log('[EXTRACT] Hash:', hashMatch[1]);
    
    const rcpHtml = await fetch(`https://cloudnestra.com/rcp/${hashMatch[1]}`, {
      headers: { 'Referer': 'https://vidsrc-embed.ru/', 'User-Agent': 'Mozilla/5.0' }
    }).then(r => r.text());
    
    const srcMatch = rcpHtml.match(/src:\s*['"]([^'"]+)['"]/);
    if (!srcMatch) return NextResponse.json({ error: 'No src' }, { status: 404 });
    
    const proRcpUrl = `https://cloudnestra.com${srcMatch[1]}`;
    console.log('[EXTRACT] ProRCP:', proRcpUrl);
    
    const proRcpHtml = await fetch(proRcpUrl, {
      headers: { 'Referer': 'https://vidsrc-embed.ru/', 'User-Agent': 'Mozilla/5.0' }
    }).then(r => r.text());
    
    const divMatch = proRcpHtml.match(/<div[^>]+id=["'][^"']*["'][^>]*>([^<]{100,})<\/div>/);
    if (!divMatch) return NextResponse.json({ error: 'No div' }, { status: 404 });
    
    const encoded = divMatch[1].trim();
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
