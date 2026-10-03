/**
 * OpenAPI generator (masterplan/01_specs.md §14.9; blueprint step 33; AC-56).
 *
 * Writes `serializeOpenApiDocument(createOpenApiDocument())` to packages/shared/openapi/openapi.json.
 * Deterministic: the document is built from constants and zod schemas only (no clock, no RNG,
 * no network), so a second run leaves the file byte-identical. test/openapi.test.ts fails when
 * the committed file differs from the module.
 *
 * Run: `npm run openapi:gen -w @dems/shared`. Inside the Claude sandbox the tsx CLI fails with
 * listen EPERM (its IPC socket); run `node --import tsx scripts/gen-openapi.ts` from
 * packages/shared instead (D49).
 *
 * `--check` writes nothing and exits 1 when the file is missing or stale (for CI).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenApiDocument, listOpenApiOperations, serializeOpenApiDocument } from '../src/api/openapi';

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OPENAPI_JSON_PATH = resolve(PACKAGE_DIR, 'openapi', 'openapi.json');

/** The exact text openapi.json must hold. */
export function renderOpenApiJson(): string {
  return serializeOpenApiDocument(createOpenApiDocument());
}

function main(argv: readonly string[]): number {
  const text = renderOpenApiJson();
  const shown = relative(process.cwd(), OPENAPI_JSON_PATH) || OPENAPI_JSON_PATH;
  const current = existsSync(OPENAPI_JSON_PATH) ? readFileSync(OPENAPI_JSON_PATH, 'utf8') : null;
  if (argv.includes('--check')) {
    if (current === text) {
      console.log(`${shown} is up to date`);
      return 0;
    }
    console.error(`${shown} is ${current === null ? 'missing' : 'stale'}: run npm run openapi:gen -w @dems/shared`);
    return 1;
  }
  if (current !== text) {
    mkdirSync(dirname(OPENAPI_JSON_PATH), { recursive: true });
    writeFileSync(OPENAPI_JSON_PATH, text);
  }
  const operations = listOpenApiOperations(createOpenApiDocument()).length;
  console.log(`${current === text ? 'unchanged' : 'wrote'} ${shown} (${operations} operations, ${Buffer.byteLength(text)} bytes)`);
  return 0;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    // A generator failure must be visible in CI logs with its stack; nothing was written.
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        source: 'scripts/gen-openapi.ts',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
    process.exitCode = 1;
  }
}
