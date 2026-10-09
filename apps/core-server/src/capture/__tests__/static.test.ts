// Static guards of the capture folder (blueprint row 57 / M3-W1; check M3-SR-1; capture spec §G
// rules G-R1, G-R2, G-R4, G-R5, G-R7, G-R8; SEC35-25). They run in the database-free project, so
// they are part of every later row's gate.
//
//   G-R1  the host units (modules, engine, plugins, core) import no file system, no process, no
//         socket and no worker thread: the capture boundary is the only door to a process;
//   G-R2  under `src/capture/` the process module and the file system are imported ONLY by the
//         pinned allowlist (`supervisor.ts`, `ipc.ts`); no file of the folder names a credential
//         file, a key file or the oMLX settings;
//   G-R4  no log or audit call of the folder names a key, a credential, an address or a path;
//   G-R5  the folder does not use the paired-client resource `AdminResource.DEVICES`;
//   G-R7  the simulator is imported through its public barrel only;
//   G-R8  no file but `ipc.ts` starts a process, no file but `timers.ts` names a global timer,
//         and no file reads the system time, draws a random number or reads the environment.
//
// Every forbidden text is built from fragments, so that this file does not contain it. Each rule
// has a positive control: the same pattern on a planted source must FIND the text.
//
// The last block pins the edits of the three frozen files (P25) that OD-14's waiver grants (spec
// §I): edits 1 to 6, 11 and 12 (row 57), 13 and 14 (row 113, decision D68), and 7 to 10, the
// capture keys of config.ts (row 58).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { logCalls } from '../../../test/static/log-calls';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, under, type SourceFile } from '../../../test/static/scan';

const tree = readTree(WORKSPACE);
const production = codeOnly(tree.filter((file) => isProductionSource(file.path) && file.path.endsWith('.ts')));
const capture = production.filter((file) => file.path.startsWith('src/capture/'));
const HOST_UNITS = ['src/modules/', 'src/engine/', 'src/plugins/', 'src/core/'];
const hosts = production.filter((file) => under(file.path, HOST_UNITS));

const join = (...parts: string[]): string => parts.join('');
const moduleImport = (names: readonly string[]): RegExp => new RegExp(`['"](?:node:)?(?:${names.join('|')})(?:/[a-z]+)?['"]`, 'g');

