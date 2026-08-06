"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useCast } from "@/hooks/useCast";
import PlayerHelpModal, {
  shouldAutoShowPlayerHelp,
  markPlayerHelpSessionShown,
  detectHelpPlatform,
  PLAYER_HELP_NEVER_KEY,
  PLAYER_HELP_SEEN_KEY,
} from "@/components/player/PlayerHelpModal";
import {
  CastOverlay,
  CastErrorBanner,
  IconHelp,
  IconCast,
} from "@/components/player/CastUI";
import {
  getProviderSettings,
  saveProviderSettings,
} from "@/lib/sync";

const TMDB_IMG = "https://image.tmdb.org/t/p";

type AnimeAudioMode = "sub" | "dub";

interface Details {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
}

interface StreamSource {
  url: string;
  quality?: string;
  provider?: string;
  type?: string;
  title?: string;
  /** Anime audio track: sub (JP + subs) or dub (EN dubbed). */
  language?: string;
  /** Referer header required by the CDN. */
  referer?: string;
  /** Origin header required by the CDN. */
  origin?: string;
}

interface Episode {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
}

type ProviderKind = "vod" | "anime";
type ProviderLoadState = "idle" | "loading" | "ready" | "empty" | "error";

interface CatalogProvider {
  id: string;
  label: string;
  blurb: string;
  kind: ProviderKind;
}

/**
 * Server selector: ONLY reverse-engineered extractors.
 * Stubs / unfinished providers are intentionally excluded.
 */
const VOD_PROVIDERS: CatalogProvider[] = [
  // Order: most reliable first for UX (not necessarily pipeline priority)
  { id: "vidsrc", label: "VidSrc", blurb: "VSEmbed · RCP · JWT", kind: "vod" },
  { id: "multiembed", label: "2Embed", blurb: "XPS · multi-CDN", kind: "vod" },
  { id: "videasy", label: "Videasy", blurb: "Speedrace · multi-CDN", kind: "vod" },
  { id: "vidcore", label: "VidCore", blurb: "API · multi-server", kind: "vod" },
];

/** Anime RE extractors */
const ANIME_PROVIDERS: CatalogProvider[] = [
  { id: "animex", label: "AnimeX", blurb: "animex.one · cx.aniwatchtv.site", kind: "anime" },
];

/**
 * Route a source URL through our stream proxy when the CDN requires
 * Referer / Origin headers that the browser <video> element cannot send.
 *
 * MP4 files loaded via video.src don't go through hls.js xhrSetup —
 * the browser makes the request directly without custom headers.
 * The proxy adds the required headers server-side.
 */
/** Proxy HLS sources (browser <video> can't send custom headers),
 *  but skip the proxy for MP4 — the browser loads it natively. */
function proxySourceUrl(source: StreamSource): string {
  // MP4 plays natively — no proxy overhead needed
  if (source.type === "mp4") return source.url;
  // HLS needs proxy for segment requests with custom headers
  if (!source.referer && !source.origin) return source.url;
  const params = new URLSearchParams();
  params.set("url", source.url);
  if (source.referer) params.set("referer", source.referer);
  if (source.origin) params.set("origin", source.origin);
  return `/api/stream/proxy?${params.toString()}`;
}

/** Infer sub/dub from explicit language field or source title. */
function detectAudioLang(s: {
  language?: string;
  title?: string;
}): AnimeAudioMode | null {
  const lang = (s.language || "").toLowerCase().trim();
  if (lang === "dub" || lang === "en" || lang === "english") return "dub";
  if (lang === "sub" || lang === "ja" || lang === "jp" || lang === "japanese")
    return "sub";

  const title = (s.title || "").toLowerCase();
  if (/\b(dub|dubbed|english)\b/.test(title) || title.includes("(dub)"))
    return "dub";
  if (/\b(sub|subbed|japanese)\b/.test(title) || title.includes("(sub)"))
    return "sub";
  return null;
}

function isValidVideoUrl(url: string): boolean {
  // Must have a recognizable video extension or be a proper HLS playlist
  if (/\.(mp4|m3u8|mkv|webm|mpd|ts|m4s)(\?|$)/i.test(url)) return true;
  // Wix repackager URLs are valid HLS
  if (url.includes("repackager.wixmp.com")) return true;
  // Wix static URLs must have a filename after the quality folder
  if (url.includes("video.wixstatic.com")) {
    // Valid if it has a filename after the quality (e.g. /1080p/mp4/file.mp4)
    if (/\/\d+p\/[^/]+\.[a-z0-9]+/i.test(url)) return true;
    // Ending with just a quality folder (e.g. /1080p/) is incomplete
    console.log("[Watch] 🚫 Rejecting incomplete wixstatic URL:", url.substring(0, 100));
    return false;
  }
  // Any URL ending with bare quality folder is incomplete
  if (/\/\d+p\/?$/i.test(url)) {
    console.log("[Watch] 🚫 Rejecting incomplete URL (ends with quality):", url.substring(0, 100));
    return false;
  }
  // URLs that look like base paths without files are suspect
  if (url.endsWith("/") && !url.includes("m3u8")) {
    console.log("[Watch] 🚫 Rejecting URL ending with slash:", url.substring(0, 100));
    return false;
  }
  return true;
}

function normalizeSource(s: any, fallbackProvider?: string): StreamSource | null {
  if (!s?.url) return null;
  if (!isValidVideoUrl(s.url)) {
    console.log("[Watch] 🚫 Skipping invalid URL:", s.url?.substring(0, 100));
    return null;
  }
  const title = s.title;
  const language =
    s.language ||
    detectAudioLang({ language: s.language, title }) ||
    undefined;
  return {
    url: s.url,
    quality: s.quality,
    provider: s.provider || fallbackProvider,
    type: s.type,
    title,
    language,
    referer: s.referer || undefined,
    origin: s.origin || undefined,
  };
}

function parseSourceList(data: any, fallbackProvider?: string): StreamSource[] {
  const list: StreamSource[] = [];
  const push = (s: any) => {
    const n = normalizeSource(s, fallbackProvider);
    if (n) list.push(n);
  };
  if (Array.isArray(data.sources)) data.sources.forEach(push);
  else if (Array.isArray(data.data?.sources)) data.data.sources.forEach(push);
  else if (data.url) push(data);
  else if (data.data?.url) push(data.data);
  else if (data.stream?.url) push(data.stream);
  return list;
}

function qualityRank(q?: string): number {
  if (!q) return 0;
  const m = q.match(/(\d{3,4})/);
  return m ? parseInt(m[1], 10) : q.toLowerCase().includes("auto") ? 1 : 0;
}

/**
 * Rank for source *lists / UI* — higher quality first.
 * Do NOT use this alone for initial autoplay: progressive 1080p MP4 via
 * the stream proxy is often 20–30s to first frame.
 */
function sourceRank(s: StreamSource): number {
  let score = qualityRank(s.quality);
  // Slight preference for HLS in lists (adaptive); MP4 still ranks by quality
  if (s.type === "hls") score += 1;
  if (s.type === "mp4") score += 2;
  return score;
}

/**
 * Rank for *initial playback* — optimize time-to-first-frame.
 * Progressive high-bitrate MP4 through /api/stream/proxy is slow; HLS with
 * startLevel:0 or a mid-quality MP4 starts much faster.
 */
function fastStartRank(s: StreamSource): number {
  const q = qualityRank(s.quality);
  if (s.type === "hls" || (s.url && s.url.includes(".m3u8"))) {
    // Adaptive playlist — hls.js starts at lowest rung (startLevel: 0)
    return 2000 + (q > 0 ? Math.min(q, 100) : 50);
  }
  if (s.type === "mp4" || (s.url && /\.mp4(\?|$)/i.test(s.url))) {
    // Prefer 720p, then 480p, then 360p; penalize 1080p+ (huge first byte wait)
    let tier = 0;
    if (q === 720) tier = 300;
    else if (q === 480) tier = 280;
    else if (q === 360 || q === 540) tier = 260;
    else if (q > 0 && q < 720) tier = 240;
    else if (q === 1080) tier = 120;
    else if (q > 1080) tier = 80;
    else tier = 200; // unknown quality
    return 1000 + tier;
  }
  return q;
}

/** Pick the source that will start playing soonest (not max quality). */
function pickBestSource(
  list: StreamSource[],
  mode: AnimeAudioMode,
  isAnime: boolean,
): StreamSource | null {
  const filtered = filterSourcesByAudio(list, mode, isAnime);
  if (!filtered.length) return null;
  const sorted = [...filtered].sort(
    (a, b) => fastStartRank(b) - fastStartRank(a),
  );
  return sorted[0]!;
}

function sourceMatchesAudio(
  s: StreamSource,
  mode: AnimeAudioMode,
  isAnime: boolean,
): boolean {
  if (!isAnime) return true;
  const detected = detectAudioLang(s);
  if (!detected) return true;
  return detected === mode;
}

function filterSourcesByAudio(
  list: StreamSource[],
  mode: AnimeAudioMode,
  isAnime: boolean,
): StreamSource[] {
  if (!isAnime) return list;
  const taggedForMode = list.filter((s) => detectAudioLang(s) === mode);
  if (taggedForMode.length > 0) return taggedForMode;
  const anyTagged = list.some((s) => detectAudioLang(s) != null);
  if (anyTagged) return [];
  return list;
}

function sourceDisplayName(s: StreamSource, index: number): string {
  const q = s.quality?.trim();
  const type = s.type?.toUpperCase();
  // Clean title: drop redundant provider name, quality, and (sub)/(dub) — shown as badges
  let base = (s.title || "").trim();
  base = base
    .replace(/\s*[·•|-]?\s*\(?\s*(sub|dub)(bed)?\s*\)?/gi, "")
    .replace(/\bAnimeX\b/gi, "")
    .replace(/\b(1080p|720p|480p|360p|Auto)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[·•|\-\s]+|[·•|\-\s]+$/g, "")
    .trim();

  if (q && q.toLowerCase() !== "auto") {
    return base ? `${q} · ${base}` : q;
  }
  if (q === "Auto" || q?.toLowerCase() === "auto") {
    return base ? `Auto · ${base}` : type === "HLS" ? "Auto (HLS)" : "Auto";
  }
  if (base) return base;
  if (type) return type;
  return `Stream ${index + 1}`;
}

