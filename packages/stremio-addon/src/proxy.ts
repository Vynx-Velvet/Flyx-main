import type { StreamSource } from "@flyx/core";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export interface ProxyTargetOptions {
  referer?: string;
  origin?: string;
  userAgent?: string;
  tokenUrl?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
};

/** Build a protected proxy URL without putting any provider credentials in code. */
export function buildProxyUrl(
  endpoint: string,
  upstreamUrl: string,
  options: ProxyTargetOptions = {},
): string {
  const proxyUrl = new URL(endpoint);
  proxyUrl.searchParams.set("url", upstreamUrl);
  if (options.referer) proxyUrl.searchParams.set("referer", options.referer);
  if (options.origin) proxyUrl.searchParams.set("origin", options.origin);
  if (options.userAgent) proxyUrl.searchParams.set("userAgent", options.userAgent);
  if (options.tokenUrl) proxyUrl.searchParams.set("tokenUrl", options.tokenUrl);
  return proxyUrl.toString();
}

export function proxyOptionsFromSource(source: StreamSource): ProxyTargetOptions {
  return {
    referer: source.referer,
    origin: source.origin,
    userAgent: source.userAgent,
    tokenUrl: source.tokenUrl,
  };
}

/** Reject local/private network targets so this can never become an SSRF tunnel. */
export function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;

    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
      return false;
    }
    if (host === "0.0.0.0" || host === "::" || host === "::1") return false;
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false;
    if (/^169\.254\./.test(host) || /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) {
      return false;
    }
    const private172 = host.match(/^172\.(\d{1,3})\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
    if (/^(?:fc|fd|fe8|fe9|fea|feb)[0-9a-f:]*$/i.test(host)) return false;
    if (/^\d+$/.test(host)) return false;

    return true;
  } catch {
    return false;
  }
}

function isVidSrcCdn(url: URL): boolean {
  return /\/pl\/[A-Za-z0-9+/=._-]{40,}\//.test(url.pathname);
}

function cleanHeader(value: string | null): string | undefined {
  if (!value || value.length > 1024 || /[\r\n]/.test(value)) return undefined;
  return value;
}

function parseToken(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return trimmed;
  try {
    const value = JSON.parse(trimmed) as unknown;
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      for (const key of ["token", "data", "string", "result"]) {
        if (typeof record[key] === "string") return record[key];
      }
    }
  } catch {
    return "";
  }
  return "";
}

function tokenTtl(token: string): number {
  const fallback = 55 * 60 * 1000;
  if (!token.startsWith("eyJ")) return fallback;
  try {
    const part = token.split(".")[1];
    if (!part) return fallback;
    const normalized = part
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(part.length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalized)) as { exp?: number };
    if (!payload.exp) return fallback;
    return Math.max(30_000, Math.min(fallback, payload.exp * 1000 - Date.now() - 30_000));
  } catch {
    return fallback;
  }
}

async function getVidSrcToken(
  streamOrigin: string,
  explicitTokenUrl: string | undefined,
  options: ProxyTargetOptions,
): Promise<string> {
  const cacheKey = `${streamOrigin}|${explicitTokenUrl ?? ""}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const endpoints = new Set<string>();
  if (explicitTokenUrl && isPublicHttpUrl(explicitTokenUrl)) endpoints.add(explicitTokenUrl);
  endpoints.add(`${streamOrigin}/generate.php`);

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);
    try {
      const response = await fetch(endpoint, {
        headers: {
          "User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
          Referer: options.referer ?? "https://cloudorchestranova.com/",
          Origin: options.origin ?? "https://cloudorchestranova.com",
        },
        signal: controller.signal,
      });
      if (!response.ok) continue;

      const token = parseToken(await response.text());
      if (!token) continue;
      tokenCache.set(cacheKey, { token, expiresAt: Date.now() + tokenTtl(token) });
      return token;
    } catch {
      // Try the next known token endpoint.
    } finally {
      clearTimeout(timeout);
    }
  }

  return "";
}

export function rewriteHlsPlaylist(
  playlist: string,
  playlistUrl: string,
  proxyEndpoint: string,
  options: ProxyTargetOptions,
): string {
  const proxied = (value: string) => {
    const absolute = new URL(value, playlistUrl).toString();
    return buildProxyUrl(proxyEndpoint, absolute, options);
  };

  return playlist
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${proxied(uri)}"`);
      }
      return proxied(trimmed);
    })
    .join("\n");
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

/** Proxy HLS playlists, segments, and MP4 byte ranges with provider headers. */
export async function handleProxyRequest(request: Request): Promise<Response> {
  const requestUrl = new URL(request.url);
  const targetValue = requestUrl.searchParams.get("url");
  if (!targetValue || !isPublicHttpUrl(targetValue)) {
    return jsonError("Invalid upstream URL", 400);
  }

  const options: ProxyTargetOptions = {
    referer: cleanHeader(requestUrl.searchParams.get("referer")),
    origin: cleanHeader(requestUrl.searchParams.get("origin")),
    userAgent: cleanHeader(requestUrl.searchParams.get("userAgent")),
    tokenUrl: cleanHeader(requestUrl.searchParams.get("tokenUrl")),
  };

  try {
    const target = new URL(targetValue);
    if (isVidSrcCdn(target)) {
      const token = await getVidSrcToken(target.origin, options.tokenUrl, options);
      if (token && !target.searchParams.has("token")) target.searchParams.set("token", token);
    }

    const upstreamHeaders = new Headers({
      Accept: "*/*",
      "User-Agent": options.userAgent ?? DEFAULT_USER_AGENT,
    });
    if (options.referer) upstreamHeaders.set("Referer", options.referer);
    if (options.origin) upstreamHeaders.set("Origin", options.origin);
    const range = request.headers.get("Range");
    if (range) upstreamHeaders.set("Range", range);

    const upstream = await fetch(target, {
      headers: upstreamHeaders,
      redirect: "follow",
    });
    if (!upstream.ok)
      return jsonError(`Upstream returned HTTP ${upstream.status}`, upstream.status);

    const contentType = upstream.headers.get("Content-Type") ?? "";
    const isHls =
      target.pathname.toLowerCase().includes(".m3u8") ||
      contentType.toLowerCase().includes("mpegurl") ||
      contentType.toLowerCase().includes("vnd.apple");

    if (isHls) {
      const playlist = await upstream.text();
      const rewritten = rewriteHlsPlaylist(
        playlist,
        upstream.url || target.toString(),
        `${requestUrl.origin}${requestUrl.pathname}`,
        options,
      );
      return new Response(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-store",
          ...CORS_HEADERS,
        },
      });
    }

    const headers = new Headers({
      "Content-Type": contentType || "application/octet-stream",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    });
    for (const name of [
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "ETag",
      "Last-Modified",
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.warn(
      "[stremio-proxy] Upstream request failed",
      error instanceof Error ? error.message : error,
    );
    return jsonError("Upstream request failed", 502);
  }
}
