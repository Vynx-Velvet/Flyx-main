/**
 * Anime Stream API Route
 * GET /api/anime/stream?malId=16498&episode=1&provider=animex
 *
 * Delegates to the unified ExtractionPipeline from @flyx/extractors.
 * Resolves anime title from Jikan when only a generic/fallback title is provided.
 *
 * Supported providers: animex
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ExtractionRequest } from '@flyx/core';
import { ExtractionPipeline } from '@flyx/extractors';
import { providerRegistry } from '@flyx/providers';
import { addLog } from '@/lib/log-store';

// Auto-register all providers
import '@flyx/providers/providers';

// Single pipeline instance (reused across requests)
const pipeline = new ExtractionPipeline(providerRegistry);

// Simple in-memory title cache (TTL ~10 min, resets on restart)
const titleCache = new Map<number, { title: string; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// In-flight request deduplication — prevents duplicate API calls from React StrictMode
const inFlight = new Map<string, Promise<{ data: any; status: number }>>();

async function resolveAnimeTitle(malId: number): Promise<string | null> {
  // Check cache
  const cached = titleCache.get(malId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.title;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://api.jikan.moe/v4/anime/${malId}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[ANIME-STREAM] Jikan title resolution HTTP ${res.status} for MAL ${malId}`);
      return null;
    }

    const data = await res.json();
    const title = data?.data?.title_english || data?.data?.title || null;

    if (title) {
      titleCache.set(malId, { title, ts: Date.now() });
      console.log(`[ANIME-STREAM] Jikan resolved MAL ${malId} → "${title}"`);
    }

    return title;
  } catch (err) {
    console.warn(`[ANIME-STREAM] Jikan title resolution failed for MAL ${malId}: ${(err as Error).message || 'timeout/network'}`);
    return null;
  }
}

function isGenericTitle(title?: string): boolean {
  if (!title) return true;
  // Match generated placeholders: "Anime 12345", "MAL ID 12345", "Loading...", etc.
  return /^(Anime|MAL ID|Title)\s+\d+$/i.test(title) || /^(Loading|Unknown|Anime Title)\.{0,3}$/i.test(title);
}

export async function GET(request: NextRequest) {
  // Build a dedup key that normalizes away `provider` and `title` —
  // the core extraction (malId + episode) is the same regardless of
  // which provider label is passed. Without this, the watch page's
  // parallel "animex" + "auto" probes race and double every API call.
  const rawParams = request.nextUrl.searchParams;
  const dedupKey = `malId=${rawParams.get('malId')}|ep=${rawParams.get('episode')}|type=${rawParams.get('type')}`;

  // Check if an identical request is already in-flight
  const existing = inFlight.get(dedupKey);
  if (existing) {
    console.log(`[ANIME-STREAM] DEDUP hit: ${dedupKey.substring(0, 80)}`);
    const { data, status } = await existing;
    return NextResponse.json(data, { status });
  }

  const startTime = Date.now();

  // Register in-flight promise so concurrent duplicates wait for this one
  let resolvePromise!: (result: { data: any; status: number }) => void;
  const promise = new Promise<{ data: any; status: number }>((resolve) => {
    resolvePromise = resolve;
  });
  inFlight.set(dedupKey, promise);

  // Helper: resolves the shared promise + returns the NextResponse
  const respond = (data: any, status: number) => {
    resolvePromise({ data, status });
    inFlight.delete(dedupKey);
    return NextResponse.json(data, { status });
  };

  // Declare variables OUTSIDE try so catch block can reference them
  let malId: number | undefined;
  let episode: number | undefined;
  let provider: string | undefined;
  let title: string | undefined;
  let isMovie = false;
  let typeParam: string | undefined;

  try {
    const searchParams = request.nextUrl.searchParams;

    malId = searchParams.get('malId')
      ? parseInt(searchParams.get('malId')!)
      : undefined;
    episode = searchParams.get('episode')
      ? parseInt(searchParams.get('episode')!)
      : undefined;
    provider = searchParams.get('provider') || undefined;
    const rawTitle = searchParams.get('title') || undefined;
    typeParam = searchParams.get('type') || undefined;

    if (!malId) {
      return respond({ error: 'MAL ID is required' }, 400);
    }

    // Resolve real title if the provided one is generic
    title = rawTitle;
    if (isGenericTitle(rawTitle)) {
      const resolved = await resolveAnimeTitle(malId);
      if (resolved) {
        title = resolved;
        console.log(`[ANIME-STREAM] Resolved title: "${rawTitle}" → "${resolved}"`);
      }
    }

    addLog({
      level: "info",
      category: "stream",
      message: `Anime stream request: MAL ${malId} EP ${episode || 'N/A'}${title ? ` "${title}"` : ''}`,
      malId,
      provider: provider || "auto",
      episode,
    });

    // Build extraction request
    isMovie = typeParam === 'movie' || typeParam === 'Movie';

    const extractionRequest: ExtractionRequest = {
      tmdbId: 0,
      mediaType: isMovie ? 'movie' : 'tv',
      malId,
      season: isMovie ? undefined : 1,
      episode: isMovie ? undefined : episode,
      title,
    };

    // Extract sources via the unified pipeline
    const result = await pipeline.extract(extractionRequest, {
      provider,
      signal: request.signal,
    });

    // Don't let failed results poison the cache
    if (!result.success || result.sources.length === 0) {
      pipeline.invalidateCache("extraction");
    }

    const executionTime = Date.now() - startTime;

    if (result.success && result.sources.length > 0) {
      addLog({
        level: "info",
        category: "stream",
        message: `Found ${result.sources.length} sources via ${result.provider} in ${executionTime}ms`,
        malId,
        provider: result.provider,
        episode,
      });

      return respond({
        success: true,
        sources: result.sources.map((s) => ({
          ...s,
          title: s.title || result.provider,
          language: s.language || undefined,
        })),
        subtitles: result.subtitles || [],
        provider: result.provider,
        providers: [result.provider],
        anime: {
          malId,
          title: title || `MAL ID ${malId}`,
          titleEnglish: title || `MAL ID ${malId}`,
          episodes: null,
          type: isMovie ? 'Movie' : 'TV',
        },
        executionTime,
      }, 200);
    }

    addLog({
      level: "error",
      category: "stream",
      message: `No sources found: ${result.error || "unknown error"}`,
      detail: `Provider: ${result.provider || provider || "auto"}, took ${executionTime}ms`,
      malId,
      provider: result.provider || provider,
      episode,
    });

    return respond(
      {
        error: result.error || 'No sources found',
        success: false,
        provider: result.provider || provider,
      },
      404,
    );
  } catch (error) {
    const err = error as Error & { code?: string; statusCode?: number; attempts?: Array<{provider: string; error: string}> };
    const errorName = err.name || "Error";
    const errorCode = (err as any).code || "UNKNOWN";

    addLog({
      level: "error",
      category: "stream",
      message: `Anime stream failed [${errorName}]: ${err.message || "unknown"}`,
      detail: `Code: ${errorCode}, Status: ${(err as any).statusCode || "N/A"}${err.attempts ? `, Attempts: ${err.attempts.map((a: any) => `${a.provider}(${a.error})`).join(", ")}` : ""}`,
      malId,
      provider: provider || "auto",
      episode,
    });

    // Known Flyx errors — use their built-in response format
    if (typeof (err as any).toJSON === "function") {
      const json = (err as any).toJSON();
      return respond(json, json.statusCode || 502);
    }

    return respond(
      { error: `Failed to fetch anime stream: ${err.message}`, success: false },
      500,
    );
  }
}
