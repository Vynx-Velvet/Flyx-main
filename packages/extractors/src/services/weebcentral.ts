/**
 * WeebCentral Manga Extractor — weebcentral.com + planeptune CDN.
 *
 * Reverse-engineered API surface (verified 2026-08-05):
 *
 * Site: server-rendered FastAPI + htmx fragments + Alpine.js
 * Auth: none required for read endpoints. Browser UA required (Cloudflare filter).
 * IDs:  ULIDs (26-char Crockford base32)
 *
 * Endpoints:
 *   GET /search/data?text=&author=&sort=&order=&anime=&adult=&included_status=&included_type=&display_mode=
 *       → HTML fragment of result articles (no pagination)
 *   GET /series/{ulid}/{slug}            → series page (metadata, server-rendered)
 *   GET /series/{ulid}/full-chapter-list → HTML fragment, ALL chapters
 *   GET /chapters/{ulid}                 → chapter page (first img, max_page, prev/next, history)
 *   GET /chapters/{ulid}/images?is_prev=False&current_page=1
 *       → HTML fragment with ALL page <img> tags (GROUND TRUTH for page list)
 *
 * Image CDN (per-series host — PARSED from chapter page, NEVER guessed):
 *   https://{sub}.{nation}.us/manga/{seriesSlug}/{chapter:04d}-{page:03d}.png
 *   Known hosts: hot.planeptune.us, scans-hot.planeptune.us,
 *                scans.lastation.us, official.lowee.us
 *   No Referer/auth needed. Just browser UA.
 *
 * Cover images: https://temp.compsci88.com/cover/{size}/{ulid}.{webp|jpg}
 */

import type { MangaData, ChapterData, MangaPageData, MangaCard, MangaStatus } from "@flyx/core";

// ── Constants ────────────────────────────────────────────────────────────────

const BASE = "https://weebcentral.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const PREFIX = "[WeebCentral]";

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function wcFetch(path: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── Search ───────────────────────────────────────────────────────────────────

interface WeebSearchItem {
  id: string;          // ULID
  slug: string;
  title: string;
  coverNormal?: string;
  coverSmall?: string;
  coverFallback?: string;
  official: boolean;
}

/**
 * Search WeebCentral for manga.
 * @param text  Search query (param is `text`, NOT `query`)
 * @param sort  "Best Match" | "Alphabet" | "Popularity" | "Subscribers" | "Recently Added" | "Latest Updates"
 * @param includedStatus  "Ongoing" | "Complete" | "Hiatus" | "Canceled"
 */
async function wcSearch(
  text: string,
  opts?: { sort?: string; includedStatus?: string[]; includedType?: string[] },
): Promise<WeebSearchItem[]> {
  const params = new URLSearchParams({
    text: text || "",
    author: "",
    sort: opts?.sort || "Best Match",
    order: "Descending",
    anime: "Any",
    adult: "Any",
    display_mode: "Full Display",
  });
  for (const s of opts?.includedStatus || []) {
    params.append("included_status", s);
  }
  for (const t of opts?.includedType || []) {
    params.append("included_type", t);
  }

  const html = await wcFetch(`/search/data?${params.toString()}`);
  return parseSearchResults(html);
}

function parseSearchResults(html: string): WeebSearchItem[] {
  const results: WeebSearchItem[] = [];
  const seen = new Set<string>();

  // Match series links: /series/{ULID}/{slug}
  const linkPattern = /<a href="https:\/\/weebcentral\.com\/series\/([0-9A-Z]+)\/([^"]+)"[^>]*>/g;
  const blocks: Array<{ sid: string; slug: string; html: string }> = [];

  // Find all link blocks with surrounding context
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const sid = match[1]!;
    const slug = match[2]!;
    // Get context around this match
    const start = Math.max(0, match.index - 500);
    const end = Math.min(html.length, match.index + 2500);
    blocks.push({ sid, slug, html: html.substring(start, end) });
  }

  for (const block of blocks) {
    if (seen.has(block.sid)) continue;
    seen.add(block.sid);

    // Title from line-clamp or text-ellipsis span
    let title = block.slug.replace(/-/g, " ");
    const titleMatch = block.html.match(/class="line-clamp-1 link link-hover">([^<]+)</);
    if (titleMatch) {
      title = titleMatch[1]!.trim();
    } else {
      const altMatch = block.html.match(/class="text-ellipsis[^"]*">([^<]+)<\/span>/);
      if (altMatch) title = altMatch[1]!.trim();
    }

    // Cover images from temp.compsci88.com
    const coverNormal = block.html.match(/srcset="https:\/\/temp\.compsci88\.com\/cover\/normal\/([^"]+)"/)?.[1]
      || block.html.match(/src="https:\/\/temp\.compsci88\.com\/cover\/normal\/([^"]+)"/)?.[1];
    const coverSmall = block.html.match(/srcset="https:\/\/temp\.compsci88\.com\/cover\/small\/([^"]+)"/)?.[1]
      || block.html.match(/src="https:\/\/temp\.compsci88\.com\/cover\/small\/([^"]+)"/)?.[1];
    const coverFallback = block.html.match(/srcset="https:\/\/temp\.compsci88\.com\/cover\/fallback\/([^"]+)"/)?.[1]
      || block.html.match(/src="https:\/\/temp\.compsci88\.com\/cover\/fallback\/([^"]+)"/)?.[1];

    results.push({
      id: block.sid,
      slug: block.slug,
      title,
      coverNormal,
      coverSmall,
      coverFallback,
      official: /chapter-badge|>Official</i.test(block.html),
    });
  }

  return results;
}

