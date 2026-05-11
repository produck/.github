#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function printUsage() {
  console.error(
    [
      'Usage:',
      '  node scripts/summarize-log.mjs --file <logFile>',
      '  [--last <lineCount>] [--match <regex>] [--max <lineCount>]',
      '',
      'Examples:',
      '  node scripts/summarize-log.mjs --file logs/test.stdout.log --last 80',
      '  node scripts/summarize-log.mjs --file logs/test.stdout.log \\',
      '    --match "FAIL|ERROR" --max 120',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const args = {
    file: '',
    last: 0,
    match: '',
    max: 200,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--file' && next) {
      args.file = next;
      i += 1;
      continue;
    }
    if (token === '--last' && next) {
      args.last = Number(next);
      i += 1;
      continue;
    }
    if (token === '--match' && next) {
      args.match = next;
      i += 1;
      continue;
    }
    if (token === '--max' && next) {
      args.max = Number(next);
      i += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      return { help: true };
    }
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printUsage();
  process.exit(0);
}

if (!args.file) {
  printUsage();
  process.exit(2);
}

const filePath = path.resolve(args.file);
if (!fs.existsSync(filePath)) {
  console.error(`Log file does not exist: ${filePath}`);
  process.exit(2);
}

const raw = fs.readFileSync(filePath, 'utf8');
const allLines = raw.split(/\r?\n/);
const totalLines = allLines.length;

let lines = allLines;
let mode = 'all';

if (args.match) {
  const pattern = new RegExp(args.match, 'i');
  lines = allLines.filter((line) => pattern.test(line));
  mode = 'match';
}

if (args.last > 0) {
  lines = lines.slice(-args.last);
  mode = mode === 'match' ? 'match+last' : 'last';
}

if (args.max > 0 && lines.length > args.max) {
  lines = lines.slice(0, args.max);
}

const header = [
  `# file: ${filePath}`,
  `# totalLines: ${totalLines}`,
  `# selectedLines: ${lines.length}`,
  `# mode: ${mode}`,
  '',
].join('\n');

process.stdout.write(header);
process.stdout.write(lines.join('\n'));
process.stdout.write('\n');
