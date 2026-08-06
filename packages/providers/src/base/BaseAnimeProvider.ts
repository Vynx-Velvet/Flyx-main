/**
 * Specialised base class for anime providers.
 *
 * Extends {@link BaseProvider} with anime-specific behaviour:
 * - Auto-detects anime content via `metadata.isAnime` flag
 * - Supports MAL ID for provider-specific lookups
 * - Handles absolute episode numbering
 */

import type { ContentCategory, ExtractionRequest, StreamSource } from "@flyx/core";
import { BaseProvider } from "./BaseProvider";

export abstract class BaseAnimeProvider extends BaseProvider {
  readonly supportedContent: ContentCategory[] = ["anime"];

  /**
   * Anime providers check for `isAnime` flag in metadata.
   */
  supportsContent(
    _mediaType: string,
    metadata?: { isAnime?: boolean },
  ): boolean {
    return metadata?.isAnime === true;
  }

  /**
   * Resolve absolute episode number for anime with non-standard numbering.
   *
   * Some anime (e.g., Attack on Titan) have split seasons where
   * the absolute episode number differs from season+episode.
   * Override this to map TMDB season/episode to the provider's
   * episode numbering.
   *
   * @param request - The extraction request.
   * @returns The absolute episode number, or undefined if not applicable.
   */
  protected resolveAbsoluteEpisode(
    _request: ExtractionRequest,
  ): number | undefined {
    return undefined;
  }

  /**
   * Normalise anime sources, preserving skip intro/outro metadata
   * which is more common in anime streams.
   */
  protected normalizeSource(raw: Record<string, unknown>): StreamSource {
    const source = super.normalizeSource(raw);

    // Anime providers often provide skip timestamps
    if (raw.skipIntro && !source.skipIntro) {
      source.skipIntro = raw.skipIntro as StreamSource["skipIntro"];
    }
    if (raw.skipOutro && !source.skipOutro) {
      source.skipOutro = raw.skipOutro as StreamSource["skipOutro"];
    }

    return source;
  }
}
