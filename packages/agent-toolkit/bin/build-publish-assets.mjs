#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '../..');
const SOURCE_DIR = path.resolve(REPO_ROOT, '.github/distribution/produck');
const OUTPUT_DIR = path.resolve(PACKAGE_ROOT, 'publish-assets/instructions/produck');
const LEGACY_OUTPUT_PATH = path.resolve(PACKAGE_ROOT, 'publish-assets/instructions/org.instructions.md');
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
  if (!fs.existsSync(OUTPUT_DIR)) {
    return;
  }
  const existing = fs.readdirSync(OUTPUT_DIR).filter((name) => name.endsWith('.instructions.md'));
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

  const sourceEntries = readSourceEntries();
  const expectedNames = new Set(sourceEntries.map((entry) => entry.fileName));

  for (const entry of sourceEntries) {
    const outPath = path.resolve(OUTPUT_DIR, entry.fileName);
    fs.writeFileSync(outPath, entry.text, 'utf8');
    process.stdout.write(`Generated ${outPath} from ${entry.sourcePath}\n`);
  }

  cleanStaleManagedFiles(expectedNames);

  if (fs.existsSync(LEGACY_OUTPUT_PATH)) {
    fs.unlinkSync(LEGACY_OUTPUT_PATH);
    process.stdout.write(`Removed legacy ${LEGACY_OUTPUT_PATH}\n`);
  }
}

run();
