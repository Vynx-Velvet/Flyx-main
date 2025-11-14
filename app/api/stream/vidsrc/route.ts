/**
 * VidSrc Stream Extraction API Route
 * 
 * GET /api/stream/vidsrc?tmdbId=550&type=movie
 * GET /api/stream/vidsrc?tmdbId=1396&type=tv&season=1&episode=1
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractM3U8 } from '@/app/lib/services/vidsrc-extractor';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse parameters
    const tmdbId = parseInt(searchParams.get('tmdbId') || '');
    const type = searchParams.get('type') as 'movie' | 'tv';
    const season = searchParams.get('season') ? parseInt(searchParams.get('season')!) : undefined;
    const episode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!) : undefined;
    
    // Validate parameters
    if (!tmdbId || isNaN(tmdbId)) {
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
    
    // Extract M3U8
    const result = await extractM3U8({ tmdbId, type, season, episode });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Extraction failed' },
        { status: 404 }
      );
    }
    
    // Return success with all URL variants
    return NextResponse.json({
      success: true,
      url: result.url,
      urls: result.urls || [result.url],
      method: result.method,
      provider: 'vidsrc'
    });
    
  } catch (error) {
    console.error('VidSrc extraction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
