/**
 * Rules for values written to the Flyx data-dir .env (edge-safe, no imports).
 *
 * .env is parsed line-by-line with last-duplicate-wins, so a value that
 * contains a newline can smuggle in extra keys (e.g. a second JWT_SECRET).
 * And every key in .env is handed to the server process's environment, so
 * keys that change how Node/Electron start are code execution.
 *
 * Mirrored (keep in sync) in packages/cli/src/lib/env-file.js and
 * packages/desktop/src/env-store.js.
 */

/** Keys that can never be set through the app (process-level / loader control). */
const BLOCKED_KEY_PATTERNS: RegExp[] = [
  /^NODE_/i, // NODE_OPTIONS, NODE_PATH, NODE_EXTRA_CA_CERTS, NODE_TLS_REJECT_UNAUTHORIZED…
  /^ELECTRON_/i,
  /^npm_/i,
  /^LD_/i,
  /^DYLD_/i,
  /^(PATH|PATHEXT|COMSPEC|SYSTEMROOT|WINDIR|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMDATA|SHELL)$/i,
  /^(UV_THREADPOOL_SIZE|OPENSSL_CONF|SSL_CERT_FILE|SSL_CERT_DIR)$/i,
  /^FLYX_(FFMPEG_PATH|STANDALONE_DIR|DATA_DIR|VLC_PATH|UPDATE_REPO|SERVER_HOST)$/i,
];

export const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isBlockedEnvKey(key: string): boolean {
  return BLOCKED_KEY_PATTERNS.some((re) => re.test(key));
}

/** True if the value can be written to a KEY=VALUE line without injecting new lines. */
export function isSafeEnvValue(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return !/[\r\n\u0000]/.test(value);
}

/** Throws if key/value must not be written to .env. */
export function assertSafeEnvEntry(key: string, value: string): void {
  if (!ENV_KEY_RE.test(key)) throw new Error(`Invalid env key: ${key}`);
  if (isBlockedEnvKey(key)) throw new Error(`Env key ${key} cannot be set`);
  if (!isSafeEnvValue(value)) throw new Error(`Env value for ${key} contains a line break`);
}
