/**
 * OpenSubtitles.org website scraper — no API key, no account.
 *
 * The site sits behind Anubis (/.within.website), a JavaScript
 * proof-of-work anti-bot challenge. We solve it server-side with
 * node:crypto sha256 (~1.5s at the site's current difficulty 4) and keep
 * the resulting session cookies for the lifetime of the server process.
 *
 * Verified live flow (Aug 2026):
 *   1. Any site URL → 307 to /.within.website/?redir=…
 *   2. Challenge page embeds <script id="anubis_challenge"
 *      type="application/json"> { challenge: { id, randomData, difficulty } }
 *      and returns HTTP 401.
 *   3. Find integer nonce where sha256hex(randomData + nonce) starts with
 *      "0".repeat(difficulty).
 *   4. GET /.within.website/x/cmd/anubis/api/pass-challenge?id=…&response=
 *      <hex>&nonce=…&redir=<FULL absolute URL>&elapsedTime=… — must send the
 *      challenge page's cookies and the FULL absolute redir → 302 + a valid
 *      techaro.lol-anubis-auth cookie.
 *   5. Replay the original request with the cookie jar → real content.
 *   6. Downloads: GET https://dl.opensubtitles.org/en/download/sub/{id}
 *      with cookies + Referer → application/zip. (Do NOT use
 *      /en/subtitleserve/… on www — it redirects into an ad landing page.)
 */

import { createHash } from "node:crypto";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const OS_ORIGIN = "https://www.opensubtitles.org";
const DL_ORIGIN = "https://dl.opensubtitles.org";
const FETCH_TIMEOUT_MS = 15_000;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const BLOCKED_BACKOFF_MS = 10 * 60 * 1000;
const MAX_NONCES = 5_000_000;
const MAX_DIFFICULTY = 6;
const SEARCH_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const SEARCH_CACHE_MAX = 200;

// ── Errors ──────────────────────────────────────────────────────

/** The site's anti-bot layer refused us (challenge too hard, or persisted). */
export class AnubisBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnubisBlockedError";
  }
}

/** The download CDN answered with a non-OK status. */
export class OSDownloadError extends Error {
  status: number;
  constructor(status: number, message = `Upstream HTTP ${status}`) {
    super(message);
    this.name = "OSDownloadError";
    this.status = status;
  }
}

// ── Session state ───────────────────────────────────────────────

/** Cookie jar shared by every fetch (search + downloads). */
const jar = new Map<string, string>();
/** Serializes concurrent challengers so only ONE PoW solve runs at a time. */
let solveInFlight: Promise<void> | null = null;
let sessionSince = 0;
let lastBlockedAt = 0;

function cookieHeader(): string {
  let out = "";
  for (const [k, v] of jar) out += `${k}=${v}; `;
  return out;
}

