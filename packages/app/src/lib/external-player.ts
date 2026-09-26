/**
 * External player (VLC) hand-off — pure helpers.
 *
 * Flyx can hand a stream to VLC instead of playing it in the browser. The
 * stream is always served *by the host instance* through /api/stream/proxy,
 * so VLC on any device (the host PC, a phone, a LAN laptop) pulls bytes
 * from the host the same way the in-app player does — the host injects the
 * Referer/Origin/User-Agent headers the CDNs demand and rewrites HLS
 * playlists, and VLC never needs a cookie because /api/stream is public.
 *
 * Everything here is dependency-free so it can be unit-tested and shared
 * between the API route (server) and the player (browser).
 */

export type ExternalPlayerMode = "off" | "manual" | "auto";

export const EXTERNAL_PLAYER_MODES: ReadonlyArray<{
  value: ExternalPlayerMode;
  label: string;
  description: string;
}> = [
  {
    value: "off",
    label: "Off",
    description: "Always play in the Flyx player. No VLC button is shown.",
  },
  {
    value: "manual",
    label: "Show a VLC button",
    description: "Play in Flyx by default, with a VLC button in the player.",
  },
  {
    value: "auto",
    label: "Always open in VLC",
    description: "Skip the Flyx player and send every title straight to VLC.",
  },
];

export function normalizeExternalPlayerMode(value: unknown): ExternalPlayerMode {
  return value === "off" || value === "auto" ? value : "manual";
}

/** The raw source fields the hand-off needs (a subset of core StreamSource). */
export interface HandoffSource {
  url: string;
  referer?: string;
  origin?: string;
}

/**
 * Absolute URL that streams `source` from the host instance.
 *
 * Always routes through /api/stream/proxy: VLC can't set Referer/Origin per
 * request, and the proxy also rewrites HLS playlists so every variant, key
 * and segment resolves back through the host. `origin` is the origin the
 * *viewer's device* reaches the host at (e.g. http://192.168.1.5:3891).
 */
export function hostStreamUrl(origin: string, source: HandoffSource): string {
  const base = origin.replace(/\/+$/, "");
  const url = (source.url || "").trim();
  if (!url) return "";

  // Already proxied (a relative /api/stream/proxy?… from the player) —
  // just make it absolute instead of double-wrapping.
  if (url.startsWith("/api/stream/proxy")) return `${base}${url}`;
  if (/^https?:\/\/[^/]+\/api\/stream\/proxy/i.test(url)) return url;

  const params = new URLSearchParams();
  params.set("url", url);
  if (source.referer) params.set("referer", source.referer);
  if (source.origin) params.set("origin", source.origin);
  return `${base}/api/stream/proxy?${params.toString()}`;
}

/** Identity for a title the route can re-resolve on the host. */
export interface HandoffItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  malId?: number;
  title?: string;
  provider?: string;
  quality?: string;
  language?: "sub" | "dub";
}

/** Playlist entry as built by the host. */
export interface HandoffPlaylistInput {
  title: string;
  url: string;
  /** Resume position in seconds (omitted when 0). */
  startTime?: number;
}

/** Query string for /api/stream/vlc (mirrors /api/downloads/stream). */
export function vlcRouteQuery(
  item: HandoffItem,
  opts: { startTime?: number; format?: "m3u" | "json" } = {},
): string {
  const q = new URLSearchParams();
  q.set("tmdbId", String(item.tmdbId));
  q.set("mediaType", item.mediaType);
  if (item.season) q.set("season", String(item.season));
  if (item.episode) q.set("episode", String(item.episode));
  if (item.malId) q.set("malId", String(item.malId));
  if (item.title) q.set("title", item.title);
  if (item.provider) q.set("provider", item.provider);
  if (item.quality) q.set("quality", item.quality);
  if (item.language) q.set("language", item.language);
  const t = Math.floor(opts.startTime ?? 0);
  if (t > 0) q.set("t", String(t));
  if (opts.format === "json") q.set("format", "json");
  return q.toString();
}

export function vlcRouteUrl(
  item: HandoffItem,
  opts: { startTime?: number; format?: "m3u" | "json" } = {},
): string {
  return `/api/stream/vlc?${vlcRouteQuery(item, opts)}`;
}

/** Human title for the VLC window / playlist ("Show — S1 E4"). */
export function handoffTitle(item: {
  title?: string;
  mediaType?: "movie" | "tv";
  season?: number;
  episode?: number;
}): string {
  const base = (item.title || "Flyx").trim() || "Flyx";
  if (item.mediaType === "tv" && item.season != null && item.episode != null) {
    return `${base} — S${item.season} E${item.episode}`;
  }
  return base;
}

/**
 * Extended M3U playlist VLC opens directly. `#EXTVLCOPT:start-time` resumes
 * at the in-app position; `network-caching` keeps LAN HLS from stuttering.
 */
export function buildVlcPlaylist(entry: HandoffPlaylistInput): string {
  const title = entry.title.replace(/[\r\n]+/g, " ").trim() || "Flyx";
  const lines = ["#EXTM3U", `#EXTINF:-1,${title}`, "#EXTVLCOPT:network-caching=3000"];
  const start = Math.floor(entry.startTime ?? 0);
  if (start > 0) lines.push(`#EXTVLCOPT:start-time=${start}`);
  lines.push(entry.url);
  return lines.join("\n") + "\n";
}

/** Filename for a downloaded playlist ("Show — S1 E4.m3u"). */
export function playlistFilename(title: string): string {
  const cleaned = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${cleaned || "flyx-stream"}.m3u`;
}

// ── Launch strategy (browser side) ─────────────────────────────

export type LaunchStrategy = "desktop" | "android" | "ios" | "playlist";

export interface LaunchEnvironment {
  userAgent: string;
  /** true inside the Electron window with the openInVlc bridge available. */
  hasDesktopBridge: boolean;
}

/**
 * How this device can reach VLC:
 *  - desktop: Electron main process spawns VLC on the host machine
 *  - android: intent:// URL launches VLC for Android directly
 *  - ios:     vlc-x-callback:// launches VLC for iOS directly
 *  - playlist: any other browser downloads an .m3u the OS opens with VLC
 */
export function pickLaunchStrategy(env: LaunchEnvironment): LaunchStrategy {
  if (env.hasDesktopBridge) return "desktop";
  const ua = env.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "playlist";
}

/** intent:// URL that opens `url` in VLC for Android (falls back to the Play Store). */
export function androidIntentUrl(url: string, title: string, startTime = 0): string {
  const stripped = url.replace(/^https?:\/\//i, "");
  const scheme = /^https:/i.test(url) ? "https" : "http";
  const parts = [
    `scheme=${scheme}`,
    "action=android.intent.action.VIEW",
    "package=org.videolan.vlc",
    "type=video/*",
    `S.title=${encodeURIComponent(title)}`,
  ];
  const ms = Math.floor(startTime * 1000);
  if (ms > 0) parts.push(`l.position=${ms}`);
  parts.push("S.browser_fallback_url=" + encodeURIComponent("https://play.google.com/store/apps/details?id=org.videolan.vlc"));
  return `intent://${stripped}#Intent;${parts.join(";")};end`;
}

/** x-callback URL that opens `url` in VLC for iOS. */
export function iosCallbackUrl(url: string): string {
  return `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}`;
}
