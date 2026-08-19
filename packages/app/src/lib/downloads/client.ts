/**
 * Client-side download delivery.
 *
 * Downloads are split into two delivery paths depending on *where the user
 * is*:
 *
 *  - Host (the desktop app's Electron window): POST /api/downloads, which
 *    writes to the configured download folder on the host and tracks jobs on
 *    the Downloads page.
 *  - Remote device (phone / LAN browser / hosted web): GET /api/downloads/
 *    stream, which streams the finished file straight to that browser so it
 *    lands on the user's device, not the host machine.
 */

import type { DownloadItemInput } from "./types";

/** True only inside the Electron desktop window (the instance host). */
export function isDesktopHost(): boolean {
  if (typeof window === "undefined") return false;
  const bridge = (window as unknown as { flyxDesktop?: { isDesktop?: boolean } })
    .flyxDesktop;
  return Boolean(bridge?.isDesktop);
}

export function buildStreamUrl(item: DownloadItemInput): string {
  const q = new URLSearchParams();
  if (item.kind === "manga") {
    q.set("kind", "manga");
    q.set("mangaId", item.mangaId);
    q.set("chapter", String(item.chapter));
    if (item.title) q.set("title", item.title);
  } else {
    q.set("kind", "video");
    q.set("tmdbId", String(item.tmdbId));
    q.set("mediaType", item.mediaType);
    if (item.season) q.set("season", String(item.season));
    if (item.episode) q.set("episode", String(item.episode));
    if (item.malId) q.set("malId", String(item.malId));
    if (item.title) q.set("title", item.title);
    if (item.provider) q.set("provider", item.provider);
    if (item.quality) q.set("quality", item.quality);
    if (item.language) q.set("language", item.language);
  }
  return `/api/downloads/stream?${q.toString()}`;
}

/** Trigger a same-origin browser download (works on phones / LAN browsers). */
export function triggerStreamDownload(item: DownloadItemInput): void {
  const a = document.createElement("a");
  a.href = buildStreamUrl(item);
  a.download = "";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export interface DeliverResult {
  ok: boolean;
  /** true = queued on host, false = streamed to this device */
  host: boolean;
  error?: string;
  count?: number;
}

export async function deliverDownloads(
  items: DownloadItemInput[],
): Promise<DeliverResult> {
  if (items.length === 0) {
    return { ok: false, host: isDesktopHost(), error: "Nothing to download" };
  }

  if (isDesktopHost()) {
    try {
      // The API caps a single request at 100 items — chunk so bulk downloads
      // (a whole anime series, a long manga) work regardless of size.
      const MAX_PER_REQUEST = 100;
      let queued = 0;
      for (let i = 0; i < items.length; i += MAX_PER_REQUEST) {
        const chunk = items.slice(i, i + MAX_PER_REQUEST);
        const res = await fetch("/api/downloads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: chunk }),
        });
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (!res.ok || !data.ok) {
          return {
            ok: false,
            host: true,
            error: (data.error as string) || "Failed to queue download",
          };
        }
        queued += chunk.length;
      }
      return { ok: true, host: true, count: queued };
    } catch {
      return { ok: false, host: true, error: "Network error" };
    }
  }

  // Remote device — stream each file to this browser. Stagger slightly so
  // bulk requests don't trip a browser's simultaneous-download guard.
  items.forEach((item, i) => {
    setTimeout(() => triggerStreamDownload(item), i * 400);
  });
  return { ok: true, host: false, count: items.length };
}
