import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

describe('preflight command', () => {
  it('creates report and ensured directories', async () => {
    await withTempDir('agent-toolkit-preflight-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'required.txt'), 'ok\n');

      const reportFile = path.join(tempDir, 'reports', 'preflight.json');
      const result = runCli([
        'preflight',
        '--cwd',
        tempDir,
        '--require',
        'required.txt',
        '--ensure-dir',
        'logs',
        '--json',
        reportFile,
      ]);

      assert.equal(result.status, 0);
      const report = await readJson(reportFile);
      assert.equal(report.ok, true);
      assert.equal(report.required[0].exists, true);
      assert.equal(report.ensuredDirs[0].existsAfter, true);
    });
  });

  it('fails when cwd does not exist', () => {
    const missingCwd = path.join(os.tmpdir(), 'agent-toolkit-preflight-missing-cwd');
    const result = runCli(['preflight', '--cwd', missingCwd]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('validates workspace package.json baseline when workspaces are explicit', async () => {
    await withTempDir('agent-toolkit-preflight-workspace-ok-', async (tempDir) => {
      const packageJson = {
        name: 'tmp-workspace',
        private: true,
        workspaces: ['packages/agent-toolkit', 'packages/eslint-rules'],
        scripts: {
          'deps:install': 'npm install',
          test: 'npm run test --workspaces --if-present',
          'produck:coverage': 'npm run coverage --workspaces --if-present',
          lint: 'eslint --fix . --max-warnings=0',
        },
      };
      await writeTextFile(
        path.join(tempDir, 'package.json'),
        `${JSON.stringify(packageJson, null, 2)}\n`,
      );

      const result = runCli([
        'preflight',
        '--cwd',
        tempDir,
        '--check-workspace-package-json',
        'package.json',
      ]);

      assert.equal(result.status, 0);
      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.deepEqual(report.workspacePackageJson.missingScripts, []);
      assert.deepEqual(report.workspacePackageJson.wildcardWorkspaces, []);
    });
  });
});

describe('summarize-log command', () => {
  it('prints help when --file is missing', () => {
    const result = runCli(['summarize-log']);

    assert.equal(result.status, 2);
    assert.match(result.stdout, /Usage:/);
  });

  it('fails when log file does not exist', () => {
    const missingFile = path.join(os.tmpdir(), 'agent-toolkit-no-such-log.log');
    const result = runCli(['summarize-log', '--file', missingFile]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Log file does not exist/);
  });

  it('supports match and last filters', async () => {
    await withTempDir('agent-toolkit-summarize-', async (tempDir) => {
      const logFile = path.join(tempDir, 'run.log');
      await writeTextFile(logFile, ['line1', 'ERROR one', 'line3', 'ERROR two'].join('\n'));

      const result = runCli([
        'summarize-log',
        '--file',
        logFile,
        '--match',
        'ERROR',
        '--last',
        '1',
      ]);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /# selectedLines: 1/);
      assert.match(result.stdout, /ERROR two/);
    });
  });

  it('supports all mode without filters', async () => {
    await withTempDir('agent-toolkit-summarize-all-', async (tempDir) => {
      const logFile = path.join(tempDir, 'all.log');
      await writeTextFile(logFile, ['a', 'b', 'c'].join('\n'));

      const result = runCli(['summarize-log', '--file', logFile]);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /# selectedLines: 3/);
      assert.match(result.stdout, /a\nb\nc/);
    });
  });
});

describe('run-capture command', () => {
  it('prints help when required args are missing', () => {
    const result = runCli(['run-capture']);

    assert.equal(result.status, 2);
    assert.match(result.stdout, /Usage:/);
  });

  it('blocks pipe command unless --allow-pipe is set', async () => {
    await withTempDir('agent-toolkit-capture-no-pipe-', async (tempDir) => {
      const outFile = path.join(tempDir, 'capture.log');
      const result = runCli([
        'run-capture',
        '--cwd',
        tempDir,
        '--cmd',
        'echo hi | sort',
        '--out',
        outFile,
      ]);

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Blocked command containing pipe/);
    });
  });

  it('captures output and writes default meta file', async () => {
    await withTempDir('agent-toolkit-capture-default-meta-', async (tempDir) => {
      const outFile = path.join(tempDir, 'capture.log');
      const result = runCli([
        'run-capture',
        '--cwd',
        tempDir,
        '--cmd',
        'node -e "console.log(\'ok\')"',
        '--out',
        outFile,
      ]);

      assert.equal(result.status, 0);
      assert.equal(fs.existsSync(outFile), true);
      assert.equal(fs.existsSync(`${outFile}.meta.json`), true);

      const output = fs.readFileSync(outFile, 'utf8');
      assert.match(output, /ok/);
    });
  });

  it('respects explicit meta path and propagates child exit code', async () => {
    await withTempDir('agent-toolkit-capture-meta-', async (tempDir) => {
      const outFile = path.join(tempDir, 'capture.log');
      const metaFile = path.join(tempDir, 'capture.meta.json');
      const result = runCli([
        'run-capture',
        '--cwd',
        tempDir,
        '--cmd',
        'node -e "process.exit(3)"',
        '--out',
        outFile,
        '--meta',
        metaFile,
      ]);

      assert.equal(result.status, 3);
      assert.equal(fs.existsSync(metaFile), true);

      const meta = await readJson(metaFile);
      assert.equal(meta.exitCode, 3);
    });
  });
});
