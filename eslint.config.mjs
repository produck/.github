import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import * as ProduckRule from './packages/eslint-rules/src/index.mjs';

export default [
  { files: ['**/*.{js,mjs,cjs,ts,mts}'] },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ProduckRule.config,
  ProduckRule.excludeGitIgnore(import.meta.url),
];
