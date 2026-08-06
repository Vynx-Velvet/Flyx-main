'use client';

import { useMemo } from 'react';
import { Slider } from '@/components/ui/Slider';
import { GENRES } from '@/lib/constants/genres';

interface SearchFilters {
    contentType: 'movie' | 'tv' | 'anime';
    genres: string[];
    yearRange: [number, number];
    minRating: number;
    sortBy: 'relevance' | 'rating' | 'release_date' | 'popularity';
}

interface SearchSidebarProps {
    filters: SearchFilters;
    onFilterChange: (newFilters: Partial<SearchFilters>) => void;
    className?: string;
}

// MAL anime genres for anime mode
const MAL_ANIME_GENRES = [
    { id: 1, name: 'Action', slug: 'action' },
    { id: 2, name: 'Adventure', slug: 'adventure' },
    { id: 4, name: 'Comedy', slug: 'comedy' },
    { id: 8, name: 'Drama', slug: 'drama' },
    { id: 10, name: 'Fantasy', slug: 'fantasy' },
    { id: 14, name: 'Horror', slug: 'horror' },
    { id: 7, name: 'Mystery', slug: 'mystery' },
    { id: 22, name: 'Romance', slug: 'romance' },
    { id: 24, name: 'Sci-Fi', slug: 'sci-fi' },
    { id: 36, name: 'Slice of Life', slug: 'slice-of-life' },
    { id: 30, name: 'Sports', slug: 'sports' },
    { id: 37, name: 'Supernatural', slug: 'supernatural' },
    { id: 41, name: 'Suspense', slug: 'suspense' },
];

export function SearchSidebar({ filters, onFilterChange, className = '' }: SearchSidebarProps) {
    // Get available genres based on content type
    const availableGenres = useMemo(() => {
        // For anime, use MAL genres
        if (filters.contentType === 'anime') {
            return MAL_ANIME_GENRES;
        }

        let genres = GENRES;
        if (filters.contentType === 'movie') {
            genres = GENRES.filter(g => g.type === 'movie');
        } else if (filters.contentType === 'tv') {
            genres = GENRES.filter(g => g.type === 'tv');
        }

        // Deduplicate by name for 'all' view
        const uniqueGenres = new Map();
        genres.forEach(g => {
            if (!uniqueGenres.has(g.name)) {
                uniqueGenres.set(g.name, g);
            }
        });

        return Array.from(uniqueGenres.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [filters.contentType]);

    const handleGenreToggle = (slug: string) => {
        const currentGenres = filters.genres;
        const newGenres = currentGenres.includes(slug)
            ? currentGenres.filter(g => g !== slug)
            : [...currentGenres, slug];
        onFilterChange({ genres: newGenres });
    };

    return (
        <aside className={`w-full lg:w-80 flex-shrink-0 ${className}`}>
            <div
                className="border border-white/[0.08] rounded-2xl p-6 sticky top-24 overflow-y-auto max-h-[calc(100vh-8rem)] custom-scrollbar"
                style={{
                    background: 'rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(24px)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 48px rgba(0,0,0,0.25)',
                }}
            >
                <div className="space-y-8">
                    {/* Content Type - Single Select */}
                    <div>
                        <h3 className="text-[10px] font-semibold text-white/35 uppercase tracking-[0.14em] mb-4">Content Type</h3>
                        <div className="flex flex-col gap-2">
                            {[
                                { id: 'movie', label: 'Movies', icon: '🎬' },
                                { id: 'tv', label: 'TV Shows', icon: '📺' },
                                { id: 'anime', label: 'Anime', icon: '🎌' },
                            ].map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => onFilterChange({ contentType: type.id as any, genres: [] })}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 border ${filters.contentType === type.id
                                        ? 'text-white border-[rgba(46,230,197,0.25)]'
                                        : 'bg-white/[0.03] border-transparent text-white/40 hover:bg-white/[0.06] hover:text-white'
                                        }`}
                                    style={
                                        filters.contentType === type.id
                                            ? {
                                                background: 'linear-gradient(135deg, rgba(46,230,197,0.14) 0%, rgba(155,140,255,0.1) 100%)',
                                                boxShadow: '0 4px 16px rgba(46,230,197,0.1)',
                                              }
                                            : undefined
                                    }
                                >
                                    <span className="text-lg">{type.icon}</span>
                                    <span>{type.label}</span>
                                    {filters.contentType === type.id && (
                                        <svg className="w-4 h-4 ml-auto text-[#2ee6c5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                        {filters.contentType === 'anime' && (
                            <p className="mt-3 text-xs text-gray-500">
                                Anime search uses MyAnimeList for accurate results
                            </p>
                        )}
                    </div>

                    {/* Sort By */}
                    <div>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Sort By</h3>
                        <select
                            value={filters.sortBy}
                            onChange={(e) => onFilterChange({ sortBy: e.target.value as any })}
                            className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(46,230,197,0.45)] transition-all"
                        >
                            <option value="relevance">Relevance</option>
                            <option value="popularity">Popularity</option>
                            <option value="rating">Rating</option>
                            <option value="release_date">Release Date</option>
                        </select>
                    </div>

                    {/* Genres (Multi-select) */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Genres</h3>
                            {filters.genres.length > 0 && (
                                <button
                                    onClick={() => onFilterChange({ genres: [] })}
                                    className="text-[10px] text-[#2ee6c5] hover:text-[#4aefd0] transition-colors"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {availableGenres.map((genre) => (
                                <button
                                    key={genre.id}
                                    onClick={() => handleGenreToggle(genre.slug)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border ${filters.genres.includes(genre.slug)
                                        ? 'bg-[rgba(46,230,197,0.12)] border-[rgba(46,230,197,0.35)] text-[#2ee6c5]'
                                        : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                                        }`}
                                >
                                    {genre.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Year Range */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Year Range</h3>
                            <span className="text-xs text-gray-400">
                                {filters.yearRange[0]} - {filters.yearRange[1]}
                            </span>
                        </div>
                        <Slider
                            min={1900}
                            max={new Date().getFullYear()}
                            value={filters.yearRange}
                            onChange={(val) => onFilterChange({ yearRange: val })}
                        />
                    </div>

                    {/* Rating */}
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Min Rating</h3>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-500">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                                {filters.minRating}+
                            </span>
                        </div>
                        <Slider
                            min={0}
                            max={10}
                            step={0.5}
                            value={[filters.minRating, 10]}
                            onChange={(val) => onFilterChange({ minRating: val[0] })}
                        />
                    </div>
                </div>
            </div>
        </aside>
    );
}
