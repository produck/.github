import * as EsLint from 'eslint';

/**
 * Pre-defined ESLint flat config object containing
 * all Produck team coding conventions.
 */
export const config: EsLint.Linter.Config;

/**
 * Generate an ESLint config that excludes paths
 * listed in the project's `.gitignore` file.
 * Requires @eslint/config-helpers as peer dependency.
 *
 * @param eslintConfigPath - Pass `import.meta.url`
 *   to locate the `.gitignore` file relative to
 *   the project root.
 * @returns Promise resolving to ESLint config with gitignore exclusions
 */
export function excludeGitIgnore(
	eslintConfigPath: string,
): Promise<EsLint.Linter.Config>;

