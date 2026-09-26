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