const FILE_SYSTEM = moduleImport(['fs']);
const PROCESS_MODULE = moduleImport([join('child', '_process')]);
const SOCKET_OR_THREAD = moduleImport(['net', 'dgram', 'tls', 'http', 'https', 'http2', join('worker', '_threads'), 'cluster']);
/** A call of a function that starts a process, by its bare name (a method such as a pattern's `exec` is not one). */
const PROCESS_START = new RegExp(`(?<![.\\w$])(?:${['spawn', 'spawnSync', 'fork', 'exec', 'execSync', 'execFile', 'execFileSync'].join('|')})\\s*\\(`, 'g');
const SYSTEM_TIME = new RegExp(
  [`\\bDate\\s*\\.\\s*${'now'}\\b`, `\\bnew\\s+Date\\s*\\(`, `\\bperformance\\s*\\.\\s*(?:${'now'}|time${'Origin'})\\b`, `\\bprocess\\s*\\.\\s*hr${'time'}\\b`].join('|'),
  'g',
);
const RANDOM = new RegExp([`\\bMath\\s*\\.\\s*${'random'}\\b`, `\\brandom${'UUID'}\\b`, `\\bget${'RandomValues'}\\b`, `['"](?:node:)?${'crypto'}['"]`].join('|'), 'g');
const GLOBAL_TIMER = new RegExp(`\\b(?:set|clear)(?:${['Interval', 'Timeout', 'Immediate'].join('|')})\\s*\\(`, 'g');
const ENVIRONMENT = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\b`, 'g');
const SIM_DEEP_IMPORT = /from\s+'(?:@dems\/shared\/(?:src\/)?sim\/[^']+|(?:\.\.\/)+(?:\.\.\/)*packages\/[^']+)'/g;
const PAIRED_CLIENT_RESOURCE = new RegExp(`\\bAdminResource\\s*\\.\\s*${'DEVICES'}\\b`, 'g');
/** Credential files, key files and the settings of the shared model server: never named under `src/capture/`. */
const SECRET_PLACE = new RegExp(
  [`\\.${'omlx'}\\b`, `\\.data/${'pg'}`, `\\b${'pw'}file\\b`, `\\bpg\\.(?:owner\\.)?${'env'}\\b`, `\\.${'pem'}\\b`, `\\bid_${'rsa'}\\b`, `${'signer'}[-_.]?key`, `\\bsettings\\.${'json'}\\b`].join('|'),
  'gi',
);
/** Credential-shaped values (spec §G G-R4): a camera URL with a user part, an RTSP address, the media token prefix. */
const SECRET_SHAPE = new RegExp([`${'rtsp'}://`, `\\b${'mts'}_`, `://[^/\\s'"]*:[^/\\s'"]*@`].join('|'), 'gi');
/** A key of a logged object that would carry a secret, an address or a path. */
const SENSITIVE_KEY = /key|secret|credential|passw|token|url|uri|address|host|plan|path|env/i;
/** The fields of a capture plan that hold an address or a path, and the words for a secret. */
const SENSITIVE_NAME = new RegExp(`\\b(?:${['plan', 'ingestUrl', 'outputPath', 'credential', 'credentials', 'password', 'secret', 'token'].join('|')})\\b`, 'g');

const places = (files: readonly SourceFile[], pattern: RegExp): string[] => [...new Set(occurrences(files, pattern).map((place) => place.replace(/:\d+$/, '')))];

