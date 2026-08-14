'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Hls from 'hls.js';
import styles from './VideoPlayer.module.css';
import {
  applyStreamProxy,
  formatTime,
  normalizeSkip,
  type PlayerSource,
} from './stream-proxy';
import type { SubtitleTrack } from '@flyx/core';
import {
  IconAlert,
  IconBack,
  IconCheck,
  IconForward10,
  IconFullscreen,
  IconFullscreenExit,
  IconNextEpisode,
  IconPause,
  IconPictureInPicture,
  IconPlay,
  IconRewind10,
  IconServers,
  IconSettings,
  IconVolume,
  IconVolumeMute,
} from './icons';
import { getPlayerPreferences } from '@/lib/utils/player-preferences';
import { useCast } from '@/hooks/useCast';
import PlayerHelpModal, {
  shouldAutoShowPlayerHelp,
  markPlayerHelpSeen,
} from './PlayerHelpModal';
import { CastButton, CastOverlay, CastErrorBanner, IconHelp, IconCast } from './CastUI';

export interface VideoPlayerProps {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title?: string;
  nextEpisode?: {
    season: number;
    episode: number;
    title?: string;
    isNextSeason?: boolean;
  } | null;
  onNextEpisode?: () => void;
  onBack?: () => void;
  autoplay?: boolean;
  malId?: number;
  malTitle?: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const HIDE_DELAY_MS = 2800;
const VOLUME_KEY = 'flyx:player:volume';
const MUTE_KEY = 'flyx:player:muted';

function loadVolume(): number {
  if (typeof window === 'undefined') return 1;
  const v = parseFloat(localStorage.getItem(VOLUME_KEY) || '1');
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

function loadMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MUTE_KEY) === '1';
}

