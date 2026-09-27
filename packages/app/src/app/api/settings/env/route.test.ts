/**
 * PATCH /api/settings/env — validation of the keys the Settings → Environment
 * form writes (no live server; isolated FLYX_DATA_DIR).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/get-session", () => ({
  getSession: async () => ({ sub: "x", username: "owner", isAdmin: true }),
}));
vi.mock("@/lib/request-master", () => ({ isMasterRequest: () => true }));

import { _resetStoreCache, createAccount } from "@/lib/db";
import { PATCH } from "./route";

let dir: string;
let savedDataDir: string | undefined;

beforeEach(() => {
  savedDataDir = process.env.FLYX_DATA_DIR;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-env-test-"));
  process.env.FLYX_DATA_DIR = dir;
  fs.writeFileSync(path.join(dir, ".env"), "JWT_SECRET=s\nDEFAULT_USERNAME=ghost\n");
  _resetStoreCache();
  createAccount("owner", "salt:hash", true);
  createAccount("guest", "salt:hash", false);
});

afterEach(() => {
  _resetStoreCache();
  if (savedDataDir === undefined) delete process.env.FLYX_DATA_DIR;
  else process.env.FLYX_DATA_DIR = savedDataDir;
  fs.rmSync(dir, { recursive: true, force: true });
});

const patch = (body: unknown) =>
  PATCH(
    new NextRequest("http://127.0.0.1:3891/api/settings/env", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const envFile = () => fs.readFileSync(path.join(dir, ".env"), "utf-8");

describe("PATCH /api/settings/env", () => {
  it("sets DEFAULT_USERNAME to an existing admin", async () => {
    const res = await patch({ set: { DEFAULT_USERNAME: " owner " } });
    expect(res.status).toBe(200);
    expect(envFile()).toContain("DEFAULT_USERNAME=owner\n");
    expect(envFile()).toContain("JWT_SECRET=s\n");
  });

  it("rejects a DEFAULT_USERNAME that isn't an admin account", async () => {
    for (const name of ["nobody", "guest"]) {
      const res = await patch({ set: { DEFAULT_USERNAME: name } });
      expect(res.status).toBe(400);
    }
    expect(envFile()).toContain("DEFAULT_USERNAME=ghost\n");
  });

  it("normalizes FLYX_ALLOWED_HOSTS entries", async () => {
    const res = await patch({
      set: { FLYX_ALLOWED_HOSTS: "https://MyPC.tail1234.ts.net:3891/, flyx.example.com  flyx.example.com" },
    });
    expect(res.status).toBe(200);
    expect(envFile()).toContain("FLYX_ALLOWED_HOSTS=mypc.tail1234.ts.net,flyx.example.com\n");
  });

  it("rejects an address it can't parse", async () => {
    const res = await patch({ set: { FLYX_ALLOWED_HOSTS: "mypc.ts.net, https://" } });
    expect(res.status).toBe(400);
    expect(envFile()).not.toContain("FLYX_ALLOWED_HOSTS");
  });
});
