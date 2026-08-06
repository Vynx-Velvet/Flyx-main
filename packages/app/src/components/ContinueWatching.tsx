"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAnalytics } from "@/components/analytics/AnalyticsProvider";
import { SYNC_DATA_CHANGED_EVENT, useSyncContext } from "@/lib/sync";
import type { WatchProgress } from "@/lib/services/user-tracking";

interface ContentMetadata {
  id: string;
  title: string;
  posterPath: string;
  backdropPath: string;
  mediaType: "movie" | "tv";
}

interface ContinueWatchingItem extends WatchProgress {
  metadata?: ContentMetadata;
}

/**
 * Continue Watching — horizontal rail of in-progress titles.
 * Hides entirely when empty. Designed to sit inside content-container.
 */
export default function ContinueWatching() {
  const router = useRouter();
  const analytics = useAnalytics();
  const { isInitialSyncComplete } = useSyncContext();
  const { getAllWatchProgress, removeWatchProgress, trackEvent } = analytics;
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [metadataCache, setMetadataCache] = useState<Record<string, ContentMetadata>>({});
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 6);
    setCanRight(max > 6 && el.scrollLeft < max - 6);
  }, []);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -560 : 560, behavior: "smooth" });
  };

  const fetchMetadata = useCallback(
    async (
      contentId: string,
      contentType: "movie" | "tv",
    ): Promise<ContentMetadata | null> => {
      if (metadataCache[contentId]) return metadataCache[contentId];

      try {
        // Prefer app proxy so we never need a public TMDB key in the browser
        const res = await fetch(
          `/api/tmdb?path=${encodeURIComponent(`/${contentType}/${contentId}`)}`,
        );
        if (!res.ok) return null;
        const data = await res.json();
        const metadata: ContentMetadata = {
          id: contentId,
          title: data.title || data.name || "Unknown",
          posterPath: data.poster_path || "",
          backdropPath: data.backdrop_path || "",
          mediaType: contentType,
        };
        setMetadataCache((prev) => ({ ...prev, [contentId]: metadata }));
        return metadata;
      } catch {
        return null;
      }
    },
    [metadataCache],
  );

  useEffect(() => {
    const handleSync = () => {
      if (analytics.reloadWatchProgress) analytics.reloadWatchProgress();
      setReloadTrigger((p) => p + 1);
    };
    window.addEventListener(SYNC_DATA_CHANGED_EVENT, handleSync);
    return () => window.removeEventListener(SYNC_DATA_CHANGED_EVENT, handleSync);
  }, [analytics]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const progressItems = getAllWatchProgress()
          .filter((p) => p.completionPercentage > 2 && p.completionPercentage < 95)
          .slice(0, 12);

        const withMeta: ContinueWatchingItem[] = [];
        for (const item of progressItems) {
          const metadata = await fetchMetadata(item.contentId, item.contentType);
          if (cancelled) return;
          withMeta.push({ ...item, metadata: metadata || undefined });
        }
        if (!cancelled) setItems(withMeta);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [getAllWatchProgress, fetchMetadata, reloadTrigger, isInitialSyncComplete]);

  useEffect(() => {
    const t = window.setTimeout(updateScroll, 100);
    return () => window.clearTimeout(t);
  }, [items, loading, updateScroll]);

  const handleItemClick = useCallback(
    (item: ContinueWatchingItem) => {
      trackEvent("continue_watching_clicked", {
        content_id: item.contentId,
        content_type: item.contentType,
        progress: item.completionPercentage,
      });

      const params = new URLSearchParams({
        tmdbId: item.contentId,
        mediaType: item.contentType,
      });
      if (item.contentType === "tv" && item.seasonNumber && item.episodeNumber) {
        params.set("season", String(item.seasonNumber));
        params.set("episode", String(item.episodeNumber));
      }
      if (item.metadata?.title) {
        params.set("title", item.metadata.title);
      }
      router.push(`/watch?${params.toString()}`);
    },
    [router, trackEvent],
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent, item: ContinueWatchingItem) => {
      e.stopPropagation();
      e.preventDefault();
      const ok = removeWatchProgress(
        item.contentId,
        item.seasonNumber,
        item.episodeNumber,
      );
      if (ok) {
        setItems((prev) =>
          prev.filter(
            (i) =>
              !(
                i.contentId === item.contentId &&
                i.seasonNumber === item.seasonNumber &&
                i.episodeNumber === item.episodeNumber
              ),
          ),
        );
        trackEvent("continue_watching_removed", {
          content_id: item.contentId,
          content_type: item.contentType,
        });
      }
    },
    [removeWatchProgress, trackEvent],
  );

  const formatTimeRemaining = (currentTime: number, duration: number): string => {
    const remaining = Math.max(0, duration - currentTime);
    const minutes = Math.floor(remaining / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m left`;
    return `${Math.max(1, minutes)}m left`;
  };

  if (loading) {
    return (
      <section className="section">
        <div className="section-head">
          <h2>Continue Watching</h2>
        </div>
        <div className="flex gap-3.5 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="skeleton h-40 w-72 shrink-0 rounded-xl sm:h-44 sm:w-80"
            />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="section">
      <div className="section-head">
        <div>
          <h2>Continue Watching</h2>
          <p className="mt-0.5 pl-[0.9rem] text-xs text-white/35">
            Pick up where you left off
          </p>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex">
          <button
            type="button"
            onClick={() => scrollBy("left")}
            disabled={!canLeft}
            aria-label="Scroll left"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/70 transition hover:border-[#00e5bf]/35 hover:bg-[#00e5bf]/12 hover:text-white disabled:opacity-30"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollBy("right")}
            disabled={!canRight}
            aria-label="Scroll right"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/70 transition hover:border-[#00e5bf]/35 hover:bg-[#00e5bf]/12 hover:text-white disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      <div
        className="rail-fade"
        data-can-scroll-left={canLeft ? "true" : "false"}
        data-can-scroll-right={canRight ? "true" : "false"}
      >
        <div
          ref={scrollRef}
          onScroll={updateScroll}
          className="flex gap-3.5 overflow-x-auto pb-1 scrollbar-none"
          role="list"
          aria-label="Continue watching"
        >
          {items.map((item) => (
            <div
              key={`${item.contentId}-${item.seasonNumber}-${item.episodeNumber}`}
              role="listitem"
              className="group w-72 shrink-0 cursor-pointer sm:w-80"
              onClick={() => handleItemClick(item)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleItemClick(item);
                }
              }}
              tabIndex={0}
              aria-label={`Continue watching ${item.metadata?.title || "content"}`}
            >
              <div
                className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101018] transition-all duration-300 hover:-translate-y-1.5 hover:border-[rgba(0,229,191,0.3)] hover:shadow-[0_18px_48px_rgba(0,0,0,0.5),0_0_40px_rgba(0,229,191,0.12)]"
              >
                <div className="relative h-40 sm:h-44">
                  {item.metadata?.backdropPath || item.metadata?.posterPath ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w780${item.metadata.backdropPath || item.metadata.posterPath}`}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/[0.03]">
                      <svg
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-white/20"
                        aria-hidden
                      >
                        <rect x="2" y="2" width="20" height="20" rx="2" />
                        <path d="m10 9 5 3-5 3V9z" />
                      </svg>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                  <button
                    type="button"
                    onClick={(e) => handleRemove(e, item)}
                    className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/65 text-sm text-white opacity-100 transition hover:border-red-500/60 hover:bg-red-600/90 md:opacity-0 md:group-hover:opacity-100"
                    aria-label={`Remove ${item.metadata?.title || "item"}`}
                  >
                    ✕
                  </button>

                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{
                        background: "linear-gradient(135deg, #00e5bf, #8b7cf0)",
                        boxShadow:
                          "0 10px 32px rgba(0,229,191,0.45), 0 0 0 1px rgba(255,255,255,0.2) inset",
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#030307" className="ml-0.5" aria-hidden>
                        <path d="M8 5.5v13l11-6.5L8 5.5z" />
                      </svg>
                    </div>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <h3 className="line-clamp-1 text-sm font-semibold text-white">
                      {item.metadata?.title || `Content ${item.contentId}`}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-white/45">
                      {item.contentType === "tv" &&
                        item.seasonNumber != null &&
                        item.episodeNumber != null && (
                          <span className="meta-chip !px-1.5 !py-0 !text-[10px]">
                            S{item.seasonNumber} E{item.episodeNumber}
                          </span>
                        )}
                      <span>
                        {formatTimeRemaining(item.currentTime, item.duration)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-white/[0.06]">
                  <div
                    className="h-full rounded-r-full bg-gradient-to-r from-[#00e5bf] to-[#8b7cf0] transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(2, item.completionPercentage))}%`,
                      boxShadow: "0 0 8px rgba(0,229,191,0.4)",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
