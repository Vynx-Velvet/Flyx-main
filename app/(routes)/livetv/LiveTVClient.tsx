'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import { useAnalytics } from '@/components/analytics/AnalyticsProvider';
import styles from './LiveTV.module.css';

/**
 * Check if an event is currently live based on its start time.
 * Events are considered live if they started within the last 3 hours.
 */
function isEventCurrentlyLive(dataTime: string, serverIsLive: boolean): boolean {
  // If server already says it's live, trust that
  if (serverIsLive) return true;
  
  if (!dataTime) return false;
  
  try {
    let eventTime: Date;
    
    if (/^\d+$/.test(dataTime)) {
      // Unix timestamp (seconds)
      eventTime = new Date(parseInt(dataTime) * 1000);
    } else {
      // Parse as date string - assume UK timezone (GMT)
      eventTime = new Date(dataTime + ' GMT');
    }
    
    const now = new Date();
    const diffMs = now.getTime() - eventTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    // Event is live if it started between 0 and 3 hours ago
    return diffHours >= 0 && diffHours <= 3;
  } catch {
    return false;
  }
}

// Types
interface Channel {
  id: string;
  name: string;
  category: string;
  country: string;
  streamId: string;
  firstLetter: string;
  isHD?: boolean;
  categoryInfo: { name: string; icon: string };
  countryInfo: { name: string; flag: string };
}

interface FilterOption {
  id: string;
  name: string;
  icon?: string;
  flag?: string;
  count: number;
}

interface ChannelResponse {
  success: boolean;
  channels: Channel[];
  pagination: { page: number; limit: number; totalChannels: number; totalPages: number; hasMore: boolean };
  filters: { categories: FilterOption[]; countries: FilterOption[]; letters: string[] };
  stats: { totalChannels: number; lastUpdated: string };
}

interface SportEvent {
  id: string;
  time: string;
  dataTime: string;
  title: string;
  sport?: string;
  league?: string;
  teams?: { home: string; away: string };
  isLive: boolean;
  channels: { name: string; channelId: string; href: string }[];
}

interface ScheduleCategory {
  name: string;
  icon: string;
  events: SportEvent[];
}

interface ScheduleResponse {
  success: boolean;
  schedule: { date: string; timezone: string; categories: ScheduleCategory[] };
  stats: { totalCategories: number; totalEvents: number; totalChannels: number; liveEvents: number };
  filters: { sports: { name: string; icon: string; count: number }[] };
}

type BrowseMode = 'events' | 'channels';

