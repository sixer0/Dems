// Static guards of the devices module (plan row W36; standing rules M2 to M5 and M8 of the gate
// report). They read the production sources of the folder as text, with the scaffold's scanner,
// and keep these rules true for every later edit:
//
//   1. Who may call is stage 6, only: the folder names no permission and no role, reads no
//      session and no device, and hands `request.principal` to the engine and to nothing else.
//   2. It writes no audit row and no event, and sends no statement: the three device commands
//      get their DEVICE_COMMAND row from the hosted action, a refusal its row from the guard.
//   3. A state change is a hosted action through `app.engine.command`, and nothing else of the
//      engine is used but the committed state: no simulator action called directly, no working
//      state of the simulator read.
//   4. One clock, no timer; no console, no environment.
//   5. Every route comes from the registry: no path is written in the folder.
//   6. Of a request only the validated path ID and the validated body are read.
//   7. M14 (decision D87): the folder logs nothing itself and catches nothing, so no error is
//      ever logged under a key other than `err`.
//   8. Integration pass D11: ONE file of the folder is not a route - `source-facts.ts`, the feed of
//      the engine's fact door `applyCaptureSourceFacts`. Rules 1 to 6 hold for it as for the
//      others. What it alone may do is held below, by name and by count: one `onReady` hook (it
//      adds its boot step after the capture unit's), one boot step, the capture fence and the
//      capture-session unit through their indexes, the engine's fact doors (the one value import
//      of the engine), and ONE failure path that writes one log line under `err` and one entry of
//      the persistent error log.
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { SCAN_COVERS, WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, scanCoverage, type SourceFile } from '../../../../test/static/scan';

const FOLDER = 'src/modules/devices/';

const tree = readTree(WORKSPACE);
const own = tree.filter((file) => isProductionSource(file.path) && file.path.startsWith(FOLDER));
const ownCode = codeOnly(own);
const all = ownCode.map((file) => file.text).join('\n');

/** The feed of the source facts (pass D11): the one file of the folder that is not a route. */
const FEED = 'src/modules/devices/source-facts.ts';
const routesCode = ownCode.filter((file) => file.path !== FEED);
const feedCode = ownCode.filter((file) => file.path === FEED);
const places = (pattern: RegExp, where: readonly SourceFile[] = ownCode): string[] => occurrences(where, pattern);
const count = (pattern: RegExp): number => places(pattern).length;

const PERMISSION = new RegExp(
  [`\\bPermission\\b`, `\\b${'permissions'}\\b`, `\\brole${'Has'}\\b`, `\\bROLE_${'PERMISSIONS'}\\b`, `\\bOperator${'Role'}\\b`, `\\.\\s*${'role'}\\b`, `\\b(?:DEVICE_${'MANAGE'}|DIAGNOSTICS_${'RUN'})\\b`].join('|'),
  'g',
);
const SESSION_OR_DEVICE = new RegExp(
  [`\\boperator${'SessionOf'}\\b`, `\\bauthentication${'Of'}\\b`, `\\bsession${'Registry'}\\b`, `\\bdevice${'Resolver'}\\b`, `\\bconsole${'IdentityOf'}\\b`, `\\bretired${'DeviceId'}\\b`, `\\boperator${'Id'}\\b`, `\\bsession${'Id'}\\b`].join('|'),
  'g',
);
const PRINCIPAL = new RegExp(`\\brequest\\s*\\.\\s*${'principal'}\\b`, 'g');
const PRINCIPAL_TO_ENGINE = new RegExp(`\\bapp\\s*\\.\\s*engine\\s*\\.\\s*command\\s*\\(\\s*request\\s*\\.\\s*${'principal'}\\s*,`, 'g');
const DENIAL = new RegExp([`ACCESS_${'DENIED'}`, `EXPORT_${'DENIED'}`, `NOT_${'PERMITTED'}`, `\\bApi${'Failure'}\\b`, `\\bdenial${'Budget'}\\b`].join('|'), 'g');
const OWN_ROWS = new RegExp(
  [`\\baudit\\s*\\.\\s*${'append'}`, `\\bevents\\s*\\.\\s*${'append'}`, `\\baudit${'Writer'}\\b`, `\\bpipeline\\s*\\.\\s*${'run'}\\b`, `\\bafter${'Commit'}\\b`, `\\bapp\\s*\\.\\s*${'publish'}\\b`, `\\bapp\\s*\\.\\s*${'db'}\\b`].join('|'),
  'g',
);
const STATEMENT = new RegExp(`\\b(?:${'SELECT'}|${'INSERT'}|${'UPDATE'}|${'DELETE'})\\s`, 'g');
const ENGINE_MEMBER = new RegExp(`\\bapp\\s*\\.\\s*engine\\s*\\.\\s*([A-Za-z]+)`, 'g');
const SIMULATOR_DIRECT = new RegExp(
  [`\\bengine${'Control'}\\b`, `\\.\\s*${'simulator'}\\s*\\(`, `\\.\\s*${'actions'}\\b`, `\\bcreate${'Sim'}\\b`, `\\bstore\\s*\\.\\s*${'getState'}\\b`, `\\w+${'Transition'}\\b`, `\\.\\s*${'pending'}\\s*\\(`].join('|'),
  'g',
);
const SYSTEM_TIME = new RegExp([`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`].join('|'), 'g');
const TIMER = new RegExp(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, 'g');
const LOG_CALL = new RegExp(`\\.\\s*log\\s*\\.\\s*(?:${'trace'}|${'debug'}|${'info'}|${'warn'}|${'error'}|${'fatal'})\\s*\\(`, 'g');
const CONSOLE_OR_ENVIRONMENT =new RegExp(`\\b${'console'}\\s*\\.|\\bprocess\\s*\\.\\s*${'env'}\\b|\\.\\s*${'listen'}\\s*\\(`, 'g');
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

