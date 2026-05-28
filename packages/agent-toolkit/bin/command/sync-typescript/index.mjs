import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const TSCONFIG_FILE = 'tsconfig.json';

const PACKAGE_TSCONFIG_TEMPLATE = {
  compilerOptions: {
    lib: ['ESNext'],
    types: ['node'],
    strictNullChecks: true,
    allowJs: true,
    noEmit: true,
    module: 'NodeNext',
  },
};

export function printSyncTypescriptHelp() {
  printTextResource(HELP_FILE);
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function computeExtendsPath(packageRoot, repoRoot) {
  const relative = path.relative(packageRoot, repoRoot);
  const normalized = relative.replace(/\\/g, '/');
  if (!normalized || normalized === '.') {
    return './tsconfig.json';
  }
  return normalized.startsWith('..')
    ? `${normalized}/tsconfig.json`
    : `./${normalized}/tsconfig.json`;
}

export function runSyncTypescript(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const check = hasFlag(options, '--check');
  const dryRun = hasFlag(options, '--dry-run') && !check;
  const jsonFile = getSingle(options, '--json', '');
  const packageRoot = getSingle(options, '--package-root', '');
  const mode = check ? 'check' : dryRun ? 'dry-run' : 'sync';

  if (!packageRoot) {
    console.error('--package-root is required');
    process.exit(2);
  }

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const pkgDir = path.resolve(cwd, packageRoot);
  if (!fs.existsSync(pkgDir)) {
    console.error(`Package root does not exist: ${pkgDir}`);
    process.exit(2);
  }

  const tsconfigPath = path.resolve(pkgDir, TSCONFIG_FILE);
  const current = readJsonIfExists(tsconfigPath);
  const fileExists = current !== null;

  // If tsconfig.json already exists, skip without checking content
  if (fileExists) {
    const report = {
      cwd,
      mode,
      ok: true,
      tsconfigPath,
      required: {
        file: path.join(packageRoot, TSCONFIG_FILE),
      },
      status: {
        fileExistsBefore: true,
        mismatchesBefore: [],
        fileExistsAfter: true,
        mismatchesAfter: [],
        updated: false,
        skipped: true,
      },
    };

    if (jsonFile) {
      const outPath = path.resolve(cwd, jsonFile);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const expectedExtends = computeExtendsPath(pkgDir, cwd);
  const expectedPkgConfig = {
    extends: expectedExtends,
    ...PACKAGE_TSCONFIG_TEMPLATE,
  };

  const plannedContent = `${JSON.stringify(expectedPkgConfig, null, 2)}\n`;

  if (mode === 'sync') {
    fs.writeFileSync(tsconfigPath, plannedContent, 'utf8');
  }

  const mismatches = [
    {
      file: path.join(packageRoot, TSCONFIG_FILE),
      expected: JSON.stringify(expectedPkgConfig, null, 2),
      actual: 'missing',
    },
  ];

  const report = {
    cwd,
    mode,
    ok: mode !== 'check',
    tsconfigPath,
    required: {
      file: path.join(packageRoot, TSCONFIG_FILE),
    },
    status: {
      fileExistsBefore: false,
      mismatchesBefore: mismatches,
      fileExistsAfter: mode === 'sync',
      mismatchesAfter: mode === 'sync' ? [] : mismatches,
      updated: mode === 'sync',
    },
  };

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
