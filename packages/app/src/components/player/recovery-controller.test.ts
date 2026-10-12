import { describe, it, expect, vi } from "vitest";
import {
  createRecoveryController,
  HLS_BUFFER_STALLED,
  HLS_MEDIA_ERROR,
  HLS_NETWORK_ERROR,
  type RecoveryMedia,
} from "./recovery-controller";

function fakeVideo(over: Partial<RecoveryMedia> = {}, ranges: Array<[number, number]> = [[0, 130]]) {
  const video: RecoveryMedia & { seeks: number[]; plays: number } = {
    currentTime: 100,
    paused: false,
    ended: false,
    seeking: false,
    readyState: 2,
    duration: 5400,
    buffered: {
      get length() {
        return ranges.length;
      },
      start: (i: number) => ranges[i][0],
      end: (i: number) => ranges[i][1],
    },
    seeks: [],
    plays: 0,
    play() {
      video.plays += 1;
      return Promise.resolve();
    },
    ...over,
  };
  // Record seeks through a setter while keeping a plain numeric field.
  let t = video.currentTime;
  Object.defineProperty(video, "currentTime", {
    get: () => t,
    set: (v: number) => {
      t = v;
      video.seeks.push(v);
    },
  });
  return video;
}

function fakeHls() {
  return { startLoad: vi.fn(), recoverMediaError: vi.fn() };
}

function setup(
  over: { now?: () => number; stallMs?: number; maxAttemptsPerSpot?: number; starvedGiveUpMs?: number } = {},
  ranges?: Array<[number, number]>,
) {
  const video = fakeVideo({}, ranges);
  const hls = fakeHls();
  const onSkip = vi.fn();
  const onGiveUp = vi.fn();
  const controller = createRecoveryController({
    getVideo: () => video,
    getHls: () => hls,
    onSkip,
    onGiveUp,
    ...over,
  });
  return { video, hls, onSkip, onGiveUp, controller };
}

/** Two watchdog ticks of normal forward playback ending at `to` (test writes are then forgotten). */
function playTo(controller: { tick(): void }, video: ReturnType<typeof fakeVideo>, to: number) {
  video.currentTime = to - 0.5;
  controller.tick();
  video.currentTime = to;
  controller.tick();
  video.seeks.length = 0;
}

