/**
 * OpenAPI generator (masterplan/01_specs.md §14.9; blueprint step 33; AC-56; backend task
 * 2026-10-04: 01_specs AC-B-11).
 *
 * Writes the document of the committed scope to packages/shared/openapi/openapi.json.
 * Deterministic: the document is built from constants and zod schemas only (no clock, no RNG,
 * no network), so a second run leaves the file byte-identical. test/openapi.test.ts fails when
 * the committed file differs from the module.
 *
 * Run: `npm run openapi:gen -w @dems/shared`. Inside the Claude sandbox the tsx CLI fails with
 * listen EPERM (its IPC socket); run `node --import tsx scripts/gen-openapi.ts` from
 * packages/shared instead (D49).
 *
 * `--check` writes nothing and exits 1 when the file is missing or stale (for CI).
 *
 * Scopes (backend task: 2026-10-04 02_plan §16 CO-3, CO-4; 04_client_integration_spec §11 AR-1).
 * The builder knows two scopes, `offline` (the ten operations a client can call without the Core
 * server) and `all` (every operation of the registry, as the Core server answers it). The
 * committed file holds `OPENAPI_COMMITTED_SCOPE`, which is `all` since the registry is complete
 * (plan row W27, contract C): 75 operations, two security schemes, the server 127.0.0.1:4420,
 * version 0.2.0.
 *
 * The `offline` document is not a file. It is what `createOpenApiDocument()` returns by default,
 * and the web API Reference builds it in the browser from the registry; no app reads
 * openapi.json. test/api-openapi-scope.test.ts holds every section of it to the baseline commit.
 * Every run of this script builds both scopes, so a registry that cannot be turned into either
 * document fails here. `--scope <offline|all> --print` writes that scope's document to stdout and
 * no file.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CoreApiScope } from '../src/api/core-api';
import { createOpenApiDocument, listOpenApiOperations, serializeOpenApiDocument } from '../src/api/openapi';

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OPENAPI_JSON_PATH = resolve(PACKAGE_DIR, 'openapi', 'openapi.json');

/** The scope of the committed openapi.json. */
export const OPENAPI_COMMITTED_SCOPE: CoreApiScope = CoreApiScope.ALL;

const SCOPES = Object.values(CoreApiScope) as readonly CoreApiScope[];

/** The exact text openapi.json must hold (the committed scope), or the text of another scope. */
export function renderOpenApiJson(scope: CoreApiScope = OPENAPI_COMMITTED_SCOPE): string {
  return serializeOpenApiDocument(createOpenApiDocument({ scope }));
}

/** `scope name: n operations` for every scope, the committed one first; building each one is the check that it can be built. */
function describeScopes(): string {
  return [...SCOPES]
    .sort((a, b) => Number(b === OPENAPI_COMMITTED_SCOPE) - Number(a === OPENAPI_COMMITTED_SCOPE))
    .map((scope) => {
      const document = createOpenApiDocument({ scope });
      const count = listOpenApiOperations(document).length;
      const schemes = Object.keys(document.components.securitySchemes ?? {}).length;
      const committed = scope === OPENAPI_COMMITTED_SCOPE ? ' (committed)' : '';
      return `${scope}${committed}: ${count} operations, ${schemes} security schemes, version ${document.info.version}`;
    })
    .join('; ');
}

function scopeArgument(argv: readonly string[]): CoreApiScope | null {
  const index = argv.indexOf('--scope');
  if (index === -1) return null;
  const value = argv[index + 1];
  const scope = SCOPES.find((candidate) => candidate === value);
  if (!scope) throw new Error(`--scope takes one of: ${SCOPES.join(', ')}`);
  return scope;
}

function main(argv: readonly string[]): number {
  const requested = scopeArgument(argv);
  if (argv.includes('--print')) {
    process.stdout.write(renderOpenApiJson(requested ?? OPENAPI_COMMITTED_SCOPE));
    return 0;
  }
  if (requested !== null && requested !== OPENAPI_COMMITTED_SCOPE) {
    console.error(`Only the ${OPENAPI_COMMITTED_SCOPE} scope is written to a file. Add --print to see the ${requested} scope.`);
    return 1;
  }
  const text = renderOpenApiJson();
  const scopes = describeScopes();
  const shown = relative(process.cwd(), OPENAPI_JSON_PATH) || OPENAPI_JSON_PATH;
  const current = existsSync(OPENAPI_JSON_PATH) ? readFileSync(OPENAPI_JSON_PATH, 'utf8') : null;
  if (argv.includes('--check')) {
    if (current === text) {
      console.log(`${shown} is up to date (${scopes})`);
      return 0;
    }
    console.error(`${shown} is ${current === null ? 'missing' : 'stale'}: run npm run openapi:gen -w @dems/shared`);
    return 1;
  }
  if (current !== text) {
    mkdirSync(dirname(OPENAPI_JSON_PATH), { recursive: true });
    writeFileSync(OPENAPI_JSON_PATH, text);
  }
  console.log(`${current === text ? 'unchanged' : 'wrote'} ${shown} (${scopes}; ${Buffer.byteLength(text)} bytes)`);
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
