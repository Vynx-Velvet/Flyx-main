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
 *
 * Integrity: nothing downloaded here is ever launched unverified. The
 * expected hash comes from the release's electron-builder metadata
 * (latest.yml / latest-mac.yml / latest-linux.yml: `files[].sha512`, base64,
 * plus `size`); for an asset those files don't list (the portable .exe —
 * electron-builder only writes update info for the NSIS target) we fall
 * back to the sha256 `digest` GitHub itself computes for every release
 * asset. No expected hash → no install. All traffic is https-only,
 * including every redirect hop.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");
const { URL } = require("url");

const DEFAULT_REPO = process.env.FLYX_UPDATE_REPO || "Vynx-Velvet/Flyx-main";
const USER_AGENT = "flyx-desktop-updater";
const MAX_REDIRECTS = 5;
const MAX_METADATA_BYTES = 1024 * 1024;

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

/** electron-builder update-info files published next to the artifacts. */
function isUpdateMetadataName(name) {
  return /^latest(-[a-z0-9]+)*\.yml$/i.test(String(name || ""));
}

// ── Update metadata (latest*.yml) ─────────────────────────────────

function unquoteYaml(v) {
  const s = String(v).trim();
  if (s.length >= 2 && ((s[0] === "'" && s.endsWith("'")) || (s[0] === '"' && s.endsWith('"')))) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Minimal parser for the fixed shape electron-builder writes:
 *
 *   version: 3.1.0
 *   files:
 *     - url: Flyx-Setup-3.1.0.exe
 *       sha512: <base64>
 *       size: 130688955
 *   path: Flyx-Setup-3.1.0.exe
 *   sha512: <base64>
 *
 * @returns {{ files: Array<{url?: string, sha512?: string, size?: number}>, path?: string, sha512?: string, version?: string }}
 */
function parseUpdateYmlMinimal(text) {
  const out = { files: [] };
  let inFiles = false;
  let current = null;
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    let line = rawLine.trim();
    if (indent === 0) {
      inFiles = false;
      current = null;
      const m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
      if (!m) continue;
      if (m[1] === "files" && !m[2]) {
        inFiles = true;
        continue;
      }
      out[m[1]] = unquoteYaml(m[2]);
      continue;
    }
    if (!inFiles) continue;
    if (line.startsWith("- ")) {
      current = {};
      out.files.push(current);
      line = line.slice(2).trim();
    }
    if (!current) continue;
    const m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (m) current[m[1]] = unquoteYaml(m[2]);
  }
  for (const f of out.files) {
    if (f.size !== undefined) f.size = Number(f.size);
  }
  return out;
}

/** Parse latest*.yml — js-yaml when present (electron-updater ships it), else the minimal parser. */
function parseUpdateYml(text) {
  try {
    const yaml = require("js-yaml");
    const doc = yaml.load(String(text || ""));
    if (doc && typeof doc === "object") {
      return { ...doc, files: Array.isArray(doc.files) ? doc.files : [] };
    }
  } catch {
    /* not installed / unparsable — fall through */
  }
  return parseUpdateYmlMinimal(text);
}

function urlBaseName(u) {
  const s = String(u || "");
  try {
    return decodeURIComponent(path.posix.basename(new URL(s, "https://x/").pathname));
  } catch {
    return path.posix.basename(s);
  }
}

/**
 * Find the expected hash for `assetName`.
 *
 * @param {{ assetName: string, metadataTexts?: string[], assetDigest?: string|null, assetSize?: number|null }} opts
 * @returns {{ algorithm: "sha512"|"sha256", encoding: "base64"|"hex", digest: string, size: number|null, source: string } | null}
 */
function expectedChecksum({ assetName, metadataTexts = [], assetDigest = null, assetSize = null }) {
  for (const text of metadataTexts) {
    const info = parseUpdateYml(text);
    const entry = (info.files || []).find(
      (f) => f && urlBaseName(f.url) === assetName && typeof f.sha512 === "string" && f.sha512,
    );
    if (entry) {
      const size = Number(entry.size);
      return {
        algorithm: "sha512",
        encoding: "base64",
        digest: String(entry.sha512).trim(),
        size: Number.isFinite(size) && size > 0 ? size : null,
        source: "latest.yml",
      };
    }
    if (info.path && urlBaseName(info.path) === assetName && typeof info.sha512 === "string" && info.sha512) {
      return {
        algorithm: "sha512",
        encoding: "base64",
        digest: info.sha512.trim(),
        size: null,
        source: "latest.yml",
      };
    }
  }
  const m = /^sha256:([0-9a-f]{64})$/i.exec(String(assetDigest || "").trim());
  if (m) {
    const size = Number(assetSize);
    return {
      algorithm: "sha256",
      encoding: "hex",
      digest: m[1].toLowerCase(),
      size: Number.isFinite(size) && size > 0 ? size : null,
      source: "github-digest",
    };
  }
  return null;
}

/** Hash a file on disk. */
function hashFile(file, algorithm = "sha512", encoding = "base64") {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(file);
    stream.on("error", reject);
    stream.on("data", (c) => hash.update(c));
    stream.on("end", () => resolve(hash.digest(encoding)));
  });
}

/**
 * Verify a downloaded file against an expected checksum.
 * Never throws — resolves { ok, error? }.
 */
