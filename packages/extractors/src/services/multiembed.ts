/**
 * MultiEmbed / 2embed extractor.
 *
 * Reverse-engineered extraction chain:
 *   1. api.2embed.cc/movie?tmdb_id={id}        → IMDB ID + metadata
 *   2. www.2embed.cc/embed/{imdb_id}            → server list (HTML dropdown)
 *   3. streamsrcs.2embed.cc/xps?imdb={imdb_id}  → JS redirect
 *   4. play.xpass.top/e/movie/{imdb_id}         → JWPlayer + playlist URLs
 *   5. play.xpass.top/mdata/{id}/.../playlist.json → m3u8 sources
 *
 * Server types (parsed from embed page):
 *   - Swish → 2vcdn.skin/e/{hash}
 *   - Xps   → play.xpass.top/e/movie/{imdb_id}  (14 backup CDNs)
 *   - Vesy  → player.videasy.to/movie/{tmdb_id}
 *   - Vcr   → vidcore.net/movie/{tmdb_id}
 *
 * TV endpoints use *_tv variants: xps-tv, vesy-tv, vcr-tv
 *
 * Security: PHP session cookie, sandbox detection, referer checks.
 * XPS provides auth_token cookie (24h expiry) with JWPlayer.
 */

import type { StreamSource, SubtitleTrack } from "@flyx/core";

// ── Constants ────────────────────────────────────────────────

const API_BASE = "https://api.2embed.cc";
const EMBED_BASE = "https://www.2embed.cc";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── Types ────────────────────────────────────────────────────

interface EmbedServer {
  name: string;
  url: string;
  type: "swish" | "xps" | "vesy" | "vcr";
}

interface PlaylistSource {
  file: string;
  type: string;
  label: string;
  id?: string;
}

interface PlaylistResponse {
  playlist: {
    sources: PlaylistSource[];
  }[];
}

interface BackupServer {
  id: string;
  name: string;
  url: string;
  dl: boolean;
}

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

async function fetchJSON<T>(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 15000,
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

// ── Step 1: Get IMDB ID from API ─────────────────────────────

async function getImdbId(
  tmdbId: number,
  mediaType: string,
): Promise<string | null> {
  try {
    const endpoint = mediaType === "movie" ? "movie" : "tv";
    const data = await fetchJSON<any>(
      `${API_BASE}/${endpoint}?tmdb_id=${tmdbId}`,
      { headers: { "User-Agent": UA } },
    );
    return data?.imdb_id ?? null;
  } catch {
    return null;
  }
}

// ── Step 2: Parse server list from embed page ────────────────

function parseServersFromEmbed(html: string): EmbedServer[] {
  const servers: EmbedServer[] = [];

  // Extract onclick handlers from the dropdown
  // Pattern: onclick="go('https://streamsrcs.2embed.cc/{type}?...')"
  const onclickRegex =
    /onclick="go\('(https:\/\/streamsrcs\.2embed\.cc\/([^?]+)\?([^']*))'\)"/g;
  let match;
  while ((match = onclickRegex.exec(html)) !== null) {
    const url = match[1]!;
    const path = match[2]!;

    let type: EmbedServer["type"];
    if (path.startsWith("swish")) type = "swish";
    else if (path.startsWith("xps")) type = "xps";
    else if (path.startsWith("vesy")) type = "vesy";
    else if (path.startsWith("vcr")) type = "vcr";
    else continue;

    const name =
      type === "swish" ? "2embed" : type.charAt(0).toUpperCase() + type.slice(1);

    servers.push({ name, url, type });
  }

  // Also check data-src on the iframe (default server)
  const datasrcMatch = html.match(/data-src="([^"]+)"/);
  if (datasrcMatch?.[1] && !servers.some((s) => s.url === datasrcMatch[1])) {
    const url = datasrcMatch[1]!;
    let type: EmbedServer["type"] = "swish";
    if (url.includes("/xps")) type = "xps";
    else if (url.includes("/vesy")) type = "vesy";
    else if (url.includes("/vcr")) type = "vcr";

    servers.unshift({
      name: type === "swish" ? "2embed" : type.charAt(0).toUpperCase() + type.slice(1),
      url,
      type,
    });
  }

  return servers;
}

// ── Step 3: Resolve streamsrc URL to final player URL ────────

/**
 * Each streamsrc server type uses JS to rewrite the iframe src.
 * These rewrites are hardcoded in xps.js, swish.js, vesy.js, vcr.js.
 */
