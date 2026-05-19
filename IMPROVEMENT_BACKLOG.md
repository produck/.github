# Improvement Backlog

Strategic improvement recommendations for the `produck` organization policy
repository, drawn from industry, open-source community, organizational
operations, and quality management practice.

This document is a working backlog. Items here are proposed but not yet
adopted as binding policy. Move accepted items into the relevant baseline
document under `.github/distribution/produck/` when implementing.

---

## Tier 1 — Low cost, high return (recommended first)

### 1. Governance fitness tests

Add regression tests for the policy documents themselves under
`packages/agent-toolkit/test/governance.test.mjs`:

- Cross-reference integrity: all markdown links and relative paths resolve.
- Command existence: every `agent-toolkit <subcommand>` referenced in
  instructions must exist in `packages/agent-toolkit/bin/command/`.
- Whitelist consistency: `[TAG]` and `<target>` whitelists match across all
  instruction files.
- Frontmatter schema: validate `applyTo` and metadata format.
- Publish-assets parity: source files at repo root must match the copies under
  `packages/agent-toolkit/publish-assets/`.

Rationale: would have automatically caught the `sync-husky-hooks` defect found
in the recent audit. Pure additive change with no architectural impact.

### 2. Document the file numbering scheme

The current sequence `00 / 10 / 12 / 15 / 20` is unusual and not explained.
Declare an allocation plan in `00-produck-base.instructions.md`:

- `00–09` — cross-language baselines
- `10–19` — language/runtime baselines (Node, Python, Go, …)
- `20–29` — workflow conventions (commit, PR, release)
- `30+` — reserved

### 3. Add `CODEOWNERS`

Every change in this repository is a potential broadcast event affecting all
downstream repositories. Mandatory review is open-source governance hygiene.

Suggested skeleton (adjust team names):

```text
*.instructions.md             @produck/governance-leads
packages/agent-toolkit/**     @produck/toolkit-maintainers
tooling-version-baseline.json @produck/governance-leads
```
### 4. Downstream "quick adopt" section in README

Add a short "Adopting in a downstream repository" block to `README.md` with
a minimal `npm exec -- agent-toolkit ...` sequence so a downstream maintainer
can be productive within five minutes.

---

## Tier 2 — Medium investment, long-term return

### 5. Instruction versioning and changelog

Today only `@produck/agent-toolkit` is versioned via npm. Instruction
documents have no explicit version. Downstream cannot tell which baseline
revision they synced or what changed.

Lightweight option:

- Add `version: YYYY.MM.DD` to each instruction file frontmatter.
- `build-publish-assets` validates versions.
- Maintain a top-level CHANGELOG entry per release.

Define breaking-change semantics:

- BREAKING — remove rules, narrow whitelist, rename fields.
- FEATURE — add rules, widen whitelist.
- FIX — clarify wording, fix typos, repair links.

### 6. Downstream compliance check as a reusable GitHub Action

`enforce-node-baseline` exists but requires downstream to invoke it. Publish a
reusable workflow that downstream repositories can opt in to:

```yaml
# downstream .github/workflows/produck-baseline.yml
jobs:
  baseline:
    uses: produck/.github/.github/workflows/baseline-check.yml@v1
```
### 7. Deprecation lifecycle

No explicit deprecation window today — a rule can simply disappear between
versions. Define a uniform policy:

- Mark with `> [!DEPRECATED]` admonition plus replacement guidance.
- Deprecated rules remain in place for at least one minor release cycle
  before removal.

### 8. Tooling baseline bump process

Bumps to `tooling-version-baseline.json` (c8, lerna, husky, etc.) currently
lack a visible review template. Add a PR template under
`.github/PULL_REQUEST_TEMPLATE/tooling-bump.md` requiring:

- Upstream changelog link.
- List of affected `sync-*` commands.
- Regression evidence (test output, fixture run).

---

## Tier 3 — Maturity polish

### 9. Narrow `applyTo` per file

All five distribution instruction files currently use `applyTo: '**'`, which
broadcasts every baseline into every prompt. Suggested narrowing:

| File           | Suggested `applyTo`                                |
| -------------- | -------------------------------------------------- |
| `00-base`      | `'**'`                                             |
| `10-node`      | `'**/package.json,**/*.{mjs,cjs,js,ts}'`           |
| `12-test`      | `'**/test/**,**/*.test.*'`                         |
| `15-workspace` | `'**/package.json,eslint.config.mjs,.prettierrc'`  |
| `20-commit`    | `'**'` (commit messages, not bound to a file path) |

Expected benefit: ~30% reduction in AI prompt token usage on average.

### 10. Sandbox repository

Maintain an internal `produck/baseline-sandbox` repository. New instruction
changes ride one iteration in the sandbox before merging into `distribution/`.
Avoids "policy directly hits N downstream repositories" risk that is well
known in upstream-style projects.

### 11. Security and supply-chain hygiene

- `SECURITY.md` — vulnerability disclosure channel; relevant because
  `agent-toolkit` performs `sync` operations on consumer repos.
- `.github/dependabot.yml` — automated dependency updates.
- npm publish via OIDC trusted publishing instead of `NPM_TOKEN` secret.

### 12. Observability of `sync-*` commands

Today downstream `sync-*` runs are opaque. Optional additions:

- Each `sync-*` writes a JSON report under `logs/`.
- A combined `agent-toolkit doctor` summarizes sync state, versions, and
  drift.
- Optional opt-in anonymous telemetry (discuss privacy policy first).

### 13. Task-oriented index

Current docs are organized by governance layer (`00/10/12/...`). Add a
reader-oriented index in `README.md`:

- "I want to start a new Node single-package repo" → commands and docs.
- "I want to onboard an existing monorepo" → commands and docs.
- "I want to add a new commit tag" → which file to edit.
- "`agent-toolkit` reports error X" → troubleshooting trail.

---

## Identified risks (worth evaluating)

### A. Circular dependency between `agent-toolkit` and the instructions

Instructions require downstream to use `npm exec -- agent-toolkit`, yet
`agent-toolkit` itself ships those instructions. If `agent-toolkit` breaks,
downstream cannot use `agent-toolkit` to repair it.

Mitigation:

- Document a manual fallback path for emergency recovery.
- Make `enforce-node-baseline` version detection fail-soft.

### B. `publish-assets` is generated, not tracked

`build-publish-assets` runs at npm `prepack`. A bug (for example forgetting to
register a new file in the copy list) silently delivers stale assets
downstream.

Mitigation choices:

- Add a CI step that runs `build-publish-assets` and diffs against source
  files; fail on mismatch.
- Alternatively, track `publish-assets` in git and validate parity in CI.

### C. Single-language assumption

All current policies assume Node.js. Future support for Python or Go would be
disruptive given `10-produck-node` naming. Consider preparing the structure
for multi-language now:

- Reserve sequence ranges in `00-base` numbering plan.
- Decide whether `10-node` becomes `10-language-node` or stays.

### D. No end-to-end contract test between `sync-*` and `enforce-node-baseline`

`agent-toolkit` tests verify each command writes correct files in isolation,
but no test verifies that after running all `sync-*` commands on a fixture
repo, `enforce-node-baseline` exits with code 0.

Mitigation:

- Add a fixture downstream repo under `packages/agent-toolkit/test/`.
- Sequence: scaffold fixture → run all `sync-*` → run
  `enforce-node-baseline --check` → assert success.

---

## Suggested execution order

**Week scope** (compliance and stability backstop):

1. Governance fitness tests (#1).
2. `CODEOWNERS` (#3).
3. End-to-end contract test (#D).

**Month scope**:

4. Instruction versioning and changelog (#5).
5. Downstream GitHub Action (#6).
6. File numbering scheme documented (#2).
7. `publish-assets` parity check (#B).

**Next iteration**:

8. Narrow `applyTo` (#9).
9. Deprecation lifecycle (#7).
10. `SECURITY.md` and Dependabot (#11).

**Long-term evolution**:

11. Sandbox repository (#10).
12. Task-oriented index (#13).
13. Multi-language structure planning (#C).
