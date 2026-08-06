'use client';

/**
 * Multi-platform casting:
 * - Chrome / Edge / Android → Google Cast SDK + Remote Playback API
 * - Safari / iOS → AirPlay (webkitShowPlaybackTargetPicker)
 * - Android fallback → Presentation API / Chrome menu guidance
 */

import { useState, useEffect, useCallback, useRef, type RefObject } from 'react';

declare global {
  interface Window {
    WebKitPlaybackTargetAvailabilityEvent?: unknown;
    chrome?: {
      cast?: {
        isAvailable?: boolean;
        SessionRequest?: new (appId: string) => unknown;
        ApiConfig?: new (
          sessionRequest: unknown,
          sessionListener: (session: CastSession) => void,
          receiverListener: (availability: string) => void,
        ) => unknown;
        initialize?: (
          config: unknown,
          onSuccess: () => void,
          onError: (error: unknown) => void,
        ) => void;
        requestSession?: (
          onSuccess: (session: CastSession) => void,
          onError: (error: { code?: string; description?: string }) => void,
        ) => void;
        media?: {
          MediaInfo?: new (url: string, contentType: string) => CastMediaInfo;
          GenericMediaMetadata?: new () => CastMetadata;
          LoadRequest?: new (mediaInfo: CastMediaInfo) => CastLoadRequest;
        };
      };
    };
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    PresentationRequest?: new (urls: string[]) => {
      start: () => Promise<{ state: string; onclose: (() => void) | null }>;
    };
  }

  interface HTMLVideoElement {
    webkitShowPlaybackTargetPicker?: () => void;
    webkitCurrentPlaybackTargetIsWireless?: boolean;
    remote?: {
      prompt: () => Promise<void>;
      watchAvailability: (cb: (available: boolean) => void) => Promise<number>;
      cancelWatchAvailability: (id: number) => Promise<void>;
      addEventListener: (type: string, listener: () => void) => void;
      removeEventListener: (type: string, listener: () => void) => void;
    };
  }
}

interface CastSession {
  displayName?: string;
  addUpdateListener: (cb: (isAlive: boolean) => void) => void;
  loadMedia: (
    request: CastLoadRequest,
    onSuccess: (media: CastMediaSession) => void,
    onError: (error: { code?: string; description?: string }) => void,
  ) => void;
  stop: (onSuccess: () => void, onError: (error: unknown) => void) => void;
  setReceiverVolumeLevel: (
    volume: number,
    onSuccess: () => void,
    onError: (error: unknown) => void,
  ) => void;
  setReceiverMuted: (
    muted: boolean,
    onSuccess: () => void,
    onError: (error: unknown) => void,
  ) => void;
}

interface CastMediaInfo {
  metadata?: CastMetadata;
  streamType?: string;
}

interface CastMetadata {
  title?: string;
  subtitle?: string;
  images?: Array<{ url: string }>;
}

interface CastLoadRequest {
  currentTime?: number;
  autoplay?: boolean;
}

interface CastMediaSession {
  playerState: string;
  currentTime?: number;
  media?: { duration?: number };
  addUpdateListener: (cb: (isAlive: boolean) => void) => void;
  stop: (req: null, onSuccess: () => void, onError: (e: unknown) => void) => void;
  pause: (req: null, onSuccess: () => void, onError: (e: unknown) => void) => void;
  play: (req: null, onSuccess: () => void, onError: (e: unknown) => void) => void;
  seek: (
    req: { currentTime: number },
    onSuccess: () => void,
    onError: (e: unknown) => void,
  ) => void;
}

export interface CastState {
  isAvailable: boolean;
  isConnected: boolean;
  isCasting: boolean;
  deviceName: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playerState: 'IDLE' | 'PLAYING' | 'PAUSED' | 'BUFFERING';
  isAirPlayAvailable: boolean;
  isAirPlayActive: boolean;
  lastError: string | null;
}

export interface CastMedia {
  url: string;
  title: string;
  subtitle?: string;
  posterUrl?: string;
  contentType?: string;
  isLive?: boolean;
  startTime?: number;
}

export interface UseCastOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  videoRef?: RefObject<HTMLVideoElement | null>;
  /** Real stream URL (not blob) — required for Chromecast loadMedia */
  streamUrl?: string | null;
  /** Bump when the <video> element mounts/changes so listeners re-bind */
  mediaKey?: string | number | null;
}

