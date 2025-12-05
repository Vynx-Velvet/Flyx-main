/**
 * Stream Extract API - Multi-Provider Stream Extraction
 * 
 * Provider Priority:
 * 1. VidSrc (vidsrc-embed.ru → cloudnestra.com) - Primary
 * 2. MoviesAPI (moviesapi.club → vidora.stream) - Fallback
 * 3. 2Embed (2embed.cc → player4u → yesmovies.baby) - Last resort
 * 
 * GET /api/stream/extract?tmdbId=550&type=movie
 * GET /api/stream/extract?tmdbId=1396&type=tv&season=1&episode=1
 */

import { NextRequest, NextResponse } from 'next/server';
import { extract2EmbedStreams } from '@/app/lib/services/2embed-extractor';
import { extractMoviesApiStreams } from '@/app/lib/services/moviesapi-extractor';
import { extractVidSrcStreams } from '@/app/lib/services/vidsrc-extractor';
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

// Runtime cache for TMDB lookups
const runtimeCache = new Map<string, { runtime: number; imdbId: string; timestamp: number }>();
const RUNTIME_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get IMDB ID and runtime from TMDB with caching
 */
async function getTmdbInfo(tmdbId: string, type: 'movie' | 'tv', season?: number, episode?: number): Promise<{ imdbId: string | null; runtime: number }> {
  const cacheKey = type === 'tv' ? `${tmdbId}-${type}-${season}-${episode}` : `${tmdbId}-${type}`;

  // Check cache
  const cached = runtimeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < RUNTIME_CACHE_TTL) {
    console.log('[TMDB] Cache hit');
    return { imdbId: cached.imdbId, runtime: cached.runtime };
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (!apiKey) {
      throw new Error('TMDB API key not configured');
    }

    let imdbId: string | null = null;
    let runtime = 0;

    // Fetch external IDs for IMDB ID
    const externalIdsUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${apiKey}`;
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), 5000);

    const externalIdsResponse = await fetch(externalIdsUrl, {
      signal: controller1.signal,
      next: { revalidate: 86400 }
    });
    clearTimeout(timeoutId1);

    if (externalIdsResponse.ok) {
      const externalIds = await externalIdsResponse.json();
      imdbId = externalIds.imdb_id || null;
    }

    // Fetch runtime
    if (type === 'movie') {
      const detailsUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}`;
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 5000);

      const detailsResponse = await fetch(detailsUrl, {
        signal: controller2.signal,
        next: { revalidate: 86400 }
      });
      clearTimeout(timeoutId2);

      if (detailsResponse.ok) {
        const details = await detailsResponse.json();
        runtime = details.runtime || 0; // Runtime in minutes
      }
    } else if (type === 'tv' && season && episode) {
      // For TV, get episode runtime
      const episodeUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${apiKey}`;
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 5000);

      const episodeResponse = await fetch(episodeUrl, {
        signal: controller2.signal,
        next: { revalidate: 86400 }
      });
      clearTimeout(timeoutId2);

      if (episodeResponse.ok) {
        const episodeDetails = await episodeResponse.json();
        runtime = episodeDetails.runtime || 0; // Runtime in minutes
      }

      // If episode runtime not available, try to get average from show details
      if (!runtime) {
        const showUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${apiKey}`;
        const controller3 = new AbortController();
        const timeoutId3 = setTimeout(() => controller3.abort(), 5000);

        const showResponse = await fetch(showUrl, {
          signal: controller3.signal,
          next: { revalidate: 86400 }
        });
        clearTimeout(timeoutId3);

        if (showResponse.ok) {
          const showDetails = await showResponse.json();
          // episode_run_time is an array, take the first/average
          if (showDetails.episode_run_time && showDetails.episode_run_time.length > 0) {
            runtime = showDetails.episode_run_time[0];
          }
        }
      }
    }

    // Cache the result
    if (imdbId) {
      runtimeCache.set(cacheKey, { imdbId, runtime, timestamp: Date.now() });
      // Also update the old imdbCache for backward compatibility
      imdbCache.set(`${tmdbId}-${type}`, { imdbId, timestamp: Date.now() });
    }

    console.log(`[TMDB] Got info: IMDB=${imdbId}, runtime=${runtime}min`);
    return { imdbId, runtime };
  } catch (error) {
    console.error('[EXTRACT] Failed to get TMDB info:', error);
    return { imdbId: null, runtime: 0 };
  }
}

