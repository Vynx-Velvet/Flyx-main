/**
 * GET /api/downloads/qualities — the qualities a title can really be
 * downloaded in.
 *
 * Providers mostly hand back one HLS master labelled "Auto", which left the
 * download dialog with nothing to offer. This resolves the title, expands
 * every generic HLS master into its `#EXT-X-STREAM-INF` variants, and
 * returns the distinct labels (highest first) plus per-source metadata for
 * the sub/dub split. The download routes honour a chosen label by picking
 * the matching variant (lib/downloads/hls-variants).
 *
 * Query: same identity as /api/downloads/stream (tmdbId, mediaType, season,
 * episode, malId, title, provider).
 */

import { NextRequest, NextResponse } from "next/server";
import { ExtractionPipeline } from "@flyx/extractors";
import { providerRegistry } from "@flyx/providers";
import "@flyx/providers/providers";
import type { StreamSource } from "@flyx/core";
import { parseDownloadItem } from "@/lib/downloads/stream-request";
import { fetchVariants, isGenericQuality } from "@/lib/downloads/hls-variants";
import { qualityScore } from "@/lib/downloads/source-picker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pipeline = new ExtractionPipeline(providerRegistry);

export async function GET(request: NextRequest) {
  let item;
  try {
    item = parseDownloadItem(new URL(request.url).searchParams);
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
  if (item.kind !== "video") {
    return NextResponse.json({ ok: false, error: "Only video has qualities" }, { status: 400 });
  }

  let sources: StreamSource[] = [];
  let provider: string | null = null;
  try {
    const result = await pipeline.extract(
      {
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        season: item.season,
        episode: item.episode,
        malId: item.malId,
        title: item.title,
      },
      { provider: item.provider, signal: request.signal },
    );
    if (result.success) {
      sources = result.sources.filter((s) => s?.url);
      provider = result.provider ?? null;
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }

  // Expand generic masters into their variants (in parallel, bounded by the
  // provider count — typically 1–3 sources).
  const expanded = await Promise.all(
    sources.map(async (s) => {
      if (!isGenericQuality(s.quality)) {
        return [{ quality: s.quality, language: s.language, provider: s.title || provider || undefined }];
      }
      const variants = await fetchVariants(s);
      if (!variants.length) {
        return [{ quality: "Auto", language: s.language, provider: s.title || provider || undefined }];
      }
      return variants.map((v) => ({ quality: v.label, language: s.language, provider: s.title || provider || undefined }));
    }),
  );
  const flat = expanded.flat();

  const labels = new Map<string, number>();
  for (const f of flat) {
    if (isGenericQuality(f.quality)) continue;
    labels.set(f.quality, Math.max(labels.get(f.quality) ?? 0, qualityScore(f.quality)));
  }
  const qualities = [...labels.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);

  return NextResponse.json(
    { ok: true, provider, qualities, sources: flat },
    { headers: { "Cache-Control": "private, max-age=120" } },
  );
}
