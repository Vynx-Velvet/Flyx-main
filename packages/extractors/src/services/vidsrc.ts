/**
 * VidSrc / VSEmbed extractor.
 *
 * Extraction chain (October 2026):
 *   1. vidsrc.sh/vs_src.php -> gated player -> single-use API token
 *   2. data.vidsrc.sh/api.php?...&stream_urls&api_token=...
 *   2. Response has encrypted `stream_urls` (base64 ChaCha20 nonce||ciphertext)
 *      + `vs` decryptor: { w: <window>, wasm_url: "<url>" }
 *   3. Fetch WASM module, instantiate → alloc(size) + decrypt(ptr, len)
 *   4. Decrypted output = stream URLs (newline-separated .m3u8 / .mp4)
 *
 * Security model:
 *   - ChaCha20 stream cipher with per-5-min-window WASM decryptor
 *   - CDN tokens are IP-bound; playback uses the same server via the stream proxy
 *   - API checks Referer header (the player host)
 *   - The player host rotates (cloudorchestranova.com → stellarconductornexus.com
 *     in Oct 2026), so it is taken from vidsrc.sh's answer, structurally
 *     validated, and every later hop is pinned to it (validatePlayerUrl)
 */

import type { StreamSource, SubtitleTrack } from "@flyx/core";
import { registerTokenUrls } from "./vidsrc-token-registry";
import { MAX_WASM_BYTES, runWasmDecrypt } from "./wasm-sandbox";

// ── Constants ────────────────────────────────────────────────

const API_BASE = "https://data.vidsrc.sh";
const EMBED_BASE = "https://vidsrc.sh";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface VsDecryptor {
  w: number;
  wasm_url: string;
  wasm?: string; // inline fallback (base64)
}

interface VsApiResponse {
  status_code: string;
  data?: {
    title?: string;
    stream_urls: string | string[];
    gen_token_url?: string;
    file_name?: string;
    [key: string]: unknown;
  };
  vs?: VsDecryptor;
  [key: string]: unknown;
}

// ── WASM decryptor cache ─────────────────────────────────────

/**
 * Cached WASM binaries, keyed by the per-window integer `w`.
 * The decryptor changes every ~5 minutes; caching avoids re-fetching
 * the WASM binary for every stream request within the same window.
 * Bounded: only the most recent few windows are kept.
 */
const WASM_CACHE_MAX = 8;
const wasmCache = new Map<string, Promise<Uint8Array>>();

/** Hosts the decryptor may be downloaded from (the API host's domain). */
const WASM_HOST_SUFFIXES = [".vidsrc.sh", ".vidsrcme.ru"];
const WASM_HOSTS = new Set([new URL(API_BASE).hostname, "data.vidsrcme.ru"]);

/** Resolve + pin the upstream-chosen WASM URL to https on the VidSrc API domain. */
export function validateWasmUrl(raw: string): URL {
  const u = new URL(raw, API_BASE);
  if (u.protocol !== "https:") throw new Error(`WASM URL must be https (${u.protocol})`);
  if (u.username || u.password || (u.port && u.port !== "443")) {
    throw new Error("WASM URL has unexpected credentials or port");
  }
  if (!WASM_HOSTS.has(u.hostname) && !WASM_HOST_SUFFIXES.some((suffix) => u.hostname.endsWith(suffix))) {
    throw new Error(`WASM URL host not allowed: ${u.hostname}`);
  }
  return u;
}

/**
 * Pin an upstream-chosen player URL. The first hop (vidsrc.sh's `src`) may
 * name any host — it rotates — as long as it is https on the default port,
 * a DNS name (no IP literal, no localhost/.local) and an /embed/ path.
 * Later hops pass `pinnedOrigin` and must stay on that exact origin.
 */
export function validatePlayerUrl(raw: string, pinnedOrigin?: string): URL {
  const url = new URL(raw, pinnedOrigin);
  const host = url.hostname.toLowerCase();
  const bad =
    url.protocol !== "https:" ||
    (url.port !== "" && url.port !== "443") ||
    !!url.username ||
    !!url.password ||
    !url.pathname.startsWith("/embed/") ||
    (pinnedOrigin !== undefined && url.origin !== pinnedOrigin) ||
    host.includes(":") ||
    /^[\d.]+$/.test(host) ||
    !/\.[a-z][a-z0-9-]*$/.test(host) ||
    host === "localhost" ||
    /\.(localhost|local|internal|lan|home|arpa)$/.test(host);
  if (bad) throw new Error("Unexpected VidSrc player URL");
  return url;
}

