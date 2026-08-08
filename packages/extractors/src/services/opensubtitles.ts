/**
 * OpenSubtitles extractor — FREE, no API key required.
 *
 * Uses the public opensubtitles.org XML-RPC API which needs only a
 * User-Agent. No login, no token, no rate-limit accounts.
 *
 * Flow:
 *   1. Look up IMDB ID from TMDB ID (via public TMDB API)
 *   2. XML-RPC SearchSubtitles by IMDB ID + season/episode
 *   3. Pick best subtitle per language (by download count)
 *   4. Return SubtitleTrack[] pointing at our proxy endpoint
 *
 * The proxy endpoint downloads+converts SRT→VTT on demand.
 */

import type { SubtitleTrack } from "@flyx/core";

const XMLRPC_URL = "https://api.opensubtitles.org/xml-rpc";
const UA = "Flyx v3.0";

/** Preferred subtitle languages in priority order. */
const DEFAULT_LANGS = ["eng", "spa", "fre", "ger", "por", "ita", "jpn", "kor", "chi", "ara", "rus", "hin"];

interface OSSubtitle {
  IDSubtitle: string;
  IDSubMovieFile: string;
  SubFileName: string;
  SubDownloadLink: string;
  SubFormat: string;
  LanguageName: string;
  ISO639: string;
  SubDownloadsCnt: string;
  SubRating: string;
  SubHearingImpaired: string;
  MatchedBy: string;
  UserNickName: string;
  SubAddDate: string;
  ZipDownloadLink?: string;
  MovieName?: string;
  MovieYear?: string;
  MovieImdbID?: string;
  SeriesSeason?: string;
  SeriesEpisode?: string;
}

// ── Tiny XML-RPC helpers ──────────────────────────────────────

function xmlRpcCall(method: string, params: unknown[]): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const val = (v: unknown): string => {
    if (typeof v === "string") return `<value><string>${esc(v)}</string></value>`;
    if (typeof v === "number") return `<value><int>${v}</int></value>`;
    if (typeof v === "boolean") return `<value><boolean>${v ? 1 : 0}</boolean></value>`;
    if (Array.isArray(v)) {
      return `<value><array><data>${v.map(val).join("")}</data></array></value>`;
    }
    if (v && typeof v === "object") {
      const members = Object.entries(v as Record<string, unknown>)
        .map(([k, val2]) => `<member><name>${esc(k)}</name>${val(val2)}</member>`)
        .join("");
      return `<value><struct>${members}</struct></value>`;
    }
    return `<value><string>${esc(String(v ?? ""))}</string></value>`;
  };
  const paramElements = params.map((p) => `<param>${val(p)}</param>`).join("");
  return `<?xml version="1.0"?><methodCall><methodName>${esc(method)}</methodName><params>${paramElements}</params></methodCall>`;
}

function parseXmlRpcResponse(xml: string): unknown {
  // Extract the first <param><value>...</value></param> content
  const valueMatch = xml.match(/<param>\s*<value>(.*?)<\/value>\s*<\/param>/s);
  if (!valueMatch?.[1]) return null;
  return parseValue(valueMatch[1]);
}

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();
  // String
  const strMatch = trimmed.match(/^<string>(.*?)<\/string>$/s);
  if (strMatch) return strMatch[1];
  // Int
  const intMatch = trimmed.match(/^<int>(\d+)<\/int>$/);
  if (intMatch?.[1]) return parseInt(intMatch[1], 10);
  // Boolean
  const boolMatch = trimmed.match(/^<boolean>(\d)<\/boolean>$/);
  if (boolMatch) return boolMatch[1] === "1";
  // Array
  const arrMatch = trimmed.match(/^<array><data>(.*?)<\/data><\/array>$/s);
  if (arrMatch?.[1]) {
    const items = arrMatch[1].match(/<value>(.*?)<\/value>/gs);
    return items ? items.map((v) => parseValue(v.replace(/<\/?value>/g, ""))) : [];
  }
  // Struct
  const structMatch = trimmed.match(/^<struct>(.*?)<\/struct>$/s);
  if (structMatch) {
    const obj: Record<string, unknown> = {};
    const memberRegex = /<member>\s*<name>(.*?)<\/name>\s*<value>(.*?)<\/value>\s*<\/member>/gs;
    const body = structMatch[1]!;
    let m: RegExpExecArray | null;
    while ((m = memberRegex.exec(body)) !== null) {
      const key = m[1]!;
      obj[key] = parseValue(m[2]!);
    }
    return obj;
  }
  return trimmed.replace(/<[^>]+>/g, "");
}

