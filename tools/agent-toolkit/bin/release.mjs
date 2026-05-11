#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';

const LEVELS = new Set(['patch', 'minor', 'major']);

function usage() {
  console.log([
    'Usage:',
    '  node ./bin/release.mjs',
    '  node ./bin/release.mjs <patch|minor|major> [--publish] [--no-commit] [--no-tag]',
    '  node ./bin/release.mjs --interactive',
    '',
    'Behavior:',
    '  1) bump version (no git tag)',
    '  2) run verify',
    '  3) run publish:dry-run',
    '  4) auto commit version change (default)',
    '  5) auto create git tag (default)',
    '  6) optionally publish latest when --publish is set',
    '',
    'Interactive mode defaults:',
    '  - release level: patch',
    '  - publish mode: dry-run',
    '  - auto commit: enabled',
    '  - auto tag: enabled',
  ].join('\n'));
}

function runNpm(args) {
  const result = spawnSync('npm', args, {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: true,
  });

  if (result.error) {
    console.error(`[release] failed to run npm ${args.join(' ')}:`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runGit(args) {
  const result = spawnSync('git', args, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  if (result.error) {
    console.error(`[release] failed to run git ${args.join(' ')}:`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function getDirtyFiles() {
  const result = spawnSync('git', ['status', '--porcelain'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  if (result.error || result.status !== 0) {
    console.error('[release] unable to check git status');
    process.exit(1);
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function ensureReleaseWorkspaceClean() {
  const dirty = getDirtyFiles();
  if (dirty.length === 0) {
    return;
  }

  console.error('[release] working tree is not clean before release:');
  for (const line of dirty) {
    console.error(`  ${line}`);
  }
  console.error('[release] commit/stash changes and retry');
  process.exit(2);
}

function commitAndTag(version, shouldCommit, shouldTag) {
  if (shouldCommit) {
    const message = `[UPGRADE] <infra>: release @produck/agent-toolkit ${version}`;
    console.log(`[release] commit version bump: ${message}`);
    runGit(['add', 'package.json']);
    runGit(['commit', '-m', message]);
  }

  if (shouldTag) {
    const tag = `agent-toolkit-v${version}`;
    console.log(`[release] create tag: ${tag}`);
    runGit(['tag', '-a', tag, '-m', `[UPGRADE] <infra>: tag ${tag}`]);
  }
}

function bumpPreview(version, level) {
  const parts = version.split('.').map((v) => Number(v));
  if (parts.length !== 3 || parts.some((v) => Number.isNaN(v))) {
    return `unknown (${version})`;
  }

  const [major, minor, patch] = parts;
  if (level === 'patch') {
    return `${major}.${minor}.${patch + 1}`;
  }
  if (level === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major + 1}.0.0`;
}

async function askInteractive(currentVersion) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(`[release] current version: ${currentVersion}`);
    console.log('[release] select release level:');
    console.log(`  1) patch (default) -> ${bumpPreview(currentVersion, 'patch')}`);
    console.log(`  2) minor           -> ${bumpPreview(currentVersion, 'minor')}`);
    console.log(`  3) major           -> ${bumpPreview(currentVersion, 'major')}`);

    const levelAnswer = (
      await rl.question('Choose level [1/2/3] (default: 1): ')
    ).trim();

    let level = 'patch';
    if (levelAnswer === '2') {
      level = 'minor';
    } else if (levelAnswer === '3') {
      level = 'major';
    } else if (levelAnswer && levelAnswer !== '1') {
      console.error(`Invalid level choice: ${levelAnswer}`);
      process.exit(2);
    }

    console.log('[release] select publish mode:');
    console.log('  1) dry-run only (default)');
    console.log('  2) publish latest after dry-run');

    const publishAnswer = (
      await rl.question('Choose mode [1/2] (default: 1): ')
    ).trim();

    let shouldPublish = false;
    if (publishAnswer === '2') {
      shouldPublish = true;
    } else if (publishAnswer && publishAnswer !== '1') {
      console.error(`Invalid publish choice: ${publishAnswer}`);
      process.exit(2);
    }

    console.log('[release] auto commit and tag settings:');
    console.log('  1) commit + tag (default)');
    console.log('  2) commit only');
    console.log('  3) no commit, no tag');

    const vcsAnswer = (
      await rl.question('Choose vcs mode [1/2/3] (default: 1): ')
    ).trim();

    let shouldCommit = true;
    let shouldTag = true;
    if (vcsAnswer === '2') {
      shouldCommit = true;
      shouldTag = false;
    } else if (vcsAnswer === '3') {
      shouldCommit = false;
      shouldTag = false;
    } else if (vcsAnswer && vcsAnswer !== '1') {
      console.error(`Invalid vcs choice: ${vcsAnswer}`);
      process.exit(2);
    }

    return { level, shouldPublish, shouldCommit, shouldTag };
  } finally {
    rl.close();
  }
}

function runRelease(level, shouldPublish, shouldCommit, shouldTag) {
  if (!LEVELS.has(level)) {
    console.error(`Invalid release level: ${level}`);
    usage();
    process.exit(2);
  }

  ensureReleaseWorkspaceClean();

  const pkgFile = path.resolve('package.json');
  const before = JSON.parse(fs.readFileSync(pkgFile, 'utf8')).version;

  console.log(`[release] bump version: ${level}`);
  runNpm(['version', level, '--no-git-tag-version']);

  const after = JSON.parse(fs.readFileSync(pkgFile, 'utf8')).version;
  console.log(`[release] version ${before} -> ${after}`);

  console.log('[release] verify toolkit');
  runNpm(['run', 'verify']);

  console.log('[release] publish dry-run');
  runNpm(['run', 'publish:dry-run']);

  commitAndTag(after, shouldCommit, shouldTag);

  if (shouldPublish) {
    console.log('[release] publish latest');
    runNpm(['run', 'publish:latest']);
  } else {
    console.log('[release] publish skipped (interactive default: dry-run)');
  }
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

const interactiveRequested = args.length === 0 || args.includes('--interactive');
if (interactiveRequested) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('Interactive mode requires a TTY.');
    usage();
    process.exit(2);
  }

  const pkgFile = path.resolve('package.json');
  const currentVersion = JSON.parse(fs.readFileSync(pkgFile, 'utf8')).version;
  const interactive = await askInteractive(currentVersion);
  runRelease(
    interactive.level,
    interactive.shouldPublish,
    interactive.shouldCommit,
    interactive.shouldTag
  );
  process.exit(0);
}

const level = args[0];
const shouldPublish = args.includes('--publish');
const shouldCommit = !args.includes('--no-commit');
const shouldTag = !args.includes('--no-tag');

if (shouldTag && !shouldCommit) {
  console.error('[release] --no-commit cannot be combined with tag enabled');
  process.exit(2);
}

runRelease(level, shouldPublish, shouldCommit, shouldTag);
