/**
 * flyx logs — View and tail server logs.
 */

const fs = require("fs");
const { serverLog } = require("../lib/paths");

async function runLogs(options = {}) {
  const lines = options.lines || 50;
  const follow = options.follow || false;

  if (!fs.existsSync(serverLog)) {
    console.log("No server log yet. Start Flyx first: flyx start");
    return;
  }

  // Print last N lines
  const content = fs.readFileSync(serverLog, "utf-8");
  const allLines = content.split("\n").filter(Boolean);
  const recent = allLines.slice(-lines);

  for (const line of recent) {
    console.log(line);
  }

  if (!follow) return;

  // Tail mode: watch for new lines
  console.log(`\n── Following ${serverLog} (Ctrl+C to stop) ──\n`);

  let lastSize = fs.statSync(serverLog).size;

  const watcher = fs.watch(serverLog, () => {
    try {
      const stat = fs.statSync(serverLog);
      if (stat.size > lastSize) {
        const stream = fs.createReadStream(serverLog, {
          start: lastSize,
          end: stat.size,
          encoding: "utf-8",
        });
        stream.on("data", (chunk) => {
          process.stdout.write(chunk);
        });
        lastSize = stat.size;
      } else if (stat.size < lastSize) {
        // File was truncated/rotated
        lastSize = 0;
      }
    } catch {}
  });

  process.on("SIGINT", () => {
    watcher.close();
    process.exit(0);
  });
}

module.exports = { default: runLogs };
