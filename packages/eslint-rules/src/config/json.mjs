import jsonPlugin from '@eslint/json';

/** @type {import('eslint').Linter.Config} */
export const json = {
  files: ['**/*.json'],
  ignores: ['**/package-lock.json'],
  plugins: { json: jsonPlugin },
  language: 'json/json',
  extends: ['json/recommended'],
};
