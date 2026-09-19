import readline from "node:readline";

/**
 * One line from the person at the terminal. Hidden input never reaches the
 * screen or the scrollback — only its length is shown, so a paste that went
 * wrong is still noticeable. When stdin isn't a terminal (a test piping
 * answers in) lines are read plainly.
 */

const CTRL_C = 3;
const BACKSPACE = 8;
const DELETE = 127;
const ENTER = [10, 13];
const ERASE = `${String.fromCharCode(BACKSPACE)} ${String.fromCharCode(BACKSPACE)}`;

let piped: AsyncIterator<string> | null = null;

export async function ask(question: string, hidden = false): Promise<string> {
  process.stdout.write(question);
  if (!process.stdin.isTTY) {
    piped ??= readline.createInterface({ input: process.stdin })[Symbol.asyncIterator]();
    const next = await piped.next();
    process.stdout.write("\n");
    return next.done ? "" : next.value.trim();
  }
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (code === CTRL_C) {
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        if (ENTER.includes(code)) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write(hidden && value ? `  (${value.length} characters, hidden)\n` : "\n");
          return resolve(value.trim());
        }
        if (code === DELETE || code === BACKSPACE) {
          if (value && !hidden) process.stdout.write(ERASE);
          value = value.slice(0, -1);
        } else if (code >= 32) {
          value += ch;
          if (!hidden) process.stdout.write(ch);
        }
      }
    };
    stdin.on("data", onData);
  });
}
