---
applyTo: '.github/distribution/produck/**,packages/agent-toolkit/**'
---

<!-- This file is NOT distributed to downstream repositories. -->
<!-- It contains organization-only governance for maintaining the tooling -->
<!-- baseline, overriding tool versions, and understanding the distribution -->
<!-- architecture. -->

# Produck Tooling Maintenance Guide

This file covers internal governance that downstream repositories do not need:
how to maintain the tooling version baseline, override tool versions, and
understand the toolkit command architecture.

## Tooling Version Baseline

### How version resolution works

The source file `.github/distribution/produck/tooling-version-baseline.json`
uses `"version": "auto"` to indicate that the version should be resolved from
the root `package.json` `devDependencies` at build time.

- `"version": "auto"` — the build script
  (`packages/agent-toolkit/bin/build-publish-assets.mjs`) reads the actual
  version from `root package.json devDependencies[toolName]` and injects it
  into the published baseline.
- Concrete version (e.g. `"version": "11.0.0"`) — the build script uses that
  value as-is, ignoring `package.json`. Use this to pin a version independently
  of the workspace.

The sync commands (`sync-format`, `sync-coverage`, `sync-git`, `sync-lint`)
have a two-tier resolution strategy:

1. If the baseline contains a concrete version (not `"auto"`), use it directly
   (this path is taken by downstream repos using the published baseline).
2. If the version is `"auto"` or empty, fall back to resolving from the local
   root `package.json` `devDependencies` (this path is taken during local
   development in this monorepo).

### How to override a tool version

To pin a tool to a fixed version independently of `package.json`:

1. Open `.github/distribution/produck/tooling-version-baseline.json`.
2. Change `"version": "auto"` to `"version": "X.Y.Z"` for the target tool.
3. The build script and all sync commands will use `"X.Y.Z"` directly.

To revert to auto-resolution, change it back to `"version": "auto"`.

### How to add a new tool to the baseline

1. Add the tool entry under `tools` in
   `.github/distribution/produck/tooling-version-baseline.json` with
   `"version": "auto"` (or a pinned version).
2. Ensure the tool exists in root `package.json` `devDependencies`.
3. Ensure all relevant sync commands (`sync-coverage`, `sync-format`,
   `sync-git`, `sync-lint`) can consume the new tool entry, or add the
   corresponding version resolution logic to them.

### How to remove a tool from the baseline

1. Remove the tool entry from `.github/distribution/produck/tooling-version-baseline.json`.
2. Remove the tool from root `package.json` `devDependencies` if it is no
   longer needed.
3. Update the relevant sync commands if they explicitly reference that tool.

## Toolkit Command Role Model

The following describes the architecture and role of each toolkit command.
Downstream repositories do not need this detail — they just run
`agent-toolkit enforce-node-baseline --cwd .`.

- `sync-instructions` is guidance-first distribution for organization baseline
  instructions. Not a hard gate; use it to reduce instruction drift, but do not
  assume it can fully prevent AI hallucination or iterative drift.
- `preflight` is the hard guard for organization engineering baseline and is
  mandatory for required baseline checks.
- `sync-install` is the hard guard for root install script governance and is
  mandatory in monorepo mode.
- `sync-coverage` is the hard guard for monorepo coverage governance and is
  mandatory in monorepo mode.
- `sync-git` is the hard guard for local anti-drift hook governance and is
  mandatory in monorepo mode.
- `sync-format` is the hard guard for root format script/config governance and
  is mandatory in monorepo mode.
- `sync-lint` is the hard guard for root lint script/config and eslint
  integration governance and is mandatory in monorepo mode.
- `sync-publish` is the hard guard for root publish script governance when
  `lerna.json` is present.
- `sync-typescript` is the hard guard for sub-package tsconfig.json
  governance, ensuring each TypeScript package has a standardized config that
  extends the root, and is mandatory in monorepo mode.
- `sync-workspace` is the hard guard for workspace package.json governance
  (produck:coverage script, test script) and is mandatory in
  monorepo mode. c8 devDependency is governed by `sync-coverage` at root only;
  workspace packages must not duplicate it.
- `validate-commit-msg` is a hard guard for AI-agent-authored `git commit` and
  `git commit --amend` operations. For human engineers, it is recommended
  rather than mandatory unless repository-specific hooks/CI enforce it.
- `run-capture` and `summarize-log` are AI-agent execution guardrails that pair
  with the node-first execution policy.

## Distribution Editing Rules

These rules apply only when working in this upstream policy repository:

- Update downstream baseline rules directly in
  `.github/distribution/produck/*.instructions.md`.
- Add organization-only governance under
  `.github/instructions/produck/` only when it must not be distributed.
- Do not distribute files from `.github/instructions/` — they are local-only.
