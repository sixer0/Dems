// Static guards of the demo-control module (plan row W43; standing rules M2 to M5, M8 and M14 of
// the gate report; spec DC-2, DC-5, SR-57, SR-58, SR-68; database contract HC-1 to HC-4). They
// read the production sources of the folder as text, with the scaffold's scanner, and keep these
// rules true for every later edit:
//
//   1. Who may call is stage 6, only: the folder reads no permission and no role of the caller,
//      no session and no device, and does not read the demo flag. Of the principal it reads the
//      operator's ID, in one place: the actor of a reset and the name in the log line of a fault.
//   2. It writes no audit row and no event and opens no unit of work. Its two statements are
//      reads. A fault is a hosted action through `app.engine.command`.
//   3. The reset routine is called in ONE place, with ONE argument: no seam of the routine is set,
//      so its name guard accepts the four project databases only. The folder holds no credential:
//      it names no connection file, reads no file and no environment, and builds no pool.
//   4. One clock, no timer; no console.
//   5. Every route comes from the registry: no path is written in the folder.
//   6. Nothing of the server calls the module's test control.
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { SCAN_COVERS, WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, scanCoverage, type SourceFile } from '../../../../test/static/scan';

const FOLDER = 'src/modules/demo/';

const tree = readTree(WORKSPACE);
const production = codeOnly(tree.filter((file) => isProductionSource(file.path)));
const ownCode = production.filter((file) => file.path.startsWith(FOLDER));
const all = ownCode.map((file) => file.text).join('\n');

const places = (pattern: RegExp, where: readonly SourceFile[] = ownCode): string[] => occurrences(where, pattern);
const count = (pattern: RegExp): number => places(pattern).length;
const filesOf = (found: readonly string[]): string[] => [...new Set(found.map((place) => place.replace(/:\d+$/, '')))].sort();

