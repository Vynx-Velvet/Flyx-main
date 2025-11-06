/**
 * Stream Extraction API Route
 * GET /api/stream/extract
 * Extracts video stream URLs with quality detection, caching, and retry logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractorService } from '@/lib/services/extractor';
import { contentRateLimiter, getClientIP } from '@/lib/utils/api-rate-limiter';
import { extractQuerySchema, validateQuery } from '@/lib/validation/stream-schemas';
import type { VideoData, StreamSource } from '@/types/media';

export const dynamic = 'force-dynamic';

/**
 * Detect and categorize stream quality from URL or metadata
 */
function detectStreamQuality(source: StreamSource): StreamSource {
  const url = source.url.toLowerCase();
  
  // If quality is already set and not 'auto', return as is
  if (source.quality !== 'auto') {
    return source;
  }

  // Detect quality from URL patterns
  if (url.includes('1080') || url.includes('fhd')) {
    return { ...source, quality: '1080p' };
  }
  if (url.includes('720') || url.includes('hd')) {
    return { ...source, quality: '720p' };
  }
  if (url.includes('480') || url.includes('sd')) {
    return { ...source, quality: '480p' };
  }
  if (url.includes('360')) {
    return { ...source, quality: '360p' };
  }

  // Default to auto for HLS streams (adaptive bitrate)
  if (source.type === 'hls') {
    return { ...source, quality: 'auto' };
  }

  // Default to 720p for unknown MP4 sources
  return { ...source, quality: '720p' };
}

/**
 * Select best quality stream from available sources
 */
function selectBestQuality(sources: StreamSource[]): StreamSource | null {
  if (sources.length === 0) return null;

  // Prefer HLS streams with auto quality
  const hlsAuto = sources.find(s => s.type === 'hls' && s.quality === 'auto');
  if (hlsAuto) return hlsAuto;

  // Quality priority order
  const qualityOrder = ['1080p', '720p', '480p', '360p', 'auto'];
  
  for (const quality of qualityOrder) {
    const source = sources.find(s => s.quality === quality);
    if (source) return source;
  }

  // Return first available source as fallback
  return sources[0];
}

/**
 * Process video data to enhance quality detection
 */
function processVideoData(videoData: VideoData): VideoData {
  // Detect quality for all sources
  const processedSources = videoData.sources.map(detectStreamQuality);

  // Sort sources by quality (best first)
  const qualityOrder = { '1080p': 0, '720p': 1, '480p': 2, '360p': 3, 'auto': 4 };
  processedSources.sort((a, b) => {
    const orderA = qualityOrder[a.quality] ?? 999;
    const orderB = qualityOrder[b.quality] ?? 999;
    return orderA - orderB;
  });

  return {
    ...videoData,
    sources: processedSources,
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `extract_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Enhanced logging
  console.log(`[${requestId}] Stream extraction request started`, {
    url: request.url,
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get('user-agent')
  });

  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimit = contentRateLimiter.checkLimit(clientIP);

    if (!rateLimit.allowed) {
      console.log(`[${requestId}] Rate limit exceeded for IP: ${clientIP}`);
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
            'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
            'X-Request-ID': requestId,
          },
        }
      );
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    console.log(`[${requestId}] Query parameters:`, Object.fromEntries(searchParams.entries()));
    
    const validation = validateQuery(extractQuerySchema, searchParams);

    if (!validation.success) {
      console.log(`[${requestId}] Validation failed:`, validation.error);
      return NextResponse.json(
        {
          error: 'Validation error',
          message: validation.error,
          requestId,
        },
        { status: 400 }
      );
    }

    const { tmdbId, mediaType, season, episode } = validation.data;
    console.log(`[${requestId}] Validated parameters:`, { tmdbId, mediaType, season, episode });

    // Extract video stream with timeout handling (45s)
    console.log(`[${requestId}] Starting extraction via extractor service...`);
    const extractionStartTime = Date.now();
    
    const videoData = await extractorService.extract(
      tmdbId,
      mediaType,
      season,
      episode
    );
    
    const extractionDuration = Date.now() - extractionStartTime;
    console.log(`[${requestId}] Extraction completed in ${extractionDuration}ms`, {
      sourcesCount: videoData.sources.length,
      subtitlesCount: videoData.subtitles.length
    });

    // Process video data to enhance quality detection
    const processedData = processVideoData(videoData);

    // Select best quality stream
    const bestSource = selectBestQuality(processedData.sources);

    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}] Stream extraction completed successfully in ${responseTime}ms`);

    return NextResponse.json(
      {
        success: true,
        data: processedData,
        metadata: {
          tmdbId,
          mediaType,
          season,
          episode,
          sourceCount: processedData.sources.length,
          subtitleCount: processedData.subtitles.length,
          bestQuality: bestSource?.quality || 'unknown',
          responseTime: `${responseTime}ms`,
          requestId,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          'X-Response-Time': `${responseTime}ms`,
          'X-Request-ID': requestId,
        },
      }
    );
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    console.error(`[${requestId}] Stream extraction API error after ${responseTime}ms:`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
      originalError: error.originalError
    });

    // Handle timeout errors
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') {
      return NextResponse.json(
        {
          error: 'Request timeout',
          message: 'Stream extraction timed out after 30 seconds. Please try again.',
          retryable: true,
        },
        { 
          status: 504,
          headers: {
            'X-Response-Time': `${responseTime}ms`,
          },
        }
      );
    }

    // Handle extractor service unavailable
    if (error.code === 'NETWORK_ERROR' || error.statusCode === 503) {
      console.log(`[${requestId}] Service unavailable error detected`, {
        errorCode: error.code,
        statusCode: error.statusCode,
        message: error.message
      });
      
      return NextResponse.json(
        {
          error: 'Service unavailable',
          message: 'Stream extraction service is temporarily unavailable. Please try again later.',
          retryable: true,
          requestId,
          debug: {
            errorCode: error.code,
            originalMessage: error.message,
            duration: responseTime
          }
        },
        { 
          status: 503,
          headers: {
            'Retry-After': '60',
            'X-Response-Time': `${responseTime}ms`,
            'X-Request-ID': requestId,
          },
        }
      );
    }

    // Handle extraction failures
    if (error.code === 'EXTRACTION_FAILED') {
      return NextResponse.json(
        {
          error: 'Extraction failed',
          message: 'Failed to extract video stream. The content may not be available.',
          retryable: error.retryable || false,
        },
        { 
          status: 404,
          headers: {
            'X-Response-Time': `${responseTime}ms`,
          },
        }
      );
    }

    // Handle invalid parameters
    if (error.code === 'INVALID_PARAMS' || error.statusCode === 400) {
      return NextResponse.json(
        {
          error: 'Invalid parameters',
          message: error.message || 'Invalid request parameters',
          retryable: false,
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${responseTime}ms`,
          },
        }
      );
    }

    // Handle rate limiting from upstream service
    if (error.statusCode === 429) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Upstream service rate limit exceeded. Please try again later.',
          retryable: true,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-Response-Time': `${responseTime}ms`,
          },
        }
      );
    }

    // Generic error response
    console.log(`[${requestId}] Returning generic error response`, {
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code,
      statusCode: error.statusCode
    });
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to extract video stream. Please try again.',
        retryable: error.retryable || false,
        requestId,
        debug: {
          errorType: error.name,
          originalMessage: error.message,
          duration: responseTime,
          timestamp: new Date().toISOString()
        }
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${responseTime}ms`,
          'X-Request-ID': requestId,
        },
      }
    );
  }
}
