import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

import { writeTextFile, withTempDir } from './helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function toModuleUrl(filePath) {
  return pathToFileURL(filePath).href;
}

function runPatched(modulePath, functionName, args, patchCode) {
  const code = [
    "import fs from 'node:fs';",
    patchCode,
    `const mod = await import(${JSON.stringify(toModuleUrl(modulePath))});`,
    `mod.${functionName}(${JSON.stringify(args)});`,
  ].join('\n');

  return spawnSync(process.execPath, ['--input-type=module', '--eval', code], {
    encoding: 'utf8',
  });
}

describe('fault injection coverage for sync commands', () => {
  it('sync-format fails when .prettierrc source candidates are missing', async () => {
    await withTempDir('agent-toolkit-fault-sync-format-prettierrc-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const modulePath = path.resolve(
        ROOT,
        'bin/command/sync-format/index.mjs',
      );
      const result = runPatched(
        modulePath,
        'runSyncFormat',
        ['--cwd', tempDir],
        [
          'const originalExistsSync = fs.existsSync;',
          'fs.existsSync = (p) => {',
          '  const s = String(p);',
          "  if (/\\.prettierrc$/.test(s) || /publish-assets[\\\\/]prettierrc$/.test(s)) return false;",
          '  return originalExistsSync(p);',
          '};',
        ].join('\n'),
      );

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Org \.prettierrc source not found/);
    });
  });

  it('sync-coverage fails when required c8 config template is missing', async () => {
    await withTempDir('agent-toolkit-fault-sync-coverage-template-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const modulePath = path.resolve(
        ROOT,
        'bin/command/sync-coverage/index.mjs',
      );
      const result = runPatched(
        modulePath,
        'runSyncCoverage',
        ['--cwd', tempDir],
        [
          'const originalExistsSync = fs.existsSync;',
          'fs.existsSync = (p) => {',
          '  const s = String(p);',
          "  if (/required-c8-config\\.json$/.test(s)) return false;",
          '  return originalExistsSync(p);',
          '};',
        ].join('\n'),
      );

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Required c8 config template does not exist/);
    });
  });

  it('sync-format fails when tooling baseline candidates are missing', async () => {
    await withTempDir('agent-toolkit-fault-sync-format-baseline-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const modulePath = path.resolve(ROOT, 'bin/command/sync-format/index.mjs');
      const result = runPatched(
        modulePath,
        'runSyncFormat',
        ['--cwd', tempDir],
        [
          'const originalExistsSync = fs.existsSync;',
          'fs.existsSync = (p) => {',
          '  const s = String(p);',
          "  if (/tooling-version-baseline\\.json$/.test(s)) return false;",
          '  return originalExistsSync(p);',
          '};',
        ].join('\n'),
      );

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Tooling baseline file does not exist/);
    });
  });

  it('sync-format fails when .prettierignore source candidates are missing', async () => {
    await withTempDir('agent-toolkit-fault-sync-format-prettierignore-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const modulePath = path.resolve(ROOT, 'bin/command/sync-format/index.mjs');
      const result = runPatched(
        modulePath,
        'runSyncFormat',
        ['--cwd', tempDir],
        [
          'const originalExistsSync = fs.existsSync;',
          'fs.existsSync = (p) => {',
          '  const s = String(p);',
          "  if (/\\.prettierignore$/.test(s) || /publish-assets[\\\\/]prettierignore$/.test(s)) return false;",
          '  return originalExistsSync(p);',
          '};',
        ].join('\n'),
      );

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Org \.prettierignore source not found/);
    });
  });

  it('sync-coverage fails when tooling baseline has invalid schemaVersion', async () => {
    await withTempDir('agent-toolkit-fault-sync-coverage-schema-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const modulePath = path.resolve(ROOT, 'bin/command/sync-coverage/index.mjs');
      const result = runPatched(
        modulePath,
        'runSyncCoverage',
        ['--cwd', tempDir],
        [
          'const originalReadFileSync = fs.readFileSync;',
          'fs.readFileSync = (p, enc) => {',
          '  const s = String(p);',
          "  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ tools: { c8: { version: '11.0.0' } }, coverage: { scriptTemplate: 'npm exec --package=c8@{c8.version} -- c8 --config .c8rc.json npm run test' } });",
          '  return originalReadFileSync(p, enc);',
          '};',
        ].join('\n'),
      );

      assert.equal(result.status, 2);
      assert.match(result.stderr, /schemaVersion must be a number/);
    });
  });

  it('sync-coverage fails when required c8 template JSON is invalid', async () => {
    await withTempDir('agent-toolkit-fault-sync-coverage-template-json-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const modulePath = path.resolve(ROOT, 'bin/command/sync-coverage/index.mjs');
      const result = runPatched(
        modulePath,
        'runSyncCoverage',
        ['--cwd', tempDir],
        [
          'const originalReadFileSync = fs.readFileSync;',
          'fs.readFileSync = (p, enc) => {',
          '  const s = String(p);',
          "  if (/required-c8-config\\.json$/.test(s)) return '{invalid-json';",
          '  return originalReadFileSync(p, enc);',
          '};',
        ].join('\n'),
      );

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Required c8 config template is not valid JSON/);
    });
  });

  it('sync-lint fails when eslint-rules version cannot be resolved', async () => {
    await withTempDir('agent-toolkit-fault-sync-lint-version-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const modulePath = path.resolve(
        ROOT,
        'bin/command/sync-lint/index.mjs',
      );
      const result = runPatched(
        modulePath,
        'runSyncLint',
        ['--cwd', tempDir],
        [
          'const originalExistsSync = fs.existsSync;',
          'fs.existsSync = (p) => {',
          '  const s = String(p);',
          "  if (/packages[\\\\/]eslint-rules[\\\\/]package\\.json$/.test(s)) return false;",
          "  if (/tooling-version-baseline\\.json$/.test(s)) return false;",
          '  return originalExistsSync(p);',
          '};',
        ].join('\n'),
      );

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Cannot resolve @produck\/eslint-rules version/);
    });
  });

  it('sync-publish fails when lerna template candidates are missing', async () => {
    await withTempDir('agent-toolkit-fault-sync-publish-lerna-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const modulePath = path.resolve(
        ROOT,
        'bin/command/sync-publish/index.mjs',
      );
      const result = runPatched(
        modulePath,
        'runSyncPublish',
        ['--cwd', tempDir],
        [
          'const originalExistsSync = fs.existsSync;',
          'fs.existsSync = (p) => {',
          '  const s = String(p);',
          "  if (/\\.github[\\\\/]lerna\\.json$/.test(s)) return false;",
          "  if (/publish-assets[\\\\/]lerna\\.json$/.test(s)) return false;",
          '  return originalExistsSync(p);',
          '};',
        ].join('\n'),
      );

      assert.equal(result.status, 2);
      assert.match(result.stderr, /lerna template does not exist in expected locations/);
    });
  });

  it('sync-publish fails when lerna template JSON is invalid', async () => {
    await withTempDir('agent-toolkit-fault-sync-publish-invalid-template-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const modulePath = path.resolve(ROOT, 'bin/command/sync-publish/index.mjs');
      const result = runPatched(
        modulePath,
        'runSyncPublish',
        ['--cwd', tempDir],
        [
          'const originalReadFileSync = fs.readFileSync;',
          'fs.readFileSync = (p, enc) => {',
          '  const s = String(p);',
          "  if (/publish-assets[\\\\/]lerna\\.json$/.test(s) || /\\.github[\\\\/]lerna\\.json$/.test(s)) return '{invalid-json';",
          '  return originalReadFileSync(p, enc);',
          '};',
        ].join('\n'),
      );

      assert.equal(result.status, 2);
      assert.match(result.stderr, /lerna template is not valid JSON/);
    });
  });

  it('sync-git fails when org .gitattributes source candidates are missing', async () => {
    await withTempDir('agent-toolkit-fault-sync-git-gitattributes-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const modulePath = path.resolve(ROOT, 'bin/command/sync-git/index.mjs');
      const result = runPatched(
        modulePath,
        'runSyncGit',
        ['--cwd', tempDir],
        [
          'const originalExistsSync = fs.existsSync;',
          'fs.existsSync = (p) => {',
          '  const s = String(p);',
          "  if (/\\.github[\\\\/]\\.gitattributes$/.test(s)) return false;",
          "  if (/publish-assets[\\\\/]gitattributes$/.test(s)) return false;",
          '  return originalExistsSync(p);',
          '};',
        ].join('\n'),
      );

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Org \.gitattributes source not found/);
    });
  });

  it('sync-git fails when org .gitignore source candidates are missing', async () => {
    await withTempDir('agent-toolkit-fault-sync-git-gitignore-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const modulePath = path.resolve(ROOT, 'bin/command/sync-git/index.mjs');
      const result = runPatched(
        modulePath,
        'runSyncGit',
        ['--cwd', tempDir],
        [
          'const originalExistsSync = fs.existsSync;',
          'fs.existsSync = (p) => {',
          '  const s = String(p);',
          "  if (/\\.github[\\\\/]\\.gitignore$/.test(s)) return false;",
          "  if (/publish-assets[\\\\/]gitignore$/.test(s)) return false;",
          '  return originalExistsSync(p);',
          '};',
        ].join('\n'),
      );

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Org \.gitignore source not found/);
    });
  });

  it('sync-git fails when tooling baseline versions are missing', async () => {
    await withTempDir('agent-toolkit-fault-sync-git-baseline-versions-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const modulePath = path.resolve(ROOT, 'bin/command/sync-git/index.mjs');
      const result = runPatched(
        modulePath,
        'runSyncGit',
        ['--cwd', tempDir],
        [
          'const originalReadFileSync = fs.readFileSync;',
          'fs.readFileSync = (p, enc) => {',
          '  const s = String(p);',
          "  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: { husky: { version: '' }, lerna: { version: '' } } });",
          '  return originalReadFileSync(p, enc);',
          '};',
        ].join('\n'),
      );

      assert.equal(result.status, 2);
      assert.match(result.stderr, /must define fixed tools\.husky\/lerna\.version/);
    });
  });
});
