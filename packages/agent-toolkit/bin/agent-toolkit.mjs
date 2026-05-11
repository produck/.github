#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ALLOWED_TAGS = ['INIT', 'ADD', 'REMOVE', 'FIX', 'REFACTOR', 'UPGRADE'];
const ALLOWED_TARGETS = ['docs', 'test', 'ci', 'deps', 'api', 'schema', 'infra'];
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(SCRIPT_DIR, '../templates');
const DEFAULT_INSTRUCTIONS_TEMPLATE_PATH = path.resolve(
  TEMPLATE_ROOT,
  'default.instructions.md',
);

function loadTemplateFile(relativePath) {
  const templatePath = path.resolve(TEMPLATE_ROOT, relativePath);
  if (!fs.existsSync(templatePath)) {
    console.error(`Template file not found: ${templatePath}`);
    process.exit(2);
  }

  return fs.readFileSync(templatePath, 'utf8');
}

function printTemplate(relativePath) {
  let content = loadTemplateFile(relativePath);
  if (!content.endsWith('\n')) {
    content = `${content}\n`;
  }
  process.stdout.write(content);
}

function parseCommonArgs(argv) {
  const positional = [];
  const options = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        if (!options[token]) {
          options[token] = [];
        }
        options[token].push(true);
      } else {
        if (!options[token]) {
          options[token] = [];
        }
        options[token].push(next);
        i += 1;
      }
      continue;
    }
    positional.push(token);
  }

  return { positional, options };
}

function getSingle(options, key, fallback = '') {
  if (!options[key] || options[key].length === 0) {
    return fallback;
  }
  return String(options[key][options[key].length - 1]);
}

function getMulti(options, key) {
  if (!options[key]) {
    return [];
  }
  return options[key].map((v) => String(v));
}

function hasFlag(options, key) {
  return Boolean(options[key]);
}

function printMainHelp() {
  printTemplate('help/main.txt');
}

function printPreflightHelp() {
  printTemplate('help/preflight.txt');
}

function printRunCaptureHelp() {
  printTemplate('help/run-capture.txt');
}

function printSummarizeHelp() {
  printTemplate('help/summarize-log.txt');
}

function printValidateHelp() {
  printTemplate('help/validate-commit-msg.txt');
}

function printSyncInstructionsHelp() {
  printTemplate('help/sync-instructions.txt');
}

function loadDefaultInstructionsTemplate() {
  let content = loadTemplateFile('default.instructions.md');
  if (!content.endsWith('\n')) {
    content = `${content}\n`;
  }
  return content;
}

function runPreflight(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const required = getMulti(options, '--require');
  const ensureDir = getMulti(options, '--ensure-dir');
  const jsonFile = getSingle(options, '--json', '');

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const report = {
    cwd,
    required: [],
    ensuredDirectories: [],
    ok: true,
  };

  for (const rel of required) {
    const resolved = path.resolve(cwd, rel);
    const exists = fs.existsSync(resolved);
    report.required.push({ path: rel, resolved, exists });
    if (!exists) {
      report.ok = false;
    }
  }

  for (const rel of ensureDir) {
    const resolved = path.resolve(cwd, rel);
    fs.mkdirSync(resolved, { recursive: true });
    report.ensuredDirectories.push({ path: rel, resolved, created: true });
  }

  if (jsonFile) {
    const out = path.resolve(cwd, jsonFile);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) {
    process.exit(2);
  }
}

function runCapture(options) {
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
    console.error('Blocked command containing pipe. Use --allow-pipe if needed.');
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

    outStream.write('\n');
    outStream.write(`# finishedAt: ${new Date(endAt).toISOString()}\n`);
    outStream.write(`# exitCode: ${String(code)}\n`);
    outStream.write(`# signal: ${signal ? String(signal) : 'none'}\n`);
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

    if (typeof code === 'number') {
      process.exit(code);
    }
    process.exit(1);
  });
}

function runSummarize(options) {
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

function validateCommitLine(line, lineNo) {
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

function runValidateCommitMsg(options) {
  const file = getSingle(options, '--file', '');
  if (!file) {
    printValidateHelp();
    process.exit(2);
  }

  const filePath = path.resolve(file);
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
    const err = validateCommitLine(lines[i], i + 1);
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
}

function runSyncInstructions(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const outArg = getSingle(options, '--out', '.instructions.md');
  const sourceArg = getSingle(options, '--source', '');
  const force = hasFlag(options, '--force');
  const dryRun = hasFlag(options, '--dry-run');

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const outPath = path.resolve(cwd, outArg);
  let content = loadDefaultInstructionsTemplate();

  if (sourceArg) {
    const sourcePath = path.resolve(cwd, sourceArg);
    if (!fs.existsSync(sourcePath)) {
      console.error(`Source file does not exist: ${sourcePath}`);
      process.exit(2);
    }
    content = fs.readFileSync(sourcePath, 'utf8');
    if (!content.endsWith('\n')) {
      content = `${content}\n`;
    }
  }

  const exists = fs.existsSync(outPath);
  if (exists && !force) {
    console.error(`Target already exists: ${outPath}`);
    console.error('Use --force to overwrite.');
    process.exit(2);
  }

  const report = {
    cwd,
    outPath,
    source: sourceArg
      ? path.resolve(cwd, sourceArg)
      : DEFAULT_INSTRUCTIONS_TEMPLATE_PATH,
    exists,
    overwritten: exists && force,
    dryRun,
  };

  if (dryRun) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(0);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

function main() {
  const parsed = parseCommonArgs(process.argv.slice(2));
  const command = parsed.positional[0] || '';
  const options = parsed.options;

  if (!command || command === '--help' || command === '-h') {
    printMainHelp();
    process.exit(0);
  }

  if (hasFlag(options, '--help') || hasFlag(options, '-h')) {
    if (command === 'preflight') {
      printPreflightHelp();
      process.exit(0);
    }
    if (command === 'run-capture') {
      printRunCaptureHelp();
      process.exit(0);
    }
    if (command === 'summarize-log') {
      printSummarizeHelp();
      process.exit(0);
    }
    if (command === 'validate-commit-msg') {
      printValidateHelp();
      process.exit(0);
    }
    if (command === 'sync-instructions') {
      printSyncInstructionsHelp();
      process.exit(0);
    }
  }

  if (command === 'preflight') {
    runPreflight(options);
    return;
  }

  if (command === 'run-capture') {
    runCapture(options);
    return;
  }

  if (command === 'summarize-log') {
    runSummarize(options);
    return;
  }

  if (command === 'validate-commit-msg') {
    runValidateCommitMsg(options);
    return;
  }

  if (command === 'sync-instructions') {
    runSyncInstructions(options);
    return;
  }

  console.error(`Unknown command: ${command}`);
  printMainHelp();
  process.exit(2);
}

main();
