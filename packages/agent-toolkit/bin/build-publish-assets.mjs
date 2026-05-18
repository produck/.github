#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');
const SOURCE_DIR = path.resolve(REPO_ROOT, '.github/distribution/produck');
const OUTPUT_DIR = path.resolve(
  PACKAGE_ROOT,
  'publish-assets/instructions/produck',
);
const SOURCE_TOOLING_BASELINE_PATH = path.resolve(
  SOURCE_DIR,
  'tooling-version-baseline.json',
);
const OUTPUT_TOOLING_BASELINE_PATH = path.resolve(
  OUTPUT_DIR,
  'tooling-version-baseline.json',
);
const SOURCE_GITATTRIBUTES_PATH = path.resolve(REPO_ROOT, '.gitattributes');
const SOURCE_GITIGNORE_PATH = path.resolve(REPO_ROOT, '.gitignore');
const SOURCE_PRETTIERRC_PATH = path.resolve(REPO_ROOT, '.prettierrc');
const SOURCE_PRETTIERIGNORE_PATH = path.resolve(REPO_ROOT, '.prettierignore');
const SOURCE_LERNA_PATH = path.resolve(REPO_ROOT, 'lerna.json');
const OUTPUT_GITATTRIBUTES_PATH = path.resolve(
  PACKAGE_ROOT,
  'publish-assets/gitattributes',
);
const OUTPUT_GITIGNORE_PATH = path.resolve(
  PACKAGE_ROOT,
  'publish-assets/gitignore',
);
const OUTPUT_PRETTIERRC_PATH = path.resolve(
  PACKAGE_ROOT,
  'publish-assets/prettierrc',
);
const OUTPUT_PRETTIERIGNORE_PATH = path.resolve(
  PACKAGE_ROOT,
  'publish-assets/prettierignore',
);
const OUTPUT_LERNA_PATH = path.resolve(
  PACKAGE_ROOT,
  'publish-assets/lerna.json',
);
const LEGACY_OUTPUT_PATH = path.resolve(
  PACKAGE_ROOT,
  'publish-assets/instructions/org.instructions.md',
);
const MANAGED_MARKER = '<!-- managed-by: @produck/agent-toolkit -->';

function normalize(text) {
  return text.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

function readFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    return '';
  }
  return match[1];
}

function validateSourceFile(fileName, text) {
  const frontmatter = readFrontmatter(text);
  if (!frontmatter) {
    throw new Error(`Missing frontmatter in source file: ${fileName}`);
  }
  if (!/^applyTo:\s*["'][^"']+["']\s*$/m.test(frontmatter)) {
    throw new Error(`Missing applyTo in source file: ${fileName}`);
  }
  if (!text.includes(MANAGED_MARKER)) {
    throw new Error(`Missing managed marker in source file: ${fileName}`);
  }
}

function readAndValidateToolingBaseline() {
  if (!fs.existsSync(SOURCE_TOOLING_BASELINE_PATH)) {
    throw new Error(
      `Missing tooling baseline source file: ${SOURCE_TOOLING_BASELINE_PATH}`,
    );
  }

  let baseline;
  try {
    baseline = JSON.parse(
      fs.readFileSync(SOURCE_TOOLING_BASELINE_PATH, 'utf8'),
    );
  } catch {
    throw new Error(
      `Invalid tooling baseline JSON: ${SOURCE_TOOLING_BASELINE_PATH}`,
    );
  }

  const c8Version = baseline?.tools?.c8?.version;
  const lernaVersion = baseline?.tools?.lerna?.version;
  const coverageScriptTemplate = baseline?.coverage?.scriptTemplate;

  if (typeof baseline.schemaVersion !== 'number') {
    throw new Error(
      `Invalid tooling baseline schemaVersion in: ${SOURCE_TOOLING_BASELINE_PATH}`,
    );
  }

  if (typeof c8Version !== 'string' || c8Version.trim() === '') {
    throw new Error(
      `Invalid tools.c8.version in: ${SOURCE_TOOLING_BASELINE_PATH}`,
    );
  }

  if (typeof lernaVersion !== 'string' || lernaVersion.trim() === '') {
    throw new Error(
      `Invalid tools.lerna.version in: ${SOURCE_TOOLING_BASELINE_PATH}`,
    );
  }

  if (
    typeof coverageScriptTemplate !== 'string' ||
    coverageScriptTemplate.trim() === ''
  ) {
    throw new Error(
      `Invalid coverage.scriptTemplate in: ${SOURCE_TOOLING_BASELINE_PATH}`,
    );
  }

  const eslintRulesPkgPath = path.resolve(
    PACKAGE_ROOT,
    '../eslint-rules/package.json',
  );
  if (fs.existsSync(eslintRulesPkgPath)) {
    const eslintRulesPkg = JSON.parse(
      fs.readFileSync(eslintRulesPkgPath, 'utf8'),
    );
    const version = eslintRulesPkg.version;
    if (typeof version === 'string' && version.trim()) {
      baseline.tools['@produck/eslint-rules'] = {
        version,
        policy: 'pinned',
        allowLatest: false,
      };
    }
  }
  return `${JSON.stringify(baseline, null, 2)}\n`;
}

