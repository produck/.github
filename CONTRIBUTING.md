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

## Commit messages

Use Conventional Commits when possible:

- `type(scope): summary`
- `type: summary`

Examples:

- `feat(auth): add token refresh handling`
- `fix(api): handle empty pagination result`
- `docs(readme): clarify local setup steps`

Avoid vague messages such as:

- `fix bug`
- `update code`
- `misc changes`

## Pull requests

Prefer PR titles that also follow Conventional Commits.

In PR descriptions, summarize:

- what changed
- why it changed
- how it was validated
- known risks or follow-up work

If a repository provides more specific instructions, follow the repository instructions over this organization baseline.
