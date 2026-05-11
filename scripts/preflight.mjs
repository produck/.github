#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function printUsage() {
  console.error(
    [
      'Usage:',
      '  node scripts/preflight.mjs [--cwd <dir>] [--require <path>] ...',
      '  [--ensure-dir <path>] ... [--json <file>]',
      '',
      'Examples:',
      '  node scripts/preflight.mjs --cwd . --require package.json \\',
      '    --ensure-dir logs',
      '  node scripts/preflight.mjs --require docs --json logs/preflight.json',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const args = {
    cwd: process.cwd(),
    require: [],
    ensureDir: [],
    json: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === '--cwd' && next) {
      args.cwd = next;
      i += 1;
      continue;
    }
    if (token === '--require' && next) {
      args.require.push(next);
      i += 1;
      continue;
    }
    if (token === '--ensure-dir' && next) {
      args.ensureDir.push(next);
      i += 1;
      continue;
    }
    if (token === '--json' && next) {
      args.json = next;
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

const baseDir = path.resolve(args.cwd);
const report = {
  cwd: baseDir,
  required: [],
  ensuredDirectories: [],
  ok: true,
};

if (!fs.existsSync(baseDir)) {
  console.error(`CWD does not exist: ${baseDir}`);
  process.exit(2);
}

for (const rel of args.require) {
  const resolved = path.resolve(baseDir, rel);
  const exists = fs.existsSync(resolved);
  report.required.push({ path: rel, resolved, exists });
  if (!exists) {
    report.ok = false;
  }
}

for (const rel of args.ensureDir) {
  const resolved = path.resolve(baseDir, rel);
  fs.mkdirSync(resolved, { recursive: true });
  report.ensuredDirectories.push({ path: rel, resolved, created: true });
}

if (args.json) {
  const outPath = path.resolve(baseDir, args.json);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) {
  process.exit(2);
}
