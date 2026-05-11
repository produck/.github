import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/config-helpers';

/** @type {import('eslint').Linter.Config} */
export const config = {
  linterOptions: {
    noInlineConfig: true,
  },
  rules: {
    indent: ['error', 2],
    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single'],
    semi: ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
  },
};

/**
 * Generate an ESLint config that excludes paths listed in .gitignore
 * @param eslintConfigPath - Pass import.meta.url to locate .gitignore relative to project root
 */
export function excludeGitIgnore(eslintConfigPath) {
  const __filename = fileURLToPath(eslintConfigPath);
  const __dirname = path.dirname(__filename);
  const gitignorePath = path.resolve(__dirname, '.gitignore');

  return includeIgnoreFile(gitignorePath, {
    name: 'gitignore',
    gitignoreResolution: true,
  });
}
