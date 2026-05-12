import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const ALLOWED_TAGS = ['INIT', 'ADD', 'REMOVE', 'FIX', 'REFACTOR', 'UPGRADE', 'PUBLISH'];
const ALLOWED_TARGETS = ['docs', 'test', 'ci', 'deps', 'api', 'schema', 'infra', 'fmt'];
const SECTION_HEADER_RE = /^(?:@[\w.-]+\/)?[\w.-]+:$/;
const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const ROOT_PACKAGE_FILE = path.resolve(COMMAND_DIR, '../../../../../package.json');

export function printValidateCommitMsgHelp() {
  printTextResource(HELP_FILE);
}

function validateCommitLine(line, lineNo) {
  if (line.trim() === '') {
    return `Line ${lineNo}: empty line is not allowed`;
  }

  const head = line.match(/^\[([A-Z]+)\]\s+/);
  if (!head) {
    return `Line ${lineNo}: must start with [TAG] followed by a space`;
  }

  const tag = head[1];
  if (!ALLOWED_TAGS.includes(tag)) {
    return `Line ${lineNo}: tag [${tag}] is not allowed`;
  }

  const rest = line.slice(head[0].length);
  if (rest.trim() === '') {
    return `Line ${lineNo}: summary is required after tag`;
  }

  const targetMatch = rest.match(/^<([^>]+)>:\s+(.+)$/);
  if (targetMatch) {
    const target = targetMatch[1];
    const summary = targetMatch[2];
    if (!ALLOWED_TARGETS.includes(target)) {
      return `Line ${lineNo}: target <${target}> is not allowed`;
    }
    if (summary.trim() === '') {
      return `Line ${lineNo}: summary is required after target`;
    }
  }

  return null;
}

function isSectionHeaderLine(line) {
  return SECTION_HEADER_RE.test(line.trim());
}

function isMonorepoRoot() {
  if (!fs.existsSync(ROOT_PACKAGE_FILE)) {
    return false;
  }

  try {
    const rootPackage = JSON.parse(fs.readFileSync(ROOT_PACKAGE_FILE, 'utf8'));
    return Array.isArray(rootPackage.workspaces) && rootPackage.workspaces.length > 0;
  } catch {
    return false;
  }
}

function validateSectionFormat(lines) {
  const errors = [];
  let currentSection = '';
  let currentSectionLineNo = 0;
  let currentSectionHasTaggedLine = false;

  for (let i = 0; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const line = lines[i];

    if (line.trim() === '') {
      errors.push(`Line ${lineNo}: empty line is not allowed`);
      continue;
    }

    if (isSectionHeaderLine(line)) {
      if (currentSection && !currentSectionHasTaggedLine) {
        errors.push(
          `Line ${currentSectionLineNo}: section header "${currentSection}" must be followed by at least one tagged line`,
        );
      }

      currentSection = line.trim();
      currentSectionLineNo = lineNo;
      currentSectionHasTaggedLine = false;
      continue;
    }

    if (!currentSection) {
      errors.push(
        `Line ${lineNo}: section header is required before tagged lines when package/workspace sections are used`,
      );
      continue;
    }

    const err = validateCommitLine(line, lineNo);
    if (err) {
      errors.push(err);
      continue;
    }

    currentSectionHasTaggedLine = true;
  }

  if (currentSection && !currentSectionHasTaggedLine) {
    errors.push(
      `Line ${currentSectionLineNo}: section header "${currentSection}" must be followed by at least one tagged line`,
    );
  }

  return errors;
}

export function runValidateCommitMsg(options) {
  const file = getSingle(options, '--file', '');
  if (!file) {
    printValidateCommitMsgHelp();
    process.exit(2);
  }

  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.error(`Message file not found: ${filePath}`);
    process.exit(2);
  }

  const raw = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.endsWith('\n') ? raw.slice(0, -1).split('\n') : raw.split('\n');

  if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
    console.error('Commit message is empty');
    process.exit(2);
  }

  const mustUseSectionHeaders = isMonorepoRoot();
  const hasSectionHeaders = lines.some((line) => isSectionHeaderLine(line));

  if (mustUseSectionHeaders && !hasSectionHeaders) {
    console.error('Commit message validation failed:');
    console.error('- Line 1: section header is required before tagged lines in monorepo mode');
    process.exit(1);
  }

  const errors = hasSectionHeaders ? validateSectionFormat(lines) : [];
  if (!hasSectionHeaders) {
    for (let i = 0; i < lines.length; i += 1) {
      const err = validateCommitLine(lines[i], i + 1);
      if (err) {
        errors.push(err);
      }
    }
  }

  if (errors.length > 0) {
    console.error('Commit message validation failed:');
    for (const err of errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  console.log('Commit message validation passed');
}
