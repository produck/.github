#!/usr/bin/env node
import { printMainHelp } from './command/main/index.mjs';
import {
  printEnforceNodeBaselineHelp,
  runEnforceNodeBaseline,
} from './command/enforce-node-baseline/index.mjs';
import {
  printPreflightHelp,
  runPreflight,
} from './command/preflight/index.mjs';
import {
  printRunCaptureHelp,
  runCapture,
} from './command/run-capture/index.mjs';
import {
  printSummarizeHelp,
  runSummarize,
} from './command/summarize-log/index.mjs';
import {
  printSyncCoverageHelp,
  runSyncCoverage,
} from './command/sync-coverage/index.mjs';
import {
  printSyncInstallHelp,
  runSyncInstall,
} from './command/sync-install/index.mjs';
import {
  printSyncInstructionsHelp,
  runSyncInstructions,
} from './command/sync-instructions/index.mjs';
import {
  printSyncFormatHelp,
  runSyncFormat,
} from './command/sync-format/index.mjs';
import {
  printSyncEditorconfigHelp,
  runSyncEditorconfig,
} from './command/sync-editorconfig/index.mjs';
import { printSyncLintHelp, runSyncLint } from './command/sync-lint/index.mjs';
import { printSyncGitHelp, runSyncGit } from './command/sync-git/index.mjs';
import {
  printSyncPublishHelp,
  runSyncPublish,
} from './command/sync-publish/index.mjs';
import {
  printSyncTypescriptHelp,
  runSyncTypescript,
} from './command/sync-typescript/index.mjs';
import { hasFlag, parseCommonArgs } from './command/shared/args.mjs';
import {
  printValidateCommitMsgHelp,
  runValidateCommitMsg,
} from './command/validate-commit-msg/index.mjs';

const COMMANDS = {
  'enforce-node-baseline': {
    printHelp: printEnforceNodeBaselineHelp,
    run: runEnforceNodeBaseline,
  },
  preflight: {
    printHelp: printPreflightHelp,
    run: runPreflight,
  },
  'run-capture': {
    printHelp: printRunCaptureHelp,
    run: runCapture,
  },
  'summarize-log': {
    printHelp: printSummarizeHelp,
    run: runSummarize,
  },
  'sync-coverage': {
    printHelp: printSyncCoverageHelp,
    run: runSyncCoverage,
  },
  'sync-install': {
    printHelp: printSyncInstallHelp,
    run: runSyncInstall,
  },
  'sync-format': {
    printHelp: printSyncFormatHelp,
    run: runSyncFormat,
  },
  'sync-lint': {
    printHelp: printSyncLintHelp,
    run: runSyncLint,
  },
  'validate-commit-msg': {
    printHelp: printValidateCommitMsgHelp,
    run: runValidateCommitMsg,
  },
  'sync-instructions': {
    printHelp: printSyncInstructionsHelp,
    run: runSyncInstructions,
  },
  'sync-editorconfig': {
    printHelp: printSyncEditorconfigHelp,
    run: runSyncEditorconfig,
  },
  'sync-git': {
    printHelp: printSyncGitHelp,
    run: runSyncGit,
  },
  'sync-publish': {
    printHelp: printSyncPublishHelp,
    run: runSyncPublish,
  },
  'sync-typescript': {
    printHelp: printSyncTypescriptHelp,
    run: runSyncTypescript,
  },
};

const DEFAULT_COMMAND = 'enforce-node-baseline';

function printCommandHelp(command) {
  const entry = COMMANDS[command];
  if (!entry) {
    printMainHelp();
    return;
  }
  entry.printHelp();
}

function main() {
  const parsed = parseCommonArgs(process.argv.slice(2));
  const command = parsed.positional[0] || '';
  const options = parsed.options;

  if (
    command === '--help' ||
    command === '-h' ||
    (!command && hasFlag(options, '--help'))
  ) {
    printMainHelp();
    process.exit(0);
  }

  const effectiveCommand = command || DEFAULT_COMMAND;

  if (hasFlag(options, '--help') || hasFlag(options, '-h')) {
    printCommandHelp(effectiveCommand);
    process.exit(0);
  }

  const entry = COMMANDS[effectiveCommand];
  if (!entry) {
    console.error(`Unknown command: ${command}`);
    printMainHelp();
    process.exit(2);
  }

  entry.run(options);
}

main();
