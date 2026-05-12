import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const PACKAGE_ROOT = path.resolve(COMMAND_DIR, '../../..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');
const TOOLKIT_PACKAGE_JSON = path.resolve(PACKAGE_ROOT, 'package.json');
const PRETTIER_CONFIG_FILE = '.prettierrc';
const ESLINT_CONFIG_FILE = 'eslint.config.mjs';
const TOOLING_BASELINE_CANDIDATE_PATHS = [
  path.resolve(REPO_ROOT, '.github/distribution/produck/tooling-version-baseline.json'),
  path.resolve(PACKAGE_ROOT, 'publish-assets/instructions/produck/tooling-version-baseline.json'),
];

const REQUIRED_BASELINE_SCRIPT_KEY = 'produck:baseline';
const REQUIRED_BASELINE_SCRIPT_VALUE =
  'npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd .';
const REQUIRED_FORMAT_SCRIPT_KEY = 'produck:format';
const REQUIRED_FORMAT_SCRIPT_VALUE =
  'npm exec -- prettier --check . && npm run format --if-present';
const REQUIRED_LINT_SCRIPT_KEY = 'produck:lint';
const REQUIRED_LINT_SCRIPT_VALUE =
  'npm exec -- eslint --fix . --max-warnings=0 && npm run lint --if-present';
const REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY = 'produck:precommit-check';
const REQUIRED_PRECOMMIT_CHECK_SCRIPT_VALUE = 'npm run produck:format && npm run produck:lint';

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
const REQUIRED_ESLINT_CONFIG = `import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import * as ProduckRule from '@produck/eslint-rules';

export default [
  { files: ['**/*.{js,mjs,cjs,ts,mts}'] },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ProduckRule.config,
  ProduckRule.excludeGitIgnore(import.meta.url),
];
`;

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

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
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

function getRequiredEslintRulesDevDependency() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const latestResult = spawnSync(npmCommand, ['view', '@produck/eslint-rules', 'version'], {
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
    previousFormat:
      typeof scripts[REQUIRED_FORMAT_SCRIPT_KEY] === 'string'
        ? scripts[REQUIRED_FORMAT_SCRIPT_KEY]
        : null,
    previousLint:
      typeof scripts[REQUIRED_LINT_SCRIPT_KEY] === 'string'
        ? scripts[REQUIRED_LINT_SCRIPT_KEY]
        : null,
    previousPrecommitCheck:
      typeof scripts[REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY] === 'string'
        ? scripts[REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY]
        : null,
  };
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
      '@produck/eslint-rules':
        typeof devDependencies['@produck/eslint-rules'] === 'string'
          ? devDependencies['@produck/eslint-rules']
          : null,
      '@produck/agent-toolkit':
        typeof devDependencies['@produck/agent-toolkit'] === 'string'
          ? devDependencies['@produck/agent-toolkit']
          : null,
    },
  };
}