export default function LiveTVClient() {
  const { trackEvent, trackPageView } = useAnalytics();
  
  const [browseMode, setBrowseMode] = useState<BrowseMode>('events');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelFilters, setChannelFilters] = useState<ChannelResponse['filters'] | null>(null);
  const [channelStats, setChannelStats] = useState<ChannelResponse['stats'] | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [schedule, setSchedule] = useState<ScheduleCategory[]>([]);
  const [scheduleStats, setScheduleStats] = useState<ScheduleResponse['stats'] | null>(null);
  const [sportFilters, setSportFilters] = useState<ScheduleResponse['filters']['sports']>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSport, setSelectedSport] = useState('all');
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => { trackPageView('/livetv'); }, [trackPageView]);

  useEffect(() => {
    if (browseMode === 'events') fetchSchedule();
    else fetchChannels();
  }, [browseMode, selectedSport, showLiveOnly, selectedCategory, searchQuery]);

  const fetchSchedule = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedSport !== 'all') params.set('sport', selectedSport);
      if (searchQuery) params.set('search', searchQuery);
      if (showLiveOnly) params.set('live', 'true');
      
      const response = await fetch(`/api/livetv/schedule?${params}`);
      const data: ScheduleResponse = await response.json();
      
      if (data.success) {
        setSchedule(data.schedule.categories);
        setScheduleStats(data.stats);
        setSportFilters(data.filters.sports);
      } else {
        setError('Failed to load schedule');
      }
    } catch {
      setError('Failed to load schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChannels = async (loadMore = false) => {
    try {
      if (!loadMore) setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchQuery) params.set('search', searchQuery);
      params.set('page', loadMore ? String(page + 1) : '1');
      params.set('limit', '100');

      const response = await fetch(`/api/livetv/channels?${params}`);
      const data: ChannelResponse = await response.json();

      if (data.success) {
        if (loadMore) {
          setChannels(prev => [...prev, ...data.channels]);
          setPage(prev => prev + 1);
        } else {
          setChannels(data.channels);
          setPage(1);
        }
        setChannelFilters(data.filters);
        setChannelStats(data.stats);
        setHasMore(data.pagination.hasMore);
      } else {
        setError('Failed to load channels');
      }
    } catch {
      setError('Failed to load channels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChannelSelect = useCallback((channel: Channel) => {
    setSelectedChannel(channel);
    trackEvent('livetv_channel_selected', { channelId: channel.id, channelName: channel.name });
  }, [trackEvent]);

  const handleEventChannelSelect = useCallback((channelId: string, channelName: string) => {
    const channel: Channel = {
      id: `event-${channelId}`,
      name: channelName,
      category: 'sports',
      country: 'international',
      streamId: channelId,
      firstLetter: channelName.charAt(0),
      isHD: true,
      categoryInfo: { name: 'Sports', icon: '⚽' },
      countryInfo: { name: 'International', flag: '🌐' },
    };
    setSelectedChannel(channel);
    trackEvent('livetv_event_channel_selected', { channelId, channelName });
  }, [trackEvent]);

  // Get unique sports for sidebar
  const uniqueSports = sportFilters.reduce((acc, sport, index) => {
    if (!acc.find(s => s.name === sport.name)) {
      acc.push({ ...sport, uniqueId: `${sport.name}-${index}` });
    }
    return acc;
  }, [] as (typeof sportFilters[0] & { uniqueId: string })[]);

  // Track if component has mounted (for hydration-safe date calculations)
  const [hasMounted, setHasMounted] = useState(false);
  const [tick, setTick] = useState(0);
  
  useEffect(() => {
    setHasMounted(true);
    // Update live status every minute
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Get all events flat for easier display
  // Only recalculate live status after mount to avoid hydration mismatch
  const allEvents = useMemo(() => {
    return schedule.flatMap(cat => 
      cat.events.map(event => ({
        ...event,
        categoryIcon: cat.icon,
        categoryName: cat.name,
        // Only recalculate on client after mount, otherwise use server value
        isLive: hasMounted ? isEventCurrentlyLive(event.dataTime, event.isLive) : event.isLive,
      }))
    );
  }, [schedule, tick, hasMounted]);

  const filteredEvents = showLiveOnly ? allEvents.filter(e => e.isLive) : allEvents;
  const liveEvents = allEvents.filter(e => e.isLive);

  return (
    <div className={styles.container}>
      <Navigation />

      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Live TV</h2>
            {scheduleStats && (
              <span className={styles.liveCount}>
                <span className={styles.liveDot} />
                {scheduleStats.liveEvents} Live
              </span>
            )}
          </div>

          {/* Mode Switch */}
          <div className={styles.modeSwitch}>
            <button 
              className={`${styles.modeBtn} ${browseMode === 'events' ? styles.active : ''}`}
              onClick={() => setBrowseMode('events')}
            >
              🏆 Events
            </button>
            <button 
              className={`${styles.modeBtn} ${browseMode === 'channels' ? styles.active : ''}`}
              onClick={() => setBrowseMode('channels')}
            >
              📺 Channels
            </button>
          </div>

          {/* Search */}
          <div className={styles.sidebarSearch}>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* Filters */}
          {browseMode === 'events' ? (
            <div className={styles.filterList}>
              <div className={styles.filterSection}>
                <h3>Sports</h3>
                <button
                  className={`${styles.filterItem} ${selectedSport === 'all' ? styles.active : ''}`}
                  onClick={() => setSelectedSport('all')}
                >
                  <span>📺 All Sports</span>
                  <span className={styles.filterCount}>{allEvents.length}</span>
                </button>
                <button
                  className={`${styles.filterItem} ${styles.liveFilter} ${showLiveOnly ? styles.active : ''}`}
                  onClick={() => setShowLiveOnly(!showLiveOnly)}
                >
                  <span><span className={styles.liveDot} /> Live Now</span>
                  <span className={styles.filterCount}>{liveEvents.length}</span>
                </button>
                {uniqueSports.slice(0, 10).map(sport => (
                  <button
                    key={sport.uniqueId}
                    className={`${styles.filterItem} ${selectedSport === sport.name ? styles.active : ''}`}
                    onClick={() => setSelectedSport(sport.name)}
                  >
                    <span>{sport.icon} {sport.name}</span>
                    <span className={styles.filterCount}>{sport.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.filterList}>
              <div className={styles.filterSection}>
                <h3>Categories</h3>
                <button
                  className={`${styles.filterItem} ${selectedCategory === 'all' ? styles.active : ''}`}
                  onClick={() => setSelectedCategory('all')}
                >
                  <span>📺 All Channels</span>
                  <span className={styles.filterCount}>{channelStats?.totalChannels || 0}</span>
                </button>
                {channelFilters?.categories.map((cat, idx) => (
                  <button
                    key={`${cat.id}-${idx}`}
                    className={`${styles.filterItem} ${selectedCategory === cat.id ? styles.active : ''}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <span>{cat.icon} {cat.name}</span>
                    <span className={styles.filterCount}>{cat.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className={styles.main}>
          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>Loading...</p>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={() => browseMode === 'events' ? fetchSchedule() : fetchChannels()} className={styles.retryBtn}>
                Retry
              </button>
            </div>
          ) : browseMode === 'events' ? (
            /* Events View */
            <div className={styles.eventsGrid}>
              {filteredEvents.length === 0 ? (
                <div className={styles.noResults}>
                  <p>No events found</p>
                </div>
              ) : (
                filteredEvents.map((event, idx) => (
                  <div key={`${event.id}-${idx}`} className={`${styles.eventCard} ${event.isLive ? styles.live : ''}`}>
                    <div className={styles.eventHeader}>
                      <span className={styles.eventTime}>
                        {event.isLive ? (
                          <span className={styles.liveTag}><span className={styles.liveDot} /> LIVE</span>
                        ) : (
                          event.time
                        )}
                      </span>
                      <span className={styles.eventSport}>{event.categoryIcon}</span>
                    </div>
                    <div className={styles.eventBody}>
                      {event.teams ? (
                        <div className={styles.matchup}>
                          <span className={styles.team}>{event.teams.home}</span>
                          <span className={styles.vs}>vs</span>
                          <span className={styles.team}>{event.teams.away}</span>
                        </div>
                      ) : (
                        <span className={styles.eventTitle}>{event.title}</span>
                      )}
                      {event.league && <span className={styles.league}>{event.league}</span>}
                    </div>
                    <div className={styles.eventChannels}>
                      {event.channels.slice(0, 4).map((ch, chIdx) => (
                        <button
                          key={`${ch.channelId}-${chIdx}`}
                          className={styles.channelBtn}
                          onClick={() => handleEventChannelSelect(ch.channelId, ch.name)}
                        >
                          ▶ {ch.name}
                        </button>
                      ))}
                      {event.channels.length > 4 && (
                        <span className={styles.moreChannels}>+{event.channels.length - 4} more</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Channels View */
            <div className={styles.channelsGrid}>
              {channels.length === 0 ? (
                <div className={styles.noResults}>
                  <p>No channels found</p>
                </div>
              ) : (
                <>
                  {channels.map((channel, idx) => (
                    <button
                      key={`${channel.id}-${idx}`}
                      className={styles.channelCard}
                      onClick={() => handleChannelSelect(channel)}
                    >
                      <div className={styles.channelLogo}>
                        <span>{channel.name.charAt(0)}</span>
                        {channel.isHD && <span className={styles.hdBadge}>HD</span>}
                      </div>
                      <div className={styles.channelInfo}>
                        <span className={styles.channelName}>{channel.name}</span>
                        <span className={styles.channelMeta}>
                          {channel.categoryInfo.icon} {channel.categoryInfo.name}
                        </span>
                      </div>
                      <span className={styles.playIcon}>▶</span>
                    </button>
                  ))}
                  {hasMore && (
                    <button onClick={() => fetchChannels(true)} className={styles.loadMoreBtn}>
                      Load More
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Player Modal */}
      {selectedChannel && (
        <LiveTVPlayer channel={selectedChannel} onClose={() => setSelectedChannel(null)} />
      )}

      <Footer />
    </div>
  );
}



// Player Component with Custom Controls
interface LiveTVPlayerProps {
  channel: Channel;
  onClose: () => void;
}

function LiveTVPlayer({ channel, onClose }: LiveTVPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const hlsRef = React.useRef<any>(null);
  const controlsTimeoutRef = React.useRef<NodeJS.Timeout>();
  const decryptRetryCount = React.useRef(0);
  const MAX_DECRYPT_RETRIES = 2;
  const CONTROLS_HIDE_DELAY = 3000; // 3 seconds
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [bufferingStatus, setBufferingStatus] = useState<string | null>(null);

  useEffect(() => {
    decryptRetryCount.current = 0;
    loadStream(false);
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [channel.streamId]);

  const loadStream = async (invalidateCache = false) => {
    if (!videoRef.current) return;
    setIsLoading(true);
    setError(null);

    // Destroy existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    try {
      // Use proxied M3U8 URL - key is embedded, segments fetch directly from CDN
      const streamUrl = `/api/dlhd-proxy?channel=${channel.streamId}${invalidateCache ? '&invalidate=true' : ''}`;

      const Hls = (await import('hls.js')).default;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          // Buffer settings - balanced for live streams
          backBufferLength: 30, // Keep 30s behind
          maxBufferLength: 20, // Buffer 20 seconds ahead
          maxMaxBufferLength: 30, // Cap at 30 seconds
          maxBufferSize: 60 * 1000 * 1000, // 60MB max buffer
          maxBufferHole: 0.5, // Allow small gaps
          // Live stream settings
          liveSyncDurationCount: 3, // 3 segments behind live edge
          liveMaxLatencyDurationCount: 6, // Max 6 segments latency before seeking
          liveDurationInfinity: true,
          liveBackBufferLength: 30,
          // Loading behavior
          startFragPrefetch: false,
          testBandwidth: false,
          // Retries - be patient
          levelLoadingMaxRetry: 4,
          fragLoadingMaxRetry: 3,
          manifestLoadingMaxRetry: 4,
          levelLoadingRetryDelay: 1000,
          fragLoadingRetryDelay: 1000,
          manifestLoadingRetryDelay: 1000,
          levelLoadingTimeOut: 15000,
          manifestLoadingTimeOut: 15000,
          fragLoadingTimeOut: 20000, // Give segments more time to load
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          setBufferingStatus(null);
          decryptRetryCount.current = 0;
          videoRef.current?.play().catch(() => {});
        });

        // Clear buffering status when fragment loads successfully
        hls.on(Hls.Events.FRAG_LOADED, () => {
          setBufferingStatus(null);
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.log(`[LiveTV] HLS error: ${data.type} - ${data.details}`, data.fatal ? '(FATAL)' : '');
          
          // Handle fragment/segment loading errors - skip to next segment
          if (data.details === 'fragLoadError' || data.details === 'fragLoadTimeOut') {
            setBufferingStatus('Loading segment...');
            console.log('[LiveTV] Fragment load failed, skipping to next segment');
            // Skip the problematic fragment by seeking forward slightly
            if (videoRef.current && hls.media) {
              const currentTime = videoRef.current.currentTime;
              const buffered = videoRef.current.buffered;
              // Find next buffered region or skip 2 seconds
              let skipTo = currentTime + 2;
              for (let i = 0; i < buffered.length; i++) {
                if (buffered.start(i) > currentTime) {
                  skipTo = buffered.start(i);
                  break;
                }
              }
              videoRef.current.currentTime = skipTo;
              console.log(`[LiveTV] Skipped from ${currentTime.toFixed(1)}s to ${skipTo.toFixed(1)}s`);
            }
            // Don't treat as fatal - let HLS.js continue
            if (data.fatal) {
              hls.recoverMediaError();
            }
            return;
          }
          
          // Handle decryption errors by invalidating cache and retrying
          if (data.details === 'fragDecryptError' || data.details === 'keyLoadError') {
            setBufferingStatus('Refreshing stream key...');
            console.log(`[LiveTV] Key error, retry ${decryptRetryCount.current + 1}/${MAX_DECRYPT_RETRIES}`);
            if (decryptRetryCount.current < MAX_DECRYPT_RETRIES) {
              decryptRetryCount.current++;
              loadStream(true);
              return;
            }
          }
          
          // Handle buffer stall - don't seek, just wait for more data
          if (data.details === 'bufferStalledError') {
            setBufferingStatus('Buffering...');
            console.log('[LiveTV] Buffer stalled, waiting for data...');
            // Don't seek - just let HLS.js continue loading
            // Seeking can cause more stalls
            return;
          }
          
          // Handle buffer append errors
          if (data.details === 'bufferAppendError') {
            setBufferingStatus('Processing video...');
            console.log('[LiveTV] Buffer append error, recovering...');
            hls.recoverMediaError();
            return;
          }
          
          // Handle media errors - try to recover
          if (data.type === 'mediaError' && data.fatal) {
            setBufferingStatus('Recovering...');
            console.log('[LiveTV] Fatal media error, attempting recovery');
            hls.recoverMediaError();
            return;
          }
          
          // Handle network errors - try to recover
          if (data.type === 'networkError' && data.fatal) {
            setBufferingStatus('Reconnecting...');
            console.log('[LiveTV] Fatal network error, attempting recovery');
            hls.startLoad();
            return;
          }
          
          // Only show error for truly fatal unrecoverable errors
          if (data.fatal && data.type !== 'mediaError' && data.type !== 'networkError') {
            setBufferingStatus(null);
            setError('Stream error - channel may be offline');
            setIsLoading(false);
          }
        });

        hlsRef.current = hls;
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        videoRef.current.src = streamUrl;
        videoRef.current.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          videoRef.current?.play().catch(() => {});
        });
      } else {
        setError('HLS not supported');
        setIsLoading(false);
      }
    } catch {
      setError('Failed to load stream');
      setIsLoading(false);
    }
  };

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('volumechange', onVolumeChange);
    
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('volumechange', onVolumeChange);
    };
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = parseFloat(e.target.value);
    videoRef.current.volume = val;
    videoRef.current.muted = val === 0;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen();
    else document.exitFullscreen();
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-hide controls after inactivity
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, CONTROLS_HIDE_DELAY);
  }, [isPlaying]);

  const handleMouseMove = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  const handleMouseLeave = useCallback(() => {
    if (isPlaying) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 1000); // Hide faster when mouse leaves
    }
  }, [isPlaying]);

  const handleMouseEnter = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Show controls when paused
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [isPlaying]);



  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose();
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay(); }
      if (e.key === 'f') toggleFullscreen();
      if (e.key === 'm') toggleMute();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, isPlaying]);

  return (
    <div className={styles.playerModal} onClick={onClose}>
      <div 
        ref={containerRef} 
        className={`${styles.playerContainer} ${showControls ? styles.showControls : styles.hideControls}`}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
      >
        {/* Close Button */}
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
        
        {/* Header */}
        <div className={styles.playerHeader}>
          <span className={styles.liveTag}><span className={styles.liveDot} /> LIVE</span>
          <span className={styles.channelTitle}>{channel.name}</span>
          <span className={styles.channelFlag}>{channel.countryInfo.flag}</span>
        </div>

        {/* Video - NO controls attribute */}
        <video 
          ref={videoRef} 
          className={styles.video} 
          playsInline 
          onClick={togglePlay}
        />

        {/* Custom Controls - Always visible */}
        <div className={styles.customControls}>
          {/* Play/Pause */}
          <button className={styles.controlBtn} onClick={togglePlay} type="button">
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Volume */}
          <button className={styles.controlBtn} onClick={toggleMute} type="button">
            {isMuted || volume === 0 ? '🔇' : '🔊'}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className={styles.volumeSlider}
          />

          <div className={styles.spacer} />

          {/* Live indicator */}
          <div className={styles.controlsLive}>
            <span className={styles.liveDot} /> LIVE
          </div>

          {/* Fullscreen */}
          <button className={styles.controlBtn} onClick={toggleFullscreen} type="button">
            {isFullscreen ? '⛶' : '⛶'}
          </button>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className={styles.playerOverlay}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>Loading {channel.name}...</p>
          </div>
        )}

        {/* Buffering Status Overlay - shows during playback issues */}
        {bufferingStatus && !isLoading && !error && (
          <div className={styles.bufferingOverlay}>
            <div className={styles.bufferingSpinner} />
            <p className={styles.bufferingText}>{bufferingStatus}</p>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className={styles.playerOverlay}>
            <p className={styles.errorText}>{error}</p>
            <div className={styles.errorActions}>
              <button onClick={() => { decryptRetryCount.current = 0; loadStream(true); }} className={styles.retryBtn}>Try Again</button>
              <button onClick={onClose} className={styles.closeErrorBtn}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