function shortError(msg: string): string {
  if (!msg) return "No playable sources found. Try again in a moment.";
  if (/provider\(s\) failed/i.test(msg) || msg.length > 120) {
    return "No playable sources right now. Providers may be offline — hit Retry.";
  }
  return msg;
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function WatchInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tmdbId = searchParams.get("tmdbId") ?? "";
  const malId = searchParams.get("malId") ?? "";
  const isAnime = Boolean(malId) || searchParams.get("mediaType") === "anime";
  const mediaType = (
    searchParams.get("mediaType") === "tv" ? "tv" : "movie"
  ) as "movie" | "tv";
  /** Currently playing season/episode (drives extract + playback). */
  const [season, setSeason] = useState(searchParams.get("season") ?? "1");
  const [episode, setEpisode] = useState(searchParams.get("episode") ?? "1");
  /**
   * Season selected in the episode panel only — browsing another season must
   * NOT change playback until the user picks a specific episode.
   */
  const [browseSeason, setBrowseSeason] = useState(
    searchParams.get("season") ?? "1",
  );

  const { addItem, removeItem, isInWatchlist } = useWatchlist();
  const [details, setDetails] = useState<Details | null>(null);
  const [animeTitle, setAnimeTitle] = useState("");
  const [animePoster, setAnimePoster] = useState("");
  const [animeEpCount, setAnimeEpCount] = useState(0);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [seasonsCount, setSeasonsCount] = useState(0);
  const [showSources, setShowSources] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);

  // Provider / server selector
  /** Provider currently driving playback (chip "On" badge). */
  const [playbackProvider, setPlaybackProvider] = useState<string | null>(null);
  /** Provider selected in the sheet for browsing sources (does not auto-play). */
  const [sheetProvider, setSheetProvider] = useState<string | null>(null);
  const [sourcesCache, setSourcesCache] = useState<
    Record<string, StreamSource[]>
  >({});
  const [providerState, setProviderState] = useState<
    Record<string, ProviderLoadState>
  >({});
  const [providerErrors, setProviderErrors] = useState<Record<string, string>>(
    {},
  );
  const [loadingProvider, setLoadingProvider] = useState(false);
  /** Anime Sub / Dub preference (persisted). Always starts as "sub" to
   *  match SSR — localStorage preference is synced in a useEffect below. */
  const [audioMode, setAudioMode] = useState<AnimeAudioMode>("sub");
  const resumeAfterSwitchRef = useRef<number | null>(null);
  const loadStartRef = useRef(0);
  const probeGenRef = useRef(0);
  const audioModeRef = useRef(audioMode);
  audioModeRef.current = audioMode;
  /** Latest provider cache/state for media-error recovery without re-binding HLS. */
  const playbackCtxRef = useRef({
    playbackProvider: null as string | null,
    sourcesCache: {} as Record<string, StreamSource[]>,
    providerState: {} as Record<string, ProviderLoadState>,
    catalogIds: [] as string[],
    audioMode: "sub" as AnimeAudioMode,
    isAnime: false,
    browseProvider: null as null | ((
      id: string,
      opts?: { force?: boolean; playFirst?: boolean },
    ) => Promise<void>),
    showToast: ((_msg: string) => {}) as (msg: string) => void,
  });

  // Sync persisted audio preference after hydration to avoid SSR mismatch.
  // The state always starts as "sub" so server & initial client render agree.
  useEffect(() => {
    const pref = getProviderSettings().animeAudioPreference;
    if (pref === "dub") setAudioMode("dub");
  }, []);

  // Player UI state
  const [playing, setPlaying] = useState(false);
  /** True after the first `play` event for the current source.
   *  Distinguishes "still buffering first frame" from "user paused". */
  const [hasStarted, setHasStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [castOverlay, setCastOverlay] = useState(false);
  const [castErrorDismissed, setCastErrorDismissed] = useState(false);
  const helpAutoOpenedRef = useRef(false);

  // Action feedback (YouTube-style)
  const [seekFlash, setSeekFlash] = useState<{
    dir: "left" | "right";
    sec: number;
  } | null>(null);
  const [volumeHud, setVolumeHud] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeRef = useRef(1);
  const seekFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeHudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ t: number; side: string }>({ t: 0, side: "" });

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  const title =
    animeTitle ||
    details?.title ||
    details?.name ||
    (malId ? `Anime ${malId}` : `Title ${tmdbId}`);
  const year = (details?.release_date ?? details?.first_air_date)?.slice(0, 4);
  const poster =
    (details?.poster_path
      ? `${TMDB_IMG}/w500${details.poster_path}`
      : animePoster) || "";

  const inList = malId
    ? isInWatchlist(malId, "anime")
    : tmdbId
      ? isInWatchlist(tmdbId, mediaType)
      : false;

  const bumpChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    // Keep chrome pinned while sheets / menus are open
    if (showSources || showEpisodes || showHelp || showSpeedMenu) return;
    hideTimer.current = setTimeout(() => setChromeVisible(false), 2800);
  }, [showSources, showEpisodes, showHelp, showSpeedMenu]);

  const showToast = useCallback((msg: string) => {
    setActionToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setActionToast(null), 1100);
  }, []);

  const flashSeek = useCallback((dir: "left" | "right", sec: number) => {
    setSeekFlash({ dir, sec });
    if (seekFlashTimer.current) clearTimeout(seekFlashTimer.current);
    seekFlashTimer.current = setTimeout(() => setSeekFlash(null), 650);
  }, []);

  const flashVolume = useCallback(() => {
    setVolumeHud(true);
    if (volumeHudTimer.current) clearTimeout(volumeHudTimer.current);
    volumeHudTimer.current = setTimeout(() => setVolumeHud(false), 1000);
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v || status !== "ready") return;
      const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : Infinity;
      const next = Math.min(Math.max(0, v.currentTime + delta), dur === Infinity ? v.currentTime + delta : Math.max(0, dur - 0.25));
      v.currentTime = next;
      setCurrentTime(next);
      flashSeek(delta < 0 ? "left" : "right", Math.abs(delta));
      bumpChrome();
    },
    [status, flashSeek, bumpChrome],
  );

  const seekToPercent = useCallback(
    (pct: number) => {
      const v = videoRef.current;
      if (!v || status !== "ready") return;
      const dur = v.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const t = (dur * pct) / 100;
      v.currentTime = t;
      setCurrentTime(t);
      showToast(`${pct}%`);
      bumpChrome();
    },
    [status, showToast, bumpChrome],
  );

  const changeVolumeBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      const base = v.muted ? 0 : v.volume;
      const next = Math.min(1, Math.max(0, base + delta));
      v.volume = next;
      v.muted = next === 0;
      volumeRef.current = next;
      setVolume(next);
      setMuted(next === 0);
      flashVolume();
      bumpChrome();
    },
    [flashVolume, bumpChrome],
  );

  const setSpeed = useCallback(
    (s: number) => {
      const v = videoRef.current;
      if (v) v.playbackRate = s;
      setPlaybackSpeed(s);
      setShowSpeedMenu(false);
      showToast(s === 1 ? "Normal speed" : `${s}× speed`);
      bumpChrome();
    },
    [showToast, bumpChrome],
  );

  const cast = useCast({
    videoRef,
    streamUrl: activeUrl,
    mediaKey: activeUrl,
    onConnect: () => {
      setCastOverlay(true);
      setCastErrorDismissed(false);
      try {
        videoRef.current?.pause();
      } catch {
        /* */
      }
    },
    onDisconnect: () => setCastOverlay(false),
    onError: () => setCastErrorDismissed(false),
  });

  // Auto-open control guide when stream is ready (once per session unless "never")
  useEffect(() => {
    if (status !== "ready") return;
    if (helpAutoOpenedRef.current) return;
    try {
      // Migration: clear legacy permanent suppress (unless never was chosen)
      if (
        localStorage.getItem(PLAYER_HELP_NEVER_KEY) !== "1" &&
        localStorage.getItem(PLAYER_HELP_SEEN_KEY) === "1"
      ) {
        localStorage.removeItem(PLAYER_HELP_SEEN_KEY);
      }
      // v3: reset session flag once so users who hit the broken auto-open still see the guide
      if (localStorage.getItem("flyx:player:help-guide-v3") !== "1") {
        sessionStorage.removeItem("flyx:player:help-session");
        localStorage.setItem("flyx:player:help-guide-v3", "1");
      }
    } catch {
      /* ignore */
    }
    if (!shouldAutoShowPlayerHelp()) return;
    helpAutoOpenedRef.current = true;
    const t = setTimeout(() => {
      setShowHelp(true);
      setChromeVisible(true);
    }, 800);
    return () => clearTimeout(t);
  }, [status]);

  const handleCastClick = useCallback(async () => {
    bumpChrome();
    if (cast.isCasting || cast.isConnected) {
      cast.disconnect();
      setCastOverlay(false);
      return;
    }
    const connected = await cast.requestSession();
    if (!connected) return;
    if (!activeUrl) return;
    const ok = await cast.loadMedia({
      url: activeUrl,
      title,
      subtitle:
        mediaType === "tv" && !malId
          ? `S${season} · E${episode}`
          : malId
            ? `EP ${episode || "1"}`
            : undefined,
      contentType: activeUrl.includes(".m3u8")
        ? "application/x-mpegURL"
        : "video/mp4",
      startTime: videoRef.current?.currentTime || 0,
    });
    if (ok) setCastOverlay(true);
  }, [
    cast,
    activeUrl,
    title,
    mediaType,
    malId,
    season,
    episode,
    bumpChrome,
  ]);

  useEffect(() => {
    const s = searchParams.get("season") ?? "1";
    const e = searchParams.get("episode") ?? "1";
    setSeason(s);
    setEpisode(e);
    setBrowseSeason(s);
  }, [searchParams]);

  // Keep chrome visible while panels open
  useEffect(() => {
    if (showSources || showEpisodes) {
      setChromeVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    } else if (playing) {
      bumpChrome();
    }
  }, [showSources, showEpisodes, playing, bumpChrome]);

  // TMDB meta
  useEffect(() => {
    if (!tmdbId || isAnime) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/tmdb?path=${encodeURIComponent(`/${mediaType}/${tmdbId}`)}`,
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setDetails(data);
          if (mediaType === "tv" && data.number_of_seasons) {
            setSeasonsCount(data.number_of_seasons);
          }
        }
      } catch {
        /* */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tmdbId, mediaType, isAnime]);

  // Episode lists keyed by season (panel browses freely; next-ep uses playing season)
  const [episodesBySeason, setEpisodesBySeason] = useState<
    Record<string, Episode[]>
  >({});
  const episodesBySeasonRef = useRef(episodesBySeason);
  episodesBySeasonRef.current = episodesBySeason;

  // Reset season cache when title changes
  useEffect(() => {
    setEpisodesBySeason({});
  }, [tmdbId]);

  useEffect(() => {
    if (!tmdbId || mediaType !== "tv" || isAnime) return;
    // Always keep the playing season + browsed season loaded
    const needed = Array.from(new Set([season, browseSeason].filter(Boolean)));
    let cancelled = false;
    (async () => {
      for (const s of needed) {
        if (cancelled) return;
        if (Array.isArray(episodesBySeasonRef.current[s])) continue;
        try {
          const res = await fetch(
            `/api/tmdb?path=${encodeURIComponent(`/tv/${tmdbId}/season/${s}`)}`,
          );
          if (!res.ok || cancelled) continue;
          const data = await res.json();
          if (cancelled) return;
          setEpisodesBySeason((prev) => ({
            ...prev,
            [s]: (data.episodes as Episode[]) ?? [],
          }));
        } catch {
          if (!cancelled) {
            setEpisodesBySeason((prev) => ({ ...prev, [s]: [] }));
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tmdbId, mediaType, season, browseSeason, isAnime]);

  // Panel list = browsed season; next-ep logic uses playing season
  const episodes = episodesBySeason[browseSeason] ?? [];
  const playingSeasonEpisodes = episodesBySeason[season] ?? [];

  // Anime meta
  useEffect(() => {
    if (!malId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/anime/jikan?path=${encodeURIComponent(`/anime/${malId}`)}`,
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && data?.data) {
          setAnimeTitle(data.data.title_english || data.data.title || "");
          setAnimePoster(
            data.data.images?.webp?.large_image_url ||
              data.data.images?.jpg?.large_image_url ||
              data.data.images?.jpg?.image_url ||
              "",
          );
          setAnimeEpCount(
            typeof data.data.episodes === "number" ? data.data.episodes : 0,
          );
          const y =
            data.data.year ??
            (data.data.aired?.from
              ? String(data.data.aired.from).slice(0, 4)
              : undefined);
          setDetails({
            id: Number(malId),
            title: data.data.title_english || data.data.title,
            vote_average: data.data.score,
            release_date: y ? `${y}-01-01` : undefined,
            number_of_episodes: data.data.episodes,
          });
        }
      } catch {
        /* */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [malId]);

  const catalogProviders = useMemo(
    () => (isAnime || malId ? ANIME_PROVIDERS : VOD_PROVIDERS),
    [isAnime, malId],
  );

  // Keep anime title out of fetch deps so loading details does not re-trigger
  // the whole extract + chip probe loop (that was flapping 2Embed to "Unavailable").
  const titleRef = useRef(title);
  titleRef.current = title;

  const fetchFromProvider = useCallback(
    async (
      providerId: string | null,
    ): Promise<{
      ok: boolean;
      list: StreamSource[];
      provider: string | null;
      error?: string;
    }> => {
      try {
        // When anime title is still generic ("Anime 57658"), AnimeX can't find the show.
        // Wait briefly for Jikan to resolve the real title before making the API call.
        if (malId && providerId && /^Anime \d+$/i.test(titleRef.current || '')) {
          for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 200));
            if (titleRef.current && !/^Anime \d+$/i.test(titleRef.current)) break;
          }
        }

        let res: Response;
        if (malId) {
          const params = new URLSearchParams({ malId });
          if (episode) params.set("episode", episode);
          if (providerId) params.set("provider", providerId);
          const t = titleRef.current;
          if (t) params.set("title", t);
          res = await fetch(`/api/anime/stream?${params.toString()}`);
        } else {
          const params = new URLSearchParams({ tmdbId, mediaType });
          if (mediaType === "tv") {
            params.set("season", season);
            params.set("episode", episode);
          }
          if (providerId) params.set("provider", providerId);
          res = await fetch(`/api/stream/extract?${params.toString()}`);
        }

        // Non-OK responses still carry JSON error bodies from the pipeline
        const data = await res.json().catch(() => ({}));
        const resolvedProvider =
          (typeof data.provider === "string" && data.provider) ||
          providerId ||
          null;
        const list = parseSourceList(data, resolvedProvider || undefined);

        if (list.length === 0) {
          return {
            ok: false,
            list: [],
            provider: resolvedProvider,
            error:
              data.message ||
              data.error ||
              (!res.ok ? `HTTP ${res.status}` : null) ||
              (providerId
                ? `No streams from ${providerId}`
                : "No playable sources found."),
          };
        }

        const tagged = list.map((s) => ({
          ...s,
          provider: s.provider || resolvedProvider || undefined,
        }));

        return { ok: true, list: tagged, provider: resolvedProvider };
      } catch (e) {
        return {
          ok: false,
          list: [],
          provider: providerId,
          error: e instanceof Error ? e.message : "Extraction failed",
        };
      }
    },
    // Intentionally omit `title` — use titleRef for anime only
    [malId, episode, tmdbId, mediaType, season],
  );

  /** Write probe result into cache + chip state without touching playback. */
  const applyProbeResult = useCallback(
    (
      requestedId: string,
      result: {
        ok: boolean;
        list: StreamSource[];
        provider: string | null;
        error?: string;
      },
    ) => {
      const pid = result.provider || requestedId;
      if (!result.ok || result.list.length === 0) {
        setProviderState((s) => ({
          ...s,
          [requestedId]: "empty",
          ...(pid !== requestedId ? { [pid]: "empty" } : {}),
        }));
        setProviderErrors((e) => ({
          ...e,
          [requestedId]: result.error || "No streams",
        }));
        return;
      }
      setSourcesCache((c) => ({
        ...c,
        [requestedId]: result.list,
        [pid]: result.list,
      }));
      setProviderState((s) => ({
        ...s,
        [requestedId]: "ready",
        [pid]: "ready",
      }));
      setProviderErrors((e) => {
        const next = { ...e };
        delete next[requestedId];
        delete next[pid];
        return next;
      });
    },
    [],
  );

  // Initial extract (auto best provider) + background availability probe
  useEffect(() => {
    if (!tmdbId && !malId) return;
    let cancelled = false;
    const gen = ++probeGenRef.current;

    setStatus("loading");
    setActiveUrl(null);
    setErrorMsg("");
    setShowSources(false);
    setPlaying(false);
    setHasStarted(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackProvider(null);
    setSheetProvider(null);
    setSourcesCache({});
    setProviderState({});
    setProviderErrors({});
    setLoadingProvider(false);
    resumeAfterSwitchRef.current = null;

    (async () => {
      // Use auto mode to combine sources from multiple providers.
      // Individual provider probes fill the source cache for direct switching.
      let result: Awaited<ReturnType<typeof fetchFromProvider>> | null = null;
      const tryOrder = catalogProviders.map((p) => p.id);

      // Race individual probes + auto mode. Start playback on the FIRST
      // success — do NOT wait for every provider (that alone can add 10–20s).
      type ProbeOutcome = {
        id: string | null;
        r: Awaited<ReturnType<typeof fetchFromProvider>>;
      };
      const probePromises: Promise<ProbeOutcome>[] = tryOrder.map((id) =>
        fetchFromProvider(id).then((r) => ({ id, r })),
      );
      const autoPromise: Promise<ProbeOutcome> = fetchFromProvider(null).then(
        (r) => ({ id: r.provider || "auto", r }),
      );

      let playbackStarted = false;
      const startPlayback = (pid: string, list: StreamSource[]) => {
        if (playbackStarted || !list.length) return;
        playbackStarted = true;
        const animeCtx = Boolean(malId);
        const best =
          pickBestSource(list, audioModeRef.current, animeCtx) || list[0]!;
        console.log("[Watch] ✅ READY (first success):", {
          pid,
          url: best.url?.substring(0, 80),
          quality: best.quality,
          type: best.type,
          lang: best.language,
          audioMode: audioModeRef.current,
          totalSources: list.length,
          referer: best.referer?.substring(0, 40),
          fastStart: fastStartRank(best),
        });
        setPlaybackProvider(pid);
        setSheetProvider(pid);
        setActiveUrl(best.url);
        setStatus("ready");
      };

      // Settle probes as they finish (parallel), updating chips + starting play ASAP
      const allOutcomes = await Promise.all(
        [...probePromises, autoPromise].map(async (p) => {
          const outcome = await p;
          if (cancelled || gen !== probeGenRef.current) return outcome;
          const { id, r } = outcome;
          if (id && id !== "auto") applyProbeResult(id, r);
          if (r.ok && r.list.length > 0) {
            const pid =
              r.provider || id || tryOrder[0] || "auto";
            if (id === "auto" || !id) {
              applyProbeResult(pid, r);
            }
            startPlayback(pid, r.list);
            result = r;
          }
          return outcome;
        }),
      );

      if (cancelled || gen !== probeGenRef.current) return;

      if (!playbackStarted) {
        // Nothing succeeded — surface the best error we got
        const failed = allOutcomes.map((o) => o.r).find((r) => !r.ok);
        console.log("[Watch] ❌ ERROR state:", {
          error: failed?.error,
          outcomes: allOutcomes.length,
        });
        setStatus("error");
        setErrorMsg(failed?.error || "No playable sources found.");
      }

      // Background re-probe any still-empty providers (soft retry once)
      void (async () => {
        for (let i = 0; i < tryOrder.length; i++) {
          const id = tryOrder[i]!;
          if (cancelled || gen !== probeGenRef.current) return;
          const state = playbackCtxRef.current.providerState[id];
          if (state === "ready") continue;
          setProviderState((s) => {
            if (s[id] === "ready" || s[id] === "loading") return s;
            return { ...s, [id]: "loading" };
          });
          await new Promise((res) => setTimeout(res, 300 + i * 200));
          if (cancelled || gen !== probeGenRef.current) return;
          let r = await fetchFromProvider(id);
          if ((!r.ok || r.list.length === 0) && !cancelled) {
            await new Promise((res) => setTimeout(res, 500));
            if (cancelled || gen !== probeGenRef.current) return;
            r = await fetchFromProvider(id);
          }
          if (cancelled || gen !== probeGenRef.current) return;
          applyProbeResult(id, r);
        }
      })();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    tmdbId,
    malId,
    mediaType,
    season,
    episode,
    fetchFromProvider,
    catalogProviders,
    applyProbeResult,
  ]);

  /**
   * Browse a provider in the sheet — loads/caches sources and updates chips.
   * Does NOT change activeUrl / playback unless `playFirst` is true
   * (used for recovery when current stream is broken).
   */
  const browseProvider = useCallback(
    async (
      providerId: string,
      opts?: { force?: boolean; playFirst?: boolean },
    ) => {
      const force = opts?.force ?? false;
      const playFirst = opts?.playFirst ?? false;

      setSheetProvider(providerId);
      setShowSpeedMenu(false);

      const cached = sourcesCache[providerId];
      if (!force && cached?.length) {
        setProviderState((s) => ({ ...s, [providerId]: "ready" }));
        if (playFirst) {
          const now = videoRef.current?.currentTime ?? 0;
          if (now > 2) resumeAfterSwitchRef.current = now;
          const best =
            pickBestSource(cached, audioModeRef.current, Boolean(malId)) ||
            cached[0]!;
          setPlaybackProvider(providerId);
          setActiveUrl(best.url);
          setStatus("ready");
          const label =
            catalogProviders.find((p) => p.id === providerId)?.label ||
            providerId;
          showToast(`Server: ${label}`);
        }
        return;
      }

      // Previously empty: re-probe on click (do not stick on a one-off failure)
      setLoadingProvider(true);
      setProviderState((s) => ({ ...s, [providerId]: "loading" }));

      // One automatic retry for flaky upstreams (2embed XPS can 0-out once)
      let result = await fetchFromProvider(providerId);
      if (!result.ok || result.list.length === 0) {
        await new Promise((r) => setTimeout(r, 400));
        result = await fetchFromProvider(providerId);
      }
      setLoadingProvider(false);

      applyProbeResult(providerId, result);

      if (!result.ok || result.list.length === 0) {
        const label =
          catalogProviders.find((p) => p.id === providerId)?.label ||
          providerId;
        showToast(`${label}: no streams`);
        return;
      }

      if (playFirst) {
        const now = videoRef.current?.currentTime ?? 0;
        if (now > 2) resumeAfterSwitchRef.current = now;
        const pid = result.provider || providerId;
        const best =
          pickBestSource(result.list, audioModeRef.current, Boolean(malId)) ||
          result.list[0]!;
        setPlaybackProvider(pid);
        setActiveUrl(best.url);
        setStatus("ready");
        const label =
          catalogProviders.find((p) => p.id === pid)?.label || pid;
        showToast(`Server: ${label}`);
      }
    },
    [
      sourcesCache,
      fetchFromProvider,
      applyProbeResult,
      showToast,
      catalogProviders,
      malId,
    ],
  );

  /** Explicit source pick — only place (besides initial load / recovery) that changes playback. */
  const selectSource = useCallback(
    (src: StreamSource) => {
      if (src.url === activeUrl) {
        setShowSources(false);
        return;
      }
      const now = videoRef.current?.currentTime ?? 0;
      if (now > 2) resumeAfterSwitchRef.current = now;
      const pid =
        src.provider || sheetProvider || playbackProvider || undefined;
      if (pid) setPlaybackProvider(pid);
      // Sync audio mode if user picks a clearly tagged source
      const detected = detectAudioLang(src);
      if (detected && detected !== audioModeRef.current && isAnime) {
        setAudioMode(detected);
        saveProviderSettings({ animeAudioPreference: detected });
      }
      setActiveUrl(src.url);
      setStatus("ready");
      setShowSources(false);
      const lang = detectAudioLang(src);
      const q = src.quality || "Source";
      showToast(
        lang
          ? `${q} · ${lang === "dub" ? "Dub" : "Sub"}`
          : src.title || q || "Source switched",
      );
    },
    [activeUrl, showToast, sheetProvider, playbackProvider, isAnime],
  );

  /**
   * Switch Sub / Dub for anime — filters source list and swaps to best
   * matching stream of the same provider when possible.
   */
  const switchAudioMode = useCallback(
    (mode: AnimeAudioMode) => {
      if (mode === audioMode) return;
      setAudioMode(mode);
      saveProviderSettings({ animeAudioPreference: mode });

      if (!isAnime) return;

      const now = videoRef.current?.currentTime ?? 0;
      if (now > 2) resumeAfterSwitchRef.current = now;

      // Prefer current playback provider, then sheet, then any ready cache
      const tryIds = [
        playbackProvider,
        sheetProvider,
        ...catalogProviders.map((p) => p.id),
      ].filter(Boolean) as string[];

      for (const id of tryIds) {
        const list = sourcesCache[id];
        if (!list?.length) continue;
        const best = pickBestSource(list, mode, true);
        if (!best) continue;
        setPlaybackProvider(id);
        setSheetProvider(id);
        setActiveUrl(best.url);
        setStatus("ready");
        showToast(
          `${mode === "dub" ? "English Dub" : "Japanese Sub"} · ${best.quality || "Auto"}`,
        );
        return;
      }
      showToast(
        mode === "dub"
          ? "Dub mode — pick a source when available"
          : "Sub mode — pick a source when available",
      );
    },
    [
      audioMode,
      isAnime,
      playbackProvider,
      sheetProvider,
      catalogProviders,
      sourcesCache,
      showToast,
    ],
  );

  /** All sources for browsed provider (unfiltered — used for counts). */
  const sheetSourcesAll = useMemo(() => {
    if (!sheetProvider) return [] as StreamSource[];
    return sourcesCache[sheetProvider] ?? [];
  }, [sheetProvider, sourcesCache]);

  /** Sources shown in the sheet — filtered by Sub/Dub for anime. */
  const sheetSources = useMemo(() => {
    const sorted = [...sheetSourcesAll].sort(
      (a, b) => sourceRank(b) - sourceRank(a),
    );
    if (!isAnime) return sorted;
    return filterSourcesByAudio(sorted, audioMode, true);
  }, [sheetSourcesAll, isAnime, audioMode]);

  const sheetAudioCounts = useMemo(() => {
    if (!isAnime) return { sub: 0, dub: 0, untagged: 0 };
    let sub = 0;
    let dub = 0;
    let untagged = 0;
    for (const s of sheetSourcesAll) {
      const d = detectAudioLang(s);
      if (d === "sub") sub++;
      else if (d === "dub") dub++;
      else untagged++;
    }
    return { sub, dub, untagged };
  }, [sheetSourcesAll, isAnime]);

  // Keep recovery context fresh without re-binding the player
  useEffect(() => {
    playbackCtxRef.current = {
      playbackProvider,
      sourcesCache,
      providerState,
      catalogIds: catalogProviders.map((p) => p.id),
      audioMode,
      isAnime: Boolean(isAnime || malId),
      browseProvider,
      showToast,
    };
  }, [
    playbackProvider,
    sourcesCache,
    providerState,
    catalogProviders,
    audioMode,
    isAnime,
    malId,
    browseProvider,
    showToast,
  ]);

  // HLS / video attach — only when activeUrl/status change
  useEffect(() => {
    const video = videoRef.current;
    const url = activeUrl;
    console.log("[Watch] 🎬 HLS effect:", { hasVideo: !!video, hasUrl: !!url, status, urlPreview: url?.substring(0, 80) });
    if (!video || !url || status !== "ready") {
      console.log("[Watch] ⏭️ HLS effect SKIPPED:", { missing: !video ? "video" : !url ? "url" : "status_not_ready" });
      return;
    }

    (async () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          /* */
        }
        hlsRef.current = null;
      }

      const isHls =
        url.includes(".m3u8") ||
        url.includes("application/vnd.apple.mpegurl") ||
        url.includes("m3u8");

      loadStartRef.current = performance.now();
      const len = (s: string) => s.length;
      console.log("[Watch] ⏱️ Loading source:", { isHls, type: isHls ? "hls" : "mp4", urlLen: url.length, urlFull: url });

      const applyResumeAndPlay = () => {
        const resume = resumeAfterSwitchRef.current;
        const play = () => {
          void video.play().catch(() => undefined);
        };
        if (resume != null && resume > 2) {
          const seek = () => {
            if (Number.isFinite(video.duration) && video.duration > resume) {
              video.currentTime = resume;
              setCurrentTime(resume);
            }
            resumeAfterSwitchRef.current = null;
            play();
          };
          if (Number.isFinite(video.duration) && video.duration > 0) seek();
          else video.addEventListener("loadedmetadata", seek, { once: true });
          return;
        }
        play();
      };

      /** On hard media failure: try next source in same audio mode,
       * then try the OTHER audio mode, then other providers.
       * If ALL options are exhausted, show an error. */
      const recoverPlayback = () => {
        const ctx = playbackCtxRef.current;
        const pid = ctx.playbackProvider;
        const raw = pid ? ctx.sourcesCache[pid] ?? [] : [];
        const list = filterSourcesByAudio(
          raw,
          ctx.audioMode,
          ctx.isAnime,
        ).sort((a, b) => fastStartRank(b) - fastStartRank(a));
        const idx = list.findIndex((s) => s.url === url);
        if (idx >= 0 && idx < list.length - 1) {
          ctx.showToast("Source failed — trying next…");
          setActiveUrl(list[idx + 1]!.url);
          return;
        }
        // Try remaining same-provider sources (fast-start order) before switching server
        const remaining = list.filter((s) => s.url !== url);
        if (remaining.length > 0) {
          ctx.showToast("Source failed — trying next…");
          setActiveUrl(remaining[0]!.url);
          return;
        }
        // If anime, try the OTHER audio mode (dub→sub or sub→dub)
        if (ctx.isAnime) {
          const otherMode: AnimeAudioMode = ctx.audioMode === "dub" ? "sub" : "dub";
          const otherList = filterSourcesByAudio(raw, otherMode, true)
            .sort((a, b) => fastStartRank(b) - fastStartRank(a));
          if (otherList.length > 0) {
            const modeLabel = otherMode === "dub" ? "Dub" : "Sub";
            ctx.showToast(`No ${ctx.audioMode === "dub" ? "dub" : "sub"} sources — trying ${modeLabel}…`);
            // Also update the persisted audio preference so the UI reflects it
            setAudioMode(otherMode);
            saveProviderSettings({ animeAudioPreference: otherMode });
            setActiveUrl(otherList[0]!.url);
            return;
          }
        }
        // Try other providers
        const order = ctx.catalogIds;
        const start = pid ? order.indexOf(pid) : -1;
        for (let i = 1; i <= order.length; i++) {
          const cand = order[(start + i) % order.length];
          if (!cand || cand === pid) continue;
          if (
            ctx.providerState[cand] === "ready" &&
            ctx.sourcesCache[cand]?.length
          ) {
            ctx.showToast("Switching server…");
            void ctx.browseProvider?.(cand, { playFirst: true });
            return;
          }
        }
        // 🔥 NEW: All recovery options exhausted — show clear error
        console.warn("[Watch] All sources and providers exhausted");
        setStatus("error");
        setErrorMsg("All streams failed to load. Try a different episode or check back later.");
      };

      // Find the current source metadata (referer, origin, type) by
      // searching ALL provider caches. Prefer the live ref so we don't
      // race a stale render closure right after first-success play.
      const currentSource = (() => {
        const caches = [
          playbackCtxRef.current.sourcesCache,
          sourcesCache,
        ];
        for (const cache of caches) {
          for (const list of Object.values(cache)) {
            const found = list.find((s) => s.url === url);
            if (found) return found;
          }
        }
        return undefined;
      })();
      const sourceReferer = currentSource?.referer;
      const sourceOrigin = currentSource?.origin;

      // Browser <video>/XHR cannot set Referer (forbidden header). Any CDN
      // that needs it MUST go through /api/stream/proxy. Previously this
      // variable was never defined → HLS path threw ReferenceError every time
      // and fell through to a broken native <video src=m3u8> attempt.
      const playbackUrl =
        sourceReferer || sourceOrigin
          ? (() => {
              const params = new URLSearchParams();
              params.set("url", url);
              if (sourceReferer) params.set("referer", sourceReferer);
              if (sourceOrigin) params.set("origin", sourceOrigin);
              return `/api/stream/proxy?${params.toString()}`;
            })()
          : url;

      console.log("[Watch] ⏱️ playbackUrl ready:", {
        proxied: playbackUrl !== url,
        isHls,
        type: currentSource?.type,
        quality: currentSource?.quality,
      });

      if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = playbackUrl;
        video.addEventListener("loadedmetadata", () => {
          console.log(`[Watch] ⏱️ Native HLS metadata in ${(performance.now() - loadStartRef.current).toFixed(0)}ms`);
          applyResumeAndPlay();
        }, { once: true });
        video.addEventListener(
          "error",
          () => {
            recoverPlayback();
          },
          { once: true },
        );
        return;
      }

      if (isHls) {
        try {
          const Hls = (await import("hls.js")).default;
          if (Hls.isSupported()) {
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              // Start at lowest quality for fast first frame; ABR climbs after
              startLevel: 0,
              abrEwmaDefaultEstimate: 500000,
              startFragPrefetch: true,
              manifestLoadingTimeOut: 8000,
              manifestLoadingMaxRetry: 2,
              manifestLoadingRetryDelay: 500,
              fragLoadingTimeOut: 12000,
              fragLoadingMaxRetry: 3,
              maxBufferLength: 20,
              maxMaxBufferLength: 60,
              // Referer/Origin are applied by the proxy — do not set on XHR
              // (forbidden headers; browsers silently drop them).
            });
            hlsRef.current = hls;
            hls.loadSource(playbackUrl);
            hls.attachMedia(video as unknown as HTMLMediaElement);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              console.log(`[Watch] ⏱️ HLS manifest parsed in ${(performance.now() - loadStartRef.current).toFixed(0)}ms`);
              applyResumeAndPlay();
            });
            hls.on(
              Hls.Events.ERROR,
              (_e: unknown, data: { fatal?: boolean }) => {
                if (data?.fatal) recoverPlayback();
              },
            );
            return;
          }
        } catch (err) {
          console.warn("[Watch] HLS.js load failed, falling through:", err);
          /* fall through */
        }
      }

      // MP4: if the CDN needs a Referer, the browser can't send it — go
      // straight through the proxy. Use refs so Fast Refresh re-renders
      // don't abort in-flight proxy requests.
      const needsProxy = !!sourceReferer;
      const mp4Src = needsProxy
        ? `/api/stream/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(sourceReferer!)}${sourceOrigin ? `&origin=${encodeURIComponent(sourceOrigin)}` : ""}`
        : url;
      // Fail over faster — 60s made a dead 1080p feel like "playback never starts"
      const mp4TimeoutMs = needsProxy ? 15000 : 8000;
      console.log(`[Watch] ⏱️ MP4 loading via ${needsProxy ? 'proxy' : 'direct'}, timeout=${mp4TimeoutMs}ms`);

      // Use a ref-backed flag so Fast Refresh doesn't kill the load
      const doneRef = { current: false };
      let mp4Timeout: ReturnType<typeof setTimeout>;
      let lastProgress = 0;

      const cleanup = () => {
        doneRef.current = true;
        clearTimeout(mp4Timeout);
        video.removeEventListener("loadedmetadata", onMeta);
        video.removeEventListener("error", onErr);
        video.removeEventListener("progress", onProg);
      };

      const onProg = () => {
        const now = performance.now();
        const buf = video.buffered;
        const end = buf.length > 0 ? buf.end(buf.length - 1) : 0;
        setBuffered(end); // update player UI in real-time
        if (now - lastProgress > 2000) {
          lastProgress = now;
          console.log(`[Watch] ⏱️ MP4 buffering: ${end.toFixed(1)}s in ${(now - loadStartRef.current).toFixed(0)}ms`);
        }
      };
      const onMeta = () => {
        if (doneRef.current) return;
        cleanup();
        console.log(`[Watch] ⏱️ MP4 metadata in ${(performance.now() - loadStartRef.current).toFixed(0)}ms`);
        applyResumeAndPlay();
      };
      const onErr = () => {
        if (doneRef.current) return;
        cleanup();
        video.src = "";
        console.log("[Watch] ⏱️ MP4 failed, trying next source...");
        recoverPlayback();
      };
      const onTimeout = () => {
        if (doneRef.current) return;
        cleanup();
        video.src = "";
        console.log(`[Watch] ⏱️ MP4 timed out after ${mp4TimeoutMs}ms`);
        recoverPlayback();
      };

      video.addEventListener("loadedmetadata", onMeta);
      video.addEventListener("error", onErr);
      video.addEventListener("progress", onProg);
      // Pre-warm: fire a no-cache fetch to the proxy so the CDN connection
      // is established before the video element starts its request.
      if (needsProxy) {
        fetch(mp4Src, { cache: "no-store", headers: { Range: "bytes=0-0" } }).catch(() => {});
      }
      video.src = mp4Src;
      video.load();
      mp4Timeout = setTimeout(onTimeout, mp4TimeoutMs);
    })();

    return () => {
      // Don't abort MP4 loads — they survive re-renders via refs.
      // Only destroy HLS.js instances.
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { /* */ }
        hlsRef.current = null;
      }
    };
    // browseProvider/showToast are stable enough; recovery uses refs for cache
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUrl, status]);

  // Keep playback rate when source switches
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = playbackSpeed;
  }, [activeUrl, status, playbackSpeed]);

  // New source → not started yet (show buffer spinner until first play)
  useEffect(() => {
    setHasStarted(false);
    setPlaying(false);
  }, [activeUrl]);

  // Video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      if (loadStartRef.current) {
        console.log(`[Watch] ⏱️ First frame in ${(performance.now() - loadStartRef.current).toFixed(0)}ms`);
        loadStartRef.current = 0;
      }
      setHasStarted(true);
      setPlaying(true);
    };
    const onPause = () => setPlaying(false);
    const onTime = () => {
      if (!seeking) setCurrentTime(video.currentTime);
    };
    const onMeta = () => setDuration(video.duration || 0);
    const onProgress = () => {
      try {
        if (video.buffered.length > 0) {
          setBuffered(video.buffered.end(video.buffered.length - 1));
        }
      } catch {
        /* */
      }
    };
    const onVol = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVol);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVol);
    };
  }, [status, seeking]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || status !== "ready") return;
    if (v.paused) void v.play();
    else v.pause();
    bumpChrome();
  }, [status, bumpChrome]);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    flashVolume();
    showToast(next ? "Muted" : "Unmuted");
    bumpChrome();
  }, [flashVolume, showToast, bumpChrome]);

  const toggleFullscreen = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
    bumpChrome();
  }, [bumpChrome]);

  const onSeek = (ratio: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const t = Math.max(0, Math.min(duration, ratio * duration));
    v.currentTime = t;
    setCurrentTime(t);
  };

  const setVol = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
    volumeRef.current = val;
    flashVolume();
  };

  // Keyboard (capture) — all actions go through helpers so HUD feedback always fires
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (showHelp) {
        if (e.key === "Escape") {
          e.preventDefault();
          markPlayerHelpSessionShown();
          setShowHelp(false);
        }
        return;
      }

      const code = e.code;
      const key = e.key;
      const shifted = e.shiftKey;
      const step = shifted ? 30 : 10;

      if (code === "Space" || key === " " || code === "KeyK") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (code === "KeyM") {
        e.preventDefault();
        toggleMute();
        return;
      }
      if (code === "KeyH" || key === "?") {
        e.preventDefault();
        setShowHelp(true);
        bumpChrome();
        return;
      }
      if (code === "KeyC" && !shifted) {
        e.preventDefault();
        void handleCastClick();
        return;
      }
      if (code === "ArrowRight" || code === "KeyL") {
        e.preventDefault();
        seekBy(step);
        return;
      }
      if (code === "ArrowLeft" || code === "KeyJ") {
        e.preventDefault();
        seekBy(-step);
        return;
      }
      if (code === "ArrowUp") {
        e.preventDefault();
        changeVolumeBy(0.1);
        return;
      }
      if (code === "ArrowDown") {
        e.preventDefault();
        changeVolumeBy(-0.1);
        return;
      }
      if (key === "," || code === "Comma") {
        e.preventDefault();
        const idx = SPEEDS.indexOf(playbackSpeed);
        setSpeed(SPEEDS[Math.max(0, (idx < 0 ? 2 : idx) - 1)] ?? 1);
        return;
      }
      if (key === "." || code === "Period") {
        e.preventDefault();
        const idx = SPEEDS.indexOf(playbackSpeed);
        setSpeed(
          SPEEDS[Math.min(SPEEDS.length - 1, (idx < 0 ? 2 : idx) + 1)] ?? 1,
        );
        return;
      }
      if (code === "Escape") {
        if (showSpeedMenu) setShowSpeedMenu(false);
        else if (showSources) setShowSources(false);
        else if (showEpisodes) setShowEpisodes(false);
        return;
      }
      let digit: number | null = null;
      if (code.startsWith("Digit")) digit = parseInt(code.slice(5), 10);
      else if (code.startsWith("Numpad") && code.length === 7)
        digit = parseInt(code.slice(6), 10);
      else if (key >= "0" && key <= "9") digit = parseInt(key, 10);
      if (digit != null && !shifted) {
        e.preventDefault();
        seekToPercent(digit * 10);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [
    showHelp,
    showSources,
    showEpisodes,
    showSpeedMenu,
    togglePlay,
    toggleFullscreen,
    toggleMute,
    handleCastClick,
    seekBy,
    changeVolumeBy,
    seekToPercent,
    setSpeed,
    playbackSpeed,
    bumpChrome,
  ]);

  // Double-click left/right thirds to skip (YouTube-style)
  const onStagePointer = useCallback(
    (e: ReactMouseEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.closest(".cinema-hud") ||
        t.closest(".cinema-panel") ||
        t.closest(".cinema-feedback") ||
        showHelp
      )
        return;

      const stage = stageRef.current;
      if (!stage || status !== "ready") return;
      const rect = stage.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const side = x < 0.33 ? "left" : x > 0.67 ? "right" : "center";
      const now = Date.now();
      const last = lastTapRef.current;

      if (now - last.t < 280 && last.side === side) {
        if (side === "left") seekBy(-10);
        else if (side === "right") seekBy(10);
        else toggleFullscreen();
        lastTapRef.current = { t: 0, side: "" };
        return;
      }
      lastTapRef.current = { t: now, side };
      window.setTimeout(() => {
        if (lastTapRef.current.t === now && lastTapRef.current.side === side) {
          if (side === "center") togglePlay();
          else bumpChrome();
        }
      }, 280);
    },
    [status, showHelp, seekBy, togglePlay, toggleFullscreen, bumpChrome],
  );

  const toggleWatchlist = useCallback(() => {
    if (malId) {
      if (inList) removeItem(malId, "anime");
      else
        addItem({
          contentId: malId,
          mediaType: "anime",
          title,
          posterPath: animePoster || undefined,
          rating: details?.vote_average,
          year: year || undefined,
        });
      return;
    }
    if (!tmdbId) return;
    if (inList) removeItem(tmdbId, mediaType);
    else
      addItem({
        contentId: tmdbId,
        mediaType,
        title,
        posterPath: poster || undefined,
        rating: details?.vote_average,
        year,
      });
  }, [
    malId,
    tmdbId,
    inList,
    mediaType,
    title,
    year,
    poster,
    animePoster,
    details,
    addItem,
    removeItem,
  ]);

  /** Navigate to a specific episode and start extraction/playback. */
  const goToEpisode = useCallback(
    (s: string, e: string) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("season", s);
      q.set("episode", e);
      window.history.replaceState(null, "", `/watch?${q.toString()}`);
      setSeason(s);
      setEpisode(e);
      setBrowseSeason(s);
      setShowEpisodes(false);
    },
    [searchParams],
  );

  /** Season tab in the panel: list that season only — do not play. */
  const selectBrowseSeason = useCallback((s: string) => {
    setBrowseSeason(s);
  }, []);

  const goToAnimeEpisode = useCallback(
    (ep: number) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("episode", String(ep));
      window.history.replaceState(null, "", `/watch?${q.toString()}`);
      setEpisode(String(ep));
      setShowEpisodes(false);
    },
    [searchParams],
  );

  const nextEpisode = useMemo(() => {
    if (malId && animeEpCount > 0) {
      const cur = Number(episode) || 1;
      if (cur < animeEpCount)
        return { kind: "anime" as const, episode: String(cur + 1) };
      return null;
    }
    // Always compute from the *playing* season list, not the panel browse list
    if (mediaType !== "tv") return null;
    const cur = Number(episode);
    if (playingSeasonEpisodes.length > 0) {
      const next = playingSeasonEpisodes.find(
        (ep) => ep.episode_number === cur + 1,
      );
      if (next)
        return {
          kind: "tv" as const,
          season,
          episode: String(next.episode_number),
        };
    }
    // Last ep of season → first of next season (auto-next / next button only)
    if (Number(season) < seasonsCount)
      return {
        kind: "tv" as const,
        season: String(Number(season) + 1),
        episode: "1",
      };
    return null;
  }, [
    malId,
    animeEpCount,
    mediaType,
    playingSeasonEpisodes,
    episode,
    season,
    seasonsCount,
  ]);

  const detailsHref = malId
    ? `/anime/${malId}`
    : tmdbId
      ? `/details/${tmdbId}?type=${mediaType}`
      : "/";

  const typeLabel = malId
    ? "Anime"
    : mediaType === "tv"
      ? "Series"
      : "Movie";

  const hasEpisodePicker =
    (mediaType === "tv" && !malId && seasonsCount > 0) ||
    (Boolean(malId) && animeEpCount > 0);

  const progress = duration > 0 ? currentTime / duration : 0;
  const bufferPct = duration > 0 ? buffered / duration : 0;

  if (!tmdbId && !malId) {
    return (
      <main className="cinema">
        <div className="cinema-empty">
          <h1>Nothing selected</h1>
          <p>Pick a title to start streaming.</p>
          <Link href="/browse?type=movie" className="btn-primary">
            Browse
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={stageRef}
      className={`cinema${chromeVisible || !playing || status !== "ready" || showHelp || castOverlay || showSpeedMenu || showSources ? " cinema-chrome-on" : " cinema-chrome-off"}`}
      onMouseMove={bumpChrome}
      onTouchStart={bumpChrome}
      onClick={onStagePointer}
    >
      {/* Full-bleed video layer — always mount <video> so cast/AirPlay can attach */}
      <div className="cinema-stage">
        <video
          ref={videoRef}
          className="cinema-video"
          playsInline
          autoPlay
          style={{
            // Keep the frame visible while paused — only hide during initial buffer
            opacity:
              status === "ready" && activeUrl && (playing || hasStarted)
                ? 1
                : 0,
            pointerEvents:
              status === "ready" && (playing || hasStarted) ? "auto" : "none",
          }}
        />

        {status === "loading" && (
          <div className="cinema-state">
            <div className="cinema-spinner" />
            <p className="cinema-state-title">Finding the best source…</p>
            <p className="cinema-state-sub">{title}</p>
          </div>
        )}

        {/* Only while waiting for first frame — NOT when the user pauses */}
        {status === "ready" && !hasStarted && activeUrl && (
          <div className="cinema-state">
            <div className="cinema-spinner" />
            <p className="cinema-state-title">Buffering stream…</p>
            <p className="cinema-state-sub">Preparing playback</p>
          </div>
        )}

        {status === "error" && (
          <div className="cinema-state">
            <div className="cinema-error-icon">
              <AlertIcon />
            </div>
            <p className="cinema-state-title">Couldn&apos;t load stream</p>
            <p className="cinema-state-sub">{shortError(errorMsg)}</p>
            <button
              type="button"
              className="cinema-retry"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        )}

        {status === "idle" && (
          <div className="cinema-state">
            <p className="cinema-state-sub">Preparing…</p>
          </div>
        )}

        {/* Center play affordance when paused (after playback has started) */}
        {status === "ready" &&
          hasStarted &&
          !playing &&
          chromeVisible &&
          !seekFlash && (
          <button
            type="button"
            className="cinema-center-play"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label="Play"
          >
            <PlayBig />
          </button>
        )}

        {/* YouTube-style action feedback */}
        {seekFlash && (
          <div
            className={`cinema-feedback cinema-seek-flash cinema-seek-${seekFlash.dir}`}
            aria-hidden
          >
            <div className="cinema-seek-rings">
              <span />
              <span />
              <span />
            </div>
            <div className="cinema-seek-label">
              {seekFlash.dir === "left" ? "«" : "»"} {seekFlash.sec}s
            </div>
          </div>
        )}

        {volumeHud && (
          <div className="cinema-feedback cinema-volume-hud" aria-hidden>
            <div className="cinema-volume-icon">
              {muted || volume === 0 ? <MuteIcon /> : <VolIcon />}
            </div>
            <div className="cinema-volume-track">
              <div
                className="cinema-volume-fill"
                style={{ height: `${muted ? 0 : volume * 100}%` }}
              />
            </div>
            <div className="cinema-volume-pct">
              {muted ? "Mute" : `${Math.round(volume * 100)}%`}
            </div>
          </div>
        )}

        {actionToast && (
          <div className="cinema-feedback cinema-action-toast" role="status">
            {actionToast}
          </div>
        )}
      </div>

      {/* Gradient scrims when chrome visible */}
      <div className="cinema-scrim cinema-scrim-top" aria-hidden />
      <div className="cinema-scrim cinema-scrim-bottom" aria-hidden />

      {/* Top HUD */}
      <header className="cinema-hud cinema-hud-top">
        <div className="cinema-hud-left">
          <button
            type="button"
            className="cinema-btn"
            onClick={(e) => {
              e.stopPropagation();
              router.push(detailsHref);
            }}
          >
            <ChevronLeft />
            <span>Back</span>
          </button>
          <div className="cinema-meta">
            <span className="cinema-chip">{typeLabel}</span>
            {mediaType === "tv" && !malId && (
              <span className="cinema-chip is-ep">
                S{season} · E{episode}
              </span>
            )}
            {malId && (
              <span className="cinema-chip is-ep">EP {episode || "1"}</span>
            )}
            <h1 className="cinema-title">{title}</h1>
          </div>
        </div>
        <div className="cinema-hud-right">
          <button
            type="button"
            className={`cinema-btn${showHelp ? " is-on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowHelp(true);
              setChromeVisible(true);
            }}
            aria-label="How to use the player"
            title="Controls help"
          >
            <IconHelp size={16} />
            <span>Controls</span>
          </button>
          <button
            type="button"
            className={`cinema-btn${cast.isCasting || cast.isConnected ? " is-on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              void handleCastClick();
            }}
            aria-label={
              cast.isCasting || cast.isConnected ? "Stop casting" : "Cast to TV"
            }
            title={
              cast.isCasting || cast.isConnected ? "Stop casting" : "Cast to TV"
            }
          >
            <IconCast
              size={16}
              active={cast.isCasting || cast.isConnected}
            />
            <span>
              {cast.isCasting || cast.isConnected ? "Casting" : "Cast"}
            </span>
          </button>
          <button
            type="button"
            className={`cinema-icon-btn${inList ? " is-on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleWatchlist();
            }}
            aria-label={inList ? "In list" : "My List"}
            title={inList ? "In list" : "My List"}
          >
            <ListIcon filled={inList} />
          </button>
          {hasEpisodePicker && (
            <button
              type="button"
              className={`cinema-icon-btn${showEpisodes ? " is-on" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowEpisodes((v) => {
                  const next = !v;
                  // Opening panel: start on the season currently playing
                  if (next) setBrowseSeason(season);
                  return next;
                });
                setShowSources(false);
                setChromeVisible(true);
              }}
              aria-label="Episodes"
              title="Episodes"
            >
              <EpisodesIcon />
            </button>
          )}
          {catalogProviders.length > 0 && (
            <button
              type="button"
              className={`cinema-btn${showSources ? " is-on" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setShowSources((v) => {
                  const next = !v;
                  if (next && !sheetProvider && playbackProvider) {
                    setSheetProvider(playbackProvider);
                  }
                  return next;
                });
                setShowEpisodes(false);
                setShowSpeedMenu(false);
                setChromeVisible(true);
              }}
              aria-label="Servers and sources"
              title="Servers & sources"
            >
              <LayersIcon />
              <span className="cinema-server-label">
                {playbackProvider
                  ? catalogProviders.find((p) => p.id === playbackProvider)
                      ?.label || playbackProvider
                  : "Servers"}
              </span>
            </button>
          )}
          {(isAnime || malId) && (
            <div
              className="cinema-audio-toggle"
              role="group"
              aria-label="Audio language"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={`cinema-audio-btn${audioMode === "sub" ? " is-active" : ""}`}
                onClick={() => switchAudioMode("sub")}
                title="Japanese audio with subtitles"
              >
                Sub
              </button>
              <button
                type="button"
                className={`cinema-audio-btn${audioMode === "dub" ? " is-active" : ""}`}
                onClick={() => switchAudioMode("dub")}
                title="English dubbed audio"
              >
                Dub
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Bottom HUD — custom controls */}
      {status === "ready" && (
        <div
          className="cinema-hud cinema-hud-bottom"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress */}
          <div
            className="cinema-progress"
            onPointerDown={(e) => {
              const bar = e.currentTarget;
              const rect = bar.getBoundingClientRect();
              const seek = (clientX: number) => {
                const r = Math.max(
                  0,
                  Math.min(1, (clientX - rect.left) / rect.width),
                );
                onSeek(r);
              };
              setSeeking(true);
              seek(e.clientX);
              const move = (ev: PointerEvent) => seek(ev.clientX);
              const up = () => {
                setSeeking(false);
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          >
            <div
              className="cinema-progress-buf"
              style={{ width: `${bufferPct * 100}%` }}
            />
            <div
              className="cinema-progress-fill"
              style={{ width: `${progress * 100}%` }}
            />
            <div
              className="cinema-progress-thumb"
              style={{ left: `${progress * 100}%` }}
            />
          </div>

          <div className="cinema-controls">
            <div className="cinema-controls-left">
              <button
                type="button"
                className="cinema-icon-btn"
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              {nextEpisode && (
                <button
                  type="button"
                  className="cinema-icon-btn"
                  onClick={() => {
                    if (nextEpisode.kind === "anime")
                      goToAnimeEpisode(Number(nextEpisode.episode));
                    else
                      goToEpisode(nextEpisode.season, nextEpisode.episode);
                  }}
                  aria-label="Next episode"
                  title="Next episode"
                >
                  <NextIcon />
                </button>
              )}
              <div className="cinema-vol">
                <button
                  type="button"
                  className="cinema-icon-btn"
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted || volume === 0 ? <MuteIcon /> : <VolIcon />}
                </button>
                <input
                  type="range"
                  className="cinema-vol-slider"
                  min={0}
                  max={1}
                  step={0.02}
                  value={muted ? 0 : volume}
                  onChange={(e) => setVol(Number(e.target.value))}
                  aria-label="Volume"
                />
              </div>
              <span className="cinema-time">
                {formatTime(currentTime)}
                <span> / </span>
                {formatTime(duration)}
              </span>
            </div>
            <div className="cinema-controls-right">
              <div className="cinema-speed-wrap">
                <button
                  type="button"
                  className={`cinema-icon-btn cinema-speed-btn${showSpeedMenu ? " is-on" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSpeedMenu((v) => !v);
                    setShowSources(false);
                    setShowEpisodes(false);
                    bumpChrome();
                  }}
                  aria-label="Playback speed"
                  title="Playback speed"
                >
                  {playbackSpeed === 1 ? "1×" : `${playbackSpeed}×`}
                </button>
                {showSpeedMenu && (
                  <div
                    className="cinema-speed-menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="cinema-speed-menu-label">Speed</p>
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`cinema-speed-option${playbackSpeed === s ? " is-active" : ""}`}
                        onClick={() => setSpeed(s)}
                      >
                        {s === 1 ? "Normal" : `${s}×`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="cinema-icon-btn"
                onClick={toggleFullscreen}
                aria-label="Fullscreen"
              >
                <FsIcon />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server + source selector */}
      {showSources && (
        <>
          <button
            type="button"
            className="cinema-sheet-backdrop"
            aria-label="Close servers"
            onClick={() => setShowSources(false)}
          />
          <div
            className="cinema-server-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Choose server and source"
          >
            <div className="cinema-server-sheet-head">
              <div>
                <p className="cinema-server-kicker">Stream servers</p>
                <h3 className="cinema-server-title">
                  {isAnime || malId
                    ? "Server, Sub/Dub & quality"
                    : "Pick a provider & quality"}
                </h3>
              </div>
              <button
                type="button"
                className="cinema-panel-close"
                onClick={() => setShowSources(false)}
              >
                Close
              </button>
            </div>

            <div className="cinema-server-body">
              {/* Provider rail — click browses only; does not swap playback */}
              <div className="cinema-server-rail" role="tablist" aria-label="Providers">
                {catalogProviders.map((p) => {
                  const st = providerState[p.id] || "idle";
                  const isBrowsing = sheetProvider === p.id;
                  const isPlaying = playbackProvider === p.id;
                  const cached = sourcesCache[p.id];
                  const count = cached?.length;
                  let metaReady: string | null = null;
                  if (st === "ready" && count != null) {
                    if ((isAnime || malId) && cached?.length) {
                      let sub = 0;
                      let dub = 0;
                      for (const s of cached) {
                        const d = detectAudioLang(s);
                        if (d === "sub") sub++;
                        else if (d === "dub") dub++;
                      }
                      if (sub || dub) {
                        metaReady = [
                          sub ? `${sub} sub` : null,
                          dub ? `${dub} dub` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                      } else {
                        metaReady = `${count} source${count === 1 ? "" : "s"}`;
                      }
                    } else {
                      metaReady = `${count} source${count === 1 ? "" : "s"}`;
                    }
                  }
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={isBrowsing}
                      className={`cinema-server-chip${isBrowsing ? " is-active" : ""}${isPlaying ? " is-playing" : ""}${st === "loading" ? " is-loading" : ""}${st === "empty" || st === "error" ? " is-bad" : ""}${st === "ready" ? " is-ready" : ""}`}
                      onClick={() => {
                        void browseProvider(p.id);
                      }}
                    >
                      <span className="cinema-server-chip-dot" aria-hidden />
                      <span className="cinema-server-chip-text">
                        <span className="cinema-server-chip-name">{p.label}</span>
                        <span className="cinema-server-chip-meta">
                          {st === "loading"
                            ? "Checking…"
                            : st === "ready"
                              ? metaReady ||
                                `${count ?? 0} source${(count ?? 0) === 1 ? "" : "s"}`
                              : st === "empty" || st === "error"
                                ? "Unavailable"
                                : p.blurb}
                        </span>
                      </span>
                      {isPlaying && (
                        <span className="cinema-server-chip-badge">On</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Sources list for browsed provider */}
              <div className="cinema-server-sources">
                <div className="cinema-server-sources-head">
                  <p>
                    {sheetProvider
                      ? catalogProviders.find((p) => p.id === sheetProvider)
                          ?.label || sheetProvider
                      : "Sources"}
                    {sheetProvider &&
                      playbackProvider &&
                      sheetProvider !== playbackProvider && (
                        <span className="cinema-server-browse-hint">
                          {" "}
                          · pick a source to switch
                        </span>
                      )}
                  </p>
                  {loadingProvider && (
                    <span className="cinema-server-loading-pill">
                      <span className="cinema-server-mini-spin" />
                      Fetching…
                    </span>
                  )}
                </div>

                {/* Anime: Sub / Dub mode switcher with live counts */}
                {(isAnime || malId) && sheetSourcesAll.length > 0 && (
                  <div
                    className="cinema-audio-mode-row"
                    role="tablist"
                    aria-label="Sub or Dub"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={audioMode === "sub"}
                      className={`cinema-audio-mode-chip${audioMode === "sub" ? " is-active" : ""}`}
                      onClick={() => switchAudioMode("sub")}
                    >
                      <span className="cinema-audio-mode-label">Sub</span>
                      <span className="cinema-audio-mode-count">
                        {sheetAudioCounts.sub ||
                          (sheetAudioCounts.untagged && audioMode === "sub"
                            ? sheetAudioCounts.untagged
                            : 0)}
                      </span>
                      <span className="cinema-audio-mode-desc">Japanese</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={audioMode === "dub"}
                      className={`cinema-audio-mode-chip${audioMode === "dub" ? " is-active" : ""}`}
                      onClick={() => switchAudioMode("dub")}
                    >
                      <span className="cinema-audio-mode-label">Dub</span>
                      <span className="cinema-audio-mode-count">
                        {sheetAudioCounts.dub}
                      </span>
                      <span className="cinema-audio-mode-desc">English</span>
                    </button>
                  </div>
                )}

                {loadingProvider && sheetSources.length === 0 && (
                  <div className="cinema-server-empty">
                    <div className="cinema-spinner" />
                    <p>Contacting server…</p>
                  </div>
                )}

                {!loadingProvider &&
                  sheetProvider &&
                  (providerState[sheetProvider] === "empty" ||
                    providerState[sheetProvider] === "error") && (
                    <div className="cinema-server-empty">
                      <p className="cinema-server-empty-title">
                        No streams on this server
                      </p>
                      <p className="cinema-server-empty-sub">
                        {providerErrors[sheetProvider] ||
                          "Try another provider from the list."}
                      </p>
                      <button
                        type="button"
                        className="cinema-retry"
                        onClick={() => {
                          setSourcesCache((c) => {
                            const next = { ...c };
                            if (sheetProvider) delete next[sheetProvider];
                            return next;
                          });
                          void browseProvider(sheetProvider!, {
                            force: true,
                          });
                        }}
                      >
                        Retry server
                      </button>
                    </div>
                  )}

                {!loadingProvider &&
                  sheetSourcesAll.length > 0 &&
                  sheetSources.length === 0 &&
                  (isAnime || malId) && (
                    <div className="cinema-server-empty">
                      <p className="cinema-server-empty-title">
                        No {audioMode === "dub" ? "dub" : "sub"} sources
                      </p>
                      <p className="cinema-server-empty-sub">
                        {audioMode === "dub"
                          ? "This episode may not have an English dub on this server."
                          : "No Japanese sub streams on this server."}
                      </p>
                      {(audioMode === "dub"
                        ? sheetAudioCounts.sub
                        : sheetAudioCounts.dub) > 0 && (
                        <button
                          type="button"
                          className="cinema-retry"
                          onClick={() =>
                            switchAudioMode(
                              audioMode === "dub" ? "sub" : "dub",
                            )
                          }
                        >
                          Switch to{" "}
                          {audioMode === "dub" ? "Sub" : "Dub"} (
                          {audioMode === "dub"
                            ? sheetAudioCounts.sub
                            : sheetAudioCounts.dub}
                          )
                        </button>
                      )}
                    </div>
                  )}

                {sheetSources.length > 0 && (
                  <div className="cinema-server-source-list">
                    {(isAnime || malId) && (
                      <p className="cinema-source-group-label">
                        {audioMode === "dub" ? "English Dub" : "Japanese Sub"}
                        <span>
                          {" "}
                          · {sheetSources.length} source
                          {sheetSources.length === 1 ? "" : "s"}
                        </span>
                      </p>
                    )}
                    {sheetSources.map((s, i) => {
                      const active = activeUrl === s.url;
                      const lang = detectAudioLang(s);
                      const label = sourceDisplayName(s, i);
                      const qi =
                        s.quality?.replace(/p$/i, "") ||
                        (s.type === "hls" ? "HLS" : "•");
                      return (
                        <button
                          key={`${s.url}-${i}`}
                          type="button"
                          className={`cinema-source-card${active ? " is-active" : ""}`}
                          onClick={() => selectSource(s)}
                        >
                          <span className="cinema-source-qi">{qi}</span>
                          <span className="cinema-source-body">
                            <span className="cinema-source-name-row">
                              <span className="cinema-source-name">
                                {label}
                              </span>
                              {lang && (
                                <span
                                  className={`cinema-source-lang is-${lang}`}
                                >
                                  {lang === "dub" ? "DUB" : "SUB"}
                                </span>
                              )}
                            </span>
                            <span className="cinema-source-meta">
                              {[
                                s.type?.toUpperCase(),
                                s.provider || sheetProvider,
                                lang === "dub"
                                  ? "English audio"
                                  : lang === "sub"
                                    ? "Japanese + subs"
                                    : null,
                                active ? "Playing now" : "Tap to play",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          {active ? (
                            <span className="cinema-source-live">Live</span>
                          ) : (
                            <span className="cinema-source-go">Play</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {!loadingProvider &&
                  sheetSourcesAll.length === 0 &&
                  sheetProvider &&
                  (providerState[sheetProvider] === "idle" ||
                    !providerState[sheetProvider]) && (
                    <div className="cinema-server-empty">
                      <p>Checking this server…</p>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Episodes panel overlay */}
      {showEpisodes && hasEpisodePicker && (
        <div
          className="cinema-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cinema-panel-head">
            <p>Episodes</p>
            <button
              type="button"
              onClick={() => setShowEpisodes(false)}
              className="cinema-panel-close"
            >
              Close
            </button>
          </div>
          {mediaType === "tv" && !malId && (
            <>
              <div className="cinema-season-row">
                {Array.from({ length: seasonsCount }, (_, i) => i + 1).map(
                  (s) => (
                    <button
                      key={s}
                      type="button"
                      className={`cinema-season${
                        String(s) === browseSeason ? " is-active" : ""
                      }${String(s) === season && String(s) !== browseSeason ? " is-playing" : ""}`}
                      onClick={() => selectBrowseSeason(String(s))}
                      title={
                        String(s) === season
                          ? `Season ${s} (playing)`
                          : `Browse season ${s}`
                      }
                    >
                      S{s}
                    </button>
                  ),
                )}
              </div>
              {browseSeason !== season && (
                <p className="cinema-browse-season-hint">
                  Browsing S{browseSeason} · pick an episode to play
                  {season ? ` (now: S${season} E${episode})` : ""}
                </p>
              )}
              <div className="cinema-panel-list">
                {episodes.map((ep) => {
                  const epSeason = String(
                    ep.season_number ?? browseSeason,
                  );
                  const active =
                    String(ep.episode_number) === episode &&
                    epSeason === season;
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      className={`cinema-panel-row${active ? " is-active" : ""}`}
                      onClick={() =>
                        goToEpisode(epSeason, String(ep.episode_number))
                      }
                    >
                      <span className="cinema-panel-idx">
                        {ep.episode_number}
                      </span>
                      <span className="cinema-panel-body">
                        <span className="cinema-panel-name">
                          {ep.name || `Episode ${ep.episode_number}`}
                        </span>
                      </span>
                      {active && (
                        <span className="cinema-panel-now">Now</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {malId && animeEpCount > 0 && (
            <div className="cinema-anime-eps">
              {Array.from({ length: animeEpCount }, (_, i) => i + 1).map(
                (n) => {
                  const active = String(n) === String(episode || "1");
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`cinema-anime-ep${active ? " is-active" : ""}`}
                      onClick={() => goToAnimeEpisode(n)}
                    >
                      {n}
                    </button>
                  );
                },
              )}
            </div>
          )}
        </div>
      )}

      {/* Cast overlay */}
      {castOverlay && (cast.isCasting || cast.isConnected) && (
        <CastOverlay
          title={title}
          subtitle={
            mediaType === "tv" && !malId
              ? `Season ${season} · Episode ${episode}`
              : malId
                ? `Episode ${episode || "1"}`
                : cast.deviceName || undefined
          }
          deviceName={cast.deviceName}
          currentTime={cast.currentTime || currentTime}
          duration={cast.duration || duration}
          isPlaying={cast.playerState === "PLAYING"}
          onPlayPause={cast.playOrPause}
          onSeek={cast.seek}
          onStop={() => {
            cast.disconnect();
            setCastOverlay(false);
          }}
        />
      )}

      {cast.lastError && !castErrorDismissed && (
        <CastErrorBanner
          message={cast.lastError}
          onDismiss={() => setCastErrorDismissed(true)}
        />
      )}

      <PlayerHelpModal
        open={showHelp}
        onClose={() => {
          markPlayerHelpSessionShown();
          setShowHelp(false);
          bumpChrome();
        }}
        platform={detectHelpPlatform()}
      />
    </main>
  );
}

/* Icons */
function PlayBig() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5L8 5.5z" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5L8 5.5z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}
function NextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6v12l8.5-6L6 6zm10 0h2v12h-2V6z" />
    </svg>
  );
}
function VolIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M18 6a8 8 0 010 12" />
    </svg>
  );
}
function MuteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
    </svg>
  );
}
function FsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ListIcon({ filled }: { filled?: boolean }) {
  return filled ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
    </svg>
  );
}
function LayersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}
function EpisodesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <main className="cinema">
          <div className="cinema-state">
            <div className="cinema-spinner" />
            <p className="cinema-state-sub">Loading player…</p>
          </div>
        </main>
      }
    >
      <WatchInner />
    </Suspense>
  );
}
