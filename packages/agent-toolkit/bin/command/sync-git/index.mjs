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
const GITIGNORE_FILE = '.gitignore';
const HUSKY_DIR = '.husky';
const PRE_COMMIT_HOOK_FILE = 'pre-commit';
const COMMIT_MSG_HOOK_FILE = 'commit-msg';
const REQUIRED_BASELINE_SCRIPT_KEY = 'produck:baseline';
const REQUIRED_BASELINE_SCRIPT_VALUE =
  'npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd .';
const REQUIRED_COMMIT_CHECK_SCRIPT_KEY = 'produck:commit:check';
const REQUIRED_COMMIT_CHECK_SCRIPT_VALUE = 'npm run produck:format && npm run produck:lint';
const REQUIRED_PREPARE_SCRIPT_KEY = 'prepare';
const REQUIRED_PREPARE_SCRIPT_VALUE = 'husky';

const GITATTRIBUTES_SOURCE_CANDIDATE_PATHS = [
  path.resolve(REPO_ROOT, '.gitattributes'),
  path.resolve(PACKAGE_ROOT, 'publish-assets/gitattributes'),
];
const GITIGNORE_SOURCE_CANDIDATE_PATHS = [
  path.resolve(REPO_ROOT, '.gitignore'),
  path.resolve(PACKAGE_ROOT, 'publish-assets/gitignore'),
];

const REQUIRED_PRE_COMMIT_HOOK = '#!/usr/bin/env sh\nnpm run produck:commit:check\n';
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

