# Flyx Desktop (Electron)

Flyx packaged as a single desktop application for Windows, macOS, and Linux.
The existing Next.js web UI runs unchanged inside an Electron window; Electron
spawns the standalone server with its own bundled Node (no system Node needed)
and keeps it serving on your local network even when the window is closed.

## How it works

```
Electron main (packages/desktop, CommonJS, no build step)
  ├─ main.js            single-instance lock, tray, window, env-watch restart
  ├─ preload.js         contextBridge: isDesktop, LAN URLs, restart events
  └─ src/               paths, env-store, server-manager, network, random, updater
            │ spawn (process.execPath + ELECTRON_RUN_AS_NODE=1)
            ▼
  <resources>/server/packages/app/server.js   (Next.js standalone build)
            │ binds 0.0.0.0 (LAN) or 127.0.0.1, port 3891 by default
            ▼
  Flyx web UI — unchanged
```

- **Config** lives in `$DATA_DIR/.env` (`%LOCALAPPDATA%\flyx` on Windows,
  `~/Library/Application Support/flyx` on macOS, `~/.local/share/flyx` on
  Linux). First launch pre-generates `JWT_SECRET` + `HOST_KEY` and defaults to
  LAN sharing (`HOSTNAME=0.0.0.0`); the web setup wizard adds your TMDB key
  and account. Logs: `$DATA_DIR/logs/flyx-server.log`.
- **Network mode** is toggled in Settings → Network (or by editing `HOSTNAME`
  in the `.env`). The main process watches `.env` and restarts the server when
  `HOSTNAME`/`PORT` change — the window shows "Restarting Flyx…" and reloads
  when the server is healthy again.
- **Closing the window hides to the tray**; the server keeps serving LAN
  clients. Quit from the tray menu to stop it (the child process is killed
  synchronously on quit — nothing lingers on port 3891).

## Auth model: master vs. LAN clients

The desktop window is the **instance master** — it never sees a login
screen, ever:

- On first boot the main process writes a random `FLYX_MASTER_TOKEN` into
  `$DATA_DIR/.env` (alongside `JWT_SECRET`) and injects it as the
  `flyx_master_token` cookie into the Electron session *before* the window
  loads. `isMasterRequest()` (server side) recognizes that cookie and
  `middleware.ts`/`api/auth/auto-login` sign the master in as the default
  account (or the first admin) with no credentials.
- The check is **cookie-based, not IP-based**: Host / `x-forwarded-for`
  headers are client-controlled and trivially spoofable over the LAN, so a
  header-based "localhost check" would let a LAN client mint an admin
  session. The master token only exists in the master's `.env` and the
  Electron window's cookie jar.
- **LAN browsers are ordinary clients**: they are always sent to `/login`
  and need an account. Accounts are created by the master (admin UI /
  HOST_KEY-protected registration); before the master creates any, a LAN
  visitor has nothing to log into — by design.
- The **setup wizard is master-only on desktop** (`/setup`,
  `/api/setup/*` return 403/redirect to non-master requests) — it writes the
  master's TMDB key and credentials, so it must never be reachable from the
  LAN.
- **The wizard runs until setup completes.** Saving writes
  `SETUP_COMPLETE=true` to `$DATA_DIR/.env` and creates the default admin
  account (first account only). Until that flag exists, `api/auth/auto-login`
  redirects the master to `/setup` instead of signing in, and a client-side
  `SetupGate` (Electron window only — it checks the `window.flyxDesktop`
  bridge) bounces an already-authenticated master back to the wizard too.
  So the master always answers the TMDB key + network-mode questions at
  least once — even when a default account already exists. Both gates read
  `SETUP_COMPLETE` via Node-runtime code (`auto-login` route, `/api/network`)
  because the Next middleware runs in the edge runtime, which never sees
  the `process.env` mutations the save route makes.
- The wizard (and the save route) require a username and a 4+ character
  password — saving without them used to make "Launch Flyx" loop back into
  the wizard, since auto-login had no credentials to create the default
  account with.
- The **account store (`store.json`) self-heals**: reads are shape-validated
  (a file that parses but isn't a store — e.g. truncated by a force-kill —
  is reset with a log line instead of throwing `TypeError`s that 500'd the
  save route), and writes are atomic (tmp + rename). The setup save never
  fails *after* the `.env` write: account-creation errors are logged and
  the save still returns ok, and auto-login re-creates the default account
  from the env credentials whenever the store has zero accounts.
- **Any `.env` change restarts the embedded server** (the desktop main
  watches the file). The edge runtime snapshots `process.env` at boot, so a
  restart is the only way the middleware and the Node route handlers ever
  agree on the environment. Without it, a `JWT_SECRET` generated at save
  time (data dirs whose `.env` older save routes had rewrote wholesale)
  was used by the Node signer but not the edge verifier, and the master
  looped between `/` and auto-login forever after finishing the wizard.
