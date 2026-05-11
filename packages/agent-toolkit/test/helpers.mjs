import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

export const PACKAGE_ROOT = path.resolve(TEST_DIR, '..');
export const TOOLKIT_BIN = path.resolve(PACKAGE_ROOT, 'bin/agent-toolkit.mjs');

export function runCli(args, options = {}) {
  const cwd = options.cwd || PACKAGE_ROOT;
  const env = options.env || process.env;

  return spawnSync(process.execPath, [TOOLKIT_BIN, ...args], {
    cwd,
    env,
    encoding: 'utf8',
  });
}

export async function withTempDir(prefix, runner) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));

  try {
    await runner(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function writeTextFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}
