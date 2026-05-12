import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');

const REQUIRED_PRE_COMMIT_HOOK = '#!/usr/bin/env sh\nnpm run produck:precommit-check\n';
const REQUIRED_COMMIT_MSG_HOOK =
  '#!/usr/bin/env sh\nnode ./node_modules/@produck/agent-toolkit/bin/agent-toolkit.mjs validate-commit-msg --file "$1"\n';

export function printSyncHuskyHooksHelp() {
  printTextResource(HELP_FILE);
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
}

export function runSyncHuskyHooks(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const check = hasFlag(options, '--check');
  const dryRun = hasFlag(options, '--dry-run') && !check;
  const jsonFile = getSingle(options, '--json', '');
  const mode = check ? 'check' : dryRun ? 'dry-run' : 'sync';

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const huskyDir = path.resolve(cwd, '.husky');
  const preCommitHookPath = path.resolve(huskyDir, 'pre-commit');
  const commitMsgHookPath = path.resolve(huskyDir, 'commit-msg');

  const previousPreCommitHook = readFileIfExists(preCommitHookPath);
  const previousCommitMsgHook = readFileIfExists(commitMsgHookPath);

  const matchesRequiredPreCommitHook = previousPreCommitHook === REQUIRED_PRE_COMMIT_HOOK;
  const matchesRequiredCommitMsgHook = previousCommitMsgHook === REQUIRED_COMMIT_MSG_HOOK;
  const requiresUpdate = !matchesRequiredPreCommitHook || !matchesRequiredCommitMsgHook;

  if (mode === 'sync' && requiresUpdate) {
    fs.mkdirSync(huskyDir, { recursive: true });
    fs.writeFileSync(preCommitHookPath, REQUIRED_PRE_COMMIT_HOOK, 'utf8');
    fs.writeFileSync(commitMsgHookPath, REQUIRED_COMMIT_MSG_HOOK, 'utf8');
  }

  const report = {
    cwd,
    mode,
    ok: true,
    required: {
      preCommitHookPath: path.relative(cwd, preCommitHookPath),
      commitMsgHookPath: path.relative(cwd, commitMsgHookPath),
    },
    status: {
      matchesRequiredPreCommitHookBefore: matchesRequiredPreCommitHook,
      matchesRequiredCommitMsgHookBefore: matchesRequiredCommitMsgHook,
      matchesRequiredPreCommitHookAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredPreCommitHook,
      matchesRequiredCommitMsgHookAfter:
        requiresUpdate && mode === 'sync' ? true : matchesRequiredCommitMsgHook,
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
