'use client';

/**
 * ExternalPlayerHandoff — the watch page in "Always open in VLC" mode.
 *
 * Instead of mounting the in-app player, the host resolves a stream and
 * this panel launches VLC on the viewer's device (see
 * lib/external-player-client). It stays on screen so the viewer can relaunch,
 * copy the host stream link for VLC's "Open Network Stream", or fall back
 * to the Flyx player for this title.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  copyStreamUrl,
  currentLaunchStrategy,
  openInVlc,
  type OpenInVlcResult,
} from '@/lib/external-player-client';
import type { HandoffItem } from '@/lib/external-player';
import styles from './ExternalPlayerHandoff.module.css';

export interface ExternalPlayerHandoffProps {
  item: HandoffItem;
  title: string;
  onBack?: () => void;
  /** Play this title in the Flyx player instead (session-only override). */
  onPlayHere?: () => void;
}

type Phase = 'launching' | 'launched' | 'error';

function strategyHint(strategy: OpenInVlcResult['strategy'] | null): string {
  switch (strategy) {
    case 'desktop':
      return 'VLC is starting on this computer with the stream served by your Flyx host.';
    case 'android':
      return 'If VLC did not open, install VLC for Android and try again.';
    case 'ios':
      return 'If VLC did not open, install VLC for iOS and try again.';
    case 'playlist':
      return 'A playlist file was downloaded — open it with VLC. You can also paste the stream link into VLC → Media → Open Network Stream.';
    default:
      return '';
  }
}

export default function ExternalPlayerHandoff({
  item,
  title,
  onBack,
  onPlayHere,
}: ExternalPlayerHandoffProps) {
  const [phase, setPhase] = useState<Phase>('launching');
  const [result, setResult] = useState<OpenInVlcResult | null>(null);
  const [copied, setCopied] = useState(false);
  const launchedRef = useRef(false);

  const launch = useCallback(async () => {
    setPhase('launching');
    setCopied(false);
    const outcome = await openInVlc({ item, title });
    setResult(outcome);
    setPhase(outcome.ok ? 'launched' : 'error');
  }, [item, title]);

  // Launch once per title (React strict mode double-invokes effects in dev).
  useEffect(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    void launch();
  }, [launch]);

  const handleCopy = useCallback(async () => {
    if (!result?.streamUrl) return;
    setCopied(await copyStreamUrl(result.streamUrl));
    window.setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const strategy = result?.strategy ?? currentLaunchStrategy();

  return (
    <div className={styles.panel} role="status" aria-live="polite">
      <div className={styles.badge} aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M8 3h8l3 12H5L8 3Z" />
          <path d="M4 15h16l1 5H3l1-5Z" />
        </svg>
      </div>

      <h2 className={styles.title}>
        {phase === 'launching' && 'Opening in VLC…'}
        {phase === 'launched' && 'Playing in VLC'}
        {phase === 'error' && 'VLC could not start'}
      </h2>
      <p className={styles.subtitle}>{title}</p>

      <p className={styles.hint}>
        {phase === 'launching' && 'Asking your Flyx host for a stream.'}
        {phase === 'launched' && strategyHint(strategy)}
        {phase === 'error' && (result?.message || 'Something went wrong.')}
      </p>

      {phase === 'launching' && <div className={styles.spinner} />}

      <div className={styles.actions}>
        {phase !== 'launching' && (
          <button type="button" className={styles.primary} onClick={() => void launch()}>
            {phase === 'error' ? 'Try again' : 'Open in VLC again'}
          </button>
        )}
        {result?.streamUrl && (
          <button type="button" className={styles.ghost} onClick={() => void handleCopy()}>
            {copied ? 'Link copied' : 'Copy stream link'}
          </button>
        )}
        {onPlayHere && (
          <button type="button" className={styles.ghost} onClick={onPlayHere}>
            Play in Flyx instead
          </button>
        )}
        {onBack && (
          <button type="button" className={styles.ghost} onClick={onBack}>
            Back
          </button>
        )}
      </div>

      <p className={styles.footnote}>
        Change this in Settings → Playback → Open in VLC.
      </p>
    </div>
  );
}
