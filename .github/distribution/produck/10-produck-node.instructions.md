---
applyTo: '**'
---

<!-- managed-by: @produck/agent-toolkit -->
<!-- source: .github/distribution/produck/10-produck-node.instructions.md -->

# Node.js Baseline (Monorepo + Standalone)

## Scope

- Applies to Node.js repositories in the organization.
- Default package manager: npm.
- Default language level: modern stable Node.js for current LTS.
- Module system: ESM by default for executable/publishable Node.js packages
  (`"type": "module"` in package-level `package.json`).
- Follow the organization `.gitattributes` baseline (LF default for text files).
- Follow the organization `.editorconfig` baseline.

Required script keys:

- `produck:install`
- `test`
- `produck:coverage`
- `produck:lint`
- `publish`

Notes:

- Script key names are fixed and must match exactly.
- Keep the script key name `produck:install` (organization-reserved key).
- The required value for `produck:install` is governed by
  `agent-toolkit sync-install`; see the Monorepo mode section below for the
  canonical value.
- `publish` may be a no-op when repository-specific release workflow does not
  use npm publishing.
- Coverage governance policy:
  - Keep the script key name `produck:coverage` (organization-reserved key).
  - In monorepo mode, workspace subpackage `scripts.produck:coverage` and
    workspace `devDependencies.c8` are fully governed by organization
    baseline.
  - Source of truth for tooling versions/template:
    `.github/distribution/produck/tooling-version-baseline.json`.
  - Use central remediation command to deploy root install script baseline:
    `npm exec -- agent-toolkit sync-install --cwd .`.
  - Use central remediation command to deploy coverage scripts:
    `npm exec -- agent-toolkit sync-coverage --cwd .`.
  - Use central remediation command to deploy local anti-drift hook baseline:
    `npm exec -- agent-toolkit sync-git --cwd .`.
  - Use central remediation command to deploy root format script/config
    baseline:
    `npm exec -- agent-toolkit sync-format --cwd .`.
  - Use central remediation command to deploy root lint script/config and
    eslint integration baseline:
    `npm exec -- agent-toolkit sync-lint --cwd .`.
  - `c8` execution baseline for deployed coverage scripts is fixed to the
    version specified in `tooling-version-baseline.json`.
  - Downstream repositories must not use unversioned `npx c8` or `c8@latest`
    in shared scripts/CI.
  - Root local governance must pin `devDependencies.c8`,
    `devDependencies.husky`, `devDependencies.lerna`, and
    `devDependencies.@produck/agent-toolkit` via
    `agent-toolkit sync-git`.
  - Root local governance must pin `devDependencies.@produck/eslint-rules`
    via `agent-toolkit sync-lint`.

- Testing strategy and framework are repository-defined.
- `verify` scripts are optional repository-local health checks and are not
  organization-required script keys.
- `verify` is not part of organization commit gates; style gates remain
  repository `produck:format` and `produck:lint` policy.
- `test` script implementation is repository-defined and is not overwritten by
  organization coverage remediation.
- Repositories should keep `npm run test` and `npm run produck:coverage`
  executable in steady state.
- For intermediate commits, temporary non-executable state or failing tests are
  allowed.
- Commit prechecks still require passing repository style gates (for example
  `produck:format` and `produck:lint`).

Central toolkit command role model:

- `agent-toolkit sync-instructions` is guidance-first distribution for
  organization baseline instructions.
- `sync-instructions` is not a hard gate; use it to reduce instruction drift,
  but do not assume it can fully prevent AI hallucination or iterative drift.
- `agent-toolkit preflight` is the hard guard for organization engineering
  baseline and is mandatory for required baseline checks.
- `agent-toolkit sync-install` is the hard guard for root install script
  governance and is mandatory in monorepo mode.
- `agent-toolkit sync-coverage` is the hard guard for monorepo coverage
  governance and is mandatory in monorepo mode.
- `agent-toolkit sync-git` is the hard guard for local anti-drift hook
  governance and is mandatory in monorepo mode.
- `agent-toolkit sync-format` is the hard guard for root format
  script/config governance and is mandatory in monorepo mode.
- `agent-toolkit sync-lint` is the hard guard for root lint
  script/config and eslint integration governance and is mandatory in monorepo
  mode.
- `agent-toolkit sync-publish` is the hard guard for root publish script
  governance when `lerna.json` is present.
- For simplified downstream execution of mandatory flow (1 -> 2 -> ... -> 9),
  use:
  `npm exec -- agent-toolkit`.
