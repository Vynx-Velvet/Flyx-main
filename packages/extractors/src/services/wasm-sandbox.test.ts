import { describe, it, expect } from "vitest";
import {
  MAX_WASM_BYTES,
  MAX_WASM_MEMORY_PAGES,
  runWasmDecrypt,
  sanitizeWasmBinary,
  validateWasmBinary,
} from "./wasm-sandbox";
import { validateWasmUrl } from "./vidsrc";

const HEADER = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

function section(id: number, body: number[]): number[] {
  return [id, body.length, ...body];
}

const str = (s: string) => [s.length, ...Buffer.from(s, "ascii")];

/**
 * Hand-assembled decryptor module:
 *   memory (min `pages`, or raw `limits` bytes), alloc(n) → 1024,
 *   decrypt(ptr, len) → `decryptBody`, optional extra sections before types.
 */
function buildModule(
  decryptBody: number[],
  pages = 1,
  limits: number[] = [0x00, ...leb(pages)],
  pre: number[] = [],
): Uint8Array {
  const types = section(1, [0x02, 0x60, 0x01, 0x7f, 0x01, 0x7f, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f]);
  const funcs = section(3, [0x02, 0x00, 0x01]);
  const mem = section(5, [0x01, ...limits]);
  const exports = section(7, [
    0x03,
    ...str("memory"), 0x02, 0x00,
    ...str("alloc"), 0x00, 0x00,
    ...str("decrypt"), 0x00, 0x01,
  ]);
  const alloc = [0x00, 0x41, 0x80, 0x08, 0x0b]; // i32.const 1024
  const dec = [0x00, ...decryptBody, 0x0b];
  const code = section(10, [0x02, alloc.length, ...alloc, dec.length, ...dec]);
  return new Uint8Array([...HEADER, ...types, ...pre, ...funcs, ...mem, ...exports, ...code]);
}

function leb(n: number): number[] {
  const out: number[] = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return out;
}

// decrypt(ptr, len) = len - 12  → plaintext is the input after the 12-byte "nonce"
const IDENTITY = [0x20, 0x01, 0x41, 0x0c, 0x6b];
// decrypt = loop { br 0 }  → never returns
const SPIN = [0x03, 0x40, 0x0c, 0x00, 0x0b, 0x41, 0x00];
// decrypt = loop { br_if 0 (memory.grow(1) != -1) }; return memory.size
const GROW_ALL = [0x03, 0x40, 0x41, 0x01, 0x40, 0x00, 0x41, 0x7f, 0x47, 0x0d, 0x00, 0x0b, 0x3f, 0x00];

describe("runWasmDecrypt", () => {
  it("runs alloc + decrypt in a worker and returns the plaintext", async () => {
    const nonce = new Uint8Array(12).fill(7);
    const enc = new Uint8Array([...nonce, ...Buffer.from("https://a/1.m3u8\nhttps://b/2.mp4", "utf8")]);
    const text = await runWasmDecrypt(buildModule(IDENTITY), enc);
    expect(text).toBe("https://a/1.m3u8\nhttps://b/2.mp4");
  });

  it("terminates a decryptor that never returns", async () => {
    const t0 = Date.now();
    await expect(runWasmDecrypt(buildModule(SPIN), new Uint8Array(32), 500)).rejects.toThrow(/timed out/);
    expect(Date.now() - t0).toBeLessThan(3000);
  });

  it("rejects modules missing the expected exports", async () => {
    const bare = new Uint8Array(HEADER);
    await expect(runWasmDecrypt(bare, new Uint8Array(16))).rejects.toThrow(/missing expected exports/);
  });

  it("rejects oversized binaries, bad magic and huge initial memory before running", () => {
    expect(() => validateWasmBinary(new Uint8Array(MAX_WASM_BYTES + 1))).toThrow(/too large/);
    expect(() => validateWasmBinary(new Uint8Array(16))).toThrow(/Not a WASM/);
    expect(() => validateWasmBinary(buildModule(IDENTITY, 60000))).toThrow(/memory too large/);
    expect(() => validateWasmBinary(buildModule(IDENTITY, 17))).not.toThrow();
  });
});

