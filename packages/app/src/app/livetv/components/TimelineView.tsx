/**
 * Timeline View — EPG-style chronological upcoming schedule
 */

import { memo } from 'react';
import { LiveEvent } from '../hooks/useLiveTVData';
import styles from '../LiveTV.module.css';

interface TimelineViewProps {
  liveEvents: LiveEvent[];
  upcomingEvents: LiveEvent[];
  onPlay: (event: LiveEvent) => void;
}

const SPORT_ICONS: Record<string, string> = {
  'soccer': '⚽', 'football': '⚽', 'basketball': '🏀', 'tennis': '🎾',
  'cricket': '🏏', 'hockey': '🏒', 'baseball': '⚾', 'golf': '⛳',
  'rugby': '🏉', 'motorsport': '🏎️', 'f1': '🏎️', 'boxing': '🥊',
  'mma': '🥊', 'ufc': '🥊', 'wwe': '🤼', 'volleyball': '🏐',
  'nfl': '🏈', 'nba': '🏀', 'nhl': '🏒', 'darts': '🎯',
};

function formatHour(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

function getSportIcon(sport: string): string {
  const lower = sport.toLowerCase();
  for (const [key, icon] of Object.entries(SPORT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '📺';
}

// Group events by hour
function groupByHour(events: LiveEvent[]): Map<string, LiveEvent[]> {
  const groups = new Map<string, LiveEvent[]>();
  for (const event of events) {
    if (!event.isoTime) continue;
    try {
      const date = new Date(event.isoTime);
      if (isNaN(date.getTime())) continue;
      // Round to nearest hour
      date.setMinutes(0, 0, 0);
      const key = date.toISOString();
      const existing = groups.get(key) || [];
      existing.push(event);
      groups.set(key, existing);
    } catch {
      continue;
    }
  }
  return groups;
}

export const TimelineView = memo(function TimelineView({
  liveEvents,
  upcomingEvents,
  onPlay,
}: TimelineViewProps) {
  const grouped = groupByHour(upcomingEvents);
  const hourEntries = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));

  if (liveEvents.length === 0 && hourEntries.length === 0) {
    return (
      <div className={styles.messageBox}>
        <span className={styles.messageIcon}>📅</span>
        <p>No upcoming events scheduled. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className={styles.timelineContainer}>
      {/* Live Now section */}
      {liveEvents.length > 0 && (
        <div className={styles.timelineSection}>
          <div className={styles.timelineHour}>
            <span className={styles.timelineHourDot} />
            LIVE NOW
          </div>
          <div className={styles.timelineEvents}>
            {liveEvents.map((event) => (
              <div
                key={event.id}
                className={styles.timelineEvent}
                onClick={() => onPlay(event)}
                data-tv-focusable="true"
              >
                <div className={styles.timelineEventTime}>
                  <span className={styles.timelineLiveLabel}>LIVE</span>
                </div>
                <div className={styles.timelineEventContent}>
                  <span className={styles.timelineEventIcon}>
                    {event.sport ? getSportIcon(event.sport) : '📺'}
                  </span>
                  <div className={styles.timelineEventInfo}>
                    <span className={styles.timelineEventTitle}>
                      {event.teams ? `${event.teams.home} vs ${event.teams.away}` : event.title}
                    </span>
                    {event.league && (
                      <span className={styles.timelineEventLeague}>{event.league}</span>
                    )}
                  </div>
                  <span className={styles.timelineEventSource}>{event.source.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming events grouped by hour */}
      {hourEntries.map(([hourKey, events]) => {
        const hourDate = new Date(hourKey);
        const hourLabel = formatHour(hourDate);

        return (
          <div key={hourKey} className={styles.timelineSection}>
            <div className={styles.timelineHour}>
              <span className={styles.timelineHourTime}>{hourLabel}</span>
            </div>
            <div className={styles.timelineEvents}>
              {events.map((event) => (
                <div
                  key={event.id}
                  className={styles.timelineEvent}
                  onClick={() => onPlay(event)}
                  data-tv-focusable="true"
                >
                  <div className={styles.timelineEventTime}>
                    <span className={styles.timelineEventClock}>{event.time}</span>
                  </div>
                  <div className={styles.timelineEventContent}>
                    <span className={styles.timelineEventIcon}>
                      {event.sport ? getSportIcon(event.sport) : '📺'}
                    </span>
                    <div className={styles.timelineEventInfo}>
                      <span className={styles.timelineEventTitle}>
                        {event.teams ? `${event.teams.home} vs ${event.teams.away}` : event.title}
                      </span>
                      {event.league && (
                        <span className={styles.timelineEventLeague}>{event.league}</span>
                      )}
                    </div>
                    {event.channels && event.channels.length > 0 && (
                      <span className={styles.timelineEventChannels}>
                        {event.channels.length} ch
                      </span>
                    )}
                    <span className={styles.timelineEventSource}>{event.source.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
});
