'use client';

import { useState, useEffect } from 'react';
import { useAnalytics } from '../components/analytics/AnalyticsProvider';
import OverviewStats from './components/OverviewStats';
import AnalyticsCharts from './components/AnalyticsCharts';
import ContentStats from './components/ContentStats';
import SystemStatus from './components/SystemStatus';

interface User {
  id: string;
  username: string;
}

export default function AdminPage() {
  const { trackPageView, trackEvent } = useAnalytics();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  // Track page view when component mounts and user is authenticated
  useEffect(() => {
    if (user) {
      trackPageView('/admin');
      trackEvent('admin_access', { 
        username: user.username,
        timestamp: Date.now()
      });
    }
  }, [user, trackPageView, trackEvent]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setUsername('');
        setPassword('');
        
        // Track successful login
        trackEvent('admin_login', { 
          username: data.user.username,
          timestamp: Date.now()
        });
      } else {
        setError(data.error || 'Login failed');
        
        // Track failed login attempt
        trackEvent('admin_login_failed', { 
          username: username,
          error: data.error,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Track logout before clearing user
      if (user) {
        trackEvent('admin_logout', { 
          username: user.username,
          timestamp: Date.now()
        });
      }
      
      await fetch('/api/admin/auth', { method: 'DELETE' });
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated background particles */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.1) 0%, transparent 50%)
          `
        }}></div>
        
        <div style={{ 
          color: '#e2e8f0', 
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          zIndex: 1,
          background: 'rgba(15, 15, 35, 0.8)',
          padding: '24px 32px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '3px solid rgba(120, 119, 198, 0.3)',
            borderTop: '3px solid #7877c6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ fontWeight: '500', letterSpacing: '0.5px' }}>
            Loading Admin Panel...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated background elements */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.4) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.2) 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.15) 0%, transparent 50%)
          `
        }}></div>
        
        {/* Floating particles */}
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: '4px',
          height: '4px',
          background: '#7877c6',
          borderRadius: '50%',
          animation: 'float 6s ease-in-out infinite',
          opacity: 0.6
        }}></div>
        <div style={{
          position: 'absolute',
          top: '20%',
          right: '15%',
          width: '6px',
          height: '6px',
          background: '#ff77c6',
          borderRadius: '50%',
          animation: 'float 8s ease-in-out infinite reverse',
          opacity: 0.4
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '15%',
          left: '20%',
          width: '3px',
          height: '3px',
          background: '#78dbff',
          borderRadius: '50%',
          animation: 'float 7s ease-in-out infinite',
          opacity: 0.5
        }}></div>

        <div style={{
          background: 'rgba(15, 15, 35, 0.95)',
          padding: '48px',
          borderRadius: '24px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          width: '100%',
          maxWidth: '420px',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ 
              width: '64px',
              height: '64px',
              marginBottom: '20px',
              margin: '0 auto 20px auto',
              background: 'linear-gradient(135deg, #7877c6 0%, #ff77c6 50%, #78dbff 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(120, 119, 198, 0.4)',
              position: 'relative'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 style={{ 
              margin: '0 0 12px 0', 
              color: '#f8fafc', 
              fontSize: '32px',
              fontWeight: '700',
              letterSpacing: '-0.5px'
            }}>
              FlyX Admin
            </h1>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '16px', fontWeight: '400' }}>
              Analytics Dashboard
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '10px', 
                color: '#e2e8f0', 
                fontWeight: '500',
                fontSize: '14px',
                letterSpacing: '0.5px'
              }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loginLoading}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#f8fafc',
                  backdropFilter: 'blur(10px)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#7877c6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(120, 119, 198, 0.1)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '10px', 
                color: '#e2e8f0', 
                fontWeight: '500',
                fontSize: '14px',
                letterSpacing: '0.5px'
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loginLoading}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  transition: 'all 0.3s ease',
                  outline: 'none',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#f8fafc',
                  backdropFilter: 'blur(10px)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#7877c6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(120, 119, 198, 0.1)';
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#fca5a5',
                padding: '14px 18px',
                borderRadius: '12px',
                marginBottom: '24px',
                textAlign: 'center',
                fontSize: '14px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                backdropFilter: 'blur(10px)'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                width: '100%',
                padding: '16px',
                background: loginLoading 
                  ? 'rgba(100, 100, 100, 0.3)' 
                  : 'linear-gradient(135deg, #7877c6 0%, #ff77c6 50%, #78dbff 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loginLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                if (!loginLoading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 25px rgba(120, 119, 198, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {loginLoading && (
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
              )}
              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{
            marginTop: '32px',
            padding: '20px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '12px',
            textAlign: 'center',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.5px' }}>
              Default Credentials
            </div>
            <div style={{ fontSize: '14px', color: '#e2e8f0', fontFamily: 'monospace', fontWeight: '500' }}>
              admin / admin123
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background effects */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.08) 0%, transparent 50%)
        `,
        zIndex: 0
      }}></div>

      {/* Header */}
      <header style={{
        background: 'rgba(15, 15, 35, 0.95)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '20px 24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #7877c6 0%, #ff77c6 50%, #78dbff 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(120, 119, 198, 0.3)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 style={{ 
              margin: 0, 
              color: '#f8fafc', 
              fontSize: '26px', 
              fontWeight: '700',
              letterSpacing: '-0.5px'
            }}>
              FlyX Admin Dashboard
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>
                Welcome, <strong style={{ color: '#e2e8f0' }}>{user.username}</strong>
              </span>
            </div>
            <button
              onClick={handleLogout}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav style={{
        background: 'rgba(15, 15, 35, 0.8)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '0 24px',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '40px' }}>
          {[
            { 
              key: 'overview', 
              label: 'Overview', 
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                  <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                  <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                  <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                </svg>
              )
            },
            { 
              key: 'analytics', 
              label: 'Analytics', 
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 9L12 6L16 10L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )
            },
            { 
              key: 'content', 
              label: 'Content', 
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                  <path d="M8 21L16 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12 17L12 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )
            }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                // Track tab navigation
                trackEvent('admin_tab_change', {
                  from_tab: activeTab,
                  to_tab: tab.key,
                  timestamp: Date.now()
                });
              }}
              style={{
                padding: '18px 0',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key 
                  ? '3px solid #7877c6' 
                  : '3px solid transparent',
                color: activeTab === tab.key ? '#7877c6' : '#94a3b8',
                fontWeight: activeTab === tab.key ? '600' : '500',
                cursor: 'pointer',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'all 0.3s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.color = '#e2e8f0';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.color = '#94a3b8';
                }
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {activeTab === tab.key && (
                <div style={{
                  position: 'absolute',
                  bottom: '-3px',
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #7877c6, #ff77c6)',
                  borderRadius: '2px 2px 0 0',
                  boxShadow: '0 0 10px rgba(120, 119, 198, 0.5)'
                }}></div>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ 
        padding: '32px 24px', 
        maxWidth: '1400px', 
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          background: 'rgba(15, 15, 35, 0.6)',
          borderRadius: '20px',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}>
          {activeTab === 'overview' && (
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
                  Dashboard Overview
                </h2>
                <p style={{
                  margin: '8px 0 0 0',
                  color: '#94a3b8',
                  fontSize: '16px'
                }}>
                  Monitor your platform's performance and analytics
                </p>
              </div>
              <OverviewStats />
              <SystemStatus />
            </div>
          )}

          {activeTab === 'analytics' && (
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
                  Analytics & Insights
                </h2>
                <p style={{
                  margin: '8px 0 0 0',
                  color: '#94a3b8',
                  fontSize: '16px'
                }}>
                  Detailed analytics and user behavior insights
                </p>
              </div>
              <AnalyticsCharts />
            </div>
          )}

          {activeTab === 'content' && (
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
                  Content Management
                </h2>
                <p style={{
                  margin: '8px 0 0 0',
                  color: '#94a3b8',
                  fontSize: '16px'
                }}>
                  Manage and monitor your content library
                </p>
              </div>
              <ContentStats />
            </div>
          )}
        </div>
      </main>

      {/* Add CSS animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 5px rgba(120, 119, 198, 0.5); }
          50% { box-shadow: 0 0 20px rgba(120, 119, 198, 0.8); }
        }
      `}</style>
    </div>
  );
}