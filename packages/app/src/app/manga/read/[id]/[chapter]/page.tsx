import type { Metadata } from "next";
import MangaReaderClient from "./MangaReaderClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; chapter: string }>;
}): Promise<Metadata> {
  const { id, chapter } = await params;
  return {
    title: `Chapter ${chapter} — Manga Reader — Flyx`,
    description: `Read manga chapter ${chapter} online for free.`,
    openGraph: { title: `Reading Chapter ${chapter} — Flyx` },
    robots: "noindex, nofollow",
  };
}

export default async function MangaReaderPage({
  params,
}: {
  params: Promise<{ id: string; chapter: string }>;
}) {
  const { id, chapter } = await params;
  const chapterNum = parseFloat(chapter) || 1;
  return <MangaReaderClient mangaId={id} chapterNumber={chapterNum} />;
}
