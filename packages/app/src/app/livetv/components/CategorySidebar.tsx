/**
 * Category Sidebar — Quick-jump category navigation
 * Desktop: vertical sidebar, Mobile: horizontal scroll pills
 */

import { memo } from 'react';
import styles from '../LiveTV.module.css';

interface Category {
  id: string;
  name: string;
  icon: string;
  count: number;
}

interface CategorySidebarProps {
  categories: Category[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  showLiveOnly: boolean;
  onLiveToggle: () => void;
  liveCount: number;
  channelCategories?: Category[];
  showChannels?: boolean;
}

export const CategorySidebar = memo(function CategorySidebar({
  categories,
  selectedCategory,
  onCategoryChange,
  showLiveOnly,
  onLiveToggle,
  liveCount,
  channelCategories = [],
  showChannels = false,
}: CategorySidebarProps) {
  interface SidebarItem {
    id: string;
    name: string;
    icon: string;
    count: number;
    isSpecial?: boolean;
    isDivider?: boolean;
  }

  const allCategories: SidebarItem[] = [
    { id: 'live', name: 'Live Now', icon: '🔴', count: liveCount, isSpecial: true },
    { id: 'all', name: 'All', icon: '🏆', count: categories.reduce((sum, c) => sum + c.count, 0) },
    ...categories.slice(0, 12),
    ...(showChannels ? [
      { id: '__channels__', name: 'TV Channels', icon: '📺', count: channelCategories.reduce((sum, c) => sum + c.count, 0), isDivider: true },
      ...channelCategories.slice(0, 8),
    ] : []),
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <nav className={styles.categorySidebar} aria-label="Categories">
        <div className={styles.categorySidebarInner}>
          {allCategories.map((cat) => {
            if (cat.isDivider) {
              return (
                <div key={cat.id} className={styles.categoryDivider}>
                  <span className={styles.categoryDividerIcon}>{cat.icon}</span>
                  <span className={styles.categoryDividerLabel}>{cat.name}</span>
                </div>
              );
            }

            if (cat.isSpecial) {
              return (
                <button
                  key={cat.id}
                  onClick={onLiveToggle}
                  className={`${styles.categoryItem} ${styles.categorySpecial} ${showLiveOnly ? styles.active : ''}`}
                  data-tv-focusable="true"
                >
                  <span className={styles.categoryIcon}>{cat.icon}</span>
                  <span className={styles.categoryName}>{cat.name}</span>
                  <span className={styles.categoryCount}>{cat.count}</span>
                </button>
              );
            }

            const isActive = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id === selectedCategory ? 'all' : cat.id)}
                className={`${styles.categoryItem} ${isActive ? styles.active : ''}`}
                data-tv-focusable="true"
              >
                <span className={styles.categoryIcon}>{cat.icon}</span>
                <span className={styles.categoryName}>{cat.name}</span>
                <span className={styles.categoryCount}>{cat.count}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile horizontal scroll */}
      <div className={styles.categoryMobileScroll}>
        <button
          onClick={onLiveToggle}
          className={`${styles.categoryMobilePill} ${showLiveOnly ? styles.active : ''}`}
        >
          <span className={styles.liveDotMini} />
          Live ({liveCount})
        </button>
        <button
          onClick={() => onCategoryChange('all')}
          className={`${styles.categoryMobilePill} ${selectedCategory === 'all' && !showLiveOnly ? styles.active : ''}`}
        >
          🏆 All
        </button>
        {categories.slice(0, 8).map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id === selectedCategory ? 'all' : cat.id)}
            className={`${styles.categoryMobilePill} ${selectedCategory === cat.id ? styles.active : ''}`}
          >
            {cat.icon} {cat.name} ({cat.count})
          </button>
        ))}
      </div>
    </>
  );
});
