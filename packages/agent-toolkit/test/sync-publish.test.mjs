import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const REQUIRED_PUBLISH_SCRIPT = 'npm exec -- lerna publish';

describe('sync-publish command', () => {
  it('prints help text', () => {
    const result = runCli(['sync-publish', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /lerna\.json/);
    assert.match(result.stdout, /produck:publish/);
  });

  it('applies required publish script when lerna.json exists', async () => {
    await withTempDir('agent-toolkit-sync-publish-sync-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');
      await writeTextFile(path.join(tempDir, 'lerna.json'), '{"version":"independent"}\n');

      const result = runCli(['sync-publish', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.lernaConfigured, true);
      assert.equal(report.status.updated, true);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts['produck:publish'], REQUIRED_PUBLISH_SCRIPT);
    });
  });

  it('exits ok without changes when lerna.json is absent', async () => {
    await withTempDir('agent-toolkit-sync-publish-no-lerna-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-publish', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.lernaConfigured, false);
      assert.equal(report.status, undefined);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts?.['produck:publish'], undefined);
    });
  });

  it('supports --check without mutating files', async () => {
    await withTempDir('agent-toolkit-sync-publish-check-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');
      await writeTextFile(path.join(tempDir, 'lerna.json'), '{"version":"independent"}\n');

      const result = runCli(['sync-publish', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.status.updated, false);
      assert.equal(report.status.matchesRequiredPublishBefore, false);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts?.['produck:publish'], undefined);
    });
  });

  it('supports --dry-run without mutating files', async () => {
    await withTempDir('agent-toolkit-sync-publish-dry-run-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');
      await writeTextFile(path.join(tempDir, 'lerna.json'), '{"version":"independent"}\n');

      const result = runCli(['sync-publish', '--cwd', tempDir, '--dry-run']);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, false);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts?.['produck:publish'], undefined);
    });
  });

  it('is a no-op when script already matches', async () => {
    await withTempDir('agent-toolkit-sync-publish-noop-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', scripts: { 'produck:publish': REQUIRED_PUBLISH_SCRIPT } }, null, 2)}\n`,
      );
      await writeTextFile(path.join(tempDir, 'lerna.json'), '{"version":"independent"}\n');

      const result = runCli(['sync-publish', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, false);
      assert.equal(report.status.matchesRequiredPublishBefore, true);
    });
  });

  it('check mode passes when script already matches', async () => {
    await withTempDir('agent-toolkit-sync-publish-check-noop-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', scripts: { 'produck:publish': REQUIRED_PUBLISH_SCRIPT } }, null, 2)}\n`,
      );
      await writeTextFile(path.join(tempDir, 'lerna.json'), '{"version":"independent"}\n');

      const result = runCli(['sync-publish', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.matchesRequiredPublishBefore, true);
    });
  });

  it('check mode is ok when lerna.json is absent', async () => {
    await withTempDir('agent-toolkit-sync-publish-check-no-lerna-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-publish', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.lernaConfigured, false);
    });
  });

  it('outputs JSON report to file when --json is specified', async () => {
    await withTempDir('agent-toolkit-sync-publish-json-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');
      await writeTextFile(path.join(tempDir, 'lerna.json'), '{"version":"independent"}\n');

      const jsonOut = path.join(tempDir, 'out', 'report.json');
      const result = runCli(['sync-publish', '--cwd', tempDir, '--json', jsonOut]);
      assert.equal(result.status, 0);

      const report = await readJson(jsonOut);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, true);
    });
  });
});
