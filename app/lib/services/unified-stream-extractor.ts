/**
 * UNIFIED STREAM EXTRACTOR
 * 
 * Tries multiple providers with automatic fallback
 * Pure fetch-based, lean and efficient
 */

import { extractM3U8 as extractVidSrc } from './vidsrc-extractor';
import { extractCloudstream } from './cloudstream-extractor';
import { extractSuperembed } from './superembed-extractor';
import { extract2Embed } from './2embed-extractor';

export interface StreamRequest {
  tmdbId: number;
  type: 'movie' | 'tv';
  season?: number;
  episode?: number;
}

export interface StreamResult {
  success: boolean;
  url?: string;
  urls?: string[]; // All URL variants
  provider?: string;
  method?: string;
  error?: string;
  attempts?: number;
}

/**
 * Extract stream URL with automatic provider fallback
 */
export async function extractStream(request: StreamRequest): Promise<StreamResult> {
  const { tmdbId, type, season, episode } = request;
  const tmdbIdStr = tmdbId.toString();
  
  // Provider functions with unified interface
  const providers = [
    { 
      name: 'vidsrc', 
      fn: async () => {
        const result = await extractVidSrc(request);
        return result.success && result.url ? [{ url: result.url, quality: 'auto' }] : [];
      }
    },
    {
      name: 'cloudstream',
      fn: async () => extractCloudstream(tmdbIdStr, type, season, episode)
    },
    {
      name: 'superembed',
      fn: async () => extractSuperembed(tmdbIdStr, type, season, episode)
    },
    {
      name: '2embed',
      fn: async () => extract2Embed(tmdbIdStr, type, season, episode)
    }
  ];
  
  let attempts = 0;
  const errors: string[] = [];
  
  for (const provider of providers) {
    attempts++;
    
    try {
      const results = await provider.fn();
      
      if (results && results.length > 0) {
        const urls = results.map(r => r.url);
        return {
          success: true,
          url: urls[0],
          urls,
          provider: provider.name,
          method: 'fetch',
          attempts
        };
      }
      
      errors.push(`${provider.name}: No streams found`);
      
    } catch (error) {
      errors.push(`${provider.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return {
    success: false,
    error: `All providers failed. ${errors.join('; ')}`,
    attempts
  };
}

/**
 * Extract with retry logic
 */
export async function extractStreamWithRetry(
  request: StreamRequest,
  maxRetries: number = 3
): Promise<StreamResult> {
  let lastError: string = '';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await extractStream(request);
    
    if (result.success) {
      return result;
    }
    
    lastError = result.error || 'Unknown error';
    
    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
  
  return {
    success: false,
    error: `Failed after ${maxRetries} attempts. Last error: ${lastError}`,
    attempts: maxRetries
  };
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
