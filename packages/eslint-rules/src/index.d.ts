import * as EsLint from 'eslint';

export declare namespace config {
  /** ESLint flat config for JS/TS files with Produck coding conventions. */
  export const ecma: EsLint.Linter.Config;
  /** ESLint flat config for JSON files using @eslint/json recommended rules. */
  export const json: EsLint.Linter.Config;
  /** ESLint flat config for Markdown files using @eslint/markdown GFM rules. */
  export const markdown: EsLint.Linter.Config;
}

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
