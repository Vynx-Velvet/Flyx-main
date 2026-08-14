import { describe, it, expect, vi, beforeEach } from "vitest";
import net from "net";
import os from "os";
import { resetDesktopModules } from "./helpers.js";

beforeEach(() => {
  resetDesktopModules();
  vi.restoreAllMocks();
});

describe("network", () => {
  it("lists IPv4 non-loopback addresses only", async () => {
    vi.spyOn(os, "networkInterfaces").mockReturnValue({
      Ethernet: [
        { address: "192.168.1.5", netmask: "255.255.255.0", family: "IPv4", internal: false },
        { address: "fe80::1", family: "IPv6", internal: false },
      ],
      "Loopback Pseudo-Interface 1": [
        { address: "127.0.0.1", family: "IPv4", internal: true },
      ],
    });

    const { getLocalIPs, getLANURLs, getLocalURL } = await import("../src/network.js");
    const ips = getLocalIPs();
    expect(ips).toHaveLength(1);
    expect(ips[0].address).toBe("192.168.1.5");

    expect(getLANURLs(3900)).toEqual([
      { url: "http://192.168.1.5:3900", address: "192.168.1.5" },
    ]);
    expect(getLocalURL(3900)).toBe("http://localhost:3900");
  });

  it("isPortInUse detects a listening port", async () => {
    const { isPortInUse } = await import("../src/network.js");

    // Free port
    const probe = net.createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    expect(await isPortInUse(port)).toBe(true); // probe itself is listening
    await new Promise((resolve) => probe.close(resolve));
    expect(await isPortInUse(port)).toBe(false);
  });
});
