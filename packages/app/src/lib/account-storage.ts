/**
 * Per-account localStorage scoping for watch history, watchlist and manga
 * progress.
 *
 * Several accounts can share one browser (a family PC signed into the
 * desktop host over the LAN), so per-user data lives under
 * `<baseKey>:<accountId>`. The account id comes from /api/auth/me, fetched
 * once per page load. Until it resolves (or while signed out) scoped
 * storage is unavailable: reads come back empty and writes are dropped —
 * never written to a key another account could pick up.
 *
 * Migration: data saved before scoping existed (the bare `<baseKey>`) is
 * moved into the first account that loads, then the bare key is removed.
 * On the single-user desktop that is simply the owner's account.
 */

/** Legacy (unscoped) keys that hold per-account data. */
export const SCOPED_BASE_KEYS = [
  "flyx_watch_progress",
  "flyx_watchlist_v1",
  "flyx_manga_progress_v1",
] as const;

/** Fired on window once the account scope is known (or changes). */
export const ACCOUNT_SCOPE_EVENT = "flyx-account-scope-changed";

// Per-tab hint so the first render after a reload already knows the
// account (sessionStorage: dies with the tab, never shared across tabs).
const HINT_KEY = "flyx:account-scope";

let accountId: string | null | undefined; // undefined = not resolved yet
let pending: Promise<string | null> | null = null;

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function scopedKey(baseKey: string, id: string): string {
  return `${baseKey}:${id}`;
}

/**
 * Move legacy unscoped values into `id`'s keys (pure — unit-testable).
 * An existing scoped value wins; the legacy key is removed either way.
 */
export function migrateLegacyKeys(storage: KeyValueStorage, id: string): void {
  for (const base of SCOPED_BASE_KEYS) {
    try {
      const legacy = storage.getItem(base);
      if (legacy === null) continue;
      const target = scopedKey(base, id);
      if (storage.getItem(target) === null) storage.setItem(target, legacy);
      storage.removeItem(base);
    } catch {
      /* quota / private mode */
    }
  }
}

function local(): KeyValueStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readHint(): string | null {
  try {
    return window.sessionStorage.getItem(HINT_KEY);
  } catch {
    return null;
  }
}

function writeHint(id: string | null): void {
  try {
    if (id) window.sessionStorage.setItem(HINT_KEY, id);
    else window.sessionStorage.removeItem(HINT_KEY);
  } catch {
    /* ignore */
  }
}

function setAccount(id: string | null): void {
  const changed = id !== accountId;
  accountId = id;
  writeHint(id);
  const s = local();
  if (id && s) migrateLegacyKeys(s, id);
  if (changed && typeof window !== "undefined") {
    try {
      window.dispatchEvent(new Event(ACCOUNT_SCOPE_EVENT));
    } catch {
      /* ignore */
    }
  }
}

/** Resolve the signed-in account id (cached per page load). */
export function resolveAccountScope(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!pending) {
    pending = fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data: { user?: { id?: unknown } | null }) => {
        const id = typeof data?.user?.id === "string" ? data.user.id : null;
        setAccount(id);
        return id;
      })
      .catch(() => {
        // Server hiccup: keep whatever the tab hint said; allow a retry.
        pending = null;
        return accountId ?? null;
      });
  }
  return pending;
}

/**
 * Current account id, synchronously: the resolved value, else this tab's
 * hint. Kicks off resolution on first use.
 */
export function currentAccountId(): string | null {
  if (typeof window === "undefined") return null;
  if (accountId === undefined) {
    void resolveAccountScope();
    return readHint();
  }
  return accountId;
}

/**
 * localStorage key for `baseKey` scoped to the signed-in account, or null
 * when no account is known yet.
 */
export function accountKey(baseKey: string): string | null {
  const id = currentAccountId();
  return id ? scopedKey(baseKey, id) : null;
}

/** Test hook. */
export function _resetAccountScope(): void {
  accountId = undefined;
  pending = null;
}
