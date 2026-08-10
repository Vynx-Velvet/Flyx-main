import type { ExtractionRequest } from "@flyx/core";
import { ExtractionPipeline } from "@flyx/extractors";
import { providerRegistry } from "@flyx/providers";
import "@flyx/providers/providers";

import { handleProxyRequest } from "./proxy";
import { buildStreamResponse, isStremioContentType, MANIFEST, parseStremioId } from "./stremio";
import { findTmdbId, TmdbLookupError } from "./tmdb";
import type { Env, StremioStreamResponse } from "./types";

const pipeline = new ExtractionPipeline(providerRegistry);
const EMPTY_STREAMS: StremioStreamResponse = { streams: [] };
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
};

function json(
  value: unknown,
  init: { status?: number; cacheControl?: string; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": init.cacheControl ?? "no-store",
      ...CORS_HEADERS,
      ...init.headers,
    },
  });
}

function splitPath(pathname: string): string[] | null {
  try {
    return pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
  } catch {
    return null;
  }
}

function tokensEqual(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) {
    difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}

async function handleStream(
  request: Request,
  env: Env,
  type: string,
  rawId: string,
  proxyEndpoint: string,
): Promise<Response> {
  if (!isStremioContentType(type))
    return json(EMPTY_STREAMS, { cacheControl: "private, max-age=3600" });
  const parsed = parseStremioId(type, rawId);
  if (!parsed) return json(EMPTY_STREAMS, { cacheControl: "private, max-age=3600" });
  if (!env.TMDB_API_KEY) {
    return json({ error: "TMDB_API_KEY is not configured", streams: [] }, { status: 503 });
  }

  try {
    const tmdbId = await findTmdbId(parsed, env.TMDB_API_KEY);
    if (tmdbId === null) {
      return json(EMPTY_STREAMS, { cacheControl: "private, max-age=3600" });
    }

    const extractionRequest: ExtractionRequest = {
      tmdbId,
      mediaType: parsed.mediaType,
      season: parsed.season,
      episode: parsed.episode,
    };
    const result = await pipeline.extract(extractionRequest, {
      signal: request.signal,
      cache: true,
    });

    return json(buildStreamResponse(result.sources, result.provider, proxyEndpoint), {
      cacheControl: "private, max-age=300, stale-while-revalidate=300",
    });
  } catch (error) {
    if (error instanceof TmdbLookupError && (error.status === 401 || error.status === 403)) {
      return json({ error: "TMDB rejected the configured API key", streams: [] }, { status: 503 });
    }
    console.warn(
      `[stremio-addon] No streams for ${type}/${rawId}`,
      error instanceof Error ? error.message : error,
    );
    return json(EMPTY_STREAMS, {
      cacheControl: "private, max-age=30",
      headers: { "X-Flyx-Status": "no-sources" },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = splitPath(url.pathname);
    if (!parts) return json({ error: "Not found" }, { status: 404 });

    if (!env.ADDON_TOKEN || env.ADDON_TOKEN.length < 32) {
      return json({ error: "ADDON_TOKEN must contain at least 32 characters" }, { status: 503 });
    }

    const suppliedToken = parts.shift();
    if (!suppliedToken || !tokensEqual(suppliedToken, env.ADDON_TOKEN)) {
      return json({ error: "Not found" }, { status: 404 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    if (parts.length === 1 && parts[0] === "manifest.json") {
      return json(MANIFEST, { cacheControl: "private, max-age=3600" });
    }

    if (parts.length === 1 && parts[0] === "health") {
      return json({
        ok: true,
        addon: MANIFEST.name,
        version: MANIFEST.version,
        tmdbConfigured: Boolean(env.TMDB_API_KEY),
        providers: providerRegistry.names,
      });
    }

    if (parts.length === 1 && parts[0] === "proxy") {
      return handleProxyRequest(request);
    }

    if (parts.length === 3 && parts[0] === "stream" && parts[2]!.endsWith(".json")) {
      const proxyEndpoint = `${url.origin}/${encodeURIComponent(env.ADDON_TOKEN)}/proxy`;
      const rawId = parts[2]!.slice(0, -".json".length);
      return handleStream(request, env, parts[1]!, rawId, proxyEndpoint);
    }

    return json({ error: "Not found" }, { status: 404 });
  },
};
