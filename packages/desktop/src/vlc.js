/**
 * Flyx Desktop — VLC launcher.
 *
 * The renderer asks (via IPC) to open a host stream URL in VLC on this
 * machine. We look for a VLC binary (FLYX_VLC_PATH override → PATH →
 * well-known install locations) and spawn it detached with the stream URL,
 * a window title and the resume position. When no binary is found we fall
 * back to writing an extended .m3u playlist and opening it with whatever
 * the OS associates with playlists — usually VLC when it is installed.
 *
 * All process/filesystem access is injectable so the logic is unit-testable.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

function candidatePaths(platform, env) {
  const e = env || process.env;
  if (platform === "win32") {
    const roots = [e.ProgramFiles, e["ProgramFiles(x86)"], e.ProgramW6432, e.LOCALAPPDATA]
      .filter(Boolean)
      .map((root) => path.join(root, "VideoLAN", "VLC", "vlc.exe"));
    roots.push("C:\\Program Files\\VideoLAN\\VLC\\vlc.exe");
    roots.push("C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe");
    return [...new Set(roots)];
  }
  if (platform === "darwin") {
    return [
      "/Applications/VLC.app/Contents/MacOS/VLC",
      path.join(os.homedir(), "Applications", "VLC.app", "Contents", "MacOS", "VLC"),
    ];
  }
  return [
    "/usr/bin/vlc",
    "/usr/local/bin/vlc",
    "/snap/bin/vlc",
    "/var/lib/flatpak/exports/bin/org.videolan.VLC",
    path.join(os.homedir(), ".local", "share", "flatpak", "exports", "bin", "org.videolan.VLC"),
  ];
}

/** Resolve `vlc` via PATH (`where` on Windows, `which` elsewhere). */
function lookupOnPath(platform, execFile) {
  const run = execFile || execFileSync;
  try {
    const out = run(platform === "win32" ? "where" : "which", ["vlc"], {
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      timeout: 3000,
    });
    const first = String(out || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return first || null;
  } catch {
    return null;
  }
}

/**
 * Find a VLC executable. Order: FLYX_VLC_PATH → PATH → known locations.
 * Returns null when nothing usable exists.
 */
function findVlc(deps = {}) {
  const platform = deps.platform || process.platform;
  const env = deps.env || process.env;
  const exists = deps.exists || ((p) => fs.existsSync(p));

  const override = env.FLYX_VLC_PATH && String(env.FLYX_VLC_PATH).trim();
  if (override && exists(override)) return override;

  const onPath = lookupOnPath(platform, deps.execFile);
  if (onPath && exists(onPath)) return onPath;

  for (const candidate of candidatePaths(platform, env)) {
    if (exists(candidate)) return candidate;
  }
  return null;
}

/** Command-line arguments for VLC. */
function buildArgs({ url, title, startTime }) {
  const args = [];
  if (title) args.push(`--meta-title=${String(title).replace(/[\r\n]+/g, " ")}`);
  const start = Math.floor(Number(startTime) || 0);
  if (start > 0) args.push(`--start-time=${start}`);
  args.push("--network-caching=3000");
  args.push("--", url);
  return args;
}

/** Extended M3U body VLC (and most players) open directly. */
function buildPlaylist({ url, title, startTime }) {
  const lines = ["#EXTM3U", `#EXTINF:-1,${String(title || "Flyx").replace(/[\r\n]+/g, " ")}`];
  const start = Math.floor(Number(startTime) || 0);
  lines.push("#EXTVLCOPT:network-caching=3000");
  if (start > 0) lines.push(`#EXTVLCOPT:start-time=${start}`);
  lines.push(url);
  return lines.join("\n") + "\n";
}

function writePlaylist(dir, title, body, writeFile) {
  const safe =
    String(title || "flyx-stream")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "flyx-stream";
  const file = path.join(dir, `${safe}.m3u`);
  (writeFile || fs.writeFileSync)(file, body, "utf8");
  return file;
}

function isHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\/\S+$/i.test(url);
}

/**
 * Open `url` in VLC. Resolves with { ok, method: "spawn" | "playlist", path?, error? }.
 * Never throws.
 */
async function launch(payload, deps = {}) {
  const url = payload && payload.url;
  if (!isHttpUrl(url)) {
    return { ok: false, error: "Stream URL must be http(s)" };
  }
  const title = (payload.title && String(payload.title)) || "Flyx";
  const startTime = payload.startTime;
  const log = deps.log || (() => {});
  const doSpawn = deps.spawn || spawn;

  const binary = findVlc(deps);
  if (binary) {
    try {
      const child = doSpawn(binary, buildArgs({ url, title, startTime }), {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      });
      if (child && typeof child.unref === "function") child.unref();
      log(`[vlc] launched ${binary}`);
      return { ok: true, method: "spawn", path: binary };
    } catch (err) {
      log(`[vlc] spawn failed: ${(err && err.message) || err}`);
      // fall through to playlist
    }
  } else {
    log("[vlc] no VLC binary found — falling back to playlist");
  }

  const openPath = deps.openPath;
  if (typeof openPath !== "function") {
    return {
      ok: false,
      method: "none",
      error: "VLC was not found on this computer. Install VLC or set FLYX_VLC_PATH.",
    };
  }
  try {
    const dir = deps.tempDir || os.tmpdir();
    const file = writePlaylist(dir, title, buildPlaylist({ url, title, startTime }), deps.writeFile);
    const failure = await openPath(file);
    if (failure) {
      return { ok: false, method: "playlist", path: file, error: String(failure) };
    }
    return { ok: true, method: "playlist", path: file };
  } catch (err) {
    return { ok: false, method: "playlist", error: String((err && err.message) || err) };
  }
}

module.exports = {
  candidatePaths,
  findVlc,
  buildArgs,
  buildPlaylist,
  writePlaylist,
  launch,
  isHttpUrl,
};
