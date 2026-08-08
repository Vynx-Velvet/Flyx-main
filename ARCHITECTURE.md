# Flyx 3.0 — Architecture

## Overview

Flyx 3.0 is a **Turborepo monorepo** that separates concerns into 11 packages with clear dependency boundaries. This document explains the system design, data flow, and key architectural decisions.

## Package Dependency Graph

```
@flyx/core          ← Zero dependencies (types, errors, cache, utils)
@flyx/config        ← depends on: core
@flyx/db            ← depends on: core
@flyx/providers     ← depends on: core, config
@flyx/extractors    ← depends on: core, config, providers
@flyx/player        ← depends on: core, extractors
@flyx/sync          ← depends on: core, db
@flyx/shared        ← depends on: core
@flyx/admin         ← depends on: core, db
@flyx/app           ← depends on: all of the above
```

## Data Flow

### Stream Extraction (VOD)

```
User → Next.js Page → useProviderSources()
  → /api/stream/extract
    → ExtractionPipeline
      → ProviderRegistry.getForContent()
        → Provider.extract() [try in priority order]
          → Extractor service
            → CF Worker (provider-specific)
              → Upstream provider API
                → Return sources
      → UnifiedCache (15min TTL, stale-while-revalidate)
    → Return ExtractionResult
  → HLS.js loads M3U8 via FetchLoader
    → Service Worker intercepts CDN requests
      → Injects Referer/Origin headers
```

### Live TV (DLHD)

```
User → Live TV page → getStreamWithFallback()
  → DLHD provider → /tv/{channelId} → CF Worker
    → /play/{channelId} → DLHD worker
      → v8 fast path → JWT → server discovery → M3U8 fetch
        → M3U8 rewrite (single implementation)
          → Keys: browser-direct
          → Segments: proxied via CF Worker
```

## Key Architecture Decisions

### 1. Abstract BaseProvider Pattern

**Why:** In Flyx 2.0, 20 providers each copy-pasted ~40 lines of boilerplate (`getConfig()`, `extract()` try/catch, `fetchSourceByName()`). The `BaseProvider` abstract class provides these as default implementations. Subclasses only implement `name`, `supportedContent`, and `doExtract()` — typically 15-30 lines.

### 2. Single Error Hierarchy

**Why:** Flyx 2.0 had 5+ error handling systems across 6 directories in mixed JS/TS. Flyx 3.0 has one `FlyxError` base class with typed subclasses for every error category. All errors carry machine-readable codes, HTTP status codes, retry-ability flags, and structured details.

### 3. Unified Cache

**Why:** Flyx 2.0 had 4 separate caching systems (MemoryCache, SWRCache, StreamRetryManager, cf-fetch). Flyx 3.0 has one `UnifiedCache` with TTL expiry, stale-while-revalidate, namespace support, and LRU eviction.

### 4. Decorator-Free Registration

**Why:** TypeScript decorators are still experimental and have issues with ESM bundlers. Instead, providers are registered via a simple `safeRegister()` function in `packages/providers/src/providers/index.ts`. Each provider import is wrapped in try/catch for robust error isolation.

### 5. Single Extraction Path

**Why:** Flyx 2.0 duplicated provider fetch logic across 5 different locations. Flyx 3.0 has one `ExtractionPipeline` class consumed everywhere — API routes, player hooks, and admin tools all use the same path.

### 6. Proper Database Migrations

**Why:** Flyx 2.0's sync worker ran `CREATE TABLE IF NOT EXISTS` on every request (a D1 anti-pattern). Flyx 3.0 tracks schema version in a `_migrations` table and only applies migrations once, in transactions with rollback on failure.

## Provider Priority Bands

| Band | Priority | Category |
|------|----------|----------|
| 1–9 | Primary | VOD (movies + TV) |
| 10–19 | Secondary | Anime |
| 20–29 | Tertiary | Live TV |
| 30–39 | Sports | PPV / Sports |
| 40+ | Fallback | IPTV |

See `packages/config/src/priorities.ts` for the exact values.

## Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|----------------|
| Core types & utils | Vitest (node) | 90% |
| Providers & registry | Vitest (node) | 80% |
| Extraction pipeline | Vitest (node) | 80% |
| Player hooks | Vitest (jsdom) | 70% |
| Database adapters | Vitest (node) | 70% |
| E2E flows | Playwright | 3 critical paths |

## See Also

- [docs/DECISIONS/](./docs/DECISIONS/) — Detailed ADRs for each choice
- [CONTRIBUTING.md](./CONTRIBUTING.md) — How to add a provider
- [docs/api/](./docs/api/) — API reference
