import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { readJson, runCli, writeTextFile, withTempDir } from './helpers.mjs';

describe('preflight command', () => {
  it('creates report and ensured directories', async () => {
    await withTempDir('agent-toolkit-preflight-', async (tempDir) => {
      await writeTextFile(path.join(tempDir, 'package.json'), '{"name":"tmp"}\n');

      const reportFile = path.join(tempDir, 'reports', 'preflight.json');
      const result = runCli([
        'preflight',
        '--cwd',
        tempDir,
        '--require',
        'package.json',
        '--ensure-dir',
        'logs',
        '--json',
        reportFile,
      ]);

      assert.equal(result.status, 0);
      const report = await readJson(reportFile);
      assert.equal(report.ok, true);

      const logsDir = path.join(tempDir, 'logs');
      const logsStat = await fs.stat(logsDir);
      assert.equal(logsStat.isDirectory(), true);
    });
  });

  it('fails when cwd does not exist', () => {
    const missingCwd = path.join(os.tmpdir(), 'agent-toolkit-no-such-cwd');
    const result = runCli(['preflight', '--cwd', missingCwd]);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /CWD does not exist/);
  });

  it('fails when required file is missing', async () => {
    await withTempDir('agent-toolkit-preflight-missing-', async (tempDir) => {
      const result = runCli(['preflight', '--cwd', tempDir, '--require', 'missing.txt']);

      assert.equal(result.status, 2);
      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, false);
      assert.equal(report.required[0].exists, false);
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

  it('supports match, last and max options', async () => {
    await withTempDir('agent-toolkit-summarize-', async (tempDir) => {
      const logFile = path.join(tempDir, 'run.log');
      await writeTextFile(
        logFile,
        [
          'INFO init',
          'ERROR first',
          'INFO retry',
          'ERROR second',
          'ERROR third',
          '',
        ].join('\n'),
      );

      const result = runCli([
        'summarize-log',
        '--file',
        logFile,
        '--match',
        'ERROR',
        '--last',
        '2',
        '--max',
        '10',
      ]);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /# mode: match\+last/);
      assert.match(result.stdout, /ERROR second/);
      assert.match(result.stdout, /ERROR third/);
    });
  });

  it('supports all mode without filters', async () => {
    await withTempDir('agent-toolkit-summarize-all-', async (tempDir) => {
      const logFile = path.join(tempDir, 'run.log');
      await writeTextFile(logFile, ['A', 'B', 'C', ''].join('\n'));

      const result = runCli(['summarize-log', '--file', logFile]);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /# mode: all/);
      assert.match(result.stdout, /A/);
      assert.match(result.stdout, /C/);
    });
  });

  it('applies max truncation when selected lines exceed limit', async () => {
    await withTempDir('agent-toolkit-summarize-max-', async (tempDir) => {
      const logFile = path.join(tempDir, 'run.log');
      await writeTextFile(logFile, ['L1', 'L2', 'L3', 'L4', ''].join('\n'));

      const result = runCli([
        'summarize-log',
        '--file',
        logFile,
        '--last',
        '4',
        '--max',
        '2',
      ]);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /# selectedLines: 2/);
      assert.match(result.stdout, /L2/);
      assert.match(result.stdout, /L3/);
    });
  });

  it('falls back to default max when --max is zero', async () => {
    await withTempDir('agent-toolkit-summarize-max-fallback-', async (tempDir) => {
      const logFile = path.join(tempDir, 'run.log');
      await writeTextFile(logFile, ['F1', 'F2', 'F3', 'F4', ''].join('\n'));

      const result = runCli([
        'summarize-log',
        '--file',
        logFile,
        '--last',
        '3',
        '--max',
        '0',
      ]);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /# mode: last/);
      assert.match(result.stdout, /# selectedLines: 3/);
      assert.match(result.stdout, /F3/);
      assert.match(result.stdout, /F4/);
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
    await withTempDir('agent-toolkit-run-capture-pipe-', async (tempDir) => {
      const outFile = path.join(tempDir, 'run.log');
      const cmd = 'node left.mjs | node right.mjs';
      const result = runCli(['run-capture', '--out', outFile, '--cmd', cmd]);

      assert.equal(result.status, 2);
      assert.match(result.stderr, /Blocked command containing pipe/);
    });
  });

  it('captures output and writes default meta file', async () => {
    await withTempDir('agent-toolkit-run-capture-ok-', async (tempDir) => {
      const outFile = path.join(tempDir, 'capture.log');
      const metaFile = `${outFile}.meta.json`;
      const emitScript = path.join(tempDir, 'emit.mjs');
      await writeTextFile(emitScript, "process.stdout.write('HELLO_CAPTURE');\n");
      const cmd = `node ${path.basename(emitScript)}`;
      const result = runCli(['run-capture', '--out', outFile, '--cmd', cmd, '--cwd', tempDir]);

      assert.equal(result.status, 0);

      const outText = await fs.readFile(outFile, 'utf8');
      assert.match(outText, /HELLO_CAPTURE/);

      const meta = await readJson(metaFile);
      assert.equal(meta.exitCode, 0);
      assert.equal(meta.outputFile, outFile);
    });
  });

  it('respects explicit meta path and propagates child exit code', async () => {
    await withTempDir('agent-toolkit-run-capture-exit-', async (tempDir) => {
      const outFile = path.join(tempDir, 'capture.log');
      const metaFile = path.join(tempDir, 'meta', 'capture.meta.json');
      const exitScript = path.join(tempDir, 'exit-3.mjs');
      await writeTextFile(exitScript, 'process.exit(3);\n');
      const cmd = `node ${path.basename(exitScript)}`;
      const result = runCli([
        'run-capture',
        '--out',
        outFile,
        '--meta',
        metaFile,
        '--cmd',
        cmd,
        '--cwd',
        tempDir,
      ]);

      assert.equal(result.status, 3);

      const meta = await readJson(metaFile);
      assert.equal(meta.exitCode, 3);
      assert.equal(meta.outputFile, outFile);
    });
  });

  it('allows pipe command when --allow-pipe is set', async () => {
    await withTempDir('agent-toolkit-run-capture-allow-pipe-', async (tempDir) => {
      const outFile = path.join(tempDir, 'pipe.log');
      const leftScript = path.join(tempDir, 'left.mjs');
      const rightScript = path.join(tempDir, 'right.mjs');
      await writeTextFile(leftScript, "process.stdout.write('LEFT');\n");
      await writeTextFile(rightScript, "process.stdout.write('RIGHT');\n");
      const cmd = `node ${path.basename(leftScript)} | node ${path.basename(rightScript)}`;
      const result = runCli([
        'run-capture',
        '--out',
        outFile,
        '--cmd',
        cmd,
        '--allow-pipe',
        '--cwd',
        tempDir,
      ]);

      assert.equal(result.status, 0);

      const outText = await fs.readFile(outFile, 'utf8');
      assert.match(outText, /RIGHT/);
    });
  });

  it('captures stderr stream from child command', async () => {
    await withTempDir('agent-toolkit-run-capture-stderr-', async (tempDir) => {
      const outFile = path.join(tempDir, 'stderr.log');
      const stderrScript = path.join(tempDir, 'stderr.mjs');

      await writeTextFile(
        stderrScript,
        "process.stderr.write('STDERR_LINE'); process.stdout.write('STDOUT_LINE');\n",
      );

      const cmd = `node ${path.basename(stderrScript)}`;
      const result = runCli([
        'run-capture',
        '--out',
        outFile,
        '--cmd',
        cmd,
        '--cwd',
        tempDir,
      ]);

      assert.equal(result.status, 0);

      const outText = await fs.readFile(outFile, 'utf8');
      assert.match(outText, /STDERR_LINE/);
      assert.match(outText, /STDOUT_LINE/);
    });
  });

  it('falls back to exit code 1 when shell cannot be spawned', async () => {
    await withTempDir('agent-toolkit-run-capture-shell-error-', async (tempDir) => {
      const outFile = path.join(tempDir, 'spawn-error.log');
      const badShell = path.join(tempDir, 'missing-shell.exe');
      const result = runCli(
        ['run-capture', '--out', outFile, '--cmd', 'echo HELLO_FROM_BAD_SHELL'],
        {
          env: {
            ...process.env,
            COMSPEC: badShell,
            ComSpec: badShell,
          },
        },
      );

      assert.notEqual(result.status, 0);

      const outText = await fs.readFile(outFile, 'utf8');
      assert.match(outText, /spawn error/i);
    });
  });
});
