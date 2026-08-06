export interface SubtitleStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  bold: boolean;
  italic: boolean;
  position: "bottom" | "top" | "middle";
  verticalPosition: number;
}

export interface SubtitlePreferences {
  enabled: boolean;
  languageCode: string;
  languageName: string;
  style: SubtitleStyle;
}

const STORAGE_KEY = "flyx_subtitle_prefs_v1";

const DEFAULTS: SubtitlePreferences = {
  enabled: true,
  languageCode: "eng",
  languageName: "English",
  style: {
    fontSize: 18,
    fontFamily: "system-ui",
    color: "#ffffff",
    textColor: "#ffffff",
    backgroundColor: "#000000",
    backgroundOpacity: 0.55,
    bold: false,
    italic: false,
    position: "bottom",
    verticalPosition: 90,
  },
};

export function getSubtitlePreferences(): SubtitlePreferences {
  if (typeof window === "undefined") return structuredClone(DEFAULTS);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...parsed,
      style: { ...DEFAULTS.style, ...(parsed.style || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveSubtitlePreferences(prefs: SubtitlePreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

/** Legacy helpers */
export function getSubtitlePreference(key: string, defaultValue = "") {
  if (typeof localStorage === "undefined") return defaultValue;
  return localStorage.getItem("flyx:subtitles:" + key) || defaultValue;
}

export function setSubtitlePreference(key: string, value: string) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("flyx:subtitles:" + key, value);
  }
}
