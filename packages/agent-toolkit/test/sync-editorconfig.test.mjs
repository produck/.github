import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { runCli, withTempDir, writeTextFile } from './helpers.mjs';
import { printSyncEditorconfigHelp } from '../bin/command/sync-editorconfig/index.mjs';

const REQUIRED_EDITORCONFIG = `root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.{yml,yaml}]
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
max_line_length = 80
`;

describe('sync-editorconfig command', () => {
  it('prints help text via CLI', () => {
    const result = runCli(['sync-editorconfig', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /\.editorconfig/);
  });

  it('prints help text via module function', () => {
    const chunks = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk) => {
      chunks.push(String(chunk));
      return true;
    };

    try {
      printSyncEditorconfigHelp();
    } finally {
      process.stdout.write = originalWrite;
    }

    const output = chunks.join('');
    assert.match(output, /Usage:/);
    assert.match(output, /\.editorconfig/);
  });

  it('exits with ok=true when .editorconfig matches required content', async () => {
    await withTempDir('agent-toolkit-sync-editorconfig-match-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, '.editorconfig'), REQUIRED_EDITORCONFIG);

      const result = runCli(['sync-editorconfig', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.fileExistsBefore, true);
      assert.equal(report.status.updated, false);
      assert.deepEqual(report.status.mismatchesBefore, []);
    });
  });

  it('creates .editorconfig when file is missing', async () => {
    await withTempDir('agent-toolkit-sync-editorconfig-create-', async (tempDir) => {
      const result = runCli(['sync-editorconfig', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.fileExistsBefore, false);
      assert.equal(report.status.updated, true);

      // Verify file was created
      const editorconfigPath = path.join(tempDir, '.editorconfig');
      assert.equal(fs.existsSync(editorconfigPath), true);
      const content = fs.readFileSync(editorconfigPath, 'utf8');
      assert.ok(content.includes('root = true'));
      assert.ok(content.includes('charset = utf-8'));
    });
  });

  it('adds missing entries to existing .editorconfig', async () => {
    await withTempDir('agent-toolkit-sync-editorconfig-merge-', async (tempDir) => {
      // Write incomplete .editorconfig
      await writeTextFile(
        path.join(tempDir, '.editorconfig'),
        `root = true

[*]
charset = utf-8
indent_style = space
`,
      );

      const result = runCli(['sync-editorconfig', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, true);
      assert.ok(report.status.mismatchesBefore.length > 0);

      // Verify missing entries were added
      const content = fs.readFileSync(path.join(tempDir, '.editorconfig'), 'utf8');
      assert.ok(content.includes('indent_size = 2'));
      assert.ok(content.includes('trim_trailing_whitespace = true'));
    });
  });

  it('reports mismatches in check mode without writing', async () => {
    await withTempDir('agent-toolkit-sync-editorconfig-check-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, '.editorconfig'),
        `root = true

[*]
charset = utf-8
`,
      );

      const result = runCli(['sync-editorconfig', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.ok(report.status.mismatchesBefore.length > 0);

      // Verify file was not modified
      const content = fs.readFileSync(path.join(tempDir, '.editorconfig'), 'utf8');
      assert.equal(content.includes('indent_size'), false);
    });
  });

  it('reports planned changes in dry-run mode without writing', async () => {
    await withTempDir('agent-toolkit-sync-editorconfig-dryrun-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, '.editorconfig'),
        `root = true

[*]
charset = utf-8
`,
      );

      const result = runCli(['sync-editorconfig', '--cwd', tempDir, '--dry-run']);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, false);

      // Verify file was not modified
      const content = fs.readFileSync(path.join(tempDir, '.editorconfig'), 'utf8');
      assert.equal(content.includes('indent_size'), false);
    });
  });

  it('outputs JSON report to file when --json is specified', async () => {
    await withTempDir('agent-toolkit-sync-editorconfig-json-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, '.editorconfig'), REQUIRED_EDITORCONFIG);

      const result = runCli(['sync-editorconfig', '--cwd', tempDir, '--json', 'logs/report.json']);
      assert.equal(result.status, 0);

      // Verify JSON file was created
      const jsonPath = path.join(tempDir, 'logs', 'report.json');
      assert.equal(fs.existsSync(jsonPath), true);
      const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      assert.equal(jsonReport.ok, true);
    });
  });

  it('fails with exit code 2 when cwd does not exist', () => {
    const result = runCli(['sync-editorconfig', '--cwd', 'd:\\nonexistent\\path']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /does not exist/);
  });

  it('appends missing sections to an existing partial .editorconfig via merge flow', async () => {
    await withTempDir('agent-toolkit-sync-editorconfig-merge-sections-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, '.editorconfig'),
        `root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
`,
      );

      const result = runCli(['sync-editorconfig', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.status.updated, true);

      const content = fs.readFileSync(path.join(tempDir, '.editorconfig'), 'utf8');
      assert.ok(content.includes('[*.{yml,yaml}]'));
      assert.ok(content.includes('[*.md]'));
      assert.ok(content.includes('max_line_length = 80'));
    });
  });

  it('appends missing root flag to existing file without root', async () => {
    await withTempDir('agent-toolkit-sync-editorconfig-missing-root-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, '.editorconfig'),
        `[*]
charset = utf-8
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.{yml,yaml}]
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
max_line_length = 80
`,
      );

      const result = runCli(['sync-editorconfig', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.status.updated, true);

      const content = fs.readFileSync(path.join(tempDir, '.editorconfig'), 'utf8');
      assert.ok(content.includes('root = true'));
    });
  });

  it('reports planned changes in dry-run mode with missing sections', async () => {
    await withTempDir('agent-toolkit-sync-editorconfig-dryrun-missing-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, '.editorconfig'),
        `root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
trim_trailing_whitespace = true
`,
      );

      const result = runCli(['sync-editorconfig', '--cwd', tempDir, '--dry-run']);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, false);
      assert.ok(report.status.mismatchesBefore.length > 0);

      // Verify file was not modified
      const content = fs.readFileSync(path.join(tempDir, '.editorconfig'), 'utf8');
      assert.equal(content.includes('[*.{yml,yaml}]'), false);
    });
  });

  it('check mode exits non-zero when root is missing', async () => {
    await withTempDir('agent-toolkit-sync-editorconfig-check-root-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, '.editorconfig'),
        `[*]
charset = utf-8
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.{yml,yaml}]
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
max_line_length = 80
`,
      );

      const result = runCli(['sync-editorconfig', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.ok(report.status.mismatchesBefore.some((m) => m.section === '_root'));
    });
  });

  it('handles invalid .editorconfig with no sections gracefully', async () => {
    await withTempDir('agent-toolkit-sync-editorconfig-invalid-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, '.editorconfig'), 'some junk content\n');

      const result = runCli(['sync-editorconfig', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.status.updated, true);
      // Missing root and all sections should be reported
      assert.ok(report.status.mismatchesBefore.length > 0);
    });
  });
});
