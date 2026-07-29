import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { BIN_PATH, GLOB_TOKENS, toolkitEnv } from './helpers.mjs';

describe('bootstrapRepo', () => {
  it('creates minimal package.json, workspace, and runs enforce-node-baseline', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'create-agent-toolkit-init-'),
    );
    try {
      const result = spawnSync(process.execPath, [BIN_PATH], {
        cwd: tempDir,
        input: 'myapp\nmymod\n',
        encoding: 'utf8',
        env: toolkitEnv({ PRODUCK_SKIP_INSTALL: '1' }),
      });

      assert.equal(
        result.status,
        0,
        `Expected exit 0, got ${result.status}\nstderr: ${result.stderr}`,
      );

      // Verify root package.json structure
      const rootPkgRaw = await fs.readFile(
        path.join(tempDir, 'package.json'),
        'utf8',
      );
      const rootPkg = JSON.parse(rootPkgRaw);
      assert.equal(rootPkg.name, '@produck/myapp-workspace');
      assert.equal(rootPkg.private, true);
      assert.deepStrictEqual(rootPkg.workspaces, ['packages/mymod']);

      // Workspaces must use explicit paths, no glob tokens
      for (const ws of rootPkg.workspaces) {
        assert.ok(
          !GLOB_TOKENS.test(ws),
          `Workspace entry must not contain glob tokens: ${ws}`,
        );
      }

      // Verify workspace package.json
      const wsPkgRaw = await fs.readFile(
        path.join(tempDir, 'packages', 'mymod', 'package.json'),
        'utf8',
      );
      const wsPkg = JSON.parse(wsPkgRaw);
      assert.equal(wsPkg.name, '@produck/mymod');
      assert.equal(wsPkg.version, '0.0.0');

      // Verify enforce-node-baseline populated root scripts
      assert.ok(
        typeof rootPkg.scripts === 'object' && rootPkg.scripts !== null,
      );
      const requiredRootScripts = [
        'produck:install',
        'produck:coverage',
        'produck:lint',
        'produck:format',
        'produck:baseline',
        'produck:commit:check',
        'prepare',
      ];
      for (const key of requiredRootScripts) {
        assert.ok(
          key in rootPkg.scripts,
          `Missing required root script: ${key}`,
        );
      }

      // Verify sync-workspace populated workspace-level scripts
      assert.ok(typeof wsPkg.scripts === 'object' && wsPkg.scripts !== null);
      assert.ok(
        'test' in wsPkg.scripts,
        'Missing required workspace script: test',
      );
      assert.ok(
        'produck:coverage' in wsPkg.scripts,
        'Missing required workspace script: produck:coverage',
      );

      // Verify enforce-node-baseline created config files
      const expectedFiles = [
        '.editorconfig',
        '.prettierrc',
        '.prettierignore',
        'eslint.config.mjs',
        '.gitattributes',
        '.gitignore',
        '.c8rc.json',
        'lerna.json',
        '.husky/pre-commit',
        '.husky/commit-msg',
        '.github/instructions/produck/00-produck-base.instructions.md',
        '.github/copilot-instructions.md',
      ];
      for (const relPath of expectedFiles) {
        const absPath = path.join(tempDir, relPath);
        try {
          await fs.stat(absPath);
        } catch {
          assert.fail(`Expected file not found: ${relPath}`);
        }
      }
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('uses default values when piped input is empty', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'create-agent-toolkit-defaults-'),
    );
    try {
      const dirName = path.basename(tempDir);

      const result = spawnSync(process.execPath, [BIN_PATH], {
        cwd: tempDir,
        input: '\n\n',
        encoding: 'utf8',
        env: toolkitEnv(),
      });

      assert.equal(
        result.status,
        0,
        `Expected exit 0, got ${result.status}\nstderr: ${result.stderr}`,
      );

      const rootPkgRaw = await fs.readFile(
        path.join(tempDir, 'package.json'),
        'utf8',
      );
      const rootPkg = JSON.parse(rootPkgRaw);

      // Both should default to the directory name
      assert.equal(rootPkg.name, `@produck/${dirName}-workspace`);
      assert.deepStrictEqual(rootPkg.workspaces, [`packages/${dirName}`]);

      const wsExists = await fs
        .stat(path.join(tempDir, 'packages', dirName, 'package.json'))
        .then(() => true)
        .catch(() => false);
      assert.ok(wsExists);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