describe("recovery controller: hls.js fatal errors", () => {
  it("seeks forward on a fatal buffer stall instead of rebuilding the pipeline", () => {
    const { video, hls, onSkip, controller } = setup();
    controller.handleHlsError({ fatal: true, type: HLS_MEDIA_ERROR, details: HLS_BUFFER_STALLED });
    expect(video.seeks).toEqual([101]);
    expect(hls.startLoad).toHaveBeenCalledWith(101);
    expect(hls.recoverMediaError).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledWith(expect.objectContaining({ kind: "seek", target: 101, attempt: 1 }));
  });

  it("escalates when the same spot stalls fatally again", () => {
    const { video, controller } = setup();
    controller.handleHlsError({ fatal: true, type: HLS_MEDIA_ERROR, details: HLS_BUFFER_STALLED });
    video.currentTime = 101; // landed, stalled again
    controller.handleHlsError({ fatal: true, type: HLS_MEDIA_ERROR, details: HLS_BUFFER_STALLED });
    expect(video.seeks).toEqual([101, 101, 103]);
  });

  it("skips just past a fragment that cannot be loaded and resumes loading there", () => {
    const { video, hls, controller } = setup();
    playTo(controller, video, 100);
    controller.handleHlsError({
      fatal: true,
      type: HLS_NETWORK_ERROR,
      details: "fragLoadError",
      frag: { start: 98, duration: 6 },
    });
    expect(video.seeks[0]).toBeCloseTo(104.1, 5);
    expect(hls.startLoad).toHaveBeenCalledWith(expect.closeTo(104.1, 5));
  });

  it("resumes loading at the current position for other network errors", () => {
    const { video, hls, controller } = setup();
    controller.handleHlsError({ fatal: true, type: HLS_NETWORK_ERROR, details: "levelLoadError" });
    expect(video.seeks).toEqual([]);
    expect(hls.startLoad).toHaveBeenCalledWith(100);
  });

  it("gives up after repeated network resumes without progress, and forgives them once playing", () => {
    const { video, hls, onGiveUp, controller } = setup();
    const err = { fatal: true, type: HLS_NETWORK_ERROR, details: "levelLoadError" };
    controller.handleHlsError(err);
    controller.handleHlsError(err);
    playTo(controller, video, 120); // recovered — budget refills
    controller.handleHlsError(err);
    controller.handleHlsError(err);
    expect(hls.startLoad).toHaveBeenCalledTimes(4);
    expect(onGiveUp).not.toHaveBeenCalled();
    controller.handleHlsError(err);
    expect(onGiveUp).toHaveBeenCalledWith(120, expect.stringContaining("levelLoadError"));
  });

  it("fails over at once when the manifest cannot be loaded", () => {
    const { hls, onGiveUp, controller } = setup();
    controller.handleHlsError({ fatal: true, type: HLS_NETWORK_ERROR, details: "manifestLoadError" });
    expect(hls.startLoad).not.toHaveBeenCalled();
    expect(onGiveUp).toHaveBeenCalledWith(100, expect.stringContaining("manifestLoadError"));
  });

  it("fails over when a fragment dies before the source ever played (every segment refused)", () => {
    const { video, hls, onGiveUp, controller } = setup();
    controller.handleHlsError({
      fatal: true,
      type: HLS_NETWORK_ERROR,
      details: "fragLoadError",
      frag: { start: 96, duration: 6 },
    });
    expect(video.seeks).toEqual([]);
    expect(hls.startLoad).not.toHaveBeenCalled();
    expect(onGiveUp).toHaveBeenCalledWith(100, expect.stringContaining("before playback started"));
  });

  it("stops skipping dead fragments after MAX_FRAGMENT_SKIPS and fails over", () => {
    const { video, onSkip, onGiveUp, controller } = setup();
    playTo(controller, video, 100);
    for (let i = 0; i < 3; i++) {
      const at = video.currentTime;
      controller.handleHlsError({
        fatal: true,
        type: HLS_NETWORK_ERROR,
        details: "fragLoadError",
        frag: { start: at, duration: 6 },
      });
    }
    expect(onSkip).toHaveBeenCalledTimes(3);
    expect(onGiveUp).not.toHaveBeenCalled();
    controller.handleHlsError({
      fatal: true,
      type: HLS_NETWORK_ERROR,
      details: "fragLoadError",
      frag: { start: video.currentTime, duration: 6 },
    });
    expect(onGiveUp).toHaveBeenCalledWith(expect.any(Number), expect.stringContaining("fragment skips did not help"));
  });

  it("recovers media errors in place at most twice, then gives up at position", () => {
    const { hls, onGiveUp, controller } = setup();
    const err = { fatal: true, type: HLS_MEDIA_ERROR, details: "bufferAppendError" };
    controller.handleHlsError(err);
    controller.handleHlsError(err);
    expect(hls.recoverMediaError).toHaveBeenCalledTimes(2);
    expect(onGiveUp).not.toHaveBeenCalled();
    controller.handleHlsError(err);
    expect(hls.recoverMediaError).toHaveBeenCalledTimes(2);
    expect(onGiveUp).toHaveBeenCalledWith(100, expect.stringContaining("bufferAppendError"));
    expect(controller.gaveUp).toBe(true);
  });

  it("gives up on unknown fatal errors and ignores non-fatal ones", () => {
    const { onGiveUp, video, controller } = setup();
    controller.handleHlsError({ fatal: false, type: HLS_MEDIA_ERROR, details: HLS_BUFFER_STALLED });
    expect(video.seeks).toEqual([]);
    controller.handleHlsError({ fatal: true, type: "otherError", details: "internalException" });
    expect(onGiveUp).toHaveBeenCalledTimes(1);
    // Further errors after give-up are ignored (no double failover).
    controller.handleHlsError({ fatal: true, type: HLS_MEDIA_ERROR, details: HLS_BUFFER_STALLED });
    expect(video.seeks).toEqual([]);
  });

  it("reset() clears the media-error budget and give-up state for a new source", () => {
    const { hls, controller } = setup();
    const err = { fatal: true, type: HLS_MEDIA_ERROR, details: "bufferAppendError" };
    controller.handleHlsError(err);
    controller.handleHlsError(err);
    controller.handleHlsError(err);
    expect(controller.gaveUp).toBe(true);
    controller.reset();
    controller.handleHlsError(err);
    expect(hls.recoverMediaError).toHaveBeenCalledTimes(3);
    expect(controller.gaveUp).toBe(false);
  });
});

