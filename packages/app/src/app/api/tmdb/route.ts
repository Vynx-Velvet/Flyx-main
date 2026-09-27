/**
 * GET /api/tmdb?path=/movie/550
 *
 * Browser-side TMDB proxy (keeps the host's API key server-side). Requires
 * a logged-in session and only forwards the TMDB endpoints the app uses,
 * so the key can't be spent on arbitrary API paths.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/** TMDB endpoint families the client code requests through this proxy. */
const ALLOWED_PATH_PREFIXES = ["/movie/", "/tv/", "/search/", "/trending/", "/discover/", "/genre/"];

/**
 * Parse and validate a caller-supplied TMDB path ("/tv/1/season/2?x=y").
 * Returns the upstream URL, or null if the path is not allowed.
 */
function buildTmdbUrl(path: string): URL | null {
  const q = path.indexOf("?");
  const pathname = q === -1 ? path : path.slice(0, q);
  const query = q === -1 ? "" : path.slice(q + 1);
  if (!/^\/[A-Za-z0-9_\-/]+$/.test(pathname)) return null;
  if (pathname.includes("//") || pathname.split("/").some((seg) => seg === "." || seg === "..")) return null;
  if (!ALLOWED_PATH_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  const url = new URL(`${TMDB_BASE}${pathname}`);
  if (url.origin !== "https://api.themoviedb.org" || !url.pathname.startsWith("/3/")) return null;
  for (const [k, v] of new URLSearchParams(query)) {
    if (k === "api_key") continue;
    url.searchParams.append(k, v);
  }
  return url;
}

export async function GET(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  const query = searchParams.get("query");
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "TMDB_API_KEY not configured" }, { status: 500 });
  }
  if (!path) {
    return NextResponse.json({ error: "path parameter required" }, { status: 400 });
  }

  try {
    const url = buildTmdbUrl(path);
    if (!url) {
      return NextResponse.json({ error: "path not allowed" }, { status: 400 });
    }
    url.searchParams.set("language", "en-US");
    if (query) url.searchParams.set("query", query);

    // Bearer auth for JWT tokens, api_key param for legacy keys
    const isJWT = apiKey.startsWith("eyJ");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (isJWT) {
      headers.Authorization = `Bearer ${apiKey}`;
    } else {
      url.searchParams.set("api_key", apiKey);
    }

    const response = await fetch(url.toString(), { headers, next: { revalidate: 300 } });
    if (!response.ok) {
      return NextResponse.json({ error: `TMDB error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(injectImageUrls(data));
  } catch {
    return NextResponse.json({ error: "Failed to reach TMDB" }, { status: 502 });
  }
}

function injectImageUrls(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(injectImageUrls);

  const obj = data as Record<string, unknown>;
  const result: Record<string, unknown> = { ...obj };

  for (const key of ["poster_path", "backdrop_path", "profile_path", "logo_path", "still_path"]) {
    if (typeof result[key] === "string" && result[key]) {
      result[`${key}_w500`] = `${TMDB_IMAGE_BASE}/w500${result[key]}`;
      result[`${key}_original`] = `${TMDB_IMAGE_BASE}/original${result[key]}`;
    }
  }

  for (const [k, v] of Object.entries(result)) {
    if (v && typeof v === "object" && !Array.isArray(v) && !k.startsWith("poster_") && !k.startsWith("backdrop_")) {
      result[k] = injectImageUrls(v);
    }
    if (Array.isArray(v) && k === "results") {
      result[k] = v.map(injectImageUrls);
    }
  }

  return result;
}
