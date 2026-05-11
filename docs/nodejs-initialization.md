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
- Module system: ESM by default (`"type": "module"` in `package.json`).
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

- Testing strategy and framework are repository-defined.
- Repositories must keep `npm run test` and `npm run coverage` executable.

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
