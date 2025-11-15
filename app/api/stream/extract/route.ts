/**
 * Stream Extract API - RCP Infrastructure Extraction
 * 
 * Uses the battle-tested RCP extraction infrastructure
 * GET /api/stream/extract?tmdbId=550&type=movie
 * GET /api/stream/extract?tmdbId=1396&type=tv&season=1&episode=1
 */

import { NextRequest, NextResponse } from 'next/server';
import { hashExtractor, proRcpExtractor, hiddenDivExtractor, tryAllDecoders, resolvePlaceholders, validateM3U8Url } from '@/app/lib/services/rcp';

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

    // Extract stream using RCP infrastructure
    const requestId = `extract-${Date.now()}`;
    console.log('[EXTRACT] Starting extraction:', { tmdbId, type, season, episode, requestId });
    
    // Step 1: Fetch embed page and extract hash
    const embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}${
      type === 'tv' ? `/${season}/${episode}` : ''
    }`;
    console.log('[EXTRACT] Embed URL:', embedUrl);
    
    const embedResponse = await fetch(embedUrl);
    const embedHtml = await embedResponse.text();
    const hash = hashExtractor.extract(embedHtml, '2embed', requestId);
    
    if (!hash) {
      console.error('[EXTRACT] Failed to extract hash');
      return NextResponse.json({ error: 'Failed to extract hash from embed page' }, { status: 404 });
    }
    console.log('[EXTRACT] Hash extracted:', hash);

    // Step 2: Fetch RCP page
    const rcpUrl = `https://cloudnestra.com/rcp/${hash}`;
    console.log('[EXTRACT] Fetching RCP page:', rcpUrl);
    
    const rcpResponse = await fetch(rcpUrl, {
      headers: {
        'Referer': 'https://vidsrc-embed.ru/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const rcpHtml = await rcpResponse.text();

    // Step 3: Extract ProRCP URL from RCP page
    console.log('[EXTRACT] RCP HTML length:', rcpHtml.length);
    console.log('[EXTRACT] RCP HTML preview:', rcpHtml.substring(0, 500));
    
    const proRcpUrl = proRcpExtractor.extract(rcpHtml, '2embed', requestId);
    if (!proRcpUrl) {
      console.error('[EXTRACT] Failed to extract ProRCP URL from RCP page');
      
      // Try manual regex as fallback
      const manualMatch = rcpHtml.match(/(?:src|href):\s*["']([^"']*(?:prorcp|srcrcp)[^"']*)["']/i);
      if (manualMatch) {
        const fallbackUrl = manualMatch[1].startsWith('http') 
          ? manualMatch[1] 
          : `https://cloudnestra.com${manualMatch[1]}`;
        console.log('[EXTRACT] Found ProRCP URL via fallback regex:', fallbackUrl);
        return NextResponse.json({ error: 'Failed to extract ProRCP URL (tried fallback)' }, { status: 404 });
      }
      
      return NextResponse.json({ error: 'Failed to extract ProRCP URL' }, { status: 404 });
    }
    console.log('[EXTRACT] ProRCP URL:', proRcpUrl);

    // Step 4: Fetch ProRCP page
    console.log('[EXTRACT] Fetching ProRCP page');
    const proRcpResponse = await fetch(proRcpUrl, {
      headers: {
        'Referer': 'https://vidsrc-embed.ru/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const proRcpHtml = await proRcpResponse.text();

    // Step 5: Extract encoded URL from hidden div
    const hiddenDiv = hiddenDivExtractor.extract(proRcpHtml, '2embed', requestId);
    if (!hiddenDiv) {
      console.error('[EXTRACT] Failed to extract hidden div');
      return NextResponse.json({ error: 'Failed to extract encoded URL from ProRCP page' }, { status: 404 });
    }
    console.log('[EXTRACT] Encoded URL extracted, length:', hiddenDiv.encoded.length);

    // Step 6: Decode the URL
    const decodedResult = await tryAllDecoders(hiddenDiv.encoded, hiddenDiv.divId, requestId);
    if (!decodedResult || !decodedResult.url) {
      console.error('[EXTRACT] Failed to decode URL');
      return NextResponse.json({ error: 'Failed to decode URL' }, { status: 404 });
    }
    console.log('[EXTRACT] URL decoded:', decodedResult.url.substring(0, 50) + '...');

    // Step 7: Resolve placeholders (returns array of URLs)
    const resolvedUrls = resolvePlaceholders(decodedResult.url);
    console.log('[EXTRACT] Placeholders resolved, got', resolvedUrls.length, 'URLs');

    // Step 8: Validate M3U8 (use first URL)
    const primaryUrl = resolvedUrls[0];
    const validation = await validateM3U8Url(primaryUrl);
    if (!validation.valid) {
      console.error('[EXTRACT] M3U8 validation failed:', validation.error);
      return NextResponse.json({ error: 'Invalid M3U8 URL: ' + validation.error }, { status: 404 });
    }
    console.log('[EXTRACT] M3U8 validated successfully');

    // Return success with proxied URL
    const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(primaryUrl)}&referer=${encodeURIComponent('https://vidsrc-embed.ru/')}&origin=${encodeURIComponent('https://vidsrc-embed.ru')}`;
    
    return NextResponse.json({
      success: true,
      streamUrl: proxiedUrl,
      url: proxiedUrl,
      provider: 'vidsrc-pro-rcp',
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
