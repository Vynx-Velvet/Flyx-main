/**
 * Parsing + response-header helpers for /api/downloads/stream.
 *
 * Extracted from the route so the request→item→filename→header mapping is
 * unit-testable without a running server, provider network, or ffmpeg.
 */

import { buildFilename, sanitizeFilename, type DownloadItemInput } from "./types";

/** Build the `Content-Disposition` value for a downloaded file. */
export function downloadContentDisposition(filename: string): string {
  const ascii = sanitizeFilename(filename)
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/"/g, "'");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Parse a stream-route query string into a validated DownloadItemInput. */
export function parseDownloadItem(searchParams: URLSearchParams): DownloadItemInput {
  const kind = searchParams.get("kind");
  if (kind === "manga") {
    const mangaId = String(searchParams.get("mangaId") || "");
    const chapter = Number(searchParams.get("chapter"));
    if (!mangaId || !Number.isFinite(chapter) || chapter <= 0) {
      throw new Error("missing a valid mangaId/chapter");
    }
    return {
      kind: "manga",
      mangaId,
      chapter,
      title: searchParams.get("title") ?? undefined,
    };
  }

  // Default to video.
  const tmdbId = Number(searchParams.get("tmdbId"));
  const malId = searchParams.get("malId")
    ? Number(searchParams.get("malId"))
    : undefined;
  if (!Number.isFinite(tmdbId)) throw new Error("missing a valid tmdbId");
  if (tmdbId <= 0 && !malId) throw new Error("missing a valid tmdbId");

  const mediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";
  const season = searchParams.get("season")
    ? Number(searchParams.get("season"))
    : undefined;
  const episode = searchParams.get("episode")
    ? Number(searchParams.get("episode"))
    : undefined;
  if (mediaType === "tv" && !season && !episode) {
    throw new Error("missing season/episode");
  }

  const languageParam = searchParams.get("language");
  return {
    kind: "video",
    tmdbId,
    mediaType,
    season,
    episode,
    malId,
    title: searchParams.get("title") ?? undefined,
    provider: searchParams.get("provider") ?? undefined,
    quality: searchParams.get("quality") ?? undefined,
    language: languageParam === "dub" ? "dub" : languageParam === "sub" ? "sub" : undefined,
  };
}

/** Filename for a parsed item (shared with the stream route). */
export function streamFilename(item: DownloadItemInput): string {
  return buildFilename(item);
}
