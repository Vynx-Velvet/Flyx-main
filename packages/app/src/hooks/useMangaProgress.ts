"use client";

import { useCallback, useEffect, useState } from "react";
import type { MangaReadingProgress } from "@flyx/core";

const STORAGE_KEY = "flyx_manga_progress_v1";

function loadAll(): Record<string, MangaReadingProgress> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function saveAll(data: Record<string, MangaReadingProgress>) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export function useMangaProgress() {
  const [progress, setProgress] = useState<Record<string, MangaReadingProgress>>({});

  useEffect(() => { setProgress(loadAll()); }, []);

  const saveProgress = useCallback((mangaId: string, chapterNumber: number, pageNumber: number) => {
    setProgress(prev => {
      const next = {
        ...prev,
        [mangaId]: {
          mangaId,
          chapterId: `${mangaId}-ch-${chapterNumber}`,
          chapterNumber,
          pageNumber,
          lastReadAt: Date.now(),
        },
      };
      saveAll(next);
      return next;
    });
  }, []);

  const getProgress = useCallback((mangaId: string): MangaReadingProgress | null => {
    return progress[mangaId] || null;
  }, [progress]);

  const getChapterProgress = useCallback((mangaId: string, chapterNumber: number): number | null => {
    const p = progress[mangaId];
    if (p && p.chapterNumber === chapterNumber) return p.pageNumber;
    return null;
  }, [progress]);

  return { progress, saveProgress, getProgress, getChapterProgress };
}
