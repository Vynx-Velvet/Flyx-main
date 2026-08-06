'use client';

import { useState, useEffect } from 'react';

export interface GitHubStats {
  stars: number;
  forks: number;
}

/**
 * Hook to fetch GitHub repository statistics.
 * Returns null when the API call fails or is not yet loaded.
 */
export function useGitHubStats(): GitHubStats | null {
  const [stats, setStats] = useState<GitHubStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const response = await fetch(
          'https://api.github.com/repos/Vynx-Velvet/Flyx-Main'
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setStats({
            stars: data.stargazers_count ?? 0,
            forks: data.forks_count ?? 0,
          });
        }
      } catch {
        // Silently fail — stats are non-critical
      }
    }

    fetchStats();

    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}
