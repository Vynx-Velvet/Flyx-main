/**
 * Recovery controller — framework-free glue between StallRecovery and a
 * media element + hls.js instance. usePlaybackRecovery wraps this for React;
 * tests drive it with fake elements.
 *
 * Policy for hls.js fatal errors:
 *   • buffer stall            → seek forward (escalating per spot)
 *   • fragment/key load error → seek just past that fragment, resume loading
 *   • other network error     → resume loading at the current position
 *   • media error             → hls.recoverMediaError() (resumes in place),
 *                               at most MAX_MEDIA_ERROR_RECOVERIES per source
 *   • anything else           → give up
 * "Give up" reports the position to resume from on another source.
 */

import { StallRecovery, fragmentSkipTarget, snapshotOf, type StallPlan, type StallRecoveryOptions } from './stall-recovery';

/** The slice of HTMLVideoElement the controller touches. */
export interface RecoveryMedia {
  currentTime: number;
  paused: boolean;
  ended: boolean;
  seeking: boolean;
  readyState: number;
  duration: number;
  buffered: { length: number; start(i: number): number; end(i: number): number };
  play(): Promise<void> | void;
}

/** The slice of hls.js the controller touches. */
export interface RecoveryHls {
  startLoad(startPosition?: number): void;
  recoverMediaError(): void;
}

/** The slice of hls.js ErrorData the controller reads. */
export interface RecoveryErrorData {
  fatal: boolean;
  type: string;
  details: string;
  frag?: { start: number; duration: number } | null;
}

export interface RecoveryControllerOptions extends StallRecoveryOptions {
  getVideo: () => RecoveryMedia | null;
  getHls: () => RecoveryHls | null;
  onSkip?: (plan: Extract<StallPlan, { kind: 'seek' }>) => void;
  onGiveUp?: (resumeAt: number, reason: string) => void;
  log?: (message: string) => void;
}

export const MAX_MEDIA_ERROR_RECOVERIES = 2;

// String values of hls.js ErrorTypes / ErrorDetails we act on. Kept as
// literals so this module has no runtime dependency on hls.js.
export const HLS_NETWORK_ERROR = 'networkError';
export const HLS_MEDIA_ERROR = 'mediaError';
export const HLS_BUFFER_STALLED = 'bufferStalledError';
const SKIPPABLE_FRAGMENT_ERRORS = new Set([
  'fragLoadError',
  'fragLoadTimeOut',
  'fragParsingError',
  'keyLoadError',
  'keyLoadTimeOut',
]);

export interface RecoveryController {
  /** One watchdog tick — call every ~500 ms while a source is active. */
  tick(): void;
  /** Feed hls.js ERROR events (non-fatal ones are ignored). */
  handleHlsError(data: RecoveryErrorData): void;
  /** The viewer or player seeked. */
  noteSeek(target: number): void;
  /** New source: forget stall spots, media-error count and give-up state. */
  reset(): void;
  readonly gaveUp: boolean;
}

export function createRecoveryController(options: RecoveryControllerOptions): RecoveryController {
  const { getVideo, getHls, onSkip, onGiveUp, log = () => {}, ...stallOptions } = options;
  const recovery = new StallRecovery(stallOptions);
  let mediaErrors = 0;
  let gaveUp = false;

  const giveUp = (resumeAt: number, reason: string) => {
    if (gaveUp) return;
    gaveUp = true;
    log(`[player-recovery] giving up on source at ${resumeAt.toFixed(1)}s: ${reason}`);
    onGiveUp?.(resumeAt, reason);
  };

  const apply = (plan: StallPlan, why: string) => {
    const video = getVideo();
    if (!video) return;
    if (plan.kind === 'give-up') {
      giveUp(plan.from + 1, `${why}: ${plan.attempts} skips did not help`);
      return;
    }
    log(
      `[player-recovery] ${why}: skipping ${plan.from.toFixed(1)}s -> ${plan.target.toFixed(1)}s (${plan.reason}, attempt ${plan.attempt})`,
    );
    try {
      video.currentTime = plan.target;
    } catch {
      /* element not ready — the watchdog tries again next tick */
    }
    // A seek normally restarts hls.js loading, but after a fatal error it
    // may have stopped altogether — make it explicit.
    const hls = getHls();
    if (hls) {
      try {
        hls.startLoad(plan.target);
      } catch {
        /* ignore */
      }
    }
    if (video.paused && !video.ended) {
      try {
        const p = video.play();
        if (p && typeof (p as Promise<void>).catch === 'function') {
          (p as Promise<void>).catch(() => {
            /* autoplay policy — the viewer can press play */
          });
        }
      } catch {
        /* ignore */
      }
    }
    onSkip?.(plan);
  };

  return {
    get gaveUp() {
      return gaveUp;
    },
    tick() {
      const video = getVideo();
      if (!video || gaveUp) return;
      const plan = recovery.observe(snapshotOf(video as unknown as HTMLVideoElement));
      if (plan) apply(plan, 'stall watchdog');
    },
    handleHlsError(data) {
      const video = getVideo();
      const hls = getHls();
      if (!data.fatal || !video || !hls || gaveUp) return;
      const at = video.currentTime || 0;

      if (data.details === HLS_BUFFER_STALLED) {
        apply(recovery.planSkip(snapshotOf(video as unknown as HTMLVideoElement)), 'hls stalled');
        return;
      }

      if (data.type === HLS_NETWORK_ERROR) {
        if (data.frag && SKIPPABLE_FRAGMENT_ERRORS.has(data.details)) {
          const target = fragmentSkipTarget(data.frag, at);
          apply(
            { kind: 'seek', target, from: at, reason: 'skip', attempt: recovery.attemptsAtSpot + 1 },
            `fragment ${data.details}`,
          );
          recovery.noteSeek(target);
          return;
        }
        log(`[player-recovery] network error ${data.details} - resuming at ${at.toFixed(1)}s`);
        try {
          hls.startLoad(at > 0 ? at : -1);
        } catch {
          giveUp(at, `network ${data.details}`);
        }
        return;
      }

      if (data.type === HLS_MEDIA_ERROR) {
        mediaErrors += 1;
        if (mediaErrors <= MAX_MEDIA_ERROR_RECOVERIES) {
          log(`[player-recovery] media error ${data.details} - recoverMediaError (${mediaErrors})`);
          try {
            hls.recoverMediaError(); // hls.js 1.6 resumes at currentTime itself
            recovery.noteSeek(at);
            return;
          } catch {
            /* fall through to give up */
          }
        }
        giveUp(at, `media ${data.details}`);
        return;
      }

      giveUp(at, `${data.type} ${data.details}`);
    },
    noteSeek(target) {
      recovery.noteSeek(target);
    },
    reset() {
      recovery.reset();
      mediaErrors = 0;
      gaveUp = false;
    },
  };
}
