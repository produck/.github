---
applyTo: '**/*.{js,cjs,mjs,ts,tsx,json,yaml,yml}'
---

<!-- managed-by: @produck/agent-toolkit -->
<!-- source: .github/distribution/produck/10-produck-node.instructions.md -->

# Node.js Initialization Baseline

This document defines the organization-level initialization baseline for Node.js
repositories.

## Scope

- Applies to all Node.js repositories in the `produck` organization, including
  services, CLI tools, and script/tooling repositories.
- Supports two repository modes: monorepo and standalone.

## Mode selection

- Monorepo mode: one repository contains multiple Node.js packages/apps.
- Standalone mode: one repository represents one Node.js package/app.
- Repository owners should declare the selected mode in the repository README.

## Common baseline (all modes)

- Node.js version policy: LTS required (no fixed major version at organization
  level).
- Package manager: npm only.
- Module system: ESM by default for executable/publishable Node.js packages
  (`"type": "module"` in package-level `package.json`).
- Follow the organization `.gitattributes` baseline (LF default for text files).
- Follow the organization `.editorconfig` baseline.

Required script keys:

- `deps:install`
- `test`
- `coverage`
- `lint`
- `publish`

Notes:

- Script key names are fixed and must match exactly.
- `publish` may be a no-op when repository-specific release workflow does not
  use npm publishing.
- Coverage governance policy:
  - Keep the script key name `coverage` (organization-reserved key).
  - In monorepo mode, workspace subpackage `scripts.coverage` is fully governed
    by organization baseline.
  - Source of truth for tooling versions/template:
    `.github/distribution/produck/tooling-version-baseline.json`.
  - Use central remediation command to deploy coverage scripts:
    `npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit sync-coverage-script --cwd .`.
  - `c8` execution baseline for deployed coverage scripts is fixed to
    `c8@11.0.0`.
  - Downstream repositories must not use unversioned `npx c8` or `c8@latest`
    in shared scripts/CI.
  - Do not require a root `devDependencies` entry for `c8` unless repository
    constraints require pinned/offline installation.

- Testing strategy and framework are repository-defined.
- `test` script implementation is repository-defined and is not overwritten by
  organization coverage remediation.
- Repositories should keep `npm run test` and `npm run coverage` executable in
  steady state.
- For intermediate commits, temporary non-executable state or failing tests are
  allowed.
- Commit prechecks still require passing repository style gates (for example
  `format:check` and `lint`).

Central toolkit command role model:

- `agent-toolkit sync-instructions` is guidance-first distribution for
  organization baseline instructions.
- `sync-instructions` is not a hard gate; use it to reduce instruction drift,
  but do not assume it can fully prevent AI hallucination or iterative drift.
- `agent-toolkit preflight` is the hard guard for organization engineering
  baseline and is mandatory for required baseline checks.
- `agent-toolkit sync-coverage-script` is the hard guard for monorepo coverage
  governance and is mandatory in monorepo mode.
- For simplified downstream execution of mandatory flow (1 -> 2 -> 3), use:
  `npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit`.
- Equivalent explicit form:
  `npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd .`.
- `agent-toolkit validate-commit-msg` is a hard guard for AI-agent-authored
  `git commit` and `git commit --amend` operations.
- For human engineers, commit-message validation is recommended rather than
  mandatory unless repository-specific hooks/CI enforce it.
- Do not require retroactive rewrite/amend of historical commits solely to
  satisfy commit-message validator rules.
- `agent-toolkit run-capture` and `agent-toolkit summarize-log` are AI-agent
  execution guardrails.
- These guardrails pair with node-first execution policy: prefer Node.js
  interpreter workflows for parsing/filtering over brittle OS-shell pipelines.
- For human engineers, `run-capture` and `summarize-log` are optional helpers.

Test authoring baseline (required):

- Prefer Node.js standard library test runner (`node:test`) with `describe` and
  `it`.
- Each test case must be independently executable.
- Test cases must not depend on execution order or state from other cases.
- New test debugging should use local `only` mode for scoped regression.
- After debugging, remove all `only` markers before final validation.

Recommended local debug flow:

