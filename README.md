# Produck Organization Policies

This repository defines organization-level collaboration policies for
repositories in the produck organization.

## Start Here

- **Organization instructions**: [.instructions.md](.instructions.md) — Quick
  navigation and core principles for all repositories.
- **Contributor guide**: [CONTRIBUTING.md](CONTRIBUTING.md) — Development and
  collaboration standards.

## What this repo contains

- AI collaboration baseline and precedence rules
- Commit message grammar and target taxonomy
- Pull request template and review checklist
- Node.js initialization baseline for monorepo and standalone modes
- Monorepo workspace packages under `packages/`

## Workspace packages

- `packages/agent-toolkit`: central CLI bridge package
  `@produck/agent-toolkit`
- `packages/eslint-rules`: shared ESLint flat config package
  `@produck/eslint-rules`

## Core documents

- AI collaboration: [.github/distribution/produck/00-produck-base.instructions.md](.github/distribution/produck/00-produck-base.instructions.md)
- Commit convention: [.github/distribution/produck/20-produck-commit.instructions.md](.github/distribution/produck/20-produck-commit.instructions.md)
- Node.js init baseline:
  [.github/distribution/produck/10-produck-node.instructions.md](.github/distribution/produck/10-produck-node.instructions.md)
- Test authoring baseline:
  [.github/distribution/produck/12-produck-test.instructions.md](.github/distribution/produck/12-produck-test.instructions.md)
- PR template: [pull_request_template.md](pull_request_template.md)

## Instruction source split

- Downstream-distributable source:
  `.github/distribution/produck/*.instructions.md`
- Organization-only source:
  `.github/instructions/produck/*.instructions.md`
- NPM publish assets are generated from downstream-distributable source by
  `packages/agent-toolkit/bin/build-publish-assets.mjs`

## How to use this repo

- New repositories should adopt these policies as a starting baseline.
- Repository-specific rules may be stricter when needed.
- If a repository introduces exceptions, document them explicitly.

## Contribution notes

- Use the commit tag grammar documented in commit-convention.
- `npm run produck:install` prints the npm version once, installs
  dependencies, and installs Husky hooks for local `pre-commit` and
  `commit-msg` enforcement.
- Keep markdown line length at 80 characters or fewer.
- Keep policy changes small, explicit, and reviewable.
