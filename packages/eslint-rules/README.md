# @produck/eslint-rules

Shared ESLint flat config presets for the Produck organization.

## Usage

```js
import produck from '@produck/eslint-rules';

export default [
  ...produck,
  // repository-specific overrides
];
```

Current package exports a minimal base preset and is intended to evolve with
organization-wide lint conventions.
