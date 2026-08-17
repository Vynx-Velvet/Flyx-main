'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Hls from 'hls.js';
import styles from './MobileVideoPlayer.module.css';
import { formatTime, normalizeSkip } from './stream-proxy';
import {
  IconBack,
  IconCheck,
  IconForward10,
  IconFullscreen,
  IconFullscreenExit,
  IconNextEpisode,
  IconPause,
  IconPlay,
  IconRewind10,
  IconServers,
  IconSettings,
  IconVolume,
  IconVolumeMute,
} from './icons';
import { useCast } from '@/hooks/useCast';
import { useMediaSession } from '@/hooks/useMediaSession';
import PlayerHelpModal, {
  shouldAutoShowPlayerHelp,
  markPlayerHelpSeen,
  detectHelpPlatform,
} from './PlayerHelpModal';
import { CastButton, CastOverlay, CastErrorBanner, IconHelp, IconCast } from './CastUI';

export interface MobileVideoPlayerProps {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title?: string;
  streamUrl: string;
  onBack?: () => void;
  onError?: (err: string) => void;
  onSourceChange?: (index: number, currentTime: number) => void;
  availableSources?: Array<{
    title: string;
    url: string;
    quality?: string;
    provider?: string;
  }>;
  currentSourceIndex?: number;
  nextEpisode?: {
    season: number;
    episode: number;
    title?: string;
    isNextSeason?: boolean;
  } | null;
  onNextEpisode?: () => void;
  isAnime?: boolean;
  audioPref?: 'sub' | 'dub';
  onAudioPrefChange?: (pref: 'sub' | 'dub', currentTime: number) => void;
  initialTime?: number;
  currentProvider?: string;
  availableProviders?: string[];
  // Accept broad string so parent can pass narrower union handlers (TS contravariance)
  onProviderChange?: (provider: any, currentTime: number) => void;
  loadingProvider?: boolean;
  skipIntro?: [number, number];
  skipOutro?: [number, number];
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const HIDE_MS = 3200;

export default function MobileVideoPlayer({
  title,
  streamUrl,
  onBack,
  onError,
  onSourceChange,
  availableSources,
  currentSourceIndex = 0,
  nextEpisode,
  onNextEpisode,
  isAnime,
  audioPref,
  onAudioPrefChange,
  initialTime = 0,
  currentProvider,
  availableProviders,
  onProviderChange,
  loadingProvider,
  skipIntro,
  skipOutro,
  mediaType,
  season,
  episode,
}: MobileVideoPlayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const dragSeek = useRef(false);
  const appliedInitial = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showChrome, setShowChrome] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [sheet, setSheet] = useState<'none' | 'sources' | 'settings'>('none');
  const [seekFlash, setSeekFlash] = useState<'left' | 'right' | null>(null);
  const [skipKind, setSkipKind] = useState<'intro' | 'outro' | null>(null);
  const [showNext, setShowNext] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [castErrorDismissed, setCastErrorDismissed] = useState(false);
  const [isCastOverlayVisible, setIsCastOverlayVisible] = useState(false);

  const cast = useCast({
    videoRef,
    streamUrl,
    mediaKey: streamUrl || null,
    onConnect: () => {
      setIsCastOverlayVisible(true);
      setCastErrorDismissed(false);
      try {
        videoRef.current?.pause();
      } catch {
        /* ignore */
      }
    },
    onDisconnect: () => setIsCastOverlayVisible(false),
    onError: () => setCastErrorDismissed(false),
  });

  // Publish now-playing metadata to the system media session (Windows SMTC,
  // read by VRChat companions like MagicChatbox) and the window title.
  useMediaSession({ mediaType, title, season, episode, isAnime, videoRef });

  const handleCastClick = useCallback(async () => {
    if (cast.isCasting || cast.isConnected) {
      cast.disconnect();
      setIsCastOverlayVisible(false);
      return;
    }
    const connected = await cast.requestSession();
    if (!connected) return;
    if (!streamUrl) return;
    const epLabel =
      mediaType === 'tv' && season != null && episode != null
        ? `S${season} E${episode}`
        : undefined;
    const ok = await cast.loadMedia({
      url: streamUrl,
      title: title || 'Flyx',
      subtitle: epLabel,
      contentType: streamUrl.includes('.m3u8')
        ? 'application/x-mpegURL'
        : 'video/mp4',
      startTime: videoRef.current?.currentTime || 0,
    });
    if (ok) setIsCastOverlayVisible(true);
  }, [cast, streamUrl, mediaType, season, episode, title]);

