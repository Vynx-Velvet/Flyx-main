/**
 * Specialised base class for live TV providers.
 *
 * Extends {@link BaseProvider} with live TV-specific behaviour:
 * - Auto-detects live TV content via `metadata.isLive` flag
 * - Supports channel-based extraction (channel ID instead of TMDB ID)
 */

import type { StreamSource } from "@flyx/core";
import { BaseProvider } from "./BaseProvider";

export abstract class BaseLiveTVProvider extends BaseProvider {
  // supportedContent is set by each subclass (generated from tools/scripts/generate-providers.ts)

  /**
   * Extract a live TV channel stream.
   *
   * Live TV providers work differently from VOD — they use channel
   * IDs or names rather than TMDB IDs. The base `doExtract` receives
   * the standard ExtractionRequest, but providers can read
   * `request.title` for the channel identifier.
   */

  /**
   * Live TV sources typically require segment proxying.
   */
  protected normalizeSource(raw: Record<string, unknown>): StreamSource {
    const source = super.normalizeSource(raw);

    // Live TV segments almost always need proxying
    if (source.requiresSegmentProxy === undefined) {
      source.requiresSegmentProxy = true;
    }

    return source;
  }
}
