import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';
import { validateRequiredExactEntries } from '../shared/workspace-validation.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const PACKAGE_ROOT = path.resolve(COMMAND_DIR, '../../..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');
const TOOLKIT_PACKAGE_JSON = path.resolve(PACKAGE_ROOT, 'package.json');
const TOOLING_BASELINE_CANDIDATE_PATHS = [
  path.resolve(REPO_ROOT, '.github/distribution/produck/tooling-version-baseline.json'),
  path.resolve(PACKAGE_ROOT, 'publish-assets/instructions/produck/tooling-version-baseline.json'),
];

const REQUIRED_BASELINE_SCRIPT_KEY = 'produck:baseline';
const REQUIRED_BASELINE_SCRIPT_VALUE =
  'npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd .';
const REQUIRED_WORKSPACE_COVERAGE_SCRIPT_KEY = 'produck:coverage';
const REQUIRED_WORKSPACE_COVERAGE_SCRIPT_VALUE =
  'c8 --config .c8rc.json npm run test --workspaces --if-present';
const REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY = 'produck:precommit-check';
const REQUIRED_PRECOMMIT_CHECK_SCRIPT_VALUE = 'npm run produck:format && npm run produck:lint';
const REQUIRED_C8_CONFIG_FILE = '.c8rc.json';
const REQUIRED_C8_CONFIG_CONTENT = `${JSON.stringify(
  {
    reporter: ['lcov', 'html', 'text-summary'],
  },
  null,
  2,
)}\n`;

