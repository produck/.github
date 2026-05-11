#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const TOOLKIT_PACKAGE_NAME = '@produck/agent-toolkit';
const DISTRIBUTION_SOURCE_PATH = '.github/distribution/produck';
const PREVIEW_FLAG = '--preview-resolved-command';

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    const stderr = result.stderr?.trim();
    throw new Error(`git ${args.join(' ')} failed${stderr ? `: ${stderr}` : ''}`);
  }

  return result;
}

function findLatestToolkitTag() {
  const result = runGit([
    'tag',
    '--list',
    `${TOOLKIT_PACKAGE_NAME}@*`,
    '--sort=-v:refname',
  ]);

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

function getDistributionSourceChangesSince(tagName) {
  const result = runGit(
    ['diff', '--name-only', `${tagName}..HEAD`, '--', DISTRIBUTION_SOURCE_PATH],
    { allowFailure: true },
  );

  if (result.status !== 0 && result.status !== 1) {
    const stderr = result.stderr?.trim();
    throw new Error(
      `Unable to diff ${DISTRIBUTION_SOURCE_PATH} since ${tagName}${
        stderr ? `: ${stderr}` : ''
      }`,
    );
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function hasForcePublishArg(args) {
  return args.some(
    (arg) => arg === '--force-publish' || arg.startsWith('--force-publish='),
  );
}

function resolveForcePublish() {
  const latestTag = findLatestToolkitTag();

  if (!latestTag) {
    return {
      shouldForcePublish: true,
      reason: `No local tag found for ${TOOLKIT_PACKAGE_NAME}`,
      latestTag: null,
      changedFiles: [],
    };
  }

  const changedFiles = getDistributionSourceChangesSince(latestTag);

  if (changedFiles.length === 0) {
    return {
      shouldForcePublish: false,
      reason: `No distribution instruction changes since ${latestTag}`,
      latestTag,
      changedFiles,
    };
  }

  return {
    shouldForcePublish: true,
    reason: `Detected ${changedFiles.length} distribution instruction change(s) since ${latestTag}`,
    latestTag,
    changedFiles,
  };
}

function run() {
  const rawArgs = process.argv.slice(2);
  const previewOnly = rawArgs.includes(PREVIEW_FLAG);
  const userArgs = rawArgs.filter((arg) => arg !== PREVIEW_FLAG);

  const publishArgs = ['publish', ...userArgs];

  let forceState;
  try {
    forceState = resolveForcePublish();
  } catch (error) {
    process.stderr.write(`[lerna-publish] ${error.message}\n`);
    process.exit(1);
  }

  const userAlreadyProvidedForcePublish = hasForcePublishArg(userArgs);
  if (!userAlreadyProvidedForcePublish && forceState.shouldForcePublish) {
    publishArgs.push('--force-publish', TOOLKIT_PACKAGE_NAME);
  }

  process.stdout.write(`[lerna-publish] ${forceState.reason}\n`);
  if (forceState.changedFiles.length > 0) {
    for (const filePath of forceState.changedFiles) {
      process.stdout.write(`[lerna-publish] changed: ${filePath}\n`);
    }
  }

  if (previewOnly) {
    process.stdout.write(`[lerna-publish] command: npx lerna ${publishArgs.join(' ')}\n`);
    return;
  }

  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npxCommand, ['lerna', ...publishArgs], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    process.stderr.write(`[lerna-publish] ${result.error.message}\n`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

run();
