---
applyTo: '**'
---

<!-- managed-by: @produck/agent-toolkit -->
<!-- source: .github/distribution/produck/15-produck-workspace.instructions.md -->

# Workspace Shared Configuration Guide

## Overview

The Produck monorepo provides unified configuration across all packages for consistency and ease of maintenance.

## Shared Configurations

### 1. ESLint Configuration (`eslint.config.mjs`)

**Location:** Root `eslint.config.mjs`

**Applies to:** All JavaScript, TypeScript files

**Rules:**

- Indentation: 2 spaces (error)
- Quotes: Single quotes (error)
- Line endings: Unix (LF) (error)
- Semicolons: Always required (error)
- Trailing commas: Always in multiline (error)
- No inline config allowed: `noInlineConfig: true`
- The listed ESLint rules can be satisfied either by explicit local
  declarations or by inherited shared presets.
- Repositories are not required to redeclare rules locally when those rules are
  already provided by inherited presets.
- If a repository overrides inherited rules, include only the deltas and
  document the rationale.

**Usage in packages:**

```javascript
// packages/my-package/eslint.config.mjs
import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  // Package-specific overrides here
];
```

### 2. TypeScript Configuration (`tsconfig.json`, conditional)

**Location:** Root `tsconfig.json` (only when needed)

**Applies to:** TypeScript packages that opt in

**Decision rule:**

- If the workspace has no TypeScript source files and no package-level need for
  shared TypeScript options, do not create/deploy root `tsconfig.json`.
- If any package uses TypeScript source files or needs centralized strict/type
  options, create root `tsconfig.json` and let TypeScript packages extend it.

**Recommended key settings when present:**

- Target: ES2022
- Strict mode: enabled
- Module resolution: node
- Source maps: enabled
- Declaration files: generated

**Usage in TypeScript packages:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

### 3. Prettier Configuration (`.prettierrc`)

**Location:** Root `.prettierrc`

**Applies to:** All source files

**Rules:**

- Print width: 100 characters
- Tab width: 2 spaces
- Single quotes: true
- Trailing commas: es5
- Arrow parens: always
- Semicolons: true

**Ignored files:** `.prettierignore`

### 4. Git Ignore Configuration (`.gitignore`)

**Location:** Root `.gitignore` (centralized, no package-level overrides)

**Applies to:** All files in the monorepo

**Strategy:** Single source of truth at repository root per monorepo convention

**Rules:**

- Dependencies: `node_modules/`, npm logs
- Coverage: `coverage/`, `.nyc_output/`
- Environment: `.env`, `.env.local`, `.env.*.local`
- Build: `dist/`, `build/`, `out/`, `*.tsbuildinfo`
- OS/Editor: `.DS_Store`, `Thumbs.db`, `.vscode/settings.json`, `.idea/`
- Temporary: `logs/`, `tmp/`, `temp/`
- Generated: `*.gen`, `*.ign` (organization team extensions)

**Why centralized?**

- All packages automatically inherit root patterns
- Single maintenance point
- No package-level overrides allowed
- Per organization baseline: keep ignore rules centralized at repository root whenever possible

## Root Workspace Scripts

### Verification & Quality

```bash
# Type check all packages (optional: only when root tsconfig.json is present)
npm run type-check

# Format and write using the organization format gate
npm run produck:format

# Lint using the organization lint gate
npm run produck:lint

# Run all package tests
npm run test

# Check coverage across packages
npm run produck:coverage
```

### Release & Coverage Tooling

- Release and coverage governance follows
  `10-produck-node.instructions.md`.
- Source of truth for version pinning and script templates remains
  `.github/distribution/produck/tooling-version-baseline.json`.
- For monorepo remediation, use:
  - `npm exec -- agent-toolkit sync-coverage --cwd .`
  - `npm exec -- agent-toolkit sync-git --cwd .`
- Keep workspace wrappers and local scripts consistent with Node baseline
  execution policy.

## Package Integration

### Adding a New Package

1. Create `packages/my-package/` directory
2. Create `packages/my-package/package.json` with workspace configuration
3. Inherit root configs:
   - ESLint: extend `../../eslint.config.mjs`
   - TypeScript (when root `tsconfig.json` exists): extend
     `../../tsconfig.json`
   - Prettier: uses root `.prettierrc` automatically

### Package-Level Overrides

Each package can extend/override shared config:

**ESLint example:**

```javascript
import rootConfig from '../../eslint.config.mjs';
import onlyWarn from 'eslint-plugin-only-warn';

export default [
  ...rootConfig,
  {
    plugins: { 'only-warn': onlyWarn },
    rules: {
      'custom-rule': 'warn', // package-specific override
    },
  },
];
```

## .editorconfig

**Location:** Root `.editorconfig`

Applies to all editors supporting EditorConfig (VSCode, Vim, Sublime, etc.):

- Charset: utf-8
- Indent: 2 spaces
- Line endings: Unix (LF)
- Trim trailing whitespace

## Dependencies

### Shared devDependencies (Root)

- `@eslint/config-helpers`: ESLint configuration utilities
- `@eslint/js`: ESLint recommended config for JavaScript
- `eslint`: Core linter
- `typescript-eslint`: TypeScript linting support
- `globals`: Global variables (browser, node)
- `prettier`: Code formatter
- `typescript`: TypeScript compiler (when TypeScript is used)
- `@types/node`: Node.js type definitions (when TypeScript is used)

### Peer Dependencies (Packages)

Each package declares peer dependencies for features it uses:

```json
{
  "peerDependencies": {
    "eslint": ">=10.3.0",
    "@eslint/config-helpers": ">=0.6.0"
  }
}
```

## CI/CD Integration

Root scripts are designed for CI pipelines:

```bash
# Pre-commit checks
npm run produck:format
npm run produck:lint
# Optional when root tsconfig.json is used
npm run type-check

# Testing
npm run test
npm run produck:coverage
```

## Best Practices

1. **Always extend shared config** instead of duplicating
2. **Use workspace lint/format scripts** for consistency
3. **Keep package-level overrides minimal** - justify in comments
4. **Update root config** when org-wide rule changes needed
5. **Test configuration changes** with all packages before committing
6. **Do NOT add package-level `.gitignore`** - only root `.gitignore` is allowed; all packages inherit from it

## Troubleshooting

### ESLint complains about missing peer deps

```bash
# Install missing peer dependencies
npm install
```

### Prettier conflicts with ESLint

Root `.prettierrc` and `eslint.config.mjs` are synchronized. If conflict occurs:

1. Check both configs have matching rules
2. Run `npm run produck:format` first, then `npm run produck:lint`

### TypeScript includes too many files (when root tsconfig.json is used)

Update `tsconfig.json` `include` and `exclude` patterns:

```json
{
  "include": ["packages/*/src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### Files are being tracked by git that should be ignored

Verify `.gitignore` patterns:

```bash
# Check if file matches any gitignore pattern
git check-ignore -v <file-or-directory>

# Update only root .gitignore - no package-level .gitignore allowed
# All packages inherit patterns from root
```

Do NOT create package-level `.gitignore` files - they will be removed per organization policy.
