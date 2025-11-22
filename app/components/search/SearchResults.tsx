/**
 * SearchResults Component
 * Displays search results in a glassmorphism panel with smooth animations
 */

'use client';

import React, { useRef, useEffect } from 'react';
import type { SearchResult } from '@/types/media';
import { GlassPanel } from '@/components/ui/GlassPanel';
import styles from './SearchResults.module.css';

export interface SearchResultsProps {
  results: SearchResult[];
  loading?: boolean;
  query: string;
  onSelect: (id: string, mediaType: 'movie' | 'tv' | 'person') => void;
  selectedIndex?: number;
  onKeyboardNavigate?: (index: number) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  loading = false,
  query,
  onSelect,
  selectedIndex = -1,
  onKeyboardNavigate,
}) => {
  const resultsRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!results.length || !onKeyboardNavigate) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(selectedIndex + 1, results.length - 1);
        onKeyboardNavigate(nextIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(selectedIndex - 1, -1);
        onKeyboardNavigate(prevIndex);
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        const result = results[selectedIndex];
        onSelect(result.id, result.mediaType);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex, onSelect, onKeyboardNavigate]);

  if (!query && !loading) {
    return null;
  }

  return (
    <GlassPanel className={styles.searchResults}>
      <div className={styles.resultsContainer} ref={resultsRef}>
        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Searching...</p>
          </div>
        )}

        {!loading && results.length === 0 && query && (
          <div className={styles.noResults}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p>No results found for "{query}"</p>
            <span className={styles.suggestion}>Try different keywords</span>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <div className={styles.resultsHeader}>
              <span className={styles.resultCount}>
                {results.length} result{results.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className={styles.resultsList}>
              {results.map((result, index) => (
                <button
                  key={result.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={`${styles.resultItem} ${index === selectedIndex ? styles.selected : ''
                    }`}
                  onClick={() => onSelect(result.id, result.mediaType)}
                  type="button"
                >
                  <div className={styles.resultPoster}>
                    {result.posterPath ? (
                      <img
                        src={result.posterPath}
                        alt={result.title}
                        loading="lazy"
                      />
                    ) : (
                      <div className={styles.posterPlaceholder}>
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className={styles.resultInfo}>
                    <h3 className={styles.resultTitle}>{result.title}</h3>
                    <div className={styles.resultMeta}>
                      <span className={styles.mediaType}>
                        {result.mediaType === 'movie'
                          ? 'Movie'
                          : result.mediaType === 'tv'
                            ? 'TV Show'
                            : 'Person'}
                      </span>
                      {result.releaseDate && (
                        <>
                          <span className={styles.separator}>•</span>
                          <span className={styles.year}>
                            {new Date(result.releaseDate).getFullYear()}
                          </span>
                        </>
                      )}
                      {(result.rating || 0) > 0 && (
                        <>
                          <span className={styles.separator}>•</span>
                          <span className={styles.rating}>
                            ⭐ {(result.rating || 0).toFixed(1)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className={styles.resultArrow}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M7 4l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </GlassPanel>
  );
};

export default SearchResults;
