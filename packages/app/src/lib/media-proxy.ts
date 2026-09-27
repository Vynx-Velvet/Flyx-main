/**
 * Shared helpers for the media proxies (/api/stream/proxy, /api/livetv/*,
 * /api/subtitles/proxy, /api/manga/image). Node runtime only.
 *
 *  - Output Content-Type allowlist: a proxied upstream must never be able
 *    to serve text/html (or SVG, XML, JS…) on the Flyx origin.
 *  - Security headers every proxy response carries.
 *  - HLS playlist rewriting: every URI in the playlist (bare URL lines and
 *    any tag's URI="…" attribute) is resolved against the playlist URL and
 *    handed to a caller-supplied builder that points it back at the proxy.
 *    URIs with a non-http(s) scheme are dropped (data: is kept only on
 *    EXT-X-KEY, where inline keys are legitimate).
 */

import { NextResponse } from "next/server";
import { hasValidSignature, type ProxyAuthorization } from "@/lib/security/proxy-sign";

// ── Content types ────────────────────────────────────────────

const EXACT_SAFE_TYPES = new Set([
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "audio/mpegurl",
  "audio/x-mpegurl",
  "application/octet-stream",
  "binary/octet-stream",
  "application/mp4",
  "application/dash+xml",
  "text/vtt",
]);

/** Image types that are safe to render on our origin (no SVG — it can script). */
const SAFE_IMAGE = /^image\/(?:jpeg|jpg|pjpeg|png|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon|apng|heic|heif)$/;

/**
 * Map an upstream Content-Type to one that is safe to serve from the Flyx
 * origin. Anything outside the media allowlist becomes
 * application/octet-stream (never rendered by the browser; hls.js / <video>
 * sniff media themselves). Parameters (charset…) are dropped.
 */
export function safeMediaContentType(
  upstream: string | null | undefined,
  opts: { allowImages?: boolean } = {},
): string {
  const essence = (upstream || "").split(";")[0]!.trim().toLowerCase();
  if (!essence) return "application/octet-stream";
  if (EXACT_SAFE_TYPES.has(essence)) return essence;
  if (/^(?:video|audio)\/[a-z0-9.+-]+$/.test(essence)) return essence;
  if (opts.allowImages !== false && SAFE_IMAGE.test(essence)) return essence;
  return "application/octet-stream";
}

/** Headers every proxy response carries (success or error). */
export const PROXY_SECURITY_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "sandbox; default-src 'none'",
});

/** JSON error response carrying the proxy security headers. */
export function proxyJsonError(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: { ...PROXY_SECURITY_HEADERS } });
}

/** 401 for requests with neither a session nor a valid signature. */
export function proxyUnauthorized(): NextResponse {
  return proxyJsonError({ error: "Unauthorized" }, 401);
}

// ── CORS for signed URLs ─────────────────────────────────────

/**
 * CORS headers for a response to a SIGNATURE-authorized request. A signed
 * URL is a bearer capability only the server can mint, so letting any
 * origin read it adds nothing an attacker could not already do with the
 * URL — and the Chromecast receiver (a gstatic.com page) needs it to fetch
 * playlists, segments and subtitles. Cookie-authorized responses must never
 * carry these: that would let any site read a logged-in user's proxy. `*`
 * is never honoured for credentialed requests, so cookies stay out of it.
 */
export const SIGNED_CORS_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
});

/** Add SIGNED_CORS_HEADERS to `res` iff the request was authorized by signature. */
export function applySignedCors<R extends Response>(res: R, via: ProxyAuthorization): R {
  if (via === "signature") {
    for (const [k, v] of Object.entries(SIGNED_CORS_HEADERS)) res.headers.set(k, v);
  }
  return res;
}

/**
 * OPTIONS preflight for a proxy route. Only a validly signed URL gets a
 * permissive answer (Range needs a preflight on older receivers); anything
 * else gets a bare 401 without CORS headers, so the browser blocks it.
 */
export function signedPreflight(request: Request): NextResponse {
  if (!hasValidSignature(request.url)) return proxyUnauthorized();
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...PROXY_SECURITY_HEADERS,
      ...SIGNED_CORS_HEADERS,
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
      "Access-Control-Max-Age": "600",
    },
  });
}

// ── HLS rewriting ────────────────────────────────────────────

export type HlsUriKind = "line" | "tag";

export interface HlsUriContext {
  /** "line" for a bare URI line, "tag" for a URI="…" attribute. */
  kind: HlsUriKind;
  /** The tag name for attributes (e.g. "EXT-X-KEY"), empty for bare lines. */
  tag: string;
}

/**
 * Build the proxied replacement for an absolute http(s) upstream URL.
 * Return null to drop the entry.
 */
export type HlsUriBuilder = (absoluteUrl: string, ctx: HlsUriContext) => string | null;

const URI_ATTR = /([:,])URI="([^"]*)"/;

