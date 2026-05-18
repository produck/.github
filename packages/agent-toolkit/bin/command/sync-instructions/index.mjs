import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import {
  loadTextResource,
  printTextResource,
} from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(COMMAND_DIR, '../../..');
const PUBLISH_ASSETS_ROOT = path.resolve(PACKAGE_ROOT, 'publish-assets');
const PUBLISH_INSTRUCTIONS_ROOT = path.resolve(
  PUBLISH_ASSETS_ROOT,
  'instructions',
);
const PUBLISH_NAMESPACE_ROOT = path.resolve(
  PUBLISH_INSTRUCTIONS_ROOT,
  'produck',
);
const MANAGED_MARKER = '<!-- managed-by: @produck/agent-toolkit -->';
const DEFAULT_NAMESPACE_OUT_DIR = '.github/instructions/produck';
const USER_SPACE_ENTRYPOINT = '.github/copilot-instructions.md';
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const USER_SPACE_BOOTSTRAP_FILE = path.resolve(
  COMMAND_DIR,
  'user-space-bootstrap.md',
);

export function printSyncInstructionsHelp() {
  printTextResource(HELP_FILE);
}

function loadDefaultInstructionsTemplate() {
  if (fs.existsSync(PUBLISH_NAMESPACE_ROOT)) {
    const names = fs
      .readdirSync(PUBLISH_NAMESPACE_ROOT)
      .filter((name) => name.endsWith('.instructions.md'))
      .sort((a, b) => a.localeCompare(b));
    const entries = names.map((name) => {
      const abs = path.resolve(PUBLISH_NAMESPACE_ROOT, name);
      let text = fs.readFileSync(abs, 'utf8');
      if (!text.endsWith('\n')) {
        text = `${text}\n`;
      }
      return {
        fileName: name,
        content: text,
        sourcePath: abs,
      };
    });
    return {
      type: 'dir',
      sourcePath: PUBLISH_NAMESPACE_ROOT,
      entries,
    };
  }

  console.error('No built-in instruction assets found.');
  console.error(
    'Run prepack/publish to generate publish-assets, or pass --source explicitly.',
  );
  process.exit(2);
}

function readInstructionEntriesFromDirectory(sourceDir) {
  const names = fs
    .readdirSync(sourceDir)
    .filter((name) => name.endsWith('.instructions.md'))
    .sort((a, b) => a.localeCompare(b));
  return names.map((name) => {
    const sourcePath = path.resolve(sourceDir, name);
    let content = fs.readFileSync(sourcePath, 'utf8');
    if (!content.endsWith('\n')) {
      content = `${content}\n`;
    }
    return {
      fileName: name,
      content,
      sourcePath,
    };
  });
}

function isManagedFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes(MANAGED_MARKER);
}

function buildUserSpaceBootstrapContent(namespaceDirPath, cwd) {
  const namespaceDisplayPath = path
    .relative(cwd, namespaceDirPath)
    .replace(/\\/g, '/');
  let content = loadTextResource(USER_SPACE_BOOTSTRAP_FILE);
  content = content.replace(
    /\{\{NAMESPACE_GLOB\}\}/g,
    `${namespaceDisplayPath}/*.instructions.md`,
  );
  if (!content.endsWith('\n')) {
    content = `${content}\n`;
  }
  return content;
}

