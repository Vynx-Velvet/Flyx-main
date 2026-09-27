/**
 * Flyx Desktop — Window / IPC trust rules.
 *
 * The desktop window is the only client that gets the master cookie and the
 * preload bridge, so everything here pins it to ONE origin:
 * http://127.0.0.1:<port>. Never "localhost" — Chromium may resolve that to
 * [::1], where any local process could be listening on the same port.
 *
 * Pure functions (no Electron imports) so the rules are unit-testable.
 */

const APP_HOST = "127.0.0.1";

/** The one origin the desktop window is allowed to be on. */
function appOrigin(port) {
  return `http://${APP_HOST}:${port}`;
}

function parseUrl(url) {
  try {
    return new URL(String(url));
  } catch {
    return null;
  }
}

/** True when `url` is on the app origin (exact scheme + host + port). */
function isAppUrl(url, port) {
  const u = parseUrl(url);
  return Boolean(u) && u.origin === appOrigin(port);
}

/**
 * IPC sender check: the invoking frame must be on the app origin. A
 * destroyed/navigated frame (senderFrame null) is never trusted.
 */
function isTrustedSender(event, port) {
  const frame = event && event.senderFrame;
  const url = frame && frame.url;
  if (!url) return false;
  return isAppUrl(url, port);
}

// Loopback spellings of our own server that must be re-pinned to 127.0.0.1
// (a redirect built from HOSTNAME=0.0.0.0 or a "localhost" link).
const LOOPBACK_ALIASES = new Set(["localhost", "0.0.0.0", "[::1]", "127.0.0.1"]);

/**
 * Decide what to do with a navigation / redirect / window.open in the main
 * window.
 *
 * @returns {{action: "allow"} | {action: "rewrite", url: string} |
 *           {action: "external", url: string} | {action: "block"}}
 */
function classifyNavigation(url, port, { allowExact = [] } = {}) {
  if (allowExact.includes(url)) return { action: "allow" };
  const u = parseUrl(url);
  if (!u) return { action: "block" };
  if (u.origin === appOrigin(port)) return { action: "allow" };
  if (
    u.protocol === "http:" &&
    LOOPBACK_ALIASES.has(u.hostname) &&
    u.port === String(port)
  ) {
    return {
      action: "rewrite",
      url: `${appOrigin(port)}${u.pathname}${u.search}${u.hash}`,
    };
  }
  // Only ever hand https links to the OS — never file:, smb:, custom
  // protocol handlers or plain http.
  if (u.protocol === "https:") return { action: "external", url: u.toString() };
  return { action: "block" };
}

/**
 * Permissions the web app actually uses:
 *  - fullscreen: players + manga reader + YouTube trailer iframes
 *  - clipboard-sanitized-write: "copy link" buttons (navigator.clipboard.writeText)
 *  - mediaKeySystem: YouTube trailer iframes declare allow="encrypted-media"
 * Everything else (camera/mic, geolocation, notifications, MIDI, HID,
 * serial, clipboard-read, openExternal, …) is denied.
 */
const ALLOWED_PERMISSIONS = new Set([
  "fullscreen",
  "clipboard-sanitized-write",
  "mediaKeySystem",
]);

/**
 * @param {string} permission
 * @param {{topUrl?: string, port: number}} ctx  topUrl = the window's
 *   top-level URL (the requesting frame may be a trailer iframe)
 */
function isPermissionAllowed(permission, { topUrl, port } = {}) {
  if (!ALLOWED_PERMISSIONS.has(permission)) return false;
  return isAppUrl(topUrl, port);
}

/** Drop query string + fragment (signed tokens, upstream URLs) before logging. */
function stripQuery(url) {
  const s = String(url || "");
  const cut = s.search(/[?#]/);
  return cut === -1 ? s : `${s.slice(0, cut)}?…`;
}

/** Strip query strings from every http(s) URL inside a free-form log message. */
function redactUrls(message) {
  return String(message || "").replace(
    /(https?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/gi,
    "$1?…",
  );
}

module.exports = {
  APP_HOST,
  appOrigin,
  isAppUrl,
  isTrustedSender,
  classifyNavigation,
  isPermissionAllowed,
  ALLOWED_PERMISSIONS,
  stripQuery,
  redactUrls,
};
