import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
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

describe('sync-coverage-script command', () => {
  it('prints help text for sync-coverage-script command', () => {
    const result = runCli(['sync-coverage-script', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /--check/);
  });

  it('fails when --cwd does not exist', () => {
    const missingCwd = path.join(os.tmpdir(), 'agent-toolkit-sync-coverage-missing-cwd');
    const result = runCli(['sync-coverage-script', '--cwd', missingCwd]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('fails when root workspaces uses wildcard path', async () => {
    await withTempDir('agent-toolkit-sync-coverage-wildcard-', async (tempDir) => {
      const rootPackage = {
        name: 'tmp',
        private: true,
        workspaces: ['packages/*'],
      };
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify(rootPackage, null, 2)}\n`,
      );

      const result = runCli(['sync-coverage-script', '--cwd', tempDir]);

      assert.equal(result.status, 2);
      assert.match(result.stderr, /workspaces.*explicit paths.*glob tokens/i);
    });
  });

  it('applies organization coverage script to explicit workspace packages', async () => {
    await withTempDir('agent-toolkit-sync-coverage-sync-', async (tempDir) => {
      const rootPackage = {
        name: 'tmp',
        private: true,
        workspaces: ['packages/a', 'packages/b'],
      };
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify(rootPackage, null, 2)}\n`,
      );

      await writeTextFile(
        path.join(tempDir, 'packages/a/package.json'),
        `${JSON.stringify({ name: 'a', scripts: { test: 'node --test test/index.mjs' } }, null, 2)}\n`,
      );
      await writeTextFile(
        path.join(tempDir, 'packages/b/package.json'),
        `${JSON.stringify({ name: 'b' }, null, 2)}\n`,
      );

      const result = runCli(['sync-coverage-script', '--cwd', tempDir]);

      assert.equal(result.status, 0);

      const a = await readJson(path.join(tempDir, 'packages/a/package.json'));
      const b = await readJson(path.join(tempDir, 'packages/b/package.json'));

      assert.equal(a.scripts.coverage, REQUIRED_COVERAGE_SCRIPT);
      assert.equal(b.scripts.coverage, REQUIRED_COVERAGE_SCRIPT);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.results.length, 2);
      assert.equal(
        report.results.every((item) => item.matchesRequiredCoverageAfter),
        true,
      );
    });
  });

  it('supports --check mode and exits non-zero when mismatch exists', async () => {
    await withTempDir('agent-toolkit-sync-coverage-check-', async (tempDir) => {
      const rootPackage = {
        name: 'tmp',
        private: true,
        workspaces: ['packages/a'],
      };
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify(rootPackage, null, 2)}\n`,
      );
      await writeTextFile(
        path.join(tempDir, 'packages/a/package.json'),
        `${JSON.stringify({ name: 'a', scripts: { coverage: 'echo custom' } }, null, 2)}\n`,
      );

      const result = runCli(['sync-coverage-script', '--cwd', tempDir, '--check']);

      assert.equal(result.status, 2);
      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.results[0].matchesRequiredCoverageAfter, false);

      const a = await readJson(path.join(tempDir, 'packages/a/package.json'));
      assert.equal(a.scripts.coverage, 'echo custom');
    });
  });

  it('supports --workspace override and --json report output', async () => {
    await withTempDir('agent-toolkit-sync-coverage-workspace-override-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp' }, null, 2)}\n`,
      );
      await writeTextFile(
        path.join(tempDir, 'packages/a/package.json'),
        `${JSON.stringify({ name: 'a' }, null, 2)}\n`,
      );

      const reportFile = path.join(tempDir, 'reports', 'sync-coverage.json');
      const result = runCli([
        'sync-coverage-script',
        '--cwd',
        tempDir,
        '--workspace',
        'packages/a',
        '--json',
        reportFile,
      ]);

      assert.equal(result.status, 0);
      const report = await readJson(reportFile);
      assert.equal(report.ok, true);
      assert.deepEqual(report.workspaces, ['packages/a']);
    });
  });

  it('supports --dry-run without writing package changes', async () => {
    await withTempDir('agent-toolkit-sync-coverage-dry-run-', async (tempDir) => {
      const rootPackage = {
        name: 'tmp',
        private: true,
        workspaces: ['packages/a'],
      };
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify(rootPackage, null, 2)}\n`,
      );
      await writeTextFile(
        path.join(tempDir, 'packages/a/package.json'),
        `${JSON.stringify({ name: 'a', scripts: { coverage: 'echo old' } }, null, 2)}\n`,
      );

      const result = runCli(['sync-coverage-script', '--cwd', tempDir, '--dry-run']);

      assert.equal(result.status, 0);
      const report = JSON.parse(result.stdout);
      assert.equal(report.mode, 'dry-run');
      assert.equal(report.results[0].updated, false);

      const a = await readJson(path.join(tempDir, 'packages/a/package.json'));
      assert.equal(a.scripts.coverage, 'echo old');
    });
  });
});
