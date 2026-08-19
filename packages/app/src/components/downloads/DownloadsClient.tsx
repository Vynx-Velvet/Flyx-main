"use client";

import { useCallback, useEffect, useState } from "react";
import type { DownloadJob } from "@/lib/downloads/types";
import { isDesktopHost } from "@/lib/downloads/client";

interface FolderInfo {
  dir: string;
  custom: string | null;
  defaultDir: string;
}

const POLL_MS = 2000;

function formatBytes(n: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const statusColor: Record<string, string> = {
  queued: "#94a3b8",
  downloading: "#38bdf8",
  processing: "#38bdf8",
  done: "#34d399",
  error: "#f87171",
  cancelled: "#64748b",
};

export default function DownloadsClient() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const [folderInput, setFolderInput] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);
  const [folderMsg, setFolderMsg] = useState("");
  const [error, setError] = useState("");
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    setIsHost(isDesktopHost());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/downloads", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs ?? []);
      } else if (res.status === 403) {
        // Only the host tracks jobs in a queue; on other devices downloads go
        // straight to that device's browser, so there's nothing to list here.
        setError(isDesktopHost() ? "Admin access required" : "");
      }
    } catch {
      /* server may be mid-restart */
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, POLL_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  useEffect(() => {
    fetch("/api/settings/downloads")
      .then((r) => r.json())
      .then((d: FolderInfo) => {
        setFolder(d);
        setFolderInput(d.dir || "");
      })
      .catch(() => {});
  }, []);

  async function saveFolder() {
    setSavingFolder(true);
    setFolderMsg("");
    try {
      const res = await fetch("/api/settings/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir: folderInput }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setFolder({ ...folder!, dir: data.dir, custom: folderInput.trim() || null });
        setFolderMsg("Saved");
      } else {
        setFolderMsg(data.error ?? "Failed to save");
      }
    } catch {
      setFolderMsg("Network error");
    } finally {
      setSavingFolder(false);
    }
  }

  const activeCount = jobs.filter(
    (j) => j.status === "queued" || j.status === "downloading" || j.status === "processing",
  ).length;

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem 5rem" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "white", margin: "0 0 0.25rem" }}>
        Downloads
      </h1>
      <p style={{ color: "rgba(255,255,255,0.5)", margin: "0 0 1.5rem" }}>
        {activeCount > 0
          ? `${activeCount} download${activeCount !== 1 ? "s" : ""} in progress`
          : "Save movies, episodes, and manga chapters to this device"}
      </p>

      {isHost && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: 12,
            fontSize: "0.8rem",
            color: "rgba(255,255,255,0.6)",
            background: "rgba(0,229,191,0.06)",
            border: "1px solid rgba(0,229,191,0.15)",
            marginBottom: "1.5rem",
          }}
        >
          This page tracks downloads saved to this machine. On a phone or other
          device on your network, files download straight to that device's browser
          instead.
        </div>
      )}

      {/* Download folder */}
      <section
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <label style={{ display: "block", fontSize: "0.875rem", color: "white", marginBottom: "0.5rem" }}>
          Save files to
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            type="text"
            value={folderInput}
            onChange={(e) => setFolderInput(e.target.value)}
            placeholder={folder?.defaultDir || "Downloads folder"}
            style={{
              flex: 1,
              minWidth: 240,
              padding: "0.5rem 0.75rem",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "white",
              fontSize: "0.85rem",
              fontFamily: "monospace",
            }}
          />
          <button
            type="button"
            onClick={saveFolder}
            disabled={savingFolder}
            style={{
              padding: "0.5rem 1rem",
              background: "rgba(0,229,191,0.12)",
              border: "1px solid rgba(0,229,191,0.25)",
              borderRadius: 8,
              color: "#00e5bf",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {savingFolder ? "Saving…" : "Save"}
          </button>
          {folder && folder.custom && (
            <button
              type="button"
              onClick={async () => {
                setFolderInput(folder.defaultDir);
                await fetch("/api/settings/downloads", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ dir: "" }),
                });
                setFolder({ ...folder, dir: folder.defaultDir, custom: null });
              }}
              style={{
                padding: "0.5rem 0.75rem",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 8,
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                fontSize: "0.8rem",
              }}
            >
              Reset to default
            </button>
          )}
        </div>
        {folderMsg && (
          <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#00e5bf" }}>{folderMsg}</div>
        )}
      </section>

      {error && (
        <div style={{ padding: "1rem", borderRadius: 12, color: "#f87171", background: "rgba(248,113,113,0.08)", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Job list */}
      {jobs.length === 0 ? (
        <div
          style={{
            padding: "3rem 1rem",
            textAlign: "center",
            color: "rgba(255,255,255,0.4)",
            border: "1px dashed rgba(255,255,255,0.12)",
            borderRadius: 16,
          }}
        >
          {isHost
            ? "Nothing downloaded yet. Use the download button on a movie, episode, or manga chapter."
            : "On this device, downloads save straight to your browser — nothing to track here. Use a download button on any movie, episode, or manga chapter."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {jobs.map((job) => {
            const color = statusColor[job.status] || "#94a3b8";
            const indeterminate =
              (job.status === "downloading" || job.status === "processing") &&
              job.progress === 0 &&
              job.outTimeMs > 0;
            return (
              <div
                key={job.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: "0.9rem 1.1rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "white", fontSize: "0.9rem", fontWeight: 500, wordBreak: "break-word" }}>
                      {job.label}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                      {job.kind === "video" ? "Video" : "Manga"}
                      {job.error ? ` · ${job.error}` : ""}
                      {job.filepath && job.status === "done" ? ` · ${job.filepath}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexShrink: 0 }}>
                    <span style={{ color, fontSize: "0.75rem", fontWeight: 600, textTransform: "capitalize" }}>
                      {job.status}
                      {job.status === "downloading" && job.outTimeMs > 0 && job.durationSec
                        ? ` ${formatTime(job.outTimeMs)}`
                        : ""}
                    </span>
                    {(job.status === "downloading" ||
                      job.status === "processing" ||
                      job.status === "queued") && (
                      <button
                        type="button"
                        onClick={() =>
                          fetch(`/api/downloads/${job.id}`, { method: "DELETE" }).then(refresh)
                        }
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(244,80,80,0.3)",
                          borderRadius: 6,
                          color: "#f87171",
                          fontSize: "0.7rem",
                          padding: "0.2rem 0.5rem",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    )}
                    {(job.status === "done" || job.status === "error" || job.status === "cancelled") && (
                      <button
                        type="button"
                        onClick={() =>
                          fetch(`/api/downloads/${job.id}`, { method: "DELETE" }).then(refresh)
                        }
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 6,
                          color: "rgba(255,255,255,0.6)",
                          fontSize: "0.7rem",
                          padding: "0.2rem 0.5rem",
                          cursor: "pointer",
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {(job.status === "downloading" || job.status === "processing") && (
                  <div style={{ marginTop: "0.6rem" }}>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 3,
                        background: "rgba(255,255,255,0.08)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: indeterminate ? "35%" : `${job.progress}%`,
                          background: "linear-gradient(90deg, #2ee6c5, #9b8cff)",
                          transition: "width 0.4s ease",
                          ...(indeterminate
                            ? { animation: "none", opacity: 0.7 }
                            : {}),
                        }}
                      />
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", marginTop: "0.3rem" }}>
                      {job.progress > 0 ? `${job.progress}%` : indeterminate ? `Processing ${formatTime(job.outTimeMs)}` : "Starting…"}
                      {job.bytes > 0 ? ` · ${formatBytes(job.bytes)}` : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
