// Static guards of the realtime channel (plan row W42; standing rules M1, M3, M8, M14 where they
// apply to a unit that is not a route module). They read the production sources of this folder as
// text, with the scaffold's scanner, and keep its rules true for every later row that touches it:
//
//   1. Authentication is not decided here: nothing reads a header, a cookie, the URL, a query
//      string or a subprotocol, and nothing resolves a credential (SR-38). The route reads what
//      stage 4 found.
//   2. No token, cookie value or credential is held: the hub maps by row IDs (spec §9.5).
//   3. One clock: no system time; and no timer of its own: the three steps come from the
//      injected timer (M8).
//   4. Nothing is written: no unit of work, no statement, no audit row. The one call that
//      changes state is the engine's `setTabletLink` (spec §6.8).
//   5. The socket library is behind the transport: only `index.ts` names it; the hub runs
//      without it.
//   6. Compression off, the message size capped, no subprotocol selected (RT-P4, RT-P7, SR-38).
//   7. Close codes and the client's limits are the contract's constants, never a number here.
//   8. The role table of this process decides nothing: the permissions of a socket are what
//      stage 4 read and what a publication carried (RB-3).
//   9. Logging: no console, nothing of a frame in a log call (SR-51).
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../test/static/scan';

const OWN_FOLDER = 'src/realtime/';

const all = readTree(WORKSPACE).filter((file) => isProductionSource(file.path) && file.path.startsWith(OWN_FOLDER));
const code = codeOnly(all);
const files = (pattern: RegExp, where: readonly SourceFile[] = code): string[] => [
  ...new Set(occurrences(where, pattern).map((place) => place.replace(/:\d+$/, ''))),
];
const textOf = (name: string): string => code.find((file) => file.path === `${OWN_FOLDER}${name}`)?.text ?? '';

