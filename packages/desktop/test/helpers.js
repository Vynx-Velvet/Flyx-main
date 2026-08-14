/**
 * Test helper — module cache reset for the CJS src/ modules.
 *
 * vi.resetModules() clears vite-node's own cache, but src/*.js modules are
 * plain CommonJS executed natively, so require() calls *inside* them are
 * served from Node's require.cache — which vi.resetModules() does NOT clear.
 * Without this, each test file would see a second, stale copy of every
 * module loaded from within another module (e.g. env-store → paths).
 */

import { createRequire } from "module";
import path from "path";
import { vi } from "vitest";

const require = createRequire(import.meta.url);
const SRC_MARKER = path.join("packages", "desktop", "src") + path.sep;

export function resetDesktopModules() {
  vi.resetModules();
  for (const key of Object.keys(require.cache)) {
    if (key.includes(SRC_MARKER)) {
      delete require.cache[key];
    }
  }
}