describe('the scan itself', () => {
  it('reads the production sources of the capture folder', () => {
    expect(capture.map((file) => file.path)).toEqual(['src/capture/forwarder.ts', 'src/capture/index.ts', 'src/capture/ipc.ts', 'src/capture/supervisor.ts', 'src/capture/timers.ts', 'src/capture/types.ts']);
    expect(hosts.length).toBeGreaterThan(100);
  });

  it('finds each forbidden text when it is present (positive control)', () => {
    const planted: SourceFile[] = [
      { path: 'a.ts', text: `import { readFileSync } from 'node:${'fs'}';\nimport { open } from 'node:${'fs'}/promises';\nimport fs from '${'fs'}';` },
      { path: 'b.ts', text: `import { spawn } from 'node:${join('child', '_process')}';\nconst child = spawn('x');\nexecFile('y');\nfork('z');\nconst match = PATTERN.exec(text);` },
      { path: 'c.ts', text: `import net from 'node:${'net'}';\nimport { Worker } from 'node:${join('worker', '_threads')}';\nimport http from '${'http'}';` },
      { path: 'd.ts', text: `const t = Date.${'now'}();\nconst d = new Date();\nconst p = performance.${'now'}();` },
      { path: 'e.ts', text: `Math.${'random'}();\nimport { random${'UUID'} } from 'node:${'crypto'}';` },
      { path: 'f.ts', text: `set${'Timeout'}(later, 50);\nclear${'Interval'}(handle);` },
      { path: 'g.ts', text: `const mode = process.${'env'}.DEMS_CAPTURE_MODE;` },
      { path: 'h.ts', text: `import { tickMachine } from '@dems/shared/sim/session-machine';` },
      { path: 'i.ts', text: `publish(AdminResource.${'DEVICES'});` },
      { path: 'j.ts', text: `read('~/.${'omlx'}/settings.json');\nread('.data/${'pg'}.env');\nread('${'signer'}-key.pem');` },
      { path: 'k.ts', text: `const camera = '${'rtsp'}://admin:secret@10.0.0.9/stream';\nconst prefix = '${'mts'}_';` },
    ];
    expect(occurrences(planted, FILE_SYSTEM)).toEqual(['a.ts:1', 'a.ts:2', 'a.ts:3']);
    expect(occurrences(planted, PROCESS_MODULE)).toEqual(['b.ts:1']);
    expect(occurrences(planted, PROCESS_START)).toEqual(['b.ts:2', 'b.ts:3', 'b.ts:4']);
    expect(occurrences(planted, SOCKET_OR_THREAD)).toEqual(['c.ts:1', 'c.ts:2', 'c.ts:3']);
    expect(occurrences(planted, SYSTEM_TIME)).toEqual(['d.ts:1', 'd.ts:2', 'd.ts:3']);
    expect(occurrences(planted, RANDOM)).toEqual(['e.ts:1', 'e.ts:2', 'e.ts:2']);
    expect(occurrences(planted, GLOBAL_TIMER)).toEqual(['f.ts:1', 'f.ts:2']);
    expect(occurrences(planted, ENVIRONMENT)).toEqual(['g.ts:1']);
    expect(occurrences(planted, SIM_DEEP_IMPORT)).toEqual(['h.ts:1']);
    expect(occurrences(planted, PAIRED_CLIENT_RESOURCE)).toEqual(['i.ts:1']);
    expect(places(planted, SECRET_PLACE)).toEqual(['j.ts']);
    expect(occurrences(planted, SECRET_PLACE).length).toBeGreaterThanOrEqual(3);
    expect(occurrences(planted, SECRET_SHAPE)).toEqual(['k.ts:1', 'k.ts:2']);
  });

  it('finds a sensitive member of a logged object (positive control)', () => {
    const text = "app.log.warn({ code: 'X', ingestUrl: plan.cameras[0].ingestUrl, apiKey, sessionId }, 'message');";
    const keys = logCalls(text).flatMap((call) => call.members.map((member) => member.key));
    expect(keys.filter((key) => SENSITIVE_KEY.test(key))).toEqual(['ingestUrl', 'apiKey']);
    expect(occurrences([{ path: 'x.ts', text }], SENSITIVE_NAME)).toEqual(['x.ts:1', 'x.ts:1', 'x.ts:1']);
  });
});

describe('G-R1: the host units open no door of their own', () => {
  /**
   * The two files of the host units that imported the file system BEFORE the capture layer
   * existed, each for one purpose: the persistent error log, and the loader of the connection
   * file. Spec §G states the rule without them; they are listed here by name so that the rule can
   * be held for every other file. A new entry is a decision, not a habit.
   */
  const FILE_SYSTEM_BEFORE_CAPTURE = ['src/plugins/config/connection-file.ts', 'src/plugins/logger/error-log.ts'];

  it('no file of modules, engine, plugins or core starts a process, opens a socket or starts a worker thread', () => {
    expect(occurrences(hosts, PROCESS_MODULE)).toEqual([]);
    expect(occurrences(hosts, SOCKET_OR_THREAD)).toEqual([]);
  });

  it('none imports the file system but the two that did before the capture layer', () => {
    expect(places(hosts, FILE_SYSTEM)).toEqual(FILE_SYSTEM_BEFORE_CAPTURE);
  });
});