const CALLER_RIGHTS = new RegExp(
  [`\\bprincipal\\s*\\.\\s*(?:${'permissions'}|${'role'}|${'sessionId'}|${'deviceId'}|${'retiredDeviceId'})\\b`, `\\brole${'Has'}\\b`, `\\bROLE_${'PERMISSIONS'}\\b`, `\\bDEMO_${'CONTROL'}\\b`, `\\.\\s*${'includes'}\\s*\\(\\s*Permission`].join('|'),
  'g',
);
const DEMO_FLAG = new RegExp(`\\b${'demo'}${'Controls'}\\b|\\bDEMS_${'DEMO'}_CONTROLS\\b|\\bDEMO_${'FLAG'}\\b|\\bDEMO_${'DISABLED'}\\b`, 'g');
const SESSION_OR_DEVICE = new RegExp([`\\boperator${'SessionOf'}\\b`, `\\bauthentication${'Of'}\\b`, `\\bsession${'Registry'}\\b`, `\\bdevice${'Resolver'}\\b`, `\\bconsole${'IdentityOf'}\\b`].join('|'), 'g');
const PRINCIPAL = new RegExp(`\\brequest\\s*\\.\\s*${'principal'}\\b`, 'g');
const PRINCIPAL_TO_ENGINE = new RegExp(`\\bapp\\s*\\.\\s*engine\\s*\\.\\s*command\\s*\\(\\s*request\\s*\\.\\s*${'principal'}\\s*,`, 'g');
const DENIAL = new RegExp([`ACCESS_${'DENIED'}`, `EXPORT_${'DENIED'}`, `NOT_${'PERMITTED'}`, `\\bdenial${'Budget'}\\b`].join('|'), 'g');
const API_FAILURE = new RegExp(`\\bnew\\s+Api${'Failure'}\\s*\\(`, 'g');
const OWN_ROWS = new RegExp([`\\baudit\\s*\\.\\s*${'append'}`, `\\bevents\\s*\\.\\s*${'append'}`, `\\baudit${'Writer'}\\b`, `\\bpipeline\\s*\\.\\s*${'run'}\\b`, `\\bafter${'Commit'}\\b`, `\\bengine\\s*\\.\\s*${'run'}\\b`].join('|'), 'g');
const STATEMENT = new RegExp(`\\b(${'SELECT'}|${'INSERT'}|${'UPDATE'}|${'DELETE'}|${'TRUNCATE'}|${'CREATE'}|${'ALTER'}|${'DROP'}|${'GRANT'}|${'COPY'})\\s`, 'g');
const ENGINE_MEMBER = new RegExp(`\\bapp\\s*\\.\\s*engine\\s*\\.\\s*([A-Za-z]+)`, 'g');
const SIMULATOR_DIRECT = new RegExp([`\\bengine${'Control'}\\b`, `\\.\\s*${'simulator'}\\s*\\(`, `\\.\\s*${'actions'}\\b`, `\\bcreate${'Sim'}\\b`, `\\bstore\\s*\\.\\s*${'getState'}\\b`, `\\w+${'Transition'}\\b`, `\\.\\s*${'pending'}\\s*\\(`].join('|'), 'g');
const SYSTEM_TIME = new RegExp([`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`].join('|'), 'g');
const TIMER = new RegExp(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, 'g');
const CONSOLE_OR_ENVIRONMENT = new RegExp(`\\b${'console'}\\s*\\.|\\bprocess\\s*\\.\\s*${'env'}\\b|\\.\\s*${'listen'}\\s*\\(`, 'g');
const ROUTE = new RegExp(`\\.\\s*${'route'}\\s*\\(`, 'g');
const ROUTE_FROM_REGISTRY = new RegExp(`\\.\\s*${'route'}\\s*\\(\\s*\\{\\s*\\.\\.\\.\\s*routeOfOperation\\s*\\(`, 'g');
const ROUTE_SHORTHAND = new RegExp(`\\.\\s*(?:get|post|put|patch|delete|head|options|all)\\s*\\(\\s*['"\`]`, 'g');
const PATH_LITERAL = new RegExp(`['"\`]\\/(?:${'api'}|ws)\\b`, 'g');
const ROUTE_HOOK = new RegExp(`\\b(?:onRequest|preParsing|preValidation|preHandler|addHook)\\b`, 'g');
const REQUEST_MEMBER = new RegExp(`\\brequest\\s*\\.\\s*([A-Za-z]+)(?:\\s*\\.\\s*([A-Za-z]+))?`, 'g');
const SLOT_REPLACED = new RegExp(`\\b(?:stages|seams)\\s*\\.\\s*(?:${'replace'}|${'provide'})\\s*\\(`, 'g');
const TEST_IMPORT = new RegExp(`from\\s+['"][^'"]*__${'tests'}__[^'"]*['"]`, 'g');
const COOKIE_OR_HOST = new RegExp(`\\bset${'Cookie'}\\b|set-${'cookie'}|\\buser-${'agent'}\\b|\\b${'hostname'}\\b`, 'gi');
const IMPORT_SOURCE = /from\s+'([^']+)'/g;

// Credentials: the two connection files that are not the server's, by fragments; any file read;
// the readers and the pool builders of the database commands; the driver itself.
const OWNER_FILE = ['pg', 'owner', 'env'].join('\\.');
const SUPERUSER_FILE = ['pg', 'pwfile'].join('\\.');
const CREDENTIAL = new RegExp(
  [
    OWNER_FILE,
    SUPERUSER_FILE,
    `\\bpg\\.${'env'}\\b`,
    `\\bread${'OwnerConnection'}\\b`,
    `\\bcreate${'OwnerPool'}\\b`,
    `\\bcreate${'RuntimePool'}\\b`,
    `\\b${'reveal'}\\s*\\(`,
    `\\b${'password'}\\b`,
    `\\bSecret\\b`,
    `\\bdems_${'owner'}\\b`,
    `\\bdems_${'admin'}\\b`,
    `\\bnew\\s+Pool\\b`,
    `from\\s+['"]pg['"]`,
    `['"]node:${'fs'}(?:\\/promises)?['"]`,
    `\\bread${'File'}(?:Sync)?\\b`,
  ].join('|'),
  'gi',
);
const ROUTINE_CALL = new RegExp(`\\breset${'Database'}\\s*\\(`, 'g');
const ROUTINE_CALL_ONE_ARGUMENT = new RegExp(`\\breset${'Database'}\\s*\\(\\s*options\\s*\\)`, 'g');
const ROUTINE_SEAM = new RegExp(`\\b(?:test${'RunPrefix'}|open${'Pool'}|migrations${'Folder'}|seed${'Dependencies'}|session${'DrainMs'}|application${'Name'}|on${'Checkpoint'})\\b`, 'g');
const DATA_DIR = new RegExp(`\\bdata${'Dir'}\\b`, 'g');
const CONTROL_USE = new RegExp(`\\bdemo${'Control'}\\s*\\(`, 'g');
const ERROR_TEXT = new RegExp(`\\.\\s*${'message'}\\b`, 'g');
const CONFIG_WRITE = new RegExp(`\\bconfig\\s*(?:\\.\\s*\\w+\\s*)+=[^=]`, 'g');

