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
 * Resolve the absolute host stream URL for the hand-off. With a raw source
 * this is a pure computation; otherwise the host re-extracts the title.
 */
export async function resolveHostStreamUrl(input: OpenInVlcInput): Promise<string> {
  const origin = window.location.origin;
  if (input.absoluteUrl) {
    return input.absoluteUrl.startsWith("/") ? `${origin}${input.absoluteUrl}` : input.absoluteUrl;
  }
  if (input.source?.url) return hostStreamUrl(origin, input.source);
  if (!input.item) throw new Error("Nothing to play");

  const res = await fetch(vlcRouteUrl(input.item, { startTime: input.startTime, format: "json" }), {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (!res.ok || !data.ok || !data.url) {
    throw new Error(data.error || "No playable stream found for this title");
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
