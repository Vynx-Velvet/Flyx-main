/**
 * Direct TMDB API helper for server-side use.
 *
 * Replaces the `tmdbService` class from Flyx 2.0.
 * Uses direct fetch calls with Bearer or api_key auth.
 * Handles response parsing, error classification, and caching headers.
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';

class TmdbApi {
  private getApiKey(): string {
    const key = process.env.TMDB_API_KEY;
    if (!key) {
      const err = new Error('TMDB_API_KEY is not configured') as Error & {
        code: string;
      };
      err.code = 'MISSING_API_KEY';
      throw err;
    }
    return key;
  }

  private async fetch<T>(
    path: string,
    params: Record<string, string | number> = {},
  ): Promise<T> {
    // Resolve configuration at request time. Next.js evaluates route modules while
    // collecting build data, when runtime-only secrets are intentionally absent.
    const apiKey = this.getApiKey();
    const url = new URL(`${TMDB_BASE}${path}`);
    url.searchParams.set('language', 'en-US');

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { Accept: 'application/json' };

    // Bearer auth for JWT tokens, api_key param for legacy keys
    if (apiKey.startsWith('eyJ')) {
      headers.Authorization = `Bearer ${apiKey}`;
    } else {
      url.searchParams.set('api_key', apiKey);
    }

    const resp = await fetch(url.toString(), {
      headers,
      next: { revalidate: 3600 },
    });

    if (!resp.ok) {
      const err = new Error(
        `TMDB API error: ${resp.status} ${resp.statusText}`,
      ) as Error & { statusCode: number };
      err.statusCode = resp.status;
      throw err;
    }

    return resp.json();
  }

  /**
   * Search TMDB for movies and TV shows.
   */
  async search(query: string, page = 1): Promise<any[]> {
    const data: any = await this.fetch('/search/multi', { query, page });
    return (data.results || []).map((item: any) => ({
      ...item,
      mediaType: item.media_type || item.mediaType || 'movie',
    }));
  }

  /**
   * Get trending content.
   */
  async getTrending(
    mediaType: 'movie' | 'tv' | 'all' = 'all',
    timeWindow: 'day' | 'week' = 'week',
    page = 1,
  ): Promise<any[]> {
    const type = mediaType === 'all' ? 'movie' : mediaType;
    const data: any = await this.fetch(`/trending/${type}/${timeWindow}`, {
      page,
    });
    return (data.results || []).map((item: any) => ({
      ...item,
      mediaType: item.media_type || item.mediaType || type,
    }));
  }

  /**
   * Get content details by TMDB ID.
   */
  async getDetails(id: string, mediaType: 'movie' | 'tv'): Promise<any> {
    const data: any = await this.fetch(`/${mediaType}/${id}`, {
      append_to_response: 'credits,videos,recommendations,similar,external_ids',
    });
    return { ...data, mediaType };
  }

  /**
   * Get season details for a TV show.
   */
  async getSeasonDetails(tvId: string, seasonNumber: number): Promise<any> {
    return this.fetch(`/tv/${tvId}/season/${seasonNumber}`);
  }

  /**
   * Search by category (discover endpoint).
   */
  async searchByCategory(
    category: string,
    contentType: 'movie' | 'tv',
    page = 1,
  ): Promise<any[]> {
    const params: Record<string, string | number> = {
      page,
      sort_by: 'popularity.desc',
    };

    switch (category) {
      case 'now_playing':
        if (contentType === 'movie') {
          params.with_release_type = '2|3';
          params.sort_by = 'release_date.desc';
        }
        break;
      case 'top_rated':
        params.sort_by = 'vote_average.desc';
        params['vote_count.gte'] = 200;
        break;
      case 'upcoming':
        if (contentType === 'movie') {
          params.with_release_type = '2|3';
          params.sort_by = 'release_date.asc';
          params['release_date.gte'] = new Date().toISOString().split('T')[0];
        }
        break;
      default:
        break;
    }

    const data: any = await this.fetch(`/discover/${contentType}`, params);
    return (data.results || []).map((item: any) => ({
      ...item,
      mediaType: contentType,
    }));
  }

  /**
   * Search movies by genre.
   */
  async searchMoviesByGenre(genreId: number, page = 1): Promise<any[]> {
    const data: any = await this.fetch('/discover/movie', {
      with_genres: genreId,
      page,
      sort_by: 'popularity.desc',
    });
    return (data.results || []).map((item: any) => ({
      ...item,
      mediaType: 'movie',
    }));
  }

  /**
   * Search TV by genre.
   */
  async searchTVByGenre(genreId: number, page = 1): Promise<any[]> {
    const data: any = await this.fetch('/discover/tv', {
      with_genres: genreId,
      page,
      sort_by: 'popularity.desc',
    });
    return (data.results || []).map((item: any) => ({
      ...item,
      mediaType: 'tv',
    }));
  }
}

/** Singleton TMDB API instance for server-side use. */
export const tmdbApi = new TmdbApi();