describe('G-R2: the pinned allowlist of the capture folder (SEC35-25)', () => {
  /** The files that own the spawn and the handshake (spec §G G-R2). */
  const ALLOWLIST = ['src/capture/supervisor.ts', 'src/capture/ipc.ts'];

  it('the process module and the file system are imported by files of the allowlist only', () => {
    const importers = [...new Set([...places(capture, PROCESS_MODULE), ...places(capture, FILE_SYSTEM)])];
    expect(importers.filter((path) => !ALLOWLIST.includes(path))).toEqual([]);
    // What is there today: one importer, of the process module; the file system is not imported at all.
    expect(places(capture, PROCESS_MODULE)).toEqual(['src/capture/ipc.ts']);
    expect(places(capture, FILE_SYSTEM)).toEqual([]);
  });

  it('no file of the folder opens a socket or starts a worker thread', () => {
    expect(occurrences(capture, SOCKET_OR_THREAD)).toEqual([]);
  });

  it('no file of the folder names a credential file, a key file or the oMLX settings', () => {
    expect(occurrences(capture, SECRET_PLACE)).toEqual([]);
  });

  it('the one spawn hands the worker no shell and never the server\'s environment', () => {
    const ipc = capture.find((file) => file.path === 'src/capture/ipc.ts')?.text ?? '';
    expect([...ipc.matchAll(PROCESS_START)]).toHaveLength(1);
    expect(ipc).toMatch(/shell: false,/);
    expect(ipc).toMatch(/env: \{ \.\.\.options\.env \},/);
    expect(occurrences(capture, ENVIRONMENT)).toEqual([]);
  });
});

describe('G-R4: nothing secret, no address and no path in a log or audit call', () => {
  it('index.ts is the only file of the folder that logs or writes the error log', () => {
    const logging = capture.filter((file) => logCalls(file.text).length > 0 || /\berrorLog\s*\.\s*append\s*\(/.test(file.text)).map((file) => file.path);
    expect(logging).toEqual(['src/capture/index.ts']);
  });

  it('no member of a logged object has a key that would carry a secret, an address or a path', () => {
    const keys = capture.flatMap((file) => logCalls(file.text).flatMap((call) => call.members.map((member) => `${file.path}:${call.line} ${member.key}`)));
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((entry) => SENSITIVE_KEY.test(entry.split(' ')[1] ?? ''))).toEqual([]);
  });

  it('the file that logs never names a capture plan, an address, a path or a secret', () => {
    // The members of a logged object can arrive through a spread, which the scan of log calls
    // does not see; so the whole file is held to it.
    expect(occurrences(capture, SENSITIVE_NAME, (path) => path === 'src/capture/index.ts')).toEqual([]);
  });

  it('no file of the folder holds a credential-shaped value or the media token prefix', () => {
    expect(occurrences(capture, SECRET_SHAPE)).toEqual([]);
  });
});

describe('G-R5: capture devices are not the paired-client registry (E-04)', () => {
  it('the folder does not use AdminResource.DEVICES', () => {
    expect(occurrences(capture, PAIRED_CLIENT_RESOURCE)).toEqual([]);
  });
});

describe('G-R7: the simulator is used through its public barrel only', () => {
  it('no deep import of the simulator and no import of a package by its path', () => {
    expect(occurrences(capture, SIM_DEEP_IMPORT)).toEqual([]);
  });
});

describe('G-R8: process, timer, time and chance go through one named place each', () => {
  it('only ipc.ts starts a process', () => {
    expect(places(capture, PROCESS_START)).toEqual(['src/capture/ipc.ts']);
  });

  it('only timers.ts names a global timer', () => {
    expect(places(capture, GLOBAL_TIMER)).toEqual(['src/capture/timers.ts']);
  });

  it('no file reads the system time: every instant is the server clock\'s', () => {
    expect(occurrences(capture, SYSTEM_TIME)).toEqual([]);
    expect(capture.find((file) => file.path === 'src/capture/index.ts')?.text).toContain('now: () => app.clock.now(),');
  });

  it('no file draws a random number or imports a source of one: a correlation ID is counted, not drawn', () => {
    expect(occurrences(capture, RANDOM)).toEqual([]);
  });
});

