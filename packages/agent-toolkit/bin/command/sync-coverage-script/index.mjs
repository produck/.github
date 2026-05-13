import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getMulti, getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const PACKAGE_ROOT = path.resolve(COMMAND_DIR, '../../..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');
const TOOLING_BASELINE_CANDIDATE_PATHS = [
  path.resolve(REPO_ROOT, '.github/distribution/produck/tooling-version-baseline.json'),
  path.resolve(PACKAGE_ROOT, 'publish-assets/instructions/produck/tooling-version-baseline.json'),
];
const GLOB_TOKEN_PATTERN = /[*?{}[\]]/;
const REQUIRED_COVERAGE_SCRIPT_KEY = 'produck:coverage';
const REQUIRED_TEST_SCRIPT_KEY = 'test';
const DEFAULT_TEST_SCRIPT_VALUE = 'node -e "console.log(\'No tests configured\')"';

export function printSyncCoverageScriptHelp() {
  printTextResource(HELP_FILE);
}

function loadToolingBaseline() {
  const toolingBaselinePath = TOOLING_BASELINE_CANDIDATE_PATHS.find((candidatePath) => {
    return fs.existsSync(candidatePath);
  });

  if (!toolingBaselinePath) {
    console.error('Tooling baseline file does not exist in expected locations:');
    for (const candidatePath of TOOLING_BASELINE_CANDIDATE_PATHS) {
      console.error(`- ${candidatePath}`);
    }
    process.exit(2);
  }

  const baseline = parseJsonFile(toolingBaselinePath, 'Tooling baseline file');
  const c8Version = baseline?.tools?.c8?.version;
  const coverageTemplate = baseline?.coverage?.scriptTemplate;

  if (typeof baseline.schemaVersion !== 'number') {
    console.error(`Tooling baseline schemaVersion must be a number: ${toolingBaselinePath}`);
    process.exit(2);
  }

  if (typeof c8Version !== 'string' || c8Version.trim() === '') {
    console.error(
      `Tooling baseline tools.c8.version must be a non-empty string: ${toolingBaselinePath}`,
    );
    process.exit(2);
  }

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

function buildRequiredCoverageScript(baseline) {
  const c8Version = String(baseline.tools.c8.version);
  const coverageTemplate = String(baseline.coverage.scriptTemplate);
  return coverageTemplate.replace(/\{c8\.version\}/g, c8Version);
}

function buildRequiredC8DevDependency(baseline) {
  return String(baseline.tools.c8.version);
}

function parseJsonFile(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    console.error(`${label} is not valid JSON: ${filePath}`);
    process.exit(2);
  }
}

function resolveWorkspacePaths(cwd, options) {
  const manual = getMulti(options, '--workspace');
  if (manual.length > 0) {
    return manual;
  }

  const rootPackageJsonPath = path.resolve(cwd, 'package.json');
  if (!fs.existsSync(rootPackageJsonPath)) {
    console.error(`Root package.json does not exist: ${rootPackageJsonPath}`);
    process.exit(2);
  }

  const rootPackageJson = parseJsonFile(rootPackageJsonPath, 'Root package.json');
  if (!Array.isArray(rootPackageJson.workspaces)) {
    console.error('Root package.json `workspaces` must be an explicit array');
    process.exit(2);
  }

  const workspaces = rootPackageJson.workspaces.map((entry) => String(entry));
  if (workspaces.length === 0) {
    console.error('Root package.json `workspaces` must not be empty');
    process.exit(2);
  }

  const hasGlob = workspaces.some((entry) => GLOB_TOKEN_PATTERN.test(entry));
  if (hasGlob) {
    console.error('Root package.json `workspaces` must use explicit paths without glob tokens');
    process.exit(2);
  }

  return workspaces;
}

