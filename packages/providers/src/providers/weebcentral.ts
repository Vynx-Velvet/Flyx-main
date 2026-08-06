/**
 * WeebCentralProvider — manga content provider.
 *
 * Manga metadata from weebcentral.com.
 * Page images from hot.planeptune.us CDN — no auth, no referrer needed.
 */

import type { ContentCategory, ExtractionRequest, StreamSource, SubtitleTrack } from "@flyx/core";
import { PROVIDER_PRIORITIES } from "@flyx/config";
import { BaseProvider } from "../base";

export class WeebCentralProvider extends BaseProvider {
  readonly name = "weebcentral";
  readonly priority = PROVIDER_PRIORITIES.WEEBCENTRAL;
  readonly supportedContent: ContentCategory[] = ["manga"];

  /**
   * Manga providers handle manga content exclusively.
   */
  supportsContent(
    _mediaType: string,
    metadata?: { isAnime?: boolean; isLive?: boolean; category?: string },
  ): boolean {
    return metadata?.category === "manga";
  }

  protected async doExtract(_request: ExtractionRequest): Promise<{
    sources: StreamSource[];
    subtitles?: SubtitleTrack[];
  }> {
    // Manga is page-by-page image content, not streamable video.
    // The manga reading path uses the weebcentral extractor directly
    // via API routes rather than through the provider extraction pipeline.
    return { sources: [], subtitles: [] };
  }
}
