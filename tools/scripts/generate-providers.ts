/**
 * Provider file generator.
 *
 * Generates all provider stub files from a single data structure.
 * Run: npx tsx tools/scripts/generate-providers.ts
 *
 * Each provider is ~15-20 lines. Only doExtract() varies.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PROVIDERS_DIR = join(import.meta.dirname, "../../packages/providers/src/providers");

interface ProviderDef {
  name: string;           // e.g. "flixer"
  className: string;      // e.g. "FlixerProvider"
  priorityKey: string;    // e.g. "FLIXER"
  categories: string[];   // e.g. ["movie", "tv"]
  baseClass: "BaseProvider" | "BaseAnimeProvider" | "BaseLiveTVProvider";
  extractorModule: string; // e.g. "flixer"
  extractorFn: string;    // e.g. "extractFlixer"
  extractorArgs: string;  // e.g. "request.tmdbId, request.mediaType, request.season, request.episode"
}

const PROVIDERS: ProviderDef[] = [
  // === VOD (BaseProvider) ===
  { name: "videasy", className: "VideasyProvider", priorityKey: "VIDEASY", categories: ["movie","tv"], baseClass: "BaseProvider", extractorModule: "videasy", extractorFn: "extractVideasy", extractorArgs: "request.tmdbId, request.mediaType, request.season, request.episode" },
  { name: "vidlink", className: "VidLinkProvider", priorityKey: "VIDLINK", categories: ["movie","tv"], baseClass: "BaseProvider", extractorModule: "vidlink", extractorFn: "extractVidLink", extractorArgs: "request.tmdbId, request.mediaType, request.season, request.episode" },
  { name: "vidsrc", className: "VidSrcProvider", priorityKey: "VIDSRC", categories: ["movie","tv"], baseClass: "BaseProvider", extractorModule: "vidsrc", extractorFn: "extractVidSrc", extractorArgs: "request.tmdbId, request.mediaType, request.season, request.episode" },
  { name: "multiembed", className: "MultiEmbedProvider", priorityKey: "MULTI_EMBED", categories: ["movie","tv"], baseClass: "BaseProvider", extractorModule: "multiembed", extractorFn: "extractMultiEmbed", extractorArgs: "request.tmdbId, request.mediaType, request.season, request.episode" },
  { name: "bingebox", className: "BingeBoxProvider", priorityKey: "BINGEBOX", categories: ["movie","tv"], baseClass: "BaseProvider", extractorModule: "bingebox", extractorFn: "extractBingeBox", extractorArgs: "request.tmdbId, request.mediaType, request.season, request.episode" },
  { name: "moviebox", className: "MovieBoxProvider", priorityKey: "MOVIEBOX", categories: ["movie","tv"], baseClass: "BaseProvider", extractorModule: "moviebox", extractorFn: "extractMovieBox", extractorArgs: "request.tmdbId, request.mediaType, request.season, request.episode" },
  { name: "primesrc", className: "PrimeSrcProvider", priorityKey: "PRIMESRC", categories: ["movie","tv"], baseClass: "BaseProvider", extractorModule: "primesrc", extractorFn: "extractPrimeSrc", extractorArgs: "request.tmdbId, request.mediaType, request.season, request.episode" },
  { name: "uflix", className: "UflixProvider", priorityKey: "UFLIX", categories: ["movie","tv"], baseClass: "BaseProvider", extractorModule: "uflix", extractorFn: "extractUflix", extractorArgs: "request.tmdbId, request.mediaType, request.season, request.episode" },
  { name: "vidcore", className: "VidCoreProvider", priorityKey: "VIDCORE", categories: ["movie","tv"], baseClass: "BaseProvider", extractorModule: "vidcore", extractorFn: "extractVidCore", extractorArgs: "request.tmdbId, request.mediaType, request.season, request.episode" },

  // === Anime (BaseAnimeProvider) ===
  { name: "animex", className: "AnimeXProvider", priorityKey: "ANIMEX", categories: ["anime"], baseClass: "BaseAnimeProvider", extractorModule: "animex", extractorFn: "extractAnimeX", extractorArgs: "request.tmdbId, request.malId, request.season, request.episode, request.title || request.malTitle" },

  // === Live TV (BaseLiveTVProvider) ===
  { name: "dlhd", className: "DLHDProvider", priorityKey: "DLHD", categories: ["live-tv","live-sports"], baseClass: "BaseLiveTVProvider", extractorModule: "dlhd", extractorFn: "extractDLHD", extractorArgs: "request.title ?? \"\"" },
  { name: "ntv", className: "NTVProvider", priorityKey: "NTV", categories: ["live-tv","live-sports"], baseClass: "BaseLiveTVProvider", extractorModule: "ntv", extractorFn: "extractNTV", extractorArgs: "request.title ?? \"\"" },
  { name: "globetv", className: "GlobeTVProvider", priorityKey: "GLOBETV", categories: ["live-tv"], baseClass: "BaseLiveTVProvider", extractorModule: "globetv", extractorFn: "extractGlobeTV", extractorArgs: "request.title ?? \"\"" },
  { name: "cdnlive", className: "CDNLiveProvider", priorityKey: "CDN_LIVE", categories: ["live-tv"], baseClass: "BaseLiveTVProvider", extractorModule: "cdnlive", extractorFn: "extractCDNLive", extractorArgs: "request.title ?? \"\"" },
  { name: "streamninja", className: "StreamNinjaProvider", priorityKey: "STREAMNINJA", categories: ["live-tv","live-sports"], baseClass: "BaseLiveTVProvider", extractorModule: "streamninja", extractorFn: "extractStreamNinja", extractorArgs: "request.title ?? \"\"" },
  { name: "ppv", className: "PPVProvider", priorityKey: "PPV", categories: ["ppv"], baseClass: "BaseLiveTVProvider", extractorModule: "ppv", extractorFn: "extractPPV", extractorArgs: "request.title ?? \"\"" },
  { name: "viprow", className: "VIPRowProvider", priorityKey: "VIPROW", categories: ["live-sports"], baseClass: "BaseLiveTVProvider", extractorModule: "viprow", extractorFn: "extractVIPRow", extractorArgs: "request.title ?? \"\"" },
];

function generateProviderFile(def: ProviderDef): string {
  const needsMAL = def.baseClass === "BaseAnimeProvider";
  const needsCategories = def.baseClass === "BaseProvider" || def.baseClass === "BaseLiveTVProvider";

  // Build import for the base class
  const baseImport = def.baseClass === "BaseProvider"
    ? "BaseProvider"
    : def.baseClass;

  return `/**
 * ${def.className} — ${def.categories.join("/")} content provider.
 *
 * Auto-generated from tools/scripts/generate-providers.ts
 */

