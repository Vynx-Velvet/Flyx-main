/**
 * GET /api/stream/vlc — hand a title to VLC, served by this host instance.
 *
 * Two request shapes:
 *   - Title identity (tmdbId/mediaType/season/episode/malId/… — same query
 *     as /api/downloads/stream): the host extracts sources and picks one.
 *   - Raw source (url + referer/origin + title): the player already holds
 *     the source, no second extraction.
 *
 * Two response shapes:
 *   - default: an extended .m3u playlist (Content-Disposition attachment)
 *     the OS opens with VLC. Carries the resume position via
 *     #EXTVLCOPT:start-time when `t` is set.
 *   - format=json: { ok, url, title, quality, provider } for clients that
 *     launch VLC themselves (Electron IPC, Android intent, iOS callback).
 *
 * The playlist entry is an absolute /api/stream/proxy URL on *this* host,
 * built from the origin the viewer reached us at — so VLC on the viewer's
 * device pulls the stream through the host exactly like the in-app player.
 * /api/stream is public in the middleware, so VLC needs no cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { pipeline } from "@/lib/extraction";
import type { StreamSource } from "@flyx/core";
import { requestOrigin } from "@/lib/request-origin";
import { parseDownloadItem } from "@/lib/downloads/stream-request";
import { pickBestSource } from "@/lib/downloads/source-picker";
import {
  buildVlcPlaylist,
  handoffTitle,
  hostStreamUrl,
  playlistFilename,
} from "@/lib/external-player";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Resolved {
  source: StreamSource | { url: string; referer?: string; origin?: string; quality?: string };
  title: string;
  provider?: string;
}

async function resolve(request: NextRequest): Promise<Resolved> {
  const { searchParams } = new URL(request.url);

  // ── Raw source (player hand-off) ────────────────────────────
  const rawUrl = searchParams.get("url");
  if (rawUrl) {
    if (!/^https?:\/\//i.test(rawUrl) && !rawUrl.startsWith("/api/stream/proxy")) {
      throw Object.assign(new Error("url must be http(s)"), { status: 400 });
    }
    return {
      source: {
        url: rawUrl,
        referer: searchParams.get("referer") ?? undefined,
        origin: searchParams.get("origin") ?? undefined,
      },
      title: searchParams.get("title") || "Flyx",
    };
  }

  // ── Title identity (host re-extracts) ──────────────────────
  let item;
  try {
    item = parseDownloadItem(searchParams);
  } catch (err) {
    throw Object.assign(new Error((err as Error).message), { status: 400 });
  }
  if (item.kind !== "video") {
    throw Object.assign(new Error("Only video can be opened in VLC"), { status: 400 });
  }

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
    throw Object.assign(new Error("No stream sources found for this title"), { status: 404 });
  }

  let candidates = result.sources;
  if (item.language) {
    const lang = candidates.filter((s) => s.language === item.language);
    if (lang.length > 0) candidates = lang;
    else if (candidates.some((s) => s.language)) {
      throw Object.assign(new Error(`No ${item.language} audio sources found`), { status: 404 });
    }
  }
  const source = pickBestSource(candidates, item.quality);
  if (!source) {
    throw Object.assign(new Error("No playable source found"), { status: 404 });
  }

  return {
    source,
    provider: result.provider,
    title: handoffTitle({
      title: item.title,
      mediaType: item.mediaType,
      season: item.season,
      episode: item.episode,
    }),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "json" ? "json" : "m3u";
  const startTime = Math.max(0, Math.floor(Number(searchParams.get("t")) || 0));

  let resolved: Resolved;
  try {
    resolved = await resolve(request);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status });
  }

  const origin = requestOrigin(request);
  const url = hostStreamUrl(origin, resolved.source);

  if (format === "json") {
    return NextResponse.json(
      {
        ok: true,
        url,
        title: resolved.title,
        quality: resolved.source.quality ?? null,
        provider: resolved.provider ?? null,
        startTime,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = buildVlcPlaylist({ title: resolved.title, url, startTime });
  const filename = playlistFilename(resolved.title);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "audio/x-mpegurl; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
