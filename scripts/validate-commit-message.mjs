#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_TAGS = ['INIT', 'ADD', 'REMOVE', 'FIX', 'REFACTOR', 'UPGRADE'];
const ALLOWED_TARGETS = ['docs', 'test', 'ci', 'deps', 'api', 'schema', 'infra'];

function usage() {
  console.error(
    [
      'Usage:',
      '  node scripts/validate-commit-message.mjs --file <message-file>',
      '',
      'Rules:',
      '  - Every line must start with [TAG]',
      '  - No empty lines are allowed',
      '  - Optional target form: [TAG] <target>: <summary>',
      '',
      'Allowed tags:',
      `  ${ALLOWED_TAGS.map((t) => `[${t}]`).join(', ')}`,
      'Allowed targets:',
      `  ${ALLOWED_TARGETS.join(', ')}`,
    ].join('\n')
  );
}

function parseArgs(argv) {
  const args = { file: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--file' && next) {
      args.file = next;
      i += 1;
      continue;
    }
    if (token === '--help' || token === '-h') {
      return { help: true };
    }
  }
  return args;
}

function validateLine(line, lineNo) {
  if (line.trim() === '') {
    return `Line ${lineNo}: empty line is not allowed`;
  }

  const head = line.match(/^\[([A-Z]+)\]\s+/);
  if (!head) {
    return `Line ${lineNo}: must start with [TAG] followed by a space`;
  }

  const tag = head[1];
  if (!ALLOWED_TAGS.includes(tag)) {
    return `Line ${lineNo}: tag [${tag}] is not allowed`;
  }

  const rest = line.slice(head[0].length);
  if (rest.trim() === '') {
    return `Line ${lineNo}: summary is required after tag`;
  }

  const targetMatch = rest.match(/^<([^>]+)>:\s+(.+)$/);
  if (targetMatch) {
    const target = targetMatch[1];
    const summary = targetMatch[2];
    if (!ALLOWED_TARGETS.includes(target)) {
      return `Line ${lineNo}: target <${target}> is not allowed`;
    }
    if (summary.trim() === '') {
      return `Line ${lineNo}: summary is required after target`;
    }
  }

  return null;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.file) {
  usage();
  process.exit(args.help ? 0 : 2);
}

const filePath = path.resolve(args.file);
if (!fs.existsSync(filePath)) {
  console.error(`Message file not found: ${filePath}`);
  process.exit(2);
}

const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
const lines = raw.endsWith('\n') ? raw.slice(0, -1).split('\n') : raw.split('\n');

if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
  console.error('Commit message is empty');
  process.exit(2);
}

const errors = [];
for (let i = 0; i < lines.length; i += 1) {
  const err = validateLine(lines[i], i + 1);
  if (err) {
    errors.push(err);
  }
}

if (errors.length > 0) {
  console.error('Commit message validation failed:');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log('Commit message validation passed');
