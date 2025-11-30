'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAdmin } from '../context/AdminContext';
import { contentTitleCache } from '../../lib/utils/content-title-cache';

interface ContentStat {
  contentId: string;
  contentTitle: string;
  contentType: string;
  views: number;
  totalWatchTime: number;
  avgCompletion: number;
  uniqueViewers: number;
  displayTitle?: string;
}

interface ContentMetrics {
  totalContent: number;
  totalViews: number;
  totalWatchTime: number;
  avgCompletion: number;
  movieCount: number;
  tvCount: number;
  topPerformer: string;
  mostCompleted: string;
}

export default function AdminContentPage() {
  const { dateRange, setIsLoading } = useAdmin();
  const [stats, setStats] = useState<ContentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [contentType, setContentType] = useState('all');
  const [sortBy, setSortBy] = useState<'views' | 'watchTime' | 'completion' | 'viewers'>('views');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'chart'>('table');

  useEffect(() => {
    fetchStats();
  }, [dateRange, contentType]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setIsLoading(true);
      const params = new URLSearchParams();
      if (dateRange.startDate && dateRange.endDate) {
        params.append('startDate', dateRange.startDate.toISOString());
        params.append('endDate', dateRange.endDate.toISOString());
      } else {
        params.append('period', dateRange.period);
      }
      if (contentType !== 'all') {
        params.append('contentType', contentType);
      }
      const response = await fetch(`/api/admin/analytics?${params}`);
      if (response.ok) {
        const data = await response.json();
        const rawStats = data.data.contentPerformance || [];
        setStats(rawStats);
        if (rawStats.length > 0) {
          setLoadingTitles(true);
          try {
            const titlesMap = await contentTitleCache.getTitles(
              rawStats.map((stat: ContentStat) => ({
                contentId: stat.contentId,
                contentType: stat.contentType as 'movie' | 'tv'
              }))
            );
            setStats(prevStats => prevStats.map(stat => ({
              ...stat,
              displayTitle: titlesMap.get(`${stat.contentType}-${stat.contentId}`) || stat.contentTitle || `${stat.contentType === 'movie' ? 'Movie' : 'Show'} #${stat.contentId}`
            })));
          } catch (err) {
            console.error('Failed to fetch titles:', err);
          } finally {
            setLoadingTitles(false);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch content stats:', err);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  const metrics = useMemo((): ContentMetrics | null => {
    if (stats.length === 0) return null;
    const totalViews = stats.reduce((sum, s) => sum + s.views, 0);
    const totalWatchTime = stats.reduce((sum, s) => sum + s.totalWatchTime, 0);
    const avgCompletion = stats.reduce((sum, s) => sum + s.avgCompletion, 0) / stats.length;
    const movieCount = stats.filter(s => s.contentType === 'movie').length;
    const tvCount = stats.filter(s => s.contentType === 'tv').length;
    const topByViews = [...stats].sort((a, b) => b.views - a.views)[0];
    const topByCompletion = [...stats].sort((a, b) => b.avgCompletion - a.avgCompletion)[0];
    return {
      totalContent: stats.length,
      totalViews,
      totalWatchTime,
      avgCompletion: Math.round(avgCompletion),
      movieCount,
      tvCount,
      topPerformer: topByViews?.displayTitle || topByViews?.contentTitle || 'N/A',
      mostCompleted: topByCompletion?.displayTitle || topByCompletion?.contentTitle || 'N/A',
    };
  }, [stats]);

  const filteredStats = useMemo(() => {
    let result = [...stats];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.displayTitle?.toLowerCase().includes(query) ||
        s.contentTitle?.toLowerCase().includes(query) ||
        s.contentId?.toLowerCase().includes(query)
      );
    }
    result.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortBy) {
        case 'views': aVal = a.views; bVal = b.views; break;
        case 'watchTime': aVal = a.totalWatchTime; bVal = b.totalWatchTime; break;
        case 'completion': aVal = a.avgCompletion; bVal = b.avgCompletion; break;
        case 'viewers': aVal = a.uniqueViewers; bVal = b.uniqueViewers; break;
        default: aVal = a.views; bVal = b.views;
      }
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
    return result;
  }, [stats, searchQuery, sortBy, sortOrder]);

  const chartData = useMemo(() => {
    const top10 = filteredStats.slice(0, 10);
    const maxViews = Math.max(...top10.map(s => s.views), 1);
    return top10.map(s => ({ ...s, viewsPercentage: (s.views / maxViews) * 100 }));
  }, [filteredStats]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 75) return '#10b981';
    if (percentage >= 50) return '#f59e0b';
    if (percentage >= 25) return '#3b82f6';
    return '#ef4444';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
        Loading content analytics...
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '24px', fontWeight: '600' }}>Content Performance</h2>
        <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '16px' }}>Analyze content popularity, engagement, and viewer retention</p>
      </div>

      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <MetricCard title="Total Content" value={metrics.totalContent} icon="📚" color="#7877c6" />
          <MetricCard title="Total Views" value={metrics.totalViews.toLocaleString()} icon="👁️" color="#10b981" />
          <MetricCard title="Watch Time" value={formatDuration(metrics.totalWatchTime)} icon="⏱️" color="#f59e0b" />
          <MetricCard title="Avg Completion" value={`${metrics.avgCompletion}%`} icon="✅" color="#ec4899" />
          <MetricCard title="Movies" value={metrics.movieCount} icon="🎬" color="#3b82f6" />
          <MetricCard title="TV Shows" value={metrics.tvCount} icon="📺" color="#8b5cf6" />
        </div>
      )}

      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ color: '#10b981', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>🏆 TOP PERFORMER</div>
            <div style={{ color: '#f8fafc', fontSize: '18px', fontWeight: '600' }}>{metrics.topPerformer}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(236, 72, 153, 0.05))', border: '1px solid rgba(236, 72, 153, 0.3)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ color: '#ec4899', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>⭐ HIGHEST COMPLETION</div>
            <div style={{ color: '#f8fafc', fontSize: '18px', fontWeight: '600' }}>{metrics.mostCompleted}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="Search content..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '10px 16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '14px', minWidth: '200px', outline: 'none' }} />
          <select value={contentType} onChange={(e) => setContentType(e.target.value)} style={selectStyle}>
            <option value="all">All Content</option>
            <option value="movie">Movies</option>
            <option value="tv">TV Shows</option>
          </select>
          <select value={`${sortBy}-${sortOrder}`} onChange={(e) => { const [field, order] = e.target.value.split('-'); setSortBy(field as typeof sortBy); setSortOrder(order as typeof sortOrder); }} style={selectStyle}>
            <option value="views-desc">Most Views</option>
            <option value="views-asc">Least Views</option>
            <option value="watchTime-desc">Most Watch Time</option>
            <option value="completion-desc">Highest Completion</option>
            <option value="viewers-desc">Most Unique Viewers</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '8px' }}>
          {[{ id: 'table', icon: '📋' }, { id: 'cards', icon: '🃏' }, { id: 'chart', icon: '📊' }].map((mode) => (
            <button key={mode.id} onClick={() => setViewMode(mode.id as typeof viewMode)} style={{ padding: '8px 12px', background: viewMode === mode.id ? '#7877c6' : 'transparent', border: 'none', borderRadius: '6px', color: viewMode === mode.id ? 'white' : '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>{mode.icon}</button>
          ))}
        </div>
      </div>

      {loadingTitles && <div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>Fetching content titles...</div>}

      {viewMode === 'table' && (
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Views</th>
                  <th style={thStyle}>Unique Viewers</th>
                  <th style={thStyle}>Watch Time</th>
                  <th style={thStyle}>Completion</th>
                </tr>
              </thead>
              <tbody>
                {filteredStats.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No content found</td></tr>
                ) : (
                  filteredStats.map((stat, index) => (
                    <tr key={stat.contentId} style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={tdStyle}><span style={{ width: '28px', height: '28px', borderRadius: '50%', background: index < 3 ? ['#ffd700', '#c0c0c0', '#cd7f32'][index] : 'rgba(255,255,255,0.1)', color: index < 3 ? '#000' : '#94a3b8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '12px' }}>{index + 1}</span></td>
                      <td style={tdStyle}><div style={{ color: '#f8fafc', fontWeight: '500' }}>{stat.displayTitle || stat.contentTitle || stat.contentId}</div><div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>ID: {stat.contentId}</div></td>
                      <td style={tdStyle}><span style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', background: stat.contentType === 'movie' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: stat.contentType === 'movie' ? '#10b981' : '#f59e0b' }}>{stat.contentType}</span></td>
                      <td style={tdStyle}><span style={{ fontWeight: '600', color: '#f8fafc' }}>{stat.views.toLocaleString()}</span></td>
                      <td style={tdStyle}><span style={{ color: '#94a3b8' }}>{stat.uniqueViewers?.toLocaleString() || 0}</span></td>
                      <td style={tdStyle}><span style={{ color: '#f8fafc' }}>{formatDuration(stat.totalWatchTime)}</span></td>
                      <td style={tdStyle}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '80px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(stat.avgCompletion, 100)}%`, background: getCompletionColor(stat.avgCompletion), borderRadius: '4px' }} /></div><span style={{ color: getCompletionColor(stat.avgCompletion), fontWeight: '600', fontSize: '13px' }}>{Math.round(stat.avgCompletion)}%</span></div></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'cards' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filteredStats.map((stat, index) => (
            <div key={stat.contentId} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px', position: 'relative' }}>
              {index < 3 && <div style={{ position: 'absolute', top: '12px', right: '12px', width: '28px', height: '28px', borderRadius: '50%', background: ['#ffd700', '#c0c0c0', '#cd7f32'][index], color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '12px' }}>{index + 1}</div>}
              <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', background: stat.contentType === 'movie' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: stat.contentType === 'movie' ? '#10b981' : '#f59e0b' }}>{stat.contentType}</span>
              <h3 style={{ margin: '12px 0 16px 0', color: '#f8fafc', fontSize: '16px', fontWeight: '600', lineHeight: '1.3', paddingRight: index < 3 ? '36px' : 0 }}>{stat.displayTitle || stat.contentTitle || stat.contentId}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Views</div><div style={{ color: '#f8fafc', fontSize: '18px', fontWeight: '700' }}>{stat.views.toLocaleString()}</div></div>
                <div><div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Watch Time</div><div style={{ color: '#f8fafc', fontSize: '18px', fontWeight: '700' }}>{formatDuration(stat.totalWatchTime)}</div></div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span style={{ color: '#64748b', fontSize: '12px' }}>Completion</span><span style={{ color: getCompletionColor(stat.avgCompletion), fontWeight: '600', fontSize: '13px' }}>{Math.round(stat.avgCompletion)}%</span></div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(stat.avgCompletion, 100)}%`, background: getCompletionColor(stat.avgCompletion), borderRadius: '3px' }} /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'chart' && (
        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '16px' }}>Top 10 Content by Views</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {chartData.map((stat, index) => (
              <div key={stat.contentId} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: index < 3 ? ['#ffd700', '#c0c0c0', '#cd7f32'][index] : 'rgba(255,255,255,0.1)', color: index < 3 ? '#000' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '11px', flexShrink: 0 }}>{index + 1}</span>
                <div style={{ width: '200px', flexShrink: 0 }}><div style={{ color: '#f8fafc', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stat.displayTitle || stat.contentTitle || stat.contentId}</div><div style={{ color: '#64748b', fontSize: '11px' }}>{stat.contentType}</div></div>
                <div style={{ flex: 1, height: '24px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden' }}><div style={{ height: '100%', width: `${stat.viewsPercentage}%`, background: 'linear-gradient(90deg, #7877c6, #ff77c6)', borderRadius: '12px' }} /></div>
                <span style={{ color: '#f8fafc', fontWeight: '600', fontSize: '14px', width: '60px', textAlign: 'right' }}>{stat.views.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = { padding: '10px 16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#f8fafc', fontSize: '14px', cursor: 'pointer', outline: 'none' };
const thStyle: React.CSSProperties = { padding: '14px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' };
const tdStyle: React.CSSProperties = { padding: '14px 16px', color: '#e2e8f0', fontSize: '14px' };

function MetricCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '16px', borderTop: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}><span style={{ fontSize: '20px' }}>{icon}</span><span style={{ color: '#94a3b8', fontSize: '13px' }}>{title}</span></div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc' }}>{value}</div>
    </div>
  );
}
