/**
 * ProRCP URL Extractor Service
 * 
 * Extracts ProRCP player URLs from CloudNestra RCP pages using Cheerio
 * for reliable HTML parsing with regex fallback support.
 */

import * as cheerio from 'cheerio';
import { ProviderName } from './types';
import { logger } from './logger';

/**
 * Pattern matching result
 */
interface PatternMatch {
  path: string;
  patternName: string;
  patternIndex: number;
}

/**
 * Pattern success tracking for optimization
 */
interface PatternStats {
  attempts: number;
  successes: number;
  lastSuccess?: Date;
}

/**
 * ProRCPExtractor class with multiple pattern matching strategies
 */
export class ProRCPExtractor {
  private patternStats: Map<string, PatternStats> = new Map();
  private readonly BASE_URL = 'https://cloudnestra.com';

  /**
   * Pattern 1: jQuery iframe creation for prorcp
   * Example: $('<iframe>').attr('src', '/prorcp/BASE64_HASH')
   */
  private readonly PATTERN_JQUERY_PRORCP = /\$\(['"]<iframe>['"]\)\.attr\(['"]src['"],\s*['"]\/prorcp\/([^'"]+)['"]\)/g;

  /**
   * Pattern 2: Direct iframe tag for prorcp
   * Example: <iframe src="/prorcp/BASE64_HASH">
   */
  private readonly PATTERN_IFRAME_PRORCP = /<iframe[^>]+src=["']\/prorcp\/([^"']+)["']/g;

  /**
   * Pattern 3: JavaScript variable for prorcp
   * Example: var playerUrl = "/prorcp/BASE64_HASH";
   */
  private readonly PATTERN_VAR_PRORCP = /(?:var|let|const)\s+\w+\s*=\s*["']\/prorcp\/([^"']+)["']/g;

  /**
   * Pattern 4: SrcRCP variant detection
   * Example: <iframe src="/srcrcp/BASE64_HASH">
   */
  private readonly PATTERN_IFRAME_SRCRCP = /<iframe[^>]+src=["']\/srcrcp\/([^"']+)["']/g;

  /**
   * Pattern 5: jQuery iframe creation for srcrcp
   * Example: $('<iframe>').attr('src', '/srcrcp/BASE64_HASH')
   */
  private readonly PATTERN_JQUERY_SRCRCP = /\$\(['"]<iframe>['"]\)\.attr\(['"]src['"],\s*['"]\/srcrcp\/([^'"]+)['"]\)/g;

  /**
   * Pattern 6: JavaScript variable for srcrcp
   * Example: var playerUrl = "/srcrcp/BASE64_HASH";
   */
  private readonly PATTERN_VAR_SRCRCP = /(?:var|let|const)\s+\w+\s*=\s*["']\/srcrcp\/([^"']+)["']/g;

  /**
   * Pattern 7: Object property assignment for srcrcp
   * Example: url: "/srcrcp/BASE64_HASH"
   */
  private readonly PATTERN_OBJ_SRCRCP = /\w+\s*:\s*["']\/srcrcp\/([^"']+)["']/g;

  /**
   * Pattern 8: Object property assignment for prorcp
   * Example: url: "/prorcp/BASE64_HASH"
   */
  private readonly PATTERN_OBJ_PRORCP = /\w+\s*:\s*["']\/prorcp\/([^"']+)["']/g;

  /**
   * Extract ProRCP URL from CloudNestra RCP HTML using Cheerio first, then regex fallback
   * 
   * @param html - The HTML content to search
   * @param provider - The provider name for logging
   * @param requestId - Request ID for logging
   * @returns The full ProRCP URL or null if not found
   */
  public extract(html: string, provider: ProviderName, requestId: string): string | null {
    const startTime = Date.now();
    
    logger.debug(
      requestId,
      'Starting ProRCP URL extraction with Cheerio',
      { htmlLength: html.length },
      provider,
      'prorcp-extraction'
    );

    // Try Cheerio method first (most reliable)
    try {
      const result = this.extractWithCheerio(html, provider, requestId);
      if (result) {
        const duration = Date.now() - startTime;
        logger.info(
          requestId,
          'ProRCP URL extracted successfully with Cheerio',
          { fullUrl: result },
          provider,
          'prorcp-extraction',
          duration
        );
        return result;
      }
    } catch (error) {
      logger.debug(
        requestId,
        'Cheerio extraction failed, falling back to regex',
        { error: error instanceof Error ? error.message : String(error) },
        provider,
        'prorcp-extraction'
      );
    }

    // Fallback to regex patterns
    const patterns = this.getOrderedPatterns();
    
    for (let i = 0; i < patterns.length; i++) {
      const patternName = patterns[i].name;
      const pattern = patterns[i].regex;
      const pathPrefix = patterns[i].pathPrefix;
      
      this.trackAttempt(patternName);
      
      try {
        const match = this.tryPattern(html, pattern, patternName, pathPrefix, provider, requestId);
        
        if (match) {
          this.trackSuccess(patternName);
          
          // Construct full URL
          const fullUrl = this.constructUrl(match.path, pathPrefix);
          
          const duration = Date.now() - startTime;
          logger.info(
            requestId,
            `ProRCP URL extracted successfully using regex ${patternName}`,
            { 
              patternName,
              patternIndex: i,
              path: match.path,
              fullUrl
            },
            provider,
            'prorcp-extraction',
            duration
          );
          
          return fullUrl;
        }
      } catch (error) {
        logger.debug(
          requestId,
          `Pattern ${patternName} threw error`,
          { error: error instanceof Error ? error.message : String(error) },
          provider,
          'prorcp-extraction'
        );
      }
    }

    const duration = Date.now() - startTime;
    logger.warn(
      requestId,
      'ProRCP URL extraction failed',
      { 
        patternsAttempted: patterns.length,
        htmlLength: html.length
      },
      provider,
      'prorcp-extraction',
      duration
    );

    return null;
  }

  /**
   * Extract ProRCP URL using Cheerio (primary method)
   */
  private extractWithCheerio(html: string, provider: ProviderName, requestId: string): string | null {
    const $ = cheerio.load(html);
    
    // Look for iframe with src containing prorcp or srcrcp
    const iframes = $('iframe[src]');
    
    for (let i = 0; i < iframes.length; i++) {
      const src = $(iframes[i]).attr('src');
      if (src && (src.includes('/prorcp/') || src.includes('/srcrcp/'))) {
        const fullUrl = src.startsWith('http') ? src : `${this.BASE_URL}${src}`;
        
        logger.debug(
          requestId,
          'Found ProRCP iframe with Cheerio',
          { src, fullUrl },
          provider,
          'prorcp-extraction'
        );
        
        return fullUrl;
      }
    }
    
    // Also check for src: "..." pattern in script tags
    const scripts = $('script:not([src])');
    
    for (let i = 0; i < scripts.length; i++) {
      const scriptContent = $(scripts[i]).html();
      if (scriptContent) {
        const srcMatch = scriptContent.match(/src:\s*['"]([^'"]*(?:prorcp|srcrcp)[^'"]+)['"]/);
        if (srcMatch && srcMatch[1]) {
          const src = srcMatch[1];
          const fullUrl = src.startsWith('http') ? src : `${this.BASE_URL}${src}`;
          
          logger.debug(
            requestId,
            'Found ProRCP src in script with Cheerio',
            { src, fullUrl },
            provider,
            'prorcp-extraction'
          );
          
          return fullUrl;
        }
      }
    }
    
    return null;
  }

  /**
   * Try a single pattern against the HTML
   */
  private tryPattern(
    html: string,
    pattern: RegExp,
    patternName: string,
    _pathPrefix: string,
    provider: ProviderName,
    requestId: string
  ): PatternMatch | null {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    // For global patterns, collect all matches
    while ((match = pattern.exec(html)) !== null) {
      if (match[1]) {
        matches.push(match[1]);
      }
    }

    logger.debug(
      requestId,
      `Pattern ${patternName} found ${matches.length} potential matches`,
      { patternName, matchCount: matches.length },
      provider,
      'prorcp-extraction'
    );

    // Validate each match and return first valid one
    for (const candidate of matches) {
      if (this.isValidPath(candidate)) {
        return {
          path: candidate,
          patternName,
          patternIndex: 0
        };
      }
    }

    return null;
  }

  /**
   * Validate that a path looks reasonable
   */
  private isValidPath(path: string): boolean {
    // Check minimum length
    if (path.length < 10) {
      return false;
    }

    // Should not contain spaces or special characters that would break URLs
    if (/[\s<>{}|\\^`]/.test(path)) {
      return false;
    }

    // Should be a reasonable length (not too long)
    if (path.length > 500) {
      return false;
    }

    return true;
  }

  /**
   * Construct full URL from path
   */
  private constructUrl(path: string, pathPrefix: string): string {
    // If path already starts with http, return as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // If path starts with /, use it directly
    if (path.startsWith('/')) {
      return `${this.BASE_URL}${path}`;
    }

    // Otherwise, prepend the path prefix
    return `${this.BASE_URL}/${pathPrefix}/${path}`;
  }

  /**
   * Get patterns ordered by success rate
   */
  private getOrderedPatterns(): Array<{ name: string; regex: RegExp; pathPrefix: string }> {
    const patterns = [
      {
        name: 'jquery-prorcp',
        regex: this.PATTERN_JQUERY_PRORCP,
        pathPrefix: 'prorcp'
      },
      {
        name: 'iframe-prorcp',
        regex: this.PATTERN_IFRAME_PRORCP,
        pathPrefix: 'prorcp'
      },
      {
        name: 'var-prorcp',
        regex: this.PATTERN_VAR_PRORCP,
        pathPrefix: 'prorcp'
      },
      {
        name: 'obj-prorcp',
        regex: this.PATTERN_OBJ_PRORCP,
        pathPrefix: 'prorcp'
      },
      {
        name: 'iframe-srcrcp',
        regex: this.PATTERN_IFRAME_SRCRCP,
        pathPrefix: 'srcrcp'
      },
      {
        name: 'jquery-srcrcp',
        regex: this.PATTERN_JQUERY_SRCRCP,
        pathPrefix: 'srcrcp'
      },
      {
        name: 'var-srcrcp',
        regex: this.PATTERN_VAR_SRCRCP,
        pathPrefix: 'srcrcp'
      },
      {
        name: 'obj-srcrcp',
        regex: this.PATTERN_OBJ_SRCRCP,
        pathPrefix: 'srcrcp'
      }
    ];

    // Sort by success rate (successes / attempts)
    return patterns.sort((a, b) => {
      const statsA = this.patternStats.get(a.name);
      const statsB = this.patternStats.get(b.name);

      if (!statsA && !statsB) return 0;
      if (!statsA) return 1;
      if (!statsB) return -1;

      const rateA = statsA.attempts > 0 ? statsA.successes / statsA.attempts : 0;
      const rateB = statsB.attempts > 0 ? statsB.successes / statsB.attempts : 0;

      return rateB - rateA; // Higher rate first
    });
  }

  /**
   * Track pattern attempt
   */
  private trackAttempt(patternName: string): void {
    const stats = this.patternStats.get(patternName) || {
      attempts: 0,
      successes: 0
    };
    stats.attempts++;
    this.patternStats.set(patternName, stats);
  }

  /**
   * Track pattern success
   */
  private trackSuccess(patternName: string): void {
    const stats = this.patternStats.get(patternName);
    if (stats) {
      stats.successes++;
      stats.lastSuccess = new Date();
      this.patternStats.set(patternName, stats);
    }
  }

  /**
   * Get pattern statistics (for monitoring/debugging)
   */
  public getPatternStats(): Map<string, PatternStats> {
    return new Map(this.patternStats);
  }

  /**
   * Reset pattern statistics
   */
  public resetPatternStats(): void {
    this.patternStats.clear();
  }
}

/**
 * Singleton instance
 */
export const proRcpExtractor = new ProRCPExtractor();
