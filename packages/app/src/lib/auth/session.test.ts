import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { _resetStoreCache, createAccount, deleteAccount, setAccountPassword } from "@/lib/db";
import { signJWT, signSessionFor } from "./jwt";
import { sessionFromToken } from "./get-session";
import { dummyVerifyPassword, safeEqualStrings } from "./password";
import { postLoginPath } from "./redirect-target";
import { _resetRateLimits, isRateLimited, recordHit } from "./rate-limit";

let dir: string;
const saved = { dataDir: process.env.FLYX_DATA_DIR, secret: process.env.JWT_SECRET };

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-session-test-"));
  process.env.FLYX_DATA_DIR = dir;
  process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
  _resetStoreCache();
});

afterEach(() => {
  _resetStoreCache();
  for (const [k, v] of [
    ["FLYX_DATA_DIR", saved.dataDir],
    ["JWT_SECRET", saved.secret],
  ] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("sessionFromToken", () => {
  it("accepts a token for an existing account at the current version", async () => {
    const acct = createAccount("alice", "salt:hash", false);
    const token = await signSessionFor({ ...acct, tokenVersion: 0 });
    const s = await sessionFromToken(token);
    expect(s).toMatchObject({ sub: acct.id, username: "alice", isAdmin: false });
  });

  it("accepts legacy tokens without a tv claim while the account is at version 0", async () => {
    const acct = createAccount("legacy", "salt:hash", false);
    const token = await signJWT({ sub: acct.id, username: "legacy", isAdmin: false });
    expect(await sessionFromToken(token)).not.toBeNull();
  });

  it("revokes tokens after a password change (tokenVersion bump)", async () => {
    const acct = createAccount("bob", "salt:hash", false);
    const token = await signSessionFor({ ...acct, tokenVersion: 0 });
    setAccountPassword(acct.id, "salt2:hash2");
    expect(await sessionFromToken(token)).toBeNull();
  });

  it("revokes tokens of deleted accounts", async () => {
    const acct = createAccount("carol", "salt:hash", true);
    const token = await signSessionFor({ ...acct, tokenVersion: 0 });
    deleteAccount(acct.id);
    expect(await sessionFromToken(token)).toBeNull();
  });

  it("returns the STORED isAdmin, not the token's claim", async () => {
    const acct = createAccount("mallory", "salt:hash", false);
    const forged = await signJWT({ sub: acct.id, username: "mallory", isAdmin: true, tv: 0 });
    expect((await sessionFromToken(forged))?.isAdmin).toBe(false);
  });

  it("rejects tokens signed with another secret", async () => {
    const acct = createAccount("dave", "salt:hash", false);
    const token = await signSessionFor({ ...acct, tokenVersion: 0 });
    process.env.JWT_SECRET = "a-completely-different-secret-value-xyz";
    expect(await sessionFromToken(token)).toBeNull();
  });
});

describe("auth helpers", () => {
  it("safeEqualStrings compares exactly", () => {
    expect(safeEqualStrings("abc", "abc")).toBe(true);
    expect(safeEqualStrings("abc", "abd")).toBe(false);
    expect(safeEqualStrings("abc", "abcd")).toBe(false);
  });

  it("dummyVerifyPassword resolves without throwing", async () => {
    await expect(dummyVerifyPassword("whatever")).resolves.toBeUndefined();
  });

  it("postLoginPath only allows same-origin page paths", () => {
    expect(postLoginPath("/details/550?type=movie")).toBe("/details/550?type=movie");
    expect(postLoginPath("/\t/evil.com")).toBeNull();
    expect(postLoginPath("//evil.com")).toBeNull();
    expect(postLoginPath("/\\evil.com")).toBeNull();
    expect(postLoginPath("https://evil.com")).toBeNull();
    expect(postLoginPath("/api/logs")).toBeNull();
    expect(postLoginPath("/setup")).toBeNull();
    expect(postLoginPath("/login?x=1")).toBeNull();
    expect(postLoginPath(null)).toBeNull();
  });

  it("rate limiter trips after the limit", () => {
    _resetRateLimits();
    for (let i = 0; i < 3; i++) recordHit("k", 60_000);
    expect(isRateLimited("k", 3)).toBe(true);
    expect(isRateLimited("k", 4)).toBe(false);
    expect(isRateLimited("other", 1)).toBe(false);
  });
});
