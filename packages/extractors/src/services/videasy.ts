/**
 * Videasy extractor.
 *
 * Reverse-engineered extraction chain:
 *   1. GET db.speedracelight.com/3/movie|tv/{id} → TMDB metadata
 *   2. GET api.speedracelight.com/seed?mediaId={tmdbId} → short-lived seed
 *   3. GET api.speedracelight.com/{provider}/sources-with-title?...&enc=2&seed=
 *      → base64 payload encrypted with custom PRNG (magic "mvm1")
 *   4. XOR-decrypt payload → JSON { sources, subtitles }
 *
 * Providers (Valorant-themed in player UI):
 *   cdn, neon2, m4uhd, meine, lamovie, hdmovie, superflix
 *
 * Domains: player.videasy.to, api.speedracelight.com, db.speedracelight.com
 */

import type { StreamSource, SubtitleTrack } from "@flyx/core";

// ── Constants ────────────────────────────────────────────────

const TMDB_PROXY = "https://db.speedracelight.com/3";
const API_BASE = "https://api.speedracelight.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Provider path suffixes under api.speedracelight.com.
 * Ordered by reliability (from live probes). Keep list short — seed API rate-limits.
 */
const PROVIDERS = [
  { path: "/cdn/sources-with-title", label: "Yoru" },
  { path: "/neon2/sources-with-title", label: "Neon" },
  { path: "/m4uhd/sources-with-title", label: "Breach" },
  { path: "/meine/sources-with-title", label: "Killjoy" },
  { path: "/lamovie/sources-with-title", label: "Omen" },
] as const;

/** Stop after this many sources to avoid burning seeds. */
const MAX_SOURCES = 8;

// Decrypt tables from player chunk 8351
const F = [
  1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
  2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
  1925078388, 2162078206, 2614888103, 3248222580,
];
const MAGIC = [109, 118, 109, 49]; // "mvm1"

// ── Crypto helpers (ported from player chunk 8351) ───────────

const isEvenTri = (e: number) => ((e * (e + 1)) & 1) === 0;
const isOddTri = (e: number) => ((e * (e + 1)) & 1) === 1;

function mix(e: number): number {
  e >>>= 0;
  e ^= e >>> 16;
  e = Math.imul(e, 2246822507) >>> 0;
  e ^= e >>> 13;
  e = Math.imul(e, 3266489909) >>> 0;
  return (e ^= e >>> 16) >>> 0;
}

function rotl(e: number, t: number): number {
  e >>>= 0;
  t &= 31;
  if (t === 0) return e >>> 0;
  return ((e << t) | (e >>> (32 - t))) >>> 0;
}

function fnv1a(e: string): number {
  let t = 2166136261;
  for (let s = 0; s < e.length; s++) {
    t = Math.imul(t ^ e.charCodeAt(s), 16777619) >>> 0;
  }
  return mix(t);
}

function accSeed(e: string): number {
  let t = 1732584193;
  for (let s = 0; s < e.length; s++) {
    t = rotl((t ^ Math.imul(e.charCodeAt(s), F[15 & s]!)) >>> 0, 5);
  }
  return mix(t);
}

function rc4Sbox(e: string): number[] {
  const t = Array.from({ length: 256 }, (_, i) => i);
  let s = 0;
  for (let a = 0; a < 256; a++) {
    s = (s + t[a]! + e.charCodeAt(a % e.length)) & 255;
    const r = t[a]!;
    t[a] = t[s]!;
    t[s] = r;
  }
  return t;
}

interface CipherState {
  S: number[];
  acc: number;
}

function buildState(seed: string, mediaId: number): CipherState {
  if (isOddTri(seed.length)) {
    return { S: rc4Sbox(seed), acc: accSeed(seed) };
  }
  const s: number[] = new Array(61);
  let a = mix(fnv1a(seed) ^ mix((mediaId >>> 0) ^ 2654435769)) >>> 0;
  for (let e = 0; e < 8; e++) {
    if (isEvenTri(e)) {
      const t = a % 61;
      a = rotl((a + 2654435769) >>> 0, 7 + (7 & e));
      s[t] = (a ^ mix(a)) >>> 0;
      a = mix((a + t) >>> 0);
    } else {
      s[e] = F[15 & e]!;
    }
  }
  return { S: s, acc: mix(2779096485 ^ a) >>> 0 };
}

