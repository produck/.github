# Commit Convention

Repositories in the `produck` organization use a bracketed TAG style for commit messages.

## Format

Use this format:

- `[TAG] summary`

In monorepo or grouped notes, package/workspace labels can appear outside each message line (for example section headers like `@scope/pkg`, `workspace`, or `*`).
The text after `[TAG]` is always the description.
For non-monorepo repositories, do not use package/workspace section headers; write commit messages directly as `[TAG] summary`.

Allowed tags (fixed whitelist):

- `[INIT]`
- `[ADDED]`
- `[REMOVED]`
- `[FIXED]`
- `[REFACTOR]`
- `[UPGRADE]`

When using this style:

- `TAG` must be uppercase and must be one of the allowed tags above.
- Summary must be in English.
- Keep summaries specific and behavior-oriented.
- Mention concrete areas when useful (route, endpoint, helper, file, test, constraint).
- Prefer one clear change per line when writing grouped summaries.
- `[REFACTOR]` implies potentially breaking updates and should explicitly describe impact.
- Special rule for `[UPGRADE]`: use `[UPGRADE] deps` for pure dependency upgrades.
- If `[UPGRADE]` also includes IFF artifacts or IPC-related artifacts/calls, the summary must explicitly name the updated artifact/call.

## Examples

- `[FIXED] race conditions in createTeam/acceptInvitation/acceptRequest by wrapping checks and writes in one transaction`
- `[ADDED] shared helper src/Web/Student/Router/Team/membership.mjs for student-side team mutation routes`
- `[REFACTOR] remove c8 ignore on Screenshot.mjs response.ok (covered by integration test)`
- `[INIT] initialize @tjuamt/eer-score-field-ai-kitchen debug tool`
- `[REMOVED] deprecated score-field prompt template`
- `[UPGRADE] deps`

## Avoid

Avoid vague or low-signal messages such as:

- `[ADDED] update things`
- `[FIXED] issue`
- `[UPGRADE] dependencies` when artifact/call updates exist but are not named
- `[added] ...` (non-uppercase tag)
- `[CHANGED] ...` (tag outside whitelist)

## Notes

- Keep the summary concise and specific.
- Prefer imperative phrasing.
- This document does not restrict PR title format.
