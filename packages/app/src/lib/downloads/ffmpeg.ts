/**
 * ffmpeg resolution + remux runner.
 *
 * Resolution order: FLYX_FFMPEG_PATH → bundled next to the standalone server
 * (<STANDALONE_DIR>/ffmpeg) → `ffmpeg` on PATH. The desktop main process
 * sets FLYX_FFMPEG_PATH when it ships a binary via extraResources.
 */

import { spawn, type ChildProcess } from "node:child_process";
import type { Readable } from "node:stream";
import fs from "node:fs";
import path from "node:path";

export function resolveFfmpeg(): string | null {
  const explicit = process.env.FLYX_FFMPEG_PATH;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const bin = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  // The desktop server's cwd is <STANDALONE_DIR>/packages/app, so the bundled
  // binary sits at <STANDALONE_DIR>/ffmpeg/<bin>.
  const bundled = path.resolve(process.cwd(), "..", "..", "ffmpeg", bin);
  if (fs.existsSync(bundled)) return bundled;

  return "ffmpeg"; // PATH fallback (spawn will fail if absent)
}

export function hasFfmpeg(): Promise<boolean> {
  const bin = resolveFfmpeg();
  if (!bin) return Promise.resolve(false);
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, ["-version"], { stdio: "ignore" });
    } catch {
      resolve(false);
      return;
    }
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

interface FfmpegProgress {
  outTimeMs: number;
  fps: number;
}

function parseProgressLine(
  line: string,
  state: { outTimeMs: number; fps: number },
): void {
  const eq = line.indexOf("=");
  if (eq === -1) return;
  const key = line.slice(0, eq).trim();
  const value = line.slice(eq + 1).trim();
  if (key === "out_time_ms" || key === "out_time_us") {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) state.outTimeMs = key === "out_time_us" ? Math.floor(n / 1000) : n;
  } else if (key === "fps") {
    const n = parseFloat(value);
    if (Number.isFinite(n)) state.fps = n;
  }
}

interface RunOptions {
  onProgress?: (p: FfmpegProgress) => void;
  signal?: AbortSignal;
  /** Skip the `-c copy` attempts and re-encode straight to H.264/AAC. */
  reencode?: boolean;
}

export type RemuxMode = "copy" | "copy-bsf" | "encode";

/**
 * Build the ffmpeg argument vector for a remux/encode run.
 *
 * Pure (no process spawn) so the fallback logic is unit-testable:
 *  - "copy"     — stream-copy streams into an MP4 container.
 *  - "copy-bsf" — same, with the AAC bitstream filter (fixes ADTS AAC).
 *  - "encode"   — re-encode to H.264/AAC for maximum compatibility (HEVC etc).
 *
 * `stream` toggles fragmented-MP4-to-stdout (no seekable output) vs a
 * seekable file with `+faststart`.
 */
export function buildRemuxArgs(
  mode: RemuxMode,
  input: string,
  output: string,
  headers: Record<string, string>,
  opts: { stream?: boolean } = {},
): string[] {
  const headerStr = Object.entries(headers)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\r\n");

  const args = [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-progress", opts.stream ? "pipe:2" : "pipe:1",
  ];
  if (headerStr) args.push("-headers", headerStr + "\r\n");

  args.push("-i", input);

  if (mode === "encode") {
    args.push(
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-c:a", "aac",
      "-b:a", "128k",
    );
  } else {
    args.push("-c", "copy");
    if (mode === "copy-bsf") args.push("-bsf:a", "aac_adtstoasc");
  }

  args.push(
    "-movflags", opts.stream ? "frag_keyframe+empty_moov" : "+faststart",
    "-max_muxing_queue_size", "9999",
  );
  if (opts.stream) args.push("-f", "mp4");
  args.push(output);

  return args;
}

