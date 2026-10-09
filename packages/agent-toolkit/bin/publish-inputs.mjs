/**
 * Repository sources whose contents are baked into the published
 * `@produck/agent-toolkit` assets. `scripts/lerna-publish.mjs` force-publishes
 * the toolkit when any of them changed since the latest toolkit release tag.
 *
 * Keep in sync with the source path constants in build-publish-assets.mjs.
 */
export const PUBLISH_INPUT_PATHS = [
  '.github/distribution/produck',
  '.gitattributes',
  '.gitignore',
  '.prettierrc',
  '.prettierignore',
  'lerna.json',
  'eslint.config.mjs',
];

const ROOT_PACKAGE_JSON_PATH = 'package.json';
const ESLINT_RULES_PACKAGE_JSON_PATH = 'packages/eslint-rules/package.json';
const TOOLING_BASELINE_PATH =
  '.github/distribution/produck/tooling-version-baseline.json';

function readJsonAtRevision({ runGit, revision, filePath }) {
  const result = runGit(['show', `${revision}:${filePath}`], {
    allowFailure: true,
  });

  if (result.status !== 0) {
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function listAutoToolNames(baselineJson) {
  const tools = baselineJson?.tools;

  if (!tools || typeof tools !== 'object') {
    return [];
  }

  return Object.entries(tools)
    .filter(([, entry]) => entry?.version === 'auto')
    .map(([toolName]) => toolName);
}

function collectChangedToolVersions({ runGit, tagName }) {
  const autoToolNames = listAutoToolNames(
    readJsonAtRevision({
      runGit,
      revision: 'HEAD',
      filePath: TOOLING_BASELINE_PATH,
    }),
  );

  if (autoToolNames.length === 0) {
    return [];
  }

  const previousPackage = readJsonAtRevision({
    runGit,
    revision: tagName,
    filePath: ROOT_PACKAGE_JSON_PATH,
  });
  const currentPackage = readJsonAtRevision({
    runGit,
    revision: 'HEAD',
    filePath: ROOT_PACKAGE_JSON_PATH,
  });
  const previousDevDeps = previousPackage?.devDependencies ?? {};
  const currentDevDeps = currentPackage?.devDependencies ?? {};

  const changedToolNames = autoToolNames.filter(
    (toolName) => previousDevDeps[toolName] !== currentDevDeps[toolName],
  );

  if (changedToolNames.length === 0) {
    return [];
  }

  return [
    `${ROOT_PACKAGE_JSON_PATH} (devDependencies: ${changedToolNames.join(', ')})`,
  ];
}

function collectChangedEslintRulesVersion({ runGit, tagName }) {
  const previousPackage = readJsonAtRevision({
    runGit,
    revision: tagName,
    filePath: ESLINT_RULES_PACKAGE_JSON_PATH,
  });
  const currentPackage = readJsonAtRevision({
    runGit,
    revision: 'HEAD',
    filePath: ESLINT_RULES_PACKAGE_JSON_PATH,
  });

  if (previousPackage?.version === currentPackage?.version) {
    return [];
  }

  return [`${ESLINT_RULES_PACKAGE_JSON_PATH} (version)`];
}

/**
 * Collects the publish inputs that differ between `tagName` and `HEAD`.
 *
 * Path inputs are compared as files; version inputs are compared as the values
 * the build script resolves into the published tooling version baseline.
 */
export function collectPublishInputChanges({ tagName, runGit }) {
  const diff = runGit(
    ['diff', '--name-only', `${tagName}..HEAD`, '--', ...PUBLISH_INPUT_PATHS],
    { allowFailure: true },
  );

  if (diff.status !== 0 && diff.status !== 1) {
    const stderr = diff.stderr?.trim();
    throw new Error(
      `Unable to diff publish inputs since ${tagName}${stderr ? `: ${stderr}` : ''}`,
    );
  }

  const changedPaths = diff.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return {
    changedPaths,
    changedVersionInputs: [
      ...collectChangedToolVersions({ runGit, tagName }),
      ...collectChangedEslintRulesVersion({ runGit, tagName }),
    ],
  };
}
