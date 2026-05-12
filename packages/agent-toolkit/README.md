# @produck/agent-toolkit

Central CLI toolkit for organization-level AI execution workflows.

## Commands

- agent-toolkit enforce-node-baseline
- agent-toolkit preflight
- agent-toolkit run-capture
- agent-toolkit summarize-log
- agent-toolkit sync-coverage-script
- agent-toolkit sync-husky-hooks
- agent-toolkit validate-commit-msg
- agent-toolkit sync-instructions

## Examples

Run default mandatory baseline flow in downstream repository root:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit
```

Equivalent explicit form:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd .
```

Run preflight checks:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit preflight --cwd . --require package.json --ensure-dir logs
```

Run one-shot mandatory baseline steps for downstream monorepo (1 -> 2 -> 3):

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd .
```

Validate monorepo root workspace package.json baseline:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit preflight --cwd . --check-workspace-package-json package.json
```

Capture long output safely:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit run-capture --cwd . --cmd "npm run test" --out logs/test.log
```

Summarize captured output:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit summarize-log --file logs/test.log --match "FAIL|ERROR"
```

Deploy organization coverage script and pinned local c8 devDependency to
workspace packages:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit sync-coverage-script --cwd .
```

Deploy organization local anti-drift husky hooks to repository root:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit sync-husky-hooks --cwd .
```

This command pins root local hook dependencies (`husky` and
`@produck/agent-toolkit`) and syncs `.husky/pre-commit` and
`.husky/commit-msg`.

Validate commit message format:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit validate-commit-msg --file .git/COMMIT_EDITMSG
```

Manual per-repository instruction distribution (write .github/instructions/produck/\*.instructions.md):

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit sync-instructions --cwd .
```

Legacy repository bootstrap behavior:

- If `.github/copilot-instructions.md` is missing, sync-instructions initializes it.
- The initialized file guides repository owners to keep organization baseline in
  `.github/instructions/produck/*.instructions.md` and put local-only rules in
  `.github/copilot-instructions.md`.

Use organization source directory instead of built-in assets:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit sync-instructions --cwd . --source path/to/org/.github/distribution/produck --force --prune
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

From repository root:

```bash
npm --workspace @produck/agent-toolkit run verify
npm --workspace @produck/agent-toolkit run pack:check
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

- Always runs verify and pack:check for `@produck/agent-toolkit`.
- Does not publish to npm.
- Used as release gate before workspace-level publish.

Release policy:

- Default organization usage is @latest.
- Run format:check and test first, then workspace `publish:dry-run` before
  `publish`.
- Keep rollback option by republishing previous stable version if needed.

Rollback quick steps:

1. Check latest published version:
   `npm view @produck/agent-toolkit version`
2. Fix source and rerun workspace publish flow with a new version.
3. Push commit and tags.
