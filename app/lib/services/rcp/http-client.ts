/**
 * Shared HTTP client for RCP extraction with proper headers and timeout handling
 */

import { ExtractionError, ERROR_CODES } from './types';

/**
 * Default headers for HTTP requests
 */
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Cache-Control': 'max-age=0',
};

/**
 * HTTP client options
 */
export interface HttpClientOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  referer?: string;
  origin?: string;
}

/**
 * HTTP response wrapper
 */
export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body: string;
  url: string;
}

/**
 * Shared HTTP client for making requests with proper error handling
 */
export class HttpClient {
  private defaultTimeout: number = 10000;
  private defaultRetries: number = 2;

  /**
   * Fetch a URL with timeout and retry logic
   */
  async fetch(
    url: string,
    options: HttpClientOptions = {},
    requestId: string
  ): Promise<HttpResponse> {
    const timeout = options.timeout || this.defaultTimeout;
    const maxRetries = options.retries !== undefined ? options.retries : this.defaultRetries;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, options, timeout, requestId);
        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && error.message.includes('status: 4')) {
          throw this.createExtractionError(
            ERROR_CODES.NETWORK_ERROR,
            `HTTP error: ${error.message}`,
            requestId,
            { url, attempt }
          );
        }
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw this.createExtractionError(
            ERROR_CODES.NETWORK_ERROR,
            `Failed after ${maxRetries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
            requestId,
            { url, attempts: maxRetries + 1 }
          );
        }
        
        // Exponential backoff before retry
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
        await this.sleep(backoffMs);
      }
    }
    
    // This should never be reached, but TypeScript needs it
    throw this.createExtractionError(
      ERROR_CODES.NETWORK_ERROR,
      `Failed to fetch ${url}: ${lastError?.message || 'Unknown error'}`,
      requestId,
      { url }
    );
  }

  /**
   * Fetch with timeout using AbortController
   */
  private async fetchWithTimeout(
    url: string,
    options: HttpClientOptions,
    timeout: number,
    requestId: string
  ): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Build headers
      const headers: Record<string, string> = {
        ...DEFAULT_HEADERS,
        ...options.headers,
      };

      // Add referer if provided
      if (options.referer) {
        headers['Referer'] = options.referer;
      }

      // Add origin if provided
      if (options.origin) {
        headers['Origin'] = options.origin;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const body = await response.text();

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body,
        url: response.url,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw this.createExtractionError(
            ERROR_CODES.TIMEOUT,
            `Request timeout after ${timeout}ms`,
            requestId,
            { url, timeout }
          );
        }
        throw error;
      }

      throw new Error('Unknown error during fetch');
    }
  }

  /**
   * Create a standardized extraction error
   */
  private createExtractionError(
    code: string,
    message: string,
    requestId: string,
    details?: any
  ): ExtractionError {
    return {
      code,
      message,
      details,
      requestId,
    };
  }

  /**
   * Sleep utility for backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set default timeout
   */
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Set default retries
   */
  setDefaultRetries(retries: number): void {
    this.defaultRetries = retries;
  }
}

/**
 * Singleton instance
 */
export const httpClient = new HttpClient();
