/**
 * Sandboxed runner for upstream-supplied WASM decryptors (VidSrc).
 *
 * The VidSrc API hands us a WASM binary chosen by the upstream and we must run
 * its `decrypt()` to recover stream URLs. Running that on the server's main
 * thread would let a hostile or broken module hang or exhaust the process, so
 * compile + instantiate + decrypt happen in a short-lived worker thread with
 * V8 heap limits and a wall-clock timeout (the worker is terminated, freeing
 * its WASM memory, when it overruns).
 *
 * The worker is created from an inline source string (`eval: true`) so the
 * runner survives bundling (Next standalone output) — there is no separate
 * worker file to resolve at runtime.
 */

import { Worker } from "node:worker_threads";

/** Largest WASM binary we accept (the real decryptor is ~7 KB). */
export const MAX_WASM_BYTES = 10 * 1024 * 1024;
/** Largest initial linear memory a module may declare (64 KiB pages → 64 MB). */
export const MAX_WASM_INITIAL_PAGES = 1024;
/**
 * Hard ceiling on every linear memory's maximum (64 KiB pages → 64 MB). WASM
 * memory is off-heap, so V8 resourceLimits do not cover it; the host rewrites
 * each memory's limits to this cap. The real VidSrc decryptor declares
 * `min 4, no max` and needs a handful of pages for a few-KB ciphertext, so
 * 64 MB is ample headroom while bounding the worst case to
 * MAX_CONCURRENT_WORKERS × 64 MB.
 */
export const MAX_WASM_MEMORY_PAGES = 1024;
const WASM_PAGE_BYTES = 65536;
/** Wall-clock budget for one compile + decrypt. */
export const WASM_TIMEOUT_MS = 5000;
/** Max decryptor workers alive at once; further calls queue. */
const MAX_CONCURRENT_WORKERS = 4;
/** Largest plaintext we read back out of WASM memory. */
const MAX_PLAINTEXT_BYTES = 1024 * 1024;

