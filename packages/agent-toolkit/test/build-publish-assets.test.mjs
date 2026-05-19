import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

import { PACKAGE_ROOT } from './helpers.mjs';

const BUILD_SCRIPT = path.resolve(PACKAGE_ROOT, 'bin/build-publish-assets.mjs');

function runBuildPatched(patchCode) {
  const code = [
    'import fs from \'node:fs\';',
    patchCode,
    `await import(${JSON.stringify(pathToFileURL(BUILD_SCRIPT).href)});`,
  ].join('\n');

  return spawnSync(process.execPath, ['--input-type=module', '--eval', code], {
    encoding: 'utf8',
  });
}

describe('build-publish-assets script', () => {
  it('fails when source instruction directory is missing', () => {
    const result = runBuildPatched(
      [
        'const originalExistsSync = fs.existsSync;',
        'fs.existsSync = (p) => {',
        '  const s = String(p);',
        '  if (/distribution[\\\\/]produck$/.test(s)) return false;',
        '  return originalExistsSync(p);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing source directory/);
  });

  it('fails when source instruction files are missing frontmatter', () => {
    const result = runBuildPatched(
      [
        'const originalReadFileSync = fs.readFileSync;',
        'fs.readFileSync = (p, enc) => {',
        '  const s = String(p);',
        '  if (/\\.instructions\\.md$/.test(s)) return \'body only\\n\';',
        '  return originalReadFileSync(p, enc);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing frontmatter in source file/);
  });

  it('fails when source instruction files are missing applyTo', () => {
    const result = runBuildPatched(
      [
        'const originalReadFileSync = fs.readFileSync;',
        'fs.readFileSync = (p, enc) => {',
        '  const s = String(p);',
        '  if (/\\.instructions\\.md$/.test(s)) return \'---\\nname: x\\n---\\n<!-- managed-by: @produck/agent-toolkit -->\\n\';',
        '  return originalReadFileSync(p, enc);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing applyTo in source file/);
  });

  it('fails when source instruction files are missing managed marker', () => {
    const result = runBuildPatched(
      [
        'const originalReadFileSync = fs.readFileSync;',
        'fs.readFileSync = (p, enc) => {',
        '  const s = String(p);',
        '  if (/\\.instructions\\.md$/.test(s)) return \'---\\napplyTo: ' +
          '"**/*"' +
          '\\n---\\ncontent\\n\';',
        '  return originalReadFileSync(p, enc);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing managed marker in source file/);
  });

  it('fails when tooling baseline source file is missing', () => {
    const result = runBuildPatched(
      [
        'const originalExistsSync = fs.existsSync;',
        'fs.existsSync = (p) => {',
        '  const s = String(p);',
        '  if (/tooling-version-baseline\\.json$/.test(s)) return false;',
        '  return originalExistsSync(p);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing tooling baseline source file/);
  });

  it('fails when tooling baseline source is invalid JSON', () => {
    const result = runBuildPatched(
      [
        'const originalReadFileSync = fs.readFileSync;',
        'fs.readFileSync = (p, enc) => {',
        '  const s = String(p);',
        '  if (/tooling-version-baseline\\.json$/.test(s)) return \'{invalid-json\';',
        '  return originalReadFileSync(p, enc);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid tooling baseline JSON/);
  });

  it('fails when tooling baseline schemaVersion is invalid', () => {
    const result = runBuildPatched(
      [
        'const originalReadFileSync = fs.readFileSync;',
        'fs.readFileSync = (p, enc) => {',
        '  const s = String(p);',
        '  if (/tooling-version-baseline\\.json$/.test(s)) {',
        '    return JSON.stringify({ tools: { c8: { version: \'11.0.0\' }, lerna: { version: \'9.0.7\' } }, coverage: { scriptTemplate: \'c8 {c8.version}\' } });',
        '  }',
        '  return originalReadFileSync(p, enc);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid tooling baseline schemaVersion/);
  });

  it('fails when tooling baseline c8 version is missing', () => {
    const result = runBuildPatched(
      [
        'const originalReadFileSync = fs.readFileSync;',
        'fs.readFileSync = (p, enc) => {',
        '  const s = String(p);',
        '  if (/tooling-version-baseline\\.json$/.test(s)) {',
        '    return JSON.stringify({ schemaVersion: 1, tools: { c8: { version: \'\' }, lerna: { version: \'9.0.7\' } }, coverage: { scriptTemplate: \'c8 {c8.version}\' } });',
        '  }',
        '  return originalReadFileSync(p, enc);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid tools\.c8\.version/);
  });

  it('fails when tooling baseline lerna version is missing', () => {
    const result = runBuildPatched(
      [
        'const originalReadFileSync = fs.readFileSync;',
        'fs.readFileSync = (p, enc) => {',
        '  const s = String(p);',
        '  if (/tooling-version-baseline\\.json$/.test(s)) {',
        '    return JSON.stringify({ schemaVersion: 1, tools: { c8: { version: \'11.0.0\' }, lerna: { version: \'\' } }, coverage: { scriptTemplate: \'c8 {c8.version}\' } });',
        '  }',
        '  return originalReadFileSync(p, enc);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid tools\.lerna\.version/);
  });

  it('fails when tooling baseline coverage template is missing', () => {
    const result = runBuildPatched(
      [
        'const originalReadFileSync = fs.readFileSync;',
        'fs.readFileSync = (p, enc) => {',
        '  const s = String(p);',
        '  if (/tooling-version-baseline\\.json$/.test(s)) {',
        '    return JSON.stringify({ schemaVersion: 1, tools: { c8: { version: \'11.0.0\' }, lerna: { version: \'9.0.7\' } }, coverage: { scriptTemplate: \'\' } });',
        '  }',
        '  return originalReadFileSync(p, enc);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid coverage\.scriptTemplate/);
  });

  it('fails when source instruction directory has no instruction files', () => {
    const result = runBuildPatched(
      [
        'const originalReaddirSync = fs.readdirSync;',
        'fs.readdirSync = (p, options) => {',
        '  const s = String(p);',
        '  if (/distribution[\\\\/]produck$/.test(s)) return [];',
        '  return originalReaddirSync(p, options);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /No source instruction files/);
  });

  it('fails when required source files are missing', () => {
    const result = runBuildPatched(
      [
        'const originalExistsSync = fs.existsSync;',
        'fs.existsSync = (p) => {',
        '  const s = String(p);',
        '  if (/\\.prettierignore$/.test(s)) return false;',
        '  return originalExistsSync(p);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing source \.prettierignore/);
  });

  it('fails when source .gitattributes is missing', () => {
    const result = runBuildPatched(
      [
        'const originalExistsSync = fs.existsSync;',
        'fs.existsSync = (p) => {',
        '  const s = String(p);',
        '  if (/\\.gitattributes$/.test(s)) return false;',
        '  return originalExistsSync(p);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing source \.gitattributes/);
  });

  it('fails when source .gitignore is missing', () => {
    const result = runBuildPatched(
      [
        'const originalExistsSync = fs.existsSync;',
        'fs.existsSync = (p) => {',
        '  const s = String(p);',
        '  if (/\\.gitignore$/.test(s)) return false;',
        '  return originalExistsSync(p);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing source \.gitignore/);
  });

  it('fails when source .prettierrc is missing', () => {
    const result = runBuildPatched(
      [
        'const originalExistsSync = fs.existsSync;',
        'fs.existsSync = (p) => {',
        '  const s = String(p);',
        '  if (/\\.prettierrc$/.test(s)) return false;',
        '  return originalExistsSync(p);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing source \.prettierrc/);
  });

  it('fails when source lerna.json is missing', () => {
    const result = runBuildPatched(
      [
        'const originalExistsSync = fs.existsSync;',
        'fs.existsSync = (p) => {',
        '  const s = String(p);',
        '  if (/lerna\\.json$/.test(s)) return false;',
        '  return originalExistsSync(p);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing source lerna\.json/);
  });

  it('fails when source eslint.config.mjs is missing', () => {
    const result = runBuildPatched(
      [
        'const originalExistsSync = fs.existsSync;',
        'fs.existsSync = (p) => {',
        '  const s = String(p);',
        '  if (/eslint\\.config\\.mjs$/.test(s) && !String(p).includes(\'publish-assets\')) return false;',
        '  return originalExistsSync(p);',
        '};',
      ].join('\n'),
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing source eslint\.config\.mjs/);
  });

  it('generates publish-assets from repository sources', () => {
    const result = spawnSync(process.execPath, [BUILD_SCRIPT], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Generated/);

    const expectedFiles = [
      path.resolve(PACKAGE_ROOT, 'publish-assets/gitattributes'),
      path.resolve(PACKAGE_ROOT, 'publish-assets/gitignore'),
      path.resolve(PACKAGE_ROOT, 'publish-assets/prettierrc'),
      path.resolve(PACKAGE_ROOT, 'publish-assets/prettierignore'),
      path.resolve(PACKAGE_ROOT, 'publish-assets/lerna.json'),
      path.resolve(
        PACKAGE_ROOT,
        'publish-assets/instructions/produck/tooling-version-baseline.json',
      ),
      path.resolve(PACKAGE_ROOT, 'publish-assets/eslint.config.template.mjs'),
    ];

    for (const filePath of expectedFiles) {
      assert.equal(fs.existsSync(filePath), true, `missing ${filePath}`);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.equal(
        content.endsWith('\n'),
        true,
        `missing trailing newline: ${filePath}`,
      );
    }

    const legacyPath = path.resolve(
      PACKAGE_ROOT,
      'publish-assets/instructions/org.instructions.md',
    );
    assert.equal(fs.existsSync(legacyPath), false);
  });

  it('removes legacy output file when present', () => {
    const legacyPath = path.resolve(
      PACKAGE_ROOT,
      'publish-assets/instructions/org.instructions.md',
    );
    fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
    fs.writeFileSync(
      legacyPath,
      '<!-- managed-by: @produck/agent-toolkit -->\nlegacy\n',
      'utf8',
    );

    const result = spawnSync(process.execPath, [BUILD_SCRIPT], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Removed legacy/);
    assert.equal(fs.existsSync(legacyPath), false);
  });

  it('keeps stale output file when it is not managed by produck marker', () => {
    const stalePath = path.resolve(
      PACKAGE_ROOT,
      'publish-assets/instructions/produck/stale.instructions.md',
    );
    fs.mkdirSync(path.dirname(stalePath), { recursive: true });
    fs.writeFileSync(stalePath, 'user owned content\n', 'utf8');

    const result = spawnSync(process.execPath, [BUILD_SCRIPT], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(stalePath), true);
  });

  it('deletes stale managed output file during build', () => {
    const stalePath = path.resolve(
      PACKAGE_ROOT,
      'publish-assets/instructions/produck/zz-test-stale.instructions.md',
    );
    fs.mkdirSync(path.dirname(stalePath), { recursive: true });
    fs.writeFileSync(
      stalePath,
      '<!-- managed-by: @produck/agent-toolkit -->\nstale content\n',
      'utf8',
    );

    const result = spawnSync(process.execPath, [BUILD_SCRIPT], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(stalePath), false);
  });
});
