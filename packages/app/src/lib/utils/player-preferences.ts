export interface PlayerPreferences {
  autoPlayNextEpisode: boolean;
  autoPlayCountdown: number;
  showNextEpisodeBeforeEnd: number;
  preferredQuality: string;
  playbackSpeed: number;
}

const STORAGE_KEY = "flyx_player_prefs_v1";

const DEFAULTS: PlayerPreferences = {
  autoPlayNextEpisode: true,
  autoPlayCountdown: 10,
  showNextEpisodeBeforeEnd: 60,
  preferredQuality: "auto",
  playbackSpeed: 1,
};

export function getPlayerPreferences(): PlayerPreferences {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePlayerPreferences(prefs: PlayerPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

/** Legacy key/value helpers */
export function getPlayerPreference(key: string, defaultValue = "") {
  if (typeof localStorage === "undefined") return defaultValue;
  return localStorage.getItem("flyx:player:" + key) || defaultValue;
}

export function setPlayerPreference(key: string, value: string) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("flyx:player:" + key, value);
  }
}
