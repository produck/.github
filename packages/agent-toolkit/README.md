# @produck/agent-toolkit

Central CLI toolkit for organization-level AI execution workflows.

## First-time bootstrap (downstream repositories)

For a new or existing downstream repository that has not yet applied the
organization baseline, run:

```
npm create @produck/agent-toolkit@latest
```

This command installs `@produck/create-agent-toolkit` and runs
`enforce-node-baseline` in the current directory. No prior installation is
required — npm handles the download automatically.

What it does (in order):

1. Syncs organization AI instruction files into `.github/instructions/produck/`
2. Runs preflight to verify required files and directories
3. Syncs root `produck:format` script and initializes `.prettierrc`
4. Syncs root `produck:lint` script, initializes/patches `eslint.config.mjs`,
   and ensures `@produck/eslint-rules`
5. Syncs root shared governance (`produck:baseline`,
   `produck:coverage`, `produck:precommit-check`), initializes `.c8rc.json`,
   and syncs shared pinned devDependencies
   (`c8`, `husky`, `lerna`, `@produck/agent-toolkit`)
6. Deploys the pinned `produck:coverage` script and `c8` devDependency to each workspace package, and enforces `scripts.test` (generates a default `test` script when missing).
   **Note:** The `produck:coverage` script in subpackages is for local and AI development use only. It is NOT enforced by organization CI or `.c8rc.json`. Only the root workspace (monorepo root) is subject to org-level coverage enforcement and `.c8rc.json`.
7. Deploys `.husky/pre-commit` and `.husky/commit-msg`

After running, add the persistent enforcement entry to the repository
`package.json`:

```json
"produck:baseline": "npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd ."
```

Then future enforcement runs via:

```
npm run produck:baseline
```

## Commands

- agent-toolkit enforce-node-baseline
- agent-toolkit preflight
- agent-toolkit run-capture
- agent-toolkit summarize-log
- agent-toolkit sync-coverage-script
- agent-toolkit sync-prettier-config
- agent-toolkit sync-eslint-config
- agent-toolkit sync-workspace-config
- agent-toolkit sync-husky-hooks
- agent-toolkit validate-commit-msg
- agent-toolkit sync-instructions

## Examples

Run default mandatory baseline flow in downstream repository root:

```
npm exec -- agent-toolkit
```

Equivalent explicit form:

```
npm exec -- agent-toolkit enforce-node-baseline --cwd .
```

`enforce-node-baseline` runs seven steps in fixed order and stops at the first
failure:

1. `sync-instructions` — distribute organization AI instruction files into
   `.github/instructions/produck/`
2. `preflight` — verify required files and directories exist
3. `sync-prettier-config` — deploy organization format gate script
   (`produck:format`) and initialize `.prettierrc`
4. `sync-eslint-config` — deploy organization lint gate script
   (`produck:lint`), initialize/patch `eslint.config.mjs`, and ensure
   `@produck/eslint-rules` integration
5. `sync-workspace-config` — deploy shared root governance scripts
   (`produck:baseline`, `produck:coverage`, `produck:precommit-check`),
   initialize root `.c8rc.json`, and sync shared pinned root devDependencies
   (`c8`, `husky`, `lerna`, `@produck/agent-toolkit`)
6. `sync-coverage-script` — deploy pinned `produck:coverage` script and `c8`
   devDependency into each workspace package, and ensure each workspace
   package has `scripts.test` (auto-generate a default value when missing)
7. `sync-husky-hooks` — deploy `.husky/pre-commit` and `.husky/commit-msg`

Add to downstream repository root `package.json` for one-command enforcement:

```json
"produck:baseline": "npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd ."
```

Then run:

```
npm run produck:baseline
```

Dry-run to preview changes without writing files:

```
npm exec -- agent-toolkit enforce-node-baseline --cwd . --dry-run
```

Check-only mode to validate without writing:

```
npm exec -- agent-toolkit enforce-node-baseline --cwd . --check
```

Validate monorepo root `package.json` scripts and workspace structure:

```
npm exec -- agent-toolkit preflight --cwd . --check-workspace-package-json package.json
```

Run preflight with required-file and directory guards:

```
npm exec -- agent-toolkit preflight --cwd . --require package.json --ensure-dir logs
```

Capture long output safely:

```
npm exec -- agent-toolkit run-capture --cwd . --cmd "npm run test" --out logs/test.log
```

Summarize captured output:

```
npm exec -- agent-toolkit summarize-log --file logs/test.log --match "FAIL|ERROR"
```

