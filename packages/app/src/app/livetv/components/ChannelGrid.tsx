'use client';

/**
 * ChannelGrid — 850 channels made navigable: category chips, a country
 * select, and compact tiles with a colour-coded monogram (there are no
 * logos). Renders in pages of 60 with a Load more button.
 */

import { memo, useEffect, useMemo, useState } from 'react';
import { getCategoryIcon, type TVChannel } from '../hooks/useLiveTVData';
import { FilterChips, type ChipItem } from './FilterChips';
import styles from '../LiveTVPage.module.css';

const PAGE = 60;

interface ChannelGridProps {
  channels: TVChannel[];
  categories: ChipItem[];
  countries: Array<{ code: string; name: string; flag?: string; count: number }>;
  category: string;
  onCategoryChange: (id: string) => void;
  country: string;
  onCountryChange: (code: string) => void;
  onPlay: (channel: TVChannel) => void;
  loading?: boolean;
}

function monogram(name: string): string {
  const words = name.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'TV';
  if (words.length === 1) return words[0]!.slice(0, 3).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

export const ChannelTile = memo(function ChannelTile({ channel, onPlay }: { channel: TVChannel; onPlay: (c: TVChannel) => void }) {
  const meta = [channel.flag ? `${channel.flag} ${channel.countryName ?? channel.country}` : channel.countryName ?? channel.country, channel.category]
    .filter(Boolean)
    .join(' · ');
  return (
    <button
      type="button"
      className={styles.tile}
      onClick={() => onPlay(channel)}
      data-tv-focusable="true"
      aria-label={`Watch ${channel.name}`}
      title={channel.name}
    >
      <span className={styles.monogram} data-cat={channel.category} aria-hidden>
        {monogram(channel.name)}
      </span>
      <span className={styles.tileBody}>
        <span className={styles.tileName}>{channel.name}</span>
        <span className={styles.tileMeta}>{meta}</span>
      </span>
      <span className={styles.tilePlay} aria-hidden>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </button>
  );
});

export const ChannelGrid = memo(function ChannelGrid({
  channels,
  categories,
  countries,
  category,
  onCategoryChange,
  country,
  onCountryChange,
  onPlay,
  loading,
}: ChannelGridProps) {
  const [limit, setLimit] = useState(PAGE);

  const visible = useMemo(() => {
    const list = category === 'all' ? channels : channels.filter((c) => c.category === category);
    return list;
  }, [channels, category]);

  // Reset paging when the filtered set changes.
  useEffect(() => {
    setLimit(PAGE);
  }, [visible.length, category, country]);

  const chips: ChipItem[] = categories.map((c) => ({ ...c, icon: c.icon ?? getCategoryIcon(c.id) }));

  return (
    <div>
      <div className={styles.channelTools}>
        <FilterChips
          items={chips}
          value={category}
          onChange={onCategoryChange}
          allLabel="All channels"
          allCount={channels.length}
          ariaLabel="Channel category"
        />
        <select
          className={styles.select}
          value={country}
          onChange={(e) => onCountryChange(e.target.value)}
          aria-label="Country"
        >
          <option value="all">All countries</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag ? `${c.flag} ` : ''}
              {c.name} ({c.count})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className={styles.tileGrid}>
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className={styles.skeletonTile} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>
          <strong>No channels match</strong>
          Try another category or country.
        </div>
      ) : (
        <>
          <div className={styles.tileGrid} role="list">
            {visible.slice(0, limit).map((c) => (
              <ChannelTile key={c.id} channel={c} onPlay={onPlay} />
            ))}
          </div>
          {visible.length > limit && (
            <div className={styles.loadMore}>
              <button type="button" className={styles.loadMoreBtn} onClick={() => setLimit((l) => l + PAGE)}>
                Show more · {visible.length - limit} left
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
});
