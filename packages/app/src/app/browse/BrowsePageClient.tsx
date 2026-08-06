"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ContentCard from "@/components/ContentCard";

export interface BrowseItem {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  posterUrl?: string;
  rating?: number;
  year?: string;
}

interface BrowsePageClientProps {
  mediaType: "movie" | "tv";
  initialItems: BrowseItem[];
  initialPage: number;
  totalPages: number;
}

function posterFromPath(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `https://image.tmdb.org/t/p/w342${p}`;
}

function mapResults(
  results: any[],
  mediaType: "movie" | "tv",
): BrowseItem[] {
  return (results || [])
    .filter((r) => r && r.id)
    .map((r) => ({
      id: r.id as number,
      title: (r.title || r.name || "Untitled") as string,
      mediaType,
      posterUrl: posterFromPath(r.poster_path),
      rating: typeof r.vote_average === "number" ? r.vote_average : undefined,
      year: ((r.release_date || r.first_air_date || "") as string).slice(0, 4) ||
        undefined,
    }));
}

async function fetchBrowsePage(
  mediaType: "movie" | "tv",
  page: number,
): Promise<{ items: BrowseItem[]; totalPages: number }> {
  const path =
    mediaType === "tv"
      ? `/tv/popular?page=${page}`
      : `/movie/popular?page=${page}`;
  const res = await fetch(`/api/tmdb?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    throw new Error(`TMDB ${res.status}`);
  }
  const data = await res.json();
  const totalPages = Math.min(
    typeof data.total_pages === "number" ? data.total_pages : 1,
    500, // TMDB hard cap
  );
  return {
    items: mapResults(data.results || [], mediaType),
    totalPages,
  };
}

export default function BrowsePageClient({
  mediaType,
  initialItems,
  initialPage,
  totalPages: initialTotalPages,
}: BrowsePageClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<BrowseItem[]>(initialItems);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTop, setShowTop] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const pageRef = useRef(page);
  const totalPagesRef = useRef(totalPages);
  const mediaTypeRef = useRef(mediaType);

  // Sync when server props change (tab switch / soft navigation)
  useEffect(() => {
    setItems(initialItems);
    setPage(initialPage);
    setTotalPages(initialTotalPages);
    setError(null);
    setLoading(false);
    loadingRef.current = false;
    pageRef.current = initialPage;
    totalPagesRef.current = initialTotalPages;
    mediaTypeRef.current = mediaType;
  }, [mediaType, initialItems, initialPage, initialTotalPages]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    const next = pageRef.current + 1;
    if (next > totalPagesRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);
    const type = mediaTypeRef.current;

    try {
      const { items: nextItems, totalPages: tp } = await fetchBrowsePage(
        type,
        next,
      );
      // Ignore stale responses if user switched tabs mid-fetch
      if (mediaTypeRef.current !== type) return;

      setTotalPages(tp);
      totalPagesRef.current = tp;
      setPage(next);
      pageRef.current = next;
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const deduped = nextItems.filter((i) => !seen.has(i.id));
        return [...prev, ...deduped];
      });
    } catch {
      if (mediaTypeRef.current === type) {
        setError("Couldn’t load more titles. Scroll to retry.");
      }
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore();
        }
      },
      { root: null, rootMargin: "480px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, mediaType, items.length]);

  // Show "return to top" after scrolling down a bit
  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 480);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const switchType = (next: "movie" | "tv") => {
    if (next === mediaType) return;
    // Notify layout (sidebar) immediately so Movies/TV rail updates with the tab
    window.dispatchEvent(
      new CustomEvent("flyx:navigate", { detail: { type: next } }),
    );
    router.push(`/browse?type=${next}`, { scroll: true });
  };

  const hasMore = page < totalPages;

  return (
    <main className="min-h-screen relative">
      <div className="page-glow" />
      {mediaType === "tv" && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-80"
          style={{
            background:
              "radial-gradient(ellipse 55% 70% at 70% 0%, rgba(139,124,240,0.14) 0%, transparent 60%)",
          }}
        />
      )}

      <div className="content-container relative py-5 md:py-8">
        <div className="page-header mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Library</p>
            <h1>{mediaType === "movie" ? "Movies" : "TV Shows"}</h1>
            <p className="subtitle">
              {mediaType === "movie"
                ? "Popular movies, endlessly scrollable"
                : "Popular series, endlessly scrollable"}
            </p>
          </div>

          <div className="segmented" role="tablist" aria-label="Content type">
            <button
              type="button"
              role="tab"
              data-active={mediaType === "movie" ? "true" : "false"}
              aria-selected={mediaType === "movie"}
              onClick={() => switchType("movie")}
            >
              Movies
            </button>
            <button
              type="button"
              role="tab"
              data-active={mediaType === "tv" ? "true" : "false"}
              aria-selected={mediaType === "tv"}
              onClick={() => switchType("tv")}
            >
              TV Shows
            </button>
          </div>
        </div>

        {items.length === 0 && !loading ? (
          <div className="glass-strong flex flex-col items-center justify-center rounded-3xl px-6 py-24 text-center">
            <div
              className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-white/35"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,229,191,0.1), rgba(139,124,240,0.08))",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m10 9 5 3-5 3V9z" />
              </svg>
            </div>
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-white/70">
              No content loaded
            </p>
            <p className="mt-1.5 max-w-xs text-sm text-white/35">
              Check your TMDB API key or try again in a moment.
            </p>
            <div className="mt-6 flex gap-3">
              <Link href="/" className="btn-secondary">
                Back home
              </Link>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  void loadMore();
                }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="content-grid">
              {items.map((item, i) => (
                <div
                  key={`${item.mediaType}-${item.id}`}
                  style={{
                    animation: "rail-fade-in 0.45s var(--ease-out) both",
                    animationDelay: `${Math.min((i % 24) * 0.02, 0.35)}s`,
                  }}
                >
                  <ContentCard
                    tmdbId={item.id}
                    title={item.title}
                    mediaType={item.mediaType}
                    posterUrl={item.posterUrl}
                    rating={item.rating}
                    year={item.year}
                  />
                </div>
              ))}
            </div>

            {/* Infinite-scroll sentinel + status */}
            <div
              ref={sentinelRef}
              className="flex flex-col items-center justify-center gap-3 py-10"
              aria-live="polite"
            >
              {loading && (
                <div className="browse-loading" aria-label="Loading more titles">
                  <span className="browse-spinner" />
                  <span className="text-sm text-white/40">Loading more…</span>
                </div>
              )}
              {error && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  className="btn-secondary text-sm"
                >
                  {error}
                </button>
              )}
              {!hasMore && items.length > 0 && !loading && (
                <p className="text-xs font-medium tracking-wide text-white/25">
                  You’re all caught up
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Return to top — appears once you’ve scrolled the infinite grid */}
      <button
        type="button"
        className={`browse-to-top${showTop ? " browse-to-top-visible" : ""}`}
        onClick={scrollToTop}
        aria-label="Return to top of page"
        tabIndex={showTop ? 0 : -1}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
        <span>Top</span>
      </button>
    </main>
  );
}
