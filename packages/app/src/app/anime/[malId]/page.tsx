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
  if (isNaN(malId)) return { title: 'Anime | Flyx' };

  try {
    const a = await jikanFull(malId, AbortSignal.timeout(8000));
    if (a) {
      const title = a.title_english || a.title || 'Unknown';
      return {
        title: `${title} | Flyx`,
        description: a.synopsis || `Watch ${title} on Flyx`,
        openGraph: {
          title,
          description: a.synopsis || undefined,
          images: a.images?.jpg?.large_image_url ? [a.images.jpg.large_image_url] : undefined,
        },
      };
    }
  } catch {}

  return { title: 'Anime | Flyx' };
}

export default async function AnimeDetailsPage({ params }: Props) {
  const { malId: malIdStr } = await params;
  const malId = parseInt(malIdStr);
  return <AnimeDetailsClient malId={isNaN(malId) ? 0 : malId} />;
}
