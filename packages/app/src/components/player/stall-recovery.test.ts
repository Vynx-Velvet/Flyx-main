import { describe, it, expect } from "vitest";
import {
  StallRecovery,
  chooseTarget,
  fragmentSkipTarget,
  readBuffered,
  skipOffset,
  type StallSnapshot,
} from "./stall-recovery";

function snap(over: Partial<StallSnapshot> = {}): StallSnapshot {
  return {
    currentTime: 100,
    paused: false,
    ended: false,
    seeking: false,
    readyState: 2,
    buffered: [{ start: 0, end: 100 }],
    duration: 5400,
    ...over,
  };
}

function clock(start = 0) {
  let t = start;
  return { now: () => t, tick: (ms: number) => (t += ms) };
}

describe("skipOffset", () => {
  it("escalates 1, 2, 4, 8, 10 and then holds", () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(skipOffset)).toEqual([1, 2, 4, 8, 10, 10, 10]);
  });
});

describe("chooseTarget", () => {
  it("jumps to the next buffered range when a hole is just ahead", () => {
    const r = chooseTarget(100, [{ start: 0, end: 100 }, { start: 103, end: 140 }], 1, 5400);
    expect(r.reason).toBe("hole");
    expect(r.target).toBeCloseTo(103.15, 5);
  });

  it("ignores a hole beyond the lookahead and skips forward instead", () => {
    const r = chooseTarget(100, [{ start: 0, end: 100 }, { start: 130, end: 140 }], 1, 5400);
    expect(r.reason).toBe("skip");
    expect(r.target).toBe(101);
  });

  it("escalates past a repeat stall even when a range starts nearby", () => {
    const r = chooseTarget(100, [{ start: 100.3, end: 140 }], 2, 5400);
    expect(r.reason).toBe("skip");
    expect(r.target).toBe(102);
  });

  it("never seeks past the end of the media", () => {
    const r = chooseTarget(5399.8, [], 4, 5400);
    expect(r.target).toBeLessThanOrEqual(5400);
    expect(r.target).toBeGreaterThan(5399.8);
  });
});

describe("fragmentSkipTarget", () => {
  it("steps just past the fragment that failed", () => {
    expect(fragmentSkipTarget({ start: 96, duration: 6 }, 100)).toBeCloseTo(102.1, 5);
  });
  it("never goes backwards and copes with a missing fragment", () => {
    expect(fragmentSkipTarget({ start: 90, duration: 4 }, 100)).toBeCloseTo(100.1, 5);
    expect(fragmentSkipTarget(null, 100)).toBeCloseTo(100.1, 5);
  });
});

describe("readBuffered", () => {
  it("copies TimeRanges into plain numbers", () => {
    const ranges = { length: 2, start: (i: number) => i * 10, end: (i: number) => i * 10 + 5 };
    expect(readBuffered(ranges)).toEqual([
      { start: 0, end: 5 },
      { start: 10, end: 15 },
    ]);
    expect(readBuffered(null)).toEqual([]);
  });
});

