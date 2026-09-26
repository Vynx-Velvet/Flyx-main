'use client';

/**
 * EventList — events as scannable rows, grouped by sport (or by "when").
 * Time column · title/league · stream count · play.
 */

import { memo, useMemo } from 'react';
import { getSportIcon, type Availability, type LiveEvent } from '../hooks/useLiveTVData';
import { AVAILABILITY_LABEL, eventTitle } from './LiveNowStrip';
import styles from '../LiveTVPage.module.css';

interface EventListProps {
  events: LiveEvent[];
  onPlay: (event: LiveEvent) => void;
  availabilityOf?: (event: LiveEvent) => Availability;
  /** "sport" (default) or "time" (Starting soon / Later today buckets). */
  groupBy?: 'sport' | 'time';
  emptyTitle?: string;
  emptyHint?: string;
}

interface Group {
  id: string;
  label: string;
  icon?: string;
  events: LiveEvent[];
}

function bucketByTime(events: LiveEvent[], now: number): Group[] {
  const soon: LiveEvent[] = [];
  const later: LiveEvent[] = [];
  const unknown: LiveEvent[] = [];
  for (const e of events) {
    if (!e.startsAt) unknown.push(e);
    else if (e.startsAt - now <= 2 * 3600 * 1000) soon.push(e);
    else later.push(e);
  }
  const groups: Group[] = [];
  if (soon.length) groups.push({ id: 'soon', label: 'Starting soon', icon: '⏱️', events: soon });
  if (later.length) groups.push({ id: 'later', label: 'Later', icon: '📅', events: later });
  if (unknown.length) groups.push({ id: 'unknown', label: 'Scheduled', icon: '📺', events: unknown });
  return groups;
}

function groupBySport(events: LiveEvent[]): Group[] {
  const map = new Map<string, Group>();
  for (const e of events) {
    const key = (e.sport || 'other').toLowerCase();
    let g = map.get(key);
    if (!g) {
      g = {
        id: key,
        label: key === 'other' ? 'Other' : key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' '),
        icon: getSportIcon(key),
        events: [],
      };
      map.set(key, g);
    }
    g.events.push(e);
  }
  return [...map.values()].sort((a, b) => b.events.length - a.events.length);
}

export const EventRow = memo(function EventRow({
  event,
  onPlay,
  avail = 'unknown',
}: { event: LiveEvent; onPlay: (e: LiveEvent) => void; avail?: Availability }) {
  const title = eventTitle(event);
  const sub = [event.league, event.sport && !event.league ? event.sport : null].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      className={styles.row}
      data-live={event.isLive ? 'true' : 'false'}
      data-avail={avail}
      onClick={() => onPlay(event)}
      data-tv-focusable="true"
      aria-label={`${event.isLive ? 'Watch' : 'Open'} ${title}`}
    >
      <div className={styles.rowTime}>
        <span className={styles.rowClock}>{event.time || '—'}</span>
        {event.isLive ? (
          <span className={styles.rowWhen} data-live="true">
            <span className={styles.liveDot} />
            LIVE
          </span>
        ) : (
          event.startsIn && <span className={styles.rowWhen}>{event.startsIn}</span>
        )}
      </div>
      <div className={styles.rowMain}>
        <p className={styles.rowTitle}>{title}</p>
        {sub && <p className={styles.rowSub}>{sub}</p>}
      </div>
      <div className={styles.rowSide}>
        {event.isLive && avail !== 'unknown' && avail !== 'online' && (
          <span className={styles.availBadge} data-avail={avail}>
            {AVAILABILITY_LABEL[avail]}
          </span>
        )}
        {event.channels.length > 0 && (
          <span className={styles.rowChannels}>
            {event.channels.length} stream{event.channels.length > 1 ? 's' : ''}
          </span>
        )}
        <span className={styles.rowPlay} aria-hidden>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>
    </button>
  );
});

export const EventList = memo(function EventList({
  events,
  onPlay,
  availabilityOf,
  groupBy = 'sport',
  emptyTitle = 'Nothing scheduled',
  emptyHint = 'Check back later or try another filter.',
}: EventListProps) {
  const groups = useMemo(
    () => (groupBy === 'time' ? bucketByTime(events, Date.now()) : groupBySport(events)),
    [events, groupBy],
  );

  if (!events.length) {
    return (
      <div className={styles.empty}>
        <strong>{emptyTitle}</strong>
        {emptyHint}
      </div>
    );
  }

  return (
    <>
      {groups.map((g) => (
        <section key={g.id} className={styles.group}>
          <h3 className={styles.groupHead}>
            {g.icon && <span aria-hidden>{g.icon}</span>}
            {g.label}
            <small>{g.events.length}</small>
          </h3>
          <div className={styles.rows}>
            {g.events.map((e) => (
              <EventRow key={e.id} event={e} onPlay={onPlay} avail={availabilityOf ? availabilityOf(e) : 'unknown'} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
});
