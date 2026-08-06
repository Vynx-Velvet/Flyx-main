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
  return answer.trim() || defaultValue;
}

/** Ask a password question with masked input. */
async function askPassword(question) {
  // Use raw mode on stdin to disable echo
  const rl = createRL();
  // Write the prompt manually so we can mask
  return new Promise((resolve) => {
    stdout.write(`${question}: `);
    const onData = (char) => {
      const c = char.toString();
      // Enter
      if (c === "\r" || c === "\n") {
        stdin.removeListener("data", onData);
        stdin.setRawMode(false);
        rl.close();
        stdout.write("\n");
        resolve(rl.line);
        return;
      }
      // Backspace
      if (c === "\x7f" || c === "\b") {
        if (rl.line.length > 0) {
          rl.line = rl.line.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }
      rl.line += c;
      stdout.write("*");
    };
    stdin.setRawMode(true);
    stdin.on("data", onData);
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

module.exports = { ask, askPassword, confirm, select };
