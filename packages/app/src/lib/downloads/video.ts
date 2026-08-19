/**
 * Video download — reuse the same extraction pipeline as /api/stream/extract,
 * pick the best source, then either stream an MP4 straight to disk or remux
 * HLS/DASH through the local stream proxy (which handles Referer/Origin and
 * VidSrc token generation) using ffmpeg.
 */

import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import type { ExtractionRequest, StreamSource } from "@flyx/core";
import { ExtractionPipeline } from "@flyx/extractors";
import { providerRegistry } from "@flyx/providers";
import "@flyx/providers/providers";
import { remuxWithFfmpeg } from "./ffmpeg";
import { pickBestSource } from "./source-picker";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const pipeline = new ExtractionPipeline(providerRegistry);

export interface VideoDownloadRequest {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  malId?: number;
  title?: string;
  provider?: string;
  durationSec?: number;
  quality?: string;
  language?: "sub" | "dub";
}

function toExtractionRequest(req: VideoDownloadRequest): ExtractionRequest {
  return {
    tmdbId: req.tmdbId,
    mediaType: req.mediaType,
    season: req.season,
    episode: req.episode,
    malId: req.malId,
    title: req.title,
  };
}

function buildProxyUrl(source: StreamSource): string {
  const port = process.env.PORT || "3891";
  const params = new URLSearchParams();
  params.set("url", source.url);
  if (source.referer) params.set("referer", source.referer);
  if (source.origin) params.set("origin", source.origin);
  return `http://127.0.0.1:${port}/api/stream/proxy?${params.toString()}`;
}

function streamToFile(
  url: string,
  headers: Record<string, string>,
  dest: string,
  onProgress: (p: { bytes: number; totalBytes: number }) => void,
  signal?: AbortSignal,
): Promise<void> {
  return fetch(url, { headers, signal, redirect: "follow" }).then(async (res) => {
    if (!res.ok || !res.body) {
      throw new Error(`upstream returned HTTP ${res.status}`);
    }
    const total = Number(res.headers.get("content-length") || 0);
    let bytes = 0;
    const out = createWriteStream(dest);
    const body = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);

    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        body.destroy(new Error("cancelled"));
      };
      if (signal) {
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      }
      body.on("data", (c: Buffer) => {
        bytes += c.length;
        onProgress({ bytes, totalBytes: total });
      });
      body.on("error", reject);
      out.on("error", reject);
      out.on("finish", () => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      });
      body.pipe(out);
    });
  });
}

/**
 * Sniff an HLS/DASH playlist for HEVC (hvc1/hev1/dvh1/dvhe) codec strings.
 *
 * HEVC survives `-c copy` into MP4 but won't play on many devices, so we
 * re-encode those instead. Providers rarely set `source.isHevc`, so this
 * fallback peeks at the manifest directly.
 */
export async function sourceNeedsReencode(source: StreamSource): Promise<boolean> {
  if (source.isHevc) return true;
  if (source.type !== "hls" && source.type !== "dash") return false;
  try {
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": source.userAgent || UA,
        ...(source.referer ? { Referer: source.referer } : {}),
        ...(source.origin ? { Origin: source.origin } : {}),
      },
      redirect: "follow",
    });
    if (!res.ok) return false;
    const text = await res.text();
    return /(?:hvc1|hev1|hevc|dvh1|dvhe)/i.test(text);
  } catch {
    return false;
  }
}

export async function downloadVideo(
  req: VideoDownloadRequest,
  dest: string,
  onProgress: (p: {
    bytes: number;
    totalBytes: number;
    outTimeMs: number;
    durationSec?: number;
  }) => void,
  signal?: AbortSignal,
): Promise<StreamSource> {
  const result = await pipeline.extract(toExtractionRequest(req), {
    provider: req.provider,
    signal,
  });
  if (!result.success || result.sources.length === 0) {
    throw new Error("No stream sources found for this title");
  }
  let candidates = result.sources;
  if (req.language) {
    const lang = candidates.filter((s) => s.language === req.language);
    if (lang.length > 0) candidates = lang;
    else if (candidates.some((s) => s.language)) {
      throw new Error(`No ${req.language} audio sources found for this title`);
    }
    // Provider doesn't tag audio — fall through with all sources.
  }
  const source = pickBestSource(candidates, req.quality);
  if (!source) throw new Error("No playable source found");

  if (source.type === "mp4") {
    await streamToFile(
      source.url,
      {
        "User-Agent": source.userAgent || UA,
        ...(source.referer ? { Referer: source.referer } : {}),
        ...(source.origin ? { Origin: source.origin } : {}),
      },
      dest,
      ({ bytes, totalBytes }) =>
        onProgress({ bytes, totalBytes, outTimeMs: 0, durationSec: req.durationSec }),
      signal,
    );
  } else {
    const reencode = await sourceNeedsReencode(source);
    await remuxWithFfmpeg(
      buildProxyUrl(source),
      dest,
      {
        Referer: source.referer || "",
        Origin: source.origin || "",
        "User-Agent": source.userAgent || UA,
      },
      {
        signal,
        reencode,
        onProgress: ({ outTimeMs }) =>
          onProgress({ bytes: 0, totalBytes: 0, outTimeMs, durationSec: req.durationSec }),
      },
    );
  }

  return source;
}
