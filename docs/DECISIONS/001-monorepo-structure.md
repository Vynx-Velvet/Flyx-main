# ADR 001: Monorepo Structure

**Status:** Accepted
**Date:** 2026-07-16

## Context

Flyx 2.0 was a single Next.js application with several sub-projects (Cloudflare Workers, sync worker, DLHD extractor, CDN-Live extractor, RPI proxy) living in separate directories with no shared code. This led to:

- Duplicate type definitions
- Inconsistent error handling
- Duplicated utility functions across workers
- No way to share providers between the app and workers

## Decision

Flyx 3.0 uses a **Turborepo monorepo** with npm workspaces and 11 packages.

## Rationale

- **Shared types** via `@flyx/core` — single source of truth
- **Shared utilities** — cache, retry, proxy, M3U8 rewriting in one place
- **Independent versioning** — packages can evolve at their own pace
- **Parallel builds** — Turborepo caches and parallelises builds
- **Workspace-aware tooling** — Vitest, ESLint, and Prettier work across all packages

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Single repo (stay as-is) | No shared code, 65K-line monolith |
| Nx | More complex than needed; Turborepo is lighter |
| pnpm workspaces | npm workspaces sufficient for this scale |
| Separate repos | Too much overhead for 11 packages |

## Consequences

- **Positive:** All code shares types, errors, and utilities
- **Positive:** Can build/test/deploy individual packages
- **Negative:** Monorepo tooling adds initial setup complexity
- **Negative:** Cross-package changes require coordination
