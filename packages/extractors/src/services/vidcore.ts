/**
 * VidCore extractor.
 *
 * Reverse-engineered extraction chain (vidcore.org player API):
 *   1. GET https://www.vidcore.org/api/sources?id={tmdb}&type=movie|tv
 *      → parallel-first-fastest provider race; returns nested sources
 *   2. Optional follow-up with skip={labels} to collect more servers
 *   3. Map nested data.sources[] → StreamSource (+ headers/referer)
 *
 * Also related:
 *   - vidcore.net/movie/{id} (2embed VCR embed host; player bundle obfuscated)
 *   - Embed UI: /embed/movie/{id}, /embed/tv/{id}/{s}/{e}
 *
 * Domains: www.vidcore.org, vidcore.org
 */

import type { StreamSource, SubtitleTrack } from "@flyx/core";

// ── Constants ────────────────────────────────────────────────

const API_BASES = [
  "https://www.vidcore.org",
  "https://vidcore.org",
] as const;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** How many skip-rounds to collect additional servers beyond the fastest. */
const MAX_ROUNDS = 4;

// ── Types ────────────────────────────────────────────────────

interface InnerSource {
  url?: string;
  type?: string;
  quality?: string;
  direct?: boolean;
  headers?: Record<string, string>;
  subtitles?: Array<{
    url?: string;
    file?: string;
    language?: string;
    lang?: string;
    label?: string;
  }>;
}

interface OuterSource {
  label?: string;
  provider?: string;
  server?: string;
  latencyMs?: number;
  url?: string;
  type?: string;
  quality?: string;
  data?: {
    sources?: InnerSource[];
    subtitles?: InnerSource["subtitles"];
  };
  sources?: InnerSource[];
  headers?: Record<string, string>;
}

interface SourcesResponse {
  sources?: OuterSource[];
  subtitles?: InnerSource["subtitles"];
  meta?: {
    total?: number;
    available?: number;
    fastest?: string;
    mode?: string;
    checks?: Array<{ name: string; status: string }>;
  };
}

// ── Helpers ──────────────────────────────────────────────────

