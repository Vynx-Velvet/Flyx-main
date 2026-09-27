/**
 * Flyx Desktop — Network detection.
 *
 * Verbatim port of packages/cli/src/lib/network.js.
 */

const os = require("os");
const net = require("net");
const { PORT } = require("./paths");

function getLocalIPs() {
  const results = [];
  try {
    const nets = os.networkInterfaces();
    for (const [interfaceName, ifaces] of Object.entries(nets)) {
      if (!ifaces) continue;
      for (const iface of ifaces) {
        if (iface.internal || iface.family !== "IPv4") continue;
        results.push({
          address: iface.address,
          netmask: iface.netmask,
          family: "IPv4",
          interface: interfaceName,
        });
      }
    }
  } catch {}
  return results.sort((first, second) => scoreAddress(second) - scoreAddress(first));
}

function scoreAddress(candidate) {
  const name = candidate.interface || "";
  const address = candidate.address || "";
  let score = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(address) ? 20 : 0;
  if (/wi-?fi|wireless|wlan|ethernet|local area connection/i.test(name)) score += 12;
  if (
    /virtual|vmware|vbox|hyper-v|docker|wsl|loopback|tailscale|zerotier|vpn|bluetooth/i.test(name)
  )
    score -= 30;
  if (address.startsWith("169.254.")) score -= 50;
  return score;
}

function getLANURLs(port) {
  const p = port || PORT;
  return getLocalIPs().map((ip) => ({
    url: `http://${ip.address}:${p}`,
    address: ip.address,
  }));
}

/**
 * URL the desktop window loads. Always the literal 127.0.0.1 — never
 * "localhost", which Chromium may resolve to [::1] where a different local
 * process could be listening on the same port (and would then receive the
 * master cookie + the preload bridge). LAN URLs for other devices are
 * getLANURLs().
 */
function getLocalURL(port) {
  return `http://127.0.0.1:${port || PORT}`;
}

// Loopback addresses probed before we bind: our server listens on
// 127.0.0.1 (or 0.0.0.0), but anything already on the port — on either
// loopback family — is treated as an impostor/collision.
const LOOPBACK_HOSTS = ["127.0.0.1", "::1"];

/** Can we bind `host:port`? Resolves "busy" | "free" | "unavailable" (no IPv6). */
function probeListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => {
      const code = err && err.code;
      // No IPv6 loopback on this machine — nothing can listen there either.
      if (code === "EADDRNOTAVAIL" || code === "EAFNOSUPPORT" || code === "EINVAL") {
        resolve("unavailable");
      } else {
        resolve("busy");
      }
    });
    server.once("listening", () => {
      server.close(() => resolve("free"));
    });
    server.listen({ port, host, exclusive: true });
  });
}

/** Does something accept connections on `host:port`? */
function probeConnect(port, host, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    const done = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

/**
 * True when the port is taken on 127.0.0.1 OR ::1 — either a bind would
 * fail, or something already accepts connections there (a wildcard or
 * SO_REUSEADDR listener can let our own bind succeed while still sitting
 * in front of it).
 */
async function isPortInUse(port) {
  for (const host of LOOPBACK_HOSTS) {
    if ((await probeListen(port, host)) === "busy") return true;
  }
  for (const host of LOOPBACK_HOSTS) {
    if (await probeConnect(port, host)) return true;
  }
  return false;
}

module.exports = { getLocalIPs, getLANURLs, getLocalURL, isPortInUse, LOOPBACK_HOSTS };
