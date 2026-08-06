'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import type { MediaItem } from '@/types/media';
import { PageTransition } from '@/components/layout/PageTransition';
import { ContentCard } from '@/components/ContentCard';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import { usePresenceContext } from '@/components/analytics/PresenceProvider';
import { useDebounce } from '@/app/hooks/useDebounce';
import { GENRES } from '@/lib/constants/genres';
import { SearchSidebar } from './SearchSidebar';

interface SearchPageClientProps {
  initialQuery: string;
  initialContentType: string;
  initialGenre: string;
}

interface SearchFilters {
  contentType: 'movie' | 'tv' | 'anime';
  genres: string[];
  yearRange: [number, number];
  minRating: number;
  sortBy: 'relevance' | 'rating' | 'release_date' | 'popularity';
}

// MAL genre ID mapping
const MAL_GENRE_IDS: Record<string, number> = {
  'action': 1,
  'adventure': 2,
  'comedy': 4,
  'drama': 8,
  'fantasy': 10,
  'horror': 14,
  'mystery': 7,
  'romance': 22,
  'sci-fi': 24,
  'slice-of-life': 36,
  'sports': 30,
  'supernatural': 37,
  'suspense': 41,
};

// Anime result type from MAL
interface AnimeResult {
  mal_id: number;
  title: string;
  title_english: string | null;
  type: string; // "TV", "Movie", "OVA", "ONA", "Special", etc.
  episodes: number | null;
  score: number | null;
  year: number | null;
  images: {
    jpg: { image_url: string; large_image_url: string };
  };
}

