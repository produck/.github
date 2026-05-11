# Commit Convention

Repositories in the `produck` organization use a bracketed TAG style for commit
messages.

## Format

Use this format:

- `[TAG] summary`

Multi-line commit message rule:

- Every non-empty line in the commit message must start with `[TAG]`.
- Do not use untagged bullet lines in commit message body.
- If body details are needed, repeat tagged lines instead of raw bullets.
- `summary` cannot appear as a standalone untagged line.

In monorepo or grouped notes, package/workspace labels can appear outside each
message line (for example section headers like `@scope/pkg`, `workspace`, or
`*`).
The text after `[TAG]` is always the description.
For non-monorepo repositories, do not use package/workspace section headers;
write commit messages directly as `[TAG] summary`.

Allowed tags (fixed whitelist):

- `[INIT]`
- `[ADD]`
- `[REMOVE]`
- `[FIX]`
- `[REFACTOR]`
- `[UPGRADE]`

Legacy-to-canonical mapping (for migration):

- `[ADDED]` -> `[ADD]`
- `[REMOVED]` -> `[REMOVE]`
- `[FIXED]` -> `[FIX]`

When using this style:

- `TAG` must be uppercase and must be one of the allowed tags above.
- Summary must be in English.
- Keep summaries specific and behavior-oriented.
- Summary may include a target noun prefix to express content domain.
- Mention concrete areas when useful (route, endpoint, helper, file, test,
  constraint).
- Prefer one clear tagged change per line when writing grouped summaries.
- `[REFACTOR]` implies potentially breaking updates and should explicitly
  describe impact.
- Special rule for `[UPGRADE]`: use `[UPGRADE] deps` for pure dependency
  upgrades.
- If `[UPGRADE]` also includes IFF artifacts or IPC-related artifacts/calls, the
  summary must explicitly name the updated artifact/call.

Summary target extension (optional):

- Format: `[TAG] <target>: <summary>`
- Allowed targets (fixed whitelist):
	- `docs`: documentation content, guides, comments, and usage notes
	- `test`: test cases, fixtures, assertions, and test tooling
	- `ci`: continuous integration workflows, pipeline steps, and automation jobs
	- `deps`: dependency declarations, lockfiles, and dependency management scripts
	- `api`: externally visible interfaces, route contracts, and client/server API
   behavior
	- `schema`: data model definitions, migration schemas, and validation schema
   changes
	- `infra`: infrastructure and environment provisioning/configuration
- When target syntax is used, `target` must be one of the allowed values above.
- Target must be wrapped in angle brackets (`<target>`) to distinguish it from
  namespace-like identifiers inside summary text.
- Targets are nouns in summary context, not tags.

## Examples

- `[FIX] race conditions in createTeam/acceptInvitation/acceptRequest by
  wrapping checks and writes in one transaction`
- `[FIX] <infra>: enforce node-first execution`
- `[FIX] <infra>: remove repo-local ignore for transient logs`
- `[FIX] <infra>: add policy-repo exception for local agent output`
- `[ADD] shared helper src/Web/Student/Router/Team/membership.mjs for
  student-side team mutation routes`
- `[REFACTOR] remove c8 ignore on Screenshot.mjs response.ok (covered by
  integration test)`
- `[INIT] initialize @tjuamt/eer-score-field-ai-kitchen debug tool`
- `[REMOVE] deprecated score-field prompt template`
- `[UPGRADE] deps`
- `[ADD] <docs>: onboarding section for monorepo mode`
- `[FIX] <test>: stabilize screenshot upload retry assertion`
- `[REFACTOR] <ci>: split lint and test jobs for faster feedback`

## Avoid

Avoid vague or low-signal messages such as:

- `[ADD] update things`
- `[FIX] issue`
- `[UPGRADE] dependencies` when artifact/call updates exist but are not named
- `[ADD] docs: ...` (target syntax without angle brackets)
- `[ADD] <feature>: ...` (target outside allowed whitelist)
- `[added] ...` (non-uppercase tag)
- `[CHANGED] ...` (tag outside whitelist)
- `- remove old script` (untagged body line)
- `summary without tag` (untagged standalone line)

## Notes

- Keep the summary concise and specific.
- Prefer imperative phrasing.
- This document does not restrict PR title format.