function parseGitignoreEntries(text) {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function findMissingGitignoreEntries(currentContent, requiredEntries) {
  if (currentContent === null) {
    return [...requiredEntries];
  }

  const existingLines = new Set(currentContent.split('\n').map((line) => line.trimEnd()));

  return requiredEntries.filter((entry) => !existingLines.has(entry));
}

function loadGitSourceFiles() {
  const gitattributesSourcePath = GITATTRIBUTES_SOURCE_CANDIDATE_PATHS.find((p) =>
    fs.existsSync(p),
  );
  const gitignoreSourcePath = GITIGNORE_SOURCE_CANDIDATE_PATHS.find((p) => fs.existsSync(p));

  if (!gitattributesSourcePath) {
    console.error('Org .gitattributes source not found in expected locations:');
    for (const p of GITATTRIBUTES_SOURCE_CANDIDATE_PATHS) {
      console.error(`- ${p}`);
    }
    process.exit(2);
  }

  if (!gitignoreSourcePath) {
    console.error('Org .gitignore source not found in expected locations:');
    for (const p of GITIGNORE_SOURCE_CANDIDATE_PATHS) {
      console.error(`- ${p}`);
    }
    process.exit(2);
  }

  const gitattributesContent = fs.readFileSync(gitattributesSourcePath, 'utf8');
  const gitignoreContent = fs.readFileSync(gitignoreSourcePath, 'utf8');

  return {
    gitattributesSourcePath,
    gitignoreSourcePath,
    gitattributesContent,
    gitignoreOrgContent: gitignoreContent,
    gitignoreRequiredEntries: parseGitignoreEntries(gitignoreContent),
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
    previousCommitCheck:
      typeof scripts[REQUIRED_COMMIT_CHECK_SCRIPT_KEY] === 'string'
        ? scripts[REQUIRED_COMMIT_CHECK_SCRIPT_KEY]
        : null,
    previousPrepare:
      typeof scripts[REQUIRED_PREPARE_SCRIPT_KEY] === 'string'
        ? scripts[REQUIRED_PREPARE_SCRIPT_KEY]
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
  const gitSources = loadGitSourceFiles();
  const requiredGitAttributesContent = gitSources.gitattributesContent;
  const gitignoreRequiredEntries = gitSources.gitignoreRequiredEntries;
  const gitignoreOrgContent = gitSources.gitignoreOrgContent;
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
    [REQUIRED_COMMIT_CHECK_SCRIPT_KEY]: REQUIRED_COMMIT_CHECK_SCRIPT_VALUE,
    [REQUIRED_PREPARE_SCRIPT_KEY]: REQUIRED_PREPARE_SCRIPT_VALUE,
  });
  const dependencyValidation = validateRequiredExactEntries(
    dependencyState.devDependencies,
    requiredDevDependencies,
  );

  const matchesRequiredBaseline = !(REQUIRED_BASELINE_SCRIPT_KEY in scriptValidation.mismatches);
  const matchesRequiredCommitCheck = !(
    REQUIRED_COMMIT_CHECK_SCRIPT_KEY in scriptValidation.mismatches
  );
  const matchesRequiredPrepare = !(REQUIRED_PREPARE_SCRIPT_KEY in scriptValidation.mismatches);
  const matchesRequiredManagedDevDependencies = dependencyValidation.ok;

  const gitAttributesPath = path.resolve(cwd, GITATTRIBUTES_FILE);
  const gitignorePath = path.resolve(cwd, GITIGNORE_FILE);
  const huskyDir = path.resolve(cwd, HUSKY_DIR);
  const preCommitHookPath = path.resolve(huskyDir, PRE_COMMIT_HOOK_FILE);
  const commitMsgHookPath = path.resolve(huskyDir, COMMIT_MSG_HOOK_FILE);
  const currentContent = readFileIfExists(gitAttributesPath);
  const currentGitignoreContent = readFileIfExists(gitignorePath);
  const currentPreCommitHook = readFileIfExists(preCommitHookPath);
  const currentCommitMsgHook = readFileIfExists(commitMsgHookPath);
  const fileExists = currentContent !== null;
  const gitignoreExists = currentGitignoreContent !== null;
  const preCommitHookExists = currentPreCommitHook !== null;
  const commitMsgHookExists = currentCommitMsgHook !== null;
  const matchesRequiredGitAttributes = currentContent === requiredGitAttributesContent;
  const missingGitignoreEntries = findMissingGitignoreEntries(
    currentGitignoreContent,
    gitignoreRequiredEntries,
  );
  const matchesRequiredGitignore = missingGitignoreEntries.length === 0;
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
  if (!matchesRequiredGitignore) {
    mismatches.push({
      file: GITIGNORE_FILE,
      expected: 'all required org-baseline entries present',
      actual: gitignoreExists
        ? `missing ${missingGitignoreEntries.length} required entries`
        : 'missing',
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
    !matchesRequiredCommitCheck ||
    !matchesRequiredPrepare ||
    !matchesRequiredManagedDevDependencies;

  if (mode === 'sync' && requiresUpdate) {
    fs.mkdirSync(huskyDir, { recursive: true });
    fs.writeFileSync(gitAttributesPath, requiredGitAttributesContent, 'utf8');

    if (!matchesRequiredGitignore) {
      if (currentGitignoreContent === null) {
        fs.writeFileSync(gitignorePath, gitignoreOrgContent, 'utf8');
      } else {
        const appendText = `\n# produck:org-baseline\n${missingGitignoreEntries.join('\n')}\n`;
        fs.writeFileSync(gitignorePath, currentGitignoreContent + appendText, 'utf8');
      }
    }

    fs.writeFileSync(preCommitHookPath, REQUIRED_PRE_COMMIT_HOOK, 'utf8');
    fs.writeFileSync(commitMsgHookPath, REQUIRED_COMMIT_MSG_HOOK, 'utf8');

    scriptState.scripts[REQUIRED_BASELINE_SCRIPT_KEY] = REQUIRED_BASELINE_SCRIPT_VALUE;
    scriptState.scripts[REQUIRED_COMMIT_CHECK_SCRIPT_KEY] = REQUIRED_COMMIT_CHECK_SCRIPT_VALUE;
    scriptState.scripts[REQUIRED_PREPARE_SCRIPT_KEY] = REQUIRED_PREPARE_SCRIPT_VALUE;
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
      gitattributesSourcePath: gitSources.gitattributesSourcePath,
      content: requiredGitAttributesContent,
      gitignoreFile: GITIGNORE_FILE,
      gitignoreSourcePath: gitSources.gitignoreSourcePath,
      gitignoreRequiredEntries,
      baselineScriptKey: REQUIRED_BASELINE_SCRIPT_KEY,
      baselineScriptValue: REQUIRED_BASELINE_SCRIPT_VALUE,
      commitCheckScriptKey: REQUIRED_COMMIT_CHECK_SCRIPT_KEY,
      commitCheckScriptValue: REQUIRED_COMMIT_CHECK_SCRIPT_VALUE,
      prepareScriptKey: REQUIRED_PREPARE_SCRIPT_KEY,
      prepareScriptValue: REQUIRED_PREPARE_SCRIPT_VALUE,
      preCommitHookPath: path.relative(cwd, preCommitHookPath),
      commitMsgHookPath: path.relative(cwd, commitMsgHookPath),
      managedDevDependencies: requiredDevDependencies,
    },
    status: {
      fileExistsBefore: fileExists,
      gitignoreExistsBefore: gitignoreExists,
      preCommitHookExistsBefore: preCommitHookExists,
      commitMsgHookExistsBefore: commitMsgHookExists,
      matchesRequiredGitAttributesBefore: matchesRequiredGitAttributes,
      matchesRequiredGitignoreBefore: matchesRequiredGitignore,
      missingGitignoreEntriesBefore: missingGitignoreEntries,
      matchesRequiredPreCommitHookBefore: matchesRequiredPreCommitHook,
      matchesRequiredCommitMsgHookBefore: matchesRequiredCommitMsgHook,
      matchesRequiredBaselineBefore: matchesRequiredBaseline,
      matchesRequiredCommitCheckBefore: matchesRequiredCommitCheck,
      matchesRequiredPrepareBefore: matchesRequiredPrepare,
      matchesRequiredManagedDevDependenciesBefore: matchesRequiredManagedDevDependencies,
      mismatchesBefore: mismatches,
      fileExistsAfter: requiresUpdate && mode === 'sync' ? true : fileExists,
      gitignoreExistsAfter: requiresUpdate && mode === 'sync' ? true : gitignoreExists,
      preCommitHookExistsAfter: requiresUpdate && mode === 'sync' ? true : preCommitHookExists,
      commitMsgHookExistsAfter: requiresUpdate && mode === 'sync' ? true : commitMsgHookExists,
      matchesRequiredGitAttributesAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredGitAttributes,
      matchesRequiredGitignoreAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredGitignore,
      missingGitignoreEntriesAfter:
        requiresUpdate && mode === 'sync' ? [] : missingGitignoreEntries,
      matchesRequiredPreCommitHookAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredPreCommitHook,
      matchesRequiredCommitMsgHookAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredCommitMsgHook,
      matchesRequiredBaselineAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredBaseline,
      matchesRequiredCommitCheckAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredCommitCheck,
      matchesRequiredPrepareAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredPrepare,
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
