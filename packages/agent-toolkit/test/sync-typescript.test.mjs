import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { runCli, withTempDir, writeTextFile } from './helpers.mjs';
import { printSyncTypescriptHelp } from '../bin/command/sync-typescript/index.mjs';

const EXPECTED_TSCONFIG = {
  extends: '../../tsconfig.json',
  compilerOptions: {
    lib: ['ESNext'],
    types: ['node'],
    strictNullChecks: true,
    allowJs: true,
    noEmit: true,
    module: 'NodeNext',
  },
};

const PACKAGE_SUBDIR = 'packages/my-pkg';

function expectedJson() {
  return `${JSON.stringify(EXPECTED_TSCONFIG, null, 2)}\n`;
}

async function createPackageDir(tempDir) {
  const pkgDir = path.join(tempDir, PACKAGE_SUBDIR);
  await writeTextFile(path.join(pkgDir, 'package.json'), '{"name":"test"}');
  return pkgDir;
}

describe('sync-typescript command', () => {
  it('prints help text via CLI', () => {
    const result = runCli(['sync-typescript', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /--package-root/);
  });

  it('prints help text via module function', () => {
    let output = '';
    const originalWrite = process.stdout.write;
    process.stdout.write = (chunk) => {
      output += String(chunk);
      return true;
    };

    try {
      printSyncTypescriptHelp();
    } finally {
      process.stdout.write = originalWrite;
    }

    assert.match(output, /Usage:/);
    assert.match(output, /--package-root/);
  });

  it('creates tsconfig.json when file is missing', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-create-',
      async (tempDir) => {
        await createPackageDir(tempDir);

        const result = runCli([
          'sync-typescript',
          '--cwd',
          tempDir,
          '--package-root',
          PACKAGE_SUBDIR,
        ]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.status.fileExistsBefore, false);
        assert.equal(report.status.updated, true);

        // Verify file was created with correct content
        const tsconfigPath = path.join(
          tempDir,
          PACKAGE_SUBDIR,
          'tsconfig.json',
        );
        assert.equal(fs.existsSync(tsconfigPath), true);
        const content = fs.readFileSync(tsconfigPath, 'utf8');
        assert.equal(content, expectedJson());
      },
    );
  });

  it('skips when tsconfig.json already exists', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-skip-',
      async (tempDir) => {
        const pkgDir = await createPackageDir(tempDir);
        const tsconfigPath = path.join(pkgDir, 'tsconfig.json');

        // Create a pre-existing tsconfig.json with different content
        await writeTextFile(
          tsconfigPath,
          JSON.stringify(
            {
              extends: '../../tsconfig.json',
              compilerOptions: { target: 'ES2020' },
            },
            null,
            2,
          ) + '\n',
        );

        const result = runCli([
          'sync-typescript',
          '--cwd',
          tempDir,
          '--package-root',
          PACKAGE_SUBDIR,
        ]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.status.fileExistsBefore, true);
        assert.equal(report.status.updated, false);
        assert.equal(report.status.skipped, true);

        // Verify file was NOT overwritten
        const content = fs.readFileSync(tsconfigPath, 'utf8');
        assert.ok(content.includes('ES2020'));
      },
    );
  });

  it('reports missing file in check mode without writing', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-check-',
      async (tempDir) => {
        await createPackageDir(tempDir);

        const result = runCli([
          'sync-typescript',
          '--cwd',
          tempDir,
          '--package-root',
          PACKAGE_SUBDIR,
          '--check',
        ]);
        assert.equal(result.status, 2);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, false);
        assert.equal(report.mode, 'check');
        assert.ok(report.status.mismatchesBefore.length > 0);

        // Verify file was NOT created
        const tsconfigPath = path.join(
          tempDir,
          PACKAGE_SUBDIR,
          'tsconfig.json',
        );
        assert.equal(fs.existsSync(tsconfigPath), false);
      },
    );
  });

  it('passes check mode when tsconfig.json already exists', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-check-exists-',
      async (tempDir) => {
        const pkgDir = await createPackageDir(tempDir);
        await writeTextFile(
          path.join(pkgDir, 'tsconfig.json'),
          JSON.stringify(
            {
              extends: '../../tsconfig.json',
              compilerOptions: { target: 'ES2020' },
            },
            null,
            2,
          ) + '\n',
        );

        const result = runCli([
          'sync-typescript',
          '--cwd',
          tempDir,
          '--package-root',
          PACKAGE_SUBDIR,
          '--check',
        ]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.status.skipped, true);
        assert.deepEqual(report.status.mismatchesBefore, []);
      },
    );
  });

  it('reports planned changes in dry-run mode without writing', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-dryrun-',
      async (tempDir) => {
        await createPackageDir(tempDir);

        const result = runCli([
          'sync-typescript',
          '--cwd',
          tempDir,
          '--package-root',
          PACKAGE_SUBDIR,
          '--dry-run',
        ]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.status.updated, false);
        assert.ok(report.status.mismatchesBefore.length > 0);

        // Verify file was NOT created
        const tsconfigPath = path.join(
          tempDir,
          PACKAGE_SUBDIR,
          'tsconfig.json',
        );
        assert.equal(fs.existsSync(tsconfigPath), false);
      },
    );
  });

  it('outputs JSON report to file when --json is specified', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-json-',
      async (tempDir) => {
        await createPackageDir(tempDir);

        const result = runCli([
          'sync-typescript',
          '--cwd',
          tempDir,
          '--package-root',
          PACKAGE_SUBDIR,
          '--json',
          'logs/report.json',
        ]);
        assert.equal(result.status, 0);

        // Verify JSON file was created
        const jsonPath = path.join(tempDir, 'logs', 'report.json');
        assert.equal(fs.existsSync(jsonPath), true);
        const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        assert.equal(jsonReport.ok, true);
        assert.equal(jsonReport.status.updated, true);
      },
    );
  });

  it('fails with exit code 2 when --package-root is missing', () => {
    const result = runCli(['sync-typescript']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /--package-root is required/);
  });

  it('fails with exit code 2 when cwd does not exist', () => {
    const result = runCli([
      'sync-typescript',
      '--package-root',
      'packages/my-pkg',
      '--cwd',
      'd:\\nonexistent\\path',
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /does not exist/);
  });

  it('fails with exit code 2 when package-root does not exist', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-bad-pkg-',
      async (tempDir) => {
        const result = runCli([
          'sync-typescript',
          '--cwd',
          tempDir,
          '--package-root',
          'packages/nonexistent',
        ]);
        assert.equal(result.status, 2);
        assert.match(result.stderr, /does not exist/);
      },
    );
  });

  it('creates tsconfig.json with correct extends path for nested package', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-nested-',
      async (tempDir) => {
        const nestedPkg = 'packages/some/nested/package';
        const pkgDir = path.join(tempDir, nestedPkg);
        await writeTextFile(
          path.join(pkgDir, 'package.json'),
          '{"name":"nested"}',
        );

        const result = runCli([
          'sync-typescript',
          '--cwd',
          tempDir,
          '--package-root',
          nestedPkg,
        ]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.status.updated, true);

        const tsconfigPath = path.join(pkgDir, 'tsconfig.json');
        const content = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        assert.equal(content.extends, '../../../../tsconfig.json');
      },
    );
  });

  it('check --dry-run uses check mode precedence', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-check-dryrun-',
      async (tempDir) => {
        await createPackageDir(tempDir);

        const result = runCli([
          'sync-typescript',
          '--cwd',
          tempDir,
          '--package-root',
          PACKAGE_SUBDIR,
          '--check',
          '--dry-run',
        ]);
        assert.equal(result.status, 2);

        const report = JSON.parse(result.stdout);
        assert.equal(report.mode, 'check');
        assert.equal(report.ok, false);

        // Verify file was NOT created (check takes precedence)
        const tsconfigPath = path.join(
          tempDir,
          PACKAGE_SUBDIR,
          'tsconfig.json',
        );
        assert.equal(fs.existsSync(tsconfigPath), false);
      },
    );
  });

  it('handles invalid JSON in existing tsconfig.json as missing', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-invalid-json-',
      async (tempDir) => {
        const pkgDir = await createPackageDir(tempDir);
        const tsconfigPath = path.join(pkgDir, 'tsconfig.json');

        // Create a file with invalid JSON content
        await writeTextFile(tsconfigPath, '{invalid json content}');

        const result = runCli([
          'sync-typescript',
          '--cwd',
          tempDir,
          '--package-root',
          PACKAGE_SUBDIR,
        ]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.status.fileExistsBefore, false);
        assert.equal(report.status.updated, true);

        // Verify file was replaced with valid template content
        const content = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        assert.equal(content.compilerOptions.lib[0], 'ESNext');
        assert.equal(content.compilerOptions.module, 'NodeNext');
      },
    );
  });

  it('computes extends path correctly when package-root is the cwd itself', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-same-dir-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"root-pkg"}',
        );

        const result = runCli([
          'sync-typescript',
          '--cwd',
          tempDir,
          '--package-root',
          '.',
        ]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.status.updated, true);

        const tsconfigPath = path.join(tempDir, 'tsconfig.json');
        const content = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        assert.equal(content.extends, './tsconfig.json');
      },
    );
  });

  it('computes extends path correctly when package-root is above cwd', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-above-cwd-',
      async (tempDir) => {
        // Create a subdirectory as the cwd, and point package-root above it
        const subDir = path.join(tempDir, 'deep/nested/cwd');
        await writeTextFile(
          path.join(subDir, 'package.json'),
          '{"name":"sub-cwd"}',
        );
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"root-pkg"}',
        );

        const result = runCli([
          'sync-typescript',
          '--cwd',
          subDir,
          '--package-root',
          '../..',
        ]);
        assert.equal(result.status, 0);

        const report = JSON.parse(result.stdout);
        assert.equal(report.ok, true);
        assert.equal(report.status.updated, true);

        // package is at tempDir/deep/nested, cwd is at tempDir/deep/nested/cwd
        // extends from package back to cwd: ./cwd/tsconfig.json
        const tsconfigPath = path.resolve(subDir, '../../tsconfig.json');
        const content = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
        assert.equal(content.extends, './nested/cwd/tsconfig.json');
      },
    );
  });

  it('outputs JSON report when file exists and --json is specified', async () => {
    await withTempDir(
      'agent-toolkit-sync-typescript-json-skip-',
      async (tempDir) => {
        const pkgDir = await createPackageDir(tempDir);
        // Create the file first
        await writeTextFile(
          path.join(pkgDir, 'tsconfig.json'),
          '{"extends":"../../tsconfig.json","compilerOptions":{"target":"ES2020"}}\n',
        );

        const result = runCli([
          'sync-typescript',
          '--cwd',
          tempDir,
          '--package-root',
          PACKAGE_SUBDIR,
          '--json',
          'logs/report.json',
        ]);
        assert.equal(result.status, 0);

        // Verify JSON report was written
        const jsonPath = path.join(tempDir, 'logs', 'report.json');
        assert.equal(fs.existsSync(jsonPath), true);
        const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        assert.equal(jsonReport.ok, true);
        assert.equal(jsonReport.status.skipped, true);
        assert.equal(jsonReport.status.updated, false);
      },
    );
  });
});
