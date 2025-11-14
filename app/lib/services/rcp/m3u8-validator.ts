/**
 * M3U8 URL Validator
 * 
 * Validates M3U8 streaming URLs to ensure they are properly formatted
 * and ready for use. Performs multiple validation checks including
 * protocol, domain, extension, and placeholder resolution.
 */

import { logger } from './logger';
import { ERROR_CODES } from './types';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * M3U8Validator class
 * 
 * Validates M3U8 URLs before they are returned to clients
 */
export class M3U8Validator {
  private requestId: string;

  constructor(requestId: string) {
    this.requestId = requestId;
  }

  /**
   * Validate an M3U8 URL
   * 
   * Performs the following checks:
   * 1. URL has protocol (http/https)
   * 2. URL has valid domain (using URL constructor)
   * 3. URL contains .m3u8 extension
   * 4. No unresolved placeholders remain
   * 5. Optional: HTTP HEAD request validation
   * 
   * @param url - M3U8 URL to validate
   * @param checkAvailability - Whether to perform HTTP HEAD request (default: false)
   * @returns ValidationResult with valid flag and optional error
   */
  async validate(url: string, checkAvailability: boolean = false): Promise<ValidationResult> {
    const startTime = Date.now();

    logger.debug(this.requestId, 'Starting validation', {
      url,
      checkAvailability,
    });

    // Check 1: Must have protocol
    const protocolResult = this.validateProtocol(url);
    if (!protocolResult.valid) {
      logger.warn(this.requestId, 'Protocol validation failed', {
        url,
        error: protocolResult.error,
        duration: Date.now() - startTime,
      });
      return protocolResult;
    }

    // Check 2: No unresolved placeholders (check before domain validation)
    // This is important because placeholders in hostname will fail domain validation
    const placeholderResult = this.validatePlaceholders(url);
    if (!placeholderResult.valid) {
      logger.warn(this.requestId, 'Placeholder validation failed', {
        url,
        error: placeholderResult.error,
        duration: Date.now() - startTime,
      });
      return placeholderResult;
    }

    // Check 3: Must have valid domain
    const domainResult = this.validateDomain(url);
    if (!domainResult.valid) {
      logger.warn(this.requestId, 'Domain validation failed', {
        url,
        error: domainResult.error,
        duration: Date.now() - startTime,
      });
      return domainResult;
    }

    // Check 4: Must contain .m3u8 extension
    const extensionResult = this.validateExtension(url);
    if (!extensionResult.valid) {
      logger.warn(this.requestId, 'Extension validation failed', {
        url,
        error: extensionResult.error,
        duration: Date.now() - startTime,
      });
      return extensionResult;
    }

    // Check 5: Optional HTTP HEAD request
    if (checkAvailability) {
      const availabilityResult = await this.validateAvailability(url);
      if (!availabilityResult.valid) {
        logger.warn(this.requestId, 'Availability validation failed', {
          url,
          error: availabilityResult.error,
          duration: Date.now() - startTime,
        });
        return availabilityResult;
      }
    }

    logger.info(this.requestId, 'Validation successful', {
      url,
      duration: Date.now() - startTime,
    });

    return { valid: true };
  }

  /**
   * Validate URL has protocol (http/https)
   * 
   * @param url - URL to validate
   * @returns ValidationResult
   */
  private validateProtocol(url: string): ValidationResult {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return {
        valid: false,
        error: 'URL must start with http:// or https://',
        errorCode: ERROR_CODES.M3U8_INVALID,
      };
    }

    return { valid: true };
  }

  /**
   * Validate URL has valid domain using URL constructor
   * 
   * @param url - URL to validate
   * @returns ValidationResult
   */
  private validateDomain(url: string): ValidationResult {
    try {
      const urlObj = new URL(url);

      // Check that hostname is not empty
      if (!urlObj.hostname || urlObj.hostname.length === 0) {
        return {
          valid: false,
          error: 'URL must have a valid hostname',
          errorCode: ERROR_CODES.M3U8_INVALID,
        };
      }

      // Check that hostname contains at least one dot (basic domain validation)
      if (!urlObj.hostname.includes('.')) {
        return {
          valid: false,
          error: 'URL hostname must be a valid domain',
          errorCode: ERROR_CODES.M3U8_INVALID,
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorCode: ERROR_CODES.M3U8_INVALID,
      };
    }
  }

  /**
   * Validate URL contains .m3u8 extension
   * 
   * @param url - URL to validate
   * @returns ValidationResult
   */
  private validateExtension(url: string): ValidationResult {
    if (!url.includes('.m3u8')) {
      return {
        valid: false,
        error: 'URL must contain .m3u8 extension',
        errorCode: ERROR_CODES.M3U8_INVALID,
      };
    }

    return { valid: true };
  }

  /**
   * Validate no unresolved placeholders remain
   * 
   * Checks for patterns like {v1}, {v2}, etc.
   * 
   * @param url - URL to validate
   * @returns ValidationResult
   */
  private validatePlaceholders(url: string): ValidationResult {
    // Check for any remaining placeholder patterns
    const placeholderPattern = /\{[^}]+\}/;
    
    if (placeholderPattern.test(url)) {
      const placeholders = url.match(/\{[^}]+\}/g);
      return {
        valid: false,
        error: `URL contains unresolved placeholders: ${placeholders?.join(', ')}`,
        errorCode: ERROR_CODES.M3U8_INVALID,
      };
    }

    return { valid: true };
  }

  /**
   * Validate URL is accessible via HTTP HEAD request
   * 
   * This is an optional check that adds latency but ensures
   * the URL is actually accessible.
   * 
   * @param url - URL to validate
   * @returns ValidationResult
   */
  private async validateAvailability(url: string): Promise<ValidationResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          valid: false,
          error: `URL returned status ${response.status}: ${response.statusText}`,
          errorCode: ERROR_CODES.M3U8_INVALID,
        };
      }

      return { valid: true };
    } catch (error) {
      // If it's an abort error, it's a timeout
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          valid: false,
          error: 'URL availability check timed out after 5 seconds',
          errorCode: ERROR_CODES.TIMEOUT,
        };
      }

      return {
        valid: false,
        error: `URL availability check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorCode: ERROR_CODES.NETWORK_ERROR,
      };
    }
  }

  /**
   * Quick validation without availability check
   * 
   * Convenience method for fast validation
   * 
   * @param url - URL to validate
   * @returns ValidationResult
   */
  async validateQuick(url: string): Promise<ValidationResult> {
    return this.validate(url, false);
  }

  /**
   * Full validation with availability check
   * 
   * Convenience method for thorough validation
   * 
   * @param url - URL to validate
   * @returns ValidationResult
   */
  async validateFull(url: string): Promise<ValidationResult> {
    return this.validate(url, true);
  }
}

/**
 * Create a new M3U8Validator instance
 * 
 * @param requestId - Request ID for logging
 * @returns M3U8Validator instance
 */
export function createM3U8Validator(requestId: string): M3U8Validator {
  return new M3U8Validator(requestId);
}

/**
 * Utility function to validate an M3U8 URL without creating an instance
 * 
 * @param url - URL to validate
 * @param requestId - Request ID for logging
 * @param checkAvailability - Whether to perform HTTP HEAD request
 * @returns ValidationResult
 */
export async function validateM3U8Url(
  url: string,
  requestId: string = 'unknown',
  checkAvailability: boolean = false
): Promise<ValidationResult> {
  const validator = new M3U8Validator(requestId);
  return validator.validate(url, checkAvailability);
}
