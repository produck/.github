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

describe('sync-prettier-config command', () => {
  it('prints help text', () => {
    const result = runCli(['sync-prettier-config', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /\.prettierrc/);
  });

  it('applies required format script and .prettierrc', async () => {
    await withTempDir('agent-toolkit-sync-prettier-config-sync-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-prettier-config', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts['produck:format'], REQUIRED_FORMAT_SCRIPT);

      const prettierConfig = fs.readFileSync(path.join(tempDir, '.prettierrc'), 'utf8');
      assert.equal(prettierConfig, REQUIRED_PRETTIER_CONFIG);
    });
  });

  it('supports --check without mutating files', async () => {
    await withTempDir('agent-toolkit-sync-prettier-config-check-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-prettier-config', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.status.updated, false);
      assert.equal(fs.existsSync(path.join(tempDir, '.prettierrc')), false);
    });
  });
});