const CAST_APP_ID = 'CC1AD845'; // Default Media Receiver (HLS)

const detectIOS = () => {
  if (typeof window === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};
const detectSafari = () =>
  typeof window !== 'undefined' &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
const detectAndroid = () =>
  typeof window !== 'undefined' && /android/i.test(navigator.userAgent);
const detectChrome = () =>
  typeof window !== 'undefined' &&
  /chrome|crios|chromium/i.test(navigator.userAgent) &&
  !/edg/i.test(navigator.userAgent);

function loadCastSDK(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.chrome?.cast?.isAvailable) {
      resolve(true);
      return;
    }
    if (document.querySelector('script[src*="cast_sender"]')) {
      const t0 = Date.now();
      const id = setInterval(() => {
        if (window.chrome?.cast?.isAvailable) {
          clearInterval(id);
          resolve(true);
        } else if (Date.now() - t0 > 8000) {
          clearInterval(id);
          resolve(false);
        }
      }, 100);
      return;
    }

    window.__onGCastApiAvailable = (isAvailable: boolean) => resolve(isAvailable);

    const script = document.createElement('script');
    script.src =
      'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
    script.async = true;
    script.onerror = () => resolve(false);
    document.head.appendChild(script);

    setTimeout(() => {
      if (!window.chrome?.cast?.isAvailable) resolve(false);
    }, 10000);
  });
}

