import { Metadata } from 'next';
import AnimeDetailsClient from './AnimeDetailsClient';
import { jikanFull } from '@/lib/anime/jikan-client';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ malId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { malId: malIdStr } = await params;
  const malId = parseInt(malIdStr);
  if (isNaN(malId)) return { title: 'Anime' };

  try {
    const a = await jikanFull(malId, AbortSignal.timeout(8000));
    if (a) {
      // Never leak placeholder strings into the window title — fall back to
      // "Anime" (the root layout template already appends "| Flyx").
      const rawTitle = a.title_english || a.title || '';
      const title = rawTitle && rawTitle !== 'Untitled' ? rawTitle : 'Anime';
      return {
        title,
        description: a.synopsis || `Watch ${title} on Flyx`,
        openGraph: {
          title,
          description: a.synopsis || undefined,
          images: a.images?.jpg?.large_image_url ? [a.images.jpg.large_image_url] : undefined,
        },
      };
    }
  } catch {}

  return { title: 'Anime' };
}

export default async function AnimeDetailsPage({ params }: Props) {
  const { malId: malIdStr } = await params;
  const malId = parseInt(malIdStr);
  return <AnimeDetailsClient malId={isNaN(malId) ? 0 : malId} />;
}
