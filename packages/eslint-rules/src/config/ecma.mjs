/** @type {import('eslint').Linter.Config} */
export const ecma = {
  files: ['**/*.{js,mjs,cjs,ts,mts}'],
  linterOptions: {
    noInlineConfig: true,
  },
  rules: {
    curly: ['error', 'all'],
    indent: ['error', 2],
    'linebreak-style': ['error', 'unix'],
    // Keep a readable line-length ruler while staying formatter-friendly.
    'max-len': [
      'warn',
      {
        code: 80,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
        ignoreComments: true,
      },
    ],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
  },
};
