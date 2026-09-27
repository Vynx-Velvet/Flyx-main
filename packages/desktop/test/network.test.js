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
      "Loopback Pseudo-Interface 1": [{ address: "127.0.0.1", family: "IPv4", internal: true }],
    });

    const { getLocalIPs, getLANURLs, getLocalURL } = await import("../src/network.js");
    const ips = getLocalIPs();
    expect(ips).toHaveLength(1);
    expect(ips[0].address).toBe("192.168.1.5");

    expect(getLANURLs(3900)).toEqual([{ url: "http://192.168.1.5:3900", address: "192.168.1.5" }]);
    // Never "localhost" — it may resolve to [::1] (a different listener).
    expect(getLocalURL(3900)).toBe("http://127.0.0.1:3900");
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

  it("isPortInUse also detects a listener on the IPv6 loopback only", async () => {
    const { isPortInUse } = await import("../src/network.js");
    const probe = net.createServer();
    const listening = await new Promise((resolve) => {
      probe.once("error", () => resolve(false)); // no IPv6 on this machine
      probe.listen(0, "::1", () => resolve(true));
    });
    if (!listening) return;
    const port = probe.address().port;
    expect(await isPortInUse(port)).toBe(true);
    await new Promise((resolve) => probe.close(resolve));
    expect(await isPortInUse(port)).toBe(false);
  });

  it("prioritizes physical network adapters over virtual adapters", async () => {
    vi.spyOn(os, "networkInterfaces").mockReturnValue({
      "VirtualBox Host-Only Network": [
        {
          address: "192.168.56.1",
          netmask: "255.255.255.0",
          family: "IPv4",
          internal: false,
        },
      ],
      "Wi-Fi": [
        {
          address: "192.168.1.42",
          netmask: "255.255.255.0",
          family: "IPv4",
          internal: false,
        },
      ],
    });

    const { getLANURLs } = await import("../src/network.js");
    expect(getLANURLs(3891)[0].address).toBe("192.168.1.42");
  });
});
