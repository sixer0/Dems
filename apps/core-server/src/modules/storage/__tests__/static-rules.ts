/**
 * The static rules of the two module folders of plan row W37 (not a test file; nothing here
 * imports Vitest). `storage/__tests__/static.test.ts` and `network-time/__tests__/static.test.ts`
 * read their folder's production sources as text with the scaffold's scanner and hold them to
 * the patterns below (standing rules M3, M4, M5, M8 of decision D83; row rule 3).
 *
 * Every forbidden text is built from fragments, so that neither this file nor a test file
 * contains it. `PLANTED` holds one text per pattern in which the pattern must be found: a
 * pattern that finds nothing in its own example proves nothing by finding nothing in the code.
 */
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../../test/static/scan';

export interface ModuleSources {
  /** The production files of the folder, sorted by path. */
  readonly all: readonly SourceFile[];
  /** The same files without their comments. */
  readonly code: readonly SourceFile[];
}

/** The production sources of one folder under `src/` (it ends with `/`). */
export function moduleSources(folder: string): ModuleSources {
  const all = readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.startsWith(folder));
  return { all, code: codeOnly(all) };
}

/** `path:line` of every match. */
export const places = (where: readonly SourceFile[], pattern: RegExp): string[] => occurrences(where, pattern);

/** How often the pattern occurs in the files. */
export const count = (where: readonly SourceFile[], pattern: RegExp): number => occurrences(where, pattern).length;

/** Every module specifier a file imports from or re-exports from, in order, without duplicates. */
export function importSources(where: readonly SourceFile[]): string[] {
  const found = new Set<string>();
  for (const file of where) {
    for (const match of file.text.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]|\bimport\s+['"]([^'"]+)['"]/g)) {
      found.add(match[1] ?? match[2] ?? match[3] ?? match[4] ?? '');
    }
  }
  return [...found].sort();
}

const any = (...parts: string[]): RegExp => new RegExp(parts.join('|'), 'g');

/** Row rule 3, ENG-13: the system time in any form, and a timer. */
export const SYSTEM_TIME = any(`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\b`, `\\bDate\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`, `\\bDate\\s*\\.\\s*(?:${'parse'}|${'UTC'})\\b`);
export const TIMER = any(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, `\\bqueue${'Microtask'}\\b`, `\\bprocess\\s*\\.\\s*next${'Tick'}\\b`);
/** Any clock at all: these folders read none; every instant in an answer is the engine's. */
export const ANY_CLOCK = any(`\\b${'clock'}\\b`, `\\.\\s*${'now'}\\s*\\(`);

/** Row rule 3: the host's network state and anything else of the machine. */
export const HOST_MODULE = any(
  `['"](?:node:)?(?:${['os', 'dns', 'net', 'dgram', 'tls', 'http', 'https', 'http2', 'child_process', 'cluster', 'fs', 'worker_threads', 'crypto', 'process'].join('|')})(?:\\/[a-z]+)?['"]`,
  `['"]node:[a-z_/]+['"]`,
);
export const HOST_STATE = any(
  `\\bnetwork${'Interfaces'}\\b`,
  `\\b${'hostname'}\\b`,
  `\\b(?:local|remote)(?:Address|Port)\\b`,
  `\\b${'lookup'}\\s*\\(`,
  `\\bprocess\\s*\\.`,
  `\\b${'navigator'}\\b`,
  `\\bglobalThis\\b`,
  `\\b${'fetch'}\\s*\\(`,
  `\\bnew\\s+(?:Web)?${'Socket'}\\b`,
  `\\bapp\\s*\\.\\s*(?:server|addresses|${'listen'}|listeningOrigin)\\b`,
);

/** M3: who may call is stage 6's. Nothing of a role, a permission, a session or a device is read. */
export const ACCESS_CHECK = any(
  `\\bPermission\\b`,
  `\\bOperatorRole\\b`,
  `\\b${'permissions'}\\b`,
  `\\b${'role'}Has\\b`,
  `\\.\\s*${'role'}\\b`,
  `['"](?:${'OPERATOR'}|${'ANONYMOUS'}|DEVICE)['"]`,
  `\\.\\s*(?:operator|session|device)Id\\b`,
  `\\bprincipal\\s*\\.`,
  `\\b(?:sessionRegistry|deviceResolver|originDecision|authenticationOf|operatorSessionOf)\\b`,
  `\\b(?:decideAccess|permissionGuard|isAccessRule|compileAccessRule)\\b`,
);
/** M3: no denial row, no refusal built here, no hook. */
export const DENIAL = any(`\\b${'ACCESS'}_DENIED\\b`, `\\b${'EXPORT'}_DENIED\\b`, `\\b${'NOT'}_PERMITTED\\b`, `\\b${'FORBIDDEN'}\\b`, `\\bnew\\s+Api${'Failure'}\\b`, `\\bApi${'Failure'}\\b`, `\\bdenial${'Budget'}\\b`);
export const HOOK = any(`\\badd${'Hook'}\\s*\\(`, `\\b(?:onRequest|preParsing|preValidation|preHandler|preSerialization|onSend|onResponse|onError)\\s*:`, `\\bdecorate(?:Request|Reply)?\\s*\\(`);
/** Every use of the request's principal. */
export const PRINCIPAL = any(`\\b${'principal'}\\b`);
/** The one allowed use: handed on, as it is, as the first argument of a hosted command. */
export const PRINCIPAL_HANDED_ON = any(`app\\s*\\.\\s*engine\\s*\\.\\s*command\\(\\s*request\\s*\\.\\s*${'principal'}\\s*,`);

