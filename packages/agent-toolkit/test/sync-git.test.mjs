import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const REQUIRED_GITATTRIBUTES_CONTENT = `* text=auto eol=lf

# Windows script entrypoints
*.bat text eol=crlf
*.cmd text eol=crlf
`;
const REQUIRED_PRE_COMMIT_HOOK = '#!/usr/bin/env sh\nnpm run produck:precommit-check\n';
const REQUIRED_COMMIT_MSG_HOOK =
  '#!/usr/bin/env sh\nnode ./node_modules/@produck/agent-toolkit/bin/agent-toolkit.mjs validate-commit-msg --file "$1"\n';
const REQUIRED_BASELINE_SCRIPT =
  'npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd .';
const REQUIRED_PRECOMMIT_CHECK_SCRIPT = 'npm run produck:format && npm run produck:lint';

describe('sync-git command', () => {
  it('prints help text for sync-git command', () => {
    const result = runCli(['sync-git', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /\.gitattributes/);
    assert.match(result.stdout, /\.husky\/pre-commit/);
    assert.match(result.stdout, /\.husky\/commit-msg/);
    assert.match(result.stdout, /produck:baseline/);
    assert.match(result.stdout, /produck:precommit-check/);
  });

  it('fails when --cwd does not exist', () => {
    const missingCwd = path.resolve('D:/tmp/agent-toolkit-sync-git-missing-cwd');
    const result = runCli(['sync-git', '--cwd', missingCwd]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('applies required root scripts, managed dependencies, git attributes, and hooks', async () => {
    await withTempDir('agent-toolkit-sync-git-sync-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', scripts: { test: 'npm test' } }, null, 2)}\n`,
      );
      await writeTextFile(path.join(tempDir, '.gitattributes'), '* text=auto eol=crlf\n');

      const result = runCli(['sync-git', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      const content = fs.readFileSync(path.join(tempDir, '.gitattributes'), 'utf8');
      const preCommit = fs.readFileSync(path.join(tempDir, '.husky/pre-commit'), 'utf8');
      const commitMsg = fs.readFileSync(path.join(tempDir, '.husky/commit-msg'), 'utf8');

      assert.equal(pkg.scripts['produck:baseline'], REQUIRED_BASELINE_SCRIPT);
      assert.equal(pkg.scripts['produck:precommit-check'], REQUIRED_PRECOMMIT_CHECK_SCRIPT);
      assert.match(pkg.devDependencies.husky, /^\d+\.\d+\.\d+$/);
      assert.match(pkg.devDependencies.lerna, /^\d+\.\d+\.\d+$/);
      assert.match(pkg.devDependencies['@produck/agent-toolkit'], /^\d+\.\d+\.\d+$/);
      assert.equal(content, REQUIRED_GITATTRIBUTES_CONTENT);
      assert.equal(preCommit, REQUIRED_PRE_COMMIT_HOOK);
      assert.equal(commitMsg, REQUIRED_COMMIT_MSG_HOOK);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, true);
      assert.equal(report.status.fileExistsAfter, true);
      assert.equal(report.status.preCommitHookExistsAfter, true);
      assert.equal(report.status.commitMsgHookExistsAfter, true);
      assert.equal(report.status.matchesRequiredBaselineAfter, true);
      assert.equal(report.status.matchesRequiredPrecommitCheckAfter, true);
      assert.equal(report.status.matchesRequiredManagedDevDependenciesAfter, true);
    });
  });

  it('supports --check mode and exits non-zero on mismatch without mutating', async () => {
    await withTempDir('agent-toolkit-sync-git-check-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', scripts: { lint: 'echo old' } }, null, 2)}\n`,
      );
      await writeTextFile(path.join(tempDir, '.gitattributes'), '* text=auto eol=crlf\n');

      const result = runCli(['sync-git', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.status.updated, false);
      assert.equal(report.status.mismatchesBefore.length > 0, true);
      assert.equal(report.status.matchesRequiredBaselineAfter, false);
      assert.equal(report.status.matchesRequiredPrecommitCheckAfter, false);

      const content = fs.readFileSync(path.join(tempDir, '.gitattributes'), 'utf8');
      assert.equal(content, '* text=auto eol=crlf\n');
      assert.equal(fs.existsSync(path.join(tempDir, '.husky/pre-commit')), false);
      assert.equal(fs.existsSync(path.join(tempDir, '.husky/commit-msg')), false);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts['produck:baseline'], undefined);
      assert.equal(pkg.scripts['produck:precommit-check'], undefined);
    });
  });

  it('supports --dry-run without writing files', async () => {
    await withTempDir('agent-toolkit-sync-git-dry-run-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp' })}\n`,
      );
      const result = runCli(['sync-git', '--cwd', tempDir, '--dry-run']);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, false);
      assert.equal(fs.existsSync(path.join(tempDir, '.gitattributes')), false);
      assert.equal(fs.existsSync(path.join(tempDir, '.husky/pre-commit')), false);
      assert.equal(fs.existsSync(path.join(tempDir, '.husky/commit-msg')), false);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts, undefined);
      assert.equal(pkg.devDependencies, undefined);
    });
  });

  it('supports --json report output', async () => {
    await withTempDir('agent-toolkit-sync-git-json-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp' })}\n`,
      );
      const result = runCli(['sync-git', '--cwd', tempDir, '--json', 'logs/git-report.json']);
      assert.equal(result.status, 0);

      const reportPath = path.join(tempDir, 'logs', 'git-report.json');
      assert.equal(fs.existsSync(reportPath), true);

      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      assert.equal(report.ok, true);
    });
  });

  it('uses PRODUCK_TOOLKIT_VERSION_OVERRIDE for managed dependency version', async () => {
    await withTempDir('agent-toolkit-sync-git-override-version-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp' })}\n`,
      );

      const result = runCli(['sync-git', '--cwd', tempDir], {
        env: { PRODUCK_TOOLKIT_VERSION_OVERRIDE: '9.9.9' },
      });
      assert.equal(result.status, 0);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.devDependencies['@produck/agent-toolkit'], '9.9.9');
    });
  });

  it('falls back to local toolkit package version when npm lookup is unavailable', async () => {
    await withTempDir('agent-toolkit-sync-git-fallback-version-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp' })}\n`,
      );

      const result = runCli(['sync-git', '--cwd', tempDir], {
        env: { PATH: '' },
      });
      assert.equal(result.status, 0);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.match(pkg.devDependencies['@produck/agent-toolkit'], /^\d+\.\d+\.\d+$/);
    });
  });

  it('is a no-op on second run after state is synchronized', async () => {
    await withTempDir('agent-toolkit-sync-git-no-op-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp' })}\n`,
      );
      const first = runCli(['sync-git', '--cwd', tempDir]);
      assert.equal(first.status, 0);

      const beforePkg = fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8');
      const beforeGitAttributes = fs.readFileSync(path.join(tempDir, '.gitattributes'), 'utf8');
      const preCommitBefore = fs.readFileSync(path.join(tempDir, '.husky/pre-commit'), 'utf8');
      const commitMsgBefore = fs.readFileSync(path.join(tempDir, '.husky/commit-msg'), 'utf8');
      const result = runCli(['sync-git', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, false);
      const afterPkg = fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8');
      const afterGitAttributes = fs.readFileSync(path.join(tempDir, '.gitattributes'), 'utf8');
      const preCommitAfter = fs.readFileSync(path.join(tempDir, '.husky/pre-commit'), 'utf8');
      const commitMsgAfter = fs.readFileSync(path.join(tempDir, '.husky/commit-msg'), 'utf8');
      assert.equal(afterPkg, beforePkg);
      assert.equal(afterGitAttributes, beforeGitAttributes);
      assert.equal(preCommitAfter, preCommitBefore);
      assert.equal(commitMsgAfter, commitMsgBefore);
    });
  });
});
