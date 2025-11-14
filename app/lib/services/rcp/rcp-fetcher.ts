/**
 * RCP Page Fetcher
 * 
 * Fetches CloudNestra RCP pages with proper headers, timeout, and retry logic.
 * This is step 3 in the extraction chain: VidSrc → Hash → RCP Page → ProRCP URL
 */

import { httpClient, HttpClientOptions } from './http-client';
import { logger } from './logger';
import { ERROR_CODES, ExtractionError } from './types';

/**
 * Options for RCP fetcher
 */
export interface RCPFetcherOptions {
  timeout?: number;
  retries?: number;
  referer?: string;
}

/**
 * RCP Fetcher class
 * 
 * Responsible for fetching CloudNestra RCP pages given a provider hash.
 * Handles URL construction, header management, timeouts, and retries.
 */
export class RCPFetcher {
  private readonly baseUrl = 'https://cloudnestra.com/rcp';
  private readonly defaultTimeout = 10000; // 10 seconds
  private readonly defaultRetries = 2;

  /**
   * Fetch RCP page for a given hash
   * 
   * @param hash - Base64-encoded provider hash
   * @param requestId - Request ID for logging
   * @param options - Optional configuration
   * @returns HTML content of the RCP page
   * @throws ExtractionError if fetch fails
   */
  async fetch(
    hash: string,
    requestId: string,
    options: RCPFetcherOptions = {}
  ): Promise<string> {
    const startTime = Date.now();
    const url = this.constructUrl(hash);
    
    logger.debug(
      requestId,
      'Fetching RCP page',
      { hash, url },
      undefined,
      'rcp-fetch'
    );

    try {
      // Prepare HTTP client options
      const httpOptions: HttpClientOptions = {
        timeout: options.timeout || this.defaultTimeout,
        retries: options.retries !== undefined ? options.retries : this.defaultRetries,
        referer: options.referer,
        origin: options.referer ? new URL(options.referer).origin : undefined,
      };

      // Fetch the RCP page
      const response = await httpClient.fetch(url, httpOptions, requestId);

      const duration = Date.now() - startTime;

      logger.info(
        requestId,
        'RCP page fetched successfully',
        { 
          url, 
          status: response.status,
          bodyLength: response.body.length 
        },
        undefined,
        'rcp-fetch',
        duration
      );

      return response.body;
    } catch (error) {
      const duration = Date.now() - startTime;

      // If it's already an ExtractionError, enhance it and re-throw
      if (this.isExtractionError(error)) {
        logger.error(
          requestId,
          'RCP fetch failed',
          { 
            hash, 
            url, 
            error: error.message,
            code: error.code 
          },
          undefined,
          'rcp-fetch',
          duration
        );
        throw error;
      }

      // Otherwise, create a new ExtractionError
      const extractionError: ExtractionError = {
        code: ERROR_CODES.RCP_FETCH_FAILED,
        message: `Failed to fetch RCP page: ${error instanceof Error ? error.message : 'Unknown error'}`,
        step: 'rcp-fetch',
        details: { hash, url },
        requestId,
      };

      logger.error(
        requestId,
        'RCP fetch failed',
        { 
          hash, 
          url, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        },
        undefined,
        'rcp-fetch',
        duration
      );

      throw extractionError;
    }
  }

  /**
   * Construct CloudNestra RCP URL from hash
   * 
   * @param hash - Base64-encoded provider hash
   * @returns Full RCP URL
   */
  private constructUrl(hash: string): string {
    // Remove any whitespace or newlines from hash
    const cleanHash = hash.trim();
    
    // Construct the full URL
    return `${this.baseUrl}/${cleanHash}`;
  }

  /**
   * Type guard to check if error is an ExtractionError
   */
  private isExtractionError(error: unknown): error is ExtractionError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'requestId' in error
    );
  }

  /**
   * Set default timeout for all requests
   */
  setDefaultTimeout(timeout: number): void {
    httpClient.setDefaultTimeout(timeout);
  }

  /**
   * Set default retries for all requests
   */
  setDefaultRetries(retries: number): void {
    httpClient.setDefaultRetries(retries);
  }
}

/**
 * Singleton instance
 */
export const rcpFetcher = new RCPFetcher();
