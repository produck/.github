import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const ALLOWED_TAGS = [
  'INIT',
  'ADD',
  'REMOVE',
  'FIX',
  'REFACTOR',
  'UPGRADE',
  'PUBLISH',
];
const ALLOWED_TARGETS = [
  'docs',
  'test',
  'ci',
  'deps',
  'api',
  'schema',
  'infra',
  'fmt',
];
const SECTION_HEADER_RE = /^(?:\*|(?:@[\w.-]+\/)?[\w.-]+):$/;
const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const ROOT_PACKAGE_FILE = path.resolve(
  COMMAND_DIR,
  '../../../../../package.json',
);
const WORKSPACE_SCOPE = 'workspace';
const WILDCARD_SCOPE = '*';
const DEFAULT_COMMENT_CHAR = '#';

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
    return (
      Array.isArray(rootPackage.workspaces) && rootPackage.workspaces.length > 0
    ); /* c8 ignore next */
  } catch {
    return false;
  }
}

function getMonorepoAllowedSectionScopes() {
  /* c8 ignore next */
  if (!fs.existsSync(ROOT_PACKAGE_FILE)) {
    return null;
  }

  let rootPackage;
  /* c8 ignore start */
  try {
    rootPackage = JSON.parse(fs.readFileSync(ROOT_PACKAGE_FILE, 'utf8'));
  } catch {
    return null;
  }
  /* c8 ignore stop */

  /* c8 ignore start */
  if (
    !Array.isArray(rootPackage.workspaces) ||
    rootPackage.workspaces.length === 0
  ) {
    return null;
  }
  /* c8 ignore stop */

  const rootDir = path.dirname(ROOT_PACKAGE_FILE);
  const allowedScopes = new Set([WORKSPACE_SCOPE, WILDCARD_SCOPE]);

  for (const workspaceEntry of rootPackage.workspaces) {
    const workspacePath = path.resolve(rootDir, String(workspaceEntry));
    const workspacePackageJsonPath = path.resolve(
      workspacePath,
      'package.json',
    );

    /* c8 ignore next */
    if (!fs.existsSync(workspacePackageJsonPath)) {
      continue;
    }

    try {
      const workspacePackage = JSON.parse(
        fs.readFileSync(workspacePackageJsonPath, 'utf8'),
      );
      if (
        typeof workspacePackage.name === 'string' &&
        workspacePackage.name.trim() !== ''
      ) {
        allowedScopes.add(workspacePackage.name.trim());
      } /* c8 ignore next */
    } catch {
      continue;
    }
  }

  return allowedScopes;
}

function validateSectionFormat(lines, allowedSectionScopes = null) {
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

      const sectionName = line.trim().slice(0, -1);
      if (allowedSectionScopes && !allowedSectionScopes.has(sectionName)) {
        errors.push(
          `Line ${lineNo}: section header "${line.trim()}" is not allowed in monorepo mode`,
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

function getCommentCharFromConfig() {
  const configured = String(process.env.GIT_COMMENT_CHAR || '').trim();
  return configured || DEFAULT_COMMENT_CHAR;
}

function normalizeCommitMessageLines(raw, commentChar = DEFAULT_COMMENT_CHAR) {
  const normalizedRaw = raw.replace(/\r\n/g, '\n');
  const rawLines = normalizedRaw.split('\n');
  const lines = [];

  for (const line of rawLines) {
    if (commentChar && line.startsWith(commentChar)) {
      continue;
    }
    lines.push(line);
  }

  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  return lines;
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

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = normalizeCommitMessageLines(raw, getCommentCharFromConfig());

  if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
    console.error('Commit message is empty');
    process.exit(2);
  }

  const mustUseSectionHeaders = isMonorepoRoot();
  const allowedSectionScopes = mustUseSectionHeaders
    ? getMonorepoAllowedSectionScopes()
    : null;
  const hasSectionHeaders = lines.some((line) => isSectionHeaderLine(line));

  // [PUBLISH] is generated by lerna and is always a repo-wide tag.
  // In independent mode lerna appends package/version lines after the tag.
  // Neither section headers nor a summary are required for this special tag.
  const isPublishOnlyMessage = /^\[PUBLISH\](\s+.*)?$/.test(lines[0].trim());

  if (isPublishOnlyMessage) {
    console.log('Commit message validation passed');
    return;
  }

  if (mustUseSectionHeaders && !hasSectionHeaders) {
    console.error('Commit message validation failed:');
    console.error(
      '- Line 1: section header is required before tagged lines in monorepo mode',
    );
    process.exit(1);
  }

  const errors = hasSectionHeaders
    ? validateSectionFormat(lines, allowedSectionScopes)
    : [];
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
