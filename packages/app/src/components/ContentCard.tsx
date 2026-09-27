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

const TYPE_LABELS: Record<ContentCardProps["mediaType"], string> = {
  movie: "Movie",
  tv: "Series",
  anime: "Anime",
  manga: "Manga",
};

const TYPE_COLORS: Record<ContentCardProps["mediaType"], string> = {
  movie: "#d7ff73",
  tv: "#b8adff",
  anime: "#ff9dca",
  manga: "#7dd3fc",
};

/**
 * Poster CDNs that block hotlinking and must load through /api/manga/image.
 * Matched on the hostname (not a substring) so only URLs that endpoint's
 * host allowlist accepts are routed there.
 */
function isProxiedPosterHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "ytimgf.youtube-anime.com" || host.endsWith(".ytimgf.youtube-anime.com");
  } catch {
    return false;
  }
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
  const [imageError, setImageError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const badgeText = badge?.label ?? TYPE_LABELS[mediaType];
  const badgeColor = badge?.color ?? TYPE_COLORS[mediaType];
  const linkHref =
    href ??
    (mediaType === "anime"
      ? `/anime/${tmdbId}`
      : mediaType === "manga"
        ? `/manga/${tmdbId}`
        : `/details/${tmdbId}?type=${mediaType}`);

  useEffect(() => {
    setLoaded(false);
    setImageError(false);
  }, [posterUrl]);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setLoaded(true);
  }, [posterUrl]);

  const showImage = Boolean(posterUrl) && !imageError;
  const imageSource = posterUrl && isProxiedPosterHost(posterUrl)
    ? `/api/manga/image?url=${encodeURIComponent(posterUrl)}`
    : posterUrl;

  const card = (
    <article className={`group w-full ${className}`}>
      <div
        className="relative w-full overflow-hidden rounded-xl border border-white/[0.08] bg-[#121418] transition duration-200 ease-out group-hover:-translate-y-1 group-hover:border-white/[0.18] group-hover:shadow-[0_16px_34px_rgba(0,0,0,0.3)]"
        style={{ aspectRatio: "2/3" }}
      >
        <div className="absolute inset-0 bg-[#14171b]">
          {showImage ? (
            <>
              {!loaded && <div className="skeleton absolute inset-0 rounded-none" />}
              <img
                ref={imageRef}
                src={imageSource}
                alt=""
                loading="lazy"
                decoding="async"
                onLoad={() => setLoaded(true)}
                onError={() => {
                  setImageError(true);
                  setLoaded(false);
                }}
                className={`absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.035] ${loaded ? "opacity-100" : "opacity-0"}`}
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1b1e23] to-[#101216]">
              <svg
                width="30"
                height="30"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                className="text-white/20"
                aria-hidden
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="m10 9 5 3-5 3V9Z" />
              </svg>
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent" />

        <span
          className="poster-badge is-type absolute left-2 top-2"
          style={{ color: badgeColor }}
        >
          {badgeText}
        </span>

        {rating != null && rating > 0 && (
          <span className="poster-badge is-rating absolute right-2 top-2">
            <span aria-hidden className="star">★</span>
            {rating.toFixed(1)}
          </span>
        )}

        {rank != null && rank <= 10 && (
          <span
            className="pointer-events-none absolute bottom-1.5 left-2 font-[family-name:var(--font-display)] text-[2.45rem] font-black leading-none tracking-tighter text-white drop-shadow-lg"
            aria-hidden
          >
            {rank}
          </span>
        )}

        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 w-11 translate-y-2 scale-90 items-center justify-center rounded-full bg-[#c8ff3d] text-[#08090b] opacity-0 shadow-[0_8px_22px_rgba(0,0,0,0.4)] transition duration-200 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="ml-0.5"
              aria-hidden
            >
              <path d="M8 5.5v13l11-6.5L8 5.5Z" />
            </svg>
          </span>
        </span>
      </div>

      <div className="px-0.5 pb-0.5 pt-2">
        <h3 className="line-clamp-2 text-[12.5px] font-semibold leading-snug tracking-tight text-white/95 sm:text-[13px]">
          {title}
        </h3>
        <div className="mt-1 flex min-h-4 items-center gap-1.5 text-[11px] text-white/45">
          {year && <span className="tabular-nums">{year}</span>}
          {year && rating != null && rating > 0 && <span className="text-white/20">·</span>}
          {rating != null && rating > 0 && (
            <span className="tabular-nums">{rating.toFixed(1)} rating</span>
          )}
        </div>
      </div>
    </article>
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
    <Link href={linkHref} className="block w-full no-underline" aria-label={`View ${title}`}>
      {card}
    </Link>
  );
}

export default ContentCard;
