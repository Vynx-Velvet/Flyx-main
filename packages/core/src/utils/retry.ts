/**
 * Unified retry utility with exponential backoff.
 *
 * Replaces the duplicated retry logic from:
 * - `lib/utils/error-handler.ts` (retryWithBackoff, fetchWithTimeout)
 * - `lib/utils/stream-retry.ts` (StreamRetryManager)
 *
 * @module retry
 */

import { NetworkError, TimeoutError } from "../errors/NetworkError";
import type { RetryConfig, FetchWithTimeoutOptions } from "../types/api";

/** Default retry configuration. */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  backoffFactor: 2,
};

/**
 * Execute a fetch with timeout and automatic retry on failure.
 *
 * @param url - The URL to fetch.
 * @param options - Fetch options with optional timeout and retry config.
 * @returns The fetch Response.
 * @throws {TimeoutError} If the request exceeds the timeout.
 * @throws {NetworkError} If all retries are exhausted.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeoutMs, retry: retryConfig, ...fetchOptions } = options;
  const retry = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  const signal = fetchOptions.signal;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retry.maxRetries; attempt++) {
    // Check if already aborted
    if (signal?.aborted) {
      throw new NetworkError(
        new DOMException("The operation was aborted", "AbortError"),
        url,
      );
    }

    try {
      const controller = new AbortController();
      const combinedSignal = signal
        ? combineSignals(signal, controller.signal)
        : controller.signal;

      // Set timeout
      const timeoutId = timeoutMs
        ? setTimeout(() => controller.abort(new DOMException(`Timeout after ${timeoutMs}ms`, "TimeoutError")), timeoutMs)
        : null;

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: combinedSignal,
        });

        // Success
        if (response.ok) return response;

        // Check if this status is retryable
        if (retry.retryableStatuses?.includes(response.status)) {
          lastError = new NetworkError(
            new Error(`HTTP ${response.status}: ${response.statusText}`),
            url,
          );
        } else {
          // Non-retryable status — throw immediately
          throw new NetworkError(
            new Error(`HTTP ${response.status}: ${response.statusText}`),
            url,
          );
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    } catch (err) {
      if (err instanceof NetworkError) {
        lastError = err;
        // Don't retry if the error is not retryable
        if (!err.retryable) throw err;
      } else if (err instanceof DOMException && err.name === "TimeoutError") {
        lastError = new TimeoutError(url, timeoutMs ?? 0);
      } else if (err instanceof DOMException && err.name === "AbortError") {
        throw new NetworkError(err, url);
      } else {
        lastError = new NetworkError(err instanceof Error ? err : new Error(String(err)), url);
      }
    }

    // Don't wait after the last attempt
    if (attempt < retry.maxRetries) {
      const delay = Math.min(
        retry.baseDelayMs * Math.pow(retry.backoffFactor ?? 2, attempt),
        retry.maxDelayMs,
      );
      // Add jitter (±25%)
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      await sleep(delay + jitter);
    }
  }

  throw lastError ?? new NetworkError(new Error("Max retries exceeded"), url);
}

/**
 * Execute a function with retry logic.
 *
 * @param fn - The async function to retry.
 * @param config - Retry configuration.
 * @returns The function's return value.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const retry = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retry.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retry.maxRetries) {
        const delay = Math.min(
          retry.baseDelayMs * Math.pow(retry.backoffFactor ?? 2, attempt),
          retry.maxDelayMs,
        );
        const jitter = delay * 0.25 * (Math.random() * 2 - 1);
        await sleep(delay + jitter);
      }
    }
  }

  throw lastError ?? new Error("Max retries exceeded");
}

/** Promise-based sleep. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Combine two AbortSignals so either one can abort the operation.
 */
function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }

  return controller.signal;
}
