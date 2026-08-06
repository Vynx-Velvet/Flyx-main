/**
 * Trending Content API Route
 * GET /api/content/trending
 * Returns trending movies and TV shows with caching.
 *
 * Ported from Flyx 2.0 — adapted for Flyx 3.0 monorepo.
 * - Replaced tmdbService with direct TMDB API calls.
 * - Zod validation imported from @/lib/validation/content-schemas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { tmdbApi } from '@/lib/utils/tmdb-api';
import { contentRateLimiter, getClientIP } from '@/lib/utils/api-rate-limiter';
import {
  trendingQuerySchema,
  validateQuery,
} from '@/lib/validation/content-schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimit = contentRateLimiter.checkLimit(clientIP);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
            'Retry-After': Math.ceil(
              (rateLimit.resetAt - Date.now()) / 1000,
            ).toString(),
          },
        },
      );
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(trendingQuerySchema, searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: validation.error,
        },
        { status: 400 },
      );
    }

    const { mediaType, timeWindow } = validation.data;

    // Fetch trending content from TMDB (with built-in caching)
    const trendingContent = await tmdbApi.getTrending(mediaType, timeWindow);

    return NextResponse.json(
      {
        success: true,
        data: trendingContent,
        count: trendingContent.length,
        mediaType,
        timeWindow,
      },
      {
        status: 200,
        headers: {
          'Cache-Control':
            'public, s-maxage=300, stale-while-revalidate=600',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        },
      },
    );
  } catch (error: any) {
    console.error('Trending API error:', error);

    // Handle specific error types
    if (error.code === 'MISSING_API_KEY') {
      return NextResponse.json(
        {
          error: 'Configuration error',
          message: 'Service is not properly configured',
        },
        { status: 500 },
      );
    }

    if (error.statusCode === 404) {
      return NextResponse.json(
        {
          error: 'Not found',
          message: 'Trending content not available',
        },
        { status: 404 },
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch trending content',
      },
      { status: 500 },
    );
  }
}
