import { describe, it, expect } from "vitest";
import {
  PROVIDER_PRIORITIES,
  validatePriorities,
  getProvidersByPriority,
  getPriority,
} from "./priorities";

describe("PROVIDER_PRIORITIES", () => {
  it("has no priority collisions", () => {
    expect(() => validatePriorities()).not.toThrow();
  });

  it("has all expected providers", () => {
    expect(PROVIDER_PRIORITIES).toHaveProperty("VIDEASY");
    expect(PROVIDER_PRIORITIES).toHaveProperty("BINGEBOX");
    expect(PROVIDER_PRIORITIES).toHaveProperty("ANIMEX");
    expect(PROVIDER_PRIORITIES).toHaveProperty("DLHD");
    expect(PROVIDER_PRIORITIES).toHaveProperty("WEEBCENTRAL");
  });

  it("has VOD providers before anime providers", () => {
    const vodMax = Math.max(
      PROVIDER_PRIORITIES.VIDEASY,
      PROVIDER_PRIORITIES.BINGEBOX,
      PROVIDER_PRIORITIES.VIDSRC,
    );
    expect(vodMax).toBeLessThan(PROVIDER_PRIORITIES.ANIMEX);
  });
});

describe("getProvidersByPriority", () => {
  it("returns providers sorted by priority ascending", () => {
    const providers = getProvidersByPriority();
    for (let i = 1; i < providers.length; i++) {
      expect(providers[i]!.priority).toBeGreaterThanOrEqual(providers[i - 1]!.priority);
    }
  });

  it("has VIDEASY as the first provider", () => {
    const providers = getProvidersByPriority();
    expect(providers[0]!.name).toBe("VIDEASY");
    expect(providers[0]!.priority).toBe(1);
  });
});

describe("getPriority", () => {
  it("returns the priority for a known provider", () => {
    expect(getPriority("BINGEBOX")).toBe(5);
  });

  it("returns undefined for unknown provider", () => {
    expect(getPriority("UNKNOWN")).toBeUndefined();
  });
});
