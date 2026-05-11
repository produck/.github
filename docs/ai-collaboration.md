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

### EditorConfig quick rule

- Default action: directly copy the `.editorconfig` sample in this document.
- If target repository has no root `.editorconfig`, create one from this sample
  without modification.
- If target repository already has a root `.editorconfig`, do not replace the
  whole file; add only missing required keys from this sample.
- Repository-documented exceptions override this sample.
- If an exception applies, keep the exception and record it in change notes.
- Do not include unrelated formatting-only changes in the same commit.

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
- Every non-empty commit message line must start with `[TAG]`.
- Empty lines are not allowed between commit message lines.
- Do not use untagged bullet lines in commit message body.
- If details are needed, use additional tagged lines.
- Do not keep summary as an untagged standalone line.
- Recommended local validation:
  `npm exec --package=@produck/agent-toolkit@latest agent-toolkit
  validate-commit-msg --file <message-file>`.
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

- `npm exec --package=@produck/agent-toolkit@latest agent-toolkit preflight
  --cwd . --require package.json --ensure-dir logs`
- `npm exec --package=@produck/agent-toolkit@latest agent-toolkit run-capture
  --out logs/run.log --cmd "<command>"`
- `npm exec --package=@produck/agent-toolkit@latest agent-toolkit summarize-log
  --file logs/run.log --last 120`
- `npm exec --package=@produck/agent-toolkit@latest agent-toolkit summarize-log
  --file logs/run.log --match "FAIL|ERROR"`

Guardrails:

- Always create output directories before capture.
- Do not append fragile post-pipelines to the capture command.
- If filtering fails, keep the captured raw log as the source of truth.

Script placement and lifecycle policy:

- Reusable repository scripts MUST be stored in `scripts/`.
- Runtime outputs (logs, reports, captures) MUST be stored in `logs/` or
  repository-defined output directories and ignored by git.
- For organization-level policy repositories (for example this `.github`
  repository), do not add runtime-output `.gitignore` only for local agent
  execution; use session memory paths or local temp locations instead.
- Temporary diagnostic scripts MUST NOT be committed and MUST use session
  memory workspace paths when available.
- Do not place ad-hoc execution scripts in `.git/`, `.github/`, or random root
  paths.
- `.github/` is reserved for GitHub platform config (workflows, templates,
  issue forms), not for temporary run scripts.

## Organization-level AI instruction scope

This repository is the policy source for organization-wide AI instructions.

What works across repositories:

- Organization-level AI instruction text can guide agent behavior in all
  repositories when configured at organization settings.
- Rules in this document should be copied into organization AI instructions.
- Repository-specific rules may still add stricter constraints.

What does not work automatically:

- Scripts stored in this repository are not auto-mounted into other
  repositories.
- Agents in another repository cannot assume local file paths from this
  repository exist.
- Cross-repository script execution requires an explicit bridge mechanism.

### Central package execution policy

When bridge mechanism uses a central npm package, default execution strategy is
`@latest` to deliver new capabilities quickly.

Local implementation reference in this repository:

- `tools/agent-toolkit` stores the central package source for shared context,
  searchability, and iteration.
- This local path is the implementation source, not an automatic runtime mount
  for other repositories.

Required safeguards for `@latest`:

- Print resolved package version before running high-impact commands.
- For high-risk operations, run dry-run/preview first, then execute.
- Keep an emergency fallback path to a pinned version for incident mitigation.
- Prefer `npm exec --package=<pkg>@latest <bin> ...` for predictable invocation.

Version observability (required before high-impact operations):

- `npm view @produck/agent-toolkit version`
- Record the observed version in task notes or PR description.

Post-release synchronization (required):

- Push release commit: `git push`
- Push release tag: `git push --tags`

Rollback runbook (minimum):

- Confirm latest published version:
  `npm view @produck/agent-toolkit version`
- If rollback is needed, bump from current source and republish a fixed version.
- Do not republish an already-used version number.
- Push corresponding commit and tags after rollback publish.

### Recommended organization AI instruction template

Use the following template text in organization AI instructions:

- Use Chinese for discussion unless repository rules require another language.
- Follow existing repository patterns; do not invent APIs, files, commands, or
  config keys.
- Node-first execution policy:
  - Use Node scripts first for file/path/output processing.
  - For large output tasks, use two phases: capture full output, then analyze.
  - Avoid fragile shell pipeline post-processing for long-output commands.
- Central package policy:
  - Default to `<pkg>@latest` for organization tooling commands.
  - Print resolved package version before high-impact execution.
  - Use dry-run first for risky operations; keep rollback path to pinned version.
- Commit message policy:
  - Every non-empty commit message line must start with `[TAG]`.
  - Empty lines are not allowed between commit message lines.
  - Use only allowed tags: `[INIT]`, `[ADD]`, `[REMOVE]`, `[FIX]`,
    `[REFACTOR]`, `[UPGRADE]`.
  - Optional target syntax is `[TAG] <target>: <summary>` with target in:
    `docs`, `test`, `ci`, `deps`, `api`, `schema`, `infra`.
- Do not assume scripts from organization `.github` repository exist in target
  repositories.
- If a repository provides stricter rules, repository rules override
  organization defaults.

## Precedence

If a repository provides more specific instructions, follow the repository
instructions over this organization baseline.

For Node.js repositories, also follow [Node.js Initialization
Baseline](nodejs-initialization.md).
