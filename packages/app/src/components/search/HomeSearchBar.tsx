"use client";

import { useIsApple } from "@/hooks/useIsApple";
import { useCommandPalette } from "@/components/search/CommandPalette";

export default function HomeSearchBar() {
  const isApple = useIsApple();
  const { openPalette } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={openPalette}
      className="home-search-bar group"
      aria-label="Open command menu"
    >
      <span className="home-search-icon" aria-hidden>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>

      <div className="home-search-copy">
        <span className="home-search-title">Search the library</span>
        <span className="home-search-sub">
          Movies, shows, anime — find anything
        </span>
      </div>

      <div className="home-search-chips" aria-hidden>
        <span className="home-search-chip home-search-chip-movie">Movies</span>
        <span className="home-search-chip home-search-chip-tv">TV</span>
        <span className="home-search-chip home-search-chip-anime">Anime</span>
      </div>

      <span
        className="home-search-kbd"
        aria-label={isApple ? "Command K" : "Control K"}
      >
        <kbd>{isApple ? "⌘" : "Ctrl"}</kbd>
        <kbd>K</kbd>
      </span>

      <span className="home-search-arrow" aria-hidden>
        →
      </span>
    </button>
  );
}
