/**
 * Flyx Desktop — GitHub Releases updater.
 *
 * The manual "pull the latest build straight from GitHub" path that works
 * for BOTH the installer and the portable .exe (electron-updater only
 * handles the NSIS installer). Pure logic + plain Node networking live here
 * so the module is unit-testable without Electron; the Electron main process
 * owns the app/shell/dialog/quit wiring.
 *
 * Artifact names come from electron-builder.yml:
 *   win:   Flyx-Setup-<version>.exe  /  Flyx-Portable-<version>.exe
 *   mac:   Flyx-<version>.dmg
 *   linux: Flyx-<version>.AppImage   /  Flyx-<version>.deb
 */

const fs = require("fs");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const DEFAULT_REPO = process.env.FLYX_UPDATE_REPO || "Vynx-Velvet/Flyx-main";
const USER_AGENT = "flyx-desktop-updater";
const MAX_REDIRECTS = 5;

// ── Pure helpers (unit tested) ────────────────────────────────────

/** Strip a leading "v" and trim, e.g. "v3.0.3" -> "3.0.3". */
function normalizeVersion(v) {
  return String(v ?? "").trim().replace(/^v/i, "");
}

/** Parse the numeric major.minor.patch triple out of a version string. */
function parseVersion(v) {
  return normalizeVersion(v)
    .split(/[.-]/)
    .slice(0, 3)
    .map((n) => {
      const p = parseInt(n, 10);
      return Number.isFinite(p) ? p : 0;
    });
}

/**
 * Compare two version strings. Returns 1 if `a` is newer, -1 if older,
 * 0 if equal. Non-numeric segments are ignored.
 */
function compareVersions(a, b) {
  const A = parseVersion(a);
  const B = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    const x = A[i] || 0;
    const y = B[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** Pick the release asset that matches this build. */
function pickAsset(assets, { platform, portable }) {
  const list = Array.isArray(assets) ? assets : [];
  if (platform === "win32") {
    const re = portable ? /^Flyx-Portable-.*\.exe$/i : /^Flyx-Setup-.*\.exe$/i;
    return list.find((a) => re.test(a.name)) || null;
  }
  if (platform === "darwin") {
    return list.find((a) => /\.dmg$/i.test(a.name)) || null;
  }
  if (platform === "linux") {
    return (
      list.find((a) => /\.AppImage$/i.test(a.name)) ||
      list.find((a) => /\.deb$/i.test(a.name)) ||
      null
    );
  }
  return null;
}

// ── Networking ────────────────────────────────────────────────────

/** Core GET that follows redirects and resolves with the final response. */
function request(url, { headers = {}, redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) {
      reject(new Error("too many redirects"));
      return;
    }
    const mod = String(url).startsWith("https:") ? https : http;
    const req = mod.request(url, { method: "GET", headers }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        resolve(request(next, { headers, redirects: redirects + 1 }));
        return;
      }
      resolve(res);
    });
    req.setTimeout(30000, () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
    req.end();
  });
}

/** Fetch the latest non-prerelease release. Throws on network/HTTP error. */
async function fetchLatestRelease(repo = DEFAULT_REPO) {
  const url = `https://api.github.com/repos/${repo}/releases/latest`;
  const res = await request(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/vnd.github+json",
    },
  });
  const status = res.statusCode || 0;
  if (status >= 400) {
    res.resume();
    throw new Error(`GitHub API returned ${status}`);
  }
  const chunks = [];
  res.on("data", (c) => chunks.push(c));
  await new Promise((resolve, reject) => {
    res.on("end", resolve);
    res.on("error", reject);
  });
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch (err) {
    throw new Error(`invalid GitHub response: ${(err && err.message) || err}`);
  }
}

/**
 * Check whether a newer build exists on GitHub for this platform.
 * Never throws — resolves with `{ available: false, error }` on failure.
 */
async function checkForUpdate({
  repo = DEFAULT_REPO,
  currentVersion,
  platform = process.platform,
  portable = false,
}) {
  const current = normalizeVersion(currentVersion);
  try {
    const release = await fetchLatestRelease(repo);
    if (!release || release.draft || release.prerelease) {
      return { available: false, current, error: null };
    }
    const latest = normalizeVersion(release.tag_name);
    const asset = pickAsset(release.assets || [], { platform, portable });
    return {
      available: Boolean(asset) && compareVersions(latest, current) > 0,
      current,
      latest,
      tag: release.tag_name,
      notes: release.body || "",
      url: release.html_url || "",
      asset: asset ? asset.name : null,
      assetUrl: asset ? asset.browser_download_url : null,
      error: null,
    };
  } catch (err) {
    return {
      available: false,
      current,
      error: (err && err.message) || String(err),
    };
  }
}

/** Download `url` to `dest`, calling `onProgress({ received, total })`. */
function downloadToFile(url, dest, onProgress = () => {}) {
  return request(url, { headers: { "User-Agent": USER_AGENT } }).then((res) => {
    const status = res.statusCode || 0;
    if (status >= 400) {
      res.resume();
      return Promise.reject(new Error(`download failed (HTTP ${status})`));
    }
    const total = Number(res.headers["content-length"] || 0);
    let received = 0;
    const out = fs.createWriteStream(dest);
    return new Promise((resolve, reject) => {
      res.on("data", (c) => {
        received += c.length;
        onProgress({ received, total });
      });
      res.on("error", reject);
      out.on("error", reject);
      out.on("finish", () => resolve(dest));
      res.pipe(out);
    });
  });
}

module.exports = {
  DEFAULT_REPO,
  normalizeVersion,
  parseVersion,
  compareVersions,
  pickAsset,
  fetchLatestRelease,
  checkForUpdate,
  downloadToFile,
};
