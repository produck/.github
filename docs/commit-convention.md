# Commit Convention

Repositories in the `produck` organization should prefer Conventional Commits for both commit messages and pull request titles when practical.

## Format

Use one of the following formats:

- `type(scope): summary`
- `type: summary`

## Recommended types

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `build`
- `ci`
- `chore`

## Examples

- `feat(auth): add token refresh handling`
- `fix(api): handle empty pagination result`
- `docs(readme): clarify local setup steps`
- `ci(actions): cache pnpm store`
- `chore: update dependencies`

## Avoid

Avoid vague or low-signal messages such as:

- `fix bug`
- `update code`
- `misc changes`
- `refactor stuff`

## Notes

- Keep the summary concise and specific.
- Prefer imperative phrasing.
- Use a scope when it improves clarity.
