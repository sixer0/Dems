// Task 4 row 89 (caution C-8 of review 086): the ONE resolve hook of a test start of `src/index.ts`.
//
// It replaces TWO imports OF THE ENTRY FILE ONLY (the parent must be `src/index.ts` itself; every other importer of the
// same modules gets the product's): `./plugins/config` by `config.ts` here (the configuration of a throw-away clone,
// handed over the IPC channel - so the started Core never opens the repository's connection file and never connects to
// the database its port names) and `./plugins/logger` by `logger.ts` here (the product's logger module with ONE value
// replaced: the path of the error log, a temporary file). Every other line of the entry runs as written.
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENTRY = pathToFileURL(resolvePath(HERE, '../../../src/index.ts')).href;
const REPLACED = Object.freeze({
  './plugins/config': pathToFileURL(resolvePath(HERE, 'config.ts')).href,
  './plugins/logger': pathToFileURL(resolvePath(HERE, 'logger.ts')).href,
});

export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL === ENTRY && Object.hasOwn(REPLACED, specifier)) return { url: REPLACED[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
