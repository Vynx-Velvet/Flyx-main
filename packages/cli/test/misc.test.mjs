import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRequire } from "module";
import http from "http";

const require = createRequire(import.meta.url);
const { makeTempDataDir, loadFresh, rmrf } = require("./helpers.js");

describe("random", () => {
  it("generates long, typeable admin passwords", () => {
    const { randomPassword } = require("../src/lib/random.js");
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const pw = randomPassword();
      expect(pw).toMatch(/^[A-Za-z2-9]{5}(-[A-Za-z2-9]{5}){3}$/);
      expect(pw).not.toMatch(/[0O1lIo]/);
      seen.add(pw);
    }
    expect(seen.size).toBe(200);
  });
});

describe("update input validation", () => {
  let dir;
  let update;
  beforeEach(() => {
    dir = makeTempDataDir();
    update = loadFresh(dir, "commands/update.js");
  });
  afterEach(() => rmrf(dir));

  it("accepts normal branch names and rejects injection", () => {
    expect(update.isValidBranch("main")).toBe(true);
    expect(update.isValidBranch("feature/x-1.2")).toBe(true);
    for (const bad of ["-x", "--upload-pack=evil", "a b", "a;rm", "../x", "a..b", "$(id)", ""]) {
      expect(update.isValidBranch(bad), bad).toBe(false);
    }
  });

  it("accepts https/ssh remotes and rejects option/ext transports", () => {
    expect(update.isValidRemoteUrl("https://github.com/Vynx-Velvet/Flyx-main.git")).toBe(true);
    expect(update.isValidRemoteUrl("git@github.com:Vynx-Velvet/Flyx-main.git")).toBe(true);
    expect(update.isValidRemoteUrl("ssh://git@github.com/Vynx-Velvet/Flyx-main.git")).toBe(true);
    for (const bad of [
      "--upload-pack=touch /tmp/x",
      "ext::sh -c touch% /tmp/pwned",
      "file:///etc",
      "https://github.com/x/y; rm -rf /",
      "http://github.com/x/y",
    ]) {
      expect(update.isValidRemoteUrl(bad), bad).toBe(false);
    }
  });
});

describe("server pid verification", () => {
  let dir;
  let server;
  beforeEach(() => {
    dir = makeTempDataDir();
    server = loadFresh(dir, "lib/server.js");
  });
  afterEach(() => rmrf(dir));

  it("only accepts positive integer pids", () => {
    expect(server.isValidPid(1234)).toBe(true);
    for (const bad of [0, -1, 1.5, "1234", "1234 & calc", NaN, null, undefined]) {
      expect(server.isValidPid(bad)).toBe(false);
    }
  });

  it("refuses to stop a live pid that is not a verified Flyx server", async () => {
    // Our own pid is alive, but nothing answers /api/health on this port.
    const res = await server.stopServer({ pid: process.pid, port: 1, startedAt: new Date().toISOString() });
    expect(res.stopped).toBe(false);
    expect(res.refused).toBe(true);
  });

  it("verifyFlyxProcess requires the boot nonce and a matching start time", async () => {
    const nonce = "a".repeat(48);
    const srv = http.createServer((req, res) => {
      const ok = req.headers["x-flyx-boot-check"] === nonce;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ status: "ok", uptime: 5, ...(ok ? { bootOk: true } : {}) }));
    });
    await new Promise((r) => srv.listen(0, "127.0.0.1", r));
    const port = srv.address().port;
    const startedAt = new Date(Date.now() - 5000).toISOString();
    try {
      // process.pid is alive; identity is decided by the health response.
      expect((await server.verifyFlyxProcess({ pid: process.pid, port, startedAt, bootNonce: nonce })).ok).toBe(true);
      expect((await server.verifyFlyxProcess({ pid: process.pid, port, startedAt, bootNonce: "b".repeat(48) })).ok).toBe(false);
      const old = new Date(Date.now() - 3600_000).toISOString();
      expect((await server.verifyFlyxProcess({ pid: process.pid, port, startedAt: old })).ok).toBe(false);
      expect((await server.verifyFlyxProcess({ pid: process.pid, port, startedAt })).ok).toBe(true);
    } finally {
      srv.close();
    }
  });
});
