import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { printMainHelp } from '../bin/command/main/index.mjs';
import {
  getMulti,
  getSingle,
  hasFlag,
  parseCommonArgs,
} from '../bin/command/shared/args.mjs';
import {
  loadTextResource,
  printTextResource,
} from '../bin/command/shared/text-resource.mjs';
import {
  toObjectRecord,
  validateWorkspaceShape,
  validateRequiredExactEntries,
} from '../bin/command/shared/workspace-validation.mjs';

import {
  PACKAGE_ROOT,
  runCli,
  writeTextFile,
  withTempDir,
} from './helpers.mjs';

const LOAD_MISSING_RESOURCE_PROBE = path.resolve(
  PACKAGE_ROOT,
  'test/probes/load-missing-resource.mjs',
);

function captureStdout(callback) {
  const chunks = [];
  const originalWrite = process.stdout.write;

  process.stdout.write = (chunk) => {
    chunks.push(String(chunk));
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
    assert.deepEqual(getMulti(options, '--require'), [
      'package.json',
      '.editorconfig',
    ]);
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
    const missingPath = path.join(
      os.tmpdir(),
      'agent-toolkit-resource-does-not-exist.txt',
    );
    const result = spawnSync(
      process.execPath,
      [LOAD_MISSING_RESOURCE_PROBE, missingPath],
      {
        cwd: PACKAGE_ROOT,
        encoding: 'utf8',
      },
    );

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
    assert.match(output, /enforce-node-baseline/);
    assert.match(output, /sync-coverage/);
    assert.match(output, /sync-format/);
    assert.match(output, /sync-install/);
    assert.match(output, /sync-lint/);
    assert.match(output, /sync-git/);
    assert.match(output, /validate-commit-msg/);
  });

  it('runs enforce-node-baseline as default when no command is provided', async () => {
    await withTempDir('agent-toolkit-default-command-', async (tempDir) => {
      const sourceDir = path.join(tempDir, 'source');
      await writeTextFile(
        path.join(sourceDir, '00-sample.instructions.md'),
        'sample\n',
      );

      const rootPackageJson = {
        name: 'tmp-workspace',
        private: true,
        workspaces: ['packages/a'],
        scripts: {
          'produck:install': 'npm -v && npm install',
          test: 'npm run test --workspaces --if-present',
          'produck:coverage': 'npm run coverage --workspaces --if-present',
          'produck:lint': 'eslint --fix . --max-warnings=0',
        },
      };

      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify(rootPackageJson, null, 2)}\n`,
      );
      await writeTextFile(
        path.join(tempDir, 'packages/a/package.json'),
        '{"name":"a"}\n',
      );

      const result = runCli([
        '--cwd',
        tempDir,
        '--source',
        sourceDir,
        '--dry-run',
      ]);

      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.deepEqual(
        report.steps.map((step) => step.name),
        [
          'preflight',
          'sync-instructions',
          'sync-editorconfig',
          'sync-format',
          'sync-lint',
          'sync-install',
          'sync-git',
          'sync-coverage',
          'sync-workspace',
          'sync-publish',
        ],
      );
    });
  });

  it('prints main help when --help is provided without command', () => {
    const result = runCli(['--help']);

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

describe('workspace-validation utilities', () => {
  it('toObjectRecord returns empty object for non-object values', () => {
    assert.deepEqual(toObjectRecord(null), {});
    assert.deepEqual(toObjectRecord([1, 2, 3]), {});
    assert.deepEqual(toObjectRecord('string'), {});
  });

  it('validateWorkspaceShape reports invalid scripts type', () => {
    const result = validateWorkspaceShape(
      { scripts: null, workspaces: [] },
      [],
      ['build'],
    );

    assert.equal(result.scriptTypeValid, false);
    assert.deepEqual(result.missingScripts, []);
  });

  it('validateWorkspaceShape reports non-array workspaces', () => {
    const result = validateWorkspaceShape(
      { scripts: {}, workspaces: 'not-an-array' },
      [],
      [],
    );

    assert.equal(result.ok, false);
    assert.deepEqual(result.wildcardWorkspaces, ['<non-array-workspaces>']);
  });

  it('validateRequiredExactEntries reports null and actual value for mismatches', () => {
    const result = validateRequiredExactEntries(
      { foo: 'wrong' },
      { foo: 'bar', baz: 'qux' },
    );

    assert.equal(result.ok, false);
    assert.equal(result.mismatches.foo.actual, 'wrong');
    assert.equal(result.mismatches.foo.expected, 'bar');
    assert.equal(result.mismatches.baz.actual, null);
    assert.equal(result.mismatches.baz.expected, 'qux');
  });
});
