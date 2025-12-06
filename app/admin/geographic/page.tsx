'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { useStats } from '../context/StatsContext';
import WorldMap from '../components/WorldMap';

interface GeoStat {
  country: string;
  countryName?: string;
  count: number;
  uniqueUsers?: number;
  sessions?: number;
}

interface GeoMetrics {
  totalCountries: number;
  topCountry: string;
  topCountryPercentage: number;
  internationalPercentage: number;
  regionBreakdown: Array<{ region: string; count: number }>;
}

export default function AdminGeographicPage() {
  const { dateRange, setIsLoading } = useAdmin();
  // Use unified stats for key metrics - SINGLE SOURCE OF TRUTH
  const { stats: unifiedStats } = useStats();
  
  const [geographic, setGeographic] = useState<GeoStat[]>([]);
  const [metrics, setMetrics] = useState<GeoMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'regions'>('list');
  
  // Prefer unified stats for geographic data when available
  const geoData = unifiedStats.topCountries.length > 0 
    ? unifiedStats.topCountries.map(c => ({ country: c.country, countryName: c.countryName, count: c.count }))
    : geographic;

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
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

      const response = await fetch(`/api/admin/analytics?${params}`);

      if (response.ok) {
        const data = await response.json();
        const geoData = data.data?.geographic || [];
        setGeographic(geoData);
        
        // Calculate metrics - always set metrics even if empty
        if (geoData.length > 0) {
          const total = geoData.reduce((sum: number, g: GeoStat) => sum + g.count, 0);
          const topCountry = geoData[0];
          
          // Group by region (simplified) - use country code for region mapping
          const regionMap: Record<string, number> = {};
          geoData.forEach((g: GeoStat) => {
            const region = getRegion(g.country);
            regionMap[region] = (regionMap[region] || 0) + g.count;
          });
          
          const regionBreakdown = Object.entries(regionMap)
            .map(([region, count]) => ({ region, count }))
            .sort((a, b) => b.count - a.count);
          
          // Use countryName from API if available, otherwise use getCountryName
          const topCountryDisplay = topCountry?.countryName || getCountryName(topCountry?.country) || topCountry?.country || 'N/A';
          
          setMetrics({
            totalCountries: geoData.filter((g: GeoStat) => g.country !== 'Unknown').length,
            topCountry: topCountryDisplay,
            topCountryPercentage: total > 0 ? Math.round((topCountry?.count / total) * 100) : 0,
            internationalPercentage: total > 0 ? Math.round(((total - (geoData[0]?.count || 0)) / total) * 100) : 0,
            regionBreakdown,
          });
        } else {
          // Set empty metrics so UI still renders
          setMetrics({
            totalCountries: 0,
            topCountry: 'N/A',
            topCountryPercentage: 0,
            internationalPercentage: 0,
            regionBreakdown: [],
          });
        }
      } else {
        console.error('Failed to fetch geographic data:', response.status);
        // Set empty metrics on error
        setMetrics({
          totalCountries: 0,
          topCountry: 'N/A',
          topCountryPercentage: 0,
          internationalPercentage: 0,
          regionBreakdown: [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch geographic data:', err);
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  };

  const getRegion = (countryCode: string): string => {
    const regions: Record<string, string[]> = {
      'North America': ['US', 'CA', 'MX'],
      'Europe': ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'PL', 'AT', 'CH', 'IE', 'PT'],
      'Asia Pacific': ['JP', 'KR', 'CN', 'IN', 'AU', 'NZ', 'SG', 'HK', 'TW', 'TH', 'MY', 'PH', 'ID', 'VN'],
      'Latin America': ['BR', 'AR', 'CL', 'CO', 'PE', 'VE'],
      'Middle East': ['AE', 'SA', 'IL', 'TR', 'EG'],
      'Africa': ['ZA', 'NG', 'KE', 'MA'],
    };
    
    for (const [region, countries] of Object.entries(regions)) {
      if (countries.includes(countryCode)) return region;
    }
    return 'Other';
  };

  const getCountryName = (code: string): string => {
    if (code === 'Unknown' || code === 'Local') return code;
    try {
      const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
      return regionNames.of(code) || code;
    } catch {
      return code;
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
        Loading geographic data...
      </div>
    );
  }

  return (
    <div>
      <div style={{
        marginBottom: '32px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <h2 style={{
            margin: 0,
            color: '#f8fafc',
            fontSize: '24px',
            fontWeight: '600',
            letterSpacing: '-0.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}>🌍</span>
            Geographic Analytics
          </h2>
          <p style={{
            margin: '8px 0 0 0',
            color: '#94a3b8',
            fontSize: '14px'
          }}>
            Real-time viewer distribution across the globe
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}>
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '20px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#22c55e',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: '500' }}>Live Data</span>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Metrics Cards */}
      {metrics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '16px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
              borderRadius: '50%',
            }} />
            <div style={{ color: '#a5b4fc', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Countries</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#f8fafc' }}>{metrics.totalCountries}</div>
            <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Unique locations</div>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.05))',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            borderRadius: '16px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              background: 'radial-gradient(circle, rgba(168, 85, 247, 0.2) 0%, transparent 70%)',
              borderRadius: '50%',
            }} />
            <div style={{ color: '#c4b5fd', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Top Country</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc' }}>{getCountryName(metrics.topCountry)}</div>
            <div style={{ color: '#a855f7', fontSize: '14px', fontWeight: '600', marginTop: '4px' }}>{metrics.topCountryPercentage}% of viewers</div>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05))',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: '16px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              background: 'radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, transparent 70%)',
              borderRadius: '50%',
            }} />
            <div style={{ color: '#86efac', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>International</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#f8fafc' }}>{metrics.internationalPercentage}%</div>
            <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Global reach</div>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.1), rgba(245, 158, 11, 0.05))',
            border: '1px solid rgba(251, 146, 60, 0.2)',
            borderRadius: '16px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              width: '80px',
              height: '80px',
              background: 'radial-gradient(circle, rgba(251, 146, 60, 0.2) 0%, transparent 70%)',
              borderRadius: '50%',
            }} />
            <div style={{ color: '#fdba74', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Regions</div>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#f8fafc' }}>{metrics.regionBreakdown.length}</div>
            <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>Active zones</div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        background: 'rgba(255, 255, 255, 0.02)',
        padding: '6px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        width: 'fit-content',
      }}>
        <button
          onClick={() => setViewMode('list')}
          style={{
            padding: '10px 20px',
            background: viewMode === 'list' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: viewMode === 'list' ? '#fff' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          🗺️ World Map
        </button>
        <button
          onClick={() => setViewMode('regions')}
          style={{
            padding: '10px 20px',
            background: viewMode === 'regions' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: viewMode === 'regions' ? '#fff' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          📊 By Region
        </button>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'list' ? (
        <WorldMap data={geoData} />
      ) : (
        <div style={{
          background: 'linear-gradient(135deg, rgba(10, 10, 20, 0.98), rgba(15, 15, 30, 0.95))',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '20px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px', fontWeight: '600' }}>
              📊 Regional Distribution
            </h3>
            <span style={{ color: '#64748b', fontSize: '13px' }}>
              {metrics?.regionBreakdown.length || 0} active regions
            </span>
          </div>
          
          <div style={{ padding: '24px' }}>
            {metrics?.regionBreakdown && metrics.regionBreakdown.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {metrics.regionBreakdown.map((region, index) => {
                  const total = metrics.regionBreakdown.reduce((sum, r) => sum + r.count, 0);
                  const percentage = total > 0 ? (region.count / total) * 100 : 0;
                  const colors = [
                    'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    'linear-gradient(90deg, #a855f7, #d946ef)',
                    'linear-gradient(90deg, #ec4899, #f43f5e)',
                    'linear-gradient(90deg, #f97316, #eab308)',
                    'linear-gradient(90deg, #22c55e, #10b981)',
                    'linear-gradient(90deg, #06b6d4, #3b82f6)',
                  ];
                  const color = colors[index % colors.length];
                  
                  return (
                    <div key={region.region} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      transition: 'all 0.2s ease',
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(99, 102, 241, 0.1)',
                            borderRadius: '8px',
                            fontSize: '16px',
                          }}>
                            {getRegionEmoji(region.region)}
                          </span>
                          <span style={{ color: '#f8fafc', fontWeight: '600', fontSize: '15px' }}>{region.region}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span style={{ color: '#f8fafc', fontWeight: '700', fontSize: '18px' }}>
                            {region.count.toLocaleString()}
                          </span>
                          <span style={{
                            background: 'rgba(99, 102, 241, 0.1)',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            color: '#a5b4fc',
                            fontSize: '13px',
                            fontWeight: '600',
                          }}>
                            {Math.round(percentage)}%
                          </span>
                        </div>
                      </div>
                      <div style={{
                        height: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${percentage}%`,
                          background: color,
                          borderRadius: '4px',
                          transition: 'width 0.5s ease',
                          boxShadow: '0 0 10px rgba(99, 102, 241, 0.3)',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 40px', color: '#64748b' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  margin: '0 auto 24px auto',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 40px rgba(99, 102, 241, 0.4)',
                }}>
                  <span style={{ fontSize: '36px' }}>🗺️</span>
                </div>
                <h4 style={{ color: '#f8fafc', margin: '0 0 8px 0' }}>No Regional Data Yet</h4>
                <p style={{ margin: 0, fontSize: '14px' }}>Geographic data will appear as users watch content</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getRegionEmoji(region: string): string {
  const emojis: Record<string, string> = {
    'North America': '🌎',
    'Europe': '🌍',
    'Asia Pacific': '🌏',
    'Latin America': '🌎',
    'Middle East': '🏜️',
    'Africa': '🌍',
    'Other': '🌐',
  };
  return emojis[region] || '🌐';
}
