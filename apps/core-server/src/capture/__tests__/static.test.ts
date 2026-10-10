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
import { CAMERA_HELPER_TABLE, CameraHelperEncoder, LOCAL_CAMERA_DEVICE_NAME, LOCAL_MIC_DEVICE_NAME, MIC_HELPER_TABLE, MicGeneratedTone, cameraPrecheckArguments, cameraPushArguments, deviceListArguments, micPrecheckArguments, micPushArguments } from '../adapters/local';

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

/** Row 131: the ONE file of the server that may import the datagram module (pinned; G-R9, C-N13, SEC35-27). */
const WS_DISCOVERY = 'src/capture/adapters/camera/ws-discovery.ts';
/** Row 83: the ONE file of the evidence signer that may import the file system and the cryptography module (pinned; G-R2, G-R8). */
const SIGNER_HOST_KEY = 'src/capture/signer/host-key.ts';
/** Row 142: the ONE file of the server that imports the `onvif` package and an HTTP agent (pinned; G-R10, G-R11, SEC35-27). */
const ONVIF_SESSION = 'src/capture/adapters/camera/onvif-session.ts';
/** Rows 134 to 136 (decision D95): the ONE door of the local-device helpers, the second file that may start a process (pinned; G-R2, G-R8, G-R12). */
const LOCAL_HELPER_DOOR = 'src/capture/adapters/local/process-door.ts';
/** Row 135: the ONE file that touches the named pipe of a microphone (pinned; G-R2, G-R6). */
const LOCAL_PIPE_FILES = 'src/capture/adapters/local/pipe-files.ts';
/** Row 61: the ONE file of the boot checks that touches the file system, the probe of the evidence store (pinned; G-R2, CS-22, CS-09). */
const BOOT_EVIDENCE_VOLUME = 'src/capture/boot/evidence-volume.ts';

const places = (files: readonly SourceFile[], pattern: RegExp): string[] => [...new Set(occurrences(files, pattern).map((place) => place.replace(/:\d+$/, '')))];

