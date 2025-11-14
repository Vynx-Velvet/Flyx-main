/**
 * Request ID generation for logging and tracing
 */

/**
 * Generate a unique request ID for tracing
 * Format: timestamp-random
 * Example: 1234567890123-a1b2c3d4
 */
export function generateRequestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Validate a request ID format
 */
export function isValidRequestId(requestId: string): boolean {
  // Format: timestamp-random (e.g., 1234567890123-a1b2c3d4)
  const pattern = /^\d{13}-[a-z0-9]{8}$/;
  return pattern.test(requestId);
}

/**
 * Extract timestamp from request ID
 */
export function getTimestampFromRequestId(requestId: string): number | null {
  if (!isValidRequestId(requestId)) {
    return null;
  }
  
  const timestamp = parseInt(requestId.split('-')[0], 10);
  return isNaN(timestamp) ? null : timestamp;
}

/**
 * Get age of request in milliseconds
 */
export function getRequestAge(requestId: string): number | null {
  const timestamp = getTimestampFromRequestId(requestId);
  if (timestamp === null) {
    return null;
  }
  
  return Date.now() - timestamp;
}
