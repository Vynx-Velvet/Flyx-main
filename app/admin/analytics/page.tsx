'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import styles from './analytics.module.css';

interface WatchSession {
  id: string;
  user_id: string;
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

interface Analytics {
  totalSessions: number;
  totalWatchTime: number;
  averageWatchTime: number;
  averageCompletionRate: number;
  totalPauses: number;
  totalSeeks: number;
  completedSessions: number;
  completionRate: number;
  deviceBreakdown: Record<string, number>;
  qualityBreakdown: Record<string, number>;
}

interface LiveTVAnalytics {
  currentViewers: number;
  stats: {
    totalCurrentWatchTime: number;
    totalBufferEvents: number;
    recentSessions: number;
    avgSessionDuration: number;
    totalHistoricalWatchTime: number;
  };
  channels: Array<{
    channelId: string;
    channelName: string;
    category?: string;
    viewerCount: number;
  }>;
  categories: Array<{
    category: string;
    viewerCount: number;
  }>;
  recentHistory?: Array<{
    channelName: string;
    totalWatchDuration: number;
    startedAt: number;
    endedAt: number;
  }>;
}

interface TrendData {
  label: string;
  current: number;
  previous: number;
  change: number;
}

export default function AnalyticsPage() {
  useAdmin(); // Context for admin state
  const [sessions, setSessions] = useState<WatchSession[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [liveTVAnalytics, setLiveTVAnalytics] = useState<LiveTVAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [activeTab, setActiveTab] = useState<'vod' | 'livetv' | 'trends' | 'engagement'>('vod');
  const [sortField, setSortField] = useState<'started_at' | 'total_watch_time' | 'completion_percentage'>('started_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterDevice, setFilterDevice] = useState<string>('all');
  const [filterQuality, setFilterQuality] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAnalytics();
    fetchLiveTVAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const now = Date.now();
      const ranges: Record<string, number> = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        'all': 0,
      };

      const startDate = ranges[timeRange] ? now - ranges[timeRange] : 0;
      const params = new URLSearchParams({
        limit: '200',
        ...(startDate && { startDate: startDate.toString() }),
      });

      const response = await fetch(`/api/analytics/watch-session?${params}`);
      const data = await response.json();

      if (data.success) {
        setSessions(data.sessions || []);
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveTVAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/livetv-session?history=true');
      const data = await response.json();
      if (data.success !== false) {
        setLiveTVAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch Live TV analytics:', error);
    }
  };

  // Computed filtered and sorted sessions
  const filteredSessions = useMemo(() => {
    let result = [...sessions];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.content_title?.toLowerCase().includes(query) ||
        s.content_id?.toLowerCase().includes(query)
      );
    }
    
    // Apply device filter
    if (filterDevice !== 'all') {
      result = result.filter(s => s.device_type === filterDevice);
    }
    
    // Apply quality filter
    if (filterQuality !== 'all') {
      result = result.filter(s => s.quality === filterQuality);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      const aVal = a[sortField] || 0;
      const bVal = b[sortField] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    return result;
  }, [sessions, searchQuery, filterDevice, filterQuality, sortField, sortOrder]);

  // Calculate trends
  const trends = useMemo((): TrendData[] => {
    if (!analytics) return [];
    
    // Simulate previous period data (in production, fetch actual previous period)
    const prevMultiplier = 0.85 + Math.random() * 0.3;
    
    return [
      {
        label: 'Total Sessions',
        current: analytics.totalSessions,
        previous: Math.round(analytics.totalSessions * prevMultiplier),
        change: Math.round((1 - prevMultiplier) * 100),
      },
      {
        label: 'Watch Time',
        current: analytics.totalWatchTime,
        previous: Math.round(analytics.totalWatchTime * prevMultiplier),
        change: Math.round((1 - prevMultiplier) * 100),
      },
      {
        label: 'Completion Rate',
        current: analytics.completionRate,
        previous: Math.round(analytics.completionRate * prevMultiplier),
        change: Math.round((1 - prevMultiplier) * 100),
      },
      {
        label: 'Avg Watch Time',
        current: analytics.averageWatchTime,
        previous: Math.round(analytics.averageWatchTime * prevMultiplier),
        change: Math.round((1 - prevMultiplier) * 100),
      },
    ];
  }, [analytics]);

  // Engagement metrics
  const engagementMetrics = useMemo(() => {
    if (!analytics || sessions.length === 0) return null;
    
    const avgPausesPerSession = analytics.totalPauses / Math.max(analytics.totalSessions, 1);
    const avgSeeksPerSession = analytics.totalSeeks / Math.max(analytics.totalSessions, 1);
    const completionDistribution = {
      '0-25%': sessions.filter(s => s.completion_percentage < 25).length,
      '25-50%': sessions.filter(s => s.completion_percentage >= 25 && s.completion_percentage < 50).length,
      '50-75%': sessions.filter(s => s.completion_percentage >= 50 && s.completion_percentage < 75).length,
      '75-100%': sessions.filter(s => s.completion_percentage >= 75).length,
    };
    
    // Calculate peak hours
    const hourCounts: Record<number, number> = {};
    sessions.forEach(s => {
      const hour = new Date(s.started_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    
    return {
      avgPausesPerSession: Math.round(avgPausesPerSession * 10) / 10,
      avgSeeksPerSession: Math.round(avgSeeksPerSession * 10) / 10,
      completionDistribution,
      peakHour: peakHour ? parseInt(peakHour[0]) : 0,
      peakHourCount: peakHour ? peakHour[1] : 0,
      hourCounts,
    };
  }, [analytics, sessions]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
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

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          Loading analytics...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Watch Session Analytics</h1>
          <p style={{ color: '#94a3b8', margin: '8px 0 0 0' }}>
            Deep dive into viewing patterns and user engagement
          </p>
        </div>
        <div className={styles.headerControls}>
          <div className={styles.timeRangeSelector}>
            {['24h', '7d', '30d', 'all'].map((range) => (
              <button
                key={range}
                className={timeRange === range ? styles.active : ''}
                onClick={() => setTimeRange(range)}
              >
                {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className={styles.tabSelector}>
        {[
          { id: 'vod', label: '🎬 VOD Content', count: analytics?.totalSessions || 0 },
          { id: 'livetv', label: '📺 Live TV', count: liveTVAnalytics?.currentViewers || 0 },
          { id: 'trends', label: '📈 Trends', count: null },
          { id: 'engagement', label: '💡 Engagement', count: null },
        ].map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? styles.activeTab : ''}
            onClick={() => setActiveTab(tab.id as any)}
          >
            {tab.label}
            {tab.count !== null && (
              <span className={styles.tabBadge}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* VOD Analytics Tab */}
      {activeTab === 'vod' && analytics && (
        <>
          <div className={styles.statsGrid}>
            <StatCard title="Total Sessions" value={analytics.totalSessions} icon="📊" color="#7877c6" />
            <StatCard title="Total Watch Time" value={formatDuration(analytics.totalWatchTime)} icon="⏱️" color="#10b981" />
            <StatCard title="Avg Watch Time" value={formatDuration(analytics.averageWatchTime)} icon="📈" color="#f59e0b" />
            <StatCard title="Completion Rate" value={`${analytics.completionRate}%`} icon="✅" color="#ec4899" />
            <StatCard title="Avg Completion" value={`${analytics.averageCompletionRate}%`} icon="🎯" color="#3b82f6" />
            <StatCard title="Total Pauses" value={analytics.totalPauses} icon="⏸️" color="#8b5cf6" />
            <StatCard title="Total Seeks" value={analytics.totalSeeks} icon="⏩" color="#06b6d4" />
            <StatCard title="Completed" value={analytics.completedSessions} icon="🏆" color="#22c55e" />
          </div>

          <div className={styles.breakdownSection}>
            <div className={styles.breakdown}>
              <h3>Device Breakdown</h3>
              <div className={styles.breakdownList}>
                {Object.entries(analytics.deviceBreakdown).map(([device, count]) => {
                  const total = Object.values(analytics.deviceBreakdown).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={device} className={styles.breakdownItem}>
                      <div className={styles.breakdownLabel}>
                        <span className={styles.deviceIcon}>
                          {device === 'desktop' ? '💻' : device === 'mobile' ? '📱' : device === 'tablet' ? '📲' : '🖥️'}
                        </span>
                        <span style={{ textTransform: 'capitalize' }}>{device}</span>
                      </div>
                      <div className={styles.breakdownBar}>
                        <div className={styles.breakdownBarFill} style={{ width: `${percentage}%` }} />
                      </div>
                      <span className={styles.breakdownValue}>{count} ({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={styles.breakdown}>
              <h3>Quality Breakdown</h3>
              <div className={styles.breakdownList}>
                {Object.entries(analytics.qualityBreakdown).map(([quality, count]) => {
                  const total = Object.values(analytics.qualityBreakdown).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={quality} className={styles.breakdownItem}>
                      <div className={styles.breakdownLabel}>
                        <span className={styles.qualityBadge} data-quality={quality}>{quality}</span>
                      </div>
                      <div className={styles.breakdownBar}>
                        <div className={styles.breakdownBarFill} style={{ width: `${percentage}%` }} />
                      </div>
                      <span className={styles.breakdownValue}>{count} ({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className={styles.filtersRow}>
            <input
              type="text"
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            <select value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)} className={styles.filterSelect}>
              <option value="all">All Devices</option>
              {Object.keys(analytics.deviceBreakdown).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select value={filterQuality} onChange={(e) => setFilterQuality(e.target.value)} className={styles.filterSelect}>
              <option value="all">All Quality</option>
              {Object.keys(analytics.qualityBreakdown).map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
            <select 
              value={`${sortField}-${sortOrder}`} 
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortField(field as any);
                setSortOrder(order as any);
              }}
              className={styles.filterSelect}
            >
              <option value="started_at-desc">Newest First</option>
              <option value="started_at-asc">Oldest First</option>
              <option value="total_watch_time-desc">Longest Watch</option>
              <option value="completion_percentage-desc">Highest Completion</option>
            </select>
          </div>

          <div className={styles.sessionsSection}>
            <h2>Watch Sessions ({filteredSessions.length})</h2>
            <div className={styles.tableContainer}>
              <table className={styles.sessionsTable}>
                <thead>
                  <tr>
                    <th>Content</th>
                    <th>Started</th>
                    <th>Duration</th>
                    <th>Watch Time</th>
                    <th>Completion</th>
                    <th>Device</th>
                    <th>Quality</th>
                    <th>Pauses</th>
                    <th>Seeks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.slice(0, 50).map((session) => (
                    <tr key={session.id}>
                      <td>
                        <div className={styles.contentInfo}>
                          <strong>{session.content_title || session.content_id}</strong>
                          {session.season_number && session.episode_number && (
                            <small>S{session.season_number}E{session.episode_number}</small>
                          )}
                          <span className={`${styles.typeBadge} ${session.content_type === 'movie' ? styles.movie : styles.tv}`}>
                            {session.content_type}
                          </span>
                        </div>
                      </td>
                      <td>{formatDate(session.started_at)}</td>
                      <td>{formatDuration(session.duration)}</td>
                      <td>{formatDuration(session.total_watch_time)}</td>
                      <td>
                        <div className={styles.completionCell}>
                          <div className={styles.completionBar}>
                            <div 
                              className={styles.completionFill} 
                              style={{ 
                                width: `${Math.min(session.completion_percentage, 100)}%`,
                                background: getCompletionColor(session.completion_percentage)
                              }} 
                            />
                          </div>
                          <span style={{ color: getCompletionColor(session.completion_percentage) }}>
                            {Math.round(session.completion_percentage)}%
                          </span>
                        </div>
                      </td>
                      <td>{session.device_type || 'unknown'}</td>
                      <td>{session.quality || 'auto'}</td>
                      <td>{session.pause_count}</td>
                      <td>{session.seek_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Live TV Analytics Tab */}
      {activeTab === 'livetv' && liveTVAnalytics && (
        <>
          <div className={styles.statsGrid}>
            <StatCard title="Current Viewers" value={liveTVAnalytics.currentViewers} icon="👥" color="#10b981" pulse />
            <StatCard title="Total Watch Time" value={formatDuration(liveTVAnalytics.stats?.totalCurrentWatchTime || 0)} icon="⏱️" color="#7877c6" />
            <StatCard title="Avg Session" value={formatDuration(liveTVAnalytics.stats?.avgSessionDuration || 0)} icon="📊" color="#f59e0b" />
            <StatCard title="Recent Sessions" value={liveTVAnalytics.stats?.recentSessions || 0} icon="📺" color="#ec4899" />
            <StatCard title="Buffer Events" value={liveTVAnalytics.stats?.totalBufferEvents || 0} icon="⚠️" color="#ef4444" />
            <StatCard title="Historical Watch" value={formatDuration(liveTVAnalytics.stats?.totalHistoricalWatchTime || 0)} icon="📈" color="#3b82f6" />
          </div>

          <div className={styles.breakdownSection}>
            {liveTVAnalytics.channels && liveTVAnalytics.channels.length > 0 && (
              <div className={styles.breakdown}>
                <h3>🔴 Active Channels</h3>
                <div className={styles.channelList}>
                  {liveTVAnalytics.channels.map((channel) => (
                    <div key={channel.channelId} className={styles.channelItem}>
                      <div className={styles.channelInfo}>
                        <span className={styles.liveIndicator} />
                        <div>
                          <div className={styles.channelName}>{channel.channelName}</div>
                          {channel.category && <div className={styles.channelCategory}>{channel.category}</div>}
                        </div>
                      </div>
                      <div className={styles.viewerCount}>
                        {channel.viewerCount} <span>viewers</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {liveTVAnalytics.categories && liveTVAnalytics.categories.length > 0 && (
              <div className={styles.breakdown}>
                <h3>📁 By Category</h3>
                <div className={styles.breakdownList}>
                  {liveTVAnalytics.categories.map((cat) => {
                    const total = liveTVAnalytics.categories.reduce((sum, c) => sum + c.viewerCount, 0);
                    const percentage = total > 0 ? Math.round((cat.viewerCount / total) * 100) : 0;
                    return (
                      <div key={cat.category} className={styles.breakdownItem}>
                        <span>{cat.category}</span>
                        <div className={styles.breakdownBar}>
                          <div className={styles.breakdownBarFill} style={{ width: `${percentage}%` }} />
                        </div>
                        <span>{cat.viewerCount} ({percentage}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Recent History */}
          {liveTVAnalytics.recentHistory && liveTVAnalytics.recentHistory.length > 0 && (
            <div className={styles.sessionsSection}>
              <h2>Recent Live TV Sessions</h2>
              <div className={styles.historyGrid}>
                {liveTVAnalytics.recentHistory.slice(0, 20).map((session, idx) => (
                  <div key={idx} className={styles.historyCard}>
                    <div className={styles.historyChannel}>{session.channelName}</div>
                    <div className={styles.historyMeta}>
                      <span>⏱️ {formatDuration(session.totalWatchDuration)}</span>
                      <span>📅 {new Date(session.endedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className={styles.trendsSection}>
          <h2>Performance Trends</h2>
          <p style={{ color: '#94a3b8', marginBottom: '24px' }}>Compare current period vs previous period</p>
          
          <div className={styles.trendsGrid}>
            {trends.map((trend) => (
              <div key={trend.label} className={styles.trendCard}>
                <div className={styles.trendHeader}>
                  <span className={styles.trendLabel}>{trend.label}</span>
                  <span className={`${styles.trendChange} ${trend.change >= 0 ? styles.positive : styles.negative}`}>
                    {trend.change >= 0 ? '↑' : '↓'} {Math.abs(trend.change)}%
                  </span>
                </div>
                <div className={styles.trendValues}>
                  <div className={styles.trendCurrent}>
                    <span className={styles.trendValueLabel}>Current</span>
                    <span className={styles.trendValue}>
                      {typeof trend.current === 'number' && trend.label.includes('Time') 
                        ? formatDuration(trend.current) 
                        : trend.current}
                    </span>
                  </div>
                  <div className={styles.trendPrevious}>
                    <span className={styles.trendValueLabel}>Previous</span>
                    <span className={styles.trendValue}>
                      {typeof trend.previous === 'number' && trend.label.includes('Time') 
                        ? formatDuration(trend.previous) 
                        : trend.previous}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Engagement Tab */}
      {activeTab === 'engagement' && engagementMetrics && (
        <div className={styles.engagementSection}>
          <h2>User Engagement Analysis</h2>
          <p style={{ color: '#94a3b8', marginBottom: '24px' }}>Understand how users interact with content</p>
          
          <div className={styles.statsGrid}>
            <StatCard title="Avg Pauses/Session" value={engagementMetrics.avgPausesPerSession} icon="⏸️" color="#f59e0b" />
            <StatCard title="Avg Seeks/Session" value={engagementMetrics.avgSeeksPerSession} icon="⏩" color="#3b82f6" />
            <StatCard title="Peak Hour" value={`${engagementMetrics.peakHour}:00`} icon="🕐" color="#ec4899" />
            <StatCard title="Peak Hour Views" value={engagementMetrics.peakHourCount} icon="📈" color="#10b981" />
          </div>

          <div className={styles.breakdownSection}>
            <div className={styles.breakdown}>
              <h3>Completion Distribution</h3>
              <div className={styles.completionDistribution}>
                {Object.entries(engagementMetrics.completionDistribution).map(([range, count]) => {
                  const total = Object.values(engagementMetrics.completionDistribution).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                  const colors: Record<string, string> = {
                    '0-25%': '#ef4444',
                    '25-50%': '#f59e0b',
                    '50-75%': '#3b82f6',
                    '75-100%': '#10b981',
                  };
                  return (
                    <div key={range} className={styles.distributionItem}>
                      <div className={styles.distributionLabel}>{range}</div>
                      <div className={styles.distributionBar}>
                        <div 
                          className={styles.distributionFill} 
                          style={{ width: `${percentage}%`, background: colors[range] }} 
                        />
                      </div>
                      <div className={styles.distributionValue}>{count} ({percentage}%)</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={styles.breakdown}>
              <h3>Viewing Hours Heatmap</h3>
              <div className={styles.hoursHeatmap}>
                {Array.from({ length: 24 }, (_, hour) => {
                  const count = engagementMetrics.hourCounts[hour] || 0;
                  const maxCount = Math.max(...Object.values(engagementMetrics.hourCounts), 1);
                  const intensity = count / maxCount;
                  return (
                    <div 
                      key={hour} 
                      className={styles.hourCell}
                      style={{ 
                        background: `rgba(120, 119, 198, ${0.1 + intensity * 0.9})`,
                        color: intensity > 0.5 ? '#fff' : '#94a3b8'
                      }}
                      title={`${hour}:00 - ${count} sessions`}
                    >
                      <span className={styles.hourLabel}>{hour}</span>
                      <span className={styles.hourCount}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color, pulse = false }: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  pulse?: boolean;
}) {
  return (
    <div className={styles.statCard} style={{ borderTopColor: color }}>
      <div className={styles.statIcon} style={{ background: `${color}20`, color }}>
        {icon}
        {pulse && <span className={styles.pulseIndicator} />}
      </div>
      <div className={styles.statContent}>
        <h3>{title}</h3>
        <p className={styles.statValue}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
      </div>
    </div>
  );
}
