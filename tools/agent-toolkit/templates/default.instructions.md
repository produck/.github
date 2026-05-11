# Organization Collaboration Instructions

This repository follows organization-level AI and engineering rules.

## Required Rules

- Commit message format must follow bracketed TAG policy.
- Keep root .editorconfig aligned with organization baseline:
  - If missing, create from organization sample.
  - If present, add missing required keys only (minimal merge).
- Repository owners generate and own eslint.config.mjs.
- AI must not rewrite full eslint config; only add missing
  @produck/eslint-rules integration as minimal patch.
- Repository-specific ESLint overrides must layer on top of
  @produck/eslint-rules.

## References

- docs/ai-collaboration.md
- docs/commit-convention.md
- docs/nodejs-initialization.md
