# Flyx 3.0

**Privacy-first streaming.** No ads. No tracking. No bullshit.

Flyx aggregates movies, TV shows, anime, manga, live TV (850+ channels), live sports, and PPV events from free streaming sources. You host it. You own it. No third party sees what you watch — or even that the app is running.

> **Flyx 3.0** is a ground-up architectural rebuild of Flyx 2.0 into a Turborepo monorepo. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design rationale and [docs/DECISIONS/](./docs/DECISIONS/) for architecture decision records.

## Quick Start

You don't need to be a developer. If you can copy-paste into a terminal, you can run Flyx. Takes 5 minutes.

**Requirements:** Node.js 20+ and npm ([download here](https://nodejs.org)), git ([download here](https://git-scm.com))

### One-click setup (recommended)

| Platform | Command |
|---|---|
| **Windows** | Download [`scripts\setup-windows.bat`](scripts/setup-windows.bat) → double-click it |
| **macOS / Linux** | `curl -fsSL https://raw.githubusercontent.com/Vynx-Velvet/Flyx-main/master/scripts/setup.sh \| bash` |

The script installs everything, links the CLI, and drops you at `flyx setup`.

### Manual setup

```bash
# 1. Clone the repo
git clone https://github.com/Vynx-Velvet/Flyx-main.git && cd Flyx-main

# 2. Install dependencies
npm install

# 3. Make "flyx" a global command (one-time)
npm run cli:link

# 4. Guided setup — asks a few questions, writes your config
flyx setup

# 5. Start and open your browser
flyx start
```

> **Need a TMDB API key?** [Get one free here](https://www.themoviedb.org/settings/api) — takes 30 seconds.

## Desktop App (Windows / macOS / Linux)

Prefer a real app over a terminal? Flyx ships as a self-contained desktop
app — **no Node.js, npm, or git needed**. Every push to `main` is auto-built
by GitHub Actions for all three platforms, and every `v*` tag is published as
a [GitHub Release](https://github.com/Vynx-Velvet/Flyx-main/releases).

| Platform | Artifacts | How to use |
|---|---|---|
| **Windows** | `Flyx-Setup-<version>.exe` · `Flyx-Portable-<version>.exe` | see below |
| **macOS** | `Flyx-<version>.dmg` | Open the dmg, drag Flyx to Applications. First launch: **right-click → Open** (v1 is unsigned — Gatekeeper will warn) |
| **Linux** | `Flyx-<version>.AppImage` · `Flyx-<version>.deb` | AppImage: `chmod +x Flyx-*.AppImage`, then run it; or install the `.deb` with your package manager |

**Windows — Setup vs. Portable:**

- **Setup** (`Flyx-Setup-…exe`) — installs like a normal program (you pick
  the install folder), adds Start Menu shortcuts, and **auto-updates** when
  you quit the app.
- **Portable** (`Flyx-Portable-…exe`) — one single exe. Put it anywhere
  (USB stick, sync folder), double-click to run, delete the file to remove
  it. No install, no auto-update.

**First launch** (any platform) opens the setup wizard: enter your TMDB key,
create your account, and pick a network mode. Your data lives in
`%LOCALAPPDATA%\flyx` on Windows (`~/Library/Application Support/flyx` on
macOS, `~/.local/share/flyx` on Linux). Closing the window keeps the server
running in the tray for your home network — **Quit from the tray menu** to
actually stop it. Windows SmartScreen may warn on first launch (unsigned v1):
choose **More info → Run anyway**.

Full details (auto-update matrix, auth model, manual testing): [docs/desktop.md](./docs/desktop.md)

## CLI Commands

After running `npm run cli:link` (step 3 above), `flyx` works from any terminal, any folder:

| Command | What it does |
|---|---|
| `flyx setup` | Guided first-time setup wizard |
| `flyx start` | Start Flyx and open your browser |
| `flyx stop` | Stop the Flyx server |
| `flyx status` | Check if Flyx is running and on what port |
| `flyx config` | View all current settings |
| `flyx config set <key> <value>` | Change a setting |
| `flyx logs` | Show recent server logs |
| `flyx update` | Pull latest code and rebuild |
| `flyx accounts list` | List all user accounts |
| `flyx accounts create <user> <pass>` | Add a user from the terminal |
| `flyx accounts delete <user>` | Remove a user |

## Environment Variables

The setup wizard writes your `.env` for you. If you want to do it manually, copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `TMDB_API_KEY` | Yes | TMDB API key for metadata, posters, and search |
| `JWT_SECRET` | Yes | Secret for signing auth tokens (min 32 characters) |
| `HOST_KEY` | Optional | Secret key for creating accounts. Required to enable registration. |
| `DATABASE_URL` | Optional | Database connection string. Defaults to local SQLite. |
| `CLOUDFLARE_ACCOUNT_ID` | Optional | Cloudflare account ID for Workers/D1 deployment |
| `CLOUDFLARE_API_TOKEN` | Optional | Cloudflare API token for Workers and D1 |
| `HOSTNAME` | Optional | Hostname to bind to. Default: `127.0.0.1`. Use `0.0.0.0` for network access. |
| `PORT` | Optional | Port to listen on. Default: `3891`. |

## Deploy to Cloudflare (optional)

```bash
npm run deploy:cloudflare   # Deploy the Next.js app to Cloudflare Workers
npm run deploy:landing      # Deploy the static landing page to Cloudflare Pages
```

## Project Structure

Flyx 3.0 is a **Turborepo monorepo** with 11 packages:

```
packages/
├── core/          @flyx/core        Shared types, error hierarchy, unified cache
├── config/        @flyx/config      Provider priorities, env validation, constants
├── providers/     @flyx/providers   Abstract BaseProvider, registry, 12+ providers
├── extractors/    @flyx/extractors  Unified extraction pipeline
├── player/        @flyx/player      Decomposed video player hooks + components
├── app/           @flyx/app         Next.js application
├── db/            @flyx/db          Database adapter (D1 + SQLite), migrations
├── sync/          @flyx/sync        Cross-device sync client
├── shared/        @flyx/shared      Shared UI components
├── cli/           @flyx/cli         Command-line management tool
└── admin/         @flyx/admin       Admin dashboard
```

## Development

```bash
npm install           # Install all workspace dependencies
npm run dev           # Start Next.js dev server with hot reload
npm test              # Run all tests
npm run type-check    # Type check all packages
npm run build         # Build for production
npm run lint          # Lint all packages
```

## Key Features

- **12+ streaming providers** with automatic priority-based fallback
- **Single extraction pipeline** — one fetch path, built-in unified cache
- **Decomposed video player** — composable React hooks (quality switching, subtitles, Chromecast, AirPlay)
- **Stream proxy** — shields your IP from upstream CDNs, handles CORS and M3U8 rewriting
- **Cross-device sync** — watchlist, progress, and preferences
- **Admin dashboard** — analytics, provider management, user monitoring
- **Run anywhere** — local (SQLite), Docker, or Cloudflare (D1 + Workers)
- **Privacy-first** — no ads, no tracking, no PII collection

## Documentation

| Document | Description |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design and data flow |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Setup, coding standards, adding providers |
| [docs/desktop.md](./docs/desktop.md) | Desktop app: packaging, auto-update, auth model |
| [docs/api/](./docs/api/) | API reference |
| [docs/DECISIONS/](./docs/DECISIONS/) | Architecture Decision Records |
| [docs/player/](./docs/player/) | Player hook API reference |

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript
- **Styling:** CSS Modules, custom design system (teal/purple/pink on deep void)
- **State:** Zustand, React Context
- **Video:** HLS.js
- **Infra:** Turborepo, Cloudflare Workers, Cloudflare D1
- **Testing:** Vitest, Playwright (E2E)
- **DB:** D1 (production), SQLite (development)

## License

MIT
