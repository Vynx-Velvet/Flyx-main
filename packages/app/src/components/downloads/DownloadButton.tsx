"use client";

import { useState } from "react";
import Link from "next/link";
import type { DownloadItemInput } from "@/lib/downloads/types";
import { deliverDownloads } from "@/lib/downloads/client";

interface Props {
  item?: DownloadItemInput;
  items?: DownloadItemInput[];
  label?: React.ReactNode;
  queuedLabel?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

type State = "idle" | "queuing" | "queued" | "started" | "error";

export default function DownloadButton({
  item,
  items,
  label = "Download",
  queuedLabel = "✓ Queued",
  className,
  style,
  title,
}: Props) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState("");

  const list = items ?? (item ? [item] : []);

  async function handleClick() {
    if (state === "queuing" || state === "queued" || state === "started") return;
    setState("queuing");
    setError("");
    const result = await deliverDownloads(list);
    if (!result.ok) {
      setError(result.error ?? "Failed to queue download");
      setState("error");
      return;
    }
    if (result.host) {
      // Queued on the host — link to the Downloads page to track progress.
      setState("queued");
    } else {
      // The file is streaming straight to this device already.
      setState("started");
      setTimeout(() => setState("idle"), 2500);
    }
  }

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

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void handleClick();
      }}
      className={className}
      style={style}
      title={title ?? (error || "Download to this device")}
      disabled={state === "queuing" || state === "started"}
    >
      {state === "queuing"
        ? "Queuing…"
        : state === "started"
          ? "Downloading…"
          : label}
    </button>
  );
}
