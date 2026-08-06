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
export { extractVidCore } from "./vidcore";

// Anime Extractors
export { extractAnimeX, searchAnime, getEpisodes } from "./animex";

// Manga Extractors
export {
  searchManga,
  getMangaDetails,
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
