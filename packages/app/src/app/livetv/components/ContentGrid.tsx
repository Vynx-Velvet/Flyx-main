/**
 * Content Grid — Unified responsive grid with infinite scroll
 */

import { memo, useState, useEffect, useRef } from 'react';
import { LiveEvent, TVChannel } from '../hooks/useLiveTVData';
import { LiveEventCard } from './LiveEventCard';
import { ChannelCard } from './ChannelCard';
import styles from '../LiveTV.module.css';

interface ContentGridProps {
  events: LiveEvent[];
  channels: TVChannel[];
  onPlayEvent: (event: LiveEvent) => void;
  onPlayChannel: (channel: TVChannel) => void;
  loading: boolean;
  error: string | null;
  hasEvents: boolean;
  hasChannels: boolean;
}

const ITEMS_PER_PAGE = 24;

export const ContentGrid = memo(function ContentGrid({
  events,
  channels,
  onPlayEvent,
  onPlayChannel,
  loading,
  error,
  hasEvents,
  hasChannels,
}: ContentGridProps) {
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset display count when data changes
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [events.length, channels.length]);

  // Infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount(prev => {
            const total = events.length + channels.length;
            if (prev >= total) return prev;
            return Math.min(prev + ITEMS_PER_PAGE, total);
          });
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [events.length, channels.length]);

  // Loading state
  if (loading) {
    return (
      <div className={styles.gridPlaceholder}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={styles.cardSkeleton} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={styles.messageBox}>
        <span className={styles.messageIcon}>⚠️</span>
        <p>{error}</p>
      </div>
    );
  }

  // Empty state
  if (events.length === 0 && channels.length === 0) {
    return (
      <div className={styles.messageBox}>
        <span className={styles.messageIcon}>📺</span>
        <p>No content found. Try adjusting your filters or selecting a different provider.</p>
      </div>
    );
  }

  // Interleave events and channels: events first, then channels
  const displayedEvents = events.slice(0, displayCount);
  const remainingSlots = Math.max(0, displayCount - displayedEvents.length);
  const displayedChannels = channels.slice(0, remainingSlots);
  const hasMore = displayCount < (events.length + channels.length);

  return (
    <div className={styles.contentContainer}>
      {/* Events grid */}
      {displayedEvents.length > 0 && (
        <div className={styles.contentSectionInner}>
          {hasEvents && hasChannels && (
            <div className={styles.sectionLabel}>
              <span className={styles.sectionLabelIcon}>🏟️</span>
              Live Events
              <span className={styles.sectionLabelCount}>{events.length}</span>
            </div>
          )}
          <div className={styles.simpleGrid}>
            {displayedEvents.map((event) => (
              <LiveEventCard key={event.id} event={event} onPlay={onPlayEvent} />
            ))}
          </div>
        </div>
      )}

      {/* Channels grid */}
      {displayedChannels.length > 0 && (
        <div className={styles.contentSectionInner}>
          {hasEvents && hasChannels && (
            <div className={styles.sectionLabel}>
              <span className={styles.sectionLabelIcon}>📺</span>
              TV Channels
              <span className={styles.sectionLabelCount}>{channels.length}</span>
            </div>
          )}
          <div className={styles.channelGrid}>
            {displayedChannels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} onPlay={onPlayChannel} />
            ))}
          </div>
        </div>
      )}

      {/* Load more trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className={styles.loadMoreTrigger}>
          <div className={styles.loadingSpinnerSmall} />
          <p>Loading more...</p>
        </div>
      )}
    </div>
  );
});
