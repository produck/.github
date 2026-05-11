import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('eslint').Linter.Config} */
export const config = {
	linterOptions: {
		noInlineConfig: true,
	},
	rules: {
		'indent': ['error', 2],
		'linebreak-style': ['error', 'unix'],
		'quotes': ['error', 'single'],
		'semi': ['error', 'always'],
		'comma-dangle': ['error', 'always-multiline'],
	},
};

/**
 * Generate an ESLint config that excludes paths listed in .gitignore
 * Requires @eslint/config-helpers as peer dependency
 */
export async function excludeGitIgnore(eslintConfigPath) {
	const { includeIgnoreFile } = await import('@eslint/config-helpers');
	const __filename = fileURLToPath(eslintConfigPath);
	const __dirname = path.dirname(__filename);
	const gitignorePath = path.resolve(__dirname, '.gitignore');

	return includeIgnoreFile(gitignorePath, {
		name: 'gitignore',
		gitignoreResolution: true,
	});
}
