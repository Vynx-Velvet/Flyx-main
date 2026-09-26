"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { DownloadItemInput } from "@/lib/downloads/types";
import { deliverDownloads } from "@/lib/downloads/client";
import { qualityScore } from "@/lib/downloads/source-picker";

interface DownloadMenuProps {
  item?: DownloadItemInput;
  items?: DownloadItemInput[];
  label?: React.ReactNode;
  queuedLabel?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  menuAlign?: "left" | "right";
}

interface SourceMeta {
  quality?: string;
  language?: string;
  url?: string;
}

type DownloadState = "idle" | "queuing" | "queued" | "started" | "error";

function itemDescription(item: DownloadItemInput | undefined, count: number): string {
  if (!item) return `${count} items`;
  if (item.kind === "manga") {
    return count > 1 ? `${count} manga chapters` : `Chapter ${item.chapter}`;
  }
  if (count > 1) return `${count} episodes`;
  if (item.malId && item.episode) return `Episode ${item.episode}`;
  if (item.mediaType === "tv" && item.season && item.episode) {
    return `Season ${item.season}, Episode ${item.episode}`;
  }
  return "Movie";
}

export default function DownloadMenu({
  item,
  items,
  label = "Download",
  queuedLabel = "✓ Queued",
  className,
  style,
  title,
}: DownloadMenuProps) {
  const downloadItems = useMemo(() => items ?? (item ? [item] : []), [item, items]);
  const video = downloadItems.find(
    (candidate): candidate is Extract<DownloadItemInput, { kind: "video" }> =>
      candidate.kind === "video",
  );
  const isAnime = Boolean(video?.malId);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);
  const [audio, setAudio] = useState<"sub" | "dub">(video?.language ?? "sub");
  const [quality, setQuality] = useState<string | undefined>();
  const [state, setState] = useState<DownloadState>("idle");
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && state !== "queuing") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, state]);

  async function loadSources() {
    if (!video || loadingSources || sourcesLoaded) return;
    setLoadingSources(true);
    try {
      const query = new URLSearchParams();
      query.set("tmdbId", String(video.tmdbId));
      query.set("mediaType", video.mediaType);
      if (video.season) query.set("season", String(video.season));
      if (video.episode) query.set("episode", String(video.episode));
      if (video.malId) query.set("malId", String(video.malId));
      if (video.title) query.set("title", video.title);
      // Real deliverable qualities: generic HLS masters are expanded into
      // their 1080p/720p/… variants server-side (see /api/downloads/qualities).
      const response = await fetch(`/api/downloads/qualities?${query.toString()}`, {
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      const list = (result?.sources ?? []) as SourceMeta[];
      // Each entry needs a url-ish truthy value for the existing filters.
      setSources(list.map((s) => ({ ...s, url: s.url || "variant" })));
    } catch {
      setSources([]);
    } finally {
      setLoadingSources(false);
      setSourcesLoaded(true);
    }
  }

  function showDialog() {
    setError("");
    setOpen(true);
    void loadSources();
  }

  const taggedAudio = sources.some((source) => source.language);
  const audioSources = isAnime
    ? sources.filter((source) => (source.language || "sub") === audio)
    : sources;
  const eligibleSources = taggedAudio ? audioSources : sources;
  const qualityOptions = [
    ...new Set(
      eligibleSources
        .filter((source) => source.url && source.quality)
        .map((source) => source.quality as string),
    ),
  ].sort((first, second) => qualityScore(second) - qualityScore(first));

  async function confirmDownload() {
    if (downloadItems.length === 0 || state === "queuing") return;
    setState("queuing");
    setError("");
    const preparedItems = downloadItems.map((candidate) =>
      candidate.kind === "video"
        ? {
            ...candidate,
            quality,
            ...(isAnime ? { language: audio } : {}),
          }
        : candidate,
    );
    const result = await deliverDownloads(preparedItems);
    if (!result.ok) {
      setState("error");
      setError(result.error ?? "Flyx could not start this download.");
      return;
    }
    setState(result.host ? "queued" : "started");
    setOpen(false);
    if (!result.host) window.setTimeout(() => setState("idle"), 2500);
  }

  if (state === "queued") {
    return (
      <Link
        href="/downloads"
        className={className}
        style={style}
        title="View downloads"
        onClick={(event) => event.stopPropagation()}
      >
        {queuedLabel}
      </Link>
    );
  }

  const dialog = open ? (
    <div className="download-dialog-layer" role="presentation">
      <button
        type="button"
        className="download-dialog-backdrop"
        onClick={() => state !== "queuing" && setOpen(false)}
        aria-label="Close download options"
      />
      <section
        className="download-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-dialog-title"
      >
        <div className="download-dialog-handle" aria-hidden />
        <header className="download-dialog-header">
          <div className="download-dialog-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M12 3v11m0 0 4-4m-4 4-4-4M4 18v2h16v-2" />
            </svg>
          </div>
          <div>
            <span>{itemDescription(downloadItems[0], downloadItems.length)}</span>
            <h2 id="download-dialog-title">Download {video?.title || "content"}</h2>
          </div>
          <button
            type="button"
            className="download-dialog-close"
            onClick={() => setOpen(false)}
            disabled={state === "queuing"}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="download-dialog-body">
          {downloadItems.length > 1 && (
            <div className="download-bulk-notice">
              <strong>{downloadItems.length} episodes will be added to the queue</strong>
              <span>You can monitor or cancel each episode from Downloads.</span>
            </div>
          )}

          {isAnime && (
            <fieldset className="download-option-group">
              <legend>Audio</legend>
              <div className="download-segmented">
                {(["sub", "dub"] as const).map((audioOption) => (
                  <button
                    key={audioOption}
                    type="button"
                    className={audio === audioOption ? "active" : undefined}
                    onClick={() => {
                      setAudio(audioOption);
                      setQuality(undefined);
                    }}
                  >
                    <strong>{audioOption === "sub" ? "Subtitled" : "Dubbed"}</strong>
                    <span>{audioOption === "sub" ? "Original audio" : "English audio"}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {video && (
            <fieldset className="download-option-group">
              <legend>Video quality</legend>
              {loadingSources && !sourcesLoaded ? (
                <div className="download-quality-loading">
                  <span />
                  <p>Checking available qualities…</p>
                </div>
              ) : isAnime && taggedAudio && audioSources.length === 0 && sources.length > 0 ? (
                <div className="download-quality-empty">
                  No {audio === "dub" ? "dubbed" : "subtitled"} source is currently available.
                </div>
              ) : (
                <div className="download-quality-grid">
                  <button
                    type="button"
                    className={quality === undefined ? "active" : undefined}
                    onClick={() => setQuality(undefined)}
                  >
                    <span className="download-radio" />
                    <span>
                      <strong>Best available</strong>
                      <small>Recommended</small>
                    </span>
                  </button>
                  {qualityOptions.map((qualityOption) => (
                    <button
                      key={qualityOption}
                      type="button"
                      className={quality === qualityOption ? "active" : undefined}
                      onClick={() => setQuality(qualityOption)}
                    >
                      <span className="download-radio" />
                      <span>
                        <strong>{qualityOption}</strong>
                        <small>Use this quality</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          )}

          {error && (
            <div className="download-dialog-error" role="alert">
              {error}
            </div>
          )}
        </div>

        <footer className="download-dialog-footer">
          <button
            type="button"
            className="download-cancel"
            onClick={() => setOpen(false)}
            disabled={state === "queuing"}
          >
            Cancel
          </button>
          <button
            type="button"
            className="download-confirm"
            onClick={() => void confirmDownload()}
            disabled={state === "queuing" || downloadItems.length === 0}
          >
            {state === "queuing"
              ? "Adding to queue…"
              : `Download ${downloadItems.length > 1 ? `${downloadItems.length} episodes` : "now"}`}
          </button>
        </footer>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          showDialog();
        }}
        className={className}
        style={style}
        title={title ?? (error || "Download to this device")}
        disabled={state === "started"}
      >
        {state === "started" ? "Downloading…" : state === "error" ? "Try again" : label}
      </button>
      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}
