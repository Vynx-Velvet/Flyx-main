/**
 * Media content types for content discovery and display.
 *
 * @module media
 */

import type { MediaType, ContentCategory } from "./provider";

/** Standardised video metadata returned by the content API. */
export interface VideoData {
  /** TMDB ID. */
  id: number;
  /** Display title in the user's language. */
  title: string;
  /** Original title. */
  originalTitle?: string;
  /** Synopsis / overview. */
  overview: string;
  /** Release date (ISO 8601). */
  releaseDate?: string;
  /** First air date for TV (ISO 8601). */
  firstAirDate?: string;
  /** Runtime in minutes. */
  runtime?: number;
  /** Average TMDB rating (0-10). */
  rating?: number;
  /** Number of votes on TMDB. */
  voteCount?: number;
  /** Backdrop image path (TMDB relative). */
  backdropPath?: string;
  /** Poster image path (TMDB relative). */
  posterPath?: string;
  /** Genre IDs from TMDB. */
  genreIds?: number[];
  /** Genre names. */
  genres?: string[];
  /** Whether the content is marked as adult. */
  adult?: boolean;
  /** Original language ISO code. */
  originalLanguage?: string;
  /** Media type for API routing. */
  mediaType: MediaType;
  /** MyAnimeList ID (anime only). */
  malId?: number;
  /** Whether this is anime content. */
  isAnime?: boolean;
}

/** Parameters for content search and discovery. */
export interface ContentQuery {
  /** Search query string. */
  query?: string;
  /** Media type filter. */
  mediaType?: MediaType;
  /** Content category for provider routing. */
  category?: ContentCategory;
  /** Genre ID filter. */
  genre?: number;
  /** Page number (1-based). */
  page?: number;
  /** Results per page. */
  limit?: number;
  /** Sort order. */
  sort?: "popularity" | "rating" | "release_date" | "title";
  /** Sort direction. */
  order?: "asc" | "desc";
  /** Year filter. */
  year?: number;
  /** Language filter (ISO 639-1). */
  language?: string;
  /** Region filter (ISO 3166-1 alpha-2). */
  region?: string;
}

/** Paginated response from the content API. */
export interface PaginatedResponse<T> {
  /** Current page number. */
  page: number;
  /** Total number of results. */
  totalResults: number;
  /** Total number of pages. */
  totalPages: number;
  /** Results for this page. */
  results: T[];
}
