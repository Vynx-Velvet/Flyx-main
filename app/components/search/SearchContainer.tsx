/**
 * SearchContainer Component
 * Integrates SearchBar, SearchResults, and SearchSuggestions with caching
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { SearchResult } from '@/types/media';
import { tmdbService } from '@/lib/services/tmdb';
import { SearchBar } from './SearchBar';
import { SearchResults } from './SearchResults';
import { SearchSuggestions, saveRecentSearch } from './SearchSuggestions';
import styles from './SearchContainer.module.css';

export interface SearchContainerProps {
  onClose?: () => void;
  autoFocus?: boolean;
}

// Cache for search results
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export const SearchContainer: React.FC<SearchContainerProps> = ({
  onClose,
  autoFocus = false,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Handle search with caching
  const handleSearch = useCallback(async (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setResults([]);
      setShowSuggestions(true);
      return;
    }

    setShowSuggestions(false);
    setSelectedIndex(-1);

    // Check cache first
    const cached = searchCache.get(trimmedQuery.toLowerCase());
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setResults(cached.results);
      return;
    }

    // Fetch from API
    setLoading(true);
    try {
      const searchResults = await tmdbService.search(trimmedQuery);

      // Limit to 20 results as per requirements
      const limitedResults = searchResults.slice(0, 20);

      // Cache the results
      searchCache.set(trimmedQuery.toLowerCase(), {
        results: limitedResults,
        timestamp: Date.now(),
      });

      setResults(limitedResults);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle result selection
  const handleSelect = useCallback((id: string, mediaType: 'movie' | 'tv' | 'person') => {
    if (query.trim()) {
      saveRecentSearch(query.trim());
    }

    // Navigate to details page
    router.push(`/details/${mediaType}/${id}`);

    // Close search
    onClose?.();
  }, [query, router, onClose]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: string) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  }, [handleSearch]);

  // Handle keyboard navigation
  const handleKeyboardNavigate = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  // Handle expand change
  const handleExpandChange = useCallback((isExpanded: boolean) => {
    setExpanded(isExpanded);
    if (!isExpanded) {
      setQuery('');
      setResults([]);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    }
  }, []);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (expanded && !query) {
          setExpanded(false);
          onClose?.();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded, query, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && expanded) {
        if (query) {
          setQuery('');
          setResults([]);
          setShowSuggestions(true);
        } else {
          setExpanded(false);
          onClose?.();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [expanded, query, onClose]);

  return (
    <div className={styles.searchContainer} ref={containerRef}>
      <SearchBar
        onSearch={handleSearch}
        autoFocus={autoFocus}
        expanded={expanded}
        onExpandChange={handleExpandChange}
      />

      {expanded && (
        <>
          {showSuggestions && !query && (
            <div className={styles.suggestionsWrapper}>
              <SearchSuggestions
                query={query}
                onSelect={handleSuggestionSelect}
              />
            </div>
          )}

          {(query || loading) && (
            <SearchResults
              results={results}
              loading={loading}
              query={query}
              onSelect={handleSelect}
              selectedIndex={selectedIndex}
              onKeyboardNavigate={handleKeyboardNavigate}
            />
          )}
        </>
      )}
    </div>
  );
};

export default SearchContainer;
