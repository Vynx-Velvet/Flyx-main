/**
 * "Now viewing" label for the app headers.
 *
 * Section names come from the route (plus the `type=` filter on browse
 * pages, so Movies and TV Shows are told apart); title pages (details,
 * anime, manga) use the page's own document title once it is set, so the
 * header reads "Fight Club" instead of "Title details".
 */

export interface PageLabel {
  /** Small kicker above the name ("Now viewing", "Browsing", …). */
  kicker: string;
  /** The name itself. */
  name: string;
}

const TITLE_SUFFIX = /\s*[|·—-]\s*Flyx\s*$/i;

/** Strip the "| Flyx" suffix pages append to document.title. */
export function cleanDocumentTitle(title: string | null | undefined): string {
  const t = (title || "").replace(TITLE_SUFFIX, "").trim();
  return t.toLowerCase() === "flyx" ? "" : t;
}

export function isTitlePage(pathname: string): boolean {
  return (
    pathname.startsWith("/details/") ||
    /^\/anime\/[^/]+/.test(pathname) ||
    /^\/manga\/[^/]+/.test(pathname)
  );
}

/**
 * Route-derived label. `search` is the query string (with or without "?").
 * `docTitle` is the cleaned document title for title pages.
 */
export function pageLabel(pathname: string, search = "", docTitle = ""): PageLabel {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  if (pathname === "/") return { kicker: "Now viewing", name: "Home" };

  if (pathname.startsWith("/browse")) {
    const type = (q.get("type") || "").toLowerCase();
    const genre = q.get("genre") || q.get("genreName") || "";
    const base = type === "movie" ? "Movies" : type === "tv" ? "TV Shows" : type === "anime" ? "Anime" : "Movies & TV";
    return { kicker: "Browsing", name: genre ? `${base} · ${genre}` : base };
  }

  if (pathname.startsWith("/search")) {
    const term = q.get("q") || q.get("query") || "";
    return { kicker: "Searching", name: term ? `“${term}”` : "Search" };
  }

  if (isTitlePage(pathname)) {
    if (docTitle) {
      const kind = pathname.startsWith("/anime/") ? "Anime" : pathname.startsWith("/manga/") ? "Manga" : q.get("type") === "tv" ? "Series" : q.get("type") === "movie" ? "Movie" : "Title";
      return { kicker: kind, name: docTitle };
    }
    return { kicker: "Now viewing", name: pathname.startsWith("/anime/") ? "Anime" : pathname.startsWith("/manga/") ? "Manga" : "Title details" };
  }

  if (pathname.startsWith("/anime")) return { kicker: "Now viewing", name: "Anime" };
  if (pathname.startsWith("/manga")) return { kicker: "Now viewing", name: "Manga" };
  if (pathname.startsWith("/livetv")) return { kicker: "Now viewing", name: "Live TV" };
  if (pathname.startsWith("/watchlist")) return { kicker: "Now viewing", name: "Watchlist" };
  if (pathname.startsWith("/downloads")) return { kicker: "Now viewing", name: "Downloads" };
  if (pathname.startsWith("/settings")) return { kicker: "Now viewing", name: "Settings" };
  if (pathname.startsWith("/help")) return { kicker: "Now viewing", name: "Help" };
  return { kicker: "Now viewing", name: "Flyx" };
}
