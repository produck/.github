import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getMulti, getSingle } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const GLOB_TOKEN_PATTERN = /[*?{}[\]]/;
const REQUIRED_WORKSPACE_SCRIPTS = ['deps:install', 'test', 'coverage', 'lint'];

function validateWorkspacePackageJson(cwd, relPath) {
  const resolved = path.resolve(cwd, relPath);
  const check = {
    path: relPath,
    resolved,
    exists: false,
    validJson: false,
    privateTrue: false,
    hasWorkspacesList: false,
    hasWildcardWorkspace: false,
    wildcardWorkspaces: [],
    hasRequiredScripts: false,
    missingScripts: [],
    errors: [],
  };

  if (!fs.existsSync(resolved)) {
    check.errors.push(`Workspace package.json does not exist: ${relPath}`);
    return check;
  }
  check.exists = true;

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    check.validJson = true;
  } catch {
    check.errors.push(`Workspace package.json is not valid JSON: ${relPath}`);
    return check;
  }

  check.privateTrue = parsed.private === true;
  if (!check.privateTrue) {
    check.errors.push('Workspace package.json must set `private` to true');
  }

  if (Array.isArray(parsed.workspaces)) {
    check.hasWorkspacesList = true;
    const workspaceList = parsed.workspaces.map((entry) => String(entry));
    check.wildcardWorkspaces = workspaceList.filter((entry) => GLOB_TOKEN_PATTERN.test(entry));
    check.hasWildcardWorkspace = check.wildcardWorkspaces.length > 0;

    if (workspaceList.length === 0) {
      check.errors.push('Workspace package.json `workspaces` must not be empty');
    }
    if (check.hasWildcardWorkspace) {
      check.errors.push(
        'Workspace package.json `workspaces` must use explicit paths without glob tokens',
      );
    }
  } else {
    check.errors.push('Workspace package.json `workspaces` must be an explicit array');
  }

  const scripts =
    parsed.scripts && typeof parsed.scripts === 'object' && !Array.isArray(parsed.scripts)
      ? parsed.scripts
      : {};

  check.missingScripts = REQUIRED_WORKSPACE_SCRIPTS.filter((key) => {
    const value = scripts[key];
    return typeof value !== 'string' || value.trim() === '';
  });
  check.hasRequiredScripts = check.missingScripts.length === 0;

  if (!check.hasRequiredScripts) {
    check.errors.push(
      `Workspace package.json missing required scripts: ${check.missingScripts.join(', ')}`,
    );
  }

  return check;
}

export function printPreflightHelp() {
  printTextResource(HELP_FILE);
}

export function runPreflight(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const required = getMulti(options, '--require');
  const ensureDir = getMulti(options, '--ensure-dir');
  const jsonFile = getSingle(options, '--json', '');
  const workspacePackageJson = getSingle(options, '--check-workspace-package-json', '');

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

  if (workspacePackageJson) {
    const check = validateWorkspacePackageJson(cwd, workspacePackageJson);
    report.workspacePackageJson = check;
    if (check.errors.length > 0) {
      report.ok = false;
    }
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