function resolveHttp(uri: string, baseUrl: string): string | null {
  try {
    // Absolute http(s) URIs are passed through verbatim (after a validity
    // check): re-serialising can re-encode characters and break CDN
    // signatures.
    if (/^https?:\/\//i.test(uri)) {
      new URL(uri);
      return uri;
    }
    const u = new URL(uri, baseUrl);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function hasScheme(uri: string): string | null {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(uri.trim());
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * Rewrite every URI in an HLS playlist through `build`.
 *
 *  - Bare URI lines (variants, segments) are rewritten; ones that are not
 *    http(s) after resolution are removed.
 *  - Any tag carrying URI="…" (EXT-X-KEY, -MAP, -MEDIA, -I-FRAME-STREAM-INF,
 *    -SESSION-KEY, -PART, -PRELOAD-HINT, -RENDITION-REPORT, …) has that
 *    attribute rewritten. A `data:` URI is kept only on EXT-X-KEY; any other
 *    non-http(s) URI removes the whole tag line.
 */
export function rewriteHlsPlaylist(text: string, baseUrl: string, build: HlsUriBuilder): string {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }

    if (trimmed.startsWith("#")) {
      const m = URI_ATTR.exec(trimmed);
      if (!m) {
        out.push(line);
        continue;
      }
      const tag = trimmed.slice(1).split(":")[0]!.toUpperCase();
      const uri = m[2]!;
      const scheme = hasScheme(uri);
      if (scheme === "data") {
        if (tag === "EXT-X-KEY") out.push(trimmed);
        continue;
      }
      if (scheme && scheme !== "http" && scheme !== "https") continue;
      const abs = resolveHttp(uri, baseUrl);
      const replacement = abs ? build(abs, { kind: "tag", tag }) : null;
      if (replacement === null) continue;
      out.push(trimmed.replace(URI_ATTR, (_m, sep: string) => `${sep}URI="${replacement}"`));
      continue;
    }

    const scheme = hasScheme(trimmed);
    if (scheme && scheme !== "http" && scheme !== "https") continue;
    const abs = resolveHttp(trimmed, baseUrl);
    const replacement = abs ? build(abs, { kind: "line", tag: "" }) : null;
    if (replacement === null) continue;
    out.push(replacement);
  }
  return out.join("\n");
}

/** True if the first bytes look like an HLS playlist (BOM/whitespace tolerant). */
export function looksLikeM3u8(head: string): boolean {
  return head.replace(/^\uFEFF/, "").trimStart().startsWith("#EXTM3U");
}

// ── Streaming helpers ────────────────────────────────────────

/**
 * Read up to `maxBytes` from the front of a stream without consuming the
 * rest. Returns the bytes read and a stream that replays them followed by
 * the remainder, so the body can still be passed through untouched.
 */
export async function peekStream(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<{ head: Uint8Array; stream: ReadableStream<Uint8Array> }> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let done = false;
  while (total < maxBytes) {
    const r = await reader.read();
    if (r.done) {
      done = true;
      break;
    }
    chunks.push(r.value);
    total += r.value.byteLength;
  }
  const head = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    head.set(c, off);
    off += c.byteLength;
  }
  let replayed = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!replayed) {
        replayed = true;
        if (head.byteLength) controller.enqueue(head);
        if (done) controller.close();
        return;
      }
      try {
        const r = await reader.read();
        if (r.done) controller.close();
        else controller.enqueue(r.value);
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return { head, stream };
}

/**
 * Wrap a body stream so it errors out when no chunk arrives for `idleMs`
 * or the whole transfer exceeds `totalMs` — a stalled CDN then ends the
 * response instead of pinning a socket forever. `onEnd` runs exactly once.
 */
export function guardStream(
  body: ReadableStream<Uint8Array>,
  opts: { idleMs: number; totalMs: number; onEnd?: () => void },
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const deadline = Date.now() + opts.totalMs;
  let ended = false;
  const end = () => {
    if (!ended) {
      ended = true;
      opts.onEnd?.();
    }
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const remaining = deadline - Date.now();
      const wait = Math.max(0, Math.min(opts.idleMs, remaining));
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const r = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("upstream stalled")), wait);
          }),
        ]);
        if (r.done) {
          end();
          controller.close();
        } else controller.enqueue(r.value);
      } catch (err) {
        end();
        reader.cancel(err).catch(() => {});
        controller.error(err);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    cancel(reason) {
      end();
      return reader.cancel(reason);
    },
  });
}

// ── Bounded LRU ──────────────────────────────────────────────

/**
 * Map-backed LRU bounded by entry count and (optionally) total size, with a
 * per-entry TTL.
 */
export class BoundedCache<V> {
  private map = new Map<string, { value: V; size: number; at: number }>();
  private bytes = 0;

  constructor(
    private readonly opts: { maxEntries: number; maxBytes?: number; ttlMs: number; sizeOf?: (v: V) => number },
  ) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > this.opts.ttlMs) {
      this.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    const size = this.opts.sizeOf ? this.opts.sizeOf(value) : 0;
    if (this.opts.maxBytes !== undefined && size > this.opts.maxBytes) return;
    this.delete(key);
    this.map.set(key, { value, size, at: Date.now() });
    this.bytes += size;
    while (
      this.map.size > this.opts.maxEntries ||
      (this.opts.maxBytes !== undefined && this.bytes > this.opts.maxBytes)
    ) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.delete(oldest);
    }
  }

  delete(key: string): void {
    const hit = this.map.get(key);
    if (!hit) return;
    this.bytes -= hit.size;
    this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }

  get totalBytes(): number {
    return this.bytes;
  }
}
