import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const PRETTIER_CONFIG_FILE = '.prettierrc';

const REQUIRED_FORMAT_SCRIPT_KEY = 'produck:format';
const REQUIRED_FORMAT_SCRIPT_VALUE =
  'npm exec -- prettier --check . && npm run format --if-present';
const REQUIRED_PRETTIER_CONFIG = `${JSON.stringify(
  {
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    useTabs: false,
    trailingComma: 'all',
    bracketSpacing: true,
    arrowParens: 'always',
    printWidth: 100,
  },
  null,
  2,
)}\n`;

export function printSyncFormatHelp() {
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

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
}

export function runSyncFormat(options) {
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

  const previousFormat =
    typeof scripts[REQUIRED_FORMAT_SCRIPT_KEY] === 'string'
      ? scripts[REQUIRED_FORMAT_SCRIPT_KEY]
      : null;

  const prettierConfigPath = path.resolve(cwd, PRETTIER_CONFIG_FILE);
  const previousPrettierConfig = readFileIfExists(prettierConfigPath);

  const matchesRequiredFormat = previousFormat === REQUIRED_FORMAT_SCRIPT_VALUE;
  const matchesRequiredPrettierConfig = previousPrettierConfig === REQUIRED_PRETTIER_CONFIG;

  const requiresUpdate = !matchesRequiredFormat || !matchesRequiredPrettierConfig;

  if (mode === 'sync' && requiresUpdate) {
    scripts[REQUIRED_FORMAT_SCRIPT_KEY] = REQUIRED_FORMAT_SCRIPT_VALUE;
    pkg.scripts = scripts;

    fs.writeFileSync(rootPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    fs.writeFileSync(prettierConfigPath, REQUIRED_PRETTIER_CONFIG, 'utf8');
  }

  const report = {
    cwd,
    mode,
    ok: true,
    rootPackageJsonPath,
    required: {
      formatScriptKey: REQUIRED_FORMAT_SCRIPT_KEY,
      formatScriptValue: REQUIRED_FORMAT_SCRIPT_VALUE,
      prettierConfigPath: path.relative(cwd, prettierConfigPath),
    },
    status: {
      matchesRequiredFormatBefore: matchesRequiredFormat,
      matchesRequiredPrettierConfigBefore: matchesRequiredPrettierConfig,
      matchesRequiredFormatAfter: requiresUpdate && mode === 'sync' ? true : matchesRequiredFormat,
      matchesRequiredPrettierConfigAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredPrettierConfig,
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
