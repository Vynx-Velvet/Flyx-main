/**
 * Unified extraction pipeline — the SINGLE path for stream extraction.
 *
 * In Flyx 2.0, provider fetch logic was duplicated across 5 places:
 * - VideoPlayer.fetchSources() (lines 649-846)
 * - VideoPlayer.fetchFromProvider() (lines 850-971)
 * - VideoPlayer.initializePlayer() (lines 1028-1344)
 * - VideoPlayerWrapper.fetchSources() (lines 97-352)
 * - API route extractWithFallback() + directExtract() switch (lines 711-803)
 *
 * Each had different timeout handling, provider ordering, error recovery,
 * and source normalisation. This class replaces ALL of them with a single,
 * tested, documented implementation.
 */

import type { ExtractionRequest, ExtractionResult, StreamSource } from "@flyx/core";
import { AllProvidersFailedError, ExtractionAbortedError } from "@flyx/core";
import { UnifiedCache } from "@flyx/core";

/** Minimal provider contract needed by the pipeline (avoids circular dep on @flyx/providers). */
interface PipelineProvider {
  readonly name: string;
  readonly priority: number;
  readonly enabled: boolean;
  extract(request: ExtractionRequest): Promise<ExtractionResult>;
  supportsContent(mediaType: string, metadata?: { isAnime?: boolean }): boolean;
}

/** Minimal registry contract needed by the pipeline. */
interface PipelineRegistry {
  get(name: string): PipelineProvider | undefined;
  getForContent(mediaType: string, metadata?: { isAnime?: boolean }): PipelineProvider[];
}

/** Extraction options for fine-grained control. */
export interface ExtractionOptions {
  /** Force a specific provider (bypasses priority-based fallback). */
  provider?: string;
  /** Look for a specific source name within the provider's results. */
  sourceName?: string;
  /** AbortSignal for cancellation (e.g. user navigates away). */
  signal?: AbortSignal;
  /** Whether to cache results (default: true). */
  cache?: boolean;
  /** Cache TTL override in ms. */
  cacheTtl?: number;
}

/**
 * Unified extraction pipeline.
 *
 * @example
 * ```ts
 * const pipeline = new ExtractionPipeline(registry);
 *
 * // Auto-select best provider via priority fallback
 * const result = await pipeline.extract({ tmdbId: 123, mediaType: "movie" });
 *
 * // Force a specific provider
 * const result = await pipeline.extract(
 *   { tmdbId: 123, mediaType: "movie" },
 *   { provider: "vidsrc" }
 * );
 *
 * // With cancellation
 * const controller = new AbortController();
 * const result = await pipeline.extract(
 *   { tmdbId: 123, mediaType: "movie" },
 *   { signal: controller.signal }
 * );
 * ```
 */
export class ExtractionPipeline {
  private readonly cache: UnifiedCache;

  constructor(
    private readonly registry: PipelineRegistry,
    cache?: UnifiedCache,
  ) {
    this.cache = cache ?? new UnifiedCache();
  }

  /**
   * Extract stream sources for a given request.
   *
   * **Auto mode** (no `options.provider`):
   * Iterates providers in priority order with automatic fallback.
   * The first provider that returns valid sources wins.
   *
   * **Direct mode** (`options.provider` specified):
   * Calls only the named provider.
   *
   * @param request - What to extract (TMDB ID, media type, season/episode).
   * @param options - Optional extraction control.
   * @returns The extraction result with sources and subtitles.
   * @throws {AllProvidersFailedError} If all providers fail.
   * @throws {ExtractionAbortedError} If extraction is cancelled.
   */
  async extract(
    request: ExtractionRequest,
    options: ExtractionOptions = {},
  ): Promise<ExtractionResult> {
    // Direct provider mode
    if (options.provider) {
      return this.extractFromProvider(request, options.provider, options);
    }

    // Auto mode: try providers in priority order
    const providers = this.registry.getForContent(request.mediaType, {
      isAnime: !!request.malId,
    });

    if (providers.length === 0) {
      throw new AllProvidersFailedError([]);
    }

    const errors: { provider: string; error: string }[] = [];
    const allSources: StreamSource[] = [];
    const seenUrls = new Set<string>();
    const seenProviders = new Set<string>();
    let firstResult: ExtractionResult | null = null;
    const MAX_PROVIDERS = 3;

    for (const provider of providers) {
      if (options.signal?.aborted) {
        throw new ExtractionAbortedError();
      }

      try {
        const cacheKey = this.requestCacheKey(provider.name, request);

        const result = options.cache !== false
          ? await this.cache.get<ExtractionResult>(
              cacheKey,
              () => provider.extract(request),
              {
                ttl: options.cacheTtl ?? 15 * 60 * 1000,
                staleWhileRevalidate: 5 * 60 * 1000,
                namespace: "extraction",
              },
            )
          : await provider.extract(request);

        if (result && result.success && result.sources.length > 0) {
          // Source name filter
          if (options.sourceName) {
            const match = this.findSourceByName(result.sources, options.sourceName);
            if (match) {
              return { ...result, sources: [match] };
            }
            errors.push({
              provider: provider.name,
              error: `Source "${options.sourceName}" not found`,
            });
            continue;
          }
          // Collect sources from this provider, dedup by URL
          if (!firstResult) firstResult = result;
          seenProviders.add(provider.name);
          for (const s of result.sources) {
            if (!seenUrls.has(s.url)) {
              seenUrls.add(s.url);
              allSources.push(s);
            }
          }
          // Stop after enough sources or enough providers
          if (allSources.length >= 10 || seenProviders.size >= MAX_PROVIDERS) {
            return { ...firstResult, sources: allSources };
          }
        } else {
          errors.push({
            provider: provider.name,
            error: result?.error ?? "No sources returned",
          });
        }
      } catch (err) {
        errors.push({
          provider: provider.name,
          error: (err as Error).message ?? "Unknown error",
        });
      }
    }

    if (allSources.length > 0) {
      return { ...firstResult!, sources: allSources };
    }

    throw new AllProvidersFailedError(errors);
  }

  /**
   * Invalidate the extraction cache for a specific key or namespace.
   */
  invalidateCache(namespace?: string): void {
    this.cache.invalidate(namespace ?? "extraction");
  }

  /** Extract from a single named provider. */
  private async extractFromProvider(
    request: ExtractionRequest,
    providerName: string,
    options: ExtractionOptions,
  ): Promise<ExtractionResult> {
    const provider = this.registry.get(providerName);
    if (!provider) {
      throw new AllProvidersFailedError([
        { provider: providerName, error: "Provider not found" },
      ]);
    }

    const result = await provider.extract(request);

    if (options.sourceName && result.success) {
      const match = this.findSourceByName(result.sources, options.sourceName);
      if (match) {
        return { ...result, sources: [match] };
      }
    }

    return result;
  }

  /** Build a cache key from request parameters. */
  private requestCacheKey(provider: string, request: ExtractionRequest): string {
    return `${provider}:${request.tmdbId}:${request.mediaType}:${request.season ?? 0}:${request.episode ?? 0}:${request.malId ?? 0}`;
  }

  /** Find a source by name (case-insensitive partial match). */
  private findSourceByName(sources: StreamSource[], name: string): StreamSource | null {
    const lowerName = name.toLowerCase();
    return sources.find((s) => s.title?.toLowerCase().includes(lowerName)) ?? null;
  }
}
