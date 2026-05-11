import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getMulti, getSingle } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');

export function printPreflightHelp() {
  printTextResource(HELP_FILE);
}

export function runPreflight(options) {
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
