# @produck/eslint-rules

Shared ESLint flat config presets for the Produck organization.

## Installation

```sh
npm install --save-dev @produck/eslint-rules
```

## Requirements

- **Node.js** >= 18.0.0
- **ESLint** >= 10.3.0 (peer dependency)
- **@eslint/config-helpers** >= 0.6.0 (peer dependency, required by
  `excludeGitIgnore`)
- **@eslint/json** >= 1.2.0 (peer dependency, required by `config.json`)
- **@eslint/markdown** >= 8.0.1 (peer dependency, required by `config.markdown`)

## Exports

### `config.ecma`

ESLint flat config for JS/TS files (`**/*.{js,mjs,cjs,ts,mts}`) with Produck
coding conventions (2-space indent, single quotes, unix linebreaks, etc.).

### `config.json`

ESLint flat config for JSON files using `@eslint/json` recommended rules.
Ignores `package-lock.json`.

### `config.markdown`

ESLint flat config for Markdown files using `@eslint/markdown` GFM rules.

### `excludeGitIgnore(eslintConfigPath)`

Generate an ESLint config that excludes paths listed in the `.gitignore` file.

- `eslintConfigPath` — Pass `import.meta.url` to locate `.gitignore` relative
  to the project root.

## Usage

```js
import * as ProduckRule from '@produck/eslint-rules';

export default [
  ProduckRule.config.ecma,
  ProduckRule.config.json,
  ProduckRule.config.markdown,
  ProduckRule.excludeGitIgnore(import.meta.url),
  // repository-specific overrides
];
```

Or use with `defineConfig` if you prefer the standard ESLint helper:

```js
import { defineConfig } from 'eslint/config';
import * as ProduckRule from '@produck/eslint-rules';

export default defineConfig([
  ProduckRule.config.ecma,
  ProduckRule.config.json,
  ProduckRule.config.markdown,
  ProduckRule.excludeGitIgnore(import.meta.url),
]);
```

## Selective composition

Each config export is a standalone flat config object — you can pick only the
ones you need:

```js
import * as ProduckRule from '@produck/eslint-rules';

export default [
  ProduckRule.config.ecma,
  // custom JSON rules instead of the preset
  {
    files: ['**/*.json'],
    /* ... */
  },
];
```

## License

[MIT](./LICENSE) © Produck
