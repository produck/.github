---
applyTo: '**'
---

<!-- managed-by: @produck/agent-toolkit -->
<!-- source: .github/instructions/produck/90-org-distribution-governance.instructions.md -->

# Organization-only Distribution Governance

This file is for maintainers of the organization policy repository only.
It is not part of downstream instruction distribution.

## Source split model

- Downstream-distributable source:
  `.github/distribution/produck/*.instructions.md`
- Organization-only source:
  `.github/instructions/produck/*.instructions.md`

Maintenance rule:

- Maintain downstream files directly in `.github/distribution/produck/`.

## Manual downstream sync

When syncing from local organization sources (without relying on npm publish),
use the downstream source directory explicitly:

- `npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit sync-instructions --cwd . --source <path-to-org>/.github/distribution/produck --force --prune`

## Central package execution policy

When bridge mechanism uses a central npm package, default execution strategy is
`@latest` to deliver new capabilities quickly.

Required safeguards for `@latest`:

- Print resolved package version before high-impact commands.
- For high-risk operations, run dry-run/preview first, then execute.
- Keep an emergency fallback path to a pinned version.

Version observability:

- `npm view @produck/agent-toolkit version`

Post-release synchronization:

- Push release commit: `git push`
- Push release tag: `git push --tags`
