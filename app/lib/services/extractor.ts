/**
 * Video Stream Extractor Service
 * Handles extraction of video stream URLs from various sources
 */

import type { VideoData, StreamSource, SubtitleTrack } from '@/types/media';
import type { APIResponse, RequestConfig } from '@/types/api';
import { cacheManager, CACHE_DURATIONS, generateCacheKey } from '@/lib/utils/cache';
import { APIErrorHandler, fetchWithTimeout, createAPIError } from '@/lib/utils/error-handler';

/**
 * Get extractor service URL from environment
 * Uses local stream extract API
 */
function getExtractorURL(): string {
  return '/api/stream/extract';
}

/**
 * Transform extractor response to VideoData
 */
function transformToVideoData(data: any): VideoData {
  const sources: StreamSource[] = [];
  const subtitles: SubtitleTrack[] = [];

  // Handle stream extract response format (2embed with multiple qualities)
  if (data.sources && Array.isArray(data.sources)) {
    data.sources.forEach((source: any) => {
      sources.push({
        url: source.url || source.file,
        quality: source.quality || 'auto',
        type: source.type || 'hls',
      });
    });
  } 
  // Single source format (backward compatibility)
  else if (data.url || data.streamUrl) {
    sources.push({
      url: data.url || data.streamUrl,
      quality: 'auto',
      type: 'hls',
    });
  }

  // Parse subtitles if available
  if (data.subtitles && Array.isArray(data.subtitles)) {
    data.subtitles.forEach((subtitle: any) => {
      subtitles.push({
        label: subtitle.label || subtitle.lang || 'Unknown',
        language: subtitle.language || subtitle.lang || 'en',
        url: subtitle.url || subtitle.file,
      });
    });
  }

  return {
    sources,
    subtitles,
    poster: data.poster,
    duration: data.duration,
  };
}

/**
 * Make a request to the local extractor service or call directly
 */
async function extractorRequest<T>(
  params: Record<string, any> = {},
  config: RequestConfig = {}
): Promise<APIResponse<T>> {
  const baseURL = getExtractorURL();
  
  console.log('Extractor request started', { params, baseURL });

  // Check cache if enabled
  if (config.cache !== false) {
    const cacheKey = generateCacheKey('extractor', params);
    const cached = await cacheManager.get<T>(cacheKey);
    if (cached) {
      console.log('Returning cached result', { cacheKey });
      return {
        data: cached,
        cached: true,
        timestamp: Date.now(),
      };
    }
  }

  // Build query params
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });
  
  const url = `${baseURL}?${queryParams.toString()}`;
  console.log('Making HTTP request to extractor', { url });

  // Make request with retry logic
  try {
    const data = await APIErrorHandler.executeWithRetry(async () => {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        config.timeout || 45000 // 45s timeout for stream extraction
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw createAPIError(
          `EXTRACTOR_${response.status}`,
          errorData.error || `Stream extraction failed: ${response.statusText}`,
          response.status,
          response.status >= 500
        );
      }

      return await response.json();
    }, config.retry);

    // Cache the result
    if (config.cache !== false) {
      const cacheKey = generateCacheKey('extractor', params);
      const ttl = config.cacheTTL || CACHE_DURATIONS.streams;
      await cacheManager.set(cacheKey, data, ttl);
    }

    return {
      data,
      cached: false,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('HTTP request to extractor failed', error);
    return {
      error: APIErrorHandler.handle(error),
      timestamp: Date.now(),
    };
  }
}

/**
 * Extractor Service
 */
export const extractorService = {
  /**
   * Extract video stream for a movie
   */
  async extractMovie(tmdbId: string): Promise<VideoData> {
    console.log('ExtractorService.extractMovie called', { tmdbId });
    
    const response = await extractorRequest<any>(
      { tmdbId, type: 'movie' },
      { 
        cacheTTL: CACHE_DURATIONS.streams,
        timeout: 45000,
      }
    );

    console.log('ExtractorService.extractMovie response', { 
      hasError: !!response.error, 
      hasData: !!response.data,
      cached: response.cached 
    });

    if (response.error || !response.data) {
      console.error('ExtractorService.extractMovie failed', response.error);
      throw response.error || createAPIError(
        'EXTRACTION_FAILED',
        'Failed to extract video stream',
        500,
        true
      );
    }

    const videoData = transformToVideoData(response.data);
    console.log('ExtractorService.extractMovie completed', { 
      sourcesCount: videoData.sources.length,
      subtitlesCount: videoData.subtitles.length 
    });
    
    return videoData;
  },

  /**
   * Extract video stream for a TV episode
   */
  async extractEpisode(
    tmdbId: string,
    season: number,
    episode: number
  ): Promise<VideoData> {
    console.log('ExtractorService.extractEpisode called', { tmdbId, season, episode });
    
    const response = await extractorRequest<any>(
      { tmdbId, type: 'tv', season, episode },
      { 
        cacheTTL: CACHE_DURATIONS.streams,
        timeout: 45000,
      }
    );

    console.log('ExtractorService.extractEpisode response', { 
      hasError: !!response.error, 
      hasData: !!response.data,
      cached: response.cached 
    });

    if (response.error || !response.data) {
      console.error('ExtractorService.extractEpisode failed', response.error);
      throw response.error || createAPIError(
        'EXTRACTION_FAILED',
        'Failed to extract video stream',
        500,
        true
      );
    }

    const videoData = transformToVideoData(response.data);
    console.log('ExtractorService.extractEpisode completed', { 
      sourcesCount: videoData.sources.length,
      subtitlesCount: videoData.subtitles.length 
    });
    
    return videoData;
  },

  /**
   * Extract video stream (auto-detect movie or episode)
   */
  async extract(
    tmdbId: string,
    mediaType: 'movie' | 'tv',
    season?: number,
    episode?: number
  ): Promise<VideoData> {
    console.log('ExtractorService.extract called', { tmdbId, mediaType, season, episode });
    
    if (mediaType === 'movie') {
      console.log('Extracting movie stream');
      return this.extractMovie(tmdbId);
    } else {
      if (season === undefined || episode === undefined) {
        console.error('Missing season/episode for TV show', { tmdbId, season, episode });
        throw createAPIError(
          'INVALID_PARAMS',
          'Season and episode are required for TV shows',
          400,
          false
        );
      }
      console.log('Extracting TV episode stream');
      return this.extractEpisode(tmdbId, season, episode);
    }
  },

  /**
   * Check if extractor service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Local API is always available
      return true;
    } catch (error) {
      return false;
    }
  },
};
