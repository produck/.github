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
    '  node ./bin/release.mjs <patch|minor|major> [--publish]',
    '  node ./bin/release.mjs --interactive',
    '',
    'Behavior:',
    '  1) bump version (no git tag)',
    '  2) run verify',
    '  3) run publish:dry-run',
    '  4) optionally publish latest when --publish is set',
    '',
    'Interactive mode defaults:',
    '  - release level: patch',
    '  - publish mode: dry-run',
  ].join('\n'));
}

function npmCmd() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function runNpm(args) {
  const result = spawnSync(npmCmd(), args, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
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

    return { level, shouldPublish };
  } finally {
    rl.close();
  }
}

function runRelease(level, shouldPublish) {
  if (!LEVELS.has(level)) {
    console.error(`Invalid release level: ${level}`);
    usage();
    process.exit(2);
  }

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
  runRelease(interactive.level, interactive.shouldPublish);
  process.exit(0);
}

const level = args[0];
const shouldPublish = args.includes('--publish');
runRelease(level, shouldPublish);
