import type { Metadata } from "next";
import MangaDetailsClient from "./MangaDetailsClient";
import { getMangaDetails } from "@flyx/extractors/services";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const manga = await getMangaDetails(id);
    const title = manga?.title ? `${manga.title} — Manga — Flyx` : "Manga — Flyx";
    return {
      title,
      description: manga?.description?.slice(0, 160) || "Read manga chapters online for free.",
      openGraph: { title: `${manga?.title || "Manga"} — Flyx` },
    };
  } catch {
    return { title: "Manga — Flyx", description: "Read manga chapters online for free." };
  }
}

export default async function MangaDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MangaDetailsClient mangaId={id} />;
}