export function printSyncWorkspaceConfigHelp() {
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

function getRequiredToolkitDevDependency() {
  const overrideVersion = String(process.env.PRODUCK_TOOLKIT_VERSION_OVERRIDE || '').trim();
  if (overrideVersion) {
    return overrideVersion;
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const latestResult = spawnSync(npmCommand, ['view', '@produck/agent-toolkit', 'version'], {
    encoding: 'utf8',
  });

  const latestVersion = String(latestResult.stdout || '').trim();
  if (latestResult.status === 0 && latestVersion) {
    return latestVersion;
  }

  const pkg = parseJsonFile(TOOLKIT_PACKAGE_JSON, 'Toolkit package.json');
  const version = typeof pkg.version === 'string' ? pkg.version.trim() : '';

  if (!version) {
    console.error(`Toolkit package version is missing: ${TOOLKIT_PACKAGE_JSON}`);
    process.exit(2);
  }

  return version;
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
  const c8Version = String(baseline?.tools?.c8?.version || '').trim();
  const huskyVersion = String(baseline?.tools?.husky?.version || '').trim();
  const lernaVersion = String(baseline?.tools?.lerna?.version || '').trim();

  if (!c8Version || !huskyVersion || !lernaVersion) {
    console.error(
      `Tooling baseline must define fixed tools.c8/husky/lerna.version: ${toolingBaselinePath}`,
    );
    process.exit(2);
  }

  return {
    toolingBaselinePath,
    c8Version,
    huskyVersion,
    lernaVersion,
  };
}

function buildScriptState(pkg) {
  const scripts =
    pkg.scripts && typeof pkg.scripts === 'object' && !Array.isArray(pkg.scripts)
      ? { ...pkg.scripts }
      : {};

  return {
    scripts,
    previousBaseline:
      typeof scripts[REQUIRED_BASELINE_SCRIPT_KEY] === 'string'
        ? scripts[REQUIRED_BASELINE_SCRIPT_KEY]
        : null,
    previousCoverage:
      typeof scripts[REQUIRED_WORKSPACE_COVERAGE_SCRIPT_KEY] === 'string'
        ? scripts[REQUIRED_WORKSPACE_COVERAGE_SCRIPT_KEY]
        : null,
    previousPrecommitCheck:
      typeof scripts[REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY] === 'string'
        ? scripts[REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY]
        : null,
  };
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
}

function buildDevDependencyState(pkg) {
  const devDependencies =
    pkg.devDependencies &&
    typeof pkg.devDependencies === 'object' &&
    !Array.isArray(pkg.devDependencies)
      ? { ...pkg.devDependencies }
      : {};

  return {
    devDependencies,
    previousManaged: {
      c8: typeof devDependencies.c8 === 'string' ? devDependencies.c8 : null,
      husky: typeof devDependencies.husky === 'string' ? devDependencies.husky : null,
      lerna: typeof devDependencies.lerna === 'string' ? devDependencies.lerna : null,
      '@produck/agent-toolkit':
        typeof devDependencies['@produck/agent-toolkit'] === 'string'
          ? devDependencies['@produck/agent-toolkit']
          : null,
    },
  };
}

export function runSyncWorkspaceConfig(options) {
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
  const requiredToolkitDependency = getRequiredToolkitDevDependency();
  const requiredDevDependencies = {
    c8: toolingBaseline.c8Version,
    husky: toolingBaseline.huskyVersion,
    lerna: toolingBaseline.lernaVersion,
    '@produck/agent-toolkit': requiredToolkitDependency,
  };

  const scriptState = buildScriptState(pkg);
  const dependencyState = buildDevDependencyState(pkg);
  const c8ConfigPath = path.resolve(cwd, REQUIRED_C8_CONFIG_FILE);
  const currentC8ConfigContent = readFileIfExists(c8ConfigPath);

  const scriptValidation = validateRequiredExactEntries(scriptState.scripts, {
    [REQUIRED_BASELINE_SCRIPT_KEY]: REQUIRED_BASELINE_SCRIPT_VALUE,
    [REQUIRED_WORKSPACE_COVERAGE_SCRIPT_KEY]: REQUIRED_WORKSPACE_COVERAGE_SCRIPT_VALUE,
    [REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY]: REQUIRED_PRECOMMIT_CHECK_SCRIPT_VALUE,
  });
  const dependencyValidation = validateRequiredExactEntries(
    dependencyState.devDependencies,
    requiredDevDependencies,
  );

  const matchesRequiredBaseline = !(REQUIRED_BASELINE_SCRIPT_KEY in scriptValidation.mismatches);
  const matchesRequiredWorkspaceCoverage = !(
    REQUIRED_WORKSPACE_COVERAGE_SCRIPT_KEY in scriptValidation.mismatches
  );
  const matchesRequiredPrecommitCheck = !(
    REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY in scriptValidation.mismatches
  );
  const matchesRequiredManagedDevDependencies = dependencyValidation.ok;
  const matchesRequiredC8Config = currentC8ConfigContent === REQUIRED_C8_CONFIG_CONTENT;

  const requiresUpdate =
    !matchesRequiredBaseline ||
    !matchesRequiredWorkspaceCoverage ||
    !matchesRequiredPrecommitCheck ||
    !matchesRequiredManagedDevDependencies ||
    !matchesRequiredC8Config;

  if (mode === 'sync' && requiresUpdate) {
    scriptState.scripts[REQUIRED_BASELINE_SCRIPT_KEY] = REQUIRED_BASELINE_SCRIPT_VALUE;
    scriptState.scripts[REQUIRED_WORKSPACE_COVERAGE_SCRIPT_KEY] =
      REQUIRED_WORKSPACE_COVERAGE_SCRIPT_VALUE;
    scriptState.scripts[REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY] =
      REQUIRED_PRECOMMIT_CHECK_SCRIPT_VALUE;
    pkg.scripts = scriptState.scripts;

    for (const [name, version] of Object.entries(requiredDevDependencies)) {
      dependencyState.devDependencies[name] = version;
    }
    pkg.devDependencies = dependencyState.devDependencies;

    fs.writeFileSync(rootPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    fs.writeFileSync(c8ConfigPath, REQUIRED_C8_CONFIG_CONTENT, 'utf8');
  }

  const report = {
    cwd,
    mode,
    ok: true,
    rootPackageJsonPath,
    toolingBaselinePath: toolingBaseline.toolingBaselinePath,
    required: {
      baselineScriptKey: REQUIRED_BASELINE_SCRIPT_KEY,
      baselineScriptValue: REQUIRED_BASELINE_SCRIPT_VALUE,
      workspaceCoverageScriptKey: REQUIRED_WORKSPACE_COVERAGE_SCRIPT_KEY,
      workspaceCoverageScriptValue: REQUIRED_WORKSPACE_COVERAGE_SCRIPT_VALUE,
      precommitCheckScriptKey: REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY,
      precommitCheckScriptValue: REQUIRED_PRECOMMIT_CHECK_SCRIPT_VALUE,
      c8ConfigFile: REQUIRED_C8_CONFIG_FILE,
      managedDevDependencies: requiredDevDependencies,
    },
    status: {
      matchesRequiredBaselineBefore: matchesRequiredBaseline,
      matchesRequiredWorkspaceCoverageBefore: matchesRequiredWorkspaceCoverage,
      matchesRequiredPrecommitCheckBefore: matchesRequiredPrecommitCheck,
      matchesRequiredManagedDevDependenciesBefore: matchesRequiredManagedDevDependencies,
      matchesRequiredC8ConfigBefore: matchesRequiredC8Config,
      matchesRequiredBaselineAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredBaseline,
      matchesRequiredWorkspaceCoverageAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredWorkspaceCoverage,
      matchesRequiredPrecommitCheckAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredPrecommitCheck,
      matchesRequiredManagedDevDependenciesAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredManagedDevDependencies,
      matchesRequiredC8ConfigAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredC8Config,
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
