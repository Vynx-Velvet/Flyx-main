/**
 * Stream Extract API - Self-Hosted Decoder (Primary Method)
 * 
 * Uses the self-hosted decoder running on Vercel's Node.js runtime
 * GET /api/stream/extract?tmdbId=550&type=movie
 * GET /api/stream/extract?tmdbId=1396&type=tv&season=1&episode=1
 */

import { NextRequest, NextResponse } from 'next/server';
import { extract2EmbedStreams } from '@/app/lib/services/2embed-extractor';
import { performanceMonitor } from '@/app/lib/utils/performance-monitor';

// Node.js runtime (default) - required for fetch

// Enhanced in-memory cache with LRU eviction
const cache = new Map<string, { sources: any[]; timestamp: number; hits: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes (increased for better performance)
const MAX_CACHE_SIZE = 500; // Maximum cache entries

// IMDB ID cache - separate cache for IMDB lookups
const imdbCache = new Map<string, { imdbId: string; timestamp: number }>();
const IMDB_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Request deduplication - prevent duplicate concurrent requests
const pendingRequests = new Map<string, Promise<any>>();

// Cache management - LRU eviction
function evictOldestCacheEntry() {
  if (cache.size < MAX_CACHE_SIZE) return;

  let oldestKey = '';
  let oldestTime = Date.now();
  let lowestHits = Infinity;

  // Find least recently used with lowest hits
  const entries = Array.from(cache.entries());
  for (const [key, value] of entries) {
    if (value.timestamp < oldestTime || (value.timestamp === oldestTime && value.hits < lowestHits)) {
      oldestTime = value.timestamp;
      lowestHits = value.hits;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    cache.delete(oldestKey);
    console.log(`[CACHE] Evicted: ${oldestKey}`);
  }
}

/**
 * Get IMDB ID from TMDB with caching
 */
async function getImdbId(tmdbId: string, type: 'movie' | 'tv'): Promise<string | null> {
  const cacheKey = `${tmdbId}-${type}`;

  // Check IMDB cache
  const cached = imdbCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < IMDB_CACHE_TTL) {
    console.log('[IMDB] Cache hit');
    return cached.imdbId;
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (!apiKey) {
      throw new Error('TMDB API key not configured');
    }

    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${apiKey}`;

    // Use fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      // Add caching headers
      next: { revalidate: 86400 } // Cache for 24 hours
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    const imdbId = data.imdb_id || null;

    // Cache the result
    if (imdbId) {
      imdbCache.set(cacheKey, { imdbId, timestamp: Date.now() });
    }

    return imdbId;
  } catch (error) {
    console.error('[EXTRACT] Failed to get IMDB ID:', error);
    return null;
  }
}

/**
 * Complete extraction flow using 2Embed with multi-quality support
 */
async function extractWith2Embed(
  tmdbId: string,
  type: 'movie' | 'tv',
  season?: number,
  episode?: number
): Promise<any[]> {
  console.log('[EXTRACT] Using 2Embed extractor (2embed.cc → player4u → yesmovies.baby)');

  // Get IMDB ID from TMDB
  const imdbId = await getImdbId(tmdbId, type);
  if (!imdbId) {
    throw new Error('Failed to get IMDB ID from TMDB');
  }

  console.log(`[EXTRACT] Got IMDB ID: ${imdbId}`);

  const result = await extract2EmbedStreams(imdbId, season, episode);

  if (!result.success || result.sources.length === 0) {
    throw new Error(result.error || 'Failed to extract streams');
  }

  console.log(`[EXTRACT] Successfully extracted ${result.sources.length} quality options`);
  console.log('[EXTRACT] Source URLs:');
  result.sources.forEach((s, i) => {
    console.log(`  [${i + 1}] ${s.url}`);
  });
  return result.sources;
}

/**
 * GET /api/stream/extract
 * 
 * Query params:
 * - tmdbId: TMDB ID (required)
 * - type: 'movie' or 'tv' (required)
 * - season: Season number (required for TV)
 * - episode: Episode number (required for TV)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse parameters
    const tmdbId = searchParams.get('tmdbId') || '';
    const type = searchParams.get('type') as 'movie' | 'tv';
    const season = searchParams.get('season') ? parseInt(searchParams.get('season')!) : undefined;
    const episode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!) : undefined;
    const provider = searchParams.get('provider') || '2embed';

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

    console.log('[EXTRACT] Request:', { tmdbId, type, season, episode, provider });
    performanceMonitor.start('stream-extraction');

    // Check cache
    const cacheKey = `${tmdbId}-${type}-${season || ''}-${episode || ''}-${provider}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[EXTRACT] Cache hit (${cached.hits} hits)`);

      // Update cache stats
      cached.hits++;
      cached.timestamp = Date.now(); // Refresh timestamp on access

      const executionTime = Date.now() - startTime;

      // Return multiple quality sources
      const sources = cached.sources.map((source: any) => ({
        quality: source.quality,
        title: source.title || source.quality,
        url: `/api/stream-proxy?url=${encodeURIComponent(source.url)}&source=${provider}&referer=${encodeURIComponent(source.referer)}`,
        directUrl: source.url,
        referer: source.referer,
        type: source.type,
        requiresSegmentProxy: source.requiresSegmentProxy
      }));

      return NextResponse.json({
        success: true,
        sources,
        // Backward compatibility - return first source as default
        streamUrl: sources[0].url,
        url: sources[0].url,
        provider: provider,
        requiresProxy: true,
        requiresSegmentProxy: true,
        cached: true,
        cacheHits: cached.hits,
        executionTime
      });
    }

    // Check if there's already a pending request for this content
    if (pendingRequests.has(cacheKey)) {
      console.log('[EXTRACT] Waiting for existing request to complete...');
      const sources = await pendingRequests.get(cacheKey)!;

      const executionTime = Date.now() - startTime;
      const proxiedSources = sources.map((source: any) => ({
        quality: source.quality,
        title: source.title || source.quality,
        url: `/api/stream-proxy?url=${encodeURIComponent(source.url)}&source=${provider}&referer=${encodeURIComponent(source.referer)}`,
        directUrl: source.url,
        referer: source.referer,
        type: source.type,
        requiresSegmentProxy: source.requiresSegmentProxy
      }));

      return NextResponse.json({
        success: true,
        sources: proxiedSources,
        streamUrl: proxiedSources[0].url,
        url: proxiedSources[0].url,
        provider: provider,
        requiresProxy: true,
        requiresSegmentProxy: true,
        cached: false,
        deduplicated: true,
        executionTime
      });
    }

    // Create a promise for this extraction
    let extractionPromise;
    if (provider === 'moviesapi') {
      const { extractMoviesApiStreams } = await import('@/app/lib/services/moviesapi-extractor');
      extractionPromise = extractMoviesApiStreams(tmdbId, type, season, episode).then(res => {
        if (!res.success) throw new Error(res.error || 'MoviesApi extraction failed');
        return res.sources;
      });
    } else {
      extractionPromise = extractWith2Embed(tmdbId, type, season, episode);
    }

    pendingRequests.set(cacheKey, extractionPromise);

    try {
      // Extract
      const sources = await extractionPromise;

      // Remove from pending requests
      pendingRequests.delete(cacheKey);

      // Evict old entries if cache is full
      evictOldestCacheEntry();

      // Cache result with initial hit count
      cache.set(cacheKey, {
        sources,
        timestamp: Date.now(),
        hits: 1
      });

      const executionTime = Date.now() - startTime;
      performanceMonitor.end('stream-extraction', {
        tmdbId,
        type,
        sources: sources.length,
        cached: false,
        provider
      });
      console.log(`[EXTRACT] Success in ${executionTime}ms - ${sources.length} qualities`);

      // Return proxied URLs
      const proxiedSources = sources.map((source: any) => ({
        quality: source.quality,
        title: source.title || source.quality,
        url: `/api/stream-proxy?url=${encodeURIComponent(source.url)}&source=${provider}&referer=${encodeURIComponent(source.referer)}`,
        directUrl: source.url,
        referer: source.referer,
        type: source.type,
        requiresSegmentProxy: source.requiresSegmentProxy
      }));

      return NextResponse.json({
        success: true,
        sources: proxiedSources,
        // Backward compatibility - return first source as default
        streamUrl: proxiedSources[0].url,
        url: proxiedSources[0].url,
        provider: provider,
        requiresProxy: true,
        requiresSegmentProxy: true,
        cached: false,
        executionTime
      });
    } catch (error) {
      // Remove from pending requests on error
      pendingRequests.delete(cacheKey);
      throw error;
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('[EXTRACT] ERROR:', error);
    console.error('[EXTRACT] Stack:', error instanceof Error ? error.stack : 'No stack');

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isCloudflareBlock = errorMessage.includes('Cloudflare') || errorMessage.includes('anti-bot') || errorMessage.includes('unavailable');
    const isDecoderFailed = errorMessage.includes('decoder') || errorMessage.includes('decoding');
    const isAllProvidersFailed = errorMessage.includes('All providers failed');

    return NextResponse.json(
      {
        error: isDecoderFailed ? 'Stream extraction temporarily unavailable' : isAllProvidersFailed ? 'No streams available' : isCloudflareBlock ? 'Stream source temporarily unavailable' : 'Failed to extract stream',
        details: errorMessage,
        suggestion: isDecoderFailed ? 'The stream provider has updated their protection. This will be fixed soon. Please try a different title for now.' : isAllProvidersFailed ? 'This content may not be available from any provider at the moment.' : isCloudflareBlock ? 'The stream provider is currently blocking automated requests. Please try again in a few minutes.' : 'Please try again or select a different title.',
        executionTime,
        isTemporary: true
      },
      { status: 503 }
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