  // First-open controls guide
  useEffect(() => {
    if (loadError) return;
    if (!shouldAutoShowPlayerHelp()) return;
    const t = setTimeout(() => setShowHelp(true), 500);
    return () => clearTimeout(t);
  }, [loadError, streamUrl]);

  const bump = useCallback(() => {
    setShowChrome(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (isPlaying && sheet === 'none' && !showHelp) {
      hideTimer.current = setTimeout(() => setShowChrome(false), HIDE_MS);
    }
  }, [isPlaying, sheet, showHelp]);

  useEffect(() => {
    bump();
  }, [isPlaying, bump]);

  // HLS load
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    setLoadError(null);
    setIsBuffering(true);
    appliedInitial.current = false;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = streamUrl.includes('.m3u8');

    const tryPlay = () => {
      if (initialTime > 0 && !appliedInitial.current && video.duration) {
        video.currentTime = Math.min(initialTime, video.duration - 1);
        appliedInitial.current = true;
      }
      video.play().catch(() => setIsPlaying(false));
    };

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 24,
        fragLoadingMaxRetry: 5,
      });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video as unknown as HTMLMediaElement);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        tryPlay();
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          const msg = 'Playback failed — try another source';
          setLoadError(msg);
          onError?.(msg);
        }
      });
    } else {
      video.src = streamUrl;
      const onMeta = () => {
        setIsBuffering(false);
        tryPlay();
      };
      video.addEventListener('loadedmetadata', onMeta, { once: true });
      video.addEventListener(
        'error',
        () => {
          const msg = 'Could not load this stream';
          setLoadError(msg);
          onError?.(msg);
        },
        { once: true },
      );
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, initialTime, onError]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

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
      const intro = normalizeSkip(skipIntro);
      const outro = normalizeSkip(skipOutro);
      const t = video.currentTime;
      if (intro && t >= intro.start && t < intro.end - 1) setSkipKind('intro');
      else if (outro && t >= outro.start && t < outro.end - 1) setSkipKind('outro');
      else setSkipKind(null);

      if (
        nextEpisode &&
        onNextEpisode &&
        video.duration > 0 &&
        video.duration - t <= 45
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
      if (nextEpisode && onNextEpisode) setShowNext(true);
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
  }, [skipIntro, skipOutro, nextEpisode, onNextEpisode]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    bump();
  }, [bump]);

  const seekBy = useCallback(
    (d: number) => {
      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration)) return;
      v.currentTime = Math.min(Math.max(0, v.currentTime + d), v.duration - 0.25);
      setSeekFlash(d < 0 ? 'left' : 'right');
      setTimeout(() => setSeekFlash(null), 500);
      bump();
    },
    [bump],
  );

  const seekTo = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v || !Number.isFinite(v.duration)) return;
      v.currentTime = Math.min(Math.max(0, t), v.duration - 0.25);
      bump();
    },
    [bump],
  );

  const toggleFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el.requestFullscreen) await el.requestFullscreen();
      // iOS video fullscreen fallback
      else if ((videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void })?.webkitEnterFullscreen) {
        (videoRef.current as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
      }
    } catch {
      /* ignore */
    }
    bump();
  }, [bump]);

  const onTapSurface = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      // double-tap handled via left/right zones conceptually — toggle play on double center
      togglePlay();
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    if (showChrome) {
      if (isPlaying) setShowChrome(false);
      else togglePlay();
    } else {
      bump();
    }
  };

  const pctFromX = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const onProgDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragSeek.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekTo(pctFromX(e.clientX, e.currentTarget) * duration);
  };
  const onProgMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragSeek.current) return;
    seekTo(pctFromX(e.clientX, e.currentTarget) * duration);
  };
  const onProgUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragSeek.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const handleSkip = () => {
    if (skipKind === 'intro') {
      const intro = normalizeSkip(skipIntro);
      if (intro) seekTo(intro.end);
    } else if (skipKind === 'outro') {
      const outro = normalizeSkip(skipOutro);
      if (outro) seekTo(outro.end);
    }
    setSkipKind(null);
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const chromeOpen =
    showChrome || !isPlaying || sheet !== 'none' || showHelp || isCastOverlayVisible;
  const episodeLabel =
    mediaType === 'tv' && season != null && episode != null
      ? `S${season} · E${episode}`
      : '';

  if (loadError) {
    return (
      <div className={styles.root} ref={rootRef}>
        <div className={styles.overlay}>
          <h2 className={styles.overlayTitle}>Playback error</h2>
          <p className={styles.overlayText}>{loadError}</p>
          {availableSources && availableSources.length > 1 && onSourceChange && (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                const next = (currentSourceIndex + 1) % availableSources.length;
                onSourceChange(next, videoRef.current?.currentTime ?? 0);
                setLoadError(null);
              }}
            >
              Try next source
            </button>
          )}
          {onBack && (
            <button type="button" className={styles.ghostBtn} onClick={onBack}>
              Go back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${chromeOpen ? styles.chromeVisible : ''}`}
    >
      <video ref={videoRef} className={styles.video} playsInline preload="auto" />

      <button type="button" className={styles.tapCatcher} aria-label="Toggle controls" onClick={onTapSurface} />

      <div className={styles.topGrad} />
      <div className={styles.botGrad} />

      {isBuffering && isPlaying && <div className={styles.buffering} />}

      {seekFlash && (
        <div className={`${styles.seekFlash} ${styles[seekFlash]}`}>
          {seekFlash === 'left' ? <IconRewind10 size={26} /> : <IconForward10 size={26} />}
          <span>10s</span>
        </div>
      )}

      {/* Top — Controls + Cast always labeled */}
      <div
        className={styles.topBar}
        style={{ opacity: 1, transform: 'none', pointerEvents: 'auto' }}
      >
        {onBack ? (
          <button type="button" className={styles.backBtn} onClick={onBack}>
            <IconBack size={18} />
            Back
          </button>
        ) : (
          <div className={styles.topSpacer} />
        )}
        <div className={styles.titleWrap}>
          <p className={styles.title}>{title || 'Now playing'}</p>
          {episodeLabel && <p className={styles.meta}>{episodeLabel}</p>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => setShowHelp(true)}
            aria-label="How to use the player"
            style={{ padding: '0 12px' }}
          >
            <IconHelp size={16} />
            Help
          </button>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => {
              void handleCastClick();
            }}
            aria-label={cast.isCasting || cast.isConnected ? 'Stop casting' : 'Cast to TV'}
            style={{
              padding: '0 12px',
              color: cast.isCasting || cast.isConnected ? '#00e5bf' : undefined,
            }}
          >
            <IconCast size={16} active={cast.isCasting || cast.isConnected} />
            Cast
          </button>
        </div>
      </div>

      {/* Center transport */}
      <div className={styles.centerStack}>
        <button type="button" className={styles.centerBtn} onClick={() => seekBy(-10)} aria-label="Rewind 10s">
          <IconRewind10 size={24} />
        </button>
        <button
          type="button"
          className={`${styles.centerBtn} ${styles.playMain}`}
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <IconPause size={28} /> : <IconPlay size={28} />}
        </button>
        <button type="button" className={styles.centerBtn} onClick={() => seekBy(10)} aria-label="Forward 10s">
          <IconForward10 size={24} />
        </button>
      </div>

      {skipKind && !showNext && (
        <button type="button" className={styles.skipBtn} onClick={handleSkip}>
          Skip {skipKind}
        </button>
      )}

      {showNext && nextEpisode && onNextEpisode && !skipKind && (
        <div className={styles.nextCard}>
          <div className={styles.nextLabel}>
            {nextEpisode.isNextSeason ? 'Next season' : 'Up next'}
          </div>
          <p className={styles.nextTitle}>
            {nextEpisode.title || `S${nextEpisode.season} E${nextEpisode.episode}`}
          </p>
          <button type="button" className={styles.nextBtn} onClick={onNextEpisode}>
            Play next episode
          </button>
        </div>
      )}

      {/* Bottom */}
      <div className={styles.bottom}>
        <div
          className={styles.progress}
          onPointerDown={onProgDown}
          onPointerMove={onProgMove}
          onPointerUp={onProgUp}
          role="slider"
          aria-label="Seek"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration || 0}
        >
          <div className={styles.track}>
            <div className={styles.buffered} style={{ width: `${buffered}%` }} />
            <div className={styles.filled} style={{ width: `${progressPct}%` }} />
            <div className={styles.thumb} style={{ left: `${progressPct}%` }} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.time}>
            {formatTime(currentTime)}
            <span className={styles.timeSep}>/</span>
            {formatTime(duration)}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setIsMuted((m) => !m)}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <IconVolumeMute size={20} /> : <IconVolume size={20} />}
            </button>

            {(availableSources && availableSources.length > 1) ||
            (availableProviders && availableProviders.length > 1) ? (
              <button
                type="button"
                className={`${styles.iconBtn} ${sheet === 'sources' ? styles.active : ''}`}
                onClick={() => setSheet(sheet === 'sources' ? 'none' : 'sources')}
                aria-label="Sources"
              >
                <IconServers size={20} />
              </button>
            ) : null}

            <button
              type="button"
              className={`${styles.iconBtn} ${sheet === 'settings' ? styles.active : ''}`}
              onClick={() => setSheet(sheet === 'settings' ? 'none' : 'settings')}
              aria-label="Settings"
            >
              <IconSettings size={20} />
            </button>

            <CastButton
              isCasting={cast.isCasting}
              isConnected={cast.isConnected}
              onClick={() => {
                void handleCastClick();
              }}
              className={styles.iconBtn}
            />

            <button
              type="button"
              className={`${styles.iconBtn} ${showHelp ? styles.active : ''}`}
              onClick={() => setShowHelp(true)}
              aria-label="How to use the player"
            >
              <IconHelp size={20} />
            </button>

            {nextEpisode && onNextEpisode && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={onNextEpisode}
                aria-label="Next episode"
              >
                <IconNextEpisode size={20} />
              </button>
            )}

            <button
              type="button"
              className={styles.iconBtn}
              onClick={toggleFullscreen}
              aria-label="Fullscreen"
            >
              {isFullscreen ? <IconFullscreenExit size={20} /> : <IconFullscreen size={20} />}
            </button>
          </div>
        </div>
      </div>

      {isCastOverlayVisible && (cast.isCasting || cast.isConnected) && (
        <CastOverlay
          title={title || 'Now playing'}
          subtitle={
            mediaType === 'tv' && season != null && episode != null
              ? `S${season} · E${episode}`
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
          bump();
        }}
        platform={detectHelpPlatform()}
      />

      {/* Sheets */}
      {sheet !== 'none' && (
        <>
          <button
            type="button"
            className={styles.sheetBackdrop}
            aria-label="Close menu"
            onClick={() => setSheet('none')}
          />
          <div className={styles.sheet}>
            <div className={styles.sheetHandle} />
            {sheet === 'sources' && (
              <>
                <h3 className={styles.sheetTitle}>Sources</h3>
                {isAnime && onAudioPrefChange && (
                  <div className={styles.chipRow}>
                    {(['sub', 'dub'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`${styles.chip} ${audioPref === p ? styles.active : ''}`}
                        onClick={() =>
                          onAudioPrefChange(p, videoRef.current?.currentTime ?? 0)
                        }
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
                {availableProviders && availableProviders.length > 1 && onProviderChange && (
                  <div className={styles.chipRow}>
                    {availableProviders.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`${styles.chip} ${currentProvider === p ? styles.active : ''}`}
                        disabled={loadingProvider}
                        onClick={() =>
                          onProviderChange(p, videoRef.current?.currentTime ?? 0)
                        }
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
                <div className={styles.sheetList}>
                  {(availableSources || []).map((s, i) => (
                    <button
                      key={`${s.url}-${i}`}
                      type="button"
                      className={`${styles.sheetItem} ${i === currentSourceIndex ? styles.active : ''}`}
                      onClick={() => {
                        onSourceChange?.(i, videoRef.current?.currentTime ?? 0);
                        setSheet('none');
                      }}
                    >
                      <span>{s.quality || s.title || `Source ${i + 1}`}</span>
                      {i === currentSourceIndex && <IconCheck />}
                    </button>
                  ))}
                </div>
              </>
            )}
            {sheet === 'settings' && (
              <>
                <h3 className={styles.sheetTitle}>Playback speed</h3>
                <div className={styles.sheetList}>
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`${styles.sheetItem} ${speed === s ? styles.active : ''}`}
                      onClick={() => {
                        setSpeed(s);
                        setSheet('none');
                      }}
                    >
                      <span>{s === 1 ? 'Normal' : `${s}×`}</span>
                      {speed === s && <IconCheck />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
