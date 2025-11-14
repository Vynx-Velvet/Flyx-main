/**
 * Stream retry utility for handling expired URLs
 */

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  onRetry?: (attempt: number, error: any) => void;
}

export class StreamRetryManager {
  private static instance: StreamRetryManager;
  private retryCache = new Map<string, number>();

  static getInstance(): StreamRetryManager {
    if (!StreamRetryManager.instance) {
      StreamRetryManager.instance = new StreamRetryManager();
    }
    return StreamRetryManager.instance;
  }

  /**
   * Check if a stream URL has expired based on common error patterns
   */
  isStreamExpired(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const statusCode = error.status || error.statusCode;

    // Common patterns for expired streams
    return (
      statusCode === 404 ||
      statusCode === 403 ||
      statusCode === 410 ||
      errorMessage.includes('not found') ||
      errorMessage.includes('expired') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('unavailable')
    );
  }

  /**
   * Retry stream extraction with exponential backoff
   */
  async retryStreamExtraction(
    tmdbId: string,
    mediaType: 'movie' | 'tv',
    season?: number,
    episode?: number,
    options: RetryOptions = {}
  ): Promise<any> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      onRetry
    } = options;

    const cacheKey = `${tmdbId}-${mediaType}-${season || 0}-${episode || 0}`;
    const currentRetries = this.retryCache.get(cacheKey) || 0;

    if (currentRetries >= maxRetries) {
      throw new Error(`Max retries (${maxRetries}) exceeded for stream extraction`);
    }

    try {
      // Build extraction URL
      let extractUrl = `/api/stream/extract?tmdbId=${tmdbId}&type=${mediaType}`;
      if (season) extractUrl += `&season=${season}`;
      if (episode) extractUrl += `&episode=${episode}`;

      const response = await fetch(extractUrl);
      const data = await response.json();

      if (data.success) {
        // Reset retry count on success
        this.retryCache.delete(cacheKey);
        return data.data;
      } else {
        throw new Error(data.error || 'Stream extraction failed');
      }
    } catch (error) {
      const newRetryCount = currentRetries + 1;
      this.retryCache.set(cacheKey, newRetryCount);

      if (onRetry) {
        onRetry(newRetryCount, error);
      }

      if (newRetryCount < maxRetries) {
        // Wait before retrying with exponential backoff
        const delay = retryDelay * Math.pow(2, newRetryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.retryStreamExtraction(tmdbId, mediaType, season, episode, options);
      } else {
        throw error;
      }
    }
  }

  /**
   * Clear retry cache for a specific stream
   */
  clearRetryCache(tmdbId: string, mediaType: string, season?: number, episode?: number): void {
    const cacheKey = `${tmdbId}-${mediaType}-${season || 0}-${episode || 0}`;
    this.retryCache.delete(cacheKey);
  }

  /**
   * Clear all retry cache
   */
  clearAllRetryCache(): void {
    this.retryCache.clear();
  }
}

export const streamRetryManager = StreamRetryManager.getInstance();