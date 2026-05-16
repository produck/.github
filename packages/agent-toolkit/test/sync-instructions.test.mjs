import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { PACKAGE_ROOT, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const MANAGED_MARKER = '<!-- managed-by: @produck/agent-toolkit -->';
const BUILTIN_NAMESPACE_DIR = path.join(PACKAGE_ROOT, 'publish-assets', 'instructions', 'produck');
const USER_SPACE_BOOTSTRAP_TEMPLATE = path.join(
  PACKAGE_ROOT,
  'bin',
  'command',
  'sync-instructions',
  'user-space-bootstrap.md',
);

async function listInstructionFiles(dir) {
  const names = await fs.readdir(dir);
  return names.filter((name) => name.endsWith('.instructions.md'));
}

describe('sync-instructions command', { concurrency: 1 }, () => {
  it('prints help text for sync-instructions command', () => {
    const result = runCli(['sync-instructions', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /--dry-run/);
  });

  it('fails when --cwd does not exist', () => {
    const missingCwd = path.join(os.tmpdir(), 'agent-toolkit-sync-missing-cwd');
    const result = runCli(['sync-instructions', '--cwd', missingCwd]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('fails when --source path does not exist', async () => {
    await withTempDir('agent-toolkit-sync-source-missing-', async (tempDir) => {
      const result = runCli([
        'sync-instructions',
        '--cwd',
        tempDir,
        '--source',
        path.join(tempDir, 'missing-source-dir'),
      ]);

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Source path does not exist/);
    });
  });

  it('fails when source directory has no .instructions.md files', async () => {
    await withTempDir('agent-toolkit-sync-empty-source-', async (tempDir) => {
      const sourceDir = path.join(tempDir, 'source');
      await fs.mkdir(sourceDir, { recursive: true });
      await writeTextFile(path.join(sourceDir, 'README.txt'), 'not an instructions file\n');

      const result = runCli(['sync-instructions', '--cwd', tempDir, '--source', sourceDir]);

      assert.equal(result.status, 2);
      assert.match(result.stderr, /No \.instructions\.md files in source directory/);
    });
  });

  it('rejects file output when source directory contains multiple instruction files', async () => {
    await withTempDir('agent-toolkit-sync-multi-file-', async (tempDir) => {
      const sourceDir = path.join(tempDir, 'source');
      await fs.mkdir(sourceDir, { recursive: true });
      await writeTextFile(path.join(sourceDir, '00-a.instructions.md'), 'A\n');
      await writeTextFile(path.join(sourceDir, '10-b.instructions.md'), 'B\n');

      const targetFile = path.join(tempDir, 'target.instructions.md');
      const result = runCli([
        'sync-instructions',
        '--cwd',
        tempDir,
        '--source',
        sourceDir,
        '--out',
        targetFile,
      ]);

      assert.equal(result.status, 2);
      assert.match(
        result.stderr,
        /Target --out is a file path but source has multiple instruction files/,
      );
    });
  });

  it('supports single-file dry-run, write, and default overwrite', async () => {
    await withTempDir('agent-toolkit-sync-single-file-', async (tempDir) => {
      const sourceFile = path.join(tempDir, 'source.instructions.md');
      const targetFile = path.join(tempDir, 'out', 'target.instructions.md');

      await writeTextFile(sourceFile, 'first-version');

      const dryRunResult = runCli([
        'sync-instructions',
        '--cwd',
        tempDir,
        '--source',
        sourceFile,
        '--out',
        targetFile,
        '--dry-run',
      ]);

      assert.equal(dryRunResult.status, 0);
      await assert.rejects(fs.stat(targetFile));

      const writeResult = runCli([
        'sync-instructions',
        '--cwd',
        tempDir,
        '--source',
        sourceFile,
        '--out',
        targetFile,
      ]);

      assert.equal(writeResult.status, 0);
      assert.equal(await fs.readFile(targetFile, 'utf8'), 'first-version\n');

      await writeTextFile(sourceFile, 'second-version');

      const overwriteResult = runCli([
        'sync-instructions',
        '--cwd',
        tempDir,
        '--source',
        sourceFile,
        '--out',
        targetFile,
      ]);

      assert.equal(overwriteResult.status, 0);
      assert.equal(await fs.readFile(targetFile, 'utf8'), 'second-version\n');
    });
  });

  it('supports directory mode with prune and user-space bootstrap init', async () => {
    await withTempDir('agent-toolkit-sync-directory-', async (tempDir) => {
      const sourceDir = path.join(tempDir, 'source');
      const outDir = path.join(tempDir, '.github', 'instructions', 'produck');

      await fs.mkdir(sourceDir, { recursive: true });
      await fs.mkdir(outDir, { recursive: true });

      await writeTextFile(path.join(sourceDir, '00-sample.instructions.md'), 'sample-content');

      const staleManaged = path.join(outDir, '90-stale.instructions.md');
      await writeTextFile(staleManaged, `${MANAGED_MARKER}\nstale\n`);

      const staleUnmanaged = path.join(outDir, '91-unmanaged.instructions.md');
      await writeTextFile(staleUnmanaged, 'unmanaged\n');

      const dryRunResult = runCli([
        'sync-instructions',
        '--cwd',
        tempDir,
        '--source',
        sourceDir,
        '--out',
        outDir,
        '--prune',
        '--dry-run',
      ]);

      assert.equal(dryRunResult.status, 0);
      assert.match(dryRunResult.stdout, /"mode": "directory"/);
      assert.match(dryRunResult.stdout, /"initializedUserSpaceEntry": true/);

      const realRun = runCli([
        'sync-instructions',
        '--cwd',
        tempDir,
        '--source',
        sourceDir,
        '--out',
        outDir,
        '--prune',
        '--force',
      ]);

      assert.equal(realRun.status, 0);

      const instructions = await listInstructionFiles(outDir);
      assert.deepEqual(instructions.sort(), [
        '00-sample.instructions.md',
        '91-unmanaged.instructions.md',
      ]);

      await assert.rejects(fs.stat(staleManaged));
      const unmanagedStat = await fs.stat(staleUnmanaged);
      assert.equal(unmanagedStat.isFile(), true);

      const bootstrapFile = path.join(tempDir, '.github', 'copilot-instructions.md');
      const bootstrapText = await fs.readFile(bootstrapFile, 'utf8');
      assert.match(bootstrapText, /\.github\/instructions\/produck\/\*\.instructions\.md/);
    });
  });

  it('overwrites in directory mode without --force', async () => {
    await withTempDir('agent-toolkit-sync-dir-conflict-', async (tempDir) => {
      const sourceDir = path.join(tempDir, 'source');
      const outDir = path.join(tempDir, '.github', 'instructions', 'produck');

      await fs.mkdir(sourceDir, { recursive: true });
      await writeTextFile(path.join(sourceDir, '00-sample.instructions.md'), 'v1\n');

      const firstRun = runCli([
        'sync-instructions',
        '--cwd',
        tempDir,
        '--source',
        sourceDir,
        '--out',
        outDir,
      ]);

      assert.equal(firstRun.status, 0);

      await writeTextFile(path.join(sourceDir, '00-sample.instructions.md'), 'v2\n');

      const overwriteRun = runCli([
        'sync-instructions',
        '--cwd',
        tempDir,
        '--source',
        sourceDir,
        '--out',
        outDir,
      ]);

      assert.equal(overwriteRun.status, 0);
      assert.equal(
        await fs.readFile(path.join(outDir, '00-sample.instructions.md'), 'utf8'),
        'v2\n',
      );
    });
  });

  it('supports built-in source assets in default mode', async () => {
    await withTempDir('agent-toolkit-sync-default-source-', async (tempDir) => {
      const dryRunResult = runCli(['sync-instructions', '--cwd', tempDir, '--dry-run']);

      assert.equal(dryRunResult.status, 0);
      assert.match(dryRunResult.stdout, /"sourceType": "dir"/);
      assert.match(dryRunResult.stdout, /publish-assets/);

      const realRun = runCli(['sync-instructions', '--cwd', tempDir]);

      assert.equal(realRun.status, 0);

      const outDir = path.join(tempDir, '.github', 'instructions', 'produck');
      const instructions = await listInstructionFiles(outDir);
      assert.equal(instructions.length > 0, true);

      const bootstrapFile = path.join(tempDir, '.github', 'copilot-instructions.md');
      const bootstrapExists = await fs.stat(bootstrapFile);
      assert.equal(bootstrapExists.isFile(), true);
    });
  });

  it('marks directory entries as unchanged when target files already match source', async () => {
    await withTempDir('agent-toolkit-sync-unchanged-', async (tempDir) => {
      const sourceDir = path.join(tempDir, 'source');
      const outDir = path.join(tempDir, '.github', 'instructions', 'produck');

      await fs.mkdir(sourceDir, { recursive: true });
      await writeTextFile(path.join(sourceDir, '00-sample.instructions.md'), 'same-content\n');

      const firstRun = runCli([
        'sync-instructions',
        '--cwd',
        tempDir,
        '--source',
        sourceDir,
        '--out',
        outDir,
      ]);

      assert.equal(firstRun.status, 0);

      const secondRun = runCli([
        'sync-instructions',
        '--cwd',
        tempDir,
        '--source',
        sourceDir,
        '--out',
        outDir,
        '--dry-run',
      ]);

      assert.equal(secondRun.status, 0);
      assert.match(secondRun.stdout, /"unchanged": true/);
    });
  });

  it('normalizes built-in instruction files when source file lacks trailing newline', async () => {
    const targetFile = path.join(BUILTIN_NAMESPACE_DIR, '00-produck-base.instructions.md');
    const originalText = await fs.readFile(targetFile, 'utf8');

    try {
      await fs.writeFile(targetFile, originalText.replace(/\n$/, ''), 'utf8');

      await withTempDir('agent-toolkit-sync-builtin-normalize-', async (tempDir) => {
        const result = runCli(['sync-instructions', '--cwd', tempDir, '--dry-run']);

        assert.equal(result.status, 0);
        assert.match(result.stdout, /"mode": "directory"/);
      });
    } finally {
      await fs.writeFile(targetFile, originalText, 'utf8');
    }
  });

  it('normalizes user-space bootstrap template when template lacks trailing newline', async () => {
    const originalTemplate = await fs.readFile(USER_SPACE_BOOTSTRAP_TEMPLATE, 'utf8');

    try {
      await fs.writeFile(
        USER_SPACE_BOOTSTRAP_TEMPLATE,
        originalTemplate.replace(/\n$/, ''),
        'utf8',
      );

      await withTempDir('agent-toolkit-sync-bootstrap-normalize-', async (tempDir) => {
        const sourceDir = path.join(tempDir, 'source');
        await fs.mkdir(sourceDir, { recursive: true });
        await writeTextFile(path.join(sourceDir, '00-sample.instructions.md'), 'sample\n');

        const result = runCli([
          'sync-instructions',
          '--cwd',
          tempDir,
          '--source',
          sourceDir,
          '--out',
          path.join(tempDir, '.github', 'instructions', 'produck'),
        ]);

        assert.equal(result.status, 0);

        const bootstrapFile = path.join(tempDir, '.github', 'copilot-instructions.md');
        const bootstrapText = await fs.readFile(bootstrapFile, 'utf8');
        assert.equal(bootstrapText.endsWith('\n'), true);
      });
    } finally {
      await fs.writeFile(USER_SPACE_BOOTSTRAP_TEMPLATE, originalTemplate, 'utf8');
    }
  });

  it('fails clearly when built-in source assets are unavailable', async () => {
    const missingDirPath = `${BUILTIN_NAMESPACE_DIR}-missing-for-test`;

    try {
      await fs.rm(missingDirPath, { recursive: true, force: true });
      await fs.rename(BUILTIN_NAMESPACE_DIR, missingDirPath);

      await withTempDir('agent-toolkit-sync-missing-builtin-', async (tempDir) => {
        const result = runCli(['sync-instructions', '--cwd', tempDir]);

        assert.equal(result.status, 2);
        assert.match(result.stderr, /No built-in instruction assets found/);
      });
    } finally {
      const backupExists = await fs
        .stat(missingDirPath)
        .then(() => true)
        .catch(() => false);
      const originalExists = await fs
        .stat(BUILTIN_NAMESPACE_DIR)
        .then(() => true)
        .catch(() => false);

      if (backupExists && !originalExists) {
        await fs.rename(missingDirPath, BUILTIN_NAMESPACE_DIR);
      }
    }
  });
});