function reconcileCoverageScript(
  cwd,
  workspacePath,
  mode,
  requiredCoverageScript,
  requiredC8Version,
) {
  const packageDir = path.resolve(cwd, workspacePath);
  const packageJsonPath = path.resolve(packageDir, 'package.json');

  const result = {
    workspacePath,
    packageDir,
    packageJsonPath,
    exists: false,
    validJson: false,
    previousCoverage: null,
    coverageScript: null,
    previousTestScript: null,
    testScript: null,
    previousC8DevDependency: null,
    c8DevDependency: null,
    matchesRequiredCoverageBefore: false,
    matchesRequiredCoverageAfter: false,
    hasRequiredTestScriptBefore: false,
    hasRequiredTestScriptAfter: false,
    matchesRequiredC8DevDependencyBefore: false,
    matchesRequiredC8DevDependencyAfter: false,
    updated: false,
    error: '',
  };

  if (!fs.existsSync(packageJsonPath)) {
    result.error = `Workspace package.json does not exist: ${workspacePath}`;
    return result;
  }
  result.exists = true;

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    result.validJson = true;
  } catch {
    result.error = `Workspace package.json is not valid JSON: ${workspacePath}`;
    return result;
  }

  const scripts =
    pkg.scripts && typeof pkg.scripts === 'object' && !Array.isArray(pkg.scripts)
      ? { ...pkg.scripts }
      : {};
  const devDependencies =
    pkg.devDependencies &&
    typeof pkg.devDependencies === 'object' &&
    !Array.isArray(pkg.devDependencies)
      ? { ...pkg.devDependencies }
      : {};

  const previousCoverage =
    typeof scripts[REQUIRED_COVERAGE_SCRIPT_KEY] === 'string'
      ? scripts[REQUIRED_COVERAGE_SCRIPT_KEY]
      : null;
  const previousTestScript =
    typeof scripts[REQUIRED_TEST_SCRIPT_KEY] === 'string' &&
    scripts[REQUIRED_TEST_SCRIPT_KEY].trim() !== ''
      ? scripts[REQUIRED_TEST_SCRIPT_KEY]
      : null;
  const previousC8DevDependency =
    typeof devDependencies.c8 === 'string' ? devDependencies.c8 : null;
  result.previousCoverage = previousCoverage;
  result.previousTestScript = previousTestScript;
  result.previousC8DevDependency = previousC8DevDependency;
  result.matchesRequiredCoverageBefore = previousCoverage === requiredCoverageScript;
  result.hasRequiredTestScriptBefore = previousTestScript !== null;
  result.matchesRequiredC8DevDependencyBefore = previousC8DevDependency === requiredC8Version;

  if (
    (!result.matchesRequiredCoverageBefore ||
      !result.hasRequiredTestScriptBefore ||
      !result.matchesRequiredC8DevDependencyBefore) &&
    mode === 'sync'
  ) {
    scripts[REQUIRED_COVERAGE_SCRIPT_KEY] = requiredCoverageScript;
    if (!result.hasRequiredTestScriptBefore) {
      scripts[REQUIRED_TEST_SCRIPT_KEY] = DEFAULT_TEST_SCRIPT_VALUE;
    }
    devDependencies.c8 = requiredC8Version;
    pkg.scripts = scripts;
    pkg.devDependencies = devDependencies;
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    result.updated = true;
  }

  result.coverageScript =
    mode === 'sync' && !result.matchesRequiredCoverageBefore
      ? requiredCoverageScript
      : previousCoverage;
  result.testScript =
    mode === 'sync' && !result.hasRequiredTestScriptBefore
      ? DEFAULT_TEST_SCRIPT_VALUE
      : previousTestScript;
  result.c8DevDependency =
    mode === 'sync' && !result.matchesRequiredC8DevDependencyBefore
      ? requiredC8Version
      : previousC8DevDependency;

  result.matchesRequiredCoverageAfter = result.updated || result.matchesRequiredCoverageBefore;
  result.hasRequiredTestScriptAfter =
    (mode === 'sync' && !result.hasRequiredTestScriptBefore) || result.hasRequiredTestScriptBefore;
  result.matchesRequiredC8DevDependencyAfter =
    result.updated || result.matchesRequiredC8DevDependencyBefore;
  return result;
}

export function runSyncCoverageScript(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const check = hasFlag(options, '--check');
  const dryRun = hasFlag(options, '--dry-run');
  const jsonFile = getSingle(options, '--json', '');
  const { baseline: toolingBaseline, toolingBaselinePath } = loadToolingBaseline();
  const requiredCoverageScript = buildRequiredCoverageScript(toolingBaseline);
  const requiredC8Version = buildRequiredC8DevDependency(toolingBaseline);

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const workspacePaths = resolveWorkspacePaths(cwd, options);
  const mode = dryRun ? 'dry-run' : check ? 'check' : 'sync';

  const report = {
    cwd,
    mode,
    toolingBaselinePath,
    toolingBaseline: {
      schemaVersion: toolingBaseline.schemaVersion,
      c8Version: toolingBaseline.tools.c8.version,
    },
    requiredCoverageScript,
    requiredTestScript: DEFAULT_TEST_SCRIPT_VALUE,
    requiredC8DevDependency: requiredC8Version,
    workspaces: workspacePaths,
    results: [],
    ok: true,
  };

  for (const workspacePath of workspacePaths) {
    const effectiveMode = mode === 'sync' ? 'sync' : 'check';
    const item = reconcileCoverageScript(
      cwd,
      workspacePath,
      effectiveMode,
      requiredCoverageScript,
      requiredC8Version,
    );
    report.results.push(item);

    if (item.error) {
      report.ok = false;
      continue;
    }

    if (
      mode === 'check' &&
      (!item.matchesRequiredCoverageAfter ||
        !item.hasRequiredTestScriptAfter ||
        !item.matchesRequiredC8DevDependencyAfter)
    ) {
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