// ── Conversion helpers ───────────────────────────────────────────────────────

function toMangaCard(item: WeebSearchItem): MangaCard {
  return {
    id: item.slug,
    title: item.title,
    coverImage: item.coverNormal
      ? `https://temp.compsci88.com/cover/normal/${item.coverNormal}`
      : item.coverFallback
        ? `https://temp.compsci88.com/cover/fallback/${item.coverFallback}`
        : "",
  };
}

function parseStatus(status: string | null | undefined): MangaStatus {
  if (!status) return "ongoing";
  const s = status.toLowerCase();
  if (s === "complete" || s === "completed") return "completed";
  if (s === "hiatus") return "hiatus";
  if (s === "canceled") return "cancelled";
  return "ongoing";
}

// ── Public API — Search ──────────────────────────────────────────────────────

export async function searchManga(
  query: string,
  _page = 1,
  limit = 20,
): Promise<MangaCard[]> {
  if (!query.trim()) return [];

  console.log(`${PREFIX} Searching: "${query}"`);

  try {
    const results = await wcSearch(query.trim());
    console.log(`${PREFIX} Search: ${results.length} results for "${query}"`);
    return results.slice(0, limit).map(toMangaCard);
  } catch (err) {
    console.error(`${PREFIX} search failed:`, (err as Error).message);
    return [];
  }
}

// ── Public API — Series Details ──────────────────────────────────────────────

/**
 * Get series details by slug (the series URL slug).
 * We need to first search to find the ULID, then fetch the series page.
 */
export async function getMangaDetails(slug: string): Promise<MangaData | null> {
  if (!slug) return null;

  console.log(`${PREFIX} Fetching details for "${slug}"`);

  try {
    // WeebCentral search expects human-readable text, not URL slugs.
    // Convert "Solo-Leveling" → "Solo Leveling" for the search query.
    const searchQuery = slug.replace(/-/g, " ");
    let searchResults = await wcSearch(searchQuery);

    // If no results, try the original slug as-is
    if (!searchResults.length && searchQuery !== slug) {
      searchResults = await wcSearch(slug);
    }

    // Match by slug (case-insensitive) or take first result
    const match = searchResults.find(
      (r) => r.slug.toLowerCase() === slug.toLowerCase(),
    ) || searchResults[0];

    if (!match) {
      console.warn(`${PREFIX} No series found for "${slug}"`);
      return null;
    }

    const html = await wcFetch(`/series/${match.id}/${match.slug}`);

    if (!html.includes("full-chapter-list")) {
      console.warn(`${PREFIX} Series page for "${slug}" did not parse (Cloudflare?)`);
      return null;
    }

    return parseSeriesPage(html, match.id, match.slug);
  } catch (err) {
    console.error(`${PREFIX} getMangaDetails failed:`, (err as Error).message);
    return null;
  }
}

/**
 * Get series details by ULID + slug directly.
 */
export async function getMangaDetailsById(ulid: string, slug: string): Promise<MangaData | null> {
  if (!ulid) return null;

  console.log(`${PREFIX} Fetching details for ${ulid}`);

  try {
    const path = slug ? `/series/${ulid}/${slug}` : `/series/${ulid}`;
    const html = await wcFetch(path);

    if (!html.includes("full-chapter-list")) {
      console.warn(`${PREFIX} Series page for ${ulid} did not parse`);
      return null;
    }

    return parseSeriesPage(html, ulid, slug);
  } catch (err) {
    console.error(`${PREFIX} getMangaDetailsById failed:`, (err as Error).message);
    return null;
  }
}

