# ADR 003: Single Error Hierarchy

**Status:** Accepted
**Date:** 2026-07-16

## Context

Flyx 2.0 had 5-7 error handling systems across 6 directories:
- `components/error/` (TypeScript, CSS modules)
- `components/ErrorHandling/` (JavaScript, styled-jsx)
- `utils/errorHandling/` (JavaScript)
- `lib/utils/error-handler.ts` (APIErrorHandler)
- `lib/stream-errors.ts` (AllProvidersFailedError)
- `hooks/useErrorHandling.js`

Mixed JS/TS, no shared interfaces, overlapping concerns, inconsistent patterns.

## Decision

A **single `FlyxError` base class** with typed subclasses for every error category.

## Error Hierarchy

```
FlyxError (base: code, statusCode, retryable, details)
├── ProviderError
│   └── AllProvidersFailedError
├── NetworkError
│   ├── TimeoutError
│   ├── RateLimitedError
│   └── CloudflareBlockedError
├── ExtractionError
│   ├── DecoderFailedError
│   ├── NoSourcesFoundError
│   └── M3U8ParseError
└── ValidationError
    ├── InvalidMediaTypeError
    └── MissingParameterError
```

## Rationale

- Every error carries a machine-readable `code`, HTTP `statusCode`, and `retryable` flag
- `toJSON()` provides consistent API error responses
- `category` is derived from the code for UI display
- TypeScript ensures exhaustive handling

## Consequences

- **Positive:** One error system to learn and use
- **Positive:** API responses are consistently structured
- **Positive:** TypeScript enforces proper error typing
- **Negative:** Migrating old error handling code requires touching many files
