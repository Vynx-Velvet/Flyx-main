/**
 * Abstract base class for all content providers.
 *
 * **This is the heart of the Flyx 3.0 provider refactor.**
 *
 * In Flyx 2.0, every provider copy-pasted the same 40+ lines of
 * boilerplate: `getConfig()`, `extract()` try/catch, `fetchSourceByName()`,
 * `normalizeSource()`, `normalizeSubtitle()`. Only the actual extraction
 * logic (`doExtract()`) differed.
 *
 * Now subclasses only implement:
 * - `name` — unique provider identifier
 * - `supportedContent` — what content categories this provider handles
 * - `doExtract()` — the actual extraction logic (~5-15 lines)
 *
 * Everything else is inherited for free.
 */

import type {
  ContentCategory,
  ExtractionRequest,
  ExtractionResult,
  MediaType,
  StreamSource,
  SubtitleTrack,
  ProviderConfig,
} from "@flyx/core";

import { FlyxError } from "@flyx/core";

/**
 * Abstract base provider implementing the template method pattern.
 *
 * @example
 * ```ts
 * class FlixerProvider extends BaseProvider {
 *   readonly name = "flixer";
 *   readonly supportedContent: ContentCategory[] = ["movie", "tv"];
 *   readonly priority = PROVIDER_PRIORITIES.FLIXER;
 *
 *   protected async doExtract(request: ExtractionRequest) {
 *     const result = await extractFlixerStreams(
 *       request.tmdbId, request.mediaType,
 *       request.season, request.episode,
 *     );
 *     return { sources: result.sources, subtitles: result.subtitles };
 *   }
 * }
 * ```
 */
export abstract class BaseProvider {
  /** Unique provider identifier (e.g., "flixer", "videasy"). */
  abstract readonly name: string;

  /** Content categories this provider handles. */
  abstract readonly supportedContent: ContentCategory[];

  /** Priority — lower is tried first. Use PROVIDER_PRIORITIES constants. */
  abstract readonly priority: number;

  /** Whether this provider is enabled. Defaults to `true`. */
  readonly enabled: boolean = true;

  // ──── Public API ────

  /**
   * Extract stream sources for a given request.
   *
   * This is a **template method**: it handles timing, error wrapping,
   * source normalisation, and subtitle normalisation automatically.
   * Subclasses implement {@link doExtract} for the actual extraction logic.
   *
   * @param request - What to extract (TMDB ID, media type, season/episode).
   * @returns The extraction result with normalised sources and subtitles.
   */
  async extract(request: ExtractionRequest): Promise<ExtractionResult> {
    const start = Date.now();

    try {
      const result = await this.doExtract(request);

      return {
        success: result.sources.length > 0,
        sources: result.sources.map((s) => this.normalizeSource(s)),
        subtitles: (result.subtitles ?? []).map((s) => this.normalizeSubtitle(s)),
        provider: this.name,
        timing: Date.now() - start,
        ...(result.hexData ? { hexData: result.hexData, needsClientDecrypt: true } : {}),
      };
    } catch (err) {
      const message =
        err instanceof FlyxError ? err.message : (err as Error)?.message ?? "Unknown error";

      return {
        success: false,
        sources: [],
        subtitles: [],
        provider: this.name,
        error: message,
        timing: Date.now() - start,
      };
    }
  }

  /**
   * Fetch a specific source by name from this provider.
   *
   * Default implementation extracts all sources and filters by name.
   * Override for providers that support direct source lookup.
   *
   * @param sourceName - The source name/title to find.
   * @param request - Extraction parameters.
   * @returns The matching source, or `null` if not found.
   */
  async fetchSourceByName(
    sourceName: string,
    request: ExtractionRequest,
  ): Promise<StreamSource | null> {
    const result = await this.extract(request);
    if (!result.success || result.sources.length === 0) return null;

    const lowerName = sourceName.toLowerCase();
    return (
      result.sources.find((s) => s.title?.toLowerCase().includes(lowerName)) ?? null
    );
  }

