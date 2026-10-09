import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PUBLISH_INPUT_PATHS,
  collectPublishInputChanges,
} from '../bin/publish-inputs.mjs';

const TAG = '@produck/agent-toolkit@0.11.2';
const BASELINE_PATH =
  '.github/distribution/produck/tooling-version-baseline.json';
const ROOT_PACKAGE_PATH = 'package.json';
const ESLINT_RULES_PATH = 'packages/eslint-rules/package.json';

function createRunGit({
  diffStatus = 0,
  diffStdout = '',
  diffStderr = '',
  revisions = {},
} = {}) {
  const calls = [];

  const runGit = (args, options = {}) => {
    calls.push({ args, options });

    if (args[0] === 'diff') {
      return { status: diffStatus, stdout: diffStdout, stderr: diffStderr };
    }

    const revisionContent = revisions[args[1]];

    if (typeof revisionContent !== 'string') {
      return { status: 128, stdout: '', stderr: 'fatal: bad revision' };
    }

    return { status: 0, stdout: revisionContent, stderr: '' };
  };

  return { runGit, calls };
}

function createRevisions({
  baseline = { tools: {} },
  currentDevDependencies = {},
  previousDevDependencies = {},
  currentEslintRulesVersion = '0.4.2',
  previousEslintRulesVersion = '0.4.2',
} = {}) {
  return {
    [`HEAD:${BASELINE_PATH}`]: JSON.stringify(baseline),
    [`HEAD:${ROOT_PACKAGE_PATH}`]: JSON.stringify({
      devDependencies: currentDevDependencies,
    }),
    [`${TAG}:${ROOT_PACKAGE_PATH}`]: JSON.stringify({
      devDependencies: previousDevDependencies,
    }),
    [`HEAD:${ESLINT_RULES_PATH}`]: JSON.stringify({
      version: currentEslintRulesVersion,
    }),
    [`${TAG}:${ESLINT_RULES_PATH}`]: JSON.stringify({
      version: previousEslintRulesVersion,
    }),
  };
}

describe('PUBLISH_INPUT_PATHS', () => {
  it('should list repository relative paths without leading traversal', () => {
    assert.equal(Array.isArray(PUBLISH_INPUT_PATHS), true);
    assert.equal(PUBLISH_INPUT_PATHS.length > 0, true);
    for (const inputPath of PUBLISH_INPUT_PATHS) {
      assert.equal(inputPath.startsWith('./'), false);
      assert.equal(inputPath.includes('..'), false);
    }
  });
});