describe("StallRecovery.observe", () => {
  it("stays quiet while the playhead advances", () => {
    const c = clock();
    const r = new StallRecovery({ now: c.now, stallMs: 3000 });
    for (let i = 0; i < 20; i++) {
      c.tick(500);
      expect(r.observe(snap({ currentTime: 100 + i * 0.5 }))).toBeNull();
    }
  });

  it("ignores a paused, ended or seeking element", () => {
    const c = clock();
    const r = new StallRecovery({ now: c.now, stallMs: 3000 });
    for (let i = 0; i < 20; i++) {
      c.tick(500);
      expect(r.observe(snap({ paused: true }))).toBeNull();
    }
    for (let i = 0; i < 20; i++) {
      c.tick(500);
      expect(r.observe(snap({ seeking: true }))).toBeNull();
    }
  });

  it("seeks one second past a stall after stallMs", () => {
    const c = clock();
    const r = new StallRecovery({ now: c.now, stallMs: 3000 });
    expect(r.observe(snap())).toBeNull(); // baseline
    c.tick(2500);
    expect(r.observe(snap())).toBeNull(); // not yet
    c.tick(600);
    const plan = r.observe(snap());
    expect(plan).toEqual({ kind: "seek", target: 101, from: 100, reason: "skip", attempt: 1 });
  });

  it("escalates the jump when the same spot stalls again, then gives up", () => {
    const c = clock();
    const r = new StallRecovery({ now: c.now, stallMs: 3000, maxAttemptsPerSpot: 3 });
    r.observe(snap());
    c.tick(3100);
    expect(r.observe(snap())).toMatchObject({ kind: "seek", target: 101, attempt: 1 });

    // Our seek landed at 101 but it stalls again there.
    c.tick(3100);
    expect(r.observe(snap({ currentTime: 101 }))).toMatchObject({ kind: "seek", target: 103, attempt: 2 });

    c.tick(3100);
    expect(r.observe(snap({ currentTime: 103 }))).toMatchObject({ kind: "seek", target: 107, attempt: 3 });

    c.tick(3100);
    expect(r.observe(snap({ currentTime: 107 }))).toEqual({ kind: "give-up", from: 107, attempts: 3 });
  });

  it("does not fire again until stallMs has elapsed after a jump", () => {
    const c = clock();
    const r = new StallRecovery({ now: c.now, stallMs: 3000 });
    r.observe(snap());
    c.tick(3100);
    expect(r.observe(snap())).toMatchObject({ kind: "seek" });
    c.tick(500);
    expect(r.observe(snap({ currentTime: 101 }))).toBeNull();
    c.tick(500);
    expect(r.observe(snap({ currentTime: 101 }))).toBeNull();
  });

  it("resets the attempt counter once playback is well past the spot", () => {
    const c = clock();
    const r = new StallRecovery({ now: c.now, stallMs: 3000, maxAttemptsPerSpot: 2 });
    r.observe(snap());
    c.tick(3100);
    expect(r.observe(snap())).toMatchObject({ attempt: 1 });
    // Recovered: playhead moves on for a while.
    for (let i = 1; i <= 20; i++) {
      c.tick(500);
      expect(r.observe(snap({ currentTime: 101 + i * 0.5 }))).toBeNull();
    }
    // A brand-new stall far away starts at attempt 1 again.
    c.tick(3100);
    expect(r.observe(snap({ currentTime: 111 }))).toMatchObject({ kind: "seek", target: 112, attempt: 1 });
  });

  it("treats a viewer seek as a fresh baseline", () => {
    const c = clock();
    const r = new StallRecovery({ now: c.now, stallMs: 3000 });
    r.observe(snap());
    c.tick(2900);
    r.noteSeek(400);
    c.tick(2900);
    expect(r.observe(snap({ currentTime: 400 }))).toBeNull();
    c.tick(200);
    expect(r.observe(snap({ currentTime: 400 }))).toMatchObject({ kind: "seek", target: 401 });
  });

  it("prefers hopping over a buffer hole on the first attempt", () => {
    const c = clock();
    const r = new StallRecovery({ now: c.now, stallMs: 3000 });
    const buffered = [
      { start: 0, end: 100 },
      { start: 102, end: 130 },
    ];
    r.observe(snap({ buffered }));
    c.tick(3100);
    const plan = r.observe(snap({ buffered }));
    expect(plan).toMatchObject({ kind: "seek", reason: "hole" });
    expect((plan as { target: number }).target).toBeCloseTo(102.15, 5);
  });
});

describe("StallRecovery.planSkip", () => {
  it("lets hls.js fatal stalls reuse the escalation", () => {
    const c = clock();
    const r = new StallRecovery({ now: c.now });
    expect(r.planSkip(snap())).toMatchObject({ kind: "seek", target: 101, attempt: 1 });
    expect(r.planSkip(snap({ currentTime: 101 }))).toMatchObject({ kind: "seek", target: 103, attempt: 2 });
    r.reset();
    expect(r.planSkip(snap({ currentTime: 101 }))).toMatchObject({ kind: "seek", target: 102, attempt: 1 });
  });
});
