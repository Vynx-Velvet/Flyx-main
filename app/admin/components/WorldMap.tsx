'use client';

import { useState, useMemo } from 'react';

interface GeographicData {
  country: string;
  countryName?: string;
  count: number;
}

interface Props {
  data: GeographicData[];
}

// Country coordinates for markers (approximate center points)
const COUNTRY_COORDS: Record<string, { x: number; y: number; name: string }> = {
  'US': { x: 130, y: 180, name: 'United States' },
  'CA': { x: 140, y: 120, name: 'Canada' },
  'MX': { x: 115, y: 220, name: 'Mexico' },
  'BR': { x: 280, y: 320, name: 'Brazil' },
  'AR': { x: 260, y: 400, name: 'Argentina' },
  'CL': { x: 240, y: 390, name: 'Chile' },
  'CO': { x: 230, y: 270, name: 'Colombia' },
  'PE': { x: 225, y: 310, name: 'Peru' },
  'GB': { x: 470, y: 145, name: 'United Kingdom' },
  'IE': { x: 455, y: 145, name: 'Ireland' },
  'DE': { x: 505, y: 155, name: 'Germany' },
  'FR': { x: 480, y: 170, name: 'France' },
  'IT': { x: 510, y: 185, name: 'Italy' },
  'ES': { x: 465, y: 195, name: 'Spain' },
  'PT': { x: 450, y: 195, name: 'Portugal' },
  'NL': { x: 490, y: 150, name: 'Netherlands' },
  'BE': { x: 485, y: 155, name: 'Belgium' },
  'SE': { x: 520, y: 115, name: 'Sweden' },
  'NO': { x: 510, y: 105, name: 'Norway' },
  'FI': { x: 545, y: 105, name: 'Finland' },
  'DK': { x: 505, y: 140, name: 'Denmark' },
  'PL': { x: 530, y: 155, name: 'Poland' },
  'AT': { x: 515, y: 170, name: 'Austria' },
  'CH': { x: 495, y: 170, name: 'Switzerland' },
  'GR': { x: 540, y: 200, name: 'Greece' },
  'RU': { x: 650, y: 130, name: 'Russia' },
  'UA': { x: 560, y: 165, name: 'Ukraine' },
  'TR': { x: 565, y: 195, name: 'Turkey' },
  'CN': { x: 730, y: 210, name: 'China' },
  'JP': { x: 820, y: 195, name: 'Japan' },
  'KR': { x: 795, y: 200, name: 'South Korea' },
  'IN': { x: 670, y: 250, name: 'India' },
  'PK': { x: 640, y: 225, name: 'Pakistan' },
  'BD': { x: 695, y: 245, name: 'Bangladesh' },
  'TH': { x: 725, y: 265, name: 'Thailand' },
  'VN': { x: 745, y: 260, name: 'Vietnam' },
  'MY': { x: 735, y: 295, name: 'Malaysia' },
  'SG': { x: 740, y: 305, name: 'Singapore' },
  'ID': { x: 770, y: 315, name: 'Indonesia' },
  'PH': { x: 785, y: 265, name: 'Philippines' },
  'AU': { x: 810, y: 385, name: 'Australia' },
  'NZ': { x: 880, y: 420, name: 'New Zealand' },
  'ZA': { x: 545, y: 395, name: 'South Africa' },
  'EG': { x: 555, y: 230, name: 'Egypt' },
  'NG': { x: 500, y: 280, name: 'Nigeria' },
  'KE': { x: 575, y: 305, name: 'Kenya' },
  'MA': { x: 455, y: 215, name: 'Morocco' },
  'SA': { x: 595, y: 250, name: 'Saudi Arabia' },
  'AE': { x: 620, y: 255, name: 'UAE' },
  'IL': { x: 565, y: 220, name: 'Israel' },
  'HK': { x: 765, y: 240, name: 'Hong Kong' },
  'TW': { x: 785, y: 235, name: 'Taiwan' },
};

