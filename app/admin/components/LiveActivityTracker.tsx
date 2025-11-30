'use client';

import { useState, useEffect } from 'react';

interface LiveActivity {
  id: string;
  user_id: string;
  session_id: string;
  activity_type: string;
  content_id?: string;
  content_title?: string;
  content_type?: string;
  season_number?: number;
  episode_number?: number;
  current_position?: number;
  duration?: number;
  quality?: string;
  device_type?: string;
  country?: string;
  started_at: number;
  last_heartbeat: number;
  is_active: boolean;
}

interface LiveStats {
  totalActive: number;
  watching: number;
  browsing: number;
  livetv: number;
  byDevice: Record<string, number>;
  byCountry: Record<string, number>;
  topContent: Array<{
    contentId: string;
    contentTitle: string;
    contentType: string;
    count: number;
  }>;
}

interface LiveTVStats {
  currentViewers: number;
  channels: Array<{
    channelId: string;
    channelName: string;
    category?: string;
    viewerCount: number;
    totalWatchTime: number;
  }>;
  categories: Array<{
    category: string;
    viewerCount: number;
  }>;
  stats: {
    totalCurrentWatchTime: number;
    totalBufferEvents: number;
    recentSessions: number;
    avgSessionDuration: number;
  };
}

export default function LiveActivityTracker() {
  const [activities, setActivities] = useState<LiveActivity[]>([]);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [liveTVStats, setLiveTVStats] = useState<LiveTVStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'watching' | 'livetv' | 'browsing'>('all');

  useEffect(() => {
    fetchLiveActivity();
    fetchLiveTVStats();

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchLiveActivity();
        fetchLiveTVStats();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchLiveActivity = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/analytics/live-activity?maxAge=5');
      const data = await response.json();

      if (data.success) {
        setActivities(data.activities);
        setStats(data.stats);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch live activity:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchLiveTVStats = async () => {
    try {
      const response = await fetch('/api/analytics/livetv-session');
      const data = await response.json();
      if (data.success !== false) {
        setLiveTVStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch Live TV stats:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (position: number, duration: number) => {
    if (!duration) return 0;
    return Math.round((position / duration) * 100);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid rgba(120, 119, 198, 0.2)',
          borderTop: '4px solid #7877c6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }}></div>
        Loading live activity...
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '0.75rem' }}>
        {lastUpdated && (
          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          style={{
            padding: '0.5rem 1rem',
            background: autoRefresh ? 'rgba(120, 119, 198, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${autoRefresh ? '#7877c6' : 'rgba(255, 255, 255, 0.1)'}`,
            borderRadius: '8px',
            color: autoRefresh ? '#7877c6' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          {autoRefresh ? '⏸ Pause' : '▶ Resume'} Auto-refresh
        </button>
        <button
          onClick={fetchLiveActivity}
          disabled={refreshing}
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: refreshing ? '#64748b' : '#94a3b8',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: 'all 0.2s',
            opacity: refreshing ? 0.6 : 1
          }}
        >
          {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Now'}
        </button>
        </div>
      </div>

      {stats && (
        <>
          {/* Summary Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{ fontSize: '1.75rem' }}>👥</div>
              <div>
                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#f8fafc' }}>
                  {stats.totalActive}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Active Users</div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{ fontSize: '1.75rem' }}>▶️</div>
              <div>
                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#f8fafc' }}>
                  {stats.watching}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Watching VOD</div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{ fontSize: '1.75rem' }}>📺</div>
              <div>
                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#f8fafc' }}>
                  {stats.livetv || liveTVStats?.currentViewers || 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Live TV</div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{ fontSize: '1.75rem' }}>🔍</div>
              <div>
                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#f8fafc' }}>
                  {stats.browsing}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Browsing</div>
              </div>
            </div>
          </div>

          {/* Activity Type Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '1rem'
          }}>
            {[
              { id: 'all', label: 'All Activity', count: stats.totalActive },
              { id: 'watching', label: 'Watching', count: stats.watching },
              { id: 'livetv', label: 'Live TV', count: stats.livetv || liveTVStats?.currentViewers || 0 },
              { id: 'browsing', label: 'Browsing', count: stats.browsing },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '0.5rem 1rem',
                  background: activeTab === tab.id ? 'rgba(120, 119, 198, 0.2)' : 'transparent',
                  border: `1px solid ${activeTab === tab.id ? '#7877c6' : 'transparent'}`,
                  borderRadius: '8px',
                  color: activeTab === tab.id ? '#7877c6' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {tab.label}
                <span style={{
                  background: activeTab === tab.id ? '#7877c6' : 'rgba(255,255,255,0.1)',
                  color: activeTab === tab.id ? 'white' : '#94a3b8',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Live TV Channels Section */}
          {(activeTab === 'all' || activeTab === 'livetv') && liveTVStats && liveTVStats.channels && liveTVStats.channels.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#f8fafc', fontSize: '1.125rem' }}>
                📺 Live TV Channels ({liveTVStats.currentViewers} viewers)
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '1rem'
              }}>
                {liveTVStats.channels.map((channel) => (
                  <div key={channel.channelId} style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          color: '#f8fafc',
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {channel.channelName}
                        </div>
                        {channel.category && (
                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                            {channel.category}
                          </div>
                        )}
                      </div>
                      <div style={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#10b981',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }} />
                        {channel.viewerCount}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Device & Country Breakdown */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.5rem'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#f8fafc', fontSize: '1.125rem' }}>
                By Device
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(stats.byDevice).map(([device, count]) => (
                  <div key={device} style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr auto',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <span style={{ color: '#e2e8f0', fontSize: '0.875rem', textTransform: 'capitalize' }}>
                      {device}
                    </span>
                    <div style={{
                      height: '8px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #7877c6, #ff77c6)',
                        width: `${(count / stats.totalActive) * 100}%`,
                        transition: 'width 0.3s'
                      }} />
                    </div>
                    <span style={{ color: '#f8fafc', fontSize: '0.875rem', fontWeight: '600', minWidth: '30px', textAlign: 'right' }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.5rem'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#f8fafc', fontSize: '1.125rem' }}>
                By Location
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(stats.byCountry).slice(0, 5).map(([country, count]) => (
                  <div key={country} style={{
                    display: 'grid',
                    gridTemplateColumns: '100px 1fr auto',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <span style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>
                      {country}
                    </span>
                    <div style={{
                      height: '8px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #7877c6, #ff77c6)',
                        width: `${(count / stats.totalActive) * 100}%`,
                        transition: 'width 0.3s'
                      }} />
                    </div>
                    <span style={{ color: '#f8fafc', fontSize: '0.875rem', fontWeight: '600', minWidth: '30px', textAlign: 'right' }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Content */}
          {stats.topContent.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#f8fafc', fontSize: '1.125rem' }}>
                Most Watched Right Now
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '1rem'
              }}>
                {stats.topContent.map((content) => (
                  <div key={content.contentId} style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: '#f8fafc',
                        fontWeight: '600',
                        fontSize: '0.875rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {content.contentTitle || content.contentId}
                      </div>
                      <div style={{
                        color: '#94a3b8',
                        fontSize: '0.75rem',
                        textTransform: 'capitalize',
                        marginTop: '0.25rem'
                      }}>
                        {content.contentType}
                      </div>
                    </div>
                    <div style={{
                      color: '#7877c6',
                      fontWeight: '700',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap'
                    }}>
                      {content.count} {content.count === 1 ? 'viewer' : 'viewers'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Active Sessions List */}
      <div>
        {(() => {
          const filteredActivities = activities.filter(a => {
            if (activeTab === 'all') return true;
            if (activeTab === 'watching') return a.activity_type === 'watching';
            if (activeTab === 'livetv') return a.activity_type === 'livetv';
            if (activeTab === 'browsing') return a.activity_type === 'browsing';
            return true;
          });
          
          return (
            <>
              <h3 style={{ margin: '0 0 1rem 0', color: '#f8fafc', fontSize: '1.125rem' }}>
                Active Sessions ({filteredActivities.length})
              </h3>
              {filteredActivities.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>😴</div>
            <p style={{ color: '#e2e8f0', fontSize: '1.125rem', margin: '0.5rem 0' }}>
              No active users right now
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
              Check back later or wait for users to visit
            </p>
          </div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {filteredActivities.map((activity) => (
              <div key={activity.id} style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '1.5rem',
                transition: 'all 0.2s'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10b981',
                      animation: 'pulse 2s infinite'
                    }} />
                    <span style={{ color: '#f8fafc', fontWeight: '600', fontSize: '0.875rem' }}>
                      {activity.activity_type === 'watching' ? '▶️ Watching' : '🔍 Browsing'}
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    {formatTime(activity.last_heartbeat)}
                  </div>
                </div>

                {activity.activity_type === 'watching' ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ 
                      color: '#f8fafc', 
                      fontSize: '1.125rem', 
                      fontWeight: '600', 
                      marginBottom: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>🎬</span>
                      {activity.content_title || `${activity.content_type || 'Content'} #${activity.content_id || 'Unknown'}`}
                    </div>
                    {activity.season_number && activity.episode_number && (
                      <div style={{ 
                        color: '#94a3b8', 
                        fontSize: '0.875rem', 
                        marginBottom: '0.75rem',
                        fontWeight: '500'
                      }}>
                        Season {activity.season_number}, Episode {activity.episode_number}
                      </div>
                    )}
                    {activity.current_position !== undefined && activity.duration && (
                      <div>
                        <div style={{
                          height: '6px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          marginBottom: '0.5rem'
                        }}>
                          <div style={{
                            height: '100%',
                            background: 'linear-gradient(90deg, #7877c6, #ff77c6)',
                            width: `${getProgressPercentage(activity.current_position, activity.duration)}%`,
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                          {formatDuration(activity.current_position)} / {formatDuration(activity.duration)}
                          {' '}({getProgressPercentage(activity.current_position, activity.duration)}%)
                        </div>
                      </div>
                    )}
                  </div>
                ) : activity.activity_type === 'browsing' ? (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ 
                      color: '#94a3b8', 
                      fontSize: '0.875rem',
                      fontStyle: 'italic',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <span>🔍</span>
                      Exploring content...
                    </div>
                  </div>
                ) : null}

                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    📱 {activity.device_type || 'unknown'}
                  </span>
                  {activity.quality && (
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      🎬 {activity.quality}
                    </span>
                  )}
                  {activity.country && (
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      📍 {activity.country}
                    </span>
                  )}
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    ⏱️ Active for {formatTime(activity.started_at)}
                  </span>
                </div>
              </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
