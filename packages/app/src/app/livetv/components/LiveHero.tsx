/**
 * Live Hero — Featured live events carousel at top of page
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { LiveEvent } from '../hooks/useLiveTVData';
import styles from '../LiveTV.module.css';

const SPORT_ICONS: Record<string, string> = {
  'soccer': '⚽', 'football': '⚽', 'basketball': '🏀', 'tennis': '🎾',
  'cricket': '🏏', 'hockey': '🏒', 'baseball': '⚾', 'golf': '⛳',
  'rugby': '🏉', 'motorsport': '🏎️', 'f1': '🏎️', 'boxing': '🥊',
  'mma': '🥊', 'ufc': '🥊', 'wwe': '🤼', 'volleyball': '🏐',
  'nfl': '🏈', 'nba': '🏀', 'nhl': '🏒', 'darts': '🎯',
};

interface LiveHeroProps {
  liveEvents: LiveEvent[];
  upcomingEvents: LiveEvent[];
  onPlay: (event: LiveEvent) => void;
  loading?: boolean;
}

export const LiveHero = memo(function LiveHero({
  liveEvents,
  upcomingEvents,
  onPlay,
  loading,
}: LiveHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const heroItems = liveEvents.length > 0
    ? liveEvents.slice(0, 5)
    : upcomingEvents.slice(0, 5);

  // Auto-advance every 6 seconds
  useEffect(() => {
    if (heroItems.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % heroItems.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroItems.length]);

  const goTo = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  if (loading) {
    return (
      <div className={styles.heroContainer}>
        <div className={styles.heroSkeleton} />
      </div>
    );
  }

  if (heroItems.length === 0) return null;

  const current = heroItems[activeIndex];
  const sportIcon = current.sport
    ? (SPORT_ICONS[current.sport.toLowerCase()] || '📺')
    : '📺';
  const teamsDisplay = current.teams
    ? `${current.teams.home} vs ${current.teams.away}`
    : current.title;

  return (
    <div className={styles.heroContainer}>
      <div className={styles.heroSlide}>
        <div className={styles.heroBg}>
          {current.poster ? (
            <img src={current.poster} alt="" className={styles.heroBgImage} />
          ) : (
            <div className={styles.heroBgPlaceholder}>
              <span className={styles.heroBgIcon}>{sportIcon}</span>
            </div>
          )}
          <div className={styles.heroGradient} />
        </div>

        <div className={styles.heroContent}>
          <div className={styles.heroBadges}>
            {current.isLive && (
              <span className={styles.heroLiveBadge}>
                <span className={styles.livePulse} />
                LIVE NOW
              </span>
            )}
            {!current.isLive && current.startsIn && (
              <span className={styles.heroUpcomingBadge}>
                Starts in {current.startsIn}
              </span>
            )}
            <span className={styles.heroSourceBadge}>
              {current.source.toUpperCase()}
            </span>
          </div>

          <h2 className={styles.heroTitle}>{teamsDisplay}</h2>
          {current.league && (
            <p className={styles.heroLeague}>{sportIcon} {current.league}</p>
          )}
          {current.sport && (
            <p className={styles.heroSport}>{current.sport}</p>
          )}

          <div className={styles.heroMeta}>
            <span className={styles.heroTime}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              {current.time}
            </span>
            {current.channels && current.channels.length > 0 && (
              <span className={styles.heroChannels}>
                {current.channels.length} channel{current.channels.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <button className={styles.heroPlayBtn} onClick={() => onPlay(current)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch Now
          </button>
        </div>
      </div>

      {heroItems.length > 1 && (
        <div className={styles.heroDots}>
          {heroItems.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`${styles.heroDot} ${i === activeIndex ? styles.active : ''}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
});
