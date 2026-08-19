#!/usr/bin/env node
/**
 * Flyx CLI — Manage your streaming server instance.
 *
 * Usage: flyx <command> [options]
 *
 * Commands:
 *   setup       Interactive first-time setup
 *   start       Start the Flyx server
 *   stop        Stop the server
 *   status      Show server status and URLs
 *   accounts    Manage user accounts
 *   config      View/edit configuration
 *   logs        View server logs
 *   update      Rebuild standalone server
 *   reset       Factory reset
 */

const { Command } = require("commander");
const path = require("path");
const fs = require("fs");

// Suppress experimental warning spam from Node 22
process.removeAllListeners("warning");

const program = new Command();

program
  .name("flyx")
  .description("Flyx — Privacy-first streaming server manager")
  .version("3.0.3")
  .addHelpCommand("help [command]", "Show help for a command");

// ── setup ───────────────────────────────────────────────────────

program
  .command("setup")
  .description("Interactive first-time setup wizard")
  .option("--tmdb-key <key>", "TMDB API key")
  .option("--mode <mode>", "private or shared")
  .option("--network <mode>", "localhost or lan")
  .option("--username <name>", "Admin username")
  .option("--password <pw>", "Admin password")
  .option("--host-key <key>", "Host key for account creation")
  .option("--force", "Overwrite existing config")
  .option("--no-start", "Don't offer to start after setup")
  .action(async (options) => {
    const { default: setup } = require("./src/commands/setup");
    await setup(options);
  });

// ── start ────────────────────────────────────────────────────────

program
  .command("start")
  .description("Start the Flyx server")
  .option("-d, --daemon", "Run in background")
  .option("-p, --port <port>", "Port to listen on", parseInt)
  .option("--hostname <host>", "Hostname to bind to")
  .action(async (options) => {
    const { default: start } = require("./src/commands/start");
    await start(options);
  });

// ── stop ─────────────────────────────────────────────────────────

program
  .command("stop")
  .description("Stop the Flyx server")
  .option("--force", "Force kill")
  .action(async (options) => {
    const { default: stop } = require("./src/commands/stop");
    await stop(options);
  });

// ── restart ──────────────────────────────────────────────────────

program
  .command("restart")
  .description("Restart the Flyx server")
  .option("-d, --daemon", "Run in background")
  .action(async (options) => {
    const { default: stop } = require("./src/commands/stop");
    const { default: start } = require("./src/commands/start");
    await stop();
    await start(options);
  });

// ── status ───────────────────────────────────────────────────────

program
  .command("status")
  .description("Show server status and network URLs")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    const { default: status } = require("./src/commands/status");
    await status(options);
  });

// ── accounts ─────────────────────────────────────────────────────

const accountsCmd = program
  .command("accounts")
  .description("Manage user accounts");

accountsCmd
  .command("add <username>")
  .description("Create a new account")
  .option("--admin", "Make this user an admin")
  .option("--password <pw>", "Password (will prompt if omitted)")
  .option("--json", "Output as JSON")
  .action(async (username, options) => {
    const { addAccount } = require("./src/commands/accounts");
    await addAccount(username, options);
  });

accountsCmd
  .command("list")
  .description("List all accounts")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    const { listAllAccounts } = require("./src/commands/accounts");
    listAllAccounts(options);
  });

accountsCmd
  .command("remove <username>")
  .description("Delete an account")
  .option("--yes", "Skip confirmation")
  .action(async (username, options) => {
    const { removeAccount } = require("./src/commands/accounts");
    await removeAccount(username, options);
  });

accountsCmd
  .command("reset-password <username>")
  .description("Reset a user's password")
  .option("--password <pw>", "New password (will prompt if omitted)")
  .action(async (username, options) => {
    const { resetPassword } = require("./src/commands/accounts");
    await resetPassword(username, options);
  });

// ── config ───────────────────────────────────────────────────────

program
  .command("config [action] [key] [value]")
  .description("View or edit configuration")
  .option("--json", "Output as JSON")
  .option("--show-secrets", "Show secret values unmasked")
  .action(async (action, key, value, options) => {
    const { showConfig, setConfig } = require("./src/commands/config");
    if (action === "set" && key) {
      await setConfig(key, value, options);
    } else {
      await showConfig(options);
    }
  });

// ── logs ─────────────────────────────────────────────────────────

program
  .command("logs")
  .description("View server logs")
  .option("-n, --lines <n>", "Number of lines to show", parseInt, 50)
  .option("-f, --follow", "Follow log output (tail -f)")
  .action(async (options) => {
    const { default: logs } = require("./src/commands/logs");
    await logs(options);
  });

// ── update ───────────────────────────────────────────────────────

program
  .command("update")
  .description("Pull latest from GitHub and rebuild the server")
  .option("--no-git", "Skip git pull, just rebuild")
  .option("--remote <url>", "Git remote URL to pull from")
  .option("--branch <name>", "Branch to track (default: current branch)")
  .option("--force", "Discard local changes without prompting")
  .action(async (options) => {
    const { default: update } = require("./src/commands/update");
    await update(options);
  });

// ── reset ────────────────────────────────────────────────────────

program
  .command("reset")
  .description("Factory reset — delete all Flyx data")
  .option("--yes", "Skip confirmation")
  .option("--keep-env", "Keep .env file")
  .action(async (options) => {
    const { default: reset } = require("./src/commands/reset");
    await reset(options);
  });

// ── Parse ────────────────────────────────────────────────────────

// If no command given, auto-detect first run
if (process.argv.length <= 2) {
  const { envExists } = require("./src/lib/env-file");

  if (!envExists()) {
    // First run — walk the user through setup
    console.log(`
  ╔══════════════════════════════════════╗
  ║     Welcome to Flyx 3.0!  🎬        ║
  ╚══════════════════════════════════════╝

  Looks like this is your first time running Flyx.
  Let's get everything set up — it only takes a minute.
`);
    const { default: setup } = require("./src/commands/setup");
    setup().then(() => process.exit(0));
    return;
  }

  // Already configured — show help
  console.log(`
  ╔══════════════════════════════════════╗
  ║        Flyx 3.0 — Streaming Hub      ║
  ╚══════════════════════════════════════╝

  Get started:

    flyx setup     Re-run setup
    flyx start     Launch the server
    flyx status    Check what's running

  Manage:

    flyx accounts  Create and manage user accounts
    flyx config    View or change settings
    flyx logs      View server logs
    flyx update    Rebuild the server
    flyx reset     Factory reset

  Run 'flyx help' for the full command list.
`);
  process.exit(0);
}

program.parse();
