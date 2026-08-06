/**
 * @flyx/core/errors
 *
 * Unified error hierarchy for Flyx 3.0.
 *
 * Every error extends {@link FlyxError}, which provides:
 * - Machine-readable error code
 * - HTTP status code mapping
 * - Retry-ability flag
 * - Structured JSON serialisation for API responses
 *
 * ## Replaces (Flyx 2.0 fragmentation):
 * - `components/error/` (TypeScript, CSS modules)
 * - `components/ErrorHandling/` (JavaScript, styled-jsx)
 * - `utils/errorHandling/` (JavaScript)
 * - `lib/utils/error-handler.ts` (APIErrorHandler)
 * - `lib/stream-errors.ts` (AllProvidersFailedError)
 * - `hooks/useErrorHandling.js`
 */

export { FlyxError } from "./FlyxError";
export {
  ProviderError,
  AllProvidersFailedError,
  ProviderNotFoundError,
  ProviderDisabledError,
} from "./ProviderError";
export {
  NetworkError,
  TimeoutError,
  RateLimitedError,
  CloudflareBlockedError,
} from "./NetworkError";
export {
  ExtractionError,
  ExtractionAbortedError,
  DecoderFailedError,
  NoSourcesFoundError,
  M3U8ParseError,
} from "./ExtractionError";
export {
  ValidationError,
  InvalidMediaTypeError,
  MissingParameterError,
} from "./ValidationError";
