'use client';

import { useRef, useState, useEffect } from 'react';
import Hls from 'hls.js';
import { useAnalytics } from '../analytics/AnalyticsProvider';
import { useWatchProgress } from '@/lib/hooks/useWatchProgress';
import { streamRetryManager } from '@/lib/utils/stream-retry';
import { trackWatchStart, trackWatchProgress, trackWatchPause, trackWatchComplete } from '@/lib/utils/live-activity';
import { getSubtitlePreferences, setSubtitlesEnabled, setSubtitleLanguage, getSubtitleStyle, setSubtitleStyle, type SubtitleStyle } from '@/lib/utils/subtitle-preferences';
import styles from './VideoPlayer.module.css';

interface VideoPlayerProps {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  season?: number;
  episode?: number;
  title?: string;
  nextEpisode?: {
    season: number;
    episode: number;
    title?: string;
  } | null;
  onNextEpisode?: () => void;
}

export default function VideoPlayer({ tmdbId, mediaType, season, episode, title, nextEpisode, onNextEpisode }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);
  const subtitlesFetchedRef = useRef(false);
  const subtitlesAutoLoadedRef = useRef(false);

  // Analytics and progress tracking
  const { trackContentEngagement, trackInteraction } = useAnalytics();
  const contentType = mediaType === 'tv' ? 'episode' : 'movie';
  const {
    handleProgress,
    loadProgress,
    handleWatchStart,
    handleWatchPause,
    handleWatchResume
  } = useWatchProgress({
    contentId: tmdbId,
    contentType,
    contentTitle: title,
    seasonNumber: season,
    episodeNumber: episode,
    onProgress: (_time, _duration) => {
      // This will be called by the hook when progress is updated
    },
    onComplete: () => {
      // Track completion in viewing history
      trackContentEngagement(tmdbId, mediaType, 'completed', {
        title,
        season,
        episode,
      });
    },
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [availableSources, setAvailableSources] = useState<any[]>([]);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [buffered, setBuffered] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [showSubtitleCustomization, setShowSubtitleCustomization] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  const [availableSubtitles, setAvailableSubtitles] = useState<any[]>([]);
  const [subtitlesLoading, setSubtitlesLoading] = useState(false);
  const [subtitleStyle, setSubtitleStyleState] = useState<SubtitleStyle>(getSubtitleStyle());
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedProgress, setSavedProgress] = useState<number>(0);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);

  const [showNextEpisodeButton, setShowNextEpisodeButton] = useState(false);
  const [provider, setProvider] = useState('2embed');
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [showProviderConfirmation, setShowProviderConfirmation] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const lastFetchedKey = useRef('');
  const volumeIndicatorTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch stream URL
  useEffect(() => {
    const currentKey = `${tmdbId}-${mediaType}-${season}-${episode}-${provider}`;

    // Prevent duplicate fetches in StrictMode
    if (lastFetchedKey.current === currentKey) {
      console.log('[VideoPlayer] Skipping duplicate fetch (already fetched)');
      return;
    }

    lastFetchedKey.current = currentKey;

    // Reset subtitle auto-load flag for new video (only on first mount)
    subtitlesAutoLoadedRef.current = false;

    const fetchStream = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          tmdbId,
          type: mediaType,
          provider,
        });

        if (mediaType === 'tv' && season && episode) {
          params.append('season', season.toString());
          params.append('episode', episode.toString());
        }

        console.log('[VideoPlayer] Fetching stream:', `/api/stream/extract?${params}`);

        // Use fetch with priority hint for faster loading
        const response = await fetch(`/api/stream/extract?${params}`, {
          priority: 'high' as RequestPriority,
        });
        const data = await response.json();

        console.log('[VideoPlayer] Stream response:', {
          ok: response.ok,
          status: response.status,
          data: data
        });

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Failed to load stream');
        }

        // Try multiple possible response formats
        let sources = [];

        if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
          sources = data.sources;
          console.log('[VideoPlayer] Found sources array:', sources.length, 'sources');
        } else if (data.data?.sources && Array.isArray(data.data.sources) && data.data.sources.length > 0) {
          sources = data.data.sources;
          console.log('[VideoPlayer] Found data.sources array:', sources.length, 'sources');
        } else if (data.url || data.streamUrl) {
          // Single source - wrap in array
          sources = [{
            quality: 'auto',
            url: data.url || data.streamUrl
          }];
          console.log('[VideoPlayer] Single source found');
        }

        if (sources.length > 0) {
          console.log('[VideoPlayer] Available sources:', sources.map((s: any) => s.title || s.quality));
          setAvailableSources(sources);
          // Sources are already sorted by the extractor with English sources first
          setCurrentSourceIndex(0);

          // Check if proxy is needed
          const initialSource = sources[0];
          let finalUrl = initialSource.url;

          if (initialSource.requiresSegmentProxy) {
            // Check if the URL is already proxied to avoid double-proxying
            const isAlreadyProxied = finalUrl.includes('/api/stream-proxy');

            if (!isAlreadyProxied) {
              console.log('[VideoPlayer] Source requires proxy, rewriting URL...');
              // Use directUrl if available to ensure we're proxying the raw URL
              const targetUrl = initialSource.directUrl || initialSource.url;

              const proxyParams = new URLSearchParams({
                url: targetUrl,
                source: provider === 'moviesapi' ? 'moviesapi' : '2embed',
                referer: initialSource.referer || ''
              });
              finalUrl = `/api/stream-proxy?${proxyParams.toString()}`;
            } else {
              console.log('[VideoPlayer] Source already proxied, using as is');
            }
          }

          setStreamUrl(finalUrl);
          console.log('[VideoPlayer] Setting initial stream URL:', finalUrl, '(', initialSource.title || initialSource.quality, ')');
        } else {
          console.error('[VideoPlayer] No stream URL found in response:', data);
          throw new Error('No stream sources available');
        }
      } catch (err) {
        console.error('[VideoPlayer] Stream fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load video');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStream();
  }, [tmdbId, mediaType, season, episode, provider]);

  // Initialize HLS
  useEffect(() => {
    if (!streamUrl || !videoRef.current) {
      console.log('[VideoPlayer] HLS init skipped:', { streamUrl: !!streamUrl, videoRef: !!videoRef.current });
      return;
    }

    const video = videoRef.current;
    console.log('[VideoPlayer] Initializing HLS with URL:', streamUrl);

    if (streamUrl.includes('.m3u8') || streamUrl.includes('stream-proxy')) {
      if (Hls.isSupported()) {
        console.log('[VideoPlayer] HLS.js is supported, creating instance');
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          // Performance optimizations
          maxBufferLength: 30, // Reduced from default 30s
          maxMaxBufferLength: 60, // Max buffer
          maxBufferSize: 60 * 1000 * 1000, // 60 MB
          maxBufferHole: 0.5, // Jump small gaps
          highBufferWatchdogPeriod: 2, // Check buffer health
          nudgeOffset: 0.1, // Fine-tune playback
          nudgeMaxRetry: 3,
          // Faster initial loading
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 2,
          manifestLoadingRetryDelay: 500,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 2,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 3,
          // Start with lower quality for faster initial load
          startLevel: -1, // Auto-select
          // For proxied streams, ensure we use the proxy for all requests
          xhrSetup: (xhr, url) => {
            console.log('[VideoPlayer] HLS.js XHR request:', url);
            // The URL is already proxied by our rewritePlaylistUrls function
            // Just ensure CORS is handled
            xhr.withCredentials = false;
          },
        });

        console.log('[VideoPlayer] Loading source:', streamUrl);
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('[VideoPlayer] HLS manifest loaded');

          // Reload subtitles if they were enabled (they may have been lost during HLS init)
          if (currentSubtitle && availableSubtitles.length > 0) {
            const currentSub = availableSubtitles.find(sub => sub.id === currentSubtitle);
            if (currentSub) {
              console.log('[VideoPlayer] Reloading subtitle after HLS manifest parsed');
              setTimeout(() => {
                loadSubtitle(currentSub);
              }, 100);
            }
          }

          // Auto-play after manifest is loaded
          video.play().catch(e => console.log('[VideoPlayer] Autoplay prevented:', e));
        });

        hls.on(Hls.Events.ERROR, async (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Network error, trying to recover...', data);

                // Check if we have alternative sources to try
                const nextSourceIndex = currentSourceIndex + 1;
                if (nextSourceIndex < availableSources.length) {
                  console.log(`Trying alternative source ${nextSourceIndex + 1}/${availableSources.length}`);
                  setError(`Source failed, trying alternative source...`);

                  // Save current time before switching
                  const savedTime = videoRef.current?.currentTime || 0;

                  // Switch to next source
                  setTimeout(() => {
                    changeSource(nextSourceIndex);

                    // Restore playback position
                    if (videoRef.current && savedTime > 0) {
                      videoRef.current.currentTime = savedTime;
                    }
                  }, 1000);

                  return;
                }

                // No more sources, check if stream is expired
                if (streamRetryManager.isStreamExpired(data)) {
                  console.log('All sources failed, attempting re-extraction...');
                  setError('All sources failed, getting fresh URLs...');

                  try {
                    const freshData = await streamRetryManager.retryStreamExtraction(
                      tmdbId,
                      mediaType,
                      season,
                      episode,
                      {
                        maxRetries: 2,
                        onRetry: (attempt) => {
                          setError(`Retrying stream extraction (${attempt}/2)...`);
                        }
                      }
                    );

                    if (freshData?.sources && freshData.sources.length > 0) {
                      console.log('Got fresh sources, reloading...');
                      setAvailableSources(freshData.sources);
                      setCurrentSourceIndex(0);
                      setStreamUrl(freshData.sources[0].url);
                      setError(null);
                    } else {
                      setError('Failed to get fresh stream URLs');
                    }
                  } catch (retryError) {
                    console.error('Stream retry failed:', retryError);
                    setError('All sources unavailable, please try again later');
                  }
                } else {
                  // Try to recover
                  console.log('Attempting HLS recovery...');
                  hls.startLoad();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Media error, trying to recover...');
                hls.recoverMediaError();
                break;
              default:
                setError('Fatal error loading video');
                break;
            }
          }
        });

        hlsRef.current = hls;

        return () => {
          hls.destroy();
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('[VideoPlayer] Using native HLS support');
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => console.log('[VideoPlayer] Autoplay prevented:', e));
        });
      } else {
        console.error('[VideoPlayer] HLS not supported and native playback not available');
      }
    } else {
      console.log('[VideoPlayer] Direct video source (not HLS)');
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.log('[VideoPlayer] Autoplay prevented:', e));
      });
    }
  }, [streamUrl]);

  // Fetch subtitles when content changes
  useEffect(() => {
    // Prevent duplicate subtitle fetches in StrictMode
    if (subtitlesFetchedRef.current) {
      console.log('[VideoPlayer] Skipping duplicate subtitle fetch (already fetched)');
      return;
    }

    subtitlesFetchedRef.current = true;

    // Get IMDB ID from TMDB
    const getImdbId = async () => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
        if (!apiKey) return;

        const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.imdb_id) {
          await fetchSubtitles(data.imdb_id);
        }
      } catch (err) {
        console.error('[VideoPlayer] Failed to get IMDB ID:', err);
      }
    };

    getImdbId();
  }, [tmdbId, mediaType, season, episode]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);

      if (video.currentTime === 0) {
        // First play - track as start
        handleWatchStart(video.currentTime, video.duration);

        // Track live activity - watch start
        trackWatchStart(
          tmdbId,
          title || 'Unknown Title',
          mediaType,
          season,
          episode
        );
      } else {
        // Resume from pause
        handleWatchResume(video.currentTime, video.duration);
      }

      trackInteraction({
        element: 'video_player',
        action: 'click',
        context: {
          action_type: 'play',
          contentId: tmdbId,
          contentType: mediaType,
          contentTitle: title,
          currentTime: video.currentTime,
          seasonNumber: season,
          episodeNumber: episode,
        },
      });
    };

    const handlePause = () => {
      setIsPlaying(false);
      handleWatchPause(video.currentTime, video.duration);

      // Track live activity - watch pause
      const progress = video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;
      trackWatchPause(
        tmdbId,
        title || 'Unknown Title',
        mediaType,
        progress,
        season,
        episode
      );

      trackInteraction({
        element: 'video_player',
        action: 'click',
        context: {
          action_type: 'pause',
          contentId: tmdbId,
          contentType: mediaType,
          currentTime: video.currentTime,
          duration: video.duration,
        },
      });
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered((video.buffered.end(video.buffered.length - 1) / video.duration) * 100);
      }

      // Show "Next Episode" button in last 90 seconds
      if (nextEpisode && video.duration > 0) {
        const timeRemaining = video.duration - video.currentTime;
        if (timeRemaining <= 90) {
          setShowNextEpisodeButton(true);
        } else {
          setShowNextEpisodeButton(false);
        }
      }

      // Track watch progress
      if (video.duration > 0) {
        handleProgress(video.currentTime, video.duration);

        // Track live activity progress (throttled to every 30 seconds)
        const progress = (video.currentTime / video.duration) * 100;
        const currentTimeRounded = Math.floor(video.currentTime);

        if (currentTimeRounded > 0 && currentTimeRounded % 30 === 0) {
          trackWatchProgress(
            tmdbId,
            title || 'Unknown Title',
            mediaType,
            progress,
            video.currentTime,
            season,
            episode
          );
        }

        // Track completion at 90%
        if (progress >= 90 && !video.dataset.completionTracked) {
          video.dataset.completionTracked = 'true';
          trackWatchComplete(
            tmdbId,
            title || 'Unknown Title',
            mediaType,
            video.currentTime,
            season,
            episode
          );
        }
      }
    };

    const handleDurationChange = () => {
      setDuration(video.duration);
      // Load saved progress when duration is available
      const savedTime = loadProgress();
      if (savedTime > 0 && savedTime < video.duration - 30) {
        // Show resume prompt instead of auto-resuming
        setSavedProgress(savedTime);
        setShowResumePrompt(true);
        video.pause(); // Pause until user decides
      }
    };

    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => {
      setIsBuffering(false);
      setIsLoading(false); // Ensure loading is cleared
    };
    const handleLoadedData = () => {
      setIsLoading(false);

      trackContentEngagement(tmdbId, mediaType, 'video_loaded', {
        title,
        season,
        episode,
        duration: video.duration,
      });
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (nextEpisode && onNextEpisode) {
        console.log('[VideoPlayer] Video ended, auto-playing next episode');
        onNextEpisode();
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Fullscreen handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!videoRef.current) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowleft':
          e.preventDefault();
          seek(currentTime - 10);
          break;
        case 'arrowright':
          e.preventDefault();
          seek(currentTime + 10);
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(volume * 100 + 10, 100));
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(volume * 100 - 10, 0));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentTime, volume]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleVolumeChange = (value: number) => {
    if (!videoRef.current) return;
    const newVolume = value / 100;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);

    // Show volume indicator
    setShowVolumeIndicator(true);
    if (volumeIndicatorTimeoutRef.current) {
      clearTimeout(volumeIndicatorTimeoutRef.current);
    }
    volumeIndicatorTimeoutRef.current = setTimeout(() => {
      setShowVolumeIndicator(false);
    }, 1000);

    trackInteraction({
      element: 'volume_control',
      action: 'click',
      context: {
        action_type: 'volume_change',
        volume: newVolume,
        contentId: tmdbId,
      },
    });
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);

    // Show volume indicator
    setShowVolumeIndicator(true);
    if (volumeIndicatorTimeoutRef.current) {
      clearTimeout(volumeIndicatorTimeoutRef.current);
    }
    volumeIndicatorTimeoutRef.current = setTimeout(() => {
      setShowVolumeIndicator(false);
    }, 1000);
  };

  const seek = (time: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(time, duration));
    videoRef.current.currentTime = newTime;

    trackInteraction({
      element: 'video_player',
      action: 'click',
      context: {
        action_type: 'seek',
        contentId: tmdbId,
        fromTime: currentTime,
        toTime: newTime,
        seekAmount: newTime - currentTime,
      },
    });
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const updateSubtitleStyle = (newStyle: Partial<SubtitleStyle>) => {
    const updated = { ...subtitleStyle, ...newStyle };
    setSubtitleStyleState(updated);
    setSubtitleStyle(updated);

    // Apply styles dynamically to video element
    if (videoRef.current) {
      const video = videoRef.current;
      const styleId = 'dynamic-subtitle-style';
      let styleEl = document.getElementById(styleId) as HTMLStyleElement;

      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }

      const bgOpacity = updated.backgroundOpacity / 100;

      // Calculate line position (0 = top, 100 = bottom)
      // VTT uses line position where negative values are from top, positive from bottom
      // We'll use percentage positioning
      const linePosition = updated.verticalPosition;

      styleEl.textContent = `
        video::cue {
          font-size: ${updated.fontSize}% !important;
          color: ${updated.textColor} !important;
          background-color: rgba(0, 0, 0, ${bgOpacity}) !important;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8) !important;
          line: ${linePosition}% !important;
        }
      `;

      // Also update existing text tracks
      if (video.textTracks && video.textTracks.length > 0) {
        const track = video.textTracks[0];
        if (track.cues) {
          for (let i = 0; i < track.cues.length; i++) {
            const cue = track.cues[i] as any;
            if (cue.line !== undefined) {
              cue.line = linePosition;
              cue.snapToLines = false; // Use percentage positioning
            }
          }
        }
      }
    }
  };

  const loadSubtitle = (subtitle: any | null) => {
    if (!videoRef.current) return;

    console.log('[VideoPlayer] loadSubtitle called with:', subtitle);

    // Remove existing subtitle tracks
    const tracks = videoRef.current.querySelectorAll('track');
    tracks.forEach(track => track.remove());

    if (subtitle) {
      // Proxy the subtitle URL through our API
      const proxiedUrl = `/api/subtitle-proxy?url=${encodeURIComponent(subtitle.url)}`;

      console.log('[VideoPlayer] Creating track with proxied URL:', proxiedUrl);

      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = subtitle.language || 'Subtitles';
      track.srclang = subtitle.iso639 || 'en';
      track.src = proxiedUrl;
      track.default = true;

      // Add load handler to ensure track is ready
      track.addEventListener('load', () => {
        console.log('[VideoPlayer] Track loaded successfully');
        if (videoRef.current && videoRef.current.textTracks && videoRef.current.textTracks.length > 0) {
          const textTrack = videoRef.current.textTracks[0];
          textTrack.mode = 'showing';
          console.log('[VideoPlayer] Track mode set to showing after load');
        }
      });

      // Add error handler
      track.addEventListener('error', (e) => {
        console.error('[VideoPlayer] Track error:', e);
      });

      videoRef.current.appendChild(track);

      console.log('[VideoPlayer] Track added, textTracks count:', videoRef.current.textTracks.length);

      // Also try to set mode immediately (for cached tracks)
      setTimeout(() => {
        if (videoRef.current && videoRef.current.textTracks && videoRef.current.textTracks.length > 0) {
          const textTrack = videoRef.current.textTracks[0];
          if (textTrack.mode !== 'showing') {
            textTrack.mode = 'showing';
            console.log('[VideoPlayer] Track mode set to showing (immediate)');
          }
        }
      }, 500);

      console.log('[VideoPlayer] Loaded subtitle:', subtitle.language);
      setCurrentSubtitle(subtitle.id);

      // Save subtitle preference - both language and enabled state
      setSubtitleLanguage(subtitle.langCode, subtitle.language);
      setSubtitlesEnabled(true);
    } else {
      console.log('[VideoPlayer] Clearing subtitles');
      setCurrentSubtitle(null);

      // Save that subtitles are disabled
      setSubtitlesEnabled(false);
    }

    setShowSubtitles(false);
  };

  const fetchSubtitles = async (imdbId: string) => {
    try {
      setSubtitlesLoading(true);
      console.log('[VideoPlayer] Fetching subtitles for IMDB ID:', imdbId);

      const params = new URLSearchParams({
        imdbId,
      });

      if (mediaType === 'tv' && season && episode) {
        params.append('season', season.toString());
        params.append('episode', episode.toString());
      }

      const response = await fetch(`/api/subtitles?${params}`);
      const data = await response.json();

      if (data.success && data.subtitles && Array.isArray(data.subtitles)) {
        console.log('[VideoPlayer] Found subtitles:', data.subtitles.length);
        setAvailableSubtitles(data.subtitles);
      } else {
        console.log('[VideoPlayer] No subtitles found');
        setAvailableSubtitles([]);
      }
    } catch (err) {
      console.error('[VideoPlayer] Subtitle fetch error:', err);
      setAvailableSubtitles([]);
    } finally {
      setSubtitlesLoading(false);
    }
  };

  // Apply saved subtitle style on mount
  useEffect(() => {
    updateSubtitleStyle(subtitleStyle);
  }, []);

  // Apply saved subtitle preferences after subtitles are loaded
  useEffect(() => {
    if (availableSubtitles.length === 0) return;

    // Don't auto-load if we've already done it for this video
    if (subtitlesAutoLoadedRef.current) {
      console.log('[VideoPlayer] Subtitles already auto-loaded, skipping');
      return;
    }

    const preferences = getSubtitlePreferences();
    console.log('[VideoPlayer] Applying saved subtitle preferences:', preferences);

    if (preferences.enabled) {
      // Find subtitle matching the saved language preference
      const preferredSubtitle = availableSubtitles.find(
        sub => sub.langCode === preferences.languageCode
      );

      if (preferredSubtitle) {
        console.log('[VideoPlayer] Auto-loading preferred subtitle:', preferredSubtitle.language);
        loadSubtitle(preferredSubtitle);
        subtitlesAutoLoadedRef.current = true;
      } else {
        // If preferred language not available, load first available (English if available)
        const englishSubtitle = availableSubtitles.find(sub => sub.langCode === 'eng');
        if (englishSubtitle) {
          console.log('[VideoPlayer] Preferred language not found, auto-loading English');
          loadSubtitle(englishSubtitle);
          subtitlesAutoLoadedRef.current = true;
        }
      }
    } else {
      console.log('[VideoPlayer] Subtitles disabled in preferences, not auto-loading');
    }
  }, [availableSubtitles]);

  const changeSource = (sourceIndex: number) => {
    if (sourceIndex < 0 || sourceIndex >= availableSources.length) return;

    const newSource = availableSources[sourceIndex];
    console.log('[VideoPlayer] Switching to source:', newSource.quality, newSource.url);

    // Save current time
    const savedTime = videoRef.current?.currentTime || 0;

    // Destroy current HLS instance if exists
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Update source
    setCurrentSourceIndex(sourceIndex);

    // Check if proxy is needed
    let finalUrl = newSource.url;
    if (newSource.requiresSegmentProxy) {
      // Check if the URL is already proxied to avoid double-proxying
      const isAlreadyProxied = finalUrl.includes('/api/stream-proxy');

      if (!isAlreadyProxied) {
        console.log('[VideoPlayer] Source requires proxy, rewriting URL...');
        // Use directUrl if available to ensure we're proxying the raw URL
        const targetUrl = newSource.directUrl || newSource.url;

        const proxyParams = new URLSearchParams({
          url: targetUrl,
          source: provider === 'moviesapi' ? 'moviesapi' : '2embed',
          referer: newSource.referer || ''
        });
        finalUrl = `/api/stream-proxy?${proxyParams.toString()}`;
      } else {
        console.log('[VideoPlayer] Source already proxied, using as is');
      }
    }

    setStreamUrl(finalUrl);
    setShowSettings(false);

    // The useEffect will reinitialize HLS with the new URL
    // and we'll restore the time and subtitles after it loads
    setTimeout(() => {
      if (videoRef.current) {
        if (savedTime > 0) {
          videoRef.current.currentTime = savedTime;
          videoRef.current.play().catch(e => console.log('[VideoPlayer] Autoplay prevented:', e));
        }

        // Reload subtitles if they were enabled
        const preferences = getSubtitlePreferences();
        if (preferences.enabled && currentSubtitle && availableSubtitles.length > 0) {
          const currentSub = availableSubtitles.find(sub => sub.id === currentSubtitle);
          if (currentSub) {
            console.log('[VideoPlayer] Reloading subtitle after source change');
            loadSubtitle(currentSub);
          }
        }
      }
    }, 1000);

    trackInteraction({
      element: 'source_selector',
      action: 'click',
      context: {
        action_type: 'source_change',
        source: newSource.quality,
        contentId: tmdbId,
      },
    });
  };

  const handleResume = () => {
    if (videoRef.current && savedProgress > 0) {
      videoRef.current.currentTime = savedProgress;
      videoRef.current.play().catch(e => console.log('[VideoPlayer] Autoplay prevented:', e));
    }
    setShowResumePrompt(false);

    trackInteraction({
      element: 'resume_prompt',
      action: 'click',
      context: {
        action_type: 'resume',
        resumeTime: savedProgress,
        contentId: tmdbId,
      },
    });
  };

  const handleStartOver = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(e => console.log('[VideoPlayer] Autoplay prevented:', e));
    }
    setShowResumePrompt(false);

    trackInteraction({
      element: 'resume_prompt',
      action: 'click',
      context: {
        action_type: 'start_over',
        contentId: tmdbId,
      },
    });
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSettings(false);
        setShowSubtitles(false);
      }, 3000);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (error) {
    const handleRetry = () => {
      setError(null);
      setIsLoading(true);
      fetchedRef.current = false;

      // Trigger re-fetch
      const fetchStream = async () => {
        try {
          const params = new URLSearchParams({
            tmdbId,
            type: mediaType,
            provider,
          });

          if (mediaType === 'tv' && season && episode) {
            params.append('season', season.toString());
            params.append('episode', episode.toString());
          }

          const response = await fetch(`/api/stream/extract?${params}`);
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.message || data.error || 'Failed to load stream');
          }

          let sources = [];

          if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) {
            sources = data.sources;
          } else if (data.data?.sources && Array.isArray(data.data.sources) && data.data.sources.length > 0) {
            sources = data.data.sources;
          } else if (data.url || data.streamUrl) {
            sources = [{
              quality: 'auto',
              url: data.url || data.streamUrl
            }];
          }

          if (sources.length > 0) {
            setAvailableSources(sources);
            setCurrentSourceIndex(0);
            setStreamUrl(sources[0].url);
            setError(null);
          } else {
            throw new Error('No stream sources available');
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load video');
        } finally {
          setIsLoading(false);
        }
      };

      fetchStream();
    };

    const handleTryNextSource = () => {
      const nextIndex = currentSourceIndex + 1;
      if (nextIndex < availableSources.length) {
        setError(null);
        changeSource(nextIndex);
      } else {
        handleRetry();
      }
    };

    return (
      <div className={styles.error}>
        <div className={styles.errorContent}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Unable to load video</h3>
          <p>{error}</p>
          <div className={styles.errorActions}>
            {currentSourceIndex + 1 < availableSources.length && (
              <button onClick={handleTryNextSource} className={styles.retryButton}>
                Try Alternative Source ({currentSourceIndex + 2}/{availableSources.length})
              </button>
            )}
            <button onClick={handleRetry} className={styles.retryButton}>
              Retry
            </button>
          </div>

          {/* Server Selection on Error Screen */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', width: '100%' }}>
            <p style={{ marginBottom: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>Switch Server</p>
            <div className={styles.tabsContainer} style={{ justifyContent: 'center', marginBottom: 0 }}>
              <button
                className={`${styles.tab} ${provider === '2embed' ? styles.active : ''}`}
                onClick={() => {
                  if (provider !== '2embed') {
                    setPendingProvider('2embed');
                    setShowProviderConfirmation(true);
                  }
                }}
                style={{ flex: '0 1 120px' }}
              >
                Server 1
              </button>
              <button
                className={`${styles.tab} ${provider === 'moviesapi' ? styles.active : ''}`}
                onClick={() => {
                  if (provider !== 'moviesapi') {
                    setPendingProvider('moviesapi');
                    setShowProviderConfirmation(true);
                  }
                }}
                style={{ flex: '0 1 120px' }}
              >
                Server 2
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${styles.playerContainer} ${!showControls && isPlaying ? styles.hideCursor : ''}`}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={togglePlay}
    >
      {(isLoading || isBuffering) && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>{isLoading ? 'Loading video...' : 'Buffering...'}</p>
          {isLoading && (
            <div className={styles.loadingHint}>
              <small>Extracting best quality source...</small>
            </div>
          )}
        </div>
      )}

      {/* Volume Indicator */}
      {showVolumeIndicator && (
        <div className={styles.volumeIndicator}>
          <div className={styles.volumeIndicatorIcon}>
            {isMuted || volume === 0 ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
            )}
          </div>
          <div className={styles.volumeIndicatorBar}>
            <div
              className={styles.volumeIndicatorFill}
              style={{ height: `${isMuted ? 0 : volume * 100}%` }}
            />
          </div>
          <div className={styles.volumeIndicatorText}>
            {Math.round((isMuted ? 0 : volume) * 100)}%
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        className={styles.video}
        playsInline
      />

      {/* Next Episode Button */}
      {showNextEpisodeButton && nextEpisode && (
        <button
          className={styles.nextEpisodeButton}
          onClick={(e) => {
            e.stopPropagation();
            if (onNextEpisode) onNextEpisode();
          }}
        >
          <span className={styles.nextEpisodeLabel}>Up Next</span>
          <span className={styles.nextEpisodeTitle}>
            {nextEpisode.title || `Episode ${nextEpisode.episode}`}
          </span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
      )}

      {/* Controls */}
      <div className={`${styles.controls} ${showControls || !isPlaying ? styles.visible : ''}`}>
        {/* Progress bar */}
        <div className={styles.progressContainer} onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const pos = (e.clientX - rect.left) / rect.width;
          seek(pos * duration);
        }}>
          <div className={styles.progressBuffered} style={{ width: `${buffered}%` }} />
          <div className={styles.progressFilled} style={{ width: `${(currentTime / duration) * 100}%` }} />
          <div className={styles.progressThumb} style={{ left: `${(currentTime / duration) * 100}%` }} />
        </div>

        {/* Control buttons */}
        <div className={styles.controlsRow}>
          <div className={styles.leftControls}>
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className={styles.btn}>
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

            <button onClick={(e) => { e.stopPropagation(); seek(currentTime - 10); }} className={styles.btn}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                <text x="9" y="15" fontSize="8" fill="white" fontWeight="bold">10</text>
              </svg>
            </button>

            <button onClick={(e) => { e.stopPropagation(); seek(currentTime + 10); }} className={styles.btn}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
                <text x="9" y="15" fontSize="8" fill="white" fontWeight="bold">10</text>
              </svg>
            </button>

            <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className={styles.btn}>
              {isMuted || volume === 0 ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
              )}
            </button>

            <div className={styles.volumeContainer} onClick={(e) => e.stopPropagation()}>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume * 100}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className={styles.volumeSlider}
                style={{ '--volume-percent': `${isMuted ? 0 : volume * 100}%` } as React.CSSProperties}
              />
            </div>

            <span className={styles.time}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className={styles.rightControls}>
            {/* CC Button for Subtitles */}
            <div className={styles.settingsContainer}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSubtitles(!showSubtitles);
                  setShowSettings(false);
                }}
                className={`${styles.btn} ${currentSubtitle ? styles.active : ''}`}
                title="Subtitles"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z" />
                </svg>
              </button>

              {showSubtitles && (
                <div className={styles.settingsMenu} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.settingsSection}>
                    <div className={styles.settingsLabel}>Subtitles</div>
                    <button
                      className={`${styles.settingsOption} ${!currentSubtitle ? styles.active : ''}`}
                      onClick={() => loadSubtitle(null)}
                    >
                      Off
                    </button>
                    {subtitlesLoading ? (
                      <div style={{ padding: '0.75rem 1rem', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                        Loading subtitles...
                      </div>
                    ) : availableSubtitles.length > 0 ? (
                      <div className={styles.sourcesList}>
                        {availableSubtitles.map((subtitle, index) => (
                          <button
                            key={index}
                            className={`${styles.settingsOption} ${currentSubtitle === subtitle.id ? styles.active : ''}`}
                            onClick={() => loadSubtitle(subtitle)}
                            title={`${subtitle.language} - ${subtitle.fileName || 'Subtitle'}`}
                          >
                            {subtitle.language}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '0.75rem 1rem', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                        No subtitles available
                      </div>
                    )}

                    {/* Subtitle Customization Button */}
                    <button
                      className={styles.settingsOption}
                      onClick={() => {
                        setShowSubtitleCustomization(!showSubtitleCustomization);
                        setShowSubtitles(false);
                      }}
                      style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '0.5rem', paddingTop: '0.75rem' }}
                    >
                      ⚙️ Customize Appearance
                    </button>
                  </div>
                </div>
              )}

              {/* Subtitle Customization Menu */}
              {showSubtitleCustomization && (
                <div className={styles.settingsMenu} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.settingsSection}>
                    <div className={styles.settingsLabel}>Subtitle Appearance</div>

                    {/* Font Size */}
                    <div style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                        Font Size: {subtitleStyle.fontSize}%
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="200"
                        value={subtitleStyle.fontSize}
                        onChange={(e) => updateSubtitleStyle({ fontSize: Number(e.target.value) })}
                        className={styles.volumeSlider}
                        style={{ width: '100%' }}
                      />
                    </div>

                    {/* Background Opacity */}
                    <div style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                        Background Opacity: {subtitleStyle.backgroundOpacity}%
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={subtitleStyle.backgroundOpacity}
                        onChange={(e) => updateSubtitleStyle({ backgroundOpacity: Number(e.target.value) })}
                        className={styles.volumeSlider}
                        style={{ width: '100%' }}
                      />
                    </div>

                    {/* Text Color */}
                    <div style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                        Text Color
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {['#ffffff', '#ffff00', '#00ff00', '#00ffff', '#ff00ff'].map(color => (
                          <button
                            key={color}
                            onClick={() => updateSubtitleStyle({ textColor: color })}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '4px',
                              backgroundColor: color,
                              border: subtitleStyle.textColor === color ? '2px solid #e50914' : '2px solid rgba(255, 255, 255, 0.3)',
                              cursor: 'pointer',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Vertical Position */}
                    <div style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                        Vertical Position: {subtitleStyle.verticalPosition}% {subtitleStyle.verticalPosition < 30 ? '(Top)' : subtitleStyle.verticalPosition > 70 ? '(Bottom)' : '(Middle)'}
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={subtitleStyle.verticalPosition}
                        onChange={(e) => updateSubtitleStyle({ verticalPosition: Number(e.target.value) })}
                        className={styles.volumeSlider}
                        style={{ width: '100%' }}
                      />
                    </div>

                    {/* Back Button */}
                    <button
                      className={styles.settingsOption}
                      onClick={() => {
                        setShowSubtitleCustomization(false);
                        setShowSubtitles(true);
                      }}
                      style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '0.5rem' }}
                    >
                      ← Back to Subtitles
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Settings Button (Quality Only) */}
            {availableSources.length > 1 && (
              <div className={styles.settingsContainer}>
                <button onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(!showSettings);
                  setShowSubtitles(false);
                  setShowServerMenu(false);
                }} className={styles.btn} title="Quality">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                  </svg>
                </button>

                {showSettings && (
                  <div className={styles.settingsMenu} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.settingsSection}>
                      <div className={styles.settingsLabel}>Quality</div>
                      <div className={styles.sourcesList}>
                        {availableSources.map((source, index) => (
                          <button
                            key={index}
                            className={`${styles.settingsOption} ${currentSourceIndex === index ? styles.active : ''}`}
                            onClick={() => changeSource(index)}
                          >
                            {source.title || source.quality}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className={styles.btn}>
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

      {/* Server Selection (Cloud Icon) */}
      {(showControls || !isPlaying) && (
        <div style={{
          position: 'absolute',
          top: '2rem',
          right: '2rem',
          zIndex: 20,
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowServerMenu(!showServerMenu);
              setShowSettings(false);
              setShowSubtitles(false);
            }}
            className={styles.btn}
            style={{
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
              padding: '0.75rem',
              borderRadius: '50%'
            }}
            title="Servers"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.5 19c0-3.037-2.463-5.5-5.5-5.5S6.5 15.963 6.5 19" />
              <path d="M17.5 19c2.485 0 4.5-2.015 4.5-4.5S19.985 10 17.5 10c-.163 0-.322.01-.48.028C16.54 6.608 13.567 4 10 4 5.582 4 2 7.582 2 12c0 3.657 2.475 6.72 5.91 7.68" />
            </svg>
          </button>

          {showServerMenu && (
            <div className={styles.settingsMenu} style={{ top: '100%', right: 0, bottom: 'auto', marginTop: '0.5rem', minWidth: '280px' }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.settingsSection}>
                <div className={styles.settingsLabel}>Server Selection</div>

                {/* Tabs */}
                <div className={styles.tabsContainer}>
                  <button
                    className={`${styles.tab} ${provider === '2embed' ? styles.active : ''}`}
                    onClick={() => {
                      if (provider !== '2embed') {
                        setPendingProvider('2embed');
                        setShowProviderConfirmation(true);
                        setShowServerMenu(false);
                      }
                    }}
                  >
                    Server 1
                  </button>
                  <button
                    className={`${styles.tab} ${provider === 'moviesapi' ? styles.active : ''}`}
                    onClick={() => {
                      if (provider !== 'moviesapi') {
                        setPendingProvider('moviesapi');
                        setShowProviderConfirmation(true);
                        setShowServerMenu(false);
                      }
                    }}
                  >
                    Server 2
                  </button>
                </div>

                {/* Content Area */}
                <div className={styles.sourcesList}>
                  {isLoading ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                      Loading sources...
                    </div>
                  ) : availableSources.length > 0 ? (
                    availableSources.map((source, index) => (
                      <button
                        key={index}
                        className={`${styles.settingsOption} ${currentSourceIndex === index ? styles.active : ''}`}
                        onClick={() => changeSource(index)}
                        style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}
                      >
                        {source.title || source.quality}
                      </button>
                    ))
                  ) : (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                      No sources available
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Title overlay */}
      {title && title.trim() && title !== 'Loading...' && title !== 'Unknown' && (showControls || !isPlaying) && (
        <div className={styles.titleOverlay}>
          <div className={styles.titleContent}>
            <h2>{title}</h2>
            {mediaType === 'tv' && season && episode && (
              <div className={styles.episodeInfo}>
                Season {season} • Episode {episode}
              </div>
            )}
            {duration > 0 && (
              <div className={styles.progressInfo}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Center play button */}
      {!isPlaying && !isLoading && !showResumePrompt && (
        <button className={styles.centerPlayButton} onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

      {/* Resume prompt */}
      {showResumePrompt && (
        <div className={styles.resumePrompt} onClick={(e) => e.stopPropagation()}>
          <div className={styles.resumePromptContent}>
            <h3>Resume Playback?</h3>
            <p>Continue from {formatTime(savedProgress)}</p>
            <div className={styles.resumePromptButtons}>
              <button onClick={handleStartOver} className={styles.resumeButton}>
                Start Over
              </button>
              <button onClick={handleResume} className={`${styles.resumeButton} ${styles.resumeButtonPrimary}`}>
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server Switch Confirmation Dialog */}
      {showProviderConfirmation && pendingProvider && (
        <div className={styles.dialogOverlay}>
          <div className={styles.dialog}>
            <h3>Switch Server?</h3>
            <p>
              Are you sure you want to switch to <strong>{pendingProvider === '2embed' ? 'Server 1' : 'Server 2'}</strong>?
              The current video will stop playing.
            </p>
            <div className={styles.dialogButtons}>
              <button
                className={styles.cancelButton}
                onClick={() => {
                  setShowProviderConfirmation(false);
                  setPendingProvider(null);
                }}
              >
                Cancel
              </button>
              <button
                className={styles.confirmButton}
                onClick={() => {
                  if (pendingProvider) {
                    setProvider(pendingProvider);
                    setError(null);
                    setIsLoading(true);
                    setStreamUrl(null);
                    setAvailableSources([]);
                  }
                  setShowProviderConfirmation(false);
                  setPendingProvider(null);
                }}
              >
                Switch Server
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