function patchEslintConfig(existing) {
  if (existing.includes('@produck/eslint-rules')) {
    return { ok: true, patched: false, output: existing };
  }

  const importRegex = /^import\s.+;\s*$/gm;
  let lastImport = null;
  let match = importRegex.exec(existing);
  while (match) {
    lastImport = match;
    match = importRegex.exec(existing);
  }

  if (!lastImport) {
    return { ok: false, patched: false, output: existing };
  }

  const importInsertAt = lastImport.index + lastImport[0].length;
  let output =
    `${existing.slice(0, importInsertAt)}\nimport * as ProduckRule from '@produck/eslint-rules';` +
    existing.slice(importInsertAt);

  const exportStart = output.indexOf('export default [');
  const exportEnd = output.lastIndexOf('];');
  if (exportStart === -1 || exportEnd === -1 || exportEnd < exportStart) {
    return { ok: false, patched: false, output: existing };
  }

  output =
    `${output.slice(0, exportEnd)}  ProduckRule.config,\n  ProduckRule.excludeGitIgnore(import.meta.url),\n` +
    output.slice(exportEnd);

  if (!output.endsWith('\n')) {
    output = `${output}\n`;
  }

  return { ok: true, patched: true, output };
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
  const requiredEslintRulesDependency = getRequiredEslintRulesDevDependency();
  const requiredDevDependencies = {
    c8: toolingBaseline.c8Version,
    husky: toolingBaseline.huskyVersion,
    lerna: toolingBaseline.lernaVersion,
    '@produck/eslint-rules': requiredEslintRulesDependency,
    '@produck/agent-toolkit': requiredToolkitDependency,
  };

  const scriptState = buildScriptState(pkg);
  const dependencyState = buildDevDependencyState(pkg);

  const prettierConfigPath = path.resolve(cwd, PRETTIER_CONFIG_FILE);
  const eslintConfigPath = path.resolve(cwd, ESLINT_CONFIG_FILE);

  const previousPrettierConfig = readFileIfExists(prettierConfigPath);
  const previousEslintConfig = readFileIfExists(eslintConfigPath);

  const matchesRequiredBaseline = scriptState.previousBaseline === REQUIRED_BASELINE_SCRIPT_VALUE;
  const matchesRequiredFormat = scriptState.previousFormat === REQUIRED_FORMAT_SCRIPT_VALUE;
  const matchesRequiredLint = scriptState.previousLint === REQUIRED_LINT_SCRIPT_VALUE;
  const matchesRequiredPrecommitCheck =
    scriptState.previousPrecommitCheck === REQUIRED_PRECOMMIT_CHECK_SCRIPT_VALUE;
  const matchesRequiredManagedDevDependencies = Object.entries(requiredDevDependencies).every(
    ([name, version]) => {
      return dependencyState.previousManaged[name] === version;
    },
  );
  const matchesRequiredPrettierConfig = previousPrettierConfig === REQUIRED_PRETTIER_CONFIG;

  let eslintConfigAction = 'unchanged';
  let matchesRequiredEslintConfig = false;
  let nextEslintConfigText = previousEslintConfig;

  if (previousEslintConfig === null) {
    eslintConfigAction = 'initialized';
    nextEslintConfigText = REQUIRED_ESLINT_CONFIG;
  } else if (previousEslintConfig === REQUIRED_ESLINT_CONFIG) {
    matchesRequiredEslintConfig = true;
  } else if (previousEslintConfig.includes('@produck/eslint-rules')) {
    matchesRequiredEslintConfig = true;
  } else {
    const patched = patchEslintConfig(previousEslintConfig);
    if (patched.ok) {
      eslintConfigAction = 'patched';
      nextEslintConfigText = patched.output;
    } else {
      eslintConfigAction = 'unpatchable';
    }
  }

  const requiresUpdate =
    !matchesRequiredBaseline ||
    !matchesRequiredFormat ||
    !matchesRequiredLint ||
    !matchesRequiredPrecommitCheck ||
    !matchesRequiredManagedDevDependencies ||
    !matchesRequiredPrettierConfig ||
    !matchesRequiredEslintConfig;

  const hasUnpatchableEslintConfig = eslintConfigAction === 'unpatchable';

  if (mode === 'sync' && requiresUpdate && !hasUnpatchableEslintConfig) {
    scriptState.scripts[REQUIRED_BASELINE_SCRIPT_KEY] = REQUIRED_BASELINE_SCRIPT_VALUE;
    scriptState.scripts[REQUIRED_FORMAT_SCRIPT_KEY] = REQUIRED_FORMAT_SCRIPT_VALUE;
    scriptState.scripts[REQUIRED_LINT_SCRIPT_KEY] = REQUIRED_LINT_SCRIPT_VALUE;
    scriptState.scripts[REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY] =
      REQUIRED_PRECOMMIT_CHECK_SCRIPT_VALUE;
    pkg.scripts = scriptState.scripts;

    for (const [name, version] of Object.entries(requiredDevDependencies)) {
      dependencyState.devDependencies[name] = version;
    }
    pkg.devDependencies = dependencyState.devDependencies;

    fs.writeFileSync(rootPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    fs.writeFileSync(prettierConfigPath, REQUIRED_PRETTIER_CONFIG, 'utf8');
    fs.writeFileSync(eslintConfigPath, nextEslintConfigText || REQUIRED_ESLINT_CONFIG, 'utf8');
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
      formatScriptKey: REQUIRED_FORMAT_SCRIPT_KEY,
      formatScriptValue: REQUIRED_FORMAT_SCRIPT_VALUE,
      lintScriptKey: REQUIRED_LINT_SCRIPT_KEY,
      lintScriptValue: REQUIRED_LINT_SCRIPT_VALUE,
      precommitCheckScriptKey: REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY,
      precommitCheckScriptValue: REQUIRED_PRECOMMIT_CHECK_SCRIPT_VALUE,
      managedDevDependencies: requiredDevDependencies,
      prettierConfigPath: path.relative(cwd, prettierConfigPath),
      eslintConfigPath: path.relative(cwd, eslintConfigPath),
      eslintConfigAction,
    },
    status: {
      matchesRequiredBaselineBefore: matchesRequiredBaseline,
      matchesRequiredFormatBefore: matchesRequiredFormat,
      matchesRequiredLintBefore: matchesRequiredLint,
      matchesRequiredPrecommitCheckBefore: matchesRequiredPrecommitCheck,
      matchesRequiredManagedDevDependenciesBefore: matchesRequiredManagedDevDependencies,
      matchesRequiredPrettierConfigBefore: matchesRequiredPrettierConfig,
      matchesRequiredEslintConfigBefore: matchesRequiredEslintConfig,
      matchesRequiredBaselineAfter:
        requiresUpdate && mode === 'sync' && !hasUnpatchableEslintConfig
          ? true
          : matchesRequiredBaseline,
      matchesRequiredFormatAfter:
        requiresUpdate && mode === 'sync' && !hasUnpatchableEslintConfig
          ? true
          : matchesRequiredFormat,
      matchesRequiredLintAfter:
        requiresUpdate && mode === 'sync' && !hasUnpatchableEslintConfig
          ? true
          : matchesRequiredLint,
      matchesRequiredPrecommitCheckAfter:
        requiresUpdate && mode === 'sync' && !hasUnpatchableEslintConfig
          ? true
          : matchesRequiredPrecommitCheck,
      matchesRequiredManagedDevDependenciesAfter:
        requiresUpdate && mode === 'sync' && !hasUnpatchableEslintConfig
          ? true
          : matchesRequiredManagedDevDependencies,
      matchesRequiredPrettierConfigAfter:
        requiresUpdate && mode === 'sync' && !hasUnpatchableEslintConfig
          ? true
          : matchesRequiredPrettierConfig,
      matchesRequiredEslintConfigAfter:
        requiresUpdate && mode === 'sync' && !hasUnpatchableEslintConfig
          ? true
          : matchesRequiredEslintConfig,
      updated: requiresUpdate && mode === 'sync' && !hasUnpatchableEslintConfig,
      hasUnpatchableEslintConfig,
    },
  };

  if (mode === 'check' && (requiresUpdate || hasUnpatchableEslintConfig)) {
    report.ok = false;
  }

  if ((mode === 'sync' || mode === 'dry-run') && hasUnpatchableEslintConfig) {
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
