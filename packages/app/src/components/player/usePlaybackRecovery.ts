'use client';

/**
 * usePlaybackRecovery — React wrapper around the recovery controller.
 *
 * Runs the stall watchdog on a timer while `active`, restarts the stall
 * clock on viewer seeks, and resets state whenever `sourceKey` changes.
 * The returned object is referentially stable so memoised load callbacks
 * can capture it. See recovery-controller.ts for the policy.
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import type Hls from 'hls.js';
import type { ErrorData } from 'hls.js';
import { createRecoveryController, type RecoveryController } from './recovery-controller';
import type { StallPlan } from './stall-recovery';

export interface PlaybackRecoveryOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  hlsRef: RefObject<Hls | null>;
  /** Watchdog only runs while true (a source is loaded and expected to play). */
  active: boolean;
  /** Changes whenever the loaded source changes — resets counters. */
  sourceKey: string;
  /** Called after an automatic skip (for a toast / log). */
  onSkip?: (plan: Extract<StallPlan, { kind: 'seek' }>) => void;
  /** Called when this source should be abandoned; `resumeAt` is where to pick up. */
  onGiveUp?: (resumeAt: number, reason: string) => void;
  /** Watchdog tick interval (ms). */
  tickMs?: number;
  stallMs?: number;
  maxAttemptsPerSpot?: number;
}

export interface PlaybackRecovery {
  /** Feed every hls.js ERROR event here. */
  handleHlsError: (hls: Hls, data: ErrorData) => void;
  /** Tell the watchdog the viewer (or the player) seeked. */
  noteSeek: (target: number) => void;
  /** Forget all stall state (new source). */
  reset: () => void;
}

export function usePlaybackRecovery(options: PlaybackRecoveryOptions): PlaybackRecovery {
  const { videoRef, hlsRef, active, sourceKey, tickMs = 500, stallMs = 3000, maxAttemptsPerSpot = 5 } = options;

  // Latest callbacks without re-creating the controller.
  const onSkipRef = useRef(options.onSkip);
  const onGiveUpRef = useRef(options.onGiveUp);
  onSkipRef.current = options.onSkip;
  onGiveUpRef.current = options.onGiveUp;

  const controllerRef = useRef<RecoveryController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createRecoveryController({
      getVideo: () => videoRef.current,
      getHls: () => hlsRef.current,
      onSkip: (plan) => onSkipRef.current?.(plan),
      onGiveUp: (at, reason) => onGiveUpRef.current?.(at, reason),
      log: (msg) => console.warn(msg),
      stallMs,
      maxAttemptsPerSpot,
    });
  }
  const controller = controllerRef.current;

  const api = useMemo<PlaybackRecovery>(
    () => ({
      handleHlsError: (_hls, data) =>
        controller.handleHlsError({
          fatal: data.fatal,
          type: data.type,
          details: data.details,
          frag: data.frag ? { start: data.frag.start, duration: data.frag.duration } : null,
        }),
      noteSeek: (target) => controller.noteSeek(target),
      reset: () => controller.reset(),
    }),
    [controller],
  );

  // New source → forget everything.
  useEffect(() => {
    controller.reset();
  }, [sourceKey, controller]);

  // Watchdog.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => controller.tick(), tickMs);
    return () => window.clearInterval(id);
  }, [active, tickMs, controller]);

  // Viewer seeks restart the stall clock.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onSeeking = () => controller.noteSeek(video.currentTime);
    video.addEventListener('seeking', onSeeking);
    return () => video.removeEventListener('seeking', onSeeking);
  }, [videoRef, active, controller]);

  return api;
}
