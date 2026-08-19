'use client';

import { useState, useEffect } from 'react';
import SyncSettings from '@/components/settings/SyncSettings';
import ProviderSettings from '@/components/settings/ProviderSettings';
import NetworkSettings from '@/components/settings/NetworkSettings';
import SecuritySettings from '@/components/settings/SecuritySettings';
import EnvSettings from '@/components/settings/EnvSettings';
import UpdatesSettings from '@/components/settings/UpdatesSettings';
import DownloadsSettings from '@/components/settings/DownloadsSettings';
import {
  getPlayerPreferences,
  savePlayerPreferences,
  type PlayerPreferences,
} from '@/lib/utils/player-preferences';
import {
  getSubtitlePreferences,
  saveSubtitlePreferences,
  type SubtitlePreferences,
  type SubtitleStyle,
} from '@/lib/utils/subtitle-preferences';
import styles from './SettingsPage.module.css';

type SettingsTab =
  | 'sync'
  | 'providers'
  | 'playback'
  | 'subtitles'
  | 'network'
  | 'security'
  | 'environment'
  | 'updates'
  | 'downloads';

export default function SettingsPageClient() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('sync');

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'sync',
      label: 'Sync',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
        </svg>
      ),
    },
    {
      id: 'providers',
      label: 'Providers',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
    },
    {
      id: 'playback',
      label: 'Playback',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      ),
    },
    {
      id: 'subtitles',
      label: 'Subtitles',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="6" y1="12" x2="18" y2="12" />
          <line x1="6" y1="16" x2="14" y2="16" />
        </svg>
      ),
    },
    {
      id: 'network',
      label: 'Network',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      ),
    },
    {
      id: 'security',
      label: 'Security',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      ),
    },
    {
      id: 'environment',
      label: 'Environment',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 17V7l8 5 8-5v10" />
          <line x1="4" y1="7" x2="20" y2="7" />
        </svg>
      ),
    },
    {
      id: 'updates',
      label: 'Updates',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
    },
    {
      id: 'downloads',
      label: 'Downloads',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>
          Customize providers, playback, sync, and subtitles
        </p>
      </div>

      <div className={styles.settingsLayout}>
        {/* Tab navigation - Sidebar */}
        <nav className={styles.tabNav}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className={styles.content}>
          {activeTab === 'sync' && <SyncSettings />}
          {activeTab === 'providers' && <ProviderSettings />}
          {activeTab === 'playback' && <PlaybackSettings />}
          {activeTab === 'subtitles' && <SubtitleSettingsPanel />}
          {activeTab === 'network' && <NetworkSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'environment' && <EnvSettings />}
          {activeTab === 'updates' && <UpdatesSettings />}
          {activeTab === 'downloads' && <DownloadsSettings />}
        </div>
      </div>
    </div>
  );
}