export default function SearchPageClient({
  initialQuery,
  initialContentType,
  initialGenre,
}: SearchPageClientProps) {
  const router = useRouter();
  const { trackPageView } = useAnalytics();

  // State management
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 500);

  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [filters, setFilters] = useState<SearchFilters>({
    contentType: (initialContentType === 'anime' ? 'anime' : initialContentType === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv' | 'anime',
    genres: initialGenre ? [initialGenre] : [],
    yearRange: [1900, new Date().getFullYear()],
    minRating: 0,
    sortBy: 'relevance'
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    // Initialize session ID from storage or create new one
    if (typeof window !== 'undefined') {
      let sid = sessionStorage.getItem('flyx_session_id');
      if (!sid) {
        sid = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        sessionStorage.setItem('flyx_session_id', sid);
      }
      setSessionId(sid);

      // Restore scroll position if returning from details page
      const navigationOrigin = sessionStorage.getItem('flyx_navigation_origin');
      if (navigationOrigin) {
        try {
          const origin = JSON.parse(navigationOrigin);
          if (origin.type === 'search' && origin.scrollY) {
            // Delay scroll restoration to allow content to render
            setTimeout(() => {
              window.scrollTo(0, origin.scrollY);
            }, 100);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, []);

  // Get presence context for browsing tracking
  const presenceContext = usePresenceContext();

  // Analytics tracking - only when query changes
  useEffect(() => {
    if (sessionId) {
      trackPageView('/search');

      // Track browsing activity with search query
      if (presenceContext?.setBrowsingContext) {
        const searchContext = query ? `Search: "${query}"` : 'Search';
        presenceContext.setBrowsingContext(searchContext);
      }
    }
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sort helper
  const sortResults = (items: MediaItem[], sortBy: string): MediaItem[] => {
    switch (sortBy) {
      case 'rating':
        return [...items].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      case 'release_date':
        return [...items].sort((a, b) => {
          const dateA = new Date(a.release_date || a.first_air_date || '').getTime();
          const dateB = new Date(b.release_date || b.first_air_date || '').getTime();
          return dateB - dateA;
        });
      case 'popularity':
        return [...items].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
      default:
        return items;
    }
  };

  // Perform search
  const performSearch = useCallback(async (
    searchQuery: string,
    searchFilters: SearchFilters,
    pageNum: number,
    append: boolean = false
  ) => {
    // Wait for session ID initialization
    if (!sessionId) return;

    // DEBUG LOGGING
    console.log(`performSearch called: query="${searchQuery}", page=${pageNum}, append=${append}, contentType=${searchFilters.contentType}`);

    if (loadingRef.current) {
      console.log('Aborting search: Already loading');
      return;
    }

    setLoading(true);
    loadingRef.current = true;

    try {
      // Handle anime search via MAL
      if (searchFilters.contentType === 'anime') {
        await performAnimeSearch(searchQuery, searchFilters, pageNum, append);
        return;
      }

      // Build search URL for movies/TV (TMDB)
      const searchUrl = new URL('/api/content/search', window.location.origin);
      searchUrl.searchParams.set('query', searchQuery);
      searchUrl.searchParams.set('page', pageNum.toString());
      searchUrl.searchParams.set('sessionId', sessionId);
      searchUrl.searchParams.set('type', searchFilters.contentType);
      searchUrl.searchParams.set('excludeAnime', 'true'); // Filter out anime from TMDB results

      // Pass genre to API if available (using the first one for now to guide the search)
      if (searchFilters.genres.length > 0) {
        searchUrl.searchParams.set('genre', searchFilters.genres[0]);
      }

      const response = await fetch(searchUrl.toString());
      const data = await response.json();

      if (!response.ok) {
        console.error('Search API error:', response.status, data);
        // If rate limited or validation error (400), stop infinite scroll
        if (response.status === 429 || response.status === 400) {
          setHasMore(false);
        }
        throw new Error(data.message || 'Search failed');
      }

      let searchResults = data.data || [];

      // Client-side filtering for advanced features
      searchResults = searchResults.filter((item: any) => {
        // Filter by Content Type
        if (item.mediaType !== searchFilters.contentType) return false;

        // Filter by Year
        const year = new Date(item.release_date || item.first_air_date || '').getFullYear();
        if (year < searchFilters.yearRange[0] || year > searchFilters.yearRange[1]) return false;

        // Filter by Rating
        if ((item.vote_average || 0) < searchFilters.minRating) return false;

        // Filter by Genres (if any selected)
        if (searchFilters.genres.length > 0) {
          // Get genre IDs matching the selected slugs, considering content type
          const selectedGenreIds = searchFilters.genres.flatMap(slug => {
            // Find all genres matching this slug
            const matchingGenres = GENRES.filter(g => g.slug === slug);

            // If filtering by specific content type, only use that type's genre ID
            if (searchFilters.contentType === 'movie') {
              const movieGenre = matchingGenres.find(g => g.type === 'movie');
              return movieGenre ? [movieGenre.id] : [];
            } else if (searchFilters.contentType === 'tv') {
              const tvGenre = matchingGenres.find(g => g.type === 'tv');
              return tvGenre ? [tvGenre.id] : [];
            }

            // For 'all' content type, include both movie and TV genre IDs
            return matchingGenres.map(g => g.id);
          }).filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

          if (selectedGenreIds.length > 0) {
            const itemGenreIds = item.genre_ids || item.genres?.map((g: any) => g.id) || [];
            // Check if item has ANY of the selected genre IDs (more lenient matching)
            const hasAnyGenre = selectedGenreIds.some(id => itemGenreIds.includes(id));
            if (!hasAnyGenre) return false;
          }
        }

        return true;
      });

      // Sort results
      searchResults = sortResults(searchResults, searchFilters.sortBy);

      // Update URL without reload
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      params.set('type', searchFilters.contentType);
      if (searchFilters.genres.length > 0) params.set('genre', searchFilters.genres[0]);
      window.history.replaceState(null, '', `/search?${params.toString()}`);

      if (append) {
        setResults(prev => [...prev, ...searchResults]);
      } else {
        setResults(searchResults);
      }

      setHasMore(searchResults.length > 0);

    } catch (error) {
      console.error('Search error:', error);
      if (!append) setResults([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [sessionId]);

  // Perform anime search via internal /api/content/anime-search (AniList-backed)
  const performAnimeSearch = useCallback(async (
    searchQuery: string,
    searchFilters: SearchFilters,
    pageNum: number,
    append: boolean = false
  ) => {
    try {
      let animeResults: AnimeResult[] = [];

      const searchUrl = new URL('/api/content/anime-search', window.location.origin);
      searchUrl.searchParams.set('page', pageNum.toString());
      searchUrl.searchParams.set('limit', '24');
      searchUrl.searchParams.set('order_by', searchFilters.sortBy === 'rating' ? 'score' : searchFilters.sortBy === 'release_date' ? 'start_date' : 'members');

      if (searchQuery.trim()) {
        searchUrl.searchParams.set('q', searchQuery);
      }

      if (searchFilters.genres.length > 0) {
        const genreIds = searchFilters.genres
          .map(slug => MAL_GENRE_IDS[slug])
          .filter(id => id !== undefined);
        if (genreIds.length > 0) {
          searchUrl.searchParams.set('genres', genreIds.join(','));
        }
      }

      if (searchFilters.yearRange[0] > 1900) {
        searchUrl.searchParams.set('start_date', `${searchFilters.yearRange[0]}-01-01`);
      }
      if (searchFilters.yearRange[1] < new Date().getFullYear()) {
        searchUrl.searchParams.set('end_date', `${searchFilters.yearRange[1]}-12-31`);
      }

      if (searchFilters.minRating > 0) {
        searchUrl.searchParams.set('min_score', searchFilters.minRating.toString());
      }

      const response = await fetch(searchUrl.toString());
      const data = await response.json();

      if (!response.ok) {
        console.error('Anime search API error:', response.status, data);
        if (response.status === 429) {
          setHasMore(false);
        }
        throw new Error(data.message || 'Anime search failed');
      }

      animeResults = data.data || [];

      // Transform MAL results to MediaItem format for consistent display
      const transformedResults: MediaItem[] = animeResults.map((anime: AnimeResult) => ({
        id: anime.mal_id.toString(),
        title: anime.title_english || anime.title,
        name: anime.title,
        overview: '',
        posterPath: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '',
        poster_path: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '',
        backdropPath: '',
        releaseDate: anime.year ? `${anime.year}-01-01` : '',
        first_air_date: anime.year ? `${anime.year}-01-01` : '',
        rating: anime.score || 0,
        vote_average: anime.score || 0,
        voteCount: 0,
        vote_count: 0,
        mediaType: 'anime' as any,
        genres: [],
        genre_ids: [],
        // Store MAL ID and anime type for navigation
        mal_id: anime.mal_id,
        anime_type: anime.type, // "TV", "Movie", "OVA", "ONA", "Special", etc.
        episodes: anime.episodes ?? undefined,
      }));

      // Update URL without reload
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      params.set('type', 'anime');
      if (searchFilters.genres.length > 0) params.set('genre', searchFilters.genres[0]);
      window.history.replaceState(null, '', `/search?${params.toString()}`);

      if (append) {
        setResults(prev => [...prev, ...transformedResults]);
      } else {
        setResults(transformedResults);
      }

      setHasMore(data.pagination?.has_next_page || false);

    } catch (error) {
      console.error('Anime search error:', error);
      if (!append) setResults([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Effect for live search and filter changes
  useEffect(() => {
    // Always allow search, even if empty (shows trending)
    setHasMore(true);

    setPage(1);
    performSearch(debouncedQuery, filters, 1, false);
  }, [debouncedQuery, filters, performSearch]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          // Double check conditions before triggering next page
          // We allow empty query now for trending content

          setPage(prev => {
            const newPage = prev + 1;
            performSearch(debouncedQuery, filters, newPage, true);
            return newPage;
          });
        }
      },
      { threshold: 0.5, rootMargin: '100px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, debouncedQuery, filters, performSearch]);

  const handleContentClick = (item: MediaItem) => {
    // Anime → MAL details page
    if ((item as any).mal_id) {
      const malId = (item as any).mal_id;
      sessionStorage.setItem('flyx_navigation_origin', JSON.stringify({
        type: 'search',
        query: query || debouncedQuery,
        filters,
        scrollY: window.scrollY,
      }));
      router.push(`/anime/${malId}`);
      return;
    }

    // Movies / TV → details surface
    sessionStorage.setItem('flyx_navigation_origin', JSON.stringify({
      type: 'search',
      query: query || debouncedQuery,
      filters,
      scrollY: window.scrollY,
    }));
    const mediaType = item.mediaType === 'tv' ? 'tv' : 'movie';
    router.push(`/details/${item.id}?type=${mediaType}`);
  };

  return (
    <PageTransition>
      <div className="min-h-screen text-white">
        <div className="page-glow" />
        <div className="content-container relative pt-5 md:pt-8 pb-20">
          {/* Page intro */}
          <div className="page-header mb-5">
            <p className="eyebrow">Discover</p>
            <h1>Search</h1>
            <p className="subtitle">
              Movies, TV shows, and anime — find anything fast
            </p>
          </div>

          <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
            {/* Mobile Filter Toggle */}
            <button
              className="lg:hidden flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.07]"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6" />
              </svg>
              {isSidebarOpen ? 'Hide Filters' : 'Show Filters'}
            </button>

            {/* Sidebar */}
            <div className={`${isSidebarOpen ? 'block' : 'hidden'} lg:block`}>
              <SearchSidebar
                filters={filters}
                onFilterChange={(newFilters) => setFilters(prev => ({ ...prev, ...newFilters }))}
              />
            </div>

            {/* Main Content */}
            <main className="flex-1 min-w-0">
              {/* Search Input Area */}
              <div className="relative mb-5">
                <div className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-white/30">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                </div>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    filters.contentType === 'anime'
                      ? 'Search anime...'
                      : filters.contentType === 'tv'
                        ? 'Search TV shows...'
                        : 'Search movies...'
                  }
                  className="w-full rounded-2xl border border-white/12 bg-gradient-to-b from-white/[0.06] to-white/[0.025] py-4 pl-14 pr-14 text-lg text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.25)] placeholder:text-white/30 focus:border-[#00e5bf]/5 focus:bg-white/[0.07] focus:outline-none focus:shadow-[0_0_0_4px_rgba(0,229,191,0.12),0_0_40px_rgba(0,229,191,0.1)] transition-all"
                  autoComplete="off"
                  spellCheck={false}
                  data-tv-focusable="true"
                  data-tv-primary="true"
                  data-tv-group="search-input"
                  aria-label="Search content"
                />
                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white/35">
                  {loading ? (
                    <div
                      className="h-5 w-5 animate-spin rounded-full border-2 border-[rgba(0,229,191,0.25)] border-t-[#00e5bf]"
                      aria-label="Searching"
                    />
                  ) : query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Results Grid */}
              {results.length > 0 ? (
                <div className="content-grid">
                  <AnimatePresence mode="popLayout">
                    {results.map((item, index) => {
                      const isAnime = !!(item as any).mal_id;
                      const posterUrl = item.posterPath
                        || (item.poster_path
                          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                          : undefined);
                      const itemYear = (item.release_date || item.first_air_date || item.releaseDate)
                        ? new Date(item.release_date || item.first_air_date || item.releaseDate || "").getFullYear()
                        : undefined;
                      const itemMediaType = (item.mediaType === "tv" ? "tv" : "movie") as "movie" | "tv";
                      const animeType = (item as any).anime_type as string | undefined;

                      return (
                        <motion.div
                          key={`${item.id}-${index}`}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ContentCard
                            tmdbId={Number(item.id) || 0}
                            title={item.title || item.name || "Untitled"}
                            mediaType={itemMediaType}
                            posterUrl={posterUrl}
                            rating={item.vote_average ?? item.rating ?? 0}
                            year={itemYear?.toString()}
                            onClick={() => handleContentClick(item)}
                            badge={
                              animeType
                                ? {
                                    label: animeType,
                                    color: animeType === "Movie"
                                      ? "#8b7cf0"
                                      : animeType === "TV"
                                        ? "#00e5bf"
                                        : "#f59e0b",
                                  }
                                : isAnime
                                  ? { label: "Anime", color: "#f062a0" }
                                  : undefined
                            }
                          />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                !loading && (
                  <div className="text-center py-24">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-white/25">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" />
                      </svg>
                    </div>
                    <p className="font-display text-xl text-white/50">No results found</p>
                    <p className="mt-2 text-sm text-white/30">Try adjusting your search or filters</p>
                  </div>
                )
              )}

              {/* Loading More Indicator */}
              {hasMore && (
                <div ref={observerTarget} className="h-20 flex items-center justify-center mt-8">
                  {loading && (
                    <div
                      className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                      style={{ borderColor: 'rgba(46,230,197,0.25)', borderTopColor: '#2ee6c5' }}
                    />
                  )}
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
