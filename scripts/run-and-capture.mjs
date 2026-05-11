#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function printUsage() {
  console.error(
    [
      'Usage:',
      '  node scripts/run-and-capture.mjs --out <logFile> --cmd <command>',
      '  [--cwd <directory>] [--meta <metaFile>] [--allow-pipe]',
      '',
      'Example:',
      '  node scripts/run-and-capture.mjs \\',
      '    --out logs/test.stdout.log \\',
      '    --meta logs/test.meta.json \\',
      '    --cmd "npm run test"',
      '',
      'Notes:',
      '  By default, shell pipes are blocked for reliability.',
      '  Add --allow-pipe only when a pipe is intentionally required.',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const args = {
    out: '',
    cmd: '',
    cwd: process.cwd(),
    meta: '',
    allowPipe: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--out' && next) {
      args.out = next;
      i += 1;
      continue;
    }
    if (token === '--cmd' && next) {
      args.cmd = next;
      i += 1;
      continue;
    }
    if (token === '--cwd' && next) {
      args.cwd = next;
      i += 1;
      continue;
    }
    if (token === '--meta' && next) {
      args.meta = next;
      i += 1;
      continue;
    }
    if (token === '--allow-pipe') {
      args.allowPipe = true;
      continue;
    }
    if (token === '--help' || token === '-h') {
      return { help: true };
    }
  }

  return args;
}

const parsed = parseArgs(process.argv.slice(2));
if (parsed.help) {
  printUsage();
  process.exit(0);
}

if (!parsed.out || !parsed.cmd) {
  printUsage();
  process.exit(2);
}

if (!parsed.allowPipe && parsed.cmd.includes('|')) {
  console.error(
    'Blocked command containing pipe. Use two-phase flow or pass --allow-pipe.'
  );
  process.exit(2);
}

const outPath = path.resolve(parsed.out);
const metaPath = parsed.meta
  ? path.resolve(parsed.meta)
  : `${outPath}.meta.json`;
const workDir = path.resolve(parsed.cwd);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.mkdirSync(path.dirname(metaPath), { recursive: true });

const startAt = Date.now();
const outStream = fs.createWriteStream(outPath, { encoding: 'utf8' });

outStream.write(`# command: ${parsed.cmd}\n`);
outStream.write(`# cwd: ${workDir}\n`);
outStream.write(`# startedAt: ${new Date(startAt).toISOString()}\n\n`);

const child = spawn(parsed.cmd, {
  cwd: workDir,
  shell: true,
  env: process.env,
});

let stdoutBytes = 0;
let stderrBytes = 0;

child.stdout.on('data', (chunk) => {
  stdoutBytes += chunk.length;
  outStream.write(chunk);
});

child.stderr.on('data', (chunk) => {
  stderrBytes += chunk.length;
  outStream.write(chunk);
});

child.on('error', (error) => {
  outStream.write(`\n[run-and-capture] spawn error: ${error.message}\n`);
});

child.on('close', (code, signal) => {
  const endAt = Date.now();
  const durationMs = endAt - startAt;
  outStream.write('\n');
  outStream.write(`# finishedAt: ${new Date(endAt).toISOString()}\n`);
  outStream.write(`# exitCode: ${String(code)}\n`);
  outStream.write(`# signal: ${signal ? String(signal) : 'none'}\n`);
  outStream.end();

  const meta = {
    command: parsed.cmd,
    cwd: workDir,
    startedAt: new Date(startAt).toISOString(),
    finishedAt: new Date(endAt).toISOString(),
    durationMs,
    exitCode: code,
    signal,
    stdoutBytes,
    stderrBytes,
    outputFile: outPath,
  };

  fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  if (typeof code === 'number') {
    process.exit(code);
  }
  process.exit(1);
});