describe('P25: the edits OD-14 waives, and no other mention of capture (spec §I edits 1 to 14)', () => {
  const raw = (path: string): string[] => (tree.find((file) => file.path === path)?.text ?? '').split('\n');
  const mentions = (path: string): string[] => raw(path).filter((line) => /capture/i.test(line)).map((line) => line.trim());

  it('app.ts: the header records the waived edits (spec §I allows that and nothing else there); two imports, the seam in three places, two units, one decorator', () => {
    expect(mentions('src/app.ts')).toEqual([
      '*    WAIVED EDITS (task 3, decision OD-14; capture spec §I edits 1 to 6). Registered after the',
      '*    fourteen: the unit `capture` (the supervisor of the capture worker) and the module',
      '*    `modules/capture-config`. The seam `capture` joins the list of mechanism 3.',
      '*      capture                        capture                 task 3 (OD-14 waiver)',
      "import { captureModule, type CaptureSupervisor } from './capture';",
      "import { captureConfigModule } from './modules/capture-config';",
      'capture: CaptureSupervisor;',
      "capture: 'src/capture (capture module)',",
      'readonly capture: CaptureSupervisor;',
      "['capture', captureModule],",
      "['modules/capture-config', captureConfigModule],",
      "app.decorate('capture', { getter: () => seams.get('capture') });",
    ]);
  });

  // Row 113, fix round 1 (navigator finding N-3; decision D68). The test above sees only the lines
  // that mention capture. This one sees EVERY line added to the frozen file: with the waived lines
  // taken out, in the order they stand, app.ts is byte-equal to the file of plan row W08. A line
  // nobody waived - of any module, with any wording - changes the digest and fails here.
  it('app.ts: every added line is a waived one (capture: spec §I edits 1 to 6; STT configuration: edits 13 and 14, decision D68); without them the file is the frozen one', () => {
    /** SHA-256 of `src/app.ts` as plan row W08 froze it (commit 9d3a1ef, 398 lines). */
    const FROZEN_APP_TS = '3846e1700616410967dae0e251c07e27f98edd866f826fa549bb1a430f375db8';
    const WAIVED: readonly string[] = [
      ' *    WAIVED EDITS (task 3, decision OD-14; capture spec §I edits 1 to 6). Registered after the',
      ' *    fourteen: the unit `capture` (the supervisor of the capture worker) and the module',
      ' *    `modules/capture-config`. The seam `capture` joins the list of mechanism 3.',
      ' *    Decision D68 extends OD-14 to the registration of `modules/stt-config` (task 3 row 113): waived edits 13 and 14.',
      ' *',
      ' *      capture                        capture                 task 3 (OD-14 waiver)',
      "import { captureModule, type CaptureSupervisor } from './capture';",
      "import { captureConfigModule } from './modules/capture-config';",
      "import { sttConfigModule } from './modules/stt-config';",
      '  capture: CaptureSupervisor;',
      "  capture: 'src/capture (capture module)',",
      '    readonly capture: CaptureSupervisor;',
      "  ['modules/stt-config', sttConfigModule],",
      "  ['capture', captureModule],",
      "  ['modules/capture-config', captureConfigModule],",
      "  app.decorate('capture', { getter: () => seams.get('capture') });",
    ];
    /** The file without the waived lines, each taken where it stands after the one before; null when one is missing. */
    const withoutWaived = (lines: readonly string[]): string | null => {
      const rest = [...lines];
      let cursor = 0;
      for (const line of WAIVED) {
        const at = rest.indexOf(line, cursor);
        if (at === -1) return null;
        rest.splice(at, 1);
        cursor = at;
      }
      return rest.join('\n');
    };
    const digest = (text: string | null): string => (text === null ? 'a waived line is missing' : createHash('sha256').update(text).digest('hex'));
    const current = raw('src/app.ts');
    expect(digest(withoutWaived(current))).toBe(FROZEN_APP_TS);
    // The two lines of the STT configuration module, exactly (edits 13 and 14).
    expect(current.filter((line) => /stt/i.test(line))).toEqual([WAIVED[3], WAIVED[8], WAIVED[12]]);
    // Positive control: one more line, of any kind, anywhere, is seen; so is a waived line that changed.
    const at = current.indexOf("  ['modules/demo', demoModule],");
    expect(at).toBeGreaterThan(0);
    expect(digest(withoutWaived([...current.slice(0, at), "  ['modules/other', otherModule],", ...current.slice(at)]))).not.toBe(FROZEN_APP_TS);
    expect(digest(withoutWaived(current.map((line) => (line === WAIVED[12] ? "  ['modules/stt-config', sttConfigModule, { early: true }]," : line))))).toBe('a waived line is missing');
  });

  it('index.ts: the supervisor boots after the boot steps and before the listener, and is shut down before the app closes', () => {
    expect(mentions('src/index.ts')).toEqual(["if (app.seams.has('capture')) await app.capture.shutdown();", 'await app.capture.boot();']);
    const entry = raw('src/index.ts').join('\n');
    expect(entry).toMatch(/await app\.readiness\.boot\(\);\n {2}await app\.capture\.boot\(\);\n {2}await app\.listen\(\{ host: LISTEN_HOST, port: config\.port \}\);/);
    expect(entry).toMatch(/try \{\n {4}if \(app\.seams\.has\('capture'\)\) await app\.capture\.shutdown\(\);\n {4}await app\.close\(\);/);
  });

  // Row 58 (spec §I edits 7 to 10; category "capture config keys" of OD-14). Until row 58 this
  // test read "config.ts is not touched by this row". The file is pinned the way app.ts is: with
  // EVERY waived added line taken out, in the order they stand, config.ts is byte-equal to the file
  // plan row W08 froze. A line nobody waived, of any kind, changes the digest and fails here.
  it('config.ts: every added line is one of the capture keys (spec §I edits 7 to 10); without them the file is the frozen one', () => {
    /** SHA-256 of `src/config.ts` as plan row W08 froze it (unchanged up to commit 101ce62, 271 lines). */
    const FROZEN_CONFIG_TS = 'de6f7bc958d84649aff0d8e248ef534e167f3639afd46a6f3e36c590cf7154f9';
    const WAIVED_CONFIG: readonly string[] = [
      ' * WAIVED EDITS (task 3, decision OD-14; capture spec §I edits 7 to 10): the three capture keys.',
      ' * `DEMS_CAPTURE_MODE` (`simulated`, the default, or `real`), `DEMS_CAPTURE_WORKER` (the worker',
      ' * program) and `DEMS_MEDIA_DIR` (the media root). Whether a start in `real` mode is refused for a',
      " * missing key is the boot checks' decision (CS-22), not this file's.",
      "export const ENV_CAPTURE_MODE = 'DEMS_CAPTURE_MODE';",
      "export const ENV_CAPTURE_WORKER = 'DEMS_CAPTURE_WORKER';",
      "export const ENV_MEDIA_DIR = 'DEMS_MEDIA_DIR';",
      "export const CAPTURE_MODES = ['simulated', 'real'] as const;",
      'export type CaptureMode = (typeof CAPTURE_MODES)[number];',
      "export const DEFAULT_CAPTURE_MODE: CaptureMode = 'simulated';",
      '/** Where the camera files live below the data directory when `DEMS_MEDIA_DIR` is unset (capture spec §H). */',
      "export const MEDIA_STORE_SUBPATH = 'media/sessions';",
      '',
      '  /** `real`: sessions record through the capture worker. `simulated`: no worker is ever started. */',
      '  readonly captureMode: CaptureMode;',
      '  /** Absolute path of the capture worker program, or null when none is configured. */',
      '  readonly captureWorkerPath: string | null;',
      '  /** Absolute path of the media root (OD-25: git-ignored, below the data directory by default). */',
      '  readonly mediaStoreDir: string;',
      '/** Unset means `simulated`. Any other value than the two modes stops the boot. */',
      'export function parseCaptureMode(raw: string | undefined): CaptureMode {',
      "  if (raw === undefined || raw === '') return DEFAULT_CAPTURE_MODE;",
      '  const mode = CAPTURE_MODES.find((known) => known === raw);',
      "  if (mode === undefined) throw new ConfigError('CAPTURE_MODE_INVALID', `${ENV_CAPTURE_MODE} must be one of ${CAPTURE_MODES.join(', ')}.`);",
      '  return mode;',
      '}',
      '',
      '/** An absolute path, or null when the variable is unset. The value itself is never put in a message. */',
      'export function parseCapturePath(name: string, raw: string | undefined): string | null {',
      "  if (raw === undefined || raw === '') return null;",
      "  if (!raw.startsWith('/') || raw.includes('\\0')) throw new ConfigError('CAPTURE_PATH_NOT_ABSOLUTE', `${name} must be an absolute path.`);",
      '  return raw;',
      '}',
      '',
      '  /** Default: `simulated`. */',
      '  readonly captureMode?: CaptureMode;',
      '  /** Default: null (no worker program). */',
      '  readonly captureWorkerPath?: string | null;',
      '  /** Default: `<dataDir>/media/sessions`. */',
      '  readonly mediaStoreDir?: string | null;',
      '  const captureWorkerPath = parseCapturePath(ENV_CAPTURE_WORKER, input.captureWorkerPath ?? undefined);',
      '  const mediaStoreDir = parseCapturePath(ENV_MEDIA_DIR, input.mediaStoreDir ?? undefined) ?? `${input.dataDir}/${MEDIA_STORE_SUBPATH}`;',
      '    captureMode: input.captureMode ?? DEFAULT_CAPTURE_MODE,',
      '    captureWorkerPath,',
      '    mediaStoreDir,',
    ];
    const withoutWaived = (lines: readonly string[]): string | null => {
      const rest = [...lines];
      let cursor = 0;
      for (const line of WAIVED_CONFIG) {
        const at = rest.indexOf(line, cursor);
        if (at === -1) return null;
        rest.splice(at, 1);
        cursor = at;
      }
      return rest.join('\n');
    };
    const digest = (text: string | null): string => (text === null ? 'a waived line is missing' : createHash('sha256').update(text).digest('hex'));
    const current = raw('src/config.ts');
    expect(digest(withoutWaived(current))).toBe(FROZEN_CONFIG_TS);
    // Every line of the file that mentions capture or the media root is a waived one: nothing else names them.
    expect(current.filter((line) => /capture|media/i.test(line)).filter((line) => !WAIVED_CONFIG.includes(line))).toEqual([]);
    // The three keys, by name (edit 7), and the three fields of the configuration (edit 8).
    expect(current.filter((line) => line.startsWith('export const ENV_')).slice(-3)).toEqual([
      "export const ENV_CAPTURE_MODE = 'DEMS_CAPTURE_MODE';",
      "export const ENV_CAPTURE_WORKER = 'DEMS_CAPTURE_WORKER';",
      "export const ENV_MEDIA_DIR = 'DEMS_MEDIA_DIR';",
    ]);
    expect(current.filter((line) => /^ {2}readonly (captureMode|captureWorkerPath|mediaStoreDir): /.test(line))).toHaveLength(3);
    // Positive control: one more line, of any kind, anywhere, is seen; so is a waived line that changed.
    const at = current.indexOf("export const LISTEN_HOST = '127.0.0.1';");
    expect(at).toBeGreaterThan(0);
    expect(digest(withoutWaived([...current.slice(0, at), "export const OTHER_HOST = '0.0.0.0';", ...current.slice(at)]))).not.toBe(FROZEN_CONFIG_TS);
    expect(digest(withoutWaived(current.map((line) => (line === "export const DEFAULT_CAPTURE_MODE: CaptureMode = 'simulated';" ? "export const DEFAULT_CAPTURE_MODE: CaptureMode = 'real';" : line))))).toBe('a waived line is missing');
  });
});
