/**
 * Hidden Div Extractor Service
 * 
 * Extracts encoded M3U8 URL data from hidden div elements in ProRCP pages.
 * The hidden divs contain encoded data that must be decoded using various methods.
 */

import * as cheerio from 'cheerio';
import { ProviderName, HiddenDivData } from './types';
import { logger } from './logger';

/**
 * HiddenDivExtractor class using Cheerio for reliable HTML parsing
 */
export class HiddenDivExtractor {

  /**
   * Reset pattern statistics (no-op for Cheerio implementation)
   * @deprecated Pattern statistics are not tracked in Cheerio implementation
   */
  public resetPatternStats(): void {
    // No-op for backward compatibility
  }

  /**
   * Get pattern statistics (returns empty map for Cheerio implementation)
   * @deprecated Pattern statistics are not tracked in Cheerio implementation
   */
  public getPatternStats(): Map<string, any> {
    return new Map();
  }

  /**
   * Extract hidden div data from ProRCP HTML using Cheerio
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
      'Starting hidden div extraction with Cheerio',
      { htmlLength: html.length },
      provider,
      'hidden-div-extraction'
    );

    try {
      const $ = cheerio.load(html);
      
      let result: HiddenDivData | null = null;
      
      // Iterate through all divs
      $('div').each((_i, elem) => {
        const $elem = $(elem);
        const style = $elem.attr('style');
        const id = $elem.attr('id');
        const content = $elem.html();
        
        // Look for hidden divs with display:none and substantial content
        if (style && style.includes('display:none') && id && content && content.length > 50) {
          // Validate the content looks like encoded data
          if (this.isValidHiddenDiv(id, content)) {
            result = {
              divId: id,
              encoded: content
            };
            
            logger.info(
              requestId,
              'Hidden div extracted successfully with Cheerio',
              { 
                divId: id,
                encodedLength: content.length
              },
              provider,
              'hidden-div-extraction',
              Date.now() - startTime
            );
            
            return false; // Stop iteration
          }
        }
      });

      if (!result) {
        const duration = Date.now() - startTime;
        logger.warn(
          requestId,
          'Hidden div extraction failed - no valid hidden div found',
          { htmlLength: html.length },
          provider,
          'hidden-div-extraction',
          duration
        );
      }

      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        requestId,
        'Hidden div extraction error',
        { error: error instanceof Error ? error.message : String(error) },
        provider,
        'hidden-div-extraction',
        duration
      );
      return null;
    }
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
}

/**
 * Singleton instance
 */
export const hiddenDivExtractor = new HiddenDivExtractor();
