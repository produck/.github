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
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function runToolkitSubcommand(cwd, args) {
  const result = spawnSync(process.execPath, [TOOLKIT_BIN, ...args], {
    cwd,
    encoding: 'utf8',
  });

  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  const status = typeof result.status === 'number' ? result.status : 1;

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

  const preflightArgs = ['preflight', '--cwd', cwd, '--require', 'package.json'];
  if (mode !== 'sync') {
    preflightArgs.push('--check-workspace-package-json', 'package.json');
  }

  const syncCoverageArgs = ['sync-coverage-script', '--cwd', cwd];
  for (const workspacePath of workspaces) {
    syncCoverageArgs.push('--workspace', workspacePath);
  }
  if (check) {
    syncCoverageArgs.push('--check');
  } else if (dryRun) {
    syncCoverageArgs.push('--dry-run');
  }

  const syncHuskyArgs = ['sync-husky-hooks', '--cwd', cwd];
  if (check) {
    syncHuskyArgs.push('--check');
  } else if (dryRun) {
    syncHuskyArgs.push('--dry-run');
  }

  const syncWorkspaceConfigArgs = ['sync-workspace-config', '--cwd', cwd];
  if (check) {
    syncWorkspaceConfigArgs.push('--check');
  } else if (dryRun) {
    syncWorkspaceConfigArgs.push('--dry-run');
  }

  const syncPrettierConfigArgs = ['sync-prettier-config', '--cwd', cwd];
  if (check) {
    syncPrettierConfigArgs.push('--check');
  } else if (dryRun) {
    syncPrettierConfigArgs.push('--dry-run');
  }

  const syncEslintConfigArgs = ['sync-eslint-config', '--cwd', cwd];
  if (check) {
    syncEslintConfigArgs.push('--check');
  } else if (dryRun) {
    syncEslintConfigArgs.push('--dry-run');
  }

  const plan = [
    { name: 'sync-instructions', args: syncInstructionsArgs },
    { name: 'preflight', args: preflightArgs },
    { name: 'sync-prettier-config', args: syncPrettierConfigArgs },
    { name: 'sync-eslint-config', args: syncEslintConfigArgs },
    { name: 'sync-workspace-config', args: syncWorkspaceConfigArgs },
    { name: 'sync-coverage-script', args: syncCoverageArgs },
    { name: 'sync-husky-hooks', args: syncHuskyArgs },
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
