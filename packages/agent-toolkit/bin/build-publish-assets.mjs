#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');
const OUTPUT_DIR = path.resolve(PACKAGE_ROOT, 'publish-assets/instructions/produck');
const LEGACY_OUTPUT_PATH = path.resolve(PACKAGE_ROOT, 'publish-assets/instructions/org.instructions.md');
const SPECS = [
  {
    sourcePath: 'docs/ai-collaboration.md',
    fileName: '00-produck-base.instructions.md',
    applyTo: '**',
  },
  {
    sourcePath: 'docs/nodejs-initialization.md',
    fileName: '10-produck-node.instructions.md',
    applyTo: '**/*.{js,cjs,mjs,ts,tsx,json,yaml,yml}',
  },
  {
    sourcePath: 'docs/commit-convention.md',
    fileName: '20-produck-commit.instructions.md',
    applyTo: '**',
  },
];
const MANAGED_MARKER = '<!-- managed-by: @produck/agent-toolkit -->';

function normalize(text) {
  return text.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

function loadSource(relativePath) {
  const fullPath = path.resolve(REPO_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing source file: ${relativePath}`);
  }
  const text = normalize(fs.readFileSync(fullPath, 'utf8'));
  return {
    fullPath,
    text,
  };
}

function buildContent(spec) {
  const source = loadSource(spec.sourcePath);
  const header = [
    '---',
    `applyTo: "${spec.applyTo}"`,
    '---',
    '',
    MANAGED_MARKER,
    `<!-- source: ${spec.sourcePath} -->`,
    '',
  ].join('\n');
  return normalize(`${header}${source.text}`);
}

function cleanStaleManagedFiles() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    return;
  }
  const expected = new Set(SPECS.map((spec) => spec.fileName));
  const existing = fs.readdirSync(OUTPUT_DIR).filter((name) => name.endsWith('.instructions.md'));
  for (const name of existing) {
    if (expected.has(name)) {
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

  for (const spec of SPECS) {
    const content = buildContent(spec);
    const outPath = path.resolve(OUTPUT_DIR, spec.fileName);
    fs.writeFileSync(outPath, content, 'utf8');
    process.stdout.write(`Generated ${outPath}\n`);
  }

  cleanStaleManagedFiles();

  if (fs.existsSync(LEGACY_OUTPUT_PATH)) {
    fs.unlinkSync(LEGACY_OUTPUT_PATH);
    process.stdout.write(`Removed legacy ${LEGACY_OUTPUT_PATH}\n`);
  }
}

run();
