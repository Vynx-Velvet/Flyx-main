/**
 * Manga content types for the manga reader and browser.
 *
 * These types define manga-specific data structures — chapters, pages,
 * metadata — that are fundamentally different from video/streaming types.
 *
 * @module manga
 */

/** Manga publication status. */
export type MangaStatus = "ongoing" | "completed" | "hiatus" | "cancelled";

/** Manga content rating / demographic. */
export type MangaContentRating = "safe" | "suggestive" | "erotica" | "pornographic";

/** A lightweight manga card for search results and browse grids. */
export interface MangaCard {
  /** Provider internal ID. */
  id: string;
  /** Primary display title (English or romanized). */
  title: string;
  /** Alternative / Japanese title. */
  altTitle?: string;
  /** Cover image URL. */
  coverImage: string;
  /** Average rating (0-10). */
  rating?: number;
  /** Number of available chapters. */
  chapterCount?: number;
  /** Publication status. */
  status?: MangaStatus;
  /** Genre tags. */
  genres?: string[];
  /** Last updated timestamp (ISO 8601). */
  lastUpdated?: string;
}

/** Full manga details including metadata and chapter list. */
export interface MangaData {
  /** Provider internal ID. */
  id: string;
  /** Primary display title. */
  title: string;
  /** Alternative titles (Japanese, synonyms). */
  altTitles: string[];
  /** Author(s). */
  author?: string;
  /** Artist(s). */
  artist?: string;
  /** Synopsis / description. */
  description: string;
  /** High-res cover image URL. */
  coverImage: string;
  /** Banner/hero image URL. */
  bannerImage?: string;
  /** Publication status. */
  status: MangaStatus;
  /** Content rating. */
  contentRating?: MangaContentRating;
  /** Genre tags. */
  genres: string[];
  /** Total number of chapters. */
  totalChapters: number;
  /** Average rating (0-10). */
  rating?: number;
  /** Number of ratings. */
  ratingCount?: number;
  /** Year first published. */
  year?: number;
  /** Last updated timestamp (ISO 8601). */
  lastUpdated?: string;
  /** Available chapters in reading order. */
  chapters: ChapterData[];
}

/** A single chapter of a manga. */
export interface ChapterData {
  /** Provider internal chapter ID. */
  id: string;
  /** Chapter number (float for .5 bonus chapters). */
  number: number;
  /** Chapter title (may be empty for numbered chapters). */
  title?: string;
  /** Number of pages in this chapter. */
  pageCount: number;
  /** Published date (ISO 8601). */
  publishedAt?: string;
  /** Language of this chapter translation. */
  language?: string;
}

/** A single page image within a chapter. */
export interface MangaPageData {
  /** Direct image URL. */
  imageUrl: string;
  /** Page number (1-based). */
  pageNumber: number;
  /** Image width in pixels (if known). */
  width?: number;
  /** Image height in pixels (if known). */
  height?: number;
  /** Referer header required to load this image. */
  referer?: string;
}

/** Reading progress persisted to localStorage. */
export interface MangaReadingProgress {
  /** Manga ID. */
  mangaId: string;
  /** Last chapter read. */
  chapterId: string;
  /** Last chapter number. */
  chapterNumber: number;
  /** Last page number viewed. */
  pageNumber: number;
  /** Timestamp of last read (epoch ms). */
  lastReadAt: number;
}
