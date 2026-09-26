/**
 * Stall recovery — the "skip one second past the bad spot" fix, automated.
 *
 * Symptom this addresses: playback stops at a specific position, the
 * player keeps trying to resume from exactly that position, and eventually
 * the whole stream restarts. Seeking a second or two past the spot has
 * always fixed it by hand, so the players now do that themselves:
 *
 *   1. A watchdog (`StallRecovery.observe`) notices the playhead has not
 *      moved for `stallMs` while the video is supposed to be playing.
 *   2. It picks a target: the start of the next buffered range if there is
 *      a hole just ahead, otherwise the stall point plus an escalating
 *      offset (1s, 2s, 4s, 8s, 10s) so a repeat stall at the same spot
 *      jumps further instead of retrying the same bytes.
 *   3. After `maxAttemptsPerSpot` jumps around the same spot it gives up
 *      and lets the player fail over to another source — resuming there,
 *      not from the beginning.
 *
 * hls.js's own fatal stall / fragment errors feed the same planner
 * (`planSkip`, `fragmentSkipTarget`) so those paths seek forward too
 * instead of tearing the MediaSource down at the stall position.
 *
 * Dependency-free so it can be unit-tested with fake clocks and buffers.
 */

export interface BufferedRange {
  start: number;
  end: number;
}

/** What the watchdog needs to know about the media element each tick. */
export interface StallSnapshot {
  currentTime: number;
  paused: boolean;
  ended: boolean;
  seeking: boolean;
  /** HTMLMediaElement.readyState (0–4). */
  readyState: number;
  buffered: BufferedRange[];
  duration: number;
}

export type SkipReason = "hole" | "skip";

export type StallPlan =
  | { kind: "seek"; target: number; from: number; reason: SkipReason; attempt: number }
  | { kind: "give-up"; from: number; attempts: number };

export interface StallRecoveryOptions {
  /** How long the playhead may sit still (while playing) before we act. */
  stallMs?: number;
  /** Jumps we'll try around one spot before giving up on the source. */
  maxAttemptsPerSpot?: number;
  /** Stalls closer than this (seconds) count as the same spot. */
  spotToleranceSec?: number;
  /** Once the playhead is this far past a spot, its attempt counter resets. */
  recoveredAfterSec?: number;
  /** Look this far ahead for the next buffered range when skipping a hole. */
  holeLookaheadSec?: number;
  now?: () => number;
}

const DEFAULTS: Required<StallRecoveryOptions> = {
  stallMs: 3000,
  maxAttemptsPerSpot: 5,
  spotToleranceSec: 2,
  recoveredAfterSec: 5,
  holeLookaheadSec: 8,
  now: () => Date.now(),
};

/** Escalating forward jump for the nth attempt at the same spot (1-based). */
export function skipOffset(attempt: number): number {
  const steps = [1, 2, 4, 8, 10];
  const i = Math.max(1, Math.floor(attempt)) - 1;
  return steps[Math.min(i, steps.length - 1)];
}

/** Read the element's TimeRanges into plain numbers (safe on any element). */
export function readBuffered(ranges: { length: number; start(i: number): number; end(i: number): number } | null | undefined): BufferedRange[] {
  const out: BufferedRange[] = [];
  if (!ranges) return out;
  for (let i = 0; i < ranges.length; i++) {
    try {
      out.push({ start: ranges.start(i), end: ranges.end(i) });
    } catch {
      /* ranges can change under us */
    }
  }
  return out;
}

/**
 * Where to seek from `currentTime`: the next buffered range if one starts
 * just ahead (a hole), else an escalating jump forward. Clamped to stay
 * inside the media.
 */
export function chooseTarget(
  currentTime: number,
  buffered: BufferedRange[],
  attempt: number,
  duration: number,
  holeLookaheadSec = DEFAULTS.holeLookaheadSec,
): { target: number; reason: SkipReason } {
  let target: number | null = null;
  let reason: SkipReason = "skip";

  const ahead = buffered
    .filter((r) => r.start > currentTime + 0.2 && r.start <= currentTime + holeLookaheadSec)
    .sort((a, b) => a.start - b.start);
  // Only treat it as a hole on the first attempt at a spot — if we already
  // landed at the range start and stalled again, escalate instead.
  if (ahead.length && attempt <= 1) {
    target = ahead[0].start + 0.15;
    reason = "hole";
  }
  if (target === null) {
    target = currentTime + skipOffset(attempt);
  }

  target = Math.max(target, currentTime + 0.25);
  if (Number.isFinite(duration) && duration > 0) {
    // Stay inside the media, but never behind the playhead.
    target = Math.min(target, Math.max(currentTime, duration - 0.05));
  }
  return { target, reason };
}

