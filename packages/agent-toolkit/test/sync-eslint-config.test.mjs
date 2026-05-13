import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const REQUIRED_LINT_SCRIPT =
  'npm exec -- eslint --fix . --max-warnings=0 && npm run lint --if-present';

describe('sync-eslint-config command', () => {
  it('prints help text', () => {
    const result = runCli(['sync-eslint-config', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /eslint\.config\.mjs/);
    assert.match(result.stdout, /@produck\/eslint-rules/);
  });

  it('applies required lint script, eslint config, and eslint-rules dependency', async () => {
    await withTempDir('agent-toolkit-sync-eslint-config-sync-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-eslint-config', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts['produck:lint'], REQUIRED_LINT_SCRIPT);
      assert.match(pkg.devDependencies['@produck/eslint-rules'], /^\d+\.\d+\.\d+$/);

      const eslintConfig = fs.readFileSync(path.join(tempDir, 'eslint.config.mjs'), 'utf8');
      assert.match(eslintConfig, /@produck\/eslint-rules/);
      assert.match(eslintConfig, /ProduckRule\.config/);
    });
  });

  it('appends Produck integration when eslint.config.mjs exists without it', async () => {
    await withTempDir('agent-toolkit-sync-eslint-config-append-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');
      await writeTextFile(
        path.join(tempDir, 'eslint.config.mjs'),
        [
          'import globals from "globals";',
          'import pluginJs from "@eslint/js";',
          '',
          'export default [',
          '  pluginJs.configs.recommended,',
          '  { languageOptions: { globals: { ...globals.node } } },',
          '];',
          '',
        ].join('\n'),
      );

      const result = runCli(['sync-eslint-config', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const eslintConfig = fs.readFileSync(path.join(tempDir, 'eslint.config.mjs'), 'utf8');
      assert.match(eslintConfig, /@produck\/eslint-rules/);
      assert.match(eslintConfig, /ProduckRule\.excludeGitIgnore\(import\.meta\.url\)/);

      const report = JSON.parse(result.stdout);
      assert.equal(report.required.eslintConfigAction, 'patched');
    });
  });
});
