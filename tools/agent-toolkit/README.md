# @produck/agent-toolkit

Central CLI toolkit for organization-level AI execution workflows.

## Commands

- agent-toolkit preflight
- agent-toolkit run-capture
- agent-toolkit summarize-log
- agent-toolkit validate-commit-msg

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

## Local verification

From repository root:

npm --prefix tools/agent-toolkit run verify
npm --prefix tools/agent-toolkit run pack:check

## Manual publish

Lerna-like release flow (recommended):

0) Interactive mode (TTY):

npm --prefix tools/agent-toolkit run release

Interactive prompts let you choose:

- version level: patch/minor/major
- action: dry-run or publish

Default choices:

- patch
- dry-run

Interactive mode handles both:

- version bump level (patch/minor/major)
- action mode (dry-run or publish)

Low-level commands (optional):

npm --prefix tools/agent-toolkit run publish:dry-run
npm --prefix tools/agent-toolkit run publish:latest

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