describe('the scan itself', () => {
  it('reads the production files of the folder', () => {
    expect(scanCoverage(ownCode, [FOLDER])).toEqual(SCAN_COVERS);
    expect(all.length).toBeGreaterThan(8_000);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const sample: SourceFile[] = [
      {
        path: 'src/sample.ts',
        text: [
          `if (request.${'principal'}.${'permissions'}.includes(Permission.DEMO_${'CONTROL'})) run();`,
          `if (!app.config.${'demo'}${'Controls'}) throw demoDisabled();`,
          `const session = operator${'SessionOf'}(request);`,
          `throw new Api${'Failure'}(403, 'NOT_${'PERMITTED'}', 'no');`,
          `await unit.audit.${'append'}({ type: 'ACCESS_${'DENIED'}' });`,
          `await app.pipeline.${'run'}('demo.own', async () => {});`,
          `await pool.query('${'UPDATE'} public.core_state SET epoch = epoch + 1');`,
          `engine${'Control'}(app).${'simulator'}()?.store.${'getState'}();`,
          `sim.${'actions'}.resetDemo();`,
          `const at = Date.${'now'}();`,
          `set${'Timeout'}(() => {}, 1);`,
          `${'console'}.log(1);`,
          `app.get('/${'api'}/v1/demo/late', handler);`,
          `app.${'route'}({ method: 'POST', url: '/${'api'}/v1/demo/other', onRequest: check });`,
          `app.stages.${'replace'}('accessRule', () => {});`,
          `import { x } from '../__${'tests'}__/support';`,
          `const owner = read${'OwnerConnection'}(dataDir); const pool = create${'OwnerPool'}(owner, 'postgres', 'x'); owner.${'password'}.${'reveal'}();`,
          `import { readFileSync } from 'node:${'fs'}'; readFileSync(join(dataDir, '${['pg', 'owner', 'env'].join('.')}'));`,
          `await reset${'Database'}(options, { test${'RunPrefix'}: prefix });`,
          `demo${'Control'}(app).replace({ routine });`,
          `log.error({ detail: error.${'message'} }, 'failed');`,
          `app.config.${'demo'}${'Controls'} = true;`,
        ].join('\n'),
      },
    ];
    const hits = (pattern: RegExp): number => occurrences(sample, pattern).length;
    expect([SESSION_OR_DEVICE, PRINCIPAL, API_FAILURE, SYSTEM_TIME, TIMER, CONSOLE_OR_ENVIRONMENT, ROUTE, ROUTE_SHORTHAND, ROUTE_HOOK, SLOT_REPLACED, TEST_IMPORT, CONTROL_USE, ERROR_TEXT, CONFIG_WRITE].map(hits)).toEqual([
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ]);
    // One line of the sample reads the caller's permissions and names the permission of the routes.
    expect([...sample[0]!.text.matchAll(CALLER_RIGHTS)]).toHaveLength(3);
    expect(hits(DEMO_FLAG)).toBe(2);
    expect(hits(DENIAL)).toBe(2);
    expect(hits(OWN_ROWS)).toBe(2);
    expect(hits(STATEMENT)).toBe(1);
    // Two lines of the sample, four texts: the control, the simulator, its store, its actions.
    expect(hits(SIMULATOR_DIRECT)).toBe(4);
    expect(hits(PATH_LITERAL)).toBe(2);
    // Two lines of the sample: the reader, the pool builder, the secret and its reveal; the file module, its read, the file's name.
    expect(hits(CREDENTIAL)).toBe(8);
    expect(hits(ROUTINE_CALL)).toBe(1);
    expect(hits(ROUTINE_CALL_ONE_ARGUMENT)).toBe(0);
    expect(hits(ROUTINE_SEAM)).toBe(1);
    expect(hits(ROUTE_FROM_REGISTRY)).toBe(0);
  });
});

