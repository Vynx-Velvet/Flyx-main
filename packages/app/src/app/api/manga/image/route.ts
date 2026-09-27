/**
 * Manga image proxy — fetches page/cover images server-side.
 *
 * GET /api/manga/image?url=...&referer=...
 *
 * The planeptune.us CDN serves images without requiring a Referer header,
 * but we still proxy through the server for consistency and caching.
 *
 * Security: session-or-signature auth (<img> tags are same-origin and send
 * the session cookie); the host allowlist is enforced on every redirect hop
 * via safeFetch; output is always an image/* type (else octet-stream).
 */

import { NextRequest, NextResponse } from "next/server";
import { isProxyRequestAuthorized } from "@/lib/security/proxy-sign";
import { BlockedUrlError, BodyTooLargeError, readBodyLimited, safeFetch } from "@/lib/security/safe-fetch";
import { PROXY_SECURITY_HEADERS, proxyJsonError, proxyUnauthorized } from "@/lib/media-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = [
  // WeebCentral CDN hosts (planeptune, lastation, lowee — all known subdomains)
  "planeptune.us",        // hot, scans-hot, etc.
  "lastation.us",         // scans.lastation.us
  "lowee.us",             // official.lowee.us
  // WeebCentral main site + CDN
  "weebcentral.com",
  "cdn.weebcentral.com",
  // Cover images
  "temp.compsci88.com",
  // AnimeX poster CDN — ContentCard routes these through here
  "ytimgf.youtube-anime.com",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase();
  return ALLOWED_HOSTS.some((a) => h === a || h.endsWith("." + a));
}

/** Raster image types only — SVG can carry script. */
function safeImageType(upstream: string | null): string {
  const essence = (upstream || "").split(";")[0]!.trim().toLowerCase();
  return /^image\/(?:jpeg|jpg|pjpeg|png|gif|webp|avif|bmp|apng|heic|heif)$/.test(essence)
    ? essence
    : "application/octet-stream";
}

export async function GET(request: NextRequest) {
  if (!(await isProxyRequestAuthorized(request))) return proxyUnauthorized();

  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const referer = searchParams.get("referer") || "";

  if (!url) {
    return proxyJsonError({ error: "Missing url parameter" }, 400);
  }

  // Validate host
  let validHost = false;
  try {
    validHost = isAllowedHost(new URL(url).hostname);
  } catch {
    return proxyJsonError({ error: "Invalid URL" }, 400);
  }
  if (!validHost) {
    return proxyJsonError({ error: "Invalid image source" }, 403);
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": UA,
      Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
    };
    if (referer) {
      headers.Referer = referer;
    }

    // Redirects are followed by safeFetch, re-checking the allowlist (and
    // public-address rule) on every hop.
    const res = await safeFetch(
      url,
      { headers, signal: AbortSignal.timeout(20_000) },
      {
        checkUrl: (u) => {
          if (!isAllowedHost(u.hostname)) throw new BlockedUrlError("Image host not allowed");
        },
      },
    );

    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return proxyJsonError({ error: `Upstream returned ${res.status}` }, 502);
    }

    const contentType = safeImageType(res.headers.get("content-type") || "image/jpeg");
    const body = await readBodyLimited(res, MAX_IMAGE_BYTES);

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        ...PROXY_SECURITY_HEADERS,
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400, immutable",
      },
    });
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      return proxyJsonError({ error: "Invalid image source" }, 403);
    }
    if (err instanceof BodyTooLargeError) {
      return proxyJsonError({ error: "Image too large" }, 502);
    }
    console.warn(`[manga/image] Failed: ${(err as Error).message}`);
    return proxyJsonError({ error: "Failed to fetch image" }, 502);
  }
}