/** M5, M4: no unit of work, no table, no audit path of its own. */
export const OWN_STORAGE = any(
  `\\b${'pipeline'}\\b`,
  `\\baudit${'Writer'}\\b`,
  `\\bunit\\s*\\.`,
  `\\bapp\\s*\\.\\s*${'db'}\\b`,
  `\\.\\s*${'query'}\\s*\\(`,
  `\\b(?:${'INSERT'}|${'UPDATE'}|${'DELETE'}|${'SELECT'}|${'TRUNCATE'})\\s`,
  `\\binsert\\s+into\\b`,
  `\\b${'drizzle'}\\b`,
  `['"]pg['"]`,
  `\\bapp\\s*\\.\\s*${'publish'}\\b`,
);
/** M4: the engine is used through the seam and nothing else of it. */
export const ENGINE_USE = any(`\\bapp\\s*\\.\\s*engine\\s*\\.\\s*([a-zA-Z]+)`);
export const ENGINE_BYPASS = any(
  `\\bengine${'Control'}\\b`,
  `\\b${'simulator'}\\s*\\(`,
  `\\.\\s*${'actions'}\\b`,
  `\\b[a-zA-Z]+${'Transition'}\\b`,
  `\\bcreate${'Sim'}\\b`,
  `\\.\\s*${'pending'}\\s*\\(`,
  `\\b(?:store|sim)\\s*\\.`,
  `\\.\\s*set${'State'}\\s*\\(`,
);

/** What of a request is read. */
export const REQUEST_DATA = any(`\\brequest\\s*\\.\\s*([a-zA-Z]+)`);

/** Never from production code: a slot replaced, a test file imported, the console, the environment, a weak random source. */
export const SLOT_REPLACED = any(`\\b(?:stages|seams)\\s*\\.\\s*(?:${'replace'}|${'provide'})\\s*\\(`);
export const TEST_IMPORT = any(`from\\s+['"][^'"]*__${'tests'}__[^'"]*['"]`, `import\\s*\\(\\s*['"][^'"]*__${'tests'}__`);
export const CONSOLE = any(`\\b${'console'}\\s*\\.`);
export const RANDOM = any(`\\bMath\\s*\\.\\s*${'random'}\\b`, `\\brandom(?:UUID|Bytes|Int)\\b`);
/** A log call: these modules write no line of their own (the request line is the logger's). */
export const LOG_CALL = any(`\\blog\\s*\\.\\s*(?:trace|debug|info|warn|error|fatal)\\s*\\(`, `\\berror${'Log'}\\b`);

/** Routes: built from the registry entry, never from a literal path or a method shorthand. */
export const ROUTE_CALL = any(`\\.\\s*${'route'}\\s*\\(\\s*\\{`);
export const ROUTE_FROM_REGISTRY = any(`\\.\\.\\.routeOfOperation\\(registryEntry\\('([A-Za-z]+)'\\)\\)`);
export const ROUTE_SHORTHAND = any(`\\.\\s*(?:get|post|put|patch|delete|head|options|all)\\s*\\(\\s*['"\`]`);
export const LITERAL_PATH = any(`['"\`]\\/(?:api|ws)\\b`);
export const CATCH = any(`\\bcatch\\b`, `\\.\\s*then\\s*\\(`);

/**
 * For each pattern, texts in which it must be found: one text per alternative of the pattern, so
 * a mistyped alternative shows as a text that is not found.
 */
