import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const EDITORCONFIG_FILE = '.editorconfig';
const TEMPLATE_FILE = path.resolve(COMMAND_DIR, 'editorconfig.template');

const REQUIRED_EDITORCONFIG_CONTENT = fs.readFileSync(TEMPLATE_FILE, 'utf8');

export function printSyncEditorconfigHelp() {
  printTextResource(HELP_FILE);
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
}

export function runSyncEditorconfig(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const check = hasFlag(options, '--check');
  const dryRun = hasFlag(options, '--dry-run') && !check;
  const jsonFile = getSingle(options, '--json', '');
  const mode = check ? 'check' : dryRun ? 'dry-run' : 'sync';

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const editorconfigPath = path.resolve(cwd, EDITORCONFIG_FILE);
  const currentContent = readFileIfExists(editorconfigPath);
  const fileExists = currentContent !== null;
  const upToDate = fileExists && currentContent === REQUIRED_EDITORCONFIG_CONTENT;

  const mismatches = [];
  if (!upToDate) {
    mismatches.push({
      file: EDITORCONFIG_FILE,
      expected: 'exact required content',
      actual: fileExists ? 'different content' : 'missing',
    });
  }
  const requiresUpdate = mismatches.length > 0;
  const plannedContent = requiresUpdate ? REQUIRED_EDITORCONFIG_CONTENT : null;

  if (mode === 'sync' && requiresUpdate && plannedContent) {
    fs.writeFileSync(editorconfigPath, plannedContent, 'utf8');
  }

  const report = {
    cwd,
    mode,
    ok: true,
    editorconfigPath,
    required: {
      file: EDITORCONFIG_FILE,
    },
    status: {
      fileExistsBefore: fileExists,
      mismatchesBefore: mismatches,
      fileExistsAfter: requiresUpdate && mode === 'sync' ? true : fileExists,
      mismatchesAfter: requiresUpdate && mode === 'sync' ? [] : mismatches,
      updated: requiresUpdate && mode === 'sync',
    },
  };

  if (mode === 'check' && requiresUpdate) {
    report.ok = false;
  }

  if (jsonFile) {
    const outPath = path.resolve(cwd, jsonFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) {
    process.exit(2);
  }
}
