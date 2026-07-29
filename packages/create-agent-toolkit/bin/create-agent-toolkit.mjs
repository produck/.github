#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { prompt, readPipedLines } from '../src/input.mjs';
import { bootstrapRepo, toolkitBin } from '../src/bootstrap.mjs';

// --- Private helpers ---

/**
 * Interactive TTY initialization: prompt user, then bootstrap.
 * @param {string} cwd
 * @returns {Promise<void>}
 */
async function initInteractive(cwd) {
  const dirName = path.basename(cwd);

  process.stdout.write('Produck Repository Initialization\n');
  process.stdout.write('================================\n\n');

  const repoName = await prompt('Repository name (\u8BCD\u6839)', dirName);
  const moduleName = await prompt('First workspace module name', repoName);

  bootstrapRepo(cwd, repoName, moduleName);
}

/**
 * Non-interactive piped-stdin initialization: read lines, then bootstrap.
 * @param {string} cwd
 */
function initFromPipedStdin(cwd) {
  const dirName = path.basename(cwd);
  const lines = readPipedLines();

  const repoName = lines[0] || dirName;
  const moduleName = lines[1] || repoName;

  bootstrapRepo(cwd, repoName, moduleName);
}

// --- Main ---
const cwd = process.cwd();
const packageJsonPath = path.join(cwd, 'package.json');

if (fs.existsSync(packageJsonPath)) {
  // Existing repository: run enforce-node-baseline directly
  const result = spawnSync(
    process.execPath,
    [toolkitBin, 'enforce-node-baseline', '--cwd', '.'],
    { stdio: 'inherit', cwd },
  );
  /* c8 ignore next */
  process.exit(result.status ?? 0);
}

// New empty repository
if (process.stdin.isTTY) {
  // Interactive mode (human typing)
  initInteractive(cwd).catch((err) => {
    process.stderr.write(`Initialization failed: ${err.message}\n`);
    process.exit(1);
  });
} else {
  // Piped input mode (non-interactive, used by tests)
  initFromPipedStdin(cwd);
}