// ── IMDB ID lookup ────────────────────────────────────────────

let _imdbCache = new Map<number, string | null>();

async function tmdbToImdb(tmdbId: number, mediaType: "movie" | "tv"): Promise<string | null> {
  const cacheKey = tmdbId * 10 + (mediaType === "tv" ? 1 : 0);
  const cached = _imdbCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) {
      _imdbCache.set(cacheKey, null);
      return null;
    }

    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${tmdbKey}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      _imdbCache.set(cacheKey, null);
      return null;
    }

    const data = await res.json();
    const imdbId = data.imdb_id ?? null;
    _imdbCache.set(cacheKey, imdbId);
    return imdbId;
  } catch {
    _imdbCache.set(cacheKey, null);
    return null;
  }
}

// ── XML-RPC calls ─────────────────────────────────────────────

async function searchSubtitles(
  imdbId: string,
  season?: number,
  episode?: number,
  languages?: string,
): Promise<OSSubtitle[]> {
  const queryParams: Record<string, unknown> = {
    imdbid: imdbId,
    sublanguageid: languages ?? DEFAULT_LANGS.join(","),
  };

  if (season != null && episode != null) {
    queryParams.season = season;
    queryParams.episode = episode;
  }

  const body = xmlRpcCall("SearchSubtitles", [queryParams]);

  try {
    const res = await fetch(XMLRPC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
        "User-Agent": UA,
      },
      body,
    });

    if (!res.ok) {
      console.warn(`[opensubtitles] Search HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const parsed = parseXmlRpcResponse(xml);

    // Response is either an array of structs or an empty struct
    if (Array.isArray(parsed)) {
      return parsed as OSSubtitle[];
    }

    return [];
  } catch (err) {
    console.warn("[opensubtitles] Search failed:", (err as Error).message);
    return [];
  }
}

export interface OpenSubtitlesResult {
  subtitles: SubtitleTrack[];
}

/**
 * Extract subtitles from opensubtitles.org for a given TMDB ID.
 * No API key needed — uses the free public XML-RPC API.
 */
export async function extractOpenSubtitles(
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number,
  preferredLanguages?: string,
): Promise<OpenSubtitlesResult> {
  if (!tmdbId || tmdbId <= 0) {
    return { subtitles: [] };
  }

  try {
    // Step 1: TMDB ID → IMDB ID
    const imdbId = await tmdbToImdb(tmdbId, mediaType);
    if (!imdbId) {
      console.log(`[opensubtitles] No IMDB ID for TMDB ${tmdbId}`);
      return { subtitles: [] };
    }

    // Step 2: Search OpenSubtitles
    const results = await searchSubtitles(imdbId, season, episode, preferredLanguages);
    if (results.length === 0) {
      console.log(`[opensubtitles] No subtitles for IMDB ${imdbId}`);
      return { subtitles: [] };
    }

    // Step 3: Pick best per language (highest download count)
    const bestPerLang = new Map<string, OSSubtitle>();
    for (const r of results) {
      const lang = (r.ISO639 || r.LanguageName || "unknown").toLowerCase();
      const existing = bestPerLang.get(lang);
      const downloads = parseInt(r.SubDownloadsCnt ?? "0", 10);
      if (!existing || downloads > parseInt(existing.SubDownloadsCnt ?? "0", 10)) {
        bestPerLang.set(lang, r);
      }
    }

    // Step 4: Build SubtitleTrack list
    const subtitles: SubtitleTrack[] = [];
    for (const [, sub] of bestPerLang) {
      const dlLink = sub.SubDownloadLink || sub.ZipDownloadLink;
      if (!dlLink) continue;

      const isCC = sub.SubHearingImpaired === "1";
      const langCode = sub.ISO639 || "en";
      const langName = sub.LanguageName || langCode.toUpperCase();

      subtitles.push({
        label: isCC ? `${langName} [CC]` : langName,
        url: `/api/subtitles/proxy?url=${encodeURIComponent(dlLink)}`,
        language: langCode,
        isCC,
      });
    }

    console.log(
      `[opensubtitles] Fetched ${subtitles.length} tracks for IMDB ${imdbId} (TMDB ${tmdbId})`,
    );
    return { subtitles };
  } catch (err) {
    console.error("[opensubtitles] Error:", err);
    return { subtitles: [] };
  }
}
