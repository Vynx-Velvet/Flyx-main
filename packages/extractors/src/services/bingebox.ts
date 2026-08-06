import type { StreamSource, SubtitleTrack } from "@flyx/core";

export interface ExtractionResult {
  sources: StreamSource[];
  subtitles: SubtitleTrack[];
}

export async function extractBingeBox(..._args: unknown[]): Promise<ExtractionResult> {
  return { sources: [], subtitles: [] };
}
