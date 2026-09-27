import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/auth/get-session", () => ({ getSession: async () => null }));

import { buildRemuxArgs, INPUT_PROTOCOL_WHITELIST, sanitizeHeaderValue } from "./ffmpeg";
import { buildLocalProxyUrl, isLocalProxyUrl } from "./proxy-url";
import { hasValidSignature } from "@/lib/security/proxy-sign";

const HEADERS = { Referer: "https://example.com", "User-Agent": "ua" };

describe("buildRemuxArgs", () => {
  it("builds a copy remux for a seekable file output", () => {
    const args = buildRemuxArgs("copy", "in.m3u8", "out.mp4", HEADERS);
    expect(args).toContain("-c");
    expect(args[args.indexOf("-c") + 1]).toBe("copy");
    expect(args).toContain("+faststart");
    expect(args).toContain("out.mp4");
    expect(args).toContain("-progress");
    expect(args[args.indexOf("-progress") + 1]).toBe("pipe:1");
    // headers are folded into a single CRLF-joined value after `-headers`
    const headerVal = args[args.indexOf("-headers") + 1];
    expect(headerVal).toContain("Referer: https://example.com");
  });

  it("adds the AAC bitstream filter in copy-bsf mode", () => {
    const copy = buildRemuxArgs("copy", "in", "out.mp4", {});
    const bsf = buildRemuxArgs("copy-bsf", "in", "out.mp4", {});
    expect(copy).not.toContain("aac_adtstoasc");
    expect(bsf).toContain("-bsf:a");
    expect(bsf[bsf.indexOf("-bsf:a") + 1]).toBe("aac_adtstoasc");
  });

  it("re-encodes to H.264/AAC in encode mode", () => {
    const args = buildRemuxArgs("encode", "in.m3u8", "out.mp4", {});
    expect(args).toContain("-c:v");
    expect(args[args.indexOf("-c:v") + 1]).toBe("libx264");
    expect(args).toContain("-preset");
    expect(args).toContain("veryfast");
    expect(args).toContain("-c:a");
    expect(args[args.indexOf("-c:a") + 1]).toBe("aac");
    expect(args).not.toContain("-c");
  });

  it("streams fragmented MP4 to stdout in stream mode", () => {
    const args = buildRemuxArgs("copy", "in.m3u8", "pipe:1", {}, { stream: true });
    expect(args).toContain("frag_keyframe+empty_moov");
    expect(args).toContain("-f");
    expect(args[args.indexOf("-f") + 1]).toBe("mp4");
    expect(args[args.length - 1]).toBe("pipe:1");
    // progress must stay off stdout so only media bytes flow through it
    expect(args[args.indexOf("-progress") + 1]).toBe("pipe:2");
  });
});

describe("buildRemuxArgs hardening", () => {
  it("whitelists network protocols (no file:) as an input option before -i", () => {
    const args = buildRemuxArgs("copy", "http://127.0.0.1:3891/api/stream/proxy?url=x", "out.mp4", {});
    const wl = args.indexOf("-protocol_whitelist");
    expect(wl).toBeGreaterThan(-1);
    expect(wl).toBeLessThan(args.indexOf("-i"));
    expect(args[wl + 1]).toBe(INPUT_PROTOCOL_WHITELIST);
    expect(INPUT_PROTOCOL_WHITELIST.split(",")).not.toContain("file");
  });

  it("strips CR/LF from header values so upstream data cannot inject headers", () => {
    const args = buildRemuxArgs("copy", "in", "out.mp4", {
      Referer: "https://a.example/\r\nX-Evil: 1",
      Origin: "https://a.example\n",
      "Bad Header\r\n": "v",
    });
    const headerVal = args[args.indexOf("-headers") + 1]!;
    const lines = headerVal.split("\r\n").filter(Boolean);
    expect(lines).toEqual(["Referer: https://a.example/X-Evil: 1", "Origin: https://a.example"]);
    expect(sanitizeHeaderValue("a\u0000b\tc\u007f")).toBe("abc");
  });

  it("caps file output size with -fs", () => {
    const args = buildRemuxArgs("copy", "in", "out.mp4", {}, { maxBytes: 1234 });
    expect(args[args.indexOf("-fs") + 1]).toBe("1234");
    expect(args.indexOf("-fs")).toBeLessThan(args.indexOf("out.mp4"));
  });
});

describe("local proxy input", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
    delete process.env.PORT;
  });

  it("builds a signed 127.0.0.1 proxy URL", () => {
    const url = buildLocalProxyUrl({ url: "https://cdn.example/a.m3u8", referer: "https://r.example/" });
    const u = new URL(url);
    expect(u.origin).toBe("http://127.0.0.1:3891");
    expect(u.pathname).toBe("/api/stream/proxy");
    expect(u.searchParams.get("url")).toBe("https://cdn.example/a.m3u8");
    expect(u.searchParams.get("sig")).toBeTruthy();
    expect(Number(u.searchParams.get("exp"))).toBeGreaterThan(Date.now() / 1000 + 24 * 3600);
    expect(hasValidSignature(url)).toBe(true);
    expect(isLocalProxyUrl(url)).toBe(true);
  });

  it("rejects any other ffmpeg input", () => {
    expect(isLocalProxyUrl("file:///etc/passwd")).toBe(false);
    expect(isLocalProxyUrl("https://cdn.example/a.m3u8")).toBe(false);
    expect(isLocalProxyUrl("http://127.0.0.1:3891/api/other?url=x")).toBe(false);
    expect(isLocalProxyUrl("http://127.0.0.1:9999/api/stream/proxy?url=x")).toBe(false);
    expect(isLocalProxyUrl("concat:a|b")).toBe(false);
  });
});
