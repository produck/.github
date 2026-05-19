import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import * as ProduckRule from '@produck/eslint-rules';

export default [
  { files: ['**/*.{js,mjs,cjs,ts,mts}'] },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ProduckRule.config.ecma,
  ProduckRule.config.json,
  ProduckRule.config.markdown,
  ProduckRule.excludeGitIgnore(import.meta.url),
];
