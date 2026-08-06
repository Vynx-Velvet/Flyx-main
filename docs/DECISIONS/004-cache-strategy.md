# ADR 004: Unified Cache Strategy

**Status:** Accepted
**Date:** 2026-07-16

## Context

Flyx 2.0 had 4 separate caching systems:
- `lib/utils/cache.ts` (MemoryCache + LocalStorageCache + CacheManager)
- `lib/utils/swr-cache.ts` (SWRCache with TTL)
- `lib/utils/stream-retry.ts` (StreamRetryManager)
- `lib/utils/cf-fetch.ts` (RPI config caching)

None were integrated with the provider system. Stream extraction results were never cached, causing redundant upstream API calls.

## Decision

A **single `UnifiedCache`** class with stale-while-revalidate, namespace support, and LRU eviction. Integrated directly into the `ExtractionPipeline`.

## Features

- **TTL-based expiry** — entries expire after a configurable duration
- **Stale-while-revalidate** — serve stale data while refreshing in background
- **Namespaces** — group entries for bulk invalidation (e.g., `invalidate("extraction")`)
- **LRU eviction** — configurable max size per namespace
- **Storage adapter** — optional persistent backend (localStorage, KV, Redis)

## Cache TTLs

| Data | TTL | Rationale |
|------|-----|-----------|
| Stream extraction | 15 min | Streams rarely change; avoid rate limits |
| Provider configs | 5 min | Config changes are infrequent |
| TMDB metadata | 60 min | Metadata is static |
| Search results | 5 min | Search freshness matters |
| Live TV channels | 2 min | EPG data changes frequently |

## Consequences

- **Positive:** Stream extraction is cached, reducing upstream load
- **Positive:** Consistent caching behavior across the platform
- **Positive:** SWR pattern keeps responses fast while keeping data fresh
- **Negative:** Stale data risk during the 15-min extraction window
