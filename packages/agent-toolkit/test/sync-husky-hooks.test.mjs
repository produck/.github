import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { runCli, writeTextFile, withTempDir } from './helpers.mjs';

const REQUIRED_PRE_COMMIT_HOOK = '#!/usr/bin/env sh\nnpm run produck:precommit-check\n';
const REQUIRED_COMMIT_MSG_HOOK =
  '#!/usr/bin/env sh\nnode ./node_modules/@produck/agent-toolkit/bin/agent-toolkit.mjs validate-commit-msg --file "$1"\n';

describe('sync-husky-hooks command', () => {
  it('prints help text for sync-husky-hooks command', () => {
    const result = runCli(['sync-husky-hooks', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /\.husky\/pre-commit/);
    assert.match(result.stdout, /\.husky\/commit-msg/);
  });

  it('fails when --cwd does not exist', () => {
    const missingCwd = path.resolve('D:/tmp/agent-toolkit-sync-husky-missing-cwd');
    const result = runCli(['sync-husky-hooks', '--cwd', missingCwd]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('applies required hook files', async () => {
    await withTempDir('agent-toolkit-sync-husky-sync-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-husky-hooks', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const preCommit = fs.readFileSync(path.join(tempDir, '.husky/pre-commit'), 'utf8');
      const commitMsg = fs.readFileSync(path.join(tempDir, '.husky/commit-msg'), 'utf8');
      assert.equal(preCommit, REQUIRED_PRE_COMMIT_HOOK);
      assert.equal(commitMsg, REQUIRED_COMMIT_MSG_HOOK);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, true);
    });
  });

  it('supports --check mode and exits non-zero on mismatch without mutating', async () => {
    await withTempDir('agent-toolkit-sync-husky-check-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-husky-hooks', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.status.updated, false);
      assert.equal(fs.existsSync(path.join(tempDir, '.husky/pre-commit')), false);
    });
  });
});
