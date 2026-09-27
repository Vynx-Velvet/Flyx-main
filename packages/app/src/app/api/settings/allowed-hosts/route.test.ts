/**
 * /api/settings/allowed-hosts — admin-only editing of FLYX_ALLOWED_HOSTS
 * (no live server; isolated FLYX_DATA_DIR).
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

import { GET, PUT } from "./route";

const KEYS = ["FLYX_DATA_DIR", "FLYX_ALLOWED_HOSTS", "FLYX_DESKTOP"];
let saved: Record<string, string | undefined>;
let dir: string;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-hosts-test-"));
  process.env.FLYX_DATA_DIR = dir;
  fs.writeFileSync(
    path.join(dir, ".env"),
    "# keep me\nJWT_SECRET=s\nFLYX_ALLOWED_HOSTS=old.example.com\nPORT=3891\n",
  );
  auth.session = { sub: "a", username: "owner", isAdmin: true };
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

const put = (hosts: unknown) =>
  PUT(
    new NextRequest("http://192.168.1.20:3891/api/settings/allowed-hosts", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hosts }),
    }),
  );
const envFile = () => fs.readFileSync(path.join(dir, ".env"), "utf-8");

describe("/api/settings/allowed-hosts", () => {
  it("is admin-only", async () => {
    auth.session = { sub: "g", username: "guest", isAdmin: false };
    expect((await GET()).status).toBe(403);
    expect((await put(["a.example.com"])).status).toBe(403);
    auth.session = null;
    expect((await put(["a.example.com"])).status).toBe(403);
    expect(envFile()).toContain("FLYX_ALLOWED_HOSTS=old.example.com\n");
  });

  it("reports the saved list and what the running server enforces", async () => {
    process.env.FLYX_ALLOWED_HOSTS = "running.example.com";
    process.env.FLYX_DESKTOP = "true";
    const body = await (await GET()).json();
    expect(body).toMatchObject({
      ok: true,
      available: true,
      hosts: ["old.example.com"],
      active: ["running.example.com"],
      autoRestart: true,
    });
  });

  it("saves normalized, de-duplicated hosts and keeps the rest of .env intact", async () => {
    const res = await put([
      "https://MyPC.tail1234.ts.net:3891/",
      "flyx.example.com",
      "FLYX.example.com ",
    ]);
    expect(res.status).toBe(200);
    expect((await res.json()).hosts).toEqual(["mypc.tail1234.ts.net", "flyx.example.com"]);
    expect(envFile()).toBe(
      "# keep me\nJWT_SECRET=s\nFLYX_ALLOWED_HOSTS=mypc.tail1234.ts.net,flyx.example.com\nPORT=3891\n",
    );
  });

  it("removes the key when the list is emptied", async () => {
    expect((await put([])).status).toBe(200);
    expect(envFile()).toBe("# keep me\nJWT_SECRET=s\nPORT=3891\n");
  });

  it("rejects wildcards, garbage and injection attempts without writing", async () => {
    for (const bad of [
      ["*"],
      ["https://"],
      ["a.example.com\nNODE_OPTIONS=--x"],
      ["bad host.com"],
      "x.com",
      [1],
    ]) {
      expect((await put(bad)).status).toBe(400);
    }
    expect(envFile()).toContain("FLYX_ALLOWED_HOSTS=old.example.com\n");
    expect(envFile()).not.toContain("NODE_OPTIONS");
  });

  it("caps the list length", async () => {
    const many = Array.from({ length: 21 }, (_, i) => `h${i}.example.com`);
    expect((await put(many)).status).toBe(400);
  });
});
