import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const LEGACY_INSTALL_SCRIPT_KEY = 'deps:install';
const REQUIRED_INSTALL_SCRIPT_KEY = 'produck:install';
const REQUIRED_INSTALL_SCRIPT_VALUE = 'npm -v && npm install';

export function printSyncInstallHelp() {
  printTextResource(HELP_FILE);
}

function parseJsonFile(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    console.error(`${label} is not valid JSON: ${filePath}`);
    process.exit(2);
  }
}

export function runSyncInstall(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const check = hasFlag(options, '--check');
  const dryRun = hasFlag(options, '--dry-run') && !check;
  const jsonFile = getSingle(options, '--json', '');
  const mode = check ? 'check' : dryRun ? 'dry-run' : 'sync';

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const rootPackageJsonPath = path.resolve(cwd, 'package.json');
  if (!fs.existsSync(rootPackageJsonPath)) {
    console.error(`Root package.json does not exist: ${rootPackageJsonPath}`);
    process.exit(2);
  }

  const pkg = parseJsonFile(rootPackageJsonPath, 'Root package.json');
  const scripts =
    pkg.scripts && typeof pkg.scripts === 'object' && !Array.isArray(pkg.scripts)
      ? { ...pkg.scripts }
      : {};

  const previousInstall =
    typeof scripts[REQUIRED_INSTALL_SCRIPT_KEY] === 'string'
      ? scripts[REQUIRED_INSTALL_SCRIPT_KEY]
      : null;
  const previousLegacyInstall =
    typeof scripts[LEGACY_INSTALL_SCRIPT_KEY] === 'string'
      ? scripts[LEGACY_INSTALL_SCRIPT_KEY]
      : null;

  const matchesRequiredInstall = previousInstall === REQUIRED_INSTALL_SCRIPT_VALUE;
  const legacyInstallScriptPresent = previousLegacyInstall !== null;
  const requiresUpdate = !matchesRequiredInstall || legacyInstallScriptPresent;

  if (mode === 'sync' && requiresUpdate) {
    delete scripts[LEGACY_INSTALL_SCRIPT_KEY];
    scripts[REQUIRED_INSTALL_SCRIPT_KEY] = REQUIRED_INSTALL_SCRIPT_VALUE;
    pkg.scripts = scripts;
    fs.writeFileSync(rootPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }

  const report = {
    cwd,
    mode,
    ok: true,
    rootPackageJsonPath,
    required: {
      installScriptKey: REQUIRED_INSTALL_SCRIPT_KEY,
      installScriptValue: REQUIRED_INSTALL_SCRIPT_VALUE,
      legacyInstallScriptKey: LEGACY_INSTALL_SCRIPT_KEY,
    },
    status: {
      matchesRequiredInstallBefore: matchesRequiredInstall,
      legacyInstallScriptPresentBefore: legacyInstallScriptPresent,
      matchesRequiredInstallAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredInstall,
      legacyInstallScriptPresentAfter:
        requiresUpdate && mode === 'sync' ? false : legacyInstallScriptPresent,
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