const REQUEST_DATA = new RegExp(
  [
    `\\brequest\\s*\\.\\s*${'headers'}\\b`,
    `\\brequest\\s*\\.\\s*${'cookies'}\\b`,
    `\\brequest\\s*\\.\\s*${'query'}\\b`,
    `\\b(?:request|req|raw)\\s*\\.\\s*(?:${'url'}|original${'Url'})\\b`,
    `\\bsearch${'Params'}\\b`,
    `\\b${'authorization'}\\b`,
    `sec-websocket-${'protocol'}`,
    `\\.\\s*${'protocol'}\\b`,
  ].join('|'),
  'gi',
);
const CREDENTIAL_RESOLUTION = new RegExp(
  [`\\bsession${'Registry'}\\b`, `\\bresolve${'Credential'}\\b`, `\\bresolve${'Device'}\\b`, `\\bread${'Credential'}\\b`, `\\bbearer${'ValueOf'}\\b`, `\\b${'Bearer'}\\b`].join('|'),
  'g',
);
const SECRET_NAME = new RegExp([`\\b${'token'}\\b`, `\\b${'cookie'}Value\\b`, `\\b${'credential'}\\s*[:=]`, `\\b${'password'}\\b`, `\\b${'ses'}_`, `\\b${'dvc'}_`, `\\b${'bio'}_`].join('|'), 'g');
const SYSTEM_TIME = new RegExp([`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\s*\\(\\s*\\)`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`].join('|'), 'g');
const TIMER = new RegExp(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, 'g');
const RANDOM = new RegExp(`\\bMath\\s*\\.\\s*${'random'}\\b`, 'g');
const WRITES = new RegExp(
  [`\\bpipeline\\b`, `\\bengine\\s*\\(?\\)?\\s*\\.\\s*(?:command|run)\\b`, `\\bunit\\s*\\.`, `\\bapp\\s*\\.\\s*db\\b`, `\\baudit${'Writer'}\\b`, `\\b(?:insert\\s+into|update\\s+public|delete\\s+from)\\b`].join('|'),
  'gi',
);
const SOCKET_LIBRARY = new RegExp(`['"](?:${'ws'}|@fastify/${'websocket'})['"]`, 'g');
const CLOSE_CODE_NUMBER = new RegExp(`\\b(?:${['1001', '1008', '1009', '1013', '4401', '4403', '4408'].join('|')})\\b`, 'g');
const ROLE_TABLE = new RegExp([`\\b${'ROLE'}_${'PERMISSIONS'}\\b`, `\\bOperatorRole\\s*\\.\\s*[A-Z]`, `['"](?:${'SUPERVISOR'}|${'INVESTIGATOR'}|${'TECHNICIAN'})['"]`].join('|'), 'g');
const CONSOLE = new RegExp(`\\b${'console'}\\s*\\.`, 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b|\\.\\s*${'listen'}\\s*\\(`, 'g');
const FRAME_IN_LOG = new RegExp(`\\blog\\s*\\.\\s*(?:fatal|error|warn|info|debug|trace)\\s*\\([^;]*\\b(?:data|text|json|message|parsed|frame|payload|state|ops)\\s*[,:}]`, 'g');

describe('the scan itself', () => {
  it('reads the production sources of the folder', () => {
    expect(all.map((file) => file.path)).toEqual([
      'src/realtime/admission.ts',
      'src/realtime/handshake.ts',
      'src/realtime/hub-types.ts',
      'src/realtime/hub.ts',
      'src/realtime/index.ts',
      'src/realtime/limits.ts',
      'src/realtime/messages.ts',
      'src/realtime/publication.ts',
      'src/realtime/tablet-link.ts',
    ]);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'a.ts', text: `const origin = request.${'headers'}.origin; const t = new URL(u).search${'Params'}.get('x');` },
      { path: 'b.ts', text: `await app.session${'Registry'}.resolve(value, 'COOKIE');` },
      { path: 'c.ts', text: `const at = Date.${'now'}(); const d = new Date(); set${'Interval'}(() => {}, 1000);` },
      { path: 'd.ts', text: `await app.pipeline.run('x', async (unit) => { await unit.query('INSERT INTO public.events VALUES ($1)'); });` },
      { path: 'e.ts', text: `import { WebSocketServer } from '${'ws'}';` },
      { path: 'f.ts', text: `socket.close(${'4401'}, 'x'); if (role === '${'SUPERVISOR'}') grant();` },
      { path: 'g.ts', text: `log.info({ connectionId, data }, 'client message');` },
      { path: 'h.ts', text: `const ${'token'} = message.x;` },
    ];
    expect(files(REQUEST_DATA, planted)).toEqual(['a.ts']);
    expect(files(CREDENTIAL_RESOLUTION, planted)).toEqual(['b.ts']);
    expect(files(SYSTEM_TIME, planted)).toEqual(['c.ts']);
    expect(files(TIMER, planted)).toEqual(['c.ts']);
    expect(files(WRITES, planted)).toEqual(['d.ts']);
    expect(files(SOCKET_LIBRARY, planted)).toEqual(['e.ts']);
    expect(files(CLOSE_CODE_NUMBER, planted)).toEqual(['f.ts']);
    expect(files(ROLE_TABLE, planted)).toEqual(['f.ts']);
    expect(files(FRAME_IN_LOG, planted)).toEqual(['g.ts']);
    expect(files(SECRET_NAME, planted)).toEqual(['h.ts']);
    // A time with an argument is a conversion, not a reading of the system time.
    expect(files(SYSTEM_TIME, [{ path: 'x.ts', text: 'new Date(input.now).toISOString()' }])).toEqual([]);
  });
});

describe('SR-38: authentication is not decided in this folder', () => {
  it('nothing reads a header, a cookie, the URL, a query string or a subprotocol', () => {
    expect(occurrences(code, REQUEST_DATA)).toEqual([]);
  });

  it('nothing resolves a credential: the route reads request.principal and authenticationOf(request)', () => {
    expect(occurrences(code, CREDENTIAL_RESOLUTION)).toEqual([]);
    const index = textOf('index.ts');
    expect(index).toMatch(/admissionOf\(request\.principal, authenticationOf\(request\)\)/);
    expect(occurrences(code, /\bauthenticationOf\s*\(/g)).toHaveLength(1);
  });

  it('nothing holds a token, a cookie value, a credential or a password (spec §9.5)', () => {
    expect(occurrences(code, SECRET_NAME)).toEqual([]);
  });
});

describe('M8: one clock, and no timer of its own', () => {
  it('no production file reads the system time, sets a timer or draws a random number', () => {
    expect(occurrences(code, SYSTEM_TIME)).toEqual([]);
    expect(occurrences(code, TIMER)).toEqual([]);
    expect(occurrences(code, RANDOM)).toEqual([]);
  });

  it('the three steps come from the injected timer, and only the plugin starts them', () => {
    expect(files(/\btimer\s*\.\s*every\s*\(/g)).toEqual(['src/realtime/index.ts']);
    expect(textOf('index.ts')).toMatch(/let timer: EngineTimer = createSystemTimer\(\);/);
  });

  it('CPS1-4: the bound of a handshake is the server clock\'s, checked at the pace step; no socket gets a timer of its own', () => {
    expect(occurrences(code, /\.\s*setTimeout\s*\(/g)).toEqual([]);
    const index = textOf('index.ts');
    expect(index).toMatch(/timer\.every\(REALTIME_DELTA_PACE_MS, pace\),/);
    expect(index).toMatch(/const destroyed = handshakes\.sweep\(\);/);
    expect(index).toMatch(/createHandshakeGuard\(followClock\(\(\) => app\.clock\), \{/);
  });

  it('CPS1-4: every upgrade is handed to the guard first, and the guard is told of every way a handshake ends', () => {
    const index = textOf('index.ts');
    expect(index).toMatch(/app\.server\.prependListener\('upgrade', onUpgrade\);/);
    expect(index).toMatch(/handshakes\.begin\(rawRequest, socket\)/);
    expect(index).toMatch(/handshakes\.taken\(request\.raw\);/);
    expect(index).toMatch(/handshakes\.answered\(request\.raw\);/);
    expect(occurrences(code, /\bhandshakes\s*\.\s*clear\s*\(/g)).toHaveLength(2);
  });
});

describe('the channel writes nothing', () => {
  it('no unit of work, no statement, no audit row, no hosted command', () => {
    expect(occurrences(code, WRITES)).toEqual([]);
  });

  it('the one call that changes state is setTabletLink, in the tablet link', () => {
    expect(files(/\bsetTabletLink\s*\(/g)).toEqual(['src/realtime/tablet-link.ts']);
  });

  it('nothing reads the environment or listens', () => {
    expect(occurrences(code, ENVIRONMENT)).toEqual([]);
  });
});

describe('the socket library is behind the transport', () => {
  it('only index.ts names it; the hub, the admission and the messages run without it', () => {
    expect(files(SOCKET_LIBRARY)).toEqual(['src/realtime/index.ts']);
  });

  it('RT-P4, RT-P7, SR-38: the message size is capped, compression is off, no subprotocol is selected', () => {
    const index = textOf('index.ts');
    expect(index).toMatch(/maxPayload: REALTIME_CLIENT_MESSAGE_MAX_BYTES,/);
    expect(index).toMatch(/perMessageDeflate: false,/);
    expect(index).toMatch(/handleProtocols: \(\) => false,/);
    expect(index).toMatch(/compress: false/);
  });

  it('exactly one route is registered, on the contract\'s path', () => {
    expect(occurrences(code, /\bapp\s*\.\s*(?:route|get|post|put|delete|patch)\s*\(/g)).toHaveLength(1);
    expect(textOf('index.ts')).toMatch(/url: WS_PATH,/);
  });
});

describe('the numbers of the protocol are constants', () => {
  it('no close code is written as a number: they are the contract\'s RealtimeCloseCode', () => {
    expect(occurrences(code, CLOSE_CODE_NUMBER)).toEqual([]);
  });

  it('the numbers a client and the server share are imported from the contract, not repeated', () => {
    const limits = textOf('limits.ts');
    for (const name of ['HEARTBEAT_INTERVAL_MS', 'REALTIME_CLIENT_MESSAGE_LIMIT', 'REALTIME_CLIENT_MESSAGE_MAX_BYTES', 'REALTIME_RESYNC_MIN_INTERVAL_MS']) {
      expect(limits, name).toContain(name);
      expect(new RegExp(`export const ${name}\\b`).test(limits), name).toBe(false);
    }
  });
});

describe('RB-3: the role table of this process decides nothing', () => {
  it('no role name and no role table: a socket\'s permissions are what stage 4 read and what a publication carried', () => {
    expect(occurrences(code, ROLE_TABLE)).toEqual([]);
  });
});

describe('SR-48, SR-51: logging', () => {
  it('no console call, and no log call names a frame, a message or a state', () => {
    expect(occurrences(code, CONSOLE)).toEqual([]);
    expect(occurrences(code, FRAME_IN_LOG)).toEqual([]);
  });
});
