/**
 * Generate packages/desktop/build/icon.png (512×512) from the web app's
 * favicon.svg. The PNG is committed to the repo so CI and electron-builder
 * never need sharp at build time (builder converts it to .ico/.icns).
 *
 * Usage: npm run desktop:icons
 */

import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FAVICON = join(ROOT, "packages", "app", "public", "favicon.svg");
const OUT_DIR = join(ROOT, "packages", "desktop", "build");
const OUT = join(OUT_DIR, "icon.png");

// Resolve sharp from the app workspace (it's an app dependency)
const require = createRequire(join(ROOT, "packages", "app", "package.json"));
const sharp = require("sharp");

if (!existsSync(FAVICON)) {
  console.error(`[desktop:icons] ERROR: favicon not found: ${FAVICON}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

await sharp(FAVICON)
  .resize(512, 512, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(OUT);

console.log(`[desktop:icons] Wrote ${OUT}`);
