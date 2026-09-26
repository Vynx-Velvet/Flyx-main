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

describe("vlc.launch", () => {
  it("rejects non-http URLs", async () => {
    const { launch } = await load();
    const result = await launch({ url: "file:///etc/passwd" }, { exists: () => false });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/http/);
  });

  it("spawns VLC detached when a binary is found", async () => {
    const { launch } = await load();
    const unref = vi.fn();
    const spawn = vi.fn(() => ({ unref }));
    const result = await launch(
      { url: "http://host:3891/api/stream/proxy?url=a", title: "T", startTime: 10 },
      {
        platform: "linux",
        env: { FLYX_VLC_PATH: "/usr/bin/vlc" },
        exists: (p) => p === "/usr/bin/vlc",
        spawn,
      },
    );
    expect(result).toEqual({ ok: true, method: "spawn", path: "/usr/bin/vlc" });
    expect(spawn).toHaveBeenCalledTimes(1);
    const [bin, args, opts] = spawn.mock.calls[0];
    expect(bin).toBe("/usr/bin/vlc");
    expect(args.at(-1)).toBe("http://host:3891/api/stream/proxy?url=a");
    expect(opts.detached).toBe(true);
    expect(unref).toHaveBeenCalled();
  });

  it("falls back to a playlist opened by the OS when no VLC is installed", async () => {
    const { launch } = await load();
    const writes = [];
    const openPath = vi.fn(async () => "");
    const result = await launch(
      { url: "http://host:3891/api/stream/proxy?url=a", title: "My: Show", startTime: 5 },
      {
        platform: "win32",
        env: {},
        exists: () => false,
        execFile: () => {
          throw new Error("no where");
        },
        openPath,
        tempDir: "C:\\tmp",
        writeFile: (file, body) => writes.push({ file, body }),
      },
    );
    expect(result.ok).toBe(true);
    expect(result.method).toBe("playlist");
    expect(writes).toHaveLength(1);
    expect(writes[0].file).toBe(path.join("C:\\tmp", "My Show.m3u"));
    expect(writes[0].body).toContain("#EXTVLCOPT:start-time=5");
    expect(openPath).toHaveBeenCalledWith(writes[0].file);
  });

  it("reports a clear error when neither VLC nor a playlist opener is available", async () => {
    const { launch } = await load();
    const result = await launch(
      { url: "http://host/x" },
      {
        platform: "linux",
        env: {},
        exists: () => false,
        execFile: () => {
          throw new Error("no which");
        },
      },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/FLYX_VLC_PATH/);
  });

  it("surfaces the OS error when the playlist cannot be opened", async () => {
    const { launch } = await load();
    const result = await launch(
      { url: "http://host/x", title: "T" },
      {
        platform: "linux",
        env: {},
        exists: () => false,
        execFile: () => {
          throw new Error("no which");
        },
        openPath: async () => "No application is associated",
        tempDir: "/tmp",
        writeFile: () => {},
      },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/No application/);
  });
});
