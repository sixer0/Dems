// Static guards of the sessions module (plan row W34; standing rules M3, M4, M5, M8, M14 of the
// gate report; decisions D83, D87). They read the production sources of `src/modules/sessions/`
// as text, with the scaffold's scanner, and keep these rules true for every later change:
//
//   1. Who may call is stage 6, only: the module names no permission and no role, reads nothing
//      of the principal, and writes no denial row.
//   2. A command is the engine host's: no simulator action is called directly, the working state
//      of the `Sim` is never read, no unit of the core pipeline is opened, and no row of the
//      audit trail or the event list is written by the module.
//   3. The state inside a unit is read in ONE place, for the decision "is this the open
//      session", and never becomes an answer.
//   4. One clock: nothing here reads the system time or starts a timer.
//   5. A request is read by its validated parts only: no header, no cookie, no raw URL.
//   6. An error is logged under the key `err` and no other (M14); nothing is written to the
//      console.
//   7. The module reaches the rest of the server through a fixed list of folders.
//   8. One error precedence (decision D94): the bodies of a stop and of a note are read in the
//      handler with the contract's schema; a text that is absent or too short reaches the hosted
//      action as the empty text and never as it was sent; no route takes a validation failure
//      into its handler.
//
// Every forbidden text is built from fragments, so that this file does not contain it.
import { describe, expect, it } from 'vitest';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../../test/static/scan';

const FOLDER = 'src/modules/sessions/';

const tree = readTree(WORKSPACE);
const own = tree.filter((file) => isProductionSource(file.path) && file.path.startsWith(FOLDER));
const code = codeOnly(own);

const places = (pattern: RegExp, where: readonly SourceFile[] = code): string[] => occurrences(where, pattern);
const files = (pattern: RegExp, where: readonly SourceFile[] = code): string[] => [...new Set(places(pattern, where).map((place) => place.replace(/:\d+$/, '')))];
const textOf = (path: string): string => code.find((file) => file.path === path)?.text ?? '';

const PERMISSION_NAME = new RegExp(`\\bPermission\\s*\\.\\s*[A-Z_]+\\b|\\b${'permissions'}\\s*\\.\\s*includes\\b|\\b${'role'}Has\\b|\\bOperator${'Role'}\\b|\\bROLE_${'PERMISSIONS'}\\b`, 'g');
const PRINCIPAL_MEMBER = new RegExp(`\\bprincipal\\s*\\??\\.\\s*(?:${'kind'}|${'role'}|${'permissions'}|operator${'Id'}|device${'Id'}|session${'Id'})\\b`, 'g');
const SESSION_OR_DEVICE_CHECK = new RegExp(`\\b(?:operatorSession${'Of'}|authentication${'Of'}|consoleIdentity${'Of'}|device${'Resolver'}|session${'Registry'}|refuseRetired${'Device'})\\b`, 'g');
const DENIAL_ROW = new RegExp(`\\b(?:ACCESS|EXPORT)_${'DENIED'}\\b|\\bdenial${'Budget'}\\b`, 'g');
const OWN_ROWS = new RegExp(`\\.\\s*audit\\s*\\.\\s*${'append'}|\\.\\s*events\\s*\\.\\s*${'append'}|\\baudit${'Writer'}\\b|\\binsert\\s+into\\b|\\.\\s*(?:${'insert'}|${'update'}|${'delete'})\\s*\\(`, 'gi');
const PIPELINE_UNIT = new RegExp(`\\bpipeline\\s*\\.\\s*${'run'}\\b|\\bafter${'Commit'}\\b|\\bscope\\s*\\.\\s*${'unit'}\\b`, 'g');
const DIRECT_SIMULATOR = new RegExp(`\\b${'sim'}\\s*\\.\\s*actions\\b|\\.\\s*${'simulator'}\\s*\\(|\\bengine${'Control'}\\b|\\bcreate${'Sim'}\\b|\\b${'store'}\\s*\\.\\s*(?:get|set)State\\b|\\bhandleSimApi${'Request'}\\b`, 'g');
const PENDING = new RegExp(`\\b${'pending'}\\s*\\(`, 'g');
const SYSTEM_TIME = new RegExp([`\\bDate\\s*\\.\\s*${'now'}\\s*\\(`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*${'now'}\\b`, `\\bhr${'time'}\\b`].join('|'), 'g');
const TIMER = new RegExp(`\\bset(?:${'Timeout'}|${'Interval'}|${'Immediate'})\\s*\\(`, 'g');
const CONSOLE = new RegExp(`\\b${'console'}\\s*\\.`, 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b|\\.\\s*${'listen'}\\s*\\(`, 'g');
const RAW_REQUEST = new RegExp(`\\brequest\\s*\\.\\s*(?:${'headers'}|${'cookies'}|raw|${'url'}|original${'Url'}|${'ip'}|host${'name'})\\b`, 'g');
const COOKIE = new RegExp(`\\bset${'Cookie'}\\b|\\bclear${'Cookie'}\\b|set-${'cookie'}`, 'gi');
const HOOK = new RegExp(`\\badd${'Hook'}\\s*\\(|\\b(?:on${'Request'}|pre${'Parsing'}|pre${'Validation'}|pre${'Handler'}|pre${'Serialization'}|on${'Send'}|error${'Handler'})\\s*:`, 'g');
const SLOT = new RegExp(`\\b(?:stages|seams)\\s*\\.\\s*(?:${'replace'}|${'provide'})\\s*\\(|\\badd${'BootStep'}\\b`, 'g');
const TEST_IMPORT = new RegExp(`from\\s+['"][^'"]*__${'tests'}__[^'"]*['"]`, 'g');
/** A log call with an object: `<something>.log.<level>({ … }`. */
const LOG_CALL = /\blog\s*\.\s*(?:trace|debug|info|warn|error|fatal)\s*\(\s*(\{[^}]*\}|[^,)]*)/g;
const IMPORT_FROM = /from\s+'([^']+)'/g;

