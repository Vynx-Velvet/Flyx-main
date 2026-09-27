"use client";

import { useCallback, useEffect, useState } from "react";
import type { MangaReadingProgress } from "@flyx/core";
import { accountKey, ACCOUNT_SCOPE_EVENT } from "@/lib/account-storage";

// Base key; stored per account (see lib/account-storage).
const STORAGE_KEY = "flyx_manga_progress_v1";

function loadAll(): Record<string, MangaReadingProgress> {
  if (typeof window === "undefined") return {};
  const key = accountKey(STORAGE_KEY);
  if (!key) return {};
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch { return {}; }
}

function saveAll(data: Record<string, MangaReadingProgress>) {
  if (typeof window === "undefined") return;
  const key = accountKey(STORAGE_KEY);
  if (!key) return; // account not known yet — never write a shared key
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

export function useMangaProgress() {
  const [progress, setProgress] = useState<Record<string, MangaReadingProgress>>({});

  useEffect(() => {
    setProgress(loadAll());
    // Re-read once the signed-in account is known (or changes).
    const onScope = () => setProgress(loadAll());
    window.addEventListener(ACCOUNT_SCOPE_EVENT, onScope);
    return () => window.removeEventListener(ACCOUNT_SCOPE_EVENT, onScope);
  }, []);

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
