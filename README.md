# Flyx 3.0

**Privacy-first streaming platform.** No ads. No tracking. No bullshit.

Flyx aggregates movies, TV shows, anime, live TV (850+ channels), live sports, and PPV events from multiple free streaming providers. It runs on Cloudflare Workers with a Next.js frontend.

> **Flyx 3.0** is a ground-up architectural refactor of the Flyx 2.0 codebase. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design rationale and [docs/DECISIONS/](./docs/DECISIONS/) for architecture decision records.

## Quick Start

```bash
# Install dependencies
npm install

# Start development (Turborepo)
npm run dev

# Run tests
npm test

# Type check all packages
npm run type-check

# Build for production
npm run build
```

## Project Structure

Flyx 3.0 is a **Turborepo monorepo** with 11 packages:

```
packages/
├── core/          @flyx/core        Shared types, error hierarchy, unified cache
├── config/        @flyx/config      Provider priorities, env validation, constants
├── providers/     @flyx/providers   Abstract BaseProvider, registry, 20+ providers
├── extractors/    @flyx/extractors  Unified extraction pipeline
├── player/        @flyx/player      Decomposed video player hooks + components
├── app/           @flyx/app         Next.js application
├── db/            @flyx/db          Database adapter (D1 + SQLite), migrations
├── sync/          @flyx/sync        Cross-device sync client
├── workers/       @flyx/workers     Cloudflare Workers (proxy, sync, extractors)
├── shared/        @flyx/shared      Shared UI components (ErrorBoundary)
└── admin/         @flyx/admin       Admin dashboard
```

## Key Features

- **20+ streaming providers** with automatic priority-based fallback
- **Unified extraction pipeline** — single fetch path, built-in caching
- **Decomposed video player** — composable hooks, no 5,000-line components
- **Cross-device sync** — watchlist, progress, and preferences
- **Admin dashboard** — analytics, provider management, user monitoring
- **Privacy-first** — no ads, no tracking, no PII collection
- **Self-hostable** — Docker support, local SQLite database option

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design and data flow |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Setup, coding standards, adding providers |
| [docs/api/](./docs/api/) | API reference |
| [docs/DECISIONS/](./docs/DECISIONS/) | Architecture Decision Records |
| [docs/player/](./docs/player/) | Player hook API reference |

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4, CSS Modules
- **State:** Zustand, React Context
- **Video:** HLS.js, FFmpeg.wasm (HEVC transcoding)
- **Infra:** Turborepo, Cloudflare Workers, Cloudflare D1
- **Testing:** Vitest, Playwright (E2E)
- **DB:** D1 (production), SQLite (development)

## Environment Variables

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

See [`.env.example`](./.env.example) for all required and optional variables.

## License

MIT