// Playback settings component - wired to localStorage
function PlaybackSettings() {
  const [preferences, setPreferences] = useState<PlayerPreferences | null>(null);

  useEffect(() => {
    setPreferences(getPlayerPreferences());
  }, []);

  const updatePreference = <K extends keyof PlayerPreferences>(
    key: K,
    value: PlayerPreferences[K]
  ) => {
    if (!preferences) return;
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    savePlayerPreferences(updated);
  };

  if (!preferences) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.settingsCard}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIconWrapper} style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
        <div>
          <h2 className={styles.cardTitle}>Playback Settings</h2>
          <p className={styles.cardSubtitle}>Configure auto-play and episode navigation</p>
        </div>
      </div>

      <div className={styles.settingsList}>
        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Auto-play next episode</span>
            <span className={styles.settingDesc}>Automatically play the next episode when one ends</span>
          </div>
          <button
            className={`${styles.toggle} ${preferences.autoPlayNextEpisode ? styles.on : ''}`}
            onClick={() => updatePreference('autoPlayNextEpisode', !preferences.autoPlayNextEpisode)}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Show now playing</span>
            <span className={styles.settingDesc}>Expose the watched title to Windows media controls and VRChat companion apps</span>
          </div>
          <button
            className={`${styles.toggle} ${preferences.showNowPlaying ? styles.on : ''}`}
            onClick={() => updatePreference('showNowPlaying', !preferences.showNowPlaying)}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        {preferences.autoPlayNextEpisode && (
          <>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Countdown duration</span>
                <span className={styles.settingDesc}>Seconds before auto-playing next episode</span>
              </div>
              <select
                className={styles.select}
                value={preferences.autoPlayCountdown}
                onChange={(e) => updatePreference('autoPlayCountdown', Number(e.target.value))}
              >
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
                <option value={15}>15 seconds</option>
                <option value={20}>20 seconds</option>
                <option value={30}>30 seconds</option>
              </select>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Show &quot;Up Next&quot; before end</span>
                <span className={styles.settingDesc}>When to show the next episode button</span>
              </div>
              <select
                className={styles.select}
                value={preferences.showNextEpisodeBeforeEnd}
                onChange={(e) => updatePreference('showNextEpisodeBeforeEnd', Number(e.target.value))}
              >
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={90}>1.5 minutes</option>
                <option value={120}>2 minutes</option>
                <option value={180}>3 minutes</option>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Subtitle settings component - wired to localStorage
function SubtitleSettingsPanel() {
  const [preferences, setPreferences] = useState<SubtitlePreferences | null>(null);

  useEffect(() => {
    setPreferences(getSubtitlePreferences());
  }, []);

  const updatePreference = <K extends keyof SubtitlePreferences>(
    key: K,
    value: SubtitlePreferences[K]
  ) => {
    if (!preferences) return;
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    saveSubtitlePreferences(updated);
  };

  const updateStyle = <K extends keyof SubtitleStyle>(
    key: K,
    value: SubtitleStyle[K]
  ) => {
    if (!preferences) return;
    const updatedStyle = { ...preferences.style, [key]: value };
    const updated = { ...preferences, style: updatedStyle };
    setPreferences(updated);
    saveSubtitlePreferences(updated);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const languageMap: Record<string, string> = {
      eng: 'English',
      spa: 'Spanish',
      fra: 'French',
      deu: 'German',
      ita: 'Italian',
      por: 'Portuguese',
      'por-br': 'Portuguese (Brazil)',
      jpn: 'Japanese',
      kor: 'Korean',
      zho: 'Chinese (Simplified)',
      'zho-tw': 'Chinese (Traditional)',
      ara: 'Arabic',
      rus: 'Russian',
      hin: 'Hindi',
      tha: 'Thai',
      vie: 'Vietnamese',
      ind: 'Indonesian',
      msa: 'Malay',
      tur: 'Turkish',
      pol: 'Polish',
      nld: 'Dutch',
      swe: 'Swedish',
      nor: 'Norwegian',
      dan: 'Danish',
      fin: 'Finnish',
      ces: 'Czech',
      hun: 'Hungarian',
      ron: 'Romanian',
      ell: 'Greek',
      heb: 'Hebrew',
      ukr: 'Ukrainian',
      ben: 'Bengali',
      tam: 'Tamil',
      tel: 'Telugu',
      fil: 'Filipino',
    };
    if (!preferences) return;
    const updated = { ...preferences, languageCode: value, languageName: languageMap[value] || value };
    setPreferences(updated);
    saveSubtitlePreferences(updated);
  };

  if (!preferences) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.settingsCard}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIconWrapper} style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <line x1="6" y1="12" x2="18" y2="12" />
            <line x1="6" y1="16" x2="14" y2="16" />
          </svg>
        </div>
        <div>
          <h2 className={styles.cardTitle}>Subtitle Settings</h2>
          <p className={styles.cardSubtitle}>Customize subtitle appearance and language</p>
        </div>
      </div>

      <div className={styles.settingsList}>
        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Enable subtitles by default</span>
            <span className={styles.settingDesc}>Automatically show subtitles when available</span>
          </div>
          <button
            className={`${styles.toggle} ${preferences.enabled ? styles.on : ''}`}
            onClick={() => updatePreference('enabled', !preferences.enabled)}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Default language</span>
            <span className={styles.settingDesc}>Preferred subtitle language</span>
          </div>
          <select
            className={styles.select}
            value={preferences.languageCode}
            onChange={handleLanguageChange}
          >
            <optgroup label="Popular">
              <option value="eng">English</option>
              <option value="spa">Spanish</option>
              <option value="fra">French</option>
              <option value="deu">German</option>
              <option value="por">Portuguese</option>
              <option value="por-br">Portuguese (Brazil)</option>
              <option value="jpn">Japanese</option>
              <option value="kor">Korean</option>
              <option value="zho">Chinese (Simplified)</option>
              <option value="zho-tw">Chinese (Traditional)</option>
            </optgroup>
            <optgroup label="Asian">
              <option value="hin">Hindi</option>
              <option value="tha">Thai</option>
              <option value="vie">Vietnamese</option>
              <option value="ind">Indonesian</option>
              <option value="msa">Malay</option>
              <option value="ben">Bengali</option>
              <option value="tam">Tamil</option>
              <option value="tel">Telugu</option>
              <option value="fil">Filipino</option>
            </optgroup>
            <optgroup label="European">
              <option value="ita">Italian</option>
              <option value="rus">Russian</option>
              <option value="tur">Turkish</option>
              <option value="pol">Polish</option>
              <option value="nld">Dutch</option>
              <option value="swe">Swedish</option>
              <option value="nor">Norwegian</option>
              <option value="dan">Danish</option>
              <option value="fin">Finnish</option>
              <option value="ces">Czech</option>
              <option value="hun">Hungarian</option>
              <option value="ron">Romanian</option>
              <option value="ell">Greek</option>
              <option value="ukr">Ukrainian</option>
            </optgroup>
            <optgroup label="Middle Eastern">
              <option value="ara">Arabic</option>
              <option value="heb">Hebrew</option>
            </optgroup>
          </select>
        </div>

        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Font size</span>
            <span className={styles.settingDesc}>{preferences.style.fontSize}%</span>
          </div>
          <input
            type="range"
            className={styles.slider}
            min={50}
            max={200}
            value={preferences.style.fontSize}
            onChange={(e) => updateStyle('fontSize', Number(e.target.value))}
          />
        </div>

        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Background opacity</span>
            <span className={styles.settingDesc}>{preferences.style.backgroundOpacity}%</span>
          </div>
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={100}
            value={preferences.style.backgroundOpacity}
            onChange={(e) => updateStyle('backgroundOpacity', Number(e.target.value))}
          />
        </div>

        <div className={styles.settingItem}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Vertical position</span>
            <span className={styles.settingDesc}>{preferences.style.verticalPosition}% from top</span>
          </div>
          <input
            type="range"
            className={styles.slider}
            min={10}
            max={95}
            value={preferences.style.verticalPosition}
            onChange={(e) => updateStyle('verticalPosition', Number(e.target.value))}
          />
        </div>

        {/* Visual Preview Box */}
        <div className={styles.subtitlePreviewBox}>
          <div className={styles.previewLabel}>Preview</div>
          <div className={styles.previewScreen}>
            {/* Fake video content */}
            <div className={styles.previewContent}>
              <div className={styles.previewPlayIcon}>▶</div>
            </div>
            {/* Subtitle positioned based on verticalPosition */}
            <div
              className={styles.previewSubtitle}
              style={{
                top: `${preferences.style.verticalPosition}%`,
                fontSize: `${Math.max(10, preferences.style.fontSize * 0.12)}px`,
                backgroundColor: `rgba(0, 0, 0, ${preferences.style.backgroundOpacity / 100})`,
                color: preferences.style.textColor,
              }}
            >
              Sample subtitle text
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
