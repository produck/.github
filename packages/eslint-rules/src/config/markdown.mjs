import markdownPlugin from '@eslint/markdown';

/** @type {import('eslint').Linter.Config} */
export const markdown = {
  files: ['**/*.md'],
  plugins: { markdown: markdownPlugin },
  language: 'markdown/gfm',
  extends: ['markdown/recommended'],
};