export const PLANTED: ReadonlyArray<readonly [name: string, pattern: RegExp, texts: readonly string[]]> = [
  ['SYSTEM_TIME', SYSTEM_TIME, [`const a = Date.${'now'}();`, `const b = new Date();`, `const c = Date();`, `const d = performance.${'now'}();`, `process.hr${'time'}.bigint();`, `Date.${'parse'}('x');`, `Date.${'UTC'}(2031, 0, 1);`]],
  ['TIMER', TIMER, [`set${'Timeout'}(() => {}, 1);`, `set${'Interval'}(tick, 5);`, `set${'Immediate'}(run);`, `queue${'Microtask'}(run);`, `process.next${'Tick'}(run);`]],
  ['ANY_CLOCK', ANY_CLOCK, [`const at = app.${'clock'};`, `const at = source.${'now'}();`]],
  [
    'HOST_MODULE',
    HOST_MODULE,
    [`import os from 'node:${'os'}';`, `import { lookup } from '${'dns'}';`, `import net from "${'net'}";`, `import { readFileSync } from 'node:${'fs'}';`, `import x from '${'dns'}/promises';`, `import { hostname } from '${'os'}';`, `import http from '${'http'}';`, `import t from 'node:${'timers'}/promises';`],
  ],
  [
    'HOST_STATE',
    HOST_STATE,
    [`os.network${'Interfaces'}();`, `os.${'hostname'}();`, `socket.localAddress;`, `socket.remotePort;`, `dns.${'lookup'}('a');`, `process.pid;`, `${'navigator'}.onLine;`, `globalThis.x;`, `await ${'fetch'}('http://x');`, `new ${'Socket'}();`, `new Web${'Socket'}(url);`, `app.server.address();`, `app.addresses();`],
  ],
  [
    'ACCESS_CHECK',
    ACCESS_CHECK,
    [
      `Permission.MAINTENANCE`,
      `OperatorRole.SUPERVISOR`,
      `held.${'permissions'}`,
      `${'role'}Has(role, p)`,
      `caller.${'role'} === 'SUPERVISOR'`,
      `caller.kind === '${'OPERATOR'}'`,
      `caller.kind === "${'ANONYMOUS'}"`,
      `caller.operatorId`,
      `caller.sessionId`,
      `caller.deviceId`,
      `request.principal.x`,
      `app.sessionRegistry`,
      `app.deviceResolver`,
      `authenticationOf(request)`,
      `decideAccess(rule, caller)`,
      `permissionGuard(app)`,
    ],
  ],
  ['DENIAL', DENIAL, [`'${'ACCESS'}_DENIED'`, `'${'EXPORT'}_DENIED'`, `'${'NOT'}_PERMITTED'`, `'${'FORBIDDEN'}'`, `throw new Api${'Failure'}(403, code, text);`, `app.denial${'Budget'}.consume(request)`]],
  ['HOOK', HOOK, [`app.add${'Hook'}('onRequest', check);`, `routes.route({ onRequest: check });`, `routes.route({ preHandler: [check] });`, `routes.route({ preValidation: check });`, `app.decorateRequest('x', null);`]],
  ['PRINCIPAL', PRINCIPAL, [`request.${'principal'}`]],
  ['PRINCIPAL_HANDED_ON', PRINCIPAL_HANDED_ON, [`await app.engine.command(request.${'principal'}, ACTION, patch);`]],
  [
    'OWN_STORAGE',
    OWN_STORAGE,
    [`await app.${'pipeline'}.run('x', work);`, `app.audit${'Writer'}`, `await unit.audit.append(row);`, `app.${'db'}.pool`, `await pool.${'query'}(text);`, `'${'UPDATE'} t SET a = 1'`, `'insert into t (a) values (1)'`, `${'drizzle'}(pool)`, `import { Pool } from 'pg';`, `app.${'publish'}({ kind: 'state' })`],
  ],
  ['ENGINE_USE', ENGINE_USE, [`app.engine.state()`]],
  [
    'ENGINE_BYPASS',
    ENGINE_BYPASS,
    [`engine${'Control'}(app)`, `host.${'simulator'}()`, `sim.${'actions'}.setStoragePolicy(patch)`, `setStoragePolicy${'Transition'}(state, now, patch)`, `create${'Sim'}(options)`, `scope.${'pending'}()`, `store.getState()`, `x.set${'State'}(next)`],
  ],
  ['REQUEST_DATA', REQUEST_DATA, [`request.body`, `request.headers`]],
  ['SLOT_REPLACED', SLOT_REPLACED, [`app.stages.${'replace'}('accessRule', () => {});`, `app.seams.${'provide'}('engine', fake);`, `app.seams.${'replace'}('clock', c);`]],
  ['TEST_IMPORT', TEST_IMPORT, [`import { x } from '../__${'tests'}__/support';`, `await import('./__${'tests'}__/support');`]],
  ['CONSOLE', CONSOLE, [`${'console'}.log('x');`]],
  ['RANDOM', RANDOM, [`Math.${'random'}()`, `randomUUID()`, `randomBytes(8)`]],
  ['LOG_CALL', LOG_CALL, [`request.log.info({ code }, 'x');`, `app.log.error({ code }, 'x');`, `app.error${'Log'}.append(entry);`]],
  ['ROUTE_CALL', ROUTE_CALL, [`routes.route({ method: 'GET' })`]],
  ['ROUTE_FROM_REGISTRY', ROUTE_FROM_REGISTRY, [`routes.route({ ...routeOfOperation(registryEntry('getTimeStatus')), handler })`]],
  ['ROUTE_SHORTHAND', ROUTE_SHORTHAND, [`app.get('/api/v1/x', handler);`, `app.post("/x", handler);`]],
  ['LITERAL_PATH', LITERAL_PATH, [`const url = '/api/v1/storage/status';`, `const ws = "/ws";`]],
  ['CATCH', CATCH, [`try { run(); } catch (error) { swallow(error); }`, `promise.then(ok, swallow)`]],
];

/** The planted texts that a pattern does NOT find: empty when every alternative works. */
export function plantedMisses(): string[] {
  const missed: string[] = [];
  for (const [name, pattern, texts] of PLANTED) {
    for (const text of texts) {
      if (count([{ path: 'planted.ts', text }], pattern) === 0) missed.push(`${name}: ${text}`);
    }
  }
  return missed;
}
