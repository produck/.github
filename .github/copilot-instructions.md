# Repository AI Instructions

This is the `produck` organization policy monorepo that maintains canonical AI
collaboration and engineering baseline rules.

## Single Source of Truth

All rules are maintained in `.github/distribution/produck/`:

- `00-produck-base.instructions.md` — General AI collaboration baseline
- `10-produck-node.instructions.md` — Node.js repository baseline
- `12-produck-test.instructions.md` — Test authoring baseline
- `15-produck-workspace.instructions.md` — Workspace shared configuration guide
- `20-produck-commit.instructions.md` — Commit convention

These files are distributed via `publish-assets` to all downstream repositories.

## Local Repository Notes

This repository has no local-specific exceptions. For organization-specific
governance or team workflow overrides, add files under
`.github/instructions/produck/` using the same `.instructions.md` format as the
canonical sources, and reference the relevant canonical document for baseline
rules.
