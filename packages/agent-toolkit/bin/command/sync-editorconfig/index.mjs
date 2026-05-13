import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const EDITORCONFIG_FILE = '.editorconfig';
const TEMPLATE_FILE = path.resolve(COMMAND_DIR, 'editorconfig.template');

const REQUIRED_EDITORCONFIG_CONTENT = fs.readFileSync(TEMPLATE_FILE, 'utf8');

// Required key-value pairs for validation
const REQUIRED_SECTIONS = {
  root: {
    line: 'root = true',
  },
  '*': {
    keys: {
      charset: 'utf-8',
      indent_style: 'space',
      indent_size: '2',
      trim_trailing_whitespace: 'true',
    },
  },
  '*.{yml,yaml}': {
    keys: {
      indent_style: 'space',
      indent_size: '2',
    },
  },
  '*.md': {
    keys: {
      trim_trailing_whitespace: 'false',
      max_line_length: '80',
    },
  },
};

export function printSyncEditorconfigHelp() {
  printTextResource(HELP_FILE);
}

function parseEditorconfig(content) {
  const sections = {};
  let currentSection = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }

    // Check for section header
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      sections[currentSection] = {};
      continue;
    }

    // Check for root = true
    const rootMatch = trimmed.match(/^root\s*=\s*(.+)$/i);
    if (rootMatch && !currentSection) {
      sections._root = rootMatch[1].trim().toLowerCase();
      continue;
    }

    // Parse key-value pair
    if (currentSection) {
      const kvMatch = trimmed.match(/^([^=]+)\s*=\s*(.+)$/);
      if (kvMatch) {
        sections[currentSection][kvMatch[1].trim().toLowerCase()] = kvMatch[2].trim().toLowerCase();
      }
    }
  }

  return sections;
}

function validateEditorconfig(sections) {
  const mismatches = [];

  // Check root
  if (sections._root !== 'true') {
    mismatches.push({ section: '_root', expected: 'true', actual: sections._root || 'missing' });
  }

  // Check each required section
  for (const [sectionName, config] of Object.entries(REQUIRED_SECTIONS)) {
    if (sectionName === 'root') continue;

    if (!sections[sectionName]) {
      mismatches.push({ section: `[${sectionName}]`, expected: 'present', actual: 'missing' });
      continue;
    }

    if (config.keys) {
      for (const [key, expectedValue] of Object.entries(config.keys)) {
        const actualValue = sections[sectionName][key];
        if (actualValue !== expectedValue) {
          mismatches.push({
            section: `[${sectionName}]`,
            key,
            expected: expectedValue,
            actual: actualValue || 'missing',
          });
        }
      }
    }
  }

  return mismatches;
}

function buildUpdatedContent(existingContent) {
  const existingSections = parseEditorconfig(existingContent);
  const lines = [];

  // Add root if missing
  if (existingSections._root !== 'true') {
    lines.push('root = true');
  }

  // Process each required section
  for (const [sectionName, config] of Object.entries(REQUIRED_SECTIONS)) {
    if (sectionName === 'root') continue;

    const existingSection = existingSections[sectionName] || {};
    const missingKeys = [];

    if (config.keys) {
      for (const [key, expectedValue] of Object.entries(config.keys)) {
        if (existingSection[key] !== expectedValue) {
          missingKeys.push({ key, value: expectedValue });
        }
      }
    }

    if (missingKeys.length > 0 || !existingSections[sectionName]) {
      lines.push('');
      lines.push(`[${sectionName}]`);
      for (const { key, value } of missingKeys) {
        lines.push(`${key} = ${value}`);
      }
    }
  }

  // If no updates needed, return original
  // c8 ignore next 3
  if (lines.length === 0) {
    return existingContent;
  }

  // Append missing entries to existing content
  return existingContent.trimEnd() + lines.join('\n') + '\n';
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
}

export function runSyncEditorconfig(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const check = hasFlag(options, '--check');
  const dryRun = hasFlag(options, '--dry-run') && !check;
  const jsonFile = getSingle(options, '--json', '');
  const mode = check ? 'check' : dryRun ? 'dry-run' : 'sync';

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const editorconfigPath = path.resolve(cwd, EDITORCONFIG_FILE);
  const currentContent = readFileIfExists(editorconfigPath);
  const fileExists = currentContent !== null;

  const sections = currentContent ? parseEditorconfig(currentContent) : {};
  const mismatches = validateEditorconfig(sections);
  const requiresUpdate = mismatches.length > 0 || !fileExists;

  let plannedContent = null;
  if (requiresUpdate) {
    plannedContent = fileExists
      ? buildUpdatedContent(currentContent)
      : REQUIRED_EDITORCONFIG_CONTENT;
  }

  if (mode === 'sync' && requiresUpdate && plannedContent) {
    fs.writeFileSync(editorconfigPath, plannedContent, 'utf8');
  }

  const report = {
    cwd,
    mode,
    ok: true,
    editorconfigPath,
    required: {
      file: EDITORCONFIG_FILE,
    },
    status: {
      fileExistsBefore: fileExists,
      mismatchesBefore: mismatches,
      fileExistsAfter: requiresUpdate && mode === 'sync' ? true : fileExists,
      mismatchesAfter: requiresUpdate && mode === 'sync' ? [] : mismatches,
      updated: requiresUpdate && mode === 'sync',
    },
  };

  if (mode === 'check' && requiresUpdate) {
    report.ok = false;
  }

  if (jsonFile) {
    const outPath = path.resolve(cwd, jsonFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) {
    process.exit(2);
  }
}