function parseSeriesPage(html: string, ulid: string, slug: string): MangaData {
  // Title
  const titleMatch = html.match(/<title>([^|]+)\s*\|/);
  const title = titleMatch?.[1]?.trim() || slug.replace(/-/g, " ");

  // Extract list items — server syntax: <li> <strong>Label: </strong> <span>values</span></li>
  function li(label: string): string | null {
    const m = html.match(new RegExp(`<li>\\s*<strong>${label}\\s*</strong>(.*?)</li>`, "s"));
    if (!m) return null;
    const val = m[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return val || null;
  }

  const authors = li("Author\\(s\\):");
  const tagsStr = li("Tags?\\(s\\):"); // server typo: "Tags(s)"
  const typeStr = li("Type:");
  const statusStr = li("Status:");
  const released = li("Released:");
  const descriptionStr = li("Description");

  // Description may be <li>... or <p>
  let description = descriptionStr || "";
  if (!description) {
    const descMatch = html.match(/Description\s*<\/strong>(.*?)<\/(?:p|div|section)>/s);
    if (descMatch) {
      description = descMatch[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  // Cover images
  const coverNormal = html.match(/srcset="https:\/\/temp\.compsci88\.com\/cover\/normal\/([^"]+)"/)?.[1]
    || html.match(/src="https:\/\/temp\.compsci88\.com\/cover\/normal\/([^"]+)"/)?.[1];
  const coverImage = coverNormal
    ? `https://temp.compsci88.com/cover/normal/${coverNormal}`
    : "";

  return {
    id: slug,
    title,
    altTitles: [],
    author: authors || undefined,
    description,
    coverImage,
    status: parseStatus(statusStr),
    genres: tagsStr ? tagsStr.split(/,\s*/) : [],
    totalChapters: 0, // populated after chapter fetch
    year: released ? parseInt(released) || undefined : undefined,
    chapters: [],
    _ulid: ulid, // internal — used by getChapterList
    _slug: slug,
  } as MangaData & { _ulid: string; _slug: string };
}

// ── Public API — Chapter List ────────────────────────────────────────────────

interface WeebChapter {
  id: string;          // ULID
  label: string;       // e.g. "Chapter 200"
  number: number;      // parsed numeric
  published: string;   // ISO8601
  official: boolean;
}

/**
 * Get all chapters for a series.
 * Returns newest-first (server order), we re-sort ascending.
 */
export async function getChapterList(
  seriesUlid: string,
): Promise<ChapterData[]> {
  console.log(`${PREFIX} Fetching chapters for ${seriesUlid}`);

  try {
    const html = await wcFetch(`/series/${seriesUlid}/full-chapter-list`);

    const chapters: WeebChapter[] = [];
    // Parse chapter entries from the HTML fragment
    const chPattern = /<div class="flex items-center" x-data="\{ new_chapter: checkNewChapter\('([^)]*?)'\)[^"]*"[^>]*>[\s\S]*?<a href="\/chapters\/([0-9A-Z]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = chPattern.exec(html)) !== null) {
      const published = m[1]!;
      const cid = m[2]!;
      const inner = m[3]!;
      const labelMatch = inner.match(/<span class="">([^<]+)<\/span>/);
      const label = labelMatch?.[1]?.trim() || "";
      const official = /chapter-badge-official/i.test(inner);

      // Parse chapter number from label
      const numMatch = label.match(/(\d+(?:\.\d+)?)/);
      const number = numMatch ? parseFloat(numMatch[1]!) : 0;

      chapters.push({ id: cid, label, number, published, official });
    }

    // Sort ascending by chapter number
    chapters.sort((a, b) => a.number - b.number);

    console.log(`${PREFIX} Found ${chapters.length} chapters for ${seriesUlid}`);
    return chapters.map((ch) => ({
      id: ch.id,
      number: ch.number,
      title: ch.label,
      pageCount: 0,
      publishedAt: ch.published,
      language: "en",
    }));
  } catch (err) {
    console.error(`${PREFIX} getChapterList failed:`, (err as Error).message);
    return [];
  }
}

/**
 * Get manga details with chapter list populated.
 */
export async function getMangaDetailsWithChapters(slug: string): Promise<MangaData | null> {
  const details = await getMangaDetails(slug);
  if (!details) return null;

  const ulid = (details as any)._ulid as string;
  if (ulid) {
    const chapters = await getChapterList(ulid);
    details.chapters = chapters;
    details.totalChapters = chapters.length;
  }

  return details;
}

// ── Public API — Chapter Pages ───────────────────────────────────────────────

/**
 * Get all page images for a chapter.
 *
 * Fetches the chapter page (for metadata) and the /images fragment (for page list).
 * The /images fragment is the GROUND TRUTH — it contains all <img> tags with
 * the actual CDN URLs. We parse host/slug/number from the first image URL.
 */
