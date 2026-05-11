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

npm exec --package=@produck/agent-toolkit@latest \
 agent-toolkit preflight --cwd . --require package.json --ensure-dir logs

Capture long output safely:

npm exec --package=@produck/agent-toolkit@latest \
 agent-toolkit run-capture --cwd . --cmd "npm run test" --out logs/test.log

Summarize captured output:

npm exec --package=@produck/agent-toolkit@latest \
 agent-toolkit summarize-log --file logs/test.log --match "FAIL|ERROR"

Validate commit message format:

npm exec --package=@produck/agent-toolkit@latest \
 agent-toolkit validate-commit-msg --file .git/COMMIT_EDITMSG

Manual per-repository instruction distribution (write .instructions.md):

npm exec --package=@produck/agent-toolkit@latest \
 agent-toolkit sync-instructions --cwd .

Use organization source file instead of built-in template:

npm exec --package=@produck/agent-toolkit@latest \
 agent-toolkit sync-instructions --cwd . \
 --source path/to/org/.instructions.md --force

Built-in template location (for review and updates):

- `templates/default.instructions.md`
- `templates/help/*.txt`

## Local verification

From repository root:

npm --workspace @produck/agent-toolkit run verify
npm --workspace @produck/agent-toolkit run pack:check

## Manual publish

Lerna-like release flow (recommended):

0. Interactive mode (TTY):

npm --workspace @produck/agent-toolkit run release

Interactive prompts let you choose:

- version level: patch/minor/major
- action: dry-run or publish
- vcs mode: commit+tag / commit only / no commit+no tag

Default choices:

- patch
- dry-run
- commit + tag

Interactive mode handles both:

- version bump level (patch/minor/major)
- action mode (dry-run or publish)
- auto commit and tag after dry-run

Non-interactive flags:

- `npm --workspace @produck/agent-toolkit run release -- patch --publish`
- `npm --workspace @produck/agent-toolkit run release -- patch --no-tag`
- `npm --workspace @produck/agent-toolkit run release -- patch --no-commit --no-tag`

Note:

- Release requires a clean working tree in `packages/agent-toolkit` before
  start.
- After release success, push commit and tags:
  - `git -C d:/workspace/PRODUCK/.github push`
  - `git -C d:/workspace/PRODUCK/.github push --tags`

Low-level commands (optional):

npm --workspace @produck/agent-toolkit run publish:dry-run
npm --workspace @produck/agent-toolkit run publish:latest

## GitHub workflow

Repository includes manual workflow:

- .github/workflows/publish-agent-toolkit.yml

Workflow behavior:

- Always runs verify, pack:check, and publish:dry-run.
- Does not publish to npm.
- Used as release gate before manual publish.

Release policy:

- Default organization usage is @latest.
- Run verify and publish:dry-run before publish:latest.
- Keep rollback option by republishing previous stable version if needed.

Rollback quick steps:

1. Check latest published version:
   `npm view @produck/agent-toolkit version`
2. Fix source and run release again with a new version.
3. Push commit and tags.