describe('the scan itself', () => {
  it('reads the production files of the folder, the feed of the source facts among them', () => {
    expect(scanCoverage(own, [FOLDER])).toEqual(SCAN_COVERS);
    expect(feedCode).toHaveLength(1);
    expect(all.length).toBeGreaterThan(2_000);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const sample: SourceFile[] = [
      {
        path: 'src/sample.ts',
        text: [
          `if (request.${'principal'}.${'permissions'}.includes(Permission.DEVICE_${'MANAGE'})) run();`,
          `const session = operator${'SessionOf'}(request);`,
          `throw new Api${'Failure'}(403, 'NOT_${'PERMITTED'}', 'no');`,
          `await unit.audit.${'append'}({ type: 'ACCESS_${'DENIED'}' });`,
          `await app.pipeline.${'run'}('devices.own', async () => {});`,
          `await pool.query('${'UPDATE'} public.hardware_snapshot SET cameras = $1');`,
          `engine${'Control'}(app).${'simulator'}()?.store.${'getState'}();`,
          `sim.${'actions'}.deviceCommand(id, command);`,
          `const next = deviceCommand${'Transition'}(state, now, id, command, audio);`,
          `const at = Date.${'now'}();`,
          `set${'Timeout'}(() => {}, 1);`,
          `${'console'}.log(1);`,
          `app.get('/${'api'}/v1/device/late', handler);`,
          `app.${'route'}({ method: 'GET', url: '/${'api'}/v1/device/other', onRequest: check });`,
          `app.stages.${'replace'}('accessRule', () => {});`,
          `import { x } from '../__${'tests'}__/support';`,
          `reply.set${'Cookie'}('a', 'b');`,
          `const origin = request.headers.origin;`,
        ].join('\n'),
      },
    ];
    const hits = (pattern: RegExp): number => occurrences(sample, pattern).length;
    expect(hits(PERMISSION)).toBeGreaterThanOrEqual(3);
    expect([SESSION_OR_DEVICE, PRINCIPAL, OWN_ROWS, STATEMENT, SYSTEM_TIME, TIMER, CONSOLE_OR_ENVIRONMENT, ROUTE, ROUTE_SHORTHAND, ROUTE_HOOK, SLOT_REPLACED, TEST_IMPORT, COOKIE_OR_HOST].map(hits)).toEqual([
      1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    ]);
    expect(hits(DENIAL)).toBe(3);
    expect(hits(SIMULATOR_DIRECT)).toBe(5);
    expect(hits(PATH_LITERAL)).toBe(2);
    expect(hits(ROUTE_FROM_REGISTRY)).toBe(0);
    expect([...sample[0]!.text.matchAll(REQUEST_MEMBER)].map((match) => match[1])).toEqual(['principal', 'headers']);
  });
});

