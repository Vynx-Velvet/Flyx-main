/**
 * Provider registration index.
 *
 * Only working providers are registered.
 */

import { providerRegistry } from "../registry";
import type { Provider } from "../registry";

// VOD Providers
import { VideasyProvider } from "./videasy";
import { VidSrcProvider } from "./vidsrc";
import { MultiEmbedProvider } from "./multiembed";

// Anime Providers
import { AnimeXProvider } from "./animex";

// Manga Providers
import { WeebCentralProvider } from "./weebcentral";

// Subtitle Providers
import { OpenSubtitlesProvider } from "./opensubtitles";

// Live TV Providers
import { DLHDProvider } from "./dlhd";

function safeRegister(name: string, factory: () => Provider): void {
  try {
    providerRegistry.register(factory());
  } catch (err) {
    console.error(`Failed to register provider "${name}":`, (err as Error).message);
  }
}

// VOD
safeRegister("videasy", () => new VideasyProvider());
safeRegister("vidsrc", () => new VidSrcProvider());
safeRegister("multiembed", () => new MultiEmbedProvider());

// Anime
safeRegister("animex", () => new AnimeXProvider());

// Manga
safeRegister("weebcentral", () => new WeebCentralProvider());

// Subtitles
safeRegister("opensubtitles", () => new OpenSubtitlesProvider());

// Live TV
safeRegister("dlhd", () => new DLHDProvider());
