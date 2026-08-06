/**
 * Stream URL proxy helper — routes CDN URLs through CF workers when needed.
 * Ported and simplified from Flyx 2.0 VideoPlayer.applyStreamProxy.
 */

export function applyStreamProxy(
  sourceUrl: string,
  providerName: string,
  requiresProxy?: boolean,
): string {
  if (!sourceUrl) return sourceUrl;

  const proxyBase = (
    process.env.NEXT_PUBLIC_CF_STREAM_PROXY_URL ||
    "https://media-proxy.vynx-3b3.workers.dev/stream"
  ).replace(/\/stream\/?$/, "");

  // Already proxied — don't double-wrap
  if (
    sourceUrl.includes("/videasy/") ||
    sourceUrl.includes("/api/stream-proxy") ||
    sourceUrl.includes("/api/stream/proxy") ||
    sourceUrl.includes("/bingebox/") ||
    sourceUrl.includes("/stream?url=") ||
    // AnimeX HLS proxy — routed through our server-side proxy
    sourceUrl.includes("aniwatchtv.site/uwu/") ||
    sourceUrl.includes("aniwatchtv.site/media/")
  ) {
    return sourceUrl;
  }

  const isVideasyCdn =
    sourceUrl.includes("cfw57.workers.dev") ||
    sourceUrl.includes("mooncarpet.site") ||
    providerName === "videasy";

  const needsProxy =
    !isVideasyCdn &&
    (requiresProxy ||
      sourceUrl.includes(".workers.dev") ||
      sourceUrl.includes("wind."));

  if (needsProxy) {
    return `${proxyBase}/stream?url=${encodeURIComponent(sourceUrl)}&source=unknown`;
  }

  return sourceUrl;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type PlayerSource = {
  title: string;
  url: string;
  quality?: string;
  provider?: string;
  type?: "hls" | "dash" | "mp4";
  skipIntro?: [number, number] | { start: number; end: number };
  skipOutro?: [number, number] | { start: number; end: number };
  requiresSegmentProxy?: boolean;
};

export function normalizeSkip(
  skip?: [number, number] | { start: number; end: number } | null,
): { start: number; end: number } | null {
  if (!skip) return null;
  if (Array.isArray(skip)) {
    if (skip.length >= 2 && skip[1] > skip[0]) {
      return { start: skip[0], end: skip[1] };
    }
    return null;
  }
  if (skip.end > skip.start) return skip;
  return null;
}
