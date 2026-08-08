# Contributing to Flyx 3.0

## Development Setup

```bash
# Clone and install
git clone <repo-url>
cd Flyx-3.0
npm install

# Start dev mode (all packages)
npm run dev

# Run tests
npm test

# Type check
npm run type-check

# Lint
npm run lint
```

## Monorepo Conventions

- **All code in TypeScript** — no `.js` or `.jsx` files (unlike Flyx 2.0)
- **Strict mode everywhere** — `tsconfig.base.json` has `"strict": true`
- **One test runner** — Vitest only (no Jest, no Bun test)
- **ESNext target** — no polyfills needed for modern runtimes
- **reactStrictMode: true** — components must handle double-mount

## Package Naming

- `@flyx/core` — Types, errors, cache, utilities
- `@flyx/config` — Constants and configuration
- `@flyx/providers` — Provider classes and registry
- `@flyx/extractors` — Extraction logic
- `@flyx/player` — Video player
- `@flyx/db` — Database layer
- `@flyx/sync` — Cross-device sync

- `@flyx/shared` — Shared UI
- `@flyx/admin` — Admin dashboard
- `@flyx/app` — Next.js app

## Adding a New Provider

### 1. Choose a priority

Check `packages/config/src/priorities.ts` for an available slot in the appropriate band. If you need a new slot, add it to the `PROVIDER_PRIORITIES` constant.

### 2. Create the extractor

```typescript
// packages/extractors/src/services/myprovider.ts
import type { MediaType, StreamSource, SubtitleTrack } from "@flyx/core";

export async function extractMyProvider(
  tmdbId: number,
  mediaType: MediaType,
  season?: number,
  episode?: number,
): Promise<{ sources: StreamSource[]; subtitles: SubtitleTrack[] }> {
  // Your extraction logic here
  // Call the upstream API, parse the response, return sources
  return { sources: [], subtitles: [] };
}
```

### 3. Create the provider class

```typescript
// packages/providers/src/providers/myprovider.ts
import type { ContentCategory, ExtractionRequest, StreamSource, SubtitleTrack } from "@flyx/core";
import { PROVIDER_PRIORITIES } from "@flyx/config";
import { BaseProvider } from "../base";

export class MyProvider extends BaseProvider {
  readonly name = "myprovider";
  readonly priority = PROVIDER_PRIORITIES.MYPROVIDER; // Add to priorities.ts
  readonly supportedContent: ContentCategory[] = ["movie", "tv"];

  protected async doExtract(request: ExtractionRequest): Promise<{
    sources: StreamSource[];
    subtitles?: SubtitleTrack[];
  }> {
    const { extractMyProvider } = await import("@flyx/extractors/services/myprovider");
    const result = await extractMyProvider(
      request.tmdbId, request.mediaType,
      request.season, request.episode,
    );
    return { sources: result.sources, subtitles: result.subtitles };
  }
}
```

### 4. Register the provider

In `packages/providers/src/providers/index.ts`:

```typescript
import { MyProvider } from "./myprovider";
safeRegister("myprovider", () => new MyProvider());
```

### 5. Add tests

```typescript
// packages/providers/src/providers/myprovider.test.ts
import { describe, it, expect } from "vitest";
import { MyProvider } from "./myprovider";

describe("MyProvider", () => {
  it("has correct name and priority", () => {
    const provider = new MyProvider();
    expect(provider.name).toBe("myprovider");
    expect(provider.supportedContent).toContain("movie");
  });
});
```

## Coding Standards

- **JSDoc on all exports** — public API must be documented
- **No `any` without justification** — use `unknown` and narrow types
- **Error handling via FlyxError** — throw typed errors, never strings
- **Cache extraction results** — use `UnifiedCache` for any network call
- **Tests for every provider** — at minimum, test that `extract()` returns the right shape

## Commit Convention

- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code restructure (no behavior change)
- `docs:` — Documentation
- `test:` — Tests
- `chore:` — Build/tooling

## Questions?

See `ARCHITECTURE.md` and `docs/DECISIONS/` for design rationale.
