import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth/get-session", () => ({ getSession: async () => null }));

import { signProxyUrl, hasValidSignature } from "./proxy-sign";
import { isPrivateAddress, assertPublicUrl, BlockedUrlError, readBodyLimited, BodyTooLargeError } from "./safe-fetch";
import { safeRedirectPath } from "./safe-redirect";
import { assertSafeEnvEntry, isBlockedEnvKey, isSafeEnvValue } from "./env-safety";

describe("proxy-sign", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
  });

  it("round-trips relative and absolute URLs", () => {
    const rel = signProxyUrl("/api/stream/proxy?url=https%3A%2F%2Fcdn.example%2Fa.m3u8&referer=x");
    expect(rel.startsWith("/api/stream/proxy?")).toBe(true);
    expect(hasValidSignature(new URL(rel, "http://127.0.0.1:3891"))).toBe(true);
    const abs = signProxyUrl("http://127.0.0.1:3891/api/livetv/segment?url=https%3A%2F%2Fx%2Fs.ts");
    expect(hasValidSignature(abs)).toBe(true);
  });

  it("is independent of host and param order", () => {
    const rel = signProxyUrl("/api/stream/proxy?b=2&a=1");
    const u = new URL(rel, "http://192.168.1.5:3891");
    const reordered = new URL(u.pathname, u.origin);
    [...u.searchParams.entries()].reverse().forEach(([k, v]) => reordered.searchParams.append(k, v));
    expect(hasValidSignature(reordered)).toBe(true);
  });

  it("rejects tampering, expiry, and a different secret", () => {
    const rel = signProxyUrl("/api/stream/proxy?url=https%3A%2F%2Fa");
    const tampered = rel.replace("https%3A%2F%2Fa", "https%3A%2F%2Fb");
    expect(hasValidSignature(new URL(tampered, "http://h"))).toBe(false);
    const expired = signProxyUrl("/api/stream/proxy?url=x", -10);
    expect(hasValidSignature(new URL(expired, "http://h"))).toBe(false);
    process.env.JWT_SECRET = "another-secret-another-secret-123";
    expect(hasValidSignature(new URL(rel, "http://h"))).toBe(false);
  });

  it("does not sign without a secret", () => {
    delete process.env.JWT_SECRET;
    expect(signProxyUrl("/api/x?a=1")).toBe("/api/x?a=1");
    expect(hasValidSignature("http://h/api/x?a=1&exp=9999999999&sig=abc")).toBe(false);
  });
});

describe("safe-fetch", () => {
  it("classifies addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.1.1", "172.20.0.1", "169.254.169.254", "100.64.1.1", "0.0.0.0", "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:192.168.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111", "172.32.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("blocks bad schemes and private hosts", async () => {
    for (const u of ["file:///etc/passwd", "data:text/html,x", "http://127.0.0.1/", "http://[::1]:3891/", "http://localhost/", "http://foo.localhost/", "http://169.254.169.254/latest", "http://user:pw@8.8.8.8/", "http://2130706433/"]) {
      await expect(assertPublicUrl(u), u).rejects.toBeInstanceOf(BlockedUrlError);
    }
    await expect(assertPublicUrl("https://8.8.8.8/x")).resolves.toBeInstanceOf(URL);
  });

  it("caps body size", async () => {
    const big = new Response(new Uint8Array(2048));
    await expect(readBodyLimited(big, 1024)).rejects.toBeInstanceOf(BodyTooLargeError);
    const ok = new Response(new Uint8Array(100));
    expect((await readBodyLimited(ok, 1024)).byteLength).toBe(100);
  });
});

describe("safe-redirect", () => {
  it("allows same-origin paths", () => {
    expect(safeRedirectPath("/watch?tmdbId=1#t")).toBe("/watch?tmdbId=1#t");
  });
  it("rejects off-origin and parser tricks", () => {
    for (const t of ["https://evil.com", "//evil.com", "/\t/evil.com", "/\\/evil.com", "\\\\evil.com", "javascript:alert(1)", "/%09/evil.com".replace("%09", "\t"), "", null, undefined]) {
      expect(safeRedirectPath(t as string, "/"), String(t)).toBe("/");
    }
  });
});

describe("env-safety", () => {
  it("blocks loader keys and newline values", () => {
    for (const k of ["NODE_OPTIONS", "node_options", "ELECTRON_RUN_AS_NODE", "PATH", "FLYX_FFMPEG_PATH", "LD_PRELOAD"]) {
      expect(isBlockedEnvKey(k), k).toBe(true);
    }
    expect(isBlockedEnvKey("TMDB_API_KEY")).toBe(false);
    expect(isSafeEnvValue("a\nJWT_SECRET=x")).toBe(false);
    expect(isSafeEnvValue("a\rb")).toBe(false);
    expect(isSafeEnvValue("plain value")).toBe(true);
    expect(() => assertSafeEnvEntry("X", "1\nY=2")).toThrow();
    expect(() => assertSafeEnvEntry("bad-key", "1")).toThrow();
    expect(() => assertSafeEnvEntry("PORT", "3891")).not.toThrow();
  });
});
