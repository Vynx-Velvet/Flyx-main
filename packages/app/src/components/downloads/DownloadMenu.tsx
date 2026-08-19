"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DownloadItemInput } from "@/lib/downloads/types";
import { deliverDownloads } from "@/lib/downloads/client";
import { qualityScore } from "@/lib/downloads/source-picker";

interface Props {
  item?: DownloadItemInput;
  items?: DownloadItemInput[];
  label?: React.ReactNode;
  queuedLabel?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  /** Which edge of the button the menu hangs from. */
  menuAlign?: "left" | "right";
}

interface QualityOption {
  label: string;
  value?: string;
}

type State = "idle" | "queuing" | "queued" | "started" | "error";

interface SourceMeta {
  quality?: string;
  language?: string;
  url?: string;
}

export default function DownloadMenu({
  item,
  items,
  label = "Download",
  queuedLabel = "✓ Queued",
  className,
  style,
  title,
  menuAlign = "left",
}: Props) {
  const list = items ?? (item ? [item] : []);
  const video = list.find(
    (i): i is Extract<DownloadItemInput, { kind: "video" }> => i.kind === "video",
  );
  const isAnime = Boolean(video?.malId);

  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<SourceMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [audio, setAudio] = useState<"sub" | "dub">(video?.language ?? "sub");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  async function loadQualities() {
    if (!video || loading || loaded) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set("tmdbId", String(video.tmdbId));
      q.set("mediaType", video.mediaType);
      if (video.season) q.set("season", String(video.season));
      if (video.episode) q.set("episode", String(video.episode));
      if (video.malId) q.set("malId", String(video.malId));
      if (video.title) q.set("title", video.title);
      const res = await fetch(`/api/stream/extract?${q.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      setSources((data?.sources ?? []) as SourceMeta[]);
    } catch {
      setSources([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Qualities for the selected audio track (anime), or all sources otherwise.
  const activeAudio = isAnime ? audio : undefined;
  // Providers either tag every source with an audio language (animex) or none.
  const hasAnyAudioTag = sources.some((s) => s.language);
  const audioSources = isAnime
    ? sources.filter((s) => (s.language || "sub") === activeAudio)
    : sources;
  // Only fall back to all sources when the provider doesn't tag audio at all;
  // a tagged provider with no matching track must not silently download the
  // other track.
  const qualitySources = hasAnyAudioTag ? audioSources : sources;

  const options: QualityOption[] = (() => {
    const seen = new Map<string, number>();
    for (const s of qualitySources) {
      if (!s?.url) continue;
      const label = (s.quality || "").trim();
      if (!label) continue;
      seen.set(label, Math.max(seen.get(label) ?? 0, qualityScore(label)));
    }
    const sorted = [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([q]) => ({ label: q, value: q }));
    return [{ label: "Best available" }, ...sorted];
  })();

  async function choose(quality?: string) {
    setOpen(false);
    if (state === "queuing" || state === "started") return;
    const toSend = list.map((i) =>
      i.kind === "video"
        ? { ...i, quality, ...(isAnime ? { language: activeAudio } : {}) }
        : i,
    );
    setState("queuing");
    setError("");
    const result = await deliverDownloads(toSend);
    if (!result.ok) {
      setError(result.error ?? "Failed to queue download");
      setState("error");
      return;
    }
    if (result.host) {
      setState("queued");
    } else {
      setState("started");
      setTimeout(() => setState("idle"), 2500);
    }
  }

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    void loadQualities();
  };

  if (state === "queued") {
    return (
      <Link
        href="/downloads"
        className={className}
        style={style}
        title="View downloads"
        onClick={(e) => e.stopPropagation()}
      >
        {queuedLabel}
      </Link>
    );
  }

  const busy = state === "queuing" || state === "started";

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        className={className}
        style={style}
        title={title ?? (error || "Download to this device")}
        disabled={busy}
      >
        {state === "queuing"
          ? "Queuing…"
          : state === "started"
            ? "Downloading…"
            : label}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            ...(menuAlign === "right" ? { right: 0 } : { left: 0 }),
            zIndex: 60,
            minWidth: 200,
            maxHeight: 340,
            overflowY: "auto",
            padding: "6px",
            borderRadius: 12,
            background:
              "linear-gradient(180deg, rgba(16,16,24,0.98), rgba(8,8,14,0.98))",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow:
              "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,229,191,0.06)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!isAnime && (
            <p
              style={{
                margin: "4px 8px 6px",
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.35)",
              }}
            >
              Download quality
            </p>
          )}

          {isAnime && (
            <>
              <p
                style={{
                  margin: "4px 8px 6px",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.35)",
                }}
              >
                Audio
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  padding: "0 4px",
                  marginBottom: 8,
                }}
              >
                {(["sub", "dub"] as const).map((a) => {
                  const active = audio === a;
                  return (
                    <button
                      key={a}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => setAudio(a)}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        borderRadius: 8,
                        border: active
                          ? "1px solid rgba(0,229,191,0.45)"
                          : "1px solid rgba(255,255,255,0.1)",
                        background: active
                          ? "rgba(0,229,191,0.12)"
                          : "transparent",
                        color: active ? "#00e5bf" : "rgba(255,255,255,0.7)",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        cursor: "pointer",
                      }}
                    >
                      {a === "sub" ? "Sub" : "Dub"}
                    </button>
                  );
                })}
              </div>
              <p
                style={{
                  margin: "0 8px 6px",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.35)",
                }}
              >
                Quality
              </p>
            </>
          )}

          {loading && !loaded ? (
            <p
              style={{
                padding: "8px 12px",
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              Loading qualities…
            </p>
          ) : isAnime && hasAnyAudioTag && audioSources.length === 0 && sources.length > 0 ? (
            <p
              style={{
                padding: "8px 12px",
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              No {audio} sources available.
            </p>
          ) : (
            options.map((opt, i) => (
              <button
                key={opt.value ?? "best"}
                type="button"
                role="menuitem"
                onClick={() => void choose(opt.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "none",
                  background:
                    i === 0 && !opt.value ? "rgba(0,229,191,0.1)" : "transparent",
                  color:
                    i === 0 && !opt.value
                      ? "#00e5bf"
                      : "rgba(255,255,255,0.85)",
                  fontSize: "0.82rem",
                  fontWeight: 500,
                  textAlign: "left",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!(i === 0 && !opt.value)) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(255,255,255,0.06)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    i === 0 && !opt.value ? "rgba(0,229,191,0.1)" : "transparent";
                }}
              >
                {opt.value ?? "Best available"}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
