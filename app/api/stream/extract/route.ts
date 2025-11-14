/**
 * Stream Extract API - CloudStream Pure Fetch Extraction
 * 
 * Pure fetch-based extraction using the working CloudStream method
 * GET /api/stream/extract?tmdbId=550&type=movie
 * GET /api/stream/extract?tmdbId=1396&type=tv&season=1&episode=1
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractCloudStream } from '@/app/lib/services/cloudstream-pure-fetch';

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

    // Use the new RCP extraction system
    console.log('Extracting stream:', { tmdbId, type, season, episode });
    
    // Import the RCP extractor
    const { extractFromProvider } = await import('@/app/lib/services/rcp/index');
    
    // Try providers in order: vidsrc, 2embed, superembed
    const providers = ['vidsrc', '2embed', 'superembed'] as const;
    let result = null;
    
    for (const provider of providers) {
      console.log(`Trying provider: ${provider}`);
      try {
        result = await extractFromProvider({
          provider,
          tmdbId,
          type,
          season,
          episode,
        });
        
        if (result.success) {
          console.log(`✓ ${provider} succeeded!`);
          break;
        } else {
          console.log(`✗ ${provider} failed: ${result.error}`);
        }
      } catch (err) {
        console.log(`✗ ${provider} error:`, err);
      }
    }
    
    if (!result) {
      result = { success: false, error: 'All providers failed' };
    }
    
    console.log('Final extraction result:', result);

    if (!result.success) {
      console.error('Extraction failed:', result.error);
      console.error('Extraction logs:', result.logs);
      return NextResponse.json(
        { 
          error: result.error || 'Extraction failed',
          logs: result.logs,
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

    // Return success
    console.log('Extraction successful!');
    return NextResponse.json({
      success: true,
      streamUrl: result.url,
      url: result.url,
      method: result.method,
      provider: 'cloudstream',
      requiresProxy: false,
      logs: result.logs,
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
