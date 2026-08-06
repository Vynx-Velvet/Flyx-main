/**
 * Error Handling and Retry Logic
 * Ported from Flyx 2.0 with APIError type inlined.
 */

export interface APIError {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Create an API error object
 */
export function createAPIError(
  code: string,
  message: string,
  statusCode: number,
  retryable = false,
): APIError {
  return { code, message, statusCode, retryable };
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error?.name === 'TypeError' && error.message?.includes('fetch')) {
    return true;
  }

  // HTTP status codes that are retryable
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
  if (error?.statusCode && retryableStatusCodes.includes(error.statusCode)) {
    return true;
  }

  // Timeout errors
  if (error?.name === 'AbortError' || error?.code === 'ETIMEDOUT') {
    return true;
  }

  return false;
}

/**
 * Parse error into APIError format
 */
export function parseError(error: any): APIError {
  // Already an APIError
  if (error?.code && error?.message && error?.statusCode !== undefined) {
    return error as APIError;
  }

  // HTTP response error
  if (error?.response) {
    return createAPIError(
      error.response.status.toString(),
      error.response.statusText || 'Request failed',
      error.response.status,
      isRetryableError(error),
    );
  }

  // Network error
  if (error?.name === 'TypeError' && error.message?.includes('fetch')) {
    return createAPIError(
      'NETWORK_ERROR',
      'Network request failed. Please check your connection.',
      0,
      true,
    );
  }

  // Timeout error
  if (error?.name === 'AbortError') {
    return createAPIError(
      'TIMEOUT',
      'Request timed out. Please try again.',
      408,
      true,
    );
  }

  // Generic error
  return createAPIError(
    'UNKNOWN_ERROR',
    error?.message || 'An unexpected error occurred',
    500,
    false,
  );
}

/**
 * Calculate delay for exponential backoff
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const delay =
    config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelay);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const apiError = parseError(error);

      // Don't retry if error is not retryable
      if (!apiError.retryable) {
        throw apiError;
      }

      // Don't retry if this was the last attempt
      if (attempt === config.maxAttempts) {
        throw apiError;
      }

      // Calculate delay and wait
      const delay = calculateBackoffDelay(attempt, config);
      console.warn(
        `Request failed (attempt ${attempt}/${config.maxAttempts}). Retrying in ${delay}ms...`,
        apiError.message,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw parseError(lastError);
}

/**
 * Fetch with timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Error handler class for consistent error handling
 */
export class APIErrorHandler {
  /**
   * Handle an error and return a formatted APIError
   */
  static handle(error: any): APIError {
    const apiError = parseError(error);

    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', apiError);
    }

    return apiError;
  }

  /**
   * Execute a request with retry logic
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    config?: RetryConfig,
  ): Promise<T> {
    try {
      return await retryWithBackoff(fn, config);
    } catch (error) {
      throw this.handle(error);
    }
  }
}
