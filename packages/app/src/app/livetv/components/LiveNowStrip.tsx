'use client';

/**
 * LiveNowStrip — horizontally scrolling cards for events that are on air
 * right now. Big, glanceable, one tap to watch.
 */

import { memo, useState } from 'react';
import { getSportIcon, type Availability, type LiveEvent } from '../hooks/useLiveTVData';
import styles from '../LiveTVPage.module.css';

interface LiveNowStripProps {
  events: LiveEvent[];
  onPlay: (event: LiveEvent) => void;
  availabilityOf?: (event: LiveEvent) => Availability;
}

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  online: 'Ready',
  unknown: '',
  offline: 'Off air',
  unsupported: 'Unsupported player',
};

export function eventTitle(event: LiveEvent): string {
  return event.teams ? `${event.teams.home} vs ${event.teams.away}` : event.title;
}

const INITIAL = 8;

export const LiveNowStrip = memo(function LiveNowStrip({ events, onPlay, availabilityOf }: LiveNowStripProps) {
  const [showAll, setShowAll] = useState(false);
  if (!events.length) return null;
  const visible = showAll ? events : events.slice(0, INITIAL);
  return (
    <>
    <div className={styles.strip} role="list" aria-label="Live now">
      {visible.map((event) => {
        const icon = event.sport ? getSportIcon(event.sport) : '📺';
        const avail = availabilityOf ? availabilityOf(event) : 'unknown';
        return (
          <button
            key={event.id}
            type="button"
            role="listitem"
            className={styles.liveCard}
            data-avail={avail}
            onClick={() => onPlay(event)}
            data-tv-focusable="true"
            aria-label={`Watch ${eventTitle(event)}`}
          >
            <div className={styles.liveCardTop}>
              <span className={styles.liveBadge}>
                <span className={styles.liveDot} />
                LIVE
              </span>
              {avail !== 'unknown' && (
                <span className={styles.availBadge} data-avail={avail}>
                  {AVAILABILITY_LABEL[avail]}
                </span>
              )}
              {event.sport && (
                <span className={styles.sportTag}>
                  <span aria-hidden>{icon}</span>
                  {event.sport}
                </span>
              )}
            </div>
            <h3 className={styles.liveCardTitle}>{eventTitle(event)}</h3>
            {event.league && <p className={styles.liveCardLeague}>{event.league}</p>}
            <div className={styles.liveCardFoot}>
              <span>
                {event.time}
                {event.channels.length > 1 ? ` · ${event.channels.length} streams` : ''}
              </span>
              <span className={styles.watchBtn}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch
              </span>
            </div>
          </button>
        );
      })}
    </div>
    {events.length > INITIAL && (
      <div className={styles.stripMore}>
        <button type="button" className={styles.loadMoreBtn} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${events.length} on air`}
        </button>
      </div>
    )}
    </>
  );
});
