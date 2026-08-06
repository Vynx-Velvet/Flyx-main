/**
 * Base error class for the entire Flyx platform.
 *
 * Every error in Flyx 3.0 extends this class. It provides:
 * - A machine-readable error code
 * - HTTP status code mapping
 * - Retry-ability flag
 * - Structured details for debugging
 *
 * This replaces the 5+ fragmented error systems in Flyx 2.0:
 * - components/error/ (TypeScript, CSS modules)
 * - components/ErrorHandling/ (JavaScript, styled-jsx)
 * - utils/errorHandling/ (JavaScript)
 * - lib/utils/error-handler.ts (TypeScript, APIErrorHandler)
 * - lib/stream-errors.ts (AllProvidersFailedError)
 * - hooks/useErrorHandling.js
 */

import type { ErrorCodeType, ErrorCategory } from "../types/error";

/**
 * Base error for all Flyx-specific errors.
 *
 * @example
 * ```ts
 * throw new FlyxError(
 *   "Something went wrong",
 *   ErrorCode.INTERNAL_ERROR,
 *   500,
 *   false,
 * );
 * ```
 */
export class FlyxError extends Error {
  /**
   * @param message - Human-readable error description.
   * @param code - Machine-readable error code from `ErrorCode`.
   * @param statusCode - HTTP status code for API responses.
   * @param retryable - Whether the operation can be retried safely.
   * @param details - Additional structured context for debugging.
   */
  constructor(
    message: string,
    public readonly code: ErrorCodeType,
    public readonly statusCode: number = 500,
    public readonly retryable: boolean = false,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** The error category derived from the error code. */
  get category(): ErrorCategory {
    return FlyxError.codeToCategory(this.code);
  }

  /** Serialise to a JSON-safe API error response body. */
  toJSON(): {
    success: false;
    code: string;
    message: string;
    statusCode: number;
    retryable: boolean;
    details?: Record<string, unknown>;
  } {
    return {
      success: false,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      retryable: this.retryable,
      ...(this.details ? { details: this.details } : {}),
    };
  }

  /**
   * Map an error code to its category for UI display and logging.
   * @internal
   */
  static codeToCategory(code: ErrorCodeType): ErrorCategory {
    if (code.startsWith("PROVIDER")) return "provider";
    if (["NETWORK_ERROR", "TIMEOUT", "RATE_LIMITED", "CLOUDFLARE_BLOCKED"].includes(code))
      return "network";
    if (code.startsWith("EXTRACTION") || code === "DECODER_FAILED" || code === "NO_SOURCES_FOUND" || code === "M3U8_PARSE_ERROR")
      return "extraction";
    if (code.startsWith("VALIDATION") || code === "INVALID_MEDIA_TYPE" || code === "MISSING_PARAMETER")
      return "validation";
    if (code === "UNAUTHORIZED" || code === "FORBIDDEN") return "auth";
    if (code.startsWith("SYNC") || code === "INVALID_SYNC_CODE") return "sync";
    return "internal";
  }
}