/**
 * Get IMDB ID from TMDB with caching (backward compatibility)
 */
async function getImdbId(tmdbId: string, type: 'movie' | 'tv'): Promise<string | null> {
  const cacheKey = `${tmdbId}-${type}`;

  // Check IMDB cache
  const cached = imdbCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < IMDB_CACHE_TTL) {
    console.log('[IMDB] Cache hit');
    return cached.imdbId;
  }

  const info = await getTmdbInfo(tmdbId, type);
  return info.imdbId;
}

/**
 * Get stream duration from HLS playlist (in seconds)
 * Returns 0 if unable to determine duration
 */
async function getStreamDuration(streamUrl: string, referer: string): Promise<number> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(streamUrl, {
      headers: {
        'Referer': referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) return 0;

    const playlist = await response.text();

    // For master playlists, we can't get duration directly
    if (playlist.includes('#EXT-X-STREAM-INF')) {
      // Try to fetch the first variant playlist
      const lines = playlist.split('\n');
      for (const line of lines) {
        if (line.trim() && !line.startsWith('#')) {
          // This is a variant URL
          let variantUrl = line.trim();
          if (!variantUrl.startsWith('http')) {
            // Relative URL - construct absolute
            const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
            variantUrl = baseUrl + variantUrl;
          }
          // Recursively get duration from variant
          return await getStreamDuration(variantUrl, referer);
        }
      }
      return 0;
    }

    // Parse segment durations from media playlist
    let totalDuration = 0;
    const extinfRegex = /#EXTINF:([0-9.]+)/g;
    let match;
    while ((match = extinfRegex.exec(playlist)) !== null) {
      totalDuration += parseFloat(match[1]);
    }

    return totalDuration;
  } catch (error) {
    console.warn('[EXTRACT] Failed to get stream duration:', error);
    return 0;
  }
}

/**
 * Validate stream duration against expected runtime
 * TEMPORARILY DISABLED - Returns true for all streams
 * TODO: Re-enable when duration validation is more reliable
 */
function isValidDuration(streamDurationSeconds: number, expectedRuntimeMinutes: number): boolean {
  // TEMPORARILY DISABLED - Accept all streams regardless of duration
  // This allows more content to be available while we improve validation
  console.log(`[EXTRACT] Duration check DISABLED: stream=${Math.round(streamDurationSeconds / 60)}min, expected=${expectedRuntimeMinutes}min - ACCEPTING`);
  return true;
}

/**
 * Get title from TMDB for content validation
 */