async function fetchWasmBytes(url: URL, referer: string): Promise<Uint8Array> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 15000);
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Referer: referer,
      },
      redirect: "error",
      signal: c.signal,
    });
    if (!r.ok) throw new Error(`WASM fetch HTTP ${r.status}`);
    const declared = Number(r.headers.get("content-length"));
    if (declared > MAX_WASM_BYTES) throw new Error(`WASM too large (${declared} bytes)`);
    if (!r.body) return new Uint8Array(await r.arrayBuffer());
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = r.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_WASM_BYTES) {
        await reader.cancel().catch(() => {});
        throw new Error("WASM too large");
      }
      chunks.push(value);
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const chunk of chunks) {
      out.set(chunk, off);
      off += chunk.byteLength;
    }
    return out;
  } finally {
    clearTimeout(t);
  }
}

function getWasmBytes(vs: VsDecryptor, referer: string): Promise<Uint8Array> {
  const key = String(vs.w);
  const cached = wasmCache.get(key);
  if (cached) return cached;

  const p = (async () => {
    if (vs.wasm_url) return fetchWasmBytes(validateWasmUrl(vs.wasm_url), referer);
    if (vs.wasm) {
      // Inline base64 fallback (rare)
      if (vs.wasm.length > Math.ceil((MAX_WASM_BYTES * 4) / 3) + 4) throw new Error("Inline WASM too large");
      return new Uint8Array(Buffer.from(vs.wasm, "base64"));
    }
    throw new Error("No WASM source in vs decryptor");
  })();

  wasmCache.set(key, p);
  p.catch(() => {
    if (wasmCache.get(key) === p) wasmCache.delete(key);
  });
  while (wasmCache.size > WASM_CACHE_MAX) {
    const oldest = wasmCache.keys().next().value;
    if (oldest === undefined) break;
    wasmCache.delete(oldest);
  }
  return p;
}

// ── ChaCha20 decryption ──────────────────────────────────────

/**
 * Decrypt the encrypted `stream_urls` string using the WASM ChaCha20 module.
 *
 * Encryption scheme (from vsdec.js):
 *   1. Base64-decode the ciphertext
 *   2. Allocate WASM memory, copy ciphertext
 *   3. Call decrypt(ptr, len) → returns plaintext length
 *   4. Plaintext starts at ptr + 12 (12-byte nonce is prepended)
 *
 * The module is upstream-supplied, so it runs in a resource-limited worker
 * thread with a timeout (see wasm-sandbox.ts), never on the main thread.
 *
 * Returns an array of stream URLs (newline-separated in the plaintext).
 */
