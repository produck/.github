import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(TEST_DIR, '..');
const BIN_PATH = path.resolve(PACKAGE_ROOT, 'bin/create-agent-toolkit.mjs');

test('runs toolkit bootstrap command against cwd', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'create-agent-toolkit-'));
  try {
    const result = spawnSync(process.execPath, [BIN_PATH], {
      cwd: tempDir,
      encoding: 'utf8',
    });

    assert.notEqual(result.status, null);
    assert.equal(result.status, 2);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    assert.match(combinedOutput, /"target":\s*"package\.json"/);
    assert.match(combinedOutput, /"exists":\s*false/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
