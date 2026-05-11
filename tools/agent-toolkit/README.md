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
