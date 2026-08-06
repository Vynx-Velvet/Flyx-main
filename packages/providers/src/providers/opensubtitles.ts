/**
 * OpenSubtitles Provider
 *
 * Subtitle-only provider. Returns no stream sources — only subtitle tracks.
 * When registered, the ExtractionPipeline can invoke this alongside other
 * providers to enrich any stream with subtitle options.
 */

import type { ContentCategory, ExtractionRequest, StreamSource, SubtitleTrack } from "@flyx/core";
import { BaseProvider } from "../base";

export class OpenSubtitlesProvider extends BaseProvider {
  readonly name = "opensubtitles";
  readonly priority = 500; // Very late — subtitle enrichment, not primary source
  readonly supportedContent: ContentCategory[] = ["movie", "tv", "anime"];

  protected async doExtract(request: ExtractionRequest): Promise<{
    sources: StreamSource[];
    subtitles?: SubtitleTrack[];
  }> {
    try {
      const { extractOpenSubtitles } = await import("@flyx/extractors/services");
      const result = await extractOpenSubtitles(
        request.tmdbId,
        request.mediaType,
        request.season,
        request.episode,
      );
      return { sources: [], subtitles: result.subtitles };
    } catch {
      return { sources: [], subtitles: [] };
    }
  }
}
