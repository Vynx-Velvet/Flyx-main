import { describe, it, expect } from "vitest";
import {
  acquireFfmpeg,
  acquireStream,
  limitSnapshot,
  MAX_FFMPEG_PROCESSES,
  STREAM_LIMITS,
  tryAcquireFfmpeg,
  tryAcquireStream,
} from "./limits";

describe("download limits", () => {
  it("caps ffmpeg processes and hands freed slots to waiters", async () => {
    const held = Array.from({ length: MAX_FFMPEG_PROCESSES }, () => tryAcquireFfmpeg());
    expect(held.every(Boolean)).toBe(true);
    expect(tryAcquireFfmpeg()).toBeNull();

    const waiting = acquireFfmpeg();
    expect(limitSnapshot().ffmpegWaiting).toBe(1);
    held[0]!();
    held[0]!(); // idempotent
    const r = await waiting;
    expect(tryAcquireFfmpeg()).toBeNull();

    const ctrl = new AbortController();
    const aborted = acquireFfmpeg(ctrl.signal);
    ctrl.abort();
    await expect(aborted).rejects.toThrow(/cancelled/);

    r();
    for (const h of held.slice(1)) h!();
    expect(limitSnapshot().ffmpeg).toBe(0);
  });

  it("allows one video stream per user", () => {
    const a = tryAcquireStream("alice", "video");
    expect(a).toBeTruthy();
    expect(tryAcquireStream("alice", "video")).toBeNull();
    const b = tryAcquireStream("bob", "video");
    expect(b).toBeTruthy();
    a!();
    const again = tryAcquireStream("alice", "video");
    expect(again).toBeTruthy();
    again!();
    b!();
    expect(limitSnapshot().video).toBe(0);
  });

  it("queues manga streams briefly, then gives up", async () => {
    const held = Array.from({ length: STREAM_LIMITS.manga.perUser }, () => tryAcquireStream("carol", "manga"));
    expect(held.every(Boolean)).toBe(true);
    // Times out while the user's slots stay busy.
    expect(await acquireStream("carol", "manga", 50)).toBeNull();
    // Gets a slot as soon as one frees.
    const pending = acquireStream("carol", "manga", 5000);
    held[0]!();
    const got = await pending;
    expect(got).toBeTruthy();
    got!();
    held[1]!();
    expect(limitSnapshot().manga).toBe(0);
  });
});
