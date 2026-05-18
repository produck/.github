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

function runValidateArgs(args, spawnOptions = {}) {
  return spawnSync(
    process.execPath,
    [TOOLKIT_BIN, 'validate-commit-msg', ...args],
    {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
      env: { ...process.env, ...(spawnOptions.env || {}) },
    },
  );
}

function runValidate(messageFile) {
  return runValidateArgs(['--file', messageFile]);
}

async function withMessage(content, runner) {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'agent-toolkit-msg-'),
  );
  const messageFile = path.join(tempDir, 'COMMIT_EDITMSG');

  await fs.writeFile(messageFile, content, 'utf8');

  try {
    await runner(messageFile);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

describe('validate-commit-msg', () => {
  it('prints help and exits when --file is missing', () => {
    const result = runValidateArgs([]);

    assert.equal(result.status, 2);
    assert.match(result.stdout, /Usage:/);
  });

  it('fails when message file is missing', () => {
    const missingPath = path.join(
      os.tmpdir(),
      'agent-toolkit-missing-message-file.txt',
    );
    const result = runValidate(missingPath);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Message file not found/);
  });

  it('fails on empty commit message file', async () => {
    await withMessage('', async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Commit message is empty/);
    });
  });

  it('accepts messages with trailing blank lines', async () => {
    const message = [
      'workspace:',
      '[FIX] <docs>: keep final message strict',
      '',
      '',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /validation passed/i);
    });
  });

  it('accepts VS Code amend-style comment summary and trailing blank lines', async () => {
    const message = [
      'workspace:',
      '[FIX] <docs>: keep final message strict',
      '',
      '# Please enter the commit message for your changes. Lines starting',
      '# with # will be ignored, and an empty message aborts the commit.',
      '# modified: package.json',
      '',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /validation passed/i);
    });
  });

  it('accepts alternate git comment char when configured', async () => {
    const message = [
      'workspace:',
      '[FIX] <docs>: support alternate comment marker',
      '; comment line injected by editor',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidateArgs(['--file', messageFile], {
        env: { GIT_COMMENT_CHAR: ';' },
      });

      assert.equal(result.status, 0);
      assert.match(result.stdout, /validation passed/i);
    });
  });

  it('accepts sectioned tagged commit lines', async () => {
    const message = [
      'workspace:',
      '[FIX] <docs>: clarify validate command output',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /validation passed/i);
    });
  });

  it('accepts monorepo package/workspace section headers', async () => {
    const message = [
      'workspace:',
      '[FIX] <docs>: align policy wording',
      '@produck/agent-toolkit:',
      '[ADD] <test>: cover validator section mode',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /validation passed/i);
    });
  });

  it('rejects orphaned section headers', async () => {
    const message = [
      'workspace:',
      '@produck/agent-toolkit:',
      '[FIX] <docs>: keep one tagged line',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /section header "workspace:" must be followed by at least one tagged line/i,
      );
    });
  });

  it('rejects tagged lines before section header in section mode', async () => {
    const message = [
      '[FIX] <docs>: line before section header',
      'workspace:',
      '[FIX] <docs>: section line',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /section header is required before tagged lines when package\/workspace sections are used/i,
      );
    });
  });

  it('rejects standalone lines without a section header in monorepo mode', async () => {
    await withMessage('summary without tag\n', async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /section header is required before tagged lines in monorepo mode/i,
      );
    });
  });

  it('rejects monorepo messages without a section header', async () => {
    await withMessage(
      '[FIX] <docs>: missing scope line\n',
      async (messageFile) => {
        const result = runValidate(messageFile);

        assert.equal(result.status, 1);
        assert.match(
          result.stderr,
          /section header is required before tagged lines in monorepo mode/i,
        );
      },
    );
  });

  it('allows [PUBLISH] without a section header in monorepo mode', async () => {
    await withMessage('[PUBLISH]\n', async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /validation passed/i);
    });
  });

  it('allows multi-line lerna [PUBLISH] message in monorepo mode', async () => {
    const message = '[PUBLISH]\n\n - @produck/agent-toolkit@0.3.1\n';

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /validation passed/i);
    });
  });

  it('rejects disallowed tags', async () => {
    const message = ['workspace:', '[CHANGED] update config', ''].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /tag \[CHANGED\] is not allowed/i);
    });
  });

  it('rejects disallowed targets', async () => {
    const message = ['workspace:', '[FIX] <feature>: add capability', ''].join(
      '\n',
    );

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /target <feature> is not allowed/i);
    });
  });

  it('rejects missing summary after tag', async () => {
    const message = ['workspace:', '[FIX]    ', ''].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /summary is required after tag/i);
    });
  });

  it('rejects empty summary after target', async () => {
    const message = ['workspace:', '[FIX] <docs>:    ', ''].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /summary is required after target/i);
    });
  });

  it('rejects empty lines in commit message', async () => {
    const message = [
      'workspace:',
      '[FIX] first line',
      '',
      '[FIX] second line',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /empty line is not allowed/i);
    });
  });

  it('rejects empty lines in section mode', async () => {
    const message = [
      'workspace:',
      '[FIX] <docs>: first line',
      '',
      '[FIX] <docs>: second line',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /empty line is not allowed/i);
    });
  });

  it('still rejects real body lines after stripping comments and edge blanks', async () => {
    const message = [
      'workspace:',
      '[FIX] <docs>: keep validator strict',
      'body line without tag',
      '# ignored summary line',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /must start with \[TAG\] followed by a space/i,
      );
    });
  });

  it('reports validateCommitLine errors inside section mode', async () => {
    const message = [
      'workspace:',
      '[CHANGED] invalid tag inside section',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(result.stderr, /tag \[CHANGED\] is not allowed/i);
    });
  });

  it('rejects trailing orphan section header', async () => {
    const message = [
      'workspace:',
      '[FIX] <docs>: section entry',
      '@produck/eslint-rules:',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /section header "@produck\/eslint-rules:" must be followed by at least one tagged line/i,
      );
    });
  });

  it('accepts wildcard scope for mixed monorepo commits', async () => {
    const message = [
      '*:',
      '[FIX] <infra>: align mixed workspace/package changes',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /validation passed/i);
    });
  });

  it('rejects section scope outside workspace/package-name/* convention', async () => {
    const message = ['core:', '[FIX] <docs>: invalid scope name', ''].join(
      '\n',
    );

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /section header "core:" is not allowed in monorepo mode/i,
      );
    });
  });

  it('accepts publish tag and fmt target', async () => {
    const message = [
      'workspace:',
      '[PUBLISH] release @produck/agent-toolkit v0.2.1',
      '[FIX] <fmt>: normalize commit policy examples',
      '',
    ].join('\n');

    await withMessage(message, async (messageFile) => {
      const result = runValidate(messageFile);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /validation passed/i);
    });
  });

  it('falls back to standalone mode when root package.json has invalid JSON', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'agent-toolkit-root-pkg-'),
    );
    try {
      const rootPkgFile = path.join(tempDir, 'package.json');
      await fs.writeFile(rootPkgFile, '{invalid-json', 'utf8');

      await withMessage('[FIX] fix something\n', async (messageFile) => {
        const result = runValidateArgs(['--file', messageFile], {
          env: { _AGENT_TOOLKIT_TEST_ROOT_PKG: rootPkgFile },
        });

        assert.equal(result.status, 0);
        assert.match(result.stdout, /validation passed/i);
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('skips workspace without package.json when building allowed scopes', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'agent-toolkit-root-pkg-'),
    );
    try {
      const rootPkgFile = path.join(tempDir, 'package.json');
      await fs.writeFile(
        rootPkgFile,
        JSON.stringify({ name: 'r', workspaces: ['packages/a'] }),
        'utf8',
      );
      await fs.mkdir(path.join(tempDir, 'packages', 'a'), { recursive: true });

      await withMessage('workspace:\n[FIX] fix\n', async (messageFile) => {
        const result = runValidateArgs(['--file', messageFile], {
          env: { _AGENT_TOOLKIT_TEST_ROOT_PKG: rootPkgFile },
        });

        assert.equal(result.status, 0);
        assert.match(result.stdout, /validation passed/i);
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('skips workspace with invalid package.json when building allowed scopes', async () => {
    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'agent-toolkit-root-pkg-'),
    );
    try {
      const rootPkgFile = path.join(tempDir, 'package.json');
      await fs.writeFile(
        rootPkgFile,
        JSON.stringify({ name: 'r', workspaces: ['packages/a'] }),
        'utf8',
      );
      await fs.mkdir(path.join(tempDir, 'packages', 'a'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'packages', 'a', 'package.json'),
        '{invalid-json',
        'utf8',
      );

      await withMessage('workspace:\n[FIX] fix\n', async (messageFile) => {
        const result = runValidateArgs(['--file', messageFile], {
          env: { _AGENT_TOOLKIT_TEST_ROOT_PKG: rootPkgFile },
        });

        assert.equal(result.status, 0);
        assert.match(result.stdout, /validation passed/i);
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
