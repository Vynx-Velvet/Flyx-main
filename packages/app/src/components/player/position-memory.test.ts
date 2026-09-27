import { describe, it, expect } from "vitest";
import { PositionMemory } from "./position-memory";

describe("PositionMemory", () => {
  const ep1 = "123:tv:1:1";
  const ep2 = "123:tv:1:2";

  it("remembers forward progress for the same content", () => {
    const m = new PositionMemory();
    m.onProgress(ep1, 10);
    m.onProgress(ep1, 754.2);
    expect(m.resumeAt(ep1)).toBe(754.2);
  });

  it("ignores the near-zero timeupdates of a freshly loaded source", () => {
    const m = new PositionMemory();
    m.onProgress(ep1, 600);
    // failed source torn down, next source starts at 0 before its resume seek
    m.onProgress(ep1, 0);
    m.onProgress(ep1, 0.4);
    expect(m.resumeAt(ep1)).toBe(600);
  });

  it("never resumes a different episode at the old position", () => {
    const m = new PositionMemory();
    m.onProgress(ep1, 600);
    expect(m.resumeAt(ep2)).toBeNull();
  });

  it("honours a deliberate seek back to the start", () => {
    const m = new PositionMemory();
    m.onProgress(ep1, 600);
    m.onSeeked(ep1, 0);
    expect(m.resumeAt(ep1)).toBeNull();
  });

  it("tracks the resume seek itself", () => {
    const m = new PositionMemory();
    m.onSeeked(ep1, 1200);
    expect(m.resumeAt(ep1)).toBe(1200);
  });

  it("rejects garbage readings", () => {
    const m = new PositionMemory();
    m.onProgress(ep1, 300);
    m.onProgress(ep1, NaN);
    m.onSeeked(ep1, Number.POSITIVE_INFINITY);
    m.onProgress("", 900);
    expect(m.resumeAt(ep1)).toBe(300);
    expect(m.resumeAt("")).toBeNull();
  });
});
