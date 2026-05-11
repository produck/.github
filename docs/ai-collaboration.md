# AI Collaboration

This document defines a lightweight AI collaboration baseline for repositories in the `produck` organization.

## Goals

- Improve consistency when using AI tools across repositories
- Keep the baseline lightweight and easy to adopt
- Let repositories add stricter or more specific instructions when needed

## Default expectations

- Default to Chinese for explanations and discussion unless the repository or request requires another language.
- Prefer existing repository patterns over introducing new abstractions or frameworks.
- Do not invent APIs, packages, configuration keys, commands, environment variables, or files.
- Do not add new dependencies unless necessary and explicitly justified.
- When changing behavior, add or update tests when practical.
- Treat authentication, authorization, secrets, infrastructure, and production configuration as high-risk areas that require human review.

## Language conventions

- Explanations, discussion, and review communication default to Chinese unless the repository or request requires another language.
- Commit messages keep the bracketed format and use English summaries.
- PR descriptions and issue comments may use Chinese or English, but keep one language per section and keep terminology consistent.
- Code identifiers, filenames, and existing public API names should follow existing repository conventions; do not translate existing symbols.
- User-facing copy should follow the target product locale of the repository/module.

## Commit and PR conventions

- Commit messages use bracketed tags: `[TAG] summary`.
- Use uppercase tags from this whitelist: `[INIT]`, `[ADDED]`, `[REMOVED]`, `[FIXED]`, `[REFACTOR]`, `[UPGRADE]`.
- For non-monorepo repositories, use `[TAG] summary` directly (no package/workspace section headers).
- Bracketed commit summaries should be in English
- `[UPGRADE] deps` is allowed for pure dependency upgrades; if IFF artifacts or IPC-related artifacts/calls are updated, the summary must name those updates explicitly.
- PR title format is repository-defined; no organization-level title format restriction
- In PR descriptions, summarize what changed, why it changed, how it was validated, and any known risks or follow-up work

## Precedence

If a repository provides more specific instructions, follow the repository instructions over this organization baseline.

For Node.js repositories, also follow [Node.js Initialization Baseline](nodejs-initialization.md).
