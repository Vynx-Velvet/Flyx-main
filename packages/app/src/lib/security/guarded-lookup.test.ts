import { describe, it, expect, beforeEach, vi } from "vitest";

const dnsLookup = vi.fn();
vi.mock("node:dns", () => ({ default: { lookup: (...a: unknown[]) => dnsLookup(...a) } }));

import { guardedLookup, BlockedUrlError } from "./safe-fetch";

type Result = { err: NodeJS.ErrnoException | null; address?: unknown; family?: number };

function run(host: string, options: object = {}): Promise<Result> {
  return new Promise((resolve) => {
    (guardedLookup as any)(host, options, (err: NodeJS.ErrnoException | null, address?: unknown, family?: number) =>
      resolve({ err, address, family }),
    );
  });
}

function resolvesTo(...addrs: string[]) {
  dnsLookup.mockImplementation((_h: string, _o: object, cb: (e: null, a: object[]) => void) =>
    cb(null, addrs.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }))),
  );
}

describe("guardedLookup (connect-time DNS rebinding guard)", () => {
  beforeEach(() => {
    dnsLookup.mockReset();
  });

  it("passes public addresses through in single and all modes", async () => {
    resolvesTo("93.184.215.14", "2606:2800:21f:cb07::1");
    const one = await run("example.com");
    expect(one.err).toBeNull();
    expect(one.address).toBe("93.184.215.14");
    expect(one.family).toBe(4);
    const all = await run("example.com", { all: true });
    expect(all.err).toBeNull();
    expect(all.address).toHaveLength(2);
    // always resolves every address so none can slip past the check
    expect(dnsLookup.mock.calls[0][1]).toMatchObject({ all: true });
  });

  it("blocks a host that resolves (or rebinds) to loopback / LAN", async () => {
    resolvesTo("127.0.0.1");
    expect((await run("127.0.0.1.nip.io")).err).toBeInstanceOf(BlockedUrlError);
    resolvesTo("192.168.1.10");
    expect((await run("rebind.example", { all: true })).err).toBeInstanceOf(BlockedUrlError);
    resolvesTo("::ffff:10.0.0.1");
    expect((await run("mapped.example")).err).toBeInstanceOf(BlockedUrlError);
  });

  it("blocks when ANY resolved address is private", async () => {
    resolvesTo("93.184.215.14", "169.254.169.254");
    expect((await run("mixed.example")).err).toBeInstanceOf(BlockedUrlError);
  });

  it("blocks an empty answer and propagates DNS errors", async () => {
    resolvesTo();
    expect((await run("empty.example")).err).toBeInstanceOf(BlockedUrlError);
    const enotfound = Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    dnsLookup.mockImplementation((_h: string, _o: object, cb: (e: Error) => void) => cb(enotfound));
    expect((await run("nx.example")).err).toBe(enotfound);
  });

  it("checks IP literals without DNS", async () => {
    expect((await run("127.0.0.1")).err).toBeInstanceOf(BlockedUrlError);
    expect((await run("[::1]")).err).toBeInstanceOf(BlockedUrlError);
    const pub = await run("8.8.8.8");
    expect(pub.err).toBeNull();
    expect(pub.address).toBe("8.8.8.8");
    expect(dnsLookup).not.toHaveBeenCalled();
  });
});
