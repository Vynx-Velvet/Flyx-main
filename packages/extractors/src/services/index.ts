/**
 * Extractor service barrel — one import for all extraction functions.
 */

// VOD Extractors
export { extractVideasy } from "./videasy";
export { extractVidLink } from "./vidlink";
export { extractVidSrc } from "./vidsrc";
export { extractMultiEmbed } from "./multiembed";
export { extractBingeBox } from "./bingebox";
export { extractMovieBox } from "./moviebox";
export { extractPrimeSrc } from "./primesrc";
export { extractUflix } from "./uflix";
// VidCore API (vidcore.org) is dead (404) — extractor kept for reference only

// Anime Extractors
export { extractAnimeX, searchAnime, getEpisodes } from "./animex";

// Manga Extractors
export {
  searchManga,
  getMangaDetails,
  getMangaDetailsWithChapters,
  getChapterPages,
  getPopularManga,
  getLatestManga,
  getActionManga,
  getRomanceManga,
  getFantasyManga,
  buildPageUrl,
} from "./weebcentral";

// Live TV Extractors
export { extractDLHD } from "./dlhd";

// Subtitle Extractors
export { extractOpenSubtitles } from "./opensubtitles";
export type { OpenSubtitlesResult } from "./opensubtitles";
// OpenSubtitles site scraper (shared with the app's subtitle download route)
export {
  searchOpenSubtitles,
  fetchOpenSubtitlesZip,
  fetchWithSession,
  AnubisBlockedError,
  OSDownloadError,
} from "./opensubtitles-html";
export type {
  OSSubRow,
  OSSearchParams,
  OSSearchResult,
  OSFetchError,
} from "./opensubtitles-html";

// VidSrc Token Registry (shared with stream proxy)
export { registerTokenUrls, getTokenUrl, clearTokenRegistry } from "./vidsrc-token-registry";
