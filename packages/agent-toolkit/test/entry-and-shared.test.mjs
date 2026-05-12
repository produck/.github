import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { printMainHelp } from '../bin/command/main/index.mjs';
import { getMulti, getSingle, hasFlag, parseCommonArgs } from '../bin/command/shared/args.mjs';
import { loadTextResource, printTextResource } from '../bin/command/shared/text-resource.mjs';

import { PACKAGE_ROOT, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const LOAD_MISSING_RESOURCE_PROBE = path.resolve(
  PACKAGE_ROOT,
  'test/probes/load-missing-resource.mjs',
);

function captureStdout(callback) {
  const chunks = [];
  const originalWrite = process.stdout.write;

  process.stdout.write = (chunk, encoding, cb) => {
    chunks.push(String(chunk));
    if (typeof cb === 'function') {
      cb();
    }
    return true;
  };

  try {
    callback();
  } finally {
    process.stdout.write = originalWrite;
  }

  return chunks.join('');
}

describe('shared argument utilities', () => {
  it('parses positional args, options with values, and boolean flags', () => {
    const parsed = parseCommonArgs([
      'sync-instructions',
      '--cwd',
      'repo',
      '--prune',
      '--source',
      'src',
      '--prune',
    ]);

    assert.deepEqual(parsed.positional, ['sync-instructions']);
    assert.deepEqual(parsed.options['--cwd'], ['repo']);
    assert.deepEqual(parsed.options['--source'], ['src']);
    assert.deepEqual(parsed.options['--prune'], [true, true]);
  });

  it('reads single and multi options with fallback behavior', () => {
    const options = {
      '--cwd': ['repo-a', 'repo-b'],
      '--require': ['package.json', '.editorconfig'],
    };

    assert.equal(getSingle(options, '--cwd', 'fallback'), 'repo-b');
    assert.equal(getSingle(options, '--missing', 'fallback'), 'fallback');
    assert.deepEqual(getMulti(options, '--require'), ['package.json', '.editorconfig']);
    assert.deepEqual(getMulti(options, '--unknown'), []);
    assert.equal(hasFlag(options, '--cwd'), true);
    assert.equal(hasFlag(options, '--unknown'), false);
  });
});

describe('shared text resources', () => {
  it('loads and prints text resources with trailing newline normalization', async () => {
    await withTempDir('agent-toolkit-resource-', async (tempDir) => {
      const resourceFile = path.join(tempDir, 'resource.txt');
      await writeTextFile(resourceFile, 'hello-resource');

      const loaded = loadTextResource(resourceFile);
      assert.equal(loaded, 'hello-resource');

      const output = captureStdout(() => {
        printTextResource(resourceFile);
      });

      assert.equal(output, 'hello-resource\n');
    });
  });

  it('exits when resource file is missing', () => {
    const missingPath = path.join(os.tmpdir(), 'agent-toolkit-resource-does-not-exist.txt');
    const result = spawnSync(process.execPath, [LOAD_MISSING_RESOURCE_PROBE, missingPath], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Resource file not found/);
  });
});

describe('main command router', () => {
  it('prints main help text from module function', () => {
    const output = captureStdout(() => {
      printMainHelp();
    });

    assert.match(output, /agent-toolkit commands:/);
    assert.match(output, /sync-coverage-script/);
    assert.match(output, /validate-commit-msg/);
  });

  it('prints main help when no command is provided', () => {
    const result = runCli([]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /agent-toolkit commands:/);
  });

  it('prints command help when --help is used with known command', () => {
    const result = runCli(['preflight', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /agent-toolkit preflight/);
  });

  it('prints main help when --help is used with unknown command', () => {
    const result = runCli(['unknown-command', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /agent-toolkit commands:/);
  });

  it('fails for unknown command without --help', () => {
    const result = runCli(['unknown-command']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown command/);
  });

  it('supports short -h help flag', () => {
    const result = runCli(['-h']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /agent-toolkit commands:/);
  });
});
