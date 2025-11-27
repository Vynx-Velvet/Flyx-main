import { ImageResponse } from 'next/og';

export const alt = 'Flyx Live TV - Watch Live Sports, News & Entertainment';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Main content */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          {/* Live indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '30px',
              padding: '12px 24px',
              background: 'rgba(239, 68, 68, 0.2)',
              borderRadius: '50px',
              border: '2px solid rgba(239, 68, 68, 0.5)',
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: '#ef4444',
              }}
            />
            <span style={{ color: '#ef4444', fontSize: '24px', fontWeight: 'bold' }}>
              LIVE
            </span>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: '80px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #06b6d4)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            LIVE TV
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: '28px',
              color: '#a1a1aa',
              marginTop: '16px',
            }}
          >
            850+ Channels • Sports • News • Entertainment
          </div>

          {/* Features row */}
          <div style={{ display: 'flex', gap: '30px', marginTop: '40px' }}>
            <div style={{ display: 'flex', padding: '10px 20px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
              <span style={{ color: '#e4e4e7', fontSize: '20px' }}>⚽ Sports</span>
            </div>
            <div style={{ display: 'flex', padding: '10px 20px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
              <span style={{ color: '#e4e4e7', fontSize: '20px' }}>📰 News</span>
            </div>
            <div style={{ display: 'flex', padding: '10px 20px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
              <span style={{ color: '#e4e4e7', fontSize: '20px' }}>🎬 Movies</span>
            </div>
            <div style={{ display: 'flex', padding: '10px 20px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
              <span style={{ color: '#e4e4e7', fontSize: '20px' }}>🎮 Gaming</span>
            </div>
          </div>
        </div>

        {/* Flyx branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            right: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ color: '#71717a', fontSize: '20px' }}>Powered by</span>
          <span
            style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#8b5cf6',
            }}
          >
            FLYX
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
