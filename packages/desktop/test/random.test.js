import { describe, it, expect } from "vitest";
import { randomString, randomPassword } from "../src/random.js";

describe("randomString", () => {
  it("produces the requested length from the URL-safe charset", () => {
    for (const len of [0, 1, 24, 64]) {
      const s = randomString(len);
      expect(s).toHaveLength(len);
      expect(s).toMatch(/^[A-Za-z0-9_-]*$/);
    }
  });

  it("produces distinct values", () => {
    expect(randomString(64)).not.toBe(randomString(64));
  });
});

describe("randomPassword", () => {
  it("produces the pronounceable CVC-CVC-dd format", () => {
    for (let i = 0; i < 10; i++) {
      expect(randomPassword()).toMatch(
        /^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]-[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]-[23456789]{2}$/,
      );
    }
  });
});