export default function WorldMap({ data }: Props) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const maxCount = useMemo(() => Math.max(...data.map(d => d.count), 1), [data]);
  const totalViewers = useMemo(() => data.reduce((sum, d) => sum + d.count, 0), [data]);
  
  const countryDataMap = useMemo(() => {
    const map: Record<string, GeographicData> = {};
    data.forEach(d => { map[d.country] = d; });
    return map;
  }, [data]);

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
    return 6 + intensity * 14;
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
      <div style={{ position: 'relative', padding: '20px', background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.03) 0%, transparent 70%)' }}>
        <svg viewBox="0 0 950 500" style={{ width: '100%', height: 'auto', minHeight: '350px' }}>
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* World map outline - simplified but accurate continents */}
          <g fill="rgba(99, 102, 241, 0.08)" stroke="rgba(99, 102, 241, 0.2)" strokeWidth="0.5">
            {/* North America */}
            <path d="M50,90 Q80,70 130,80 L180,90 Q220,100 240,130 L250,160 Q240,180 220,190 L200,200 Q180,210 160,220 L140,230 Q120,240 100,235 L80,225 Q60,210 55,190 L50,160 Q45,130 50,90 Z" />
            {/* USA mainland */}
            <path d="M70,160 Q100,150 140,155 L180,165 Q200,175 210,190 L200,210 Q180,220 150,225 L120,220 Q90,210 75,195 L70,175 Z" />
            {/* Mexico & Central America */}
            <path d="M90,225 Q110,220 130,225 L145,240 Q150,260 140,280 L120,290 Q100,285 95,270 L90,250 Z" />
            
            {/* South America */}
            <path d="M200,280 Q230,270 270,280 L300,300 Q320,330 310,370 L290,410 Q270,440 250,450 L230,440 Q210,420 215,380 L220,340 Q210,310 200,280 Z" />
            
            {/* Europe */}
            <path d="M440,100 Q470,90 510,95 L550,105 Q580,115 590,140 L585,170 Q570,190 540,195 L500,190 Q470,185 455,170 L445,145 Q440,120 440,100 Z" />
            {/* UK & Ireland */}
            <path d="M455,130 Q465,125 475,130 L480,145 Q478,155 470,160 L460,158 Q455,150 455,140 Z" />
            {/* Scandinavia */}
            <path d="M500,80 Q520,70 540,75 L555,90 Q560,110 550,130 L535,140 Q520,135 510,120 L505,100 Z" />
            
            {/* Africa */}
            <path d="M460,210 Q500,200 540,210 L580,230 Q600,260 590,310 L570,360 Q550,400 520,410 L480,400 Q460,370 465,320 L470,270 Q460,240 460,210 Z" />
            
            {/* Middle East */}
            <path d="M550,200 Q580,195 610,205 L640,225 Q650,250 640,275 L610,285 Q580,280 560,260 L555,230 Z" />
            
            {/* Russia/Asia */}
            <path d="M560,90 Q620,70 700,75 L780,85 Q840,100 860,130 L850,160 Q820,180 760,175 L680,165 Q620,155 580,140 L565,115 Z" />
            
            {/* India */}
            <path d="M630,220 Q660,210 690,220 L710,250 Q715,290 695,320 L665,330 Q640,320 635,285 L630,250 Z" />
            
            {/* Southeast Asia */}
            <path d="M700,240 Q730,230 760,240 L780,270 Q785,300 770,330 L740,340 Q710,330 705,300 L700,270 Z" />
            
            {/* China */}
            <path d="M680,160 Q720,150 770,160 L810,180 Q830,210 815,250 L780,270 Q740,275 700,260 L680,230 Q670,195 680,160 Z" />
            
            {/* Japan */}
            <path d="M810,175 Q825,170 835,180 L840,200 Q838,220 825,225 L815,220 Q808,205 810,190 Z" />
            
            {/* Australia */}
            <path d="M750,340 Q800,330 850,345 L870,380 Q875,420 850,445 L800,455 Q760,445 755,410 L750,370 Z" />
            
            {/* New Zealand */}
            <path d="M870,400 Q885,395 895,410 L890,435 Q880,445 870,440 L868,420 Z" />
            
            {/* Indonesia */}
            <path d="M720,300 Q760,295 800,305 L820,320 Q825,340 810,350 L770,355 Q740,350 730,335 L720,315 Z" />
          </g>

          {/* Grid lines */}
          <g stroke="rgba(99, 102, 241, 0.05)" strokeWidth="0.5">
            {[100, 200, 300, 400].map(y => <line key={y} x1="30" y1={y} x2="920" y2={y} />)}
            {[100, 200, 300, 400, 500, 600, 700, 800, 900].map(x => <line key={x} x1={x} y1="50" x2={x} y2="470" />)}
          </g>

          {/* Country markers */}
          {data.map((item) => {
            const coords = COUNTRY_COORDS[item.country];
            if (!coords) return null;
            
            const size = getMarkerSize(item.count);
            const color = getHeatColor(item.count);
            const isHovered = hoveredCountry === item.country;
            
            return (
              <g key={item.country}>
                {/* Pulse ring */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={size + 8}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  opacity="0.3"
                  style={{ animation: 'pulse 2s infinite' }}
                />
                {/* Main marker */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={isHovered ? size + 4 : size}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={isHovered ? 3 : 2}
                  style={{ 
                    cursor: 'pointer',
                    filter: isHovered ? 'url(#glow)' : 'none',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={() => {
                    setHoveredCountry(item.country);
                    setTooltipPos({ x: coords.x, y: coords.y });
                  }}
                  onMouseLeave={() => setHoveredCountry(null)}
                />
                {/* Count label for large markers */}
                {size > 12 && (
                  <text
                    x={coords.x}
                    y={coords.y + 4}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="10"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {item.count > 999 ? `${(item.count / 1000).toFixed(1)}k` : item.count}
                  </text>
                )}
              </g>
            );
          })}

          {/* Tooltip */}
          {hoveredCountry && countryDataMap[hoveredCountry] && (
            <g>
              <rect
                x={tooltipPos.x - 75}
                y={tooltipPos.y - 60}
                width="150"
                height="50"
                rx="8"
                fill="rgba(15, 23, 42, 0.95)"
                stroke={getHeatColor(countryDataMap[hoveredCountry].count)}
                strokeWidth="2"
              />
              <text x={tooltipPos.x} y={tooltipPos.y - 40} textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="600">
                {countryDataMap[hoveredCountry].countryName || COUNTRY_COORDS[hoveredCountry]?.name || hoveredCountry}
              </text>
              <text x={tooltipPos.x} y={tooltipPos.y - 22} textAnchor="middle" fill={getHeatColor(countryDataMap[hoveredCountry].count)} fontSize="14" fontWeight="700">
                {countryDataMap[hoveredCountry].count.toLocaleString()} viewers
              </text>
            </g>
          )}
        </svg>

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