async function decryptStreamUrls(
  encB64: string,
  vs: VsDecryptor,
  referer: string,
): Promise<string[]> {
  const wasm = await getWasmBytes(vs, referer);

  // Base64 decode the encrypted blob
  const enc = new Uint8Array(Buffer.from(encB64, "base64"));

  const decrypted = await runWasmDecrypt(wasm, enc);

  return decrypted
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ── Public API ───────────────────────────────────────────────

const empty = (): { sources: StreamSource[]; subtitles: SubtitleTrack[] } => ({
  sources: [],
  subtitles: [],
});

/** Follow the public embed bootstrap. API tokens are IP-bound and single-use;
 * never cache a player page or share its token between extraction requests. */
async function getStreamApi(
  tmdbId: number,
  mediaType: string,
  season?: number,
  episode?: number,
): Promise<{ api: URL; playerOrigin: string }> {
  const params = new URLSearchParams({ type: mediaType, id: String(tmdbId) });
  if (mediaType === "tv") {
    params.set("season", String(season ?? 1));
    params.set("episode", String(episode ?? 1));
  }
  const read = async (url: URL, referer: string) => {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Referer: referer },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Player bootstrap HTTP ${response.status}`);
    return response.text();
  };
  const frame = JSON.parse(await read(new URL(`${EMBED_BASE}/vs_src.php?${params}`), `${EMBED_BASE}/`)) as { src?: string };
  if (!frame.src) throw new Error("VidSrc embed did not return a player");
  const innerUrl = validatePlayerUrl(frame.src);
  const playerOrigin = innerUrl.origin;
  const inner = await read(innerUrl, `${EMBED_BASE}/`);
  const cfgMatch = inner.match(/window\.CFG\s*=\s*(\{[^\n]+?\});/);
  if (!cfgMatch) throw new Error("VidSrc player configuration missing");
  const cfg = JSON.parse(cfgMatch[1]!) as { playerUrl?: string };
  if (!cfg.playerUrl) throw new Error("VidSrc player URL missing");
  const player = await read(validatePlayerUrl(cfg.playerUrl, playerOrigin), innerUrl.href);
  const configMatch = player.match(/window\.CONFIG\s*=\s*(\{[^\n]+?\});/);
  if (!configMatch) throw new Error("VidSrc stream configuration missing");
  const config = JSON.parse(configMatch[1]!) as { api?: string; streamBase?: string; apiToken?: string };
  if (!config.apiToken) throw new Error("VidSrc API token missing");
  const api = new URL(config.api || config.streamBase || "", API_BASE);
  if (api.origin !== API_BASE || api.pathname !== "/api.php" || api.username || api.password) {
    throw new Error("Unexpected VidSrc API URL");
  }
  api.searchParams.set("stream_urls", "");
  if (mediaType === "tv") {
    api.searchParams.set("season", String(season ?? 1));
    api.searchParams.set("episode", String(episode ?? 1));
  }
  api.searchParams.set("api_token", config.apiToken);
  return { api, playerOrigin };
}

export async function extractVidSrc(
  tmdbId: number,
  mediaType = "movie",
  season?: number,
  episode?: number,
): Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }> {
  if (!tmdbId) return empty();

  try {
    const { api: apiUrl, playerOrigin } = await getStreamApi(tmdbId, mediaType, season, episode);
    const playerReferer = `${playerOrigin}/`;

    // 2. Fetch the stream-data API
    const r = await fetch(apiUrl, {
      headers: {
        "User-Agent": UA,
        Referer: playerReferer,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
    });

    if (!r.ok) {
      console.warn(`[VidSrc] API HTTP ${r.status} for ${mediaType}/${tmdbId}`);
      return empty();
    }

    const json: VsApiResponse = await r.json();

    if (json.status_code !== "200" || !json.data) {
      console.warn(`[VidSrc] API returned status ${json.status_code}`);
      return empty();
    }

    // 3. Extract stream URLs (decrypt if necessary)
    let streamUrls: string[];

    if (Array.isArray(json.data.stream_urls)) {
      streamUrls = json.data.stream_urls;
    } else if (
      typeof json.data.stream_urls === "string" &&
      json.data.stream_urls.length > 0 &&
      json.vs
    ) {
      streamUrls = await decryptStreamUrls(json.data.stream_urls, json.vs, playerReferer);
    } else {
      console.warn("[VidSrc] No stream_urls in API response");
      return empty();
    }

    streamUrls = streamUrls.filter((url) => {
      if (typeof url !== "string") return false;
      try { return ["https:", "http:"].includes(new URL(url.trim()).protocol); } catch { return false; }
    });
    if (!streamUrls.length) {
      console.warn("[VidSrc] Decrypted stream URLs array is empty");
      return empty();
    }

    // 4. Build stream sources.
    //    The API returns gen_token_url — the endpoint to fetch IP-bound tokens.
    //    Pass it through so /api/stream/proxy uses the correct token endpoint
    //    instead of guessing ${cdn_origin}/generate.php (which fails on TLS).
    const tokenUrl = json.data.gen_token_url || undefined;

    // Register CDN origins → token URL so the stream proxy can find them
    if (tokenUrl) {
      const origins = new Set<string>();
      for (const url of streamUrls) {
        try { origins.add(new URL(url.trim()).origin); } catch { /* skip malformed */ }
      }
      if (origins.size > 0) {
        registerTokenUrls([...origins], tokenUrl);
        console.log(`[VidSrc] Registered token URL for ${origins.size} CDN origin(s)`);
      }
    }

    const resolution = json.data.file_name?.match(/\[(\d+p)\]/)?.[1];
    const sources: StreamSource[] = streamUrls.map((url, i) => {
      const trimmed = url.trim();
      const isHls = trimmed.includes(".m3u8");

      return {
        url: trimmed,
        quality: isHls ? "Auto" : resolution ?? "Auto",
        type: isHls ? ("hls" as const) : ("mp4" as const),
        title: streamUrls.length > 1 ? `VidSrc ${i + 1}` : "VidSrc",
        referer: playerReferer,
        origin: playerOrigin,
        requiresSegmentProxy: true,
        tokenUrl,
      };
    });

    console.log(`[VidSrc] Extracted ${sources.length} source(s) for ${mediaType}/${tmdbId}`);
    return { sources, subtitles: [] };
  } catch (e) {
    console.warn(`[VidSrc] Extraction failed for ${mediaType}/${tmdbId}:`, (e as Error).message);
    return empty();
  }
}
