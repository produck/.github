# Node.js Initialization Baseline

This document defines the organization-level initialization baseline for Node.js repositories.

## Scope

- Applies to all Node.js repositories in the `produck` organization, including services, CLI tools, and script/tooling repositories.
- Supports two repository modes: monorepo and standalone.

## Mode selection

- Monorepo mode: one repository contains multiple Node.js packages/apps.
- Standalone mode: one repository represents one Node.js package/app.
- Repository owners should declare the selected mode in the repository README.

## Common baseline (all modes)

- Node.js version policy: LTS required (no fixed major version at organization level).
- Package manager: npm only.
- Module system: ESM by default (`"type": "module"` in `package.json`).

Required script keys:

- `deps:install`
- `test`
- `coverage`
- `lint`
- `publish`

Notes:

- Script key names are fixed and must match exactly.
- `publish` may be a no-op when repository-specific release workflow does not use npm publishing.

- Testing strategy and framework are repository-defined.
- Repositories must keep `npm run test` and `npm run coverage` executable.

## Monorepo mode

Repository layout:

- Root-level `docs/` is required.
- Each package/app should contain its own `src/` and `test/`.

Script placement:

- Root `package.json` must provide `deps:install`, `test`, `coverage`, and `lint` orchestration scripts.
- `publish` may be defined at root or package level based on release workflow.

## Standalone mode

Repository layout:

- Top-level `src/`, `test/`, and `docs/` are required.

Script placement:

- The repository root `package.json` must define `deps:install`, `test`, `coverage`, `lint`, and `publish`.

## Enforcement strategy

- This baseline is enforced by documentation first.
- CI enforcement can be added later with repository checks.

## Precedence

- Repository-specific rules may add stricter requirements.
- If repository-specific rules conflict with this document, repository owners should explicitly document the exception.
