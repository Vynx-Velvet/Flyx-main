'use client';

/**
 * FilterChips — a horizontally scrolling row of toggle chips with counts.
 * `all` is always first; the active chip is lime.
 */

import styles from '../LiveTVPage.module.css';

export interface ChipItem {
  id: string;
  label: string;
  icon?: string;
  count?: number;
}

interface FilterChipsProps {
  items: ChipItem[];
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;
  allCount?: number;
  ariaLabel: string;
}

export function FilterChips({ items, value, onChange, allLabel = 'All', allCount, ariaLabel }: FilterChipsProps) {
  return (
    <div className={styles.chips} role="tablist" aria-label={ariaLabel}>
      <button
        type="button"
        role="tab"
        className={styles.chip}
        data-active={value === 'all' ? 'true' : 'false'}
        aria-selected={value === 'all'}
        onClick={() => onChange('all')}
        data-tv-focusable="true"
      >
        {allLabel}
        {allCount != null && <span className={styles.chipCount}>{allCount}</span>}
      </button>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className={styles.chip}
          data-active={value === item.id ? 'true' : 'false'}
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          data-tv-focusable="true"
        >
          {item.icon && <span aria-hidden>{item.icon}</span>}
          {item.label}
          {item.count != null && <span className={styles.chipCount}>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
