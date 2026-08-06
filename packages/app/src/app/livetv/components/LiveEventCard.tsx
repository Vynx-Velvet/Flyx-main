/**
 * Live Event Card — Glassmorphism card for sports events
 */

import { memo } from 'react';
import { LiveEvent } from '../hooks/useLiveTVData';
import styles from '../LiveTV.module.css';

const SPORT_ICONS: Record<string, string> = {
  'soccer': '⚽', 'football': '⚽', 'basketball': '🏀', 'tennis': '🎾',
  'cricket': '🏏', 'hockey': '🏒', 'baseball': '⚾', 'golf': '⛳',
  'rugby': '🏉', 'motorsport': '🏎️', 'f1': '🏎️', 'boxing': '🥊',
  'mma': '🥊', 'ufc': '🥊', 'wwe': '🤼', 'volleyball': '🏐',
  'nfl': '🏈', 'nba': '🏀', 'nhl': '🏒', 'darts': '🎯',
};

const SOURCE_STYLES: Record<string, { label: string; className: string }> = {
  dlhd:       { label: 'DLHD',       className: 'sourceBlue' },
  cdnlive:    { label: 'CDN Live',   className: 'sourcePurple' },
  ntv:        { label: 'NTV',        className: 'sourceGreen' },
  globetv:    { label: 'GlobeTV',    className: 'sourceCyan' },
  streamninja:{ label: 'StreamNinja',className: 'sourceRed' },
  ppv:        { label: 'PPV',        className: 'sourceGold' },
  viprow:     { label: 'VIPRow',     className: 'sourcePink' },
};

function getSportIcon(sport: string): string {
  const lower = sport.toLowerCase();
  for (const [key, icon] of Object.entries(SPORT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return '📺';
}

interface LiveEventCardProps {
  event: LiveEvent;
  onPlay: (event: LiveEvent) => void;
  featured?: boolean;
}

export const LiveEventCard = memo(function LiveEventCard({ event, onPlay, featured }: LiveEventCardProps) {
  const sourceStyle = SOURCE_STYLES[event.source] || { label: 'LIVE', className: 'sourceGray' };
  const sportIcon = event.sport ? getSportIcon(event.sport) : '📺';
  const teamsDisplay = event.teams
    ? `${event.teams.home} vs ${event.teams.away}`
    : event.title;

  return (
    <div
      className={`${styles.eventCard} ${featured ? styles.featured : ''}`}
      onClick={() => onPlay(event)}
      data-tv-focusable="true"
    >
      <div className={styles.eventPoster}>
        {event.poster ? (
          <img src={event.poster} alt={event.title} className={styles.posterImage} loading="lazy" />
        ) : (
          <div className={styles.posterPlaceholder}>
            <span className={styles.sportIconLarge}>{sportIcon}</span>
          </div>
        )}

        <div className={styles.eventOverlay}>
          <button className={styles.playButton} aria-label={`Play ${event.title}`}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>

        {event.isLive && (
          <div className={styles.liveBadge}>
            <span className={styles.livePulse} />
            LIVE
          </div>
        )}

        {!event.isLive && event.startsIn && (
          <div className={styles.upcomingBadge}>
            in {event.startsIn}
          </div>
        )}

        <div className={`${styles.sourceBadge} ${styles[sourceStyle.className]}`}>
          {sourceStyle.label}
        </div>
      </div>

      <div className={styles.eventInfo}>
        <h3 className={styles.eventTitle}>{teamsDisplay}</h3>
        {event.league && <span className={styles.eventLeague}>{event.league}</span>}

        <div className={styles.eventMeta}>
          <span className={styles.eventTime}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            {event.time}
          </span>
          {event.sport && (
            <span className={styles.eventSportTag}>
              {sportIcon} {event.sport}
            </span>
          )}
        </div>

        {event.channels && event.channels.length > 0 && (
          <div className={styles.eventChannels}>
            <span className={styles.channelCount}>
              {event.channels.length} channel{event.channels.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
