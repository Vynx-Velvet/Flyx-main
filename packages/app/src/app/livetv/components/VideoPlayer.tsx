/**
 * Live TV Video Player
 *
 * Native HLS.js player for DLHD, CDN Live, and VIPRow streams.
 * NO EMBEDS - direct m3u8 playback with full controls.
 * Includes channel selector for events with multiple channels.
 */

'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { LiveEvent, TVChannel } from '../hooks/useLiveTVData';
import { getTvPlaylistUrl, getAvailableBackends } from '@/app/lib/proxy-config';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  event: LiveEvent | null;
  channel: TVChannel | null;
  isOpen: boolean;
  onClose: () => void;
}

export function VideoPlayer({ event, channel, isOpen, onClose }: VideoPlayerProps) {
  // Listen for Flyx Bypass m3u8 interception messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data && typeof e.data === 'object' && e.data.url && typeof e.data.url === 'string') {
                if (e.data.url.includes('.m3u8') || e.data.url.includes('.mpd')) {
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [qualities, setQualities] = useState<Array<{ height: number; index: number }>>([]);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showChannelMenu, setShowChannelMenu] = useState(false);
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null);
  const destroyingRef = useRef(false); // guards against cascading callbacks during teardown
  const recoveryRef = useRef(false); // tracks if auto-recovery is in progress
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Mirror refs for state read from inside long-lived callbacks (the loading
  // timeout, the stall detector, etc). Reading state from those closures
  // captures the value at the time the callback was registered, so a stale
  // `true` would trigger spurious reloads after the manifest had parsed.
  const isLoadingRef = useRef(true);
  const errorRef = useRef<string | null>(null);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlaybackTimeRef = useRef(0);
  const stallCountRef = useRef(0);
  // Backend switching state — `availableBackends` is the list of upstream
  // CDN backends the server exposes for this channel; `selectedBackend`
  // round-trips to the stream URL and is used by the proxy when picking
  // which CDN to fetch the M3U8 from.
  const [availableBackends, setAvailableBackends] = useState<Array<{
    id: string;
    isPrimary: boolean;
    label: string;
    status?: 'online' | 'offline' | 'timeout' | 'unknown';
  }>>([]);
  const [selectedBackend, setSelectedBackend] = useState<string | undefined>(undefined);
  const [showBackendMenu, setShowBackendMenu] = useState(false);
  const [loadingBackends, setLoadingBackends] = useState(false);

  // Get current channel from event
  const currentEventChannel = event?.channels?.[selectedChannelIndex];

  // Get stream URL — routes to correct provider extractor
  const getStreamUrl = useCallback((): string | null => {
    // Channel playback
    if (channel) {
      return getTvPlaylistUrl(channel.channelId, channel.source, selectedBackend);
    }

    // Event playback — use selected channel from event
    if (event) {
      if (event.channels.length > 0) {
        const ch = event.channels[selectedChannelIndex] || event.channels[0];
        return getTvPlaylistUrl(ch.channelId, event.source, selectedBackend);
      }
    }

    return null;
  }, [event, channel, selectedChannelIndex, selectedBackend]);

  // Ref to hold initPlayer for use in attemptFullReload (avoids circular deps)
  const initPlayerRef = useRef<() => void>(() => {});

  // Attempt full stream reload (destroy + re-init) as last-resort recovery
  const attemptFullReload = useCallback(() => {
    if (destroyingRef.current || recoveryRef.current) return; // tearing down or already recovering
    recoveryRef.current = true;
    setRecoveryStatus('Reloading stream...');

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (stallTimerRef.current) {
      clearInterval(stallTimerRef.current);
      stallTimerRef.current = null;
    }

    // Small delay then re-init
    setTimeout(() => {
      recoveryRef.current = false;
      setRecoveryStatus(null);
      stallCountRef.current = 0;
      initPlayerRef.current();
    }, 1500);
  }, []);

  // Load HLS stream
  const loadHlsStream = useCallback((video: HTMLVideoElement, url: string) => {
    stallCountRef.current = 0;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        // Buffering — generous for live
        backBufferLength: 60,
        maxBufferLength: 45,
        maxMaxBufferLength: 90,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        // Live sync
        liveSyncDurationCount: 4,
        liveMaxLatencyDurationCount: 12,
        liveDurationInfinity: true,
        // Very aggressive retries — never give up easily
        manifestLoadingMaxRetry: 20,
        manifestLoadingRetryDelay: 800,
        manifestLoadingMaxRetryTimeout: 60000,
        levelLoadingMaxRetry: 20,
        levelLoadingRetryDelay: 800,
        levelLoadingMaxRetryTimeout: 60000,
        fragLoadingMaxRetry: 30,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 60000,
        // ABR
        abrEwmaDefaultEstimate: 1000000,
        abrBandWidthFactor: 0.7,
        abrBandWidthUpFactor: 0.5,
        abrMaxWithRealBitrate: true,
        // Stall recovery
        nudgeOffset: 0.2,
        nudgeMaxRetry: 10,
        xhrSetup: (xhr) => {
          xhr.timeout = 30000;
        },
      });

      hls.loadSource(url);
      hls.attachMedia(video as unknown as HTMLMediaElement);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels = data.levels.map((level, index) => ({
          height: level.height,
          index,
        })).filter(l => l.height > 0);

        setQualities(levels);
        setIsLoading(false);
        isLoadingRef.current = false;
        setRecoveryStatus(null);
        // Stream loaded successfully — cancel the "slow to load" auto-recovery
        // timer. Without this, the timer would close over a stale `true` and
        // force a full reload every ~25s on healthy live playback, which the
        // user sees as periodic buffering.
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
        video.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentQuality(data.level);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (destroyingRef.current) return; // teardown in progress — ignore
        console.error('[VideoPlayer] HLS Error:', data.type, data.details, data.fatal);

        // Non-fatal: buffer stall — nudge forward
        if (data.details === 'bufferStalledError') {
          stallCountRef.current++;
      if (video.currentTime > 0 && !video.paused) {
            // Nudge forward to skip the gap
            video.currentTime = video.currentTime + 0.3;
          }

          // If we've stalled too many times, do a full reload
          if (stallCountRef.current >= 8) {
            console.warn('[VideoPlayer] Too many stalls, full reload');
            attemptFullReload();
          }
          return;
        }

        if (data.fatal) {
          // NETWORK errors — always try to recover, never give up
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setRetryCount(prev => {
              const next = prev + 1;

              if (next <= 15) {
                // Phase 1: hls.startLoad with backoff (attempts 1-15)
                setRecoveryStatus(`Reconnecting... (${next})`);
                const delay = Math.min(500 * Math.pow(1.5, Math.min(next, 8)), 8000);
                setTimeout(() => {
                  if (hlsRef.current) {
                    hlsRef.current.startLoad();
                  }
                }, delay);
              } else {
                // Phase 2: full stream reload
                console.warn('[VideoPlayer] Network retries exhausted, full reload');
                attemptFullReload();
              }
              return next;
            });
            return;
          }

          // MEDIA errors — recoverMediaError, then swap codec, then full reload
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            setRetryCount(prev => {
              const next = prev + 1;

              if (next <= 2) {
                setRecoveryStatus('Recovering media...');
                hls.recoverMediaError();
              } else if (next <= 4) {
                setRecoveryStatus('Switching codec...');
                hls.swapAudioCodec();
                hls.recoverMediaError();
              } else {
                console.warn('[VideoPlayer] Media recovery exhausted, full reload');
                attemptFullReload();
              }
              return next;
            });
            return;
          }

          // Other fatal errors — full reload instead of giving up
          console.warn('[VideoPlayer] Unknown fatal error, attempting full reload');
          attemptFullReload();
        }
      });

      // Monitor buffer health — reset counters on success
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (retryCount > 0) setRetryCount(0);
        if (recoveryStatus) setRecoveryStatus(null);
        stallCountRef.current = 0;
      });

      // Playback stall detector — catches cases HLS.js doesn't report
      const startStallDetector = () => {
        if (stallTimerRef.current) clearInterval(stallTimerRef.current);
        stallTimerRef.current = setInterval(() => {
          if (!video || video.paused || video.ended) return;

          const currentTime = video.currentTime;
          if (currentTime === lastPlaybackTimeRef.current && currentTime > 0) {
            // Playback hasn't advanced — we're stalled
            stallCountRef.current++;

            if (stallCountRef.current >= 3 && stallCountRef.current < 6) {
              // Try nudging forward
              setRecoveryStatus('Recovering...');
              video.currentTime = currentTime + 0.5;
              if (hlsRef.current) hlsRef.current.startLoad();
            } else if (stallCountRef.current >= 6) {
              // Full reload
              console.warn('[VideoPlayer] Persistent stall, full reload');
              attemptFullReload();
            }
          } else {
            // Playback is advancing — reset stall counter
            if (stallCountRef.current > 0) stallCountRef.current = 0;
            if (recoveryStatus) setRecoveryStatus(null);
          }
          lastPlaybackTimeRef.current = currentTime;
        }, 3000);
      };

      video.addEventListener('playing', startStallDetector);

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        isLoadingRef.current = false;
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
        // Even native HLS — try reload instead of giving up
        console.warn('[VideoPlayer] Native HLS error, retrying...');
        setTimeout(() => {
          video.src = url;
          video.load();
          video.play().catch(() => {});
        }, 2000);
      });
    } else {
      const msg = 'HLS not supported in this browser';
      setError(msg);
      errorRef.current = msg;
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [retryCount, attemptFullReload, recoveryStatus]);

  // Initialize player
  const initPlayer = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    // Re-arm — we're no longer tearing down
    destroyingRef.current = false;

    // Clear any previous stall detector
    if (stallTimerRef.current) {
      clearInterval(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    isLoadingRef.current = true;
    errorRef.current = null;
    setRecoveryStatus(null);
    recoveryRef.current = false;
    lastPlaybackTimeRef.current = 0;
    stallCountRef.current = 0;

    const streamUrl = getStreamUrl();

    if (!streamUrl) {
      setError('No stream URL available - channel may not be configured');
      errorRef.current = 'No stream URL available - channel may not be configured';
      setIsLoading(false);
      isLoadingRef.current = false;
      return;
    }

    // Handle API endpoints that return JSON (e.g., stream resolution APIs)
    if (streamUrl.includes('/api/livetv/')) {
      try {
        const response = await fetch(streamUrl);
        const data = await response.json();
        if (data.streamUrl) {
          loadHlsStream(video, data.streamUrl);
        } else {
          const msg = data.error || 'Failed to get stream from API';
          setError(msg);
          errorRef.current = msg;
          setIsLoading(false);
          isLoadingRef.current = false;
        }
      } catch (err) {
        console.error('[VideoPlayer] API fetch error:', err);
        const msg = 'Failed to fetch stream - network error';
        setError(msg);
        errorRef.current = msg;
        setIsLoading(false);
        isLoadingRef.current = false;
      }
      return;
    }

    // HLS keys are baked into the playlist by the CDN (no key whitelist
    // needed in the browser).

    loadHlsStream(video, streamUrl);

    // Loading timeout — instead of killing the stream, attempt a full reload
    // when the manifest never arrives. The condition reads refs (not stale
    // closure state) so it correctly observes updates from MANIFEST_PARSED.
    loadingTimeoutRef.current = setTimeout(() => {
      if (isLoadingRef.current && !errorRef.current && !recoveryRef.current) {
        console.warn('[VideoPlayer] Loading timeout — attempting auto-recovery');
        setRecoveryStatus('Stream slow to load, retrying...');
        attemptFullReload();
      }
    }, 25000);

    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
    // We intentionally do not depend on isLoading/error — those are tracked
    // via isLoadingRef/errorRef to avoid restarting the player on every state
    // update. Adding them here used to cause double-init / cancel races.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getStreamUrl, loadHlsStream, attemptFullReload, channel, event, selectedChannelIndex]);

  // Keep ref in sync so attemptFullReload can call initPlayer without circular deps
  useEffect(() => { initPlayerRef.current = initPlayer; }, [initPlayer]);

  // Switch channel
  const switchChannel = useCallback((index: number) => {
    setSelectedChannelIndex(index);
    setShowChannelMenu(false);
    setRetryCount(0);
    setRecoveryStatus(null);
    setSelectedBackend(undefined); // Reset backend when switching channels
    setAvailableBackends([]);
    stallCountRef.current = 0;
  }, []);

  // Fetch available backends for current channel
  const fetchBackends = useCallback(async () => {
    const channelId = channel?.channelId || event?.channels?.[selectedChannelIndex]?.channelId;
    if (!channelId) return;

    setLoadingBackends(true);
    try {
      const backends = await getAvailableBackends(channelId);
      setAvailableBackends(backends);
    } catch (e) {
      console.error('[VideoPlayer] Failed to fetch backends:', e);
    } finally {
      setLoadingBackends(false);
    }
  }, [channel, event, selectedChannelIndex]);

  // Switch backend — the backend ID is sent as `backend` on the stream URL
  // and the server uses it (or falls back to the default origin) when
  // picking which upstream CDN to fetch the M3U8 from.
  const switchBackend = useCallback((backendId: string) => {
    if (!backendId) {
      console.error('[VideoPlayer] Empty backend ID');
      return;
    }
    setSelectedBackend(backendId);
    setShowBackendMenu(false);
    setError(null);
    errorRef.current = null;
    setRetryCount(0);
    setRecoveryStatus(null);
    stallCountRef.current = 0;
  }, []);

  // Single mount/unmount effect for the player. The previous version had two
  // overlapping effects — one keyed on isOpen/event/channel and another on
  // selectedChannelIndex/selectedBackend — that both called initPlayer(),
  // causing the player to double-init on first open and tear itself down
  // before MANIFEST_PARSED fired (the user saw an infinite spinner).
  useEffect(() => {
    if (!isOpen || (!event && !channel)) return;

    setSelectedChannelIndex(0);
    setRetryCount(0);
    setRecoveryStatus(null);
    stallCountRef.current = 0;
    setSelectedBackend(undefined); // Reset backend when opening new channel
    setAvailableBackends([]); // Clear cached backends
    initPlayer();

    return () => {
      // Set destroying flag FIRST — prevents ERROR/FRAG_BUFFERED
      // callbacks from triggering attemptFullReload → initPlayer
      // during hls.destroy(), which would crash the error boundary.
      destroyingRef.current = true;
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch {}
        hlsRef.current = null;
      }
      if (stallTimerRef.current) {
        clearInterval(stallTimerRef.current);
        stallTimerRef.current = null;
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [isOpen, event, channel, selectedChannelIndex, selectedBackend]);

  // Video event handlers - sync play/pause/volume state with video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Sync initial state
    setIsPlaying(!video.paused);
    setVolume(video.volume);
    setIsMuted(video.muted);

    const onPlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };
    const onPause = () => {
      setIsPlaying(false);
    };
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };
    const onCanPlay = () => setIsLoading(false);
    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('volumechange', onVolumeChange);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('volumechange', onVolumeChange);
    };
  }, [isOpen]);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showQualityMenu && !showChannelMenu && !showBackendMenu) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, showQualityMenu, showChannelMenu, showBackendMenu]);

  // Hide controls when menus close
  useEffect(() => {
    if (!showQualityMenu && !showChannelMenu && !showBackendMenu && isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2000);
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [showQualityMenu, showChannelMenu, showBackendMenu, isPlaying]);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          video.muted = !video.muted;
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case 'Escape':
          isFullscreen ? document.exitFullscreen?.() : onClose();
          break;
      }
      showControlsTemporarily();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, onClose, showControlsTemporarily]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    document.fullscreenElement ? document.exitFullscreen?.() : container.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    setVolume(val);
    if (val > 0) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const selectQuality = (index: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
      setCurrentQuality(index);
    }
    setShowQualityMenu(false);
  };

  const getTitle = () => {
    if (channel) return channel.name;
    if (event) {
      const ch = event.channels[selectedChannelIndex];
      return ch ? `${event.title} • ${ch.name}` : event.title;
    }
    return 'Live TV';
  };

  if (!isOpen) return null;

  const hasMultipleChannels = event && event.channels.length > 1;

  return (
    <div className={styles.playerOverlay}>
      <div
        ref={containerRef}
        className={styles.playerContainer}
        onMouseMove={showControlsTemporarily}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        onClick={(e) => e.target === e.currentTarget && togglePlay()}
      >
        <video
          ref={videoRef}
          className={styles.video}
          playsInline
          onClick={togglePlay}
        />

        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p>{recoveryStatus || 'Loading stream...'}</p>
          </div>
        )}

        {!isLoading && recoveryStatus && !error && (
          <div className={styles.loadingOverlay} style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className={styles.spinner} />
            <p>{recoveryStatus}</p>
          </div>
        )}

        {error && (
          <div className={styles.errorOverlay}>
            <div className={styles.errorIcon}>⚠️</div>
            <p className={styles.errorMessage}>{error}</p>
            <div className={styles.errorActions}>
              <button onClick={() => { setRetryCount(0); initPlayer(); }} className={styles.retryButton}>
                Retry
              </button>
              <button
                onClick={() => {
                  if (availableBackends.length === 0) fetchBackends();
                  setShowBackendMenu(!showBackendMenu);
                }}
                className={styles.switchBackendButton}
              >
                {loadingBackends ? 'Loading...' : 'Switch Server'}
              </button>
            </div>

            {showBackendMenu && availableBackends.length > 0 && (
              <div className={styles.backendMenu}>
                <p className={styles.backendMenuTitle}>Select a different server:</p>
                {availableBackends.map((backend) => (
                  <button
                    key={backend.id}
                    onClick={() => switchBackend(backend.id)}
                    className={`${styles.backendOption} ${selectedBackend === backend.id ? styles.active : ''} ${backend.isPrimary ? styles.primary : ''}`}
                  >
                    {backend.label}
                    {backend.status === 'online' && <span className={styles.statusOnline}>●</span>}
                    {backend.status === 'offline' && <span className={styles.statusOffline}>●</span>}
                    {backend.status === 'timeout' && <span className={styles.statusTimeout}>●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={`${styles.controls} ${showControls ? styles.visible : ''}`}>
          <div className={styles.topBar}>
            <button onClick={onClose} className={styles.closeButton}>✕</button>
            <div className={styles.titleSection}>
              <h2 className={styles.title}>{getTitle()}</h2>
              {event?.isLive && (
                <span className={styles.liveBadge}>
                  <span className={styles.liveDot} />
                  LIVE
                </span>
              )}
            </div>
          </div>

          <div className={styles.bottomBar}>
            <button onClick={togglePlay} className={styles.controlButton}>
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <div className={styles.volumeControl}>
              <button
                onClick={() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }}
                className={styles.controlButton}
              >
                {isMuted || volume === 0 ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className={styles.volumeSlider}
                style={{ '--volume-percent': `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
              />
            </div>

            <div className={styles.spacer} />

            {/* Channel Selector */}
            {hasMultipleChannels && (
              <div className={styles.channelSelector}>
                <button
                  onClick={() => { setShowChannelMenu(!showChannelMenu); setShowQualityMenu(false); setShowBackendMenu(false); }}
                  className={styles.controlButton}
                >
                  📺
                  <span className={styles.channelLabel}>
                    {currentEventChannel?.name || 'Channel'}
                  </span>
                </button>

                {showChannelMenu && (
                  <div className={styles.channelMenu}>
                    {event.channels.map((ch, idx) => (
                      <button
                        key={ch.channelId}
                        onClick={() => switchChannel(idx)}
                        className={`${styles.channelOption} ${idx === selectedChannelIndex ? styles.active : ''}`}
                      >
                        {ch.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Backend/Server Selector - only for DLHD sources */}
            {(channel?.source === 'dlhd' || event?.source === 'dlhd') && (
              <div className={styles.backendSelector}>
                <button
                  onClick={() => {
                    if (availableBackends.length === 0) fetchBackends();
                    setShowBackendMenu(!showBackendMenu);
                    setShowQualityMenu(false);
                    setShowChannelMenu(false);
                  }}
                  className={styles.controlButton}
                >
                  🖥️
                  <span className={styles.backendLabel}>
                    {selectedBackend ? selectedBackend.split('.')[0].toUpperCase() : 'Auto'}
                  </span>
                </button>

                {showBackendMenu && (
                  <div className={styles.backendMenuPopup}>
                    {loadingBackends ? (
                      <p className={styles.backendLoading}>Loading servers...</p>
                    ) : availableBackends.length > 0 ? (
                      <>
                        <button
                          onClick={() => { setSelectedBackend(undefined); setShowBackendMenu(false); }}
                          className={`${styles.backendOption} ${!selectedBackend ? styles.active : ''}`}
                        >
                          Auto (Default)
                        </button>
                        {availableBackends.map((backend) => (
                          <button
                            key={backend.id}
                            onClick={() => switchBackend(backend.id)}
                            className={`${styles.backendOption} ${selectedBackend === backend.id ? styles.active : ''} ${backend.isPrimary ? styles.primary : ''}`}
                          >
                            {backend.label}
                            {backend.status === 'online' && <span className={styles.statusOnline}>●</span>}
                            {backend.status === 'offline' && <span className={styles.statusOffline}>●</span>}
                            {backend.status === 'timeout' && <span className={styles.statusTimeout}>●</span>}
                          </button>
                        ))}
                      </>
                    ) : (
                      <p className={styles.backendLoading}>No servers available</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quality Selector */}
            {qualities.length > 0 && (
              <div className={styles.qualitySelector}>
                <button
                  onClick={() => { setShowQualityMenu(!showQualityMenu); setShowChannelMenu(false); setShowBackendMenu(false); }}
                  className={styles.controlButton}
                >
                  ⚙️
                  <span className={styles.qualityLabel}>
                    {currentQuality === -1 ? 'Auto' : `${qualities.find(q => q.index === currentQuality)?.height || ''}p`}
                  </span>
                </button>

                {showQualityMenu && (
                  <div className={styles.qualityMenu}>
                    <button
                      onClick={() => selectQuality(-1)}
                      className={`${styles.qualityOption} ${currentQuality === -1 ? styles.active : ''}`}
                    >
                      Auto
                    </button>
                    {qualities.map((q) => (
                      <button
                        key={q.index}
                        onClick={() => selectQuality(q.index)}
                        className={`${styles.qualityOption} ${currentQuality === q.index ? styles.active : ''}`}
                      >
                        {q.height}p
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={toggleFullscreen} className={styles.controlButton}>
              {isFullscreen ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
