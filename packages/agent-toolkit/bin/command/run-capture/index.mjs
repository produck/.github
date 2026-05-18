import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');

export function printRunCaptureHelp() {
  printTextResource(HELP_FILE);
}

export function runCapture(options) {
  const out = getSingle(options, '--out', '');
  const cmd = getSingle(options, '--cmd', '');
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const meta = getSingle(options, '--meta', '');
  const allowPipe = hasFlag(options, '--allow-pipe');

  if (!out || !cmd) {
    printRunCaptureHelp();
    process.exit(2);
  }

  if (!allowPipe && cmd.includes('|')) {
    console.error(
      'Blocked command containing pipe. Use --allow-pipe if needed.',
    );
    process.exit(2);
  }

  const outPath = path.resolve(out);
  const metaPath = meta ? path.resolve(meta) : `${outPath}.meta.json`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.mkdirSync(path.dirname(metaPath), { recursive: true });

  const startAt = Date.now();
  const outStream = fs.createWriteStream(outPath, { encoding: 'utf8' });

  outStream.write(`# command: ${cmd}\n`);
  outStream.write(`# cwd: ${cwd}\n`);
  outStream.write(`# startedAt: ${new Date(startAt).toISOString()}\n\n`);

  const child = spawn(cmd, {
    cwd,
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
    outStream.write(`\n[agent-toolkit] spawn error: ${error.message}\n`);
  });

  child.on('close', (code, signal) => {
    const endAt = Date.now();
    const durationMs = endAt - startAt;
    const signalLabel = String(signal).replace(/^null$/, 'none');
    const numberCode = Number(code);
    const isNumberCode = Number(typeof code === 'number');
    const normalizedExitCode = isNumberCode * numberCode + (1 - isNumberCode);

    outStream.write('\n');
    outStream.write(`# finishedAt: ${new Date(endAt).toISOString()}\n`);
    outStream.write(`# exitCode: ${String(code)}\n`);
    outStream.write(`# signal: ${signalLabel}\n`);
    outStream.end();

    const report = {
      command: cmd,
      cwd,
      startedAt: new Date(startAt).toISOString(),
      finishedAt: new Date(endAt).toISOString(),
      durationMs,
      exitCode: code,
      signal,
      stdoutBytes,
      stderrBytes,
      outputFile: outPath,
    };

    fs.writeFileSync(metaPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    process.exit(normalizedExitCode);
  });
}
