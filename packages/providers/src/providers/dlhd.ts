/**
 * DLHDProvider — live-tv/live-sports content provider.
 *
 * Auto-generated from tools/scripts/generate-providers.ts
 */

import type { ContentCategory, ExtractionRequest, StreamSource, SubtitleTrack } from "@flyx/core";
import { PROVIDER_PRIORITIES } from "@flyx/config";
import { extractDLHD } from "@flyx/extractors/services";
import { BaseLiveTVProvider } from "../base";

export class DLHDProvider extends BaseLiveTVProvider {
  readonly name = "dlhd";
  readonly priority = PROVIDER_PRIORITIES.DLHD;
  readonly supportedContent: ContentCategory[] = ["live-tv","live-sports"];

  protected async doExtract(request: ExtractionRequest): Promise<{
    sources: StreamSource[];
    subtitles?: SubtitleTrack[];
  }> {
    const result = await extractDLHD(request.title ?? "");
    return { sources: result.sources ?? [], subtitles: result.subtitles ?? [] };
  }
}