describe("recovery controller: watchdog", () => {
  it("skips a stuck spot after stallMs and nudges play if the element paused itself", () => {
    let now = 0;
    const { video, hls, onSkip, controller } = setup({ now: () => now, stallMs: 3000 });
    controller.tick(); // baseline
    now += 3100;
    controller.tick();
    expect(video.seeks).toEqual([101]);
    expect(hls.startLoad).toHaveBeenCalledWith(101);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(video.plays).toBe(0); // it was playing — no play() call needed

    // A viewer-paused element is never treated as a stall.
    video.paused = true;
    video.currentTime = 101;
    now += 3100;
    controller.tick();
    expect(video.seeks).toEqual([101, 101]); // only the test's own write
    expect(video.plays).toBe(0);
  });

  it("presses play when a skip is applied to an element the browser left paused", () => {
    const { video, controller } = setup();
    video.paused = true;
    controller.handleHlsError({ fatal: true, type: HLS_MEDIA_ERROR, details: HLS_BUFFER_STALLED });
    expect(video.seeks).toEqual([101]);
    expect(video.plays).toBe(1);
  });

  it("fails over at the stall spot + 1s after too many attempts", () => {
    let now = 0;
    const { video, onGiveUp, controller } = setup({ now: () => now, stallMs: 3000, maxAttemptsPerSpot: 2 });
    controller.tick();
    now += 3100;
    controller.tick(); // → 101
    video.currentTime = 101;
    now += 3100;
    controller.tick(); // → 103
    video.currentTime = 103;
    now += 3100;
    controller.tick(); // give up
    expect(onGiveUp).toHaveBeenCalledWith(104, expect.stringContaining("2 skips"));
    now += 3100;
    controller.tick(); // no further action once given up
    expect(onGiveUp).toHaveBeenCalledTimes(1);
  });

  it("leaves a starved playhead to the loader, then fails over at the same spot", () => {
    let now = 0;
    const { video, hls, onSkip, onGiveUp, controller } = setup(
      { now: () => now, stallMs: 3000, starvedGiveUpMs: 30_000 },
      [[0, 100]], // playhead at the end of its buffer
    );
    controller.tick();
    for (let i = 0; i < 59; i++) {
      now += 500;
      controller.tick();
    }
    expect(video.seeks).toEqual([]);
    expect(hls.startLoad).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
    now += 600;
    controller.tick();
    expect(onGiveUp).toHaveBeenCalledWith(100, expect.stringContaining("starved"));
  });

  it("does nothing while playback is progressing normally", () => {
    let now = 0;
    const { video, onSkip, controller } = setup({ now: () => now });
    for (let i = 0; i < 30; i++) {
      now += 500;
      video.currentTime = 100 + i * 0.5;
      controller.tick();
    }
    expect(onSkip).not.toHaveBeenCalled();
    expect(video.seeks.length).toBe(30); // only our test's own writes
  });
});
