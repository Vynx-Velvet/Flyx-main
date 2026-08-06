/**
 * Content Details API Route
 * GET /api/content/details
 * Returns detailed information about a movie or TV show with prefetching.
 *
 * Ported from Flyx 2.0 — adapted for Flyx 3.0 monorepo.
 * - Replaced tmdbService with direct TMDB API calls.
 * - Zod validation imported from @/lib/validation/content-schemas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { tmdbApi } from '@/lib/utils/tmdb-api';
import { contentRateLimiter, getClientIP } from '@/lib/utils/api-rate-limiter';
import {
  detailsQuerySchema,
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
    const validation = validateQuery(detailsQuerySchema, searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: validation.error,
        },
        { status: 400 },
      );
    }

    const { id, mediaType } = validation.data;

    // Fetch content details (with built-in caching)
    const details = await tmdbApi.getDetails(id, mediaType);

    // For TV shows, prefetch first season details if available
    let prefetchedSeason = null;
    if (
      mediaType === 'tv' &&
      details.seasons &&
      details.seasons.length > 0
    ) {
      try {
        // Find first non-special season (season 0 is usually specials)
        const firstSeason =
          details.seasons.find((s: any) => s.seasonNumber > 0) ||
          details.seasons[0];
        if (firstSeason) {
          prefetchedSeason = await tmdbApi.getSeasonDetails(
            id,
            firstSeason.seasonNumber,
          );
        }
      } catch (error) {
        // Prefetch failure shouldn't break the main request
        console.warn('Failed to prefetch season details:', error);
      }
    }

    // Build response with prefetched data
    const responseData = {
      ...details,
      seasons: prefetchedSeason
        ? details.seasons?.map((season: any) =>
            season.seasonNumber === prefetchedSeason.seasonNumber
              ? prefetchedSeason
              : season,
          )
        : details.seasons,
    };

    return NextResponse.json(
      {
        success: true,
        data: responseData,
        prefetched: prefetchedSeason ? ['season_1'] : [],
      },
      {
        status: 200,
        headers: {
          'Cache-Control':
            'public, s-maxage=3600, stale-while-revalidate=7200',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        },
      },
    );
  } catch (error: any) {
    console.error('Details API error:', error);

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
          message: 'Content not found',
        },
        { status: 404 },
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch content details',
      },
      { status: 500 },
    );
  }
}
