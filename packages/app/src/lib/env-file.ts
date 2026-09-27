/**
 * Minimal read/update of $FLYX_DATA_DIR/.env for single settings.
 *
 * Only the target KEY=… line changes; comments, order and every other key
 * are kept. Writes are atomic (tmp + rename — the desktop app's .env
 * watcher fires on the rename and restarts the server) and owner-only,
 * since the file also holds JWT_SECRET.
 */

import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { assertSafeEnvEntry } from "@/lib/security/env-safety";

export function envFilePath(): string | null {
  const dir = process.env.FLYX_DATA_DIR;
  return dir ? join(dir, ".env") : null;
}

/** Value of `key` in the .env file (not the running environment), or null. */
export function readEnvVar(key: string): string | null {
  const file = envFilePath();
  if (!file || !existsSync(file)) return null;
  let value: string | null = null;
  for (const line of readFileSync(file, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq !== -1 && trimmed.slice(0, eq) === key) value = trimmed.slice(eq + 1);
  }
  return value;
}

/** Set `key` to `value`, or remove it when `value` is null. */
export function setEnvVar(key: string, value: string | null): void {
  const file = envFilePath();
  if (!file) throw new Error("FLYX_DATA_DIR is not set");
  if (value !== null) assertSafeEnvEntry(key, value);

  const lines = existsSync(file) ? readFileSync(file, "utf-8").split(/\r?\n/) : [];
  if (lines.length && lines[lines.length - 1] === "") lines.pop();

  let placed = false;
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const eq = trimmed.indexOf("=");
    const isKey = !trimmed.startsWith("#") && eq !== -1 && trimmed.slice(0, eq) === key;
    if (!isKey) {
      out.push(line);
    } else if (value !== null && !placed) {
      out.push(`${key}=${value}`);
      placed = true;
    }
  }
  if (value !== null && !placed) out.push(`${key}=${value}`);

  const tmp = file + ".tmp";
  try {
    unlinkSync(tmp); // `mode` only applies when the file is created
  } catch {
    /* no stale tmp */
  }
  writeFileSync(tmp, out.join("\n") + "\n", { encoding: "utf-8", mode: 0o600 });
  renameSync(tmp, file);
}
