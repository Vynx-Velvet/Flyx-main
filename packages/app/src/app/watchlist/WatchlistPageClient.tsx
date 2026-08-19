"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ContentCard from "@/components/ContentCard";
import DownloadMenu from "@/components/downloads/DownloadMenu";
import type { DownloadItemInput } from "@/lib/downloads/types";
import {
  useWatchlist,
  type WatchlistItem,
  type WatchlistMediaType,
} from "@/hooks/useWatchlist";

type Filter = "all" | WatchlistMediaType;
type Sort = "recent" | "title" | "rating";

function itemHref(item: WatchlistItem) {
  if (item.mediaType === "anime") return `/anime/${item.contentId}`;
  if (item.mediaType === "manga") return `/manga/${item.contentId}`;
  return `/details/${item.contentId}?type=${item.mediaType}`;
}

/** Movies/anime are single titles and can download directly; tv/manga need a picker. */
function directDownload(item: WatchlistItem): DownloadItemInput | null {
  if (item.mediaType === "movie") {
    return {
      kind: "video",
      tmdbId: Number(item.contentId) || 0,
      mediaType: "movie",
      title: item.title,
    };
  }
  if (item.mediaType === "anime") {
    return {
      kind: "video",
      tmdbId: 0,
      mediaType: "movie",
      malId: Number(item.contentId) || undefined,
      title: item.title,
    };
  }
  return null;
}

const DOWNLOAD_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

function formatAdded(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WatchlistPageClient() {
  const { items, loaded, removeItem, clearAll } = useWatchlist();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");

  const filtered = useMemo(() => {
    let list = [...items];
    if (filter !== "all") {
      list = list.filter((i) => i.mediaType === filter);
    }
    switch (sort) {
      case "title":
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "rating":
        list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      default:
        list.sort((a, b) => b.addedAt - a.addedAt);
    }
    return list;
  }, [items, filter, sort]);

  const movieCount = items.filter((i) => i.mediaType === "movie").length;
  const tvCount = items.filter((i) => i.mediaType === "tv").length;
  const animeCount = items.filter((i) => i.mediaType === "anime").length;

  const filters = (
    [
      { key: "all" as const, label: "All", count: items.length },
      { key: "movie" as const, label: "Movies", count: movieCount },
      { key: "tv" as const, label: "TV", count: tvCount },
      { key: "anime" as const, label: "Anime", count: animeCount },
    ] as const
  );

  return (
    <main className="watchlist-page min-h-screen">
      <div className="page-glow" />

      <div className="content-container relative py-5 md:py-8">
        {/* Header */}
        <div className="watchlist-header">
          <div>
            <p className="eyebrow">Library</p>
            <h1>Watchlist</h1>
            <p className="subtitle">
              {!loaded
                ? "Loading…"
                : items.length === 0
                  ? "Nothing saved yet — start building your list"
                  : `${items.length} saved title${items.length === 1 ? "" : "s"}`}
            </p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Clear your entire watchlist?")) clearAll();
              }}
              className="watchlist-clear"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Toolbar */}
        {items.length > 0 && (
          <div className="watchlist-toolbar">
            <div
              className="watchlist-filters"
              role="tablist"
              aria-label="Filter watchlist"
            >
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.key}
                  data-active={filter === f.key ? "true" : "false"}
                  onClick={() => setFilter(f.key)}
                  className="watchlist-filter"
                >
                  <span>{f.label}</span>
                  {f.count > 0 && (
                    <span className="watchlist-filter-count">{f.count}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="watchlist-sort">
              <span className="watchlist-sort-label">Sort</span>
              <div className="watchlist-sort-pills" role="group" aria-label="Sort">
                {(
                  [
                    ["recent", "Recent"],
                    ["title", "A–Z"],
                    ["rating", "Rating"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    data-active={sort === key ? "true" : "false"}
                    onClick={() => setSort(key)}
                    className="watchlist-sort-pill"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        {!loaded ? (
          <div className="watchlist-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[2/3] rounded-[0.9rem]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="watchlist-empty">
            <div className="watchlist-empty-icon" aria-hidden>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="watchlist-empty-title">Your watchlist is empty</p>
            <p className="watchlist-empty-copy">
              Save movies, shows, and anime with{" "}
              <strong>+ My List</strong>. They stay private on this device.
            </p>
            <div className="watchlist-empty-actions">
              <Link href="/browse?type=movie" className="btn-primary">
                Browse Movies
              </Link>
              <Link href="/browse?type=tv" className="btn-secondary">
                Browse TV
              </Link>
              <Link href="/anime" className="btn-secondary">
                Browse Anime
              </Link>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="watchlist-empty is-filter">
            <p className="watchlist-empty-title">Nothing in this filter</p>
            <p className="watchlist-empty-copy">
              Try another tab, or show everything in your list.
            </p>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="btn-secondary"
            >
              Show all
            </button>
          </div>
        ) : (
          <>
            <div className="watchlist-panel">
              <div className="watchlist-grid">
                {filtered.map((item: WatchlistItem, i) => {
                  const dl = directDownload(item);
                  return (
                    <div
                      key={item.id}
                      className="watchlist-card"
                      style={{
                        animation: "rail-fade-in 0.4s var(--ease-out) both",
                        animationDelay: `${Math.min(i * 0.03, 0.35)}s`,
                      }}
                    >
                      <ContentCard
                        tmdbId={Number(item.contentId) || 0}
                        title={item.title}
                        mediaType={item.mediaType}
                        posterUrl={item.posterPath}
                        rating={item.rating}
                        year={item.year}
                        href={itemHref(item)}
                      />
                      <div className="watchlist-download">
                        {dl ? (
                          <DownloadMenu
                            item={dl}
                            label={DOWNLOAD_ICON}
                            queuedLabel={DOWNLOAD_ICON}
                            title={`Download ${item.title}`}
                            className="watchlist-download-btn"
                          />
                        ) : (
                          <Link
                            href={itemHref(item)}
                            className="watchlist-download-btn"
                            title={
                              item.mediaType === "manga"
                                ? "Download chapters — opens manga page"
                                : "Download episodes — opens details page"
                            }
                            onClick={(e) => e.stopPropagation()}
                          >
                            {DOWNLOAD_ICON}
                          </Link>
                        )}
                      </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeItem(item.contentId, item.mediaType);
                      }}
                      className="watchlist-remove"
                      aria-label={`Remove ${item.title} from watchlist`}
                      title="Remove"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        aria-hidden
                      >
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                    <p className="watchlist-added">
                      Added {formatAdded(item.addedAt)}
                    </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Keep the page from feeling empty with few titles */}
            <div className="watchlist-cta">
              <div>
                <p className="watchlist-cta-title">Add more titles</p>
                <p className="watchlist-cta-copy">
                  Keep building your list from browse and anime.
                </p>
              </div>
              <div className="watchlist-cta-actions">
                <Link href="/browse?type=movie" className="btn-secondary !text-sm">
                  Movies
                </Link>
                <Link href="/browse?type=tv" className="btn-secondary !text-sm">
                  TV Shows
                </Link>
                <Link href="/anime" className="btn-secondary !text-sm">
                  Anime
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
