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

const REQUIRED_COVERAGE_SCRIPT = String(
  TOOLING_BASELINE.coverage.scriptTemplate,
).replace(/\{c8\.version\}/g, String(TOOLING_BASELINE.tools.c8.version));
const REQUIRED_TEST_SCRIPT = 'node -e "console.log(\'No tests configured\')"';
const REQUIRED_C8_VERSION = String(TOOLING_BASELINE.tools.c8.version);

describe('sync-workspace command', () => {
  it('prints help text for sync-workspace command', () => {
    const result = runCli(['sync-workspace', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /produck:coverage/);
    assert.match(result.stdout, /scripts\.test/);
    assert.match(result.stdout, /c8 version/);
  });

  it('fails when --cwd does not exist', () => {
    const missingCwd = path.join(
      os.tmpdir(),
      'agent-toolkit-sync-workspace-missing-cwd',
    );
    const result = runCli(['sync-workspace', '--cwd', missingCwd]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('fails when root package.json is invalid JSON', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-invalid-root-json-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{invalid-json}\n',
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir]);
        assert.equal(result.status, 2);
        assert.match(result.stderr, /Root package\.json is not valid JSON/);
      },
    );
  });

  it('reconciles workspace produck:coverage script', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-coverage-script-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/a'] }, null, 2)}\n`,
        );
        await writeTextFile(
          path.join(tempDir, 'packages/a/package.json'),
          `${JSON.stringify({ name: 'a', scripts: { test: 'node --test test/index.mjs' } }, null, 2)}\n`,
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir]);
        assert.equal(result.status, 0);

        const a = await readJson(path.join(tempDir, 'packages/a/package.json'));
        assert.equal(a.scripts['produck:coverage'], REQUIRED_COVERAGE_SCRIPT);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.results.length, 1);
        assert.equal(report.results[0].matchesRequiredCoverageAfter, true);
      },
    );
  });

  it('enforces test script in workspace packages', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-test-script-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/a'] }, null, 2)}\n`,
        );
        await writeTextFile(
          path.join(tempDir, 'packages/a/package.json'),
          `${JSON.stringify({ name: 'a' }, null, 2)}\n`,
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir]);
        assert.equal(result.status, 0);

        const a = await readJson(path.join(tempDir, 'packages/a/package.json'));
        assert.equal(a.scripts.test, REQUIRED_TEST_SCRIPT);

        const report = JSON.parse(result.stdout);
        assert.equal(report.results[0].hasRequiredTestScriptAfter, true);
      },
    );
  });

  it('enforces c8 devDependency in workspace packages', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-c8-devdep-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/a'] }, null, 2)}\n`,
        );
        await writeTextFile(
          path.join(tempDir, 'packages/a/package.json'),
          `${JSON.stringify({ name: 'a', scripts: { 'produck:coverage': REQUIRED_COVERAGE_SCRIPT, test: REQUIRED_TEST_SCRIPT } }, null, 2)}\n`,
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir]);
        assert.equal(result.status, 0);

        const a = await readJson(path.join(tempDir, 'packages/a/package.json'));
        assert.equal(a.devDependencies.c8, REQUIRED_C8_VERSION);

        const report = JSON.parse(result.stdout);
        assert.equal(
          report.results[0].matchesRequiredC8DevDependencyAfter,
          true,
        );
      },
    );
  });

  it('supports --workspace override flag', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-override-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp' }, null, 2)}\n`,
        );
        await writeTextFile(
          path.join(tempDir, 'packages/a/package.json'),
          `${JSON.stringify({ name: 'a' }, null, 2)}\n`,
        );

        const result = runCli([
          'sync-workspace',
          '--cwd',
          tempDir,
          '--workspace',
          'packages/a',
        ]);

        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.deepEqual(report.workspaces, ['packages/a']);
      },
    );
  });

  it('supports --check mode and exits non-zero on mismatch without mutating', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-check-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/a'] }, null, 2)}\n`,
        );
        await writeTextFile(
          path.join(tempDir, 'packages/a/package.json'),
          `${JSON.stringify({ name: 'a', scripts: { 'produck:coverage': 'echo custom' }, devDependencies: { c8: '10.0.0' } }, null, 2)}\n`,
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir, '--check']);

        assert.equal(result.status, 2);
        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.equal(report.results[0].matchesRequiredCoverageAfter, false);
        assert.equal(report.results[0].hasRequiredTestScriptAfter, false);
        assert.equal(
          report.results[0].matchesRequiredC8DevDependencyAfter,
          false,
        );

        const a = await readJson(path.join(tempDir, 'packages/a/package.json'));
        assert.equal(a.scripts['produck:coverage'], 'echo custom');
        assert.equal(a.devDependencies.c8, '10.0.0');
      },
    );
  });

  it('supports --dry-run without writing package changes', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-dry-run-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/a'] }, null, 2)}\n`,
        );
        await writeTextFile(
          path.join(tempDir, 'packages/a/package.json'),
          `${JSON.stringify({ name: 'a', scripts: { 'produck:coverage': 'echo old' } }, null, 2)}\n`,
        );

        const result = runCli([
          'sync-workspace',
          '--cwd',
          tempDir,
          '--dry-run',
        ]);

        assert.equal(result.status, 0);
        const report = JSON.parse(result.stdout);
        assert.equal(report.mode, 'dry-run');
        assert.equal(report.results[0].updated, false);

        const a = await readJson(path.join(tempDir, 'packages/a/package.json'));
        assert.equal(a.scripts['produck:coverage'], 'echo old');
        assert.equal(a.scripts.test, undefined);
        assert.equal(a.devDependencies, undefined);
      },
    );
  });

  it('supports --json report output', async () => {
    await withTempDir('agent-toolkit-sync-workspace-json-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/a'] }, null, 2)}\n`,
      );
      await writeTextFile(
        path.join(tempDir, 'packages/a/package.json'),
        `${JSON.stringify({ name: 'a' }, null, 2)}\n`,
      );

      const reportFile = path.join(tempDir, 'reports', 'sync-workspace.json');
      const result = runCli([
        'sync-workspace',
        '--cwd',
        tempDir,
        '--json',
        reportFile,
      ]);

      assert.equal(result.status, 0);
      const report = await readJson(reportFile);
      assert.equal(report.ok, true);
      assert.deepEqual(report.workspaces, ['packages/a']);
    });
  });

  it('reports missing workspace package.json as error item', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-missing-pkg-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/missing'] }, null, 2)}\n`,
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir]);
        assert.equal(result.status, 2);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.equal(report.results.length, 1);
        assert.match(
          report.results[0].error,
          /Workspace package\.json does not exist/,
        );
      },
    );
  });

  it('reports invalid workspace package.json as error item', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-invalid-json-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/a'] }, null, 2)}\n`,
        );
        await writeTextFile(
          path.join(tempDir, 'packages/a/package.json'),
          '{invalid-json}\n',
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir]);
        assert.equal(result.status, 2);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.equal(report.results.length, 1);
        assert.match(
          report.results[0].error,
          /Workspace package\.json is not valid JSON/,
        );
      },
    );
  });

  it('handles root package without workspaces array', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-no-workspaces-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true }, null, 2)}\n`,
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.deepEqual(report.workspaces, []);
        assert.deepEqual(report.results, []);
      },
    );
  });

  it('handles root package with empty workspaces array', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-empty-workspaces-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: [] }, null, 2)}\n`,
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.deepEqual(report.workspaces, []);
        assert.deepEqual(report.results, []);
      },
    );
  });

  it('expands glob pattern in workspaces successfully', async () => {
    await withTempDir('agent-toolkit-sync-workspace-glob-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/*'] }, null, 2)}\n`,
      );

      // Create workspace subdirectories
      await writeTextFile(
        path.join(tempDir, 'packages/foo/package.json'),
        '{"name":"foo","scripts":{},"devDependencies":{}}\n',
      );
      await writeTextFile(
        path.join(tempDir, 'packages/bar/package.json'),
        '{"name":"bar","scripts":{},"devDependencies":{}}\n',
      );

      const result = runCli(['sync-workspace', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.deepEqual(report.workspaces, ['packages/bar', 'packages/foo']);
      assert.equal(report.results.length, 2);
      assert.equal(report.results[0].workspacePath, 'packages/bar');
      assert.equal(report.results[1].workspacePath, 'packages/foo');
    });
  });

  it('rejects recursive glob pattern ** in workspaces', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-double-glob-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/**'] }, null, 2)}\n`,
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir]);
        assert.equal(result.status, 2);
        assert.match(result.stderr, /Recursive glob pattern/);
      },
    );
  });

  it('is a no-op on second run after state is synchronized', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-no-op-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/a'] }, null, 2)}\n`,
        );
        await writeTextFile(
          path.join(tempDir, 'packages/a/package.json'),
          `${JSON.stringify({ name: 'a' }, null, 2)}\n`,
        );

        const first = runCli(['sync-workspace', '--cwd', tempDir]);
        assert.equal(first.status, 0);

        const before = fs.readFileSync(
          path.join(tempDir, 'packages/a/package.json'),
          'utf8',
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.results[0].updated, false);

        const after = fs.readFileSync(
          path.join(tempDir, 'packages/a/package.json'),
          'utf8',
        );
        assert.equal(after, before);
      },
    );
  });

  it('check mode marks workspace ok=false when only coverage script mismatches', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-check-coverage-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/a'] }, null, 2)}\n`,
        );
        const wsPkg = {
          name: 'a',
          scripts: { test: REQUIRED_TEST_SCRIPT },
          devDependencies: { c8: REQUIRED_C8_VERSION },
        };
        await writeTextFile(
          path.join(tempDir, 'packages/a/package.json'),
          `${JSON.stringify(wsPkg, null, 2)}\n`,
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir, '--check']);
        assert.equal(result.status, 2);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.equal(report.results[0].matchesRequiredCoverageAfter, false);
        assert.equal(report.results[0].hasRequiredTestScriptAfter, true);
        assert.equal(
          report.results[0].matchesRequiredC8DevDependencyAfter,
          true,
        );
      },
    );
  });

  it('check mode marks workspace ok=false when only test script mismatches', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-check-ws-test-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/a'] }, null, 2)}\n`,
        );
        const wsPkg = {
          name: 'a',
          scripts: { 'produck:coverage': REQUIRED_COVERAGE_SCRIPT },
          devDependencies: { c8: REQUIRED_C8_VERSION },
        };
        await writeTextFile(
          path.join(tempDir, 'packages/a/package.json'),
          `${JSON.stringify(wsPkg, null, 2)}\n`,
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir, '--check']);
        assert.equal(result.status, 2);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.equal(report.results[0].matchesRequiredCoverageAfter, true);
        assert.equal(report.results[0].hasRequiredTestScriptAfter, false);
        assert.equal(
          report.results[0].matchesRequiredC8DevDependencyAfter,
          true,
        );
      },
    );
  });

  it('check mode marks workspace ok=false when only c8 devDep mismatches', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-check-ws-c8dep-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['packages/a'] }, null, 2)}\n`,
        );
        const wsPkg = {
          name: 'a',
          scripts: {
            'produck:coverage': REQUIRED_COVERAGE_SCRIPT,
            test: REQUIRED_TEST_SCRIPT,
          },
        };
        await writeTextFile(
          path.join(tempDir, 'packages/a/package.json'),
          `${JSON.stringify(wsPkg, null, 2)}\n`,
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir, '--check']);
        assert.equal(result.status, 2);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.equal(report.results[0].matchesRequiredCoverageAfter, true);
        assert.equal(report.results[0].hasRequiredTestScriptAfter, true);
        assert.equal(
          report.results[0].matchesRequiredC8DevDependencyAfter,
          false,
        );
      },
    );
  });

  it('skips glob workspace entry when base directory does not exist', async () => {
    await withTempDir(
      'agent-toolkit-sync-workspace-glob-missing-dir-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', private: true, workspaces: ['src/*', 'packages/a'] }, null, 2)}\n`,
        );
        // src/ does not exist at all; packages/a exists
        await writeTextFile(
          path.join(tempDir, 'packages/a/package.json'),
          `${JSON.stringify({ name: 'a' }, null, 2)}\n`,
        );

        const result = runCli(['sync-workspace', '--cwd', tempDir]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        // src/* glob is skipped because src/ does not exist
        // Only packages/a is resolved
        assert.equal(report.workspaces.length, 1);
        assert.equal(report.workspaces[0], 'packages/a');
      },
    );
  });
});