Deploy organization coverage script and pinned local c8 devDependency to workspace packages:

```
npm exec -- agent-toolkit sync-coverage-script --cwd .
```

This command also enforces `scripts.test` in each workspace package.
If missing, it generates:

```
node -e "console.log('No tests configured')"
```

**Note:** The `produck:coverage` script in subpackages is for local and AI development use only. It is NOT enforced by organization CI or `.c8rc.json`. Only the root workspace (monorepo root) is subject to org-level coverage enforcement and `.c8rc.json`.

Deploy organization format config and script baseline to repository root:

```
npm exec -- agent-toolkit sync-prettier-config --cwd .
```

This command manages `scripts.produck:format` and `.prettierrc` only.

Deploy organization lint config and script baseline to repository root:

```
npm exec -- agent-toolkit sync-eslint-config --cwd .
```

This command manages `scripts.produck:lint`, `eslint.config.mjs`, and
`devDependencies.@produck/eslint-rules`. If `eslint.config.mjs` exists without
`@produck/eslint-rules`, it appends Produck integration to the exported config
array.

Deploy organization root shared scripts and shared pinned dependencies to
repository root:

```
npm exec -- agent-toolkit sync-workspace-config --cwd .
```

This command manages `scripts.produck:baseline`,
`scripts.produck:coverage`, `scripts.produck:precommit-check`, initializes
`.c8rc.json`, and pins `c8`, `husky`, `lerna`, and `@produck/agent-toolkit`
in root `devDependencies`.

Deploy organization local anti-drift husky hooks to repository root:

```
npm exec -- agent-toolkit sync-husky-hooks --cwd .
```

This command syncs only `.husky/pre-commit` and `.husky/commit-msg`.

Validate commit message format:

```
npm exec -- agent-toolkit validate-commit-msg --file .git/COMMIT_EDITMSG
```

Manual per-repository instruction distribution (write .github/instructions/produck/\*.instructions.md):

```
npm exec -- agent-toolkit sync-instructions --cwd .
```

Legacy repository bootstrap behavior:

- If `.github/copilot-instructions.md` is missing, sync-instructions initializes it.
- The initialized file guides repository owners to keep organization baseline in
  `.github/instructions/produck/*.instructions.md` and put local-only rules in
  `.github/copilot-instructions.md`.

Use organization source directory instead of built-in assets:

```
npm exec -- agent-toolkit sync-instructions --cwd . --source path/to/org/.github/distribution/produck --force --prune
```

Built-in command-local resource locations (for review and updates):

- `bin/command/*/help.txt`
- `bin/command/sync-instructions/user-space-bootstrap.md`

Publish-time generated instruction assets:

- `publish-assets/instructions/produck/*.instructions.md`
- Generated from `.github/distribution/produck/*.instructions.md` via
  `prepack`
- Included in npm package, ignored in git working tree

Downstream source maintenance in policy repository:

- Maintain source files directly under `.github/distribution/produck/*.instructions.md`

Organization-only instruction source (not published):

- `.github/instructions/produck/*.instructions.md`

## Local verification

`verify` is an optional package-level health check and is not a commit gate.
Use repository style gates first, then run package checks when needed.

From repository root:

```bash
npm run format:check
npm run lint
npm --workspace @produck/agent-toolkit run test
npm --workspace @produck/agent-toolkit run pack:check
# optional health check
npm --workspace @produck/agent-toolkit run verify
```

## Publishing

Publishing is centralized at workspace root via lerna, not via
package-level release scripts.

From monorepo root (`produck/.github`):

```bash
npm run format:check
npm run test
npm run publish:dry-run
npm run publish
```

Notes:

- `publish:dry-run` validates package contents by running `npm pack --dry-run`
  across non-private workspace packages.
- `publish` runs lerna publish flow from workspace root.

## GitHub workflow

Repository includes manual workflow:

- .github/workflows/publish-agent-toolkit.yml

Workflow behavior:

- Runs test and pack:check for `@produck/agent-toolkit`.
- Does not publish to npm.
- Used as release gate before workspace-level publish.

Release policy:

- Central package is installed locally in downstream repositories at a fixed
  version managed by `agent-toolkit sync-husky-hooks`.
- Run format:check and test first, then workspace `publish:dry-run` before
  `publish`.
- Keep rollback option by republishing previous stable version if needed.

Rollback quick steps:

1. Check latest published version:
   `npm view @produck/agent-toolkit version`
2. Fix source and rerun workspace publish flow with a new version.
3. Push commit and tags.