function absorbSetCookies(headers: Headers): void {
  const raw =
    typeof (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie ===
    "function"
      ? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [];
  for (const c of raw) {
    const pair = c.split(";")[0]!;
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
}

// ── Anubis proof-of-work ────────────────────────────────────────

interface AnubisChallengeJSON {
  challenge?: {
    id?: string;
    randomData?: string;
    difficulty?: number;
    method?: string;
  };
  rules?: { algorithm?: string };
}

/**
 * Find the nonce whose sha256(randomData + nonce) has `difficulty` leading
 * zero hex chars. Equivalent to the site's own worker check (floor(d/2) zero
 * bytes, plus the high nibble for odd difficulties).
 */
function solveAnubisPoW(
  randomData: string,
  difficulty: number,
): { nonce: number; digest: string; elapsedMs: number } {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > MAX_DIFFICULTY) {
    throw new AnubisBlockedError(`anubis difficulty ${difficulty} outside 1..${MAX_DIFFICULTY}`);
  }
  const t0 = Date.now();
  const prefix = "0".repeat(difficulty);
  for (let nonce = 0; nonce < MAX_NONCES; nonce++) {
    const digest = createHash("sha256").update(randomData + nonce).digest("hex");
    if (digest.startsWith(prefix)) {
      return { nonce, digest, elapsedMs: Date.now() - t0 };
    }
  }
  throw new AnubisBlockedError("anubis PoW exceeded nonce budget");
}

/**
 * Run the full challenge: hit the target (307 → challenge page), parse the
 * challenge JSON, solve the PoW, pass the challenge, absorb the session
 * cookie. On success subsequent fetches with the jar sail through.
 */
async function solveChallengeFor(targetUrl: string): Promise<void> {
  if (Date.now() - lastBlockedAt < BLOCKED_BACKOFF_MS) {
    throw new AnubisBlockedError("backing off after a recent block");
  }
  // Serialize concurrent challengers — ONE PoW solve at a time; waiters
  // reuse the winner's session on their retry.
  if (solveInFlight) {
    await solveInFlight;
    return;
  }
  const run = solveChallengeInner(targetUrl);
  solveInFlight = run;
  try {
    await run;
  } finally {
    solveInFlight = null;
  }
}

async function solveChallengeInner(targetUrl: string): Promise<void> {
  // 1. Probe the target to get the challenge redirect (307).
  let res = await rawFetch(targetUrl, {});
  const location = res.headers.get("location") ?? "";
  if (!location.includes("/.within.website/")) {
    // No challenge (session may already be valid) — nothing to solve.
    sessionSince = Date.now();
    return;
  }

  // 2. Challenge page — absorb its cookies, parse the challenge JSON.
  const challengeUrl = new URL(location, OS_ORIGIN).href;
  res = await rawFetch(challengeUrl, {});
  if (!res.ok && res.status !== 401 && res.status !== 403) {
    throw new AnubisBlockedError(`challenge page HTTP ${res.status}`);
  }
  absorbSetCookies(res.headers);
  const html = await res.text();
  const m = html.match(
    /<script id="anubis_challenge" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!m?.[1]) {
    console.warn(
      `[opensubtitles] challenge page without anubis_challenge: ${html.replace(/\s+/g, " ").slice(0, 250)}`,
    );
    throw new AnubisBlockedError("challenge JSON missing");
  }
  const parsed = JSON.parse(
    m[1].replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">"),
  ) as AnubisChallengeJSON;
  const ch = parsed.challenge ?? {};
  const algorithm = ch.method ?? parsed.rules?.algorithm ?? "";
  const difficulty = ch.difficulty ?? 0;
  if (algorithm !== "fast") {
    console.warn(`[opensubtitles] unknown anubis algorithm ${JSON.stringify(algorithm)}`);
    throw new AnubisBlockedError(`anubis algorithm "${algorithm}" unsupported`);
  }
  if (!ch.id || !ch.randomData) {
    throw new AnubisBlockedError("challenge JSON incomplete");
  }
  console.log(`[opensubtitles] solving anubis challenge (difficulty ${difficulty})`);

  // 3. Solve.
  const { nonce, digest, elapsedMs } = solveAnubisPoW(ch.randomData, difficulty);

  // 4. Pass the challenge — full absolute redir + challenge cookies.
  const q = new URLSearchParams({
    id: ch.id,
    response: digest,
    nonce: String(nonce),
    redir: targetUrl,
    elapsedTime: String(elapsedMs),
  });
  res = await rawFetch(
    `${OS_ORIGIN}/.within.website/x/cmd/anubis/api/pass-challenge?${q.toString()}`,
    { headers: { Referer: challengeUrl } },
  );
  absorbSetCookies(res.headers);
  if (res.status !== 302 && res.status !== 303 && res.status !== 200) {
    console.warn(`[opensubtitles] pass-challenge HTTP ${res.status}`);
    lastBlockedAt = Date.now();
    throw new AnubisBlockedError(`pass-challenge HTTP ${res.status}`);
  }
  sessionSince = Date.now();
  console.log(`[opensubtitles] anubis solved in ${elapsedMs}ms (nonce ${nonce})`);
}

// ── Fetch plumbing ──────────────────────────────────────────────

async function rawFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      redirect: "manual",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: cookieHeader(),
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

function isAnubisChallenge(res: Response, location: string): boolean {
  if ((res.status === 302 || res.status === 303 || res.status === 307) && location.includes("/.within.website/")) {
    return true;
  }
  if (res.status === 401 || res.status === 403) {
    const setCookie =
      typeof (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie ===
      "function"
        ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie().join("; ")
        : "";
    return setCookie.includes("anubis");
  }
  return false;
}

/**
 * Fetch with the shared session. Detects a challenge (307 to
 * /.within.website/, 401/403 with anubis cookies, or an inline challenge
 * page for text/html bodies), solves it ONCE, then retries once.
 * `kind: "text"` responses are returned with the body still readable;
 * buffer responses are returned untouched.
 */
export async function fetchWithSession(
  url: string,
  init: RequestInit = {},
  kind: "text" | "buffer" = "text",
): Promise<Response> {
  // Re-solve proactively when the session cookie is older than the TTL (the
  // site rotates cookies; a stale jar just gets 307'd anyway — this saves a
  // wasted first round-trip).
  if (sessionSince && Date.now() - sessionSince > SESSION_TTL_MS) {
    try {
      await solveChallengeFor(url);
    } catch (err) {
      lastBlockedAt = Date.now();
      throw new AnubisBlockedError(
        `session refresh failed: ${(err as Error).message}`,
      );
    }
  }
  let retried = false;
  for (;;) {
    const res = await rawFetch(url, init);
    // Absorb cookies from every response — the site sets PHPSESSID on
    // canonical redirects and expects it back on the next request.
    absorbSetCookies(res.headers);
    const location = res.headers.get("location") ?? "";

    if (!isAnubisChallenge(res, location)) {
      // Inline challenge page check (some endpoints serve it as 200 HTML).
      if (kind === "text" && res.status === 200) {
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("text/html")) {
          const body = await res.text();
          if (!body.includes("anubis_challenge") && !body.includes("Making sure you")) {
            // Re-wrap so the caller can still read the body.
            return new Response(body, { status: res.status, headers: res.headers });
          }
          if (retried) break;
        } else {
          return res;
        }
      } else {
        return res;
      }
    }

    if (retried) {
      lastBlockedAt = Date.now();
      console.warn("[opensubtitles] still challenged after solving — treating as blocked");
      throw new AnubisBlockedError("challenge persisted after solve");
    }
    retried = true;
    await solveChallengeFor(url);
  }
  lastBlockedAt = Date.now();
  throw new AnubisBlockedError("challenge persisted after solve");
}

