import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const REQUIRED_FORMAT_SCRIPT = 'npm exec -- prettier --check . && npm run format --if-present';
const REQUIRED_LINT_SCRIPT =
  'npm exec -- eslint --fix . --max-warnings=0 && npm run lint --if-present';
const REQUIRED_PRECOMMIT_CHECK_SCRIPT = 'npm run produck:format && npm run produck:lint';
const REQUIRED_BASELINE_SCRIPT =
  'npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd .';
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

describe('sync-workspace-config command', () => {
  it('prints help text for sync-workspace-config command', () => {
    const result = runCli(['sync-workspace-config', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /\.prettierrc/);
    assert.match(result.stdout, /eslint\.config\.mjs/);
    assert.match(result.stdout, /@produck\/eslint-rules/);
  });

  it('fails when --cwd does not exist', () => {
    const missingCwd = path.resolve('D:/tmp/agent-toolkit-sync-workspace-config-missing-cwd');
    const result = runCli(['sync-workspace-config', '--cwd', missingCwd]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('applies required scripts, devDependencies, and config files', async () => {
    await withTempDir('agent-toolkit-sync-workspace-config-sync-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', scripts: { test: 'npm test' } }, null, 2)}\n`,
      );

      const result = runCli(['sync-workspace-config', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts['produck:baseline'], REQUIRED_BASELINE_SCRIPT);
      assert.equal(pkg.scripts['produck:format'], REQUIRED_FORMAT_SCRIPT);
      assert.equal(pkg.scripts['produck:lint'], REQUIRED_LINT_SCRIPT);
      assert.equal(pkg.scripts['produck:precommit-check'], REQUIRED_PRECOMMIT_CHECK_SCRIPT);
      assert.match(pkg.devDependencies.husky, /^\d+\.\d+\.\d+$/);
      assert.match(pkg.devDependencies.c8, /^\d+\.\d+\.\d+$/);
      assert.match(pkg.devDependencies.lerna, /^\d+\.\d+\.\d+$/);
      assert.match(pkg.devDependencies['@produck/eslint-rules'], /^\d+\.\d+\.\d+$/);
      assert.match(pkg.devDependencies['@produck/agent-toolkit'], /^\d+\.\d+\.\d+$/);

      const prettierConfig = fs.readFileSync(path.join(tempDir, '.prettierrc'), 'utf8');
      assert.equal(prettierConfig, REQUIRED_PRETTIER_CONFIG);

      const eslintConfig = fs.readFileSync(path.join(tempDir, 'eslint.config.mjs'), 'utf8');
      assert.match(eslintConfig, /@produck\/eslint-rules/);
      assert.match(eslintConfig, /ProduckRule\.config/);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, true);
      assert.equal(report.status.matchesRequiredPrettierConfigAfter, true);
      assert.equal(report.status.matchesRequiredEslintConfigAfter, true);
    });
  });

  it('appends Produck integration when eslint.config.mjs exists without it', async () => {
    await withTempDir('agent-toolkit-sync-workspace-config-append-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify({ name: 'tmp', scripts: { test: 'npm test' } }, null, 2)}\n`,
      );
      await writeTextFile(
        path.join(tempDir, 'eslint.config.mjs'),
        [
          "import globals from 'globals';",
          "import pluginJs from '@eslint/js';",
          '',
          'export default [',
          '  pluginJs.configs.recommended,',
          '  { languageOptions: { globals: { ...globals.node } } },',
          '];',
          '',
        ].join('\n'),
      );

      const result = runCli(['sync-workspace-config', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const eslintConfig = fs.readFileSync(path.join(tempDir, 'eslint.config.mjs'), 'utf8');
      assert.match(eslintConfig, /@produck\/eslint-rules/);
      assert.match(eslintConfig, /ProduckRule\.excludeGitIgnore\(import\.meta\.url\)/);

      const report = JSON.parse(result.stdout);
      assert.equal(report.required.eslintConfigAction, 'patched');
      assert.equal(report.status.matchesRequiredEslintConfigAfter, true);
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
      assert.equal(fs.existsSync(path.join(tempDir, '.prettierrc')), false);
      assert.equal(fs.existsSync(path.join(tempDir, 'eslint.config.mjs')), false);
    });
  });
});
