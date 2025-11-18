/**
 * Subtitle Preferences - LocalStorage management for user subtitle settings
 */

export interface SubtitlePreferences {
  enabled: boolean;
  languageCode: string;
  languageName: string;
}

const STORAGE_KEY = 'vynx_subtitle_preferences';
const DEFAULT_PREFERENCES: SubtitlePreferences = {
  enabled: true,
  languageCode: 'eng',
  languageName: 'English',
};

/**
 * Get subtitle preferences from localStorage
 */
export function getSubtitlePreferences(): SubtitlePreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFERENCES;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[SubtitlePreferences] Error reading from localStorage:', error);
  }

  return DEFAULT_PREFERENCES;
}

/**
 * Save subtitle preferences to localStorage
 */
export function saveSubtitlePreferences(preferences: SubtitlePreferences): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    console.log('[SubtitlePreferences] Saved:', preferences);
  } catch (error) {
    console.error('[SubtitlePreferences] Error writing to localStorage:', error);
  }
}

/**
 * Update subtitle enabled state
 */
export function setSubtitlesEnabled(enabled: boolean): void {
  const preferences = getSubtitlePreferences();
  preferences.enabled = enabled;
  saveSubtitlePreferences(preferences);
}

/**
 * Update subtitle language preference
 */
export function setSubtitleLanguage(languageCode: string, languageName: string): void {
  const preferences = getSubtitlePreferences();
  preferences.languageCode = languageCode;
  preferences.languageName = languageName;
  saveSubtitlePreferences(preferences);
}

/**
 * Clear subtitle preferences (reset to defaults)
 */
export function clearSubtitlePreferences(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[SubtitlePreferences] Cleared');
  } catch (error) {
    console.error('[SubtitlePreferences] Error clearing localStorage:', error);
  }
}
