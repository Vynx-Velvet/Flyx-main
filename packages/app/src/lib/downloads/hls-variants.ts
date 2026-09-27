/**
 * HLS master-playlist variants for downloads.
 *
 * Most providers return one HLS *master* playlist labelled "Auto", so the
 * download dialog used to offer nothing but "Best available". The real
 * choices (1080p / 720p / 480p …) live inside that playlist as
 * `#EXT-X-STREAM-INF` entries. This module reads them so the dialog can list
 * them, and swaps the chosen variant in for the master before the download
 * starts so the pick is actually honoured.
 *
 * The parser and the picker are pure (unit-tested); `fetchVariants` and
 * `resolveSourceForQuality` do the network work.
 */

import type { StreamSource } from "@flyx/core";
import { qualityScore } from "./source-picker";
import { buildLocalProxyUrl } from "./proxy-url";

/** Standard tiers a variant is labelled with, by the larger of height and 16:9-width-height. */
const TIERS = [2160, 1440, 1080, 720, 480, 360, 240];

/**
 * "1080p"-style label for a variant. Cinema-ratio streams (1920x800) are
 * labelled by width so they read as the tier viewers expect (1080p), not
 * "800p".
 */
export function tierLabel(width: number, height: number): string {
  const effective = Math.max(height, Math.round((width * 9) / 16));
  if (!effective) return "Auto";
  let best = TIERS[TIERS.length - 1]!;
  for (const t of TIERS) {
    if (effective >= t * 0.9) {
      best = t;
      break;
    }
  }
  return `${best}p`;
}

/**
 * The stream proxy rewrites playlist URIs to /api/stream/proxy?...&url=<abs>;
 * recover the absolute upstream URL from such a line (or resolve it as-is).
 */
export function unwrapProxiedUri(uri: string, baseUrl: string): string {
  if (uri.includes("/api/stream/proxy?")) {
    try {
      const q = new URL(uri, "http://localhost").searchParams.get("url");
      if (q) return q;
    } catch {
      /* fall through */
    }
  }
  return new URL(uri, baseUrl).href;
}

export interface HlsVariant {
  /** Absolute media-playlist URL. */
  url: string;
  height: number;
  width: number;
  bandwidth: number;
  /** "1080p" style label (falls back to bandwidth when RESOLUTION is absent). */
  label: string;
}

/** Labels that mean "the provider did not say" — expand these into variants. */
export function isGenericQuality(label: string | undefined | null): boolean {
  const q = (label || "").trim().toLowerCase();
  return q === "" || q === "auto" || q === "hls" || q === "default" || q === "best";
}

function attrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Z0-9-]+)=("([^"]*)"|[^,]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out[m[1]!] = m[3] ?? m[2] ?? "";
  return out;
}

/** Parse `#EXT-X-STREAM-INF` entries of a master playlist. Returns [] for media playlists. */
export function parseMasterVariants(text: string, baseUrl: string): HlsVariant[] {
  const lines = text.split(/\r?\n/);
  const variants: HlsVariant[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    let j = i + 1;
    while (j < lines.length && (lines[j]!.trim() === "" || lines[j]!.trim().startsWith("#"))) j++;
    const uri = lines[j]?.trim();
    if (!uri) continue;
    const a = attrs(line);
    const [w, h] = (a.RESOLUTION || "").split("x").map((n) => parseInt(n, 10));
    const bandwidth = parseInt(a.BANDWIDTH || "0", 10) || 0;
    const height = Number.isFinite(h) ? h! : 0;
    const width = Number.isFinite(w) ? w! : 0;
    let url: string;
    try {
      url = unwrapProxiedUri(uri, baseUrl);
    } catch {
      continue;
    }
    variants.push({
      url,
      width,
      height,
      bandwidth,
      label: height > 0 || width > 0 ? tierLabel(width, height) : bandwidth > 0 ? `${Math.round(bandwidth / 1000)} kbps` : "Auto",
    });
    i = j;
  }
  // Highest first; de-duplicate equal labels keeping the higher bandwidth.
  const byLabel = new Map<string, HlsVariant>();
  for (const v of variants.sort((x, y) => y.height - x.height || y.bandwidth - x.bandwidth)) {
    if (!byLabel.has(v.label)) byLabel.set(v.label, v);
  }
  return [...byLabel.values()];
}

/** Pick the variant matching a "1080p"-style label (exact, else closest by height). */
export function pickVariant(variants: HlsVariant[], quality: string | undefined): HlsVariant | null {
  if (!variants.length) return null;
  if (!quality || isGenericQuality(quality)) return variants[0]!;
  const wanted = quality.trim().toLowerCase();
  const exact = variants.find((v) => v.label.toLowerCase() === wanted);
  if (exact) return exact;
  const target = qualityScore(quality);
  if (!target) return variants[0]!;
  // Compare by tier (the label), not raw pixel height — a 1920x800 stream is
  // the "1080p" option and should win a 1080p request over a 1280x534 one.
  const tier = (v: HlsVariant) => qualityScore(v.label) || v.height;
  return [...variants].sort(
    (a, b) => Math.abs(tier(a) - target) - Math.abs(tier(b) - target) || b.bandwidth - a.bandwidth,
  )[0]!;
}

/**
 * The master must be fetched exactly like the player fetches it: through our
 * own stream proxy, which adds provider tokens (VidSrc's IP-bound `token=`),
 * Referer/Origin and relaxed TLS. A direct fetch gets "401 no token" and the
 * dialog would fall back to "Auto". The proxy URL is signed because this
 * server-side fetch carries no session cookie.
 */
function localProxyUrl(source: StreamSource): string {
  return buildLocalProxyUrl(source, 10 * 60);
}

/** Fetch and parse a master playlist. Empty array on any failure or for media playlists. */
export async function fetchVariants(source: StreamSource, timeoutMs = 10000): Promise<HlsVariant[]> {
  if (source.type === "mp4") return [];
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), timeoutMs);
    const r = await fetch(localProxyUrl(source), { signal: c.signal, cache: "no-store" });
    clearTimeout(t);
    if (!r.ok) return [];
    const text = await r.text();
    if (!text.trim().startsWith("#EXTM3U")) return [];
    return parseMasterVariants(text, source.url);
  } catch {
    return [];
  }
}

/**
 * Quality labels a set of sources can really deliver: explicit provider
 * labels as-is, generic HLS masters expanded into their variants.
 */
export async function listDeliverableQualities(sources: StreamSource[]): Promise<string[]> {
  const labels = new Map<string, number>();
  const add = (label: string) => {
    const l = label.trim();
    if (!l || isGenericQuality(l)) return;
    labels.set(l, Math.max(labels.get(l) ?? 0, qualityScore(l)));
  };
  await Promise.all(
    sources
      .filter((s) => s?.url)
      .map(async (s) => {
        if (!isGenericQuality(s.quality)) {
          add(s.quality);
          return;
        }
        for (const v of await fetchVariants(s)) add(v.label);
      }),
  );
  return [...labels.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
}

/**
 * Make a requested quality real: when the chosen source is a generic HLS
 * master, replace its URL with the matching variant playlist. Sources with
 * explicit labels (or MP4s) are returned unchanged.
 */
export async function resolveSourceForQuality(
  source: StreamSource,
  quality: string | undefined,
): Promise<StreamSource> {
  if (!quality || isGenericQuality(quality) || !isGenericQuality(source.quality) || source.type === "mp4") {
    return source;
  }
  const variants = await fetchVariants(source);
  const pick = pickVariant(variants, quality);
  if (!pick) return source;
  return { ...source, url: pick.url, quality: pick.label };
}