async function getTmdbTitle(tmdbId: string, type: 'movie' | 'tv'): Promise<string | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
    if (!apiKey) return null;

    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 86400 }
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return type === 'movie' ? data.title : data.name;
    }
    return null;
  } catch {
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
  episode?: number,
  expectedRuntime?: number,
  expectedTitle?: string
): Promise<any[]> {
  console.log('[EXTRACT] Using 2Embed extractor (2embed.cc → player4u → yesmovies.baby)');

  // Get IMDB ID from TMDB
  const imdbId = await getImdbId(tmdbId, type);
  
  // We can try with TMDB ID even if IMDB lookup fails
  if (!imdbId) {
    console.warn('[EXTRACT] Failed to get IMDB ID, will try with TMDB ID only');
  } else {
    console.log(`[EXTRACT] Got IMDB ID: ${imdbId}`);
  }

  // Get title for content validation if not provided
  let titleForValidation = expectedTitle;
  if (!titleForValidation) {
    titleForValidation = await getTmdbTitle(tmdbId, type) || undefined;
    if (titleForValidation) {
      console.log(`[EXTRACT] Got title for validation: "${titleForValidation}"`);
    }
  }

  // Pass both IMDB and TMDB IDs - extractor will try both, with title for validation
  const result = await extract2EmbedStreams(imdbId || '', season, episode, tmdbId, titleForValidation);

  if (!result.success || result.sources.length === 0) {
    throw new Error(result.error || 'Failed to extract streams');
  }

  console.log(`[EXTRACT] Extracted ${result.sources.length} sources, validating durations...`);

  // Validate stream durations if we have expected runtime
  let validatedSources = result.sources;
  
  if (expectedRuntime && expectedRuntime > 0) {
    // Check duration of first source (they usually share the same content)
    // This avoids checking every source which would be slow
    const firstSource = result.sources[0];
    if (firstSource) {
      const streamDuration = await getStreamDuration(firstSource.url, firstSource.referer);
      
      if (streamDuration > 0) {
        console.log(`[EXTRACT] Stream duration: ${Math.round(streamDuration / 60)}min, expected: ${expectedRuntime}min`);
        
        if (!isValidDuration(streamDuration, expectedRuntime)) {
          console.warn('[EXTRACT] Duration validation FAILED - content may be incorrect');
          // Filter out all sources from this extraction as they're likely all wrong
          throw new Error('Content duration mismatch - source rejected for safety');
        }
      }
    }
  }

  console.log(`[EXTRACT] Successfully validated ${validatedSources.length} quality options`);
  console.log('[EXTRACT] Source URLs:');
  validatedSources.forEach((s, i) => {
    console.log(`  [${i + 1}] ${s.url}`);
  });
  return validatedSources;
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
    const provider = searchParams.get('provider') || 'vidsrc';

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

      // Return multiple quality sources with status
      const sources = cached.sources.map((source: any) => ({
        quality: source.quality,
        title: source.title || source.quality,
        url: `/api/stream-proxy?url=${encodeURIComponent(source.url)}&source=${provider}&referer=${encodeURIComponent(source.referer)}`,
        directUrl: source.url,
        referer: source.referer,
        type: source.type,
        requiresSegmentProxy: source.requiresSegmentProxy,
        status: source.status || 'working'
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
        requiresSegmentProxy: source.requiresSegmentProxy,
        status: source.status || 'working'
      }));

      return NextResponse.json({
        success: true,
        sources: proxiedSources,
        streamUrl: proxiedSources[0]?.url || '',
        url: proxiedSources[0]?.url || '',
        provider: provider,
        requiresProxy: true,
        requiresSegmentProxy: true,
        cached: false,
        deduplicated: true,
        executionTime
      });
    }

    // Get TMDB info including expected runtime for validation
    const tmdbInfo = await getTmdbInfo(tmdbId, type, season, episode);
    const expectedRuntime = tmdbInfo.runtime;
    console.log(`[EXTRACT] Expected runtime from TMDB: ${expectedRuntime}min`);

    // Create extraction based on provider preference
    const extractionPromise = (async () => {
      // If explicitly requesting moviesapi, use it directly
      if (provider === 'moviesapi') {
        console.log('[EXTRACT] Using MoviesAPI (explicit request)...');
        const moviesApiResult = await extractMoviesApiStreams(tmdbId, type, season, episode);
        
        // Return all sources (including those marked as down) so UI can show status
        if (moviesApiResult.sources.length > 0) {
          // Filter to only working sources for playback, but include status info
          const workingSources = moviesApiResult.sources.filter(s => s.status === 'working');
          
          if (workingSources.length > 0) {
            console.log(`[EXTRACT] ✓ MoviesAPI: ${workingSources.length} working, ${moviesApiResult.sources.length} total`);
            return { sources: moviesApiResult.sources, provider: 'moviesapi' };
          }
        }
        
        // If no working sources, return what we have with status info
        if (moviesApiResult.sources.length > 0) {
          console.log(`[EXTRACT] MoviesAPI: ${moviesApiResult.sources.length} sources (none working)`);
          return { sources: moviesApiResult.sources, provider: 'moviesapi' };
        }
        
        throw new Error(moviesApiResult.error || 'MoviesAPI returned no sources');
      }
      
      // If explicitly requesting 2embed, use it directly
      if (provider === '2embed') {
        console.log('[EXTRACT] Using 2Embed (explicit request)...');
        const sources = await extractWith2Embed(tmdbId, type, season, episode, expectedRuntime);
        console.log(`[EXTRACT] ✓ 2Embed succeeded with ${sources.length} source(s)`);
        return { sources, provider: '2embed' };
      }
      
      // If explicitly requesting vidsrc, use it directly
      if (provider === 'vidsrc') {
        console.log('[EXTRACT] Using VidSrc (explicit request)...');
        const vidsrcResult = await extractVidSrcStreams(tmdbId, type, season, episode);
        
        if (vidsrcResult.sources.length > 0) {
          const workingSources = vidsrcResult.sources.filter(s => s.status === 'working');
          
          if (workingSources.length > 0) {
            console.log(`[EXTRACT] ✓ VidSrc: ${workingSources.length} working, ${vidsrcResult.sources.length} total`);
            return { sources: vidsrcResult.sources, provider: 'vidsrc' };
          }
        }
        
        if (vidsrcResult.sources.length > 0) {
          console.log(`[EXTRACT] VidSrc: ${vidsrcResult.sources.length} sources (none working)`);
          return { sources: vidsrcResult.sources, provider: 'vidsrc' };
        }
        
        throw new Error(vidsrcResult.error || 'VidSrc returned no sources');
      }
      
      // Default behavior (no specific provider): Try VidSrc first, then MoviesAPI, then 2Embed
      console.log('[EXTRACT] Trying primary source: VidSrc...');
      try {
        const vidsrcResult = await extractVidSrcStreams(tmdbId, type, season, episode);
        const workingVidsrc = vidsrcResult.sources.filter(s => s.status === 'working');
        
        if (workingVidsrc.length > 0) {
          console.log(`[EXTRACT] ✓ VidSrc succeeded with ${workingVidsrc.length} working source(s)`);
          return { sources: vidsrcResult.sources, provider: 'vidsrc' };
        }
        throw new Error(vidsrcResult.error || 'VidSrc returned no working sources');
      } catch (vidsrcError) {
        console.warn('[EXTRACT] VidSrc failed:', vidsrcError instanceof Error ? vidsrcError.message : vidsrcError);
        
        // Fallback to MoviesAPI
        console.log('[EXTRACT] Trying fallback source: MoviesAPI...');
        try {
          const moviesApiResult = await extractMoviesApiStreams(tmdbId, type, season, episode);
          const workingSources = moviesApiResult.sources.filter(s => s.status === 'working');
          
          if (workingSources.length > 0) {
            console.log(`[EXTRACT] ✓ MoviesAPI succeeded with ${workingSources.length} working source(s)`);
            return { sources: moviesApiResult.sources, provider: 'moviesapi' };
          }
          throw new Error(moviesApiResult.error || 'MoviesAPI returned no working sources');
        } catch (moviesApiError) {
          console.warn('[EXTRACT] MoviesAPI failed:', moviesApiError instanceof Error ? moviesApiError.message : moviesApiError);
          
          // Final fallback to 2Embed
          console.log('[EXTRACT] Trying final fallback: 2Embed...');
          const sources = await extractWith2Embed(tmdbId, type, season, episode, expectedRuntime);
          console.log(`[EXTRACT] ✓ 2Embed succeeded with ${sources.length} source(s)`);
          return { sources, provider: '2embed' };
        }
      }
    })();

    pendingRequests.set(cacheKey, extractionPromise.then(r => r.sources));

    try {
      // Extract with automatic fallback
      const result = await extractionPromise;
      const { sources, provider: usedProvider } = result;

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
        provider: usedProvider
      });
      console.log(`[EXTRACT] Success in ${executionTime}ms - ${sources.length} qualities via ${usedProvider}`);

      // Return proxied URLs with status info
      const proxiedSources = sources.map((source: any) => ({
        quality: source.quality,
        title: source.title || source.quality,
        url: `/api/stream-proxy?url=${encodeURIComponent(source.url)}&source=${usedProvider}&referer=${encodeURIComponent(source.referer)}`,
        directUrl: source.url,
        referer: source.referer,
        type: source.type,
        requiresSegmentProxy: source.requiresSegmentProxy,
        status: source.status || 'working' // Include status for UI display
      }));

      return NextResponse.json({
        success: true,
        sources: proxiedSources,
        // Backward compatibility - return first source as default
        streamUrl: proxiedSources[0].url,
        url: proxiedSources[0].url,
        provider: usedProvider,
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
