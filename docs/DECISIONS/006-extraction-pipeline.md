# ADR 006: Unified Extraction Pipeline

**Status:** Accepted
**Date:** 2026-07-16

## Context

Flyx 2.0 duplicated provider fetch logic across 5 locations:
- `VideoPlayer.fetchSources()` (~200 lines)
- `VideoPlayer.fetchFromProvider()` (~120 lines)
- `VideoPlayer.initializePlayer()` (~320 lines)
- `VideoPlayerWrapper.fetchSources()` (~250 lines)
- API route `extractWithFallback()` + `directExtract()` switch (~200 lines)

Each had different timeout handling, provider ordering, error recovery, and source normalisation. The `directExtract()` function was a 100-line `switch` statement requiring manual updates when providers were added or removed.

## Decision

A **single `ExtractionPipeline` class** consumed everywhere — API routes, player hooks, admin tools.

## Design

```typescript
class ExtractionPipeline {
  async extract(request, options?): Promise<ExtractionResult>
    // Auto mode: try providers in priority order
    // Direct mode: call named provider only
    // Source filter: return only matching source
    // Cancellation: AbortSignal support
    // Caching: built-in via UnifiedCache
}
```

## Key Features

- **Provider fallback** — iterates providers in priority order until one succeeds
- **Cancellation** — `AbortSignal` support for cleanup on navigation
- **Built-in caching** — uses `UnifiedCache` with 15-min TTL
- **Source filtering** — find specific sources by name
- **Aggregated errors** — `AllProvidersFailedError` with per-provider details

## Consequences

- **Positive:** One extraction path to test, debug, and optimise
- **Positive:** Adding a provider automatically adds it to the fallback chain
- **Positive:** No more stale closure bugs from duplicated state management
- **Positive:** Caching is automatic — no need for each consumer to implement it
- **Negative:** Single pipeline is a potential bottleneck — must be well-tested
