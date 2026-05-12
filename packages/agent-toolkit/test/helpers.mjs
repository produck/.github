import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

export const PACKAGE_ROOT = path.resolve(TEST_DIR, '..');
export const TOOLKIT_BIN = path.resolve(PACKAGE_ROOT, 'bin/agent-toolkit.mjs');

const TOOLKIT_PACKAGE_JSON = path.resolve(PACKAGE_ROOT, 'package.json');
const TOOLKIT_PACKAGE = JSON.parse(fs.readFileSync(TOOLKIT_PACKAGE_JSON, 'utf8'));
const TEST_TOOLKIT_VERSION_OVERRIDE = String(TOOLKIT_PACKAGE.version || '').trim();

export function runCli(args, options = {}) {
  const cwd = options.cwd || PACKAGE_ROOT;
  const env = {
    ...process.env,
    ...(options.env || {}),
  };

  if (TEST_TOOLKIT_VERSION_OVERRIDE && !env.PRODUCK_TOOLKIT_VERSION_OVERRIDE) {
    env.PRODUCK_TOOLKIT_VERSION_OVERRIDE = TEST_TOOLKIT_VERSION_OVERRIDE;
  }

  return spawnSync(process.execPath, [TOOLKIT_BIN, ...args], {
    cwd,
    env,
    encoding: 'utf8',
  });
}

export async function withTempDir(prefix, runner) {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), prefix));

  try {
    await runner(tempDir);
  } finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  }
}

export async function writeTextFile(filePath, content) {
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.writeFile(filePath, content, 'utf8');
}

export async function readJson(filePath) {
  const raw = await fsPromises.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}
