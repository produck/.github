import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { printTextResource } from '../shared/text-resource.mjs';

const COMMAND_DIR = path.dirname(fileURLToPath(import.meta.url));
const HELP_FILE = path.resolve(COMMAND_DIR, 'help.txt');

export function printMainHelp() {
  printTextResource(HELP_FILE);
}
