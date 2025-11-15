/**
 * Stream Extract API - VidSrc Pro Pure Fetch Extraction
 * 
 * Pure fetch-based extraction using VidSrc Pro (no VM, no Puppeteer)
 * GET /api/stream/extract?tmdbId=550&type=movie
 * GET /api/stream/extract?tmdbId=1396&type=tv&season=1&episode=1
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractVidsrcPro } from '@/app/lib/services/vidsrc-pro-pure-fetch';

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

    // Extract stream using VidSrc Pro
    console.log('Extracting stream:', { tmdbId, type, season, episode });
    const result = await extractVidsrcPro(tmdbId, type, season, episode);
    console.log('Extraction result:', result);

    if (!result.success) {
      console.error('Extraction failed:', result.error);
      return NextResponse.json(
        { 
          error: result.error || 'Extraction failed',
          debug: {
            tmdbId,
            type,
            season,
            episode,
          }
        },
        { status: 404 }
      );
    }

    // Return success with proxied URL
    console.log('Extraction successful!');
    
    // Create proxied URL that routes through our stream-proxy
    const proxiedUrl = `/api/stream-proxy?url=${encodeURIComponent(result.url!)}&referer=${encodeURIComponent('https://vidsrc-embed.ru/')}&origin=${encodeURIComponent('https://vidsrc-embed.ru')}`;
    
    return NextResponse.json({
      success: true,
      streamUrl: proxiedUrl,
      url: proxiedUrl,
      provider: 'vidsrc-pro',
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