const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
try {
  const mod = new WebAssembly.Module(workerData.wasm);
  const inst = new WebAssembly.Instance(mod, {});
  const ex = inst.exports;
  if (typeof ex.alloc !== "function" || typeof ex.decrypt !== "function" || !(ex.memory instanceof WebAssembly.Memory)) {
    throw new Error("WASM module missing expected exports (alloc, decrypt, memory)");
  }
  const enc = workerData.enc;
  const ptr = ex.alloc(enc.length) >>> 0;
  if (ptr + enc.length > ex.memory.buffer.byteLength) throw new Error("WASM alloc returned out-of-bounds pointer");
  new Uint8Array(ex.memory.buffer, ptr, enc.length).set(enc);
  const outLen = ex.decrypt(ptr, enc.length) >>> 0;
  if (outLen > workerData.maxOut || ptr + 12 + outLen > ex.memory.buffer.byteLength) {
    throw new Error("WASM decrypt returned an invalid length");
  }
  // Defense in depth: limits are capped host-side, but never trust a result
  // produced after memory grew past the cap.
  if (ex.memory.buffer.byteLength > workerData.maxMem) throw new Error("WASM memory exceeded cap");
  const text = new TextDecoder().decode(new Uint8Array(ex.memory.buffer, ptr + 12, outLen));
  parentPort.postMessage({ ok: true, text });
} catch (e) {
  parentPort.postMessage({ ok: false, error: String((e && e.message) || e) });
}
`;

/** Read an unsigned LEB128 u32 bounded by `end`. Returns [value, nextOffset]. */
function readLeb(bytes: Uint8Array, off: number, end = bytes.length): [number, number] {
  let result = 0;
  let shift = 0;
  for (let i = 0; i < 5; i++) {
    if (off >= end) throw new Error("WASM: truncated LEB128");
    const b = bytes[off++]!;
    result += (b & 0x7f) * 2 ** shift;
    if (!(b & 0x80)) {
      if (result > 0xffffffff) throw new Error("WASM: LEB128 exceeds u32");
      return [result, off];
    }
    shift += 7;
  }
  throw new Error("WASM: malformed LEB128");
}

function writeLeb(n: number, out: number[]): void {
  do {
    let b = n & 0x7f;
    n = Math.floor(n / 128);
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
}

function readByte(bytes: Uint8Array, off: number, end: number): [number, number] {
  if (off >= end) throw new Error("WASM: truncated section");
  return [bytes[off]!, off + 1];
}

/** Skip a table limits entry (only flags 0x00/0x01, u32 min/max accepted). */
function skipTableLimits(bytes: Uint8Array, p: number, end: number): number {
  let flags: number;
  [flags, p] = readByte(bytes, p, end);
  if (flags & ~0x01) throw new Error(`WASM: unsupported table limits flags 0x${flags.toString(16)}`);
  [, p] = readLeb(bytes, p, end);
  if (flags & 1) [, p] = readLeb(bytes, p, end);
  return p;
}

/** Walk the import section; reject imported memories and unknown import kinds. */
function checkImports(bytes: Uint8Array, p: number, end: number): void {
  let count: number;
  [count, p] = readLeb(bytes, p, end);
  for (let i = 0; i < count; i++) {
    for (let n = 0; n < 2; n++) {
      let len: number;
      [len, p] = readLeb(bytes, p, end);
      p += len;
      if (p > end) throw new Error("WASM: truncated import name");
    }
    let kind: number;
    [kind, p] = readByte(bytes, p, end);
    switch (kind) {
      case 0x00: // func: typeidx
        [, p] = readLeb(bytes, p, end);
        break;
      case 0x01: // table: reftype + limits
        [, p] = readByte(bytes, p, end);
        p = skipTableLimits(bytes, p, end);
        break;
      case 0x02:
        throw new Error("WASM: imported memory is not allowed");
      case 0x03: // global: valtype + mut
        [, p] = readByte(bytes, p, end);
        [, p] = readByte(bytes, p, end);
        break;
      case 0x04: // tag: attribute + typeidx
        [, p] = readByte(bytes, p, end);
        [, p] = readLeb(bytes, p, end);
        break;
      default:
        throw new Error(`WASM: unknown import kind 0x${kind.toString(16)}`);
    }
  }
  if (p !== end) throw new Error("WASM: import section size mismatch");
}

/**
 * Parse the memory section and return a re-encoded payload with every memory
 * capped at MAX_WASM_MEMORY_PAGES, or null when nothing needed rewriting.
 */
function capMemories(bytes: Uint8Array, p: number, end: number): number[] | null {
  let count: number;
  [count, p] = readLeb(bytes, p, end);
  const out: number[] = [];
  writeLeb(count, out);
  let changed = false;
  for (let i = 0; i < count; i++) {
    let flags: number;
    [flags, p] = readByte(bytes, p, end);
    if (flags & 0x04) throw new Error("WASM: memory64 is not allowed");
    if (flags & 0x02) throw new Error("WASM: shared memory is not allowed");
    if (flags & ~0x01) throw new Error(`WASM: unsupported memory limits flags 0x${flags.toString(16)}`);
    let min: number;
    [min, p] = readLeb(bytes, p, end);
    let max: number | null = null;
    if (flags & 1) [max, p] = readLeb(bytes, p, end);
    if (min > MAX_WASM_INITIAL_PAGES) throw new Error(`WASM memory too large (${min} pages)`);
    const cappedMax = Math.min(max ?? MAX_WASM_MEMORY_PAGES, MAX_WASM_MEMORY_PAGES);
    if (min > cappedMax) throw new Error(`WASM memory min ${min} exceeds max ${cappedMax}`);
    if (max !== cappedMax) changed = true;
    out.push(0x01);
    writeLeb(min, out);
    writeLeb(cappedMax, out);
  }
  if (p !== end) throw new Error("WASM: memory section size mismatch");
  return changed ? out : null;
}

/**
 * Structural checks + memory capping before handing bytes to the worker.
 *
 * WASM linear memory lives outside the V8 heap, so the worker's
 * resourceLimits do not bound it: a module declaring no maximum could
 * `memory.grow` towards 4 GB before the timeout fires. We walk the section
 * list, reject imported / shared / 64-bit memories, and rewrite each defined
 * memory's limits to `max = min(declared ?? cap, MAX_WASM_MEMORY_PAGES)`.
 * All other bytes are copied verbatim. Returns the (possibly rewritten)
 * module; throws on anything unparseable or failing WebAssembly.validate.
 */
export function sanitizeWasmBinary(bytes: Uint8Array): Uint8Array {
  if (bytes.length > MAX_WASM_BYTES) throw new Error(`WASM binary too large (${bytes.length} bytes)`);
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d
  ) {
    throw new Error("Not a WASM binary");
  }
  if (bytes[4] !== 0x01 || bytes[5] !== 0x00 || bytes[6] !== 0x00 || bytes[7] !== 0x00) {
    throw new Error("WASM: unsupported binary version");
  }
  const chunks: Uint8Array[] = [];
  let copyFrom = 0;
  let off = 8;
  while (off < bytes.length) {
    const sectionStart = off;
    const id = bytes[off++]!;
    let size: number;
    [size, off] = readLeb(bytes, off);
    const end = off + size;
    if (end > bytes.length) throw new Error("WASM: truncated section");
    if (id === 2) {
      checkImports(bytes, off, end);
    } else if (id === 5) {
      const payload = capMemories(bytes, off, end);
      if (payload) {
        chunks.push(bytes.subarray(copyFrom, sectionStart));
        const head = [5];
        writeLeb(payload.length, head);
        chunks.push(Uint8Array.from([...head, ...payload]));
        copyFrom = end;
      }
    }
    off = end;
  }
  let out = bytes;
  if (chunks.length > 0) {
    chunks.push(bytes.subarray(copyFrom));
    out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
  }
  const view = out.buffer instanceof ArrayBuffer ? (out as Uint8Array<ArrayBuffer>) : new Uint8Array(out);
  if (!WebAssembly.validate(view)) throw new Error("WASM: module failed validation");
  return out;
}

/** Throw-only form of {@link sanitizeWasmBinary}. */
export function validateWasmBinary(bytes: Uint8Array): void {
  sanitizeWasmBinary(bytes);
}

let active = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT_WORKERS) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
}

function release(): void {
  const next = waiters.shift();
  if (next) next();
  else active--;
}

/**
 * Compile `wasm`, call `alloc(len)` + `decrypt(ptr, len)` on `enc` inside a
 * resource-limited worker and return the plaintext (read from ptr + 12).
 */
export async function runWasmDecrypt(
  wasm: Uint8Array,
  enc: Uint8Array,
  timeoutMs = WASM_TIMEOUT_MS,
): Promise<string> {
  const safeWasm = sanitizeWasmBinary(wasm);
  await acquire();
  try {
    return await new Promise<string>((resolve, reject) => {
      const worker = new Worker(WORKER_SOURCE, {
        eval: true,
        workerData: {
          wasm: safeWasm,
          enc,
          maxOut: MAX_PLAINTEXT_BYTES,
          maxMem: MAX_WASM_MEMORY_PAGES * WASM_PAGE_BYTES,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: 64,
          maxYoungGenerationSizeMb: 16,
          codeRangeSizeMb: 16,
          stackSizeMb: 4,
        },
      });
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void worker.terminate();
        fn();
      };
      const timer = setTimeout(
        () => finish(() => reject(new Error(`WASM decrypt timed out after ${timeoutMs} ms`))),
        timeoutMs,
      );
      worker.once("message", (msg: { ok: boolean; text?: string; error?: string }) => {
        finish(() => (msg.ok ? resolve(msg.text ?? "") : reject(new Error(msg.error || "WASM decrypt failed"))));
      });
      worker.once("error", (err) => finish(() => reject(err)));
      worker.once("exit", (code) =>
        finish(() => reject(new Error(`WASM worker exited early (code ${code})`))),
      );
    });
  } finally {
    release();
  }
}
