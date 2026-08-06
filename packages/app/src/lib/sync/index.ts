'use client';

import { useState, useEffect, useCallback } from 'react';

export const SYNC_DATA_CHANGED_EVENT = 'sync-data-changed';

export interface SyncContextValue {
  isInitialSyncComplete: boolean;
  lastSyncTime: number;
  triggerSync: () => void;
}

// ─── Provider Settings ──────────────────────────────────────────────────────

export interface ProviderSettings {
  animeAudioPreference: 'sub' | 'dub';
  providerOrder: string[];
  disabledProviders: string[];
}

const PROVIDER_SETTINGS_KEY = 'flyx-provider-settings';

const DEFAULT_PROVIDER_SETTINGS: ProviderSettings = {
  animeAudioPreference: 'sub',
  providerOrder: [],
  disabledProviders: [],
};

export function getProviderSettings(): ProviderSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_PROVIDER_SETTINGS };
  try {
    const raw = localStorage.getItem(PROVIDER_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_PROVIDER_SETTINGS };
    return { ...DEFAULT_PROVIDER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROVIDER_SETTINGS };
  }
}

export function saveProviderSettings(partial: Partial<ProviderSettings>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getProviderSettings();
    const updated = { ...current, ...partial };
    localStorage.setItem(PROVIDER_SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent(SYNC_DATA_CHANGED_EVENT));
  } catch {
    // noop
  }
}

/**
 * Hook to access sync context.
 * Returns whether the initial sync is complete and the last sync timestamp.
 */
export function useSyncContext(): SyncContextValue {
  const [isInitialSyncComplete, setIsInitialSyncComplete] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());

  const triggerSync = useCallback(() => {
    setLastSyncTime(Date.now());
    window.dispatchEvent(new CustomEvent(SYNC_DATA_CHANGED_EVENT));
  }, []);

  useEffect(() => {
    const handleSync = () => {
      setLastSyncTime(Date.now());
    };

    window.addEventListener(SYNC_DATA_CHANGED_EVENT, handleSync);
    return () => window.removeEventListener(SYNC_DATA_CHANGED_EVENT, handleSync);
  }, []);

  return { isInitialSyncComplete, lastSyncTime, triggerSync };
}
