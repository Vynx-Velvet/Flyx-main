import { describe, it, expect } from "vitest";
import { buildRemuxArgs } from "./ffmpeg";

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
