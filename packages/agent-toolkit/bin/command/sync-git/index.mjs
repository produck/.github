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

const GITATTRIBUTES_FILE = '.gitattributes';
const HUSKY_DIR = '.husky';
const PRE_COMMIT_HOOK_FILE = 'pre-commit';
const COMMIT_MSG_HOOK_FILE = 'commit-msg';
const REQUIRED_BASELINE_SCRIPT_KEY = 'produck:baseline';
const REQUIRED_BASELINE_SCRIPT_VALUE =
  'npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd .';
const REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY = 'produck:precommit-check';
const REQUIRED_PRECOMMIT_CHECK_SCRIPT_VALUE = 'npm run produck:format && npm run produck:lint';

const REQUIRED_GITATTRIBUTES_CONTENT = `* text=auto eol=lf

# Windows script entrypoints
*.bat text eol=crlf
*.cmd text eol=crlf
`;
const REQUIRED_PRE_COMMIT_HOOK = '#!/usr/bin/env sh\nnpm run produck:precommit-check\n';
const REQUIRED_COMMIT_MSG_HOOK =
  '#!/usr/bin/env sh\nnode ./node_modules/@produck/agent-toolkit/bin/agent-toolkit.mjs validate-commit-msg --file "$1"\n';

export function printSyncGitHelp() {
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
  const huskyVersion = String(baseline?.tools?.husky?.version || '').trim();
  const lernaVersion = String(baseline?.tools?.lerna?.version || '').trim();

  if (!huskyVersion || !lernaVersion) {
    console.error(
      `Tooling baseline must define fixed tools.husky/lerna.version: ${toolingBaselinePath}`,
    );
    process.exit(2);
  }

  return {
    toolingBaselinePath,
    huskyVersion,
    lernaVersion,
  };
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
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
      husky: typeof devDependencies.husky === 'string' ? devDependencies.husky : null,
      lerna: typeof devDependencies.lerna === 'string' ? devDependencies.lerna : null,
      '@produck/agent-toolkit':
        typeof devDependencies['@produck/agent-toolkit'] === 'string'
          ? devDependencies['@produck/agent-toolkit']
          : null,
    },
  };
}