describe('collectPublishInputChanges()', () => {
  it('should report no changes when publish inputs are unchanged', () => {
    const { runGit } = createRunGit({ revisions: createRevisions() });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result, { changedPaths: [], changedVersionInputs: [] });
  });

  it('should compare the declared publish input paths against the tag', () => {
    const { runGit, calls } = createRunGit({ revisions: createRevisions() });

    collectPublishInputChanges({ tagName: TAG, runGit });

    const diffCall = calls.find((call) => call.args[0] === 'diff');

    assert.deepEqual(diffCall.args, [
      'diff',
      '--name-only',
      `${TAG}..HEAD`,
      '--',
      ...PUBLISH_INPUT_PATHS,
    ]);
    assert.deepEqual(diffCall.options, { allowFailure: true });
  });

  it('should report changed publish input paths', () => {
    const { runGit } = createRunGit({
      diffStdout: 'lerna.json\n\r\n.gitignore\r\n',
      revisions: createRevisions(),
    });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result.changedPaths, ['lerna.json', '.gitignore']);
    assert.deepEqual(result.changedVersionInputs, []);
  });

  it('should accept a diff exit code of 1 as a completed comparison', () => {
    const { runGit } = createRunGit({
      diffStatus: 1,
      diffStdout: 'lerna.json\n',
      revisions: createRevisions(),
    });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result.changedPaths, ['lerna.json']);
  });

  it('should throw when the diff command fails', () => {
    const { runGit } = createRunGit({
      diffStatus: 2,
      diffStderr: 'fatal: bad object\n',
      revisions: createRevisions(),
    });

    assert.throws(
      () => collectPublishInputChanges({ tagName: TAG, runGit }),
      /Unable to diff publish inputs since .*: fatal: bad object/,
    );
  });

  it('should throw without stderr details when the diff command fails', () => {
    const { runGit } = createRunGit({
      diffStatus: 128,
      diffStderr: '   \n',
      revisions: createRevisions(),
    });

    assert.throws(
      () => collectPublishInputChanges({ tagName: TAG, runGit }),
      new RegExp(`^Error: Unable to diff publish inputs since ${TAG}$`),
    );
  });

  it('should report "auto" tool version bumps from the root package.json', () => {
    const { runGit } = createRunGit({
      revisions: createRevisions({
        baseline: {
          tools: {
            eslint: { version: 'auto' },
            'typescript-eslint': { version: 'auto' },
            typescript: { version: '6.0.3' },
          },
        },
        previousDevDependencies: {
          eslint: '10.8.1',
          'typescript-eslint': '8.66.0',
          typescript: '6.0.3',
        },
        currentDevDependencies: {
          eslint: '10.12.0',
          'typescript-eslint': '8.71.1',
          typescript: '7.0.2',
        },
      }),
    });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result.changedVersionInputs, [
      'package.json (devDependencies: eslint, typescript-eslint)',
    ]);
  });

  it('should ignore tool version changes outside the "auto" entries', () => {
    const { runGit } = createRunGit({
      revisions: createRevisions({
        baseline: { tools: { typescript: { version: '6.0.3' } } },
        previousDevDependencies: { typescript: '6.0.3' },
        currentDevDependencies: { typescript: '7.0.2' },
      }),
    });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result.changedVersionInputs, []);
  });

  it('should ignore unchanged "auto" tool versions', () => {
    const { runGit } = createRunGit({
      revisions: createRevisions({
        baseline: { tools: { eslint: { version: 'auto' } } },
        previousDevDependencies: { eslint: '10.12.0' },
        currentDevDependencies: { eslint: '10.12.0' },
      }),
    });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result.changedVersionInputs, []);
  });

  it('should report path and version inputs together', () => {
    const { runGit } = createRunGit({
      revisions: createRevisions({
        baseline: {
          tools: {
            eslint: { version: 'auto' },
            typescript: { version: '6.0.3' },
          },
        },
        previousDevDependencies: { eslint: '10.8.1', typescript: '6.0.3' },
        currentDevDependencies: { eslint: '10.12.0', typescript: '6.0.3' },
        currentEslintRulesVersion: '0.4.3',
      }),
    });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result.changedVersionInputs, [
      'package.json (devDependencies: eslint)',
      'packages/eslint-rules/package.json (version)',
    ]);
    assert.deepEqual(result.changedPaths, []);
  });

  it('should ignore a baseline without a usable tools object', () => {
    const { runGit: withoutTools } = createRunGit({
      revisions: createRevisions({
        baseline: { schemaVersion: 1 },
        previousDevDependencies: { eslint: '10.8.1' },
        currentDevDependencies: { eslint: '10.12.0' },
      }),
    });
    const { runGit: withScalarTools } = createRunGit({
      revisions: createRevisions({
        baseline: { tools: 'nope' },
        previousDevDependencies: { eslint: '10.8.1' },
        currentDevDependencies: { eslint: '10.12.0' },
      }),
    });

    assert.deepEqual(
      collectPublishInputChanges({ tagName: TAG, runGit: withoutTools })
        .changedVersionInputs,
      [],
    );
    assert.deepEqual(
      collectPublishInputChanges({ tagName: TAG, runGit: withScalarTools })
        .changedVersionInputs,
      [],
    );
  });

  it('should ignore unusable baseline tool entries', () => {
    const { runGit } = createRunGit({
      revisions: createRevisions({
        baseline: { tools: { eslint: null } },
        previousDevDependencies: { eslint: '10.8.1' },
        currentDevDependencies: { eslint: '10.12.0' },
      }),
    });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result.changedVersionInputs, []);
  });

  it('should report @produck/eslint-rules version changes', () => {
    const { runGit } = createRunGit({
      revisions: createRevisions({
        currentEslintRulesVersion: '0.4.3',
      }),
    });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result.changedVersionInputs, [
      'packages/eslint-rules/package.json (version)',
    ]);
  });

  it('should ignore @produck/eslint-rules when it is absent from both revisions', () => {
    const revisions = createRevisions();
    delete revisions[`HEAD:${ESLINT_RULES_PATH}`];
    delete revisions[`${TAG}:${ESLINT_RULES_PATH}`];
    const { runGit } = createRunGit({ revisions });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result.changedVersionInputs, []);
  });

  it('should treat a missing revision as a changed input', () => {
    const revisions = createRevisions({
      baseline: { tools: { eslint: { version: 'auto' } } },
      currentDevDependencies: { eslint: '10.12.0' },
    });
    delete revisions[`${TAG}:${ROOT_PACKAGE_PATH}`];
    const { runGit } = createRunGit({ revisions });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result.changedVersionInputs, [
      'package.json (devDependencies: eslint)',
    ]);
  });

  it('should treat invalid revision content as a changed input', () => {
    const { runGit } = createRunGit({
      revisions: {
        ...createRevisions({
          baseline: { tools: { eslint: { version: 'auto' } } },
          previousDevDependencies: { eslint: '10.8.1' },
        }),
        [`HEAD:${ROOT_PACKAGE_PATH}`]: '{ not json',
      },
    });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result.changedVersionInputs, [
      'package.json (devDependencies: eslint)',
    ]);
  });

  it('should treat a missing devDependencies field as empty', () => {
    const { runGit } = createRunGit({
      revisions: {
        ...createRevisions({
          baseline: { tools: { eslint: { version: 'auto' } } },
        }),
        [`HEAD:${ROOT_PACKAGE_PATH}`]: JSON.stringify({
          devDependencies: { eslint: '10.12.0' },
        }),
        [`${TAG}:${ROOT_PACKAGE_PATH}`]: JSON.stringify({ name: 'root' }),
      },
    });

    const result = collectPublishInputChanges({ tagName: TAG, runGit });

    assert.deepEqual(result.changedVersionInputs, [
      'package.json (devDependencies: eslint)',
    ]);
  });
});
