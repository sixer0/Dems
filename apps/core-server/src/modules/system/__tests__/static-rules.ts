/**
 * The static rules of the two module folders of plan row W40 (not a test file; nothing here
 * imports Vitest). `system/__tests__/static.test.ts` and `alerts/__tests__/static.test.ts` read
 * their folder's production sources as text with the scaffold's scanner and hold them to the
 * patterns below (standing rules M2 to M5, M8 and M14 of decisions D83 and D87; row rule 3).
 *
 * Every forbidden text is built from fragments, so that neither this file nor a test file
 * contains it. `PLANTED` holds texts per pattern in which the pattern must be found: a pattern
 * that finds nothing in its own example proves nothing by finding nothing in the code.
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

/** The first capture group of every match, in file order. */
export function captures(where: readonly SourceFile[], pattern: RegExp): string[] {
  return where.flatMap((file) => [...file.text.matchAll(pattern)].map((match) => match[1] ?? ''));
}

/** The text of one file of the folder, without comments. */
export function codeOf(where: readonly SourceFile[], name: string): string {
  const file = where.find((candidate) => candidate.path.endsWith(`/${name}`));
  if (file === undefined) throw new Error(`the folder has no file ${name}`);
  return file.text;
}

/** Every module specifier a file imports from or re-exports from, without duplicates, sorted. */
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

/** The system time in any form, a timer, and any clock at all: every instant is the engine's. */
export const SYSTEM_TIME = any(`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\b`, `\\bDate\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`, `\\bDate\\s*\\.\\s*(?:${'parse'}|${'UTC'})\\b`);
export const TIMER = any(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, `\\bqueue${'Microtask'}\\b`, `\\bprocess\\s*\\.\\s*next${'Tick'}\\b`);
export const ANY_CLOCK = any(`\\b${'clock'}\\b`, `\\.\\s*${'now'}\\s*\\(`);

/** Anything of the machine: a runtime module, the process, the network, the console, a random source. */
export const HOST_MODULE = any(
  `['"](?:node:)?(?:${['os', 'dns', 'net', 'dgram', 'tls', 'http', 'https', 'http2', 'child_process', 'cluster', 'fs', 'worker_threads', 'crypto', 'process'].join('|')})(?:\\/[a-z]+)?['"]`,
  `['"]node:[a-z_/]+['"]`,
);
export const HOST_STATE = any(`\\bprocess\\s*\\.`, `\\bglobalThis\\b`, `\\b${'fetch'}\\s*\\(`, `\\bnew\\s+(?:Web)?${'Socket'}\\b`, `\\bapp\\s*\\.\\s*(?:server|addresses|${'listen'})\\b`);
export const CONSOLE = any(`\\b${'console'}\\s*\\.`);
export const RANDOM = any(`\\bMath\\s*\\.\\s*${'random'}\\b`, `\\brandom(?:UUID|Bytes|Int)\\b`);

/** M3: who may call is stage 6's. Nothing of a role, a permission, a session or a device is read. */
export const ACCESS_CHECK = any(
  `\\bPermission\\b`,
  `\\bOperatorRole\\b`,
  `\\b${'permissions'}\\b`,
  `\\b${'role'}Has\\b`,
  `\\.\\s*${'role'}\\b`,
  `['"](?:${'ANONYMOUS'}|DEVICE)['"]`,
  `\\.\\s*(?:session|device|retiredDevice)Id\\b`,
  `\\b(?:sessionRegistry|deviceResolver|originDecision|authenticationOf|operatorSessionOf)\\b`,
  `\\b(?:decideAccess|permissionGuard|isAccessRule|compileAccessRule)\\b`,
);
/** M3: no denial row, no refusal built here, no hook. */
export const DENIAL = any(`\\b${'ACCESS'}_DENIED\\b`, `\\b${'EXPORT'}_DENIED\\b`, `\\b${'NOT'}_PERMITTED\\b`, `\\b${'FORBIDDEN'}\\b`, `\\bApi${'Failure'}\\b`, `\\bdenial${'Budget'}\\b`);
export const HOOK = any(`\\badd${'Hook'}\\s*\\(`, `\\b(?:onRequest|preParsing|preValidation|preHandler|preSerialization|onSend|onResponse|onError)\\s*:`, `\\bdecorate(?:Request|Reply)?\\s*\\(`);
export const CATCH = any(`\\bcatch\\b`, `\\.\\s*then\\s*\\(`);

/**
 * The identity of the caller. It is read for the one log line of SR-82 and nowhere else: the
 * operator ID once and the kind of an operator once, both in the function that builds the line.
 */
