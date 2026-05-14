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
      'produck:lint': 'eslint --fix . --max-warnings=0',
    },
  };
}

describe('enforce-node-baseline command', () => {
  it('prints help text for enforce-node-baseline command', () => {
    const result = runCli(['enforce-node-baseline', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /1\) preflight/);
  });

  it('runs preflight, sync-instructions, sync-editorconfig, sync-format, sync-lint, sync-git, sync-coverage, and sync-publish in order', async () => {
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
      await writeTextFile(
        path.join(tempDir, '.editorconfig'),
        `root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
`,
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
      assert.equal(report.steps.length, 8);
      assert.deepEqual(
        report.steps.map((step) => step.name),
        [
          'preflight',
          'sync-instructions',
          'sync-editorconfig',
          'sync-format',
          'sync-lint',
          'sync-git',
          'sync-coverage',
          'sync-publish',
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
      assert.equal(report.steps[2].name, 'sync-editorconfig');
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

  it('supports --json output for report file', async () => {
    await withTempDir('agent-toolkit-enforce-node-baseline-json-', async (tempDir) => {
      const sourceDir = path.join(tempDir, 'source');
      await writeTextFile(path.join(sourceDir, '00-sample.instructions.md'), 'sample\n');
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify(createRootWorkspacePackageJson(), null, 2)}\n`,
      );
      await writeTextFile(
        path.join(tempDir, 'packages/a/package.json'),
        `${JSON.stringify({ name: 'a', scripts: { test: 'npm test' } }, null, 2)}\n`,
      );
      await writeTextFile(
        path.join(tempDir, '.editorconfig'),
        `root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.{yml,yaml}]
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
max_line_length = 80
`,
      );

      const result = runCli([
        'enforce-node-baseline',
        '--cwd',
        tempDir,
        '--source',
        sourceDir,
        '--prune',
        '--json',
        'logs/baseline-report.json',
      ]);

      assert.equal(result.status, 0);

      const jsonPath = path.join(tempDir, 'logs', 'baseline-report.json');
      assert.equal(fs.existsSync(jsonPath), true);
      const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      assert.equal(report.ok, true);
    });
  });

  it('fails when --cwd does not exist', () => {
    const missingCwd = path.resolve('D:/tmp/agent-toolkit-enforce-node-baseline-missing-cwd');
    const result = runCli(['enforce-node-baseline', '--cwd', missingCwd]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('supports --dry-run with forwarded --workspace and --force flags', async () => {
    await withTempDir('agent-toolkit-enforce-node-baseline-dry-run-', async (tempDir) => {
      const sourceDir = path.join(tempDir, 'source');
      await writeTextFile(path.join(sourceDir, '00-sample.instructions.md'), 'sample\n');
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
        '--force',
        '--workspace',
        'packages/a',
        '--dry-run',
      ]);

      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.mode, 'dry-run');
      assert.equal(report.steps[1].name, 'sync-instructions');
      assert.equal(report.steps[1].args.includes('--force'), true);
      assert.equal(report.steps[1].args.includes('--dry-run'), true);

      const coverageStep = report.steps.find((step) => step.name === 'sync-coverage');
      assert.equal(Boolean(coverageStep), true);
      assert.equal(coverageStep.args.includes('--workspace'), true);
      assert.equal(coverageStep.args.includes('packages/a'), true);
      assert.equal(coverageStep.args.includes('--dry-run'), true);
      assert.equal(coverageStep.args.includes('--check'), false);
    });
  });

  it('uses check mode when both --check and --dry-run are provided', async () => {
    await withTempDir('agent-toolkit-enforce-node-baseline-check-dry-run-', async (tempDir) => {
      const sourceDir = path.join(tempDir, 'source');
      await writeTextFile(path.join(sourceDir, '00-sample.instructions.md'), 'sample\n');
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
        '--check',
        '--dry-run',
      ]);

      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.mode, 'check');

      const coverageStep = report.steps.find((step) => step.name === 'sync-coverage');
      if (coverageStep) {
        assert.equal(coverageStep.args.includes('--check'), true);
        assert.equal(coverageStep.args.includes('--dry-run'), false);
      }
    });
  });
});