function resolveStreamSrcUrl(server: EmbedServer, mediaType = "movie"): string {
  // The streamsrc page has an iframe with src={id params}
  // and a .js file that prepends the actual player domain.
  // We can compute the final URL without fetching the intermediate page.

  const url = new URL(server.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const contentPath = mediaType === "tv" ? "tv" : "movie";

  switch (server.type) {
    case "swish": {
      // swish.js: 'https://2vcdn.skin/e/' + myUrl
      // Note: swish only available for movies, not TV
      const hash = params["id"] || url.pathname.split("/").pop();
      return `https://2vcdn.skin/e/${hash}`;
    }
    case "xps": {
      // xps.js:  'https://play.xpass.top/e/movie/' + myUrl
      // xps-tv.js: 'https://play.xpass.top/e/tv/' + myUrl
      // TV iframe src = "{tmdbId}/{season}/{episode}?autostart=true"
      const imdb = params["imdb"] || "";
      const tmdb = params["tmdb"] || "";
      if (mediaType === "tv") {
        const s = params["s"] || "1";
        const e = params["e"] || "1";
        return `https://play.xpass.top/e/tv/${tmdb}/${s}/${e}?autostart=true`;
      }
      const autostart = imdb ? "?autostart=true" : "";
      return `https://play.xpass.top/e/movie/${imdb}${autostart}`;
    }
    case "vesy": {
      // vesy.js: 'https://player.videasy.to/movie/' + myUrl
      const tmdb = params["tmdb"] || "";
      return `https://player.videasy.to/${contentPath}/${tmdb}?color=FFFFFF`;
    }
    case "vcr": {
      // vcr.js: 'https://vidcore.net/movie/' + myUrl
      const tmdb = params["tmdb"] || "";
      return `https://vidcore.net/${contentPath}/${tmdb}?autoplay=true`;
    }
    default:
      return server.url;
  }
}

// ── Step 4: Extract backup servers & playlist URLs from XPS ───

/** Extract a balanced JSON array/object starting at `openIdx` (must point at [ or {). */
function extractBalancedJson(html: string, openIdx: number): string | null {
  const open = html[openIdx];
  if (open !== "[" && open !== "{") return null;
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = openIdx; i < html.length; i++) {
    const ch = html[i]!;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return html.slice(openIdx, i + 1);
    }
  }
  return null;
}

function parseXpsPage(html: string): {
  backups: BackupServer[];
  dataUrl: string;
  subUrl: string;
  primaryPlaylist: string;
} {
  // Extract var backups=[...] with balanced brackets (regex is too fragile)
  let backups: BackupServer[] = [];
  const backupsKey = html.indexOf("var backups=");
  if (backupsKey >= 0) {
    const arrStart = html.indexOf("[", backupsKey);
    const json = arrStart >= 0 ? extractBalancedJson(html, arrStart) : null;
    if (json) {
      try {
        backups = JSON.parse(json) as BackupServer[];
      } catch {
        /* ignore */
      }
    }
  }

  // Primary playlist from JWPlayer config: var data={...,"playlist":"/vip/.../playlist.json",...}
  let primaryPlaylist = "";
  const dataKey = html.indexOf("var data=");
  if (dataKey >= 0) {
    const objStart = html.indexOf("{", dataKey);
    const json = objStart >= 0 ? extractBalancedJson(html, objStart) : null;
    if (json) {
      try {
        const data = JSON.parse(json) as { playlist?: string };
        if (typeof data.playlist === "string") primaryPlaylist = data.playlist;
      } catch {
        /* ignore */
      }
    }
  }

  // Extract var dataUrl = "..."
  const dataUrlMatch = html.match(/var dataUrl="([^"]+)"/);
  const dataUrl = dataUrlMatch?.[1] ?? "";

  // Extract var suburl = "..."
  const subUrlMatch = html.match(/var suburl="([^"]+)"/);
  const subUrl = subUrlMatch?.[1] ?? "";

  return { backups, dataUrl, subUrl, primaryPlaylist };
}

// ── Step 5: Fetch playlist.json and extract sources ──────────

