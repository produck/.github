import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const REQUIRED_PRECOMMIT_CHECK_SCRIPT = 'npm run produck:format && npm run produck:lint';
const REQUIRED_WORKSPACE_COVERAGE_SCRIPT =
  'c8 --config .c8rc.json npm run test --workspaces --if-present';
const REQUIRED_BASELINE_SCRIPT =
  'npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd .';
const REQUIRED_C8_CONFIG_CONTENT = `${JSON.stringify(
  {
    reporter: ['lcov', 'html', 'text-summary'],
  },
  null,
  2,
)}\n`;

describe('sync-workspace-config command', () => {
  it('prints help text for sync-workspace-config command', () => {
    const result = runCli(['sync-workspace-config', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /produck:baseline/);
    assert.match(result.stdout, /produck:precommit-check/);
  });

  it('fails when --cwd does not exist', () => {
    const missingCwd = path.resolve('D:/tmp/agent-toolkit-sync-workspace-config-missing-cwd');
    const result = runCli(['sync-workspace-config', '--cwd', missingCwd]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('applies required shared scripts and shared managed dependencies', async () => {
    await withTempDir('agent-toolkit-sync-workspace-config-sync-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', scripts: { test: 'npm test' } }, null, 2)}\n`,
      );

      const result = runCli(['sync-workspace-config', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts['produck:baseline'], REQUIRED_BASELINE_SCRIPT);
      assert.equal(pkg.scripts['produck:coverage'], REQUIRED_WORKSPACE_COVERAGE_SCRIPT);
      assert.equal(pkg.scripts['produck:precommit-check'], REQUIRED_PRECOMMIT_CHECK_SCRIPT);
      assert.match(pkg.devDependencies.husky, /^\d+\.\d+\.\d+$/);
      assert.match(pkg.devDependencies.c8, /^\d+\.\d+\.\d+$/);
      assert.match(pkg.devDependencies.lerna, /^\d+\.\d+\.\d+$/);
      assert.match(pkg.devDependencies['@produck/agent-toolkit'], /^\d+\.\d+\.\d+$/);
      assert.equal(
        fs.readFileSync(path.join(tempDir, '.c8rc.json'), 'utf8'),
        REQUIRED_C8_CONFIG_CONTENT,
      );

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, true);
      assert.equal(report.status.matchesRequiredBaselineAfter, true);
      assert.equal(report.status.matchesRequiredWorkspaceCoverageAfter, true);
      assert.equal(report.status.matchesRequiredPrecommitCheckAfter, true);
      assert.equal(report.status.matchesRequiredC8ConfigAfter, true);
    });
  });

  it('supports --check mode and exits non-zero on mismatch without mutating', async () => {
    await withTempDir('agent-toolkit-sync-workspace-config-check-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', scripts: { lint: 'echo old' } }, null, 2)}\n`,
      );

      const result = runCli(['sync-workspace-config', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.status.updated, false);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts.lint, 'echo old');
      assert.equal(fs.existsSync(path.join(tempDir, '.c8rc.json')), false);
    });
  });
});
