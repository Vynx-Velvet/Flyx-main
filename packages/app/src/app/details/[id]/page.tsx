import { Suspense } from "react";
import type { Metadata } from "next";
import DetailsPageClient from "./DetailsPageClient";
import { PageLoader } from "@/components/ui/EmptyState";

const TMDB_BASE = "https://api.themoviedb.org/3";

async function fetchTitle(
  id: string,
  mediaType: "movie" | "tv",
): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL(`${TMDB_BASE}/${mediaType}/${id}`);
    url.searchParams.set("language", "en-US");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey.startsWith("eyJ")) {
      headers.Authorization = `Bearer ${apiKey}`;
    } else {
      url.searchParams.set("api_key", apiKey);
    }

    const res = await fetch(url.toString(), {
      headers,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.title || data.name || null) as string | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { type } = await searchParams;
  const mediaType = type === "tv" ? "tv" : "movie";
  const title = await fetchTitle(id, mediaType);

  if (title) {
    return {
      title,
      description: `Watch ${title} on Flyx — free streaming, no ads.`,
      openGraph: { title: `${title} | Flyx` },
    };
  }

  return {
    title: mediaType === "tv" ? "TV Series" : "Movie",
  };
}

export default async function DetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; season?: string }>;
}) {
  const { id } = await params;
  const { type, season } = await searchParams;
  const mediaType = type === "tv" ? "tv" : "movie";

  return (
    <Suspense fallback={<PageLoader message="Loading title…" />}>
      <DetailsPageClient
        id={id}
        mediaType={mediaType}
        initialSeason={season ? Number(season) : undefined}
      />
    </Suspense>
  );
}
