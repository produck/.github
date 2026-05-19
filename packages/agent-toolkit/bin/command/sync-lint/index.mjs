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
const ESLINT_RULES_PACKAGE_NAME = '@produck/eslint-rules';
const ESLINT_CONFIG_FILE = 'eslint.config.mjs';

const REQUIRED_LINT_SCRIPT_KEY = 'produck:lint';
const REQUIRED_LINT_SCRIPT_VALUE = 'eslint --fix . --max-warnings=0';
const ESLINT_CONFIG_TEMPLATE_PATH = path.resolve(
  COMMAND_DIR,
  'eslint.config.template.mjs',
);

function loadRequiredEslintConfig() {
  return fs.readFileSync(ESLINT_CONFIG_TEMPLATE_PATH, 'utf8');
}

export function printSyncLintHelp() {
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

const ESLINT_TOOLING_PACKAGE_NAMES = [
  'eslint',
  '@eslint/js',
  '@eslint/json',
  '@eslint/markdown',
  '@eslint/config-helpers',
  'typescript-eslint',
  'globals',
];

function getRequiredEslintDevDependencies() {
  // Prefer the in-tree source of truth for @produck/eslint-rules: when
  // sync-lint runs inside the monorepo, eslint-rules/package.json is
  // authoritative. When running as an installed dependency, fall back to the
  // publish-assets tooling baseline.
  const inTreeEslintRulesPkgPath = path.resolve(
    REPO_ROOT,
    'packages/eslint-rules/package.json',
  );

  let eslintRulesVersion = '';
  if (fs.existsSync(inTreeEslintRulesPkgPath)) {
    const eslintRulesPkg = parseJsonFile(
      inTreeEslintRulesPkgPath,
      'eslint-rules package.json',
    );
    // The '' fallback is for when the in-tree package.json has a non-string
    // version field, which never occurs for this package.
    const v =
      typeof eslintRulesPkg.version === 'string'
        ? eslintRulesPkg.version.trim()
        : /* c8 ignore next */
        '';
    if (v) {
      eslintRulesVersion = v;
    }
  }

  const toolingBaselinePath = TOOLING_BASELINE_CANDIDATE_PATHS.find(
    (candidatePath) => {
      return fs.existsSync(candidatePath);
    },
  );

  /* c8 ignore next 7 */
  if (!toolingBaselinePath) {
    console.error('Cannot resolve ESLint tooling versions. Looked at:');
    for (const candidatePath of TOOLING_BASELINE_CANDIDATE_PATHS) {
      console.error(`- ${candidatePath}`);
    }
    process.exit(2);
  }

  const baseline = parseJsonFile(toolingBaselinePath, 'Tooling baseline file');

  /* c8 ignore next 12 */
  if (!eslintRulesVersion) {
    const entry = baseline?.tools?.[ESLINT_RULES_PACKAGE_NAME];
    const v = typeof entry?.version === 'string' ? entry.version.trim() : '';
    if (!v) {
      console.error(
        `Tooling baseline tools["${ESLINT_RULES_PACKAGE_NAME}"].version must be a non-empty string: ${toolingBaselinePath}`,
      );
      process.exit(2);
    }
    eslintRulesVersion = v;
  }

  const deps = { [ESLINT_RULES_PACKAGE_NAME]: eslintRulesVersion };

  for (const name of ESLINT_TOOLING_PACKAGE_NAMES) {
    const entry = baseline?.tools?.[name];
    const v =
      typeof entry?.version === 'string'
        ? entry.version.trim()
        : /* c8 ignore next */
        '';
    /* c8 ignore next 6 */
    if (!v) {
      console.error(
        `Tooling baseline tools["${name}"].version must be a non-empty string: ${toolingBaselinePath}`,
      );
      process.exit(2);
    }
    deps[name] = v;
  }

  return deps;
}

function patchEslintConfig(existing) {
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

export function runSyncLint(options) {
  const REQUIRED_ESLINT_CONFIG = loadRequiredEslintConfig();
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

  const previousLint =
    typeof scripts[REQUIRED_LINT_SCRIPT_KEY] === 'string'
      ? scripts[REQUIRED_LINT_SCRIPT_KEY]
      : null;
  const requiredEslintDevDeps = getRequiredEslintDevDependencies();

  const eslintConfigPath = path.resolve(cwd, ESLINT_CONFIG_FILE);
  const previousEslintConfig = readFileIfExists(eslintConfigPath);

  const matchesRequiredLint = previousLint === REQUIRED_LINT_SCRIPT_VALUE;
  const matchesRequiredEslintDeps = Object.entries(requiredEslintDevDeps).every(
    ([name, version]) => devDependencies[name] === version,
  );

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
    !matchesRequiredLint ||
    !matchesRequiredEslintDeps ||
    !matchesRequiredEslintConfig;
  const hasUnpatchableEslintConfig = eslintConfigAction === 'unpatchable';

  if (mode === 'sync' && requiresUpdate && !hasUnpatchableEslintConfig) {
    scripts[REQUIRED_LINT_SCRIPT_KEY] = REQUIRED_LINT_SCRIPT_VALUE;
    pkg.scripts = scripts;

    for (const [name, version] of Object.entries(requiredEslintDevDeps)) {
      devDependencies[name] = version;
    }
    pkg.devDependencies = devDependencies;

    fs.writeFileSync(
      rootPackageJsonPath,
      `${JSON.stringify(pkg, null, 2)}\n`,
      'utf8',
    );
    // nextEslintConfigText is empty only if the patcher produces no output, which
    // does not occur in tests since the existing config is always patchable.
    fs.writeFileSync(
      eslintConfigPath,
      /* c8 ignore next */
      nextEslintConfigText || REQUIRED_ESLINT_CONFIG,
      'utf8',
    );
  }

  const report = {
    cwd,
    mode,
    ok: true,
    rootPackageJsonPath,
    required: {
      lintScriptKey: REQUIRED_LINT_SCRIPT_KEY,
      lintScriptValue: REQUIRED_LINT_SCRIPT_VALUE,
      eslintDevDependencies: requiredEslintDevDeps,
      eslintConfigPath: path.relative(cwd, eslintConfigPath),
      eslintConfigAction,
    },
    status: {
      matchesRequiredLintBefore: matchesRequiredLint,
      matchesRequiredEslintDepsBefore: matchesRequiredEslintDeps,
      matchesRequiredEslintConfigBefore: matchesRequiredEslintConfig,
      matchesRequiredLintAfter:
        requiresUpdate && mode === 'sync' && !hasUnpatchableEslintConfig
          ? true
          : matchesRequiredLint,
      matchesRequiredEslintDepsAfter:
        requiresUpdate && mode === 'sync' && !hasUnpatchableEslintConfig
          ? true
          : matchesRequiredEslintDeps,
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
