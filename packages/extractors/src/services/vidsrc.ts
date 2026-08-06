/**
 * VidSrc / VSEmbed extractor.
 *
 * Reverse-engineered extraction chain:
 *   1. vsembed.ru/embed/movie?tmdb={id}
 *   2. cloudorchestranova.com/rcp/{hash} (now in obfuscated JS, not HTML)
 *   3. cloudorchestranova.com/prorcp/{hash}
 *   4. sartorialsupernova.space/generate.php → JWT
 *   5. master.m3u8?token={jwt} → variant streams
 *
 * Security model:
 *   - Single-use RCP hashes (server-side HMAC)
 *   - JWT token with ~4hr expiry, IP-locked
 *   - All CDN requests require Referer header
 */

import type { StreamSource, SubtitleTrack } from "@flyx/core";

// ── Constants ────────────────────────────────────────────────

const EMBED_BASE = "https://vsembed.ru";
const RCP_BASE = "https://cloudorchestranova.com";
const TOKEN_URL = "https://sartorialsupernova.space/generate.php";
const CDN_BASE = "https://sartorialsupernova.space";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── Helpers ──────────────────────────────────────────────────

async function fetchText(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 15000,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── Extractor ────────────────────────────────────────────────

export async function extractVidSrc(
  tmdbId: number,
  mediaType = "movie",
  season?: number,
  episode?: number,
): Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }> {
  const empty = { sources: [] as StreamSource[], subtitles: [] as SubtitleTrack[] };
  const h = { "User-Agent": UA };

  const embedUrl =
    mediaType === "tv" && season !== undefined && episode !== undefined
      ? `${EMBED_BASE}/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`
      : `${EMBED_BASE}/embed/movie?tmdb=${tmdbId}`;

  try {
    // ── Step 1: Fetch embed page, find RCP hash in JS ────────
    const embedHtml = await fetchText(embedUrl, { headers: h });

    // RCP URL is now embedded in obfuscated JS, not a plain HTML iframe.
    const rcpMatch = embedHtml.match(
      /cloudorchestranova\.com\/rcp\/([A-Za-z0-9+/=_-]+)/,
    );
    if (!rcpMatch) {
      console.warn("[VidSrc] No RCP hash in page source");
      return empty;
    }
    const rcpHash = rcpMatch[1];

    // ── Step 2: Fetch RCP page ─────────────────────────────
    const rcpHtml = await fetchText(`${RCP_BASE}/rcp/${rcpHash}`, {
      headers: { ...h, Referer: "https://vsembed.ru/" },
    });

    const prorcpMatch = rcpHtml.match(/\/prorcp\/([A-Za-z0-9+/=_-]+)/);
    if (!prorcpMatch) return empty;
    const prorcpHash = prorcpMatch[1];

    // ── Step 3: Fetch player page ──────────────────────────
    const playerHtml = await fetchText(`${RCP_BASE}/prorcp/${prorcpHash}`, {
      headers: { ...h, Referer: RCP_BASE + "/" },
    });

    const masterMatch = playerHtml.match(
      /master_urls\s*=\s*"(https?:\/\/[^"]+?\/master\.m3u8[^"]*?)"/,
    );
    if (!masterMatch?.[1]) return empty;
    const masterTemplate = masterMatch[1].split(" or ")[0]!.trim();

    // ── Step 4: Fetch JWT token ────────────────────────────
    const token = await fetchText(TOKEN_URL, {
      headers: { ...h, Referer: RCP_BASE + "/" },
    });

    // ── Step 5: Master playlist ────────────────────────────
    const masterUrl = masterTemplate.replace("__TOKEN__", token.trim());
    const masterM3u8 = await fetchText(masterUrl, {
      headers: { ...h, Referer: RCP_BASE + "/" },
    });

    // ── Step 6: Build proxied sources ───────────────────────
    const ref = RCP_BASE + "/";
    const proxyBase = `/api/stream/proxy?referer=${encodeURIComponent(ref)}&url=`;

    const proxiedMaster = `${proxyBase}${encodeURIComponent(masterUrl)}`;
    const lines = masterM3u8.split("\n");
    const sources: StreamSource[] = [];

    sources.push({
      url: proxiedMaster,
      quality: "Auto",
      type: "hls",
      title: "VidSrc",
    });

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line?.startsWith("#EXT-X-STREAM-INF")) {
        const resolution = line.match(/RESOLUTION=(\d+)x(\d+)/);
        const bandwidth = line.match(/BANDWIDTH=(\d+)/);
        const variantPath = lines[i + 1]?.trim();

        if (variantPath && !variantPath.startsWith("#")) {
          const height = resolution?.[2] ? parseInt(resolution[2]) : 0;
          const bitrate = bandwidth?.[1] ? Math.round(parseInt(bandwidth[1]) / 1000) : 0;
          const variantUrl = variantPath.startsWith("http")
            ? variantPath
            : `${CDN_BASE}${variantPath}`;

          sources.push({
            url: `${proxyBase}${encodeURIComponent(variantUrl)}`,
            quality: height ? `${height}p` : "Auto",
            type: "hls",
            title: `VidSrc ${height}p${bitrate ? ` (${bitrate}kbps)` : ""}`,
          });
        }
      }
    }

    return { sources, subtitles: [] };
  } catch {
    return empty;
  }
}
