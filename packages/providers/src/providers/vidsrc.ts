/**
 * VidSrcProvider — movie/tv content provider.
 *
 * Auto-generated from tools/scripts/generate-providers.ts
 */

import type { ContentCategory, ExtractionRequest, StreamSource, SubtitleTrack } from "@flyx/core";
import { PROVIDER_PRIORITIES } from "@flyx/config";
import { extractVidSrc } from "@flyx/extractors/services";
import { BaseProvider } from "../base";

export class VidSrcProvider extends BaseProvider {
  readonly name = "vidsrc";
  readonly priority = PROVIDER_PRIORITIES.VIDSRC;
  readonly supportedContent: ContentCategory[] = ["movie","tv"];

  protected async doExtract(request: ExtractionRequest): Promise<{
    sources: StreamSource[];
    subtitles?: SubtitleTrack[];
  }> {
    const result = await extractVidSrc(request.tmdbId, request.mediaType, request.season, request.episode);
    return { sources: result.sources ?? [], subtitles: result.subtitles ?? [] };
  }
}
