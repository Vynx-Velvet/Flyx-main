import { describe, it, expect } from "vitest";
import { migrateLegacyKeys, scopedKey } from "./account-storage";

function mem(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

describe("migrateLegacyKeys", () => {
  it("moves unscoped data into the first account that loads and removes the legacy key", () => {
    const s = mem({ flyx_watchlist_v1: "[1]", flyx_watch_progress: "[2]", unrelated: "x" });
    migrateLegacyKeys(s, "acct-a");
    expect(s.dump()).toEqual({
      "flyx_watchlist_v1:acct-a": "[1]",
      "flyx_watch_progress:acct-a": "[2]",
      unrelated: "x",
    });
    // A second account gets nothing from the (now removed) legacy keys.
    migrateLegacyKeys(s, "acct-b");
    expect(s.getItem(scopedKey("flyx_watchlist_v1", "acct-b"))).toBeNull();
  });

  it("never overwrites an account's existing scoped data", () => {
    const s = mem({ flyx_manga_progress_v1: "{\"old\":1}", "flyx_manga_progress_v1:a": "{\"mine\":1}" });
    migrateLegacyKeys(s, "a");
    expect(s.getItem("flyx_manga_progress_v1:a")).toBe("{\"mine\":1}");
    expect(s.getItem("flyx_manga_progress_v1")).toBeNull();
  });
});
