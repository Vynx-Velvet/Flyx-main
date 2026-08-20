import { describe, it, expect } from "vitest";
import { needsRelaxedTLS } from "./relaxed-fetch";

describe("needsRelaxedTLS", () => {
  it("matches exact hosts in the relaxed list", () => {
    expect(needsRelaxedTLS("https://dlhd.st/path")).toBe(true);
    expect(needsRelaxedTLS("https://hamis.romponalis.st/foo")).toBe(true);
    expect(needsRelaxedTLS("https://phantemlis.top/")).toBe(true);
  });

  it("matches subdomains of any relaxed base host", () => {
    // DLHD rotates CDN subdomains (xameleon.phantemlis.top today,
    // <other>.phantemlis.top tomorrow). Suffix matching must accept any
    // subdomain of a base in RELAXED_HOSTS, otherwise extraction silently
    // falls back to vanilla fetch and breaks.
    expect(needsRelaxedTLS("https://xameleon.phantemlis.top/foo.m3u8")).toBe(true);
    expect(needsRelaxedTLS("https://anything.phantemlis.top/foo")).toBe(true);
    expect(needsRelaxedTLS("https://deeply.nested.dlhd.st/")).toBe(true);
    expect(needsRelaxedTLS("https://cdn.epaly.fun/stream")).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    expect(needsRelaxedTLS("https://example.com/")).toBe(false);
    expect(needsRelaxedTLS("https://google.com/")).toBe(false);
    expect(needsRelaxedTLS("https://phantom.org/")).toBe(false);
  });

  it("returns false for invalid URLs", () => {
    expect(needsRelaxedTLS("not a url")).toBe(false);
    expect(needsRelaxedTLS("")).toBe(false);
  });
});