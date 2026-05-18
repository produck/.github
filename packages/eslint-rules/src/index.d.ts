import * as EsLint from 'eslint';

/**
 * Pre-defined ESLint flat config object containing
 * all Produck team coding conventions.
 */
export const config: EsLint.Linter.Config;

/**
 * Generate an ESLint config that excludes paths
 * listed in `.gitignore` file.
 *
 * @param eslintConfigPath - Pass import.meta.url to
 * locate `.gitignore` relative to project root.
 */
export function excludeGitIgnore(
  eslintConfigPath: string,
): EsLint.Linter.Config;
