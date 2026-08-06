// Stream proxy configuration — ported from Flyx 2.0

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

export async function getAvailableBackends(
  _channelId: string,
): Promise<BackendInfo[]> {
  return [
    { id: "primary", isPrimary: true, label: "Primary (DLHD)" },
    { id: "secondary", isPrimary: false, label: "Secondary" },
    { id: "fallback", isPrimary: false, label: "Fallback" },
  ];
}

export function resolveBackendId(serverUrl: string): string {
  if (!serverUrl) return "primary";
  return serverUrl.split("/").pop() ?? "primary";
}
