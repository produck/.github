#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(fileURLToPath(import.meta.url));
const agentToolkitRoot = path.dirname(
  require.resolve('@produck/agent-toolkit/package.json'),
);
const toolkitBin = path.join(agentToolkitRoot, 'bin', 'agent-toolkit.mjs');

const result = spawnSync(
  process.execPath,
  [toolkitBin, 'enforce-node-baseline', '--cwd', '.'],
  {
    stdio: 'inherit',
    cwd: process.cwd(),
  },
);

process.exit(result.status ?? 0);
