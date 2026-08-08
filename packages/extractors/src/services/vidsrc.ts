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

// ── WASM module cache ────────────────────────────────────────

/**
 * Cached WASM modules, keyed by the per-window integer `w`.
 * The decryptor changes every ~5 minutes; caching avoids re-fetching
 * the WASM binary for every stream request within the same window.
 */
const wasmCache = new Map<number, Promise<WebAssembly.Module>>();

async function getWasmModule(
  vs: VsDecryptor,
): Promise<WebAssembly.Module> {
  const cached = wasmCache.get(vs.w);
  if (cached) return cached;

  const p = (async () => {
    let buffer: ArrayBuffer;

    if (vs.wasm_url) {
      const r = await fetch(vs.wasm_url, {
        headers: {
          "User-Agent": UA,
          Referer: "https://cloudorchestranova.com/",
        },
      });
      if (!r.ok) throw new Error(`WASM fetch HTTP ${r.status}`);
      buffer = await r.arrayBuffer();
    } else if (vs.wasm) {
      // Inline base64 fallback (rare)
      buffer = Buffer.from(vs.wasm, "base64").buffer.slice(
        Buffer.from(vs.wasm, "base64").byteOffset,
        Buffer.from(vs.wasm, "base64").byteOffset +
          Buffer.from(vs.wasm, "base64").byteLength,
      );
    } else {
      throw new Error("No WASM source in vs decryptor");
    }

    return WebAssembly.compile(buffer);
  })();

  wasmCache.set(vs.w, p);
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
 * Returns an array of stream URLs (newline-separated in the plaintext).
 */
async function decryptStreamUrls(
  encB64: string,
  vs: VsDecryptor,
): Promise<string[]> {
  const mod = await getWasmModule(vs);

  const instance = await WebAssembly.instantiate(mod, {});
  const exports = instance.exports as unknown as {
    alloc: (size: number) => number;
    decrypt: (ptr: number, len: number) => number;
    memory: WebAssembly.Memory;
  };

  if (!exports.alloc || !exports.decrypt || !exports.memory) {
    throw new Error("WASM module missing expected exports (alloc, decrypt, memory)");
  }

  // Base64 decode the encrypted blob
  const enc = Buffer.from(encB64, "base64");

  // Allocate WASM memory and copy in the encrypted data
  const ptr = exports.alloc(enc.length);
  const mem = new Uint8Array(exports.memory.buffer, ptr, enc.length);
  mem.set(enc);

  // Decrypt — returns plaintext length
  const outLen = exports.decrypt(ptr, enc.length);

  // Plaintext starts at ptr + 12 (ChaCha20 nonce is 12 bytes)
  const decrypted = new TextDecoder().decode(
    new Uint8Array(exports.memory.buffer, ptr + 12, outLen),
  );

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