describe('M3: who may call is stage 6, only', () => {
  it('the folder reads no permission and no role of the caller, and names the permission of its routes nowhere', () => {
    // Fix wave K, reconcile pass (decision D216 (2): an audit row of an action a paired device sent names that device): ONE read of the
    // caller's device, in `deviceIdOf`, handed to the audited refusal of a reset. It decides nothing: no permission, no role, no session.
    expect(filesOf(places(CALLER_RIGHTS))).toEqual(['src/modules/demo/index.ts']);
    expect([...all.matchAll(CALLER_RIGHTS)].map((match) => match[0].replace(/\s+/g, ''))).toEqual(['principal.deviceId']);
  });

  it('DC-2: the folder does not read the demo flag and builds no DEMO_DISABLED answer: stage 6 decides both', () => {
    expect(places(DEMO_FLAG)).toEqual([]);
  });

  it('it reads no session and no device of the caller', () => {
    expect(places(SESSION_OR_DEVICE)).toEqual([]);
  });

  it('request.principal is handed to app.engine.command as it is (two calls), and read once more: the operator ID, in one function', () => {
    expect(count(PRINCIPAL)).toBe(2);
    expect(count(PRINCIPAL_TO_ENGINE)).toBe(2);
    expect(places(PRINCIPAL).every((place) => place.startsWith('src/modules/demo/index.ts:'))).toBe(true);
    // The one other read: `const { principal } = request;` in `operatorIdOf`, which takes the kind and the operator ID.
    // Fix wave K, reconcile pass (D216 (2)): and once in `deviceIdOf`, which takes the kind and the device the session is bound to.
    expect(count(/\{\s*principal\s*\}\s*=\s*request\b/g)).toBe(2);
    expect([...all.matchAll(/\bprincipal\s*\.\s*([A-Za-z]+)/g)].map((match) => match[1])).toEqual(['kind', 'operatorId', 'kind', 'deviceId']);
  });

  it('it writes ONE denial row - the audited refusal of a reset the guard refused (pass D11), in the host - and takes no place in the denial budget; its two refusals of its own are the 503 of a reset that did not happen and the 409 of the reset guard', () => {
    // Integration pass D11 (C3 §3 op 75 "refuses ... and audits the refusal"): one `ACCESS_DENIED` row, written by `host.ts` and nowhere else.
    expect(filesOf(places(DENIAL))).toEqual(['src/modules/demo/host.ts']);
    expect(places(DENIAL)).toHaveLength(1);
    expect(count(/\bdenialBudget\b/g)).toBe(0);
    // +1 by integration pass D10: the reset guard's refusal is `409 RESET_BLOCKED_REAL_EVIDENCE` (C3 §3 op 75, §4).
    expect(places(API_FAILURE)).toHaveLength(2);
    expect(filesOf(places(API_FAILURE))).toEqual(['src/modules/demo/reset.ts']);
    expect(all).toMatch(/new ApiFailure\(503, EnvelopeCode\.NOT_READY,/);
    expect(all).toMatch(/new ApiFailure\(409, ApiErrorCode\.RESET_BLOCKED_REAL_EVIDENCE,/);
  });

  it('no route carries a hook, and the module adds none to the server', () => {
    expect(places(ROUTE_HOOK)).toEqual([]);
  });
});

describe('M4, M5: a fault is a hosted action; the module writes no row', () => {
  it('no event, and ONE audit row in ONE unit of work of its own: the audited refusal of a reset (pass D11), in the host', () => {
    // `app.pipeline.run(...)` and `unit.audit.append(...)` of `auditRefusal`; a fault, a scenario load and a reset still write nothing here.
    expect(places(OWN_ROWS)).toHaveLength(2);
    expect(filesOf(places(OWN_ROWS))).toEqual(['src/modules/demo/host.ts']);
    expect(count(/\bevents\s*\.\s*append/g)).toBe(0);
  });

  it('its statements are two, and both are reads', () => {
    const found = ownCode.flatMap((file) => [...file.text.matchAll(STATEMENT)].map((match) => `${file.path} ${match[1]}`));
    expect(found).toEqual(['src/modules/demo/host.ts SELECT', 'src/modules/demo/status.ts SELECT']);
    expect(all).toContain("'SELECT id, role_id AS role FROM public.operators ORDER BY id'");
    expect(all).toContain("'SELECT seeded_at::text AS seeded_at, last_reset_at::text AS last_reset_at FROM public.core_state'");
  });

  it('of the engine seam it uses command (the two faults), state and epoch (the answers), stop, reload and ONE resync start (a reset); it sets no header of API-7', () => {
    const members = ownCode.flatMap((file) => [...file.text.matchAll(ENGINE_MEMBER)].map((match) => match[1]));
    expect(members.filter((member) => member === 'command')).toHaveLength(2);
    expect(members.filter((member) => member === 'stop')).toHaveLength(1);
    expect(members.filter((member) => member === 'reload')).toHaveLength(1);
    expect(members.filter((member) => member === 'start')).toHaveLength(1);
    expect([...new Set(members)].sort()).toEqual(['command', 'epoch', 'reload', 'start', 'state', 'stop']);
    // The two headers of API-7 are the engine unit's (`src/engine/api-headers.ts`, decision D87).
    expect(count(/_HEADER_NAME\b|\.header\s*\(/g)).toBe(0);
    // The one start is the resync after a reset that did not happen (decision D101). Never a
    // process start: that would move a recording to FAULT, and after a reset that happened it
    // would add 1 to the epoch a second time (decision D74 DN-5).
    expect([...all.matchAll(/\bengine\s*\.\s*start\s*\(\s*([^)]*)\)/g)].map((match) => match[1])).toEqual(["'resync'"]);
    expect(count(/['"`]boot['"`]/g)).toBe(0);
    expect(count(/\breadiness\s*\.\s*boot\s*\(/g)).toBe(0);
  });

  it('it calls no simulator action directly, runs no transition and reads no working state of the simulator', () => {
    expect(places(SIMULATOR_DIRECT)).toEqual([]);
  });

  it('the hosted actions it names are inject and clearFault', () => {
    const named = [...all.matchAll(/engine\s*\.\s*command\s*\(\s*request\s*\.\s*principal\s*,\s*'([A-Za-z]+)'/g)].map((match) => match[1]);
    expect(named).toEqual(['inject', 'clearFault']);
  });
});

describe('SR-58, SR-68, HC-1 to HC-4: the reset routine and its credentials', () => {
  it('the routine is called in one place, with one argument: no seam of the routine is set by the server', () => {
    expect(places(ROUTINE_CALL)).toHaveLength(1);
    expect(places(ROUTINE_CALL_ONE_ARGUMENT)).toHaveLength(1);
    expect(filesOf(places(ROUTINE_CALL))).toEqual(['src/modules/demo/index.ts']);
    // Not one of the routine's options that a test passes, and none of its test seams.
    expect(places(ROUTINE_SEAM)).toEqual([]);
  });

  it('the folder holds no credential: it names no connection file, no role and no secret, reads no file, and builds no pool', () => {
    expect(places(CREDENTIAL)).toEqual([]);
  });

  it('the data directory is handed on and never opened: two mentions in the host (the getter), three in the reset (the type, the option); the media root likewise (decision D165: the root of both reset guards)', () => {
    expect(ownCode.map((file) => [file.path, [...file.text.matchAll(DATA_DIR)].length]).filter(([, hits]) => hits !== 0)).toEqual([
      ['src/modules/demo/host.ts', 2],
      ['src/modules/demo/reset.ts', 3],
    ]);
    // The media root: the getter of the host (the configuration's value, as the sealing reads it) and its one use by the
    // caller-side guard; the type and the option of the routine in the reset. No path is built from it.
    expect(ownCode.map((file) => [file.path, [...file.text.matchAll(/\bmediaStoreDir\b/g)].length]).filter(([, hits]) => hits !== 0)).toEqual([
      ['src/modules/demo/host.ts', 3],
      ['src/modules/demo/reset.ts', 2],
    ]);
    expect(count(/\bconfig\s*\.\s*mediaStoreDir\b/g)).toBe(1);
    // No path is built from it: the folder imports no path and no file module.
    expect(count(/['"]node:(?:path|fs|os)(?:\/promises)?['"]/g)).toBe(0);
  });

  it('the database it names is the configuration\'s, in one place', () => {
    expect(count(/\bconfig\s*\.\s*database\s*\.\s*database\b/g)).toBe(1);
    expect(count(/['"`]dems_(?:demo|lane)/g)).toBe(0);
  });

  it('SR-57: nothing in the folder assigns to the configuration', () => {
    expect(places(CONFIG_WRITE)).toEqual([]);
  });

  it('no production file of the server calls the module\'s test control: its one mention is its definition', () => {
    expect(places(CONTROL_USE, production)).toHaveLength(1);
    const definitions = production.flatMap((file) => [...file.text.matchAll(/\bexport\s+function\s+demoControl\s*\(/g)].map(() => file.path));
    expect(definitions).toEqual(['src/modules/demo/index.ts']);
    // And nothing of the server replaces a part of the reset: `.replace(` on the control is not written anywhere in production.
    expect(production.flatMap((file) => [...file.text.matchAll(/\bdemoControl\s*\([^)]*\)\s*\.\s*replace\b/g)].map(() => file.path))).toEqual([]);
  });
});

describe('M8, M14: time, logging, and what the folder may touch', () => {
  it('every instant is app.clock: no system time and no timer', () => {
    expect(places(SYSTEM_TIME)).toEqual([]);
    expect(places(TIMER)).toEqual([]);
    expect(count(/\bapp\s*\.\s*clock\s*\.\s*now\s*\(/g)).toBe(1);
  });

  it('nothing is written to the console, no environment is read, nothing listens', () => {
    expect(places(CONSOLE_OR_ENVIRONMENT)).toEqual([]);
  });

  it('M14: no log line and no error-log entry is built from the text of an error; the one text handed on is the routine\'s own log line', () => {
    const found = ownCode.flatMap((file) => [...file.text.matchAll(/(\w+)\s*\.\s*message\b/g)].map((match) => `${file.path} ${match[1]}`));
    expect(found).toEqual(['src/modules/demo/reset.ts entry']);
    // Every catch of the folder logs what it caught under `err`, or rethrows it wrapped.
    // +2 by integration pass D11: a guard that could not be asked, an audit row of a refusal that could not be written.
    // +1 by integration pass I-9c: the camera network settings that could not be read again after a reset.
    expect(count(/\{\s*err\s*:/g)).toBe(8);
    expect(count(/\{\s*(?:error|cause|e)\s*[,:}]/g)).toBe(0);
  });

  it('no cookie is set and nothing keys on a host or a user agent', () => {
    expect(places(COOKIE_OR_HOST)).toEqual([]);
  });

  it('no stage and no seam is provided or replaced, and nothing is imported from a test folder', () => {
    expect(places(SLOT_REPLACED)).toEqual([]);
    expect(places(TEST_IMPORT)).toEqual([]);
  });

  it('the folder imports the contract, the shared vocabulary, the reset routine, the core\'s runner of the boot checks with the readiness plugin\'s error, the guard\'s helpers and the envelope: and no driver', () => {
    const sources = new Set(ownCode.flatMap((file) => [...file.text.matchAll(IMPORT_SOURCE)].map((match) => match[1] ?? '')));
    expect([...sources].sort()).toEqual([
      '../../core',
      '../../db/mapping',
      '../../db/reset',
      '../../plugins/error-envelope',
      '../../plugins/logger',
      '../../plugins/permission-guard',
      '../../plugins/readiness',
      '../../realtime',
      '../capture-config',
      './host',
      './operations',
      './reset',
      './status',
      '@dems/shared/api',
      '@dems/shared/sim',
      'fastify',
      'fastify-type-provider-zod',
    ]);
  });
});

describe('M2, M7: routes and input', () => {
  it('every route is registered from its registry entry: five routes, no path written in the folder', () => {
    expect(count(ROUTE)).toBe(5);
    expect(count(ROUTE_FROM_REGISTRY)).toBe(5);
    expect(places(ROUTE_SHORTHAND)).toEqual([]);
    expect(places(PATH_LITERAL)).toEqual([]);
  });

  it('of a request it reads the principal, the validated body, the request ID and the request\'s logger, and nothing else', () => {
    const members = ownCode.flatMap((file) => [...file.text.matchAll(REQUEST_MEMBER)].map((match) => [match[1], match[2]].filter((part) => part !== undefined).join('.')));
    expect(members.sort()).toEqual(['body', 'body', 'body.name', 'id', 'id', 'log', 'log', 'log.info', 'log.info', 'principal', 'principal']);
  });
});
