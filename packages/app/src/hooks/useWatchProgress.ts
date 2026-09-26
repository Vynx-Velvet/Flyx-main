"use client";

/**
 * useWatchProgress — live view of the watch-progress store for resume
 * surfaces (watchlist cards, rails). Re-reads whenever the player writes
 * (same tab, via WATCH_PROGRESS_EVENT) or another tab writes (storage event).
 */

import { useCallback, useEffect, useState } from "react";
import {
  getAllWatchProgress,
  latestForContent,
  WATCH_PROGRESS_EVENT,
  WATCH_PROGRESS_KEY,
  type ProgressEntry,
} from "@/lib/watch-progress";

export function useWatchProgress() {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);

  useEffect(() => {
    const refresh = () => setEntries(getAllWatchProgress());
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === WATCH_PROGRESS_KEY) refresh();
    };
    window.addEventListener(WATCH_PROGRESS_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(WATCH_PROGRESS_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  /** Most recent entry for a title (any episode), or null. */
  const latestFor = useCallback(
    (contentId: string, contentType: "movie" | "tv") => latestForContent(entries, contentId, contentType),
    [entries],
  );

  return { entries, latestFor };
}
