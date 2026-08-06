/**
 * Channel Card — Compact card for TV channels
 */

import { memo } from 'react';
import { TVChannel } from '../hooks/useLiveTVData';
import styles from '../LiveTV.module.css';

interface ChannelCardProps {
  channel: TVChannel;
  onPlay: (channel: TVChannel) => void;
}

const SOURCE_ACCENT: Record<string, string> = {
  dlhd:       styles.accentBlue,
  cdnlive:    styles.accentPurple,
  ntv:        styles.accentGreen,
  globetv:    styles.accentCyan,
  streamninja:styles.accentRed,
  ppv:        styles.accentGold,
  viprow:     styles.accentPink,
};

export const ChannelCard = memo(function ChannelCard({ channel, onPlay }: ChannelCardProps) {
  const accentClass = SOURCE_ACCENT[channel.source] || '';

  return (
    <div
      className={`${styles.channelCard} ${accentClass}`}
      onClick={() => onPlay(channel)}
      data-tv-focusable="true"
    >
      <div className={styles.channelLogo}>
        {channel.logo ? (
          <img src={channel.logo} alt={channel.name} loading="lazy" />
        ) : (
          <span className={styles.channelLogoPlaceholder}>📺</span>
        )}
      </div>

      <div className={styles.channelInfo}>
        <h4 className={styles.channelName}>{channel.name}</h4>
        <div className={styles.channelMeta}>
          <span className={styles.channelCategory}>{channel.category}</span>
          {channel.countryName && (
            <span className={styles.channelCountry}>{channel.countryName}</span>
          )}
        </div>
      </div>

      <div className={styles.channelActions}>
        {channel.viewers !== undefined && channel.viewers > 0 && (
          <span className={styles.channelViewers}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            {channel.viewers}
          </span>
        )}
        <span className={styles.channelPlayBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>
    </div>
  );
});
