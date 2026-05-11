# Contributing

Thank you for contributing to repositories in the `produck` organization.

## AI collaboration baseline

This organization uses a lightweight set of AI collaboration defaults.

- Default to Chinese for explanations and discussion unless the repository or request requires another language.
- Prefer existing repository patterns over introducing new abstractions.
- Do not invent APIs, packages, configuration keys, commands, environment variables, or files.
- Do not add new dependencies unless necessary and explicitly justified.
- When changing behavior, add or update tests when practical.
- Treat authentication, authorization, secrets, infrastructure, and production configuration as high-risk areas that require human review.

Language conventions:

- Explanations, discussion, and review communication default to Chinese unless the repository or request requires another language.
- Commit messages use English summaries in the bracketed format.
- PR descriptions and issue comments may use Chinese or English, but keep one language per section and keep terminology consistent.
- Code identifiers, filenames, and existing public API names should follow existing repository conventions; do not translate existing symbols.
- User-facing copy should follow the target product locale of the repository/module.

## Commit messages

Use bracketed commit style:

- `[TAG] summary`

Allowed tags are `[INIT]`, `[ADDED]`, `[REMOVED]`, `[FIXED]`, `[REFACTOR]`, and `[UPGRADE]`.
Tags must be uppercase, and bracketed summaries must be in English.
For grouped notes in monorepos, package/workspace labels can appear as section headers outside each message line.
For non-monorepo repositories, do not use package/workspace section headers; use `[TAG] summary` directly.
Special rule for `[UPGRADE]`:
- For pure dependency upgrades, `[UPGRADE] deps` is allowed and recommended.
- If the commit also updates IFF artifacts or IPC-related artifacts/calls, the summary must be specific about what was updated.

Examples:

- `[FIXED] race conditions in createTeam/acceptInvitation/acceptRequest by using one transaction`
- `[ADDED] screenshot-upload-fail cross-endpoint test covering uploadFile response.ok branch`
- `[REMOVED] deprecated score-field prompt template`

Avoid vague messages such as:

- `[ADDED] update things`
- `[FIXED] issue`
- `[UPGRADE] dependencies` when the commit includes specific artifact/call updates that should be named

## Pull requests

PR titles have no organization-level format restriction.
Use clear, specific titles, and follow repository-specific rules when provided.

In PR descriptions, summarize:

- what changed
- why it changed
- how it was validated
- known risks or follow-up work

If a repository provides more specific instructions, follow the repository instructions over this organization baseline.

For Node.js repositories, follow [Node.js Initialization Baseline](docs/nodejs-initialization.md).
