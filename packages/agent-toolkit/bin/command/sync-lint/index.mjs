import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const PACKAGE_ROOT = path.resolve(COMMAND_DIR, '../../..');
const TOOLKIT_PACKAGE_JSON = path.resolve(PACKAGE_ROOT, 'package.json');
const ESLINT_CONFIG_FILE = 'eslint.config.mjs';

const REQUIRED_LINT_SCRIPT_KEY = 'produck:lint';
const REQUIRED_LINT_SCRIPT_VALUE =
  'npm exec -- eslint --fix . --max-warnings=0 && npm run lint --if-present';
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

export function runSyncLint(options) {
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
  const previousEslintRules =
    typeof devDependencies['@produck/eslint-rules'] === 'string'
      ? devDependencies['@produck/eslint-rules']
      : null;

  const requiredEslintRulesDependency = getRequiredEslintRulesDevDependency();

  const eslintConfigPath = path.resolve(cwd, ESLINT_CONFIG_FILE);
  const previousEslintConfig = readFileIfExists(eslintConfigPath);

  const matchesRequiredLint = previousLint === REQUIRED_LINT_SCRIPT_VALUE;
  const matchesRequiredEslintRules = previousEslintRules === requiredEslintRulesDependency;

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
    !matchesRequiredLint || !matchesRequiredEslintRules || !matchesRequiredEslintConfig;
  const hasUnpatchableEslintConfig = eslintConfigAction === 'unpatchable';

  if (mode === 'sync' && requiresUpdate && !hasUnpatchableEslintConfig) {
    scripts[REQUIRED_LINT_SCRIPT_KEY] = REQUIRED_LINT_SCRIPT_VALUE;
    pkg.scripts = scripts;

    devDependencies['@produck/eslint-rules'] = requiredEslintRulesDependency;
    pkg.devDependencies = devDependencies;

    fs.writeFileSync(rootPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    fs.writeFileSync(eslintConfigPath, nextEslintConfigText || REQUIRED_ESLINT_CONFIG, 'utf8');
  }

  const report = {
    cwd,
    mode,
    ok: true,
    rootPackageJsonPath,
    required: {
      lintScriptKey: REQUIRED_LINT_SCRIPT_KEY,
      lintScriptValue: REQUIRED_LINT_SCRIPT_VALUE,
      eslintRulesVersion: requiredEslintRulesDependency,
      eslintConfigPath: path.relative(cwd, eslintConfigPath),
      eslintConfigAction,
    },
    status: {
      matchesRequiredLintBefore: matchesRequiredLint,
      matchesRequiredEslintRulesBefore: matchesRequiredEslintRules,
      matchesRequiredEslintConfigBefore: matchesRequiredEslintConfig,
      matchesRequiredLintAfter:
        requiresUpdate && mode === 'sync' && !hasUnpatchableEslintConfig
          ? true
          : matchesRequiredLint,
      matchesRequiredEslintRulesAfter:
        requiresUpdate && mode === 'sync' && !hasUnpatchableEslintConfig
          ? true
          : matchesRequiredEslintRules,
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
