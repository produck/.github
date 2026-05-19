import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

import * as ProduckRule from '../src/index.mjs';

describe('eslint config exports', () => {
  it('config.ecma contains org style baseline rules', () => {
    const { ecma } = ProduckRule.config;

    assert.deepEqual(ecma.rules.indent, ['error', 2]);
    assert.deepEqual(ecma.rules['linebreak-style'], ['error', 'unix']);
    assert.deepEqual(ecma.rules['max-len'], [
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
    assert.equal(ecma.linterOptions.noInlineConfig, true);
  });

  it('config.json targets json files with recommended rules', () => {
    const { json } = ProduckRule.config;

    assert.deepEqual(json.files, ['**/*.json']);
    assert.deepEqual(json.ignores, ['**/package-lock.json']);
    assert.equal(json.language, 'json/json');
    assert.equal(typeof json.plugins.json, 'object');
    assert.deepEqual(json.extends, ['json/recommended']);
  });

  it('config.markdown targets md files with gfm rules', () => {
    const { markdown } = ProduckRule.config;

    assert.deepEqual(markdown.files, ['**/*.md']);
    assert.equal(markdown.language, 'markdown/gfm');
    assert.equal(typeof markdown.plugins.markdown, 'object');
    assert.deepEqual(markdown.extends, ['markdown/recommended']);
  });

  it('returns a valid flat config fragment from .gitignore', async () => {
    const fixtureRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'eslint-rules-'),
    );

    await fs.writeFile(
      path.join(fixtureRoot, '.gitignore'),
      '# comment\n\ndist\n',
      'utf8',
    );

    const eslintConfigPath = path.join(fixtureRoot, 'eslint.config.mjs');

    await fs.writeFile(eslintConfigPath, 'export default [];\n', 'utf8');

    const ignoreConfig = ProduckRule.excludeGitIgnore(
      pathToFileURL(eslintConfigPath).href,
    );

    assert.equal(typeof ignoreConfig, 'object');
    assert.ok(ignoreConfig);
    assert.ok(Array.isArray(ignoreConfig.ignores));
    assert.ok(ignoreConfig.ignores.length > 0);
  });

  it('throws when .gitignore is missing', async () => {
    const fixtureRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'eslint-rules-'),
    );
    const eslintConfigPath = path.join(fixtureRoot, 'eslint.config.mjs');

    await fs.writeFile(eslintConfigPath, 'export default [];\n', 'utf8');

    assert.throws(
      () => ProduckRule.excludeGitIgnore(pathToFileURL(eslintConfigPath).href),
      /ENOENT/,
    );
  });
});
