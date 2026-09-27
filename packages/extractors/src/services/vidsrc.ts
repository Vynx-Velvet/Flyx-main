/**
 * VidSrc / VSEmbed extractor.
 *
 * Extraction chain (2026 — rewritten after cloudorchestranova dropped /rcp/):
 *   1. data.vidsrcme.ru/api.php?type={movie|tv}&tmdb={id}&stream_urls
 *   2. Response has encrypted `stream_urls` (base64 ChaCha20 nonce||ciphertext)
 *      + `vs` decryptor: { w: <window>, wasm_url: "<url>" }
 *   3. Fetch WASM module, instantiate → alloc(size) + decrypt(ptr, len)
 *   4. Decrypted output = stream URLs (newline-separated .m3u8 / .mp4)
 *
 * Security model:
 *   - ChaCha20 stream cipher with per-5-min-window WASM decryptor
 *   - Some streams require IP-bound tokens (gen_token_url) — unsupported server-side
 *   - API checks Referer header (cloudorchestranova.com)
 */

import type { StreamSource, SubtitleTrack } from "@flyx/core";
import { registerTokenUrls } from "./vidsrc-token-registry";
import { MAX_WASM_BYTES, runWasmDecrypt } from "./wasm-sandbox";

// ── Constants ────────────────────────────────────────────────

const API_BASE = "https://data.vidsrcme.ru";
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
const WASM_HOST_SUFFIX = ".vidsrcme.ru";
const WASM_HOSTS = new Set([new URL(API_BASE).hostname]);

/** Resolve + pin the upstream-chosen WASM URL to https on the VidSrc API domain. */
export function validateWasmUrl(raw: string): URL {
  const u = new URL(raw, API_BASE);
  if (u.protocol !== "https:") throw new Error(`WASM URL must be https (${u.protocol})`);
  if (u.username || u.password || (u.port && u.port !== "443")) {
    throw new Error("WASM URL has unexpected credentials or port");
  }
  if (!WASM_HOSTS.has(u.hostname) && !u.hostname.endsWith(WASM_HOST_SUFFIX)) {
    throw new Error(`WASM URL host not allowed: ${u.hostname}`);
  }
  return u;
}

async function fetchWasmBytes(url: URL): Promise<Uint8Array> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 15000);
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Referer: "https://cloudorchestranova.com/",
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

function getWasmBytes(vs: VsDecryptor): Promise<Uint8Array> {
  const key = String(vs.w);
  const cached = wasmCache.get(key);
  if (cached) return cached;

  const p = (async () => {
    if (vs.wasm_url) return fetchWasmBytes(validateWasmUrl(vs.wasm_url));
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
): Promise<string[]> {
  const wasm = await getWasmBytes(vs);

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

export async function extractVidSrc(
  tmdbId: number,
  mediaType = "movie",
  season?: number,
  episode?: number,
): Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }> {
  if (!tmdbId) return empty();

  try {
    // 1. Build API URL with stream_urls flag
    const params = new URLSearchParams({
      type: mediaType,
      tmdb: String(tmdbId),
      stream_urls: "",
    });
    if (mediaType === "tv") {
      if (season !== undefined) params.set("season", String(season));
      if (episode !== undefined) params.set("episode", String(episode));
    }
    const apiUrl = `${API_BASE}/api.php?${params.toString()}`;

    // 2. Fetch the stream-data API
    const r = await fetch(apiUrl, {
      headers: {
        "User-Agent": UA,
        Referer: "https://cloudorchestranova.com/",
        Accept: "application/json",
      },
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
      streamUrls = await decryptStreamUrls(json.data.stream_urls, json.vs);
    } else {
      console.warn("[VidSrc] No stream_urls in API response");
      return empty();
    }

    if (!streamUrls.length) {
      console.warn("[VidSrc] Decrypted stream URLs array is empty");
      return empty();
    }

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
        referer: "https://cloudorchestranova.com/",
        origin: "https://cloudorchestranova.com",
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
