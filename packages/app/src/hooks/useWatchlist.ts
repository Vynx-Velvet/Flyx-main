"use client";

import { useCallback, useEffect, useState } from "react";

export type WatchlistMediaType = "movie" | "tv" | "anime" | "manga";

export interface WatchlistItem {
  id: string;
  contentId: string;
  mediaType: WatchlistMediaType;
  title: string;
  posterPath?: string;
  rating?: number;
  year?: string;
  addedAt: number;
}

const STORAGE_KEY = "flyx_watchlist_v1";

function loadItems(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WatchlistItem[];
    // Normalize legacy items that might lack mediaType
    return parsed
      .filter((i) => i && i.contentId && i.title)
      .map((i) => ({
        ...i,
        mediaType:
          i.mediaType === "tv" || i.mediaType === "anime" || i.mediaType === "movie" || i.mediaType === "manga"
            ? i.mediaType
            : "movie",
        id: i.id || `${i.mediaType || "movie"}-${i.contentId}`,
      }));
  } catch {
    return [];
  }
}

function saveItems(items: WatchlistItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / private mode
  }
}

export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(loadItems());
    setLoaded(true);
  }, []);

  const addItem = useCallback(
    (
      item: Omit<WatchlistItem, "id" | "addedAt"> & {
        id?: string;
      },
    ) => {
      setItems((prev) => {
        const contentId = String(item.contentId || item.id || "");
        if (!contentId) return prev;
        if (
          prev.some(
            (i) =>
              i.contentId === contentId && i.mediaType === item.mediaType,
          )
        ) {
          return prev;
        }
        const next: WatchlistItem[] = [
          {
            id: `${item.mediaType}-${contentId}`,
            contentId,
            mediaType: item.mediaType,
            title: item.title,
            posterPath: item.posterPath,
            rating: item.rating,
            year: item.year,
            addedAt: Date.now(),
          },
          ...prev,
        ];
        saveItems(next);
        return next;
      });
    },
    [],
  );

  const removeItem = useCallback(
    (contentId: string, mediaType?: WatchlistMediaType) => {
      setItems((prev) => {
        const next = prev.filter(
          (i) =>
            !(
              i.contentId === contentId &&
              (mediaType ? i.mediaType === mediaType : true)
            ),
        );
        saveItems(next);
        return next;
      });
    },
    [],
  );

  const clearAll = useCallback(() => {
    setItems([]);
    saveItems([]);
  }, []);

  const isInWatchlist = useCallback(
    (contentId: string, mediaType?: WatchlistMediaType) =>
      items.some(
        (i) =>
          i.contentId === String(contentId) &&
          (mediaType ? i.mediaType === mediaType : true),
      ),
    [items],
  );

  const toggleItem = useCallback(
    (item: Omit<WatchlistItem, "id" | "addedAt">) => {
      const contentId = String(item.contentId);
      const exists = items.some(
        (i) => i.contentId === contentId && i.mediaType === item.mediaType,
      );
      if (exists) {
        removeItem(contentId, item.mediaType);
        return false;
      }
      addItem(item);
      return true;
    },
    [items, addItem, removeItem],
  );

  return {
    items,
    loaded,
    addItem,
    removeItem,
    clearAll,
    isInWatchlist,
    toggleItem,
    watchlist: items,
  };
}

export default useWatchlist;
