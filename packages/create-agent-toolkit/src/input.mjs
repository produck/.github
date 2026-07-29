import fs from 'node:fs';
import { createInterface } from 'node:readline';

/**
 * Prompt the user for input via readline (TTY mode only).
 * @param {string} question
 * @param {string} defaultValue
 * @returns {Promise<string>}
 */
/* c8 ignore start */
export function prompt(question, defaultValue = '') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const display = defaultValue
    ? `${question} (${defaultValue}): `
    : `${question}: `;
  return new Promise((resolve) => {
    rl.question(display, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}
/* c8 ignore stop */

/**
 * Read all lines from piped stdin synchronously.
 * @returns {string[]}
 */
export function readPipedLines() {
  const raw = fs.readFileSync(process.stdin.fd, 'utf8');
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' || raw.includes('\n\n'));
}
