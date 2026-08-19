/**
 * Pure source-selection helpers for downloads.
 *
 * Kept dependency-free (only a type import) so they can be unit-tested
 * without pulling in the extraction pipeline, ffmpeg, or the file store.
 */

import type { StreamSource } from "@flyx/core";

/** Parse a quality label into a sortable number ("1080p" → 1080, "4K" → 4000). */
export function qualityScore(quality?: string): number {
  const q = (quality || "").toLowerCase();
  if (q.startsWith("4k") || q.startsWith("2160")) return 4000;
  if (q.startsWith("1440")) return 1440;
  if (q.startsWith("1080")) return 1080;
  if (q.startsWith("720")) return 720;
  if (q.startsWith("480")) return 480;
  if (q.startsWith("360")) return 360;
  const m = q.match(/(\d{3,4})/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Pick the source to download.
 *
 * With no `quality`, returns the highest-quality source (preferring plain MP4
 * on ties). With a `quality` label, returns an exact match if present,
 * otherwise the closest by numeric quality score.
 */
export function pickBestSource(
  sources: StreamSource[],
  quality?: string,
): StreamSource | null {
  const usable = sources.filter((s) => s && s.url);
  if (usable.length === 0) return null;

  if (quality) {
    const wanted = quality.trim().toLowerCase();
    // Exact label match first (e.g. "1080p").
    const exact = usable.find(
      (s) => (s.quality || "").trim().toLowerCase() === wanted,
    );
    if (exact) return exact;
    // Closest by numeric quality score.
    const target = qualityScore(quality);
    if (target > 0) {
      return [...usable].sort(
        (a, b) =>
          Math.abs(qualityScore(a.quality) - target) -
          Math.abs(qualityScore(b.quality) - target),
      )[0];
    }
  }

  return usable.sort((a, b) => {
    const q = qualityScore(b.quality) - qualityScore(a.quality);
    if (q !== 0) return q;
    // Prefer plain MP4 (no remux needed) on ties.
    return (a.type === "mp4" ? 0 : 1) - (b.type === "mp4" ? 0 : 1);
  })[0];
}

/** Distinct quality labels for a set of sources, highest-first. */
export function listQualities(sources: StreamSource[]): string[] {
  const seen = new Map<string, number>();
  for (const s of sources) {
    if (!s?.url) continue;
    const label = (s.quality || "").trim();
    if (!label) continue;
    seen.set(label, Math.max(seen.get(label) ?? 0, qualityScore(label)));
  }
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([q]) => q);
}