async function fetchPlaylistSources(
  playlistUrl: string,
  baseUrl: string,
  referer: string,
): Promise<StreamSource[]> {
  const fullUrl = playlistUrl.startsWith("http")
    ? playlistUrl
    : `${baseUrl.replace(/\/$/, "")}${playlistUrl.startsWith("/") ? "" : "/"}${playlistUrl}`;

  try {
    const data = await fetchJSON<PlaylistResponse>(fullUrl, {
      headers: {
        "User-Agent": UA,
        Referer: referer,
        Origin: baseUrl,
        Accept: "application/json,*/*",
      },
    });

    const sources: StreamSource[] = [];
    const items = Array.isArray(data.playlist) ? data.playlist : [];
    for (const item of items) {
      const srcList = Array.isArray(item?.sources) ? item.sources : [];
      for (const source of srcList) {
        if (!source?.file) continue;
        // Skip error/broken URLs returned by CDN backends
        if (source.file.includes("/video/error") || source.file.includes("/error")) continue;
        if (!source.file.startsWith("http") && !source.file.startsWith("/")) continue;
        sources.push({
          url: source.file,
          quality: source.label || "Auto",
          type: source.type === "hls" || source.file.includes(".m3u8") ? "hls" : "mp4",
          title: `2embed ${source.label || source.id || ""}`.trim(),
        });
      }
    }
    return sources;
  } catch {
    return [];
  }
}

// ── Step 6: Extract subtitles ─────────────────────────────────

async function fetchSubtitles(
  subUrl: string,
): Promise<SubtitleTrack[]> {
  if (!subUrl) return [];

  try {
    const data = await fetchJSON<any>(subUrl, {
      headers: { "User-Agent": UA },
    });

    const tracks: SubtitleTrack[] = [];
    // sub.1x2.space returns various subtitle formats
    if (Array.isArray(data)) {
      for (const sub of data) {
        tracks.push({
          url: sub.file || sub.url || "",
          label: sub.label || sub.language || sub.lang || "",
          language: sub.lang || sub.language || "en",
        });
      }
    } else if (data?.subtitles) {
      for (const sub of data.subtitles) {
        tracks.push({
          url: sub.file || sub.url || "",
          label: sub.label || sub.language || sub.lang || "",
          language: sub.lang || sub.language || "en",
        });
      }
    }
    return tracks;
  } catch {
    return [];
  }
}

// ── Main Extractor ───────────────────────────────────────────

