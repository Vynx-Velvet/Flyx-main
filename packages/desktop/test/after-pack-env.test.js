import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { assertNoRealEnv, serverResourcesDir } from "../build/after-pack.cjs";

describe("afterPack .env guard", () => {
  function serverTree() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "flyx-pack-"));
    const app = path.join(root, "packages", "app");
    fs.mkdirSync(path.join(app, "node_modules", "dep"), { recursive: true });
    fs.writeFileSync(path.join(app, ".env"), "TMDB_API_KEY=dummy-key-for-build\nFLYX_DESKTOP=true\n");
    fs.writeFileSync(path.join(app, "node_modules", "dep", ".env.example"), "X=\n");
    return root;
  }

  it("passes with only the dummy packages/app/.env (templates ignored)", () => {
    const root = serverTree();
    expect(assertNoRealEnv(root)).toEqual([path.join(root, "packages", "app", ".env")]);
  });

  it("fails the build when the app .env holds real values", () => {
    const root = serverTree();
    fs.writeFileSync(path.join(root, "packages", "app", ".env"), "TMDB_API_KEY=eyJrealtoken\n");
    expect(() => assertNoRealEnv(root)).toThrow(/refusing to package/);
  });

  it("fails the build on any other .env* file", () => {
    const root = serverTree();
    fs.writeFileSync(path.join(root, "packages", "app", ".env.local"), "JWT_SECRET=x\n");
    expect(() => assertNoRealEnv(root)).toThrow(/\.env\.local/);
  });

  it("is a no-op when there is no server payload", () => {
    expect(assertNoRealEnv(path.join(os.tmpdir(), "flyx-does-not-exist-xyz"))).toEqual([]);
  });

  it("locates the server payload per platform", () => {
    expect(serverResourcesDir("/out", "win32", "Flyx")).toBe(path.join("/out", "resources", "server"));
    expect(serverResourcesDir("/out", "darwin", "Flyx")).toBe(
      path.join("/out", "Flyx.app", "Contents", "Resources", "server"),
    );
  });
});