1. Add `{ only: true }` to the target `describe/it` and all ancestor
   `describe` blocks.
2. Run `node --test --test-only test/index.mjs`.
3. Remove all `only` markers.
4. Run full regression via repository standard test command.

Script and output directory policy:

- Reusable project scripts should be committed under root `scripts/`.
- Organization-level shared tooling may use a central npm package bridge instead
  of repository-local `scripts/` duplication.
- Runtime command outputs should be written under root `logs/` (or a documented
  equivalent) and ignored by git.
- Temporary debug scripts should not be committed.
- `.github/` should not be used as a temporary script workspace.

Required ignore baseline:

- Each Node.js repository must include a root `.gitignore`.
- The root `.gitignore` must start from the GitHub default template for Node.js
  projects (`Node.gitignore` from github/gitignore).
- Team-specific ignore conventions should be appended on top of that baseline
  template, not used as a replacement.
- The root `.gitignore` should at minimum ignore:
  - `node_modules/`
  - `coverage/`
  - `.env`
  - `.env.*`
  - npm logs (for example `npm-debug.log*`)
  - OS/editor noise (for example `.DS_Store`, `Thumbs.db`, `.vscode/` when
    workspace settings are not intended to be shared)

Team conventions for `.gitignore`:

- Keep organization-wide additions grouped under a dedicated comment block for
  easy updates.
- Do not remove baseline entries from the GitHub template unless repository
  owners document a justified exception.
- Organization-approved team extension entries are:
  - `*.ign*` (manually created local directories/files that should not be
    committed)
  - `*.gen*` (generated artifacts created by program execution, for example
    during tests)
- Append these team entries under a dedicated team block at the end of the root
  `.gitignore`.

## Monorepo mode

Repository layout:

- Root-level `docs/` is required.
- Each package/app should contain its own `src/` and `test/`.

Script placement:

- Root `package.json` must provide `deps:install`, `test`, `coverage`, and
  `lint` orchestration scripts.
- `publish` may be defined at root or package level based on release workflow.
- Workspace subpackage `coverage` scripts must be synchronized by
  `agent-toolkit sync-coverage-script`.

Release tooling policy (required):

- Monorepo release workflow must use `lerna`.
- `lerna` execution version is governed at organization level, not per
  repository.
- Source of truth for `lerna` version baseline:
  `.github/distribution/produck/tooling-version-baseline.json`.
- Required execution baseline: `lerna@9.0.7`.
- Required invocation:
  `npm exec --package=lerna@9.0.7 -- lerna <subcommand>`.
- Downstream repositories must not use unversioned `npx lerna` or
  `lerna@latest` in shared scripts/CI.
- For high-impact release commands, run dry-run/preview before publish.
- Keep an emergency organization-level rollback path when baseline version is
  updated.

Root workspace `package.json` minimal baseline (required):

- `private`: `true`
- `workspaces` (explicit package path list only)
- `scripts` with at least: `deps:install`, `test`, `coverage`, `lint`
- `publish` script is optional at root when release is managed per package or
  by external workflow.

`workspaces` field constraints (required):

- Do not use wildcard/glob patterns (for example `packages/*`, `**`, `?`,
  `{}` or `[]`).
- List each workspace package path explicitly.

Avoid unused root runtime/publish fields by default:

- `type`
- `main`
- `exports`
- `types`
- `files`
- `publishConfig`

Add the fields above only when the monorepo root itself is an executable
runtime package or is intentionally published.

Ignore strategy:

- Keep ignore rules centralized at repository root whenever possible.
- Add package-level `.gitignore` only when a package has unique generated
  artifacts.

## Standalone mode

Repository layout:

- Top-level `src/`, `test/`, and `docs/` are required.

Script placement:

- The repository root `package.json` must define `deps:install`, `test`,
  `coverage`, `lint`, and `publish`.

Ignore strategy:

- Keep project-specific generated files ignored in the repository root
  `.gitignore`.

## Enforcement strategy

- This baseline is enforced by documentation first.
- CI enforcement can be added later with repository checks.

## Precedence

- Repository-specific rules may add stricter requirements.
- If repository-specific rules conflict with this document, repository owners
  should explicitly document the exception.
