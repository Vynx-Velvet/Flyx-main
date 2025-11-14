/**
 * Hidden Div Extractor Service
 * 
 * Extracts encoded M3U8 URL data from hidden div elements in ProRCP pages.
 * The hidden divs contain encoded data that must be decoded using various methods.
 */

import { ProviderName, HiddenDivData } from './types';
import { logger } from './logger';

/**
 * Pattern matching result
 */
interface PatternMatch {
  divId: string;
  encoded: string;
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
 * HiddenDivExtractor class with multiple pattern matching strategies
 */
export class HiddenDivExtractor {
  private patternStats: Map<string, PatternStats> = new Map();

  /**
   * Pattern 1: Hidden div with display:none style
   * Example: <div id="RANDOM_ID" style="display:none;">ENCODED_DATA</div>
   */
  private readonly PATTERN_DISPLAY_NONE = /<div[^>]+id=["']([^"']+)["'][^>]+style=["'][^"']*display:\s*none[^"']*["'][^>]*>([^<]+)<\/div>/gi;

  /**
   * Pattern 2: Hidden div with style attribute first
   * Example: <div style="display:none;" id="RANDOM_ID">ENCODED_DATA</div>
   */
  private readonly PATTERN_STYLE_FIRST = /<div[^>]+style=["'][^"']*display:\s*none[^"']*["'][^>]+id=["']([^"']+)["'][^>]*>([^<]+)<\/div>/gi;

  /**
   * Pattern 3: Hidden div with visibility:hidden
   * Example: <div id="RANDOM_ID" style="visibility:hidden;">ENCODED_DATA</div>
   */
  private readonly PATTERN_VISIBILITY_HIDDEN = /<div[^>]+id=["']([^"']+)["'][^>]+style=["'][^"']*visibility:\s*hidden[^"']*["'][^>]*>([^<]+)<\/div>/gi;

  /**
   * Pattern 4: Hidden div with class="hidden" or similar
   * Example: <div id="RANDOM_ID" class="hidden">ENCODED_DATA</div>
   */
  private readonly PATTERN_HIDDEN_CLASS = /<div[^>]+id=["']([^"']+)["'][^>]+class=["'][^"']*hidden[^"']*["'][^>]*>([^<]+)<\/div>/gi;

  /**
   * Pattern 5: Div with data-encoded attribute
   * Example: <div id="RANDOM_ID" data-encoded="ENCODED_DATA"></div>
   */
  private readonly PATTERN_DATA_ENCODED = /<div[^>]+id=["']([^"']+)["'][^>]+data-encoded=["']([^"']+)["']/gi;

  /**
   * Pattern 6: Any div with suspicious ID and content (fallback)
   * Example: <div id="enc_12345">ENCODED_DATA</div>
   */
  private readonly PATTERN_SUSPICIOUS_DIV = /<div[^>]+id=["']([a-zA-Z0-9_-]{8,})["'][^>]*>([A-Za-z0-9+\/=:]{50,})<\/div>/gi;

  /**
   * Extract hidden div data from ProRCP HTML
   * 
   * @param html - The HTML content to search
   * @param provider - The provider name for logging
   * @param requestId - Request ID for logging
   * @returns The hidden div data or null if not found
   */
  public extract(html: string, provider: ProviderName, requestId: string): HiddenDivData | null {
    const startTime = Date.now();
    
    logger.debug(
      requestId,
      'Starting hidden div extraction',
      { htmlLength: html.length },
      provider,
      'hidden-div-extraction'
    );

    // Try all patterns in order of historical success rate
    const patterns = this.getOrderedPatterns();
    
    for (let i = 0; i < patterns.length; i++) {
      const patternName = patterns[i].name;
      const pattern = patterns[i].regex;
      
      this.trackAttempt(patternName);
      
      try {
        const match = this.tryPattern(html, pattern, patternName, provider, requestId);
        
        if (match) {
          this.trackSuccess(patternName);
          
          const duration = Date.now() - startTime;
          logger.info(
            requestId,
            `Hidden div extracted successfully using ${patternName}`,
            { 
              patternName,
              patternIndex: i,
              divId: match.divId,
              encodedLength: match.encoded.length
            },
            provider,
            'hidden-div-extraction',
            duration
          );
          
          return {
            divId: match.divId,
            encoded: match.encoded
          };
        }
      } catch (error) {
        logger.debug(
          requestId,
          `Pattern ${patternName} threw error`,
          { error: error instanceof Error ? error.message : String(error) },
          provider,
          'hidden-div-extraction'
        );
      }
    }

    const duration = Date.now() - startTime;
    logger.warn(
      requestId,
      'Hidden div extraction failed',
      { 
        patternsAttempted: patterns.length,
        htmlLength: html.length
      },
      provider,
      'hidden-div-extraction',
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
    provider: ProviderName,
    requestId: string
  ): PatternMatch | null {
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
    
    const matches: Array<{ divId: string; encoded: string }> = [];
    let match: RegExpExecArray | null;

    // Collect all matches
    while ((match = pattern.exec(html)) !== null) {
      if (match[1] && match[2]) {
        matches.push({
          divId: match[1],
          encoded: match[2]
        });
      }
    }

    logger.debug(
      requestId,
      `Pattern ${patternName} found ${matches.length} potential matches`,
      { patternName, matchCount: matches.length },
      provider,
      'hidden-div-extraction'
    );

    // Validate each match and return first valid one
    for (const candidate of matches) {
      if (this.isValidHiddenDiv(candidate.divId, candidate.encoded)) {
        return {
          divId: candidate.divId,
          encoded: candidate.encoded,
          patternName,
          patternIndex: 0
        };
      }
    }

    return null;
  }

  /**
   * Validate that a hidden div match is valid
   */
  private isValidHiddenDiv(divId: string, encoded: string): boolean {
    // Validate div ID
    if (!divId || divId.length < 3) {
      return false;
    }

    // Div ID should not contain spaces or special characters
    if (/[\s<>{}|\\^`]/.test(divId)) {
      return false;
    }

    // Validate encoded data
    if (!encoded || encoded.length < 20) {
      return false;
    }

    // Encoded data should not contain HTML tags
    if (/<[^>]+>/.test(encoded)) {
      return false;
    }

    // Encoded data should not be just whitespace
    if (encoded.trim().length === 0) {
      return false;
    }

    // Check if it looks like encoded data (contains alphanumeric, +, /, =, :, or .)
    // This covers base64, hex, Caesar cipher, and other common encoding formats
    // Allow dots for URLs that might be encoded with Caesar cipher
    const encodedPattern = /^[A-Za-z0-9+\/=:.]+$/;
    if (!encodedPattern.test(encoded.trim())) {
      return false;
    }

    return true;
  }

  /**
   * Get patterns ordered by success rate
   */
  private getOrderedPatterns(): Array<{ name: string; regex: RegExp }> {
    const patterns = [
      {
        name: 'display-none',
        regex: this.PATTERN_DISPLAY_NONE
      },
      {
        name: 'style-first',
        regex: this.PATTERN_STYLE_FIRST
      },
      {
        name: 'visibility-hidden',
        regex: this.PATTERN_VISIBILITY_HIDDEN
      },
      {
        name: 'hidden-class',
        regex: this.PATTERN_HIDDEN_CLASS
      },
      {
        name: 'data-encoded',
        regex: this.PATTERN_DATA_ENCODED
      },
      {
        name: 'suspicious-div',
        regex: this.PATTERN_SUSPICIOUS_DIV
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
export const hiddenDivExtractor = new HiddenDivExtractor();