// ── Search ──────────────────────────────────────────────────────

export interface OSSubRow {
  subId: string;
  langCode: string;
  langName: string;
  releaseName: string;
  format: string; // "srt" | "vtt" | …
  downloads: number;
  rating: number;
  dateISO: string;
}

export type OSFetchError = "blocked" | "failed";

export interface OSSearchResult {
  rows: OSSubRow[];
  error?: OSFetchError;
}

export interface OSSearchParams {
  imdbId: string; // "tt0816692"
  season?: number;
  episode?: number;
  /** Priority-ordered wanted language codes (3-letter). */
  languages?: string[];
}

const searchCache = new Map<string, { rows: OSSubRow[]; at: number }>();

function searchUrl(imdbId: string, season?: number, episode?: number, lang = "all"): string {
  let url = `${OS_ORIGIN}/en/search2/sublanguageid-${lang}/imdbid-${imdbId}`;
  if (season != null && episode != null) url += `/season-${season}/episode-${episode}`;
  return url;
}

function setSearchCache(key: string, rows: OSSubRow[]): void {
  searchCache.set(key, { rows, at: Date.now() });
  while (searchCache.size > SEARCH_CACHE_MAX) {
    const oldest = searchCache.keys().next().value;
    if (oldest === undefined) break;
    searchCache.delete(oldest);
  }
}

/**
 * Parse the search results table. Row shape (verified live):
 *   <tr id="name{id}" …>
 *     <td class="sb_star_even" id="main{id}">
 *       <strong><a class="bnone" href="/en/subtitles/{id}/…">Title (year)</a></strong>
 *       <br /><span title="{release name}">…</span>
 *     <td><a title="Polish" href="/en/search/…/sublanguageid-pol"><div class="flag pl"></div></a></td>
 *     <td>1CD</td>
 *     <td><time datetime="{iso}">…</time><br /><span class="p">23.976</span></td>
 *     <td><a href="/en/subtitleserve/sub/{id}">17x</a><br /><span class="p">srt</span></td>
 *     <td><span title="0 votes">0.0</span></td>
 *     …
 *   </tr>
 */
function parseSubtitleRows(html: string): OSSubRow[] {
  const rows: OSSubRow[] = [];
  const trRe = /<tr[^>]*id="name(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html)) !== null) {
    try {
      const subId = m[1]!;
      const block = m[2]!;
      const langCode = block.match(/sublanguageid-([a-z]{2,3})/)?.[1] ?? "";
      const langName =
        block.match(/<a title="([^"]+)" href="[^"]*sublanguageid-[a-z]+/)?.[1] ?? langCode;
      // First <span title> in the row is the release name (the rating span
      // carries title="N votes" and comes later).
      const releaseName = block.match(/<span title="([^"]*)">/)?.[1] ?? "";
      const format =
        block.match(
          /subtitleserve\/sub\/\d+"[^>]*>[^<]*<\/a><br\s*\/?>\s*<span class="p">([a-z0-9]+)<\/span>/i,
        )?.[1] ?? "";
      const downloads = parseFloat(
        block.match(/subtitleserve\/sub\/\d+"[^>]*>([\d.]+)\s*[km]?x/i)?.[1] ?? "0",
      );
      const rating = parseFloat(
        block.match(/title="(\d+) votes"[^>]*>([\d.]+)<\/span>/)?.[2] ?? "0",
      );
      const dateISO = block.match(/datetime="([^"]+)"/)?.[1] ?? "";
      rows.push({ subId, langCode, langName, releaseName, format, downloads, rating, dateISO });
    } catch {
      // Per-row parse failure — skip this row, keep the rest.
    }
  }
  return rows;
}

