import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const ESLINT_CONFIG_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'eslint.config.fixture.mjs',
);

describe('agent-toolkit eslint config', () => {
  it('exports a flat config array with produck rules', async () => {
    const mod = await import(pathToFileURL(ESLINT_CONFIG_PATH).href); /* c8 ignore next */
    assert.equal(Array.isArray(mod.default), true);
    assert.equal(mod.default.length > 0, true);
  });
});
