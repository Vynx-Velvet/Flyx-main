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
 *
 * Limits (shared with the admin queue, see lib/downloads/limits): one
 * direct stream per user at a time, a server-wide cap on ffmpeg processes
 * (429 when busy), ffmpeg is killed when the client disconnects, and every
 * response is capped in size.
 */

import { NextRequest, NextResponse } from "next/server";
import { pipeline } from "@/lib/extraction";
import { Readable } from "node:stream";
import { getSession } from "@/lib/auth/get-session";
import type { DownloadItemInput } from "@/lib/downloads/types";
import {
  downloadContentDisposition,
  parseDownloadItem,
  streamFilename,
} from "@/lib/downloads/stream-request";
import { pickBestSource } from "@/lib/downloads/source-picker";
import { resolveSourceForQuality } from "@/lib/downloads/hls-variants";
import { sourceNeedsReencode } from "@/lib/downloads/video";
import { remuxToStream } from "@/lib/downloads/ffmpeg";
import { buildMangaChapterCbz } from "@/lib/downloads/manga";
import { buildLocalProxyUrl } from "@/lib/downloads/proxy-url";
import {
  acquireStream,
  MANGA_SLOT_WAIT_MS,
  MAX_VIDEO_BYTES,
  tryAcquireFfmpeg,
  tryAcquireStream,
  type Release,
} from "@/lib/downloads/limits";
import { safeFetch } from "@/lib/security/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function busy(message: string): NextResponse {
  return NextResponse.json(
    { ok: false, error: message },
    { status: 429, headers: { "Retry-After": "30" } },
  );
}

/**
 * Pass an upstream body through, failing past `maxBytes` and running
 * `onDone` exactly once when it finishes, errors, or the client cancels.
 */
function cappedBody(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  onDone: () => void,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let total = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          onDone();
          return;
        }
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          controller.error(new Error("download exceeds the maximum allowed size"));
          onDone();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        controller.error(err);
        onDone();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => {});
      onDone();
    },
  });
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

  // Bounded direct downloads per user: one video at a time (it can run ffmpeg
  // for hours); manga chapters (held in memory while zipping) queue briefly
  // because the client requests them in bulk.
  const releaseStream =
    item.kind === "manga"
      ? await acquireStream(session.sub, "manga", MANGA_SLOT_WAIT_MS, request.signal)
      : tryAcquireStream(session.sub, "video");
  if (!releaseStream) {
    return busy("Another download is already in progress — try again when it finishes");
  }
  // Ownership of `releaseStream` passes to the response body once one is returned.
  let handedOff = false;
  let releaseFfmpeg: Release | null = null;

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
    const picked = pickBestSource(candidates, item.quality);
    // A generic HLS master + a real quality request → use that variant.
    const source = picked ? await resolveSourceForQuality(picked, item.quality) : null;
    if (!source) {
      return NextResponse.json(
        { ok: false, error: "No playable source found" },
        { status: 404 },
      );
    }

    headers["Content-Type"] = "video/mp4";

    if (source.type === "mp4") {
      // Provider-chosen URL: refuse private/loopback targets on every hop.
      const upstream = await safeFetch(source.url, {
        headers: {
          "User-Agent": source.userAgent || UA,
          ...(source.referer ? { Referer: source.referer } : {}),
          ...(source.origin ? { Origin: source.origin } : {}),
        },
        signal: request.signal,
      });
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json(
          { ok: false, error: `upstream returned HTTP ${upstream.status}` },
          { status: 502 },
        );
      }
      const len = upstream.headers.get("content-length");
      if (len && Number(len) > MAX_VIDEO_BYTES) {
        await upstream.body.cancel().catch(() => {});
        return NextResponse.json(
          { ok: false, error: "download exceeds the maximum allowed size" },
          { status: 502 },
        );
      }
      if (len) headers["Content-Length"] = len;
      handedOff = true;
      return new NextResponse(cappedBody(upstream.body, MAX_VIDEO_BYTES, releaseStream), { headers });
    }

    // HLS/DASH — remux (or re-encode for HEVC) to a live MP4 stream.
    releaseFfmpeg = tryAcquireFfmpeg();
    if (!releaseFfmpeg) {
      return busy("The server is busy with other downloads — try again shortly");
    }
    const reencode = await sourceNeedsReencode(source);
    const onExit = releaseFfmpeg;
    // Handed to remuxToStream: it calls onExit on every path, including failures.
    releaseFfmpeg = null;
    handedOff = true;
    const { stream } = await remuxToStream(
      buildLocalProxyUrl(source),
      {
        Referer: source.referer || "",
        Origin: source.origin || "",
        "User-Agent": source.userAgent || UA,
      },
      {
        signal: request.signal,
        reencode,
        maxBytes: MAX_VIDEO_BYTES,
        onExit: () => {
          onExit();
          releaseStream();
        },
      },
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
  } finally {
    releaseFfmpeg?.();
    if (!handedOff) releaseStream();
  }
}
