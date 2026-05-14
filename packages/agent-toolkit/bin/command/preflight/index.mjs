import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';
import { validateWorkspaceShape } from '../shared/workspace-validation.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const REQUIRED_WORKSPACE_FIELDS = ['private', 'workspaces', 'scripts'];
const REQUIRED_WORKSPACE_SCRIPTS = ['deps:install', 'test', 'produck:coverage', 'produck:lint'];

export function printPreflightHelp() {
  printTextResource(HELP_FILE);
}

function validateWorkspacePackageJson(cwd, checkPath) {
  const packagePath = path.resolve(cwd, checkPath);
  const check = {
    file: checkPath,
    ok: true,
    exists: true,
    validJson: true,
    missingFields: [],
    missingScripts: [],
    wildcardWorkspaces: [],
    scriptTypeValid: true,
  };

  if (!fs.existsSync(packagePath)) {
    check.ok = false;
    check.exists = false;
    return check;
  }

  let json;
  try {
    json = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch {
    check.ok = false;
    check.validJson = false;
    return check;
  }

  const shape = validateWorkspaceShape(json, REQUIRED_WORKSPACE_FIELDS, REQUIRED_WORKSPACE_SCRIPTS);
  check.missingFields = shape.missingFields;
  check.scriptTypeValid = shape.scriptTypeValid;
  check.missingScripts = shape.missingScripts;
  check.wildcardWorkspaces = shape.wildcardWorkspaces;
  check.ok = shape.ok;

  return check;
}

export function runPreflight(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const requireTargets = options['--require'] || [];
  const ensureDirs = options['--ensure-dir'] || [];
  const checkWorkspacePackageJson = getSingle(options, '--check-workspace-package-json', '');
  const dryRun = hasFlag(options, '--dry-run');
  const jsonFile = getSingle(options, '--json', '');

  const report = {
    cwd,
    dryRun,
    ok: true,
    required: [],
    ensuredDirs: [],
    workspacePackageJson: null,
  };

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  for (const target of requireTargets) {
    const absolute = path.resolve(cwd, String(target));
    const exists = fs.existsSync(absolute);
    report.required.push({ target: String(target), absolute, exists });
    if (!exists) {
      report.ok = false;
    }
  }

  for (const dir of ensureDirs) {
    const absolute = path.resolve(cwd, String(dir));
    const existedBefore = fs.existsSync(absolute);
    if (!dryRun && !existedBefore) {
      fs.mkdirSync(absolute, { recursive: true });
    }
    report.ensuredDirs.push({
      target: String(dir),
      absolute,
      existedBefore,
      existsAfter: fs.existsSync(absolute),
    });
  }

  if (checkWorkspacePackageJson) {
    const workspaceCheck = validateWorkspacePackageJson(cwd, checkWorkspacePackageJson);
    report.workspacePackageJson = workspaceCheck;
    if (!workspaceCheck.ok) {
      report.ok = false;
    }
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