export function useCast(options: UseCastOptions = {}) {
  const [state, setState] = useState<CastState>({
    isAvailable: true,
    isConnected: false,
    isCasting: false,
    deviceName: null,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    playerState: 'IDLE',
    isAirPlayAvailable: false,
    isAirPlayActive: false,
    lastError: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const castSessionRef = useRef<CastSession | null>(null);
  const castMediaRef = useRef<CastMediaSession | null>(null);
  const hasCastSDKRef = useRef(false);
  const isIOSRef = useRef(false);
  const isSafariRef = useRef(false);
  const isAndroidRef = useRef(false);
  const isChromeRef = useRef(false);

  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);
  const onErrorRef = useRef(options.onError);
  useEffect(() => {
    onConnectRef.current = options.onConnect;
  }, [options.onConnect]);
  useEffect(() => {
    onDisconnectRef.current = options.onDisconnect;
  }, [options.onDisconnect]);
  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  // Init Cast SDK (Chrome / Android, not iOS)
  useEffect(() => {
    isIOSRef.current = detectIOS();
    isSafariRef.current = detectSafari();
    isAndroidRef.current = detectAndroid();
    isChromeRef.current = detectChrome();

    if (isIOSRef.current) return;
    if (!isChromeRef.current && !isAndroidRef.current && typeof window !== 'undefined') {
      // Still try Cast SDK on Edge / desktop Chromium
      if (!/edg|chrome|chromium/i.test(navigator.userAgent)) return;
    }

    let cancelled = false;
    (async () => {
      const available = await loadCastSDK();
      if (cancelled || !available || !window.chrome?.cast) return;
      hasCastSDKRef.current = true;

      try {
        const sessionRequest = new window.chrome.cast.SessionRequest!(CAST_APP_ID);
        const apiConfig = new window.chrome.cast.ApiConfig!(
          sessionRequest,
          (session: CastSession) => {
            castSessionRef.current = session;
            setState((prev) => ({
              ...prev,
              isConnected: true,
              isCasting: true,
              deviceName: session.displayName || 'Chromecast',
              lastError: null,
            }));
            onConnectRef.current?.();
            session.addUpdateListener((isAlive: boolean) => {
              if (!isAlive) {
                castSessionRef.current = null;
                castMediaRef.current = null;
                setState((prev) => ({
                  ...prev,
                  isConnected: false,
                  isCasting: false,
                  deviceName: null,
                }));
                onDisconnectRef.current?.();
              }
            });
          },
          (availability: string) => {
            setState((prev) => ({
              ...prev,
              isAvailable: availability === 'available' || prev.isAirPlayAvailable || true,
            }));
          },
        );
        window.chrome.cast.initialize!(
          apiConfig,
          () => {},
          () => {},
        );
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Remote Playback + AirPlay capability on the video element
  useEffect(() => {
    const video = options.videoRef?.current;
    if (!video) return;

    const hasAirPlay = !!(
      window.WebKitPlaybackTargetAvailabilityEvent ||
      'webkitCurrentPlaybackTargetIsWireless' in video ||
      typeof video.webkitShowPlaybackTargetPicker === 'function'
    );
    if (hasAirPlay) {
      setState((prev) => ({
        ...prev,
        isAirPlayAvailable: true,
        isAvailable: true,
      }));
    }

    const remote = video.remote;
    if (remote && !isIOSRef.current) {
      const handleConnecting = () =>
        setState((prev) => ({ ...prev, lastError: null }));
      const handleConnect = () => {
        setState((prev) => ({
          ...prev,
          isConnected: true,
          isCasting: true,
          lastError: null,
        }));
        onConnectRef.current?.();
      };
      const handleDisconnect = () => {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isCasting: false,
        }));
        onDisconnectRef.current?.();
      };
      remote.addEventListener('connecting', handleConnecting);
      remote.addEventListener('connect', handleConnect);
      remote.addEventListener('disconnect', handleDisconnect);

      remote
        .watchAvailability(() => {
          setState((prev) => ({ ...prev, isAvailable: true }));
        })
        .then((id) => {
          watchIdRef.current = id;
        })
        .catch(() => {});

      return () => {
        remote.removeEventListener('connecting', handleConnecting);
        remote.removeEventListener('connect', handleConnect);
        remote.removeEventListener('disconnect', handleDisconnect);
        if (watchIdRef.current != null) {
          remote.cancelWatchAvailability(watchIdRef.current).catch(() => {});
        }
      };
    }
  }, [options.videoRef, options.streamUrl, options.mediaKey]);

  // AirPlay wireless target events
  useEffect(() => {
    const video = options.videoRef?.current;
    if (!video) return;

    const onAvail = (event: Event & { availability?: string }) => {
      const available = event.availability === 'available';
      setState((prev) => ({
        ...prev,
        isAirPlayAvailable: available,
        isAvailable: true,
      }));
    };
    const onWireless = () => {
      const wireless = !!video.webkitCurrentPlaybackTargetIsWireless;
      setState((prev) => ({
        ...prev,
        isAirPlayActive: wireless,
        isCasting: wireless || prev.isCasting,
        isConnected: wireless || prev.isConnected,
        deviceName: wireless ? 'AirPlay' : prev.deviceName,
        lastError: null,
      }));
      if (wireless) onConnectRef.current?.();
      else onDisconnectRef.current?.();
    };

    video.addEventListener(
      'webkitplaybacktargetavailabilitychanged',
      onAvail as EventListener,
    );
    video.addEventListener(
      'webkitcurrentplaybacktargetiswirelesschanged',
      onWireless,
    );
    return () => {
      video.removeEventListener(
        'webkitplaybacktargetavailabilitychanged',
        onAvail as EventListener,
      );
      video.removeEventListener(
        'webkitcurrentplaybacktargetiswirelesschanged',
        onWireless,
      );
    };
  }, [options.videoRef, options.streamUrl, options.mediaKey]);

  const requestSession = useCallback(async () => {
    const video = options.videoRef?.current;
    if (!video) {
      const error = 'Video is not ready yet. Wait a moment and try again.';
      setState((prev) => ({ ...prev, lastError: error }));
      onErrorRef.current?.(error);
      return false;
    }
    setState((prev) => ({ ...prev, lastError: null }));

    // 1) AirPlay (iOS / Safari)
    if (typeof video.webkitShowPlaybackTargetPicker === 'function') {
      try {
        if (video.readyState < 2) {
          try {
            video.load();
          } catch {
            /* ignore */
          }
          await new Promise((r) => setTimeout(r, 120));
        }
        video.webkitShowPlaybackTargetPicker();
        return true;
      } catch {
        if (isIOSRef.current) {
          const error =
            'AirPlay is not available. Make sure your Apple TV or AirPlay speaker is on the same Wi‑Fi.';
          setState((prev) => ({ ...prev, lastError: error }));
          onErrorRef.current?.(error);
          return false;
        }
      }
    }

    // 2) Presentation API (Android)
    if (
      isAndroidRef.current &&
      typeof window !== 'undefined' &&
      window.PresentationRequest &&
      options.streamUrl
    ) {
      try {
        const presentationUrl = options.streamUrl.startsWith('/')
          ? `${window.location.origin}${options.streamUrl}`
          : options.streamUrl;
        const presentationRequest = new window.PresentationRequest([presentationUrl]);
        const connection = await presentationRequest.start();
        setState((prev) => ({
          ...prev,
          isConnected: true,
          isCasting: true,
          deviceName: 'Cast device',
          lastError: null,
        }));
        onConnectRef.current?.();
        connection.onclose = () => {
          setState((prev) => ({
            ...prev,
            isConnected: false,
            isCasting: false,
            deviceName: null,
          }));
          onDisconnectRef.current?.();
        };
        return true;
      } catch (e: unknown) {
        const err = e as { name?: string };
        if (err?.name === 'NotAllowedError') return false;
      }
    }

    // 3) Remote Playback API (skip blob/MSE sources)
    const remote = video.remote;
    const src = video.src || video.currentSrc || options.streamUrl || '';
    const isBlob = src.startsWith('blob:');
    if (remote && !isIOSRef.current && !isBlob) {
      try {
        await remote.prompt();
        return true;
      } catch (error: unknown) {
        const err = error as { name?: string };
        if (err?.name === 'NotAllowedError') return false;
      }
    }

    // 4) Google Cast SDK
    const ensureSdk = async () => {
      if (window.chrome?.cast?.requestSession) return true;
      return loadCastSDK();
    };
    const ready = await ensureSdk();
    if (ready && window.chrome?.cast?.requestSession) {
      hasCastSDKRef.current = true;
      return new Promise<boolean>((resolve) => {
        window.chrome!.cast!.requestSession!(
          (session) => {
            castSessionRef.current = session;
            setState((prev) => ({
              ...prev,
              isConnected: true,
              isCasting: false,
              deviceName: session.displayName || 'Chromecast',
              lastError: null,
            }));
            onConnectRef.current?.();
            session.addUpdateListener((isAlive) => {
              if (!isAlive) {
                castSessionRef.current = null;
                castMediaRef.current = null;
                setState((prev) => ({
                  ...prev,
                  isConnected: false,
                  isCasting: false,
                  deviceName: null,
                  playerState: 'IDLE',
                }));
                onDisconnectRef.current?.();
              }
            });
            resolve(true);
          },
          (error) => {
            if (error.code === 'cancel') {
              resolve(false);
              return;
            }
            let msg = error.description || 'Failed to connect to cast device';
            if (error.code === 'receiver_unavailable') {
              msg =
                'No Chromecast found. For smart TVs, try Chrome menu → Cast → Cast tab.';
            } else if (error.code === 'timeout') {
              msg = 'Cast connection timed out. Try again.';
            }
            setState((prev) => ({ ...prev, lastError: msg }));
            onErrorRef.current?.(msg);
            resolve(false);
          },
        );
      });
    }

    // Guidance fallbacks
    let error: string;
    if (isIOSRef.current) {
      error = 'AirPlay is not available on this device.';
    } else if (isAndroidRef.current) {
      error =
        'To cast on Android:\n1. Chrome menu (⋮) → Cast…\n2. Pick your TV\n\nOr use screen mirroring from Quick Settings.';
    } else if (isChromeRef.current || /edg/i.test(navigator.userAgent)) {
      error =
        'Cast not ready. Try Chrome/Edge menu (⋮) → Cast…\nFor LG/Samsung TVs use “Cast tab”.';
    } else {
      error =
        'Casting works best in Chrome or Edge. Use the browser menu → Cast, or open this page on Chrome.';
    }
    setState((prev) => ({ ...prev, lastError: error }));
    onErrorRef.current?.(error);
    return false;
  }, [options.videoRef, options.streamUrl]);

  const loadMedia = useCallback(async (media: CastMedia) => {
    if (!castSessionRef.current || !window.chrome?.cast?.media) {
      // AirPlay / Remote Playback use the local video element source
      return true;
    }
    try {
      const contentType = media.contentType || 'application/x-mpegURL';
      const mediaInfo = new window.chrome.cast.media.MediaInfo!(media.url, contentType);
      const metadata = new window.chrome.cast.media.GenericMediaMetadata!();
      metadata.title = media.title;
      if (media.subtitle) metadata.subtitle = media.subtitle;
      if (media.posterUrl) metadata.images = [{ url: media.posterUrl }];
      mediaInfo.metadata = metadata;
      mediaInfo.streamType = media.isLive ? 'LIVE' : 'BUFFERED';

      const loadRequest = new window.chrome.cast.media.LoadRequest!(mediaInfo);
      if (media.startTime && media.startTime > 0) {
        loadRequest.currentTime = media.startTime;
      }
      loadRequest.autoplay = true;

      return new Promise<boolean>((resolve) => {
        castSessionRef.current!.loadMedia(
          loadRequest,
          (mediaSession) => {
            castMediaRef.current = mediaSession;
            setState((prev) => ({
              ...prev,
              isCasting: true,
              playerState:
                mediaSession.playerState === 'PLAYING'
                  ? 'PLAYING'
                  : mediaSession.playerState === 'BUFFERING'
                    ? 'BUFFERING'
                    : 'IDLE',
              duration: mediaSession.media?.duration || 0,
            }));
            mediaSession.addUpdateListener((isAlive) => {
              if (!isAlive || !castMediaRef.current) return;
              const ps = castMediaRef.current.playerState;
              setState((prev) => ({
                ...prev,
                currentTime: castMediaRef.current?.currentTime || 0,
                duration: castMediaRef.current?.media?.duration || prev.duration,
                playerState:
                  ps === 'PLAYING'
                    ? 'PLAYING'
                    : ps === 'PAUSED'
                      ? 'PAUSED'
                      : ps === 'BUFFERING'
                        ? 'BUFFERING'
                        : 'IDLE',
              }));
            });
            resolve(true);
          },
          (error) => {
            let msg =
              error.description ||
              'Failed to load media on the cast device.';
            if (
              error.code === 'LOAD_FAILED' ||
              error.description?.includes('LOAD_FAILED')
            ) {
              msg =
                'TV could not play this stream. Try Chrome menu → Cast → Cast tab (screen mirror).';
            }
            setState((prev) => ({ ...prev, lastError: msg }));
            onErrorRef.current?.(msg);
            resolve(false);
          },
        );
      });
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    if (castMediaRef.current) {
      try {
        castMediaRef.current.stop(
          null,
          () => {},
          () => {},
        );
      } catch {
        /* ignore */
      }
      castMediaRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isCasting: false,
      playerState: 'IDLE',
      currentTime: 0,
    }));
  }, []);

  const disconnect = useCallback(() => {
    stop();
    if (castSessionRef.current) {
      try {
        castSessionRef.current.stop(
          () => {},
          () => {},
        );
      } catch {
        /* ignore */
      }
      castSessionRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isCasting: false,
      isConnected: false,
      isAirPlayActive: false,
      deviceName: null,
      playerState: 'IDLE',
    }));
    onDisconnectRef.current?.();
  }, [stop]);

  const playOrPause = useCallback(() => {
    if (!castMediaRef.current) return;
    if (castMediaRef.current.playerState === 'PLAYING') {
      castMediaRef.current.pause(
        null,
        () => setState((prev) => ({ ...prev, playerState: 'PAUSED' })),
        () => {},
      );
    } else {
      castMediaRef.current.play(
        null,
        () => setState((prev) => ({ ...prev, playerState: 'PLAYING' })),
        () => {},
      );
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (!castMediaRef.current) return;
    castMediaRef.current.seek(
      { currentTime: time },
      () => setState((prev) => ({ ...prev, currentTime: time })),
      () => {},
    );
  }, []);

  const setCastVolume = useCallback((volume: number) => {
    if (!castSessionRef.current) return;
    try {
      castSessionRef.current.setReceiverVolumeLevel(
        volume,
        () =>
          setState((prev) => ({
            ...prev,
            volume,
            isMuted: volume === 0,
          })),
        () => {},
      );
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCastMute = useCallback(() => {
    if (!castSessionRef.current) return;
    setState((prev) => {
      const next = !prev.isMuted;
      try {
        castSessionRef.current?.setReceiverMuted(
          next,
          () => {},
          () => {},
        );
      } catch {
        /* ignore */
      }
      return { ...prev, isMuted: next };
    });
  }, []);

  return {
    ...state,
    requestSession,
    loadMedia,
    stop,
    disconnect,
    playOrPause,
    seek,
    setVolume: setCastVolume,
    toggleMute: toggleCastMute,
  };
}
