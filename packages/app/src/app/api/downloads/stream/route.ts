/**
 * GET /api/downloads/stream — stream a single download directly to the
 * requesting device's browser (Content-Disposition: attachment).
 *
 * This is the non-host delivery path: a phone / LAN browser asks the server
 * (the host machine) to do the heavy lifting — extraction, HLS→MP4 remux,
 * image→CBZ bundling — but the resulting file lands on *that* device via a
 * normal browser download, never on the host's disk.
 *
 * The host (desktop) path instead POSTs to /api/downloads, which writes to
 * the configured download folder and tracks progress on the Downloads page.
 *
 * Auth: any signed-in user (the middleware already gates the whole app).
 */

import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getSession } from "@/lib/auth/get-session";
import type { DownloadItemInput } from "@/lib/downloads/types";
import {
  downloadContentDisposition,
  parseDownloadItem,
  streamFilename,
} from "@/lib/downloads/stream-request";
import { ExtractionPipeline } from "@flyx/extractors";
import { providerRegistry } from "@flyx/providers";
import "@flyx/providers/providers";
import type { StreamSource } from "@flyx/core";
import { pickBestSource } from "@/lib/downloads/source-picker";
import { sourceNeedsReencode } from "@/lib/downloads/video";
import { remuxToStream } from "@/lib/downloads/ffmpeg";
import { buildMangaChapterCbz } from "@/lib/downloads/manga";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const pipeline = new ExtractionPipeline(providerRegistry);

function proxyUrl(source: StreamSource): string {
  const port = process.env.PORT || "3891";
  const params = new URLSearchParams();
  params.set("url", source.url);
  if (source.referer) params.set("referer", source.referer);
  if (source.origin) params.set("origin", source.origin);
  return `http://127.0.0.1:${port}/api/stream/proxy?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let item: DownloadItemInput;
  try {
    item = parseDownloadItem(new URL(request.url).searchParams);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 },
    );
  }

  const filename = streamFilename(item);
  const headers: Record<string, string> = {
    "Content-Disposition": downloadContentDisposition(filename),
    "Cache-Control": "no-store",
  };

  try {
    if (item.kind === "manga") {
      const { zipped } = await buildMangaChapterCbz(
        { mangaId: item.mangaId, chapter: item.chapter, title: item.title },
        undefined,
        request.signal,
      );
      headers["Content-Type"] = "application/vnd.comicbook+zip";
      headers["Content-Length"] = String(zipped.byteLength);
      return new NextResponse(new Uint8Array(zipped), { headers });
    }

    // ── Video ──────────────────────────────────────────────────
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
    if (!result.success || result.sources.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No stream sources found for this title" },
        { status: 404 },
      );
    }
    let candidates = result.sources;
    if (item.language) {
      const lang = candidates.filter((s) => s.language === item.language);
      if (lang.length > 0) candidates = lang;
      else if (candidates.some((s) => s.language)) {
        return NextResponse.json(
          { ok: false, error: `No ${item.language} audio sources found` },
          { status: 404 },
        );
      }
      // Provider doesn't tag audio — fall through with all sources.
    }
    const source = pickBestSource(candidates, item.quality);
    if (!source) {
      return NextResponse.json(
        { ok: false, error: "No playable source found" },
        { status: 404 },
      );
    }

    headers["Content-Type"] = "video/mp4";

    if (source.type === "mp4") {
      const upstream = await fetch(source.url, {
        headers: {
          "User-Agent": source.userAgent || UA,
          ...(source.referer ? { Referer: source.referer } : {}),
          ...(source.origin ? { Origin: source.origin } : {}),
        },
        redirect: "follow",
        signal: request.signal,
      });
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json(
          { ok: false, error: `upstream returned HTTP ${upstream.status}` },
          { status: 502 },
        );
      }
      const len = upstream.headers.get("content-length");
      if (len) headers["Content-Length"] = len;
      return new NextResponse(upstream.body, { headers });
    }

    // HLS/DASH — remux (or re-encode for HEVC) to a live MP4 stream.
    const reencode = await sourceNeedsReencode(source);
    const { stream } = await remuxToStream(
      proxyUrl(source),
      {
        Referer: source.referer || "",
        Origin: source.origin || "",
        "User-Agent": source.userAgent || UA,
      },
      { signal: request.signal, reencode },
    );
    const web = Readable.toWeb(stream) as ReadableStream;
    return new NextResponse(web, { headers });
  } catch (err) {
    // A mid-stream failure can't change an already-started response, but an
    // extraction/remux error before bytes flow surfaces here as a clean 500.
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
