/**
 * API Rate Limiter
 * Rate limiting for API endpoints based on IP address.
 * Ported from Flyx 2.0 with simplified in-memory implementation.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class APIRateLimiter {
  private readonly requests: Map<string, RateLimitEntry>;
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxRequests: number = 100, windowMs: number = 60 * 1000) {
    this.requests = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Clean up old entries every minute (server-side only)
    if (typeof setInterval !== 'undefined') {
      this.cleanupTimer = setInterval(() => this.cleanup(), 60 * 1000);
    }
  }

  /**
   * Check if a request should be allowed
   */
  checkLimit(
    identifier: string,
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetAt) {
      // New window
      const resetAt = now + this.windowMs;
      this.requests.set(identifier, {
        count: 1,
        resetAt,
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt,
      };
    }

    // Check if limit exceeded
    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    // Increment count
    entry.count++;

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [identifier, entry] of this.requests.entries()) {
      if (now > entry.resetAt) {
        this.requests.delete(identifier);
      }
    }
  }
}

// Create rate limiters for different endpoints
export const contentRateLimiter = new APIRateLimiter(100, 60 * 1000); // 100 requests per minute
export const searchRateLimiter = new APIRateLimiter(30, 60 * 1000); // 30 requests per minute

/**
 * Get client IP from request headers
 * Supports both Cloudflare and other proxy headers
 */
export function getClientIP(request: Request): string {
  // Cloudflare-specific header (most reliable when using Cloudflare)
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Try various headers that might contain the real IP
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to a default
  return 'unknown';
}