describe("sanitizeWasmBinary memory caps", () => {
  it("caps a memory with no maximum so memory.grow stops at the cap", async () => {
    const mod = buildModule(GROW_ALL, 1); // min 1, no max
    const safe = sanitizeWasmBinary(mod);
    expect(safe).not.toEqual(mod);
    const inst = new WebAssembly.Instance(new WebAssembly.Module(safe), {});
    const mem = inst.exports.memory as WebAssembly.Memory;
    expect(mem.buffer.byteLength).toBe(65536);

    const t0 = Date.now();
    // Plaintext length == final page count (bytes after ptr+12 are zeros).
    const text = await runWasmDecrypt(mod, new Uint8Array(16));
    expect(text.length).toBe(MAX_WASM_MEMORY_PAGES);
    expect(Date.now() - t0).toBeLessThan(4000);
  });

  it("clamps an oversized declared maximum and keeps min unchanged", () => {
    const safe = sanitizeWasmBinary(buildModule(IDENTITY, 2, [0x01, 0x02, ...leb(65536)]));
    const mem = new WebAssembly.Instance(new WebAssembly.Module(safe), {}).exports.memory as WebAssembly.Memory;
    expect(mem.buffer.byteLength).toBe(2 * 65536);
    expect(mem.grow(MAX_WASM_MEMORY_PAGES - 2)).toBe(2);
    expect(() => mem.grow(1)).toThrow();
  });

  it("leaves a module with a small maximum byte-for-byte unchanged", async () => {
    const mod = buildModule(GROW_ALL, 1, [0x01, 0x01, 0x10]); // max 16
    expect(sanitizeWasmBinary(mod)).toBe(mod);
    const text = await runWasmDecrypt(mod, new Uint8Array(16));
    expect(text.length).toBe(16);
    const nonce = new Uint8Array(12);
    const enc = new Uint8Array([...nonce, ...Buffer.from("https://x/y.m3u8")]);
    expect(await runWasmDecrypt(buildModule(IDENTITY, 1, [0x01, 0x01, 0x10]), enc)).toBe("https://x/y.m3u8");
  });

  it("rejects memory64 and shared memory", () => {
    expect(() => validateWasmBinary(buildModule(IDENTITY, 1, [0x04, 0x01]))).toThrow(/memory64/);
    expect(() => validateWasmBinary(buildModule(IDENTITY, 1, [0x05, 0x01, 0x10]))).toThrow(/memory64/);
    expect(() => validateWasmBinary(buildModule(IDENTITY, 1, [0x03, 0x01, 0x10]))).toThrow(/shared/);
    expect(() => validateWasmBinary(buildModule(IDENTITY, 1, [0x08, 0x01]))).toThrow(/unsupported memory/);
  });

  it("rejects imported memory", async () => {
    const imports = section(2, [0x01, ...str("env"), ...str("mem"), 0x02, 0x00, 0x01]);
    const mod = new Uint8Array([...HEADER, ...imports]);
    expect(() => validateWasmBinary(mod)).toThrow(/imported memory/);
    await expect(runWasmDecrypt(mod, new Uint8Array(16))).rejects.toThrow(/imported memory/);
  });

  it("rejects min above the cap", () => {
    expect(() => validateWasmBinary(buildModule(IDENTITY, 1, [0x01, 0x10, 0x08]))).toThrow(/exceeds max/);
  });

  it("rejects malformed section sizes", () => {
    const good = buildModule(IDENTITY, 1);
    // Section size runs past end of file.
    expect(() => validateWasmBinary(new Uint8Array([...HEADER, 0x01, 0x7f, 0x00]))).toThrow(/truncated/);
    // Memory section size too small for its payload.
    const typesAndFuncs = [...section(1, [0x01, 0x60, 0x00, 0x00])];
    expect(() => validateWasmBinary(new Uint8Array([...HEADER, ...typesAndFuncs, 0x05, 0x02, 0x01, 0x00, 0x01])))
      .toThrow(/WASM/);
    // Memory section size too large (trailing garbage inside the section).
    expect(() => validateWasmBinary(new Uint8Array([...HEADER, 0x05, 0x04, 0x01, 0x00, 0x01, 0xff]))).toThrow(
      /size mismatch/,
    );
    // Overlong / overflowing LEB128 section size.
    expect(() => validateWasmBinary(new Uint8Array([...HEADER, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0x0f]))).toThrow(
      /LEB128/,
    );
    // Truncated trailing bytes after an otherwise valid module fail validation.
    expect(() => validateWasmBinary(new Uint8Array([...good, 0x00]))).toThrow(/WASM/);
    // Wrong version.
    const v2 = new Uint8Array(good);
    v2[4] = 0x02;
    expect(() => validateWasmBinary(v2)).toThrow(/version/);
  });
});

describe("validateWasmUrl", () => {
  it("accepts the VidSrc API host over https", () => {
    expect(validateWasmUrl("https://data.vidsrcme.ru/wasm.php?w=1").hostname).toBe("data.vidsrcme.ru");
    expect(validateWasmUrl("/wasm.php?w=1").hostname).toBe("data.vidsrcme.ru");
  });

  it("rejects other hosts, schemes and credentials", () => {
    expect(() => validateWasmUrl("http://data.vidsrcme.ru/wasm.php")).toThrow(/https/);
    expect(() => validateWasmUrl("https://evil.example/wasm")).toThrow(/not allowed/);
    expect(() => validateWasmUrl("https://vidsrcme.ru.evil.example/wasm")).toThrow(/not allowed/);
    expect(() => validateWasmUrl("https://127.0.0.1/wasm")).toThrow(/not allowed/);
    expect(() => validateWasmUrl("https://u:p@data.vidsrcme.ru/wasm")).toThrow(/credentials/);
    expect(() => validateWasmUrl("file:///etc/passwd")).toThrow(/https/);
  });
});
