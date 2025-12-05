/**
 * Stream Proxy API
 * 
 * Proxies HLS streams and their segments with proper referer headers.
 * This is essential for 2embed streams which require the referer header
 * on ALL requests (master.txt, playlists, and segments).
 * 
 * GET /api/stream-proxy?url=<encoded_url>&source=2embed&referer=<encoded_referer>
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Proxy a stream URL with proper headers
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');
    const source = searchParams.get('source') || '2embed';
    const referer = searchParams.get('referer') || 'https://www.2embed.cc';

    if (!url) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }

    const decodedUrl = decodeURIComponent(url);

    // Fetch with proper headers
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      'Referer': referer,
      'Origin': new URL(referer).origin,
    };

    const response = await fetch(decodedUrl, {
      headers,
      redirect: 'manual'
    });

    // Handle redirects by following them internally
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        // Follow the redirect internally instead of returning a redirect response
        const redirectUrl = new URL(location, decodedUrl).toString();
        const redirectResponse = await fetch(redirectUrl, {
          headers,
          redirect: 'follow'
        });
        
        if (!redirectResponse.ok) {
          return NextResponse.json(
            { error: `Redirect target error: ${redirectResponse.status}` },
            { status: redirectResponse.status }
          );
        }
        
        // Return the redirected content
        const redirectContentType = redirectResponse.headers.get('content-type') || '';
        const redirectArrayBuffer = await redirectResponse.arrayBuffer();
        
        // Detect actual content type from data
        const redirectFirstBytes = new Uint8Array(redirectArrayBuffer.slice(0, 4));
        const redirectIsMpegTs = redirectFirstBytes[0] === 0x47;
        const redirectIsFmp4 = (redirectFirstBytes[0] === 0x00 && redirectFirstBytes[1] === 0x00 && redirectFirstBytes[2] === 0x00);
        
        let redirectActualContentType = redirectContentType || 'video/mp2t';
        if (redirectIsMpegTs) {
          redirectActualContentType = 'video/mp2t';
        } else if (redirectIsFmp4) {
          redirectActualContentType = 'video/mp4';
        }
        
        return new NextResponse(redirectArrayBuffer, {
          status: 200,
          headers: {
            'Content-Type': redirectActualContentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Content-Type',
            'Cache-Control': 'public, max-age=3600',
            'Content-Length': redirectArrayBuffer.byteLength.toString(),
          },
        });
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    
    // Check if this is actually video data by looking at the first bytes
    // Some servers disguise video segments as .html files with text/html content-type
    const arrayBuffer = await response.arrayBuffer();
    const firstBytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const isMpegTs = firstBytes[0] === 0x47; // MPEG-TS sync byte
    const isFmp4 = (firstBytes[0] === 0x00 && firstBytes[1] === 0x00 && firstBytes[2] === 0x00); // fMP4 box
    const isVideoData = isMpegTs || isFmp4;
    
    // Only treat as playlist if:
    // 1. Content-type indicates playlist AND
    // 2. URL looks like a playlist AND
    // 3. Data doesn't look like video
    const isPlaylist = !isVideoData && (
      contentType.includes('mpegurl') || 
      decodedUrl.includes('.m3u8') || 
      decodedUrl.includes('.txt') ||
      (contentType.includes('text') && !decodedUrl.includes('.html'))
    );

    // For playlists, rewrite URLs to go through our proxy
    if (isPlaylist) {
      // Convert arrayBuffer back to text for playlist processing
      const text = new TextDecoder().decode(arrayBuffer);
      const rewrittenPlaylist = rewritePlaylistUrls(text, decodedUrl, source, referer);
      
      return new NextResponse(rewrittenPlaylist, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    // For segments, return the binary data with correct content type
    let actualContentType = 'video/mp2t';
    if (isMpegTs) {
      actualContentType = 'video/mp2t';
    } else if (isFmp4) {
      actualContentType = 'video/mp4';
    }
    
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': actualContentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Proxy error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Rewrite playlist URLs to go through our proxy
 * CRITICAL: Must preserve the FULL original URL in the proxy parameter
 * HANDLES: Master playlists, quality playlists, segment lists, AND URLs in HLS tags
 */
function rewritePlaylistUrls(
  playlist: string,
  baseUrl: string,
  source: string,
  referer: string
): string {
  const lines = playlist.split('\n');
  const rewritten: string[] = [];
  
  const base = new URL(baseUrl);
  const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
  
  // Helper function to resolve and proxy a URL
  const proxyUrl = (url: string): string => {
    let absoluteUrl: string;
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      absoluteUrl = url;
    } else if (url.startsWith('/')) {
      absoluteUrl = `${base.origin}${url}`;
    } else {
      absoluteUrl = `${base.origin}${basePath}${url}`;
    }
    
    return `/api/stream-proxy?url=${encodeURIComponent(absoluteUrl)}&source=${source}&referer=${encodeURIComponent(referer)}`;
  };
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Handle HLS tags that contain URIs
    if (line.startsWith('#EXT-X-MEDIA:') || line.startsWith('#EXT-X-I-FRAME-STREAM-INF:')) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      if (uriMatch) {
        const originalUri = uriMatch[1];
        const proxiedUri = proxyUrl(originalUri);
        rewritten.push(line.replace(`URI="${originalUri}"`, `URI="${proxiedUri}"`));
      } else {
        rewritten.push(line);
      }
      continue;
    }
    
    // Keep other comments and empty lines as-is
    if (line.startsWith('#') || trimmedLine === '') {
      rewritten.push(line);
      continue;
    }

    // This is a URL line - could be a playlist or segment
    if (!trimmedLine) {
      rewritten.push(line);
      continue;
    }
    
    try {
      rewritten.push(proxyUrl(trimmedLine));
    } catch (error) {
      rewritten.push(line);
    }
  }

  return rewritten.join('\n');
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  });
}
