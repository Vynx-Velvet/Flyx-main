'use client';

import { useState, useEffect } from 'react';

export interface DiscordStats {
  memberCount: number;
  onlineCount: number;
}

/**
 * Hook to fetch Discord server statistics via a proxy endpoint.
 * Returns null when the API call fails or is not yet loaded.
 */
export function useDiscordStats(): DiscordStats | null {
  const [stats, setStats] = useState<DiscordStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        // Using a public Discord invite stats endpoint
        const response = await fetch(
          'https://discord.com/api/v9/invites/CUG5p8B3vq?with_counts=true'
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setStats({
            memberCount: data.approximate_member_count ?? 0,
            onlineCount: data.approximate_presence_count ?? 0,
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
