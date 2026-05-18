import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const PACKAGE_ROOT = path.resolve(COMMAND_DIR, '../../..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');
const LERNA_CONFIG_FILE = 'lerna.json';
const LERNA_TEMPLATE_CANDIDATE_PATHS = [
  path.resolve(REPO_ROOT, LERNA_CONFIG_FILE),
  path.resolve(PACKAGE_ROOT, 'publish-assets', LERNA_CONFIG_FILE),
];

const REQUIRED_PUBLISH_CHECK_SCRIPT_KEY = 'produck:publish:check';
const REQUIRED_PUBLISH_CHECK_SCRIPT_VALUE =
  'npm run produck:install && npm run produck:coverage && produck:commit:check';
const REQUIRED_PUBLISH_SCRIPT_KEY = 'produck:publish';
const REQUIRED_PUBLISH_SCRIPT_VALUE =
  'npm run produck:publish:check && npm run publish --';
const REQUIRED_LERNA_VERSION_COMMIT_HOOKS = false;

export function printSyncPublishHelp() {
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

function loadRequiredLernaTemplate() {
  const templatePath = LERNA_TEMPLATE_CANDIDATE_PATHS.find((candidatePath) => {
    return fs.existsSync(candidatePath);
  });

  if (!templatePath) {
    console.error('lerna template does not exist in expected locations:');
    for (const candidatePath of LERNA_TEMPLATE_CANDIDATE_PATHS) {
      console.error(`- ${candidatePath}`);
    }
    process.exit(2);
  }

  const template = parseJsonFile(templatePath, 'lerna template');
  if (typeof template.version !== 'string') {
    console.error(
      `lerna template must have a "version" field: ${templatePath}`,
    );
    process.exit(2);
  }

  // The {} fallbacks below guard against templates that omit 'command' or
  // 'command.version'; the canonical lerna template always provides both.
  const normalizedTemplate = {
    ...template,
    command: {
      ...(template.command && typeof template.command === 'object'
        ? template.command
        : /* c8 ignore next */
        {}),
      version: {
        ...(template?.command?.version &&
        typeof template.command.version === 'object'
          ? template.command.version
          : /* c8 ignore next */
          {}),
        commitHooks: REQUIRED_LERNA_VERSION_COMMIT_HOOKS,
      },
    },
  };

  return {
    templatePath,
    content: `${JSON.stringify(normalizedTemplate, null, 2)}\n`,
  };
}

export function runSyncPublish(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const check = hasFlag(options, '--check');
  const dryRun = hasFlag(options, '--dry-run') && !check;
  const jsonFile = getSingle(options, '--json', '');
  const mode = check ? 'check' : dryRun ? 'dry-run' : 'sync';
  const requiredLernaTemplate = loadRequiredLernaTemplate();

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const lernaConfigPath = path.resolve(cwd, LERNA_CONFIG_FILE);
  const lernaExistedBefore = fs.existsSync(lernaConfigPath);
  let lernaDefaultCreated = false;
  let matchesRequiredLernaCommitHooks = false;
  let matchesRequiredLernaCommitHooksBefore = false;

  if (!lernaExistedBefore) {
    if (mode === 'sync') {
      fs.writeFileSync(lernaConfigPath, requiredLernaTemplate.content, 'utf8');
      lernaDefaultCreated = true;
      matchesRequiredLernaCommitHooks = true;
    }
  } else {
    const lernaConfig = parseJsonFile(lernaConfigPath, 'lerna.json');

    if (typeof lernaConfig.version !== 'string') {
      console.error(
        `lerna.json must have a "version" field: ${lernaConfigPath}`,
      );
      process.exit(2);
    }

    const currentCommitHooks = lernaConfig?.command?.version?.commitHooks;
    matchesRequiredLernaCommitHooks =
      currentCommitHooks === REQUIRED_LERNA_VERSION_COMMIT_HOOKS;
    matchesRequiredLernaCommitHooksBefore = matchesRequiredLernaCommitHooks;

    if (mode === 'sync' && !matchesRequiredLernaCommitHooks) {
      const nextLernaConfig = {
        ...lernaConfig,
        command: {
          ...(lernaConfig.command && typeof lernaConfig.command === 'object'
            ? lernaConfig.command
            : {}),
          version: {
            ...(lernaConfig?.command?.version &&
            typeof lernaConfig.command.version === 'object'
              ? lernaConfig.command.version
              : {}),
            commitHooks: REQUIRED_LERNA_VERSION_COMMIT_HOOKS,
          },
        },
      };
      fs.writeFileSync(
        lernaConfigPath,
        `${JSON.stringify(nextLernaConfig, null, 2)}\n`,
        'utf8',
      );
      matchesRequiredLernaCommitHooks = true;
    }
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

  const previousPublishCheck =
    typeof scripts[REQUIRED_PUBLISH_CHECK_SCRIPT_KEY] === 'string'
      ? scripts[REQUIRED_PUBLISH_CHECK_SCRIPT_KEY]
      : null;
  const previousPublish =
    typeof scripts[REQUIRED_PUBLISH_SCRIPT_KEY] === 'string'
      ? scripts[REQUIRED_PUBLISH_SCRIPT_KEY]
      : null;

  const matchesRequiredPublishCheck =
    previousPublishCheck === REQUIRED_PUBLISH_CHECK_SCRIPT_VALUE;
  const matchesRequiredPublish =
    previousPublish === REQUIRED_PUBLISH_SCRIPT_VALUE;
  const lernaRequiresCreation = !lernaExistedBefore && !lernaDefaultCreated;
  const requiresUpdate =
    !matchesRequiredPublishCheck ||
    !matchesRequiredPublish ||
    lernaRequiresCreation ||
    !matchesRequiredLernaCommitHooks;

  if (
    mode === 'sync' &&
    (!matchesRequiredPublishCheck || !matchesRequiredPublish)
  ) {
    scripts[REQUIRED_PUBLISH_CHECK_SCRIPT_KEY] =
      REQUIRED_PUBLISH_CHECK_SCRIPT_VALUE;
    scripts[REQUIRED_PUBLISH_SCRIPT_KEY] = REQUIRED_PUBLISH_SCRIPT_VALUE;
    pkg.scripts = scripts;
    fs.writeFileSync(
      rootPackageJsonPath,
      `${JSON.stringify(pkg, null, 2)}\n`,
      'utf8',
    );
  }

  const report = {
    cwd,
    mode,
    ok: true,
    lernaConfigPath,
    rootPackageJsonPath,
    required: {
      lernaTemplatePath: requiredLernaTemplate.templatePath,
      publishCheckScriptKey: REQUIRED_PUBLISH_CHECK_SCRIPT_KEY,
      publishCheckScriptValue: REQUIRED_PUBLISH_CHECK_SCRIPT_VALUE,
      publishScriptKey: REQUIRED_PUBLISH_SCRIPT_KEY,
      publishScriptValue: REQUIRED_PUBLISH_SCRIPT_VALUE,
      lernaVersionCommitHooks: REQUIRED_LERNA_VERSION_COMMIT_HOOKS,
    },
    status: {
      lernaExistedBefore,
      lernaDefaultCreated,
      matchesRequiredLernaCommitHooksBefore:
        matchesRequiredLernaCommitHooksBefore,
      matchesRequiredLernaCommitHooksAfter: matchesRequiredLernaCommitHooks,
      matchesRequiredPublishCheckBefore: matchesRequiredPublishCheck,
      matchesRequiredPublishCheckAfter:
        !matchesRequiredPublishCheck && mode === 'sync'
          ? true
          : matchesRequiredPublishCheck,
      matchesRequiredPublishBefore: matchesRequiredPublish,
      matchesRequiredPublishAfter:
        !matchesRequiredPublish && mode === 'sync'
          ? true
          : matchesRequiredPublish,
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
