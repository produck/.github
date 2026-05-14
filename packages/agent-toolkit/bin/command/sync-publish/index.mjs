import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSingle, hasFlag } from '../shared/args.mjs';
import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');
const LERNA_CONFIG_FILE = 'lerna.json';

const REQUIRED_PUBLISH_CHECK_SCRIPT_KEY = 'produck:publish:check';
const REQUIRED_PUBLISH_CHECK_SCRIPT_VALUE =
  'npm run produck:format && npm run produck:lint && npm run produck:coverage';
const USER_PUBLISH_SCRIPT_KEY = 'publish';
const REQUIRED_PUBLISH_SCRIPT_KEY = 'produck:publish';
const REQUIRED_PUBLISH_SCRIPT_FALLBACK_VALUE = 'npm run produck:publish:check && lerna publish';

const REQUIRED_LERNA_DEFAULT_CONFIG = `${JSON.stringify(
  {
    $schema: 'node_modules/lerna/schemas/lerna-schema.json',
    version: 'independent',
  },
  null,
  2,
)}\n`;

export function printSyncPublishHelp() {
  printTextResource(HELP_FILE);
}

function parseJsonFile(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    console.error(`${label} is not valid JSON: ${filePath}`);
    process.exit(2);
  }
}

function buildRequiredPublishScriptValue(hasUserPublishScript) {
  if (hasUserPublishScript) {
    return 'npm run produck:publish:check && npm run publish --';
  }

  return REQUIRED_PUBLISH_SCRIPT_FALLBACK_VALUE;
}

export function runSyncPublish(options) {
  const cwd = path.resolve(getSingle(options, '--cwd', process.cwd()));
  const check = hasFlag(options, '--check');
  const dryRun = hasFlag(options, '--dry-run') && !check;
  const jsonFile = getSingle(options, '--json', '');
  const mode = check ? 'check' : dryRun ? 'dry-run' : 'sync';

  if (!fs.existsSync(cwd)) {
    console.error(`CWD does not exist: ${cwd}`);
    process.exit(2);
  }

  const lernaConfigPath = path.resolve(cwd, LERNA_CONFIG_FILE);
  const lernaExistedBefore = fs.existsSync(lernaConfigPath);
  let lernaDefaultCreated = false;

  if (!lernaExistedBefore) {
    if (mode === 'sync') {
      fs.writeFileSync(lernaConfigPath, REQUIRED_LERNA_DEFAULT_CONFIG, 'utf8');
      lernaDefaultCreated = true;
    }
  } else {
    const lernaConfig = parseJsonFile(lernaConfigPath, 'lerna.json');

    if (typeof lernaConfig.version !== 'string') {
      console.error(`lerna.json must have a "version" field: ${lernaConfigPath}`);
      process.exit(2);
    }
  }

  const rootPackageJsonPath = path.resolve(cwd, 'package.json');
  if (!fs.existsSync(rootPackageJsonPath)) {
    console.error(`Root package.json does not exist: ${rootPackageJsonPath}`);
    process.exit(2);
  }

  const pkg = parseJsonFile(rootPackageJsonPath, 'Root package.json');
  const scripts =
    pkg.scripts && typeof pkg.scripts === 'object' && !Array.isArray(pkg.scripts)
      ? { ...pkg.scripts }
      : {};
  const hasUserPublishScript =
    typeof scripts[USER_PUBLISH_SCRIPT_KEY] === 'string' &&
    scripts[USER_PUBLISH_SCRIPT_KEY].trim() !== '';
  const requiredPublishScriptValue = buildRequiredPublishScriptValue(hasUserPublishScript);

  const previousPublishCheck =
    typeof scripts[REQUIRED_PUBLISH_CHECK_SCRIPT_KEY] === 'string'
      ? scripts[REQUIRED_PUBLISH_CHECK_SCRIPT_KEY]
      : null;
  const previousPublish =
    typeof scripts[REQUIRED_PUBLISH_SCRIPT_KEY] === 'string'
      ? scripts[REQUIRED_PUBLISH_SCRIPT_KEY]
      : null;

  const matchesRequiredPublishCheck = previousPublishCheck === REQUIRED_PUBLISH_CHECK_SCRIPT_VALUE;
  const matchesRequiredPublish = previousPublish === requiredPublishScriptValue;
  const lernaRequiresCreation = !lernaExistedBefore && !lernaDefaultCreated;
  const requiresUpdate =
    !matchesRequiredPublishCheck || !matchesRequiredPublish || lernaRequiresCreation;

  if (mode === 'sync' && (!matchesRequiredPublishCheck || !matchesRequiredPublish)) {
    scripts[REQUIRED_PUBLISH_CHECK_SCRIPT_KEY] = REQUIRED_PUBLISH_CHECK_SCRIPT_VALUE;
    scripts[REQUIRED_PUBLISH_SCRIPT_KEY] = requiredPublishScriptValue;
    pkg.scripts = scripts;
    fs.writeFileSync(rootPackageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }

  const report = {
    cwd,
    mode,
    ok: true,
    lernaConfigPath,
    rootPackageJsonPath,
    required: {
      publishCheckScriptKey: REQUIRED_PUBLISH_CHECK_SCRIPT_KEY,
      publishCheckScriptValue: REQUIRED_PUBLISH_CHECK_SCRIPT_VALUE,
      publishScriptKey: REQUIRED_PUBLISH_SCRIPT_KEY,
      publishScriptValue: requiredPublishScriptValue,
    },
    status: {
      hasUserPublishScript,
      lernaExistedBefore,
      lernaDefaultCreated,
      matchesRequiredPublishCheckBefore: matchesRequiredPublishCheck,
      matchesRequiredPublishCheckAfter:
        !matchesRequiredPublishCheck && mode === 'sync' ? true : matchesRequiredPublishCheck,
      matchesRequiredPublishBefore: matchesRequiredPublish,
      matchesRequiredPublishAfter:
        !matchesRequiredPublish && mode === 'sync' ? true : matchesRequiredPublish,
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
