'use client';

import { useState, useMemo, memo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup
} from 'react-simple-maps';

interface GeographicData {
  country: string;
  countryName?: string;
  count: number;
}

interface Props {
  data: GeographicData[];
}

// World map TopoJSON from Natural Earth
const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Country coordinates (capital cities / center points)
const COUNTRY_COORDS: Record<string, { coordinates: [number, number]; name: string }> = {
  'US': { coordinates: [-95.7, 37.1], name: 'United States' },
  'CA': { coordinates: [-106.3, 56.1], name: 'Canada' },
  'MX': { coordinates: [-102.5, 23.6], name: 'Mexico' },
  'BR': { coordinates: [-51.9, -14.2], name: 'Brazil' },
  'AR': { coordinates: [-63.6, -38.4], name: 'Argentina' },
  'CL': { coordinates: [-71.5, -35.7], name: 'Chile' },
  'CO': { coordinates: [-74.3, 4.6], name: 'Colombia' },
  'PE': { coordinates: [-75.0, -9.2], name: 'Peru' },
  'GB': { coordinates: [-3.4, 55.4], name: 'United Kingdom' },
  'IE': { coordinates: [-8.2, 53.4], name: 'Ireland' },
  'DE': { coordinates: [10.5, 51.2], name: 'Germany' },
  'FR': { coordinates: [2.2, 46.2], name: 'France' },
  'IT': { coordinates: [12.6, 41.9], name: 'Italy' },
  'ES': { coordinates: [-3.7, 40.5], name: 'Spain' },
  'PT': { coordinates: [-8.2, 39.4], name: 'Portugal' },
  'NL': { coordinates: [5.3, 52.1], name: 'Netherlands' },
  'BE': { coordinates: [4.5, 50.5], name: 'Belgium' },
  'SE': { coordinates: [18.6, 60.1], name: 'Sweden' },
  'NO': { coordinates: [8.5, 60.5], name: 'Norway' },
  'FI': { coordinates: [26.0, 64.0], name: 'Finland' },
  'DK': { coordinates: [9.5, 56.3], name: 'Denmark' },
  'PL': { coordinates: [19.1, 51.9], name: 'Poland' },
  'AT': { coordinates: [14.6, 47.5], name: 'Austria' },
  'CH': { coordinates: [8.2, 46.8], name: 'Switzerland' },
  'GR': { coordinates: [21.8, 39.1], name: 'Greece' },
  'RU': { coordinates: [105.3, 61.5], name: 'Russia' },
  'UA': { coordinates: [31.2, 48.4], name: 'Ukraine' },
  'TR': { coordinates: [35.2, 39.0], name: 'Turkey' },
  'CN': { coordinates: [104.2, 35.9], name: 'China' },
  'JP': { coordinates: [138.3, 36.2], name: 'Japan' },
  'KR': { coordinates: [128.0, 35.9], name: 'South Korea' },
  'IN': { coordinates: [78.9, 20.6], name: 'India' },
  'PK': { coordinates: [69.3, 30.4], name: 'Pakistan' },
  'BD': { coordinates: [90.4, 23.7], name: 'Bangladesh' },
  'TH': { coordinates: [100.5, 15.9], name: 'Thailand' },
  'VN': { coordinates: [108.3, 14.1], name: 'Vietnam' },
  'MY': { coordinates: [101.9, 4.2], name: 'Malaysia' },
  'SG': { coordinates: [103.8, 1.4], name: 'Singapore' },
  'ID': { coordinates: [113.9, -0.8], name: 'Indonesia' },
  'PH': { coordinates: [121.8, 12.9], name: 'Philippines' },
  'AU': { coordinates: [133.8, -25.3], name: 'Australia' },
  'NZ': { coordinates: [174.9, -40.9], name: 'New Zealand' },
  'ZA': { coordinates: [22.9, -30.6], name: 'South Africa' },
  'EG': { coordinates: [30.8, 26.8], name: 'Egypt' },
  'NG': { coordinates: [8.7, 9.1], name: 'Nigeria' },
  'KE': { coordinates: [38.0, -0.0], name: 'Kenya' },
  'MA': { coordinates: [-7.1, 31.8], name: 'Morocco' },
  'SA': { coordinates: [45.1, 23.9], name: 'Saudi Arabia' },
  'AE': { coordinates: [53.8, 23.4], name: 'UAE' },
  'IL': { coordinates: [34.9, 31.0], name: 'Israel' },
  'HK': { coordinates: [114.2, 22.3], name: 'Hong Kong' },
  'TW': { coordinates: [121.0, 23.7], name: 'Taiwan' },
  'CZ': { coordinates: [15.5, 49.8], name: 'Czech Republic' },
  'RO': { coordinates: [25.0, 46.0], name: 'Romania' },
  'HU': { coordinates: [19.5, 47.2], name: 'Hungary' },
  'SK': { coordinates: [19.7, 48.7], name: 'Slovakia' },
  'BG': { coordinates: [25.5, 42.7], name: 'Bulgaria' },
  'HR': { coordinates: [15.2, 45.1], name: 'Croatia' },
  'RS': { coordinates: [21.0, 44.0], name: 'Serbia' },
  'SI': { coordinates: [15.0, 46.2], name: 'Slovenia' },
};

