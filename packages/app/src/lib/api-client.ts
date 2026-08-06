/**
 * Enhanced API Client
 * Combines error handling, retry logic, offline detection, and SWR caching.
 * Ported from Flyx 2.0 — adapted for Flyx 3.0 monorepo.
 */

import {
  parseError,
  retryWithBackoff,
  fetchWithTimeout,
  DEFAULT_RETRY_CONFIG,
} from './utils/error-handler';
import type { APIError, RetryConfig } from './utils/error-handler';
import { offlineManager } from './utils/offline-manager';
import { swrCache } from './utils/swr-cache';

interface APIClientConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: RetryConfig;
  cache?: boolean;
  cacheTTL?: number;
  onError?: (error: APIError) => void;
}

class APIClient {
  private config: APIClientConfig;

  constructor(config: APIClientConfig = {}) {
    this.config = {
      timeout: 10000,
      retry: DEFAULT_RETRY_CONFIG,
      cache: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      ...config,
    };
  }

  /**
   * Make a GET request with full error handling and caching
   */
  async get<T>(
    endpoint: string,
    options: Partial<APIClientConfig> = {},
  ): Promise<T> {
    const url = this.buildURL(endpoint);
    const config = { ...this.config, ...options };

    // Use SWR cache if enabled
    if (config.cache) {
      return swrCache.get(
        url,
        () => this.fetchWithErrorHandling<T>(url, { method: 'GET' }, config),
        {
          ttl: config.cacheTTL!,
          staleTime: config.cacheTTL! / 5, // 20% of TTL
        },
      );
    }

    return this.fetchWithErrorHandling<T>(url, { method: 'GET' }, config);
  }

  /**
   * Make a POST request with error handling
   */
  async post<T>(
    endpoint: string,
    data?: unknown,
    options: Partial<APIClientConfig> = {},
  ): Promise<T> {
    const url = this.buildURL(endpoint);
    const config = { ...this.config, ...options };

    return this.fetchWithErrorHandling<T>(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
      },
      config,
    );
  }

  /**
   * Make a PUT request with error handling
   */
  async put<T>(
    endpoint: string,
    data?: unknown,
    options: Partial<APIClientConfig> = {},
  ): Promise<T> {
    const url = this.buildURL(endpoint);
    const config = { ...this.config, ...options };

    return this.fetchWithErrorHandling<T>(
      url,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
      },
      config,
    );
  }

  /**
   * Make a DELETE request with error handling
   */
  async delete<T>(
    endpoint: string,
    options: Partial<APIClientConfig> = {},
  ): Promise<T> {
    const url = this.buildURL(endpoint);
    const config = { ...this.config, ...options };

    return this.fetchWithErrorHandling<T>(url, { method: 'DELETE' }, config);
  }

  /**
   * Fetch with comprehensive error handling
   */
  private async fetchWithErrorHandling<T>(
    url: string,
    init: RequestInit,
    config: APIClientConfig,
  ): Promise<T> {
    // Check if offline
    if (offlineManager.getIsOffline()) {
      // Queue non-GET requests for later
      if (init.method && init.method !== 'GET') {
        offlineManager.queueRequest(url, init);
      }

      throw parseError({
        code: 'OFFLINE',
        message: 'You are currently offline. Request has been queued.',
        statusCode: 0,
        retryable: true,
      });
    }

    // Execute with retry logic
    try {
      return await retryWithBackoff(
        async () => {
          const response = await fetchWithTimeout(url, init, config.timeout);

          if (!response.ok) {
            const error = await this.parseResponseError(response);
            throw error;
          }

          // Handle empty responses
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            return {} as T;
          }

          return response.json();
        },
        config.retry,
      );
    } catch (error) {
      const apiError = parseError(error);

      // Call error handler if provided
      if (config.onError) {
        config.onError(apiError);
      }

      throw apiError;
    }
  }

  /**
   * Parse error from response
   */
  private async parseResponseError(response: Response): Promise<APIError> {
    let message = response.statusText;

    try {
      const data = await response.json();
      if (data.message) {
        message = data.message;
      } else if (data.error) {
        message = data.error;
      }
    } catch {
      // Ignore JSON parse errors
    }

    return {
      code: response.status.toString(),
      message: this.getUserFriendlyMessage(response.status, message),
      statusCode: response.status,
      retryable: this.isRetryableStatus(response.status),
    };
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(
    status: number,
    originalMessage: string,
  ): string {
    const friendlyMessages: Record<number, string> = {
      400: 'Invalid request. Please check your input and try again.',
      401: 'You need to be logged in to access this.',
      403: "You don't have permission to access this.",
      404: 'The requested content could not be found.',
      408: 'Request timed out. Please try again.',
      429: 'Too many requests. Please wait a moment and try again.',
      500: "Server error. We're working on fixing this.",
      502: 'Service temporarily unavailable. Please try again.',
      503: 'Service is currently down for maintenance.',
      504: 'Request timed out. Please try again.',
    };

    return (
      friendlyMessages[status] ||
      originalMessage ||
      'An unexpected error occurred.'
    );
  }

  /**
   * Check if status code is retryable
   */
  private isRetryableStatus(status: number): boolean {
    return [408, 429, 500, 502, 503, 504].includes(status);
  }

  /**
   * Build full URL
   */
  private buildURL(endpoint: string): string {
    if (endpoint.startsWith('http')) {
      return endpoint;
    }

    const baseURL = this.config.baseURL || '';
    return `${baseURL}${endpoint}`;
  }

  /**
   * Invalidate cache for a URL
   */
  invalidateCache(endpoint: string): void {
    const url = this.buildURL(endpoint);
    swrCache.invalidate(url);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    swrCache.clear();
  }
}

// Create default instance
export const apiClient = new APIClient();

// Export class for custom instances
export { APIClient };

/**
 * User-friendly error messages for common scenarios
 */
export function getErrorMessage(error: APIError): string {
  if (error.code === 'OFFLINE') {
    return 'You appear to be offline. Please check your internet connection.';
  }

  if (error.code === 'NETWORK_ERROR') {
    return 'Network error. Please check your connection and try again.';
  }

  if (error.code === 'TIMEOUT') {
    return 'Request timed out. Please try again.';
  }

  return error.message;
}

/**
 * Check if error should show retry button
 */
export function shouldShowRetry(error: APIError): boolean {
  return (
    error.retryable ||
    error.code === 'OFFLINE' ||
    error.code === 'NETWORK_ERROR'
  );
}