export function runSyncGit(options) {
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
    husky: toolingBaseline.huskyVersion,
    lerna: toolingBaseline.lernaVersion,
    '@produck/agent-toolkit': requiredToolkitDependency,
  };

  const scriptState = buildScriptState(pkg);
  const dependencyState = buildDevDependencyState(pkg);
  const scriptValidation = validateRequiredExactEntries(scriptState.scripts, {
    [REQUIRED_BASELINE_SCRIPT_KEY]: REQUIRED_BASELINE_SCRIPT_VALUE,
    [REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY]: REQUIRED_PRECOMMIT_CHECK_SCRIPT_VALUE,
  });
  const dependencyValidation = validateRequiredExactEntries(
    dependencyState.devDependencies,
    requiredDevDependencies,
  );

  const matchesRequiredBaseline = !(REQUIRED_BASELINE_SCRIPT_KEY in scriptValidation.mismatches);
  const matchesRequiredPrecommitCheck = !(
    REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY in scriptValidation.mismatches
  );
  const matchesRequiredManagedDevDependencies = dependencyValidation.ok;

  const gitAttributesPath = path.resolve(cwd, GITATTRIBUTES_FILE);
  const huskyDir = path.resolve(cwd, HUSKY_DIR);
  const preCommitHookPath = path.resolve(huskyDir, PRE_COMMIT_HOOK_FILE);
  const commitMsgHookPath = path.resolve(huskyDir, COMMIT_MSG_HOOK_FILE);
  const currentContent = readFileIfExists(gitAttributesPath);
  const currentPreCommitHook = readFileIfExists(preCommitHookPath);
  const currentCommitMsgHook = readFileIfExists(commitMsgHookPath);
  const fileExists = currentContent !== null;
  const preCommitHookExists = currentPreCommitHook !== null;
  const commitMsgHookExists = currentCommitMsgHook !== null;
  const matchesRequiredGitAttributes = currentContent === REQUIRED_GITATTRIBUTES_CONTENT;
  const matchesRequiredPreCommitHook = currentPreCommitHook === REQUIRED_PRE_COMMIT_HOOK;
  const matchesRequiredCommitMsgHook = currentCommitMsgHook === REQUIRED_COMMIT_MSG_HOOK;

  const mismatches = [];
  if (!matchesRequiredGitAttributes) {
    mismatches.push({
      file: GITATTRIBUTES_FILE,
      expected: 'exact required content',
      actual: fileExists ? 'different content' : 'missing',
    });
  }
  if (!matchesRequiredPreCommitHook) {
    mismatches.push({
      file: `${HUSKY_DIR}/${PRE_COMMIT_HOOK_FILE}`,
      expected: 'exact required content',
      actual: preCommitHookExists ? 'different content' : 'missing',
    });
  }
  if (!matchesRequiredCommitMsgHook) {
    mismatches.push({
      file: `${HUSKY_DIR}/${COMMIT_MSG_HOOK_FILE}`,
      expected: 'exact required content',
      actual: commitMsgHookExists ? 'different content' : 'missing',
    });
  }

  const requiresUpdate =
    mismatches.length > 0 ||
    !matchesRequiredBaseline ||
    !matchesRequiredPrecommitCheck ||
    !matchesRequiredManagedDevDependencies;

  if (mode === 'sync' && requiresUpdate) {
    fs.mkdirSync(huskyDir, { recursive: true });
    fs.writeFileSync(gitAttributesPath, REQUIRED_GITATTRIBUTES_CONTENT, 'utf8');
    fs.writeFileSync(preCommitHookPath, REQUIRED_PRE_COMMIT_HOOK, 'utf8');
    fs.writeFileSync(commitMsgHookPath, REQUIRED_COMMIT_MSG_HOOK, 'utf8');

    scriptState.scripts[REQUIRED_BASELINE_SCRIPT_KEY] = REQUIRED_BASELINE_SCRIPT_VALUE;
    scriptState.scripts[REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY] =
      REQUIRED_PRECOMMIT_CHECK_SCRIPT_VALUE;
    pkg.scripts = scriptState.scripts;

    for (const [name, version] of Object.entries(requiredDevDependencies)) {
      dependencyState.devDependencies[name] = version;
    }
    pkg.devDependencies = dependencyState.devDependencies;

    fs.writeFileSync(rootPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }

  const report = {
    cwd,
    mode,
    ok: true,
    rootPackageJsonPath,
    toolingBaselinePath: toolingBaseline.toolingBaselinePath,
    required: {
      file: GITATTRIBUTES_FILE,
      content: REQUIRED_GITATTRIBUTES_CONTENT,
      baselineScriptKey: REQUIRED_BASELINE_SCRIPT_KEY,
      baselineScriptValue: REQUIRED_BASELINE_SCRIPT_VALUE,
      precommitCheckScriptKey: REQUIRED_PRECOMMIT_CHECK_SCRIPT_KEY,
      precommitCheckScriptValue: REQUIRED_PRECOMMIT_CHECK_SCRIPT_VALUE,
      preCommitHookPath: path.relative(cwd, preCommitHookPath),
      commitMsgHookPath: path.relative(cwd, commitMsgHookPath),
      managedDevDependencies: requiredDevDependencies,
    },
    status: {
      fileExistsBefore: fileExists,
      preCommitHookExistsBefore: preCommitHookExists,
      commitMsgHookExistsBefore: commitMsgHookExists,
      matchesRequiredGitAttributesBefore: matchesRequiredGitAttributes,
      matchesRequiredPreCommitHookBefore: matchesRequiredPreCommitHook,
      matchesRequiredCommitMsgHookBefore: matchesRequiredCommitMsgHook,
      matchesRequiredBaselineBefore: matchesRequiredBaseline,
      matchesRequiredPrecommitCheckBefore: matchesRequiredPrecommitCheck,
      matchesRequiredManagedDevDependenciesBefore: matchesRequiredManagedDevDependencies,
      mismatchesBefore: mismatches,
      fileExistsAfter: requiresUpdate && mode === 'sync' ? true : fileExists,
      preCommitHookExistsAfter: requiresUpdate && mode === 'sync' ? true : preCommitHookExists,
      commitMsgHookExistsAfter: requiresUpdate && mode === 'sync' ? true : commitMsgHookExists,
      matchesRequiredGitAttributesAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredGitAttributes,
      matchesRequiredPreCommitHookAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredPreCommitHook,
      matchesRequiredCommitMsgHookAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredCommitMsgHook,
      matchesRequiredBaselineAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredBaseline,
      matchesRequiredPrecommitCheckAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredPrecommitCheck,
      matchesRequiredManagedDevDependenciesAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredManagedDevDependencies,
      mismatchesAfter: requiresUpdate && mode === 'sync' ? [] : mismatches,
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