export function runSyncInstructions(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const outArg = getSingle(options, '--out', DEFAULT_NAMESPACE_OUT_DIR);
  const sourceArg = getSingle(options, '--source', '');
  const force = true;
  const dryRun = hasFlag(options, '--dry-run');
  const prune = hasFlag(options, '--prune');

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const defaults = loadDefaultInstructionsTemplate();
  let sourceType = defaults.type;
  let sourceResolved = defaults.sourcePath;
  let entries = defaults.entries;

  if (sourceArg) {
    const sourcePath = path.resolve(cwd, sourceArg);
    if (!fs.existsSync(sourcePath)) {
      console.error(`Source path does not exist: ${sourcePath}`);
      process.exit(2);
    }
    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
      sourceType = 'dir';
      sourceResolved = sourcePath;
      entries = readInstructionEntriesFromDirectory(sourcePath);
      if (entries.length === 0) {
        console.error(
          `No .instructions.md files in source directory: ${sourcePath}`,
        );
        process.exit(2);
      }
    } else {
      sourceType = 'file';
      sourceResolved = sourcePath;
      let content = fs.readFileSync(sourcePath, 'utf8');
      if (!content.endsWith('\n')) {
        content = `${content}\n`;
      }
      entries = [
        {
          fileName: path.basename(sourcePath),
          content,
          sourcePath,
        },
      ];
    }
  }

  const outPath = path.resolve(cwd, outArg);
  const outLooksLikeFile = outArg.endsWith('.md');

  if (outLooksLikeFile && entries.length > 1) {
    console.error(
      'Target --out is a file path but source has multiple instruction files.',
    );
    console.error('Use an output directory for multi-file sync.');
    process.exit(2);
  }

  if (outLooksLikeFile) {
    const entry = entries[0];
    const exists = fs.existsSync(outPath);
    const report = {
      mode: 'single-file',
      cwd,
      sourceType,
      source: sourceResolved,
      outPath,
      exists,
      overwritten: exists,
      dryRun,
      prune: false,
      initializedUserSpaceEntry: false,
      userSpaceEntryPath: null,
    };
    if (dryRun) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      process.exit(0);
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, entry.content, 'utf8');
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const outDir = outPath;
  const planned = entries.map((entry) => {
    return {
      fileName: entry.fileName,
      sourcePath: entry.sourcePath,
      targetPath: path.resolve(outDir, entry.fileName),
      content: entry.content,
    };
  });

  const targetSet = new Set(planned.map((item) => item.targetPath));
  const unchanged = [];
  for (const item of planned) {
    if (fs.existsSync(item.targetPath)) {
      const current = fs.readFileSync(item.targetPath, 'utf8');
      if (current === item.content) {
        unchanged.push(item.targetPath);
      }
    }
  }

  const toWrite = planned.filter(
    (item) => !unchanged.includes(item.targetPath),
  );

  const pruneDeletes = [];
  if (prune && fs.existsSync(outDir)) {
    const existing = fs
      .readdirSync(outDir)
      .filter((name) => name.endsWith('.instructions.md'))
      .map((name) => path.resolve(outDir, name));
    for (const existingPath of existing) {
      if (!targetSet.has(existingPath) && isManagedFile(existingPath)) {
        pruneDeletes.push(existingPath);
      }
    }
  }

  const userSpaceEntryPath = path.resolve(cwd, USER_SPACE_ENTRYPOINT);
  const shouldInitUserSpaceEntry = !fs.existsSync(userSpaceEntryPath);

  const report = {
    mode: 'directory',
    cwd,
    sourceType,
    source: sourceResolved,
    outDir,
    dryRun,
    force,
    prune,
    initializedUserSpaceEntry: shouldInitUserSpaceEntry,
    userSpaceEntryPath,
    files: planned.map((item) => ({
      fileName: item.fileName,
      sourcePath: item.sourcePath,
      targetPath: item.targetPath,
      unchanged: unchanged.includes(item.targetPath),
    })),
    deleteFiles: pruneDeletes,
  };

  if (dryRun) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(0);
  }

  fs.mkdirSync(outDir, { recursive: true });
  for (const item of toWrite) {
    fs.writeFileSync(item.targetPath, item.content, 'utf8');
  }

  if (shouldInitUserSpaceEntry) {
    fs.mkdirSync(path.dirname(userSpaceEntryPath), { recursive: true });
    const userSpaceBootstrap = buildUserSpaceBootstrapContent(outDir, cwd);
    fs.writeFileSync(userSpaceEntryPath, userSpaceBootstrap, 'utf8');
  }

  for (const filePath of pruneDeletes) {
    fs.unlinkSync(filePath);
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
