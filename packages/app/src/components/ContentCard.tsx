"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface ContentCardProps {
  tmdbId: number;
  title: string;
  mediaType: "movie" | "tv" | "anime" | "manga";
  posterUrl?: string;
  rating?: number;
  year?: string;
  className?: string;
  href?: string;
  onClick?: () => void;
  badge?: { label: string; color?: string };
  rank?: number;
}

export function ContentCard({
  tmdbId,
  title,
  posterUrl,
  mediaType,
  rating,
  year,
  className = "",
  href,
  onClick,
  badge,
  rank,
}: ContentCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const badgeText =
    badge?.label ??
    (mediaType === "movie"
      ? "Movie"
      : mediaType === "anime"
        ? "Anime"
        : mediaType === "manga"
          ? "Manga"
          : "Series");
  const badgeColor =
    badge?.color ??
    (mediaType === "movie"
      ? "#00e5bf"
      : mediaType === "anime"
        ? "#f062a0"
        : mediaType === "manga"
          ? "#38bdf8"
          : "#8b7cf0");
  const linkHref =
    href ??
    (mediaType === "anime"
      ? `/anime/${tmdbId}`
      : mediaType === "manga"
        ? `/manga/${tmdbId}`
        : `/details/${tmdbId}?type=${mediaType}`);

  const circleLen = 2 * Math.PI * 14;
  const pct = Math.min(((rating ?? 0) / 10) * 100, 100);
  const dash = (pct / 100) * circleLen;
  const ringColor =
    (rating ?? 0) >= 7 ? "#2dd4a8" : (rating ?? 0) >= 5 ? "#f59e0b" : "#f45050";

  // Reset when URL changes
  useEffect(() => {
    setLoaded(false);
    setImgError(false);
  }, [posterUrl]);

  // Cached images often fire load before React attaches onLoad — fix that race
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !posterUrl) return;
    if (img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [posterUrl]);

  const showImage = Boolean(posterUrl) && !imgError;

  const card = (
    <div className={`group w-full ${className}`}>
      {/* Poster only — rounded + overflow; title lives outside so it never clips */}
      <div
        className="relative w-full overflow-hidden rounded-[0.9rem] bg-[#111118] transition-[transform,box-shadow] duration-300 ease-out will-change-transform group-hover:-translate-y-1 group-hover:scale-[1.02]"
        style={{
          aspectRatio: "2/3",
          boxShadow:
            "0 10px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        {/* Hover ring */}
        <div
          className="pointer-events-none absolute inset-0 z-[6] rounded-[0.9rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ boxShadow: "inset 0 0 0 1.5px rgba(0,229,191,0.35)" }}
          aria-hidden
        />

        {/* Image / fallback */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[#14141c]" />

          {showImage ? (
            <>
              {!loaded && (
                <div className="skeleton absolute inset-0 z-[1] rounded-none" />
              )}
              <img
                ref={imgRef}
                src={posterUrl && posterUrl.includes("ytimgf.youtube-anime.com")
                  ? `/api/manga/image?url=${encodeURIComponent(posterUrl)}`
                  : posterUrl}
                alt=""
                loading="lazy"
                decoding="async"
                onLoad={() => setLoaded(true)}
                onError={() => {
                  setImgError(true);
                  setLoaded(false);
                }}
                className={`absolute inset-0 z-[2] h-full w-full object-cover transition-[transform,opacity] duration-300 ease-out group-hover:scale-[1.05] ${
                  loaded ? "opacity-100" : "opacity-0"
                }`}
                style={{ transformOrigin: "center 30%" }}
              />
            </>
          ) : (
            <div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1a1a24] to-[#0e0e14] px-3">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                className="text-white/15"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m10 9 5 3-5 3V9z" />
              </svg>
            </div>
          )}
        </div>

        {/* Soft bottom shade for rank readability only */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[40%]"
          style={{
            background:
              "linear-gradient(to top, rgba(3,3,7,0.75) 0%, transparent 100%)",
          }}
        />

        {/* Rank */}
        {rank != null && rank <= 10 && (
          <div
            className="pointer-events-none absolute bottom-1 left-1.5 z-[5] font-[family-name:var(--font-display)] text-[2.5rem] font-black leading-none tracking-tighter sm:text-[2.75rem]"
            style={{
              color: "rgba(255,255,255,0.95)",
              textShadow:
                "0 2px 10px rgba(0,0,0,0.95), 0 0 1px #000",
            }}
            aria-hidden
          >
            {rank}
          </div>
        )}

        {/* Rating ring */}
        {rating != null && rating > 0 && (
          <div className="absolute right-2 top-2 z-10">
            <div
              className="relative flex h-9 w-9 items-center justify-center rounded-full sm:h-10 sm:w-10"
              style={{
                background: "rgba(0,0,0,0.72)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                boxShadow:
                  "0 3px 12px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1)",
              }}
            >
              <svg
                className="absolute inset-0 h-full w-full -rotate-90 p-[2px]"
                viewBox="0 0 36 36"
                aria-hidden
              >
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="2.5"
                  strokeDasharray={`${dash.toFixed(1)} ${circleLen.toFixed(1)}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="relative text-[10px] font-bold tabular-nums leading-none text-white sm:text-[11px]">
                {rating.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* Type badge — explicit padding (inline beats any Tailwind miss) */}
        <span
          className="poster-type-badge absolute left-2 top-2 z-10"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 7,
            paddingBottom: 7,
            paddingLeft: 12,
            paddingRight: 12,
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            background: "rgba(0, 0, 0, 0.72)",
            border: `1px solid ${badgeColor}60`,
            color: badgeColor,
            boxShadow: `0 0 14px ${badgeColor}20`,
            WebkitBackdropFilter: "blur(10px)",
            backdropFilter: "blur(10px)",
          }}
        >
          {badgeText}
        </span>

        {/* Play affordance */}
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div
            className="flex h-11 w-11 translate-y-2 scale-90 items-center justify-center rounded-full opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100"
            style={{
              background: "linear-gradient(135deg, #00e5bf, #8b7cf0)",
              boxShadow: "0 8px 24px rgba(0,229,191,0.4)",
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="#030307"
              className="ml-0.5"
              aria-hidden
            >
              <path d="M8 5.5v13l11-6.5L8 5.5z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Title + meta — OUTSIDE rounded clip, never cut off */}
      <div className="px-0.5 pt-2 pb-0.5">
        <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug tracking-tight text-white/95 sm:text-[13px]">
          {title}
        </p>
        <div className="mt-1 flex min-h-[1rem] items-center gap-1.5 text-[11px] text-white/45">
          {year && <span className="tabular-nums">{year}</span>}
          {rating != null && rating > 0 && (
            <>
              {year && <span className="text-white/20">·</span>}
              <span className="font-semibold tabular-nums text-amber-300/90">
                ★ {rating.toFixed(1)}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full cursor-pointer border-0 bg-transparent p-0 text-left"
        aria-label={`View ${title}`}
      >
        {card}
      </button>
    );
  }

  return (
    <Link
      href={linkHref}
      className="block w-full no-underline"
      aria-label={`View ${title}`}
    >
      {card}
    </Link>
  );
}

export default ContentCard;
