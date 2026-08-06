/**
 * CategoryTabs — Content category navigation tabs
 *
 * Filters content by category: All, Live TV, Sports, PPV.
 * Selecting a category filters the provider tabs below.
 */

import { memo } from 'react';
import type { ContentCategory } from '../hooks/useLiveTVData';
import styles from '../LiveTV.module.css';

interface CategoryInfo {
  id: ContentCategory;
  label: string;
  icon: string;
  providerCount: number;
  eventCount: number;
  channelCount: number;
}

interface CategoryTabsProps {
  categories: CategoryInfo[];
  selectedCategory: ContentCategory;
  onCategoryChange: (category: ContentCategory) => void;
}

export const CategoryTabs = memo(function CategoryTabs({
  categories,
  selectedCategory,
  onCategoryChange,
}: CategoryTabsProps) {
  if (categories.length === 0) return null;

  return (
    <div className={styles.categoryTabsBar}>
      <div className={styles.categoryTabsScroll}>
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          const totalContent = cat.eventCount + cat.channelCount;

          return (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={`${styles.categoryTab} ${isActive ? styles.active : ''}`}
              data-tv-focusable="true"
            >
              <span className={styles.categoryTabIcon}>{cat.icon}</span>
              <span className={styles.categoryTabLabel}>{cat.label}</span>
              {totalContent > 0 && (
                <span className={`${styles.categoryTabCount} ${isActive ? styles.active : ''}`}>
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