function runOnce(args: string[], opts: RunOptions): Promise<number> {
  const bin = resolveFfmpeg();
  if (!bin) return Promise.reject(new Error("ffmpeg is not available"));

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      reject(err);
      return;
    }

    const state = { outTimeMs: 0, fps: 0 };
    let stderr = "";
    let buf = "";

    child.stdout.on("data", (d: Buffer) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) {
          parseProgressLine(line, state);
          opts.onProgress?.({ outTimeMs: state.outTimeMs, fps: state.fps });
        }
      }
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });

    const onAbort = () => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already dead */
      }
    };
    if (opts.signal) {
      if (opts.signal.aborted) onAbort();
      else opts.signal.addEventListener("abort", onAbort, { once: true });
    }

    child.on("error", (err) => {
      opts.signal?.removeEventListener("abort", onAbort);
      reject(err);
    });
    child.on("exit", (code) => {
      opts.signal?.removeEventListener("abort", onAbort);
      if (opts.signal?.aborted) {
        reject(new Error("cancelled"));
        return;
      }
      if (code === 0) {
        resolve(0);
      } else {
        reject(new Error(stderr.trim().split("\n").slice(-3).join(" ") || `ffmpeg exited ${code}`));
      }
    });
  });
}

/**
 * Remux `input` to a live MP4 byte stream (for direct-to-device downloads).
 *
 * Unlike `remuxWithFfmpeg` (which writes to a seekable file with `+faststart`),
 * this pipes fragmented MP4 to stdout — `frag_keyframe+empty_moov` lets it
 * stream without seeking back to rewrite the moov atom, and `-progress pipe:2`
 * keeps progress off stdout so stdout carries only media bytes.
 */
export function remuxToStream(
  input: string,
  headers: Record<string, string>,
  opts: RunOptions = {},
): Promise<{ stream: Readable; abort: () => void }> {
  const signal = opts.signal;
  const bin = resolveFfmpeg();
  if (!bin) return Promise.reject(new Error("ffmpeg is not available"));

  const args = buildRemuxArgs(
    opts.reencode ? "encode" : "copy",
    input,
    "pipe:1",
    headers,
    { stream: true },
  );

  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err) {
      reject(err);
      return;
    }

    let stderr = "";
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });

    const kill = () => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already dead */
      }
    };
    const onAbort = () => kill();
    if (signal) {
      if (signal.aborted) kill();
      else signal.addEventListener("abort", onAbort);
    }
    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    child.once("error", (err) => {
      cleanup();
      reject(err);
    });
    child.once("spawn", () => {
      resolve({ stream: child.stdout as Readable, abort: kill });
      child.stdout?.once("close", cleanup);
      child.once("exit", () => {
        cleanup();
        // Surface an early ffmpeg failure (bad URL / no streams) as a stream
        // error so the response terminates instead of hanging on a dead pipe.
        if (child.exitCode !== 0 && stderr) {
          child.stdout?.destroy(
            new Error(
              stderr.trim().split("\n").slice(-3).join(" ") ||
                `ffmpeg exited ${child.exitCode}`,
            ),
          );
        }
      });
    });
  });
}

/**
 * Download/remux `input` to `output`. `headers` are sent on the upstream
 * request (Referer/Origin/User-Agent).
 *
 * Fallback chain (skip straight to encode when `opts.reencode` is set):
 *   1. `-c copy` (fast, lossless)
 *   2. `-c copy` + AAC bitstream filter (fixes ADTS-AAC sources)
 *   3. re-encode to H.264/AAC (HEVC or otherwise un-muxable streams)
 */
export async function remuxWithFfmpeg(
  input: string,
  output: string,
  headers: Record<string, string>,
  opts: RunOptions,
): Promise<void> {
  const modes: RemuxMode[] = opts.reencode
    ? ["encode"]
    : ["copy", "copy-bsf", "encode"];

  let lastErr: unknown;
  for (const mode of modes) {
    try {
      await runOnce(buildRemuxArgs(mode, input, output, headers), opts);
      return;
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("ffmpeg failed");
}
