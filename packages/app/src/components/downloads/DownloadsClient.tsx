"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DownloadJob } from "@/lib/downloads/types";
import { isDesktopHost } from "@/lib/downloads/client";

interface FolderInfo {
  dir: string;
  custom: string | null;
  defaultDir: string;
}

type QueueFilter = "all" | "active" | "finished";

const ACTIVE_STATUSES = new Set(["queued", "downloading", "processing"]);

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function statusLabel(status: DownloadJob["status"]): string {
  if (status === "done") return "Ready";
  if (status === "processing") return "Finishing";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function DownloadsClient() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [folder, setFolder] = useState<FolderInfo | null>(null);
  const [folderInput, setFolderInput] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);
  const [folderMessage, setFolderMessage] = useState("");
  const [error, setError] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [filter, setFilter] = useState<QueueFilter>("all");

  useEffect(() => setIsHost(isDesktopHost()), []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/downloads", { cache: "no-store" });
      if (response.ok) {
        const result = await response.json();
        setJobs(result.jobs ?? []);
        setError("");
      } else if (response.status === 403) {
        setError(
          isDesktopHost() ? "Administrator access is required to manage host downloads." : "",
        );
      }
    } catch {
      setError("The download queue is temporarily unavailable.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    void fetch("/api/settings/downloads")
      .then((response) => response.json())
      .then((result: FolderInfo) => {
        setFolder(result);
        setFolderInput(result.dir || "");
      })
      .catch(() => undefined);
  }, []);

  const activeCount = jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length;
  const completedCount = jobs.filter((job) => job.status === "done").length;
  const failedCount = jobs.filter((job) => job.status === "error").length;
  const visibleJobs = useMemo(() => {
    if (filter === "active") return jobs.filter((job) => ACTIVE_STATUSES.has(job.status));
    if (filter === "finished") return jobs.filter((job) => !ACTIVE_STATUSES.has(job.status));
    return jobs;
  }, [filter, jobs]);

  async function saveFolder() {
    setSavingFolder(true);
    setFolderMessage("");
    try {
      const response = await fetch("/api/settings/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir: folderInput }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not save this folder");
      setFolder((current) =>
        current ? { ...current, dir: result.dir, custom: folderInput.trim() || null } : current,
      );
      setFolderMessage("Download folder saved");
    } catch (reason) {
      setFolderMessage(reason instanceof Error ? reason.message : "Could not save this folder");
    } finally {
      setSavingFolder(false);
    }
  }

  async function resetFolder() {
    if (!folder) return;
    setFolderInput(folder.defaultDir);
    setSavingFolder(true);
    try {
      const response = await fetch("/api/settings/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dir: "" }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not reset the folder");
      setFolder({ ...folder, dir: result.dir, custom: null });
      setFolderInput(result.dir);
      setFolderMessage("Using the default Downloads folder");
    } catch (reason) {
      setFolderMessage(reason instanceof Error ? reason.message : "Could not reset the folder");
    } finally {
      setSavingFolder(false);
    }
  }

  async function removeJob(jobId: string) {
    await fetch(`/api/downloads/${jobId}`, { method: "DELETE" });
    await refresh();
  }

  async function clearFinished() {
    const finishedJobs = jobs.filter((job) => !ACTIVE_STATUSES.has(job.status));
    await Promise.all(
      finishedJobs.map((job) => fetch(`/api/downloads/${job.id}`, { method: "DELETE" })),
    );
    await refresh();
  }

  return (
    <main className="downloads-page content-container">
      <header className="downloads-header">
        <div>
          <span className="downloads-eyebrow">Offline library</span>
          <h1>Downloads</h1>
          <p>Save movies and episodes, follow their progress, and manage completed files.</p>
        </div>
        <Link href="/browse" className="btn-primary">
          Find something to download
        </Link>
      </header>

      <section className="downloads-stats" aria-label="Download summary">
        <div>
          <span>Active</span>
          <strong>{activeCount}</strong>
          <small>{activeCount === 1 ? "item downloading" : "items downloading"}</small>
        </div>
        <div>
          <span>Ready</span>
          <strong>{completedCount}</strong>
          <small>saved to this computer</small>
        </div>
        <div>
          <span>Needs attention</span>
          <strong>{failedCount}</strong>
          <small>{failedCount ? "check failed items" : "everything looks good"}</small>
        </div>
      </section>

      {isHost && (
        <section className="download-destination">
          <div className="download-destination-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
              <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2" />
            </svg>
          </div>
          <div className="download-destination-copy">
            <span>Save location</span>
            <strong>Choose where finished files are stored</strong>
            <small>Downloads started from this desktop app are written to this folder.</small>
          </div>
          <div className="download-folder-field">
            <input
              value={folderInput}
              onChange={(event) => setFolderInput(event.target.value)}
              placeholder={folder?.defaultDir || "Downloads folder"}
              aria-label="Download folder"
            />
            <button type="button" onClick={() => void saveFolder()} disabled={savingFolder}>
              {savingFolder ? "Saving…" : "Save folder"}
            </button>
            {folder?.custom && (
              <button
                type="button"
                className="secondary"
                onClick={() => void resetFolder()}
                disabled={savingFolder}
              >
                Use default
              </button>
            )}
          </div>
          {folderMessage && <p className="download-folder-message">{folderMessage}</p>}
        </section>
      )}

      {!isHost && (
        <section className="download-device-note">
          <strong>Downloads go directly to this device</strong>
          <span>
            Because you opened Flyx in a browser, your browser manages downloaded files instead of
            the desktop queue.
          </span>
        </section>
      )}

      {error && (
        <div className="downloads-error" role="alert">
          {error}
        </div>
      )}

      <section className="download-queue">
        <div className="download-queue-toolbar">
          <div>
            <h2>Download queue</h2>
            <span>
              {jobs.length} total item{jobs.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="download-filter" role="tablist" aria-label="Filter downloads">
            {(["all", "active", "finished"] as QueueFilter[]).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={filter === option}
                className={filter === option ? "active" : undefined}
                onClick={() => setFilter(option)}
              >
                {option === "all" ? "All" : option === "active" ? "In progress" : "Finished"}
              </button>
            ))}
          </div>
          {jobs.some((job) => !ACTIVE_STATUSES.has(job.status)) && (
            <button type="button" className="download-clear" onClick={() => void clearFinished()}>
              Clear finished
            </button>
          )}
        </div>

        {visibleJobs.length === 0 ? (
          <div className="download-empty">
            <span className="download-empty-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 3v11m0 0 4-4m-4 4-4-4M4 19h16" />
              </svg>
            </span>
            <h3>{jobs.length ? "No downloads match this filter" : "Your queue is empty"}</h3>
            <p>Open any movie or episode and choose Download to add it here.</p>
            {!jobs.length && (
              <Link href="/browse" className="btn-secondary">
                Browse movies and shows
              </Link>
            )}
          </div>
        ) : (
          <div className="download-job-list">
            {visibleJobs.map((job) => {
              const active = ACTIVE_STATUSES.has(job.status);
              const indeterminate =
                (job.status === "downloading" || job.status === "processing") &&
                job.progress === 0 &&
                job.outTimeMs > 0;
              return (
                <article key={job.id} className={`download-job download-job-${job.status}`}>
                  <div className="download-job-icon" aria-hidden>
                    {job.kind === "video" ? "▶" : "▤"}
                  </div>
                  <div className="download-job-main">
                    <div className="download-job-heading">
                      <div>
                        <h3>{job.label}</h3>
                        <p>
                          {job.kind === "video" ? "Video" : "Manga"}
                          {job.quality ? ` · ${job.quality}` : ""}
                          {job.language ? ` · ${job.language.toUpperCase()}` : ""}
                        </p>
                      </div>
                      <span className="download-job-status">{statusLabel(job.status)}</span>
                    </div>
                    {active && (
                      <div className="download-progress">
                        <div>
                          <span
                            className={indeterminate ? "indeterminate" : undefined}
                            style={indeterminate ? undefined : { width: `${job.progress}%` }}
                          />
                        </div>
                        <p>
                          {job.progress > 0
                            ? `${job.progress}%`
                            : indeterminate
                              ? `Processing ${formatTime(job.outTimeMs)}`
                              : "Starting…"}
                          {job.bytes > 0 ? ` · ${formatBytes(job.bytes)}` : ""}
                        </p>
                      </div>
                    )}
                    {job.error && <p className="download-job-error">{job.error}</p>}
                    {job.filepath && job.status === "done" && (
                      <code className="download-job-path">{job.filepath}</code>
                    )}
                  </div>
                  <button
                    type="button"
                    className={active ? "download-job-cancel" : "download-job-remove"}
                    onClick={() => void removeJob(job.id)}
                  >
                    {active ? "Cancel" : "Remove"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
