/**
 * Hash Extraction Service
 * 
 * Extracts provider-specific hashes from VidSrc embed pages using multiple
 * pattern matching strategies with fallback support.
 */

import { ProviderName } from './types';
import { logger } from './logger';

/**
 * Pattern matching result
 */
interface PatternMatch {
  hash: string;
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
 * HashExtractor class with multiple pattern matching strategies
 */
export class HashExtractor {
  private patternStats: Map<string, PatternStats> = new Map();

  /**
   * Pattern 1: data-hash attribute with provider name
   * Example: <div data-hash="BASE64_HASH">2Embed</div>
   */
  private createDataHashPattern(providerName: string): RegExp {
    // Match data-hash attribute followed by provider name in content
    // Allow for whitespace variations in attribute syntax
    return new RegExp(
      `data-hash\\s*=\\s*["']([^"']+)["'][^>]*>[\\s\\S]*?${this.escapeRegex(providerName)}`,
      'i'
    );
  }

  /**
   * Pattern 2: jQuery iframe creation with atob
   * Example: $('<iframe>').attr('src', atob('BASE64_HASH'))
   */
  private readonly PATTERN_JQUERY_IFRAME = /\$\(['"]<iframe>['"]\)\.attr\(['"]src['"],\s*atob\(['"]([^'"]+)['"]\)/g;

  /**
   * Pattern 3: Direct iframe with base64 src
   * Example: <iframe src="data:text/html;base64,BASE64_HASH">
   */
  private readonly PATTERN_IFRAME_BASE64 = /<iframe[^>]+src=["']data:text\/html;base64,([^"']+)["']/g;

  /**
   * Pattern 4: JavaScript variable assignment
   * Example: var hash = "BASE64_HASH";
   */
  private readonly PATTERN_VAR_ASSIGNMENT = /var\s+\w+\s*=\s*["']([A-Za-z0-9+\/=]{50,})["']/g;

  /**
   * Extract hash from HTML using all available patterns
   * 
   * @param html - The HTML content to search
   * @param providerName - The provider name to search for
   * @param requestId - Request ID for logging
   * @returns The extracted hash or null if not found
   */
  public extract(html: string, providerName: ProviderName, requestId: string): string | null {
    const startTime = Date.now();
    
    logger.debug(
      requestId,
      `Starting hash extraction for provider: ${providerName}`,
      { htmlLength: html.length },
      providerName,
      'hash-extraction'
    );

    // Try all patterns in order of historical success rate
    const patterns = this.getOrderedPatterns(providerName);
    
    for (let i = 0; i < patterns.length; i++) {
      const patternName = patterns[i].name;
      const pattern = patterns[i].regex;
      
      this.trackAttempt(patternName);
      
      try {
        const match = this.tryPattern(html, pattern, patternName, providerName, requestId);
        
        if (match) {
          this.trackSuccess(patternName);
          
          const duration = Date.now() - startTime;
          logger.info(
            requestId,
            `Hash extracted successfully using ${patternName}`,
            { 
              patternName,
              patternIndex: i,
              hashLength: match.hash.length
            },
            providerName,
            'hash-extraction',
            duration
          );
          
          return match.hash;
        }
      } catch (error) {
        logger.debug(
          requestId,
          `Pattern ${patternName} threw error`,
          { error: error instanceof Error ? error.message : String(error) },
          providerName,
          'hash-extraction'
        );
      }
    }

    const duration = Date.now() - startTime;
    logger.warn(
      requestId,
      `Hash extraction failed for provider: ${providerName}`,
      { 
        patternsAttempted: patterns.length,
        htmlLength: html.length
      },
      providerName,
      'hash-extraction',
      duration
    );

    return null;
  }

  /**
   * Try a single pattern against the HTML
   */
  private tryPattern(
    html: string,
    pattern: RegExp,
    patternName: string,
    providerName: ProviderName,
    requestId: string
  ): PatternMatch | null {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    
    const matches: string[] = [];
    let match: RegExpExecArray | null;

    // For global patterns, collect all matches
    if (pattern.global) {
      while ((match = pattern.exec(html)) !== null) {
        if (match[1]) {
          matches.push(match[1]);
        }
      }
    } else {
      // For non-global patterns, get single match
      match = pattern.exec(html);
      if (match && match[1]) {
        matches.push(match[1]);
      }
    }

    logger.debug(
      requestId,
      `Pattern ${patternName} found ${matches.length} potential matches`,
      { patternName, matchCount: matches.length },
      providerName,
      'hash-extraction'
    );

    // Validate each match
    for (const candidate of matches) {
      if (this.isValidBase64(candidate)) {
        return {
          hash: candidate,
          patternName,
          patternIndex: 0
        };
      }
    }

    return null;
  }

  /**
   * Validate that a string is valid base64
   */
  private isValidBase64(str: string): boolean {
    // Check minimum length
    if (str.length < 20) {
      return false;
    }

    // Check for valid base64 characters
    const base64Regex = /^[A-Za-z0-9+\/]+=*$/;
    if (!base64Regex.test(str)) {
      return false;
    }

    // Check padding
    const paddingCount = (str.match(/=/g) || []).length;
    if (paddingCount > 2) {
      return false;
    }

    // Try to decode to verify it's valid base64
    try {
      if (typeof window !== 'undefined' && typeof window.atob === 'function') {
        atob(str);
      } else if (typeof Buffer !== 'undefined' && Buffer.from) {
        Buffer.from(str, 'base64');
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get patterns ordered by success rate
   */
  private getOrderedPatterns(providerName: ProviderName): Array<{ name: string; regex: RegExp }> {
    const patterns = [
      {
        name: 'data-hash-attribute',
        regex: this.createDataHashPattern(this.getProviderDisplayName(providerName))
      },
      {
        name: 'jquery-iframe-atob',
        regex: this.PATTERN_JQUERY_IFRAME
      },
      {
        name: 'iframe-base64-src',
        regex: this.PATTERN_IFRAME_BASE64
      },
      {
        name: 'var-assignment',
        regex: this.PATTERN_VAR_ASSIGNMENT
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
   * Get display name for provider (used in HTML)
   */
  private getProviderDisplayName(providerName: ProviderName): string {
    const displayNames: Record<ProviderName, string> = {
      '2embed': '2Embed',
      'superembed': 'Superembed',
      'cloudstream': 'CloudStream Pro'
    };
    return displayNames[providerName];
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

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Singleton instance
 */
export const hashExtractor = new HashExtractor();