async function fetchSearchPage(url: string): Promise<OSSearchResult> {
  let res = await fetchWithSession(url, {}, "text");
  // Follow plain (non-challenge) redirects — the site 301s /search2/… to
  // /search/… and every response carries cf-ray headers, so the status
  // alone can't be trusted as a block signal.
  for (
    let hops = 0;
    (res.status === 301 || res.status === 302 || res.status === 303 ||
      res.status === 307 || res.status === 308) &&
    hops < 3;
    hops++
  ) {
    const loc = res.headers.get("location");
    if (!loc || loc.includes("/.within.website/")) break;
    url = new URL(loc, url).href;
    res = await fetchWithSession(url, {}, "text");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const cfBlocked =
      /Just a moment|captcha|cf-chl|cf-mitigated|Attention Required/i.test(body) ||
      (res.status === 403 && res.headers.has("cf-ray") && body.length < 2000);
    if (cfBlocked) {
      console.warn(`[opensubtitles] cloudflare block on ${url.slice(0, 90)}`);
      return { rows: [], error: "blocked" };
    }
    console.warn(`[opensubtitles] search HTTP ${res.status} on ${url.slice(0, 90)}`);
    return { rows: [], error: "failed" };
  }
  const html = await res.text();
  const rows = parseSubtitleRows(html);
  if (rows.length === 0) {
    // OK fetch but zero rows — page structure drifted, or genuinely no subs.
    console.warn(
      `[opensubtitles] parsed 0 rows from ${url.slice(0, 90)} (${html.length}b): ${html.replace(/\s+/g, " ").slice(0, 250)}`,
    );
    return { rows: [], error: "failed" };
  }
  return { rows };
}

/**
 * Search opensubtitles.org for a title. One "all languages" request, plus a
 * single capped follow-up round of per-language searches for missing wanted
 * codes (the all-language listing is download-count ranked, so rare
 * languages can fall off page 1).
 */
export async function searchOpenSubtitles(p: OSSearchParams): Promise<OSSearchResult> {
  const wanted = p.languages ?? [];
  const key = `${p.imdbId}|${p.season ?? ""}|${p.episode ?? ""}|${wanted.join(",")}`;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_CACHE_TTL_MS) {
    console.log(`[opensubtitles] search cache hit ${key}`);
    return { rows: hit.rows };
  }

  try {
    const primary = await fetchSearchPage(searchUrl(p.imdbId, p.season, p.episode));
    if (primary.error) return primary; // blocked — never fan out after a block

    let rows = primary.rows;

    if (wanted.length) {
      const found = new Set(rows.map((r) => r.langCode));
      const missing = wanted.filter((w) => !found.has(w)).slice(0, 3);
      if (missing.length) {
        const extra = await Promise.allSettled(
          missing.map((lang) => fetchSearchPage(searchUrl(p.imdbId, p.season, p.episode, lang))),
        );
        for (const r of extra) {
          if (r.status === "fulfilled" && !r.value.error) rows = rows.concat(r.value.rows);
        }
      }
    }

    // De-dupe by sub id (follow-up rounds overlap the primary listing).
    const seen = new Set<string>();
    rows = rows.filter((r) => (seen.has(r.subId) ? false : (seen.add(r.subId), true)));

    setSearchCache(key, rows);
    console.log(`[opensubtitles] search ${p.imdbId} → ${rows.length} rows (${rows.length ? rows.map((r) => r.langCode).filter((v, i, a) => a.indexOf(v) === i).join(",") : "none"})`);
    return { rows };
  } catch (err) {
    if (err instanceof AnubisBlockedError) {
      return { rows: [], error: "blocked" };
    }
    console.warn("[opensubtitles] search failed:", (err as Error).message);
    return { rows: [], error: "failed" };
  }
}

// ── Download ────────────────────────────────────────────────────

/**
 * Fetch a subtitle zip straight from the download CDN (the www
 * /en/subtitleserve path redirects into an ad landing — avoid it).
 */
export async function fetchOpenSubtitlesZip(
  subId: string,
): Promise<{ fileName: string; data: Uint8Array }> {
  let url = `${DL_ORIGIN}/en/download/sub/${subId}`;
  const init: RequestInit = {
    headers: {
      Referer: `${OS_ORIGIN}/en/subtitles/${subId}/`,
      Accept: "application/zip, */*",
    },
  };

  let res = await fetchWithSession(url, init, "buffer");
  // Follow plain (non-challenge) redirects manually — challenge detection
  // in fetchWithSession only reacts to /.within.website/ locations.
  for (let hops = 0; (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307) && hops < 3; hops++) {
    const loc = res.headers.get("location");
    if (!loc) break;
    url = new URL(loc, url).href;
    res = await fetchWithSession(url, init, "buffer");
  }

  if (!res.ok) throw new OSDownloadError(res.status);
  const data = new Uint8Array(await res.arrayBuffer());
  if (data.length === 0) throw new OSDownloadError(res.status, "empty body");
  return { fileName: res.headers.get("content-disposition") ?? "", data };
}
