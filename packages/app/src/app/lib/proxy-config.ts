// Live TV proxy configuration.
//
// `getTvPlaylistUrl` builds the API URL the browser hits to resolve a
// channel ID into an HLS playlist URL (routed through /api/livetv/stream
// which calls extractDLHD server-side).
//
// `getAvailableBackends` fetches the server-side list of upstream CDN
// backends exposed at /api/livetv/backends. The browser does *not* learn
// raw upstream hostnames — the server writes them into the M3U8 proxy URL
// as the `origin` parameter.

export interface BackendInfo {
  id: string;
  isPrimary: boolean;
  label: string;
  status?: "online" | "offline" | "timeout" | "unknown";
}

export function getTvPlaylistUrl(
  channelId: string,
  provider?: string,
  backendId?: string,
): string {
  const base = process.env.NEXT_PUBLIC_TV_PROXY_URL ?? "/api/livetv";
  const params = new URLSearchParams({ channel: channelId });
  if (provider) params.set("provider", provider);
  if (backendId) params.set("backend", backendId);
  return `${base}/stream?${params}`;
}

/**
 * Fetch the list of upstream CDN backends available for `channelId`.
 * Returns an empty array on error so the UI degrades gracefully — the
 * "Switch Server" menu simply disappears.
 */
export async function getAvailableBackends(
  channelId: string,
): Promise<BackendInfo[]> {
  try {
    const r = await fetch(
      `/api/livetv/backends?channel=${encodeURIComponent(channelId)}`,
      { cache: "no-store" },
    );
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data?.backends) ? data.backends : [];
  } catch {
    return [];
  }
}