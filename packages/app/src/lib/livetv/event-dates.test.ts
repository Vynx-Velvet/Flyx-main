import { describe, expect, it } from "vitest";
import { datedEventStart, datesInTitle } from "./event-dates";

// 2026-10-17 19:00 London (BST, UTC+1).
const NOW = new Date("2026-10-17T18:00:00Z");
const TODAY = { y: 2026, m: 10, d: 17 };

describe("dates in DLHD event titles", () => {
  it("reads day-first, month-first and range forms", () => {
    expect(datesInTitle("Formula 1 Mexican Grand Prix | Mexico City, Mexico | 1 November 2026", TODAY)).toEqual([
      { y: 2026, m: 11, d: 1 },
    ]);
    expect(datesInTitle("Boxing WBA : Tyson Fury vs Anthony Joshua Fight live on Friday, December 11, 2026", TODAY)).toEqual([
      { y: 2026, m: 12, d: 11 },
    ]);
    expect(datesInTitle("Erste Bank Open | Vienna, Austria | 24 October – 1 November 2026", TODAY)).toEqual([
      { y: 2026, m: 10, d: 24 },
      { y: 2026, m: 11, d: 1 },
    ]);
  });

  it("ignores titles without dates, and words that only start like a month", () => {
    expect(datesInTitle("Italy - Serie A : Torino vs Udinese", TODAY)).toEqual([]);
    expect(datesInTitle("General Hospital S64, E25", TODAY)).toEqual([]);
    expect(datesInTitle("Olympique Marseille 2 - Monaco", TODAY)).toEqual([]);
    expect(datesInTitle("Mayweather 3 rounds", TODAY)).toEqual([]);
  });

  it("moves an event dated another day to that day at its listed London time", () => {
    expect(datedEventStart("F1 Mexican Grand Prix | 1 November 2026", "20:00", NOW)).toBe("2026-11-01T20:00:00.000Z");
    expect(datedEventStart("F1 United States Grand Prix | 18 October 2026", "19:00", NOW)).toBe("2026-10-18T18:00:00.000Z");
  });

  it("leaves today's events and running date ranges alone", () => {
    expect(datedEventStart("Torino vs Udinese", "19:45", NOW)).toBeNull();
    expect(datedEventStart("Match | 17 October 2026", "19:45", NOW)).toBeNull();
    expect(datedEventStart("Open | 12 October – 19 October 2026", "10:00", NOW)).toBeNull();
    expect(datedEventStart("Open | 24 October – 1 November 2026", "10:00", NOW)).toBe("2026-10-24T09:00:00.000Z");
  });
});
