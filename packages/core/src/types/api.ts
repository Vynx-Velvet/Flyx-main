/**
 * API communication types.
 *
 * @module api
 */

/** Standardised API error response body. */
export interface APIErrorResponse {
  /** Whether the request succeeded. */
  success: false;
  /** Machine-readable error code. */
  code: string;
  /** Human-readable error message. */
  message: string;
  /** HTTP status code. */
  statusCode: number;
  /** Whether the request can be retried. */
  retryable: boolean;
  /** Additional error context. */
  details?: Record<string, unknown>;
}

/** Standardised API success response body. */
export interface APISuccessResponse<T = unknown> {
  /** Whether the request succeeded. */
  success: true;
  /** Response data. */
  data: T;
  /** Optional metadata (pagination, timing, etc.). */
  meta?: Record<string, unknown>;
}

/** Union type for all API responses. */
export type APIResponse<T = unknown> = APISuccessResponse<T> | APIErrorResponse;

/** Retry configuration for fetch operations. */
export interface RetryConfig {
  /** Maximum number of retry attempts. */
  maxRetries: number;
  /** Base delay in milliseconds before exponential backoff. */
  baseDelayMs: number;
  /** Maximum total delay across all retries. */
  maxDelayMs: number;
  /** HTTP status codes that trigger a retry. */
  retryableStatuses?: number[];
  /** Custom backoff factor (default 2 for exponential). */
  backoffFactor?: number;
}

/** Fetch options with timeout support. */
export interface FetchWithTimeoutOptions extends RequestInit {
  /** Timeout in milliseconds. */
  timeoutMs?: number;
  /** Retry configuration. */
  retry?: RetryConfig;
}

/** Default cache TTLs in milliseconds. */
export const CACHE_DURATIONS = {
  /** Stream extraction results: 15 minutes. */
  streams: 15 * 60 * 1000,
  /** Provider configurations: 5 minutes. */
  providers: 5 * 60 * 1000,
  /** TMDB metadata: 60 minutes. */
  metadata: 60 * 60 * 1000,
  /** Search results: 5 minutes. */
  search: 5 * 60 * 1000,
  /** Live TV channel listings: 2 minutes. */
  livetv: 2 * 60 * 1000,
} as const;
