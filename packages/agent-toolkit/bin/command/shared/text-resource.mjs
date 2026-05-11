import fs from 'node:fs';

export function loadTextResource(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`Resource file not found: ${filePath}`);
    process.exit(2);
  }

  return fs.readFileSync(filePath, 'utf8');
}

export function printTextResource(filePath) {
  let content = loadTextResource(filePath);
  if (!content.endsWith('\n')) {
    content = `${content}\n`;
  }

  process.stdout.write(content);
}