function WorldMap({ data }: Props) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const maxCount = useMemo(() => Math.max(...data.map(d => d.count), 1), [data]);
  const totalViewers = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);
  


  const getHeatColor = (count: number) => {
    const intensity = count / maxCount;
    if (intensity > 0.8) return '#ef4444';
    if (intensity > 0.6) return '#f97316';
    if (intensity > 0.4) return '#eab308';
    if (intensity > 0.2) return '#22c55e';
    return '#3b82f6';
  };

  const getMarkerSize = (count: number) => {
    const intensity = count / maxCount;
    return 4 + intensity * 16;
  };

  if (!data || data.length === 0) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(10, 10, 25, 0.98), rgba(15, 15, 35, 0.95))',
        padding: '60px',
        borderRadius: '20px',
        border: '1px solid rgba(99, 102, 241, 0.2)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🌍</div>
        <h3 style={{ color: '#f8fafc', marginBottom: '12px' }}>No Geographic Data Yet</h3>
        <p style={{ color: '#94a3b8', margin: 0 }}>Viewer locations will appear as users watch content</p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(5, 5, 20, 0.99), rgba(10, 15, 30, 0.98))',
      borderRadius: '24px',
      border: '1px solid rgba(99, 102, 241, 0.15)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🌐</span>
          <div>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px', fontWeight: '600' }}>Global Viewer Distribution</h3>
            <p style={{ margin: '2px 0 0 0', color: '#64748b', fontSize: '12px' }}>{data.length} countries • {totalViewers.toLocaleString()} total viewers</p>
          </div>
        </div>
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          padding: '6px 14px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
          <span style={{ color: '#22c55e', fontSize: '13px', fontWeight: '500' }}>Live</span>
        </div>
      </div>

      {/* Map */}
      <div style={{ position: 'relative', background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.03) 0%, transparent 70%)' }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 130,
            center: [0, 30]
          }}
          style={{ width: '100%', height: 'auto', minHeight: '400px' }}
        >
          <ZoomableGroup>
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="rgba(99, 102, 241, 0.15)"
                    stroke="rgba(99, 102, 241, 0.3)"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: 'none' },
                      hover: { fill: 'rgba(99, 102, 241, 0.25)', outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* Country markers */}
            {data.map((item) => {
              const coords = COUNTRY_COORDS[item.country];
              if (!coords) return null;
              
              const size = getMarkerSize(item.count);
              const color = getHeatColor(item.count);
              const isHovered = hoveredCountry === item.country;
              
              return (
                <Marker key={item.country} coordinates={coords.coordinates}>
                  {/* Pulse ring */}
                  <circle
                    r={size + 6}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    opacity={0.3}
                    style={{ animation: 'pulse 2s infinite' }}
                  />
                  {/* Main marker */}
                  <circle
                    r={isHovered ? size + 3 : size}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={() => setHoveredCountry(item.country)}
                    onMouseLeave={() => setHoveredCountry(null)}
                  />
                  {/* Count label for large markers */}
                  {size > 10 && (
                    <text
                      textAnchor="middle"
                      y={4}
                      style={{
                        fill: '#fff',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        pointerEvents: 'none',
                      }}
                    >
                      {item.count > 999 ? `${(item.count / 1000).toFixed(1)}k` : item.count}
                    </text>
                  )}
                  {/* Tooltip */}
                  {isHovered && (
                    <g>
                      <rect
                        x={-60}
                        y={-50}
                        width={120}
                        height={40}
                        rx={6}
                        fill="rgba(15, 23, 42, 0.95)"
                        stroke={color}
                        strokeWidth={1.5}
                      />
                      <text x={0} y={-32} textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="600">
                        {item.countryName || coords.name}
                      </text>
                      <text x={0} y={-18} textAnchor="middle" fill={color} fontSize="12" fontWeight="700">
                        {item.count.toLocaleString()} viewers
                      </text>
                    </g>
                  )}
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        <style jsx>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.1); } }`}</style>
      </div>

      {/* Legend */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Intensity:</span>
          {[
            { color: '#3b82f6', label: 'Low' },
            { color: '#22c55e', label: 'Med' },
            { color: '#eab308', label: 'High' },
            { color: '#f97316', label: 'V.High' },
            { color: '#ef4444', label: 'Peak' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.color }} />
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Countries List */}
      <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <h4 style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Top Countries</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
          {data.slice(0, 12).map((item, index) => {
            const percentage = totalViewers > 0 ? (item.count / totalViewers) * 100 : 0;
            const coords = COUNTRY_COORDS[item.country];
            
            return (
              <div
                key={item.country}
                style={{
                  padding: '12px 14px',
                  background: hoveredCountry === item.country ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '10px',
                  border: `1px solid ${hoveredCountry === item.country ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.04)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onMouseEnter={() => setHoveredCountry(item.country)}
                onMouseLeave={() => setHoveredCountry(null)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', width: '20px' }}>#{index + 1}</span>
                  <span style={{ fontSize: '18px' }}>{getCountryFlag(item.country)}</span>
                  <span style={{ color: '#f8fafc', fontSize: '13px', fontWeight: '500' }}>
                    {item.countryName || coords?.name || item.country}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: getHeatColor(item.count), fontWeight: '700', fontSize: '14px' }}>{item.count.toLocaleString()}</div>
                  <div style={{ color: '#64748b', fontSize: '10px' }}>{percentage.toFixed(1)}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getCountryFlag(code: string): string {
  if (!code || code === 'Unknown' || code.length !== 2) return '🌍';
  try {
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)));
  } catch { return '🌍'; }
}

export default memo(WorldMap);
