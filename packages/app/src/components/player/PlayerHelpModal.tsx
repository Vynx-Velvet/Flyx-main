'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './PlayerHelpModal.module.css';

export const PLAYER_HELP_NEVER_KEY = 'flyx:player:help-never';
/** Session-only: already auto-shown this tab session */
export const PLAYER_HELP_SESSION_KEY = 'flyx:player:help-session';
/** Legacy key — no longer blocks auto-show (kept for cleanup) */
export const PLAYER_HELP_SEEN_KEY = 'flyx:player:help-seen';

export type HelpPlatform = 'desktop' | 'mobile' | 'apple';

export function detectHelpPlatform(): HelpPlatform {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const coarse =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth < 768;
  if (isIOS) return 'apple';
  if (isAndroid || (coarse && narrow)) return 'mobile';
  return 'desktop';
}

/**
 * Auto-open help once per browser session unless user chose "never show again".
 * Closing the modal alone does NOT permanently suppress it.
 */
export function shouldAutoShowPlayerHelp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem(PLAYER_HELP_NEVER_KEY) === '1') return false;
    if (sessionStorage.getItem(PLAYER_HELP_SESSION_KEY) === '1') return false;
    return true;
  } catch {
    return true;
  }
}

/** Mark as auto-shown for this tab session (not permanent). */
export function markPlayerHelpSessionShown(): void {
  try {
    sessionStorage.setItem(PLAYER_HELP_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** @deprecated Prefer markPlayerHelpSessionShown — kept so old imports still typecheck */
export function markPlayerHelpSeen(): void {
  markPlayerHelpSessionShown();
}

export function setPlayerHelpNeverShow(never: boolean): void {
  try {
    if (never) {
      localStorage.setItem(PLAYER_HELP_NEVER_KEY, '1');
      // Clear legacy permanent "seen" so re-enabling is clean
      localStorage.removeItem(PLAYER_HELP_SEEN_KEY);
    } else {
      localStorage.removeItem(PLAYER_HELP_NEVER_KEY);
    }
  } catch {
    /* ignore */
  }
}

type Shortcut = { action: string; keys: string[] };

function desktopShortcuts(isApple: boolean): { sections: Array<{ label: string; items: Shortcut[] }>; tip: string } {
  const mod = isApple ? '⌘' : 'Ctrl';
  return {
    sections: [
      {
        label: 'Playback',
        items: [
          { action: 'Play / pause', keys: ['Space', 'K'] },
          { action: 'Seek back / forward 10s', keys: ['←', '→'] },
          { action: 'Seek 30 seconds', keys: ['Shift', '← / →'] },
          { action: 'Double‑click sides to skip 10s', keys: ['Click L / R'] },
          { action: 'Jump to 0%–90%', keys: ['0', '…', '9'] },
          { action: 'Next episode', keys: ['N'] },
        ],
      },
      {
        label: 'Audio & display',
        items: [
          { action: 'Volume up / down', keys: ['↑', '↓'] },
          { action: 'Mute', keys: ['M'] },
          { action: 'Fullscreen', keys: ['F'] },
          { action: 'Playback speed', keys: [',', '.', '1× menu'] },
        ],
      },
      {
        label: 'Casting',
        items: [
          { action: 'Cast to TV (player button)', keys: ['Cast icon'] },
          {
            action: isApple ? 'AirPlay (Safari / Mac)' : 'Browser cast menu',
            keys: isApple ? ['AirPlay'] : [`${mod}`, 'menu → Cast'],
          },
        ],
      },
    ],
    tip: 'Tip: double‑click left/right sides of the video to skip 10s (center double‑click = fullscreen). Open this guide anytime via Controls.',
  };
}

function mobileShortcuts(isApple: boolean): { sections: Array<{ label: string; items: Shortcut[] }>; tip: string } {
  return {
    sections: [
      {
        label: 'Touch controls',
        items: [
          { action: 'Show / hide controls', keys: ['Tap video'] },
          { action: 'Play / pause', keys: ['Center button'] },
          { action: 'Skip ±10 seconds', keys: ['−10s / +10s'] },
          { action: 'Scrub timeline', keys: ['Drag bar'] },
        ],
      },
      {
        label: 'More',
        items: [
          { action: 'Sources & servers', keys: ['Servers'] },
          { action: 'Speed', keys: ['Settings'] },
          { action: 'Fullscreen', keys: ['Expand'] },
          {
            action: isApple ? 'AirPlay to Apple TV' : 'Cast to Chromecast / TV',
            keys: ['Cast icon'],
          },
        ],
      },
    ],
    tip: isApple
      ? 'Tip: AirPlay needs the same Wi‑Fi as your Apple TV. Tap Cast, then pick your device.'
      : 'Tip: Cast works best in Chrome. If the picker is empty, use Chrome menu (⋮) → Cast… or screen mirror.',
  };
}

export interface PlayerHelpModalProps {
  open: boolean;
  onClose: () => void;
  /** Force a platform; otherwise auto-detect */
  platform?: HelpPlatform;
}

export default function PlayerHelpModal({ open, onClose, platform }: PlayerHelpModalProps) {
  const [neverAgain, setNeverAgain] = useState(false);
  const [detected, setDetected] = useState<HelpPlatform>('desktop');
  const [isAppleDesktop, setIsAppleDesktop] = useState(false);

  useEffect(() => {
    if (!open) return;
    const p = platform || detectHelpPlatform();
    setDetected(p);
    const ua = navigator.userAgent || '';
    setIsAppleDesktop(/Mac/i.test(navigator.platform || '') || /Mac OS X/i.test(ua));
    try {
      setNeverAgain(localStorage.getItem(PLAYER_HELP_NEVER_KEY) === '1');
    } catch {
      setNeverAgain(false);
    }
  }, [open, platform]);

  const content = useMemo(() => {
    if (detected === 'desktop') return desktopShortcuts(isAppleDesktop);
    return mobileShortcuts(detected === 'apple');
  }, [detected, isAppleDesktop]);

  if (!open) return null;

  const platformLabel =
    detected === 'apple'
      ? 'iPhone / iPad'
      : detected === 'mobile'
        ? 'Phone / tablet'
        : isAppleDesktop
          ? 'Mac'
          : 'Desktop';

  const handleGotIt = () => {
    markPlayerHelpSessionShown();
    setPlayerHelpNeverShow(neverAgain);
    onClose();
  };

  const handleNever = () => {
    markPlayerHelpSessionShown();
    setPlayerHelpNeverShow(true);
    onClose();
  };

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-help-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleGotIt();
      }}
    >
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.badge}>{platformLabel}</div>
            <h2 id="player-help-title" className={styles.title}>
              How to control playback
            </h2>
            <p className={styles.subtitle}>
              Shortcuts and gestures tailored to your device. You can reopen this anytime.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={handleGotIt} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.body}>
          {content.sections.map((section) => (
            <div key={section.label} className={styles.section}>
              <p className={styles.sectionLabel}>{section.label}</p>
              {section.items.map((item) => (
                <div key={item.action} className={styles.row}>
                  <span className={styles.rowLabel}>{item.action}</span>
                  <span className={styles.keys}>
                    {item.keys.map((k) => (
                      <kbd key={k} className={styles.kbd}>
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <p className={styles.tip}>{content.tip}</p>
        </div>

        <div className={styles.footer}>
          <label className={styles.neverRow}>
            <input
              type="checkbox"
              checked={neverAgain}
              onChange={(e) => setNeverAgain(e.target.checked)}
            />
            Don&apos;t show this automatically again
          </label>
          <div className={styles.actions}>
            <button type="button" className={styles.ghost} onClick={handleNever}>
              Never show
            </button>
            <button type="button" className={styles.primary} onClick={handleGotIt}>
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