- At startup the desktop main also **heals missing secrets**
  (`ensureSecrets`): `JWT_SECRET`/`HOST_KEY` are regenerated into the
  `.env` before the server first spawns, same as the
  `FLYX_MASTER_TOKEN` migration — so a save never has to rotate secrets
  mid-flight.
- Logging out from the desktop window sets a 1-hour `flyx_master_logout`
  marker so the master can deliberately switch accounts without being
  instantly auto-signed-in again; a successful manual login clears it.
- CLI/hosted deployments (no `FLYX_DESKTOP`, no master token) keep the
  legacy "Just me" first-boot auto-create behavior.

## Development

Prerequisites: **Node ≥ 22.12** and npm 10+. (Electron's install script uses
`require(ESM)` internally, which only works on Node 22.12+. Older 22.x will
fail at `electron` postinstall with `ERR_REQUIRE_ESM`.)

```bash
npm ci
npm run desktop:dev      # builds .flyx-standalone/ then launches `electron .`
```

Unpackaged runs use `<repo>/.flyx-dev-data/` (gitignored) so development never
touches real user data.

```bash
npm run desktop:package  # build + electron-builder dist per current OS
npm run desktop:publish  # build + publish to GitHub Releases (v* tags)
npm run desktop:icons    # regenerate packages/desktop/build/icon.png
```

`electron` is pinned to an **exact** version (not a range) in
`packages/desktop/package.json` — electron-builder refuses ranges because it
downloads platform binaries for one specific release. Bump it together with
the package version on each release.

Packaging itself also needs Node ≥ 22.12 (`app-builder-lib` 26.15+ requires
ESM-only `@noble/hashes` 2.x from CommonJS). CI runs a recent Node 22, so
`dist` works there. On an older local Node, use
`npm run dist:local --workspace=@flyx/desktop` — `eb-node.cjs` re-runs
electron-builder under Electron's own bundled Node 24 (it also disables
Electron's asar fs patching and fixes yargs argv detection, both of which
break under `ELECTRON_RUN_AS_NODE`).

**Important**: `build-desktop.mjs` merges the standalone output's root
`node_modules` into `packages/app/node_modules`. electron-builder's
extraResources copier silently drops a *top-level* `node_modules` directory
(app-builder-lib's filter excludes it unconditionally) — only nested ones
survive. Without the merge, the packaged app crashes at startup with
`MODULE_NOT_FOUND` for `react`/`@next/env` even though the same tree runs
fine from the repo (Node walks up into the repo root `node_modules` there).
Always test the packaged exe, not just the repo copy.

Artifacts land in `packages/desktop/dist/`:
`Flyx-Setup-<version>.exe`, `Flyx-Portable-<version>.exe`, `.dmg`, `.AppImage`, `.deb`.

## Auto-updates

`electron-updater` checks GitHub Releases ~10s after startup and downloads
updates in the background; they install when the app quits ("Restart to
Update" in the tray). Active only when packaged **and** updatable:

| Artifact          | Auto-update |
| ----------------- | ----------- |
| Windows NSIS      | ✅ yes      |
| Windows portable  | ❌ no (no installer to replace) |
| macOS .dmg        | ❌ no (unsigned builds; requires codesigning) |
| Linux AppImage    | ✅ yes      |
| Linux .deb        | ✅ yes      |

The **desktop package version must bump in lockstep** with the app (tag +
`packages/desktop/package.json` `version`) or updater checks no-op.

## Code signing & OS warnings

v1 ships unsigned: Windows SmartScreen and macOS Gatekeeper will warn on first
launch. Also expect the **Windows firewall prompt** the first time the server
binds `0.0.0.0` — allow it on **private networks** (LAN sharing needs it;
public networks stay blocked).

## Known limitations

- **DLHD live TV**: its Python microservice (`dlhd_service.py`, port 9876) is
  not bundled with the desktop app. The Node fallback strategies (TLS-relaxed
  fetch, proxy rotation) are used instead; some DLHD channels may not play.
- **Payload size**: ~150–250 MB compressed (the full Next.js standalone tree,
  including sharp and @next/swc native binaries, shipped as `extraResources`).
- Changing network mode restarts the server — in-progress streams on other
  devices are interrupted (the UI shows "Restarting…" while it rebinds).

## Manual test procedure

1. `npm run desktop:dev` → setup wizard (master-only) → choose "Whole home
   network" → lands on home with no login.
2. Tray menu → "On your network" shows `http://<ip>:3891`; clicking copies it.
3. Phone on the same Wi-Fi: open that URL → redirected to `/login` (LAN
   clients always authenticate) → log in with an account the master created
   → browse and play a video (proves proxies + relative M3U8 rewrites work
   cross-device). Without credentials the phone must never reach content or
   the setup wizard.
4. Settings → Network: QR code renders; toggle sharing off → "Restarting…" →
   URL stops answering from the phone; toggle back on.
5. Packaged check: `Flyx-Portable-<version>.exe` → first run shows setup, no
   login ever → Quit from tray → `netstat -ano | findstr :3891` shows
   nothing listening.
6. Windows: verify the firewall prompt appears once, and that "private
   networks" allows the phone to connect.
