/**
 * Dates written into DLHD event titles.
 *
 * The schedule's time column is a bare London clock time ("20:00"), which the
 * parser places on today's date. The "Upcoming Events" list reuses that layout
 * for events weeks away and puts the real day in the title instead
 * ("… | 1 November 2026", "… live on Friday, December 11, 2026",
 * "… | 24 October – 1 November 2026"), so those showed as LIVE every evening.
 */

import { londonDateTimeToDate, londonToday } from "./uk-time";

type Day = { y: number; m: number; d: number };

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// "1 November 2026", "24th Oct", "1 Nov, 2026"
const DAY_FIRST = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?(?![a-z])(?:,?\s+(\d{4}))?/gi;
// "December 11, 2026", "Oct 24th"
const MONTH_FIRST = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/gi;

/**
 * Calendar dates in `title`, in reading order. A date without a year borrows
 * the title's other year (ranges like "24 October – 1 November 2026"), else
 * London's current year.
 */
export function datesInTitle(title: string, today: Day = londonToday()): Day[] {
  const found: { y?: number; m: number; d: number; at: number; end: number }[] = [];
  for (const m of title.matchAll(DAY_FIRST)) {
    const at = m.index!;
    found.push({ d: Number(m[1]), m: MONTHS[m[2]!.toLowerCase().slice(0, 3)]!, y: m[3] ? Number(m[3]) : undefined, at, end: at + m[0].length });
  }
  for (const m of title.matchAll(MONTH_FIRST)) {
    const at = m.index!;
    const end = at + m[0].length;
    // Text the day-first pass already read as a date ("1 November 12…").
    if (found.some((f) => at < f.end && end > f.at)) continue;
    found.push({ d: Number(m[2]), m: MONTHS[m[1]!.toLowerCase().slice(0, 3)]!, y: m[3] ? Number(m[3]) : undefined, at, end });
  }
  const year = found.find((f) => f.y)?.y ?? today.y;
  return found
    .filter((f) => f.d >= 1 && f.d <= 31)
    .sort((a, b) => a.at - b.at)
    .map((f) => ({ y: f.y ?? year, m: f.m, d: f.d }));
}

/**
 * ISO start for an event whose title names a day other than today (at the
 * listed London clock time), or null when the title names no date, today, or
 * a range that includes today.
 */
export function datedEventStart(title: string, time24: string, now: Date = new Date()): string | null {
  const dates = datesInTitle(title, londonToday(now));
  if (!dates.length) return null;
  const key = (x: Day) => x.y * 10000 + x.m * 100 + x.d;
  const today = key(londonToday(now));
  const keys = dates.map(key);
  const first = Math.min(...keys);
  const last = Math.max(...keys);
  if (today >= first && today <= last) return null;
  const start = dates[keys.indexOf(first)]!;
  return londonDateTimeToDate(start.y, start.m, start.d, time24)?.toISOString() ?? null;
}
