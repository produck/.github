import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { PACKAGE_ROOT, readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const TOOLING_BASELINE_FILE = path.join(
  PACKAGE_ROOT,
  '..',
  '..',
  '.github',
  'distribution',
  'produck',
  'tooling-version-baseline.json',
);

const TOOLING_BASELINE = JSON.parse(fs.readFileSync(TOOLING_BASELINE_FILE, 'utf8'));

const REQUIRED_COVERAGE_SCRIPT = String(TOOLING_BASELINE.coverage.scriptTemplate).replace(
  /\{c8\.version\}/g,
  String(TOOLING_BASELINE.tools.c8.version),
);

function createRootWorkspacePackageJson() {
  return {
    name: 'tmp-workspace',
    private: true,
    workspaces: ['packages/a'],
    scripts: {
      'deps:install': 'npm install',
      test: 'npm run test --workspaces --if-present',
      'produck:coverage': 'npm run coverage --workspaces --if-present',
      lint: 'eslint --fix . --max-warnings=0',
    },
  };
}

describe('enforce-node-baseline command', () => {
  it('prints help text for enforce-node-baseline command', () => {
    const result = runCli(['enforce-node-baseline', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /1\) sync-instructions/);
  });

  it('runs sync-instructions, preflight, sync-workspace-config, sync-coverage-script, and sync-husky-hooks in order', async () => {
    await withTempDir('agent-toolkit-enforce-node-baseline-sync-', async (tempDir) => {
      const sourceDir = path.join(tempDir, 'source');
      const instructionFile = path.join(sourceDir, '00-sample.instructions.md');

      await writeTextFile(instructionFile, 'sample-instruction\n');
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify(createRootWorkspacePackageJson(), null, 2)}\n`,
      );
      await writeTextFile(
        path.join(tempDir, 'packages/a/package.json'),
        `${JSON.stringify({ name: 'a', scripts: { test: 'npm test' } }, null, 2)}\n`,
      );

      const result = runCli([
        'enforce-node-baseline',
        '--cwd',
        tempDir,
        '--source',
        sourceDir,
        '--prune',
      ]);

      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.steps.length, 5);
      assert.deepEqual(
        report.steps.map((step) => step.name),
        [
          'sync-instructions',
          'preflight',
          'sync-workspace-config',
          'sync-coverage-script',
          'sync-husky-hooks',
        ],
      );
      assert.equal(
        report.steps.every((step) => step.ok),
        true,
      );

      const copiedInstruction = path.join(
        tempDir,
        '.github',
        'instructions',
        'produck',
        '00-sample.instructions.md',
      );
      const copiedInstructionText = fs.readFileSync(copiedInstruction, 'utf8');
      assert.match(copiedInstructionText, /sample-instruction/);

      const workspacePackage = await readJson(path.join(tempDir, 'packages/a/package.json'));
      assert.equal(workspacePackage.scripts['produck:coverage'], REQUIRED_COVERAGE_SCRIPT);
    });
  });

  it('supports check mode as non-mutating flow and exits non-zero on first mismatch', async () => {
    await withTempDir('agent-toolkit-enforce-node-baseline-check-', async (tempDir) => {
      const sourceDir = path.join(tempDir, 'source');
      await writeTextFile(path.join(sourceDir, '00-sample.instructions.md'), 'sample\n');
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify(createRootWorkspacePackageJson(), null, 2)}\n`,
      );
      await writeTextFile(
        path.join(tempDir, 'packages/a/package.json'),
        `${JSON.stringify({ name: 'a', scripts: { 'produck:coverage': 'echo old' } }, null, 2)}\n`,
      );

      const result = runCli([
        'enforce-node-baseline',
        '--cwd',
        tempDir,
        '--source',
        sourceDir,
        '--check',
      ]);

      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.steps.length, 3);
      assert.equal(report.steps[2].name, 'sync-workspace-config');
      assert.equal(report.steps[2].ok, false);

      const copiedInstruction = path.join(
        tempDir,
        '.github',
        'instructions',
        'produck',
        '00-sample.instructions.md',
      );
      assert.equal(fs.existsSync(copiedInstruction), false);

      const workspacePackage = await readJson(path.join(tempDir, 'packages/a/package.json'));
      assert.equal(workspacePackage.scripts['produck:coverage'], 'echo old');
    });
  });
});
