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
const REQUIRED_ROOT_COVERAGE_SCRIPT_KEY = 'produck:coverage';
const REQUIRED_ROOT_COVERAGE_SCRIPT_VALUE = [
  'c8',
  '--config .c8rc.json',
  'npm run test',
  '--workspaces',
  '--if-present',
].join(' ');
const REQUIRED_C8_CONFIG_FILE = '.c8rc.json';
const REQUIRED_C8_CONFIG_TEMPLATE_FILE = path.resolve(
  COMMAND_DIR,
  'required-c8-config.json',
);

export function printSyncCoverageHelp() {
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
  if (typeof baseline.schemaVersion !== 'number') {
    console.error(
      `Tooling baseline schemaVersion must be a number: ${toolingBaselinePath}`,
    );
    process.exit(2);
  }

  const c8Version = resolveToolVersionFromDevDeps(baseline, 'c8');
  if (typeof c8Version !== 'string' || c8Version.trim() === '') {
    console.error(
      `Tooling baseline tools.c8.version must be a non-empty string: ${toolingBaselinePath}`,
    );
    process.exit(2);
  }

  const coverageTemplate = baseline?.coverage?.scriptTemplate;
  if (typeof coverageTemplate !== 'string' || coverageTemplate.trim() === '') {
    console.error(
      `Tooling baseline coverage.scriptTemplate must be a non-empty string: ${toolingBaselinePath}`,
    );
    process.exit(2);
  }

  return {
    baseline,
    toolingBaselinePath,
  };
}

function buildRequiredC8DevDependency(baseline) {
  return String(baseline.tools.c8.version);
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
}

function loadRequiredC8ConfigContent() {
  if (!fs.existsSync(REQUIRED_C8_CONFIG_TEMPLATE_FILE)) {
    console.error(
      `Required c8 config template does not exist: ${REQUIRED_C8_CONFIG_TEMPLATE_FILE}`,
    );
    process.exit(2);
  }

  const template = parseJsonFile(
    REQUIRED_C8_CONFIG_TEMPLATE_FILE,
    'Required c8 config template',
  );
  return `${JSON.stringify(template, null, 2)}\n`;
}

function syncRootCoverage(
  cwd,
  mode,
  requiredC8Version,
  requiredC8ConfigContent,
) {
  const rootPackageJsonPath = path.resolve(cwd, 'package.json');
  const c8ConfigPath = path.resolve(cwd, REQUIRED_C8_CONFIG_FILE);
  const currentC8ConfigContent = readFileIfExists(c8ConfigPath);
  const pkg = parseJsonFile(rootPackageJsonPath, 'Root package.json');
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
  const previousRootCoverageScript =
    typeof scripts[REQUIRED_ROOT_COVERAGE_SCRIPT_KEY] === 'string'
      ? scripts[REQUIRED_ROOT_COVERAGE_SCRIPT_KEY]
      : null;
  const previousC8DevDependency =
    typeof devDependencies.c8 === 'string' ? devDependencies.c8 : null;
  const matchesRequiredRootCoverageBefore =
    previousRootCoverageScript === REQUIRED_ROOT_COVERAGE_SCRIPT_VALUE;
  const matchesRequiredC8DevDependencyBefore =
    previousC8DevDependency === requiredC8Version;
  const matchesRequiredC8ConfigBefore =
    currentC8ConfigContent === requiredC8ConfigContent;
  const requiresUpdate =
    !matchesRequiredRootCoverageBefore ||
    !matchesRequiredC8DevDependencyBefore ||
    !matchesRequiredC8ConfigBefore;

  if (mode === 'sync' && requiresUpdate) {
    scripts[REQUIRED_ROOT_COVERAGE_SCRIPT_KEY] =
      REQUIRED_ROOT_COVERAGE_SCRIPT_VALUE;
    pkg.scripts = scripts;
    devDependencies.c8 = requiredC8Version;
    pkg.devDependencies = devDependencies;
    fs.writeFileSync(
      rootPackageJsonPath,
      `${JSON.stringify(pkg, null, 2)}\n`,
      'utf8',
    );
    fs.writeFileSync(c8ConfigPath, requiredC8ConfigContent, 'utf8');
  }

  return {
    rootPackageJsonPath,
    required: {
      rootCoverageScriptKey: REQUIRED_ROOT_COVERAGE_SCRIPT_KEY,
      rootCoverageScriptValue: REQUIRED_ROOT_COVERAGE_SCRIPT_VALUE,
      c8ConfigFile: REQUIRED_C8_CONFIG_FILE,
      c8ConfigContent: requiredC8ConfigContent,
      c8DevDependency: requiredC8Version,
    },
    status: {
      matchesRequiredRootCoverageBefore,
      matchesRequiredC8DevDependencyBefore,
      matchesRequiredC8ConfigBefore,
      matchesRequiredRootCoverageAfter:
        requiresUpdate && mode === 'sync'
          ? true
          : matchesRequiredRootCoverageBefore,
      matchesRequiredC8DevDependencyAfter:
        requiresUpdate && mode === 'sync'
          ? true
          : matchesRequiredC8DevDependencyBefore,
      matchesRequiredC8ConfigAfter:
        requiresUpdate && mode === 'sync'
          ? true
          : matchesRequiredC8ConfigBefore,
      updated: requiresUpdate && mode === 'sync',
    },
  };
}

export function runSyncCoverage(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const check = hasFlag(options, '--check');
  const dryRun = hasFlag(options, '--dry-run');
  const jsonFile = getSingle(options, '--json', '');
  const { baseline: toolingBaseline, toolingBaselinePath } =
    loadToolingBaseline();
  const requiredC8Version = buildRequiredC8DevDependency(toolingBaseline);
  const requiredC8ConfigContent = loadRequiredC8ConfigContent();

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const mode = dryRun ? 'dry-run' : check ? 'check' : 'sync';
  const root = syncRootCoverage(
    cwd,
    mode,
    requiredC8Version,
    requiredC8ConfigContent,
  );

  const report = {
    cwd,
    mode,
    toolingBaselinePath,
    toolingBaseline: {
      schemaVersion: toolingBaseline.schemaVersion,
      c8Version: toolingBaseline.tools.c8.version,
    },
    requiredC8DevDependency: requiredC8Version,
    root,
    ok: true,
  };

  if (
    mode === 'check' &&
    (!root.status.matchesRequiredRootCoverageAfter ||
      !root.status.matchesRequiredC8DevDependencyAfter ||
      !root.status.matchesRequiredC8ConfigAfter)
  ) {
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
