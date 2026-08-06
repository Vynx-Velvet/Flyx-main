'use client';

import React, { createContext, useContext, useCallback } from 'react';
import type { WatchProgress } from '@/lib/services/user-tracking';

/**
 * Minimal watch progress store using localStorage.
 * This is a lightweight replacement for the full analytics/sync system.
 */

const STORAGE_KEY = 'flyx_watch_progress';

function loadProgress(): WatchProgress[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WatchProgress[];
  } catch {
    return [];
  }
}

function saveProgress(progress: WatchProgress[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage full or unavailable
  }
}

export interface AnalyticsContextValue {
  trackEvent: (name: string, data?: Record<string, unknown>) => void;
  trackPageView: (path: string) => void;
  getAllWatchProgress: () => WatchProgress[];
  removeWatchProgress: (
    contentId: string,
    seasonNumber?: number,
    episodeNumber?: number
  ) => boolean;
  reloadWatchProgress: () => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({
  trackEvent: () => {},
  trackPageView: () => {},
  getAllWatchProgress: () => [],
  removeWatchProgress: () => false,
  reloadWatchProgress: () => {},
});

export function useAnalytics(): AnalyticsContextValue {
  return useContext(AnalyticsContext);
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const getAllWatchProgress = useCallback((): WatchProgress[] => {
    return loadProgress();
  }, []);

  const removeWatchProgress = useCallback(
    (contentId: string, seasonNumber?: number, episodeNumber?: number): boolean => {
      const items = loadProgress();
      const filtered = items.filter(
        (item) =>
          !(
            item.contentId === contentId &&
            item.seasonNumber === (seasonNumber ?? item.seasonNumber) &&
            item.episodeNumber === (episodeNumber ?? item.episodeNumber)
          )
      );
      if (filtered.length === items.length) return false;
      saveProgress(filtered);
      return true;
    },
    []
  );

  const reloadWatchProgress = useCallback(() => {
    // Force re-read from localStorage on next access
    window.dispatchEvent(new Event('local-storage-changed'));
  }, []);

  const trackEvent = useCallback(
    (name: string, _data?: Record<string, unknown>) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[Analytics] ${name}`, _data);
      }
    },
    []
  );

  const trackPageView = useCallback((path: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Analytics] page_view`, path);
    }
  }, []);

  return (
    <AnalyticsContext.Provider
      value={{
        trackEvent,
        trackPageView,
        getAllWatchProgress,
        removeWatchProgress,
        reloadWatchProgress,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}

export default AnalyticsProvider;
