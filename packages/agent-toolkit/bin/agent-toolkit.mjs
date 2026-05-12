#!/usr/bin/env node
import { printMainHelp } from './command/main/index.mjs';
import { printPreflightHelp, runPreflight } from './command/preflight/index.mjs';
import { printRunCaptureHelp, runCapture } from './command/run-capture/index.mjs';
import { printSummarizeHelp, runSummarize } from './command/summarize-log/index.mjs';
import {
  printSyncCoverageScriptHelp,
  runSyncCoverageScript,
} from './command/sync-coverage-script/index.mjs';
import {
  printSyncInstructionsHelp,
  runSyncInstructions,
} from './command/sync-instructions/index.mjs';
import { hasFlag, parseCommonArgs } from './command/shared/args.mjs';
import {
  printValidateCommitMsgHelp,
  runValidateCommitMsg,
} from './command/validate-commit-msg/index.mjs';

const COMMANDS = {
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
  'sync-coverage-script': {
    printHelp: printSyncCoverageScriptHelp,
    run: runSyncCoverageScript,
  },
  'validate-commit-msg': {
    printHelp: printValidateCommitMsgHelp,
    run: runValidateCommitMsg,
  },
  'sync-instructions': {
    printHelp: printSyncInstructionsHelp,
    run: runSyncInstructions,
  },
};

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

  if (!command || command === '--help' || command === '-h') {
    printMainHelp();
    process.exit(0);
  }

  if (hasFlag(options, '--help') || hasFlag(options, '-h')) {
    printCommandHelp(command);
    process.exit(0);
  }

  const entry = COMMANDS[command];
  if (!entry) {
    console.error(`Unknown command: ${command}`);
    printMainHelp();
    process.exit(2);
  }

  entry.run(options);
}

main();
