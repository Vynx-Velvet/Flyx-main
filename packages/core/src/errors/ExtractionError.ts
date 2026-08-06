/**
 * Extraction-specific error classes.
 */

import { ErrorCode } from "../types/error";
import { FlyxError } from "./FlyxError";

/**
 * Thrown when stream extraction fails for a specific reason.
 *
 * This is distinct from {@link import('./ProviderError').ProviderError}
 * which wraps provider-level failures. ExtractionError is for the
 * extraction pipeline itself (decoding, parsing, etc.).
 */
export class ExtractionError extends FlyxError {
  constructor(
    message: string,
    code: string = ErrorCode.EXTRACTION_FAILED,
    retryable: boolean = true,
    details?: Record<string, unknown>,
  ) {
    super(message, code as never, 502, retryable, details);
  }
}

/**
 * Thrown when extraction is aborted (e.g. user navigated away).
 */
export class ExtractionAbortedError extends FlyxError {
  constructor() {
    super("Extraction was aborted", ErrorCode.EXTRACTION_ABORTED, 499, false);
  }
}

/**
 * Thrown when an obfuscated decoder script fails to execute.
 */
export class DecoderFailedError extends ExtractionError {
  constructor(
    public readonly decoderName: string,
    originalError?: Error,
  ) {
    super(
      `Decoder "${decoderName}" failed: ${originalError?.message || "Unknown error"}`,
      ErrorCode.DECODER_FAILED,
      false, // Decoder failures are not retryable without code changes
      { decoderName, originalMessage: originalError?.message ?? null },
    );
  }
}

/**
 * Thrown when no playable sources were found in the extraction result.
 */
export class NoSourcesFoundError extends ExtractionError {
  constructor(provider: string) {
    super(
      `No playable sources found from provider "${provider}"`,
      ErrorCode.NO_SOURCES_FOUND,
      true, // Retryable — next provider may have sources
      { provider },
    );
  }
}

/**
 * Thrown when an M3U8 playlist cannot be parsed.
 */
export class M3U8ParseError extends ExtractionError {
  constructor(
    public readonly m3u8Url: string,
    originalError?: Error,
  ) {
    super(
      `Failed to parse M3U8 playlist: ${originalError?.message || "Unknown parse error"}`,
      ErrorCode.M3U8_PARSE_ERROR,
      false,
      { m3u8Url },
    );
  }
}
