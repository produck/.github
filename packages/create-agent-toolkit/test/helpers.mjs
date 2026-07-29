import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(fileURLToPath(import.meta.url));
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the create-agent-toolkit package root. */
export const PACKAGE_ROOT = path.resolve(TEST_DIR, '..');

/** Absolute path to the CLI entry point. */
export const BIN_PATH = path.resolve(
  PACKAGE_ROOT,
  'bin/create-agent-toolkit.mjs',
);

const agentToolkitRoot = path.dirname(
  require.resolve('@produck/agent-toolkit/package.json'),
);
const agentToolkitPkg = JSON.parse(
  await fs.readFile(path.join(agentToolkitRoot, 'package.json'), 'utf8'),
);

/** Resolved version of @produck/agent-toolkit for env override. */
export const TOOLKIT_VERSION = agentToolkitPkg.version;

/** Pattern matching glob tokens forbidden in workspaces. */
export const GLOB_TOKENS = /[*?{}[\]]/;

/**
 * Build a base environment object with toolkit version override.
 * @param {Record<string,string>} extra - Additional env vars to merge
 * @returns {Record<string,string>}
 */
export function toolkitEnv(extra = {}) {
  return {
    ...process.env,
    PRODUCK_TOOLKIT_VERSION_OVERRIDE: TOOLKIT_VERSION,
    ...extra,
  };
}
