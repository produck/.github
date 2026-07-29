import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(fileURLToPath(import.meta.url));
const agentToolkitRoot = path.dirname(
  require.resolve('@produck/agent-toolkit/package.json'),
);

/** Path to the agent-toolkit CLI entry point. */
export const toolkitBin = path.join(
  agentToolkitRoot,
  'bin',
  'agent-toolkit.mjs',
);

/**
 * Create minimal repo structure and run enforce-node-baseline + npm install.
 *
 * Creates:
 * - Root package.json with explicit workspace enumeration (no globs)
 * - Workspace directory with minimal package.json
 * Then delegates to enforce-node-baseline for all configuration scaffolding.
 *
 * @param {string} cwd - Target repository root directory
 * @param {string} repoName - Repository name (used as @produck/<repoName>)
 * @param {string} moduleName - First workspace module name
 */
export function bootstrapRepo(cwd, repoName, moduleName) {
  const workspaceRelPath = `packages/${moduleName}`;

  // Create workspace directory and minimal package.json
  const workspaceDir = path.join(cwd, workspaceRelPath);
  fs.mkdirSync(workspaceDir, { recursive: true });

  const workspacePkg = {
    name: `@produck/${moduleName}`,
    version: '0.0.0',
  };
  fs.writeFileSync(
    path.join(workspaceDir, 'package.json'),
    `${JSON.stringify(workspacePkg, null, 2)}\n`,
    'utf8',
  );

  // Create root package.json with explicit workspace enumeration (no globs)
  const rootPkg = {
    name: `@produck/${repoName}`,
    private: true,
    workspaces: [workspaceRelPath],
  };
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    `${JSON.stringify(rootPkg, null, 2)}\n`,
    'utf8',
  );

  process.stdout.write(
    `\n\u2713 Created root package.json (workspaces: ${workspaceRelPath})\n`,
  );
  process.stdout.write(
    `\u2713 Created workspace ${workspaceRelPath}/package.json\n\n`,
  );

  // Run enforce-node-baseline to populate all configuration
  process.stdout.write('\u2192 Running enforce-node-baseline...\n\n');

  const baselineResult = spawnSync(
    process.execPath,
    [toolkitBin, 'enforce-node-baseline', '--cwd', '.'],
    { stdio: 'inherit', cwd },
  );

  /* c8 ignore start */
  if (baselineResult.status !== 0) {
    process.stderr.write(
      `\n\u26A0 enforce-node-baseline exited with code ${baselineResult.status ?? 1}.\n`,
    );
    process.stderr.write(
      'Minimal package.json has been created. Fix issues and re-run:\n',
    );
    process.stderr.write('  npx @produck/create-agent-toolkit\n');
    process.exit(baselineResult.status ?? 1);
  }
  /* c8 ignore stop */

  // Install dependencies written by enforce-node-baseline
  if (process.env.PRODUCK_SKIP_INSTALL) {
    process.stdout.write(
      '\n\u2139 Skipping npm install (PRODUCK_SKIP_INSTALL is set).\n',
    );
    process.stdout.write('Run manually: npm install\n');
    process.stdout.write('\n\u2713 Repository initialized successfully!\n');
    return;
  } /* c8 ignore start */

  process.stdout.write('\n\u2192 Running npm install...\n\n');

  const installResult = spawnSync('npm', ['install'], {
    stdio: 'inherit',
    cwd,
  });

  if (installResult.status !== 0) {
    process.stderr.write(
      `\n\u26A0 npm install exited with code ${installResult.status ?? 1}.\n`,
    );
    process.stderr.write('Run manually: npm install\n');
    process.exit(installResult.status ?? 1);
  }

  process.stdout.write('\n\u2713 Repository initialized successfully!\n');
  /* c8 ignore stop */
}