describe('M3: who may call is stage 6, only', () => {
  it('the folder names no permission and no role', () => {
    expect(places(PERMISSION)).toEqual([]);
  });

  it('it reads no session, no operator and no device of the caller', () => {
    expect(places(SESSION_OR_DEVICE)).toEqual([]);
  });

  it('request.principal is handed to app.engine.command as it is, and used nowhere else', () => {
    expect(count(PRINCIPAL)).toBe(3);
    expect(count(PRINCIPAL_TO_ENGINE)).toBe(3);
    expect(places(PRINCIPAL).every((place) => place.startsWith('src/modules/devices/index.ts:'))).toBe(true);
  });

  it('it builds no refusal of its own and writes no denial row: no ApiFailure, no denial code, no place in the budget', () => {
    expect(places(DENIAL)).toEqual([]);
  });

  it('no route carries a hook; the one hook of the folder is the feed\'s `onReady` (pass D11), which adds its boot step after the capture unit\'s', () => {
    expect(places(ROUTE_HOOK, routesCode)).toEqual([]);
    expect(places(ROUTE_HOOK, feedCode)).toHaveLength(1);
    expect(feedCode[0]?.text).toMatch(/app\.addHook\('onReady',/);
    expect(places(/\baddBootStep\s*\(/g)).toHaveLength(1);
    expect(places(/\baddBootStep\s*\(/g, feedCode)).toHaveLength(1);
  });
});

describe('M4, M5: a state change is a hosted action; the module writes nothing itself', () => {
  it('no audit row, no event, no unit of work, no publication, no statement', () => {
    expect(places(OWN_ROWS)).toEqual([]);
    expect(places(STATEMENT)).toEqual([]);
  });

  it('of the engine seam it uses three members: command (three calls, five operations), state (four reads) and meters (the two answers with audio channels)', () => {
    const members = ownCode.flatMap((file) => [...file.text.matchAll(ENGINE_MEMBER)].map((match) => match[1]));
    expect(members.filter((member) => member === 'command')).toHaveLength(3);
    expect(members.filter((member) => member === 'state')).toHaveLength(4);
    // The newest meter frame (decisions D89, D122): a required member of the seam, called without a fallback.
    expect(members.filter((member) => member === 'meters')).toHaveLength(2);
    expect([...all.matchAll(/\bengine\s*\.\s*meters\s*(\?\.)?\s*\(\s*\)/g)].map((match) => match[1])).toEqual([undefined, undefined]);
    // Pass D11: the feed reads `running` once (a stopped engine is handed nothing); it reaches the fact doors through `factDoorsOf(app.engine)`.
    expect(members.filter((member) => member === 'running')).toHaveLength(1);
    expect(feedCode.flatMap((file) => [...file.text.matchAll(ENGINE_MEMBER)].map((match) => match[1]))).toEqual(['running']);
    expect([...new Set(members)].sort()).toEqual(['command', 'meters', 'running', 'state']);
  });

  it('it calls no simulator action directly, runs no transition and reads no working state of the simulator', () => {
    expect(places(SIMULATOR_DIRECT)).toEqual([]);
  });

  it('the hosted actions it names are deviceCommand, setActiveCamera and resetClip', () => {
    const named = [...all.matchAll(/engine\s*\.\s*command\s*\(\s*request\s*\.\s*principal\s*,\s*'([A-Za-z]+)'/g)].map((match) => match[1]);
    expect(named).toEqual(['deviceCommand', 'setActiveCamera', 'resetClip']);
  });
});

describe('M8: time, and what the folder may touch', () => {
  it('every instant is app.clock: no system time and no timer', () => {
    expect(places(SYSTEM_TIME)).toEqual([]);
    expect(places(TIMER)).toEqual([]);
    expect(count(/\bapp\s*\.\s*clock\s*\.\s*now\s*\(/g)).toBe(2);
  });

  it('nothing is written to the console, no environment is read, nothing listens', () => {
    expect(places(CONSOLE_OR_ENVIRONMENT)).toEqual([]);
  });

  it('M14: the folder writes no log line and no error-log entry of its own, so no error can be logged under a key other than err', () => {
    // An unexpected failure is the error envelope's to log (as `{ err }`) and to persist; a
    // hosted action that fails is the engine host's.
    expect(places(LOG_CALL, routesCode)).toEqual([]);
    expect(places(/\berrorLog\b/g, routesCode)).toEqual([]);
    expect(places(/\btry\s*\{|\bcatch\s*[({]|\.\s*catch\s*\(/g)).toEqual([]);
    // Pass D11, the feed: ONE failure path (the rejection handler of the hand-over), one log line under `err`, one entry of the error log.
    expect(places(LOG_CALL, feedCode)).toHaveLength(1);
    expect(places(/\berrorLog\s*\.\s*append\s*\(/g, feedCode)).toHaveLength(1);
    expect(places(/\{\s*err\s*,/g, feedCode)).toHaveLength(1);
    expect(places(/\{\s*(?:error|cause|e)\s*[,:}]/g, feedCode)).toEqual([]);
    // Positive control of the two patterns.
    const sample: SourceFile[] = [{ path: 'src/sample.ts', text: `try { run(); } catch (error) { request.log.warn({ error }, 'failed'); app.log.error({ err: error }, 'failed'); }` }];
    expect(occurrences(sample, LOG_CALL)).toHaveLength(2);
    expect(occurrences(sample, /\btry\s*\{|\bcatch\s*[({]|\.\s*catch\s*\(/g)).toHaveLength(2);
  });

  it('no cookie is set and nothing keys on a host or a user agent', () => {
    expect(places(COOKIE_OR_HOST)).toEqual([]);
  });

  it('no stage and no seam is provided or replaced, and nothing is imported from a test folder', () => {
    expect(places(SLOT_REPLACED)).toEqual([]);
    expect(places(TEST_IMPORT)).toEqual([]);
  });

  it('the folder imports the contract, the shared simulator\'s pure exports, the engine\'s types and the guard\'s route helper, and nothing else of the server', () => {
    const sources = new Set(ownCode.flatMap((file) => [...file.text.matchAll(IMPORT_SOURCE)].map((match) => match[1] ?? '')));
    expect([...sources].sort()).toEqual([
      // Pass D11, the feed only: the capture-session unit's events, the fence's registry and open sources, the error description of the logger.
      '../../capture-session',
      '../../capture/fence',
      '../../engine',
      // LCD integration (user request 2026-10-19): lifecycle/HTTP stay in the separate lcd unit.
      '../../lcd',
      '../../plugins/logger',
      '../../plugins/permission-guard',
      './operations',
      './source-facts',
      './status',
      '@dems/shared/api',
      '@dems/shared/domain',
      '@dems/shared/sim',
      'fastify',
      'fastify-type-provider-zod',
      'zod',
    ]);
    // The engine is imported for its types only: nothing of it runs in this folder.
    const engineImports = routesCode.flatMap((file) => file.text.split('\n').filter((line) => line.includes(`'../../engine'`)));
    expect(engineImports).toHaveLength(1);
    expect(engineImports.every((line) => line.trimStart().startsWith('import type '))).toBe(true);
    // Pass D11: the feed imports the fact doors, and the three capture / logger sources are its alone.
    expect(feedCode[0]?.text.split('\n').filter((line) => line.includes(`'../../engine'`))).toEqual(["import { factDoorsOf, provideCaptureDeviceListing } from '../../engine';"]); // + the device-list rule (fix F-M4, R69-03)
    for (const source of ['../../capture-session', '../../capture/fence', '../../plugins/logger']) {
      expect(routesCode.some((file) => file.text.includes(`'${source}'`)), source).toBe(false);
    }
  });
});

describe('M2, M7: routes and input', () => {
  it('every route is registered from its registry entry: ten routes, no path written in the folder', () => {
    // Seven `route(` calls: four reads, one in the loop over the three device commands, two view commands,
    // and the one read of the panel's own firmware word (LCD bridge task, operation 114).
    expect(count(ROUTE)).toBe(8);
    expect(count(ROUTE_FROM_REGISTRY)).toBe(8);
    expect(places(ROUTE_SHORTHAND)).toEqual([]);
    expect(places(PATH_LITERAL)).toEqual([]);
  });

  it('of a request it reads the principal, the validated path ID and the validated body, and nothing else', () => {
    const members = ownCode.flatMap((file) => [...file.text.matchAll(REQUEST_MEMBER)].map((match) => [match[1], match[2]].filter((part) => part !== undefined).join('.')));
    expect(members.sort()).toEqual(['body.cameraId', 'body.channel', 'params.id', 'principal', 'principal', 'principal']);
  });
});
