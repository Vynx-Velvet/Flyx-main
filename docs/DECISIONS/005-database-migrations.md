# ADR 005: Database Migrations

**Status:** Accepted
**Date:** 2026-07-16

## Context

Flyx 2.0 had two parallel database systems:
- `connection.ts` using Bun SQLite / better-sqlite3 (with `eval('require')` hack)
- `d1-connection.ts` using Cloudflare D1

The sync worker ran `CREATE TABLE IF NOT EXISTS` on every GET/POST request — a well-known D1 anti-pattern that adds latency to every request. The code claimed to be "D1-only" but `queries.ts` still imported from the old SQLite connection.

## Decision

A **unified `DBAdapter` interface** with version-tracked, transactional migrations.

## Architecture

```
DBAdapter (interface: query, execute, batch, close)
├── D1Adapter        — Cloudflare D1 (production)
└── SQLiteAdapter    — Bun SQLite (development)

MigrationRunner
├── Tracks version in _migrations table
├── Runs migrations once, in order
├── Wraps each in BEGIN/COMMIT transaction
└── Rolls back on failure
```

## Key Principle

**Migrations run once, not on every request.** The schema version is tracked in a `_migrations` table. Each migration increments the version. The runner checks the current version and only applies pending migrations.

## Consequences

- **Positive:** No `CREATE TABLE IF NOT EXISTS` on every request
- **Positive:** Schema is version-controlled and auditable
- **Positive:** Failed migrations roll back cleanly
- **Negative:** Requires migration discipline — all schema changes must go through migrations