- Equivalent explicit form:
  `npm exec -- agent-toolkit enforce-node-baseline --cwd .`.
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

Test authoring baseline:

- See [Test Authoring Baseline](12-produck-test.instructions.md) for the full
  test writing, structure, debug, and coverage workflow rules.

Script and output directory policy:

- Follow script/output placement and lifecycle policy from
  `00-produck-base.instructions.md`.
- For monorepo shared configuration and root workspace practices, follow
  `15-produck-workspace.instructions.md`.

Required ignore baseline:

- Each Node.js repository must include a root `.gitignore`.
- Baseline template and required minimum entries follow
  `00-produck-base.instructions.md`.
- Monorepo centralization policy and workspace-specific ignore guidance follow
  `15-produck-workspace.instructions.md`.

Team conventions for `.gitignore`:

- Team extension entries and placement rules follow
  `00-produck-base.instructions.md`.

## Monorepo mode

Repository layout:

- Root-level `docs/` is required.
- Each package/app should contain its own `src/` and `test/`.

Script placement:

- Root `package.json` must provide `produck:install`, `test`, `produck:coverage`,
  and `produck:lint` orchestration scripts.
- Root `package.json` must reserve `produck:commit:check` for organization
  anti-drift gate with required value:
  `npm run produck:format && npm run produck:lint`.
- Root `package.json` must reserve `prepare` for husky setup with required
  value: `husky`.
- Root `package.json` must reserve `produck:format` and `produck:lint` for
  organization-controlled format/lint gates.
- Root `package.json` must reserve `produck:publish` for organization-controlled
  publish gate when `lerna.json` is present (governed by
  `agent-toolkit sync-publish`).
- `publish` may be defined at root or package level based on release workflow.
- Workspace subpackage `produck:coverage` scripts must be synchronized by
  `agent-toolkit sync-coverage`.
- Root local hook governance must be synchronized by
  `agent-toolkit sync-git`.
- Root local shared script governance must initialize
  `scripts.produck:install` with required value `npm -v && npm install`
  via `agent-toolkit sync-install`.
- Root local format governance must be synchronized by
  `agent-toolkit sync-format`.
- Root local lint governance must be synchronized by
  `agent-toolkit sync-lint`.
- Root local shared script/dependency governance must pin root
  `devDependencies.c8`,
  `devDependencies.husky`, `devDependencies.lerna`,
  `devDependencies.@produck/agent-toolkit` via
  `agent-toolkit sync-git`.
- Root local shared script/dependency governance must initialize
  `scripts.produck:coverage` with workspace-level execution behavior:
  attempt `test` on all workspace packages using `--workspaces --if-present`.
- Root local shared script/dependency governance must initialize `.c8rc.json`
  via `agent-toolkit sync-coverage`.
- Root local format governance must initialize `.prettierrc` and
  `scripts.produck:format` via `agent-toolkit sync-format`.
- Root local lint governance must initialize `eslint.config.mjs`,
  `scripts.produck:lint`, and `devDependencies.@produck/eslint-rules`
  (including append-mode integration for existing eslint config) via
  `agent-toolkit sync-lint`.
- Root `package.json` must define a `produck:baseline` script for organization
  baseline enforcement:
  ```json
  "produck:baseline": "npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd ."
  ```

Release tooling policy (required):

- Monorepo release workflow must use `lerna`.
- `lerna` execution version is governed at organization level, not per
  repository.
- Source of truth for `lerna` version baseline:
  `.github/distribution/produck/tooling-version-baseline.json`.
- Required execution baseline: version specified in `tooling-version-baseline.json`.
- Required invocation:
  `npm exec -- lerna <subcommand>`.
- Downstream repositories must not use unversioned `npx lerna` or
  `lerna@latest` in shared scripts/CI.
- For high-impact release commands, run dry-run/preview before publish.
- Keep an emergency organization-level rollback path when baseline version is
  updated.

Root workspace `package.json` minimal baseline (required):

- `private`: `true`
- `workspaces` (explicit package path list only)
- `scripts` with at least: `produck:install`, `test`, `produck:coverage`,
  `produck:lint`
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

- The repository root `package.json` must define `produck:install`, `test`,
  `produck:coverage`, `produck:lint`, and `publish`.
- Root `package.json` must define a `produck:baseline` script for organization
  baseline enforcement:
  ```json
  "produck:baseline": "npm exec --package=@produck/agent-toolkit@latest -- agent-toolkit enforce-node-baseline --cwd ."
  ```

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