export async function extractMultiEmbed(
  tmdbId: number,
  mediaType = "movie",
  season?: number,
  episode?: number,
): Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }> {
  const empty = {
    sources: [] as StreamSource[],
    subtitles: [] as SubtitleTrack[],
  };
  const h = { "User-Agent": UA };

  try {
    // ── Step 1: Build embed URL ───────────────────────────
    // 2embed supports BOTH IMDB IDs and TMDB IDs natively.
    // For TV, use TMDB ID directly to skip the IMDB lookup API call.
    let embedPath: string;
    if (mediaType === "movie") {
      // Movies: prefer IMDB ID (API provides richer metadata)
      const imdbId = await getImdbId(tmdbId, mediaType);
      embedPath = imdbId
        ? `/embed/${imdbId}`
        : `/embed/${tmdbId}`;
    } else {
      // TV: use TMDB ID directly — faster, fewer failure points
      const s = season ?? 1;
      const e = episode ?? 1;
      embedPath = `/embedtv/${tmdbId}&s=${s}&e=${e}`;
    }

    const embedHtml = await fetchText(`${EMBED_BASE}${embedPath}`, {
      headers: { ...h, Referer: EMBED_BASE + "/" },
    });

    const servers = parseServersFromEmbed(embedHtml);
    if (!servers.length) return empty;

    // ── Step 3: Try XPS first (most backends), fall back to others ──
    // Prefer XPS → Swish → Vesy → Vcr
    const priorityOrder: EmbedServer["type"][] = ["xps", "swish", "vesy", "vcr"];
    let allSources: StreamSource[] = [];
    let allSubtitles: SubtitleTrack[] = [];

    for (const preferredType of priorityOrder) {
      const server = servers.find((s) => s.type === preferredType);
      if (!server) continue;

      try {
        if (server.type === "xps") {
          // Full XPS chain: play.xpass.top → playlist.json → m3u8
          const xpsUrl = resolveStreamSrcUrl(server, mediaType);
          const result = await followXpsChain(
            xpsUrl,
            "https://streamsrcs.2embed.cc/",
            h,
          );

          if (result.subtitles.length) allSubtitles = result.subtitles;
          if (result.sources.length) {
            allSources.push(...result.sources);
            break;
          }
        } else {
          // Other servers: resolve to their final URL
          // These redirect to other player pages (videasy, vidcore, etc.)
          // For now just return the URL as a source — the actual extraction
          // happens in those providers' own extractors
          const finalUrl = resolveStreamSrcUrl(server, mediaType);

          // Try to get actual m3u8 from known patterns
          try {
            const playerHtml = await fetchText(finalUrl, {
              headers: { ...h, Referer: "https://streamsrcs.2embed.cc/" },
            });

            // Try to find m3u8 URLs directly in the page
            const m3u8Matches = playerHtml.match(
              /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g,
            );
            if (m3u8Matches) {
              for (const m3u8Url of m3u8Matches) {
                allSources.push({
                  url: m3u8Url,
                  quality: server.name,
                  type: "hls",
                  title: `2embed ${server.name}`,
                  referer: new URL(finalUrl).origin,
                });
              }
            }

            // Also try to find playlist.json patterns
            const playlistMatches = playerHtml.match(
              /\/[^"'\s]*playlist\.json[^"'\s]*/g,
            );
            if (playlistMatches) {
              for (const plPath of playlistMatches) {
                try {
                  const plBase = new URL(finalUrl).origin;
                  const sources = await fetchPlaylistSources(
                    plPath,
                    plBase,
                    finalUrl,
                  );
                  allSources.push(...sources);
                } catch {
                  // continue
                }
              }
            }
          } catch {
            // If we can't extract from this server, try next
            continue;
          }

          if (allSources.length) break;
        }
      } catch {
        // Try next server type
        continue;
      }
    }

    // ── Deduplicate and sanitize sources ──
    // Proxy wrapping (appending /api/stream/proxy?...) happens at the API
    // route level, not in the extractor. The extractor returns raw CDN URLs
    // with a referer field so callers can proxy if needed.
    const seen = new Set<string>();
    const deduped = allSources
      .filter((s) => {
        const key = s.url;
        if (!key || seen.has(key)) return false;
        // Skip non-HTTP URLs and error paths from broken CDN backends
        if (!/^https?:\/\//i.test(s.url)) return false;
        if (/\/video\/error|\/error\b/i.test(s.url)) return false;
        seen.add(key);
        return true;
      })
      .map((s) => {
        // Set referer for CDNs that require it (XPS/play.xpass.top)
        if (!s.referer) {
          return { ...s, referer: "https://play.xpass.top/" };
        }
        return s;
      });

    return { sources: deduped, subtitles: allSubtitles };
  } catch {
    return empty;
  }
}

/**
 * Follow through the full XPS chain from an embed page,
 * extracting actual m3u8 sources from playlist.json backends.
 * Used both by the main flow and the TMDB-direct fallback.
 */
async function followXpsChain(
  xpsUrl: string,
  referer: string,
  h: Record<string, string>,
): Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }> {
  const xpsBase = new URL(xpsUrl).origin;

  const xpsHtml = await fetchText(xpsUrl, {
    headers: { ...h, Referer: referer },
  });

  const { backups, subUrl, primaryPlaylist } = parseXpsPage(xpsHtml);

  const subtitles: SubtitleTrack[] = [];
  if (subUrl) {
    const subs = await fetchSubtitles(subUrl);
    if (subs.length) subtitles.push(...subs);
  }

  const sources: StreamSource[] = [];
  const seenUrls = new Set<string>();

  const tryPlaylist = async (playlistPath: string, label?: string) => {
    if (!playlistPath) return;
    const playlistSources = await fetchPlaylistSources(
      playlistPath,
      xpsBase,
      xpsUrl,
    );
    for (const s of playlistSources) {
      if (seenUrls.has(s.url)) continue;
      seenUrls.add(s.url);
      sources.push({
        ...s,
        title: s.title || (label ? `2embed ${label}` : "2embed"),
        quality: s.quality || label || "Auto",
        referer: "https://play.xpass.top/",
      });
    }
  };

  // Primary JWPlayer playlist first (usually best)
  await tryPlaylist(primaryPlaylist, "Primary");

  // Then backup CDNs (cap to avoid slow extraction)
  const maxBackups = Math.min(backups.length, 8);
  for (let i = 0; i < maxBackups; i++) {
    const backup = backups[i]!;
    if (!backup.url) continue;
    await tryPlaylist(backup.url, backup.name || `Server ${i + 1}`);
    // Enough variety for the UI — stop early if we already have several
    if (sources.length >= 6) break;
  }

  // If no playlist sources found, try direct m3u8 in the page
  if (!sources.length) {
    const m3u8Matches = xpsHtml.match(
      /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g,
    );
    if (m3u8Matches) {
      for (const url of m3u8Matches) {
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        sources.push({
          url,
          quality: "Auto",
          type: "hls",
          title: "2embed",
          referer: "https://play.xpass.top/",
        });
      }
    }
  }

  return { sources, subtitles };
}
