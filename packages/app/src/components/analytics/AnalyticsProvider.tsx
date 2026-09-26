'use client';

import { createContext, useCallback, useContext } from 'react';
import type { WatchProgress } from '@/lib/services/user-tracking';
import {
  getAllWatchProgress as readAll,
  removeWatchProgress as removeOne,
  updateWatchProgress as upsert,
  WATCH_PROGRESS_EVENT,
  type UpsertInput,
} from '@/lib/watch-progress';

/**
 * Analytics context — thin façade over lib/watch-progress (the single
 * localStorage-backed store the player writes and every "resume" surface
 * reads) plus no-op event tracking hooks.
 */

export interface AnalyticsContextValue {
  trackEvent: (name: string, data?: Record<string, unknown>) => void;
  trackPageView: (path: string) => void;
  getAllWatchProgress: () => WatchProgress[];
  /** Record where the viewer is (called by the player every few seconds). */
  updateWatchProgress: (input: UpsertInput) => void;
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
  updateWatchProgress: () => {},
  removeWatchProgress: () => false,
  reloadWatchProgress: () => {},
});

export function useAnalytics(): AnalyticsContextValue {
  return useContext(AnalyticsContext);
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const getAllWatchProgress = useCallback((): WatchProgress[] => readAll(), []);

  const updateWatchProgress = useCallback((input: UpsertInput) => {
    upsert(input);
  }, []);

  const removeWatchProgress = useCallback(
    (contentId: string, seasonNumber?: number, episodeNumber?: number): boolean => {
      // Legacy signature: no season/episode = remove every entry for the id.
      const all = readAll();
      const targets = all.filter(
        (e) =>
          e.contentId === contentId &&
          (seasonNumber == null || e.seasonNumber === seasonNumber) &&
          (episodeNumber == null || e.episodeNumber === episodeNumber),
      );
      let removed = false;
      for (const t of targets) {
        removed =
          removeOne({
            contentId: t.contentId,
            contentType: t.contentType,
            seasonNumber: t.seasonNumber,
            episodeNumber: t.episodeNumber,
          }) || removed;
      }
      return removed;
    },
    []
  );

  const reloadWatchProgress = useCallback(() => {
    window.dispatchEvent(new Event(WATCH_PROGRESS_EVENT));
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
        updateWatchProgress,
        removeWatchProgress,
        reloadWatchProgress,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
}