  /**
   * Check if this provider supports a given content type.
   *
   * Default implementation checks `supportedContent` against the
   * media type and optional metadata flags.
   *
   * @param mediaType - "movie" or "tv".
   * @param metadata - Optional flags for anime/live content.
   * @returns `true` if this provider can handle this content.
   */
  supportsContent(
    mediaType: MediaType,
    metadata?: { isAnime?: boolean; isLive?: boolean; category?: ContentCategory },
  ): boolean {
    // Anime content: ONLY anime providers match (VOD providers must NOT match)
    if (metadata?.isAnime) {
      return this.supportedContent.includes("anime");
    }
    // Live TV content: ONLY live TV providers match
    if (metadata?.isLive) {
      return this.supportedContent.includes("live-tv") ||
        (!!metadata?.category && this.supportedContent.includes(metadata.category));
    }
    // Category-based match (for ppv, live-sports, iptv)
    if (metadata?.category && this.supportedContent.includes(metadata.category)) {
      return true;
    }
    // Direct media type match (movie → "movie", tv → "tv")
    if (this.supportedContent.includes(mediaType)) {
      return true;
    }
    return false;
  }

  /**
   * Get the serialisable configuration for this provider.
   *
   * Used by the settings UI and `/api/providers` endpoint.
   */
  getConfig(): ProviderConfig {
    return {
      name: this.name,
      priority: this.priority,
      enabled: this.enabled,
      supportedContent: [...this.supportedContent],
    };
  }

  // ──── Subclass Contract ────

  /**
   * Perform the actual extraction.
   *
   * **This is the only method subclasses must implement.**
   *
   * @param request - What to extract.
   * @returns Raw sources and subtitles (will be normalised by `extract()`).
   */
  protected abstract doExtract(request: ExtractionRequest): Promise<{
    sources: StreamSource[];
    subtitles?: SubtitleTrack[];
    hexData?: string;
  }>;

  // ──── Normalisation Helpers ────

  /**
   * Normalise a raw source object into the standard StreamSource shape.
   *
   * Handles inconsistent field names from different upstream APIs.
   * Override in a subclass if the provider has unusual source shapes.
   */
  protected normalizeSource(raw: StreamSource | Record<string, unknown>): StreamSource {
    // If already a well-formed StreamSource with a url, return as-is
    if (typeof raw.url === "string" && raw.url.length > 0) {
      return raw as StreamSource;
    }
    const r = raw as Record<string, unknown>;
    return {
      url: String(r.url ?? ""),
      quality: String(r.quality ?? r.label ?? "Auto"),
      type: ((r.type as StreamSource["type"]) ?? "hls"),
      title: r.title != null ? String(r.title) : undefined,
      language: r.language != null ? String(r.language) : undefined,
      requiresSegmentProxy: r.requiresSegmentProxy != null ? Boolean(r.requiresSegmentProxy) : undefined,
      referer: r.referer != null ? String(r.referer) : undefined,
      origin: r.origin != null ? String(r.origin) : undefined,
      isHevc: r.isHevc != null ? Boolean(r.isHevc) : undefined,
      skipIntro: r.skipIntro != null ? (r.skipIntro as StreamSource["skipIntro"]) : undefined,
      skipOutro: r.skipOutro != null ? (r.skipOutro as StreamSource["skipOutro"]) : undefined,
    };
  }

  /**
   * Normalise a raw subtitle object into the standard SubtitleTrack shape.
   */
  protected normalizeSubtitle(raw: SubtitleTrack | Record<string, unknown>): SubtitleTrack {
    // If already a well-formed SubtitleTrack with a url, return as-is
    if (typeof (raw as SubtitleTrack).url === "string" && (raw as SubtitleTrack).url.length > 0) {
      return raw as SubtitleTrack;
    }
    const r = raw as Record<string, unknown>;
    return {
      label: String(r.label ?? r.name ?? "Unknown"),
      url: String(r.url ?? r.file ?? ""),
      language: String(r.language ?? r.lang ?? "unknown"),
      isCC: r.isCC != null ? Boolean(r.isCC) : undefined,
    };
  }
}
