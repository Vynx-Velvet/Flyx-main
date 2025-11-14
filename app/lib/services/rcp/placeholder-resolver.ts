/**
 * Placeholder Resolver
 * 
 * Resolves CDN placeholder variables in M3U8 URLs to actual domain names.
 * Generates all CDN variant URLs for failover support.
 * 
 * Placeholders like {v1}, {v2}, etc. are replaced with actual shadowlandschronicles domains.
 */

import { logger } from './logger';

/**
 * CDN placeholder mapping table
 * Maps placeholder variables to their corresponding CDN domains
 */
const PLACEHOLDER_MAP: Record<string, string[]> = {
  '{v1}': ['shadowlandschronicles.com'],
  '{v2}': ['shadowlandschronicles.net'],
  '{v3}': ['shadowlandschronicles.io'],
  '{v4}': ['shadowlandschronicles.org'],
  '{v5}': ['shadowlandschronicles.com'], // Fallback to v1
};

/**
 * PlaceholderResolver class
 * 
 * Handles resolution of CDN placeholders in M3U8 URLs
 */
export class PlaceholderResolver {
  private requestId: string;

  constructor(requestId: string) {
    this.requestId = requestId;
  }

  /**
   * Resolve all placeholders in a URL and generate CDN variants
   * 
   * @param url - URL that may contain placeholders like {v1}, {v2}, etc.
   * @returns Array of resolved URLs with primary first
   * 
   * @example
   * // Single placeholder
   * resolve("https://{v1}/path/master.m3u8")
   * // Returns: ["https://shadowlandschronicles.com/path/master.m3u8"]
   * 
   * @example
   * // Multiple placeholders
   * resolve("https://{v1}/path/{v2}/master.m3u8")
   * // Returns: ["https://shadowlandschronicles.com/path/shadowlandschronicles.net/master.m3u8"]
   * 
   * @example
   * // No placeholders
   * resolve("https://example.com/master.m3u8")
   * // Returns: ["https://example.com/master.m3u8"]
   */
  resolve(url: string): string[] {
    const startTime = Date.now();

    // Find all placeholders in the URL
    const placeholders = url.match(/\{[^}]+\}/g);

    // If no placeholders, return original URL
    if (!placeholders || placeholders.length === 0) {
      logger.debug(this.requestId, 'PlaceholderResolver', 'No placeholders found in URL', {
        url,
        duration: Date.now() - startTime,
      });
      return [url];
    }

    logger.debug(this.requestId, 'PlaceholderResolver', 'Found placeholders', {
      url,
      placeholders,
    });

    // Recursively resolve all placeholders
    const resolvedUrls = this.resolveRecursive(url);

    logger.info(this.requestId, 'PlaceholderResolver', 'Resolved placeholders', {
      originalUrl: url,
      resolvedCount: resolvedUrls.length,
      primaryUrl: resolvedUrls[0],
      duration: Date.now() - startTime,
    });

    return resolvedUrls;
  }

  /**
   * Recursively resolve placeholders in a URL
   * 
   * @param url - URL to resolve
   * @returns Array of all possible resolved URLs
   */
  private resolveRecursive(url: string): string[] {
    const urls: string[] = [];

    // Find all placeholders in the URL
    const placeholders = url.match(/\{[^}]+\}/g);

    // Base case: no more placeholders
    if (!placeholders || placeholders.length === 0) {
      return [url];
    }

    // Get the first placeholder
    const firstPlaceholder = placeholders[0];

    // Get replacement domains for this placeholder
    const replacements = PLACEHOLDER_MAP[firstPlaceholder];

    if (!replacements || replacements.length === 0) {
      // Unknown placeholder - keep it as is and log warning
      logger.warn(this.requestId, 'PlaceholderResolver', 'Unknown placeholder', {
        placeholder: firstPlaceholder,
        url,
      });

      // Try to extract the placeholder content and use it as-is
      const fallback = firstPlaceholder.slice(1, -1); // Remove { and }
      const newUrl = url.replace(firstPlaceholder, fallback);
      return this.resolveRecursive(newUrl);
    }

    // Generate URLs for each replacement
    for (const replacement of replacements) {
      const newUrl = url.replace(firstPlaceholder, replacement);

      // Recursively resolve remaining placeholders
      const resolvedUrls = this.resolveRecursive(newUrl);
      urls.push(...resolvedUrls);
    }

    return urls;
  }

  /**
   * Check if a URL contains unresolved placeholders
   * 
   * @param url - URL to check
   * @returns true if URL contains placeholders
   */
  hasPlaceholders(url: string): boolean {
    return /\{[^}]+\}/.test(url);
  }

  /**
   * Get all supported placeholder variables
   * 
   * @returns Array of supported placeholder strings
   */
  static getSupportedPlaceholders(): string[] {
    return Object.keys(PLACEHOLDER_MAP);
  }

  /**
   * Get CDN domains for a specific placeholder
   * 
   * @param placeholder - Placeholder string (e.g., "{v1}")
   * @returns Array of CDN domains or undefined if not found
   */
  static getDomainsForPlaceholder(placeholder: string): string[] | undefined {
    return PLACEHOLDER_MAP[placeholder];
  }
}

/**
 * Singleton instance for convenience
 * Note: Creates a new instance per request to maintain request ID context
 */
export function createPlaceholderResolver(requestId: string): PlaceholderResolver {
  return new PlaceholderResolver(requestId);
}

/**
 * Utility function to resolve placeholders without creating an instance
 * 
 * @param url - URL to resolve
 * @param requestId - Request ID for logging
 * @returns Array of resolved URLs
 */
export function resolvePlaceholders(url: string, requestId: string = 'unknown'): string[] {
  const resolver = new PlaceholderResolver(requestId);
  return resolver.resolve(url);
}
