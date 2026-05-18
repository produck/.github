import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

import { config, excludeGitIgnore } from '../src/index.mjs';

describe('eslint config exports', () => {
  it('uses org style baseline indentation in default config', () => {
    assert.deepEqual(config.rules.indent, ['error', 2]);
    assert.deepEqual(config.rules['linebreak-style'], ['error', 'unix']);
    assert.deepEqual(config.rules['max-len'], [
      'warn',
      {
        code: 80,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
        ignoreComments: true,
      },
    ]);
    assert.equal(config.linterOptions.noInlineConfig, true);
  });

  it('returns a valid flat config fragment from .gitignore', async () => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'eslint-rules-'));

    await fs.writeFile(path.join(fixtureRoot, '.gitignore'), '# comment\n\ndist\n', 'utf8');

    const eslintConfigPath = path.join(fixtureRoot, 'eslint.config.mjs');

    await fs.writeFile(eslintConfigPath, 'export default [];\n', 'utf8');

    const ignoreConfig = excludeGitIgnore(pathToFileURL(eslintConfigPath).href);

    assert.equal(typeof ignoreConfig, 'object');
    assert.ok(ignoreConfig);
    assert.ok(Array.isArray(ignoreConfig.ignores));
    assert.ok(ignoreConfig.ignores.length > 0);
  });

  it('throws when .gitignore is missing', async () => {
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'eslint-rules-'));
    const eslintConfigPath = path.join(fixtureRoot, 'eslint.config.mjs');

    await fs.writeFile(eslintConfigPath, 'export default [];\n', 'utf8');

    assert.throws(() => excludeGitIgnore(pathToFileURL(eslintConfigPath).href), /ENOENT/);
  });
});