function nextWord(state: CipherState, counter: number): number {
  const r = state.S;
  let acc = state.acc;
  const n = acc % 61;
  // `n in r` → Number(true)=1 → 0-1 = -1 (all bits set for & mask)
  const i = 0 - Number(n in r);
  const l = (r[n] ?? 0) >>> 0;
  const a = (l ^ (Math.imul(2654435769, counter + 1) >>> 0)) >>> 0;
  let d = ((acc ^ a) >>> 0 | ((acc & a & i) >>> 0)) >>> 0;
  d = (rotl((d + acc) >>> 0, 31 & n) ^ rotl(acc, 31 & Math.imul(n, 7))) >>> 0;
  acc = mix((d + 2654435769) >>> 0);
  r[n] = acc >>> 0;
  state.acc = acc;
  return acc >>> 0;
}

function keystream(seed: string, mediaId: number, len: number): Uint8Array {
  const state = buildState(seed, mediaId);
  const out = new Uint8Array(len);
  let counter = 0;
  for (let e = 0; e < len; ) {
    const t = nextWord(state, counter++);
    out[e++] = 255 & t;
    if (e < len) out[e++] = (t >>> 8) & 255;
    if (e < len) out[e++] = (t >>> 16) & 255;
    if (e < len) out[e++] = (t >>> 24) & 255;
  }
  return out;
}

function b64ToBytes(e: string): Uint8Array {
  const t = e
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(4 * Math.ceil(e.length / 4), "=");
  const bin = atob(t);
  const s = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) s[i] = bin.charCodeAt(i);
  return s;
}

function decryptPayload(
  payload: string,
  seed: string,
  mediaId: number,
): string {
  const r = b64ToBytes(payload);
  const o = keystream(seed, mediaId, r.length);
  for (let e = 0; e < r.length; e++) r[e]! ^= o[e]!;
  for (let e = 0; e < MAGIC.length; e++) {
    if (r[e] !== MAGIC[e]) {
      throw new Error("Videasy decrypt failed: bad seed or tampered payload");
    }
  }
  return new TextDecoder("utf-8").decode(r.subarray(MAGIC.length));
}

// ── HTTP helpers ─────────────────────────────────────────────

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const defaultHeaders = {
  "User-Agent": UA,
  Referer: "https://player.videasy.to/",
  Origin: "https://player.videasy.to",
  Accept: "application/json, text/plain, */*",
};

// ── Seed + encrypted source fetch ────────────────────────────

const seedCache = new Map<string, { seed: string; expiresAt: number }>();
/** In-flight seed fetches so parallel callers share one request. */
const seedInflight = new Map<string, Promise<string>>();

async function getSeed(mediaId: number, force = false): Promise<string> {
  const key = `${API_BASE}|${mediaId}`;
  const now = Date.now();
  if (!force) {
    const cached = seedCache.get(key);
    if (cached && cached.expiresAt - 5000 > now) return cached.seed;
    const inflight = seedInflight.get(key);
    if (inflight) return inflight;
  }

  const promise = (async () => {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(`${API_BASE}/seed?mediaId=${mediaId}`, {
          headers: defaultHeaders,
          signal: controller.signal,
        });
        clearTimeout(timer);
        const data = (await res.json()) as {
          seed?: string;
          ttlMs?: number;
          error?: string;
        };
        if (res.status === 429 || data.error === "rate_limited") {
          lastErr = new Error("seed rate_limited");
          await sleep(800 * (attempt + 1) + Math.random() * 400);
          continue;
        }
        if (!res.ok || !data.seed) {
          throw new Error(`seed HTTP ${res.status}`);
        }
        const ttl = data.ttlMs ?? 30000;
        seedCache.set(key, { seed: data.seed, expiresAt: Date.now() + ttl });
        return data.seed;
      } catch (e) {
        lastErr = e as Error;
        await sleep(400 * (attempt + 1));
      }
    }
    throw lastErr ?? new Error("seed failed");
  })();

  seedInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    seedInflight.delete(key);
  }
}

interface ProviderSource {
  url?: string;
  quality?: string;
  type?: string;
  file?: string;
}

interface ProviderResult {
  sources?: ProviderSource[];
  subtitles?: Array<{
    url?: string;
    file?: string;
    language?: string;
    lang?: string;
    label?: string;
  }>;
}

