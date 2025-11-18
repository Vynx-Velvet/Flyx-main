/**
 * Subtitle Proxy - Downloads and serves subtitles with proper CORS headers
 * Converts SRT to VTT format if needed
 */

import { NextRequest, NextResponse } from 'next/server';

function convertSrtToVtt(srtContent: string): string {
  // Check if already VTT
  if (srtContent.trim().startsWith('WEBVTT')) {
    return srtContent;
  }

  // Convert SRT to VTT
  let vttContent = 'WEBVTT\n\n';
  
  // Replace SRT timecode format (00:00:00,000 --> 00:00:00,000) with VTT format (00:00:00.000 --> 00:00:00.000)
  vttContent += srtContent
    .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4')
    .replace(/^\d+\n/gm, ''); // Remove subtitle numbers

  return vttContent;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    console.log('[SUBTITLE-PROXY] Fetching subtitle from:', url);

    // Fetch the subtitle file
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error('[SUBTITLE-PROXY] Failed to fetch subtitle:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch subtitle' },
        { status: response.status }
      );
    }

    let content = await response.text();

    // Convert to VTT if needed
    content = convertSrtToVtt(content);

    console.log('[SUBTITLE-PROXY] Serving subtitle, length:', content.length);

    // Return with proper CORS headers and content type
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/vtt; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('[SUBTITLE-PROXY] Error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy subtitle' },
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
