import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import { resetDesktopModules } from "./helpers.js";

beforeEach(() => {
  resetDesktopModules();
  vi.restoreAllMocks();
});

async function load() {
  return import("../src/vlc.js");
}

describe("vlc.candidatePaths", () => {
  it("lists Program Files locations on Windows", async () => {
    const { candidatePaths } = await load();
    const paths = candidatePaths("win32", {
      ProgramFiles: "C:\\PF",
      "ProgramFiles(x86)": "C:\\PF86",
    });
    expect(paths[0]).toBe(path.join("C:\\PF", "VideoLAN", "VLC", "vlc.exe"));
    expect(paths).toContain(path.join("C:\\PF86", "VideoLAN", "VLC", "vlc.exe"));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("lists the app bundle on macOS and bin dirs on Linux", async () => {
    const { candidatePaths } = await load();
    expect(candidatePaths("darwin", {})[0]).toBe("/Applications/VLC.app/Contents/MacOS/VLC");
    expect(candidatePaths("linux", {})).toContain("/usr/bin/vlc");
  });
});

describe("vlc.findVlc", () => {
  it("prefers FLYX_VLC_PATH when it exists", async () => {
    const { findVlc } = await load();
    const found = findVlc({
      platform: "linux",
      env: { FLYX_VLC_PATH: "/opt/vlc/bin/vlc" },
      exists: (p) => p === "/opt/vlc/bin/vlc",
      execFile: () => {
        throw new Error("not on PATH");
      },
    });
    expect(found).toBe("/opt/vlc/bin/vlc");
  });

  it("uses PATH lookup before known locations", async () => {
    const { findVlc } = await load();
    const found = findVlc({
      platform: "win32",
      env: { ProgramFiles: "C:\\PF" },
      exists: () => true,
      execFile: () => "C:\\Tools\\vlc.exe\r\nC:\\Other\\vlc.exe\r\n",
    });
    expect(found).toBe("C:\\Tools\\vlc.exe");
  });

  it("falls back to known locations and returns null when nothing exists", async () => {
    const { findVlc } = await load();
    const known = path.join("C:\\PF", "VideoLAN", "VLC", "vlc.exe");
    expect(
      findVlc({
        platform: "win32",
        env: { ProgramFiles: "C:\\PF" },
        exists: (p) => p === known,
        execFile: () => {
          throw new Error("where: not found");
        },
      }),
    ).toBe(known);
    expect(
      findVlc({
        platform: "win32",
        env: {},
        exists: () => false,
        execFile: () => {
          throw new Error("where: not found");
        },
      }),
    ).toBeNull();
  });
});

describe("vlc.buildArgs / buildPlaylist", () => {
  it("passes title, resume position and the URL after --", async () => {
    const { buildArgs } = await load();
    const args = buildArgs({
      url: "http://192.168.1.5:3891/api/stream/proxy?url=x",
      title: "Show — S1 E2",
      startTime: 93.7,
    });
    expect(args).toEqual([
      "--meta-title=Show — S1 E2",
      "--start-time=93",
      "--network-caching=3000",
      "--",
      "http://192.168.1.5:3891/api/stream/proxy?url=x",
    ]);
  });

  it("omits start-time at zero", async () => {
    const { buildArgs, buildPlaylist } = await load();
    expect(buildArgs({ url: "http://h/x", title: "T", startTime: 0 })).not.toContain(
      expect.stringMatching(/start-time/),
    );
    const body = buildPlaylist({ url: "http://h/x", title: "T", startTime: 0 });
    expect(body).toBe("#EXTM3U\n#EXTINF:-1,T\n#EXTVLCOPT:network-caching=3000\nhttp://h/x\n");
  });

  it("writes an EXTVLCOPT start-time into the playlist", async () => {
    const { buildPlaylist } = await load();
    const body = buildPlaylist({ url: "http://h/x", title: "Line\nBreak", startTime: 30 });
    expect(body).toContain("#EXTINF:-1,Line Break\n");
    expect(body).toContain("#EXTVLCOPT:start-time=30\n");
  });
});

describe("vlc.isAllowedStreamUrl", () => {
  it("accepts only our own server's stream routes", async () => {
    const { isAllowedStreamUrl } = await load();
    const ok = [
      "http://127.0.0.1:3891/api/stream/proxy?url=a&sig=b",
      "http://localhost:3891/api/stream/proxy?url=a",
      "http://127.0.0.1:3891/api/livetv/playlist?ch=1",
    ];
    for (const url of ok) expect(isAllowedStreamUrl(url, 3891), url).toBeTruthy();

    const bad = [
      "file:///etc/passwd",
      "smb://evil/share/x.mkv",
      "https://127.0.0.1:3891/api/stream/proxy?url=a", // https: not our server
      "http://evil.example/api/stream/proxy?url=a",
      "http://192.168.1.5:3891/api/stream/proxy?url=a", // LAN address ≠ this machine's server origin
      "http://127.0.0.1:3892/api/stream/proxy?url=a", // wrong port
      "http://127.0.0.1:3891/api/admin/users",
      "http://127.0.0.1:3891/api/stream/../admin/users",
      "http://user:pw@127.0.0.1:3891/api/stream/proxy",
      "http://127.0.0.1:3891/",
      "",
      42,
    ];
    for (const url of bad) expect(isAllowedStreamUrl(url, 3891), String(url)).toBeNull();
    expect(isAllowedStreamUrl("http://127.0.0.1:3891/api/stream/proxy", undefined)).toBeNull();
  });
});

describe("vlc.launch", () => {
  it("rejects non-http URLs", async () => {
    const { launch } = await load();
    const result = await launch({ url: "file:///etc/passwd" }, { exists: () => false, port: 3891 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/http/);
  });

  it("rejects http URLs that aren't this server's stream routes (never spawns VLC)", async () => {
    const { launch } = await load();
    const spawn = vi.fn();
    const result = await launch(
      { url: "http://evil.example/api/stream/proxy?url=a" },
      { platform: "linux", env: { FLYX_VLC_PATH: "/usr/bin/vlc" }, exists: () => true, spawn, port: 3891 },
    );
    expect(result.ok).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("spawns VLC detached when a binary is found", async () => {
    const { launch } = await load();
    const unref = vi.fn();
    const spawn = vi.fn(() => ({ unref }));
    const result = await launch(
      { url: "http://127.0.0.1:3891/api/stream/proxy?url=a", title: "T", startTime: 10 },
      {
        platform: "linux",
        env: { FLYX_VLC_PATH: "/usr/bin/vlc" },
        exists: (p) => p === "/usr/bin/vlc",
        spawn,
        port: 3891,
      },
    );
    expect(result).toEqual({ ok: true, method: "spawn", path: "/usr/bin/vlc" });
    expect(spawn).toHaveBeenCalledTimes(1);
    const [bin, args, opts] = spawn.mock.calls[0];
    expect(bin).toBe("/usr/bin/vlc");
    expect(args.at(-1)).toBe("http://127.0.0.1:3891/api/stream/proxy?url=a");
    expect(opts.detached).toBe(true);
    expect(unref).toHaveBeenCalled();
  });

  it("falls back to a playlist opened by the OS when no VLC is installed", async () => {
    const { launch } = await load();
    const writes = [];
    const openPath = vi.fn(async () => "");
    const result = await launch(
      { url: "http://127.0.0.1:3891/api/stream/proxy?url=a", title: "..\\..\\evil", startTime: 5 },
      {
        platform: "win32",
        env: {},
        exists: () => false,
        execFile: () => {
          throw new Error("no where");
        },
        openPath,
        tempDir: "C:\\tmp",
        mkdir: () => {},
        writeFile: (file, body) => writes.push({ file, body }),
        port: 3891,
      },
    );
    expect(result.ok).toBe(true);
    expect(result.method).toBe("playlist");
    expect(writes).toHaveLength(1);
    // Random name in a Flyx-only subfolder — the title never becomes a path.
    expect(path.dirname(writes[0].file)).toBe(path.join("C:\\tmp", "flyx-vlc"));
    expect(path.basename(writes[0].file)).toMatch(/^flyx-[0-9a-f]{24}\.m3u$/);
    expect(writes[0].body).toContain("#EXTINF:-1,..\\..\\evil\n");
    expect(writes[0].body).toContain("#EXTVLCOPT:start-time=5");
    expect(openPath).toHaveBeenCalledWith(writes[0].file);
  });

  it("reports a clear error when neither VLC nor a playlist opener is available", async () => {
    const { launch } = await load();
    const result = await launch(
      { url: "http://127.0.0.1:3891/api/stream/proxy?url=x" },
      {
        platform: "linux",
        env: {},
        exists: () => false,
        execFile: () => {
          throw new Error("no which");
        },
        port: 3891,
      },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/FLYX_VLC_PATH/);
  });

  it("surfaces the OS error when the playlist cannot be opened", async () => {
    const { launch } = await load();
    const result = await launch(
      { url: "http://127.0.0.1:3891/api/livetv/playlist?ch=1", title: "T" },
      {
        platform: "linux",
        env: {},
        exists: () => false,
        execFile: () => {
          throw new Error("no which");
        },
        openPath: async () => "No application is associated",
        tempDir: "/tmp",
        mkdir: () => {},
        writeFile: () => {},
        port: 3891,
      },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/No application/);
  });
});
