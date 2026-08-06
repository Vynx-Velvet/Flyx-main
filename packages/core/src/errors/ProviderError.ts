/**
 * Provider-specific error classes.
 */

import { ErrorCode } from "../types/error";
import { FlyxError } from "./FlyxError";

/**
 * Thrown when a single provider fails during extraction.
 *
 * These errors are collected during provider fallback iteration;
 * if all providers fail, they are aggregated into an
 * {@link AllProvidersFailedError}.
 */
export class ProviderError extends FlyxError {
  /**
   * @param message - What went wrong.
   * @param provider - The provider that failed.
   * @param code - Error code (defaults to `PROVIDER_ERROR`).
   * @param statusCode - HTTP status (defaults to 502).
   * @param retryable - Whether to retry (defaults to true).
   */
  constructor(
    message: string,
    public readonly provider: string,
    code: string = ErrorCode.PROVIDER_ERROR,
    statusCode: number = 502,
    retryable: boolean = true,
  ) {
    super(message, code as never, statusCode, retryable, { provider });
  }
}

/**
 * Thrown when every available provider has been tried and all failed.
 *
 * The {@link attempts} array contains the individual provider errors
 * for debugging and user feedback.
 */
export class AllProvidersFailedError extends FlyxError {
  /** Individual provider failures, in the order they were attempted. */
  public readonly attempts: { provider: string; error: string }[];

  constructor(attempts: { provider: string; error: string }[]) {
    const message =
      attempts.length === 0
        ? "No providers available for this content"
        : `All ${attempts.length} provider(s) failed: ${attempts.map((a) => `${a.provider} (${a.error})`).join(", ")}`;

    super(message, ErrorCode.ALL_PROVIDERS_FAILED, 502, true, {
      attemptCount: attempts.length,
      attempts,
    });

    this.attempts = attempts;
  }
}

/**
 * Thrown when a requested provider is not found in the registry.
 */
export class ProviderNotFoundError extends FlyxError {
  constructor(providerName: string) {
    super(
      `Provider "${providerName}" not found in registry`,
      ErrorCode.PROVIDER_NOT_FOUND,
      404,
      false,
      { providerName },
    );
  }
}

/**
 * Thrown when a provider exists but is currently disabled.
 */
export class ProviderDisabledError extends FlyxError {
  constructor(providerName: string) {
    super(
      `Provider "${providerName}" is currently disabled`,
      ErrorCode.PROVIDER_DISABLED,
      503,
      false,
      { providerName },
    );
  }
}
