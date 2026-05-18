import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const REQUIRED_INSTALL_SCRIPT = 'npm -v && npm install';

describe('sync-install command', () => {
  it('prints help text', () => {
    const result = runCli(['sync-install', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /produck:install/);
  });

  it('applies required install script and removes legacy script', async () => {
    await withTempDir('agent-toolkit-sync-install-sync-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', scripts: { 'deps:install': 'npm install' } }, null, 2)}\n`,
      );

      const result = runCli(['sync-install', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts['produck:install'], REQUIRED_INSTALL_SCRIPT);
      assert.equal(pkg.scripts['deps:install'], undefined);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.matchesRequiredInstallAfter, true);
      assert.equal(report.status.legacyInstallScriptPresentAfter, false);
      assert.equal(report.status.updated, true);
    });
  });

  it('supports --check without mutating files', async () => {
    await withTempDir('agent-toolkit-sync-install-check-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', scripts: { 'deps:install': 'npm install' } }, null, 2)}\n`,
      );

      const result = runCli(['sync-install', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.status.updated, false);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts['produck:install'], undefined);
      assert.equal(pkg.scripts['deps:install'], 'npm install');
    });
  });

  it('fails when root package.json does not exist', async () => {
    await withTempDir(
      'agent-toolkit-sync-install-missing-pkg-',
      async (tempDir) => {
        const result = runCli(['sync-install', '--cwd', tempDir]);

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Root package\.json does not exist/);
      },
    );
  });

  it('fails when root package.json is invalid JSON', async () => {
    await withTempDir(
      'agent-toolkit-sync-install-invalid-pkg-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{ invalid json\n',
        );

        const result = runCli(['sync-install', '--cwd', tempDir]);

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Root package\.json is not valid JSON/);
      },
    );
  });

  it('supports --dry-run without mutating files', async () => {
    await withTempDir(
      'agent-toolkit-sync-install-dry-run-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const result = runCli(['sync-install', '--cwd', tempDir, '--dry-run']);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.mode, 'dry-run');
        assert.equal(report.status.updated, false);

        const pkg = await readJson(path.join(tempDir, 'package.json'));
        assert.equal(pkg.scripts, undefined);
      },
    );
  });

  it('supports --json output report file', async () => {
    await withTempDir('agent-toolkit-sync-install-json-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        '{"name":"tmp"}\n',
      );

      const result = runCli([
        'sync-install',
        '--cwd',
        tempDir,
        '--json',
        'logs/install-report.json',
      ]);
      assert.equal(result.status, 0);

      const report = await readJson(
        path.join(tempDir, 'logs', 'install-report.json'),
      );
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, true);
    });
  });

  it('supports --check and --dry-run together with check taking precedence', async () => {
    await withTempDir(
      'agent-toolkit-sync-install-check-dry-run-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const result = runCli([
          'sync-install',
          '--cwd',
          tempDir,
          '--check',
          '--dry-run',
        ]);
        assert.equal(result.status, 2);

        const report = JSON.parse(result.stdout);
        assert.equal(report.mode, 'check');
        assert.equal(report.ok, false);
        assert.equal(report.status.updated, false);
      },
    );
  });

  it('fails when --cwd does not exist', () => {
    const result = runCli([
      'sync-install',
      '--cwd',
      path.join(os.tmpdir(), 'agent-toolkit-sync-install-no-cwd-999'),
    ]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });
});
