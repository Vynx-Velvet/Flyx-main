import { describe, it, expect } from "vitest";
import { extractDLHD, isValidDLHDChannelId, probeDLHDEdge } from "./dlhd";

describe("DLHD channel id validation", () => {
  it("accepts short numeric ids only", () => {
    for (const ok of ["1", "51", "303", "123456"]) expect(isValidDLHDChannelId(ok)).toBe(true);
    for (const bad of ["", "1234567", "51a", "../51", "51/../x", " 51", "5 1", "-1", "0x1f"]) {
      expect(isValidDLHDChannelId(bad)).toBe(false);
    }
  });

  it("rejects invalid ids before any network or cache work", async () => {
    await expect(extractDLHD("../../etc")).resolves.toEqual({ sources: [], subtitles: [] });
    await expect(extractDLHD("x".repeat(10000))).resolves.toEqual({ sources: [], subtitles: [] });
    await expect(probeDLHDEdge("abc")).resolves.toBeNull();
  });
});
