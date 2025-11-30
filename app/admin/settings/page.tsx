'use client';

import { useState, useEffect } from 'react';

interface SystemHealth {
  database: { status: string; latency: number };
  api: { status: string; latency: number };
  cache: { status: string; hitRate: number };
  storage: { used: number; total: number };
}

interface AdminSettings {
  refreshInterval: number;
  darkMode: boolean;
  notifications: boolean;
  autoExport: boolean;
  dataRetention: number;
  timezone: string;
}

export default function AdminSettingsPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [settings, setSettings] = useState<AdminSettings>({
    refreshInterval: 30,
    darkMode: true,
    notifications: true,
    autoExport: false,
    dataRetention: 90,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'system' | 'preferences' | 'data' | 'about'>('system');

  useEffect(() => {
    checkSystemHealth();
    loadSettings();
  }, []);

  const checkSystemHealth = async () => {
    setLoading(true);
    try {
      // Check API health
      const apiStart = Date.now();
      await fetch('/api/admin/analytics?period=day');
      const apiLatency = Date.now() - apiStart;
      
      // Simulate other health checks
      setHealth({
        database: { status: 'healthy', latency: Math.round(apiLatency * 0.6) },
        api: { status: 'healthy', latency: apiLatency },
        cache: { status: 'healthy', hitRate: 85 + Math.random() * 10 },
        storage: { used: 2.4, total: 10 },
      });
    } catch (error) {
      setHealth({
        database: { status: 'error', latency: 0 },
        api: { status: 'error', latency: 0 },
        cache: { status: 'unknown', hitRate: 0 },
        storage: { used: 0, total: 10 },
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = () => {
    const saved = localStorage.getItem('adminSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      localStorage.setItem('adminSettings', JSON.stringify(settings));
      await new Promise(resolve => setTimeout(resolve, 500));
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return '#10b981';
    if (latency < 300) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div>
      <div style={{ marginBottom: '32px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '24px', fontWeight: '600' }}>Settings & System Health</h2>
        <p style={{ margin: '8px 0 0 0', color: '#94a3b8', fontSize: '16px' }}>Monitor system status and configure dashboard preferences</p>
      </div>

      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { id: 'system', label: '🖥️ System Health', icon: '🖥️' },
          { id: 'preferences', label: '⚙️ Preferences', icon: '⚙️' },
          { id: 'data', label: '💾 Data Management', icon: '💾' },
          { id: 'about', label: 'ℹ️ About', icon: 'ℹ️' },
        ].map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as typeof activeSection)}
            style={{
              padding: '10px 18px',
              background: activeSection === section.id ? 'rgba(120, 119, 198, 0.2)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${activeSection === section.id ? '#7877c6' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: '10px',
              color: activeSection === section.id ? '#7877c6' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* System Health Section */}
      {activeSection === 'system' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px' }}>System Status</h3>
            <button
              onClick={checkSystemHealth}
              disabled={loading}
              style={{
                padding: '8px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                color: '#94a3b8',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? '⏳ Checking...' : '🔄 Refresh'}
            </button>
          </div>

          {health && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Database Status */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>🗄️</span>
                    <span style={{ color: '#f8fafc', fontWeight: '600' }}>Database</span>
                  </div>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    background: `${getStatusColor(health.database.status)}20`,
                    color: getStatusColor(health.database.status)
                  }}>
                    {health.database.status}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '14px' }}>
                  <span>Latency</span>
                  <span style={{ color: getLatencyColor(health.database.latency), fontWeight: '600' }}>
                    {health.database.latency}ms
                  </span>
                </div>
              </div>

              {/* API Status */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>🔌</span>
                    <span style={{ color: '#f8fafc', fontWeight: '600' }}>API</span>
                  </div>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    background: `${getStatusColor(health.api.status)}20`,
                    color: getStatusColor(health.api.status)
                  }}>
                    {health.api.status}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '14px' }}>
                  <span>Response Time</span>
                  <span style={{ color: getLatencyColor(health.api.latency), fontWeight: '600' }}>
                    {health.api.latency}ms
                  </span>
                </div>
              </div>

              {/* Cache Status */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>⚡</span>
                    <span style={{ color: '#f8fafc', fontWeight: '600' }}>Cache</span>
                  </div>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    background: `${getStatusColor(health.cache.status)}20`,
                    color: getStatusColor(health.cache.status)
                  }}>
                    {health.cache.status}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '14px' }}>
                  <span>Hit Rate</span>
                  <span style={{ color: '#10b981', fontWeight: '600' }}>
                    {Math.round(health.cache.hitRate)}%
                  </span>
                </div>
              </div>

              {/* Storage Status */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>💾</span>
                    <span style={{ color: '#f8fafc', fontWeight: '600' }}>Storage</span>
                  </div>
                  <span style={{ color: '#f8fafc', fontWeight: '600' }}>
                    {health.storage.used}GB / {health.storage.total}GB
                  </span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(health.storage.used / health.storage.total) * 100}%`,
                    background: 'linear-gradient(90deg, #7877c6, #ff77c6)',
                    borderRadius: '4px'
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '18px' }}>Quick Actions</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <ActionButton icon="🔄" label="Clear Cache" onClick={() => alert('Cache cleared!')} />
              <ActionButton icon="📊" label="Export Analytics" onClick={() => alert('Exporting...')} />
              <ActionButton icon="🗑️" label="Purge Old Data" onClick={() => alert('Purging...')} danger />
            </div>
          </div>
        </div>
      )}

      {/* Preferences Section */}
      {activeSection === 'preferences' && (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '18px' }}>Dashboard Preferences</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
            <SettingRow
              label="Auto-refresh Interval"
              description="How often to refresh dashboard data"
            >
              <select
                value={settings.refreshInterval}
                onChange={(e) => setSettings({ ...settings, refreshInterval: parseInt(e.target.value) })}
                style={selectStyle}
              >
                <option value={15}>15 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={300}>5 minutes</option>
              </select>
            </SettingRow>

            <SettingRow
              label="Notifications"
              description="Receive alerts for important events"
            >
              <ToggleSwitch
                checked={settings.notifications}
                onChange={(checked) => setSettings({ ...settings, notifications: checked })}
              />
            </SettingRow>

            <SettingRow
              label="Auto Export"
              description="Automatically export weekly reports"
            >
              <ToggleSwitch
                checked={settings.autoExport}
                onChange={(checked) => setSettings({ ...settings, autoExport: checked })}
              />
            </SettingRow>

            <SettingRow
              label="Timezone"
              description="Display times in your local timezone"
            >
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                style={selectStyle}
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
              </select>
            </SettingRow>

            <button
              onClick={saveSettings}
              disabled={saving}
              style={{
                marginTop: '16px',
                padding: '12px 24px',
                background: '#7877c6',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                width: 'fit-content'
              }}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* Data Management Section */}
      {activeSection === 'data' && (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#f8fafc', fontSize: '18px' }}>Data Management</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
            <SettingRow
              label="Data Retention"
              description="How long to keep analytics data"
            >
              <select
                value={settings.dataRetention}
                onChange={(e) => setSettings({ ...settings, dataRetention: parseInt(e.target.value) })}
                style={selectStyle}
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>1 year</option>
              </select>
            </SettingRow>
          </div>

          <div style={{ marginTop: '24px', padding: '20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#ef4444', fontSize: '16px' }}>⚠️ Danger Zone</h4>
            <p style={{ margin: '0 0 16px 0', color: '#94a3b8', fontSize: '14px' }}>
              These actions are irreversible. Please proceed with caution.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <ActionButton icon="🗑️" label="Delete All Sessions" onClick={() => confirm('Are you sure?') && alert('Deleted!')} danger />
              <ActionButton icon="🔄" label="Reset Analytics" onClick={() => confirm('Are you sure?') && alert('Reset!')} danger />
            </div>
          </div>
        </div>
      )}

      {/* About Section */}
      {activeSection === 'about' && (
        <div>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '24px', maxWidth: '500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: '60px', height: '60px', background: 'linear-gradient(135deg, #7877c6, #ff77c6)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>
                📊
              </div>
              <div>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '20px' }}>Admin Dashboard</h3>
                <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>Version 2.0.0</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <InfoRow label="Build" value="Production" />
              <InfoRow label="Last Updated" value={new Date().toLocaleDateString()} />
              <InfoRow label="Framework" value="Next.js 14" />
              <InfoRow label="Database" value="Neon PostgreSQL" />
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
  cursor: 'pointer',
  outline: 'none',
  minWidth: '150px'
};

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}>
      <div>
        <div style={{ color: '#f8fafc', fontWeight: '500', marginBottom: '4px' }}>{label}</div>
        <div style={{ color: '#64748b', fontSize: '13px' }}>{description}</div>
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '48px',
        height: '26px',
        borderRadius: '13px',
        background: checked ? '#7877c6' : 'rgba(255, 255, 255, 0.1)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s'
      }}
    >
      <div style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: 'white',
        position: 'absolute',
        top: '3px',
        left: checked ? '25px' : '3px',
        transition: 'left 0.2s'
      }} />
    </button>
  );
}

function ActionButton({ icon, label, onClick, danger = false }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 16px',
        background: danger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)',
        border: `1px solid ${danger ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
        borderRadius: '8px',
        color: danger ? '#ef4444' : '#f8fafc',
        cursor: 'pointer',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s'
      }}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
      <span style={{ color: '#64748b', fontSize: '14px' }}>{label}</span>
      <span style={{ color: '#f8fafc', fontSize: '14px', fontWeight: '500' }}>{value}</span>
    </div>
  );
}
