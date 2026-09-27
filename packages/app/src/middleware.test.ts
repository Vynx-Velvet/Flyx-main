import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { middleware } from "./middleware";
import { hasNonJsonBody, isAllowedHost, isCrossSiteMutation, requestOrigin } from "@/lib/request-origin";

const KEYS = ["JWT_SECRET", "FLYX_ALLOWED_HOSTS", "NEXT_PUBLIC_APP_URL", "DEFAULT_USERNAME", "FLYX_DESKTOP"];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const req = (url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) =>
  new NextRequest(url, init);

describe("isAllowedHost", () => {
  it("allows local names and IP literals", () => {
    for (const h of [
      "localhost:3891",
      "127.0.0.1:3891",
      "192.168.1.20:3891",
      "[::1]:3891",
      "desktop-pc:3891",
      "flyx.local",
      "app.localhost",
    ]) {
      expect(isAllowedHost(h)).toBe(true);
    }
  });

  it("rejects arbitrary domains (DNS rebinding)", () => {
    expect(isAllowedHost("evil.example.com")).toBe(false);
    expect(isAllowedHost("attacker.test:3891")).toBe(false);
  });

  it("honors NEXT_PUBLIC_APP_URL and FLYX_ALLOWED_HOSTS", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://flyx.example.com";
    process.env.FLYX_ALLOWED_HOSTS = "media.home.arpa, other.example.org:8443";
    expect(isAllowedHost("flyx.example.com")).toBe(true);
    expect(isAllowedHost("media.home.arpa:3891")).toBe(true);
    expect(isAllowedHost("other.example.org")).toBe(true);
    expect(isAllowedHost("evil.example.com")).toBe(false);
  });
});

describe("isCrossSiteMutation / hasNonJsonBody", () => {
  it("blocks a POST whose Origin is another host", () => {
    const r = req("http://192.168.1.20:3891/api/settings", {
      method: "POST",
      headers: { host: "192.168.1.20:3891", origin: "http://evil.example.com" },
    });
    expect(isCrossSiteMutation(r)).toBe(true);
  });

  it("allows same-origin POSTs and GETs", () => {
    const r = req("http://192.168.1.20:3891/api/settings", {
      method: "POST",
      headers: { host: "192.168.1.20:3891", origin: "http://192.168.1.20:3891" },
    });
    expect(isCrossSiteMutation(r)).toBe(false);
    expect(
      isCrossSiteMutation(req("http://x/api/a", { headers: { origin: "http://evil.com" } })),
    ).toBe(false);
  });

  it("blocks Sec-Fetch-Site: cross-site and Origin: null", () => {
    expect(
      isCrossSiteMutation(
        req("http://localhost/api/a", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }),
      ),
    ).toBe(true);
    expect(
      isCrossSiteMutation(
        req("http://localhost/api/a", { method: "POST", headers: { host: "localhost", origin: "null" } }),
      ),
    ).toBe(true);
  });

  it("requires JSON bodies on mutations", () => {
    const textPost = req("http://localhost/api/a", {
      method: "POST",
      headers: { "content-type": "text/plain", "content-length": "5" },
      body: "hello",
    });
    expect(hasNonJsonBody(textPost)).toBe(true);
    const jsonPost = req("http://localhost/api/a", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8", "content-length": "2" },
      body: "{}",
    });
    expect(hasNonJsonBody(jsonPost)).toBe(false);
    expect(hasNonJsonBody(req("http://localhost/api/a", { method: "POST" }))).toBe(false);
  });
});

describe("requestOrigin", () => {
  it("only honors http/https forwarded protos", () => {
    const r = (proto: string) =>
      req("http://0.0.0.0:3891/", { headers: { host: "pc:3891", "x-forwarded-proto": proto } });
    expect(requestOrigin(r("https"))).toBe("https://pc:3891");
    expect(requestOrigin(r("javascript"))).toBe("http://pc:3891");
  });
});

describe("middleware", () => {
  it("403s an unknown Host (plain text for pages, JSON for API)", async () => {
    const page = await middleware(req("http://evil.example.com/", { headers: { host: "evil.example.com" } }));
    expect(page.status).toBe(403);
    const api = await middleware(
      req("http://evil.example.com/api/settings", { headers: { host: "evil.example.com" } }),
    );
    expect(api.status).toBe(403);
    expect(api.headers.get("content-type")).toMatch(/json/);
  });

  it("403s a cross-origin API POST and 415s a text/plain one", async () => {
    const cross = await middleware(
      req("http://localhost:3891/api/auth/login", {
        method: "POST",
        headers: { host: "localhost:3891", origin: "http://evil.example.com", "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(cross.status).toBe(403);
    const text = await middleware(
      req("http://localhost:3891/api/auth/login", {
        method: "POST",
        headers: { host: "localhost:3891", "content-type": "text/plain", "content-length": "2" },
        body: "{}",
      }),
    );
    expect(text.status).toBe(415);
  });

  it("does not treat nested *.png paths as public assets", async () => {
    const res = await middleware(req("http://localhost:3891/details/1.png", { headers: { host: "localhost:3891" } }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    const asset = await middleware(req("http://localhost:3891/favicon.svg", { headers: { host: "localhost:3891" } }));
    expect(asset.headers.get("location")).toBeNull();
  });

  it("gates /api/logs, /api/network and /debug behind a session", async () => {
    for (const p of ["/api/logs", "/api/network", "/debug"]) {
      const res = await middleware(req(`http://localhost:3891${p}`, { headers: { host: "localhost:3891" } }));
      expect(res.headers.get("location")).toContain("/login");
    }
  });

  it("treats every token as invalid when JWT_SECRET is unset (no fallback secret)", async () => {
    const token = await new SignJWT({ sub: "x", username: "x", isAdmin: true })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("fallback-dev-secret-not-for-production"));
    const res = await middleware(
      req("http://localhost:3891/settings", {
        headers: { host: "localhost:3891", cookie: `flyx_token=${token}` },
      }),
    );
    expect(res.headers.get("location")).toContain("/login");
  });
});
