/**
 * Validation error classes.
 */

import { ErrorCode } from "../types/error";
import { FlyxError } from "./FlyxError";

/**
 * Thrown when input validation fails.
 *
 * Used by API routes, provider parameter checks, and sync validation.
 */
export class ValidationError extends FlyxError {
  constructor(
    message: string,
    public readonly field?: string,
    code: string = ErrorCode.VALIDATION_ERROR,
  ) {
    super(message, code as never, 400, false, {
      field: field ?? null,
    });
  }
}

/**
 * Thrown when an invalid or unsupported media type is requested.
 */
export class InvalidMediaTypeError extends ValidationError {
  constructor(mediaType: string) {
    super(
      `Invalid media type: "${mediaType}". Expected "movie" or "tv".`,
      "mediaType",
      ErrorCode.INVALID_MEDIA_TYPE,
    );
  }
}

/**
 * Thrown when a required parameter is missing from a request.
 */
export class MissingParameterError extends ValidationError {
  constructor(paramName: string) {
    super(
      `Missing required parameter: "${paramName}"`,
      paramName,
      ErrorCode.MISSING_PARAMETER,
    );
  }
}
