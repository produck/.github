import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const REQUIRED_FORMAT_SCRIPT = 'npm exec -- prettier --check . && npm run format --if-present';
const REQUIRED_PRETTIER_CONFIG = `${JSON.stringify(
  {
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    useTabs: false,
    trailingComma: 'all',
    bracketSpacing: true,
    arrowParens: 'always',
    printWidth: 100,
  },
  null,
  2,
)}\n`;

describe('sync-format command', () => {
  it('prints help text', () => {
    const result = runCli(['sync-format', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /\.prettierrc/);
  });

  it('applies required format script and .prettierrc', async () => {
    await withTempDir('agent-toolkit-sync-format-sync-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-format', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts['produck:format'], REQUIRED_FORMAT_SCRIPT);

      const prettierConfig = fs.readFileSync(path.join(tempDir, '.prettierrc'), 'utf8');
      assert.equal(prettierConfig, REQUIRED_PRETTIER_CONFIG);
    });
  });

  it('supports --check without mutating files', async () => {
    await withTempDir('agent-toolkit-sync-format-check-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-format', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.status.updated, false);
      assert.equal(fs.existsSync(path.join(tempDir, '.prettierrc')), false);
    });
  });

  it('fails when root package.json does not exist', async () => {
    await withTempDir('agent-toolkit-sync-format-missing-pkg-', async (tempDir) => {
      const result = runCli(['sync-format', '--cwd', tempDir]);

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Root package\.json does not exist/);
    });
  });

  it('fails when root package.json is invalid JSON', async () => {
    await withTempDir('agent-toolkit-sync-format-invalid-pkg-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{ invalid json\n');

      const result = runCli(['sync-format', '--cwd', tempDir]);

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Root package\.json is not valid JSON/);
    });
  });

  it('supports --dry-run without mutating files', async () => {
    await withTempDir('agent-toolkit-sync-format-dry-run-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-format', '--cwd', tempDir, '--dry-run']);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.mode, 'dry-run');
      assert.equal(report.status.updated, false);
      assert.equal(fs.existsSync(path.join(tempDir, '.prettierrc')), false);
    });
  });

  it('supports --json output report file', async () => {
    await withTempDir('agent-toolkit-sync-format-json-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli([
        'sync-format',
        '--cwd',
        tempDir,
        '--json',
        'logs/prettier-report.json',
      ]);
      assert.equal(result.status, 0);

      const report = await readJson(path.join(tempDir, 'logs', 'prettier-report.json'));
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, true);
    });
  });

  it('supports --check and --dry-run together with check taking precedence', async () => {
    await withTempDir('agent-toolkit-sync-format-check-dry-run-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-format', '--cwd', tempDir, '--check', '--dry-run']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.mode, 'check');
      assert.equal(report.ok, false);
      assert.equal(report.status.updated, false);
    });
  });
});
