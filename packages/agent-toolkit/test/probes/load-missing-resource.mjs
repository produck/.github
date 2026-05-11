import { loadTextResource } from '../../bin/command/shared/text-resource.mjs';

const targetFile = process.argv[2];
loadTextResource(targetFile);
