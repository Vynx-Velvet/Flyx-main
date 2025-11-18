/**
 * Test endpoint to verify subtitle fetching
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const imdbId = searchParams.get('imdbId') || 'tt0111161'; // Default to Shawshank Redemption
  
  try {
    console.log('[TEST-SUBTITLES] Testing with IMDB ID:', imdbId);
    
    const response = await fetch(`${request.nextUrl.origin}/api/subtitles?imdbId=${imdbId}`, {
      method: 'GET',
    });
    
    const data = await response.json();
    
    console.log('[TEST-SUBTITLES] Response:', {
      success: data.success,
      count: data.subtitles?.length || 0,
      subtitles: data.subtitles?.slice(0, 3) || []
    });
    
    return NextResponse.json({
      success: true,
      message: 'Subtitle test completed',
      imdbId,
      response: data
    });
    
  } catch (error) {
    console.error('[TEST-SUBTITLES] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
