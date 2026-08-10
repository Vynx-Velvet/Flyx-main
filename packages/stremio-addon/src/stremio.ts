import type { StreamSource } from "@flyx/core";
import { buildProxyUrl, proxyOptionsFromSource } from "./proxy";
import type {
  ParsedStremioId,
  StremioContentType,
  StremioStream,
  StremioStreamResponse,
} from "./types";

export const MANIFEST = {
  id: "community.flyx.private",
  version: "1.0.0",
  name: "Flyx Streams",
  description: "Private movie and series streams powered by Flyx.",
  resources: [
    {
      name: "stream",
      types: ["movie", "series"],
      idPrefixes: ["tt"],
    },
  ],
  types: ["movie", "series"],
  catalogs: [],
} as const;

/** Parse Cinemeta IDs: tt1234567 for movies and tt1234567:S:E for series. */
export function parseStremioId(type: string, id: string): ParsedStremioId | null {
  if (type === "movie") {
    const match = /^(tt\d+)$/.exec(id);
    return match ? { imdbId: match[1]!, mediaType: "movie" } : null;
  }

  if (type === "series") {
    const match = /^(tt\d+):(\d+):(\d+)$/.exec(id);
    if (!match) return null;
    const season = Number(match[2]);
    const episode = Number(match[3]);
    if (!Number.isSafeInteger(season) || season < 0) return null;
    if (!Number.isSafeInteger(episode) || episode < 1) return null;
    return {
      imdbId: match[1]!,
      mediaType: "tv",
      season,
      episode,
    };
  }

  return null;
}

export function isStremioContentType(value: string): value is StremioContentType {
  return value === "movie" || value === "series";
}

function qualityScore(quality: string): number {
  const normalized = quality.toLowerCase();
  if (normalized.includes("auto")) return 10_000;
  if (normalized.includes("4k")) return 2_160;
  const numeric = normalized.match(/(\d{3,4})p?/);
  return numeric ? Number(numeric[1]) : 0;
}

function shouldProxy(source: StreamSource): boolean {
  return Boolean(
    source.requiresSegmentProxy ||
    source.referer ||
    source.origin ||
    source.userAgent ||
    source.tokenUrl,
  );
}

function toStremioStream(
  source: StreamSource,
  provider: string,
  proxyEndpoint: string,
): StremioStream {
  const sourceName = source.title?.trim() || provider;
  const format = source.type.toUpperCase();
  const url = shouldProxy(source)
    ? buildProxyUrl(proxyEndpoint, source.url, proxyOptionsFromSource(source))
    : source.url;

  return {
    name: "Flyx",
    title: `${sourceName}\n${source.quality} • ${format}`,
    url,
  };
}

export function buildStreamResponse(
  sources: StreamSource[],
  provider: string,
  proxyEndpoint: string,
): StremioStreamResponse {
  const sorted = sources
    .map((source, index) => ({ source, index }))
    .sort(
      (a, b) =>
        qualityScore(b.source.quality) - qualityScore(a.source.quality) || a.index - b.index,
    )
    .map(({ source }) => toStremioStream(source, provider, proxyEndpoint));

  return { streams: sorted };
}