async function fetchProvider(
  path: string,
  mediaId: number,
  params: Record<string, string | number | undefined>,
  seed: string,
): Promise<ProviderResult | null> {
  const buildQs = (s: string) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === "") continue;
      qs.set(k, String(v));
    }
    qs.set("enc", "2");
    qs.set("seed", s);
    return qs;
  };

  const attempt = async (s: string): Promise<ProviderResult | null> => {
    const text = await fetchText(
      `${API_BASE}${path}?${buildQs(s).toString()}`,
      { headers: defaultHeaders },
      20000,
    );
    let payload = text.trim();
    if (payload.startsWith('"') && payload.endsWith('"')) {
      payload = JSON.parse(payload) as string;
    }
    if (payload.startsWith("{")) {
      try {
        const err = JSON.parse(payload) as { error?: string };
        if (err.error) {
          if (
            String(err.error).includes("SEED") ||
            String(err.error).includes("seed")
          ) {
            throw new Error("SEED_INVALID");
          }
          return null;
        }
      } catch (e) {
        if ((e as Error).message === "SEED_INVALID") throw e;
        // not JSON error — fall through to decrypt
      }
    }
    const decoded = decryptPayload(payload, s, mediaId);
    return JSON.parse(decoded) as ProviderResult;
  };

  try {
    return await attempt(seed);
  } catch (e) {
    if ((e as Error).message === "SEED_INVALID") {
      try {
        seedCache.delete(`${API_BASE}|${mediaId}`);
        const fresh = await getSeed(mediaId, true);
        return await attempt(fresh);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function mapSources(
  raw: ProviderSource[],
  label: string,
): StreamSource[] {
  const out: StreamSource[] = [];
  for (const s of raw) {
    const url = s.url || s.file;
    if (!url || typeof url !== "string") continue;
    if (!/^https?:\/\//i.test(url)) continue;

    out.push({
      url,
      quality: String(s.quality || "Auto"),
      type: (s.type === "dash" || s.type === "mpd" || url.includes(".mpd")) ? "dash" : "hls",
      title: `Videasy ${label}${s.quality ? ` · ${s.quality}` : ""}`,
      referer: "https://player.videasy.to/",
    });
  }
  return out;
}

function mapSubtitles(
  raw: ProviderResult["subtitles"],
): SubtitleTrack[] {
  if (!raw?.length) return [];
  const out: SubtitleTrack[] = [];
  for (const s of raw) {
    const url = s.url || s.file;
    if (!url) continue;
    out.push({
      url,
      language: s.lang || s.language || "und",
      label: s.label || s.language || s.lang || "Unknown",
    });
  }
  return out;
}

// ── Main Extractor ───────────────────────────────────────────

export async function extractVideasy(
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
    // ── Step 1: TMDB metadata via proxy ────────────────────
    const isTv =
      mediaType === "tv" && season !== undefined && episode !== undefined;
    const path = isTv
      ? `/tv/${tmdbId}?append_to_response=external_ids`
      : `/movie/${tmdbId}?append_to_response=external_ids`;

    const tmdb = await fetchJSON<{
      id: number;
      title?: string;
      name?: string;
      original_title?: string;
      original_name?: string;
      release_date?: string;
      first_air_date?: string;
      imdb_id?: string;
      external_ids?: { imdb_id?: string };
      number_of_seasons?: number;
    }>(`${TMDB_PROXY}${path}`, { headers: defaultHeaders });

    const title =
      tmdb.title ||
      tmdb.name ||
      tmdb.original_title ||
      tmdb.original_name ||
      String(tmdbId);
    const yearStr = (tmdb.release_date || tmdb.first_air_date || "").slice(0, 4);
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    const imdbId = tmdb.imdb_id || tmdb.external_ids?.imdb_id || "";

    // Match player: title is encodeURIComponent'd before being put in params
    // (axios/ky may encode again → double-encode; we pass once via URLSearchParams)
    const params: Record<string, string | number | undefined> = {
      title: encodeURIComponent(title),
      mediaType: isTv ? "tv" : "movie",
      year: year || undefined,
      tmdbId,
      imdbId,
      totalSeasons: isTv ? tmdb.number_of_seasons : undefined,
      seasonId: isTv ? season : undefined,
      episodeId: isTv ? episode : undefined,
    };

    // ── Step 2: One seed, sequential providers (avoids rate limits) ─
    let seed: string;
    try {
      seed = await getSeed(tmdbId);
    } catch {
      return empty;
    }

    const sources: StreamSource[] = [];
    const subtitles: SubtitleTrack[] = [];
    const seenUrls = new Set<string>();
    const seenSubs = new Set<string>();

    for (const p of PROVIDERS) {
      if (sources.length >= MAX_SOURCES) break;
      const data = await fetchProvider(p.path, tmdbId, params, seed);
      // Keep using latest cached seed if refresh happened inside fetchProvider
      const cached = seedCache.get(`${API_BASE}|${tmdbId}`);
      if (cached) seed = cached.seed;

      if (!data?.sources?.length) continue;
      for (const s of mapSources(data.sources, p.label)) {
        if (seenUrls.has(s.url)) continue;
        seenUrls.add(s.url);
        sources.push(s);
      }
      for (const sub of mapSubtitles(data.subtitles)) {
        if (seenSubs.has(sub.url)) continue;
        seenSubs.add(sub.url);
        subtitles.push(sub);
      }
      // Small gap between provider hits
      await sleep(150);
    }

    return { sources, subtitles };
  } catch {
    return empty;
  }
}
