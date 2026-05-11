import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(TEST_DIR, '..');
const TOOLKIT_BIN = path.resolve(PACKAGE_ROOT, 'bin/agent-toolkit.mjs');

function runValidate(messageFile) {
  return spawnSync(process.execPath, [TOOLKIT_BIN, 'validate-commit-msg', '--file', messageFile], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
  });
}

async function withMessage(content, runner) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-toolkit-msg-'));
  const messageFile = path.join(tempDir, 'COMMIT_EDITMSG');

  await fs.writeFile(messageFile, content, 'utf8');

  try {
    await runner(messageFile);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

describe('validate-commit-msg', () => {
  it('accepts standalone tagged commit lines', async () => {
    await withMessage('[FIX] <docs>: clarify validate command output\n', async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /validation passed/i);
    });
  });

  it('accepts monorepo package/workspace section headers', async () => {
    const message = ['workspace:', '[FIX] <docs>: align policy wording', 'core:', '[ADD] <test>: cover validator section mode', ''].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /validation passed/i);
    });
  });

  it('rejects orphaned section headers', async () => {
    const message = ['workspace:', 'core:', '[FIX] <docs>: keep one tagged line', ''].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /section header "workspace:" must be followed by at least one tagged line/i);
    });
  });

  it('accepts publish tag and fmt target', async () => {
    const message = ['[PUBLISH] release @produck/agent-toolkit v0.2.1', '[FIX] <fmt>: normalize commit policy examples', ''].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /validation passed/i);
    });
  });
});
