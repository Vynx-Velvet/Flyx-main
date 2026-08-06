/**
 * DLHD Channels API
 *
 * Returns all DLHD channels with filtering and search support.
 * Channels are loaded from the static JSON file.
 *
 * Ported from Flyx 2.0 — no architectural changes needed.
 * NOTE: Requires dlhd-channels.json data file at lib/data/dlhd-channels.json.
 */

import { NextRequest, NextResponse } from 'next/server';
import dlhdChannelsData from '@/lib/data/dlhd-channels.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DLHDChannel {
  id: string;
  name: string;
  category: string;
  country: string;
  firstLetter: string;
}

interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  count: number;
}

interface CountryInfo {
  id: string;
  name: string;
  flag: string;
  count: number;
}

const CATEGORY_ICONS: Record<string, { name: string; icon: string }> = {
  sports: { name: 'Sports', icon: '⚽' },
  entertainment: { name: 'Entertainment', icon: '🎬' },
  movies: { name: 'Movies', icon: '🎥' },
  news: { name: 'News', icon: '📰' },
  kids: { name: 'Kids', icon: '🧸' },
  documentary: { name: 'Documentary', icon: '🌍' },
  music: { name: 'Music', icon: '🎵' },
};

const COUNTRY_FLAGS: Record<string, { name: string; flag: string }> = {
  usa: { name: 'United States', flag: '🇺🇸' },
  uk: { name: 'United Kingdom', flag: '🇬🇧' },
  france: { name: 'France', flag: '🇫🇷' },
  germany: { name: 'Germany', flag: '🇩🇪' },
  spain: { name: 'Spain', flag: '🇪🇸' },
  italy: { name: 'Italy', flag: '🇮🇹' },
  portugal: { name: 'Portugal', flag: '🇵🇹' },
  turkey: { name: 'Turkey', flag: '🇹🇷' },
  poland: { name: 'Poland', flag: '🇵🇱' },
  brazil: { name: 'Brazil', flag: '🇧🇷' },
  mexico: { name: 'Mexico', flag: '🇲🇽' },
  canada: { name: 'Canada', flag: '🇨🇦' },
  australia: { name: 'Australia', flag: '🇦🇺' },
  'middle-east': { name: 'Middle East', flag: '🌍' },
  balkans: { name: 'Balkans', flag: '🌍' },
  international: { name: 'International', flag: '🌐' },
  israel: { name: 'Israel', flag: '🇮🇱' },
  sweden: { name: 'Sweden', flag: '🇸🇪' },
  bulgaria: { name: 'Bulgaria', flag: '🇧🇬' },
  malaysia: { name: 'Malaysia', flag: '🇲🇾' },
  cyprus: { name: 'Cyprus', flag: '🇨🇾' },
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const country = searchParams.get('country');
    const search = searchParams.get('search');

    let channels = dlhdChannelsData.channels as DLHDChannel[];

    // Apply filters
    if (category && category !== 'all') {
      channels = channels.filter((ch) => ch.category === category);
    }

    if (country && country !== 'all') {
      channels = channels.filter((ch) => ch.country === country);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      channels = channels.filter((ch) =>
        ch.name.toLowerCase().includes(searchLower),
      );
    }

    // Build category stats
    const categoryStats = new Map<string, number>();
    const countryStats = new Map<string, number>();

    for (const ch of dlhdChannelsData.channels as DLHDChannel[]) {
      categoryStats.set(
        ch.category,
        (categoryStats.get(ch.category) || 0) + 1,
      );
      countryStats.set(
        ch.country,
        (countryStats.get(ch.country) || 0) + 1,
      );
    }

    const categories: CategoryInfo[] = Array.from(
      categoryStats.entries(),
    )
      .map(([id, count]) => ({
        id,
        name: CATEGORY_ICONS[id]?.name || id,
        icon: CATEGORY_ICONS[id]?.icon || '📺',
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const countries: CountryInfo[] = Array.from(
      countryStats.entries(),
    )
      .map(([id, count]) => ({
        id,
        name: COUNTRY_FLAGS[id]?.name || id,
        flag: COUNTRY_FLAGS[id]?.flag || '🌐',
        count,
      }))
      .sort((a, b) => b.count - a.count);

    // Transform channels for response
    const transformedChannels = channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      category: ch.category,
      country: ch.country,
      firstLetter: ch.firstLetter,
      categoryInfo:
        CATEGORY_ICONS[ch.category] || {
          name: ch.category,
          icon: '📺',
        },
      countryInfo:
        COUNTRY_FLAGS[ch.country] || {
          name: ch.country,
          flag: '🌐',
        },
    }));

    return NextResponse.json(
      {
        success: true,
        channels: transformedChannels,
        categories,
        countries,
        totalChannels: dlhdChannelsData.totalChannels,
        lastUpdated: dlhdChannelsData.lastUpdated,
      },
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    console.error('[DLHD Channels] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load channels',
      },
      { status: 500 },
    );
  }
}
