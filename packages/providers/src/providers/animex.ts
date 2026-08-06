/**
 * AnimeXProvider — anime content provider.
 *
 * Uses animex.one for metadata and cx.aniwatchtv.site for streaming.
 * No auth, no crypto, no special headers — pure fetch.
 */

import type { ExtractionRequest, StreamSource, SubtitleTrack } from "@flyx/core";
import { PROVIDER_PRIORITIES } from "@flyx/config";
import { extractAnimeX } from "@flyx/extractors/services";
import { BaseAnimeProvider } from "../base";

export class AnimeXProvider extends BaseAnimeProvider {
  readonly name = "animex";
  readonly priority = PROVIDER_PRIORITIES.ANIMEX;

  protected async doExtract(request: ExtractionRequest): Promise<{
    sources: StreamSource[];
    subtitles?: SubtitleTrack[];
  }> {
    const result = await extractAnimeX(
      request.tmdbId,
      request.malId,
      request.season,
      request.episode,
      request.title || request.malTitle,
    );
    return { sources: result.sources ?? [], subtitles: result.subtitles ?? [] };
  }
}
