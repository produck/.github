import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { BIN_PATH, toolkitEnv } from './helpers.mjs';

describe('existing repository', () => {
  it('runs enforce-node-baseline directly without entering interactive mode', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'create-agent-toolkit-existing-'),
    );
    try {
      // Create minimal valid existing repo
      const existingPkg = {
        name: '@produck/existing-repo',
        private: true,
        workspaces: ['packages/existing-mod'],
      };
      await fs.mkdir(path.join(tempDir, 'packages', 'existing-mod'), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(tempDir, 'packages', 'existing-mod', 'package.json'),
        `${JSON.stringify({ name: '@produck/existing-mod', version: '0.0.0' }, null, 2)}\n`,
      );
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify(existingPkg, null, 2)}\n`,
      );

      const result = spawnSync(process.execPath, [BIN_PATH], {
        cwd: tempDir,
        encoding: 'utf8',
        env: toolkitEnv(),
      });

      const combinedOutput = `${result.stdout}\n${result.stderr}`;
      // Must not enter interactive mode
      assert.ok(
        !combinedOutput.includes('Produck Repository Initialization'),
        'Should not enter interactive mode when package.json exists',
      );
      // enforce-node-baseline should run (at minimum, preflight)
      assert.ok(
        combinedOutput.includes('"cwd"'),
        'Should run enforce-node-baseline',
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
