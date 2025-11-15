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
    console.log('[EXTRACT] Starting extraction:', { tmdbId, type, season, episode });
    
    // Step 1: Extract hash from embed page
    const embedUrl = `https://vidsrc-embed.ru/embed/${type}/${tmdbId}${
      type === 'tv' ? `/${season}/${episode}` : ''
    }`;
    console.log('[EXTRACT] Embed URL:', embedUrl);
    
    const hash = await hashExtractor.extractHash(embedUrl);
    if (!hash) {
      console.error('[EXTRACT] Failed to extract hash');
      return NextResponse.json({ error: 'Failed to extract hash from embed page' }, { status: 404 });
    }
    console.log('[EXTRACT] Hash extracted:', hash);

    // Step 2: Extract ProRCP URL
    const proRcpUrl = await proRcpExtractor.extractProRcpUrl(hash);
    if (!proRcpUrl) {
      console.error('[EXTRACT] Failed to extract ProRCP URL');
      return NextResponse.json({ error: 'Failed to extract ProRCP URL' }, { status: 404 });
    }
    console.log('[EXTRACT] ProRCP URL:', proRcpUrl);

    // Step 3: Extract encoded URL from hidden div
    const encodedUrl = await hiddenDivExtractor.extractEncodedUrl(proRcpUrl);
    if (!encodedUrl) {
      console.error('[EXTRACT] Failed to extract encoded URL');
      return NextResponse.json({ error: 'Failed to extract encoded URL from ProRCP page' }, { status: 404 });
    }
    console.log('[EXTRACT] Encoded URL extracted, length:', encodedUrl.length);

    // Step 4: Decode the URL
    const decodedResult = tryAllDecoders(encodedUrl);
    if (!decodedResult.success || !decodedResult.url) {
      console.error('[EXTRACT] Failed to decode URL');
      return NextResponse.json({ error: 'Failed to decode URL' }, { status: 404 });
    }
    console.log('[EXTRACT] URL decoded:', decodedResult.url.substring(0, 50) + '...');

    // Step 5: Resolve placeholders
    const resolvedUrl = resolvePlaceholders(decodedResult.url);
    console.log('[EXTRACT] Placeholders resolved');

    // Step 6: Validate M3U8
    const validation = await validateM3U8Url(resolvedUrl);
    if (!validation.isValid) {
      console.error('[EXTRACT] M3U8 validation failed:', validation.error);
      return NextResponse.json({ error: 'Invalid M3U8 URL: ' + validation.error }, { status: 404 });
    }
    console.log('[EXTRACT] M3U8 validated successfully');

    // Return success with proxied URL
    const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(resolvedUrl)}&referer=${encodeURIComponent('https://vidsrc-embed.ru/')}&origin=${encodeURIComponent('https://vidsrc-embed.ru')}`;
    
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
