/**
 * Search Content API Route
 * GET /api/content/search
 * Returns search results with debouncing and caching.
 *
 * Ported from Flyx 2.0 — adapted for Flyx 3.0 monorepo.
 * - Replaced tmdbService with direct TMDB API calls.
 * - Rate limiter ported to simplified in-memory implementation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchRateLimiter, getClientIP } from '@/lib/utils/api-rate-limiter';
import { GENRES } from '@/lib/constants/genres';
import { tmdbApi } from '@/lib/utils/tmdb-api';

export const dynamic = 'force-dynamic';

// Animation genre ID in TMDB
const ANIMATION_GENRE_ID = 16;

// Check if a result is likely anime (Japanese animation)
function isLikelyAnime(item: any): boolean {
  const genreIds = item.genre_ids || [];
  const isAnimation = genreIds.includes(ANIMATION_GENRE_ID);

  // Check original language — Japanese animation is likely anime
  const originalLanguage = item.original_language || '';
  const isJapanese = originalLanguage === 'ja';

  // If it's animation AND Japanese, it's likely anime
  if (isAnimation && isJapanese) {
    return true;
  }

  // Additional heuristics for anime detection
  const title = (item.title || item.name || '').toLowerCase();
  const originalTitle = (
    item.original_title ||
    item.original_name ||
    ''
  ).toLowerCase();

  // Common anime title patterns
  const animePatterns = [
    /\bseason\s*\d+\b.*(?:part|cour)/i,
    /\b(?:ova|ona|special)\b/i,
  ];

  if (isAnimation) {
    for (const pattern of animePatterns) {
      if (pattern.test(title) || pattern.test(originalTitle)) {
        return true;
      }
    }
  }

  return false;
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting (stricter for search to prevent abuse)
    const clientIP = getClientIP(request);
    const rateLimit = searchRateLimiter.checkLimit(clientIP);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Search rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
            'Retry-After': Math.ceil(
              (rateLimit.resetAt - Date.now()) / 1000,
            ).toString(),
          },
        },
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const category = searchParams.get('category') || '';
    const genre = searchParams.get('genre') || '';
    const contentType = searchParams.get('type') || 'movie';
    const page = parseInt(searchParams.get('page') || '1');
    const sessionId = searchParams.get('sessionId') || '';
    const excludeAnime = searchParams.get('excludeAnime') === 'true';

    let searchResults: any[] = [];

    if (!query && !category && !genre) {
      // If no search parameters, return trending content
      const trendingType =
        contentType === 'movie'
          ? 'movie'
          : contentType === 'tv'
            ? 'tv'
            : 'movie';
      searchResults = await tmdbApi.getTrending(trendingType, 'week', page);

      // Filter out anime from trending results
      if (excludeAnime) {
        searchResults = searchResults.filter(
          (item: any) => !isLikelyAnime(item),
        );
      }
    }

    // Helper to get genre IDs from slug or ID string
    const getGenreIds = (genreParam: string): number[] => {
      // Check if it's a number (ID)
      if (/^\d+$/.test(genreParam)) {
        return [parseInt(genreParam)];
      }
      // Check if it's a slug
      const matchedGenres = GENRES.filter(
        (g) =>
          g.slug === genreParam.toLowerCase() ||
          g.name.toLowerCase() === genreParam.toLowerCase(),
      );
      return matchedGenres.map((g) => g.id);
    };

    if (query) {
      // Regular text search
      searchResults = await tmdbApi.search(query, page);

      // Filter by content type
      if (contentType === 'movie') {
        searchResults = searchResults.filter(
          (item: any) => item.mediaType === 'movie',
        );
      } else if (contentType === 'tv') {
        searchResults = searchResults.filter(
          (item: any) => item.mediaType === 'tv',
        );
      }

      // Filter out anime if requested (for movies/TV search)
      if (excludeAnime) {
        searchResults = searchResults.filter(
          (item: any) => !isLikelyAnime(item),
        );
      }

      // Filter by genre if specified
      if (genre) {
        const targetGenreIds = getGenreIds(genre);
        if (targetGenreIds.length > 0) {
          searchResults = searchResults.filter((item: any) => {
            const itemGenreIds = item.genre_ids || [];
            return itemGenreIds.some((id: number) =>
              targetGenreIds.includes(id),
            );
          });
        }
      }
    } else if (category) {
      // Category-based search (legacy/special categories)
      searchResults = await tmdbApi.searchByCategory(
        category,
        contentType as any,
        page,
      );
    } else if (genre) {
      // Genre-based discovery
      const targetGenreIds = getGenreIds(genre);

      if (targetGenreIds.length > 0) {
        const promises: Promise<any[]>[] = [];

        // If specific type requested, fetch accordingly
        if (contentType === 'movie') {
          const movieGenreId = targetGenreIds.find((id) =>
            GENRES.find((g) => g.id === id && g.type === 'movie'),
          );
          const idToUse = movieGenreId || targetGenreIds[0];
          if (idToUse) {
            promises.push(tmdbApi.searchMoviesByGenre(idToUse, page));
          }
        }

        if (contentType === 'tv') {
          const tvGenreId = targetGenreIds.find((id) =>
            GENRES.find((g) => g.id === id && g.type === 'tv'),
          );
          const idToUse = tvGenreId || targetGenreIds[0];
          if (idToUse) {
            promises.push(tmdbApi.searchTVByGenre(idToUse, page));
          }
        }

        const results = await Promise.all(promises);
        searchResults = results
          .flat()
          .sort(
            (a, b) => (b.popularity || 0) - (a.popularity || 0),
          );

        // Filter out anime if requested
        if (excludeAnime) {
          searchResults = searchResults.filter(
            (item: any) => !isLikelyAnime(item),
          );
        }
      }
    }

    // Track the search query for popular searches
    if (query && sessionId) {
      try {
        await fetch(`${request.nextUrl.origin}/api/search/popular`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            sessionId,
            resultsCount: searchResults.length,
            clickedResult: false,
          }),
        });
      } catch (trackingError) {
        console.error('Failed to track search:', trackingError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: searchResults,
        count: searchResults.length,
        query: query || category || genre,
        page,
        searchType: category
          ? 'category'
          : genre
            ? 'genre'
            : 'text',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        },
      },
    );
  } catch (error: any) {
    console.error('Search API error:', error);

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
          success: true,
          data: [],
          count: 0,
          message: 'No results found',
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to perform search',
      },
      { status: 500 },
    );
  }
}
