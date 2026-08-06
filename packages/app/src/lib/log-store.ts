/**
 * In-memory log store for debugging and user-facing error reporting.
 *
 * Captures extraction failures, API errors, and provider issues with
 * structured metadata. Kept in memory (clears on server restart).
 * Max 500 entries to prevent memory leaks.
 */

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  category: "stream" | "api" | "provider" | "extraction" | "manga" | "auth" | "system";
  message: string;
  detail?: string;
  malId?: number;
  provider?: string;
  episode?: number;
}

const MAX_ENTRIES = 500;
const store: LogEntry[] = [];

let idCounter = 0;

export function addLog(entry: Omit<LogEntry, "id" | "timestamp">): LogEntry {
  const log: LogEntry = {
    ...entry,
    id: String(++idCounter),
    timestamp: new Date().toISOString(),
  };
  store.push(log);
  if (store.length > MAX_ENTRIES) {
    store.splice(0, store.length - MAX_ENTRIES);
  }
  // Also print to console for server-side debugging
  const prefix = `[flyx:${entry.category}]`;
  const extra = entry.detail ? ` — ${entry.detail}` : "";
  const method = entry.level === "error" ? console.error : entry.level === "warn" ? console.warn : console.log;
  method(`${prefix} ${entry.message}${extra}`);
  return log;
}

export function getLogs(opts?: {
  level?: LogEntry["level"];
  category?: LogEntry["category"];
  limit?: number;
}): LogEntry[] {
  let filtered = [...store];
  if (opts?.level) filtered = filtered.filter((l) => l.level === opts.level);
  if (opts?.category) filtered = filtered.filter((l) => l.category === opts.category);
  const limit = opts?.limit ?? 100;
  return filtered.slice(-limit).reverse();
}

export function clearLogs(): void {
  store.length = 0;
}

export function getErrorSummary(): string {
  const errors = store.filter((l) => l.level === "error").slice(-20);
  if (!errors.length) return "No recent errors.";
  return errors
    .map((e) => `[${e.timestamp}] [${e.category}] ${e.message}${e.detail ? ` — ${e.detail}` : ""}`)
    .join("\n");
}