describe('the scan itself', () => {
  it('reads the eight production sources of the module', () => {
    expect(own.map((file) => file.path)).toEqual([
      'src/modules/sessions/audio-intervals.ts',
      'src/modules/sessions/current.ts',
      'src/modules/sessions/history.ts',
      'src/modules/sessions/index.ts',
      'src/modules/sessions/operations.ts',
      'src/modules/sessions/refusals.ts',
      'src/modules/sessions/routes.ts',
      'src/modules/sessions/text-body.ts',
    ]);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const sample: SourceFile[] = [
      {
        path: 'src/sample.ts',
        text: [
          `if (!request.principal.${'permissions'}.includes(Permission.SESSION_START)) throw refused();`,
          `if (request.principal.${'kind'} !== 'OPERATOR') throw refused();`,
          `const session = operatorSession${'Of'}(request);`,
          `await unit.audit.${'append'}({ type: 'ACCESS_${'DENIED'}' });`,
          `await app.pipeline.${'run'}('sessions.x', async (unit) => {});`,
          `host.${'sim'}.actions.cancel();`,
          `return scope.${'pending'}().session;`,
          `const at = Date.${'now'}();`,
          `set${'Timeout'}(() => {}, 1);`,
          `${'console'}.log(1);`,
          `const port = process.${'env'}.PORT;`,
          `const agent = request.${'headers'}['user-agent'];`,
          `reply.set${'Cookie'}('a', 'b');`,
          `routes.route({ pre${'Handler'}: async () => {} });`,
          `app.seams.${'replace'}('engine', fake);`,
          `import { x } from '../__${'tests'}__/support';`,
          `request.log.error({ error }, 'failed');`,
        ].join('\n'),
      },
    ];
    const hits = (pattern: RegExp): number => occurrences(sample, pattern).length;
    expect(
      [PERMISSION_NAME, PRINCIPAL_MEMBER, SESSION_OR_DEVICE_CHECK, DENIAL_ROW, OWN_ROWS, PIPELINE_UNIT, DIRECT_SIMULATOR, PENDING, SYSTEM_TIME, TIMER, CONSOLE, ENVIRONMENT, RAW_REQUEST, COOKIE, HOOK, SLOT, TEST_IMPORT, LOG_CALL].map(hits),
    ).toEqual([2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });
});

describe('rule M3: who may call is stage 6, only', () => {
  it('the module names no permission and no role, reads no member of the principal, and resolves no session or device itself', () => {
    expect(places(PERMISSION_NAME)).toEqual([]);
    expect(places(PRINCIPAL_MEMBER)).toEqual([]);
    expect(places(SESSION_OR_DEVICE_CHECK)).toEqual([]);
  });

  it('the principal is only ever handed on, as it is, to the engine: every use of it is an argument of a hosted command', () => {
    const uses = places(/\brequest\s*\.\s*principal\b/g);
    expect(files(/\brequest\s*\.\s*principal\b/g)).toEqual(['src/modules/sessions/routes.ts']);
    // Task 3 row 71: operation 81 hands it on, as it is, to the capture-session unit (which names the actor and the sending device of the switch).
    const handedOn = places(/\.\s*(?:command|switchAudioSource)\s*\(\s*request\s*\.\s*principal\s*,/g);
    expect(handedOn).toEqual(uses);
    expect(places(/\.\s*switchAudioSource\s*\(\s*request\s*\.\s*principal\s*,/g)).toHaveLength(1);
    // Thirteen call sites: the three steps of the composite start, the shared handler of the
    // three transitions, and one for each of the other nine commands.
    expect(uses).toHaveLength(14);
  });

  it('the module writes no denial row and takes no place in the denial budget: both are the guard\'s', () => {
    expect(places(DENIAL_ROW)).toEqual([]);
  });

  it('no route has a hook, no stage or seam is touched, and no boot step is added', () => {
    expect(places(HOOK)).toEqual([]);
    expect(places(SLOT)).toEqual([]);
  });
});

describe('rules M4 and M5: a command is the engine host\'s', () => {
  it('no simulator action is called directly and the working state of the Sim is never read', () => {
    expect(places(DIRECT_SIMULATOR)).toEqual([]);
  });

  it('the module opens no unit of the core pipeline and writes no row: no audit row, no event, no INSERT, UPDATE or DELETE', () => {
    expect(places(PIPELINE_UNIT)).toEqual([]);
    expect(places(OWN_ROWS)).toEqual([]);
  });

  it('every command goes through app.engine.command or app.engine.run, and only routes.ts calls the engine', () => {
    expect(files(/\bapp\s*\.\s*engine\b/g)).toEqual(['src/modules/sessions/routes.ts']);
    const routes = textOf('src/modules/sessions/routes.ts');
    expect(routes.match(/\bapp\s*\.\s*engine\s*\.\s*command\s*\(/g)).toHaveLength(3);
    expect(routes.match(/\bapp\s*\.\s*engine\s*\.\s*run\s*\(/g)).toHaveLength(1);
    // The three reads of the committed state: the open session after a create, the monitor, and
    // the open session of operation 82 (integration pass D4). Pass D6 (F-D4-4): + 2 in operation 81's
    // one line - the open session and the selector, for `409 AUDIO_SOURCE_CONFLICT` in simulated capture.
    expect(routes.match(/\bapp\s*\.\s*engine\s*\.\s*(?:state|slice)\s*\(/g)).toHaveLength(5);
    expect(routes.match(/\bapp\s*\.\s*engine\s*\.\s*\w+/g)?.every((call) => /\.(?:command|run|state|slice)$/.test(call))).toBe(true);
  });

  it('the state inside a unit is read in one place, for the decision about the open session, and is never returned', () => {
    expect(places(PENDING)).toHaveLength(1);
    const routes = textOf('src/modules/sessions/routes.ts');
    expect(routes).toMatch(/const session = scope\.pending\(\)\.session;\s*if \(session === null \|\| session\.id !== id\) throw notOpenSession\(\);/);
    expect(routes).not.toMatch(/return\s+scope\s*\.\s*pending/);
  });

  it('the two statements of the module are reads: the history page and the audio-source intervals (operation 82), through the typed builder on the pool the pool plugin\'s helper hands over', () => {
    expect(files(/\.\s*select\s*\(/g)).toEqual(['src/modules/sessions/audio-intervals.ts', 'src/modules/sessions/history.ts']);
    expect(places(/\.\s*select\s*\(/g)).toHaveLength(2);
    // `app.db.read` (review finding CPB1-8): the module keeps no pool and probes nothing itself.
    expect(files(/\bapp\s*\.\s*db\s*\.\s*read\s*\(/g)).toEqual(['src/modules/sessions/audio-intervals.ts', 'src/modules/sessions/history.ts']);
    expect(places(/\bapp\s*\.\s*db\s*\.\s*read\s*\(HISTORY_READ_SOURCE, .*, request\);/g)).toHaveLength(1);
    expect(places(/\bapp\s*\.\s*db\s*\.\s*read\s*\(INTERVALS_READ_SOURCE, .*, request\);/g)).toHaveLength(1);
    expect(files(/\bapp\s*\.\s*db\s*\.\s*(?:pool|probe)\b/g)).toEqual([]);
  });
});

describe('rules M8 and M14: time, the request, the log', () => {
  it('reads no system time and starts no timer; the one instant it needs is app.clock\'s', () => {
    expect(places(SYSTEM_TIME)).toEqual([]);
    expect(places(TIMER)).toEqual([]);
    expect(places(/\bapp\s*\.\s*clock\s*\.\s*now\s*\(/g)).toHaveLength(1);
  });

  it('reads no header, no cookie and no raw URL of a request, and sets no cookie', () => {
    expect(places(RAW_REQUEST)).toEqual([]);
    expect(places(COOKIE)).toEqual([]);
  });

  it('writes nothing to the console, reads no environment and never listens', () => {
    expect(places(CONSOLE)).toEqual([]);
    expect(places(ENVIRONMENT)).toEqual([]);
  });

  it('M14: the module has no log call of its own: the error of a failed read is logged by the pool plugin\'s helper, under the key err', () => {
    const calls = code.flatMap((file) => [...file.text.matchAll(LOG_CALL)].map((match) => `${file.path}: ${match[0].replace(/\s+/g, ' ')}`));
    expect(calls).toEqual([]);
    expect(places(/\b(?:error|err)\s*\.\s*message\b/g)).toEqual([]);
  });
});

describe('decision D94: one error precedence for the two texts the hosted action bounds from below', () => {
  const routes = (): string => textOf('src/modules/sessions/routes.ts');

  it('the bodies of a stop and of a note are read in the handler, with the schema the registry names, and nowhere else', () => {
    expect(files(/\breadTextBody\s*\(/g)).toEqual(['src/modules/sessions/routes.ts']);
    expect(routes().match(/\breadTextBody\s*\(/g)).toHaveLength(2);
    expect(routes()).toMatch(/const stopBody = bodySchemaOf\('stopSession', SessionStopRequestSchema\);/);
    expect(routes()).toMatch(/const noteBody = bodySchemaOf\('addSessionNote', SessionNoteRequestSchema\);/);
    expect(routes()).toMatch(/readTextBody\(stopBody, 'reason', request\.body\)/);
    expect(routes()).toMatch(/readTextBody\(noteBody, 'text', request\.body\)/);
    // Neither schema is a route's body schema: stage 7 would answer the lower bound before the session.
    expect(routes()).not.toMatch(/body:\s*(?:SessionStopRequestSchema|SessionNoteRequestSchema|stopBody|noteBody)\b/);
  });

  it('a body of the wrong shape is refused before the engine, and a missing text reaches the action as NO_TEXT, never as it was sent', () => {
    // Each read is followed at once by the refusal of line 8.
    expect(routes().match(/readTextBody\([^;]+;\s*if \(body\.kind === 'INVALID'\) throw invalidInput\('body'\);/g)).toHaveLength(2);
    expect(routes()).toMatch(/const reason = body\.kind === 'VALID' \? body\.value\.reason : NO_TEXT;/);
    expect(routes()).toMatch(/const text = body\.kind === 'VALID' \? body\.value\.text : NO_TEXT;/);
    // In those two handlers nothing else of the body is read: the action gets `reason` or `text`.
    // (the sixth read is operation 81's `inputId`, validated by the route's body schema; the seventh
    // is the same `inputId` in the 409 rule of pass D6)
    expect(routes().match(/\brequest\s*\.\s*body\b/g)).toHaveLength(7);
    expect(places(/\brequest\s*\.\s*body\b/g).every((place) => place.startsWith('src/modules/sessions/routes.ts'))).toBe(true);
  });

  it('no route takes a validation failure into its handler: what stage 7 refuses, stage 7 answers', () => {
    expect(places(new RegExp(`\\battach${'Validation'}\\b|\\bvalidation${'Error'}\\b`, 'g'))).toEqual([]);
  });

  it('the module answers no INVALID_REASON itself: that refusal is the hosted action\'s, mapped by the engine host', () => {
    expect(places(new RegExp(`\\bINVALID_${'REASON'}\\b|\\bREASON_TOO_${'SHORT'}\\b|\\bNOTE_${'INVALID'}\\b`, 'g'))).toEqual([]);
  });
});

describe('what the module depends on', () => {
  it('imports no test support, and reaches the rest of the server through this list of folders and no other', () => {
    expect(places(TEST_IMPORT)).toEqual([]);
    const imported = new Set<string>();
    for (const file of code) {
      for (const match of file.text.matchAll(IMPORT_FROM)) {
        const source = match[1] ?? '';
        if (source.startsWith('../')) imported.add(source);
      }
    }
    // `../../capture-notices`: the gate of a pre-check run (task 3 row 133; C3 §3.1).
    // `../../capture-session`: the capture of a real recording and operation 81 (task 3 row 71).
    // `../../sealing-host`: the retry ON DEMAND of a failed seal by the recovery operation (fix pass F-M7b, R88-02 (a)).
    expect([...imported].sort()).toEqual(['../../capture-notices', '../../capture-session', '../../db/mapping', '../../db/schema', '../../engine', '../../plugins/error-envelope', '../../plugins/permission-guard', '../../sealing-host']);
  });
});
