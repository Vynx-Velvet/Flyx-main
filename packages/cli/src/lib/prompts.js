/**
 * Flyx CLI — Interactive prompt helpers.
 *
 * Uses node:readline/promises. Supports hidden password input,
 * select menus, and confirm prompts.
 */

const readline = require("readline/promises");
const { stdin, stdout } = require("process");

function createRL() {
  return readline.createInterface({ input: stdin, output: stdout });
}

/** Ask a free-text question. Returns trimmed answer or empty string. */
async function ask(question, { defaultValue = "" } = {}) {
  const rl = createRL();
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  const answer = await rl.question(prompt);
  rl.close();
  // Drain any leftover data from stdin (e.g. multi-line paste residue)
  // so it doesn't bleed into the next prompt.
  if (stdin.readableLength > 0) {
    stdin.read(stdin.readableLength);
  }
  return answer.trim() || defaultValue;
}

/** Ask a password question with masked input. */
async function askPassword(question) {
  // Don't use readline — it conflicts with raw-mode stdin processing.
  // Instead, handle raw keystrokes directly with a plain accumulator.
  const wasRaw = stdin.isRaw; // capture before entering raw mode
  return new Promise((resolve) => {
    stdout.write(`${question}: `);

    let password = "";

    const onData = (buf) => {
      // Raw mode on Windows delivers one byte per event for ASCII;
      // on Unix it's also one byte. Process each byte individually.
      for (const byte of buf) {
        // Enter / Return
        if (byte === 0x0d || byte === 0x0a) {
          stdin.removeListener("data", onData);
          if (!wasRaw) stdin.setRawMode(false);
          stdout.write("\n");
          resolve(password);
          return;
        }
        // Backspace / Delete
        if (byte === 0x7f || byte === 0x08) {
          if (password.length > 0) {
            password = password.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        // Ignore other control characters (ESC, TAB, etc.)
        if (byte < 0x20 && byte !== 0x0d && byte !== 0x0a) continue;

        password += String.fromCharCode(byte);
        stdout.write("*");
      }
    };

    stdin.on("data", onData);
    stdin.setRawMode(true);
    stdin.resume();
  }).finally(() => {
    // Always restore cooked mode so subsequent readline prompts work.
    if (!wasRaw && stdin.isRaw) {
      stdin.setRawMode(false);
    }
    stdin.pause();
  });
}

/** Ask yes/no. Returns boolean. */
async function confirm(question, { defaultYes = true } = {}) {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = await ask(`${question} [${hint}]`);
  const a = answer.toLowerCase();
  if (a === "y" || a === "yes") return true;
  if (a === "n" || a === "no") return false;
  return defaultYes;
}

/** Show a numbered list, return the selected value. */
async function select(question, options) {
  console.log(`\n${question}`);
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt.label}`);
  });
  const answer = await ask("Choose", { defaultValue: "1" });
  const idx = parseInt(answer, 10) - 1;
  if (idx >= 0 && idx < options.length) return options[idx].value;
  return options[0].value;
}

/** Print a consistent step header. */
function step(number, total, title) {
  console.log(`\n  ── Step ${number}/${total}: ${title} ──\n`);
}

module.exports = { ask, askPassword, confirm, select, step };
