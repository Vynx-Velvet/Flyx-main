'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { useAnalytics } from '../analytics/AnalyticsProvider';
import { useWatchProgress } from '@/lib/hooks/useWatchProgress';
import { trackWatchStart, trackWatchProgress, trackWatchPause, trackWatchComplete } from '@/lib/utils/live-activity';
import { getSubtitlePreferences, setSubtitlesEnabled, setSubtitleLanguage, getSubtitleStyle, setSubtitleStyle, type SubtitleStyle } from '@/lib/utils/subtitle-preferences';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { useCast, CastMedia } from '@/hooks/useCast';
import { CastOverlay } from './CastButton';
import { getStreamProxyUrl } from '@/app/lib/proxy-config';
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

  const subtitlesFetchedRef = useRef(false);
  const subtitlesAutoLoadedRef = useRef(false);
  const hasShownResumePromptRef = useRef(false);
  const triedProvidersRef = useRef<Set<string>>(new Set());

  // Analytics and progress tracking
  const { trackContentEngagement, trackInteraction, updateWatchTime, recordPause, clearWatchTime } = useAnalytics();
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
  const [provider, setProvider] = useState('videasy'); // Default to videasy (primary provider with multi-language)
  const [menuProvider, setMenuProvider] = useState('videasy');
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [sourcesCache, setSourcesCache] = useState<Record<string, any[]>>({});
  const [loadingProviders, setLoadingProviders] = useState<Record<string, boolean>>({});
  const [isCastOverlayVisible, setIsCastOverlayVisible] = useState(false);
  const [providerAvailability, setProviderAvailability] = useState<Record<string, boolean>>({
    videasy: true, // Primary provider - always enabled
    vidsrc: false, // Disabled by default until we check
  });
  const [highlightServerButton, setHighlightServerButton] = useState(false);

  // HLS quality levels
  const [hlsLevels, setHlsLevels] = useState<{ height: number; bitrate: number; index: number }[]>([]);
  const [currentHlsLevel, setCurrentHlsLevel] = useState<number>(-1); // -1 = auto
  const [currentResolution, setCurrentResolution] = useState<string>('');

  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const lastFetchedKey = useRef('');
  const volumeIndicatorTimeoutRef = useRef<NodeJS.Timeout>();

  // Pinch-to-zoom for mobile
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomIndicatorTimeoutRef = useRef<NodeJS.Timeout>();

  const handleZoomChange = useCallback((scale: number) => {
    if (scale !== 1) {
      setShowZoomIndicator(true);
      if (zoomIndicatorTimeoutRef.current) {
        clearTimeout(zoomIndicatorTimeoutRef.current);
      }
      zoomIndicatorTimeoutRef.current = setTimeout(() => {
        setShowZoomIndicator(false);
      }, 1500);
    }
  }, []);

  // Single tap handler for mobile:
  // - If paused and controls visible: unpause
  // - If paused and controls hidden: show controls (don't unpause yet)
  // - If playing: pause
  const handleSingleTap = useCallback(() => {
    if (!videoRef.current) return;
    
    const isPaused = videoRef.current.paused;
    
    if (isPaused) {
      // Video is paused
      if (showControls) {
        // Controls are visible, so unpause
        videoRef.current.play();
      } else {
        // Controls are hidden, just show them first
        setShowControls(true);
      }
    } else {
      // Video is playing, pause it
      videoRef.current.pause();
    }
  }, [showControls]);

  const {
    scale: zoomScale,
    isZoomed,
    resetZoom,
    containerProps: zoomContainerProps,
    contentStyle: zoomContentStyle,
  } = usePinchZoom({
    minScale: 1,
    maxScale: 4,
    onZoomChange: handleZoomChange,
    onSingleTap: handleSingleTap,
  });

  // Cast to TV functionality
  const cast = useCast({
    onConnect: () => {
      console.log('[VideoPlayer] Cast connected');
    },
    onDisconnect: () => {
      console.log('[VideoPlayer] Cast disconnected');
      setIsCastOverlayVisible(false);
    },
    onError: (error) => {
      console.error('[VideoPlayer] Cast error:', error);
    },
  });

  // Build cast media object
  const getCastMedia = useCallback((): CastMedia | undefined => {
    if (!streamUrl) return undefined;
    
    const episodeInfo = mediaType === 'tv' && season && episode 
      ? `S${season}E${episode}` 
      : undefined;
    
    return {
      url: streamUrl.startsWith('/') ? `${window.location.origin}${streamUrl}` : streamUrl,
      title: title || 'Unknown Title',
      subtitle: episodeInfo,
      contentType: 'application/x-mpegURL',
      isLive: false,
      startTime: currentTime > 0 ? currentTime : undefined,
    };
  }, [streamUrl, title, mediaType, season, episode, currentTime]);

  // Handle cast button click
  const handleCastClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (cast.isCasting) {
      cast.stop();
      setIsCastOverlayVisible(false);
    } else if (cast.isConnected) {
      const media = getCastMedia();
      if (media) {
        // Pause local playback
        videoRef.current?.pause();
        const success = await cast.loadMedia(media);
        if (success) {
          setIsCastOverlayVisible(true);
        }
      }
    } else {
      const connected = await cast.requestSession();
      if (connected) {
        const media = getCastMedia();
        if (media) {
          videoRef.current?.pause();
          const success = await cast.loadMedia(media);
          if (success) {
            setIsCastOverlayVisible(true);
          }
        }
      }
    }
  }, [cast, getCastMedia]);

  // Fetch sources for a specific provider
  const fetchSources = async (providerName: string, force: boolean = false): Promise<any[] | null> => {
    // Check cache first
    if (!force && sourcesCache[providerName] && sourcesCache[providerName].length > 0) {
      console.log(`[VideoPlayer] Using cached sources for ${providerName}`);
      return sourcesCache[providerName];
    }

    const currentKey = `${tmdbId}-${mediaType}-${season}-${episode}-${providerName}`;

    // Prevent duplicate fetches in StrictMode if not forcing
    if (!force && lastFetchedKey.current === currentKey) {
      console.log('[VideoPlayer] Skipping duplicate fetch (already fetched)');
      return null;
    }

    lastFetchedKey.current = currentKey;

    // Set loading state for this specific provider
    setLoadingProviders(prev => ({ ...prev, [providerName]: true }));

    if (providerName === provider) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const params = new URLSearchParams({
        tmdbId,
        type: mediaType,
        provider: providerName,
      });

      if (mediaType === 'tv' && season && episode) {
        params.append('season', season.toString());
        params.append('episode', episode.toString());
      }

      console.log(`[VideoPlayer] Fetching sources for ${providerName}:`, `/api/stream/extract?${params}`);

      const response = await fetch(`/api/stream/extract?${params}`, {
        priority: 'high' as RequestPriority,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to load stream');
      }

      let sources: any[] = [];
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
        console.log(`[VideoPlayer] Found ${sources.length} sources for ${providerName}`);

        // Cache the sources for this provider
        setSourcesCache(prev => ({
          ...prev,
          [providerName]: sources
        }));

        // If this is the active provider, update available sources
        if (providerName === provider) {
          setAvailableSources(sources);
        }

        return sources;
      } else {
        throw new Error('No stream sources available');
      }
    } catch (err) {
      console.error(`[VideoPlayer] Error fetching sources for ${providerName}:`, err);
      // Only set error if this is the active provider
      if (providerName === provider) {
        setError(err instanceof Error ? err.message : 'Failed to load video');
      }
      return null;
    } finally {
      setLoadingProviders(prev => ({ ...prev, [providerName]: false }));
      if (providerName === provider) {
        setIsLoading(false);
      }
    }
  };

  // Helper function to fetch from a specific provider
  // No pre-flight validation - let HLS.js handle it with automatic fallback
  const fetchFromProvider = async (providerName: string): Promise<{ sources: any[], provider: string } | null> => {
    const params = new URLSearchParams({
      tmdbId,
      type: mediaType,
      provider: providerName,
    });

    if (mediaType === 'tv' && season && episode) {
      params.append('season', season.toString());
      params.append('episode', episode.toString());
    }

    console.log(`[VideoPlayer] Fetching from ${providerName}...`);

    try {
      const response = await fetch(`/api/stream/extract?${params}`, { priority: 'high' as RequestPriority });
      const data = await response.json();

      if (data.sources && data.sources.length > 0) {
        console.log(`[VideoPlayer] ${providerName} returned ${data.sources.length} sources`);
        return { sources: data.sources, provider: providerName };
      }
      
      console.log(`[VideoPlayer] ${providerName} failed: ${data.error || 'No sources'}`);
      return null;
    } catch (err) {
      console.error(`[VideoPlayer] ${providerName} error:`, err);
      return null;
    }
  };

  // Initial fetch with automatic provider fallback
  useEffect(() => {
    // Reset subtitle auto-load flag for new video
    subtitlesAutoLoadedRef.current = false;
    hasShownResumePromptRef.current = false;
    triedProvidersRef.current.clear(); // Reset tried providers for new content

    // Clear cache when content changes
    setSourcesCache({});
    
    // Reset lastFetchedKey to allow fresh fetch
    lastFetchedKey.current = '';
    setLoadingProviders({});
    setIsLoading(true);
    setError(null);
    setHighlightServerButton(false);
    setStreamUrl(null);

    const initializePlayer = async () => {
      // First fetch provider availability
      let availability = {
        videasy: true, // Primary provider - always enabled
        vidsrc: false,
      };

      try {
        const res = await fetch('/api/providers');
        const data = await res.json();
        availability = {
          videasy: data.providers?.videasy?.enabled ?? true,
          vidsrc: data.providers?.vidsrc?.enabled ?? false,
        };
        setProviderAvailability(availability);
      } catch (err) {
        console.warn('[VideoPlayer] Failed to fetch provider availability:', err);
      }

      // Build provider priority list - Videasy FIRST (primary with multi-language support)
      const providerOrder: string[] = [];
      providerOrder.push('videasy'); // Always try Videasy first
      if (availability.vidsrc) providerOrder.push('vidsrc'); // VidSrc as fallback

      console.log(`[VideoPlayer] Provider order: ${providerOrder.join(' → ')}`);

      // Try each provider in order until one works
      let result: { sources: any[], provider: string } | null = null;
      
      for (const providerName of providerOrder) {
        result = await fetchFromProvider(providerName);
        if (result) {
          break;
        }
        console.log(`[VideoPlayer] ${providerName} failed, trying next provider...`);
      }

      if (!result) {
        console.error('[VideoPlayer] All providers failed');
        setError('No streams available from any provider');
        setIsLoading(false);
        setHighlightServerButton(true);
        return;
      }

      const { sources, provider: successfulProvider } = result;
      console.log(`[VideoPlayer] Success! Got ${sources.length} sources from ${successfulProvider}`);

      // Update state with successful provider
      setProvider(successfulProvider);
      setMenuProvider(successfulProvider);
      setSourcesCache(prev => ({ ...prev, [successfulProvider]: sources }));
      setAvailableSources(sources);
      setCurrentSourceIndex(0);
      lastFetchedKey.current = `${tmdbId}-${mediaType}-${season}-${episode}-${successfulProvider}`;

      // Setup initial stream URL
      const initialSource = sources[0];
      console.log('[VideoPlayer] Initial source:', {
        title: initialSource.title,
        url: initialSource.url?.substring(0, 100),
        status: initialSource.status,
        requiresSegmentProxy: initialSource.requiresSegmentProxy,
      });
      
      // Check if the source has a valid URL
      if (!initialSource.url) {
        console.error('[VideoPlayer] Initial source has no URL!');
        setError('No stream URL available');
        setIsLoading(false);
        return;
      }
      
      let finalUrl = initialSource.url;

      if (initialSource.requiresSegmentProxy) {
        const isAlreadyProxied = finalUrl.includes('/api/stream-proxy') || finalUrl.includes('/stream/?url=');
        console.log('[VideoPlayer] Proxy check:', { requiresSegmentProxy: true, isAlreadyProxied });
        if (!isAlreadyProxied) {
          const targetUrl = initialSource.directUrl || initialSource.url;
          finalUrl = getStreamProxyUrl(targetUrl, successfulProvider, initialSource.referer || '');
          console.log('[VideoPlayer] Applied proxy to URL');
        }
      }
      
      console.log('[VideoPlayer] Setting stream URL:', finalUrl.substring(0, 100) + '...');
      setStreamUrl(finalUrl);
      setIsLoading(false);
    };

    initializePlayer();
  }, [tmdbId, mediaType, season, episode]);

  // Initialize HLS
  useEffect(() => {
    if (!streamUrl || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    console.log('[VideoPlayer] Initializing HLS with URL:', streamUrl);

    if (streamUrl.includes('.m3u8') || streamUrl.includes('stream-proxy') || streamUrl.includes('/stream/')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 60 * 1000 * 1000,
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 2,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 3,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 2,
          manifestLoadingRetryDelay: 500,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 2,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 3,
          startLevel: -1,
          // @ts-ignore
          xhrSetup: (xhr: any, url: any) => {
            xhr.withCredentials = false;
          },
        } as any);

        console.log('[HLS] Created HLS instance, loading source...');
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        console.log('[HLS] Source loaded and media attached');

        // Debug: Log all HLS events
        hls.on(Hls.Events.MANIFEST_LOADING, () => {
          console.log('[HLS] Loading manifest...');
        });
        
        hls.on(Hls.Events.MANIFEST_LOADED, (_event, data) => {
          console.log('[HLS] Manifest loaded:', data.levels?.length, 'levels');
        });

        hls.on(Hls.Events.LEVEL_LOADING, (_event, data) => {
          console.log('[HLS] Loading level:', data.level);
        });

        hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
          console.log('[HLS] Level loaded:', data.level, 'fragments:', data.details?.fragments?.length);
        });

        hls.on(Hls.Events.FRAG_LOADING, (_event, data) => {
          console.log('[HLS] Loading fragment:', data.frag?.sn);
        });

        hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
          console.log('[HLS] Fragment loaded:', data.frag?.sn, 'bytes:', data.payload?.byteLength);
          
          // Mark current source as confirmed working when first fragment loads
          if (data.frag?.sn === 0 || data.frag?.sn === 1) {
            setAvailableSources(prev => {
              const updated = [...prev];
              if (updated[currentSourceIndex] && updated[currentSourceIndex].status !== 'working') {
                console.log(`[VideoPlayer] Confirming source ${currentSourceIndex} (${updated[currentSourceIndex].title}) as WORKING`);
                updated[currentSourceIndex] = { ...updated[currentSourceIndex], status: 'working' };
                setSourcesCache(prevCache => ({ ...prevCache, [provider]: updated }));
              }
              return updated;
            });
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // Extract available quality levels
          if (hls.levels && hls.levels.length > 0) {
            const levels = hls.levels.map((level, index) => ({
              height: level.height || 0,
              bitrate: level.bitrate || 0,
              index
            })).filter(l => l.height > 0).sort((a, b) => b.height - a.height);
            
            // Remove duplicates by height
            const uniqueLevels = levels.filter((level, idx, arr) => 
              arr.findIndex(l => l.height === level.height) === idx
            );
            
            setHlsLevels(uniqueLevels);
            console.log('[VideoPlayer] HLS quality levels:', uniqueLevels);
          }
          
          if (currentSubtitle && availableSubtitles.length > 0) {
            const currentSub = availableSubtitles.find(sub => sub.id === currentSubtitle);
            if (currentSub) {
              setTimeout(() => {
                loadSubtitle(currentSub);
              }, 100);
            }
          }
          video.play().catch(e => console.log('[VideoPlayer] Autoplay prevented:', e));
        });

        // Track current level changes
        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          const level = hls.levels[data.level];
          if (level && level.height) {
            setCurrentResolution(`${level.height}p`);
          }
        });

        hls.on(Hls.Events.ERROR, async (_event, data) => {
          console.error('[HLS] Error:', {
            type: data.type,
            details: data.details,
            fatal: data.fatal,
            url: data.url,
            response: data.response,
            reason: data.reason,
            networkDetails: data.networkDetails,
            frag: data.frag ? { sn: data.frag.sn, url: data.frag.url } : null,
          });
          
          // Log the actual response if available
          if (data.response) {
            console.error('[HLS] Response details:', {
              code: data.response.code,
              text: data.response.text,
            });
          }
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('[HLS] Fatal network error, trying next source...', data);
                setIsLoading(true);
                setError(null);
                
                // Mark the CURRENT source as 'down' since it failed
                // Use functional updates to avoid stale closure issues
                setAvailableSources(prevSources => {
                  const updatedSources = [...prevSources];
                  if (updatedSources[currentSourceIndex]) {
                    console.log(`[VideoPlayer] Marking source ${currentSourceIndex} (${updatedSources[currentSourceIndex].title}) as DOWN`);
                    updatedSources[currentSourceIndex] = { 
                      ...updatedSources[currentSourceIndex], 
                      status: 'down' 
                    };
                    // Also update the cache
                    setSourcesCache(prev => ({ ...prev, [provider]: updatedSources }));
                  }
                  return updatedSources;
                });
                
                // Try to find and fetch the next available source
                const tryNextSource = async () => {
                  // Get current sources from state (may be stale in closure, but we'll work with what we have)
                  const currentSources = availableSources;
                  const currentIdx = currentSourceIndex;
                  
                  // Look for next source to try
                  for (let i = currentIdx + 1; i < currentSources.length; i++) {
                    const nextSource = currentSources[i];
                    
                    // If source has a URL, use it directly
                    if (nextSource.url && nextSource.url !== '') {
                      console.log(`[VideoPlayer] Trying source ${i}: ${nextSource.title} (has URL)`);
                      setCurrentSourceIndex(i);
                      setStreamUrl(nextSource.url);
                      return true;
                    }
                    
                    // Source doesn't have URL - need to fetch it from API
                    if (nextSource.title && provider === 'videasy') {
                      console.log(`[VideoPlayer] Fetching source ${i}: ${nextSource.title}...`);
                      
                      // Extract source name from title (e.g., "Neon (English)" -> "Neon")
                      const sourceName = nextSource.title.split(' (')[0];
                      
                      try {
                        const params = new URLSearchParams({
                          tmdbId,
                          type: mediaType,
                          provider: 'videasy',
                          source: sourceName,
                        });
                        
                        if (mediaType === 'tv' && season && episode) {
                          params.append('season', season.toString());
                          params.append('episode', episode.toString());
                        }
                        
                        const response = await fetch(`/api/stream/extract?${params}`);
                        const data = await response.json();
                        
                        if (data.sources && data.sources[0]?.url) {
                          console.log(`[VideoPlayer] ✓ ${sourceName} fetched successfully`);
                          
                          // Update the source in our list - use functional update
                          setAvailableSources(prev => {
                            const updatedSources = [...prev];
                            updatedSources[i] = { ...updatedSources[i], ...data.sources[0], status: 'working' };
                            setSourcesCache(prevCache => ({ ...prevCache, [provider]: updatedSources }));
                            return updatedSources;
                          });
                          
                          setCurrentSourceIndex(i);
                          setStreamUrl(data.sources[0].url);
                          return true;
                        } else {
                          console.log(`[VideoPlayer] ✗ ${sourceName} failed, trying next...`);
                          // Mark as down and continue - update both state and cache
                          setAvailableSources(prev => {
                            const updatedSources = [...prev];
                            updatedSources[i] = { ...updatedSources[i], status: 'down' };
                            setSourcesCache(prevCache => ({ ...prevCache, [provider]: updatedSources }));
                            return updatedSources;
                          });
                        }
                      } catch (err) {
                        console.error(`[VideoPlayer] Error fetching ${sourceName}:`, err);
                      }
                    }
                  }
                  
                  // No more sources in current provider, try other providers
                  console.log(`[VideoPlayer] All ${provider} sources exhausted, trying other providers...`);
                  
                  const fallbackProviders: string[] = [];
                  if (provider !== 'vidsrc' && providerAvailability.vidsrc) fallbackProviders.push('vidsrc');
                  
                  for (const fallbackProvider of fallbackProviders) {
                    if (triedProvidersRef.current.has(fallbackProvider)) continue;
                    
                    console.log(`[VideoPlayer] Trying fallback: ${fallbackProvider}`);
                    triedProvidersRef.current.add(fallbackProvider);
                    
                    const result = await fetchFromProvider(fallbackProvider);
                    if (result && result.sources.length > 0 && result.sources[0].url) {
                      console.log(`[VideoPlayer] ✓ ${fallbackProvider} works!`);
                      setProvider(fallbackProvider);
                      setMenuProvider(fallbackProvider);
                      setSourcesCache(prev => ({ ...prev, [fallbackProvider]: result.sources }));
                      setAvailableSources(result.sources);
                      setCurrentSourceIndex(0);
                      setStreamUrl(result.sources[0].url);
                      return true;
                    }
                  }
                  
                  return false;
                };
                
                tryNextSource().then(found => {
                  if (!found) {
                    setIsLoading(false);
                    setError('All sources failed. Try selecting a different server.');
                    setHighlightServerButton(true);
                  }
                });
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setError('Fatal error loading video');
                setHighlightServerButton(true);
                break;
            }
          }
        });

        hlsRef.current = hls;

        return () => {
          hls.destroy();
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => console.log('[VideoPlayer] Autoplay prevented:', e));
        });
      }
    } else {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.log('[VideoPlayer] Autoplay prevented:', e));
      });
    }
  }, [streamUrl]);

  // Fetch subtitles when content changes
  useEffect(() => {
    if (subtitlesFetchedRef.current) return;
    subtitlesFetchedRef.current = true;

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
        handleWatchStart(video.currentTime, video.duration);
        trackWatchStart(tmdbId, title || 'Unknown Title', mediaType, season, episode);
      } else {
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
      // Record pause for analytics
      recordPause(tmdbId, season, episode);
      const progress = video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;
      trackWatchPause(tmdbId, title || 'Unknown Title', mediaType, progress, season, episode);
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

      if (nextEpisode && video.duration > 0) {
        const timeRemaining = video.duration - video.currentTime;
        if (timeRemaining <= 90) {
          setShowNextEpisodeButton(true);
        } else {
          setShowNextEpisodeButton(false);
        }
      }

      if (video.duration > 0) {
        handleProgress(video.currentTime, video.duration);
        const progress = (video.currentTime / video.duration) * 100;
        const currentTimeRounded = Math.floor(video.currentTime);

        // Enhanced watch time tracking - update every second when playing
        updateWatchTime({
          contentId: tmdbId,
          contentType: mediaType,
          contentTitle: title,
          seasonNumber: season,
          episodeNumber: episode,
          currentPosition: video.currentTime,
          duration: video.duration,
          isPlaying: !video.paused,
        });

        if (currentTimeRounded > 0 && currentTimeRounded % 30 === 0) {
          trackWatchProgress(tmdbId, title || 'Unknown Title', mediaType, progress, video.currentTime, season, episode);
        }

        if (progress >= 90 && !video.dataset.completionTracked) {
          video.dataset.completionTracked = 'true';
          trackWatchComplete(tmdbId, title || 'Unknown Title', mediaType, video.currentTime, season, episode);
        }
      }
    };

    const handleDurationChange = () => {
      setDuration(video.duration);

      if (hasShownResumePromptRef.current) return;

      const savedTime = loadProgress();
      if (savedTime > 0 && savedTime < video.duration - 30) {
        setSavedProgress(savedTime);
        setShowResumePrompt(true);
        video.pause();
        hasShownResumePromptRef.current = true;
      } else if (video.duration > 0) {
        // Mark as shown even if we didn't show it (e.g. no saved progress)
        // to prevent it from showing later if duration changes again
        hasShownResumePromptRef.current = true;
      }
    };

    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => {
      setIsBuffering(false);
      setIsLoading(false);
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
        onNextEpisode();
      }
    };

    const handleVideoError = (e: Event) => {
      const videoEl = e.target as HTMLVideoElement;
      const error = videoEl.error;
      console.error('[VideoPlayer] Video element error:', {
        code: error?.code,
        message: error?.message,
        MEDIA_ERR_ABORTED: error?.code === 1,
        MEDIA_ERR_NETWORK: error?.code === 2,
        MEDIA_ERR_DECODE: error?.code === 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: error?.code === 4,
      });
    };

    video.addEventListener('error', handleVideoError);
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
      video.removeEventListener('error', handleVideoError);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('ended', handleEnded);
      // Clear watch time tracking on unmount (will sync before clearing)
      clearWatchTime(tmdbId, season, episode);
    };
  }, [tmdbId, season, episode, clearWatchTime]);

  // Fullscreen handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      
      // Unlock orientation when exiting fullscreen (e.g., via Escape key)
      if (!isNowFullscreen && screen.orientation && 'unlock' in screen.orientation) {
        try {
          (screen.orientation as any).unlock();
        } catch (e) {
          // Ignore unlock errors
        }
      }
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

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        
        // Force landscape orientation on mobile devices
        if (screen.orientation && 'lock' in screen.orientation) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch (e) {
            // Orientation lock may not be supported or allowed
            console.log('[VideoPlayer] Could not lock orientation:', e);
          }
        }
      } catch (e) {
        console.error('[VideoPlayer] Fullscreen request failed:', e);
      }
    } else {
      // Unlock orientation when exiting fullscreen
      if (screen.orientation && 'unlock' in screen.orientation) {
        try {
          (screen.orientation as any).unlock();
        } catch (e) {
          // Ignore unlock errors
        }
      }
      document.exitFullscreen();
    }
  };

  const updateSubtitleStyle = (newStyle: Partial<SubtitleStyle>) => {
    const updated = { ...subtitleStyle, ...newStyle };
    setSubtitleStyleState(updated);
    setSubtitleStyle(updated);
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
      if (video.textTracks && video.textTracks.length > 0) {
        const track = video.textTracks[0];
        if (track.cues) {
          for (let i = 0; i < track.cues.length; i++) {
            const cue = track.cues[i] as any;
            if (cue.line !== undefined) {
              cue.line = linePosition;
              cue.snapToLines = false;
            }
          }
        }
      }
    }
  };

  const loadSubtitle = (subtitle: any | null) => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.querySelectorAll('track');
    tracks.forEach(track => track.remove());
    if (subtitle) {
      const proxiedUrl = `/api/subtitle-proxy?url=${encodeURIComponent(subtitle.url)}`;
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = subtitle.language || 'Subtitles';
      track.srclang = subtitle.iso639 || 'en';
      track.src = proxiedUrl;
      track.default = true;
      track.addEventListener('load', () => {
        if (videoRef.current && videoRef.current.textTracks && videoRef.current.textTracks.length > 0) {
          const textTrack = videoRef.current.textTracks[0];
          textTrack.mode = 'showing';
        }
      });
      videoRef.current.appendChild(track);
      setTimeout(() => {
        if (videoRef.current && videoRef.current.textTracks && videoRef.current.textTracks.length > 0) {
          const textTrack = videoRef.current.textTracks[0];
          if (textTrack.mode !== 'showing') {
            textTrack.mode = 'showing';
          }
        }
      }, 500);
      setCurrentSubtitle(subtitle.id);
      setSubtitleLanguage(subtitle.langCode, subtitle.language);
      setSubtitlesEnabled(true);
    } else {
      setCurrentSubtitle(null);
      setSubtitlesEnabled(false);
    }
    setShowSubtitles(false);
  };

  const fetchSubtitles = async (imdbId: string) => {
    try {
      setSubtitlesLoading(true);
      const params = new URLSearchParams({ imdbId });
      if (mediaType === 'tv' && season && episode) {
        params.append('season', season.toString());
        params.append('episode', episode.toString());
      }
      const response = await fetch(`/api/subtitles?${params}`);
      const data = await response.json();
      if (data.success && data.subtitles && Array.isArray(data.subtitles)) {
        setAvailableSubtitles(data.subtitles);
      } else {
        setAvailableSubtitles([]);
      }
    } catch (err) {
      setAvailableSubtitles([]);
    } finally {
      setSubtitlesLoading(false);
    }
  };

  useEffect(() => {
    updateSubtitleStyle(subtitleStyle);
  }, []);

  useEffect(() => {
    if (availableSubtitles.length === 0) return;
    if (subtitlesAutoLoadedRef.current) return;
    const preferences = getSubtitlePreferences();
    if (preferences.enabled) {
      const preferredSubtitle = availableSubtitles.find(sub => sub.langCode === preferences.languageCode);
      if (preferredSubtitle) {
        loadSubtitle(preferredSubtitle);
        subtitlesAutoLoadedRef.current = true;
      } else {
        const englishSubtitle = availableSubtitles.find(sub => sub.langCode === 'eng');
        if (englishSubtitle) {
          loadSubtitle(englishSubtitle);
          subtitlesAutoLoadedRef.current = true;
        }
      }
    }
  }, [availableSubtitles]);

  // Change HLS quality level
  const changeHlsLevel = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentHlsLevel(levelIndex);
      
      if (levelIndex === -1) {
        setCurrentResolution('Auto');
      } else {
        const level = hlsLevels.find(l => l.index === levelIndex);
        if (level) {
          setCurrentResolution(`${level.height}p`);
        }
      }
    }
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    fetchSources(provider, true).then(sources => {
      if (sources && sources.length > 0) {
        setAvailableSources(sources);
        setCurrentSourceIndex(0);
        setStreamUrl(sources[0].url);
      }
    });
  };

  const handleStartOver = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
    setShowResumePrompt(false);
  };

  const handleResume = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = savedProgress;
      videoRef.current.play();
    }
    setShowResumePrompt(false);
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Handle tap to play/pause (separate from zoom gestures)
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only toggle play if clicking directly on the container or video wrapper
    // and not on controls or other interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[class*="settings"]') || target.closest('[class*="controls"]')) {
      return;
    }
    togglePlay();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${styles.playerContainer} ${!showControls && isPlaying ? styles.hideCursor : ''}`}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={handleContainerClick}
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

      {error && (
        <div className={styles.error}>
          <div className={styles.errorContent}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3>Playback Error</h3>
            <p>{error}</p>
            <div className={styles.errorActions}>
              <button onClick={handleRetry} className={styles.retryButton}>
                Retry
              </button>
            </div>
            <div className={styles.serverHint}>
              <p>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.5 19c0-3.037-2.463-5.5-5.5-5.5S6.5 15.963 6.5 19" />
                  <path d="M17.5 19c2.485 0 4.5-2.015 4.5-4.5S19.985 10 17.5 10c-.163 0-.322.01-.48.028C16.54 6.608 13.567 4 10 4 5.582 4 2 7.582 2 12c0 3.657 2.475 6.72 5.91 7.68" />
                </svg>
                Try a different server using the cloud button in the top right
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* Video wrapper for pinch-to-zoom on mobile */}
      <div
        {...zoomContainerProps}
        className={styles.videoWrapper}
      >
        <video
          ref={videoRef}
          className={styles.video}
          style={zoomContentStyle}
          playsInline
        />
      </div>

      {/* Zoom indicator */}
      {showZoomIndicator && (
        <div className={styles.zoomIndicator}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/>
          </svg>
          <span>{Math.round(zoomScale * 100)}%</span>
        </div>
      )}

      {/* Reset zoom button - hides with controls */}
      {isZoomed && (showControls || !isPlaying) && (
        <button
          className={styles.resetZoomButton}
          onClick={(e) => {
            e.stopPropagation();
            resetZoom();
          }}
          title="Reset zoom"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            <path d="M7 9h5v1H7z"/>
          </svg>
          <span>1x</span>
        </button>
      )}

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

      <div className={`${styles.controls} ${showControls || !isPlaying ? styles.visible : ''}`}>
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

              {showSubtitleCustomization && (
                <div className={styles.settingsMenu} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.settingsSection}>
                    <div className={styles.settingsLabel}>Subtitle Appearance</div>
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

            {/* Resolution/Quality button - only for HLS quality levels */}
            <div className={styles.settingsContainer}>
              <button onClick={(e) => {
                e.stopPropagation();
                setShowSettings(!showSettings);
                setShowSubtitles(false);
                setShowServerMenu(false);
              }} className={styles.btn} title="Resolution">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
              </button>

              {showSettings && (
                <div className={styles.settingsMenu} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.settingsSection}>
                    <div className={styles.settingsLabel}>
                      Resolution {currentResolution && <span style={{ opacity: 0.7, fontSize: '0.85em' }}>({currentResolution})</span>}
                    </div>
                    <div className={styles.sourcesList}>
                      {hlsLevels.length > 0 ? (
                        <>
                          <button
                            className={`${styles.settingsOption} ${currentHlsLevel === -1 ? styles.active : ''}`}
                            onClick={() => changeHlsLevel(-1)}
                          >
                            Auto
                          </button>
                          {hlsLevels.map((level) => (
                            <button
                              key={level.index}
                              className={`${styles.settingsOption} ${currentHlsLevel === level.index ? styles.active : ''}`}
                              onClick={() => changeHlsLevel(level.index)}
                            >
                              {level.height}p
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className={styles.settingsOption} style={{ opacity: 0.6, cursor: 'default' }}>
                          {currentResolution || 'Auto'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cast to TV button */}
            {cast.isAvailable && (
              <button 
                onClick={handleCastClick} 
                className={`${styles.btn} ${cast.isCasting ? styles.active : ''}`}
                title={cast.isCasting ? 'Stop casting' : 'Cast to TV'}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  {cast.isCasting ? (
                    <>
                      <path d="M1 18v3h3c0-1.66-1.34-3-3-3z" />
                      <path d="M1 14v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z" />
                      <path d="M1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z" />
                      <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                      <path d="M5 7v2h12v8h-4v2h6V7z" opacity="0.3" />
                    </>
                  ) : (
                    <>
                      <path d="M1 18v3h3c0-1.66-1.34-3-3-3z" />
                      <path d="M1 14v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z" />
                      <path d="M1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z" />
                      <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                    </>
                  )}
                </svg>
              </button>
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
              setHighlightServerButton(false); // Clear highlight when clicked
              // Initialize menu provider to current provider when opening
              if (!showServerMenu) {
                setMenuProvider(provider);
              }
            }}
            className={`${styles.btn} ${highlightServerButton ? styles.serverButtonHighlight : ''}`}
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

                <div className={styles.tabsContainer}>
                  <button
                    className={`${styles.tab} ${menuProvider === 'videasy' ? styles.active : ''}`}
                    onClick={() => {
                      setMenuProvider('videasy');
                      fetchSources('videasy');
                    }}
                  >
                    Videasy
                  </button>
                  {providerAvailability.vidsrc && (
                    <button
                      className={`${styles.tab} ${menuProvider === 'vidsrc' ? styles.active : ''}`}
                      onClick={() => {
                        setMenuProvider('vidsrc');
                        fetchSources('vidsrc');
                      }}
                    >
                      VidSrc
                    </button>
                  )}
                </div>

                <div className={styles.sourcesList}>
                  {loadingProviders[menuProvider] ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                      Loading sources...
                    </div>
                  ) : sourcesCache[menuProvider] && sourcesCache[menuProvider].length > 0 ? (
                    sourcesCache[menuProvider].map((source, index) => (
                      <button
                        key={index}
                        className={`${styles.settingsOption} ${provider === menuProvider && currentSourceIndex === index ? styles.active : ''}`}
                        onClick={async () => {
                          // If source has "unknown" status (not yet fetched), fetch it first
                          if (source.status === 'unknown' && menuProvider === 'videasy') {
                            console.log(`[VideoPlayer] Fetching unknown source: ${source.title}`);
                            setIsLoading(true);
                            setShowServerMenu(false);
                            
                            // Extract source name from title (e.g., "Neon (English)" -> "Neon")
                            const sourceName = source.title?.split(' (')[0] || source.title;
                            
                            try {
                              const params = new URLSearchParams({
                                tmdbId,
                                type: mediaType,
                                provider: 'videasy',
                                source: sourceName,
                              });
                              if (mediaType === 'tv' && season && episode) {
                                params.append('season', season.toString());
                                params.append('episode', episode.toString());
                              }
                              
                              const response = await fetch(`/api/stream/extract?${params}`);
                              const data = await response.json();
                              
                              if (data.success && data.sources && data.sources.length > 0) {
                                const fetchedSource = data.sources[0];
                                // Update the source in cache with the fetched URL
                                const updatedSources = [...sourcesCache[menuProvider]];
                                updatedSources[index] = { ...source, ...fetchedSource, status: 'working' };
                                setSourcesCache(prev => ({ ...prev, [menuProvider]: updatedSources }));
                                setAvailableSources(updatedSources);
                                
                                // Set the stream URL
                                setStreamUrl(fetchedSource.url);
                                setCurrentSourceIndex(index);
                                setProvider(menuProvider);
                              } else {
                                // Mark as failed
                                const updatedSources = [...sourcesCache[menuProvider]];
                                updatedSources[index] = { ...source, status: 'down' };
                                setSourcesCache(prev => ({ ...prev, [menuProvider]: updatedSources }));
                                setError(`Source "${sourceName}" is not available`);
                              }
                            } catch (err) {
                              console.error('[VideoPlayer] Failed to fetch source:', err);
                              setError('Failed to load source');
                            } finally {
                              setIsLoading(false);
                            }
                            return;
                          }
                          
                          // For working sources, just switch to them
                          if (menuProvider !== provider) {
                            setProvider(menuProvider);
                            setAvailableSources(sourcesCache[menuProvider]);
                          }
                          
                          // Set the stream URL directly
                          if (source.url) {
                            setStreamUrl(source.url);
                            setCurrentSourceIndex(index);
                            setShowServerMenu(false);
                          }
                        }}
                        style={{
                          padding: '0.6rem 1rem',
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          opacity: source.status === 'down' ? 0.5 : 1
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {source.title || source.quality}
                          {source.language && source.language !== 'en' && (
                            <span style={{
                              fontSize: '0.75rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(255, 255, 255, 0.15)',
                              color: 'rgba(255, 255, 255, 0.9)',
                              textTransform: 'uppercase',
                              fontWeight: 500
                            }}>
                              {source.language}
                            </span>
                          )}
                        </span>
                        {source.status && (
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: source.status === 'working' ? '#4ade80' : 
                                             source.status === 'unknown' ? '#fbbf24' : '#f87171',
                              marginLeft: '8px',
                              boxShadow: `0 0 4px ${source.status === 'working' ? 'rgba(74, 222, 128, 0.5)' : 
                                                    source.status === 'unknown' ? 'rgba(251, 191, 36, 0.5)' : 'rgba(248, 113, 113, 0.5)'}`
                            }}
                            title={source.status === 'working' ? 'Available' : 
                                   source.status === 'unknown' ? 'Click to try' : 'Unavailable'}
                          />
                        )}
                      </button>
                    ))
                  ) : (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                      {loadingProviders[menuProvider] ? 'Loading sources...' : 'No sources available'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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

      {!isPlaying && !isLoading && !showResumePrompt && (
        <button className={styles.centerPlayButton} onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}

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

      {/* Cast Overlay - shown when casting to TV */}
      {isCastOverlayVisible && cast.isCasting && (
        <CastOverlay
          title={title || 'Unknown Title'}
          subtitle={mediaType === 'tv' && season && episode ? `Season ${season} • Episode ${episode}` : undefined}
          onStopCasting={() => {
            cast.stop();
            setIsCastOverlayVisible(false);
          }}
          currentTime={cast.currentTime}
          duration={cast.duration}
          isPlaying={cast.playerState === 'PLAYING'}
          onPlayPause={cast.playOrPause}
          onSeek={cast.seek}
        />
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
