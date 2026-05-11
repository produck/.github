# @produck/agent-toolkit

Central CLI toolkit for organization-level AI execution workflows.

## Commands

- agent-toolkit preflight
- agent-toolkit run-capture
- agent-toolkit summarize-log
- agent-toolkit validate-commit-msg
- agent-toolkit sync-instructions

## Examples

Run preflight checks:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit preflight --cwd . --require package.json --ensure-dir logs
```

Capture long output safely:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit run-capture --cwd . --cmd "npm run test" --out logs/test.log
```

Summarize captured output:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit summarize-log --file logs/test.log --match "FAIL|ERROR"
```

Validate commit message format:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit validate-commit-msg --file .git/COMMIT_EDITMSG
```

Manual per-repository instruction distribution (write .instructions.md):

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit sync-instructions --cwd .
```

Use organization source file instead of built-in template:

```
npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit sync-instructions --cwd . --source path/to/org/.instructions.md --force
```

Built-in template location (for review and updates):

- `templates/default.instructions.md`
- `templates/help/*.txt`

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
