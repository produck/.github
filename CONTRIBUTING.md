# Contributing

Thank you for contributing to repositories in the `produck` organization.

## AI collaboration baseline

This organization uses a lightweight set of AI collaboration defaults.

Organization-level scope note:

- Policies in this repository can be applied across repositories through
  organization AI instruction settings.
- Scripts in this repository are not automatically available inside other
  repositories.
- For scope details and copyable organization instruction text, see
  [AI Collaboration](docs/ai-collaboration.md).

- Default to Chinese for explanations and discussion unless the repository or
  request requires another language.
- Prefer existing repository patterns over introducing new abstractions.
- Do not invent APIs, packages, configuration keys, commands, environment
  variables, or files.
- Do not add new dependencies unless necessary and explicitly justified.
- When changing behavior, add or update tests when practical.
- Treat authentication, authorization, secrets, infrastructure, and production
  configuration as high-risk areas that require human review.
- Include a root `.gitattributes` in repositories and normalize text files to LF
  by default.

Git attributes baseline:

- Use LF as the default text line ending via `.gitattributes`.
- Recommended minimum `.gitattributes`:

```gitattributes
* text=auto eol=lf

# Windows script entrypoints
*.bat text eol=crlf
*.cmd text eol=crlf
```

EditorConfig baseline:

- Include a root `.editorconfig` in repositories.
- Recommended minimum `.editorconfig`:

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

- Organization-wide requirement: all Markdown files should keep each line at 80
  characters or fewer.

Language conventions:

- Explanations, discussion, and review communication default to Chinese unless
  the repository or request requires another language.
- Commit messages use English summaries in the bracketed format.
- PR descriptions and issue comments may use Chinese or English, but keep one
  language per section and keep terminology consistent.
- Code identifiers, filenames, and existing public API names should follow
  existing repository conventions; do not translate existing symbols.
- User-facing copy should follow the target product locale of the
  repository/module.

## Commit messages

Use bracketed commit style:

- `[TAG] summary`

Multi-line rule:

- Every non-empty commit message line must start with `[TAG]`.
- Empty lines are not allowed between commit message lines.
- Do not use untagged bullet lines in commit body.
- If details are needed, use additional tagged lines.
- Do not keep summary as an untagged standalone line.

Validation step (recommended):

- `node scripts/validate-commit-message.mjs --file <message-file>`

Allowed tags are `[INIT]`, `[ADD]`, `[REMOVE]`, `[FIX]`, `[REFACTOR]`, and
`[UPGRADE]`.
Legacy tag mapping for migration is `[ADDED]` -> `[ADD]`, `[REMOVED]` ->
`[REMOVE]`, and `[FIXED]` -> `[FIX]`.
Tags must be uppercase, and bracketed summaries must be in English.
Summary may optionally use a target noun prefix: `[TAG] <target>: <summary>`.
Allowed targets are `docs`, `test`, `ci`, `deps`, `api`, `schema`, and `infra`.
If target syntax is used, target must be wrapped in angle brackets and must be
from the allowed target list.
Targets are summary nouns, not commit tags.
For grouped notes in monorepos, package/workspace labels can appear as section
headers outside each message line.
For non-monorepo repositories, do not use package/workspace section headers; use
`[TAG] summary` directly.
Special rule for `[UPGRADE]`:
- For pure dependency upgrades, `[UPGRADE] deps` is allowed and recommended.
- If the commit also updates IFF artifacts or IPC-related artifacts/calls, the
  summary must be specific about what was updated.

Examples:

- `[FIX] race conditions in createTeam/acceptInvitation/acceptRequest by using
  one transaction`
- `[FIX] <infra>: enforce node-first execution policy`
- `[FIX] <infra>: remove repo-local ignore for transient logs`
- `[ADD] screenshot-upload-fail cross-endpoint test covering uploadFile
  response.ok branch`
- `[REMOVE] deprecated score-field prompt template`
- `[ADD] <docs>: onboarding section for standalone mode`
- `[FIX] <test>: cover uploadFile response.ok branch`

Avoid vague messages such as:

- `[ADD] update things`
- `[FIX] issue`
- `[UPGRADE] dependencies` when the commit includes specific artifact/call
  updates that should be named
- `[ADD] docs: ...` (target syntax without angle brackets)
- `[ADD] <feature>: ...` (target outside allowed target list)
- `- update infra` (untagged body line)
- empty lines between tagged lines

## Pull requests

PR titles have no organization-level format restriction.
Use clear, specific titles, and follow repository-specific rules when provided.

In PR descriptions, summarize:

- what changed
- why it changed
- how it was validated
- known risks or follow-up work

If a repository provides more specific instructions, follow the repository
instructions over this organization baseline.

For Node.js repositories, follow [Node.js Initialization
Baseline](docs/nodejs-initialization.md).
This includes the root `.gitignore` baseline and mode-specific ignore strategy.
For `.gitignore`, use the GitHub default Node.js template as baseline, then
append team conventions.
Organization-approved team conventions include `*.ign*` and `*.gen*`.

## Terminal workflow for large output

For commands with very large output, avoid one-shot shell pipelines like
`command | tail` or `command | grep`.

Node-first policy:

- MUST use Node scripts first for path checks, file operations, output
  processing, and multi-step command execution.
- MAY use direct shell commands only for short, read-only, atomic checks.
- MUST avoid pipeline-based post-processing in long-output tasks.

Use a two-step flow:

1. Capture all command output into a log file.
2. Analyze the captured log in a separate command.

Recommended execution sequence:

1. `node scripts/preflight.mjs --cwd . --require package.json --ensure-dir logs`
2. `node scripts/run-and-capture.mjs --out logs/run.log --cmd "npm run test"`
3. `node scripts/summarize-log.mjs --file logs/run.log --last 120`
4. `node scripts/summarize-log.mjs --file logs/run.log --match "FAIL|ERROR"`

Recommended commands:

- `node scripts/run-and-capture.mjs --out logs/run.log --cmd "npm run test"`
- `node scripts/summarize-log.mjs --file logs/run.log --last 120`
- `node scripts/summarize-log.mjs --file logs/run.log --match "FAIL|ERROR"`

This improves reliability when terminal sessions are non-interactive or have
TTY/pipe limitations.

Directory conventions for Node-first execution:

- Commit reusable execution utilities under `scripts/` only.
- Write runtime logs/results under `logs/` only.
- Exception for this organization-level `.github` repository: avoid adding
  repo-local ignore rules just for transient agent logs; use session memory
  paths or local temp directories.
- Do not commit temporary debug scripts; keep them in session memory locations
  when available.
- Do not place temporary scripts under `.git/` or `.github/`.
- Keep `.github/` for repository hosting metadata (workflows/templates/forms)
  only.
