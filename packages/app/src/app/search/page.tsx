import { Suspense } from "react";
import SearchPageClient from "./SearchPageClient";

export const metadata = {
  title: "Search",
  description: "Search movies, TV shows, and anime on Flyx",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; genre?: string }>;
}) {
  const params = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="loading" />
        </div>
      }
    >
      <SearchPageClient
        initialQuery={params.q ?? ""}
        initialContentType={params.type ?? "movie"}
        initialGenre={params.genre ?? ""}
      />
    </Suspense>
  );
}
