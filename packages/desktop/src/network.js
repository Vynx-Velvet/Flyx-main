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
    for (const [, ifaces] of Object.entries(nets)) {
      if (!ifaces) continue;
      for (const iface of ifaces) {
        if (iface.internal || iface.family !== "IPv4") continue;
        results.push({
          address: iface.address,
          netmask: iface.netmask,
          family: "IPv4",
          interface: iface.name || "",
        });
      }
    }
  } catch {}
  return results;
}

function getLANURLs(port) {
  const p = port || PORT;
  return getLocalIPs().map((ip) => ({
    url: `http://${ip.address}:${p}`,
    address: ip.address,
  }));
}

function getLocalURL(port) {
  return `http://localhost:${port || PORT}`;
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port, "127.0.0.1");
  });
}

module.exports = { getLocalIPs, getLANURLs, getLocalURL, isPortInUse };
