/**
 * GET /api/stream/extract
 *
 * Unified stream extraction endpoint using the ExtractionPipeline.
 * Replaces the fragmented extraction logic from Flyx 2.0.
 *
 * Query params:
 *   tmdbId    - TMDB ID (required)
 *   mediaType - "movie" or "tv" (required)
 *   season    - Season number (TV only)
 *   episode   - Episode number (TV only)
 *   malId     - MyAnimeList ID (anime only)
 *   provider  - Force a specific provider (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import type { ExtractionRequest, MediaType } from "@flyx/core";
import { AllProvidersFailedError, ExtractionAbortedError, MissingParameterError, InvalidMediaTypeError } from "@flyx/core";
import { ExtractionPipeline } from "@flyx/extractors";
import { providerRegistry } from "@flyx/providers";

// Auto-register all providers
import "@flyx/providers/providers";

// Single pipeline instance (reused across requests)
const pipeline = new ExtractionPipeline(providerRegistry);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    // Validate required params
    const tmdbIdStr = searchParams.get("tmdbId");
    const mediaType = searchParams.get("mediaType") as MediaType | null;

    if (!tmdbIdStr) throw new MissingParameterError("tmdbId");
    if (!mediaType) throw new MissingParameterError("mediaType");
    if (!["movie", "tv"].includes(mediaType)) throw new InvalidMediaTypeError(mediaType);

    const tmdbId = parseInt(tmdbIdStr, 10);
    if (isNaN(tmdbId)) throw new MissingParameterError("tmdbId");

    // Build extraction request (malId triggers anime provider routing)
    const hasMalId = searchParams.get("malId");
    const extractionRequest: ExtractionRequest = {
      tmdbId,
      mediaType,
      season: searchParams.get("season") ? parseInt(searchParams.get("season")!, 10) : undefined,
      episode: searchParams.get("episode") ? parseInt(searchParams.get("episode")!, 10) : undefined,
      malId: hasMalId ? parseInt(hasMalId, 10) : undefined,
      title: searchParams.get("title") ?? undefined,
      malTitle: searchParams.get("malTitle") ?? undefined,
    };

    // Extract sources via the unified pipeline
    const result = await pipeline.extract(extractionRequest, {
      provider: searchParams.get("provider") ?? undefined,
      signal: request.signal,
    });

    return NextResponse.json({
      ...result,
      success: true,
    });
  } catch (err) {
    // Handle known errors with proper status codes
    if (err instanceof AllProvidersFailedError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }
    if (err instanceof ExtractionAbortedError) {
      return NextResponse.json(err.toJSON(), { status: 499 });
    }
    if (err instanceof MissingParameterError || err instanceof InvalidMediaTypeError) {
      return NextResponse.json(err.toJSON(), { status: err.statusCode });
    }

    // Unknown errors
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { success: false, code: "INTERNAL_ERROR", message, statusCode: 500, retryable: true },
      { status: 500 },
    );
  }
}
