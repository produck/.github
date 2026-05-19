# @produck/agent-toolkit

Central CLI toolkit for organization-level AI execution workflows.

## First-time bootstrap (downstream repositories)

For a new or existing downstream repository that has not yet applied the
organization baseline, run:

```bash
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
5. Syncs root shared governance (`produck:baseline`, `produck:coverage`, `produck:commit:check`) and syncs shared pinned devDependencies (`husky`, `lerna`, `@produck/agent-toolkit`)
6. Deploys root `.c8rc.json` and root `c8` devDependency
   **Note:** The `produck:coverage` script in subpackages is for local and AI development use only. It is NOT enforced by organization CI or `.c8rc.json`. Only the root workspace (monorepo root) is subject to org-level coverage enforcement and `.c8rc.json`.
7. Deploys root `.gitattributes`
8. Deploys the pinned `produck:coverage` script and `c8` devDependency to each workspace package, and enforces `scripts.test` (generates a default `test` script when missing).
9. Deploys `.husky/pre-commit` and `.husky/commit-msg`

After running, add the persistent enforcement entry to the repository
`package.json`:

```json
"produck:baseline": "npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd ."
```

Then future enforcement runs via:

```bash
npm run produck:baseline
```

## Commands

- agent-toolkit enforce-node-baseline
- agent-toolkit preflight
- agent-toolkit run-capture
- agent-toolkit summarize-log
- agent-toolkit sync-coverage
- agent-toolkit sync-git
- agent-toolkit sync-format
- agent-toolkit sync-install
- agent-toolkit sync-lint
- agent-toolkit sync-publish
- agent-toolkit validate-commit-msg
- agent-toolkit sync-instructions

## Examples

Run default mandatory baseline flow in downstream repository root:

```bash
npm exec -- agent-toolkit
```

Equivalent explicit form:

```bash
npm exec -- agent-toolkit enforce-node-baseline --cwd .
```

`enforce-node-baseline` runs nine steps in fixed order and stops at the first
failure:

1. `preflight` — verify required files and directories exist
2. `sync-instructions` — distribute organization AI instruction files into
   `.github/instructions/produck/`
3. `sync-editorconfig` — deploy organization `.editorconfig`
4. `sync-format` — deploy organization format gate script
   (`produck:format`) and initialize `.prettierrc`
5. `sync-lint` — deploy organization lint gate script
   (`produck:lint`), initialize/patch `eslint.config.mjs`, and ensure
   `@produck/eslint-rules` integration
6. `sync-install` — deploy root `scripts.produck:install`
   (`npm -v && npm install`) and remove legacy `scripts.deps:install`
7. `sync-git` — deploy root `.gitattributes`, sync
   `.husky/pre-commit`/`.husky/commit-msg`, and enforce shared root scripts
   (`produck:baseline`, `produck:commit:check`) plus shared pinned root
   devDependencies (`husky`, `lerna`, `@produck/agent-toolkit`)
8. `sync-coverage` — deploy root `scripts.produck:coverage`, `.c8rc.json`, and
   root `c8` devDependency, then deploy pinned `produck:coverage` script and
   `c8` devDependency into each workspace package, and ensure each workspace
   package has `scripts.test` (auto-generate a default value when missing)
9. `sync-publish` — create default `lerna.json` when missing and deploy root
   `scripts.produck:publish:check` plus `scripts.produck:publish`

Add to downstream repository root `package.json` for one-command enforcement:

```json
"produck:baseline": "npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd ."
```

Then run:

```bash
npm run produck:baseline
```

Dry-run to preview changes without writing files:

```bash
npm exec -- agent-toolkit enforce-node-baseline --cwd . --dry-run
```

Check-only mode to validate without writing:

```bash
npm exec -- agent-toolkit enforce-node-baseline --cwd . --check
```

Validate monorepo root `package.json` scripts and workspace structure:

```bash
npm exec -- agent-toolkit preflight --cwd . --check-workspace-package-json package.json
```

Run preflight with required-file and directory guards:

```bash
npm exec -- agent-toolkit preflight --cwd . --require package.json --ensure-dir logs
```

Capture long output safely:

```bash
npm exec -- agent-toolkit run-capture --cwd . --cmd "npm run test" --out logs/test.log
```

Summarize captured output:

```bash
npm exec -- agent-toolkit summarize-log --file logs/test.log --match "FAIL|ERROR"
```

Deploy organization coverage script and pinned local c8 devDependency to workspace packages:

```bash
npm exec -- agent-toolkit sync-coverage --cwd .
```

This command also enforces `scripts.test` in each workspace package.
If missing, it generates:

```bash
node -e "console.log('No tests configured')"
```

**Note:** The `produck:coverage` script in subpackages is for local and AI development use only. It is NOT enforced by organization CI or `.c8rc.json`. Only the root workspace (monorepo root) is subject to org-level coverage enforcement and `.c8rc.json`.

Deploy organization format config and script baseline to repository root:

```bash
npm exec -- agent-toolkit sync-format --cwd .
```

This command manages `scripts.produck:format` and `.prettierrc` only.
The managed `produck:format` script always writes formatting fixes via
Prettier, so a separate root `format` script is not required.

Deploy organization lint config and script baseline to repository root:

```bash
npm exec -- agent-toolkit sync-lint --cwd .
```

This command manages `scripts.produck:lint`, `eslint.config.mjs`, and
`devDependencies.@produck/eslint-rules`. If `eslint.config.mjs` exists without
`@produck/eslint-rules`, it appends Produck integration to the exported config
array.

Deploy root and workspace coverage config plus root `c8` devDependency:

```bash
npm exec -- agent-toolkit sync-coverage --cwd .
```

This command manages root `scripts.produck:coverage`, root `.c8rc.json`, pins
root `devDependencies.c8`, and updates workspace package `produck:coverage`,
`test`, and `devDependencies.c8`. The generated `.c8rc.json` uses `src/**` and
`extension/**` as the default include scope, excludes common build and
dependency directories, and enables `check-coverage` with 99.5 thresholds for
branches, functions, lines, and statements.

Deploy root git attributes baseline:

```bash
npm exec -- agent-toolkit sync-git --cwd .
```

This command manages root `.gitattributes`, `.husky/pre-commit`,
`.husky/commit-msg`, `scripts.produck:baseline`,
`scripts.produck:commit:check`, and shared pinned root devDependencies
`husky`, `lerna`, and `@produck/agent-toolkit`.

Deploy root install script baseline:

```bash
npm exec -- agent-toolkit sync-install --cwd .
```

This command manages `scripts.produck:install` with value
`npm -v && npm install` and removes legacy `scripts.deps:install`.

Deploy root publish script baseline:

```bash
npm exec -- agent-toolkit sync-publish --cwd .
```

This command manages `scripts.produck:publish:check` and
`scripts.produck:publish`. If `lerna.json` is absent, sync mode creates a
default file before writing the scripts. When `scripts.publish` already
exists, `scripts.produck:publish` delegates to it after the shared checks;
otherwise it falls back to `lerna publish`.

Validate commit message format:

```bash
npm exec -- agent-toolkit validate-commit-msg --file .git/COMMIT_EDITMSG
```

Manual per-repository instruction distribution (write .github/instructions/produck/\*.instructions.md):

```bash
npm exec -- agent-toolkit sync-instructions --cwd .
```

Legacy repository bootstrap behavior:

- If `.github/copilot-instructions.md` is missing, sync-instructions initializes it.
- The initialized file guides repository owners to keep organization baseline in
  `.github/instructions/produck/*.instructions.md` and put local-only rules in
  `.github/copilot-instructions.md`.

Use organization source directory instead of built-in assets:

```bash
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
npm run produck:format
npm run produck:lint
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
npm run produck:publish:check
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
  version managed by `agent-toolkit sync-git`.
- Run `produck:publish:check` first.
- Then run workspace `publish:dry-run` before `publish`.
- Keep rollback option by republishing previous stable version if needed.

Rollback quick steps:

1. Check latest published version:
   `npm view @produck/agent-toolkit version`
2. Fix source and rerun workspace publish flow with a new version.
3. Push commit and tags.
