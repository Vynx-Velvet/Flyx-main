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
 *   - target=cast (implies json): same, but the URL is on an address a
 *     Chromecast on the LAN can reach (lib/lan-origin.ts castOrigin), not
 *     the origin the viewer used (often 127.0.0.1). 409 with
 *     code "lan-sharing-off" when the server is bound to localhost only.
 *
 * The playlist entry is an absolute /api/stream/proxy URL on *this* host,
 * built from the origin the viewer reached us at — so VLC on the viewer's
 * device pulls the stream through the host exactly like the in-app player.
 * VLC carries no cookie, so that URL is signed (proxy-sign.ts). Because this
 * route mints signatures it requires a logged-in session itself.
 *
 * A raw `url` must be an absolute http(s) URL or a host proxy path
 * (/api/stream/proxy, /api/livetv/playlist) with no whitespace/control
 * characters — a newline would inject extra entries into the .m3u.
 */

import { NextRequest, NextResponse } from "next/server";
import { pipeline } from "@/lib/extraction";
import type { StreamSource } from "@flyx/core";
import { requestOrigin } from "@/lib/request-origin";
import { parseDownloadItem } from "@/lib/downloads/stream-request";
import { pickBestSource } from "@/lib/downloads/source-picker";
import {
  HOST_PROXY_PATHS,
  buildVlcPlaylist,
  handoffTitle,
  hostStreamUrl,
  playlistFilename,
  validateHandoffUrl,
} from "@/lib/external-player";
import { getSession } from "@/lib/auth/get-session";
import { signProxyUrl } from "@/lib/security/proxy-sign";
import { castOrigin } from "@/lib/lan-origin";

const CAST_LAN_SHARING_OFF = "Turn on LAN sharing in Settings to cast";

/**
 * Absolute, signed host URL for a source: host proxy paths are re-based
 * onto `origin` and signed; anything else is wrapped in /api/stream/proxy.
 */
function signedHostStreamUrl(
  origin: string,
  source: { url: string; referer?: string; origin?: string },
): string {
  const url = hostStreamUrl(origin, source);
  if (!url) return url;
  const parsed = new URL(url);
  if (!HOST_PROXY_PATHS.includes(parsed.pathname)) return url;
  return `${origin.replace(/\/+$/, "")}${signProxyUrl(`${parsed.pathname}${parsed.search}`)}`;
}

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
    const url = validateHandoffUrl(rawUrl);
    if (!url) {
      throw Object.assign(new Error("url must be a plain http(s) URL"), { status: 400 });
    }
    return {
      source: {
        url,
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
  if (!(await getSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const forCast = searchParams.get("target") === "cast";
  const format = forCast || searchParams.get("format") === "json" ? "json" : "m3u";
  const startTime = Math.max(0, Math.floor(Number(searchParams.get("t")) || 0));

  // A Chromecast fetches the stream itself: it needs an address on the LAN.
  const lanOrigin = forCast ? castOrigin(request) : null;
  if (forCast && !lanOrigin) {
    return NextResponse.json(
      { ok: false, code: "lan-sharing-off", error: CAST_LAN_SHARING_OFF },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  let resolved: Resolved;
  try {
    resolved = await resolve(request);
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status });
  }

  const origin = lanOrigin ?? requestOrigin(request);
  const url = signedHostStreamUrl(origin, resolved.source);

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