async function fetchJSON<T>(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 20000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function mapType(type?: string, url?: string): "hls" | "dash" | "mp4" {
  const t = (type || "").toLowerCase();
  if (t === "dash" || t === "mpd" || url?.includes(".mpd")) return "dash";
  if (t === "mp4" || url?.includes(".mp4")) return "mp4";
  return "hls";
}

function flattenSources(
  outer: OuterSource[],
  apiBase: string,
): { sources: StreamSource[]; subtitles: SubtitleTrack[]; labels: string[] } {
  const sources: StreamSource[] = [];
  const subtitles: SubtitleTrack[] = [];
  const labels: string[] = [];
  const seenUrl = new Set<string>();
  const seenSub = new Set<string>();

  for (const o of outer) {
    if (o.label) labels.push(o.label);

    const inners: InnerSource[] =
      o.data?.sources ||
      o.sources ||
      (o.url ? [{ url: o.url, type: o.type, quality: o.quality, headers: o.headers }] : []);

    const label = o.label || o.provider || o.server || "VidCore";

    for (const s of inners) {
      if (!s.url || seenUrl.has(s.url)) continue;
      seenUrl.add(s.url);

      const headers = s.headers || o.headers || {};
      const referer =
        headers.Referer ||
        headers.referer ||
        `${apiBase}/`;
      const origin = headers.Origin || headers.origin;
      const userAgent = headers["User-Agent"] || headers["user-agent"];

      // Prefer CDN URL; when not direct, player rewrites through /api/proxy
      let url = s.url;
      if (s.direct === false && Object.keys(headers).length > 0) {
        // Keep raw URL + headers on StreamSource for our own proxy layer
        url = s.url;
      }

      sources.push({
        url,
        quality: s.quality || o.quality || "Auto",
        type: mapType(s.type || o.type, url),
        title: `VidCore ${label}${s.quality ? ` · ${s.quality}` : ""}`,
        referer,
        origin,
        userAgent,
        requiresSegmentProxy: s.direct === false,
      });
    }

    const subs = o.data?.subtitles || [];
    for (const sub of subs) {
      const url = sub.url || sub.file;
      if (!url || seenSub.has(url)) continue;
      seenSub.add(url);
      subtitles.push({
        url,
        language: sub.lang || sub.language || "und",
        label: sub.label || sub.language || sub.lang || "Unknown",
      });
    }
  }

  return { sources, subtitles, labels };
}

async function fetchSourcesRound(
  base: string,
  params: URLSearchParams,
): Promise<SourcesResponse | null> {
  try {
    return await fetchJSON<SourcesResponse>(`${base}/api/sources?${params}`, {
      headers: {
        "User-Agent": UA,
        Referer: `${base}/embed/movie/${params.get("id") || ""}`,
        Origin: base,
        Accept: "application/json",
      },
    });
  } catch {
    return null;
  }
}

// ── Main Extractor ───────────────────────────────────────────

export async function extractVidCore(
  tmdbId: number,
  mediaType = "movie",
  season?: number,
  episode?: number,
): Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }> {
  const empty = {
    sources: [] as StreamSource[],
    subtitles: [] as SubtitleTrack[],
  };

  try {
    const type = mediaType === "tv" ? "tv" : "movie";
    const allSources: StreamSource[] = [];
    const allSubtitles: SubtitleTrack[] = [];
    const seenUrls = new Set<string>();
    const seenSubs = new Set<string>();
    const skipped = new Set<string>();

    let usedBase: string | null = null;

    // Prefer www — often returns richer provider mix
    for (const base of API_BASES) {
      const params = new URLSearchParams({
        id: String(tmdbId),
        type,
      });
      if (type === "tv") {
        if (season !== undefined) params.set("season", String(season));
        if (episode !== undefined) params.set("episode", String(episode));
      }

      const data = await fetchSourcesRound(base, params);
      if (!data?.sources?.length) continue;

      usedBase = base;
      const flat = flattenSources(data.sources, base);
      for (const s of flat.sources) {
        if (seenUrls.has(s.url)) continue;
        seenUrls.add(s.url);
        allSources.push(s);
      }
      for (const sub of flat.subtitles) {
        if (seenSubs.has(sub.url)) continue;
        seenSubs.add(sub.url);
        allSubtitles.push(sub);
      }
      for (const l of flat.labels) skipped.add(l);

      // Collect more servers via skip rounds (API is parallel-first-fastest)
      for (let round = 1; round < MAX_ROUNDS && skipped.size < 12; round++) {
        const p2 = new URLSearchParams({
          id: String(tmdbId),
          type,
        });
        if (type === "tv") {
          if (season !== undefined) p2.set("season", String(season));
          if (episode !== undefined) p2.set("episode", String(episode));
        }
        if (skipped.size) p2.set("skip", Array.from(skipped).join(","));

        const more = await fetchSourcesRound(base, p2);
        if (!more?.sources?.length) break;

        const f2 = flattenSources(more.sources, base);
        let added = 0;
        for (const s of f2.sources) {
          if (seenUrls.has(s.url)) continue;
          seenUrls.add(s.url);
          allSources.push(s);
          added++;
        }
        for (const sub of f2.subtitles) {
          if (seenSubs.has(sub.url)) continue;
          seenSubs.add(sub.url);
          allSubtitles.push(sub);
        }
        for (const l of f2.labels) skipped.add(l);
        if (added === 0) break;
      }

      break; // one working base is enough
    }

    // Fallback: try RSC token path on vidcore.net (legacy 2embed VCR host)
    if (!allSources.length) {
      const netSources = await tryVidcoreNet(tmdbId, mediaType, season, episode);
      allSources.push(...netSources);
    }

    void usedBase;
    return { sources: allSources, subtitles: allSubtitles };
  } catch {
    return empty;
  }
}

/**
 * Legacy fallback: grab RSC player config from vidcore.net.
 * Stream API is obfuscated in the player bundle; currently returns empty
 * unless m3u8 appears in the page (rare).
 */
async function tryVidcoreNet(
  tmdbId: number,
  mediaType: string,
  season?: number,
  episode?: number,
): Promise<StreamSource[]> {
  const BASE = "https://vidcore.net";
  const path =
    mediaType === "tv"
      ? `/tv/${tmdbId}/${season ?? 1}/${episode ?? 1}`
      : `/movie/${tmdbId}`;
  const query = mediaType === "movie" ? "?autoplay=true" : "";

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${BASE}${path}${query}`, {
      headers: {
        "User-Agent": UA,
        RSC: "1",
        Accept: "text/x-component",
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const text = await res.text();

    const m3u8 = text.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g);
    if (m3u8?.length) {
      return m3u8.map((url) => ({
        url,
        quality: "Auto",
        type: "hls" as const,
        title: "VidCore.net",
        referer: `${BASE}/`,
      }));
    }
  } catch {
    // ignore
  }
  return [];
}
