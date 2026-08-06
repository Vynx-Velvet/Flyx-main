/**
 * TMDB Genre IDs and metadata for content filtering.
 * Ported from Flyx 2.0 with no changes — TMDB genre IDs are stable.
 */

export const GENRES = [
  { id: 28, name: 'Action', slug: 'action', type: 'movie' },
  { id: 12, name: 'Adventure', slug: 'adventure', type: 'movie' },
  { id: 16, name: 'Animation', slug: 'anime', type: 'movie' },
  { id: 35, name: 'Comedy', slug: 'comedy', type: 'movie' },
  { id: 80, name: 'Crime', slug: 'crime', type: 'movie' },
  { id: 99, name: 'Documentary', slug: 'documentary', type: 'movie' },
  { id: 18, name: 'Drama', slug: 'drama', type: 'movie' },
  { id: 10751, name: 'Family', slug: 'family', type: 'movie' },
  { id: 14, name: 'Fantasy', slug: 'fantasy', type: 'movie' },
  { id: 36, name: 'History', slug: 'history', type: 'movie' },
  { id: 27, name: 'Horror', slug: 'horror', type: 'movie' },
  { id: 10402, name: 'Music', slug: 'music', type: 'movie' },
  { id: 9648, name: 'Mystery', slug: 'mystery', type: 'movie' },
  { id: 10749, name: 'Romance', slug: 'romance', type: 'movie' },
  { id: 878, name: 'Science Fiction', slug: 'sci-fi', type: 'movie' },
  { id: 10770, name: 'TV Movie', slug: 'tv-movie', type: 'movie' },
  { id: 53, name: 'Thriller', slug: 'thriller', type: 'movie' },
  { id: 10752, name: 'War', slug: 'war', type: 'movie' },
  { id: 37, name: 'Western', slug: 'western', type: 'movie' },
  // TV Genres
  { id: 10759, name: 'Action & Adventure', slug: 'action-adventure', type: 'tv' },
  { id: 16, name: 'Animation', slug: 'animation', type: 'tv' },
  { id: 35, name: 'Comedy', slug: 'comedy', type: 'tv' },
  { id: 80, name: 'Crime', slug: 'crime', type: 'tv' },
  { id: 99, name: 'Documentary', slug: 'documentary', type: 'tv' },
  { id: 18, name: 'Drama', slug: 'drama', type: 'tv' },
  { id: 10751, name: 'Family', slug: 'family', type: 'tv' },
  { id: 10762, name: 'Kids', slug: 'kids', type: 'tv' },
  { id: 9648, name: 'Mystery', slug: 'mystery', type: 'tv' },
  { id: 10763, name: 'News', slug: 'news', type: 'tv' },
  { id: 10764, name: 'Reality', slug: 'reality', type: 'tv' },
  { id: 10765, name: 'Sci-Fi & Fantasy', slug: 'sci-fi-fantasy', type: 'tv' },
  { id: 10766, name: 'Soap', slug: 'soap', type: 'tv' },
  { id: 10767, name: 'Talk', slug: 'talk', type: 'tv' },
  { id: 10768, name: 'War & Politics', slug: 'war-politics', type: 'tv' },
  { id: 37, name: 'Western', slug: 'western', type: 'tv' },
];

export const MOVIE_GENRES = GENRES.filter((g) => g.type === 'movie');
export const TV_GENRES = GENRES.filter((g) => g.type === 'tv');