export async function getChapterPages(
  _mangaId: string,
  chapterNumber: number,
  _mangaTitle?: string,
): Promise<MangaPageData[]> {
  // _mangaId here can be either a slug or a chapter ULID.
  // The API routes pass the manga slug as mangaId.
  // We need to resolve slug -> series ULID -> chapter ULID for the specific chapter number.

  if (!_mangaId || chapterNumber <= 0) return [];

  console.log(`${PREFIX} Fetching pages for "${_mangaId}" ch${chapterNumber}`);

  try {
    // Step 1: Search to find the series ULID.
    // WeebCentral search expects human-readable text, not URL slugs.
    const searchQuery = _mangaId.replace(/-/g, " ");
    let searchResults = await wcSearch(searchQuery);
    if (!searchResults.length && searchQuery !== _mangaId) {
      searchResults = await wcSearch(_mangaId);
    }
    const match = searchResults.find(
      (r) => r.slug.toLowerCase() === _mangaId.toLowerCase(),
    ) || searchResults[0];

    if (!match) {
      console.warn(`${PREFIX} No series found for "${_mangaId}"`);
      return [];
    }

    // Step 2: Get chapter list to find the chapter ULID
    const chapters = await getChapterList(match.id);
    const chapter = chapters.find((ch) => ch.number === chapterNumber);
    if (!chapter) {
      console.warn(`${PREFIX} Chapter ${chapterNumber} not found in ${chapters.length} chapters`);
      return [];
    }

    // Step 3: Fetch chapter page images
    const chapterUlid = chapter.id;
    const html = await wcFetch(`/chapters/${chapterUlid}`);
    const frag = await wcFetch(`/chapters/${chapterUlid}/images?is_prev=False&current_page=1`);

    // Parse all img URLs from the fragment
    const imageUrls = frag.match(/<img\s+src="(https:\/\/[^"]+\.(?:png|jpg|webp))"/g)
      ?.map((tag) => {
        const srcMatch = tag.match(/src="([^"]+)"/);
        return srcMatch?.[1] || "";
      })
      .filter(Boolean) || [];

    if (!imageUrls.length) {
      console.warn(`${PREFIX} No page images found for chapter ${chapterUlid}`);
      return [];
    }

    console.log(`${PREFIX} Chapter ${chapterNumber}: ${imageUrls.length} pages`);
    return imageUrls.map((url, i) => ({
      imageUrl: url,
      pageNumber: i + 1,
    }));
  } catch (err) {
    console.error(`${PREFIX} getChapterPages failed:`, (err as Error).message);
    return [];
  }
}

// ── Public API — Browse / Discovery ──────────────────────────────────────────

export async function getPopularManga(limit = 20): Promise<MangaCard[]> {
  console.log(`${PREFIX} Fetching popular manga...`);
  try {
    const results = await wcSearch("", { sort: "Popularity" });
    return results.slice(0, limit).map(toMangaCard);
  } catch (err) {
    console.error(`${PREFIX} getPopularManga failed:`, (err as Error).message);
    return [];
  }
}

export async function getLatestManga(limit = 20): Promise<MangaCard[]> {
  console.log(`${PREFIX} Fetching latest manga...`);
  try {
    const results = await wcSearch("", { sort: "Latest Updates" });
    return results.slice(0, limit).map(toMangaCard);
  } catch (err) {
    console.error(`${PREFIX} getLatestManga failed:`, (err as Error).message);
    return [];
  }
}

export async function getActionManga(limit = 20): Promise<MangaCard[]> {
  console.log(`${PREFIX} Fetching action manga...`);
  try {
    const results = await wcSearch("action");
    return results.slice(0, limit).map(toMangaCard);
  } catch (err) {
    console.error(`${PREFIX} getActionManga failed:`, (err as Error).message);
    return [];
  }
}

export async function getRomanceManga(limit = 20): Promise<MangaCard[]> {
  console.log(`${PREFIX} Fetching romance manga...`);
  try {
    const results = await wcSearch("romance");
    return results.slice(0, limit).map(toMangaCard);
  } catch (err) {
    console.error(`${PREFIX} getRomanceManga failed:`, (err as Error).message);
    return [];
  }
}

export async function getFantasyManga(limit = 20): Promise<MangaCard[]> {
  console.log(`${PREFIX} Fetching fantasy manga...`);
  try {
    const results = await wcSearch("fantasy");
    return results.slice(0, limit).map(toMangaCard);
  } catch (err) {
    console.error(`${PREFIX} getFantasyManga failed:`, (err as Error).message);
    return [];
  }
}

/** Build a CDN page URL (only use when you know the host/slug from chapter data). */
export function buildPageUrl(
  cdnHost: string,
  seriesSlug: string,
  chapterNumber: number,
  pageNumber: number,
): string {
  return `https://${cdnHost}/manga/${seriesSlug}/${String(chapterNumber).padStart(4, "0")}-${String(pageNumber).padStart(3, "0")}.png`;
}
