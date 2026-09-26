import { describe, it, expect } from "vitest";
import { isWithinLiveWindow, londonClockToDate, londonClockToIso, londonOffsetMs } from "./uk-time";

describe("londonOffsetMs", () => {
  it("is +1h in British Summer Time and 0 in winter", () => {
    expect(londonOffsetMs(new Date("2026-09-25T12:00:00Z"))).toBe(3_600_000);
    expect(londonOffsetMs(new Date("2026-01-15T12:00:00Z"))).toBe(0);
  });
});

describe("londonClockToDate", () => {
  it("converts a BST wall time to the right instant (20:00 London = 19:00Z)", () => {
    const now = new Date("2026-09-25T10:00:00Z");
    expect(londonClockToIso("20:00", now)).toBe("2026-09-25T19:00:00.000Z");
  });

  it("converts a GMT wall time unchanged in winter", () => {
    const now = new Date("2026-01-15T10:00:00Z");
    expect(londonClockToIso("20:00", now)).toBe("2026-01-15T20:00:00.000Z");
  });

  it("uses London's calendar day, not UTC's", () => {
    // 23:30Z on the 24th is already 00:30 on the 25th in London (BST).
    const now = new Date("2026-09-24T23:30:00Z");
    expect(londonClockToIso("05:00", now)).toBe("2026-09-25T04:00:00.000Z");
  });

  it("rejects garbage", () => {
    expect(londonClockToDate("25:00")).toBeNull();
    expect(londonClockToDate("soon")).toBeNull();
    expect(londonClockToIso("")).toBe("");
  });
});

describe("isWithinLiveWindow", () => {
  it("is live from kick-off until the window ends", () => {
    const start = Date.parse("2026-09-25T19:00:00Z");
    expect(isWithinLiveWindow(start, start - 1)).toBe(false);
    expect(isWithinLiveWindow(start, start)).toBe(true);
    expect(isWithinLiveWindow(start, start + 149 * 60_000)).toBe(true);
    expect(isWithinLiveWindow(start, start + 150 * 60_000)).toBe(false);
    expect(isWithinLiveWindow(NaN, start)).toBe(false);
  });
});
