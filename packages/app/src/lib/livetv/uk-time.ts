/**
 * DLHD publishes its schedule in UK wall-clock time ("UK GMT" in the page,
 * but that means Europe/London: GMT in winter, BST = UTC+1 in summer). The
 * old code treated those clock times as UTC, so every event was an hour off
 * for half the year and "live" detection was off with it.
 *
 * These helpers convert a London wall time on London's current calendar day
 * to a real instant, using Intl so DST is handled by the runtime.
 */

const LONDON = "Europe/London";

function londonParts(at: Date): { y: number; m: number; d: number; h: number; mi: number; s: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** London's UTC offset in ms at instant `at` (0 in winter, 3 600 000 in summer). */
export function londonOffsetMs(at: Date): number {
  const p = londonParts(at);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  // Drop sub-second drift from `at` before comparing.
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant for `HH:MM` London wall time on London's calendar day at `now`.
 * Returns null for unparseable input.
 */
export function londonClockToDate(time24: string, now: Date = new Date()): Date | null {
  const m = time24.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hours = parseInt(m[1]!, 10);
  const minutes = parseInt(m[2]!, 10);
  if (hours > 23 || minutes > 59) return null;

  const today = londonParts(now);
  // Wall time as if it were UTC, then remove London's offset at that moment.
  const naive = Date.UTC(today.y, today.m - 1, today.d, hours, minutes, 0, 0);
  const offset = londonOffsetMs(new Date(naive));
  return new Date(naive - offset);
}

/** ISO instant for a London clock time, or "" when unparseable. */
export function londonClockToIso(time24: string, now: Date = new Date()): string {
  return londonClockToDate(time24, now)?.toISOString() ?? "";
}

/** Typical length of a live event window, used when the page gives no end time. */
export const LIVE_WINDOW_MS = 150 * 60 * 1000;

/** True when `now` falls inside [start, start + LIVE_WINDOW_MS). */
export function isWithinLiveWindow(startMs: number, now: number = Date.now(), windowMs = LIVE_WINDOW_MS): boolean {
  return Number.isFinite(startMs) && now >= startMs && now < startMs + windowMs;
}
