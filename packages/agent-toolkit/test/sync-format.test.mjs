import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');
const TOOLING_BASELINE_REPO_PATH = path.resolve(
  REPO_ROOT,
  '.github/distribution/produck/tooling-version-baseline.json',
);
const TOOLING_BASELINE_ASSET_PATH = path.resolve(
  PACKAGE_ROOT,
  'publish-assets/instructions/produck/tooling-version-baseline.json',
);
const TOOLING_BASELINE_PATH = fs.existsSync(TOOLING_BASELINE_REPO_PATH)
  ? TOOLING_BASELINE_REPO_PATH
  : TOOLING_BASELINE_ASSET_PATH;
const TOOLING_BASELINE = JSON.parse(
  fs.readFileSync(TOOLING_BASELINE_PATH, 'utf8'),
);
const REQUIRED_PRETTIER_VERSION = TOOLING_BASELINE.tools.prettier.version;
const PRETTIERRC_REPO_PATH = path.resolve(REPO_ROOT, '.prettierrc');
const PRETTIERRC_ASSET_PATH = path.resolve(
  PACKAGE_ROOT,
  'publish-assets/prettierrc',
);
const PRETTIERRC_SOURCE_PATH = fs.existsSync(PRETTIERRC_REPO_PATH)
  ? PRETTIERRC_REPO_PATH
  : PRETTIERRC_ASSET_PATH;
const PRETTIERIGNORE_REPO_PATH = path.resolve(REPO_ROOT, '.prettierignore');
const PRETTIERIGNORE_ASSET_PATH = path.resolve(
  PACKAGE_ROOT,
  'publish-assets/prettierignore',
);
const PRETTIERIGNORE_SOURCE_PATH = fs.existsSync(PRETTIERIGNORE_REPO_PATH)
  ? PRETTIERIGNORE_REPO_PATH
  : PRETTIERIGNORE_ASSET_PATH;
const REQUIRED_FORMAT_SCRIPT =
  'prettier --write . --ignore-path .prettierignore --ignore-path .gitignore';
const REQUIRED_PRETTIER_IGNORE = fs.readFileSync(
  PRETTIERIGNORE_SOURCE_PATH,
  'utf8',
);
const REQUIRED_PRETTIER_CONFIG = `${JSON.stringify(
  JSON.parse(fs.readFileSync(PRETTIERRC_SOURCE_PATH, 'utf8')),
  null,
  2,
)}\n`;

describe('sync-format command', () => {
  it('prints help text', () => {
    const result = runCli(['sync-format', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /\.prettierrc/);
  });

  it('applies required format script and .prettierrc', async () => {
    await withTempDir('agent-toolkit-sync-format-sync-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        '{"name":"tmp"}\n',
      );

      const result = runCli(['sync-format', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts['produck:format'], REQUIRED_FORMAT_SCRIPT);
      assert.equal(pkg.devDependencies['prettier'], REQUIRED_PRETTIER_VERSION);

      const prettierConfig = fs.readFileSync(
        path.join(tempDir, '.prettierrc'),
        'utf8',
      );
      assert.equal(prettierConfig, REQUIRED_PRETTIER_CONFIG);
      const prettierIgnore = fs.readFileSync(
        path.join(tempDir, '.prettierignore'),
        'utf8',
      );
      assert.equal(prettierIgnore, REQUIRED_PRETTIER_IGNORE);
    });
  });

  it('supports --check without mutating files', async () => {
    await withTempDir('agent-toolkit-sync-format-check-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        '{"name":"tmp"}\n',
      );

      const result = runCli(['sync-format', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.status.updated, false);
      assert.equal(fs.existsSync(path.join(tempDir, '.prettierrc')), false);
      assert.equal(fs.existsSync(path.join(tempDir, '.prettierignore')), false);
    });
  });

  it('fails when root package.json does not exist', async () => {
    await withTempDir(
      'agent-toolkit-sync-format-missing-pkg-',
      async (tempDir) => {
        const result = runCli(['sync-format', '--cwd', tempDir]);

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Root package\.json does not exist/);
      },
    );
  });

  it('fails when root package.json is invalid JSON', async () => {
    await withTempDir(
      'agent-toolkit-sync-format-invalid-pkg-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{ invalid json\n',
        );

        const result = runCli(['sync-format', '--cwd', tempDir]);

        assert.equal(result.status, 2);
        assert.match(result.stderr, /Root package\.json is not valid JSON/);
      },
    );
  });

  it('supports --dry-run without mutating files', async () => {
    await withTempDir('agent-toolkit-sync-format-dry-run-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        '{"name":"tmp"}\n',
      );

      const result = runCli(['sync-format', '--cwd', tempDir, '--dry-run']);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.mode, 'dry-run');
      assert.equal(report.status.updated, false);
      assert.equal(fs.existsSync(path.join(tempDir, '.prettierrc')), false);
      assert.equal(fs.existsSync(path.join(tempDir, '.prettierignore')), false);
    });
  });

  it('supports --json output report file', async () => {
    await withTempDir('agent-toolkit-sync-format-json-', async (tempDir) => {
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        '{"name":"tmp"}\n',
      );

      const result = runCli([
        'sync-format',
        '--cwd',
        tempDir,
        '--json',
        'logs/prettier-report.json',
      ]);
      assert.equal(result.status, 0);

      const report = await readJson(
        path.join(tempDir, 'logs', 'prettier-report.json'),
      );
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, true);
    });
  });

  it('supports --check and --dry-run together with check taking precedence', async () => {
    await withTempDir(
      'agent-toolkit-sync-format-check-dry-run-',
      async (tempDir) => {
        await writeTextFile(
          path.join(tempDir, 'package.json'),
          '{"name":"tmp"}\n',
        );

        const result = runCli([
          'sync-format',
          '--cwd',
          tempDir,
          '--check',
          '--dry-run',
        ]);
        assert.equal(result.status, 2);

        const report = JSON.parse(result.stdout);
        assert.equal(report.mode, 'check');
        assert.equal(report.ok, false);
        assert.equal(report.status.updated, false);
      },
    );
  });
});
