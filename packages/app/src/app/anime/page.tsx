import AnimePageClient from "./AnimePageClient";

export const metadata = {
  title: "Anime",
  description: "Browse and stream anime — sub, dub, and seasonal",
};

export default function AnimePage() {
  return <AnimePageClient />;
}
