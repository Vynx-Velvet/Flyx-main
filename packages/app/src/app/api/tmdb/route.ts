import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export async function GET(request: NextRequest) {
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
    const url = new URL(`${TMDB_BASE}${path}`);
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
