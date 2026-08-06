/**
 * Unified HLS playlist (M3U8) rewriting.
 *
 * Replaces 3 independent implementations from Flyx 2.0:
 * - DLHD routes: `rewriteM3u8ForPlayEndpoint`
 * - DLHD pipeline: `rewriteM3u8`
 * - CDN-Live worker: `rewriteM3u8`
 *
 * @module m3u8
 */

/** Configuration for M3U8 playlist rewriting. */
export interface M3U8RewriteConfig {
  /** Base URL to prepend to relative URIs in the playlist. */
  baseUrl?: string;
  /** Callback to transform segment URLs. */
  segmentTransformer?: (url: string, index: number) => string;
  /** Callback to transform key URLs. */
  keyTransformer?: (url: string) => string;
  /** Whether to rewrite EXT-X-MAP URIs (fMP4 init segments). */
  rewriteMap?: boolean;
  /** Whether to prepend baseUrl to relative URIs. */
  resolveRelative?: boolean;
}

/**
 * Parse and rewrite an HLS M3U8 playlist.
 *
 * Handles:
 * - `#EXTINF` segment URIs
 * - `#EXT-X-KEY` URI attributes
 * - `#EXT-X-MAP` URI attributes (fMP4 init segments)
 * - Relative URI resolution
 *
 * @param content - The raw M3U8 playlist text.
 * @param config - Rewrite configuration.
 * @returns The rewritten M3U8 content.
 */
export function rewriteM3U8(content: string, config: M3U8RewriteConfig = {}): string {
  const lines = content.split("\n");
  const rewritten: string[] = [];
  let segmentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Segment URI line (non-comment, non-blank, not a tag)
    if (!line.startsWith("#") && line.trim() !== "") {
      let uri = line.trim();

      // Resolve relative URIs
      if (config.resolveRelative && config.baseUrl && !isAbsoluteUrl(uri)) {
        uri = `${config.baseUrl.replace(/\/$/, "")}/${uri.replace(/^\//, "")}`;
      }

      // Apply segment transformer
      if (config.segmentTransformer) {
        uri = config.segmentTransformer(uri, segmentIndex);
      }

      rewritten.push(uri);
      segmentIndex++;
      continue;
    }

    // EXT-X-KEY tag with URI attribute
    if (line.startsWith("#EXT-X-KEY") && line.includes('URI="')) {
      const rewrittenLine = line.replace(/URI="([^"]*)"/, (_match, uri: string) => {
        let newUri = uri;

        if (config.resolveRelative && config.baseUrl && !isAbsoluteUrl(uri)) {
          newUri = `${config.baseUrl.replace(/\/$/, "")}/${uri.replace(/^\//, "")}`;
        }

        if (config.keyTransformer) {
          newUri = config.keyTransformer(newUri);
        }

        return `URI="${newUri}"`;
      });
      rewritten.push(rewrittenLine);
      continue;
    }

    // EXT-X-MAP tag with URI attribute (fMP4 init segments)
    if (config.rewriteMap && line.startsWith("#EXT-X-MAP") && line.includes('URI="')) {
      const rewrittenLine = line.replace(/URI="([^"]*)"/, (_match, uri: string) => {
        let newUri = uri;

        if (config.resolveRelative && config.baseUrl && !isAbsoluteUrl(uri)) {
          newUri = `${config.baseUrl.replace(/\/$/, "")}/${uri.replace(/^\//, "")}`;
        }

        if (config.segmentTransformer) {
          newUri = config.segmentTransformer(newUri, -1); // -1 = init segment
        }

        return `URI="${newUri}"`;
      });
      rewritten.push(rewrittenLine);
      continue;
    }

    // Pass through unchanged
    rewritten.push(line);
  }

  return rewritten.join("\n");
}

/**
 * Check if a URI is absolute (has a scheme).
 */
function isAbsoluteUrl(uri: string): boolean {
  return /^https?:\/\//i.test(uri) || uri.startsWith("//");
}

/**
 * Build a segment proxy URL for a given CDN segment URL.
 *
 * @param segmentUrl - The original segment URL.
 * @param proxyEndpoint - The proxy endpoint base URL.
 * @param channelId - Optional channel/source identifier.
 * @returns The proxied segment URL.
 */
export function proxySegmentUrl(
  segmentUrl: string,
  proxyEndpoint: string,
  channelId?: string,
): string {
  const params = new URLSearchParams();
  params.set("url", segmentUrl);
  if (channelId) params.set("channel", channelId);
  return `${proxyEndpoint}?${params.toString()}`;
}
