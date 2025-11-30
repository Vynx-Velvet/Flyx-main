'use client';

import { useState, useEffect, useCallback } from 'react';
import LiveActivityTracker from '../components/LiveActivityTracker';

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
  last_heartbeat: number;
}

interface LiveStats {
  totalActive: number;
  watching: number;
  browsing: number;
  livetv: number;
  byDevice: Record<string, number>;
  byCountry: Record<string, number>;
  topContent: Array<{ contentId: string; contentTitle: string; contentType: string; count: number }>;
}

interface HistoricalPoint {
  time: number;
  count: number;
}

export default function AdminLivePage() {
  const [activities, setActivities] = useState<LiveActivity[]>([]);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [peakToday, setPeakToday] = useState(0);
  const [history, setHistory] = useState<HistoricalPoint[]>([]);
  const [viewMode, setViewMode] = useState<'realtime' | 'summary' | 'map'>('realtime');
  const [refreshRate, setRefreshRate] = useState(5);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/analytics/live-activity?maxAge=${refreshRate}`);
      const data = await response.json();
      if (data.success) {
        setActivities(data.activities || []);
        setStats(data.stats);
        setLastUpdate(new Date());
        
        const currentActive = data.stats?.totalActive || 0;
        setPeakToday(prev => Math.max(prev, currentActive));
        
        // Add to history for mini chart
        setHistory(prev => {
          const newHistory = [...prev, { time: Date.now(), count: currentActive }];
          // Keep last 30 data points (5 minutes at 10s intervals)
          return newHistory.slice(-30);
        });
      }
    } catch (error) {
      console.error('Failed to fetch live stats:', error);
    }
  }, [refreshRate]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, refreshRate * 1000);
    return () => clearInterval(interval);
  }, [fetchStats, refreshRate]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'watching': return '▶️';
      case 'livetv': return '📺';
      case 'browsing': return '🔍';
      default: return '👤';
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  return (
    <div>
      <div style={{ marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '24px', fontWeight: '600' }}>Live Activity Monitor</h2>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '20px', fontSize: '12px', color: '#10b981' }}>
                <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                LIVE
              </span>
            </div>
            <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '16px' }}>
              Real-time user activity • Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Loading...'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={refreshRate} onChange={(e) => setRefreshRate(parseInt(e.target.value))} style={{ padding: '8px 12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '14px' }}>
              <option value={5}>5s refresh</option>
              <option value={10}>10s refresh</option>
              <option value={30}>30s refresh</option>
            </select>
            <button onClick={() => setViewMode('realtime')} style={{ padding: '8px 16px', background: viewMode === 'realtime' ? '#7877c6' : 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: viewMode === 'realtime' ? 'white' : '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>🔴 Real-time</button>
            <button onClick={() => setViewMode('summary')} style={{ padding: '8px 16px', background: viewMode === 'summary' ? '#7877c6' : 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: viewMode === 'summary' ? 'white' : '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>📊 Summary</button>
            <button onClick={() => setViewMode('map')} style={{ padding: '8px 16px', background: viewMode === 'map' ? '#7877c6' : 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: viewMode === 'map' ? 'white' : '#94a3b8', cursor: 'pointer', fontSize: '14px' }}>🌍 Map</button>
          </div>
        </div>
      </div>

      {/* Live Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard title="Active Now" value={stats.totalActive} icon="👥" color="#10b981" pulse />
          <StatCard title="Watching VOD" value={stats.watching} icon="▶️" color="#7877c6" />
          <StatCard title="Live TV" value={stats.livetv} icon="📺" color="#f59e0b" />
          <StatCard title="Browsing" value={stats.browsing} icon="🔍" color="#3b82f6" />
          <StatCard title="Peak Today" value={peakToday} icon="📈" color="#ec4899" />
          <StatCard title="Countries" value={Object.keys(stats.byCountry || {}).length} icon="🌍" color="#8b5cf6" />
        </div>
      )}

      {/* Mini Activity Chart */}
      {history.length > 1 && (
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>Activity Trend (Last 5 min)</span>
            <span style={{ color: '#f8fafc', fontWeight: '600' }}>{stats?.totalActive || 0} active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '60px' }}>
            {history.map((point, i) => {
              const maxCount = Math.max(...history.map(h => h.count), 1);
              const height = (point.count / maxCount) * 100;
              return (
                <div key={i} style={{ flex: 1, height: `${Math.max(height, 4)}%`, background: i === history.length - 1 ? '#10b981' : 'rgba(120, 119, 198, 0.6)', borderRadius: '2px', transition: 'height 0.3s' }} title={`${point.count} users`} />
              );
            })}
          </div>
        </div>
      )}


      {/* Real-time View */}
      {viewMode === 'realtime' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
          <div>
            <LiveActivityTracker />
          </div>
          
          {/* Activity Feed */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '16px', height: 'fit-content' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
              Live Feed
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {activities.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No active users</div>
              ) : (
                activities.slice(0, 15).map((activity) => (
                  <div key={activity.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{getActivityIcon(activity.activity_type)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {activity.content_title || activity.activity_type}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '11px' }}>
                        {activity.device_type} • {activity.country || 'Unknown'}{activity.current_position ? ` • ${formatDuration(activity.current_position)}` : ''}
                      </div>
                    </div>
                    <span style={{ color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>{formatTimeAgo(activity.last_heartbeat)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary View */}
      {viewMode === 'summary' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {/* Top Content */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '16px' }}>🔥 Currently Watching</h3>
            {stats.topContent && stats.topContent.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.topContent.slice(0, 5).map((content, i) => (
                  <div key={content.contentId} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: i < 3 ? ['#ffd700', '#c0c0c0', '#cd7f32'][i] : 'rgba(255,255,255,0.1)', color: i < 3 ? '#000' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '11px' }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#f8fafc', fontSize: '14px', fontWeight: '500' }}>{content.contentTitle || content.contentId}</div>
                      <div style={{ color: '#64748b', fontSize: '12px' }}>{content.contentType}</div>
                    </div>
                    <span style={{ color: '#10b981', fontWeight: '600' }}>{content.count} viewers</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No active content</div>
            )}
          </div>

          {/* Device Breakdown */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '16px' }}>📱 By Device</h3>
            {stats.byDevice && Object.keys(stats.byDevice).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(stats.byDevice).sort((a, b) => b[1] - a[1]).map(([device, count]) => {
                  const total = Object.values(stats.byDevice).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={device} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '20px' }}>{device === 'desktop' ? '💻' : device === 'mobile' ? '📱' : device === 'tablet' ? '📲' : '🖥️'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#f8fafc', fontSize: '14px', textTransform: 'capitalize' }}>{device}</span>
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>{count} ({Math.round(percentage)}%)</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${percentage}%`, background: '#7877c6', borderRadius: '3px' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No device data</div>
            )}
          </div>

          {/* Activity Types */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '16px' }}>📊 Activity Types</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <ActivityTypeBar label="Watching VOD" count={stats.watching} total={stats.totalActive} color="#7877c6" icon="▶️" />
              <ActivityTypeBar label="Live TV" count={stats.livetv} total={stats.totalActive} color="#f59e0b" icon="📺" />
              <ActivityTypeBar label="Browsing" count={stats.browsing} total={stats.totalActive} color="#3b82f6" icon="🔍" />
            </div>
          </div>
        </div>
      )}

      {/* Map View */}
      {viewMode === 'map' && stats && (
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '18px' }}>🌍 Active Users by Location</h3>
          {stats.byCountry && Object.keys(stats.byCountry).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {Object.entries(stats.byCountry).sort((a, b) => b[1] - a[1]).map(([country, count]) => (
                <div key={country} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '24px' }}>🌐</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f8fafc', fontWeight: '500' }}>{country}</div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>{count} active user{count !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)' }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>No location data available</div>
          )}
        </div>
      )}

      <style jsx>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

function StatCard({ title, value, icon, color, pulse = false }: { title: string; value: string | number; icon: string; color: string; pulse?: boolean }) {
  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '16px', borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px', position: 'relative' }}>{icon}{pulse && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} />}</span>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{title}</span>
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc' }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
    </div>
  );
}

function ActivityTypeBar({ label, count, total, color, icon }: { label: string; count: number; total: number; color: string; icon: string }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ color: '#f8fafc', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>{icon} {label}</span>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{count} ({Math.round(percentage)}%)</span>
      </div>
      <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percentage}%`, background: color, borderRadius: '4px', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}
