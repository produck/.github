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

function toOptions(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!String(token).startsWith('--')) {
      continue;
    }
    const next = argv[i + 1];
    if (!next || String(next).startsWith('--')) {
      if (!options[token]) {
        options[token] = [];
      }
      options[token].push(true);
      continue;
    }
    if (!options[token]) {
      options[token] = [];
    }
    options[token].push(String(next));
    i += 1;
  }
  return options;
}

function runPatched(modulePath, functionName, args, patchCode) {
  const options = toOptions(args);
  const code = [
    'import fs from \'node:fs\';',
    patchCode,
    `const mod = await import(${JSON.stringify(toModuleUrl(modulePath))});`,
    `mod.${functionName}(${JSON.stringify(options)});`,
  ].join('\n');

  return spawnSync(process.execPath, ['--input-type=module', '--eval', code], {
    encoding: 'utf8',
  });
}

describe('fault injection coverage for sync commands', () => {
  it('sync-format fails when .prettierrc source candidates are missing', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-format-prettierrc-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

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
            '  if (/\\.prettierrc$/.test(s) || /publish-assets[\\\\/]prettierrc$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Org \.prettierrc source not found/);
      },
    );
  });

  it('sync-coverage fails when required c8 config template is missing', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-coverage-template-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

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
            '  if (/required-c8-config\\.json$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(
          result.stderr,
          /Required c8 config template does not exist/,
        );
      },
    );
  });

  it('sync-format fails when tooling baseline candidates are missing', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-format-baseline-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

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
            '  if (/tooling-version-baseline\\.json$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Tooling baseline file does not exist/);
      },
    );
  });

  it('sync-format fails when tooling baseline prettier version is empty', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-format-empty-prettier-version-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-format/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncFormat',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: { prettier: { version: "" } } });',
            '  // Mask root package.json so fallback resolver does not find prettier',
            '  if (/[.]json$/.test(s) && /package[.]json$/.test(s) && !/node_modules/.test(s) && !/publish-assets/.test(s) && !/tooling-version-baseline/.test(s)) {',
            '    return JSON.stringify({ name: "tmp" });',
            '  }',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /tools\.prettier\.version/);
      },
    );
  });

  it('sync-format fails when .prettierignore source candidates are missing', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-format-prettierignore-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

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
            '  if (/\\.prettierignore$/.test(s) || /publish-assets[\\\\/]prettierignore$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Org \.prettierignore source not found/);
      },
    );
  });

  it('sync-coverage fails when tooling baseline has invalid schemaVersion', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-coverage-schema-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-coverage/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncCoverage',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ tools: { c8: { version: \'11.0.0\' } }, coverage: { scriptTemplate: \'npm exec --package=c8@{c8.version} -- c8 --config .c8rc.json npm run test\' } });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /schemaVersion must be a number/);
      },
    );
  });

  it('sync-coverage fails when required c8 template JSON is invalid', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-coverage-template-json-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-coverage/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncCoverage',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/required-c8-config\\.json$/.test(s)) return \'{invalid-json\';',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(
          result.stderr,
          /Required c8 config template is not valid JSON/,
        );
      },
    );
  });

  it('sync-coverage fails when tooling baseline candidates are missing', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-coverage-no-baseline-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

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
            '  if (/tooling-version-baseline\\.json$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Tooling baseline file does not exist/);
      },
    );
  });

  it('sync-coverage fails when tooling baseline c8 version is empty', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-coverage-empty-c8-version-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-coverage/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncCoverage',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: { c8: { version: "" } }, coverage: { scriptTemplate: "c8 --config .c8rc.json npm run test" } });',
            '  // Mask root package.json so fallback resolver does not find c8',
            '  if (/[.]json$/.test(s) && /package[.]json$/.test(s) && !/node_modules/.test(s) && !/publish-assets/.test(s) && !/tooling-version-baseline/.test(s)) {',
            '    return JSON.stringify({ name: "tmp" });',
            '  }',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(
          result.stderr,
          /tools\.c8\.version must be a non-empty string/,
        );
      },
    );
  });

  it('sync-coverage fails when tooling baseline coverage template is empty', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-coverage-empty-template-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-coverage/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncCoverage',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: { c8: { version: "11.0.0" } }, coverage: { scriptTemplate: "" } });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(
          result.stderr,
          /coverage\.scriptTemplate must be a non-empty string/,
        );
      },
    );
  });

  it('sync-lint fails when eslint-rules version cannot be resolved', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-lint-version-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

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
            '  if (/packages[\\\\/]eslint-rules[\\\\/]package\\.json$/.test(s)) return false;',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Cannot resolve ESLint tooling versions/);
      },
    );
  });

  it('sync-lint fails when tooling baseline eslint-rules version is empty', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-lint-empty-baseline-version-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

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
            'const originalReadFileSync = fs.readFileSync;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  if (s.includes("packages\\\\eslint-rules\\\\package.json") || s.includes("packages/eslint-rules/package.json")) return false;',
            '  return originalExistsSync(p);',
            '};',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: { "@produck/eslint-rules": { version: "" } } });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /must be a non-empty string/);
      },
    );
  });

  it('sync-lint uses baseline eslint-rules version when in-tree package is unavailable', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-lint-baseline-version-success-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

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
            'const originalReadFileSync = fs.readFileSync;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  if (s.includes("packages\\\\eslint-rules\\\\package.json") || s.includes("packages/eslint-rules/package.json")) return false;',
            '  return originalExistsSync(p);',
            '};',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: { "@produck/eslint-rules": { version: "1.2.3" }, "eslint": { version: "10.0.0" }, "@eslint/js": { version: "10.0.0" }, "@eslint/json": { version: "1.0.0" }, "@eslint/markdown": { version: "8.0.0" }, "@eslint/config-helpers": { version: "0.6.0" }, "typescript-eslint": { version: "8.0.0" }, "globals": { version: "17.0.0" } } });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 0);
        const report = JSON.parse(result.stdout);
        assert.equal(
          report.required.eslintDevDependencies['@produck/eslint-rules'],
          '1.2.3',
        );
      },
    );
  });

  it('sync-publish fails when lerna template candidates are missing', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-publish-lerna-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

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
            '  if (/\\.github[\\\\/]lerna\\.json$/.test(s)) return false;',
            '  if (/publish-assets[\\\\/]lerna\\.json$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(
          result.stderr,
          /lerna template does not exist in expected locations/,
        );
      },
    );
  });

  it('sync-publish fails when lerna template JSON is invalid', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-publish-invalid-template-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-publish/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncPublish',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/publish-assets[\\\\/]lerna\\.json$/.test(s) || /\\.github[\\\\/]lerna\\.json$/.test(s)) return \'{invalid-json\';',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /lerna template is not valid JSON/);
      },
    );
  });

  it('sync-publish fails when lerna template has no version field', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-publish-template-no-version-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-publish/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncPublish',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/lerna\\.json$/.test(s)) return JSON.stringify({ command: { version: { commitHooks: true } } });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(
          result.stderr,
          /lerna template must have a "version" field/,
        );
      },
    );
  });

  it('sync-git fails when org .gitattributes source candidates are missing', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-git-gitattributes-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(ROOT, 'bin/command/sync-git/index.mjs');
        const result = runPatched(
          modulePath,
          'runSyncGit',
          ['--cwd', tempDir],
          [
            'const originalExistsSync = fs.existsSync;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  if (/\\.github[\\\\/]\\.gitattributes$/.test(s)) return false;',
            '  if (/publish-assets[\\\\/]gitattributes$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Org \.gitattributes source not found/);
      },
    );
  });

  it('sync-git fails when org .gitignore source candidates are missing', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-git-gitignore-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(ROOT, 'bin/command/sync-git/index.mjs');
        const result = runPatched(
          modulePath,
          'runSyncGit',
          ['--cwd', tempDir],
          [
            'const originalExistsSync = fs.existsSync;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  if (/\\.github[\\\\/]\\.gitignore$/.test(s)) return false;',
            '  if (/publish-assets[\\\\/]gitignore$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Org \.gitignore source not found/);
      },
    );
  });

  it('sync-git fails when tooling baseline versions are missing', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-git-baseline-versions-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(ROOT, 'bin/command/sync-git/index.mjs');
        const result = runPatched(
          modulePath,
          'runSyncGit',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: { husky: { version: \'\' }, lerna: { version: \'\' } } });',
            '  // Mask root package.json so fallback resolver does not find husky/lerna',
            '  if (/[.]json$/.test(s) && /package[.]json$/.test(s) && !/node_modules/.test(s) && !/publish-assets/.test(s) && !/tooling-version-baseline/.test(s)) {',
            '  return JSON.stringify({ name: "tmp" });',
            '  }',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(
          result.stderr,
          /must define fixed tools\.husky\/lerna\.version/,
        );
      },
    );
  });

  it('sync-git fails when tooling baseline candidates are missing', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-git-no-baseline-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(ROOT, 'bin/command/sync-git/index.mjs');
        const result = runPatched(
          modulePath,
          'runSyncGit',
          ['--cwd', tempDir],
          [
            'const originalExistsSync = fs.existsSync;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Tooling baseline file does not exist/);
      },
    );
  });

  it('sync-git uses npm latest version when npm lookup succeeds', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-git-npm-success-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(ROOT, 'bin/command/sync-git/index.mjs');
        const result = runPatched(
          modulePath,
          'runSyncGit',
          ['--cwd', tempDir],
          [
            'import os from "node:os";',
            'import path from "node:path";',
            'const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-toolkit-fault-npm-bin-"));',
            'const npmName = process.platform === "win32" ? "npm.cmd" : "npm";',
            'const npmPath = path.join(binDir, npmName);',
            'if (process.platform === "win32") {',
            '  fs.writeFileSync(npmPath, "@echo off\\necho 9.8.7\\n", "utf8");',
            '} else {',
            '  fs.writeFileSync(npmPath, "#!/bin/sh\\necho 9.8.7\\n", "utf8");',
            '  fs.chmodSync(npmPath, 0o755);',
            '}',
            'process.env.PATH = binDir;',
            'process.env.PRODUCK_TOOLKIT_VERSION_OVERRIDE = "";',
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (s.endsWith("packages\\agent-toolkit\\package.json") || s.endsWith("packages/agent-toolkit/package.json")) return JSON.stringify({ name: "@produck/agent-toolkit" });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 0);
        const report = JSON.parse(result.stdout);
        assert.match(
          report.required.managedDevDependencies['@produck/agent-toolkit'],
          /^\d+\.\d+\.\d+$/,
        );
      },
    );
  });

  it('sync-git fails when npm lookup fails and local toolkit package has no version', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-git-missing-local-version-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(ROOT, 'bin/command/sync-git/index.mjs');
        const result = runPatched(
          modulePath,
          'runSyncGit',
          ['--cwd', tempDir],
          [
            'process.env.PATH = "";',
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (s.endsWith("packages\\\\agent-toolkit\\\\package.json") || s.endsWith("packages/agent-toolkit/package.json")) return JSON.stringify({ name: "@produck/agent-toolkit" });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Toolkit package version is missing/);
      },
    );
  });

  it('sync-format uses concrete baseline version without falling back to package.json', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-format-concrete-version-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-format/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncFormat',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: { prettier: { version: "99.99.99" } } });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        // With concrete version in baseline, the early return is taken
        // without falling through to root package.json fallback.
        assert.equal(result.status, 0);
        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
      },
    );
  });

  it('sync-git uses concrete baseline version without falling back to package.json', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-git-concrete-version-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          JSON.stringify({
            name: 'tmp',
            scripts: {
              'produck:baseline': 'echo baseline',
              'produck:commit:check': 'echo check',
              prepare: 'husky',
            },
            devDependencies: {
              '@produck/agent-toolkit': '0.0.0',
            },
          }) + '\n',
        );

        const modulePath = path.resolve(ROOT, 'bin/command/sync-git/index.mjs');
        const result = runPatched(
          modulePath,
          'runSyncGit',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: { husky: { version: "9.9.9" }, lerna: { version: "8.8.8" } } });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        // Concrete baseline versions are used directly without needing
        // root package.json fallback.
        assert.equal(result.status, 0);
        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
      },
    );
  });

  it('sync-lint fails when tooling baseline and root package.json both lack eslint tools', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-lint-no-tools-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-lint/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncLint',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: {} });',
            '  // Return a root package.json without eslint tools (falls through to readFileSync fallback)',
            '  if (/package\\.json$/.test(s) && !/node_modules/.test(s) && !/publish-assets/.test(s) && !/tooling-version-baseline/.test(s) && !/eslint-rules/.test(s)) {',
            '    return JSON.stringify({ name: "tmp" });',
            '  }',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /must be a non-empty string/);
      },
    );
  });

  it('validate-commit-msg supports non-monorepo flow without section headers', async () => {
    await withTempDir(
      'agent-toolkit-fault-validate-msg-non-monorepo-',
      async (tempDir) => {
        const messageFile = path.join(tempDir, 'COMMIT_EDITMSG');
        await writeTextFile(messageFile, '[FIX] <docs>: standalone message\n');

        const modulePath = path.resolve(
          ROOT,
          'bin/command/validate-commit-msg/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runValidateCommitMsg',
          ['--file', messageFile],
          [
            'const originalExistsSync = fs.existsSync;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  if (/package\\.json$/.test(s) && !s.endsWith("COMMIT_EDITMSG")) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 0);
        assert.match(result.stdout, /validation passed/i);
      },
    );
  });

  it('validate-commit-msg reports line-level errors in non-monorepo flow', async () => {
    await withTempDir(
      'agent-toolkit-fault-validate-msg-line-errors-',
      async (tempDir) => {
        const messageFile = path.join(tempDir, 'COMMIT_EDITMSG');
        await writeTextFile(messageFile, '[CHANGED] invalid tag\n');

        const modulePath = path.resolve(
          ROOT,
          'bin/command/validate-commit-msg/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runValidateCommitMsg',
          ['--file', messageFile],
          [
            'const originalExistsSync = fs.existsSync;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  if (/package\\.json$/.test(s) && !s.endsWith("COMMIT_EDITMSG")) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 1);
        assert.match(result.stderr, /tag \[CHANGED\] is not allowed/i);
      },
    );
  });

  it('validate-commit-msg parser accepts extra argv tokens and standalone flags', async () => {
    await withTempDir(
      'agent-toolkit-fault-validate-msg-options-shape-',
      async (tempDir) => {
        const messageFile = path.join(tempDir, 'COMMIT_EDITMSG');
        await writeTextFile(messageFile, '[FIX] <docs>: standalone line\n');

        const modulePath = path.resolve(
          ROOT,
          'bin/command/validate-commit-msg/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runValidateCommitMsg',
          ['ignored-positional', '--check', '--file', messageFile],
          [
            'const originalExistsSync = fs.existsSync;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  if (/package\\.json$/.test(s) && !s.endsWith("COMMIT_EDITMSG")) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 0);
        assert.match(result.stdout, /validation passed/i);
      },
    );
  });

  it('validate-commit-msg handles workspace metadata collection edge cases', async () => {
    await withTempDir(
      'agent-toolkit-fault-validate-msg-workspace-metadata-edge-',
      async (tempDir) => {
        const messageFile = path.join(tempDir, 'COMMIT_EDITMSG');
        await writeTextFile(
          messageFile,
          'workspace:\n[FIX] <docs>: keep sections strict\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/validate-commit-msg/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runValidateCommitMsg',
          ['--file', messageFile],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/[\\/]\\.github[\\/]package\\.json$/.test(s)) return JSON.stringify({ workspaces: ["missing-ws", "broken-ws"] });',
            '  if (/broken-ws[\\/]package\\.json$/.test(s)) return "{invalid-json";',
            '  return originalReadFileSync(p, enc);',
            '};',
            'const originalExistsSync = fs.existsSync;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  if (/missing-ws[\\/]package\\.json$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 0);
        assert.match(result.stdout, /validation passed/i);
      },
    );
  });

  it('validate-commit-msg tolerates root package disappearing after monorepo check', async () => {
    await withTempDir(
      'agent-toolkit-fault-validate-msg-root-disappears-',
      async (tempDir) => {
        const messageFile = path.join(tempDir, 'COMMIT_EDITMSG');
        await writeTextFile(
          messageFile,
          'workspace:\n[FIX] <docs>: keep sections strict\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/validate-commit-msg/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runValidateCommitMsg',
          ['--file', messageFile],
          [
            'const originalExistsSync = fs.existsSync;',
            'let rootPackageCheckCount = 0;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  if (/[\\/]\\.github[\\/]package\\.json$/.test(s)) {',
            '    rootPackageCheckCount += 1;',
            '    return rootPackageCheckCount === 1;',
            '  }',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 0);
        assert.match(result.stdout, /validation passed/i);
      },
    );
  });

  it('validate-commit-msg tolerates root package JSON parse failure after monorepo check', async () => {
    await withTempDir(
      'agent-toolkit-fault-validate-msg-root-second-read-invalid-',
      async (tempDir) => {
        const messageFile = path.join(tempDir, 'COMMIT_EDITMSG');
        await writeTextFile(
          messageFile,
          'workspace:\n[FIX] <docs>: keep sections strict\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/validate-commit-msg/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runValidateCommitMsg',
          ['--file', messageFile],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'let rootPackageReadCount = 0;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/[\\/]\\.github[\\/]package\\.json$/.test(s)) {',
            '    rootPackageReadCount += 1;',
            '    if (rootPackageReadCount === 1) return JSON.stringify({ workspaces: ["packages/agent-toolkit"] });',
            '    return "{invalid-json";',
            '  }',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 0);
        assert.match(result.stdout, /validation passed/i);
      },
    );
  });

  it('validate-commit-msg tolerates empty workspaces after monorepo check', async () => {
    await withTempDir(
      'agent-toolkit-fault-validate-msg-root-second-read-empty-workspaces-',
      async (tempDir) => {
        const messageFile = path.join(tempDir, 'COMMIT_EDITMSG');
        await writeTextFile(
          messageFile,
          'workspace:\n[FIX] <docs>: keep sections strict\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/validate-commit-msg/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runValidateCommitMsg',
          ['--file', messageFile],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'let rootPackageReadCount = 0;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/[\\/]\\.github[\\/]package\\.json$/.test(s)) {',
            '    rootPackageReadCount += 1;',
            '    if (rootPackageReadCount === 1) return JSON.stringify({ workspaces: ["packages/agent-toolkit"] });',
            '    return JSON.stringify({ workspaces: [] });',
            '  }',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 0);
        assert.match(result.stdout, /validation passed/i);
      },
    );
  });

  it('validate-commit-msg allows non-section empty-line diagnostics in non-monorepo mode', async () => {
    await withTempDir(
      'agent-toolkit-fault-validate-msg-non-section-empty-line-',
      async (tempDir) => {
        const messageFile = path.join(tempDir, 'COMMIT_EDITMSG');
        await writeTextFile(
          messageFile,
          '[FIX] <docs>: first line\n\n[FIX] <docs>: second line\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/validate-commit-msg/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runValidateCommitMsg',
          ['--file', messageFile],
          [
            'const originalExistsSync = fs.existsSync;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  if (/package\\.json$/.test(s) && !s.endsWith("COMMIT_EDITMSG")) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 1);
        assert.match(result.stderr, /empty line is not allowed/i);
      },
    );
  });

  it('sync-workspace fails when tooling baseline candidates are missing', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-workspace-no-baseline-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-workspace/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncWorkspace',
          ['--cwd', tempDir],
          [
            'const originalExistsSync = fs.existsSync;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Tooling baseline file does not exist/);
      },
    );
  });

  it('sync-workspace fails when tooling baseline has invalid schemaVersion', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-workspace-schema-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-workspace/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncWorkspace',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ tools: { c8: { version: "11.0.0" } } });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(result.stderr, /schemaVersion must be a number/);
      },
    );
  });

  it('sync-workspace fails when tooling baseline c8 version is empty', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-workspace-empty-c8-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-workspace/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncWorkspace',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: { c8: { version: "" } }, coverage: { scriptTemplate: "c8 --reporter=lcov npm test" } });',
            '  // Return root package.json without c8 so devDep fallback returns empty',
            '  if (/package\\.json$/.test(s) && !s.includes("agent-toolkit-fault-")) return JSON.stringify({ devDependencies: {} });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(
          result.stderr,
          /tools\.c8\.version must be a non-empty string/,
        );
      },
    );
  });

  it('sync-workspace fails when tooling baseline coverage template is empty', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-workspace-empty-template-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-workspace/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncWorkspace',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: { c8: { version: "11.0.0" } } });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(
          result.stderr,
          /coverage\.scriptTemplate must be a non-empty string/,
        );
      },
    );
  });

  it('sync-workspace uses concrete baseline version without falling back to package.json', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-workspace-concrete-version-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-workspace/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncWorkspace',
          ['--cwd', tempDir],
          [
            'const originalExistsSync = fs.existsSync;',
            'fs.existsSync = (p) => {',
            '  const s = String(p);',
            '  // Hide the source baseline (which has "auto" versions) so publish-assets baseline (concrete versions) is used',
            '  if (/distribution[\\\\/]produck[\\\\/]tooling-version-baseline\\.json$/.test(s)) return false;',
            '  return originalExistsSync(p);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 0);
        // The command should succeed using the publish-assets baseline concrete version
        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
      },
    );
  });

  it('sync-workspace falls back when root package.json has no c8 devDependency', async () => {
    await withTempDir(
      'agent-toolkit-fault-sync-workspace-fallback-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp","devDependencies":{}}\n',
        );

        const modulePath = path.resolve(
          ROOT,
          'bin/command/sync-workspace/index.mjs',
        );
        const result = runPatched(
          modulePath,
          'runSyncWorkspace',
          ['--cwd', tempDir],
          [
            'const originalReadFileSync = fs.readFileSync;',
            'fs.readFileSync = (p, enc) => {',
            '  const s = String(p);',
            '  if (/tooling-version-baseline\\.json$/.test(s)) return JSON.stringify({ schemaVersion: 1, tools: { c8: { version: "auto" } }, coverage: { scriptTemplate: "c8 --reporter=lcov --reporter=html --reporter=text-summary npm test" } });',
            '  // Return root package.json without c8 so devDep fallback returns empty',
            '  if (/package\\.json$/.test(s) && !s.includes("agent-toolkit-fault-")) return JSON.stringify({ devDependencies: {} });',
            '  return originalReadFileSync(p, enc);',
            '};',
          ].join('\n'),
        );

        assert.equal(result.status, 2);
        assert.match(
          result.stderr,
          /tools\.c8\.version must be a non-empty string/,
        );
      },
    );
  });
});
