import BrowsePageClient, {
  type BrowseItem,
} from "./BrowsePageClient";
import { tmdbFetch, tmdbPoster } from "@/lib/tmdb-server";

interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
}

interface TMDBListResponse {
  page?: number;
  total_pages?: number;
  results?: TMDBItem[];
}

async function getFirstPage(type: "movie" | "tv") {
  const path = type === "tv" ? "/tv/popular?page=1" : "/movie/popular?page=1";
  const data = await tmdbFetch<TMDBListResponse>(path);
  const results = data?.results ?? [];
  const items: BrowseItem[] = results
    .filter((item) => item?.id)
    .map((item) => ({
      id: item.id,
      title: item.title ?? item.name ?? "Untitled",
      mediaType: type,
      posterUrl: tmdbPoster(item.poster_path, "w342"),
      rating: item.vote_average,
      year: (item.release_date ?? item.first_air_date)?.slice(0, 4),
    }));

  return {
    items,
    page: data?.page ?? 1,
    totalPages: Math.min(data?.total_pages ?? 1, 500),
  };
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const mediaType = type === "tv" ? "tv" : "movie";
  const first = await getFirstPage(mediaType);

  return (
    <BrowsePageClient
      key={mediaType}
      mediaType={mediaType}
      initialItems={first.items}
      initialPage={first.page}
      totalPages={first.totalPages}
    />
  );
}
