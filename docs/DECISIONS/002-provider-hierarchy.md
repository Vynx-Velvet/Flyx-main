# ADR 002: Provider Hierarchy (Abstract Base Class)

**Status:** Accepted
**Date:** 2026-07-16

## Context

Flyx 2.0 had 20 providers, each implementing the `Provider` interface independently. Analysis showed ~85% boilerplate duplication: every provider copy-pasted `getConfig()`, `extract()` try/catch error wrapping, `fetchSourceByName()`, `normalizeSource()`, and `normalizeSubtitle()`. Only the `doExtract()` logic varied.

Additionally, providers used three conflicting import patterns (static, dynamic, inline) and four separate caching systems existed but none were used by providers.

## Decision

Use an **abstract base class** (`BaseProvider`) with the **template method pattern**.

## Rationale

- **Boilerplate elimination:** `extract()`, `getConfig()`, `supportsContent()`, `fetchSourceByName()`, `normalizeSource()`, and `normalizeSubtitle()` are inherited for free.
- **Subclasses implement only:** `name`, `supportedContent`, `priority`, and `doExtract()`.
- **Result:** Provider files shrink from 100+ lines to 15-30 lines.
- **Consistent behavior:** All providers handle errors, timing, and normalisation identically.

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Keep interface + copy-paste | 85% waste, bugs in individual error handlers |
| Mixins | Less clear than template method, harder to debug |
| Functional composition | Less discoverable; classes provide clearer extension points |

## Consequences

- **Positive:** ~85% code reduction in provider layer
- **Positive:** Consistent error handling and timing across all providers
- **Positive:** Adding a new provider requires ~20 lines of code
- **Negative:** Class hierarchy may feel rigid for unusual providers
- **Mitigation:** Specialised subclasses (`BaseAnimeProvider`, `BaseLiveTVProvider`) for different content types
