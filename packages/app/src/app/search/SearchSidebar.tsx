"use client";

import { useMemo } from "react";
import { Slider } from "@/components/ui/Slider";
import { GENRES } from "@/lib/constants/genres";

interface SearchFilters {
  contentType: "movie" | "tv" | "anime";
  genres: string[];
  yearRange: [number, number];
  minRating: number;
  sortBy: "relevance" | "rating" | "release_date" | "popularity";
}

interface SearchSidebarProps {
  filters: SearchFilters;
  onFilterChange: (newFilters: Partial<SearchFilters>) => void;
  className?: string;
}

const ANIME_GENRES = [
  { id: 1, name: "Action", slug: "action" },
  { id: 2, name: "Adventure", slug: "adventure" },
  { id: 4, name: "Comedy", slug: "comedy" },
  { id: 8, name: "Drama", slug: "drama" },
  { id: 10, name: "Fantasy", slug: "fantasy" },
  { id: 14, name: "Horror", slug: "horror" },
  { id: 7, name: "Mystery", slug: "mystery" },
  { id: 22, name: "Romance", slug: "romance" },
  { id: 24, name: "Sci-Fi", slug: "sci-fi" },
  { id: 36, name: "Slice of Life", slug: "slice-of-life" },
  { id: 30, name: "Sports", slug: "sports" },
  { id: 37, name: "Supernatural", slug: "supernatural" },
  { id: 41, name: "Suspense", slug: "suspense" },
];

const CONTENT_TYPES = [
  { id: "movie", label: "Movies", icon: "M3 5h18v14H3zM7 5v14m10-14v14M3 10h18" },
  { id: "tv", label: "TV Shows", icon: "M3 7h18v13H3zM8 3l4 4 4-4" },
  {
    id: "anime",
    label: "Anime",
    icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 10h.01M15 10h.01M9 15c2 1.4 4 1.4 6 0",
  },
] as const;

export function SearchSidebar({ filters, onFilterChange, className = "" }: SearchSidebarProps) {
  const availableGenres = useMemo(() => {
    if (filters.contentType === "anime") return ANIME_GENRES;
    const matchingGenres = GENRES.filter((genre) => genre.type === filters.contentType);
    const uniqueGenres = new Map(matchingGenres.map((genre) => [genre.name, genre]));
    return Array.from(uniqueGenres.values()).sort((first, second) =>
      first.name.localeCompare(second.name),
    );
  }, [filters.contentType]);

  function toggleGenre(slug: string) {
    onFilterChange({
      genres: filters.genres.includes(slug)
        ? filters.genres.filter((genre) => genre !== slug)
        : [...filters.genres, slug],
    });
  }

  return (
    <aside className={`search-filter-card ${className}`}>
      <div className="search-filter-card-head">
        <div>
          <span>Refine results</span>
          <h2>Filters</h2>
        </div>
        {filters.genres.length > 0 && (
          <button type="button" onClick={() => onFilterChange({ genres: [] })}>
            Reset
          </button>
        )}
      </div>

      <section className="search-filter-section">
        <h3>Content type</h3>
        <div className="search-type-options">
          {CONTENT_TYPES.map((type) => {
            const active = filters.contentType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                className={active ? "active" : undefined}
                onClick={() => onFilterChange({ contentType: type.id, genres: [] })}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={type.icon} />
                </svg>
                <span>{type.label}</span>
                <span className="search-type-check">{active ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="search-filter-section">
        <h3>Sort results</h3>
        <select
          value={filters.sortBy}
          onChange={(event) =>
            onFilterChange({ sortBy: event.target.value as SearchFilters["sortBy"] })
          }
        >
          <option value="relevance">Most relevant</option>
          <option value="popularity">Most popular</option>
          <option value="rating">Highest rated</option>
          <option value="release_date">Newest first</option>
        </select>
      </section>

      <section className="search-filter-section">
        <div className="search-filter-section-title">
          <h3>Genres</h3>
          <span>{filters.genres.length ? `${filters.genres.length} selected` : "Any genre"}</span>
        </div>
        <div className="search-genre-options">
          {availableGenres.map((genre) => (
            <button
              key={genre.id}
              type="button"
              className={filters.genres.includes(genre.slug) ? "active" : undefined}
              onClick={() => toggleGenre(genre.slug)}
            >
              {genre.name}
            </button>
          ))}
        </div>
      </section>

      <section className="search-filter-section">
        <div className="search-filter-section-title">
          <h3>Release years</h3>
          <span>
            {filters.yearRange[0]}–{filters.yearRange[1]}
          </span>
        </div>
        <Slider
          min={1900}
          max={new Date().getFullYear()}
          value={filters.yearRange}
          onChange={(yearRange) => onFilterChange({ yearRange })}
        />
      </section>

      <section className="search-filter-section">
        <div className="search-filter-section-title">
          <h3>Minimum rating</h3>
          <span>{filters.minRating > 0 ? `${filters.minRating}+` : "Any rating"}</span>
        </div>
        <Slider
          min={0}
          max={10}
          step={0.5}
          value={[filters.minRating, 10]}
          onChange={(ratingRange) => onFilterChange({ minRating: ratingRange[0] })}
        />
      </section>
    </aside>
  );
}