function readSourceEntries() {
  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Missing source directory: ${SOURCE_DIR}`);
  }

  const fileNames = fs
    .readdirSync(SOURCE_DIR)
    .filter((name) => name.endsWith('.instructions.md'))
    .sort((a, b) => a.localeCompare(b));

  if (fileNames.length === 0) {
    throw new Error(`No source instruction files in: ${SOURCE_DIR}`);
  }

  return fileNames.map((fileName) => {
    const sourcePath = path.resolve(SOURCE_DIR, fileName);
    const text = normalize(fs.readFileSync(sourcePath, 'utf8'));
    validateSourceFile(fileName, text);
    return {
      fileName,
      sourcePath,
      text,
    };
  });
}

function cleanStaleManagedFiles(expectedNames) {
  const existing = fs
    .readdirSync(OUTPUT_DIR)
    .filter((name) => name.endsWith('.instructions.md'));
  for (const name of existing) {
    if (expectedNames.has(name)) {
      continue;
    }
    const filePath = path.resolve(OUTPUT_DIR, name);
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(MANAGED_MARKER)) {
      fs.unlinkSync(filePath);
    }
  }
}

function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(OUTPUT_GITATTRIBUTES_PATH), { recursive: true });

  const sourceEntries = readSourceEntries();
  const expectedNames = new Set(sourceEntries.map((entry) => entry.fileName));

  for (const entry of sourceEntries) {
    const outPath = path.resolve(OUTPUT_DIR, entry.fileName);
    fs.writeFileSync(outPath, entry.text, 'utf8');
    process.stdout.write(`Generated ${outPath} from ${entry.sourcePath}\n`);
  }

  const toolingBaselineText = readAndValidateToolingBaseline();
  fs.writeFileSync(OUTPUT_TOOLING_BASELINE_PATH, toolingBaselineText, 'utf8');
  process.stdout.write(
    `Generated ${OUTPUT_TOOLING_BASELINE_PATH} from ${SOURCE_TOOLING_BASELINE_PATH}\n`,
  );

  if (!fs.existsSync(SOURCE_GITATTRIBUTES_PATH)) {
    throw new Error(
      `Missing source .gitattributes: ${SOURCE_GITATTRIBUTES_PATH}`,
    );
  }
  if (!fs.existsSync(SOURCE_GITIGNORE_PATH)) {
    throw new Error(`Missing source .gitignore: ${SOURCE_GITIGNORE_PATH}`);
  }
  if (!fs.existsSync(SOURCE_PRETTIERRC_PATH)) {
    throw new Error(`Missing source .prettierrc: ${SOURCE_PRETTIERRC_PATH}`);
  }
  if (!fs.existsSync(SOURCE_PRETTIERIGNORE_PATH)) {
    throw new Error(
      `Missing source .prettierignore: ${SOURCE_PRETTIERIGNORE_PATH}`,
    );
  }
  if (!fs.existsSync(SOURCE_LERNA_PATH)) {
    throw new Error(`Missing source lerna.json: ${SOURCE_LERNA_PATH}`);
  }

  fs.writeFileSync(
    OUTPUT_GITATTRIBUTES_PATH,
    normalize(fs.readFileSync(SOURCE_GITATTRIBUTES_PATH, 'utf8')),
    'utf8',
  );
  process.stdout.write(
    `Generated ${OUTPUT_GITATTRIBUTES_PATH} from ${SOURCE_GITATTRIBUTES_PATH}\n`,
  );

  fs.writeFileSync(
    OUTPUT_GITIGNORE_PATH,
    normalize(fs.readFileSync(SOURCE_GITIGNORE_PATH, 'utf8')),
    'utf8',
  );
  process.stdout.write(
    `Generated ${OUTPUT_GITIGNORE_PATH} from ${SOURCE_GITIGNORE_PATH}\n`,
  );

  fs.writeFileSync(
    OUTPUT_PRETTIERRC_PATH,
    normalize(fs.readFileSync(SOURCE_PRETTIERRC_PATH, 'utf8')),
    'utf8',
  );
  process.stdout.write(
    `Generated ${OUTPUT_PRETTIERRC_PATH} from ${SOURCE_PRETTIERRC_PATH}\n`,
  );

  fs.writeFileSync(
    OUTPUT_PRETTIERIGNORE_PATH,
    normalize(fs.readFileSync(SOURCE_PRETTIERIGNORE_PATH, 'utf8')),
    'utf8',
  );
  process.stdout.write(
    `Generated ${OUTPUT_PRETTIERIGNORE_PATH} from ${SOURCE_PRETTIERIGNORE_PATH}\n`,
  );

  fs.writeFileSync(
    OUTPUT_LERNA_PATH,
    normalize(fs.readFileSync(SOURCE_LERNA_PATH, 'utf8')),
    'utf8',
  );
  process.stdout.write(
    `Generated ${OUTPUT_LERNA_PATH} from ${SOURCE_LERNA_PATH}\n`,
  );

  cleanStaleManagedFiles(expectedNames);

  if (fs.existsSync(LEGACY_OUTPUT_PATH)) {
    fs.unlinkSync(LEGACY_OUTPUT_PATH);
    process.stdout.write(`Removed legacy ${LEGACY_OUTPUT_PATH}\n`);
  }
}

run();
