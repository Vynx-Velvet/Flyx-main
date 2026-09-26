/**
 * Live TV segment cache + prefetch.
 *
 * DLHD segments are ~2 MB images that must be downloaded whole and unwrapped
 * before a single byte can go to the player, so the first frame waits on a
 * full round trip per segment. Serving the playlist is the earliest moment
 * we know which segments hls.js is about to ask for — so the playlist proxy
 * pre-warms the newest few here, and the segment proxy answers from memory.
 *
 * In-flight requests are de-duplicated (a prefetch and a player request for
 * the same URL share one upstream fetch). Entries are small in number but
 * large in bytes, so the cache is bounded by total size, not count.
 */

import { relaxedFetch } from "@flyx/core/utils";
import { unwrapDLHDSegment, looksLikeTS } from "@flyx/extractors/services";

const UA =
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0";

const MAX_CACHE_BYTES = 96 * 1024 * 1024; // ~40 live segments
const MAX_AGE_MS = 3 * 60 * 1000; // live segments are useless after a few minutes
const PREFETCH_CONCURRENCY = 4;

interface Entry {
  ts: Uint8Array;
  at: number;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<Uint8Array>>();
let cacheBytes = 0;

function evict() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.at > MAX_AGE_MS) {
      cacheBytes -= entry.ts.byteLength;
      cache.delete(key);
    }
  }
  // Map iteration order is insertion order → oldest first.
  while (cacheBytes > MAX_CACHE_BYTES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cacheBytes -= cache.get(oldest)!.ts.byteLength;
    cache.delete(oldest);
  }
}

export interface SegmentHeaders {
  referer?: string;
  origin?: string;
  cookie?: string;
}

async function fetchAndUnwrap(url: string, headers: SegmentHeaders): Promise<Uint8Array> {
  const h: Record<string, string> = { "User-Agent": UA, Accept: "*/*" };
  if (headers.referer) h.Referer = headers.referer;
  if (headers.origin) h.Origin = headers.origin;
  if (headers.cookie) h.Cookie = headers.cookie;

  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 20000);
  let res: Response;
  try {
    res = await relaxedFetch(url, { headers: h, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) {
    throw Object.assign(new Error(`upstream ${res.status}`), { status: res.status });
  }
  const raw = new Uint8Array(await res.arrayBuffer());
  if (raw.byteLength === 0) throw Object.assign(new Error("empty segment"), { status: 502 });
  // Copy out of the (much larger) wrapper's backing store.
  return looksLikeTS(raw) ? raw : new Uint8Array(unwrapDLHDSegment(raw));
}

/** Cached, de-duplicated segment fetch → unwrapped MPEG-TS bytes. */
export function getSegment(url: string, headers: SegmentHeaders = {}): Promise<Uint8Array> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at <= MAX_AGE_MS) return Promise.resolve(hit.ts);

  const pending = inflight.get(url);
  if (pending) return pending;

  const p = fetchAndUnwrap(url, headers)
    .then((ts) => {
      cache.set(url, { ts, at: Date.now() });
      cacheBytes += ts.byteLength;
      evict();
      return ts;
    })
    .finally(() => {
      inflight.delete(url);
    });
  inflight.set(url, p);
  return p;
}

/** True when `url` can be served from memory right now. */
export function isCached(url: string): boolean {
  const hit = cache.get(url);
  return Boolean(hit && Date.now() - hit.at <= MAX_AGE_MS);
}

/**
 * Fire-and-forget warm-up of the segments hls.js will request first. Never
 * throws; failures simply mean the player's own request fetches upstream.
 */
export function prefetchSegments(urls: string[], headers: SegmentHeaders = {}): void {
  const todo = urls.filter((u) => u && !isCached(u) && !inflight.has(u));
  if (!todo.length) return;
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const url = todo[i++]!;
      try {
        await getSegment(url, headers);
      } catch {
        /* the player's request will report the real error */
      }
    }
  };
  for (let n = 0; n < Math.min(PREFETCH_CONCURRENCY, todo.length); n++) void worker();
}

/** Test/diagnostic hook. */
export function segmentCacheStats() {
  return { entries: cache.size, bytes: cacheBytes, inflight: inflight.size };
}
