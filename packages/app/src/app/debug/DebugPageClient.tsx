"use client";

import { useState, useEffect, useCallback } from "react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  category: string;
  message: string;
  detail?: string;
  malId?: number;
  provider?: string;
  episode?: number;
}

type FilterLevel = "all" | "error" | "warn" | "info";
type FilterCategory = "all" | "stream" | "api" | "provider" | "extraction" | "manga" | "auth" | "system";

export default function DebugPageClient() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState("");
  const [filterLevel, setFilterLevel] = useState<FilterLevel>("all");
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");
  const [copied, setCopied] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterLevel !== "all") params.set("level", filterLevel);
      if (filterCategory !== "all") params.set("category", filterCategory);
      params.set("limit", "200");
      const res = await fetch(`/api/logs?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setSummary(data.summary ?? "");
      }
    } catch { /* ignore */ }
  }, [filterLevel, filterCategory]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const clearLogs = async () => {
    await fetch("/api/logs", { method: "DELETE" });
    fetchLogs();
  };

  const copyReport = () => {
    const text = [
      "=== Flyx Debug Report ===",
      `Time: ${new Date().toISOString()}`,
      `Total logs: ${logs.length}`,
      "",
      summary,
      "",
      "--- Recent Logs ---",
      ...logs.slice(0, 50).map((l) =>
        `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category}] ${l.message}${l.detail ? ` — ${l.detail}` : ""}${l.provider ? ` (provider: ${l.provider})` : ""}`
      ),
      "",
      "Paste this in your bug report on GitHub or Discord.",
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto", color: "#f0f0f5" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Debug Logs</h1>
          <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.45)", margin: "0.25rem 0 0" }}>
            {logs.length} entries in memory • Auto-refresh every 3s
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
              background: autoRefresh ? "rgba(0,229,191,0.1)" : "rgba(255,255,255,0.04)",
              color: autoRefresh ? "#00e5bf" : "rgba(255,255,255,0.5)",
              cursor: "pointer", fontSize: "0.775rem", fontFamily: "inherit",
            }}
          >
            {autoRefresh ? "Auto ✓" : "Auto ✗"}
          </button>
          <button
            onClick={fetchLogs}
            style={{
              padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)",
              cursor: "pointer", fontSize: "0.775rem", fontFamily: "inherit",
            }}
          >
            Refresh
          </button>
          <button
            onClick={clearLogs}
            style={{
              padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid rgba(244,80,80,0.2)",
              background: "transparent", color: "rgba(244,80,80,0.7)",
              cursor: "pointer", fontSize: "0.775rem", fontFamily: "inherit",
            }}
          >
            Clear
          </button>
          <button
            onClick={copyReport}
            style={{
              padding: "0.5rem 1rem", borderRadius: 8, border: "1px solid rgba(0,229,191,0.2)",
              background: copied ? "rgba(0,229,191,0.1)" : "rgba(0,229,191,0.05)",
              color: copied ? "#00e5bf" : "rgba(0,229,191,0.7)",
              cursor: "pointer", fontSize: "0.775rem", fontWeight: 600, fontFamily: "inherit",
            }}
          >
            {copied ? "Copied!" : "Copy Report"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {(["all", "error", "warn", "info"] as FilterLevel[]).map((l) => (
          <button
            key={l}
            onClick={() => setFilterLevel(l)}
            style={{
              padding: "0.3rem 0.75rem", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)",
              background: filterLevel === l ? "rgba(255,255,255,0.08)" : "transparent",
              color: filterLevel === l ? "#f0f0f5" : "rgba(255,255,255,0.35)",
              cursor: "pointer", fontSize: "0.7rem", fontFamily: "inherit", textTransform: "uppercase",
            }}
          >
            {l}
          </button>
        ))}
        <span style={{ color: "rgba(255,255,255,0.1)", lineHeight: "28px" }}>|</span>
        {(["all", "stream", "extraction", "provider", "api", "manga", "auth", "system"] as FilterCategory[]).map((c) => (
          <button
            key={c}
            onClick={() => setFilterCategory(c)}
            style={{
              padding: "0.3rem 0.75rem", borderRadius: 6, border: "1px solid rgba(255,255,255,0.08)",
              background: filterCategory === c ? "rgba(255,255,255,0.08)" : "transparent",
              color: filterCategory === c ? "#f0f0f5" : "rgba(255,255,255,0.35)",
              cursor: "pointer", fontSize: "0.7rem", fontFamily: "inherit",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Summary */}
      {summary && (
        <div style={{
          padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: 8,
          background: "rgba(244,80,80,0.06)", border: "1px solid rgba(244,80,80,0.12)",
          fontSize: "0.75rem", fontFamily: "monospace", whiteSpace: "pre-wrap",
          color: "rgba(255,255,255,0.6)", lineHeight: 1.6, maxHeight: 150, overflow: "auto",
        }}>
          {summary}
        </div>
      )}

      {/* Log entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {logs.length === 0 ? (
          <p style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", padding: "3rem" }}>
            No logs yet. Errors will appear here automatically.
          </p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 60px 80px 1fr",
                gap: "0.75rem",
                padding: "0.4rem 0.75rem",
                borderRadius: 6,
                background: log.level === "error"
                  ? "rgba(244,80,80,0.06)"
                  : log.level === "warn"
                    ? "rgba(245,158,11,0.04)"
                    : "transparent",
                border: log.level === "error" ? "1px solid rgba(244,80,80,0.08)" : "1px solid transparent",
                fontSize: "0.7rem",
                fontFamily: "monospace",
                alignItems: "baseline",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span style={{
                color: log.level === "error" ? "#f45050" : log.level === "warn" ? "#f59e0b" : "#00e5bf",
                fontWeight: 600, textTransform: "uppercase",
              }}>
                {log.level}
              </span>
              <span style={{
                color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)",
                padding: "1px 6px", borderRadius: 4, textAlign: "center", whiteSpace: "nowrap",
              }}>
                {log.category}
                {log.provider ? `/${log.provider}` : ""}
              </span>
              <span style={{ color: "rgba(255,255,255,0.65)", wordBreak: "break-word" }}>
                {log.message}
                {log.malId ? ` (MAL ${log.malId})` : ""}
                {log.episode ? ` EP${log.episode}` : ""}
                {log.detail ? (
                  <span style={{ color: "rgba(255,255,255,0.3)", display: "block", marginTop: 2 }}>
                    {log.detail}
                  </span>
                ) : null}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
