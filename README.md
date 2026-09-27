# Flyx

Flyx is a self-hosted app for browsing movies, TV shows, anime, manga, live TV, and sports from third-party sources. Run it on your computer and use it there, or share it with devices on your home network.

The desktop app includes its own server. The CLI (command-line interface) runs the server from a terminal so you can use Flyx in a browser. Both need an internet connection for online catalogs and streams; source availability varies.

## Choose your setup

| What you want                                      | Start here                                      | Requirements                                                            |
| -------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| Install an app and follow on-screen instructions   | [Desktop installation](#desktop-installation)   | A compatible Windows, macOS, or Linux release; no Node.js or Git needed |
| Run Flyx from a terminal or on a headless computer | [CLI installation](#cli-installation)           | Node.js, npm, Git, and the source checkout                              |
| Watch from a phone, tablet, or another computer    | [Connect other devices](#connect-other-devices) | Flyx running on a host on the same network                              |
| Change the code or build an app                    | [Development](#development)                     | The source checkout and development tools                               |

**New to hosting?** Your _host_ is the computer running Flyx. Other devices connect through a browser. The host must stay on, awake, and connected while you use it from another device.

### In this guide

- [Get your TMDB API key](#get-your-tmdb-api-key)
- [Desktop: Windows](#windows-desktop), [macOS](#macos-desktop), [Linux](#linux-desktop)
- [Desktop first launch](#desktop-first-launch)
- [CLI installation](#cli-installation), [setup](#configure-and-start), and [commands](#cli-command-reference)
- [Using Flyx](#using-flyx) and [connecting devices](#connect-other-devices)
- [Updating Flyx](#updating-flyx)
- [Settings, data, and backups](#settings-data-and-backups)
- [Troubleshooting](#troubleshooting)
- [Development](#development) and [project documentation](#project-documentation)

## Get your TMDB API key

TMDB (The Movie Database) supplies movie and TV metadata: posters, descriptions, and search results. Its key is separate from your Flyx username and password.

1. Create an account at [TMDB](https://www.themoviedb.org/signup), or sign in.
2. Open your [TMDB API settings](https://www.themoviedb.org/settings/api).
3. Follow TMDB's API application process if you do not already have a key. Describe your actual use of Flyx.
4. Copy the **API key (v3 auth)**: a 32-character hexadecimal value.
5. Paste that key into Flyx's setup prompt.

Use the **API key**, rather than the much longer **API Read Access Token**. TMDB supports both authentication methods, but Flyx's CLI setup specifically validates the 32-character key. See [TMDB's authentication documentation](https://developer.themoviedb.org/docs/authentication-application).

The CLI lets you skip the key and add it later, but movie and TV metadata features need a valid key. Keep your key and configuration private.

## Desktop installation

Open [Flyx Releases](https://github.com/Vynx-Velvet/Flyx-main/releases), choose a release, and expand **Assets**. Download the file for your operating system. The **Source code** ZIP/TAR downloads are not app installers.

`<version>` below means the release number. Use the actual downloaded filename in commands. Check release notes for CPU architecture and compatibility, especially on Intel versus Apple silicon Macs and ARM Linux machines. Packaging explicitly targets Windows x64; a macOS or Linux filename alone does not identify its architecture.

### Windows desktop

1. Download `Flyx-Setup-<version>.exe`.
2. Open it and follow the installer. You can choose the installation folder.
3. Launch **Flyx** from the Start menu or its shortcut.
4. Continue with [first launch](#desktop-first-launch).

Builds do not currently use a Microsoft code-signing identity. If SmartScreen warns, verify that the file came from this project's release page before choosing **More info → Run anyway**, if available.

For a portable executable, download `Flyx-Portable-<version>.exe`, put it in a writable folder, and double-click it. It does not need installation, but **settings and accounts still live in your Windows user data folder**, not beside the EXE. Moving the EXE to another computer does not move your accounts.

If Windows asks about firewall access and you want home-network sharing, allow Flyx on **private networks**.

### macOS desktop

1. Download `Flyx-<version>.dmg` for a release compatible with your Mac.
2. Open it and drag **Flyx** into **Applications**.
3. Launch Flyx from Applications. You can eject the mounted DMG afterward.
4. Continue with [first launch](#desktop-first-launch).

The app is ad-hoc signed but not Apple-notarized. If macOS blocks it because the developer cannot be verified, confirm that it came from this project's release page. After trying to open it, go to **System Settings → Privacy & Security**, find the blocked-app notice, and choose **Open Anyway** if offered. Follow [Apple's app-opening instructions](https://support.apple.com/en-gb/102445) for your macOS version; do not disable Gatekeeper globally.

Approving an app does not fix an incompatible CPU architecture. Use a compatible release or [build from source](#build-the-desktop-app).

#### macOS “damaged” / “move to Trash” fix

If macOS says **“Flyx is damaged and can't be opened. You should move it to the Trash,”** follow these steps for your copy downloaded from this project's Releases page:

1. Copy **Flyx.app** into **Applications** first. Do not run the fix against the copy inside the mounted DMG.
2. Quit Flyx if it is running.
3. Open **Terminal** from **Applications → Utilities**, or press **Command+Space**, type `Terminal`, and press Return.
4. Paste this command and press Return:

   ```bash
   sudo xattr -cr /Applications/Flyx.app
   ```

5. Enter your **Mac login password** when prompted, then press Return. Terminal does not display characters as you type the password.
6. When the terminal prompt returns, reopen **Flyx** from Applications. Successful completion normally prints nothing.

This clears extended attributes, including download quarantine metadata, recursively from the Flyx app bundle. `sudo` runs the command with administrator permissions, `-c` clears attributes, and `-r` includes bundled files. See [Apple's `xattr` command source and usage](https://github.com/apple-oss-distributions/file_cmds/blob/main/xattr/xattr.c).

- **No such file:** confirm that **Flyx.app** is in **Applications**. If installed elsewhere, replace `/Applications/Flyx.app` with its actual path, enclosing it in quotes if it contains spaces.
- **Still blocked or damaged:** download a fresh compatible release. Removing quarantine cannot repair a corrupt download or an incompatible build.

You may need to repeat this for a newly downloaded version. The command targets only Flyx; it does not change system-wide Gatekeeper settings.

### Linux desktop

Choose **AppImage** for a standalone application file or **DEB** for a Debian/Ubuntu-based distribution. A graphical desktop session is required; use the CLI on a headless host.

**AppImage:**

1. Download `Flyx-<version>.AppImage` into a folder where you want to keep it.
2. Open the file's properties in your file manager and allow execution as a program.
3. Open the file to launch Flyx.

Alternatively, open a terminal in that folder and run these commands, replacing the filename:

```bash
chmod +x "Flyx-<version>.AppImage"
./Flyx-<version>.AppImage
```

If double-clicking does nothing, launch from a terminal to see the error. For a FUSE error, follow your distribution's AppImage/FUSE instructions or use the DEB on a compatible distribution.

**Debian / Ubuntu:** open the downloaded DEB in your software installer, or run this from its folder with the actual filename:

```bash
sudo apt install ./Flyx-<version>.deb
```

Launch **Flyx** from your applications menu. A DEB is not a package for every Linux distribution.

### Desktop first launch

The desktop wizard appears in this order:

1. **Welcome:** continue to setup.
2. **Network:** choose **Just this computer** or **Whole home network**. The first limits access to the host; the second allows other devices to connect.
3. **Account:** choose a username and password, with an optional display name. An account is required even for one viewer. The desktop wizard currently accepts four-character passwords; use a longer password and save it safely.
4. **TMDB:** enter your [API key](#get-your-tmdb-api-key), then save the configuration.
5. **Finish:** choose **Launch Flyx**. Saving can restart the embedded server; allow the window to reconnect.

The desktop window normally signs into the instance's default/admin account automatically. Browsers on other devices need account credentials. Complete this wizard in the desktop app itself; LAN visitors cannot configure the desktop host through it.

**Closing the window keeps Flyx running.** Reopen it from the tray/menu-bar icon. To stop the server completely, choose **Quit Flyx** from that icon's menu. This disconnects other devices too. Host sleep can interrupt playback even if Flyx has not been quit.

## CLI installation

The CLI is installed from this repository. Downloading the desktop app does not install a `flyx` terminal command.

### Prerequisites

Use **Node.js 22.12 or newer in the 22.x line**, **npm 10+**, and **Git**. Node 22 matches the desktop build workflow. Although the root package declares Node 20+, the full workspace includes Electron tooling that requires a newer runtime.

Get Node.js from [nodejs.org](https://nodejs.org/en/download) and Git from [git-scm.com](https://git-scm.com/downloads). Reopen your terminal after installing. Each command below should print a version:

```text
node --version
npm --version
git --version
```

Allow disk space for dependencies and the compiled app. Installation and the first build download dependencies and may take several minutes.

### Windows CLI

1. Install the prerequisites.
2. Open **Command Prompt** from Start. The following commands use Command Prompt syntax.
3. Run one line at a time, waiting for completion. Stop if a command fails.

```bat
cd /d "%USERPROFILE%"
git clone https://github.com/Vynx-Velvet/Flyx-main.git Flyx
cd Flyx
npm ci
```

If a `Flyx` folder already exists, choose another destination or use your existing checkout. Do not delete your work to repeat installation.

In PowerShell, replace the first line with `Set-Location $env:USERPROFILE`; the remaining commands also work. If PowerShell blocks `npm.ps1`, use `npm.cmd` instead of `npm`, or switch to Command Prompt. Continue with [configure and start](#configure-and-start).

### macOS CLI

Install Node.js and Git, then open **Terminal** from Applications → Utilities:

```bash
cd ~
git clone https://github.com/Vynx-Velvet/Flyx-main.git Flyx
cd Flyx
npm ci
```

If macOS prompts for command-line developer tools when running Git, complete that installation and retry. Run each command separately, then continue with setup below.

### Linux CLI

Install Git with your distribution's package manager and install Node.js 22.x using an installation method appropriate for your distribution. Check the versions above; the distribution's default Node package may be too old.

```bash
cd ~
git clone https://github.com/Vynx-Velvet/Flyx-main.git Flyx
cd Flyx
npm ci
```

Run commands as your normal user. A graphical desktop is not required: after enabling LAN access, use another device's browser.

### Configure and start

From the repository folder, run these **one at a time** on any OS:

```bash
npm run cli -- setup --no-start
npm run cli -- update --no-git
npm run cli -- start
```

The first opens the configuration wizard, the second builds the checked-out source, and the third launches it. Separating these steps also avoids a current first-run issue where a single `setup` process may not discover the build it just created.

The CLI wizard asks for:

1. **TMDB key:** enter the 32-character key, or skip to add it later.
2. **Account mode:** **Just Me** generates an account password; save it when displayed. **Family & Friends** asks for an admin username/password.
3. **Network:** localhost for this computer only, or LAN for other devices.
4. **Account details:** complete your chosen mode's prompts. Interactive shared setup requires a username of at least three characters and a password of at least eight.
5. **Review:** confirm configuration and account creation.

Account mode and network mode are separate choices. Private mode still creates an account; save its credentials for browser sign-in. The wizard generates an authentication secret and a host key for registration.

Once startup reports that the server is ready, open **http://localhost:3891**. The CLI prints the URL; it does not automatically open a browser. On a headless host, use its LAN address from another device.

Leave the terminal open in foreground mode. Press **Ctrl+C** to stop the server, or run `npm run cli -- stop` from a second terminal in the checkout.

### Make `flyx` a global command

This is optional. All commands work from the checkout as `npm run cli -- <command>` without global linking.

Windows:

```bat
npm run cli:link
flyx --help
```

macOS/Linux:

```bash
chmod +x packages/cli/cli.js
npm run cli:link
flyx --help
```

Once linked and on your terminal's PATH, `flyx` works outside the repository folder. Keep the checkout in place; the link points to it. If linking fails with a permissions error, use the repository-local command. In PowerShell, use `flyx.cmd` if the script shim is blocked.

The [Windows helper](scripts/setup-windows.bat) and [macOS/Linux helper](scripts/setup.sh) are alternative clone/install/link scripts. They require Node.js and Git already installed and print a next-step setup command; they do not complete the configuration wizard. The explicit instructions above make each stage easier to follow.

### CLI command reference

Without global linking, replace `flyx` below with `npm run cli --` from the checkout. For example: `npm run cli -- logs -n 100`.

| Command                                 | Purpose                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| `flyx --help`                           | List commands. Add `--help` to a subcommand for its options.                                |
| `flyx setup --no-start`                 | Configure without building or launching; prompts before overwriting existing configuration. |
| `flyx start`                            | Start in the foreground on port 3891.                                                       |
| `flyx start --port 3892`                | Choose a different port for this launch.                                                    |
| `flyx start --daemon`                   | Request background mode; see limitations below.                                             |
| `flyx stop`                             | Stop the CLI-tracked server. `--force` is available if normal stopping fails.               |
| `flyx restart`                          | Stop and start again; defaults to foreground mode.                                          |
| `flyx status`                           | Show tracked process status, health, and URLs; supports `--json`.                           |
| `flyx config`                           | Show saved settings with supported secrets masked.                                          |
| `flyx config set TMDB_API_KEY YOUR_KEY` | Save your actual TMDB key; restart afterward.                                               |
| `flyx config set HOSTNAME 0.0.0.0`      | Enable network listening after restart; use `127.0.0.1` for local-only.                     |
| `flyx logs -n 100`                      | Show the last 100 log lines.                                                                |
| `flyx logs --follow`                    | Follow new log output; Ctrl+C exits the log viewer.                                         |
| `flyx accounts list`                    | List accounts; supports `--json`.                                                           |
| `flyx accounts add alex`                | Create an account and prompt for a password; add `--admin` for admin access.                |
| `flyx accounts reset-password alex`     | Prompt for a new password; existing sessions remain valid until expiry.                     |
| `flyx accounts remove alex`             | Delete an account after confirmation; cannot remove the last admin.                         |
| `flyx update --no-git`                  | Rebuild the checkout without fetching/resetting source.                                     |
| `flyx update`                           | Update source and rebuild; read the [update caveat](#cli-updates).                          |
| `flyx reset`                            | Delete the selected instance's data after confirmation. Back up first.                      |

Account add/reset requires passwords of at least eight characters. Prefer password prompts over command arguments that remain in terminal history. Stop the server before CLI account edits because those commands directly modify the account store.

**Current CLI limitations:**

- `start` uses port 3891 unless passed `--port`; saving `PORT` with `config set` is insufficient. `restart` has no port option, so use `stop`, then `start --port 3892` for a custom port.
- Saved `HOSTNAME` takes precedence over `start --hostname`. Change the saved setting to change network mode reliably.
- `--daemon` does not fully detach the child and its log streams. Do not rely on it as an OS service or as a guarantee of survival after closing the terminal. Use foreground mode or configure a process supervisor for unattended hosting.
- CLI status/stop tracks CLI launches, not the Electron-owned server. Quit desktop Flyx through its tray menu.

## Using Flyx

After opening the desktop app or signing in through a browser:

1. **Find something:** browse a category or use Search. Open a title's details; for a series, select a season and episode.
2. **Play:** start playback and allow the source to load. Player controls include pause, seeking, volume, fullscreen, and available quality/subtitle options. Options depend on the stream.
3. **Try another source if needed:** a catalog entry does not guarantee a working stream. Use available provider/source choices, then try another title to distinguish a source failure from a connection problem.
4. **Save for later:** use Watchlist and return to the same account for saved items and viewing progress.
5. **Read or watch live:** manga and live content have dedicated sections. Live channels/events depend on upstream availability and schedules.

**Settings** includes Providers, Playback, Subtitles, Connect Devices, Security, Environment, Updates, and Downloads. Some actions require the host/admin account or desktop app.

For downloads, use the available download action and check **Downloads** for progress. Review the destination in **Settings → Downloads**. Jobs and downloaded files belong to the host, even when started from a phone. Keep the host running until they finish.

Where the player offers **VLC**, desktop integration can launch an installed VLC player. VLC is a separate application, and Flyx must remain running to supply the stream. Casting and external-player support depend on browser, device, and source; a TV browser may not play every stream a desktop can.

## Connect other devices

1. Start Flyx on the host.
2. On desktop, open **Settings → Connect Devices** and turn sharing on. On CLI, run `flyx config set HOSTNAME 0.0.0.0`, then stop and start.
3. Connect the other device to the same home network. Guest Wi-Fi may isolate devices.
4. Copy the address or scan the QR code in **Connect Devices**. Desktop's tray menu also lists network addresses; CLI users can inspect `flyx status`.
5. Open that address in the other device's browser and sign in. An example is `http://192.168.1.42:3891`; use your host's actual address.

`localhost` and `127.0.0.1` mean **the device you are currently using**. On your phone they point to the phone, not the host. `0.0.0.0` is a listening setting, not a browser address. Printed LAN URLs are only reachable if sharing is enabled and the firewall allows it.

Use an existing account or create another for each viewer. On a CLI host, use `flyx accounts add <username>` with the server stopped. Browser registration requires the instance's **host key**, separate from the TMDB key and user password. Share it only with people you want to allow to register.

Network-mode changes restart the desktop server and interrupt streams. Keep the host awake and check its address after changing networks. This guide covers home-network access; it does not configure public internet hosting or router port forwarding.

## Updating Flyx

### Desktop updates

Open **Settings → Updates → Check now**, then **Download & Install** if available. The tray menu also offers an update check. Complete any OS installer steps that open.

| Installation     | Update behavior                                                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows Setup    | Supports background checks and installation on quit after download. Manual updates can launch a new installer.                                                                    |
| Windows Portable | Manual GitHub flow downloads a new versioned EXE beside the current one and launches it. That folder must be writable.                                                            |
| macOS DMG        | Manual flow opens a downloaded DMG. Quit Flyx, copy the new app to Applications to replace the old copy, and reopen. Do not rely on unattended updating for these builds.         |
| Linux AppImage   | Can use the AppImage updater. Manual flow also makes its download executable and launches it. Keep a copy in your chosen app folder and update launchers pointing at older files. |
| Linux DEB        | Install the new DEB through your package manager to retain a DEB installation. The generic manual GitHub chooser currently prefers AppImage when both Linux formats exist.        |

If the check fails, get the matching file from [Releases](https://github.com/Vynx-Velvet/Flyx-main/releases) and repeat your installation steps. Normal app replacement does not require deleting your data folder. Back up before switching versions.

### CLI updates

For an unmodified installation checkout:

```bash
flyx stop
flyx update
flyx start
```

**`flyx update` resets the checkout to the selected remote branch.** It uses a hard reset rather than a merge-based pull. Accepting its discard prompt removes local changes and untracked files; local commits can also be displaced. Do not use it on a development checkout containing work you want to keep.

For a checkout you manage yourself, update through your normal Git workflow and install dependencies as needed, then:

```bash
flyx stop
flyx update --no-git
flyx start
```

`--no-git` still checks dependencies and rebuilds. Updating a running CLI server attempts to stop/restart it; a failed build can leave it stopped. Resolve the error before restarting. Reapply a custom `--port` on startup.

## Settings, data, and backups

### Data locations

Packaged desktop and CLI installations use the same default data folder for the same OS user:

| OS      | Folder                               | Open it                                                      |
| ------- | ------------------------------------ | ------------------------------------------------------------ |
| Windows | `%LOCALAPPDATA%\flyx`                | Paste into File Explorer's address bar.                      |
| macOS   | `~/Library/Application Support/flyx` | Finder → Go → Go to Folder, then paste.                      |
| Linux   | `~/.local/share/flyx`                | Enter in the file manager; show hidden folders if necessary. |

This includes `.env` configuration, `store.json` account/application data, and `logs/flyx-server.log`. CLI process state is stored here too. Downloaded media can use a separate destination; check Download settings.

**Do not run desktop and CLI against the same data folder simultaneously.** They also share a default port. Quit one before using the other. For separate instances, set the process environment variable `FLYX_DATA_DIR` to another absolute directory before launch and choose another port. Use that same environment setting for every CLI management command.

The CLI wizard writes `<data-folder>/.env`, **not the repository root `.env`**. Desktop development uses `<repo>/.flyx-dev-data/`. Web development has its own configuration below.

### Configuration reference

On desktop, use the applicable Settings screen. On CLI, use `flyx config` and `flyx config set KEY VALUE`, then stop/start. Desktop watches its `.env` and restarts after changes.

| Setting           | Meaning                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `TMDB_API_KEY`    | TMDB v3 API key for metadata.                                                               |
| `JWT_SECRET`      | Generated authentication signing secret; keep private and stable.                           |
| `HOST_KEY`        | Generated key required for account registration.                                            |
| `HOSTNAME`        | `127.0.0.1` for this computer, `0.0.0.0` for network listening.                             |
| `PORT`            | Desktop listening port, normally 3891. CLI requires `start --port` to override 3891.        |
| `FLYX_NO_BROWSER` | `true` disables browser/Puppeteer extraction fallbacks; may affect sources.                 |
| `FLYX_DATA_DIR`   | Process environment override for the data folder; set before launch, not with `config set`. |
| `FLYX_ALLOWED_HOSTS` | Comma-separated host names allowed to reach Flyx besides IPs, `localhost`, `*.local` and bare machine names — e.g. a reverse-proxy domain or `mybox.tailnet.ts.net`. Other names get "unrecognized host" (403). |

Desktop also manages its master token and setup-complete flag; leave those to the app. `flyx config --show-secrets` reveals sensitive settings, so do not post its output in issues.

The local account store is `store.json`; local desktop/CLI setup does not require an external database or cloud service account.

### Back up, restore, and uninstall

1. Quit desktop Flyx or stop the CLI server.
2. Copy the entire data folder to a safe location, including hidden files such as `.env`.
3. Back up downloaded media separately if stored outside that folder.

To restore, stop Flyx and restore the saved folder to the same location (or configured `FLYX_DATA_DIR`) before starting. Backups can contain credentials and authentication secrets; keep them private.

Uninstall Windows Flyx through Installed apps, remove the macOS app from Applications, remove a Linux DEB with its package manager, or delete a portable/AppImage executable after quitting. Removing the executable is separate from removing personal data. Keep your data folder to preserve it for reinstallation.

`flyx reset` deletes the files Flyx created in the selected data directory (settings, accounts, logs, downloads list) and leaves anything else in place. It refuses to run on a folder that doesn't look like a Flyx data folder, a drive root, or your home folder. `--keep-env` preserves only `.env`, not accounts or other data. Reset is a destructive fresh start, not a routine troubleshooting step. Quit the desktop app and back up first.

## Troubleshooting

| Problem                                                     | What to try                                                                                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node/npm/Git not recognized                                 | Install prerequisites, reopen the terminal, and check version commands.                                                                                     |
| `flyx` not recognized or linking fails                      | Use `npm run cli -- <command>` from the checkout. PowerShell users can use `npm.cmd` / `flyx.cmd` for blocked script shims.                                 |
| Electron install reports `ERR_REQUIRE_ESM`                  | Check Node's version; use Node 22.12+ in the 22.x line and rerun `npm ci`.                                                                                  |
| Missing Lightning CSS/Tailwind native module on macOS/Linux | Use the platform-native dependency workaround in [development](#development).                                                                               |
| `Server build not found`                                    | Run `npm run cli -- update --no-git`, wait for success, then run `npm run cli -- start` as a new command.                                                   |
| Build fails                                                 | Read the first build error. Configuration and accounts are separate from compilation; do not reset them to fix a dependency/compiler error.                 |
| Port 3891 already in use                                    | Quit desktop Flyx or stop the existing CLI instance. For a separate instance, use `start --port 3892` and that port in your URL.                            |
| Window closes but server remains                            | Choose **Quit Flyx** in the tray menu to stop it.                                                                                                           |
| Phone cannot connect                                        | Check sharing, current LAN address, host sleep, private-network firewall access, guest Wi-Fi isolation, and VPN settings blocking LAN access.               |
| Posters/search fail or TMDB key rejected                    | Use the 32-character API key, check host access to TMDB, and restart CLI after saving a correction.                                                         |
| Desktop setup loops                                         | Complete all screens with a username/password, allow the restart, then quit/reopen and inspect logs if it continues.                                        |
| CLI password lost                                           | Stop the server, run `flyx accounts reset-password <username>`, then restart and sign in.                                                                   |
| Browsing works but playback fails                           | Try another source/title. Upstream availability and device codec support vary; some live-TV extraction paths use a Python service not bundled with desktop. |
| Desktop update check fails                                  | Download the matching release asset manually. GitHub connectivity/rate limits or absent compatible assets can prevent updates.                              |

CLI logs: `flyx logs -n 100`. Desktop logs: `logs/flyx-server.log` in the data folder. If startup reports a different port, use that port rather than assuming 3891.

When [reporting an issue](https://github.com/Vynx-Velvet/Flyx-main/issues), include OS, CPU architecture, Flyx release, installation type, exact steps, and relevant error/log excerpts. Remove passwords, keys, tokens, and private details before posting.

## Development

Use the CLI prerequisites and clone/install instructions above. Run commands from the repository root unless stated otherwise.

### Web app with live reload

Next.js runs in `packages/app`. Create `packages/app/.env.local` for development configuration.

Windows PowerShell:

```powershell
Copy-Item .env.example packages/app/.env.local
```

macOS/Linux:

```bash
cp .env.example packages/app/.env.local
```

Edit that file: set your TMDB key, a random JWT secret of at least 32 characters, and a host key if you need registration. Generate a random secret with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Start the app:

```bash
npm run dev -- --hostname 127.0.0.1
```

Open Next.js's printed URL, normally `http://localhost:3000`. This development server has different port/environment loading from desktop/CLI. Stop with Ctrl+C. Without `FLYX_DATA_DIR`, local account data lives in `.flyx` under the working directory (`packages/app` for this launcher).

**macOS/Linux native dependencies:** desktop CI applies this workaround after `npm ci` because the lockfile may omit platform-specific optional dependencies:

```bash
npm install --no-save --ignore-scripts lightningcss@1.32.0 @tailwindcss/oxide@4.3.3
```

Use it for the corresponding native-module error. Versions match the checked-in workflow; keep them aligned when upgrading dependencies.

### Build the desktop app

```bash
npm run desktop:dev
```

This builds the embedded server and launches Electron. Development data lives in `.flyx-dev-data/`, separate from packaged app data.

To package for your current OS:

```bash
npm run desktop:package
```

Output goes to `packages/desktop/dist/`. Cross-platform releases use separate Windows, macOS, and Linux runners. A local build does not establish compatibility with every OS/architecture. See [desktop internals and manual testing](docs/desktop.md).

### Development commands

| Command                    | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `npm run dev`              | Run the web app development server.                |
| `npm run dev:all`          | Run workspace development tasks through Turborepo. |
| `npm run build`            | Run workspace production builds.                   |
| `npm run build:standalone` | Produce `.flyx-standalone/` for server launchers.  |
| `npm test`                 | Run Vitest.                                        |
| `npm run type-check`       | Run workspace TypeScript checks.                   |
| `npm run lint`             | Run ESLint.                                        |
| `npm run test:e2e:reader`  | Run the manga reader Playwright suite.             |

Next.js builds currently skip TypeScript validation, so build success does not replace `npm run type-check`.

### Docker and Cloudflare

The repository contains deployment files, but they are not complete beginner setup paths for this checkout. The Docker image runs as a non-root user, keeps its data in the `/data` volume, and generates its own `JWT_SECRET`/`HOST_KEY` on first start; Compose publishes it on `127.0.0.1:3000` only. Treat Docker as experimental — the image has not been verified end-to-end yet.

`deploy:cloudflare` and `deploy:landing` require their respective hosting configuration and credentials; they are not local setup commands. Use desktop or CLI for the local installation covered here.

## Project documentation

Flyx is an npm-workspace/Turborepo monorepo. `packages/app` contains the Next.js UI/server, `packages/desktop` contains Electron, and `packages/cli` contains management commands. Other packages provide configuration, providers, extraction, player components, database adapters, sync, shared UI, and admin functionality.

- [Architecture](ARCHITECTURE.md)
- [Contributor guide](CONTRIBUTING.md)
- [Desktop implementation and packaging](docs/desktop.md)
- [Architecture decisions](docs/DECISIONS/)
- [Provider API](docs/api/providers.md)
- [Player hooks](docs/player/hooks.md)

This README describes setup in the current checkout. Some older supporting guides describe earlier UI/setup behavior; use the steps here for installation.

Self-hosting gives you control over the local instance and its stored data. Flyx still connects to TMDB, streaming providers, and upstream services; self-hosting does not make those requests anonymous.
