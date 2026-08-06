/**
 * Network-related error classes.
 */

import { ErrorCode } from "../types/error";
import { FlyxError } from "./FlyxError";

/**
 * Wraps a low-level network error (fetch failure, DNS, TLS, etc.).
 *
 * Always retryable by default since network errors are often transient.
 */
export class NetworkError extends FlyxError {
  /**
   * @param original - The original error that was caught.
   * @param url - The URL being fetched when the error occurred.
   */
  constructor(
    original: Error,
    public readonly url?: string,
  ) {
    super(
      original.message || "Network request failed",
      ErrorCode.NETWORK_ERROR,
      0, // No HTTP status since the request never completed
      true,
      {
        originalName: original.name,
        url: url ?? null,
      },
    );
  }
}

/**
 * Thrown when a request exceeds its timeout.
 */
export class TimeoutError extends FlyxError {
  constructor(
    public readonly url: string,
    timeoutMs: number,
  ) {
    super(
      `Request to ${url} timed out after ${timeoutMs}ms`,
      ErrorCode.TIMEOUT,
      504,
      true,
      { url, timeoutMs },
    );
  }
}

/**
 * Thrown when a provider or API returns a 429 Too Many Requests.
 */
export class RateLimitedError extends FlyxError {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(
      message,
      ErrorCode.RATE_LIMITED,
      429,
      true,
      { retryAfterMs: retryAfterMs ?? null },
    );
  }
}

/**
 * Thrown when a request is blocked by Cloudflare's anti-bot protection.
 *
 * This typically means the proxy or extraction worker was detected
 * and needs a configuration update (user-agent, headers, or IP rotation).
 */
export class CloudflareBlockedError extends FlyxError {
  constructor(
    public readonly url: string,
    public readonly cfRay?: string,
  ) {
    super(
      `Request blocked by Cloudflare protection${cfRay ? ` (Ray: ${cfRay})` : ""}`,
      ErrorCode.CLOUDFLARE_BLOCKED,
      403,
      false,
      { url, cfRay: cfRay ?? null },
    );
  }
}
