/**
 * Error type definitions for the unified error hierarchy.
 *
 * @module error
 */

/** Standardised error codes used across the entire platform. */
export const ErrorCode = {
  // Provider errors
  PROVIDER_ERROR: "PROVIDER_ERROR",
  ALL_PROVIDERS_FAILED: "ALL_PROVIDERS_FAILED",
  PROVIDER_DISABLED: "PROVIDER_DISABLED",
  PROVIDER_NOT_FOUND: "PROVIDER_NOT_FOUND",

  // Network errors
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
  RATE_LIMITED: "RATE_LIMITED",
  CLOUDFLARE_BLOCKED: "CLOUDFLARE_BLOCKED",

  // Extraction errors
  EXTRACTION_FAILED: "EXTRACTION_FAILED",
  EXTRACTION_ABORTED: "EXTRACTION_ABORTED",
  DECODER_FAILED: "DECODER_FAILED",
  NO_SOURCES_FOUND: "NO_SOURCES_FOUND",
  M3U8_PARSE_ERROR: "M3U8_PARSE_ERROR",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_MEDIA_TYPE: "INVALID_MEDIA_TYPE",
  MISSING_PARAMETER: "MISSING_PARAMETER",

  // Auth errors
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",

  // Sync errors
  SYNC_FAILED: "SYNC_FAILED",
  INVALID_SYNC_CODE: "INVALID_SYNC_CODE",

  // Generic
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Category for classifying errors in the UI and logging. */
export type ErrorCategory = "provider" | "network" | "extraction" | "validation" | "auth" | "sync" | "internal";
