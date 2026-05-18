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

const REQUIRED_ROOT_COVERAGE_SCRIPT =
  'c8 --config .c8rc.json npm run test --workspaces --if-present';
const REQUIRED_COVERAGE_SCRIPT = String(TOOLING_BASELINE.coverage.scriptTemplate).replace(
  /\{c8\.version\}/g,
  String(TOOLING_BASELINE.tools.c8.version),
);
const REQUIRED_TEST_SCRIPT = 'node -e "console.log(\'No tests configured\')"';
const REQUIRED_C8_CONFIG_TEMPLATE_FILE = path.join(
  PACKAGE_ROOT,
  'bin',
  'command',
  'sync-coverage',
  'required-c8-config.json',
);
const REQUIRED_C8_CONFIG_CONTENT = `${JSON.stringify(
  JSON.parse(fs.readFileSync(REQUIRED_C8_CONFIG_TEMPLATE_FILE, 'utf8')),
  null,
  2,
)}\n`;

const REQUIRED_C8_VERSION = String(TOOLING_BASELINE.tools.c8.version);

describe('sync-coverage command', () => {
  it('prints help text for sync-coverage command', () => {
    const result = runCli(['sync-coverage', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /\.c8rc\.json/);
    assert.match(result.stdout, /produck:coverage/);
  });

  it('fails when --cwd does not exist', () => {
    const missingCwd = path.join(os.tmpdir(), 'agent-toolkit-sync-coverage-missing-cwd');
    const result = runCli(['sync-coverage', '--cwd', missingCwd]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('fails when root package.json is invalid JSON', async () => {
    await withTempDir('agent-toolkit-sync-coverage-invalid-root-json-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{invalid-json}\n');

      const result = runCli(['sync-coverage', '--cwd', tempDir]);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /Root package\.json is not valid JSON/);
    });
  });

  it('fails when root workspaces contains glob token', async () => {
    await withTempDir('agent-toolkit-sync-coverage-workspace-glob-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/*'] }, null, 2)}\n`,
      );

      const result = runCli(['sync-coverage', '--cwd', tempDir]);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /must use explicit paths without glob tokens/);
    });
  });

  it('applies root c8 config and workspace coverage sync', async () => {
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

      const result = runCli(['sync-coverage', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const root = await readJson(path.join(tempDir, 'package.json'));
      const a = await readJson(path.join(tempDir, 'packages/a/package.json'));
      const b = await readJson(path.join(tempDir, 'packages/b/package.json'));

      assert.equal(root.scripts['produck:coverage'], REQUIRED_ROOT_COVERAGE_SCRIPT);
      assert.equal(root.devDependencies.c8, REQUIRED_C8_VERSION);
      assert.equal(
        fs.readFileSync(path.join(tempDir, '.c8rc.json'), 'utf8'),
        REQUIRED_C8_CONFIG_CONTENT,
      );
      assert.equal(a.scripts['produck:coverage'], REQUIRED_COVERAGE_SCRIPT);
      assert.equal(b.scripts['produck:coverage'], REQUIRED_COVERAGE_SCRIPT);
      assert.equal(a.scripts.test, 'node --test test/index.mjs');
      assert.equal(b.scripts.test, REQUIRED_TEST_SCRIPT);
      assert.equal(a.devDependencies.c8, REQUIRED_C8_VERSION);
      assert.equal(b.devDependencies.c8, REQUIRED_C8_VERSION);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.root.status.matchesRequiredRootCoverageAfter, true);
      assert.equal(report.root.status.matchesRequiredC8DevDependencyAfter, true);
      assert.equal(report.root.status.matchesRequiredC8ConfigAfter, true);
      assert.equal(report.results.length, 2);
      assert.equal(
        report.results.every((item) => item.matchesRequiredCoverageAfter),
        true,
      );
      assert.equal(
        report.results.every((item) => item.matchesRequiredC8DevDependencyAfter),
        true,
      );
      assert.equal(
        report.results.every((item) => item.hasRequiredTestScriptAfter),
        true,
      );
    });
  });

  it('supports --check mode and exits non-zero on mismatch without mutating', async () => {
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
        `${JSON.stringify({ name: 'a', scripts: { 'produck:coverage': 'echo custom' }, devDependencies: { c8: '10.0.0' } }, null, 2)}\n`,
      );

      const result = runCli(['sync-coverage', '--cwd', tempDir, '--check']);

      assert.equal(result.status, 2);
      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.root.status.matchesRequiredRootCoverageAfter, false);
      assert.equal(report.root.status.matchesRequiredC8DevDependencyAfter, false);
      assert.equal(report.root.status.matchesRequiredC8ConfigAfter, false);
      assert.equal(report.results[0].matchesRequiredCoverageAfter, false);
      assert.equal(report.results[0].hasRequiredTestScriptAfter, false);
      assert.equal(report.results[0].matchesRequiredC8DevDependencyAfter, false);

      const a = await readJson(path.join(tempDir, 'packages/a/package.json'));
      const rootAfter = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(rootAfter.scripts?.['produck:coverage'], undefined);
      assert.equal(a.scripts['produck:coverage'], 'echo custom');
      assert.equal(a.devDependencies.c8, '10.0.0');
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
        'sync-coverage',
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

  it('check mode reports missing workspace package.json as error item', async () => {
    await withTempDir('agent-toolkit-sync-coverage-missing-workspace-pkg-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', private: true }, null, 2)}\n`,
      );

      const result = runCli([
        'sync-coverage',
        '--cwd',
        tempDir,
        '--workspace',
        'packages/missing',
        '--check',
      ]);

      assert.equal(result.status, 2);
      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.results.length, 1);
      assert.match(report.results[0].error, /Workspace package\.json does not exist/);
    });
  });

  it('check mode reports invalid workspace package.json as error item', async () => {
    await withTempDir('agent-toolkit-sync-coverage-invalid-workspace-json-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', private: true }, null, 2)}\n`,
      );
      await writeTextFile(path.join(tempDir, 'packages/a/package.json'), '{invalid-json}\n');

      const result = runCli([
        'sync-coverage',
        '--cwd',
        tempDir,
        '--workspace',
        'packages/a',
        '--check',
      ]);

      assert.equal(result.status, 2);
      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.results.length, 1);
      assert.match(report.results[0].error, /Workspace package\.json is not valid JSON/);
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
        `${JSON.stringify({ name: 'a', scripts: { 'produck:coverage': 'echo old' } }, null, 2)}\n`,
      );

      const result = runCli(['sync-coverage', '--cwd', tempDir, '--dry-run']);

      assert.equal(result.status, 0);
      const report = JSON.parse(result.stdout);
      assert.equal(report.mode, 'dry-run');
      assert.equal(report.root.status.updated, false);
      assert.equal(report.results[0].updated, false);

      const root = await readJson(path.join(tempDir, 'package.json'));
      const a = await readJson(path.join(tempDir, 'packages/a/package.json'));
      assert.equal(root.scripts?.['produck:coverage'], undefined);
      assert.equal(a.scripts['produck:coverage'], 'echo old');
      assert.equal(a.scripts.test, undefined);
      assert.equal(a.devDependencies, undefined);
      assert.equal(fs.existsSync(path.join(tempDir, '.c8rc.json')), false);
    });
  });

  it('is a no-op on second run after state is synchronized', async () => {
    await withTempDir('agent-toolkit-sync-coverage-no-op-', async (tempDir) => {
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
        `${JSON.stringify({ name: 'a' }, null, 2)}\n`,
      );

      const first = runCli(['sync-coverage', '--cwd', tempDir]);
      assert.equal(first.status, 0);

      const beforeRoot = fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8');
      const beforeC8 = fs.readFileSync(path.join(tempDir, '.c8rc.json'), 'utf8');
      const beforeWorkspace = fs.readFileSync(
        path.join(tempDir, 'packages/a/package.json'),
        'utf8',
      );

      const result = runCli(['sync-coverage', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.root.status.updated, false);
      assert.equal(report.results[0].updated, false);

      const afterRoot = fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8');
      const afterC8 = fs.readFileSync(path.join(tempDir, '.c8rc.json'), 'utf8');
      const afterWorkspace = fs.readFileSync(path.join(tempDir, 'packages/a/package.json'), 'utf8');
      assert.equal(afterRoot, beforeRoot);
      assert.equal(afterC8, beforeC8);
      assert.equal(afterWorkspace, beforeWorkspace);
    });
  });
});
