/**
 * RCP Decoders - Main Entry Point
 * 
 * This is the primary interface for the decoder module.
 * All decoder operations should go through this file.
 * 
 * @example
 * ```typescript
 * import { decode } from './decoders';
 * 
 * const result = await decode({
 *   encoded: '=8Df6QXN7pHczZDSIhESVtke3hWY...',
 *   divId: 'TsA2KGDGux',
 *   requestId: 'req-123'
 * });
 * 
 * if (result.success) {
 *   console.log('URL:', result.url);
 *   console.log('Method:', result.method);
 * }
 * ```
 */

import { DecodeInput, DecodeResult, DecoderConfig } from './types';
import { DEFAULT_CONFIG } from './constants';
import { generateCacheKey, measureTime } from './utils';

// Import decoder strategies (to be implemented)
// import { fastPathDecode } from './strategies/fast-path';
// import { bruteForceDecode } from './strategies/brute-force';
// import { puppeteerDecode } from './strategies/puppeteer-fallback';

/**
 * Current configuration
 */
let config: DecoderConfig = { ...DEFAULT_CONFIG };

/**
 * Result cache
 */
const cache = new Map<string, { url: string; method: string; timestamp: number }>();

/**
 * Performance metrics
 */
const metrics = {
  totalAttempts: 0,
  successfulAttempts: 0,
  failedAttempts: 0,
  totalTime: 0,
  methodCounts: new Map<string, number>(),
};

/**
 * Main decode function
 * 
 * Attempts to decode an encoded string using multiple strategies:
 * 1. Fast path (most common methods)
 * 2. Brute force (combinations)
 * 3. Puppeteer fallback (live decoder extraction)
 * 
 * @param input - Decode input parameters
 * @returns Decode result
 */
export async function decode(input: DecodeInput): Promise<DecodeResult> {
  const startTime = Date.now();
  metrics.totalAttempts++;

  try {
    // Validate input
    if (!input.encoded || input.encoded.length < 10) {
      return {
        success: false,
        error: 'Invalid or missing encoded input',
        elapsed: Date.now() - startTime,
      };
    }

    // Check cache
    if (config.enableCaching) {
      const cacheKey = generateCacheKey(
        input.encoded,
        input.divId || '',
        input.dataI || ''
      );
      const cached = cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < config.cacheTTL) {
        metrics.successfulAttempts++;
        return {
          success: true,
          url: cached.url,
          method: cached.method,
          elapsed: Date.now() - startTime,
          metadata: {
            cached: true,
            strategy: 'fast-path',
          },
        };
      }
    }

    // Strategy 1: Fast Path
    // TODO: Implement fast path strategy
    // const fastPathResult = await fastPathDecode(input, config);
    // if (fastPathResult.success) {
    //   return handleSuccess(fastPathResult, input, startTime);
    // }

    // Strategy 2: Brute Force
    // TODO: Implement brute force strategy
    // const bruteForceResult = await bruteForceDecode(input, config);
    // if (bruteForceResult.success) {
    //   return handleSuccess(bruteForceResult, input, startTime);
    // }

    // Strategy 3: Puppeteer Fallback
    // TODO: Implement Puppeteer fallback
    // const puppeteerResult = await puppeteerDecode(input, config);
    // if (puppeteerResult.success) {
    //   return handleSuccess(puppeteerResult, input, startTime);
    // }

    // All strategies failed
    metrics.failedAttempts++;
    return {
      success: false,
      error: 'All decoder strategies failed',
      elapsed: Date.now() - startTime,
      details: {
        methodsAttempted: 0, // TODO: Track actual count
        puppeteerAttempted: true,
      },
    };
  } catch (error) {
    metrics.failedAttempts++;
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      elapsed: Date.now() - startTime,
    };
  }
}

/**
 * Handle successful decode
 */
function handleSuccess(
  result: DecodeResult,
  input: DecodeInput,
  startTime: number
): DecodeResult {
  if (!result.success) return result;

  metrics.successfulAttempts++;
  metrics.totalTime += Date.now() - startTime;

  // Update method counts
  const count = metrics.methodCounts.get(result.method) || 0;
  metrics.methodCounts.set(result.method, count + 1);

  // Cache result
  if (config.enableCaching) {
    const cacheKey = generateCacheKey(
      input.encoded,
      input.divId || '',
      input.dataI || ''
    );
    cache.set(cacheKey, {
      url: result.url,
      method: result.method,
      timestamp: Date.now(),
    });
  }

  return result;
}

/**
 * Set decoder configuration
 * 
 * @param newConfig - Partial configuration to merge
 */
export function setConfig(newConfig: Partial<DecoderConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current configuration
 * 
 * @returns Current configuration
 */
export function getConfig(): DecoderConfig {
  return { ...config };
}

/**
 * Enable or disable debug mode
 * 
 * @param enabled - Whether to enable debug mode
 */
export function setDebugMode(enabled: boolean): void {
  config.debug = enabled;
}

/**
 * Clear the result cache
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache statistics
 * 
 * @returns Cache stats
 */
export function getCacheStats() {
  return {
    size: cache.size,
    maxSize: 1000, // From constants
    hitRate: metrics.totalAttempts > 0
      ? (metrics.successfulAttempts / metrics.totalAttempts)
      : 0,
  };
}

/**
 * Get performance metrics
 * 
 * @returns Performance metrics
 */
export function getMetrics() {
  return {
    totalAttempts: metrics.totalAttempts,
    successfulAttempts: metrics.successfulAttempts,
    failedAttempts: metrics.failedAttempts,
    successRate: metrics.totalAttempts > 0
      ? metrics.successfulAttempts / metrics.totalAttempts
      : 0,
    avgTime: metrics.successfulAttempts > 0
      ? metrics.totalTime / metrics.successfulAttempts
      : 0,
    methodDistribution: Object.fromEntries(metrics.methodCounts),
  };
}

/**
 * Reset all metrics
 */
export function resetMetrics(): void {
  metrics.totalAttempts = 0;
  metrics.successfulAttempts = 0;
  metrics.failedAttempts = 0;
  metrics.totalTime = 0;
  metrics.methodCounts.clear();
}

/**
 * Get statistics for a specific method
 * 
 * @param methodId - Method identifier
 * @returns Method statistics
 */
export function getMethodStats(methodId: string) {
  const count = metrics.methodCounts.get(methodId) || 0;
  const successRate = metrics.successfulAttempts > 0
    ? count / metrics.successfulAttempts
    : 0;

  return {
    methodId,
    usageCount: count,
    successRate,
    percentage: metrics.totalAttempts > 0
      ? (count / metrics.totalAttempts) * 100
      : 0,
  };
}

/**
 * Export types for external use
 */
export * from './types';
export * from './constants';
export * from './utils';

/**
 * Export for backward compatibility with existing code
 * This allows gradual migration to the new structure
 */
export {
  decode as decodeWithCache,
  clearCache as clearDecodeCache,
  getCacheStats as getDecodeCacheStats,
};

/**
 * Default export
 */
export default {
  decode,
  setConfig,
  getConfig,
  setDebugMode,
  clearCache,
  getCacheStats,
  getMetrics,
  resetMetrics,
  getMethodStats,
};