describe('the scan itself', () => {
  it('reads the production sources of the capture folder', () => {
    // The adapter layer (row 65) is part of `capture` for every rule below; its own file list is pinned in `adapters/__tests__/static.test.ts`.
    const ADAPTERS = 'src/capture/adapters/';
    // The evidence signer (row 83) is part of `capture` for every rule below as well; its files are pinned here by name.
    const SIGNER = 'src/capture/signer/';
    expect(capture.filter((file) => file.path.startsWith(SIGNER)).map((file) => file.path).sort()).toEqual(['src/capture/signer/der.ts', 'src/capture/signer/host-key.ts', 'src/capture/signer/index.ts', 'src/capture/signer/key-record.ts', 'src/capture/signer/seal.ts', 'src/capture/signer/types.ts']);
    // The capture fence (row 136) is part of `capture` for every rule below too; its files are pinned here by name.
    const FENCE = 'src/capture/fence/';
    expect(capture.filter((file) => file.path.startsWith(FENCE)).map((file) => file.path).sort()).toEqual(['boot.ts', 'development-discovery.ts', 'fake-mic.ts', 'fake-profile.ts', 'generated-sources.ts', 'index.ts', 'operation.ts', 'registration.ts', 'sources.ts', 'statements.ts'].map((name) => `${FENCE}${name}`)); // fix wave K, reconcile pass: + fake-profile.ts (G89b-01, the selector line of a generated source)
    // The boot checks of real capture (row 61) are part of `capture` for every rule below as well; their files are pinned here by name.
    const BOOT = 'src/capture/boot/';
    expect(capture.filter((file) => file.path.startsWith(BOOT)).map((file) => file.path).sort()).toEqual(['checks.ts', 'evidence-volume.ts', 'index.ts', 'worker-probe.ts'].map((name) => `${BOOT}${name}`));
    expect(capture.filter((file) => !file.path.startsWith(ADAPTERS) && !file.path.startsWith(SIGNER) && !file.path.startsWith(FENCE) && !file.path.startsWith(BOOT)).map((file) => file.path)).toEqual(['src/capture/forwarder.ts', 'src/capture/fragments.ts', 'src/capture/index.ts', 'src/capture/ipc.ts', 'src/capture/stale-notices.ts', 'src/capture/supervisor.ts', 'src/capture/timers.ts', 'src/capture/types.ts', 'src/capture/worker-arguments.ts']); // pin by delta (wave H driver F): + stale-notices.ts (the boot clear of capture notices), + worker-arguments.ts (one argument list for a session start and the boot probe)
    expect(capture.filter((file) => file.path.startsWith(ADAPTERS)).length).toBeGreaterThanOrEqual(16);
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
  const ALLOWLIST = ['src/capture/supervisor.ts', 'src/capture/ipc.ts', SIGNER_HOST_KEY, LOCAL_HELPER_DOOR, LOCAL_PIPE_FILES, BOOT_EVIDENCE_VOLUME];

  it('the process module and the file system are imported by files of the allowlist only', () => {
    const importers = [...new Set([...places(capture, PROCESS_MODULE), ...places(capture, FILE_SYSTEM)])];
    expect(importers.filter((path) => !ALLOWLIST.includes(path))).toEqual([]);
    // What is there today: the worker's process channel and (rows 134 to 136, decision D95) the pinned door of the local-device helpers.
    expect(places(capture, PROCESS_MODULE).sort()).toEqual([LOCAL_HELPER_DOOR, 'src/capture/ipc.ts']);
    // Row 83: the software signer's key at rest (evidence package spec §C.3, SEC35-07). Rows 134 / 135: the facts of a program path
    // (the door) and the named pipe of a microphone (`pipe-files.ts`: lstat, mkdir, realpath, unlink and nothing else).
    // Row 61: the probe of the evidence store (`boot/evidence-volume.ts`: one exclusive create, a sync, a link and the removal of its own two names).
    expect(places(capture, FILE_SYSTEM).sort()).toEqual([LOCAL_PIPE_FILES, LOCAL_HELPER_DOOR, BOOT_EVIDENCE_VOLUME, SIGNER_HOST_KEY].sort());
  });

  it('no file of the folder opens a socket or starts a worker thread', () => {
    // Row 131 (G-R9): the ONE datagram socket of the Core is the WS-Discovery probe; its file is pinned by name, for that one module.
    // Row 142 (G-R10): the ONE importer of an HTTP agent is the connection test; its file is pinned by name, for those two modules.
    expect(occurrences(capture, SOCKET_OR_THREAD, (path) => path !== WS_DISCOVERY && path !== ONVIF_SESSION)).toEqual([]);
    expect((capture.find((file) => file.path === WS_DISCOVERY)?.text.match(SOCKET_OR_THREAD) ?? []).map((text) => text.replace(/['"]/g, ''))).toEqual([join('node:', 'dg', 'ram')]);
    expect((capture.find((file) => file.path === ONVIF_SESSION)?.text.match(SOCKET_OR_THREAD) ?? []).map((text) => text.replace(/['"]/g, ''))).toEqual([join('node:', 'ht', 'tp'), join('node:', 'ht', 'tps')]);
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
  it('only ipc.ts and the pinned door of the local-device helpers start a process', () => {
    expect(places(capture, PROCESS_START).sort()).toEqual([LOCAL_HELPER_DOOR, 'src/capture/ipc.ts']);
  });

  it('only timers.ts names a global timer', () => {
    expect(places(capture, GLOBAL_TIMER)).toEqual(['src/capture/timers.ts']);
  });

  it('no file reads the system time: every instant is the server clock\'s', () => {
    expect(occurrences(capture, SYSTEM_TIME)).toEqual([]);
    expect(capture.find((file) => file.path === 'src/capture/index.ts')?.text).toContain('now: () => app.clock.now(),');
  });

  it('no file draws a random number or imports a source of one: a correlation ID is counted, not drawn', () => {
    // Row 83: the same one file imports the cryptography module (key generation, Ed25519 sign and verify); no other file does.
    expect(occurrences(capture, RANDOM, (path) => path !== SIGNER_HOST_KEY)).toEqual([]);
    expect(places(capture, RANDOM)).toEqual([SIGNER_HOST_KEY]);
  });
});

// Row 131 (check M4-SR-1, rules G-R9 and G-R13; check M4-SEC-DISC-4, static half; capture spec §G.1,
// §A.6.1 DS-1, DS-2, DS-5, DS-15, DS-16; specs C-N13; SEC35-27 (1), (6), SEC35-29 (2), SEC35-30 (4)).
describe('G-R9: one datagram socket, in one file, closed on every way out, to one destination', () => {
  const DATAGRAM = moduleImport([join('dg', 'ram')]);
  const PARSER = new RegExp(`['"]${join('xml', '2js')}(?:/[^'"]*)?['"]`, 'g');
  const PROBE_ANSWER = 'src/capture/adapters/camera/probe-answer.ts';
  /** The parser ships no types: its declaration stands beside its one importer and names the module too. */
  const PARSER_TYPES = 'src/capture/adapters/camera/xml2js.d.ts';
  const CREATE = new RegExp(`\\b${join('create', 'Socket')}\\s*\\(`, 'g');
  const FORBIDDEN_SOCKET_USE = new RegExp(`\\b(?:${[join('add', 'Membership'), join('addSourceSpecific', 'Membership'), join('reuse', 'Addr'), join('reuse', 'Port'), join('set', 'Broadcast'), join('udp', '6')].join('|')})\\b`, 'g');
  const FIXTURE = new RegExp(`\\b${join('loopback', 'Fixture')}\\b`, 'g');
  const LOG_OR_FILE = new RegExp(`\\bconsole\\s*\\.|\\b(?:write|append)File(?:Sync)?\\s*\\(|\\bcreateWriteStream\\s*\\(`, 'g');
  const SETTLE = /\b(?:resolveSearch|rejectSearch)\s*\(/g;
  const discovery = capture.find((file) => file.path === WS_DISCOVERY)?.text ?? '';

  /** The rule as a function of a tree, so that the control can run it on planted files. */
  const violations = (files: readonly SourceFile[]): string[] => [
    ...occurrences(files, DATAGRAM, (path) => path !== WS_DISCOVERY).map((place) => `${place} imports the datagram module`),
    ...occurrences(files, PARSER, (path) => path !== PROBE_ANSWER && path !== PARSER_TYPES).map((place) => `${place} imports the XML parser`),
    ...occurrences(files, FIXTURE, (path) => path !== WS_DISCOVERY).map((place) => `${place} names the loopback test target`),
    ...occurrences(files, FORBIDDEN_SOCKET_USE, (path) => path.startsWith('src/capture/')).map((place) => `${place} joins a group, shares a port, broadcasts or opens IPv6`),
  ];

  it('finds a second importer, a second parser, a product file that sets the test target, and a joined group (control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/modules/capture-config/search.ts', text: `import { ${join('create', 'Socket')} } from 'node:${join('dg', 'ram')}';\nconst adapter = build({ ${join('loopback', 'Fixture')}: { address, port } });` },
      { path: 'src/capture/adapters/camera/onvif-session.ts', text: `import xml from '${join('xml', '2js')}';\nimport dgram from '${join('dg', 'ram')}';` },
      { path: 'src/capture/adapters/camera/other.ts', text: `socket.${join('add', 'Membership')}(group);\nconst socket = make({ type: '${join('udp', '6')}', ${join('reuse', 'Addr')}: true });` },
    ];
    expect(violations(planted)).toEqual([
      'src/modules/capture-config/search.ts:1 imports the datagram module',
      'src/capture/adapters/camera/onvif-session.ts:2 imports the datagram module',
      'src/capture/adapters/camera/onvif-session.ts:1 imports the XML parser',
      'src/modules/capture-config/search.ts:2 names the loopback test target',
      'src/capture/adapters/camera/other.ts:1 joins a group, shares a port, broadcasts or opens IPv6',
      'src/capture/adapters/camera/other.ts:2 joins a group, shares a port, broadcasts or opens IPv6',
      'src/capture/adapters/camera/other.ts:2 joins a group, shares a port, broadcasts or opens IPv6',
    ]);
    const leak = `const socket = ${join('create', 'Socket')}({ type: 'udp4' });\nresolveSearch(result());\nconst second = ${join('create', 'Socket')}({ type: 'udp4' });`;
    expect([...leak.matchAll(CREATE)]).toHaveLength(2);
    expect([...leak.matchAll(SETTLE)]).toHaveLength(1);
  });

  it('the datagram module is imported by exactly one file of the server, the parser by exactly one, and no product file sets the loopback test target', () => {
    expect(violations(production)).toEqual([]);
    expect(places(production, DATAGRAM)).toEqual([WS_DISCOVERY]);
    expect(places(production, PARSER)).toEqual([PROBE_ANSWER, PARSER_TYPES]);
    // SEC35-27 (6): the option is declared and read in the one file; nothing else under src/ passes it.
    expect(places(production, FIXTURE)).toEqual([WS_DISCOVERY]);
  });

  it('that file: one createSocket call site, the type literal udp4, TTL 1, no group joined, the constant group or the loopback literal as the only destinations', () => {
    expect([...discovery.matchAll(CREATE)]).toHaveLength(1);
    expect(discovery).toContain(`${join('create', 'Socket')}({ type: 'udp4' })`);
    expect(discovery).toContain("export const WS_DISCOVERY_GROUP = Object.freeze({ address: '239.255.255.250', port: 3702 });");
    expect(discovery).toContain('export const WS_DISCOVERY_TTL = 1;');
    expect(discovery).toContain('open.setMulticastTTL(WS_DISCOVERY_TTL);');
    // One send call site; its destination is the group constant or the injected target, which is refused unless it is the loopback literal.
    expect([...discovery.matchAll(/\.send\s*\(/g)]).toHaveLength(1);
    expect(discovery).toContain('open.send(probe, destination.port, destination.address, sent);');
    expect(discovery).toContain('const destination = fixture ?? WS_DISCOVERY_GROUP;');
    expect(discovery).toContain("const LOOPBACK = '127.0.0.1';");
    expect(discovery).toMatch(/if \(fixture !== null && \(fixture\.address !== LOOPBACK \|\|[^\n]*\n\s*throw new CaptureAdapterError/);
    // Every address literal of the file: the group and the loopback literal, and one documentation address for the fixture's synthetic interface.
    expect([...new Set(discovery.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? [])].sort()).toEqual(['127.0.0.1', '192.0.2.1', '239.255.255.250', '255.255.255.0']);
  });

  it('that file: one place closes the socket, and the search settles only through it once a socket exists', () => {
    expect([...discovery.matchAll(/\.close\s*\(/g)]).toHaveLength(1);
    const finish = discovery.slice(discovery.indexOf('const finish = '), discovery.indexOf('const result = '));
    expect(finish).toContain('open.close(() => settle());');
    // The three settles that do not pass through `finish` all stand before the socket is declared: nothing is open yet.
    const direct = [...discovery.matchAll(SETTLE)].filter((match) => !discovery.slice(0, match.index).endsWith('finish(() => '));
    expect(direct).toHaveLength(3);
    expect(direct.every((match) => (match.index ?? 0) < discovery.indexOf('let socket: Socket | null = null;'))).toBe(true);
    expect([...discovery.matchAll(SETTLE)].length - direct.length).toBe(3);
    // The datagram handler is one try / catch (SEC35-29 (1)).
    expect(discovery).toMatch(/const onDatagram = \(bytes: Buffer, remote: RemoteInfo\): void => \{\s*try \{[^}]*\} catch \{\s*handlerErrors \+= 1;\s*\}\s*\};/);
  });

  it('the parser options are pinned in the one file that imports it (SEC35-29 (2)): strict, arrays always, synchronous, no value or attribute processor', () => {
    const answer = capture.find((file) => file.path === PROBE_ANSWER)?.text ?? '';
    for (const option of ['strict: true,', 'explicitArray: true,', 'async: false,', 'ignoreAttrs: true,']) expect(answer, option).toContain(option);
    expect([...answer.matchAll(/new xml2js\.Parser\s*\(/g)]).toHaveLength(1);
    expect(answer).not.toMatch(/valueProcessors|attrValueProcessors|attrNameProcessors|parseStringPromise|JSON\.stringify|structuredClone/);
  });

  it('M4-SEC-DISC-4 (static half): the discovery files log nothing and write no file: counts leave through the result only', () => {
    const camera = capture.filter((file) => file.path.startsWith('src/capture/adapters/camera/'));
    expect(camera.length).toBeGreaterThanOrEqual(5);
    expect(camera.filter((file) => logCalls(file.text).length > 0).map((file) => file.path)).toEqual([]);
    expect(occurrences(camera, LOG_OR_FILE)).toEqual([]);
    expect(occurrences([{ path: 'x.ts', text: "console.log(candidate.host);\nwriteFileSync(path, JSON.stringify(result));" }], LOG_OR_FILE)).toEqual(['x.ts:1', 'x.ts:2']);
  });
});

describe('G-R13: a search is started by the search operation and the pre-check, and by nothing else', () => {
  /**
   * The production files that call `discover` (R-9 AC-1). Row 132 wired the adapter: ONE file holds
   * the one call, and both triggers come through it - the search operation (`routes.ts`, op 93) and
   * the pre-check's search (`index.ts`, `runPrecheckSearch`). Another entry is a decision, not a habit.
   */
  const DISCOVER_CALL_SITES: readonly string[] = ['src/modules/capture-discovery/search.ts'];
  const DISCOVER_CALL = /\.\s*discover\s*\(/g;

  it('finds a call from a boot hook, a timer or a read operation (control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/capture/index.ts', text: "app.addHook('onReady', async () => {\n  await registry.cameraAdapters()[0]?.discover({ windowMs, signal });\n});" },
      { path: 'src/modules/capture-config/list.ts', text: 'const found = await adapter.discover(search);' },
      // Not a call: the member's definition, and another name.
      { path: 'src/capture/adapters/fake/camera.ts', text: 'async discover(search) {}\nconst discoverAll = 1;\nrediscover(x);' },
    ];
    expect(places(planted, DISCOVER_CALL)).toEqual(['src/capture/index.ts', 'src/modules/capture-config/list.ts']);
  });

  it('no production file calls discover but the pinned call sites', () => {
    expect(places(production, DISCOVER_CALL)).toEqual(DISCOVER_CALL_SITES);
  });
});

// Row 142 (check M4-SR-1, rules G-R10 and G-R11; check M4-SEC-NET-1, the `onvif` half; capture spec
// §G.1, §A.6.2 CT-1 to CT-4; decisions D75, D76, D82; SEC35-27, SEC35-33 (4), (5), (6), SEC35-49).
describe('G-R10 / G-R11: one importer of the ONVIF client, five reads, no stream connection', () => {
  const PACKAGE = new RegExp(`['"]${join('on', 'vif')}(?:/[^'"]*)?['"]`, 'g');
  /** The package's types describe every operation of a client: the declaration beside the one importer declares the five reads only. */
  const PACKAGE_TYPES = 'src/capture/adapters/camera/onvif-cam.d.ts';
  const FILE_OF_THE_CLIENT = `${join('on', 'vif')}/lib/cam.js`;
  const AGENT_IMPORT = new RegExp(`^import \\{ Agent as Https?Agent \\} from 'node:${join('ht', 'tp')}s?';$`, 'gm');
  const STREAM_OR_SOCKET = moduleImport(['net', 'tls', join('ht', 'tp2')]);
  const CLIENT_CALL = /\bclient\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g;
  const NO_CERTIFICATE_CHECK = new RegExp(`${join('reject', 'Unauthorized')}\\s*:\\s*false`, 'g');
  /** The reads of rule CT-1, as the package names them. */
  const READS = ['getCapabilities', 'getProfiles', 'getServices', 'getStreamUri', 'getSystemDateAndTime'];
  const session = capture.find((file) => file.path === ONVIF_SESSION)?.text ?? '';
  const types = capture.find((file) => file.path === PACKAGE_TYPES)?.text ?? '';
  const callsOf = (text: string): string[] => [...new Set([...text.matchAll(CLIENT_CALL)].map((match) => match[1] ?? ''))].sort();

  /** The rule as a function of a tree, so that the control can run it on planted files. */
  const violations = (files: readonly SourceFile[]): string[] => [
    ...occurrences(files, PACKAGE, (path) => path !== ONVIF_SESSION && path !== PACKAGE_TYPES).map((place) => `${place} imports the ONVIF client`),
    ...occurrences(files, STREAM_OR_SOCKET, (path) => path.startsWith('src/capture/')).map((place) => `${place} imports a socket, TLS or HTTP/2 module`),
    ...occurrences(files, NO_CERTIFICATE_CHECK, (path) => path !== ONVIF_SESSION).map((place) => `${place} switches the certificate check off`),
    ...files.filter((file) => file.path === ONVIF_SESSION).flatMap((file) => callsOf(file.text).filter((name) => !READS.includes(name)).map((name) => `${file.path} calls ${name} on the client`)),
  ];

  it('finds a second importer, the package\'s main entry, a write call, a listener and a second place without a certificate check (control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/modules/capture-discovery/connect/service.ts', text: `import { Cam } from '${join('on', 'vif')}';\nconst agent = new Agent({ ${join('reject', 'Unauthorized')}: false });` },
      { path: 'src/capture/adapters/camera/onvif-discovery.ts', text: `import { connect } from 'node:${'net'}';\nimport tls from '${'tls'}';` },
      { path: ONVIF_SESSION, text: `client.getProfiles(done);\nclient.setSystemDateAndTime(options, done);\nclient.connect(done);\nclient.on('rawResponse', keep);\nclient . systemReboot(done);` },
    ];
    expect(violations(planted)).toEqual([
      'src/modules/capture-discovery/connect/service.ts:1 imports the ONVIF client',
      'src/capture/adapters/camera/onvif-discovery.ts:1 imports a socket, TLS or HTTP/2 module',
      'src/capture/adapters/camera/onvif-discovery.ts:2 imports a socket, TLS or HTTP/2 module',
      'src/modules/capture-discovery/connect/service.ts:2 switches the certificate check off',
      `${ONVIF_SESSION} calls connect on the client`,
      `${ONVIF_SESSION} calls on on the client`,
      `${ONVIF_SESSION} calls setSystemDateAndTime on the client`,
      `${ONVIF_SESSION} calls systemReboot on the client`,
    ]);
  });

  it('the package is imported by exactly one file of the server, by the file of the client and never by its main entry', () => {
    expect(violations(production)).toEqual([]);
    expect(places(production, PACKAGE)).toEqual([PACKAGE_TYPES, ONVIF_SESSION]);
    // The main entry would load the package's datagram code (capture spec §A.6.1a O-8): the client's own file is named.
    expect((session.match(PACKAGE) ?? []).map((text) => text.replace(/['"]/g, ''))).toEqual([FILE_OF_THE_CLIENT]);
    expect((types.match(PACKAGE) ?? []).map((text) => text.replace(/['"]/g, ''))).toEqual([FILE_OF_THE_CLIENT]);
    expect(session).not.toMatch(/\bDiscovery\b/);
  });

  it('the calls on the client are the five reads, and the declaration of the client has no other member', () => {
    expect(callsOf(session)).toEqual(READS);
    const declared = [...types.matchAll(/^\s{4}(\w+)\(/gm)].map((match) => match[1] ?? '').filter((name) => name !== 'constructor');
    expect(declared.sort()).toEqual(READS);
  });

  it('one constructor call: no automatic connect, the address of the constructor kept, an explicit request limit; no listener on the client', () => {
    expect([...session.matchAll(/\bnew\s+cam\s*\.\s*Cam\s*\(/g)]).toHaveLength(1);
    const built = session.slice(session.indexOf('new cam.Cam('), session.indexOf('new cam.Cam(') + 600);
    for (const option of ['autoconnect: false,', 'preserveAddress: true,', 'timeout: limits.requestMs,', 'agent,']) expect(built, option).toContain(option);
    expect(session).not.toMatch(/rawRequest|rawResponse|\.\s*(?:on|once|addListener)\s*\(\s*['"]warning['"]/);
  });

  it('the client never leaves the file: what the file exports is the facade and its vocabulary', () => {
    const exported = [...session.matchAll(/^export\s+(?:const|function|interface|type|class)\s+(\w+)/gm)].map((match) => match[1] ?? '');
    expect([...new Set(exported)].sort()).toEqual(['ONVIF_SESSION_LIMITS', 'ONVIF_SESSION_READS', 'OnvifConnectionTester', 'OnvifConnectionTesterOptions', 'OnvifSessionLimits', 'OnvifSessionRead', 'OnvifSessionResult', 'OnvifTestReason', 'OnvifTestWarning', 'createOnvifConnectionTester']);
    expect(session).not.toMatch(/\breturn\s+client\b|\bexport\s+default\b|\bexport\s*\{/);
    expect(session).toContain('return Object.freeze({ test });');
  });

  it('G-R10: an HTTP agent is imported in that one file, for the name Agent only; no socket, TLS or HTTP/2 module anywhere in the folder', () => {
    expect(session.match(AGENT_IMPORT)).toEqual([`import { Agent as HttpAgent } from 'node:${join('ht', 'tp')}';`, `import { Agent as HttpsAgent } from 'node:${join('ht', 'tps')}';`]);
    expect(occurrences(capture, STREAM_OR_SOCKET)).toEqual([]);
    // SEC35-33 (6): the certificate of a camera is not checked in this one file, with TLS 1.2 as the floor beside every such place.
    expect(places(production, NO_CERTIFICATE_CHECK)).toEqual([ONVIF_SESSION]);
    for (const match of session.matchAll(NO_CERTIFICATE_CHECK)) expect(session.slice(match.index, (match.index ?? 0) + 60)).toContain("minVersion: 'TLSv1.2'");
    // D82: the scheme of a stream is compared, never dialled - the folder holds no stream locator and no stream client.
    expect(occurrences(capture, SECRET_SHAPE)).toEqual([]);
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
      // Decision D114 (rows 132 and 133): the two modules of the camera search and of the local inputs.
      '*    Decision D114 extends OD-14 to `modules/capture-discovery` (row 132) and `modules/capture-inputs` (row 133): waived edits 19 to 22.',
      '*      capture                        capture                 task 3 (OD-14 waiver)',
      "import { captureModule, type CaptureSupervisor } from './capture';",
      "import { captureConfigModule } from './modules/capture-config';",
      "import { captureDiscoveryModule } from './modules/capture-discovery';",
      "import { captureInputsModule } from './modules/capture-inputs';",
      'capture: CaptureSupervisor;',
      "capture: 'src/capture (capture module)',",
      'readonly capture: CaptureSupervisor;',
      "['capture', captureModule],",
      "['modules/capture-config', captureConfigModule],",
      "['modules/capture-discovery', captureDiscoveryModule],",
      "['modules/capture-inputs', captureInputsModule],",
      "app.decorate('capture', { getter: () => seams.get('capture') });",
    ]);
  });

  // Row 113, fix round 1 (navigator finding N-3; decision D68). The test above sees only the lines
  // that mention capture. This one sees EVERY line added to the frozen file: with the waived lines
  // taken out, in the order they stand, app.ts is byte-equal to the file of plan row W08. A line
  // nobody waived - of any module, with any wording - changes the digest and fails here.
  it('app.ts: every added line is a waived one (capture: spec §I edits 1 to 6; STT configuration: edits 13 and 14, decision D68; camera search and local inputs: edits 19 to 22, decision D114); without them the file is the frozen one', () => {
    // THE SINGLE SOURCE OF THE WAIVED LINES of `app.ts` (review R63-14; capture spec §I, erratum PE-R63-14): the list
    // `WAIVED` below. The spec's table numbers every edit and names its authority - edits 1 to 6 (OD-14), 13 and 14
    // (D68), 19 to 22 (D114), and the four module registrations that had no number until that erratum: 23 and 24
    // `modules/evidence-export` (D143), 25 and 26 `modules/media-stream` (D140), 27 and 28 `modules/transcripts`
    // (D146), 29 and 30 `modules/sealing` (D147 (E)). A line added to this list is added to that table in the same change.
    /** SHA-256 of `src/app.ts` as plan row W08 froze it (commit 9d3a1ef, 398 lines). */
    const FROZEN_APP_TS = '3846e1700616410967dae0e251c07e27f98edd866f826fa549bb1a430f375db8';
    const WAIVED: readonly string[] = [
      ' *    WAIVED EDITS (task 3, decision OD-14; capture spec §I edits 1 to 6). Registered after the',
      ' *    fourteen: the unit `capture` (the supervisor of the capture worker) and the module',
      ' *    `modules/capture-config`. The seam `capture` joins the list of mechanism 3.',
      ' *    Decision D68 extends OD-14 to the registration of `modules/stt-config` (task 3 row 113): waived edits 13 and 14.',
      ' *    Decision D114 extends OD-14 to `modules/capture-discovery` (row 132) and `modules/capture-inputs` (row 133): waived edits 19 to 22.',
      ' *',
      ' *      capture                        capture                 task 3 (OD-14 waiver)',
      "import { captureModule, type CaptureSupervisor } from './capture';",
      "import { captureConfigModule } from './modules/capture-config';",
      "import { captureDiscoveryModule } from './modules/capture-discovery';",
      "import { captureInputsModule } from './modules/capture-inputs';",
      // Waived edits 23 and 24. Row 91, controller ruling D143: the registration of `modules/evidence-export` (operation 87) - this import and its unit line below.
      "import { evidenceExportModule } from './modules/evidence-export';",
      // Waived edits 25 and 26. Row 90, controller ruling D140: the registration of `modules/media-stream` (operation 88 and the evidence media route) - this import and its unit line below.
      "import { mediaStreamModule } from './modules/media-stream';",
      // Waived edits 29 and 30. Row 82b, controller ruling D147 (E): the registration of `modules/sealing` (operation 83 and the mount of the sealing composition) - this import and its unit line below.
      "import { sealingModule } from './modules/sealing';",
      "import { sttConfigModule } from './modules/stt-config';",
      // Waived edits 27 and 28. Integration pass D4, controller decision D146 (ops 84 to 86 had no owner in wave D): the registration of `modules/transcripts` - this import and its unit line below.
      "import { transcriptsModule } from './modules/transcripts';",
      '  capture: CaptureSupervisor;',
      "  capture: 'src/capture (capture module)',",
      '    readonly capture: CaptureSupervisor;',
      "  ['modules/stt-config', sttConfigModule],",
      "  ['capture', captureModule],",
      "  ['modules/capture-config', captureConfigModule],",
      "  ['modules/capture-discovery', captureDiscoveryModule],",
      "  ['modules/capture-inputs', captureInputsModule],",
      // Row 91, controller ruling D143 (see the import above).
      "  ['modules/evidence-export', evidenceExportModule],",
      // Row 90, controller ruling D140 (see the import above).
      "  ['modules/media-stream', mediaStreamModule],",
      // Integration pass D4, controller decision D146 (see the import above).
      "  ['modules/transcripts', transcriptsModule],",
      // Row 82b, controller ruling D147 (E) (see the import above).
      "  ['modules/sealing', sealingModule],",
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
    expect(current.filter((line) => /stt/i.test(line))).toEqual([WAIVED[3], WAIVED[14], WAIVED[19]]);
    // Positive control: one more line, of any kind, anywhere, is seen; so is a waived line that changed.
    const at = current.indexOf("  ['modules/demo', demoModule],");
    expect(at).toBeGreaterThan(0);
    expect(digest(withoutWaived([...current.slice(0, at), "  ['modules/other', otherModule],", ...current.slice(at)]))).not.toBe(FROZEN_APP_TS);
    expect(digest(withoutWaived(current.map((line) => (line === WAIVED[19] ? "  ['modules/stt-config', sttConfigModule, { early: true }]," : line))))).toBe('a waived line is missing');
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
  // Row 136 (spec §I edits 15 to 18; decision D108 (b): the same category of OD-14): the two keys of
  // the development fence stand in the same four places and are waived lines of the same list.
  it('config.ts: every added line is one of the capture keys (spec §I edits 7 to 10 and 15 to 18); without them the file is the frozen one', () => {
    /** SHA-256 of `src/config.ts` as plan row W08 froze it (unchanged up to commit 101ce62, 271 lines). */
    const FROZEN_CONFIG_TS = 'de6f7bc958d84649aff0d8e248ef534e167f3639afd46a6f3e36c590cf7154f9';
    const WAIVED_CONFIG: readonly string[] = [
      ' * WAIVED EDITS (task 3, decision OD-14; capture spec §I edits 7 to 10): the three capture keys.',
      ' * `DEMS_CAPTURE_MODE` (`simulated`, the default, or `real`), `DEMS_CAPTURE_WORKER` (the worker',
      ' * program) and `DEMS_MEDIA_DIR` (the media root). Whether a start in `real` mode is refused for a',
      " * missing key is the boot checks' decision (CS-22), not this file's.",
      ' * WAIVED EDITS (task 3, decisions OD-14 and D108; capture spec §I edits 15 to 18): the two keys of',
      ' * the development fence. `DEMS_CAPTURE_DEV_SOURCES` (`1` or `0`, the default: development sources',
      ' * exist) and `DEMS_CAPTURE_HELPER_FFMPEG` (the program the development helpers run). What a start',
      " * refuses for them is the capture fence's decision (capture spec §A.1.2), not this file's.",
      ' * WAIVED EDIT (task 3, fix wave H, ruling D198; the category of OD-14 and D108): one more key of the',
      ' * development fence. `DEMS_CAPTURE_DEV_FAKE_MIC` (`tone`, the default, or `speech`): what the first',
      " * generated test microphone plays. What a start refuses for it is the capture fence's decision.",
      // Wave H closing pass Z1 (decision D207): the installation identity, two keys, in the same four places.
      ' * WAIVED EDIT (task 3, fix wave H closing pass Z1, decision D207): the installation identity of the',
      ' * Core. `DEMS_INSTALLATION_DEVICE_ID` (a device id, e.g. `DEMS-IR-01`) and `DEMS_INSTALLATION_NAME`',
      ' * (a display name) are what the signed manifest of a sealed recording states as its device. Read',
      " * once, at start. Whether a start without them is refused is the sealing host's decision.",
      "export const ENV_CAPTURE_MODE = 'DEMS_CAPTURE_MODE';",
      "export const ENV_CAPTURE_WORKER = 'DEMS_CAPTURE_WORKER';",
      "export const ENV_MEDIA_DIR = 'DEMS_MEDIA_DIR';",
      "export const ENV_CAPTURE_DEV_SOURCES = 'DEMS_CAPTURE_DEV_SOURCES';",
      "export const ENV_CAPTURE_HELPER_FFMPEG = 'DEMS_CAPTURE_HELPER_FFMPEG';",
      "export const ENV_CAPTURE_DEV_FAKE_MIC = 'DEMS_CAPTURE_DEV_FAKE_MIC';",
      "export const ENV_INSTALLATION_DEVICE_ID = 'DEMS_INSTALLATION_DEVICE_ID';",
      "export const ENV_INSTALLATION_NAME = 'DEMS_INSTALLATION_NAME';",
      "export const CAPTURE_MODES = ['simulated', 'real'] as const;",
      'export type CaptureMode = (typeof CAPTURE_MODES)[number];',
      "export const DEFAULT_CAPTURE_MODE: CaptureMode = 'simulated';",
      "export const CAPTURE_DEV_FAKE_MICS = ['tone', 'speech'] as const;",
      'export type CaptureDevFakeMic = (typeof CAPTURE_DEV_FAKE_MICS)[number];',
      '/** Where the camera files live below the data directory when `DEMS_MEDIA_DIR` is unset (capture spec §H). */',
      "export const MEDIA_STORE_SUBPATH = 'media/sessions';",
      '',
      '  /** `real`: sessions record through the capture worker. `simulated`: no worker is ever started. */',
      '  readonly captureMode: CaptureMode;',
      '  /** Absolute path of the capture worker program, or null when none is configured. */',
      '  readonly captureWorkerPath: string | null;',
      '  /** Absolute path of the media root (OD-25: git-ignored, below the data directory by default). */',
      '  readonly mediaStoreDir: string;',
      '  /** The development flag of the capture fence. Read by ONE function: `captureOperationDecisionOf` (static rule G-R15). */',
      '  readonly captureDevSources: boolean;',
      '  /** Absolute path of the program the development helpers run, or null when none is configured. */',
      '  readonly captureHelperFfmpegPath: string | null;',
      '  /** What the first generated test microphone plays. Read by ONE function: `fakeMicDecisionOf` of the capture fence. */',
      '  readonly captureDevFakeMic: CaptureDevFakeMic;',
      '  /** The device id of this installation, or null when none is configured. Read by ONE function: `installationIdentityOf` of the sealing host. */',
      '  readonly installationDeviceId: string | null;',
      '  /** The display name of this installation, or null when none is configured. */',
      '  readonly installationName: string | null;',
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
      '/** `1` turns the development flag on; unset, empty or `0` leaves it off. Any other value stops the boot. */',
      'export function parseCaptureDevSources(raw: string | undefined): boolean {',
      "  if (raw === undefined || raw === '' || raw === '0') return false;",
      "  if (raw === '1') return true;",
      "  throw new ConfigError('CAPTURE_DEV_SOURCES_INVALID', `${ENV_CAPTURE_DEV_SOURCES} must be 1 or 0.`);",
      '}',
      '',
      '/** Unset or empty means `tone`. Any other value than the two stops the boot. */',
      'export function parseCaptureDevFakeMic(raw: string | undefined): CaptureDevFakeMic {',
      "  if (raw === undefined || raw === '') return 'tone';",
      '  const source = CAPTURE_DEV_FAKE_MICS.find((known) => known === raw);',
      "  if (source === undefined) throw new ConfigError('CAPTURE_DEV_FAKE_MIC_INVALID', `${ENV_CAPTURE_DEV_FAKE_MIC} must be one of ${CAPTURE_DEV_FAKE_MICS.join(', ')}.`);",
      '  return source;',
      '}',
      '',
      '/** A device id of the contract\'s form (`DEMS-IR-01`), or null when the variable is unset. Any other value stops the boot. */',
      'export function parseInstallationDeviceId(raw: string | undefined): string | null {',
      "  if (raw === undefined || raw === '') return null;",
      "  if (!/^[A-Z][A-Z0-9-]{0,31}$/.test(raw)) throw new ConfigError('INSTALLATION_DEVICE_ID_INVALID', `${ENV_INSTALLATION_DEVICE_ID} must be a device id: a capital letter, then capitals, digits or hyphens, 32 characters at most.`);",
      '  return raw;',
      '}',
      '',
      '/** A display name of 1 to 120 printable characters, or null when the variable is unset. Any other value stops the boot. */',
      'export function parseInstallationName(raw: string | undefined): string | null {',
      "  if (raw === undefined || raw === '') return null;",
      "  if (raw.length > 120 || raw !== raw.trim() || [...raw].some((character) => (character.codePointAt(0) ?? 0) < 32 || character.codePointAt(0) === 127)) throw new ConfigError('INSTALLATION_NAME_INVALID', `${ENV_INSTALLATION_NAME} must be 1 to 120 printable characters without a leading or trailing space.`);",
      '  return raw;',
      '}',
      '',
      '  /** Default: `simulated`. */',
      '  readonly captureMode?: CaptureMode;',
      '  /** Default: null (no worker program). */',
      '  readonly captureWorkerPath?: string | null;',
      '  /** Default: `<dataDir>/media/sessions`. */',
      '  readonly mediaStoreDir?: string | null;',
      '  /** Default: false (no development source exists). */',
      '  readonly captureDevSources?: boolean;',
      '  /** Default: null (no helper program). */',
      '  readonly captureHelperFfmpegPath?: string | null;',
      '  /** Default: `tone`. */',
      '  readonly captureDevFakeMic?: CaptureDevFakeMic;',
      '  /** Default: null (no installation identity is configured). */',
      '  readonly installationDeviceId?: string | null;',
      '  /** Default: null. */',
      '  readonly installationName?: string | null;',
      '  const captureWorkerPath = parseCapturePath(ENV_CAPTURE_WORKER, input.captureWorkerPath ?? undefined);',
      '  const mediaStoreDir = parseCapturePath(ENV_MEDIA_DIR, input.mediaStoreDir ?? undefined) ?? `${input.dataDir}/${MEDIA_STORE_SUBPATH}`;',
      '  const captureHelperFfmpegPath = parseCapturePath(ENV_CAPTURE_HELPER_FFMPEG, input.captureHelperFfmpegPath ?? undefined);',
      '    captureMode: input.captureMode ?? DEFAULT_CAPTURE_MODE,',
      '    captureWorkerPath,',
      '    mediaStoreDir,',
      '    captureDevSources: input.captureDevSources ?? false,',
      '    captureHelperFfmpegPath,',
      "    captureDevFakeMic: input.captureDevFakeMic ?? 'tone',",
      '    installationDeviceId: parseInstallationDeviceId(input.installationDeviceId ?? undefined),',
      '    installationName: parseInstallationName(input.installationName ?? undefined),',
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
    expect(current.filter((line) => line.startsWith('export const ENV_')).slice(-8)).toEqual([
      "export const ENV_CAPTURE_MODE = 'DEMS_CAPTURE_MODE';",
      "export const ENV_CAPTURE_WORKER = 'DEMS_CAPTURE_WORKER';",
      "export const ENV_MEDIA_DIR = 'DEMS_MEDIA_DIR';",
      "export const ENV_CAPTURE_DEV_SOURCES = 'DEMS_CAPTURE_DEV_SOURCES';",
      "export const ENV_CAPTURE_HELPER_FFMPEG = 'DEMS_CAPTURE_HELPER_FFMPEG';",
      "export const ENV_CAPTURE_DEV_FAKE_MIC = 'DEMS_CAPTURE_DEV_FAKE_MIC';",
      // Wave H closing pass Z1 (decision D207): the two keys of the installation identity (pin 6 -> 8).
      "export const ENV_INSTALLATION_DEVICE_ID = 'DEMS_INSTALLATION_DEVICE_ID';",
      "export const ENV_INSTALLATION_NAME = 'DEMS_INSTALLATION_NAME';",
    ]);
    expect(current.filter((line) => /^ {2}readonly (captureMode|captureWorkerPath|mediaStoreDir|captureDevSources|captureHelperFfmpegPath): /.test(line))).toHaveLength(5);
    // The development flag has NO default but "off": a line that turned it on by default is not a waived one.
    expect(digest(withoutWaived(current.map((line) => (line === '    captureDevSources: input.captureDevSources ?? false,' ? '    captureDevSources: input.captureDevSources ?? true,' : line))))).toBe('a waived line is missing');
    // Positive control: one more line, of any kind, anywhere, is seen; so is a waived line that changed.
    const at = current.indexOf("export const LISTEN_HOST = '127.0.0.1';");
    expect(at).toBeGreaterThan(0);
    expect(digest(withoutWaived([...current.slice(0, at), "export const OTHER_HOST = '0.0.0.0';", ...current.slice(at)]))).not.toBe(FROZEN_CONFIG_TS);
    expect(digest(withoutWaived(current.map((line) => (line === "export const DEFAULT_CAPTURE_MODE: CaptureMode = 'simulated';" ? "export const DEFAULT_CAPTURE_MODE: CaptureMode = 'real';" : line))))).toBe('a waived line is missing');
  });
});

// Row 136 (check M4-SR-1, rules G-R12, G-R14, G-R15; capture spec §G.1; SEC35-41 (c), SEC35-43 (e);
// decisions D95, D108). Each rule is a function of a tree or of an argument list, so that its
// control can run it on planted input.
describe('G-R12: helpers and mkfifo start through the pinned door; every argument is of a fixed table', () => {
  const LOCAL = 'src/capture/adapters/local/';
  const INGEST = `${join('rt', 'sp')}://127.0.0.1:8555/live/cam`;
  const PIPE = '/data/dems/run/capture/SES-20261009-0001/MIC-03.pcm';
  const START_MS = 1_760_000_000_123;
  /** Every argument list the helpers can build: both cameras with both encoders, both microphones, the two pre-checks, the device list. */
  const lists: readonly (readonly string[])[] = [
    ...Object.values(CameraHelperEncoder).flatMap((encoder) => [
      cameraPushArguments({ source: 'DEVICE', deviceName: LOCAL_CAMERA_DEVICE_NAME, encoder, ingestUrl: INGEST, startMs: START_MS }),
      cameraPushArguments({ source: 'GENERATED', encoder, ingestUrl: INGEST, startMs: START_MS }),
    ]),
    cameraPrecheckArguments(LOCAL_CAMERA_DEVICE_NAME),
    deviceListArguments(),
    micPushArguments({ source: { kind: 'DEVICE', name: LOCAL_MIC_DEVICE_NAME }, pipePath: PIPE }),
    ...Object.values(MicGeneratedTone).map((tone) => micPushArguments({ source: { kind: 'GENERATED', tone }, pipePath: PIPE })),
    micPrecheckArguments(LOCAL_MIC_DEVICE_NAME),
  ];
  const literals = new Set<string>([...CAMERA_HELPER_TABLE.literals, ...MIC_HELPER_TABLE.literals]);
  /** The computed values (spec §A.6.4 HL-3): the plan's listener, the two forms of `S`, the pipe, and the device named exactly. */
  const computed = new Set<string>([INGEST, PIPE, `-${(START_MS / 1000).toFixed(3)}`, String(START_MS * 1000), `${LOCAL_CAMERA_DEVICE_NAME}:none`, `none:${LOCAL_MIC_DEVICE_NAME}`]);
  const FORMATS = ['avfoundation', 'lavfi', join('rt', 'sp'), 'f32le', 'null'];
  const FORBIDDEN = new RegExp(['0\\.0\\.0\\.0', '::', '\\budp\\b', 'listen', '@', '[;&|`$<>\\\\]', 'movie=', 'capture screen', 'desk view'].join('|'), 'i');
  const LOOPBACK = new RegExp(`^${join('rt', 'sp')}://127\\.0\\.0\\.1:\\d{4,5}/[A-Za-z0-9/_-]+$`);

  /** The rule over one argument list. */
  const violations = (args: readonly string[]): string[] => [
    ...args.filter((arg) => !literals.has(arg) && !computed.has(arg)).map((arg) => `not of the table: ${arg}`),
    ...args.filter((arg) => FORBIDDEN.test(arg)).map((arg) => `forbidden: ${arg}`),
    ...args.filter((arg) => arg.includes('://') && !LOOPBACK.test(arg)).map((arg) => `not the loopback listener: ${arg}`),
    ...args.flatMap((arg, index) => (arg === '-f' && !FORMATS.includes(args[index + 1] ?? '') ? [`format: ${args[index + 1] ?? ''}`] : [])),
  ];

  it('finds a wildcard address, a datagram transport, a listen flag, a user part, a shell mark, a file filter, another format and a screen capture (control)', () => {
    const planted = ['-f', 'x11grab', '-i', 'Capture screen 0:none', '-i', `a${'movie'}=/etc/hosts`, '-listen', '1', 'udp://0.0.0.0:9000', `${join('rt', 'sp')}://user:pw@127.0.0.1:8555/x`, `${join('rt', 'sp')}://10.0.0.9:8555/live`, 'x; rm -rf /'];
    const found = violations(planted);
    for (const text of ['format: x11grab', 'forbidden: Capture screen 0:none', `forbidden: a${'movie'}=/etc/hosts`, 'forbidden: -listen', 'forbidden: udp://0.0.0.0:9000', `forbidden: ${join('rt', 'sp')}://user:pw@127.0.0.1:8555/x`, `not the loopback listener: ${join('rt', 'sp')}://10.0.0.9:8555/live`, 'forbidden: x; rm -rf /']) expect(found, text).toContain(text);
    // A value that is neither of the table nor computed is seen even when it looks harmless.
    expect(violations([...(lists[0] ?? []), '-shortest'])).toEqual(['not of the table: -shortest']);
  });

  it('every argument of every helper is a literal of its table or a computed value; none is forbidden; every address is the loopback listener', () => {
    expect(lists).toHaveLength(10);
    for (const args of lists) expect(violations(args), args.join(' ')).toEqual([]);
    // SEC35-43 (e): the inputs are the two devices by exact name and the generated ones of the table, and nothing else.
    const inputs = new Set(lists.flatMap((args) => args.flatMap((arg, index) => (arg === '-i' ? [args[index + 1] ?? ''] : []))));
    expect([...inputs].filter((input) => !literals.has(input) && input !== `${LOCAL_CAMERA_DEVICE_NAME}:none` && input !== `none:${LOCAL_MIC_DEVICE_NAME}`)).toEqual([]);
  });

  it('the door is the one file under adapters/local that starts a process: one spawn, no shell, the caller\'s environment only, nothing inherited', () => {
    const door = capture.find((file) => file.path === LOCAL_HELPER_DOOR)?.text ?? '';
    expect([...door.matchAll(PROCESS_START)]).toHaveLength(1);
    expect(door).toMatch(/shell: false,/);
    expect(door).toMatch(/detached: false,/);
    expect(door).toMatch(/env: \{ \.\.\.options\.env \},/);
    expect(door).toMatch(/stdio: \['ignore', 'pipe', 'pipe'\],/);
    expect(places(capture.filter((file) => file.path.startsWith(LOCAL)), PROCESS_START)).toEqual([LOCAL_HELPER_DOOR]);
    // `mkfifo` is a program like the helpers: it is named in the local folder only and started by no file but the door.
    const MKFIFO = /\bmkfifo\b/g;
    expect(places(capture, MKFIFO).every((path) => path.startsWith(LOCAL))).toBe(true);
    expect(places(capture, MKFIFO).length).toBeGreaterThan(0);
    // The argument tables live in one file per source class.
    expect(places(capture, /'-list_devices'|'avfoundation'|'lavfi'/g).sort()).toEqual([`${LOCAL}camera-helper-args.ts`, `${LOCAL}mic-helper-args.ts`]);
  });
});

describe('G-R14: no credential literal, no vendor-default table, and a local device is never replaced by a fake', () => {
  const ADAPTERS = 'src/capture/adapters/';
  const LOCAL = `${ADAPTERS}local/`;
  const FENCE = 'src/capture/fence/';
  const adapterFiles = capture.filter((file) => file.path.startsWith(ADAPTERS) || file.path.startsWith(FENCE));
  /** A default account as a string literal, and a table keyed by a camera maker. */
  const DEFAULT_ACCOUNT = new RegExp(`['"\`](?:${['admin', 'root', 'administrator', 'service', '12345', '123456', '888888', '666666', join('pass', 'word')].join('|')})['"\`]`, 'gi');
  const VENDOR = new RegExp(`\\b(?:${['hikvision', 'dahua', 'uniview', 'hanwha', 'vivotek', 'reolink', 'amcrest', 'foscam', 'tp-?link'].join('|')})\\b`, 'gi');
  /** An import of the in-memory fakes or of the generated test sources, and a call that builds one. */
  const FAKE_IMPORT = /from\s+'(?:\.\.?\/)+(?:fake(?:\/[a-z-]+)?|fence(?:\/[a-z-]+)?|generated-sources)'/g;
  const FAKE_BUILD = /\bcreate(?:Fake|Generated)[A-Za-z]*\s*\(/g;
  const CATCH = /\bcatch\b/g;
  /** The files that may build a fake or a generated source: the fakes' own registry, and the fence's registry of `REAL_DEVELOPMENT`. */
  const FAKE_BUILDERS = [`${ADAPTERS}fake/index.ts`, `${FENCE}index.ts`];

  const violations = (files: readonly SourceFile[]): string[] => [
    ...occurrences(files, DEFAULT_ACCOUNT).map((place) => `${place} names a default account`),
    ...occurrences(files, VENDOR).map((place) => `${place} names a camera maker`),
    ...occurrences(files, FAKE_IMPORT, (path) => path.startsWith(LOCAL)).map((place) => `${place} imports a fake source into the local-device folder`),
    ...occurrences(files, FAKE_BUILD, (path) => !FAKE_BUILDERS.includes(path) && !/^export function create/m.test(files.find((file) => file.path === path)?.text ?? '')).map((place) => `${place} builds a fake source`),
    ...files.filter((file) => FAKE_BUILDERS.includes(file.path) && CATCH.test(file.text)).map((file) => `${file.path} builds fake sources and has an error path`),
  ];

  it('finds a default account, a maker table, a fake imported into the local folder, and a fake built in an error path (control)', () => {
    const planted: SourceFile[] = [
      { path: `${ADAPTERS}camera/defaults.ts`, text: `const DEFAULTS = { ${'hik'}vision: ['${'ad'}min', '${'123'}45'] };` },
      { path: `${LOCAL}camera-adapter.ts`, text: "import { createFakeCameraAdapter } from '../fake';\ntry { open(); } catch { return createFakeCameraAdapter({ id }); }" },
      { path: `${FENCE}index.ts`, text: 'try { register(local); } catch { register(createGeneratedCameraAdapter(options)); }' },
    ];
    expect(violations(planted)).toEqual([
      `${ADAPTERS}camera/defaults.ts:1 names a default account`,
      `${ADAPTERS}camera/defaults.ts:1 names a default account`,
      `${ADAPTERS}camera/defaults.ts:1 names a camera maker`,
      `${LOCAL}camera-adapter.ts:1 imports a fake source into the local-device folder`,
      `${LOCAL}camera-adapter.ts:2 builds a fake source`,
      `${FENCE}index.ts builds fake sources and has an error path`,
    ]);
  });

  it('the adapter layer and the fence hold none of them', () => {
    expect(adapterFiles.length).toBeGreaterThan(40);
    expect(violations(adapterFiles)).toEqual([]);
    // What builds a test source today, beside the files that define one: the fence's registry of `REAL_DEVELOPMENT`, and nothing else.
    expect(places(adapterFiles, FAKE_BUILD).filter((path) => !/^export function create/m.test(adapterFiles.find((file) => file.path === path)?.text ?? ''))).toEqual([`${FENCE}index.ts`]);
    for (const path of FAKE_BUILDERS) expect((adapterFiles.find((file) => file.path === path)?.text ?? '').match(CATCH), path).toBeNull();
  });
});

describe('G-R15: the development flag is read in one function', () => {
  const OPERATION = 'src/capture/fence/operation.ts';
  const FLAG = new RegExp(`\\b${join('capture', 'DevSources')}\\b`, 'g');
  const FLAG_READ = new RegExp(`\\.\\s*${join('capture', 'DevSources')}\\b`, 'g');
  const FLAG_VARIABLE = new RegExp(`\\b(?:ENV_CAPTURE_DEV_SOURCES|${join('DEMS_CAPTURE_', 'DEV_SOURCES')}['"\`\\]])`, 'g');
  /** Where the member exists at all: its declaration and the object the loader builds, and the one function that reads it. */
  const FLAG_PLACES = [OPERATION, 'src/config.ts', 'src/plugins/config/load-config.ts'];

  const violations = (files: readonly SourceFile[]): string[] => [
    ...occurrences(files, FLAG, (path) => !FLAG_PLACES.includes(path)).map((place) => `${place} names the development flag`),
    ...occurrences(files, FLAG_READ, (path) => path !== OPERATION && path !== 'src/config.ts').map((place) => `${place} reads the development flag`),
    ...occurrences(files, FLAG_VARIABLE, (path) => path !== 'src/config.ts' && path !== 'src/plugins/config/load-config.ts').map((place) => `${place} names the variable of the development flag`),
  ];

  it('finds a second reader, a destructured read and a read of the variable (control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/capture/adapters/registry.ts', text: `if (app.config.${join('capture', 'DevSources')}) registerDevelopment();` },
      { path: 'src/modules/sessions/start.ts', text: `const { ${join('capture', 'DevSources')} } = app.config;` },
      { path: 'src/engine/index.ts', text: `const flag = options.env[ENV_CAPTURE_DEV_SOURCES] === '1';` },
    ];
    expect(violations(planted)).toEqual([
      'src/capture/adapters/registry.ts:1 names the development flag',
      'src/modules/sessions/start.ts:1 names the development flag',
      'src/capture/adapters/registry.ts:1 reads the development flag',
      'src/engine/index.ts:1 names the variable of the development flag',
    ]);
  });

  it('no production file but the one function reads it; the configuration declares and builds it, the loader parses it', () => {
    expect(violations(production)).toEqual([]);
    const operation = production.find((file) => file.path === OPERATION)?.text ?? '';
    // ONE read, inside the one function; `captureOperationOf` asks that function and reads nothing.
    expect([...operation.matchAll(FLAG_READ)]).toHaveLength(1);
    expect(operation).toMatch(/export function captureOperationDecisionOf\(config: CaptureOperationInput\): CaptureOperationDecision \{[^}]*config\.captureDevSources === true;/);
    expect(operation).toContain('return captureOperationDecisionOf(config).operation;');
    // The configuration builds it from its input with the default "off", and from nothing else.
    expect([...(production.find((file) => file.path === 'src/config.ts')?.text ?? '').matchAll(FLAG_READ)]).toHaveLength(1);
  });
});

describe('SEC35-41 (c): every INSERT into capture_devices names adapter_kind', () => {
  /** A statement text that inserts into the registry, with its column list. */
  const INSERT = /INSERT\s+INTO\s+(?:public\.)?capture_devices\s*\(([^)]*)\)/gi;
  const columnLists = (files: readonly SourceFile[]): { readonly path: string; readonly columns: string }[] =>
    files.flatMap((file) => [...file.text.matchAll(INSERT)].map((match) => ({ path: file.path, columns: match[1] ?? '' })));

  it('finds a statement that leans on the column default (control)', () => {
    const planted: SourceFile[] = [{ path: 'src/modules/x/statements.ts', text: "const ADD = 'INSERT INTO public.capture_devices (id, kind, transport) VALUES ($1, $2, $3)';" }];
    expect(columnLists(planted).filter((found) => !/\badapter_kind\b/.test(found.columns)).map((found) => found.path)).toEqual(['src/modules/x/statements.ts']);
  });

  it('the statements of the server name it, and the two builders of a typed row carry it', () => {
    const statements = columnLists(production);
    expect(statements.map((found) => found.path)).toEqual(['src/capture/fence/statements.ts']);
    expect(statements.filter((found) => !/\badapter_kind\b/.test(found.columns))).toEqual([]);
    // The local-device statement writes the kind as a LITERAL: no bind value can make it write another one.
    const fence = production.find((file) => file.path === 'src/capture/fence/statements.ts')?.text ?? '';
    expect(fence).toMatch(/\$5::boolean, 'LOCAL_DEVICE' /);
    expect(fence).not.toMatch(/UPDATE|DELETE/i);
    // The typed writers (drizzle): the mapping of the engine's rows and the seed each name the member.
    expect(production.find((file) => file.path === 'src/db/mapping/rows.ts')?.text ?? '').toContain('adapterKind: adapterKindOf(device),');
    expect(production.find((file) => file.path === 'src/db/seed/seed.ts')?.text ?? '').toMatch(/adapterKind: 'FAKE',/);
  });
});

// Row 61 (decisions D72(a), D72(l); pair-58 finding A-3; capture spec §A.1.2 "One definition"). The
// relation of the capture mode to the demo flag is decided in ONE function,
// `captureOperationDecisionOf`; the boot refuses what it refuses. Every other comparison of the
// capture mode is a reader that should ASK that function. The readers that existed before the one
// function are listed by name: the list may only SHRINK (each is a request to its owner), and a
// file that is not on it fails here.
describe('G-R16: the capture mode and the demo flag are related in one function; the boot checks ask it', () => {
  const OPERATION = 'src/capture/fence/operation.ts';
  const BOOT = 'src/capture/boot/';
  /** A comparison of the capture mode with one of its two values, in either order. */
  const MODE_COMPARED = new RegExp(`\\b${join('capture', 'Mode')}\\s*[!=]==?\\s*['"\`]|['"\`](?:real|simulated)['"\`]\\s*[!=]==?\\s*[\\w.]*${join('capture', 'Mode')}\\b`, 'g');
  /** A read of the demo flag from an object. The member of the same name on the DECISION of the one function is its answer, not the flag. */
  const DEMO_READ = new RegExp(`(?<!\\bdecision)\\.\\s*${join('demo', 'Controls')}\\b`, 'g');
  /** The readers of the capture mode from before the one function (rows 57, 58, 115, 132, 133). Nothing is added here. */
  const LEGACY_MODE_READERS = ['src/engine/index.ts', 'src/modules/capture-discovery/index.ts', 'src/modules/capture-inputs/routes.ts', 'src/transcription/boot.ts', 'src/transcription/index.ts'];
  /**
   * Who reads the demo flag: the one function; the configuration that builds it; the entry point's start line; the access
   * rule and the sign-in answer, which are about the DEMO CONTROLS themselves; and the M2 fencing, the second definition
   * of finding A-3 (a request of row 136: it becomes a caller of the one function).
   */
  const DEMO_READERS = [OPERATION, 'src/config.ts', 'src/index.ts', 'src/modules/capture-config/fencing.ts', 'src/modules/identity/sign-in.ts', 'src/plugins/permission-guard/decision.ts', 'src/plugins/permission-guard/index.ts'];

  const violations = (files: readonly SourceFile[]): string[] => [
    ...places(files, MODE_COMPARED).filter((path) => path !== OPERATION && !LEGACY_MODE_READERS.includes(path)).map((path) => `${path} compares the capture mode itself`),
    ...places(files, DEMO_READ).filter((path) => !DEMO_READERS.includes(path)).map((path) => `${path} reads the demo flag`),
    ...places(files.filter((file) => file.path.startsWith(BOOT)), new RegExp(`\\b(?:${join('capture', 'Mode')}|${join('demo', 'Controls')})\\b(?!\\s*[;,}]|\\s*\\?\\s*null)`, 'g')).map((path) => `${path} names a flag the one function decides`),
  ];

  it('finds a new comparison of the mode, a new reader of the demo flag, and a boot check that decides for itself (control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/modules/sessions/start.ts', text: `if (app.config.${join('capture', 'Mode')} === 'real' && !app.config.${join('demo', 'Controls')}) startWorker();` },
      { path: 'src/sealing/pipeline.ts', text: `const real = 'real' === config.${join('capture', 'Mode')};` },
      { path: `${BOOT}checks.ts`, text: `if (deps.${join('capture', 'Mode')} !== 'real') return inert;` },
    ];
    expect(violations(planted)).toEqual([
      'src/modules/sessions/start.ts compares the capture mode itself',
      'src/sealing/pipeline.ts compares the capture mode itself',
      `${BOOT}checks.ts compares the capture mode itself`,
      'src/modules/sessions/start.ts reads the demo flag',
      `${BOOT}checks.ts names a flag the one function decides`,
    ]);
  });

  it('no production file compares the capture mode but the one function and the readers from before it; the list has no entry that is gone', () => {
    expect(violations(production)).toEqual([]);
    expect(places(production, MODE_COMPARED)).toContain(OPERATION);
    // The list only shrinks: an entry whose file no longer compares the mode must be taken out.
    expect(LEGACY_MODE_READERS.filter((path) => !places(production, MODE_COMPARED).includes(path))).toEqual([]);
    expect(DEMO_READERS.filter((path) => !places(production, DEMO_READ).includes(path))).toEqual([]);
  });

  it('the boot checks take the decision of the one function and refuse what it refuses, before any real check', () => {
    const mount = capture.find((file) => file.path === `${BOOT}index.ts`)?.text ?? '';
    const checks = capture.find((file) => file.path === `${BOOT}checks.ts`)?.text ?? '';
    expect(mount).toContain('const decision = captureOperationDecisionOf(app.config);');
    expect([...mount.matchAll(/\bcaptureOperationDecisionOf\s*\(/g)]).toHaveLength(1);
    const refusal = checks.indexOf('if (decision.refusal !== null) return refuse(CaptureBootRefusal.OPERATION_REFUSED, decision.refusal);');
    expect(refusal).toBeGreaterThan(0);
    for (const call of ['workerProgramProblemOf(deps.workerProgram', 'deps.probeEvidenceVolume()', 'deps.signingKeyProblem()', 'await deps.handshake()']) {
      expect(checks.indexOf(call, refusal), call).toBeGreaterThan(refusal);
    }
    // The worker is started LAST: after the path rule, the store and the key.
    expect(checks.lastIndexOf('await deps.handshake()')).toBeGreaterThan(checks.lastIndexOf('deps.signingKeyProblem()'));
    // The boot folder starts no process and names no timer itself: the channel and the timers are handed in (G-R8).
    expect(places(capture.filter((file) => file.path.startsWith(BOOT)), PROCESS_START)).toEqual([]);
    expect(places(capture.filter((file) => file.path.startsWith(BOOT)), GLOBAL_TIMER)).toEqual([]);
  });
});
