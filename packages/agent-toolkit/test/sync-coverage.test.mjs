import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  PACKAGE_ROOT,
  readJson,
  runCli,
  writeTextFile,
  withTempDir,
} from './helpers.mjs';

const TOOLING_BASELINE_FILE = path.join(
  PACKAGE_ROOT,
  '..',
  '..',
  '.github',
  'distribution',
  'produck',
  'tooling-version-baseline.json',
);

const TOOLING_BASELINE = JSON.parse(
  fs.readFileSync(TOOLING_BASELINE_FILE, 'utf8'),
);

const REQUIRED_ROOT_COVERAGE_SCRIPT = [
  'c8',
  '--config .c8rc.json',
  'npm run test',
  '--workspaces',
  '--if-present',
].join(' ');

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
    const missingCwd = path.join(
      os.tmpdir(),
      'agent-toolkit-sync-coverage-missing-cwd',
    );
    const result = runCli(['sync-coverage', '--cwd', missingCwd]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('fails when root package.json is invalid JSON', async () => {
    await withTempDir(
      'agent-toolkit-sync-coverage-invalid-root-json-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{invalid-json}\n',
        );

        const result = runCli(['sync-coverage', '--cwd', tempDir]);
        assert.equal(result.status, 2);
        assert.match(result.stderr, /Root package\.json is not valid JSON/);
      },
    );
  });

  it('applies root c8 config and coverage', async () => {
    await withTempDir('agent-toolkit-sync-coverage-sync-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', private: true }, null, 2)}\n`,
      );

      const result = runCli(['sync-coverage', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const root = await readJson(path.join(tempDir, 'package.json'));

      assert.equal(
        root.scripts['produck:coverage'],
        REQUIRED_ROOT_COVERAGE_SCRIPT,
      );
      assert.equal(root.devDependencies.c8, REQUIRED_C8_VERSION);
      assert.equal(
        fs.readFileSync(path.join(tempDir, '.c8rc.json'), 'utf8'),
        REQUIRED_C8_CONFIG_CONTENT,
      );

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.root.status.matchesRequiredRootCoverageAfter, true);
      assert.equal(
        report.root.status.matchesRequiredC8DevDependencyAfter,
        true,
      );
      assert.equal(report.root.status.matchesRequiredC8ConfigAfter, true);
    });
  });

  it('supports --check mode and exits non-zero on mismatch without mutating', async () => {
    await withTempDir('agent-toolkit-sync-coverage-check-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', private: true }, null, 2)}\n`,
      );

      const result = runCli(['sync-coverage', '--cwd', tempDir, '--check']);

      assert.equal(result.status, 2);
      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.root.status.matchesRequiredRootCoverageAfter, false);
      assert.equal(
        report.root.status.matchesRequiredC8DevDependencyAfter,
        false,
      );
      assert.equal(report.root.status.matchesRequiredC8ConfigAfter, false);

      const rootAfter = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(rootAfter.scripts?.['produck:coverage'], undefined);
      assert.equal(fs.existsSync(path.join(tempDir, '.c8rc.json')), false);
    });
  });

  it('supports --dry-run without writing package changes', async () => {
    await withTempDir(
      'agent-toolkit-sync-coverage-dry-run-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true }, null, 2)}\n`,
        );

        const result = runCli(['sync-coverage', '--cwd', tempDir, '--dry-run']);

        assert.equal(result.status, 0);
        const report = JSON.parse(result.stdout);
        assert.equal(report.mode, 'dry-run');
        assert.equal(report.root.status.updated, false);

        const root = await readJson(path.join(tempDir, 'package.json'));
        assert.equal(root.scripts?.['produck:coverage'], undefined);
        assert.equal(fs.existsSync(path.join(tempDir, '.c8rc.json')), false);
      },
    );
  });

  it('is a no-op on second run after state is synchronized', async () => {
    await withTempDir('agent-toolkit-sync-coverage-no-op-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', private: true }, null, 2)}\n`,
      );

      const first = runCli(['sync-coverage', '--cwd', tempDir]);
      assert.equal(first.status, 0);

      const beforeRoot = fs.readFileSync(
        path.join(tempDir, 'package.json'),
        'utf8',
      );
      const beforeC8 = fs.readFileSync(
        path.join(tempDir, '.c8rc.json'),
        'utf8',
      );

      const result = runCli(['sync-coverage', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.root.status.updated, false);

      const afterRoot = fs.readFileSync(
        path.join(tempDir, 'package.json'),
        'utf8',
      );
      const afterC8 = fs.readFileSync(path.join(tempDir, '.c8rc.json'), 'utf8');
      assert.equal(afterRoot, beforeRoot);
      assert.equal(afterC8, beforeC8);
    });
  });

  it('check mode marks root ok=false when only c8 devDep mismatches', async () => {
    await withTempDir(
      'agent-toolkit-sync-coverage-check-devdep-',
      async (tempDir) => {
        const rootPkg = {
          name: 'tmp',
          private: true,
          scripts: { 'produck:coverage': REQUIRED_ROOT_COVERAGE_SCRIPT },
          devDependencies: { c8: '1.0.0' },
        };
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify(rootPkg, null, 2)}\n`,
        );
        await writeTextFile(
          path.join(tempDir, '.c8rc.json'),
          REQUIRED_C8_CONFIG_CONTENT,
        );

        const result = runCli(['sync-coverage', '--cwd', tempDir, '--check']);
        assert.equal(result.status, 2);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.equal(report.root.status.matchesRequiredRootCoverageAfter, true);
        assert.equal(
          report.root.status.matchesRequiredC8DevDependencyAfter,
          false,
        );
      },
    );
  });

  it('check mode marks root ok=false when only c8 config mismatches', async () => {
    await withTempDir(
      'agent-toolkit-sync-coverage-check-c8config-',
      async (tempDir) => {
        const rootPkg = {
          name: 'tmp',
          private: true,
          scripts: { 'produck:coverage': REQUIRED_ROOT_COVERAGE_SCRIPT },
          devDependencies: { c8: REQUIRED_C8_VERSION },
        };
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify(rootPkg, null, 2)}\n`,
        );

        const result = runCli(['sync-coverage', '--cwd', tempDir, '--check']);

        assert.equal(result.status, 2);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.equal(report.root.status.matchesRequiredRootCoverageAfter, true);
        assert.equal(
          report.root.status.matchesRequiredC8DevDependencyAfter,
          true,
        );
        assert.equal(report.root.status.matchesRequiredC8ConfigAfter, false);
      },
    );
  });

  it('outputs JSON report to file when --json is specified', async () => {
    await withTempDir(
      'agent-toolkit-sync-coverage-json-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true }, null, 2)}\n`,
        );

        const jsonPath = path.join(tempDir, 'logs', 'sync-coverage.json');
        const result = runCli([
          'sync-coverage',
          '--cwd',
          tempDir,
          '--json',
          jsonPath,
        ]);

        assert.equal(result.status, 0);

        const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        assert.equal(report.ok, true);
        assert.equal(report.cwd, tempDir);
      },
    );
  });
});
