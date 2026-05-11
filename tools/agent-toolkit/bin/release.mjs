#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const LEVELS = new Set(['patch', 'minor', 'major']);

function usage() {
  console.log([
    'Usage:',
    '  node ./bin/release.mjs <patch|minor|major> [--publish]',
    '',
    'Behavior:',
    '  1) bump version (no git tag)',
    '  2) run verify',
    '  3) run publish:dry-run',
    '  4) optionally publish latest when --publish is set',
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

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

const level = args[0];
const shouldPublish = args.includes('--publish');

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
  console.log('[release] publish skipped (add --publish to publish)');
}
