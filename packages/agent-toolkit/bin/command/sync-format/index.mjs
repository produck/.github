import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const PACKAGE_ROOT = path.resolve(COMMAND_DIR, '../../..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');
const TOOLING_BASELINE_CANDIDATE_PATHS = [
  path.resolve(
    REPO_ROOT,
    '.github/distribution/produck/tooling-version-baseline.json',
  ),
  path.resolve(
    PACKAGE_ROOT,
    'publish-assets/instructions/produck/tooling-version-baseline.json',
  ),
];
const PRETTIER_CONFIG_FILE = '.prettierrc';
const PRETTIER_IGNORE_FILE = '.prettierignore';
const REQUIRED_PRETTIER_DEV_DEPENDENCY_KEY = 'prettier';

const PRETTIER_CONFIG_SOURCE_CANDIDATE_PATHS = [
  path.resolve(REPO_ROOT, '.prettierrc'),
  path.resolve(PACKAGE_ROOT, 'publish-assets/prettierrc'),
];
const PRETTIER_IGNORE_SOURCE_CANDIDATE_PATHS = [
  path.resolve(REPO_ROOT, '.prettierignore'),
  path.resolve(PACKAGE_ROOT, 'publish-assets/prettierignore'),
];

const REQUIRED_FORMAT_SCRIPT_KEY = 'produck:format';
const REQUIRED_FORMAT_SCRIPT_VALUE =
  'prettier --write . --ignore-path .prettierignore --ignore-path .gitignore';

function loadPrettierConfigContent() {
  const sourcePath = PRETTIER_CONFIG_SOURCE_CANDIDATE_PATHS.find((p) =>
    fs.existsSync(p),
  );

  if (!sourcePath) {
    console.error('Org .prettierrc source not found in expected locations:');
    for (const p of PRETTIER_CONFIG_SOURCE_CANDIDATE_PATHS) {
      console.error(`- ${p}`);
    }
    process.exit(2);
  }

  const parsed = parseJsonFile(sourcePath, '.prettierrc source');

  return {
    sourcePath,
    content: `${JSON.stringify(parsed, null, 2)}\n`,
  };
}

function loadPrettierIgnoreContent() {
  const sourcePath = PRETTIER_IGNORE_SOURCE_CANDIDATE_PATHS.find((p) =>
    fs.existsSync(p),
  );

  if (!sourcePath) {
    console.error(
      'Org .prettierignore source not found in expected locations:',
    );
    for (const p of PRETTIER_IGNORE_SOURCE_CANDIDATE_PATHS) {
      console.error(`- ${p}`);
    }
    process.exit(2);
  }

  return {
    sourcePath,
    content: fs.readFileSync(sourcePath, 'utf8'),
  };
}

export function printSyncFormatHelp() {
  printTextResource(HELP_FILE);
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
}

function parseJsonFile(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    console.error(`${label} is not valid JSON: ${filePath}`);
    process.exit(2);
  }
}

function resolveSemverExact(text) {
  return text.replace(/^[\^~>=<]+\s*/, '').trim();
}

function resolveToolVersionFromDevDeps(baseline, toolName) {
  // If baseline has a concrete version (not "auto"), use it directly.
  // This is the case when reading the published publish-assets baseline.
  const baselineVersion = String(
    baseline?.tools?.[toolName]?.version || '',
  ).trim();
  if (baselineVersion && baselineVersion !== 'auto') {
    return baselineVersion;
  }

  // Fall back to resolving from local root package.json devDependencies.
  // This covers source baseline with version="auto" during local dev.
  const repoRoot = path.resolve(PACKAGE_ROOT, '../..');
  const pkgJsonPath = path.resolve(repoRoot, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkg = parseJsonFile(pkgJsonPath, 'root package.json');
    const dep = pkg?.devDependencies?.[toolName];
    if (typeof dep === 'string' && dep.trim()) {
      return resolveSemverExact(dep);
    }
  }

  return '';
}