export default function VideoPlayer({
  tmdbId,
  mediaType,
  season,
  episode,
  title,
  nextEpisode,
  onNextEpisode,
  onBack,
  autoplay = true,
  malId,
  malTitle,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ t: number; zone: string }>({ t: 0, zone: '' });
  const pendingResumeRef = useRef(0);
  const hasAutoPlayedRef = useRef(false);
  const failoverLockRef = useRef(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);

  const [sources, setSources] = useState<PlayerSource[]>([]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [provider, setProvider] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolume] = useState(loadVolume);
  const [isMuted, setIsMuted] = useState(loadMuted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChrome, setShowChrome] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showServers, setShowServers] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPct, setHoverPct] = useState(0);
  const [showVolumeHud, setShowVolumeHud] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [seekFlash, setSeekFlash] = useState<'left' | 'right' | null>(null);
  const [seekFlashSec, setSeekFlashSec] = useState(10);

  // ── Subtitles ──────────────────────────────────────
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState(-1); // -1 = off
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [subtitleStatus, setSubtitleStatus] = useState<
    'idle' | 'ok' | 'blocked' | 'failed'
  >('idle');
  const [showNext, setShowNext] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [dismissedNext, setDismissedNext] = useState(false);
  const [showKbdHint, setShowKbdHint] = useState(false);
  const [skipVisible, setSkipVisible] = useState<'intro' | 'outro' | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [castErrorDismissed, setCastErrorDismissed] = useState(false);
  const [isCastOverlayVisible, setIsCastOverlayVisible] = useState(false);
  const helpAutoOpenedRef = useRef(false);

  const prefs = useRef(getPlayerPreferences());
  // Latest values for keyboard handler (avoids stale closures / empty-deps listener)
  const volumeRef = useRef(volume);
  const speedRef = useRef(speed);
  const showSettingsRef = useRef(showSettings);
  const showServersRef = useRef(showServers);
  const showHelpRef = useRef(showHelp);
  const durationRef = useRef(duration);
  const statusRef = useRef(status);
  const nextEpisodeRef = useRef(nextEpisode);
  const onNextEpisodeRef = useRef(onNextEpisode);
  const onBackRef = useRef(onBack);
  volumeRef.current = volume;
  speedRef.current = speed;
  showSettingsRef.current = showSettings;
  showServersRef.current = showServers;
  showHelpRef.current = showHelp;
  durationRef.current = duration;
  statusRef.current = status;
  nextEpisodeRef.current = nextEpisode;
  onNextEpisodeRef.current = onNextEpisode;
  onBackRef.current = onBack;

  // ---------- Chrome auto-hide ----------
  const bumpChrome = useCallback(() => {
    setShowChrome(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying && !showSettings && !showServers && !showHelp) {
      hideTimerRef.current = setTimeout(() => setShowChrome(false), HIDE_DELAY_MS);
    }
  }, [isPlaying, showSettings, showServers, showHelp]);

  useEffect(() => {
    bumpChrome();
  }, [isPlaying, bumpChrome]);

  const currentStreamUrl = sources[sourceIndex]?.url ?? null;

  const cast = useCast({
    videoRef,
    streamUrl: currentStreamUrl,
    mediaKey: status === 'ready' ? `${currentStreamUrl || ''}:${sourceIndex}` : null,
    onConnect: () => {
      setIsCastOverlayVisible(true);
      setCastErrorDismissed(false);
      try {
        videoRef.current?.pause();
      } catch {
        /* ignore */
      }
    },
    onDisconnect: () => {
      setIsCastOverlayVisible(false);
    },
    onError: () => {
      setCastErrorDismissed(false);
    },
  });

  // ---------- Source fetch ----------
  const fetchSources = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);
    setSources([]);
    setSourceIndex(0);

    try {
      const params = new URLSearchParams({
        tmdbId: String(tmdbId),
        mediaType,
      });
      if (season != null) params.set('season', String(season));
      if (episode != null) params.set('episode', String(episode));
      if (malId != null) params.set('malId', String(malId));
      if (title) params.set('title', title);
      if (malTitle) params.set('malTitle', malTitle);

      // Prefer server pipeline; fall back to client extractors
      let list: PlayerSource[] = [];
      let usedProvider = 'unknown';

      try {
        const res = await fetch(`/api/stream/extract?${params}`, { cache: 'no-store' });
        const data = await res.json();
        if (data.success && data.sources?.length) {
          usedProvider = data.provider || 'pipeline';
          list = data.sources
            .filter((s: { url?: string }) => s.url)
            .map((s: {
              url: string;
              title?: string;
              quality?: string;
              type?: string;
              requiresSegmentProxy?: boolean;
              skipIntro?: PlayerSource['skipIntro'];
              skipOutro?: PlayerSource['skipOutro'];
            }) => ({
              title: s.title || s.quality || 'Stream',
              url: applyStreamProxy(s.url, usedProvider, s.requiresSegmentProxy),
              quality: s.quality,
              provider: usedProvider,
              type: (s.type as PlayerSource['type']) || 'hls',
              skipIntro: s.skipIntro,
              skipOutro: s.skipOutro,
              requiresSegmentProxy: s.requiresSegmentProxy,
            }));
        }
      } catch {
        /* try clients */
      }

      if (!list.length) {
        const clients: Array<{ name: string; run: () => Promise<Array<{ url: string; title?: string; quality?: string; skipIntro?: [number, number]; skipOutro?: [number, number]; requiresSegmentProxy?: boolean }>> }> = [];

        // VOD: videasy + vidsrc + multiembed via unified extraction API
        for (const vp of ['videasy', 'vidsrc', 'multiembed']) {
          clients.push({
            name: vp,
            run: async () => {
              const params = new URLSearchParams({ tmdbId: String(tmdbId), mediaType, provider: vp });
              if (title) params.set('title', title);
              if (season) params.set('season', String(season));
              if (episode) params.set('episode', String(episode));
              const res = await fetch(`/api/stream/extract?${params}`);
              const data = await res.json();
              return (data.success && data.sources) ? data.sources : [];
            },
          });
        }

        if (malId) {
          clients.push({
            name: 'animex',
            run: async () => {
              const { extractAnimeClient } = await import('@/app/lib/services/anime-client-extractor');
              const result = await extractAnimeClient(Number(malId), title || malTitle || '', episode);
              return result.sources || [];
            },
          });
        }

        for (const c of clients) {
          try {
            const raw = await c.run();
            const valid = raw.filter((s) => s.url);
            if (valid.length) {
              usedProvider = c.name;
              list = valid.map((s) => ({
                title: s.title || s.quality || `${c.name} source`,
                url: applyStreamProxy(s.url, c.name, s.requiresSegmentProxy),
                quality: s.quality,
                provider: c.name,
                type: 'hls' as const,
                skipIntro: s.skipIntro,
                skipOutro: s.skipOutro,
              }));
              break;
            }
          } catch {
            /* next */
          }
        }
      }

      if (!list.length) {
        setStatus('error');
        setErrorMsg('No playable streams found. Try again or pick another title.');
        return;
      }

      setSources(list);
      setProvider(usedProvider);
      setSourceIndex(0);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load stream');
    }
  }, [tmdbId, mediaType, season, episode, malId, title, malTitle]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  // ---------- Subtitle fetching ----------
  useEffect(() => {
    const tmdbNum = parseInt(tmdbId, 10);
    if (!tmdbNum || tmdbNum <= 0) return;

    let cancelled = false;

    async function fetchSubtitles() {
      try {
        const params = new URLSearchParams({
          tmdbId: String(tmdbNum),
          type: mediaType,
        });
        if (season != null) params.set("season", String(season));
        if (episode != null) params.set("episode", String(episode));

        const res = await fetch(`/api/subtitles/search?${params.toString()}`);
        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (cancelled) return;
        if (data.subtitles?.length > 0) {
          setSubtitleTracks(data.subtitles);
          setSubtitleStatus('ok');
        } else {
          // No tracks: remember why so the CC button can show unavailable state
          setSubtitleStatus(data.error === 'blocked' ? 'blocked' : 'failed');
        }
      } catch {
        // Subtitle fetch is best-effort — don't bother the user
        if (!cancelled) setSubtitleStatus('failed');
      }
    }

    fetchSubtitles();
    return () => { cancelled = true; };
  }, [tmdbId, mediaType, season, episode]);

  // ---------- HLS attach ----------
  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const loadSource = useCallback(
    (src: PlayerSource, resumeAt = 0) => {
      const video = videoRef.current;
      if (!video || !src?.url) return;

      destroyHls();
      setIsBuffering(true);
      pendingResumeRef.current = resumeAt;

      const url = src.url;
      const isHls = url.includes('.m3u8') || src.type === 'hls' || !src.type;

      const onReady = () => {
        if (pendingResumeRef.current > 0 && video.duration) {
          video.currentTime = Math.min(pendingResumeRef.current, video.duration - 1);
          pendingResumeRef.current = 0;
        }
        if (autoplay || hasAutoPlayedRef.current) {
          video.play().catch(() => setIsPlaying(false));
        }
        hasAutoPlayedRef.current = true;
      };

      if (isHls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          fragLoadingMaxRetry: 6,
          manifestLoadingMaxRetry: 4,
          levelLoadingMaxRetry: 4,
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video as unknown as HTMLMediaElement);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsBuffering(false);
          onReady();
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
            return;
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          // Fatal — fail over to next source once
          if (failoverLockRef.current) return;
          failoverLockRef.current = true;
          setSourceIndex((i) => i + 1);
          setTimeout(() => {
            failoverLockRef.current = false;
          }, 500);
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl') && isHls) {
        video.src = url;
        video.addEventListener('loadedmetadata', onReady, { once: true });
      } else {
        video.src = url;
        video.addEventListener('loadedmetadata', () => {
          setIsBuffering(false);
          onReady();
        }, { once: true });
      }
    },
    [autoplay, destroyHls],
  );

  // Load when source changes; failover on bad index
  useEffect(() => {
    if (status !== 'ready' || !sources.length) return;
    if (sourceIndex >= sources.length) {
      setStatus('error');
      setErrorMsg('All sources failed. Try again in a moment.');
      return;
    }
    const resume = videoRef.current?.currentTime || pendingResumeRef.current || 0;
    loadSource(sources[sourceIndex], resume > 2 ? resume : 0);
    return () => destroyHls();
  }, [status, sources, sourceIndex, loadSource, destroyHls]);

  // Apply volume / speed
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = isMuted;
    localStorage.setItem(VOLUME_KEY, String(volume));
    localStorage.setItem(MUTE_KEY, isMuted ? '1' : '0');
  }, [volume, isMuted]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  // Video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length) {
        try {
          const end = video.buffered.end(video.buffered.length - 1);
          setBuffered(video.duration ? (end / video.duration) * 100 : 0);
        } catch {
          /* ignore */
        }
      }
      // skip intro/outro
      const src = sources[sourceIndex];
      const intro = normalizeSkip(src?.skipIntro);
      const outro = normalizeSkip(src?.skipOutro);
      const t = video.currentTime;
      if (intro && t >= intro.start && t < intro.end - 1) setSkipVisible('intro');
      else if (outro && t >= outro.start && t < outro.end - 1) setSkipVisible('outro');
      else setSkipVisible(null);

      // next episode
      const p = prefs.current;
      if (
        nextEpisode &&
        onNextEpisode &&
        !dismissedNext &&
        video.duration > 0 &&
        video.duration - t <= (p.showNextEpisodeBeforeEnd || 60)
      ) {
        setShowNext(true);
      }
    };
    const onMeta = () => setDuration(video.duration || 0);
    const onPlay = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onEnded = () => {
      setIsPlaying(false);
      if (nextEpisode && onNextEpisode && prefs.current.autoPlayNextEpisode) {
        setShowNext(true);
        setCountdown(prefs.current.autoPlayCountdown || 10);
      }
    };

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('durationchange', onMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('durationchange', onMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnded);
    };
  }, [sources, sourceIndex, nextEpisode, onNextEpisode, dismissedNext]);

  // Countdown auto-next
  useEffect(() => {
    if (countdown == null || !onNextEpisode) return;
    if (countdown <= 0) {
      onNextEpisode();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown, onNextEpisode]);

  // Fullscreen + PiP support
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    setPipSupported(!!document.pictureInPictureEnabled);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Focus player + first-visit controls guide (also while loading so it always appears)
  useEffect(() => {
    if (status === 'error') return;
    if (status === 'ready') {
      containerRef.current?.focus({ preventScroll: true });
    }
    if (helpAutoOpenedRef.current) return;
    if (!shouldAutoShowPlayerHelp()) return;
    helpAutoOpenedRef.current = true;
    const t = setTimeout(() => setShowHelp(true), 300);
    return () => clearTimeout(t);
  }, [status]);

  // ---------- Actions ----------
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    bumpChrome();
  }, [bumpChrome]);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      const dur = v.duration;
      // Allow seek even if duration is still resolving (HLS often starts with NaN)
      if (Number.isFinite(dur) && dur > 0) {
        v.currentTime = Math.min(Math.max(0, v.currentTime + delta), Math.max(0, dur - 0.25));
      } else {
        v.currentTime = Math.max(0, v.currentTime + delta);
      }
      setCurrentTime(v.currentTime);
      setSeekFlashSec(Math.abs(delta));
      setSeekFlash(delta < 0 ? 'left' : 'right');
      if (seekFlashTimerRef.current) clearTimeout(seekFlashTimerRef.current);
      seekFlashTimerRef.current = setTimeout(() => setSeekFlash(null), 550);
      bumpChrome();
    },
    [bumpChrome],
  );

  const seekTo = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v) return;
      const dur = v.duration;
      if (Number.isFinite(dur) && dur > 0) {
        v.currentTime = Math.min(Math.max(0, t), Math.max(0, dur - 0.25));
      } else {
        v.currentTime = Math.max(0, t);
      }
      setCurrentTime(v.currentTime);
      bumpChrome();
    },
    [bumpChrome],
  );

  const changeVolume = useCallback(
    (nextVol: number) => {
      const next = Math.min(1, Math.max(0, nextVol));
      const video = videoRef.current;
      // Apply immediately — don't wait for the volume effect
      if (video) {
        video.volume = next;
        if (next > 0) video.muted = false;
      }
      volumeRef.current = next;
      setVolume(next);
      if (next > 0) setIsMuted(false);
      setShowVolumeHud(true);
      if (volumeHudTimerRef.current) clearTimeout(volumeHudTimerRef.current);
      volumeHudTimerRef.current = setTimeout(() => setShowVolumeHud(false), 900);
      try {
        localStorage.setItem(VOLUME_KEY, String(next));
        if (next > 0) localStorage.setItem(MUTE_KEY, '0');
      } catch {
        /* ignore */
      }
      bumpChrome();
    },
    [bumpChrome],
  );

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      const video = videoRef.current;
      if (video) video.muted = next;
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
    setShowVolumeHud(true);
    if (volumeHudTimerRef.current) clearTimeout(volumeHudTimerRef.current);
    volumeHudTimerRef.current = setTimeout(() => setShowVolumeHud(false), 900);
    bumpChrome();
  }, [bumpChrome]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* ignore */
    }
    bumpChrome();
  }, [bumpChrome]);

  const togglePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* ignore */
    }
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 1200);
  }, []);

  const handleCastClick = useCallback(async () => {
    bumpChrome();
    if (cast.isCasting || cast.isConnected) {
      cast.disconnect();
      setIsCastOverlayVisible(false);
      return;
    }
    const connected = await cast.requestSession();
    if (!connected) return;

    const url = sources[sourceIndex]?.url || currentStreamUrl;
    if (!url) {
      showToast('No stream to cast yet');
      return;
    }

    const epLabel =
      mediaType === 'tv' && season != null && episode != null
        ? `S${season} E${episode}`
        : undefined;

    const ok = await cast.loadMedia({
      url,
      title: title || 'Flyx',
      subtitle: epLabel,
      contentType: url.includes('.m3u8')
        ? 'application/x-mpegURL'
        : 'video/mp4',
      startTime: videoRef.current?.currentTime || 0,
    });
    if (ok) setIsCastOverlayVisible(true);
  }, [
    bumpChrome,
    cast,
    sources,
    sourceIndex,
    currentStreamUrl,
    mediaType,
    season,
    episode,
    title,
    showToast,
  ]);

  const switchSource = useCallback(
    (index: number) => {
      const resume = videoRef.current?.currentTime || 0;
      pendingResumeRef.current = resume;
      setSourceIndex(index);
      setShowServers(false);
      showToast(`Source ${index + 1}`);
    },
    [showToast],
  );

  const changeSpeed = useCallback(
    (s: number) => {
      setSpeed(s);
      showToast(`${s}× speed`);
      setShowSettings(false);
    },
    [showToast],
  );

  const handleSkip = useCallback(() => {
    const src = sources[sourceIndex];
    if (skipVisible === 'intro') {
      const intro = normalizeSkip(src?.skipIntro);
      if (intro) seekTo(intro.end);
    } else if (skipVisible === 'outro') {
      const outro = normalizeSkip(src?.skipOutro);
      if (outro) seekTo(outro.end);
    }
    setSkipVisible(null);
  }, [sources, sourceIndex, skipVisible, seekTo]);

  // Keep action refs in sync so the keyboard listener can be mount-once (no stale closures)
  const actionsRef = useRef({
    togglePlay,
    seekBy,
    seekTo,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    changeSpeed,
    showToast,
  });
  actionsRef.current = {
    togglePlay,
    seekBy,
    seekTo,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    changeSpeed,
    showToast,
  };

  // Keyboard shortcuts — single stable listener on document (capture).
  // Matches Flyx-main: capture:true so nothing else steals arrows/volume.
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (tag === 'INPUT') {
        const type = ((target as HTMLInputElement).type || 'text').toLowerCase();
        // Steal keys from range/checkbox/button; leave real text fields alone
        if (
          type === 'range' ||
          type === 'checkbox' ||
          type === 'radio' ||
          type === 'button' ||
          type === 'submit' ||
          type === 'reset' ||
          type === 'file' ||
          type === 'color' ||
          type === 'hidden'
        ) {
          return false;
        }
        return true;
      }
      return false;
    };

    /** Normalize key identity across layouts / Shift / numpad */
    const keyId = (e: KeyboardEvent): string => {
      const code = e.code || '';
      if (code === 'Space' || e.key === ' ') return 'space';
      if (code === 'ArrowLeft' || e.key === 'ArrowLeft' || e.key === 'Left') return 'left';
      if (code === 'ArrowRight' || e.key === 'ArrowRight' || e.key === 'Right') return 'right';
      if (code === 'ArrowUp' || e.key === 'ArrowUp' || e.key === 'Up') return 'up';
      if (code === 'ArrowDown' || e.key === 'ArrowDown' || e.key === 'Down') return 'down';
      if (code === 'Escape' || e.key === 'Escape' || e.key === 'Esc') return 'escape';
      if (code.startsWith('Key') && code.length === 4) return code.slice(3).toLowerCase();
      if (code.startsWith('Digit') && code.length === 6) return code.slice(5); // "0"-"9"
      if (code.startsWith('Numpad') && code.length === 7) {
        const n = code.slice(6);
        if (n >= '0' && n <= '9') return n;
      }
      // Shift turns "1" into "!" — still map via code above; key fallback for bare digits
      if (e.key >= '0' && e.key <= '9') return e.key;
      return (e.key || '').toLowerCase();
    };

    const resolveDuration = (): number => {
      const live = videoRef.current?.duration;
      if (typeof live === 'number' && Number.isFinite(live) && live > 0) return live;
      const cached = durationRef.current;
      if (typeof cached === 'number' && Number.isFinite(cached) && cached > 0) return cached;
      return 0;
    };

    const onKey = (e: KeyboardEvent) => {
      // Only while this player is active/ready
      if (statusRef.current !== 'ready') return;
      if (!videoRef.current || !containerRef.current) return;
      if (e.isComposing) return;
      // Allow Ctrl/Cmd+K etc. for the command palette
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      // Don't handle keys if player isn't on screen
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;

      const id = keyId(e);
      const shifted = e.shiftKey || e.getModifierState?.('Shift') === true;
      const a = actionsRef.current;

      // Help modal owns Esc / doesn't steal typing inside it
      if (showHelpRef.current) {
        if (id === 'escape') {
          e.preventDefault();
          e.stopPropagation();
          setShowHelp(false);
          markPlayerHelpSeen();
        }
        return;
      }

      switch (id) {
        case 'space':
        case 'k':
          e.preventDefault();
          e.stopPropagation();
          a.togglePlay();
          return;
        case 'left':
        case 'j':
          e.preventDefault();
          e.stopPropagation();
          a.seekBy(shifted ? -30 : -10);
          return;
        case 'right':
        case 'l':
          e.preventDefault();
          e.stopPropagation();
          a.seekBy(shifted ? 30 : 10);
          return;
        case 'up': {
          e.preventDefault();
          e.stopPropagation();
          // Read live from element so rapid presses always stack
          const video = videoRef.current;
          const cur =
            video && !video.muted ? video.volume : volumeRef.current;
          const base = video?.muted ? 0 : cur;
          a.changeVolume(base + 0.1);
          return;
        }
        case 'down': {
          e.preventDefault();
          e.stopPropagation();
          const video = videoRef.current;
          const cur =
            video && !video.muted ? video.volume : volumeRef.current;
          const base = video?.muted ? 0 : cur;
          a.changeVolume(base - 0.1);
          return;
        }
        case 'm':
          e.preventDefault();
          e.stopPropagation();
          a.toggleMute();
          return;
        case 'f':
          e.preventDefault();
          e.stopPropagation();
          void a.toggleFullscreen();
          return;
        case 'escape':
          if (showSettingsRef.current) {
            e.preventDefault();
            e.stopPropagation();
            setShowSettings(false);
          } else if (showServersRef.current) {
            e.preventDefault();
            e.stopPropagation();
            setShowServers(false);
          } else if (onBackRef.current && !document.fullscreenElement) {
            e.preventDefault();
            e.stopPropagation();
            onBackRef.current();
          }
          return;
        case 'n':
          if (nextEpisodeRef.current && onNextEpisodeRef.current) {
            e.preventDefault();
            e.stopPropagation();
            onNextEpisodeRef.current();
          }
          return;
        case ',':
        case '<': {
          e.preventDefault();
          e.stopPropagation();
          const idx = SPEEDS.indexOf(speedRef.current);
          a.changeSpeed(SPEEDS[Math.max(0, (idx < 0 ? 2 : idx) - 1)] ?? 1);
          return;
        }
        case '.':
        case '>': {
          e.preventDefault();
          e.stopPropagation();
          const idx = SPEEDS.indexOf(speedRef.current);
          a.changeSpeed(
            SPEEDS[Math.min(SPEEDS.length - 1, (idx < 0 ? 2 : idx) + 1)] ?? 1,
          );
          return;
        }
        default: {
          // 0–9 → jump to 0%–90%
          if (id.length === 1 && id >= '0' && id <= '9') {
            if (shifted) return;
            const dur = resolveDuration();
            if (dur <= 0) {
              a.showToast('Wait for video to load…');
              return;
            }
            const digit = parseInt(id, 10);
            e.preventDefault();
            e.stopPropagation();
            a.seekTo((dur * digit) / 10);
            a.showToast(`${digit * 10}%`);
          }
        }
      }
    };

    // document + capture wins over page scroll / focused buttons
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  // Progress bar interaction
  const pctFromEvent = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const onProgressPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingProgress(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pctFromEvent(e.clientX, e.currentTarget);
    seekTo(p * duration);
    bumpChrome();
  };

  const onProgressPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pctFromEvent(e.clientX, e.currentTarget);
    setHoverPct(p * 100);
    setHoverTime(p * duration);
    if (e.buttons === 1 || isDraggingProgress) seekTo(p * duration);
  };

  const onProgressPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    setIsDraggingProgress(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  // Click zones: single = play, double side = seek
  const onZoneClick = (zone: 'left' | 'center' | 'right') => (e: ReactMouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const last = lastTapRef.current;
    if (now - last.t < 280 && last.zone === zone) {
      if (zone === 'left') seekBy(-10);
      else if (zone === 'right') seekBy(10);
      else toggleFullscreen();
      lastTapRef.current = { t: 0, zone: '' };
      return;
    }
    lastTapRef.current = { t: now, zone };
    setTimeout(() => {
      if (lastTapRef.current.t === now) {
        if (zone === 'center') togglePlay();
        else bumpChrome();
      }
    }, 280);
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const chromeOpen =
    showChrome || !isPlaying || showSettings || showServers || showHelp || isCastOverlayVisible;
  const episodeLabel =
    mediaType === 'tv' && season != null && episode != null
      ? `Season ${season} · Episode ${episode}`
      : mediaType === 'movie'
        ? 'Movie'
        : '';

  // ---------- Render (single shell so Help/Cast always exist) ----------
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const isReady = status === 'ready';

  return (
    <div
      ref={containerRef}
      className={`${styles.root} ${chromeOpen || isLoading || isError || showHelp ? styles.chromeVisible : ''} ${!chromeOpen && isReady && !showHelp ? styles.hideCursor : ''}`}
      tabIndex={0}
      role="application"
      aria-label={title ? `Video player: ${title}` : 'Video player'}
      onMouseMove={bumpChrome}
      onMouseDown={() => containerRef.current?.focus({ preventScroll: true })}
      onMouseLeave={() => isPlaying && !showSettings && !showServers && !showHelp && setShowChrome(false)}
      onKeyDown={(e) => {
        if (
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === ' '
        ) {
          e.preventDefault();
        }
      }}
    >
      {/* Always mount video so cast/AirPlay can bind to an element */}
      <video
        ref={videoRef}
        className={styles.video}
        playsInline
        preload="auto"
        onClick={(e) => {
          e.stopPropagation();
          if (isReady) togglePlay();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (isReady) toggleFullscreen();
        }}
      >
        {subtitleTracks.map((track, i) => (
          <track
            key={`${track.language}-${i}`}
            kind="subtitles"
            label={track.label}
            srcLang={track.language}
            src={track.url}
            default={i === activeSubtitle}
          />
        ))}
      </video>

      <div className={styles.topGradient} />
      <div className={styles.bottomGradient} />

      {isReady && (
        <div className={styles.clickZones} aria-hidden>
          <button type="button" className={styles.clickZone} onClick={onZoneClick('left')} tabIndex={-1} />
          <button type="button" className={styles.clickZone} onClick={onZoneClick('center')} tabIndex={-1} />
          <button type="button" className={styles.clickZone} onClick={onZoneClick('right')} tabIndex={-1} />
        </div>
      )}

      {isReady && isBuffering && isPlaying && <div className={styles.buffering} />}

      {isReady && seekFlash && (
        <div className={`${styles.seekFlash} ${styles[seekFlash]}`}>
          {seekFlash === 'left' ? <IconRewind10 /> : <IconForward10 />}
          <span>{seekFlashSec}s</span>
        </div>
      )}

      {isReady && showVolumeHud && (
        <div className={styles.volumeHud}>
          {isMuted || volume === 0 ? <IconVolumeMute /> : <IconVolume />}
          <div className={styles.volumeHudBar}>
            <div
              className={styles.volumeHudFill}
              style={{ height: `${isMuted ? 0 : volume * 100}%` }}
            />
          </div>
          <div className={styles.volumeHudText}>
            {isMuted ? 'Mute' : `${Math.round(volume * 100)}%`}
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}

      {isReady && !isPlaying && !isBuffering && (
        <div className={styles.centerPlay}>
          <button
            type="button"
            className={styles.centerPlayBtn}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            aria-label="Play"
          >
            <IconPlay size={36} />
          </button>
        </div>
      )}

      {/* Top bar — Help + Cast always labeled and visible */}
      <div className={styles.topBar} style={{ opacity: 1, transform: 'none', pointerEvents: 'auto' }}>
        <div className={styles.topLeft}>
          {onBack && (
            <button type="button" className={styles.backBtn} onClick={onBack}>
              <IconBack />
              Back
            </button>
          )}
          <div className={styles.titleBlock}>
            <h2 className={styles.title}>{title || 'Now playing'}</h2>
            {episodeLabel && <p className={styles.subtitle}>{episodeLabel}</p>}
          </div>
        </div>
        <div className={styles.topRight}>
          <button
            type="button"
            className={`${styles.pill} ${showHelp ? styles.active : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowHelp(true);
              bumpChrome();
            }}
            aria-label="How to use the player"
          >
            <IconHelp size={16} />
            Controls
          </button>
          <button
            type="button"
            className={`${styles.pill} ${cast.isCasting || cast.isConnected ? styles.active : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              void handleCastClick();
            }}
            aria-label={cast.isCasting || cast.isConnected ? 'Stop casting' : 'Cast to TV'}
          >
            <IconCast active={cast.isCasting || cast.isConnected} size={16} />
            {cast.isCasting || cast.isConnected ? 'Casting' : 'Cast'}
          </button>
          {/* Subtitles selector */}
          {(subtitleTracks.length > 0 ||
            subtitleStatus === 'blocked' ||
            subtitleStatus === 'failed') && (
            <div className={styles.menuAnchor}>
              <button
                type="button"
                className={`${styles.pill} ${activeSubtitle >= 0 ? styles.active : ''} ${showSubtitleMenu ? styles.active : ''}`}
                onClick={(e) => {
                  if (subtitleTracks.length === 0) return;
                  e.stopPropagation();
                  setShowSubtitleMenu((s) => !s);
                  setShowServers(false);
                  setShowSettings(false);
                  bumpChrome();
                }}
                aria-label="Subtitles"
                title={
                  subtitleTracks.length === 0
                    ? 'Subtitles unavailable'
                    : 'Subtitles'
                }
                disabled={subtitleTracks.length === 0}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="6" y1="12" x2="18" y2="12" />
                  <line x1="6" y1="16" x2="14" y2="16" />
                </svg>
                {activeSubtitle >= 0
                  ? subtitleTracks[activeSubtitle]?.label?.slice(0, 3) ?? 'CC'
                  : 'CC'}
              </button>
              {showSubtitleMenu && (
                <div className={`${styles.menu} ${styles.menuTop}`} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.menuHeader}>Subtitles</div>
                  <div className={styles.menuBody}>
                    <button
                      type="button"
                      className={`${styles.menuItem} ${activeSubtitle === -1 ? styles.active : ''}`}
                      onClick={() => { setActiveSubtitle(-1); setShowSubtitleMenu(false); }}
                    >
                      <span>Off</span>
                      {activeSubtitle === -1 && <IconCheck />}
                    </button>
                    {subtitleTracks.map((track, i) => (
                      <button
                        key={`${track.language}-${i}`}
                        type="button"
                        className={`${styles.menuItem} ${i === activeSubtitle ? styles.active : ''}`}
                        onClick={() => { setActiveSubtitle(i); setShowSubtitleMenu(false); }}
                      >
                        <span>{track.label}</span>
                        {i === activeSubtitle && <IconCheck />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {isReady && sources.length > 0 && (
            <div className={styles.menuAnchor}>
              <button
                type="button"
                className={`${styles.pill} ${showServers ? styles.active : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowServers((s) => !s);
                  setShowSettings(false);
                  bumpChrome();
                }}
              >
                <IconServers size={16} />
                {sources[sourceIndex]?.quality ||
                  sources[sourceIndex]?.title ||
                  provider ||
                  'Source'}
              </button>
              {showServers && (
                <div className={`${styles.menu} ${styles.menuTop}`} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.menuHeader}>Choose a source</div>
                  <div className={styles.menuBody}>
                    {sources.map((s, i) => (
                      <button
                        key={`${s.url}-${i}`}
                        type="button"
                        className={`${styles.menuItem} ${i === sourceIndex ? styles.active : ''}`}
                        onClick={() => switchSource(i)}
                      >
                        <span>
                          {s.quality || s.title || `Source ${i + 1}`}
                          {s.provider ? (
                            <span className={styles.menuItemMeta}> · {s.provider}</span>
                          ) : null}
                        </span>
                        {i === sourceIndex && <IconCheck />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loading / error overlays on top of the same shell */}
      {isLoading && (
        <div className={styles.overlay}>
          <div className={styles.spinner} />
          <h2 className={styles.overlayTitle}>Finding the best stream…</h2>
          <p className={styles.overlayText}>
            {title ? `Loading “${title}”` : 'Searching providers for a working source'}
          </p>
          {onBack && (
            <button type="button" className={styles.ghostBtn} onClick={onBack}>
              Cancel
            </button>
          )}
        </div>
      )}

      {isError && (
        <div className={styles.overlay}>
          <div className={styles.errorIcon}>
            <IconAlert size={52} />
          </div>
          <h2 className={styles.overlayTitle}>Couldn&apos;t play this</h2>
          <p className={styles.overlayText}>{errorMsg || 'Something went wrong.'}</p>
          <div className={styles.overlayActions}>
            <button type="button" className={styles.primaryBtn} onClick={fetchSources}>
              Try again
            </button>
            {onBack && (
              <button type="button" className={styles.ghostBtn} onClick={onBack}>
                Go back
              </button>
            )}
          </div>
        </div>
      )}

      {/* Skip intro/outro */}
      {skipVisible && (
        <button type="button" className={styles.skipBtn} onClick={handleSkip}>
          Skip {skipVisible === 'intro' ? 'intro' : 'outro'}
        </button>
      )}

      {/* Next episode */}
      {showNext && nextEpisode && onNextEpisode && !skipVisible && (
        <div className={styles.nextCard} onClick={(e) => e.stopPropagation()}>
          <div className={styles.nextCardHeader}>
            <span className={styles.nextCardLabel}>
              {nextEpisode.isNextSeason ? 'Next season' : 'Up next'}
            </span>
            <button
              type="button"
              className={styles.nextCardDismiss}
              aria-label="Dismiss"
              onClick={() => {
                setShowNext(false);
                setDismissedNext(true);
                setCountdown(null);
              }}
            >
              ×
            </button>
          </div>
          <p className={styles.nextCardTitle}>
            {nextEpisode.title ||
              `S${nextEpisode.season} E${nextEpisode.episode}`}
          </p>
          <div className={styles.nextCardActions}>
            <button type="button" className={styles.nextPrimary} onClick={onNextEpisode}>
              Play next
              {countdown != null && (
                <span className={styles.nextCountdown}>({countdown})</span>
              )}
              <IconNextEpisode size={18} />
            </button>
          </div>
        </div>
      )}

      {showKbdHint && !showHelp && (
        <div className={styles.kbdHint}>
          <span><kbd>Space</kbd> Play</span>
          <span><kbd>←</kbd><kbd>→</kbd> ±10s · <kbd>Shift</kbd>+arrows ±30s</span>
          <span><kbd>↑</kbd><kbd>↓</kbd> Volume</span>
          <span><kbd>0</kbd>–<kbd>9</kbd> Jump</span>
          <span><kbd>F</kbd> Fullscreen</span>
        </div>
      )}

      {/* Casting UI */}
      {isCastOverlayVisible && (cast.isCasting || cast.isConnected) && (
        <CastOverlay
          title={title || 'Now playing'}
          subtitle={
            mediaType === 'tv' && season != null && episode != null
              ? `Season ${season} · Episode ${episode}`
              : cast.deviceName || undefined
          }
          deviceName={cast.deviceName}
          currentTime={cast.currentTime || currentTime}
          duration={cast.duration || duration}
          isPlaying={cast.playerState === 'PLAYING'}
          onPlayPause={cast.playOrPause}
          onSeek={cast.seek}
          onStop={() => {
            cast.disconnect();
            setIsCastOverlayVisible(false);
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
          markPlayerHelpSeen();
          setShowHelp(false);
          bumpChrome();
        }}
        platform="desktop"
      />

      {/* Bottom controls — only when stream is ready */}
      {isReady && (
      <div className={styles.controls} onClick={(e) => e.stopPropagation()}>
        <div
          className={`${styles.progressWrap} ${isDraggingProgress ? styles.dragging : ''}`}
          onPointerDown={onProgressPointerDown}
          onPointerMove={onProgressPointerMove}
          onPointerUp={onProgressPointerUp}
          onPointerCancel={onProgressPointerUp}
          onPointerLeave={() => {
            if (!isDraggingProgress) setHoverTime(null);
          }}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={currentTime}
        >
          <div className={styles.progressTrack}>
            <div className={styles.progressBuffered} style={{ width: `${buffered}%` }} />
            <div className={styles.progressFilled} style={{ width: `${progressPct}%` }} />
            <div className={styles.progressThumb} style={{ left: `${progressPct}%` }} />
          </div>
          {hoverTime != null && (
            <div className={styles.progressTooltip} style={{ left: `${hoverPct}%` }}>
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        <div className={styles.controlsRow}>
          <div className={styles.leftControls}>
            <button
              type="button"
              className={`${styles.btn} ${styles.playBtn}`}
              onClick={togglePlay}
              data-tip={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <IconPause size={22} /> : <IconPlay size={22} />}
            </button>

            <button
              type="button"
              className={styles.btn}
              onClick={() => seekBy(-10)}
              data-tip="Back 10s"
              aria-label="Rewind 10 seconds"
            >
              <IconRewind10 size={22} />
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={() => seekBy(10)}
              data-tip="Forward 10s"
              aria-label="Forward 10 seconds"
            >
              <IconForward10 size={22} />
            </button>

            <div className={styles.volumeCluster}>
              <button
                type="button"
                className={styles.btn}
                onClick={toggleMute}
                data-tip={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <IconVolumeMute /> : <IconVolume />}
              </button>
              <div className={styles.volumeSlider}>
                <input
                  type="range"
                  className={styles.volumeRange}
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  style={{ ['--vol' as string]: `${(isMuted ? 0 : volume) * 100}%` }}
                  onChange={(e) => changeVolume(parseFloat(e.target.value))}
                  aria-label="Volume"
                />
              </div>
            </div>

            <div className={styles.time}>
              {formatTime(currentTime)}
              <span className={styles.timeSep}>/</span>
              {formatTime(duration)}
            </div>
          </div>

          <div className={styles.rightControls}>
            {nextEpisode && onNextEpisode && (
              <button
                type="button"
                className={styles.btn}
                onClick={onNextEpisode}
                data-tip="Next episode (N)"
                aria-label="Next episode"
              >
                <IconNextEpisode />
              </button>
            )}

            <div className={styles.menuAnchor}>
              <button
                type="button"
                className={`${styles.btn} ${showSettings ? styles.active : ''}`}
                onClick={() => {
                  setShowSettings((s) => !s);
                  setShowServers(false);
                  bumpChrome();
                }}
                data-tip="Settings"
                aria-label="Settings"
              >
                <IconSettings />
              </button>
              {showSettings && (
                <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.menuHeader}>Playback</div>
                  <div className={styles.menuBody}>
                    <div className={styles.menuSection}>
                      <div className={styles.menuSectionLabel}>Speed</div>
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`${styles.menuItem} ${speed === s ? styles.active : ''}`}
                          onClick={() => changeSpeed(s)}
                        >
                          <span>{s === 1 ? 'Normal' : `${s}×`}</span>
                          {speed === s && <IconCheck />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <CastButton
              isCasting={cast.isCasting}
              isConnected={cast.isConnected}
              onClick={() => {
                void handleCastClick();
              }}
            />

            <button
              type="button"
              className={`${styles.btn} ${showHelp ? styles.active : ''}`}
              onClick={() => {
                setShowHelp(true);
                bumpChrome();
              }}
              data-tip="Controls help"
              aria-label="How to use the player"
            >
              <IconHelp />
            </button>

            {pipSupported && (
              <button
                type="button"
                className={styles.btn}
                onClick={togglePiP}
                data-tip="Picture in picture"
                aria-label="Picture in picture"
              >
                <IconPictureInPicture />
              </button>
            )}

            <button
              type="button"
              className={styles.btn}
              onClick={toggleFullscreen}
              data-tip={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <IconFullscreenExit /> : <IconFullscreen />}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