export const OPERATOR_ID = any(`\\.\\s*${'operator'}Id\\b`);
export const OPERATOR_KIND = any(`['"]${'OPERATOR'}['"]`);
/** Every use of the request's principal, and the forms it may have. */
export const PRINCIPAL = any(`\\b${'principal'}\\b`);
export const PRINCIPAL_TO_COMMAND = any(`app\\s*\\.\\s*engine\\s*\\.\\s*command\\(\\s*request\\s*\\.\\s*${'principal'}\\s*,`);
export const PRINCIPAL_AS_CALLER = any(`const\\s+caller\\s*=\\s*request\\s*\\.\\s*${'principal'}\\s*;`);
/** Every use of the name the principal is held under inside a handler. */
export const CALLER = any(`\\bcaller\\b(?!\\s*:)`);

/** M5, M4: no unit of work, no table, no audit path of its own, no publication. */
export const OWN_STORAGE = any(
  `\\b${'pipeline'}\\b`,
  `\\baudit${'Writer'}\\b`,
  `\\bunit\\s*\\.`,
  `\\.\\s*unit\\b`,
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
export const SCOPE_USE = any(`\\bscope\\s*\\.\\s*([a-zA-Z]+)`);
export const ENGINE_BYPASS = any(`\\bengine${'Control'}\\b`, `\\b${'simulator'}\\s*\\(`, `\\.\\s*${'actions'}\\b`, `\\b[a-zA-Z]+${'Transition'}\\b`, `\\bcreate${'Sim'}\\b`, `\\b(?:store|sim)\\s*\\.`, `\\.\\s*set${'State'}\\s*\\(`);

/** What of a request is read. */
export const REQUEST_DATA = any(`\\brequest\\s*\\.\\s*([a-zA-Z]+)`);

/** Never from production code: a slot replaced, a test file imported. */
export const SLOT_REPLACED = any(`\\b(?:stages|seams)\\s*\\.\\s*(?:${'replace'}|${'provide'})\\s*\\(`);
export const TEST_IMPORT = any(`from\\s+['"][^'"]*__${'tests'}__[^'"]*['"]`, `import\\s*\\(\\s*['"][^'"]*__${'tests'}__`);

/** A log call of any level, a child logger, the persistent error log. */
export const LOG_CALL = any(`\\blog\\s*\\.\\s*(?:trace|debug|info|warn|error|fatal)\\s*\\(`);
export const LOG_OTHER = any(`\\blog\\s*\\.\\s*${'child'}\\s*\\(`, `\\berror${'Log'}\\b`, `\\bapp\\s*\\.\\s*log\\b`);
/** M14: a member under which an error must not be logged. */
export const ERROR_MEMBER = any(`\\{[^{}]*\\b(?:${'error'}|${'cause'}|${'reason'})\\b\\s*[,:}]`);

/** Routes: built from the registry entry, never from a literal path or a method shorthand. */
export const ROUTE_CALL = any(`\\.\\s*${'route'}\\s*\\(\\s*\\{`);
export const ROUTE_FROM_REGISTRY = any(`\\.\\.\\.routeOfOperation\\(registryEntry\\('([A-Za-z]+)'\\)\\)`);
export const ROUTE_SHORTHAND = any(`\\.\\s*(?:get|post|put|patch|delete|head|options|all)\\s*\\(\\s*['"\`]`);
export const LITERAL_PATH = any(`['"\`]\\/(?:api|ws)\\b`);

/**
 * For each pattern, texts in which it must be found: one text per alternative of the pattern, so
 * a mistyped alternative shows as a text that is not found.
 */
export const PLANTED: ReadonlyArray<readonly [name: string, pattern: RegExp, texts: readonly string[]]> = [
  ['SYSTEM_TIME', SYSTEM_TIME, [`const a = Date.${'now'}();`, `const b = new Date();`, `const c = Date();`, `const d = performance.${'now'}();`, `process.hr${'time'}.bigint();`, `Date.${'parse'}('x');`, `Date.${'UTC'}(2031, 0, 1);`]],
  ['TIMER', TIMER, [`set${'Timeout'}(() => {}, 1);`, `set${'Interval'}(tick, 5);`, `set${'Immediate'}(run);`, `queue${'Microtask'}(run);`, `process.next${'Tick'}(run);`]],
  ['ANY_CLOCK', ANY_CLOCK, [`const at = app.${'clock'};`, `const at = source.${'now'}();`]],
  ['HOST_MODULE', HOST_MODULE, [`import os from 'node:${'os'}';`, `import { lookup } from '${'dns'}';`, `import { readFileSync } from 'node:${'fs'}';`, `import x from '${'dns'}/promises';`, `import t from 'node:${'timers'}/promises';`]],
  ['HOST_STATE', HOST_STATE, [`process.pid;`, `globalThis.x;`, `await ${'fetch'}('http://x');`, `new ${'Socket'}();`, `new Web${'Socket'}(url);`, `app.server.address();`, `app.addresses();`, `app.${'listen'}({ port })`]],
  ['CONSOLE', CONSOLE, [`${'console'}.log('x');`]],
  ['RANDOM', RANDOM, [`Math.${'random'}()`, `randomUUID()`, `randomBytes(8)`]],
  [
    'ACCESS_CHECK',
    ACCESS_CHECK,
    [
      `Permission.MAINTENANCE`,
      `OperatorRole.SUPERVISOR`,
      `held.${'permissions'}`,
      `${'role'}Has(role, p)`,
      `caller.${'role'} === 'SUPERVISOR'`,
      `caller.kind === "${'ANONYMOUS'}"`,
      `caller.kind === 'DEVICE'`,
      `caller.sessionId`,
      `caller.deviceId`,
      `caller.retiredDeviceId`,
      `app.sessionRegistry`,
      `app.deviceResolver`,
      `authenticationOf(request)`,
      `operatorSessionOf(request)`,
      `decideAccess(rule, caller)`,
      `permissionGuard(app)`,
    ],
  ],
  ['DENIAL', DENIAL, [`'${'ACCESS'}_DENIED'`, `'${'EXPORT'}_DENIED'`, `'${'NOT'}_PERMITTED'`, `'${'FORBIDDEN'}'`, `throw new Api${'Failure'}(403, code, text);`, `app.denial${'Budget'}.consume(request)`]],
  ['HOOK', HOOK, [`app.add${'Hook'}('onRequest', check);`, `routes.route({ onRequest: check });`, `routes.route({ preHandler: [check] });`, `routes.route({ preValidation: check });`, `app.decorateRequest('x', null);`]],
  ['CATCH', CATCH, [`try { run(); } catch (error) { swallow(error); }`, `promise.then(ok, swallow)`]],
  ['OPERATOR_ID', OPERATOR_ID, [`caller.${'operator'}Id`]],
  ['OPERATOR_KIND', OPERATOR_KIND, [`caller.kind === '${'OPERATOR'}'`, `caller.kind === "${'OPERATOR'}"`]],
  ['PRINCIPAL', PRINCIPAL, [`request.${'principal'}`]],
  ['PRINCIPAL_TO_COMMAND', PRINCIPAL_TO_COMMAND, [`await app.engine.command(request.${'principal'}, ACTION);`]],
  ['PRINCIPAL_AS_CALLER', PRINCIPAL_AS_CALLER, [`const caller = request.${'principal'};`]],
  ['CALLER', CALLER, [`scope.command(caller, ACTION)`, `lineOf(caller, keys)`]],
  [
    'OWN_STORAGE',
    OWN_STORAGE,
    [`await app.${'pipeline'}.run('x', work);`, `app.audit${'Writer'}`, `await unit.audit.append(row);`, `scope.unit`, `app.${'db'}.pool`, `await pool.${'query'}(text);`, `'${'UPDATE'} t SET a = 1'`, `'insert into t (a) values (1)'`, `${'drizzle'}(pool)`, `import { Pool } from 'pg';`, `app.${'publish'}({ kind: 'state' })`],
  ],
  ['ENGINE_USE', ENGINE_USE, [`app.engine.state()`]],
  ['SCOPE_USE', SCOPE_USE, [`scope.pending()`]],
  ['ENGINE_BYPASS', ENGINE_BYPASS, [`engine${'Control'}(app)`, `host.${'simulator'}()`, `sim.${'actions'}.updateSettings(patch)`, `updateSettings${'Transition'}(state, patch)`, `create${'Sim'}(options)`, `store.getState()`, `x.set${'State'}(next)`]],
  ['REQUEST_DATA', REQUEST_DATA, [`request.body`, `request.headers`]],
  ['SLOT_REPLACED', SLOT_REPLACED, [`app.stages.${'replace'}('accessRule', () => {});`, `app.seams.${'provide'}('engine', fake);`, `app.seams.${'replace'}('clock', c);`]],
  ['TEST_IMPORT', TEST_IMPORT, [`import { x } from '../__${'tests'}__/support';`, `await import('./__${'tests'}__/support');`]],
  ['LOG_CALL', LOG_CALL, [`request.log.info({ code }, 'x');`, `app.log.error({ code }, 'x');`, `log.warn('x');`, `request.log.debug(line, 'x');`]],
  ['LOG_OTHER', LOG_OTHER, [`request.log.${'child'}({ a: 1 })`, `app.error${'Log'}.append(entry);`, `app.log.info('x')`]],
  ['ERROR_MEMBER', ERROR_MEMBER, [`log.info({ ${'error'} }, 'x')`, `log.info({ a: 1, ${'cause'}: thrown }, 'x')`, `log.info({ ${'reason'}: text }, 'x')`]],
  ['ROUTE_CALL', ROUTE_CALL, [`routes.route({ method: 'GET' })`]],
  ['ROUTE_FROM_REGISTRY', ROUTE_FROM_REGISTRY, [`routes.route({ ...routeOfOperation(registryEntry('listAlerts')), handler })`]],
  ['ROUTE_SHORTHAND', ROUTE_SHORTHAND, [`app.get('/api/v1/x', handler);`, `app.post("/x", handler);`]],
  ['LITERAL_PATH', LITERAL_PATH, [`const url = '/api/v1/settings';`, `const ws = "/ws";`]],
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