/** Seek target that steps clear of a fragment hls.js could not load. */
export function fragmentSkipTarget(
  frag: { start: number; duration: number } | null | undefined,
  currentTime: number,
): number {
  const fragEnd = frag ? frag.start + Math.max(0, frag.duration) : currentTime;
  return Math.max(fragEnd, currentTime) + 0.1;
}

export class StallRecovery {
  private readonly opts: Required<StallRecoveryOptions>;
  private lastTime = -1;
  private lastAdvanceAt = 0;
  private spot = -1;
  private lastTarget = -1;
  private attempts = 0;

  constructor(options: StallRecoveryOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.lastAdvanceAt = this.opts.now();
  }

  /** Forget everything (new source / new title). */
  reset(): void {
    this.lastTime = -1;
    this.lastAdvanceAt = this.opts.now();
    this.spot = -1;
    this.lastTarget = -1;
    this.attempts = 0;
  }

  /** Call after the player seeks (ours or the viewer's) so the stall clock restarts. */
  noteSeek(target: number): void {
    this.lastTime = target;
    this.lastAdvanceAt = this.opts.now();
  }

  /** Attempts recorded around the current trouble spot (for UI / logs). */
  get attemptsAtSpot(): number {
    return this.attempts;
  }

  /**
   * Feed one snapshot per tick (≈500 ms). Returns a plan when the playhead
   * has been stuck for `stallMs`, else null.
   */
  observe(snap: StallSnapshot): StallPlan | null {
    const now = this.opts.now();
    const t = snap.currentTime;

    if (snap.paused || snap.ended || snap.seeking) {
      this.lastTime = t;
      this.lastAdvanceAt = now;
      return null;
    }

    if (this.lastTime < 0 || t > this.lastTime + 0.05 || t < this.lastTime - 0.5) {
      // Moving (or seeked backwards): fresh baseline.
      this.lastTime = t;
      this.lastAdvanceAt = now;
      if (this.spot >= 0 && t > Math.max(this.spot, this.lastTarget) + this.opts.recoveredAfterSec) {
        this.spot = -1;
        this.lastTarget = -1;
        this.attempts = 0;
      }
      return null;
    }

    if (now - this.lastAdvanceAt < this.opts.stallMs) return null;

    // Stuck. Restart the clock so we don't fire every tick while the seek lands.
    this.lastAdvanceAt = now;
    return this.planSkip(snap);
  }

  /**
   * Decide the next jump for a stall at `snap.currentTime` right now
   * (used directly by hls.js fatal-stall handlers).
   */
  planSkip(snap: StallSnapshot): StallPlan {
    const t = snap.currentTime;
    // Same trouble spot if we're still at the original stall point, or we
    // stalled right where our previous jump landed (a chain of jumps).
    const tol = this.opts.spotToleranceSec;
    const sameSpot =
      this.spot >= 0 &&
      (Math.abs(t - this.spot) <= tol || (this.lastTarget >= 0 && Math.abs(t - this.lastTarget) <= tol));
    const attempt = sameSpot ? this.attempts + 1 : 1;

    if (attempt > this.opts.maxAttemptsPerSpot) {
      return { kind: "give-up", from: t, attempts: this.attempts };
    }

    if (!sameSpot) this.spot = t;
    this.attempts = attempt;

    const { target, reason } = chooseTarget(t, snap.buffered, attempt, snap.duration, this.opts.holeLookaheadSec);
    this.lastTarget = target;
    this.lastTime = target;
    this.lastAdvanceAt = this.opts.now();
    return { kind: "seek", target, from: t, reason, attempt };
  }
}

/** Snapshot helper for real media elements. */
export function snapshotOf(video: HTMLVideoElement): StallSnapshot {
  return {
    currentTime: video.currentTime,
    paused: video.paused,
    ended: video.ended,
    seeking: video.seeking,
    readyState: video.readyState,
    buffered: readBuffered(video.buffered),
    duration: video.duration,
  };
}
