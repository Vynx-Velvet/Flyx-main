/**
 * ProviderTabs — Provider selection tabs
 */

import { memo } from 'react';
import type { Provider, ProviderInfo } from '../hooks/useLiveTVData';
import styles from '../LiveTV.module.css';

const PROVIDER_COLORS: Record<Provider | 'all', { bg: string; text: string }> = {
  all:  { bg: 'transparent', text: 'var(--color-text)' },
  dlhd: { bg: 'hsl(210, 100%, 50%, 0.15)', text: 'hsl(210, 100%, 65%)' },
};

interface ProviderTabsProps {
  providers: ProviderInfo[];
  selectedProvider: Provider | 'all';
  onProviderChange: (provider: Provider | 'all') => void;
}

export const ProviderTabs = memo(function ProviderTabs({
  providers,
  selectedProvider,
  onProviderChange,
}: ProviderTabsProps) {
  if (providers.length === 0) return null;

  return (
    <div className={styles.providerTabsBar}>
      <div className={styles.providerTabsScroll}>
        <button
          onClick={() => onProviderChange('all')}
          className={`${styles.providerTab} ${selectedProvider === 'all' ? styles.active : ''}`}
          data-tv-focusable="true"
        >
          <span className={styles.providerTabLabel}>All Providers</span>
          <span className={`${styles.providerTabLive} ${selectedProvider === 'all' ? styles.active : ''}`}>
            {providers.reduce((sum, p) => sum + p.liveCount, 0)} live
          </span>
        </button>

        {providers.map((prov) => {
          const isActive = selectedProvider === prov.id;
          const colors = PROVIDER_COLORS[prov.id];
          const totalContent = prov.eventCount + prov.channelCount;

          return (
            <button
              key={prov.id}
              onClick={() => onProviderChange(prov.id)}
              className={`${styles.providerTab} ${isActive ? styles.active : ''}`}
              style={isActive ? {
                borderColor: colors.text,
                background: colors.bg,
              } : undefined}
              data-tv-focusable="true"
            >
              <span
                className={styles.providerTabDot}
                style={{ background: colors.text }}
              />
              <span className={styles.providerTabLabel}>{prov.label}</span>
              {prov.liveCount > 0 && (
                <span className={`${styles.providerTabLive} ${isActive ? styles.active : ''}`}>
                  {prov.liveCount} live
                </span>
              )}
              {totalContent > 0 && prov.liveCount === 0 && (
                <span className={styles.providerTabCount}>
                  {totalContent}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
