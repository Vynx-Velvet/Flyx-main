/**
 * Unit tests for the auth/setup route handlers (no live server — handlers
 * are called directly with an isolated FLYX_DATA_DIR).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({
  session: null as null | { sub: string; username: string; isAdmin: boolean },
}));
vi.mock("@/lib/auth/get-session", () => ({
  getSession: async () => auth.session,
}));

import { _resetStoreCache, createAccount, getAccountCount, listAccounts } from "@/lib/db";
import { _resetRateLimits } from "@/lib/auth/rate-limit";
import { POST as setupSave } from "../setup/save/route";
import { POST as register } from "./register/route";
import { GET as autoLogin } from "./auto-login/route";
import { DELETE as deleteAccountRoute } from "./accounts/route";

const ENV_KEYS = [
  "FLYX_DATA_DIR",
  "FLYX_DESKTOP",
  "FLYX_MASTER_TOKEN",
  "SETUP_COMPLETE",
  "DEFAULT_USERNAME",
  "DEFAULT_PASSWORD",
  "DEFAULT_DISPLAY_NAME",
  "TMDB_API_KEY",
  "JWT_SECRET",
  "HOST_KEY",
  "HOSTNAME",
  "NEXT_PUBLIC_APP_URL",
];
let savedEnv: Record<string, string | undefined>;
let dir: string;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-routes-test-"));
  process.env.FLYX_DATA_DIR = dir;
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
  auth.session = null;
  _resetStoreCache();
  _resetRateLimits();
});

afterEach(() => {
  _resetStoreCache();
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3891${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const setupBody = {
  tmdbKey: "tmdb-key-123",
  username: "owner",
  password: "correct horse",
  networkMode: "localhost",
};

describe("POST /api/setup/save", () => {
  it("runs on first boot, creates the admin and does not flip a CLI server into desktop mode", async () => {
    const res = await setupSave(jsonRequest("/api/setup/save", setupBody));
    expect(res.status).toBe(200);
    const env = fs.readFileSync(path.join(dir, ".env"), "utf-8");
    expect(env).toContain("SETUP_COMPLETE=true");
    expect(env).not.toContain("FLYX_DESKTOP");
    expect(listAccounts()).toMatchObject([{ username: "owner", isAdmin: true }]);
  });

  it("is locked once setup is complete unless the caller is an admin", async () => {
    await setupSave(jsonRequest("/api/setup/save", setupBody));
    const again = await setupSave(
      jsonRequest("/api/setup/save", { ...setupBody, username: "attacker" }),
    );
    expect(again.status).toBe(403);
    expect(listAccounts().map((a) => a.username)).toEqual(["owner"]);

    auth.session = { sub: listAccounts()[0].id, username: "owner", isAdmin: true };
    const asAdmin = await setupSave(jsonRequest("/api/setup/save", setupBody));
    expect(asAdmin.status).toBe(200);
  });

  it("is locked when any account exists even without SETUP_COMPLETE", async () => {
    createAccount("existing", "salt:hash", true);
    const res = await setupSave(jsonRequest("/api/setup/save", setupBody));
    expect(res.status).toBe(403);
  });

  it("rejects values containing line breaks", async () => {
    const res = await setupSave(
      jsonRequest("/api/setup/save", { ...setupBody, tmdbKey: "abc\nJWT_SECRET=pwned" }),
    );
    expect(res.status).toBe(400);
    expect(fs.existsSync(path.join(dir, ".env"))).toBe(false);
    const res2 = await setupSave(
      jsonRequest("/api/setup/save", { ...setupBody, password: "longenough\rNODE_OPTIONS=x" }),
    );
    expect(res2.status).toBe(400);
  });

  it("requires 8+ character passwords", async () => {
    const res = await setupSave(jsonRequest("/api/setup/save", { ...setupBody, password: "short" }));
    expect(res.status).toBe(400);
  });

  it("serializes concurrent first-run saves (only one admin)", async () => {
    const [a, b] = await Promise.all([
      setupSave(jsonRequest("/api/setup/save", { ...setupBody, username: "one" })),
      setupSave(jsonRequest("/api/setup/save", { ...setupBody, username: "two" })),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 403]);
    expect(getAccountCount()).toBe(1);
  });

  it("is master-only on desktop", async () => {
    process.env.FLYX_DESKTOP = "true";
    const res = await setupSave(jsonRequest("/api/setup/save", setupBody));
    expect(res.status).toBe(403);
  });
});

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    process.env.HOST_KEY = "the-host-key-abcdefghijkl";
    createAccount("owner", "salt:hash", true);
  });

  it("never grants admin through the host key", async () => {
    const res = await register(
      jsonRequest(
        "/api/auth/register",
        { username: "guest", password: "password123", isAdmin: true },
        { "x-host-key": "the-host-key-abcdefghijkl" },
      ),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).account.isAdmin).toBe(false);
  });

  it("lets an admin session create an admin", async () => {
    auth.session = { sub: listAccounts()[0].id, username: "owner", isAdmin: true };
    const res = await register(
      jsonRequest("/api/auth/register", { username: "second", password: "password123", isAdmin: true }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).account.isAdmin).toBe(true);
  });

  it("rejects a wrong host key", async () => {
    const res = await register(
      jsonRequest(
        "/api/auth/register",
        { username: "guest", password: "password123" },
        { "x-host-key": "wrong" },
      ),
    );
    expect(res.status).toBe(403);
  });

  it("refuses to create the first account", async () => {
    _resetStoreCache();
    fs.rmSync(path.join(dir, "store.json"));
    const res = await register(
      jsonRequest(
        "/api/auth/register",
        { username: "guest", password: "password123" },
        { "x-host-key": "the-host-key-abcdefghijkl" },
      ),
    );
    expect(res.status).toBe(409);
    expect(getAccountCount()).toBe(0);
  });

  it("rate-limits repeated attempts", async () => {
    let last = 0;
    for (let i = 0; i < 25; i++) {
      const res = await register(
        jsonRequest(
          "/api/auth/register",
          { username: `u${i}xx`, password: "password123" },
          { "x-host-key": "wrong", "x-forwarded-for": "10.0.0.9" },
        ),
      );
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe("GET /api/auth/auto-login", () => {
  const get = (qs = "", headers: Record<string, string> = {}) =>
    autoLogin(new NextRequest(`http://localhost:3891/api/auth/auto-login${qs}`, { headers }));

  beforeEach(() => {
    process.env.DEFAULT_USERNAME = "owner";
    process.env.DEFAULT_PASSWORD = "default-password";
  });

  it("creates the default account on a pristine store and honors a safe redirect", async () => {
    const res = await get("?redirect=%2Fdetails%2F550");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3891/details/550");
    expect(res.cookies.get("flyx_token")?.value).toBeTruthy();
    expect(getAccountCount()).toBe(1);
  });

  it("ignores an unsafe redirect ('/\\t/evil.com')", async () => {
    const res = await get(`?redirect=${encodeURIComponent("/\t/evil.com")}`);
    expect(res.headers.get("location")).toBe("http://localhost:3891/");
  });

  it("does not hand admin to an anonymous visitor on a recovered (corrupt) store", async () => {
    fs.writeFileSync(path.join(dir, "store.json"), "{ corrupt");
    const res = await get();
    expect(res.headers.get("location")).toBe("http://localhost:3891/login");
    expect(res.cookies.get("flyx_token")).toBeUndefined();
    expect(getAccountCount()).toBe(0);
  });

  it("does not auto-create when the store once held accounts", async () => {
    fs.writeFileSync(
      path.join(dir, "store.json"),
      JSON.stringify({ version: 1, accounts: [], settings: {}, initialized: true }),
    );
    const res = await get();
    expect(res.headers.get("location")).toBe("http://localhost:3891/login");
    expect(getAccountCount()).toBe(0);
  });

  it("?check=1 is forbidden to anonymous callers and never reveals password length", async () => {
    expect((await get("?check=1")).status).toBe(403);
    auth.session = { sub: "x", username: "owner", isAdmin: true };
    const body = await (await get("?check=1")).json();
    expect(body).not.toHaveProperty("passLength");
  });

  // Upgraded installs: pre-3.2.5 setup re-runs rewrote DEFAULT_USERNAME
  // without creating that account (3.2.5 regression: master locked out).
  it("signs the master in as the oldest admin when the default account is missing", async () => {
    const token = "m".repeat(40);
    process.env.FLYX_MASTER_TOKEN = token;
    process.env.SETUP_COMPLETE = "true";
    createAccount("guest", "salt:hash", false);
    const first = createAccount("first-admin", "salt:hash", true);
    await new Promise((r) => setTimeout(r, 5));
    createAccount("second-admin", "salt:hash", true);
    const res = await get("?redirect=%2Fsettings", { cookie: `flyx_master_token=${token}` });
    expect(res.headers.get("location")).toBe("http://localhost:3891/settings");
    const jwt = res.cookies.get("flyx_token")?.value;
    expect(jwt).toBeTruthy();
    const { verifyJWT } = await import("@/lib/auth/jwt");
    expect((await verifyJWT(jwt!))?.sub).toBe(first.id);
  });

  it("sends the master to /login only when no admin exists", async () => {
    const token = "m".repeat(40);
    process.env.FLYX_MASTER_TOKEN = token;
    process.env.SETUP_COMPLETE = "true";
    createAccount("guest", "salt:hash", false);
    const res = await get("", { cookie: `flyx_master_token=${token}` });
    expect(res.headers.get("location")).toBe("http://localhost:3891/login");
    expect(res.cookies.get("flyx_token")).toBeUndefined();
  });

  it("never falls back to an admin for a non-master visitor", async () => {
    process.env.FLYX_MASTER_TOKEN = "m".repeat(40);
    process.env.SETUP_COMPLETE = "true";
    process.env.FLYX_DESKTOP = "true";
    createAccount("first-admin", "salt:hash", true);
    const res = await get("", { cookie: `flyx_master_token=${"x".repeat(40)}` });
    expect(res.headers.get("location")).toBe("http://localhost:3891/login");
    expect(res.cookies.get("flyx_token")).toBeUndefined();
  });
});

describe("DELETE /api/auth/accounts", () => {
  const del = (id: string) =>
    deleteAccountRoute(
      new NextRequest("http://localhost:3891/api/auth/accounts", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      }),
    );

  it("refuses to delete the default account and the last admin", async () => {
    process.env.DEFAULT_USERNAME = "owner";
    const owner = createAccount("owner", "salt:hash", true);
    const other = createAccount("other-admin", "salt:hash", true);
    const guest = createAccount("guest", "salt:hash", false);

    auth.session = { sub: other.id, username: "other-admin", isAdmin: true };
    expect((await del(owner.id)).status).toBe(400);

    // other-admin deletes nothing of theirs; owner removes other-admin, then
    // other-admin can't be the "last admin" target anymore — use a fresh pair.
    auth.session = { sub: owner.id, username: "owner", isAdmin: true };
    expect((await del(guest.id)).status).toBe(200);
    expect((await del(other.id)).status).toBe(200);

    delete process.env.DEFAULT_USERNAME;
    const lone = listAccounts().find((a) => a.username === "owner")!;
    const admin2 = createAccount("admin2", "salt:hash", false);
    auth.session = { sub: admin2.id, username: "admin2", isAdmin: true };
    const res = await del(lone.id);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/last admin/);
  });

  it("requires an admin session", async () => {
    const a = createAccount("x-user", "salt:hash", false);
    auth.session = { sub: "y", username: "y", isAdmin: false };
    expect((await del(a.id)).status).toBe(403);
  });
});
