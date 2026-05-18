import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

const REQUIRED_LINT_SCRIPT = 'eslint --fix . --max-warnings=0';

describe('sync-lint command', () => {
  it('prints help text', () => {
    const result = runCli(['sync-lint', '--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /eslint\.config\.mjs/);
    assert.match(result.stdout, /@produck\/eslint-rules/);
  });

  it('applies required lint script, eslint config, and eslint-rules dependency', async () => {
    await withTempDir('agent-toolkit-sync-lint-sync-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-lint', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.equal(pkg.scripts['produck:lint'], REQUIRED_LINT_SCRIPT);
      assert.match(pkg.devDependencies['@produck/eslint-rules'], /^\d+\.\d+\.\d+$/);

      const eslintConfig = fs.readFileSync(path.join(tempDir, 'eslint.config.mjs'), 'utf8');
      assert.match(eslintConfig, /@produck\/eslint-rules/);
      assert.match(eslintConfig, /ProduckRule\.config/);
    });
  });

  it('appends Produck integration when eslint.config.mjs exists without it', async () => {
    await withTempDir('agent-toolkit-sync-lint-append-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');
      await writeTextFile(
        path.join(tempDir, 'eslint.config.mjs'),
        [
          'import globals from "globals";',
          'import pluginJs from "@eslint/js";',
          '',
          'export default [',
          '  pluginJs.configs.recommended,',
          '  { languageOptions: { globals: { ...globals.node } } },',
          '];',
          '',
        ].join('\n'),
      );

      const result = runCli(['sync-lint', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const eslintConfig = fs.readFileSync(path.join(tempDir, 'eslint.config.mjs'), 'utf8');
      assert.match(eslintConfig, /@produck\/eslint-rules/);
      assert.match(eslintConfig, /ProduckRule\.excludeGitIgnore\(import\.meta\.url\)/);

      const report = JSON.parse(result.stdout);
      assert.equal(report.required.eslintConfigAction, 'patched');
    });
  });

  it('supports --check mode without mutating files', async () => {
    await withTempDir('agent-toolkit-sync-lint-check-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-lint', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.status.updated, false);
      assert.equal(fs.existsSync(path.join(tempDir, 'eslint.config.mjs')), false);
    });
  });

  it('supports --dry-run without writing package changes', async () => {
    await withTempDir('agent-toolkit-sync-lint-dryrun-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-lint', '--cwd', tempDir, '--dry-run']);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, false);
      assert.equal(fs.existsSync(path.join(tempDir, 'eslint.config.mjs')), false);
    });
  });

  it('outputs JSON report to file when --json is specified', async () => {
    await withTempDir('agent-toolkit-sync-lint-json-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-lint', '--cwd', tempDir, '--json', 'logs/eslint-report.json']);
      assert.equal(result.status, 0);

      const jsonPath = path.join(tempDir, 'logs', 'eslint-report.json');
      assert.equal(fs.existsSync(jsonPath), true);
      const jsonReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      assert.equal(jsonReport.ok, true);
    });
  });

  it('fails with exit code 2 when cwd does not exist', () => {
    const result = runCli(['sync-lint', '--cwd', 'd:\\nonexistent\\path']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /does not exist/);
  });

  it('reports no-op when eslint config already contains Produck integration', async () => {
    await withTempDir('agent-toolkit-sync-lint-noop-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');
      await writeTextFile(
        path.join(tempDir, 'eslint.config.mjs'),
        'import ProduckRule from "@produck/eslint-rules";\n\nexport default [ProduckRule.config];\n',
      );

      const result = runCli(['sync-lint', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const report = JSON.parse(result.stdout);
      assert.equal(report.required.eslintConfigAction, 'unchanged');
    });
  });

  it('fails when root package.json does not exist', async () => {
    await withTempDir('agent-toolkit-sync-lint-missing-pkg-', async (tempDir) => {
      const result = runCli(['sync-lint', '--cwd', tempDir]);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /Root package\.json does not exist/);
    });
  });

  it('fails when root package.json is invalid JSON', async () => {
    await withTempDir('agent-toolkit-sync-lint-invalid-pkg-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{ invalid json\n');

      const result = runCli(['sync-lint', '--cwd', tempDir]);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /Root package\.json is not valid JSON/);
    });
  });

  it('marks unpatchable eslint config and exits non-zero in sync mode', async () => {
    await withTempDir('agent-toolkit-sync-lint-unpatchable-sync-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');
      await writeTextFile(path.join(tempDir, 'eslint.config.mjs'), 'const x = 1;\n');

      const result = runCli(['sync-lint', '--cwd', tempDir]);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.required.eslintConfigAction, 'unpatchable');
      assert.equal(report.status.hasUnpatchableEslintConfig, true);
      assert.equal(report.status.updated, false);
    });
  });

  it('marks unpatchable eslint config and exits non-zero in check mode', async () => {
    await withTempDir('agent-toolkit-sync-lint-unpatchable-check-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');
      await writeTextFile(path.join(tempDir, 'eslint.config.mjs'), 'const x = 1;\n');

      const result = runCli(['sync-lint', '--cwd', tempDir, '--check']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.required.eslintConfigAction, 'unpatchable');
      assert.equal(report.status.hasUnpatchableEslintConfig, true);
      assert.equal(report.status.updated, false);
    });
  });

  it('marks unpatchable eslint config and exits non-zero in dry-run mode', async () => {
    await withTempDir('agent-toolkit-sync-lint-unpatchable-dry-run-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');
      await writeTextFile(path.join(tempDir, 'eslint.config.mjs'), 'const x = 1;\n');

      const result = runCli(['sync-lint', '--cwd', tempDir, '--dry-run']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.required.eslintConfigAction, 'unpatchable');
      assert.equal(report.status.hasUnpatchableEslintConfig, true);
      assert.equal(report.status.updated, false);
    });
  });

  it('uses check mode when both --check and --dry-run are provided', async () => {
    await withTempDir('agent-toolkit-sync-lint-check-dry-run-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-lint', '--cwd', tempDir, '--check', '--dry-run']);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.mode, 'check');
      assert.equal(report.ok, false);
      assert.equal(report.status.updated, false);
    });
  });

  it('resolves @produck/eslint-rules version without consulting the npm registry', async () => {
    await withTempDir('agent-toolkit-sync-lint-offline-version-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const result = runCli(['sync-lint', '--cwd', tempDir], {
        env: { PATH: '' },
      });
      assert.equal(result.status, 0);

      const pkg = await readJson(path.join(tempDir, 'package.json'));
      assert.match(pkg.devDependencies['@produck/eslint-rules'], /^\d+\.\d+\.\d+$/);
    });
  });

  it('is a no-op on second run after state is synchronized', async () => {
    await withTempDir('agent-toolkit-sync-lint-no-op-second-run-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const first = runCli(['sync-lint', '--cwd', tempDir]);
      assert.equal(first.status, 0);

      const beforePkg = fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8');
      const beforeConfig = fs.readFileSync(path.join(tempDir, 'eslint.config.mjs'), 'utf8');

      const second = runCli(['sync-lint', '--cwd', tempDir]);
      assert.equal(second.status, 0);

      const report = JSON.parse(second.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, false);

      const afterPkg = fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8');
      const afterConfig = fs.readFileSync(path.join(tempDir, 'eslint.config.mjs'), 'utf8');
      assert.equal(afterPkg, beforePkg);
      assert.equal(afterConfig, beforeConfig);
    });
  });

  it('marks config unpatchable when import exists but export default array is missing', async () => {
    await withTempDir('agent-toolkit-sync-lint-unpatchable-import-only-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');
      await writeTextFile(
        path.join(tempDir, 'eslint.config.mjs'),
        'import x from "y";\nconst z = 1;\n',
      );

      const result = runCli(['sync-lint', '--cwd', tempDir]);
      assert.equal(result.status, 2);

      const report = JSON.parse(result.stdout);
      assert.equal(report.required.eslintConfigAction, 'unpatchable');
      assert.equal(report.status.hasUnpatchableEslintConfig, true);
    });
  });

  it('passes in --check mode when project is already synchronized', async () => {
    await withTempDir('agent-toolkit-sync-lint-check-clean-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const first = runCli(['sync-lint', '--cwd', tempDir]);
      assert.equal(first.status, 0);

      const checkResult = runCli(['sync-lint', '--cwd', tempDir, '--check']);
      assert.equal(checkResult.status, 0);

      const report = JSON.parse(checkResult.stdout);
      assert.equal(report.mode, 'check');
      assert.equal(report.ok, true);
      assert.equal(report.status.updated, false);
      assert.equal(report.status.hasUnpatchableEslintConfig, false);
    });
  });

  it('patches config without trailing newline and writes final newline', async () => {
    await withTempDir('agent-toolkit-sync-lint-patch-newline-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');
      await writeTextFile(
        path.join(tempDir, 'eslint.config.mjs'),
        'import globals from "globals";\nexport default [\n  { languageOptions: { globals: { ...globals.node } } },\n];',
      );

      const result = runCli(['sync-lint', '--cwd', tempDir]);
      assert.equal(result.status, 0);

      const eslintConfig = fs.readFileSync(path.join(tempDir, 'eslint.config.mjs'), 'utf8');
      assert.equal(eslintConfig.endsWith('\n'), true);
      assert.match(eslintConfig, /@produck\/eslint-rules/);
    });
  });
});