function loadToolingBaseline() {
  const toolingBaselinePath = TOOLING_BASELINE_CANDIDATE_PATHS.find(
    (candidatePath) => {
      return fs.existsSync(candidatePath);
    },
  );

  if (!toolingBaselinePath) {
    console.error(
      'Tooling baseline file does not exist in expected locations:',
    );
    for (const candidatePath of TOOLING_BASELINE_CANDIDATE_PATHS) {
      console.error(`- ${candidatePath}`);
    }
    process.exit(2);
  }

  const baseline = parseJsonFile(toolingBaselinePath, 'Tooling baseline file');
  const prettierVersion = resolveToolVersionFromDevDeps(baseline, 'prettier');

  if (!prettierVersion) {
    console.error(
      `Tooling baseline must define fixed tools.prettier.version: ${toolingBaselinePath}`,
    );
    process.exit(2);
  }

  return { toolingBaselinePath, prettierVersion };
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
  const toolingBaseline = loadToolingBaseline();
  const requiredPrettierVersion = toolingBaseline.prettierVersion;
  const {
    sourcePath: prettierConfigSourcePath,
    content: requiredPrettierConfigContent,
  } = loadPrettierConfigContent();
  const {
    sourcePath: prettierIgnoreSourcePath,
    content: REQUIRED_PRETTIER_IGNORE_CONTENT,
  } = loadPrettierIgnoreContent();
  const scripts =
    pkg.scripts &&
    typeof pkg.scripts === 'object' &&
    !Array.isArray(pkg.scripts)
      ? { ...pkg.scripts }
      : {};
  const devDependencies =
    pkg.devDependencies &&
    typeof pkg.devDependencies === 'object' &&
    !Array.isArray(pkg.devDependencies)
      ? { ...pkg.devDependencies }
      : {};

  const previousFormat =
    typeof scripts[REQUIRED_FORMAT_SCRIPT_KEY] === 'string'
      ? scripts[REQUIRED_FORMAT_SCRIPT_KEY]
      : null;
  const previousPrettierDep =
    typeof devDependencies[REQUIRED_PRETTIER_DEV_DEPENDENCY_KEY] === 'string'
      ? devDependencies[REQUIRED_PRETTIER_DEV_DEPENDENCY_KEY]
      : null;

  const prettierConfigPath = path.resolve(cwd, PRETTIER_CONFIG_FILE);
  const prettierIgnorePath = path.resolve(cwd, PRETTIER_IGNORE_FILE);
  const previousPrettierConfig = readFileIfExists(prettierConfigPath);
  const previousPrettierIgnore = readFileIfExists(prettierIgnorePath);

  const matchesRequiredFormat = previousFormat === REQUIRED_FORMAT_SCRIPT_VALUE;
  const matchesRequiredPrettierConfig =
    previousPrettierConfig === requiredPrettierConfigContent;
  const matchesRequiredPrettierDep =
    previousPrettierDep === requiredPrettierVersion;
  const matchesRequiredPrettierIgnore =
    previousPrettierIgnore === REQUIRED_PRETTIER_IGNORE_CONTENT;

  const requiresUpdate =
    !matchesRequiredFormat ||
    !matchesRequiredPrettierConfig ||
    !matchesRequiredPrettierDep ||
    !matchesRequiredPrettierIgnore;

  if (mode === 'sync' && requiresUpdate) {
    scripts[REQUIRED_FORMAT_SCRIPT_KEY] = REQUIRED_FORMAT_SCRIPT_VALUE;
    pkg.scripts = scripts;

    devDependencies[REQUIRED_PRETTIER_DEV_DEPENDENCY_KEY] =
      requiredPrettierVersion;
    pkg.devDependencies = devDependencies;

    fs.writeFileSync(
      rootPackageJsonPath,
      `${JSON.stringify(pkg, null, 2)}\n`,
      'utf8',
    );
    fs.writeFileSync(prettierConfigPath, requiredPrettierConfigContent, 'utf8');
    fs.writeFileSync(
      prettierIgnorePath,
      REQUIRED_PRETTIER_IGNORE_CONTENT,
      'utf8',
    );
  }

  const report = {
    cwd,
    mode,
    ok: true,
    rootPackageJsonPath,
    toolingBaselinePath: toolingBaseline.toolingBaselinePath,
    required: {
      formatScriptKey: REQUIRED_FORMAT_SCRIPT_KEY,
      formatScriptValue: REQUIRED_FORMAT_SCRIPT_VALUE,
      prettierConfigPath: path.relative(cwd, prettierConfigPath),
      prettierConfigSourcePath,
      prettierIgnorePath: path.relative(cwd, prettierIgnorePath),
      prettierIgnoreSourcePath,
      managedDevDependencies: {
        [REQUIRED_PRETTIER_DEV_DEPENDENCY_KEY]: requiredPrettierVersion,
      },
    },
    status: {
      matchesRequiredFormatBefore: matchesRequiredFormat,
      matchesRequiredPrettierConfigBefore: matchesRequiredPrettierConfig,
      matchesRequiredPrettierDepBefore: matchesRequiredPrettierDep,
      matchesRequiredPrettierIgnoreBefore: matchesRequiredPrettierIgnore,
      matchesRequiredFormatAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredFormat,
      matchesRequiredPrettierConfigAfter:
        requiresUpdate && mode === 'sync'
          ? true
          : matchesRequiredPrettierConfig,
      matchesRequiredPrettierDepAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredPrettierDep,
      matchesRequiredPrettierIgnoreAfter:
        requiresUpdate && mode === 'sync'
          ? true
          : matchesRequiredPrettierIgnore,
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
