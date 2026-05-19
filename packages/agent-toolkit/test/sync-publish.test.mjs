import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const REQUIRED_PUBLISH_CHECK_SCRIPT =
  'npm run produck:install && npm run produck:coverage && npm run produck:commit:check';
const REQUIRED_PUBLISH_SCRIPT =
  'npm run produck:publish:check && npm run publish --';

describe('sync-publish command', () => {
  it('prints help text', () => {
    const result = runCli(['sync-publish', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /lerna\.json/);
    assert.match(result.stdout, /produck:publish/);
  });

  it('fails when --cwd does not exist', () => {
    const result = runCli([
      'sync-publish',
      '--cwd',
      'd:\\missing-sync-publish-cwd',
    ]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('applies required publish script when lerna.json exists', async () => {
    await withTempDir('agent-toolkit-sync-publish-sync-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        '{"name":"tmp"}\n',
      );
      await writeTextFile(
        path.join(tempDir, 'lerna.json'),
        '{"version":"independent"}\n',
      );

      const result = runCli(['sync-publish', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.lernaExistedBefore, true);
      assert.equal(report.status.updated, true);
      assert.equal(report.status.matchesRequiredLernaCommitHooksAfter, true);
      assert.match(report.required.lernaTemplatePath, /lerna\.json$/);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      const lerna = await readJson(path.join(tempDir, 'lerna.json'));
      assert.equal(
        pkg.scripts['produck:publish:check'],
        REQUIRED_PUBLISH_CHECK_SCRIPT,
      );
      assert.equal(pkg.scripts['produck:publish'], REQUIRED_PUBLISH_SCRIPT);
      assert.equal(lerna.command.version.commitHooks, false);
    });
  });

  it('creates default lerna.json and publish script when absent', async () => {
    await withTempDir(
      'agent-toolkit-sync-publish-no-lerna-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const result = runCli(['sync-publish', '--cwd', tempDir]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.status.lernaExistedBefore, false);
        assert.equal(report.status.lernaDefaultCreated, true);
        assert.equal(report.status.updated, true);
        assert.equal(report.status.matchesRequiredLernaCommitHooksAfter, true);
        assert.match(report.required.lernaTemplatePath, /lerna\.json$/);

        assert.equal(fs.existsSync(path.join(tempDir, 'lerna.json')), true);
        const pkg = await readJson(path.join(tempDir, 'package.json'));
        const lerna = await readJson(path.join(tempDir, 'lerna.json'));
        assert.equal(
          pkg.scripts['produck:publish:check'],
          REQUIRED_PUBLISH_CHECK_SCRIPT,
        );
        assert.equal(pkg.scripts['produck:publish'], REQUIRED_PUBLISH_SCRIPT);
        assert.equal(lerna.command.version.commitHooks, false);
        assert.equal(lerna.command.publish.message, '[PUBLISH]');
      },
    );
  });

  it('keeps user publish script when present and still enforces produck:publish', async () => {
    await withTempDir(
      'agent-toolkit-sync-publish-user-publish-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', scripts: { publish: 'node ./scripts/publish.mjs' } }, null, 2)}\n`,
        );
        await writeTextFile(
          path.join(tempDir, 'lerna.json'),
          '{"version":"independent"}\n',
        );

        const result = runCli(['sync-publish', '--cwd', tempDir]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.status.matchesRequiredLernaCommitHooksAfter, true);

        const pkg = await readJson(path.join(tempDir, 'package.json'));
        const lerna = await readJson(path.join(tempDir, 'lerna.json'));
        assert.equal(pkg.scripts.publish, 'node ./scripts/publish.mjs');
        assert.equal(
          pkg.scripts['produck:publish:check'],
          REQUIRED_PUBLISH_CHECK_SCRIPT,
        );
        assert.equal(pkg.scripts['produck:publish'], REQUIRED_PUBLISH_SCRIPT);
        assert.equal(lerna.command.version.commitHooks, false);
      },
    );
  });

  it('dry-run does not create lerna.json when absent', async () => {
    await withTempDir(
      'agent-toolkit-sync-publish-dry-run-no-lerna-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const result = runCli(['sync-publish', '--cwd', tempDir, '--dry-run']);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.status.lernaDefaultCreated, false);
        assert.equal(report.status.updated, false);
        assert.equal(fs.existsSync(path.join(tempDir, 'lerna.json')), false);
      },
    );
  });

  it('fails when lerna.json exists but has no version field', async () => {
    await withTempDir(
      'agent-toolkit-sync-publish-invalid-lerna-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );
        await writeTextFile(
          path.join(tempDir, 'lerna.json'),
          '{"packages":["packages/*"]}\n',
        );

        const result = runCli(['sync-publish', '--cwd', tempDir]);
        assert.equal(result.status, 2);
        assert.match(result.stderr, /lerna\.json must have a "version" field/);
      },
    );
  });

  it('fails when root package.json does not exist', async () => {
    await withTempDir(
      'agent-toolkit-sync-publish-missing-package-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'lerna.json'),
          '{"version":"independent"}\n',
        );

        const result = runCli(['sync-publish', '--cwd', tempDir]);
        assert.equal(result.status, 2);
        assert.match(result.stderr, /Root package\.json does not exist/);
      },
    );
  });

  it('supports --check without mutating files', async () => {
    await withTempDir('agent-toolkit-sync-publish-check-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        '{"name":"tmp"}\n',
      );
      await writeTextFile(
        path.join(tempDir, 'lerna.json'),
        '{"version":"independent"}\n',
      );

      const result = runCli(['sync-publish', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.status.updated, false);
      assert.equal(report.status.matchesRequiredPublishCheckBefore, false);
      assert.equal(report.status.matchesRequiredPublishBefore, false);
      assert.equal(report.status.matchesRequiredLernaCommitHooksAfter, false);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts, undefined);
    });
  });

  it('supports --dry-run without mutating files', async () => {
    await withTempDir(
      'agent-toolkit-sync-publish-dry-run-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );
        await writeTextFile(
          path.join(tempDir, 'lerna.json'),
          '{"version":"independent"}\n',
        );

        const result = runCli(['sync-publish', '--cwd', tempDir, '--dry-run']);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.status.updated, false);

        const pkg = await readJson(path.join(tempDir, 'package.json'));
        assert.equal(pkg.scripts, undefined);
      },
    );
  });

  it('is a no-op when script already matches', async () => {
    await withTempDir('agent-toolkit-sync-publish-noop-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', scripts: { 'produck:publish:check': REQUIRED_PUBLISH_CHECK_SCRIPT, 'produck:publish': REQUIRED_PUBLISH_SCRIPT } }, null, 2)}\n`,
      );
      await writeTextFile(
        path.join(tempDir, 'lerna.json'),
        '{"version":"independent","command":{"version":{"commitHooks":false}}}\n',
      );

      const result = runCli(['sync-publish', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, false);
      assert.equal(report.status.matchesRequiredPublishCheckBefore, true);
      assert.equal(report.status.matchesRequiredPublishBefore, true);
      assert.equal(report.status.matchesRequiredLernaCommitHooksBefore, true);
    });
  });

  it('check mode passes when script already matches', async () => {
    await withTempDir(
      'agent-toolkit-sync-publish-check-noop-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          `${JSON.stringify({ name: 'tmp', scripts: { 'produck:publish:check': REQUIRED_PUBLISH_CHECK_SCRIPT, 'produck:publish': REQUIRED_PUBLISH_SCRIPT } }, null, 2)}\n`,
        );
        await writeTextFile(
          path.join(tempDir, 'lerna.json'),
          '{"version":"independent","command":{"version":{"commitHooks":false}}}\n',
        );

        const result = runCli(['sync-publish', '--cwd', tempDir, '--check']);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.status.matchesRequiredPublishCheckBefore, true);
        assert.equal(report.status.matchesRequiredPublishBefore, true);
        assert.equal(report.status.matchesRequiredLernaCommitHooksBefore, true);
      },
    );
  });

  it('sync mode enforces lerna command.version.commitHooks=false for existing lerna config', async () => {
    await withTempDir(
      'agent-toolkit-sync-publish-lerna-commit-hooks-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );
        await writeTextFile(
          path.join(tempDir, 'lerna.json'),
          '{"version":"independent","command":{"version":{"commitHooks":true}}}\n',
        );

        const result = runCli(['sync-publish', '--cwd', tempDir]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(
          report.status.matchesRequiredLernaCommitHooksBefore,
          false,
        );
        assert.equal(report.status.matchesRequiredLernaCommitHooksAfter, true);

        const lerna = await readJson(path.join(tempDir, 'lerna.json'));
        assert.equal(lerna.command.version.commitHooks, false);
      },
    );
  });

  it('check mode fails when lerna.json is absent', async () => {
    await withTempDir(
      'agent-toolkit-sync-publish-check-no-lerna-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const result = runCli(['sync-publish', '--cwd', tempDir, '--check']);
        assert.equal(result.status, 2);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.equal(report.status.lernaExistedBefore, false);
        assert.equal(report.status.lernaDefaultCreated, false);
      },
    );
  });

  it('outputs JSON report to file when --json is specified', async () => {
    await withTempDir('agent-toolkit-sync-publish-json-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        '{"name":"tmp"}\n',
      );
      await writeTextFile(
        path.join(tempDir, 'lerna.json'),
        '{"version":"independent"}\n',
      );

      const jsonOut = path.join(tempDir, 'out', 'report.json');
      const result = runCli([
        'sync-publish',
        '--cwd',
        tempDir,
        '--json',
        jsonOut,
      ]);
      assert.equal(result.status, 0);

      const report = await readJson(jsonOut);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, true);
    });
  });
});