async function verifyFile(file, expected) {
  if (!expected || !expected.digest) {
    return { ok: false, error: "No published checksum for this download — refusing to install it." };
  }
  try {
    const { size } = fs.statSync(file);
    if (expected.size && size !== expected.size) {
      return { ok: false, error: `Download size mismatch (${size} bytes, expected ${expected.size}).` };
    }
    const actual = await hashFile(file, expected.algorithm, expected.encoding);
    const a = Buffer.from(actual);
    const b = Buffer.from(expected.encoding === "hex" ? expected.digest.toLowerCase() : expected.digest);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, error: "Download checksum mismatch — the file was corrupted or tampered with." };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Could not verify download: ${(err && err.message) || err}` };
  }
}

/**
 * Fetch the release metadata, work out the expected checksum for the
 * downloaded asset and verify `file` against it.
 *
 * @param {{ file: string, assetName: string, metadataUrls?: string[], assetDigest?: string|null, assetSize?: number|null, fetchText?: (url: string) => Promise<string> }} opts
 */
async function verifyDownload({ file, assetName, metadataUrls = [], assetDigest = null, assetSize = null, fetchText: fetchImpl = fetchText }) {
  const metadataTexts = [];
  for (const url of metadataUrls) {
    try {
      metadataTexts.push(await fetchImpl(url));
    } catch {
      /* a missing/unreachable metadata file just can't vouch for anything */
    }
  }
  const expected = expectedChecksum({ assetName, metadataTexts, assetDigest, assetSize });
  const result = await verifyFile(file, expected);
  return { ...result, source: expected ? expected.source : null };
}

// ── Portable hand-off record ──────────────────────────────────────

/**
 * A portable self-update downloads Flyx-Portable-<new>.exe next to the
 * running exe, records { oldExe, newExe } and relaunches. The NEW build then
 * deletes exactly `oldExe` — never a directory sweep.
 *
 * @returns {string|null} the path to delete, or null
 */
function planPortableCleanup(record, currentExe) {
  if (!record || typeof record !== "object") return null;
  const { oldExe, newExe } = record;
  if (typeof oldExe !== "string" || typeof newExe !== "string" || !currentExe) return null;
  const norm = (p) => path.resolve(p).toLowerCase();
  // Only the build we handed off to cleans up, and never itself.
  if (norm(newExe) !== norm(currentExe)) return null;
  if (norm(oldExe) === norm(currentExe)) return null;
  if (!/^Flyx-Portable-.*\.exe$/i.test(path.basename(oldExe))) return null;
  // Same folder the new build lives in — the updater never writes elsewhere.
  if (norm(path.dirname(oldExe)) !== norm(path.dirname(currentExe))) return null;
  return oldExe;
}

// ── Networking ────────────────────────────────────────────────────

/**
 * Core GET that follows redirects and resolves with the final response.
 * https only — the first URL and every redirect hop (an https→http
 * downgrade would let anyone on the path swap the download).
 */
function request(url, { headers = {}, redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (redirects > MAX_REDIRECTS) {
      reject(new Error("too many redirects"));
      return;
    }
    let parsed;
    try {
      parsed = new URL(String(url));
    } catch {
      reject(new Error("invalid update URL"));
      return;
    }
    if (parsed.protocol !== "https:") {
      reject(new Error(`refusing non-https update URL (${parsed.protocol})`));
      return;
    }
    const req = https.request(parsed, { method: "GET", headers }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        let next;
        try {
          next = new URL(res.headers.location, parsed).toString();
        } catch {
          reject(new Error("invalid redirect"));
          return;
        }
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

/** GET a small text file (release metadata). */
async function fetchText(url) {
  const res = await request(url, { headers: { "User-Agent": USER_AGENT } });
  const status = res.statusCode || 0;
  if (status >= 400) {
    res.resume();
    throw new Error(`HTTP ${status}`);
  }
  const chunks = [];
  let size = 0;
  await new Promise((resolve, reject) => {
    res.on("data", (c) => {
      size += c.length;
      if (size > MAX_METADATA_BYTES) {
        res.destroy(new Error("metadata too large"));
        return;
      }
      chunks.push(c);
    });
    res.on("end", resolve);
    res.on("error", reject);
  });
  return Buffer.concat(chunks).toString("utf-8");
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
    const assets = release.assets || [];
    const asset = pickAsset(assets, { platform, portable });
    return {
      available: Boolean(asset) && compareVersions(latest, current) > 0,
      current,
      latest,
      tag: release.tag_name,
      notes: release.body || "",
      url: release.html_url || "",
      asset: asset ? asset.name : null,
      assetUrl: asset ? asset.browser_download_url : null,
      assetSize: asset && Number.isFinite(asset.size) ? asset.size : null,
      assetDigest: asset && typeof asset.digest === "string" ? asset.digest : null,
      metadataUrls: assets
        .filter((a) => a && isUpdateMetadataName(a.name) && a.browser_download_url)
        .map((a) => a.browser_download_url),
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
  isUpdateMetadataName,
  parseUpdateYml,
  parseUpdateYmlMinimal,
  expectedChecksum,
  hashFile,
  verifyFile,
  verifyDownload,
  planPortableCleanup,
  request,
  fetchText,
  fetchLatestRelease,
  checkForUpdate,
  downloadToFile,
};
