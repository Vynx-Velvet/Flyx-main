'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import GeographicHeatmap from '../components/GeographicHeatmap';

interface GeoStat {
  country: string;
  count: number;
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
  const [geographic, setGeographic] = useState<GeoStat[]>([]);
  const [metrics, setMetrics] = useState<GeoMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'regions'>('list');

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
        const geoData = data.data.geographic || [];
        setGeographic(geoData);
        
        // Calculate metrics
        if (geoData.length > 0) {
          const total = geoData.reduce((sum: number, g: GeoStat) => sum + g.count, 0);
          const topCountry = geoData[0];
          
          // Group by region (simplified)
          const regionMap: Record<string, number> = {};
          geoData.forEach((g: GeoStat) => {
            const region = getRegion(g.country);
            regionMap[region] = (regionMap[region] || 0) + g.count;
          });
          
          const regionBreakdown = Object.entries(regionMap)
            .map(([region, count]) => ({ region, count }))
            .sort((a, b) => b.count - a.count);
          
          setMetrics({
            totalCountries: geoData.filter((g: GeoStat) => g.country !== 'Unknown').length,
            topCountry: topCountry?.country || 'N/A',
            topCountryPercentage: total > 0 ? Math.round((topCountry?.count / total) * 100) : 0,
            internationalPercentage: total > 0 ? Math.round(((total - (geoData[0]?.count || 0)) / total) * 100) : 0,
            regionBreakdown,
          });
        }
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
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <h2 style={{
          margin: 0,
          color: '#f8fafc',
          fontSize: '24px',
          fontWeight: '600',
          letterSpacing: '-0.5px'
        }}>
          Geographic Analytics
        </h2>
        <p style={{
          margin: '8px 0 0 0',
          color: '#94a3b8',
          fontSize: '16px'
        }}>
          Analyze viewer distribution across regions and countries
        </p>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>🌍 Countries Reached</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#f8fafc' }}>{metrics.totalCountries}</div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>🏆 Top Country</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#f8fafc' }}>{getCountryName(metrics.topCountry)}</div>
            <div style={{ color: '#7877c6', fontSize: '14px' }}>{metrics.topCountryPercentage}% of viewers</div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>🌐 International</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#f8fafc' }}>{metrics.internationalPercentage}%</div>
            <div style={{ color: '#64748b', fontSize: '14px' }}>Outside top country</div>
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>📊 Regions</div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#f8fafc' }}>{metrics.regionBreakdown.length}</div>
            <div style={{ color: '#64748b', fontSize: '14px' }}>Active regions</div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px'
      }}>
        <button
          onClick={() => setViewMode('list')}
          style={{
            padding: '8px 16px',
            background: viewMode === 'list' ? 'rgba(120, 119, 198, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${viewMode === 'list' ? '#7877c6' : 'rgba(255, 255, 255, 0.1)'}`,
            borderRadius: '8px',
            color: viewMode === 'list' ? '#7877c6' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          📋 Country List
        </button>
        <button
          onClick={() => setViewMode('regions')}
          style={{
            padding: '8px 16px',
            background: viewMode === 'regions' ? 'rgba(120, 119, 198, 0.2)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${viewMode === 'regions' ? '#7877c6' : 'rgba(255, 255, 255, 0.1)'}`,
            borderRadius: '8px',
            color: viewMode === 'regions' ? '#7877c6' : '#94a3b8',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          🗺️ By Region
        </button>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'list' ? (
        <GeographicHeatmap data={geographic} />
      ) : (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '18px' }}>Regional Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {metrics?.regionBreakdown.map((region) => {
              const total = metrics.regionBreakdown.reduce((sum, r) => sum + r.count, 0);
              const percentage = total > 0 ? (region.count / total) * 100 : 0;
              return (
                <div key={region.region} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <div style={{ width: '140px', color: '#f8fafc', fontWeight: '500' }}>{region.region}</div>
                  <div style={{ flex: 1, height: '24px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${percentage}%`,
                      background: 'linear-gradient(90deg, #7877c6, #ff77c6)',
                      borderRadius: '12px',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  <div style={{ width: '80px', textAlign: 'right', color: '#f8fafc', fontWeight: '600' }}>
                    {region.count}
                  </div>
                  <div style={{ width: '50px', textAlign: 'right', color: '#64748b', fontSize: '14px' }}>
                    {Math.round(percentage)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
