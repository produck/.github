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
  path.resolve(PACKAGE_ROOT, 'publish-assets/instructions/produck/tooling-version-baseline.json'),
  path.resolve(REPO_ROOT, '.github/distribution/produck/tooling-version-baseline.json'),
];
const GLOB_TOKEN_PATTERN = /[*?{}[\]]/;

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

  if (!coverageTemplate.includes('{c8.version}')) {
    console.error(
      `Tooling baseline coverage.scriptTemplate must include {c8.version}: ${toolingBaselinePath}`,
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

function reconcileCoverageScript(cwd, workspacePath, mode, requiredCoverageScript) {
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
    matchesRequiredCoverageBefore: false,
    matchesRequiredCoverageAfter: false,
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

  const previousCoverage = typeof scripts.coverage === 'string' ? scripts.coverage : null;
  result.previousCoverage = previousCoverage;
  result.matchesRequiredCoverageBefore = previousCoverage === requiredCoverageScript;

  if (!result.matchesRequiredCoverageBefore && mode === 'sync') {
    scripts.coverage = requiredCoverageScript;
    pkg.scripts = scripts;
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    result.updated = true;
  }

  result.coverageScript =
    mode === 'sync' && !result.matchesRequiredCoverageBefore
      ? requiredCoverageScript
      : previousCoverage;

  result.matchesRequiredCoverageAfter = result.updated || result.matchesRequiredCoverageBefore;
  return result;
}

export function runSyncCoverageScript(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const check = hasFlag(options, '--check');
  const dryRun = hasFlag(options, '--dry-run');
  const jsonFile = getSingle(options, '--json', '');
  const { baseline: toolingBaseline, toolingBaselinePath } = loadToolingBaseline();
  const requiredCoverageScript = buildRequiredCoverageScript(toolingBaseline);

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
    workspaces: workspacePaths,
    results: [],
    ok: true,
  };

  for (const workspacePath of workspacePaths) {
    const effectiveMode = mode === 'sync' ? 'sync' : 'check';
    const item = reconcileCoverageScript(cwd, workspacePath, effectiveMode, requiredCoverageScript);
    report.results.push(item);

    if (item.error) {
      report.ok = false;
      continue;
    }

    if (mode === 'check' && !item.matchesRequiredCoverageAfter) {
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
