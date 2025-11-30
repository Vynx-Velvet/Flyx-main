'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';

interface WatchSession {
  id: string;
  user_id: string;
  session_id: string;
  content_id: string;
  content_type: string;
  content_title: string;
  season_number?: number;
  episode_number?: number;
  started_at: number;
  ended_at?: number;
  total_watch_time: number;
  last_position: number;
  duration: number;
  completion_percentage: number;
  quality?: string;
  device_type?: string;
  is_completed: boolean;
  pause_count: number;
  seek_count: number;
}

interface SessionMetrics {
  totalSessions: number;
  avgDuration: number;
  avgCompletion: number;
  completedCount: number;
  avgPauses: number;
  avgSeeks: number;
  peakHour: number;
  mostWatchedType: string;
}

export default function AdminSessionsPage() {
  const { dateRange, setIsLoading } = useAdmin();
  const [sessions, setSessions] = useState<WatchSession[]>([]);
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'abandoned'>('all');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'duration' | 'completion'>('recent');
  const [selectedSession, setSelectedSession] = useState<WatchSession | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const limit = 100;

  useEffect(() => {
    fetchSessions();
  }, [dateRange, filter, contentTypeFilter, sortBy]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      setIsLoading(true);
      
      const params = new URLSearchParams({ limit: limit.toString() });
      
      if (dateRange.startDate && dateRange.endDate) {
        params.append('startDate', dateRange.startDate.getTime().toString());
        params.append('endDate', dateRange.endDate.getTime().toString());
      }

      const response = await fetch(`/api/analytics/watch-session?${params}`);
      if (response.ok) {
        const data = await response.json();
        let sessionData = data.sessions || [];
        
        // Apply filters
        if (filter === 'completed') {
          sessionData = sessionData.filter((s: WatchSession) => s.is_completed || s.completion_percentage >= 90);
        } else if (filter === 'abandoned') {
          sessionData = sessionData.filter((s: WatchSession) => !s.is_completed && s.completion_percentage < 50);
        }
        
        if (contentTypeFilter !== 'all') {
          sessionData = sessionData.filter((s: WatchSession) => s.content_type === contentTypeFilter);
        }
        
        // Apply sorting
        if (sortBy === 'duration') {
          sessionData.sort((a: WatchSession, b: WatchSession) => b.total_watch_time - a.total_watch_time);
        } else if (sortBy === 'completion') {
          sessionData.sort((a: WatchSession, b: WatchSession) => b.completion_percentage - a.completion_percentage);
        }
        
        setSessions(sessionData);
        
        // Calculate metrics
        if (data.analytics) {
          const analytics = data.analytics;
          setMetrics({
            totalSessions: analytics.totalSessions || 0,
            avgDuration: analytics.averageWatchTime || 0,
            avgCompletion: analytics.averageCompletionRate || 0,
            completedCount: analytics.completedSessions || 0,
            avgPauses: Math.round((analytics.totalPauses || 0) / Math.max(analytics.totalSessions, 1)),
            avgSeeks: Math.round((analytics.totalSeeks || 0) / Math.max(analytics.totalSessions, 1)),
            peakHour: 20, // Would need additional data
            mostWatchedType: sessionData.filter((s: WatchSession) => s.content_type === 'movie').length > 
                           sessionData.filter((s: WatchSession) => s.content_type === 'tv').length ? 'Movies' : 'TV Shows',
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 90) return '#10b981';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const exportSessions = () => {
    const csvContent = [
      ['Content', 'Type', 'Started', 'Duration', 'Watch Time', 'Completion', 'Device', 'Pauses', 'Seeks'].join(','),
      ...sessions.map(s => [
        `"${s.content_title || s.content_id}"`,
        s.content_type,
        new Date(s.started_at).toISOString(),
        s.duration,
        s.total_watch_time,
        Math.round(s.completion_percentage),
        s.device_type || 'unknown',
        s.pause_count,
        s.seek_count
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getHourlyDistribution = () => {
    const hours: Record<number, number> = {};
    sessions.forEach(s => {
      const hour = new Date(s.started_at).getHours();
      hours[hour] = (hours[hour] || 0) + 1;
    });
    return hours;
  };

  return (
    <div>
      <div style={{
        marginBottom: '32px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h2 style={{
          margin: 0,
          color: '#f8fafc',
          fontSize: '24px',
          fontWeight: '600',
          letterSpacing: '-0.5px'
        }}>
          Session Analytics
        </h2>
        <p style={{
          margin: '8px 0 0 0',
          color: '#94a3b8',
          fontSize: '16px'
        }}>
          Detailed analysis of viewing sessions and user engagement patterns
        </p>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <MetricCard title="Total Sessions" value={metrics.totalSessions} icon="📊" />
          <MetricCard title="Avg Duration" value={formatDuration(metrics.avgDuration)} icon="⏱️" />
          <MetricCard title="Avg Completion" value={`${metrics.avgCompletion}%`} icon="✅" />
          <MetricCard title="Completed" value={metrics.completedCount} icon="🎬" />
          <MetricCard title="Avg Pauses" value={metrics.avgPauses} icon="⏸️" />
          <MetricCard title="Avg Seeks" value={metrics.avgSeeks} icon="⏩" />
        </div>
      )}

      {/* Filters and Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} style={selectStyle}>
            <option value="all">All Sessions</option>
            <option value="completed">Completed (90%+)</option>
            <option value="abandoned">Abandoned (&lt;50%)</option>
          </select>
          <select value={contentTypeFilter} onChange={(e) => setContentTypeFilter(e.target.value as any)} style={selectStyle}>
            <option value="all">All Content</option>
            <option value="movie">Movies Only</option>
            <option value="tv">TV Shows Only</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} style={selectStyle}>
            <option value="recent">Most Recent</option>
            <option value="duration">Longest Duration</option>
            <option value="completion">Highest Completion</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setViewMode('table')} style={{ ...viewButtonStyle, background: viewMode === 'table' ? '#7877c6' : 'rgba(255, 255, 255, 0.05)', color: viewMode === 'table' ? 'white' : '#94a3b8' }}>📋 Table</button>
          <button onClick={() => setViewMode('timeline')} style={{ ...viewButtonStyle, background: viewMode === 'timeline' ? '#7877c6' : 'rgba(255, 255, 255, 0.05)', color: viewMode === 'timeline' ? 'white' : '#94a3b8' }}>📈 Timeline</button>
          <button onClick={() => exportSessions()} style={{ ...viewButtonStyle, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>📥 Export</button>
        </div>
      </div>

      {/* Sessions Table View */}
      {viewMode === 'table' && (
        <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                  <th style={thStyle}>Content</th>
                  <th style={thStyle}>Started</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Watch Time</th>
                  <th style={thStyle}>Completion</th>
                  <th style={thStyle}>Device</th>
                  <th style={thStyle}>Pauses</th>
                  <th style={thStyle}>Seeks</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading sessions...</td></tr>
                ) : sessions.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No sessions found</td></tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.id} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }} onClick={() => setSelectedSession(session)}>
                      <td style={tdStyle}>
                        <div>
                          <div style={{ color: '#f8fafc', fontWeight: '500' }}>{session.content_title || `Content #${session.content_id}`}</div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', background: session.content_type === 'movie' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: session.content_type === 'movie' ? '#10b981' : '#f59e0b' }}>{session.content_type}</span>
                            {session.season_number && session.episode_number && <span style={{ color: '#64748b', fontSize: '12px' }}>S{session.season_number}E{session.episode_number}</span>}
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>{formatDate(session.started_at)}</td>
                      <td style={tdStyle}>{formatDuration(session.duration)}</td>
                      <td style={tdStyle}>{formatDuration(session.total_watch_time)}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(session.completion_percentage, 100)}%`, background: getCompletionColor(session.completion_percentage), borderRadius: '3px' }} />
                          </div>
                          <span style={{ color: getCompletionColor(session.completion_percentage), fontWeight: '600', fontSize: '13px' }}>{Math.round(session.completion_percentage)}%</span>
                        </div>
                      </td>
                      <td style={tdStyle}><span style={{ textTransform: 'capitalize' }}>{session.device_type || 'Unknown'}</span></td>
                      <td style={tdStyle}>{session.pause_count}</td>
                      <td style={tdStyle}>{session.seek_count}</td>
                      <td style={tdStyle}><button onClick={(e) => { e.stopPropagation(); setSelectedSession(session); }} style={{ padding: '4px 8px', background: 'rgba(120, 119, 198, 0.2)', border: '1px solid rgba(120, 119, 198, 0.3)', borderRadius: '4px', color: '#7877c6', cursor: 'pointer', fontSize: '12px' }}>Details</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Hourly Distribution */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '16px' }}>📊 Hourly Distribution</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
              {Array.from({ length: 24 }, (_, hour) => {
                const hourData = getHourlyDistribution();
                const count = hourData[hour] || 0;
                const maxCount = Math.max(...Object.values(hourData), 1);
                const height = (count / maxCount) * 100;
                return (
                  <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '100%', height: `${height}%`, minHeight: count > 0 ? '4px' : '0', background: 'linear-gradient(180deg, #7877c6, #ff77c6)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} title={`${hour}:00 - ${count} sessions`} />
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{hour}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session Timeline */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '16px' }}>🕐 Recent Sessions Timeline</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sessions.slice(0, 20).map((session) => (
                <div key={session.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setSelectedSession(session)}>
                  <div style={{ width: '60px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>{new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getCompletionColor(session.completion_percentage), boxShadow: `0 0 8px ${getCompletionColor(session.completion_percentage)}40` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f8fafc', fontWeight: '500', fontSize: '14px' }}>{session.content_title || session.content_id}</div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>{formatDuration(session.total_watch_time)} watched • {Math.round(session.completion_percentage)}% complete</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', background: session.content_type === 'movie' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: session.content_type === 'movie' ? '#10b981' : '#f59e0b' }}>{session.content_type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setSelectedSession(null)}>
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px' }}>{selectedSession.content_title || selectedSession.content_id}</h3>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', background: selectedSession.content_type === 'movie' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: selectedSession.content_type === 'movie' ? '#10b981' : '#f59e0b' }}>{selectedSession.content_type}</span>
                  {selectedSession.season_number && <span style={{ color: '#94a3b8', fontSize: '14px' }}>S{selectedSession.season_number}E{selectedSession.episode_number}</span>}
                </div>
              </div>
              <button onClick={() => setSelectedSession(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer', padding: '0' }}>×</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <DetailItem label="Started" value={formatDate(selectedSession.started_at)} />
              <DetailItem label="Device" value={selectedSession.device_type || 'Unknown'} />
              <DetailItem label="Duration" value={formatDuration(selectedSession.duration)} />
              <DetailItem label="Watch Time" value={formatDuration(selectedSession.total_watch_time)} />
              <DetailItem label="Quality" value={selectedSession.quality || 'Auto'} />
              <DetailItem label="Last Position" value={formatDuration(selectedSession.last_position)} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>Completion</span>
                <span style={{ color: getCompletionColor(selectedSession.completion_percentage), fontWeight: '600' }}>{Math.round(selectedSession.completion_percentage)}%</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(selectedSession.completion_percentage, 100)}%`, background: getCompletionColor(selectedSession.completion_percentage), borderRadius: '4px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '24px', padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc' }}>{selectedSession.pause_count}</div>
                <div style={{ color: '#64748b', fontSize: '12px' }}>Pauses</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc' }}>{selectedSession.seek_count}</div>
                <div style={{ color: '#64748b', fontSize: '12px' }}>Seeks</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: selectedSession.is_completed ? '#10b981' : '#f59e0b' }}>{selectedSession.is_completed ? '✓' : '○'}</div>
                <div style={{ color: '#64748b', fontSize: '12px' }}>{selectedSession.is_completed ? 'Completed' : 'In Progress'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: '#f8fafc',
  fontSize: '14px',
  cursor: 'pointer'
};

const viewButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '500',
  display: 'flex',
  alignItems: 'center',
  gap: '6px'
};

const thStyle: React.CSSProperties = {
  padding: '14px 16px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: '600',
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  color: '#e2e8f0',
  fontSize: '14px'
};

function MetricCard({ title, value, icon }: { title: string; value: string | number; icon: string }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      padding: '16px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '22px', fontWeight: '700', color: '#f8fafc' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>{title}</div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: '#f8fafc', fontSize: '14px', fontWeight: '500', textTransform: 'capitalize' }}>{value}</div>
    </div>
  );
}
