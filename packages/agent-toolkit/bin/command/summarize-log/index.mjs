import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');

export function printSummarizeHelp() {
  printTextResource(HELP_FILE);
}

export function runSummarize(options) {
  const file = getSingle(options, '--file', '');
  const last = Number(getSingle(options, '--last', '0')) || 0;
  const match = getSingle(options, '--match', '');
  const max = Number(getSingle(options, '--max', '200')) || 200;

  if (!file) {
    printSummarizeHelp();
    process.exit(2);
  }

  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.error(`Log file does not exist: ${filePath}`);
    process.exit(2);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const allLines = raw.split(/\r?\n/);

  let lines = allLines;
  let mode = 'all';

  if (match) {
    const pattern = new RegExp(match, 'i');
    lines = allLines.filter((line) => pattern.test(line));
    mode = 'match';
  }

  if (last > 0) {
    lines = lines.slice(-last);
    mode = mode === 'match' ? 'match+last' : 'last';
  }

  if (max > 0 && lines.length > max) {
    lines = lines.slice(0, max);
  }

  const header = [
    `# file: ${filePath}`,
    `# totalLines: ${allLines.length}`,
    `# selectedLines: ${lines.length}`,
    `# mode: ${mode}`,
    '',
  ].join('\n');

  process.stdout.write(header);
  process.stdout.write(lines.join('\n'));
  process.stdout.write('\n');
}