import type { ${needsCategories ? "ContentCategory, " : ""}ExtractionRequest, StreamSource, SubtitleTrack } from "@flyx/core";
import { PROVIDER_PRIORITIES } from "@flyx/config";
import { ${def.extractorFn} } from "@flyx/extractors/services";
import { ${baseImport} } from "../base";

export class ${def.className} extends ${baseImport} {
  readonly name = "${def.name}";
  readonly priority = PROVIDER_PRIORITIES.${def.priorityKey};${needsCategories ? `\n  readonly supportedContent: ContentCategory[] = ${JSON.stringify(def.categories)};` : ""}

  protected async doExtract(request: ExtractionRequest): Promise<{
    sources: StreamSource[];
    subtitles?: SubtitleTrack[];
  }> {
    const result = await ${def.extractorFn}(${def.extractorArgs});
    return { sources: result.sources ?? [], subtitles: result.subtitles ?? [] };
  }
}
`;
}

// Generate all files
mkdirSync(PROVIDERS_DIR, { recursive: true });

for (const def of PROVIDERS) {
  const code = generateProviderFile(def);
  const filePath = join(PROVIDERS_DIR, `${def.name}.ts`);
  writeFileSync(filePath, code, "utf-8");
  console.log(`  ✓ ${def.name}.ts`);
}

console.log(`\nGenerated ${PROVIDERS.length} provider files`);
