/**
 * External player (VLC) hand-off — browser side.
 *
 * Picks the launch path for the device the page is running on and fires
 * it. The stream URL always points at the host instance (see
 * lib/external-player.ts), so the same URL works whether VLC runs on the
 * host PC, a phone, or another laptop on the LAN.
 */

import {
  androidIntentUrl,
  buildVlcPlaylist,
  handoffTitle,
  hostStreamUrl,
  iosCallbackUrl,
  pickLaunchStrategy,
  playlistFilename,
  vlcRouteUrl,
  type HandoffItem,
  type HandoffSource,
  type LaunchStrategy,
} from "./external-player";

interface DesktopBridge {
  isDesktop?: boolean;
  openInVlc?: (payload: {
    url: string;
    title: string;
    startTime?: number;
  }) => Promise<{ ok: boolean; method?: string; error?: string; path?: string }>;
}

function desktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  const bridge = (window as unknown as { flyxDesktop?: DesktopBridge }).flyxDesktop;
  return bridge && typeof bridge.openInVlc === "function" ? bridge : null;
}

export function currentLaunchStrategy(): LaunchStrategy {
  return pickLaunchStrategy({
    userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    hasDesktopBridge: Boolean(desktopBridge()),
  });
}

export interface OpenInVlcInput {
  /**
   * An already-absolute URL on the host instance (e.g. a Live TV playlist
   * `${origin}/api/livetv/playlist?…`). Used as-is; no extraction, no proxy
   * wrapping.
   */
  absoluteUrl?: string;
  /** Raw source (the player already has it) — skips a second extraction. */
  source?: HandoffSource;
  /** Title identity — used when no raw source is at hand (watch page "auto" mode). */
  item?: HandoffItem;
  title?: string;
  mediaType?: "movie" | "tv";
  season?: number;
  episode?: number;
  /** Resume position in seconds. */
  startTime?: number;
}

export interface OpenInVlcResult {
  ok: boolean;
  strategy: LaunchStrategy;
  /** The absolute host stream URL (for "copy link" fallbacks). */
  streamUrl: string;
  /** Short user-facing outcome. */
  message: string;
  error?: string;
}

/**
 * Resolve the absolute host stream URL for the hand-off.
 *
 * External players carry no session cookie, so the URL they get must be
 * signed by the host: a raw source (or an unsigned host URL) is sent to
 * /api/stream/vlc?format=json, which wraps + signs it. A URL the host
 * already signed (e.g. Live TV's playlist URL) is used as-is. With only a
 * title identity, the host re-extracts the title.
 */
export async function resolveHostStreamUrl(input: OpenInVlcInput): Promise<string> {
  const origin = window.location.origin;
  if (input.absoluteUrl) {
    const abs = input.absoluteUrl.startsWith("/") ? `${origin}${input.absoluteUrl}` : input.absoluteUrl;
    if (/[?&]sig=/.test(abs)) return abs;
    return signViaHost({ url: abs });
  }
  if (input.source?.url) return signViaHost(input.source);
  if (!input.item) throw new Error("Nothing to play");

  return fetchVlcJson(vlcRouteUrl(input.item, { startTime: input.startTime, format: "json" }));
}

/**
 * Signed, absolute stream URL for a Chromecast: always served through the
 * host proxy (the receiver can't send Referer or our cookie, and most CDNs
 * lack CORS) on an address the Cast device can reach on the LAN. Throws
 * with the host's message (e.g. "Turn on LAN sharing in Settings to cast").
 */
export async function resolveCastStreamUrl(source: HandoffSource): Promise<string> {
  return signViaHost(source, { cast: true });
}

/** Ask the host for a signed, absolute stream URL for a raw source. */
async function signViaHost(source: HandoffSource, opts: { cast?: boolean } = {}): Promise<string> {
  // Pure computation first: an already-proxied URL is made absolute and
  // re-based, a raw CDN URL is wrapped — the host then signs it.
  const unsigned = hostStreamUrl(window.location.origin, source);
  if (!unsigned) throw new Error("Nothing to play");
  const q = new URLSearchParams();
  const parsed = new URL(unsigned);
  const sameHostProxy = parsed.origin === window.location.origin;
  // A host proxy URL is passed root-relative (the route re-bases it onto
  // the origin the viewer reached us at); a raw CDN URL keeps its headers.
  q.set("url", sameHostProxy ? `${parsed.pathname}${parsed.search}` : source.url);
  if (!sameHostProxy) {
    if (source.referer) q.set("referer", source.referer);
    if (source.origin) q.set("origin", source.origin);
  }
  q.set("format", "json");
  if (opts.cast) q.set("target", "cast");
  return fetchVlcJson(`/api/stream/vlc?${q.toString()}`);
}

async function fetchVlcJson(path: string): Promise<string> {
  const res = await fetch(path, {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    url?: string;
    error?: string;
    code?: string;
  };
  if (!res.ok || !data.ok || !data.url) {
    // `code` lets callers branch (e.g. "lan-sharing-off" for casting).
    throw Object.assign(new Error(data.error || "No playable stream found for this title"), {
      code: data.code,
    });
  }
  return data.url;
}

/** Hand the current title to VLC on this device. Never throws. */
export async function openInVlc(input: OpenInVlcInput): Promise<OpenInVlcResult> {
  const strategy = currentLaunchStrategy();
  const title = handoffTitle({
    title: input.title ?? input.item?.title,
    mediaType: input.mediaType ?? input.item?.mediaType,
    season: input.season ?? input.item?.season,
    episode: input.episode ?? input.item?.episode,
  });

  let streamUrl = "";
  try {
    streamUrl = await resolveHostStreamUrl(input);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, strategy, streamUrl: "", message: error, error };
  }

  const startTime = Math.max(0, Math.floor(input.startTime ?? 0));

  try {
    switch (strategy) {
      case "desktop": {
        const bridge = desktopBridge()!;
        const result = await bridge.openInVlc!({ url: streamUrl, title, startTime });
        if (result.ok) {
          return {
            ok: true,
            strategy,
            streamUrl,
            message:
              result.method === "playlist"
                ? "Opened a playlist with your default player"
                : "Playing in VLC",
          };
        }
        return {
          ok: false,
          strategy,
          streamUrl,
          message: result.error || "VLC could not be started",
          error: result.error,
        };
      }
      case "android":
        window.location.href = androidIntentUrl(streamUrl, title, startTime);
        return { ok: true, strategy, streamUrl, message: "Opening VLC…" };
      case "ios":
        window.location.href = iosCallbackUrl(streamUrl);
        return { ok: true, strategy, streamUrl, message: "Opening VLC…" };
      case "playlist":
      default: {
        // Any other browser: download an .m3u the OS hands to VLC. A title
        // identity goes through the route (proper filename + resume); a
        // stream URL we already hold is written into a playlist right here.
        let href: string;
        let objectUrl: string | null = null;
        if (input.item) {
          href = vlcRouteUrl(input.item, { startTime });
        } else {
          const body = buildVlcPlaylist({ title, url: streamUrl, startTime });
          objectUrl = URL.createObjectURL(new Blob([body], { type: "audio/x-mpegurl" }));
          href = objectUrl;
        }
        const a = document.createElement("a");
        a.href = href;
        a.download = input.item ? "" : playlistFilename(title);
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl!), 10_000);
        return {
          ok: true,
          strategy,
          streamUrl,
          message: "Playlist downloaded — open it with VLC",
        };
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, strategy, streamUrl, message: error, error };
  }
}

/** Copy the host stream URL so it can be pasted into VLC → Open Network Stream. */
export async function copyStreamUrl(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
