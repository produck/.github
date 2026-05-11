# AI Collaboration

This document defines a lightweight AI collaboration baseline for repositories
in the `produck` organization.

## Goals

- Improve consistency when using AI tools across repositories
- Keep the baseline lightweight and easy to adopt
- Let repositories add stricter or more specific instructions when needed

## Default expectations

- Default to Chinese for explanations and discussion unless the repository or
  request requires another language.
- Prefer existing repository patterns over introducing new abstractions or
  frameworks.
- Do not invent APIs, packages, configuration keys, commands, environment
  variables, or files.
- Do not add new dependencies unless necessary and explicitly justified.
- When changing behavior, add or update tests when practical.
- Treat authentication, authorization, secrets, infrastructure, and production
  configuration as high-risk areas that require human review.
- Repositories should include a root `.gitattributes` to normalize line endings
  safely across platforms.

## Git attributes conventions

- All repositories should include a root `.gitattributes`.
- Default text line ending policy is LF.
- Recommended minimum template:

```gitattributes
* text=auto eol=lf

# Windows script entrypoints
*.bat text eol=crlf
*.cmd text eol=crlf
```

- Repository-specific exceptions are allowed but must be documented in
  repository instructions.

## EditorConfig conventions

- All repositories should include a root `.editorconfig`.
- Recommended organization baseline:

```editorconfig
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.yml]
indent_style = space
indent_size = 2

[*.yaml]
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
max_line_length = 80
```

- Repository-specific exceptions are allowed but must be documented in
  repository instructions.
- Organization-wide requirement: all Markdown files should keep each line at 80
  characters or fewer.

## Language conventions

- Explanations, discussion, and review communication default to Chinese unless
  the repository or request requires another language.
- Commit messages keep the bracketed format and use English summaries.
- PR descriptions and issue comments may use Chinese or English, but keep one
  language per section and keep terminology consistent.
- Code identifiers, filenames, and existing public API names should follow
  existing repository conventions; do not translate existing symbols.
- User-facing copy should follow the target product locale of the
  repository/module.

## Commit and PR conventions

- Commit messages use bracketed tags: `[TAG] summary`.
- Use uppercase tags from this whitelist: `[INIT]`, `[ADD]`, `[REMOVE]`,
  `[FIX]`, `[REFACTOR]`, `[UPGRADE]`.
- Legacy tag mapping for migration is `[ADDED]` -> `[ADD]`, `[REMOVED]` ->
  `[REMOVE]`, and `[FIXED]` -> `[FIX]`.
- To express content domain, summary may use target syntax: `[TAG] <target>:
  <summary>`.
- Allowed targets are `docs`, `test`, `ci`, `deps`, `api`, `schema`, and
  `infra`.
- If target syntax is used, target must be wrapped in angle brackets and must be
  from the allowed target list.
- For non-monorepo repositories, use `[TAG] summary` directly (no
  package/workspace section headers).
- Bracketed commit summaries should be in English
- `[UPGRADE] deps` is allowed for pure dependency upgrades; if IFF artifacts or
  IPC-related artifacts/calls are updated, the summary must name those updates
  explicitly.
- PR title format is repository-defined; no organization-level title format
  restriction
- In PR descriptions, summarize what changed, why it changed, how it was
  validated, and any known risks or follow-up work

## Terminal long-output protocol

When a command may produce large output (for example 10k+ lines), use a
two-phase flow instead of shell pipelines like `| grep` or `| tail`.

Node-first policy:

- MUST use Node scripts first for output processing, file processing, path
  checks, and multi-step command orchestration.
- MAY use direct shell commands only for short, read-only, atomic checks (for
  example status/list/current-directory checks).
- MUST avoid shell pipelines and stream redirection for long-output tasks.

- Phase 1 (capture): run command and write full output to a file first.
- Phase 2 (analyze): run a separate step to filter/summarize that file.

Recommended three-step flow:

1. Preflight: verify required files/paths and create output directories.
2. Capture: execute command and persist full output.
3. Analyze: summarize or filter captured output.

Recommended local tools:

- `node scripts/preflight.mjs --cwd . --require package.json --ensure-dir logs`
- `node scripts/run-and-capture.mjs --out logs/run.log --cmd "<command>"`
- `node scripts/summarize-log.mjs --file logs/run.log --last 120`
- `node scripts/summarize-log.mjs --file logs/run.log --match "FAIL|ERROR"`

Guardrails:

- Always create output directories before capture.
- Do not append fragile post-pipelines to the capture command.
- If filtering fails, keep the captured raw log as the source of truth.

## Precedence

If a repository provides more specific instructions, follow the repository
instructions over this organization baseline.

For Node.js repositories, also follow [Node.js Initialization
Baseline](nodejs-initialization.md).
