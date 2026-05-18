import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { getMulti, getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const TOOLKIT_BIN = path.resolve(COMMAND_DIR, '../../agent-toolkit.mjs');

export function printEnforceNodeBaselineHelp() {
  printTextResource(HELP_FILE);
}

function parseJsonOrNull(text) {
  const trimmed = text.trim();
  /* c8 ignore start */
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
  /* c8 ignore stop */
}

function runToolkitSubcommand(cwd, args) {
  const result = spawnSync(process.execPath, [TOOLKIT_BIN, ...args], {
    cwd,
    encoding: 'utf8',
  });

  /* c8 ignore start */
  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  const status = typeof result.status === 'number' ? result.status : 1;
  /* c8 ignore stop */

  return {
    args,
    status,
    ok: status === 0,
    report: parseJsonOrNull(stdout),
    stdout,
    stderr,
  };
}

function buildStepReport(name, stepResult) {
  const hasParsedReport = Boolean(stepResult.report);

  return {
    name,
    args: stepResult.args,
    status: stepResult.status,
    ok: stepResult.ok,
    report: stepResult.report,
    /* c8 ignore next */
    stdout: hasParsedReport ? '' : stepResult.stdout,
    stderr: stepResult.stderr,
  };
}

export function runEnforceNodeBaseline(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const source = getSingle(options, '--source', '');
  const force = hasFlag(options, '--force');
  const prune = hasFlag(options, '--prune');
  const check = hasFlag(options, '--check');
  const dryRun = hasFlag(options, '--dry-run') && !check;
  const jsonFile = getSingle(options, '--json', '');
  const workspaces = getMulti(options, '--workspace');

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const mode = check ? 'check' : dryRun ? 'dry-run' : 'sync';
  const report = {
    cwd,
    mode,
    ok: true,
    steps: [],
  };

  const syncInstructionsArgs = ['sync-instructions', '--cwd', cwd];
  if (source) {
    syncInstructionsArgs.push('--source', source);
  }
  if (force) {
    syncInstructionsArgs.push('--force');
  }
  if (prune) {
    syncInstructionsArgs.push('--prune');
  }
  if (mode !== 'sync') {
    syncInstructionsArgs.push('--dry-run');
  }

  const preflightArgs = [
    'preflight',
    '--cwd',
    cwd,
    '--require',
    'package.json',
  ];
  if (mode !== 'sync') {
    preflightArgs.push('--check-workspace-package-json', 'package.json');
  }

  const syncCoverageArgs = ['sync-coverage', '--cwd', cwd];
  for (const workspacePath of workspaces) {
    syncCoverageArgs.push('--workspace', workspacePath);
  }
  if (check) {
    syncCoverageArgs.push('--check');
  } else if (dryRun) {
    syncCoverageArgs.push('--dry-run');
  }

  const syncPublishArgs = ['sync-publish', '--cwd', cwd];
  if (check) {
    syncPublishArgs.push('--check');
  } else if (dryRun) {
    syncPublishArgs.push('--dry-run');
  }

  const syncInstallArgs = ['sync-install', '--cwd', cwd];
  if (check) {
    syncInstallArgs.push('--check');
  } else if (dryRun) {
    syncInstallArgs.push('--dry-run');
  }

  const syncGitArgs = ['sync-git', '--cwd', cwd];
  if (check) {
    syncGitArgs.push('--check');
  } else if (dryRun) {
    syncGitArgs.push('--dry-run');
  }

  const syncEditorconfigArgs = ['sync-editorconfig', '--cwd', cwd];
  if (check) {
    syncEditorconfigArgs.push('--check');
  } else if (dryRun) {
    syncEditorconfigArgs.push('--dry-run');
  }

  const syncPrettierConfigArgs = ['sync-format', '--cwd', cwd];
  if (check) {
    syncPrettierConfigArgs.push('--check');
  } else if (dryRun) {
    syncPrettierConfigArgs.push('--dry-run');
  }

  const syncEslintConfigArgs = ['sync-lint', '--cwd', cwd];
  if (check) {
    syncEslintConfigArgs.push('--check');
  } else if (dryRun) {
    syncEslintConfigArgs.push('--dry-run');
  }

  const plan = [
    { name: 'preflight', args: preflightArgs },
    { name: 'sync-instructions', args: syncInstructionsArgs },
    { name: 'sync-editorconfig', args: syncEditorconfigArgs },
    { name: 'sync-format', args: syncPrettierConfigArgs },
    { name: 'sync-lint', args: syncEslintConfigArgs },
    { name: 'sync-install', args: syncInstallArgs },
    { name: 'sync-git', args: syncGitArgs },
    { name: 'sync-coverage', args: syncCoverageArgs },
    { name: 'sync-publish', args: syncPublishArgs },
  ];

  for (const step of plan) {
    const stepResult = runToolkitSubcommand(cwd, step.args);
    report.steps.push(buildStepReport(step.name, stepResult));

    if (!stepResult.ok) {
      report.ok = false;
      break;
    }
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
