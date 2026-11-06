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
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { describe, expect, it, vi } from 'vitest';
// The whole-tree scans below cross the default 5 s under the parallel suite on the bench
// (measured idle 2026-11-05: three full runs timed them out at 5-13 s while every one passes
// isolated); the file lifts the ceiling, not any assertion.
vi.setConfig({ testTimeout: 30_000 });

import { logCalls } from '../../../test/static/log-calls';
import { SCAN_COVERS, WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, scanCoverage, under, type SourceFile } from '../../../test/static/scan';
import { CAMERA_HELPER_TABLE, CameraHelperEncoder, LOCAL_CAMERA_DEVICE_NAME, LOCAL_MIC_DEVICE_NAME, MIC_HELPER_TABLE, MicGeneratedTone, cameraPrecheckArguments, cameraPushArguments, deviceListArguments, micPrecheckArguments, micPushArguments } from '../adapters/local';
import { CARD_LISTING_HELPER_TABLE, MIC_LINUX_HELPER_TABLE, linuxCardListingArguments, linuxChannelSelection, linuxMicDeviceArgument, linuxMicPrecheckArguments, linuxMicPushArguments } from '../adapters/local/mic-helper-args';
import { COMMISSIONING_HELPER_TABLE, commissioningAddressArgument, linuxEchoArguments, linuxNeighbourArguments } from '../adapters/local/mic-helper-args';
import { MACOS_LISTING_HELPER_TABLE, MIC_MACOS_HELPER_TABLE, isMicPipeArgument, macMicDeviceListArguments, macMicDeviceWord, macMicPrecheckArguments, macMicPushArguments, macSystemAudioArguments, macUsbTreeArguments } from '../adapters/local/mic-helper-args';

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
/** Task 4 row 110 (WP-22a; amended by row 3's decision text SR-3, entry 1): the SECOND file of the server that imports the `onvif` package, the set-network file; it imports ONE HTTP agent for the same purpose (pinned; G-R10, G-R11, G-R2). */
const ONVIF_NETWORK = 'src/capture/adapters/camera/onvif-network.ts';
/** Rows 134 to 136 (decision D95): the ONE door of the local-device helpers, the second file that may start a process (pinned; G-R2, G-R8, G-R12). */
const LOCAL_HELPER_DOOR = 'src/capture/adapters/local/process-door.ts';
/** Row 135: the ONE file that touches the named pipe of a microphone (pinned; G-R2, G-R6). */
const LOCAL_PIPE_FILES = 'src/capture/adapters/local/pipe-files.ts';
/** Row 61: the ONE file of the boot checks that touches the file system, the probe of the evidence store (pinned; G-R2, CS-22, CS-09). */
const BOOT_EVIDENCE_VOLUME = 'src/capture/boot/evidence-volume.ts';
/** Task 4 row 21 (WP-02; amended by row 3's decision text SR-1, entry 1): the ONE door of the production programs, the third file that may start a process (pinned; G-R2, G-R8). */
const PRODUCTION_DOOR = 'src/capture/adapters/production-door.ts';
/** Task 4 row 64 (WP-07a; amended by row 3's decision text SR-1, entry 3): the ONE file of the card listing that touches the file system, FOR READING ONLY (pinned; G-R2). */
const CARD_LISTING_READER = 'src/capture/adapters/audio/card-listing-reader.ts';
/** Task 4 row 65 (WP-08; amended by row 3's decision text SR-1, entry 2): the ONE file of the sound configuration that touches the file system, FOR WRITING UNDER THE CORE'S RUN DIRECTORY ONLY (pinned; G-R2). */
const ALSA_CONFIG_WRITER = 'src/capture/adapters/audio/alsa-config-writer.ts';
/** Audit 2026-11-05 row 101 (DF-24, decision D23 (1)): the ONE file that reads the camera interface's carrier, FOR READING ONLY (pinned; G-R2). */
const CAMERA_LINK_READER = 'src/capture/boot/camera-link.ts';

const places = (files: readonly SourceFile[], pattern: RegExp): string[] => [...new Set(occurrences(files, pattern).map((place) => place.replace(/:\d+$/, '')))];

describe('the scan itself', () => {
  it('reads the production sources of the capture folder', () => {
    // Rule R1 (test/static/scan.ts): the scan equals an independent walk of the folder and is not empty.
    // The adapter layer (row 65), the evidence signer (row 83), the capture fence (row 136) and the boot
    // checks of real capture (row 61) are part of `capture` for every rule below: each is read.
    expect(scanCoverage(capture, ['src/capture/'])).toEqual(SCAN_COVERS);
    for (const part of ['src/capture/adapters/', 'src/capture/signer/', 'src/capture/fence/', 'src/capture/boot/']) {
      expect(capture.some((file) => file.path.startsWith(part)), part).toBe(true);
    }
    expect(capture.some((file) => !file.path.slice('src/capture/'.length).includes('/')), 'the files of the folder itself').toBe(true);
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
  const ALLOWLIST = ['src/capture/supervisor.ts', 'src/capture/ipc.ts', SIGNER_HOST_KEY, LOCAL_HELPER_DOOR, LOCAL_PIPE_FILES, BOOT_EVIDENCE_VOLUME, PRODUCTION_DOOR, CARD_LISTING_READER, ALSA_CONFIG_WRITER, CAMERA_LINK_READER];

  it('the process module and the file system are imported by files of the allowlist only', () => {
    const importers = [...new Set([...places(capture, PROCESS_MODULE), ...places(capture, FILE_SYSTEM)])];
    expect(importers.filter((path) => !ALLOWLIST.includes(path))).toEqual([]);
    // What is there today: the worker's process channel and (rows 134 to 136, decision D95) the pinned door of the local-device helpers.
    // Task 4 row 21 (SR-1, entry 1): the production door is the third. It imports the process module and NOT the file system.
    expect(places(capture, PROCESS_MODULE).sort()).toEqual([LOCAL_HELPER_DOOR, PRODUCTION_DOOR, 'src/capture/ipc.ts']);
    // Row 83: the software signer's key at rest (evidence package spec §C.3, SEC35-07). Rows 134 / 135: the facts of a program path
    // (the door) and the named pipe of a microphone (`pipe-files.ts`: lstat, mkdir, realpath, unlink and nothing else; WIDENED BY ROW N10,
    // decision C118 (1): the pipe keeper's open for reading NON-BLOCKING, read and close - pinned by text in `adapters/local/__tests__/mic-static.test.ts`).
    // Row 61: the probe of the evidence store (`boot/evidence-volume.ts`: one exclusive create, a sync, a link and the removal of its own two names).
    // Task 4 row 64 (SR-1, entry 3): the reader of the card listing (`audio/card-listing-reader.ts`: open for reading, read, close and nothing else).
    // Task 4 row 65 (SR-1, entry 2): the writer of the shared-capture configuration (`audio/alsa-config-writer.ts`: one file below the run directory, made whole by a rename).
    // Audit 2026-11-05 row 101 (DF-24, decision D23 (1)): the reader of the camera link (`boot/camera-link.ts`: open for reading, read, close and nothing else).
    expect(places(capture, FILE_SYSTEM).sort()).toEqual([LOCAL_PIPE_FILES, LOCAL_HELPER_DOOR, BOOT_EVIDENCE_VOLUME, SIGNER_HOST_KEY, CARD_LISTING_READER, ALSA_CONFIG_WRITER, CAMERA_LINK_READER].sort());
  });

  // Audit 2026-11-05 row 101 (DF-24, decision D23 (1): "the Core watches the camera interface carrier"). For reading only,
  // like the card listing reader: two fixed file words below one directory named by the interface form, no process, no timer.
  it('the camera link reader: one import of the file system, one open and that for reading; it writes, removes, starts and waits on nothing', () => {
    const reader = capture.find((file) => file.path === CAMERA_LINK_READER)?.text ?? '';
    expect(reader.match(FILE_SYSTEM)).toEqual([`'node:${'fs'}/promises'`]);
    expect(reader).toMatch(new RegExp(`^import \\{ open \\} from 'node:${'fs'}/promises';$`, 'm'));
    expect(reader.match(/\bopen\([^)]*\)/g)).toEqual(["open(file, 'r')"]);
    expect(reader.match(/\b(?:write|writeFile|appendFile|mkdir|mkdtemp|rm|rmdir|unlink|rename|truncate|chmod|chown|copyFile|link|symlink|utimes|readdir|readlink|realpath|watch)\s*\(/g)).toBeNull();
    // The two files are fixed words; the one variable part of the directory is held to the interface form before it is used.
    expect(reader.match(/readFact\(`[^`]*`/g)).toEqual(['readFact(`${directory}/carrier`', 'readFact(`${directory}/operstate`']);
    expect(reader).toMatch(/^ {2}if \(!CAPTURE_INTERFACE_NAME_PATTERN\.test\(interfaceName\)\) \{$/m);
    expect(reader).toMatch(/^ {2}const directory = `\$\{root\}\/\$\{interfaceName\}`;$/m);
    expect([...reader.matchAll(PROCESS_MODULE), ...reader.matchAll(PROCESS_START), ...reader.matchAll(ENVIRONMENT), ...reader.matchAll(GLOBAL_TIMER), ...reader.matchAll(SOCKET_OR_THREAD)]).toEqual([]);
    expect(logCalls(reader)).toEqual([]);
  });

  // Task 4 row 65 (SR-1, entry 2: "for writing under the Core's run directory only"). The generator beside it imports no module of the host at all.
  it('the sound configuration writer: one import of the file system, one exclusive create with the owner-only mode, one rename onto the one path below the run directory; it reads and starts nothing', () => {
    const writer = capture.find((file) => file.path === ALSA_CONFIG_WRITER)?.text ?? '';
    expect(writer.match(FILE_SYSTEM)).toEqual([`'node:${'fs'}/promises'`]);
    expect(writer).toMatch(new RegExp(`^import \\{ lstat, mkdir, open, rename, rm \\} from 'node:${'fs'}/promises';$`, 'm'));
    // Integration pass I-6: the local name of the scratch file is `staging` (the search-path rule of `test/static` refuses the other word in production code).
    expect(writer.match(/\bopen\([^)]*\)/g)).toEqual(["open(staging, 'wx', OWNER_ONLY_FILE)"]);
    expect(writer.match(/\b(?:mkdir|rename|rm)\([^)]*\)/g)).toEqual(['mkdir(directory, { recursive: true, mode: OWNER_ONLY_DIRECTORY })', 'rm(staging, { force: true })', 'rename(staging, target)', 'rm(staging, { force: true })']);
    expect(writer).toMatch(/^const OWNER_ONLY_DIRECTORY = 0o700;$/m);
    expect(writer).toMatch(/^const OWNER_ONLY_FILE = 0o600;$/m);
    // The three names are made from the path function of the generator and literals: no other path exists in the file.
    expect(writer).toMatch(/^ {2}const target = alsaConfigPath\(runDir\);$/m);
    expect(writer).toMatch(/^ {2}const directory = target\.slice\(0, target\.lastIndexOf\('\/'\)\);$/m);
    expect(writer).toMatch(/^ {2}const staging = `\$\{directory\}\/dems-alsa\.tmp`;$/m);
    expect(writer).toMatch(/if \(path !== target\) throw new AlsaConfigWriteError\(AlsaConfigWriteRefusal\.PATH\);/);
    expect(writer.match(/\b(?:readFile|read|readdir|readlink|createReadStream|appendFile|copyFile|link|symlink|chmod|chown|truncate|unlink|rmdir|mkdtemp|utimes)\s*\(/g)).toBeNull();
    expect([...writer.matchAll(PROCESS_MODULE), ...writer.matchAll(PROCESS_START), ...writer.matchAll(ENVIRONMENT)]).toEqual([]);
    const generator = capture.find((file) => file.path === 'src/capture/adapters/audio/alsa-config.ts')?.text ?? '';
    expect(generator.match(/from\s+'[^']+'/g)).toEqual(["from './card-listing'"]);
  });

  // Task 4 row 64 (SR-1, entry 3: "for reading only"). The parser beside it imports no module of the host at all.
  it('the card listing reader: one import of the file system, one open and that for reading; it writes, removes and starts nothing', () => {
    const reader = capture.find((file) => file.path === CARD_LISTING_READER)?.text ?? '';
    expect(reader.match(FILE_SYSTEM)).toEqual([`'node:${'fs'}/promises'`]);
    expect(reader).toMatch(new RegExp(`^import \\{ open \\} from 'node:${'fs'}/promises';$`, 'm'));
    expect(reader.match(/\bopen\([^)]*\)/g)).toEqual(["open(path, 'r')"]);
    expect(reader.match(/\b(?:write|writeFile|appendFile|mkdir|mkdtemp|rm|rmdir|unlink|rename|truncate|chmod|chown|copyFile|link|symlink|utimes)\s*\(/g)).toBeNull();
    expect([...reader.matchAll(PROCESS_MODULE), ...reader.matchAll(PROCESS_START)]).toEqual([]);
    const parser = capture.find((file) => file.path === 'src/capture/adapters/audio/card-listing.ts')?.text ?? '';
    expect(parser.match(/from\s+'[^']+'/g)).toEqual(["from '@dems/shared/api'", "from '../types'"]);
  });

  it('no file of the folder opens a socket or starts a worker thread', () => {
    // Row 131 (G-R9): the ONE datagram socket of the Core is the WS-Discovery probe; its file is pinned by name, for that one module.
    // Row 142 (G-R10): the ONE importer of an HTTP agent is the connection test; its file is pinned by name, for those two modules.
    // Task 4 row 110 (SR-3: "unless row 110 needs the same two for the same purpose, which it then pins by exact string in the same way"):
    // the set-network file needs ONE of the two, the plain HTTP agent; it speaks no TLS, so the certificate exception is not widened.
    expect(occurrences(capture, SOCKET_OR_THREAD, (path) => path !== WS_DISCOVERY && path !== ONVIF_SESSION && path !== ONVIF_NETWORK)).toEqual([]);
    expect((capture.find((file) => file.path === WS_DISCOVERY)?.text.match(SOCKET_OR_THREAD) ?? []).map((text) => text.replace(/['"]/g, ''))).toEqual([join('node:', 'dg', 'ram')]);
    expect((capture.find((file) => file.path === ONVIF_SESSION)?.text.match(SOCKET_OR_THREAD) ?? []).map((text) => text.replace(/['"]/g, ''))).toEqual([join('node:', 'ht', 'tp'), join('node:', 'ht', 'tps')]);
    expect((capture.find((file) => file.path === ONVIF_NETWORK)?.text.match(SOCKET_OR_THREAD) ?? []).map((text) => text.replace(/['"]/g, ''))).toEqual([join('node:', 'ht', 'tp')]);
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
  it('only ipc.ts, the pinned door of the local-device helpers and the pinned door of the production programs start a process', () => {
    expect(places(capture, PROCESS_START).sort()).toEqual([LOCAL_HELPER_DOOR, PRODUCTION_DOOR, 'src/capture/ipc.ts']);
  });

  // Task 4 row 21 (SR-1, entry 1; the twin of the local door's start line in G-R12). The local door is not edited:
  // its line still closes standard input. This one keeps it open, as the channel of the start message and of liveness.
  // MOVED BY TASK 4 ROW 89 (decisions D51, D53: the live preview): the one spawn line now takes its standard input from the
  // child's `plumbing` - the door's own pipe for every caller of `startProductionProcess` (ALONE), or, for the SECOND child of
  // `startProductionPipeline`, the standard output of the FIRST child, which the door never reads and closes its end of. Still one
  // spawn call, started by the one start function from three places (the plain door and the two children of a pipeline).
  it('the production door: one spawn, no shell, an environment it built itself from its closed list, standard input a pipe (the door\'s, or in a pipeline the first child\'s output); no file system', () => {
    const door = capture.find((file) => file.path === PRODUCTION_DOOR)?.text ?? '';
    expect([...door.matchAll(PROCESS_START)]).toHaveLength(1);
    expect(door).toMatch(/shell: false,/);
    // MOVED BY ROW N5b (decision C131 (3)): a group of its own ONLY on the caller's ask with `true`; every other caller is the door of before.
    expect(door).toMatch(/detached: inOwnGroup,/);
    expect(door).toMatch(/const inOwnGroup = options\.processGroup === true;/);
    expect(door).toMatch(/env: environment,/);
    expect(door).toMatch(/stdio: \[plumbing\.input, 'pipe', 'pipe'\],/);
    // Row 89: the input is one of two forms, and the three starts are pinned: the plain door, and the two children of a pipeline.
    expect(door).toMatch(/^ {2}readonly input: 'pipe' \| Readable;$/m);
    expect(door).toMatch(/^const ALONE: Plumbing = Object\.freeze\(\{ input: 'pipe', readOutput: true \}\);$/m);
    expect(door).toMatch(/^export const startProductionProcess: ProductionDoor = \(options\) => startChild\(options, ALONE\)\.process;$/m);
    expect(door).toMatch(/startChild\(firstOptions, \{ input: 'pipe', readOutput: false \}\)/);
    expect(door).toMatch(/startChild\(\{ \.\.\.secondOptions, message: null \}, \{ input: joint, readOutput: true \}\)/);
    expect(door).toMatch(/^ {2}joint\?\.destroy\(\);$/m);
    expect(door.match(/\bstartChild\(/g)).toHaveLength(4);
    // The output of a child is read only when its plumbing says so; the one unread output is handed to the next child alone.
    expect(door).toMatch(/^ {2}if \(plumbing\.readOutput\) \{\n {4}running\.stdout\?\.on\('data',/m);
    expect(door).toMatch(/return \{ process: handle, unread: plumbing\.readOutput \? null : running\.stdout \};/);
    // Never the caller's object and never the server's own environment: the one `env:` of the file is the line above.
    expect(door.match(/\benv:/g)).toHaveLength(1);
    expect(door).toMatch(/PRODUCTION_ENVIRONMENT_KEYS = Object\.freeze\(\['ALSA_CONFIG_PATH'\] as const\);/);
    expect([...door.matchAll(FILE_SYSTEM)]).toEqual([]);
    // Task 4 row N5 (wave 12; its request line, served by row N4): the door's observer of standard error (`onDiagnostics`, design
    // masterplan/06 section 4.6) NEVER HOLDS THE CHILD - the door pauses no stream of a child - and the door has THREE timers and no
    // other: the write bound of the start message, the second of the observer's rate bound, the turn of its telling. Additive.
    const PAUSES_A_STREAM = /\.pause\s*\(/g;
    const DOOR_TIMER = /\btimers\.after\(/g;
    expect(door.match(PAUSES_A_STREAM)).toBeNull();
    expect(door.match(DOOR_TIMER)).toHaveLength(3);
    // Control: a paused stream and a fourth timer are seen by the same patterns.
    expect('child.stderr.pause(); child.stdout.pause ();'.match(PAUSES_A_STREAM)).toHaveLength(2);
    expect(`${door}\ncancelExtra = options.timers.after(1_000, later);`.match(DOOR_TIMER)).toHaveLength(4);
    // The local door keeps its own line (G-R12 pins it): the two doors are two files, neither a variant of the other.
    expect(capture.find((file) => file.path === LOCAL_HELPER_DOOR)?.text).not.toMatch(/'pipe', 'pipe', 'pipe'/);
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
    // Task 4 row 96 (G-R9 amended by row 3's decision text SR-2, in its destination clause only): the one call site stands in ONE function,
    // `transmit`, with two callers - the round (the group or the injected target, as before) and the typed probe (next test).
    expect([...discovery.matchAll(/\.send\s*\(/g)]).toHaveLength(1);
    expect(discovery).toContain('open.send(probe, to.port, to.address, sent);');
    expect(discovery.match(/\btransmit\([^)]*\)/g)).toEqual([
      'transmit(open: Socket, probe: Buffer, to: { readonly address: string; readonly port: number }, sent: (error: Error | null)',
      'transmit(open, probe, destination, sent)',
      'transmit(open, typedProbe, typed, typedSent)',
    ]);
    expect(discovery).toContain('const destination = fixture ?? WS_DISCOVERY_GROUP;');
    expect(discovery).toContain("const LOOPBACK = '127.0.0.1';");
    expect(discovery).toMatch(/if \(fixture !== null && \(fixture\.address !== LOOPBACK \|\|[^\n]*\n\s*throw new CaptureAdapterError/);
    // Every address literal of the file: the group and the loopback literal, and one documentation address for the fixture's synthetic interface.
    expect([...new Set(discovery.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) ?? [])].sort()).toEqual(['127.0.0.1', '192.0.2.1', '239.255.255.250', '255.255.255.0']);
  });

  // Task 4 row 96 (WP-12; SR-2: "a third destination is admitted, ONE unicast address that has passed the destination rule function of row 95
  // before any packet is built ... the static test must show that the unicast destination can only be a value returned by the rule function
  // (a typed or stored address never reaches the send call directly)"). Unchanged and still pinned above and below: one importer, one socket,
  // `udp4`, TTL 1, no group joined, one place that closes, the handler as one try / catch, the loopback target named in this one file.
  it('SR-2: the third destination is the destination rule\'s own answer - made in the rule\'s file only, handed on unchanged, and replaced by the loopback target under the fixture', () => {
    const DESTINATION_RULE = 'src/capture/destination-rule.ts';
    const ROUTES = 'src/modules/capture-discovery/routes.ts';
    const SEARCH = 'src/modules/capture-discovery/search.ts';
    const TYPED_RULE = 'src/modules/capture-discovery/typed-address.ts';
    const textOf = (path: string): string => production.find((file) => file.path === path)?.text ?? '';
    // (1) In the datagram file the member is typed as the rule's answer, and the typed target is that answer's address on the group's port - or the fixture.
    expect(discovery).toContain("import type { AllowedDestination } from '../../destination-rule';");
    expect(discovery).toContain('readonly unicast?: AllowedDestination;');
    expect(discovery).toContain('const unicast = search.unicast ?? null;');
    expect(discovery).toContain('const typed = unicast === null ? null : (fixture ?? { address: unicast.address, port: WS_DISCOVERY_GROUP.port });');
    // `typed` and `unicast` are assigned once each, and no other value of the file is an address of a send: the two callers of `transmit` name `destination` and `typed`.
    expect(discovery.match(/\b(?:typed|unicast|destination) = /g)).toEqual(['destination = ', 'unicast = ', 'typed = ']);
    // The typed probe stays on the segment: TTL 1 for it too, and one datagram, sent once, after a first round that left.
    expect(discovery).toContain('if (typed !== null) open.setTTL(WS_DISCOVERY_TTL);');
    expect(discovery.match(/\bsendTyped\(\)/g)).toHaveLength(1);
    // The source the rule named must be held by a probed interface, else nothing is sent at all (the refusal stands before the socket).
    expect(discovery).toContain('const sourceHeld = unicast === null || fixture !== null || interfaces.some((probed) => probed.address === unicast.sourceAddress);');
    expect(discovery.indexOf('if (interfaces.length === 0 || !sourceHeld) {')).toBeGreaterThan(0);
    expect(discovery.indexOf('if (interfaces.length === 0 || !sourceHeld) {')).toBeLessThan(discovery.indexOf('let socket: Socket | null = null;'));

    // (2) An answer of the rule is MADE in the rule's file and nowhere else: no other production file writes its two source members.
    //
    // NAMED ENTRY SR-14 (decision C93; review `verification/060_m3_review.md` finding F3-02; request line `row 143b` (1)).
    //   FILE     `src/capture/adapters/camera/stored-address.ts` - the ONE hand-on site of the rule's source address.
    //   SYMBOLS  `admitted` (the judgement `{ allowed: true, sourceAddress }`) and `storedCameraSourceOf` (the dial's `{ sourceAddress }`).
    //   ADMITTED the member `sourceAddress`, written by its own name alone (a shorthand member), in the three pinned lines of those two
    //            places and in no other line: the value is the address the rule answered, read from the rule's decision, held to the
    //            strict form (`isSourceAddress`) and handed on UNCHANGED. `viaAlias` is not admitted there, nor a member with a value.
    //   WHY      until this entry the rule was green by the FORM of that file, not by what it does (C60 (1)): the pattern (a) took a
    //            plainly typed member for a made answer - `sourceAddress: string` matched, because the blank after the colon was given
    //            back and the look-ahead then stood before it - and (b) did not see a member written by its name alone, so an answer
    //            composed as `{ sourceAddress, viaAlias }` in any file passed. Both are closed here: the look-ahead stands directly
    //            behind the colon, and the pattern has a second form for the shorthand member (in an object, between two commas of a list,
    //            or in a pattern that takes an object apart - it cannot tell them apart and refuses all three outside the pinned lines).
    //   NOT CHANGED: the rule itself. An answer of the rule is made in the rule's file and nowhere else; every other production file fails.
    const STORED_ADDRESS = 'src/capture/adapters/camera/stored-address.ts';
    const MAKES_AN_ANSWER = /\b(?:sourceAddress|viaAlias)\s*:(?!\s*(?:string|boolean)\b)|(?<=[{,]\s*)(?:sourceAddress|viaAlias)(?=\s*[,}])/g;
    /** SR-14: the three lines of the hand-on site, in file order - the judgement, the read of it, the dial's source. */
    const HANDS_THE_SOURCE_ON = [
      'return Object.freeze({ allowed: true, sourceAddress });',
      'const { sourceAddress } = judgement;',
      'return isSourceAddress(sourceAddress) ? { sourceAddress } : { refusal: StoredCameraRefusal.SOURCE_ABSENT };',
    ];
    const lineAt = (text: string, index: number): string => text.slice(text.lastIndexOf('\n', index - 1) + 1, (text.indexOf('\n', index) + 1 || text.length + 1) - 1).trim();
    const answerLines = (file: SourceFile): string[] => [...file.text.matchAll(MAKES_AN_ANSWER)].map((match) => lineAt(file.text, match.index));
    /** The rule as a function of a tree, so that the control can run it on planted files: every line that writes a source member outside the rule's file and outside the entry. */
    const madeOutsideTheRule = (files: readonly SourceFile[]): string[] =>
      files
        .filter((file) => file.path !== DESTINATION_RULE)
        .flatMap((file) => answerLines(file).filter((line) => !(file.path === STORED_ADDRESS && HANDS_THE_SOURCE_ON.includes(line))).map((line) => `${file.path} ${line}`));
    expect(madeOutsideTheRule(production)).toEqual([]);
    expect(places(production, MAKES_AN_ANSWER).sort()).toEqual([STORED_ADDRESS, DESTINATION_RULE].sort());
    // The entry's lines stand once each, in this order (the second is the read of the judgement the third hands on), and the value they
    // hand on has ONE origin: `admitted` is called once, with the decision's own source or null, and assigns it once.
    const storedAddress = production.find((file) => file.path === STORED_ADDRESS) ?? { path: STORED_ADDRESS, text: '' };
    expect(answerLines(storedAddress)).toEqual(HANDS_THE_SOURCE_ON);
    expect(storedAddress.text.match(/\badmitted\([^\n]*\);/g)).toEqual(['admitted(isSourceAddress(source) ? source : null);']);
    expect(storedAddress.text.match(/\bsourceAddress = [^;]*;/g)).toEqual(['sourceAddress = source;']);
    expect(storedAddress.text).toContain('const source = destination === undefined || destination === null ? null : destination.sourceAddress;');
    expect(storedAddress.text.match(/\bviaAlias\b/g)).toBeNull();
    // SR-14 CONTROL: the entry admits nothing else. Seen: a composed answer by shorthand members in another file (the blind spot), a member
    // with a value in the hand-on file, a fourth shorthand line there, and the entry's own lines in any other file. Not seen: a typed member,
    // an optional parameter and a read of the member (the defect: honest code is no longer refused).
    const sourcePlanted: SourceFile[] = [
      { path: ROUTES, text: 'const found = await adapter.discover({ windowMs, signal, unicast: { address, port, sourceAddress, viaAlias } });' },
      { path: STORED_ADDRESS, text: `${HANDS_THE_SOURCE_ON.join('\n')}\nreturn Object.freeze({ allowed: true, sourceAddress: camera.host });\nconst made = { sourceAddress,\n  viaAlias };` },
      { path: 'src/capture/adapters/camera/onvif-session.ts', text: `${HANDS_THE_SOURCE_ON[0]}\nconst bound = dial(candidate,\n  sourceAddress, signal);` },
      { path: SEARCH, text: 'interface Source { readonly sourceAddress: string; readonly viaAlias : boolean }\nfunction read(signal: AbortSignal, sourceAddress?: string): void {}\nconst from = decision.destination.sourceAddress;\nconst alias = destination.viaAlias === true;' },
      { path: DESTINATION_RULE, text: 'return { address, port, sourceAddress: formatAddress(source.value), viaAlias: source.alias };' },
    ];
    expect(madeOutsideTheRule(sourcePlanted)).toEqual([
      `${ROUTES} const found = await adapter.discover({ windowMs, signal, unicast: { address, port, sourceAddress, viaAlias } });`,
      `${ROUTES} const found = await adapter.discover({ windowMs, signal, unicast: { address, port, sourceAddress, viaAlias } });`,
      `${STORED_ADDRESS} return Object.freeze({ allowed: true, sourceAddress: camera.host });`,
      `${STORED_ADDRESS} const made = { sourceAddress,`,
      `${STORED_ADDRESS} viaAlias };`,
      `src/capture/adapters/camera/onvif-session.ts ${HANDS_THE_SOURCE_ON[0]}`,
      'src/capture/adapters/camera/onvif-session.ts sourceAddress, signal);',
    ]);
    // The pattern this entry replaces, kept as a text for the record of what it could not do: it refused the typed member and passed the composed answer.
    const BEFORE_SR_14 = /\b(?:sourceAddress|viaAlias)\s*:\s*(?!string\b|boolean\b)/g;
    expect(places(sourcePlanted, BEFORE_SR_14)).toEqual([STORED_ADDRESS, SEARCH, DESTINATION_RULE]);
    // (3) The one writer of `unicast` hands on what it was given; the one writer of `typed` hands on the rule's decision. No address text is in either.
    const WRITES_UNICAST = /\bunicast\s*:\s*(?!AllowedDestination\b)[^,;}]+/g;
    expect(places(production, WRITES_UNICAST)).toEqual([SEARCH]);
    expect(textOf(SEARCH).match(WRITES_UNICAST)).toEqual(['unicast: typed ']);
    expect(textOf(SEARCH)).toContain('const typed = request.trigger === CaptureDiscoveryTrigger.MANUAL ? request.typed : undefined;');
    expect(textOf(ROUTES).match(/\btyped = [^;]*;/g)).toEqual(['typed = decision.destination;']);
    expect(textOf(ROUTES)).toContain('const decision = typedAddress.decide(address);');
    expect(textOf(ROUTES)).toContain('if (!decision.allowed) throw addressNotAllowed();');
    // C10 (web console only): the guard's own refusal is asked for once the body is known to hold the member, BEFORE the rule is asked.
    expect(textOf(ROUTES).match(/\brequireWebConsoleSession\(/g)).toHaveLength(1);
    expect(textOf(ROUTES).indexOf('await permissionGuard(app).requireWebConsoleSession(request);')).toBeGreaterThan(textOf(ROUTES).indexOf('if (address !== undefined) {'));
    expect(textOf(ROUTES).indexOf('await permissionGuard(app).requireWebConsoleSession(request);')).toBeLessThan(textOf(ROUTES).indexOf('typedAddress.decide(address)'));
    // The text of the body is read at ONE place of the route and goes to the rule only.
    expect(textOf(ROUTES).match(/\brequest\s*\.\s*body\b[^;\n]*/g)).toEqual(['request.body?.address']);
    expect(textOf(ROUTES).match(/\([^()]*\baddress\b[^()]*\)/g)).toEqual(['(address !== undefined)', '(address)']);
    // (4) The module's own rule holder has no rule: without one handed in, every typed address is refused; a rule's answer is returned as it came.
    expect(textOf(TYPED_RULE)).toContain('if (provided === null) return refused(TYPED_ADDRESS_NOT_CONFIGURED);');
    expect(textOf(TYPED_RULE).match(/\ballowed: true\b/g)).toBeNull();
    expect(textOf(TYPED_RULE)).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b|\bdestination\s*:/);

    // CONTROL: a typed text that reaches the search, an answer composed outside the rule's file, and a second assignment in the datagram file are each seen.
    const planted: SourceFile[] = [
      { path: ROUTES, text: "const found = await adapter.discover({ windowMs, signal, unicast: { address: request.body.address, port: 3702, sourceAddress: own, viaAlias: false } });" },
      { path: SEARCH, text: 'const found = await adapter.discover({ windowMs, signal, unicast: typed });' },
    ];
    expect(places(planted, MAKES_AN_ANSWER)).toEqual([ROUTES]);
    expect(places(planted, WRITES_UNICAST)).toEqual([ROUTES, SEARCH]);
    expect('const typed = unicast === null ? null : fixture;\ntyped = { address: stored, port: 3702 };'.match(/\b(?:typed|unicast|destination) = /g)).toEqual(['typed = ', 'typed = ']);
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

describe('G-R13: a search is started by the search operation, the pre-check and the SMART ATTACH sweep, and by nothing else', () => {
  /**
   * The production files that call `discover` (R-9 AC-1). Row 132 wired the adapter: ONE file holds
   * the one call, and the two triggers that PROBE come through it - the search operation
   * (`routes.ts`, op 93) and the pre-check's search (`index.ts`, `runPrecheckSearch`). Another
   * entry is a decision, not a habit.
   *
   * DECISION D62 (ratified 2026-11-05) added the THIRD trigger, `AUTO`, and the rule keeps its
   * teeth BY THIS VERY PIN: the sweep sends NO WS-Discovery probe. It reads the host's own
   * neighbour table over the injected host-command seam and probes what lives there; its targets
   * are the Core's OWN ARP observations and no caller supplies one (R-9 AC-10 stands). What the
   * sweep may do is bounded below: it enters the store through `begin` like every search, it names
   * `AUTO` and no other trigger, `search.ts` does not name `AUTO` at all, and its timer exists only
   * behind the configuration flag.
   */
  const DISCOVER_CALL_SITES: readonly string[] = ['src/modules/capture-discovery/search.ts'];
  const DISCOVER_CALL = /\.\s*discover\s*\(/g;
  /** D62: the files that START a search in the store. `search.ts` for the two operator triggers, `segment-scan.ts` for the sweep - and nobody else. */
  const BEGIN_CALL_SITES: readonly string[] = ['src/modules/capture-discovery/search.ts', 'src/modules/capture-discovery/segment-scan.ts'];
  const BEGIN_CALL = /\bstore\.begin\s*\(/g;
  const AUTO_TRIGGER = /\bCaptureDiscoveryTrigger\.AUTO\b/g;
  const SEGMENT_SCAN = 'src/modules/capture-discovery/segment-scan.ts';

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

  it('D62: the sweep starts its store search through begin, names no probe call and no other trigger; search.ts never names AUTO (control)', () => {
    expect(places(production, BEGIN_CALL)).toEqual(BEGIN_CALL_SITES);
    const sweep = production.find((file) => file.path === SEGMENT_SCAN)?.text ?? '';
    expect(sweep.length).toBeGreaterThan(1_000);
    // The sweep sends no WS-Discovery probe and names no operator trigger; the two probe triggers stay in `search.ts`.
    expect([...sweep.matchAll(DISCOVER_CALL)]).toHaveLength(0);
    expect([...sweep.matchAll(AUTO_TRIGGER)].length).toBeGreaterThanOrEqual(2);
    expect(sweep).not.toMatch(/\bCaptureDiscoveryTrigger\.(?:MANUAL|PRECHECK)\b/);
    const search = production.find((file) => file.path === 'src/modules/capture-discovery/search.ts')?.text ?? '';
    expect([...search.matchAll(AUTO_TRIGGER)]).toHaveLength(0);
    // Control: a third begin-caller, a probe call in the sweep and an AUTO in `search.ts` are each seen by the pins above.
    const planted: SourceFile[] = [
      { path: 'src/modules/capture-session/tick.ts', text: 'const s = store.begin({ sessionId, searchId, trigger, startedAt, windowMs, interfaceCount: 0 });' },
      { path: SEGMENT_SCAN, text: 'const found = await adapter.discover({ windowMs });\nstore.begin(o);\nbegin(o); // a definition line is not a call' },
      { path: 'src/modules/capture-discovery/search.ts', text: 'if (request.trigger === CaptureDiscoveryTrigger.AUTO) return refuse;' },
    ];
    expect(places(planted, BEGIN_CALL)).toEqual(['src/modules/capture-session/tick.ts', SEGMENT_SCAN]);
    expect(places(planted, DISCOVER_CALL)).toEqual([SEGMENT_SCAN]);
    expect(places([planted[2] as SourceFile], AUTO_TRIGGER)).toEqual(['src/modules/capture-discovery/search.ts']);
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
  /** Task 4 row 110 (SR-3, entry 1): the four calls of the set-camera-network operation, as the package names them. The exact list of the set-network file. */
  const NETWORK_CALLS = ['getNetworkInterfaces', 'setNetworkDefaultGateway', 'setNetworkInterfaces', 'systemReboot'];
  const session = capture.find((file) => file.path === ONVIF_SESSION)?.text ?? '';
  const network = capture.find((file) => file.path === ONVIF_NETWORK)?.text ?? '';
  const types = capture.find((file) => file.path === PACKAGE_TYPES)?.text ?? '';
  const callsOf = (text: string): string[] => [...new Set([...text.matchAll(CLIENT_CALL)].map((match) => match[1] ?? ''))].sort();

  /** The rule as a function of a tree, so that the control can run it on planted files. */
  const violations = (files: readonly SourceFile[]): string[] => [
    ...occurrences(files, PACKAGE, (path) => path !== ONVIF_SESSION && path !== PACKAGE_TYPES && path !== ONVIF_NETWORK).map((place) => `${place} imports the ONVIF client`),
    ...occurrences(files, STREAM_OR_SOCKET, (path) => path.startsWith('src/capture/')).map((place) => `${place} imports a socket, TLS or HTTP/2 module`),
    ...occurrences(files, NO_CERTIFICATE_CHECK, (path) => path !== ONVIF_SESSION).map((place) => `${place} switches the certificate check off`),
    ...files.filter((file) => file.path === ONVIF_SESSION).flatMap((file) => callsOf(file.text).filter((name) => !READS.includes(name)).map((name) => `${file.path} calls ${name} on the client`)),
    // Row 110: each importer has its own exact list. A read in the set-network file fails as a network call in the connection file does.
    ...files.filter((file) => file.path === ONVIF_NETWORK).flatMap((file) => callsOf(file.text).filter((name) => !NETWORK_CALLS.includes(name)).map((name) => `${file.path} calls ${name} on the client`)),
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
    // Task 4 row 110 (SR-3): the second importer is held to ITS four calls - a read of the connection file, a clock set, a factory default,
    // the DHCP-era calls and a listener fail there; and the connection file still fails on each of the four (the lines above).
    const plantedNetwork: SourceFile[] = [
      { path: ONVIF_NETWORK, text: `client.getNetworkInterfaces(done);\nclient.setNetworkInterfaces(options, done);\nclient.setNetworkDefaultGateway(options, done);\nclient.systemReboot(done);\nclient.getProfiles(done);\nclient.setSystemFactoryDefault(done);\nclient.setNTP(options, done);\nclient.on('rawResponse', keep);\nconst agent = new Agent({ ${join('reject', 'Unauthorized')}: false });` },
      { path: 'src/capture/adapters/camera/onvif-third.ts', text: `import cam from '${join('on', 'vif')}/lib/cam.js';` },
    ];
    expect(violations(plantedNetwork)).toEqual([
      'src/capture/adapters/camera/onvif-third.ts:1 imports the ONVIF client',
      `${ONVIF_NETWORK}:9 switches the certificate check off`,
      `${ONVIF_NETWORK} calls getProfiles on the client`,
      `${ONVIF_NETWORK} calls on on the client`,
      `${ONVIF_NETWORK} calls setNTP on the client`,
      `${ONVIF_NETWORK} calls setSystemFactoryDefault on the client`,
    ]);
  });

  it('the package is imported by exactly two files of the server (SR-3), each by the file of the client and never by its main entry', () => {
    expect(violations(production)).toEqual([]);
    // Task 4 row 110 (SR-3, entry 1): + the set-network file. The list stays exact: a third importer fails until a further decision row admits it.
    expect(places(production, PACKAGE).sort()).toEqual([PACKAGE_TYPES, ONVIF_NETWORK, ONVIF_SESSION].sort());
    // The main entry would load the package's datagram code (capture spec §A.6.1a O-8): the client's own file is named.
    expect((session.match(PACKAGE) ?? []).map((text) => text.replace(/['"]/g, ''))).toEqual([FILE_OF_THE_CLIENT]);
    expect((network.match(PACKAGE) ?? []).map((text) => text.replace(/['"]/g, ''))).toEqual([FILE_OF_THE_CLIENT]);
    expect((types.match(PACKAGE) ?? []).map((text) => text.replace(/['"]/g, ''))).toEqual([FILE_OF_THE_CLIENT]);
    expect(session).not.toMatch(/\bDiscovery\b/);
    expect(network).not.toMatch(/\bDiscovery\b/);
  });

  it('the calls on the client are the five reads in the connection file and the four network calls in the set-network file; the declaration of the client has those nine and no other member', () => {
    expect(callsOf(session)).toEqual(READS);
    expect(callsOf(network)).toEqual(NETWORK_CALLS);
    const declared = [...types.matchAll(/^\s{4}(\w+)\(/gm)].map((match) => match[1] ?? '').filter((name) => name !== 'constructor');
    expect(declared.sort()).toEqual([...READS, ...NETWORK_CALLS].sort());
    // No DHCP mode (the destination rule carries none): the one declared form of an interface set says `DHCP: false`, and the one request of the file says it by a literal.
    expect(types.match(/\bDHCP\s*:\s*\w+/g)).toEqual(['DHCP: false']);
    expect(network.match(/\bDHCP\s*:\s*\w+/g)).toEqual(['DHCP: false']);
    expect(network).not.toMatch(/\bIPv6\b|\bfromDHCP\b/);
  });

  // Task 4 row 110 (SR-3: "one constructor rule holds for each importer; the client never leaves either file; the set-network file imports neither the credential reader nor the reveal module").
  it('the set-network file: one constructor call under the same rule, the facade as its only way out, no credential reader and no reveal module, every destination a value the destination rule returned', () => {
    expect([...network.matchAll(/\bnew\s+cam\s*\.\s*Cam\s*\(/g)]).toHaveLength(1);
    const built = network.slice(network.indexOf('new cam.Cam('), network.indexOf('new cam.Cam(') + 600);
    for (const option of ['autoconnect: false,', 'preserveAddress: true,', 'timeout: limits.requestMs,', 'agent,', 'useSecure: false,']) expect(built, option).toContain(option);
    expect(network).not.toMatch(/rawRequest|rawResponse|\.\s*(?:on|once|addListener)\s*\(\s*['"]warning['"]/);
    const exported = [...network.matchAll(/^export\s+(?:const|function|interface|type|class)\s+(\w+)/gm)].map((match) => match[1] ?? '');
    expect([...new Set(exported)].sort()).toEqual(['ONVIF_NETWORK_CALLS', 'ONVIF_NETWORK_LIMITS', 'OnvifGatewayState', 'OnvifNetworkCall', 'OnvifNetworkLimits', 'OnvifNetworkOutcome', 'OnvifNetworkReason', 'OnvifNetworkSetResult', 'OnvifNetworkSetter', 'OnvifNetworkSetterOptions', 'OnvifRebootState', 'createOnvifNetworkSetter']);
    expect(network).not.toMatch(/\breturn\s+client\b|\bexport\s+default\b|\bexport\s*\{/);
    expect(network).toContain('return Object.freeze({ setAddress });');
    // What it imports, exactly: the agent, the client's file, the destination rule's types, the timer seam, the opaque credential, the layer's errors and types, the target function.
    // NAMED ENTRY (row B1; decision C95; review `verification/060b_m3_review_second_pass.md` finding B-01): + the reply guard, `./onvif-reply-guard` -
    // the one-pass scan that caps and judges a device's reply BEFORE the package reads it (its namespace replacement is quadratic and synchronous).
    // The guard itself imports NOTHING (checked on the next line), so the entry opens no door: no module, no socket, no file, no timer.
    // NAMED ENTRY (row S06; review 086 caution C-10 / S-06; decision C127): + `./stored-address` for `isSourceAddress` - the source of a set call held to the relay's source form; stored-address.ts imports only a type of '../types', so the entry opens no door
    expect(network.match(/from\s+'[^']+'/g)).toEqual(["from 'node:http'", `from '${FILE_OF_THE_CLIENT}'`, "from '../../destination-rule'", "from '../../types'", "from '../credential'", "from '../errors'", "from '../types'", "from './connection-target'", "from './onvif-reply-guard'", "from './stored-address'"]);
    expect([capture.find((file) => file.path === 'src/capture/adapters/camera/onvif-reply-guard.ts')?.text.match(/\bfrom\s+['"]|\b(?:import|require)\s*\(/g) ?? 'no import', session.match(/from '\.\/onvif-reply-guard'/g)?.length]).toEqual(['no import', 1]);
    expect(network).toMatch(/^import \{ usingCredential, type SealedCredential \} from '\.\.\/credential';$/m);
    expect(network).not.toMatch(/credential-reader|credential-holders|\breveal\w*\s*\(|\bsessionOpen\b|\bconnectionTest\b|\brelayRestart\b/);
    expect(network.match(AGENT_IMPORT)).toEqual([`import { Agent as HttpAgent } from 'node:${join('ht', 'tp')}';`]);
    // S13-11: the client is built with, and every connection forced to, the address and port of the rule's own answer; the typed or stored text never reaches either.
    expect(network).toContain('decision = options.destination(target.host, target.port);');
    expect(network).toContain('const destination = decision.destination;');
    expect(built).toContain('hostname: destination.address,');
    expect(built).toContain('port: destination.port,');
    expect(network).toContain('host: destination.address, port: destination.port, localAddress: destination.sourceAddress, family: 4 }');
    expect(network.match(/\bhost(?:name)?\s*:\s*[\w.]+/g)).toEqual(['host: destination.address', 'hostname: destination.address', 'hostname: destination.address']);
  });

  it('one constructor call: no automatic connect, the address of the constructor kept, an explicit request limit; no listener on the client', () => {
    expect([...session.matchAll(/\bnew\s+cam\s*\.\s*Cam\s*\(/g)]).toHaveLength(1);
    const built = session.slice(session.indexOf('new cam.Cam('), session.indexOf('new cam.Cam(') + 600);
    for (const option of ['autoconnect: false,', 'preserveAddress: true,', 'timeout: limits.requestMs,', 'agent,']) expect(built, option).toContain(option);
    expect(session).not.toMatch(/rawRequest|rawResponse|\.\s*(?:on|once|addListener)\s*\(\s*['"]warning['"]/);
  });

  it('the client never leaves the file: what the file exports is the facade and its vocabulary', () => {
    const exported = [...session.matchAll(/^export\s+(?:const|function|interface|type|class)\s+(\w+)/gm)].map((match) => match[1] ?? '');
    // Task 4 row 26 (G-R10 / G-R11 amended by row 3's decision text: "the connection file keeps no configuration call"): + the locator facade, its answer and the stream of a video source - four names, no client.
    // Task 4 integration pass I-7 (row 49's request; the same amendment: a read, no configuration call): + the time-read facade - two names, no client, and no credential in its reach.
    expect([...new Set(exported)].sort()).toEqual(['ONVIF_SESSION_LIMITS', 'ONVIF_SESSION_READS', 'OnvifConnectionTester', 'OnvifConnectionTesterOptions', 'OnvifLocatorResult', 'OnvifSessionLimits', 'OnvifSessionRead', 'OnvifSessionResult', 'OnvifStreamLocator', 'OnvifStreamProfile', 'OnvifTestReason', 'OnvifTestWarning', 'OnvifTimeReader', 'createOnvifConnectionTester', 'createOnvifStreamLocator', 'createOnvifTimeReader']);
    expect(session).not.toMatch(/\breturn\s+client\b|\bexport\s+default\b|\bexport\s*\{/);
    expect(session).toContain('return Object.freeze({ test });');
    // The time read: its exchange is built with the literal `null` where the other two facades hand a credential on, and its `read` takes none.
    expect(session).toContain('return Object.freeze({ read });');
    expect(session.match(/\bexchange<[^(]*\(limits, timers, candidate, (\w+), signal, \{/g)?.map((call) => /candidate, (\w+), signal/.exec(call)?.[1])).toEqual(['credential', 'credential', 'null']);
    expect(session).toMatch(/^ {2}read\(candidate: CameraCandidate, signal: AbortSignal\): Promise</m);
  });

  // NAMED ENTRY SR-5, entry 2 (decision C93; review `verification/060_m3_review.md` finding F3-03; request line `row 143b` (2);
  // SR-5 is the amendment of C48 that admitted the time-read facade).
  //   FILE     `src/capture/adapters/camera/onvif-session.ts`.
  //   SYMBOL   `OnvifTimeReader.read`, the facade's one member.
  //   ADMITTED a THIRD parameter of that member, `fromAddress: string` - the source address the one request is made FROM (S13-11
  //            point 2; decision C65), a dotted address literal held to its form before any request. The bound signature is the
  //            form a STORED camera is read by and MUST stand; the two-parameter signature may stand beside it or be deleted.
  //   WHY      until this entry the pin above held the two-parameter line only, so the source address could reach the facade
  //            in no other way than as a SECOND signature: the pin was green by that form, and it forced an overload no
  //            production caller uses (C60 (1)). The entry names the bound signature instead of leaving it beside the pin.
  //   NOT CHANGED: the facade carries no credential (the exchange is built with the literal `null`, pinned above), no third
  //            signature, no fourth parameter, no other type of the third. Every production caller hands the address on.
  const TIME_READ_UNBOUND = 'read(candidate: CameraCandidate, signal: AbortSignal): Promise<{ readonly answered: boolean; readonly cameraUtcMs: number | null }>;';
  const TIME_READ_BOUND = 'read(candidate: CameraCandidate, signal: AbortSignal, fromAddress: string): Promise<{ readonly answered: boolean; readonly cameraUtcMs: number | null }>;';
  /** The rule as a function of a text, so that the control can run it on planted interfaces. */
  const timeReadViolations = (text: string): string[] => {
    const start = text.indexOf('export interface OnvifTimeReader {');
    const body = start < 0 ? '' : text.slice(start, text.indexOf('\n}', start));
    // Every member line of the interface (the scan holds code only: no comment line is left in it).
    const signatures = [...body.matchAll(/^ {2}\S[^\n]*$/gm)].map((match) => match[0].trim());
    return [
      ...signatures.filter((signature) => signature !== TIME_READ_UNBOUND && signature !== TIME_READ_BOUND).map((signature) => `not a signature of the entry: ${signature}`),
      ...(signatures.filter((signature) => signature === TIME_READ_BOUND).length === 1 ? [] : ['the bound signature does not stand exactly once']),
      ...(signatures.filter((signature) => signature === TIME_READ_UNBOUND).length <= 1 ? [] : ['the two-parameter signature stands more than once']),
    ];
  };

  it('SR-5, entry 2: the time read takes the source address as its third parameter and nothing else - one bound signature, at most the two-parameter one beside it; every production caller is bound (control)', () => {
    expect(timeReadViolations(session)).toEqual([]);
    // Who reads a camera's clock in production: the watch (one call) and the two fence binders. Each hands a source on: no caller uses the two-parameter form.
    const callers = production.flatMap((file) => [...file.text.matchAll(/\breader\.read\(([^()\n]*)\)/g)].map((match) => `${file.path} ${(match[1] ?? '').split(',').length}`));
    expect(callers).toEqual(['src/capture/adapters/camera/camera-watch.ts 3', 'src/capture/fence/production-parts.ts 3', 'src/capture/fence/production-parts.ts 3']);
    // The implementation: one function, its third parameter optional and of the one type; it is the facade's only member.
    expect(session.match(/^ {2}const read = \([^\n]*\): Promise</gm)).toEqual(['  const read = (candidate: CameraCandidate, signal: AbortSignal, sourceAddress?: string): Promise<']);

    // CONTROL: the entry admits nothing else.
    const facade = (...members: string[]): string => `export interface OnvifTimeReader {\n${members.map((member) => `  ${member}`).join('\n')}\n}\n`;
    expect(timeReadViolations(facade(TIME_READ_UNBOUND, TIME_READ_BOUND))).toEqual([]);
    expect(timeReadViolations(facade(TIME_READ_BOUND))).toEqual([]);
    const credential = 'read(candidate: CameraCandidate, signal: AbortSignal, fromAddress: string, credential: CameraCredential): Promise<{ readonly answered: boolean; readonly cameraUtcMs: number | null }>;';
    const anyText = 'read(candidate: CameraCandidate, signal: AbortSignal, fromAddress: unknown): Promise<{ readonly answered: boolean; readonly cameraUtcMs: number | null }>;';
    const optional = 'read(candidate: CameraCandidate, signal: AbortSignal, fromAddress?: string): Promise<{ readonly answered: boolean; readonly cameraUtcMs: number | null }>;';
    expect(timeReadViolations(facade(TIME_READ_UNBOUND))).toEqual(['the bound signature does not stand exactly once']);
    expect(timeReadViolations(facade(TIME_READ_UNBOUND, TIME_READ_BOUND, credential))).toEqual([`not a signature of the entry: ${credential}`]);
    expect(timeReadViolations(facade(TIME_READ_UNBOUND, anyText))).toEqual([`not a signature of the entry: ${anyText}`, 'the bound signature does not stand exactly once']);
    expect(timeReadViolations(facade(TIME_READ_BOUND, optional))).toEqual([`not a signature of the entry: ${optional}`]);
    expect(timeReadViolations(facade(TIME_READ_BOUND, TIME_READ_BOUND))).toEqual(['the bound signature does not stand exactly once']);
    expect(timeReadViolations(facade(TIME_READ_BOUND, 'setClock(candidate: CameraCandidate, at: number): Promise<void>;'))).toEqual(['not a signature of the entry: setClock(candidate: CameraCandidate, at: number): Promise<void>;']);
    expect(timeReadViolations(facade(TIME_READ_BOUND, 'readonly client: unknown;'))).toEqual(['not a signature of the entry: readonly client: unknown;']);
    expect(timeReadViolations('export interface Other {}')).toEqual(['the bound signature does not stand exactly once']);
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
  /** THE ENTRY STATEMENT of the composition, as it stands since row 106c (decision C82, named amendment SR-11): three members. */
  const ENTRY_COMPOSITION = 'composeProductionCaptureOf(app, { platform: process.platform, network: captureNetworkFacts(app), hostRunner: captureHostRunnerOf(createSystemTimers()) });';

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
      // Decisions D51 / D53 (row 90P): the registration of `modules/camera-preview` (operations 112-113 and the preview route) - this import, its comment and its unit line below.
      "import { cameraPreviewModule } from './modules/camera-preview';",
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
      // Decisions D51 / D53 (see the import above).
      '  // Decisions D51 / D53 (row 90P): operations 112-113 and the registry-external preview route `GET /preview/:token`.',
      "  ['modules/camera-preview', cameraPreviewModule],",
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
    // Decisions D51 / D53 (row 90P): one waived import stands before the STT import, so its two positions move by one.
    expect(current.filter((line) => /stt/i.test(line))).toEqual([WAIVED[3], WAIVED[15], WAIVED[20]]);
    // Positive control: one more line, of any kind, anywhere, is seen; so is a waived line that changed.
    const at = current.indexOf("  ['modules/demo', demoModule],");
    expect(at).toBeGreaterThan(0);
    expect(digest(withoutWaived([...current.slice(0, at), "  ['modules/other', otherModule],", ...current.slice(at)]))).not.toBe(FROZEN_APP_TS);
    expect(digest(withoutWaived(current.map((line) => (line === WAIVED[19] ? "  ['modules/stt-config', sttConfigModule, { early: true }]," : line))))).toBe('a waived line is missing');
  });

  it('index.ts: the supervisor boots after the boot steps and before the listener, and is shut down before the app closes', () => {
    // Task 4 row 85 (decision C46; review finding F-07; gate M2 decision C50): until row 85 the entry point named capture
    // in two statements. It now also hands the host facts of its own process to the boot checks - one import line, one
    // statement, two comment lines - and nothing else. Any further mention of capture in the entry point fails here.
    // Task 4 row 85b (decision C55): the entry point also composes production capture - one more header line, one import
    // line, one comment line that names capture, one statement (7 -> 11 lines; the first only changed its last character).
    expect(mentions('src/index.ts')).toEqual([
      '* to the capture boot checks (task 4 row 85, decision C46: one import line, one statement);',
      '* the composition of production capture (task 4 row 85b, decision C55: one import line, one statement);',
      // Task 4 row 106c (decision C82, NAMED AMENDMENT SR-11): the import line gained ONE name, the maker of the runner (the
      // one the host facts are made with); the statement below gained ONE member. No line that names capture was added.
      "import { captureBootControl, captureHostOfProcess, captureHostRunnerOf, createSystemTimers } from './capture';",
      "import { composeProductionCaptureOf } from './capture-composition';",
      // Integration pass I-9a (request line `row 108`; decisions C55, C60 (4)): the reader of the network facts is a member of
      // the ONE statement - one import line, one comment line that names the boot step, and the statement's new text (11 -> 13 lines).
      "import { captureNetworkFacts } from './modules/capture-config';",
      "if (app.seams.has('capture')) await app.capture.shutdown();",
      '// Task 4 row 85b, decision C55: the members of production capture are handed to their takers, once, before the boot',
      '// handed in, NOT called: it is asked at each judgement and answers "not configured" until boot step `capture.config` loaded.',
      // SR-11 (decision C82, row 106c): the runner of the host's questions is the third member, for the ONE purpose of
      // reading the address helper's interface file by a fixed row. A fourth member, or another value of this one, fails here.
      ENTRY_COMPOSITION,
      '// Task 4 row 85, decision C46: the host facts of THIS process go to the capture boot checks before the boot steps',
      'captureBootControl(app).provideHost(',
      'captureHostOfProcess(',
      'await app.capture.boot();',
    ]);
    const entry = raw('src/index.ts').join('\n');
    // C46: the facts are handed in after the app is ready and BEFORE the boot steps run; they are the process's own four facts.
    expect(entry).toMatch(/\n {2}captureBootControl\(app\)\.provideHost\(\n {4}captureHostOfProcess\(\n {6}\{\n {8}platform: process\.platform,\n {8}startArguments: process\.execArgv,\n {8}nodeOptionsSet: process\.env\['NODE_OPTIONS'\] !== undefined,\n {8}userLimits: \(\) => \(process\.report\?\.getReport\(\) as \{ readonly userLimits\?: unknown \} \| undefined\)\?\.userLimits,\n {6}\},\n {6}createSystemTimers\(\),\n {4}\),\n {2}\);\n {2}await app\.readiness\.boot\(\);/);
    expect(entry.indexOf('await app.ready();')).toBeGreaterThan(0);
    expect(entry.indexOf('captureBootControl(app).provideHost(')).toBeGreaterThan(entry.indexOf('await app.ready();'));
    // Row 85b: the composition is asked for once, by the entry point alone, after the app is ready and before the boot steps;
    // it is handed the platform and - since integration pass I-9a - the reader of the network facts of the capture-config
    // module, as a function it does not call (the facts are loaded later, in boot step `capture.config`). NOTHING ELSE, no seam.
    expect(entry.match(/\bcomposeProductionCaptureOf\(/g)).toHaveLength(1);
    expect(entry.match(/\bcaptureNetworkFacts\b/g)).toHaveLength(2);
    expect(entry.indexOf(ENTRY_COMPOSITION)).toBeGreaterThan(entry.indexOf('await app.ready();'));
    expect(entry.indexOf(ENTRY_COMPOSITION)).toBeLessThan(entry.indexOf('await app.readiness.boot();'));
    expect(places(production, /\bcomposeProductionCaptureOf\s*\(/g)).toEqual(['src/capture-composition.ts', 'src/index.ts']);
    // The composing file is above the modules and outside the capture unit: nothing under src/capture/ or src/modules/ names it.
    expect(places(production.filter((file) => /^src\/(?:capture|modules|plugins|core|engine)\//.test(file.path)), /capture-composition/g)).toEqual([]);
    expect(entry).toMatch(/await app\.readiness\.boot\(\);\n {2}await app\.capture\.boot\(\);\n {2}await app\.listen\(\{ host: LISTEN_HOST, port: config\.port \}\);/);
    expect(entry).toMatch(/try \{\n {4}if \(app\.seams\.has\('capture'\)\) await app\.capture\.shutdown\(\);\n {4}await app\.close\(\);/);
  });

  // Row 58 (spec §I edits 7 to 10; category "capture config keys" of OD-14). Until row 58 this
  // test read "config.ts is not touched by this row". The file is pinned the way app.ts is: with
  // EVERY waived added line taken out, in the order they stand, config.ts is byte-equal to the file
  // plan row W08 froze. A line nobody waived, of any kind, changes the digest and fails here.
  // Row 136 (spec §I edits 15 to 18; decision D108 (b): the same category of OD-14): the two keys of
  // the development fence stand in the same four places and are waived lines of the same list.
  it('config.ts: every added line is a waived one - the capture keys (spec §I edits 7 to 10 and 15 to 18) and the LCD backend URL (2026-11-03); without them the file is the frozen one', () => {
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
      ' * Core. `DEMS_INSTALLATION_DEVICE_ID` (a device id, e.g. `DEMS-SITE-21`) and `DEMS_INSTALLATION_NAME`',
      ' * (a display name) are what the signed manifest of a sealed recording states as its device. Read',
      " * once, at start. Whether a start without them is refused is the sealing host's decision.",
      // Task 4 row 21 (WP-02; addendum 8.2 "Configuration keys"): the relay and guard paths, two keys, in the same four places.
      ' * WAIVED EDIT (task 4 row 21, work package WP-02; the category of OD-14): the two program paths of',
      ' * production capture. `DEMS_CAPTURE_RELAY` (the relay of a camera) and `DEMS_CAPTURE_GUARD` (the',
      ' * guard of a helper) are absolute paths, started by the production door only. Whether a start',
      " * without them is refused is the decision of the boot checks of production capture, not this file's.",
      // Task 4 row 105 (WP-19b; the category of OD-14): the socket of the address helper - nine lines in five places, served by row 85 (the writer of this list in batch 9).
      ' * WAIVED EDIT (task 4 row 105, work package WP-19b; the category of OD-14): the socket of the capture',
      " * host's address helper. `DEMS_CAPTURE_ALIAS_SOCKET` is an absolute path; unset, the helper is \"not",
      ' * configured" for the capture commissioning functions. It is dialled by the one local-socket client.',
      // Task 4 row 85c (decision C60 (3); the category of OD-14): the audio helper of production capture - nine lines in five places.
      ' * WAIVED EDIT (task 4 row 85c, decision C60 (3); the category of OD-14): the audio helper of production',
      ' * capture. `DEMS_CAPTURE_AUDIO_HELPER` is an absolute path; unset, no production microphone can be',
      ' * opened. It is started by the guard of production capture, never directly and never by a development door.',
      // LCD integration (user request 2026-10-19; the key joined config.ts with the task-4
      // checkpoint f85e9c01 of 2026-11-03, outside the capture family - same category of OD-14):
      // the backend URL of the panel bridge, five places in the file.
      // Decision D62 (ratified 2026-11-05; the category of OD-14): the four keys of SMART ATTACH - the flag,
      // the segment /24, and the optional bench pair - in the same places as every key before them, plus their
      // parsers, their refusal of a sweep without its segment, and the fields the auto-attach reads. Every line
      // below is one added line of `src/config.ts` as the decision wrote it, in the order the file holds them.
      " * WAIVED EDITS (decision D62, ratified 2026-11-05; the category of OD-14): the four keys of SMART",
      " * ATTACH. `DEMS_CAMERA_AUTOATTACH` (`1` turns the segment sweep on; unset, empty or `0` leaves it",
      " * off, and every other environment is exactly as it was), `DEMS_CAMERA_SEGMENT_CIDR` (one IPv4 `/24`",
      " * literal, required while the sweep is on: a start that turns it on without its segment stops the",
      " * boot here), and the optional pair `DEMS_CAMERA_DEFAULT_USER` with `DEMS_CAMERA_DEFAULT_PASSWORD`",
      " * (the bench camera credential, read ONLY to test and store an auto-adopted camera; the secret is a",
      " * `Secret` and prints as `[redacted]`). Without the pair the sweep still lists what answers: nothing",
      " * is tested, adopted or assigned.",
      "export const ENV_LCD_BACKEND_URL = 'DEMS_LCD_BACKEND_URL';",
      "export const ENV_CAPTURE_MODE = 'DEMS_CAPTURE_MODE';",
      "export const ENV_CAPTURE_WORKER = 'DEMS_CAPTURE_WORKER';",
      "export const ENV_MEDIA_DIR = 'DEMS_MEDIA_DIR';",
      "export const ENV_CAPTURE_DEV_SOURCES = 'DEMS_CAPTURE_DEV_SOURCES';",
      "export const ENV_CAPTURE_HELPER_FFMPEG = 'DEMS_CAPTURE_HELPER_FFMPEG';",
      "export const ENV_CAPTURE_DEV_FAKE_MIC = 'DEMS_CAPTURE_DEV_FAKE_MIC';",
      "export const ENV_INSTALLATION_DEVICE_ID = 'DEMS_INSTALLATION_DEVICE_ID';",
      "export const ENV_INSTALLATION_NAME = 'DEMS_INSTALLATION_NAME';",
      "export const ENV_CAPTURE_RELAY = 'DEMS_CAPTURE_RELAY';",
      "export const ENV_CAPTURE_GUARD = 'DEMS_CAPTURE_GUARD';",
      "export const ENV_CAPTURE_ALIAS_SOCKET = 'DEMS_CAPTURE_ALIAS_SOCKET';",
      "export const ENV_CAPTURE_AUDIO_HELPER = 'DEMS_CAPTURE_AUDIO_HELPER';",
      "// Decision D62 (2026-11-05): the four keys of SMART ATTACH (segment sweep, its /24, the bench pair).",
      "export const ENV_CAMERA_AUTOATTACH = 'DEMS_CAMERA_AUTOATTACH';",
      "export const ENV_CAMERA_SEGMENT_CIDR = 'DEMS_CAMERA_SEGMENT_CIDR';",
      "export const ENV_CAMERA_DEFAULT_USER = 'DEMS_CAMERA_DEFAULT_USER';",
      "export const ENV_CAMERA_DEFAULT_PASSWORD = 'DEMS_CAMERA_DEFAULT_PASSWORD';",
      "export const CAPTURE_MODES = ['simulated', 'real'] as const;",
      'export type CaptureMode = (typeof CAPTURE_MODES)[number];',
      "export const DEFAULT_CAPTURE_MODE: CaptureMode = 'simulated';",
      "export const CAPTURE_DEV_FAKE_MICS = ['tone', 'speech'] as const;",
      'export type CaptureDevFakeMic = (typeof CAPTURE_DEV_FAKE_MICS)[number];',
      '/** Where the camera files live below the data directory when `DEMS_MEDIA_DIR` is unset (capture spec §H). */',
      "export const MEDIA_STORE_SUBPATH = 'media/sessions';",
      '',
      '  /** Optional local LCD bridge. Configured at startup; never a browser supplied URL. */',
      '  readonly lcdBackendUrl?: string | null;',
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
      '  /** Absolute path of the relay program of production capture, or null when none is configured. Started by the production door only. */',
      '  readonly captureRelayPath: string | null;',
      '  /** Absolute path of the guard program of production capture, or null when none is configured. Started by the production door only. */',
      '  readonly captureGuardPath: string | null;',
      "  /** Absolute path of the socket of the capture host's address helper, or null when none is configured. */",
      '  readonly captureAliasSocketPath: string | null;',
      '  /** Absolute path of the audio helper of production capture, or null when none is configured. Started by the guard of production capture only. */',
      '  readonly captureAudioHelperPath: string | null;',
      "  /** Decision D62 (2026-11-05) SMART ATTACH: true only when `DEMS_CAMERA_AUTOATTACH=1`. Off by default: no sweep, no timer, nothing changes. */",
      "  readonly cameraAutoattach: boolean;",
      "  /** Decision D62: the one IPv4 `/24` literal of the camera segment the sweep reads, or null when unset. Required while the sweep is on: `createConfig` refuses the pair otherwise. */",
      "  readonly cameraSegmentCidr: string | null;",
      "  /** Decision D62: the bench camera user name, or null. Read ONLY for the auto connect-test and the stored credential; without it nothing is auto-adopted. */",
      "  readonly cameraDefaultUser: string | null;",
      "  /** Decision D62: its password as a `Secret` (prints `[redacted]`, reaches no log line), or null. */",
      "  readonly cameraDefaultPassword: Secret | null;",
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
      '/** A device id of the contract\'s form (`DEMS-SITE-21`), or null when the variable is unset. Any other value stops the boot. */',
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
      "// ── Decision D62 (2026-11-05): SMART ATTACH ─────────────────────────────────────────────────────",
      "",
      "/** `1` turns the SMART ATTACH segment sweep on; unset, empty or `0` leaves it off. Any other value stops the boot. */",
      "export function parseCameraAutoattach(raw: string | undefined): boolean {",
      "  if (raw === undefined || raw === '' || raw === '0') return false;",
      "  if (raw === '1') return true;",
      "  throw new ConfigError('CAMERA_AUTOATTACH_INVALID', `${ENV_CAMERA_AUTOATTACH} must be 1 or 0.`);",
      "}",
      "",
      "/**",
      " * The one form of `DEMS_CAMERA_SEGMENT_CIDR` (decision D62): a strict dotted IPv4 quad — four",
      " * decimal parts from 0 to 255 without a leading zero — and the literal prefix length `/24`. No",
      " * other prefix, no host name, no port, no blank: the sweep reads exactly one /24 of the host.",
      " */",
      "export const CAMERA_SEGMENT_CIDR_PATTERN = /^(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}\\/24$/;",
      "",
      "/** One IPv4 `/24` literal, or null when the variable is unset. Any other text stops the boot. */",
      "export function parseCameraSegmentCidr(raw: string | undefined): string | null {",
      "  if (raw === undefined || raw === '') return null;",
      "  if (!CAMERA_SEGMENT_CIDR_PATTERN.test(raw)) throw new ConfigError('CAMERA_SEGMENT_CIDR_INVALID', `${ENV_CAMERA_SEGMENT_CIDR} must be one IPv4 /24 literal, e.g. 192.168.7.0/24.`);",
      "  return raw;",
      "}",
      "",
      "/** The bench camera user name of decision D62: 1 to 120 printable characters without surrounding space, or null when unset. */",
      "export function parseCameraDefaultUser(raw: string | undefined): string | null {",
      "  if (raw === undefined || raw === '') return null;",
      "  if (raw.length > 120 || raw !== raw.trim() || [...raw].some((character) => (character.codePointAt(0) ?? 0) < 32 || character.codePointAt(0) === 127)) throw new ConfigError('CAMERA_DEFAULT_USER_INVALID', `${ENV_CAMERA_DEFAULT_USER} must be 1 to 120 printable characters without a leading or trailing space.`);",
      "  return raw;",
      "}",
      "",
      "/** The bench camera password of decision D62, sealed in a `Secret`: it prints as `[redacted]` and reaches no log line. Null when unset. */",
      "export function parseCameraDefaultPassword(raw: string | undefined): Secret | null {",
      "  if (raw === undefined || raw === '') return null;",
      "  if (raw.length > 256 || [...raw].some((character) => (character.codePointAt(0) ?? 0) < 32 || character.codePointAt(0) === 127)) throw new ConfigError('CAMERA_DEFAULT_PASSWORD_INVALID', `${ENV_CAMERA_DEFAULT_PASSWORD} must be 1 to 256 printable characters.`);",
      "  return new Secret(raw);",
      "}",
      "",
      '  readonly lcdBackendUrl?: string | null;',
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
      '  /** Default: null (no relay program of production capture). */',
      '  readonly captureRelayPath?: string | null;',
      '  /** Default: null (no guard program of production capture). */',
      '  readonly captureGuardPath?: string | null;',
      "  /** Default: null (no socket of the capture host's address helper). */",
      '  readonly captureAliasSocketPath?: string | null;',
      '  /** Default: null (no audio helper of production capture). */',
      '  readonly captureAudioHelperPath?: string | null;',
      "  /** Decision D62 (2026-11-05). Default: false (no SMART ATTACH sweep, no timer). */",
      "  readonly cameraAutoattach?: boolean;",
      "  /** Decision D62: one IPv4 `/24` literal, or null. Required when `cameraAutoattach` is on. */",
      "  readonly cameraSegmentCidr?: string | null;",
      "  /** Decision D62. Default: null (no bench camera user: nothing is auto-adopted). */",
      "  readonly cameraDefaultUser?: string | null;",
      "  /** Decision D62. Default: null (no bench camera password). */",
      "  readonly cameraDefaultPassword?: Secret | null;",
      '  const captureWorkerPath = parseCapturePath(ENV_CAPTURE_WORKER, input.captureWorkerPath ?? undefined);',
      '  const mediaStoreDir = parseCapturePath(ENV_MEDIA_DIR, input.mediaStoreDir ?? undefined) ?? `${input.dataDir}/${MEDIA_STORE_SUBPATH}`;',
      '  const captureHelperFfmpegPath = parseCapturePath(ENV_CAPTURE_HELPER_FFMPEG, input.captureHelperFfmpegPath ?? undefined);',
      "  // Decision D62 (2026-11-05): a sweep that is on without its segment is refused HERE, at the one",
      "  // place that builds a configuration: no half-wired timer can start. Off is always whole: no CIDR needed.",
      "  const cameraAutoattach = input.cameraAutoattach ?? false;",
      "  const cameraSegmentCidr = parseCameraSegmentCidr(input.cameraSegmentCidr ?? undefined);",
      "  if (cameraAutoattach && cameraSegmentCidr === null) {",
      "    throw new ConfigError('CAMERA_SEGMENT_CIDR_REQUIRED', `${ENV_CAMERA_SEGMENT_CIDR} must hold one IPv4 /24 literal while ${ENV_CAMERA_AUTOATTACH} is on.`);",
      "  }",
      '    lcdBackendUrl: parseLcdBackendUrl(input.lcdBackendUrl ?? undefined),',
      '    captureMode: input.captureMode ?? DEFAULT_CAPTURE_MODE,',
      '    captureWorkerPath,',
      '    mediaStoreDir,',
      '    captureDevSources: input.captureDevSources ?? false,',
      '    captureHelperFfmpegPath,',
      "    captureDevFakeMic: input.captureDevFakeMic ?? 'tone',",
      '    installationDeviceId: parseInstallationDeviceId(input.installationDeviceId ?? undefined),',
      '    installationName: parseInstallationName(input.installationName ?? undefined),',
      '    captureRelayPath: parseCapturePath(ENV_CAPTURE_RELAY, input.captureRelayPath ?? undefined),',
      '    captureGuardPath: parseCapturePath(ENV_CAPTURE_GUARD, input.captureGuardPath ?? undefined),',
      '    captureAliasSocketPath: parseCapturePath(ENV_CAPTURE_ALIAS_SOCKET, input.captureAliasSocketPath ?? undefined),',
      '    captureAudioHelperPath: parseCapturePath(ENV_CAPTURE_AUDIO_HELPER, input.captureAudioHelperPath ?? undefined),',
      "    // Decision D62 (2026-11-05): SMART ATTACH. Off by default; the segment is re-read through its pattern here, so no caller can smuggle another form in.",
      "    cameraAutoattach,",
      "    cameraSegmentCidr,",
      "    cameraDefaultUser: parseCameraDefaultUser(input.cameraDefaultUser ?? undefined),",
      "    cameraDefaultPassword: input.cameraDefaultPassword ?? null,",
      '/** LCD integration, user request 2026-10-19: host-only HTTP service, no redirects or remote hosts. */',
      'export function parseLcdBackendUrl(raw: string | undefined): string | null {',
      "  if (raw === undefined || raw === '') return null;",
      '  const matched = /^http:\\/\\/127\\.0\\.0\\.1:([0-9]{1,5})\\/?$/.exec(raw);',
      '  const port = Number(matched?.[1]);',
      '  if (matched === null || port < 1 || port > 65_535) {',
      "    throw new ConfigError('LCD_BACKEND_URL_INVALID', 'DEMS_LCD_BACKEND_URL must be http://127.0.0.1:<port> with a valid port.');",
      '  }',
      '  return `http://127.0.0.1:${port}`;',
      '}',
      '',
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
    expect(current.filter((line) => line.startsWith('export const ENV_')).slice(-16)).toEqual([
      "export const ENV_CAPTURE_MODE = 'DEMS_CAPTURE_MODE';",
      "export const ENV_CAPTURE_WORKER = 'DEMS_CAPTURE_WORKER';",
      "export const ENV_MEDIA_DIR = 'DEMS_MEDIA_DIR';",
      "export const ENV_CAPTURE_DEV_SOURCES = 'DEMS_CAPTURE_DEV_SOURCES';",
      "export const ENV_CAPTURE_HELPER_FFMPEG = 'DEMS_CAPTURE_HELPER_FFMPEG';",
      "export const ENV_CAPTURE_DEV_FAKE_MIC = 'DEMS_CAPTURE_DEV_FAKE_MIC';",
      // Wave H closing pass Z1 (decision D207): the two keys of the installation identity (pin 6 -> 8).
      "export const ENV_INSTALLATION_DEVICE_ID = 'DEMS_INSTALLATION_DEVICE_ID';",
      "export const ENV_INSTALLATION_NAME = 'DEMS_INSTALLATION_NAME';",
      // Task 4 row 21 (WP-02): the relay and guard paths of production capture (pin 8 -> 10).
      "export const ENV_CAPTURE_RELAY = 'DEMS_CAPTURE_RELAY';",
      "export const ENV_CAPTURE_GUARD = 'DEMS_CAPTURE_GUARD';",
      // Task 4 row 105 (WP-19b): the socket of the address helper (pin 10 -> 11).
      "export const ENV_CAPTURE_ALIAS_SOCKET = 'DEMS_CAPTURE_ALIAS_SOCKET';",
      // Task 4 row 85c (decision C60 (3)): the audio helper of production capture (pin 11 -> 12).
      "export const ENV_CAPTURE_AUDIO_HELPER = 'DEMS_CAPTURE_AUDIO_HELPER';",
      // Decision D62 (2026-11-05): the four SMART ATTACH keys, last in the file, inside the widened window.
"export const ENV_CAMERA_AUTOATTACH = 'DEMS_CAMERA_AUTOATTACH';",
"export const ENV_CAMERA_SEGMENT_CIDR = 'DEMS_CAMERA_SEGMENT_CIDR';",
"export const ENV_CAMERA_DEFAULT_USER = 'DEMS_CAMERA_DEFAULT_USER';",
"export const ENV_CAMERA_DEFAULT_PASSWORD = 'DEMS_CAMERA_DEFAULT_PASSWORD';",
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
  /**
   * Task 4 row 66 (WP-08; amended by row 3's decision text SR-4, places 1 to 3): the lists of the Linux microphone table.
   * A card with two inputs, an interface with eight (input 3), and the pre-check. The count of all lists moves by this delta.
   */
  const linuxLists: readonly (readonly string[])[] = [
    linuxMicPushArguments({ cardIndex: 1, deviceIndex: 0, channelCount: 2, inputNumber: 2, pipePath: PIPE }),
    linuxMicPushArguments({ cardIndex: 2, deviceIndex: 0, channelCount: 8, inputNumber: 3, pipePath: PIPE }),
    linuxMicPrecheckArguments({ cardIndex: 2, deviceIndex: 0, channelCount: 8 }),
  ];
  const literals = new Set<string>([...CAMERA_HELPER_TABLE.literals, ...MIC_HELPER_TABLE.literals]);
  /** The literals of the Linux table are its own: they are not lent to the lists above (its channel counts are 64 words). */
  const linuxLiterals = new Set<string>(MIC_LINUX_HELPER_TABLE.literals);
  /** The computed values (spec §A.6.4 HL-3): the plan's listener, the two forms of `S`, the pipe, and the device named exactly. */
  const computed = new Set<string>([INGEST, PIPE, `-${(START_MS / 1000).toFixed(3)}`, String(START_MS * 1000), `${LOCAL_CAMERA_DEVICE_NAME}:none`, `none:${LOCAL_MIC_DEVICE_NAME}`]);
  /** SR-4 (2): the ONE kind of argument that may hold a vertical bar, the channel selection made by one table function from an integer 0 to 63. */
  const CHANNEL_SELECTIONS = new Set<string>(Array.from({ length: 64 }, (_unused, index) => linuxChannelSelection(index)));
  /** SR-4 (3): the device argument of the Linux table, made by one table function from two integers (card index, device index), 0 to 31 each. */
  const LINUX_DEVICES = new Set<string>(Array.from({ length: 32 * 32 }, (_unused, index) => linuxMicDeviceArgument(Math.floor(index / 32), index % 32)));
  /** SR-4 (1): five formats become six, `alsa` the sixth. */
  const FORMATS = ['avfoundation', 'lavfi', join('rt', 'sp'), 'f32le', 'null', 'alsa'];
  const FORBIDDEN = new RegExp(['0\\.0\\.0\\.0', '::', '\\budp\\b', 'listen', '@', '[;&|`$<>\\\\]', 'movie=', 'capture screen', 'desk view'].join('|'), 'i');
  const LOOPBACK = new RegExp(`^${join('rt', 'sp')}://127\\.0\\.0\\.1:\\d{4,5}/[A-Za-z0-9/_-]+$`);

  /**
   * The rule over one argument list. `linux` says the list is of the Linux microphone table: only then is a channel
   * selection admitted (after `-af`, once) and a device of two integers (after `-i`). In such an argument every other
   * forbidden mark stays forbidden: the selection is tested again with its bars taken out.
   */
  const violations = (args: readonly string[], linux = false): string[] => {
    const selection = (arg: string, index: number): boolean => linux && CHANNEL_SELECTIONS.has(arg) && args[index - 1] === '-af';
    const device = (arg: string, index: number): boolean => linux && LINUX_DEVICES.has(arg) && args[index - 1] === '-i';
    const table = linux ? linuxLiterals : literals;
    return [
      ...args.filter((arg, index) => !table.has(arg) && !(linux ? arg === PIPE : computed.has(arg)) && !selection(arg, index) && !device(arg, index)).map((arg) => `not of the table: ${arg}`),
      ...args.filter((arg, index) => FORBIDDEN.test(selection(arg, index) ? arg.replaceAll('|', '') : arg)).map((arg) => `forbidden: ${arg}`),
      ...(args.filter((arg) => arg.includes('|')).length > 1 ? ['more than one argument holds a bar'] : []),
      ...args.filter((arg) => arg.includes('://') && !LOOPBACK.test(arg)).map((arg) => `not the loopback listener: ${arg}`),
      ...args.flatMap((arg, index) => (arg === '-f' && !FORMATS.includes(args[index + 1] ?? '') ? [`format: ${args[index + 1] ?? ''}`] : [])),
    ];
  };

  it('finds a wildcard address, a datagram transport, a listen flag, a user part, a shell mark, a file filter, another format and a screen capture (control)', () => {
    const planted = ['-f', 'x11grab', '-i', 'Capture screen 0:none', '-i', `a${'movie'}=/etc/hosts`, '-listen', '1', 'udp://0.0.0.0:9000', `${join('rt', 'sp')}://user:pw@127.0.0.1:8555/x`, `${join('rt', 'sp')}://10.0.0.9:8555/live`, 'x; rm -rf /'];
    const found = violations(planted);
    for (const text of ['format: x11grab', 'forbidden: Capture screen 0:none', `forbidden: a${'movie'}=/etc/hosts`, 'forbidden: -listen', 'forbidden: udp://0.0.0.0:9000', `forbidden: ${join('rt', 'sp')}://user:pw@127.0.0.1:8555/x`, `not the loopback listener: ${join('rt', 'sp')}://10.0.0.9:8555/live`, 'forbidden: x; rm -rf /']) expect(found, text).toContain(text);
    // A value that is neither of the table nor computed is seen even when it looks harmless.
    expect(violations([...(lists[0] ?? []), '-shortest'])).toEqual(['not of the table: -shortest']);
  });

  it('every argument of every helper is a literal of its table or a computed value; none is forbidden; every address is the loopback listener', () => {
    // Ten lists before task 4; row 66 (SR-4) adds the three of the Linux microphone table: thirteen.
    expect(lists).toHaveLength(10);
    expect([...lists, ...linuxLists]).toHaveLength(13);
    for (const args of lists) expect(violations(args), args.join(' ')).toEqual([]);
    for (const args of linuxLists) expect(violations(args, true), args.join(' ')).toEqual([]);
    // SEC35-43 (e): the inputs are the two devices by exact name and the generated ones of the table, and nothing else.
    const inputs = new Set(lists.flatMap((args) => args.flatMap((arg, index) => (arg === '-i' ? [args[index + 1] ?? ''] : []))));
    expect([...inputs].filter((input) => !literals.has(input) && input !== `${LOCAL_CAMERA_DEVICE_NAME}:none` && input !== `none:${LOCAL_MIC_DEVICE_NAME}`)).toEqual([]);
  });

  // Task 4 row 66: G-R12 as amended by row 3's decision text SR-4 (places 1 to 3) with the sentence of AD-07 (2). Kept: every rule above.
  it('SR-4: the bar is admitted in the one channel selection of a Linux list and nowhere else; the Linux device is two integers; a card named by text is seen (control)', () => {
    const [duo, octo, precheck] = linuxLists;
    // (1) the format, (2) the one bar argument, (3) the device argument, as text.
    // Task 4 row 79b (decision C89): this pin moves by TWO words per list and nothing else - `-channels <n>` is now
    // `-ch_layout <n>C`. Reason: the pinned FFmpeg 9.0.2 has no option `channels` (refused 18 of 18 in the Ubuntu
    // 24.04 container, test/079 section 5); its sound-device input takes the layout word. The rule is unchanged: the
    // count is still no computed text but one of 64 words of the table, taken by its number (pinned below).
    expect((duo ?? []).slice((duo ?? []).indexOf('-thread_queue_size'), (duo ?? []).indexOf('-vn'))).toEqual(['-thread_queue_size', '1024', '-f', 'alsa', '-c:a', 'pcm_s24le', '-ch_layout', '2C', '-sample_rate', '48000', '-i', 'dems_1_0', '-af', 'pan=mono|c0=c1']);
    expect((octo ?? []).slice((octo ?? []).indexOf('-thread_queue_size'), (octo ?? []).indexOf('-vn'))).toEqual(['-thread_queue_size', '1024', '-f', 'alsa', '-c:a', 'pcm_s24le', '-ch_layout', '8C', '-sample_rate', '48000', '-i', 'dems_2_0', '-af', 'pan=mono|c0=c2']);
    // Row 79b: the closed set the word comes from - 64 words, `1C` to `64C`, each the word after `-ch_layout` for
    // its count and for no other; outside 1 to 64 nothing is made. No list of any table holds `-channels`.
    expect(MIC_LINUX_HELPER_TABLE.channelLayouts).toEqual(Array.from({ length: 64 }, (_unused, index) => `${String(index + 1)}C`));
    expect(MIC_LINUX_HELPER_TABLE.channelLayouts.filter((word) => !linuxLiterals.has(word) || literals.has(word))).toEqual([]);
    for (let count = 1; count <= 64; count += 1) {
      const list = linuxMicPrecheckArguments({ cardIndex: 0, deviceIndex: 0, channelCount: count });
      expect(list[list.indexOf('-ch_layout') + 1], String(count)).toBe(MIC_LINUX_HELPER_TABLE.channelLayouts[count - 1]);
      expect(violations(list, true), String(count)).toEqual([]);
    }
    for (const outside of [0, 65, -1, 1.5, Number.NaN, '8', '8C']) expect(() => linuxMicPrecheckArguments({ cardIndex: 0, deviceIndex: 0, channelCount: outside as number })).toThrow('a value of the Linux microphone helper is not of its shape');
    expect([...lists, ...linuxLists].filter((args) => args.includes('-channels'))).toEqual([]);
    expect(linuxLists.map((args) => args.filter((arg) => arg.includes('|')))).toEqual([['pan=mono|c0=c1'], ['pan=mono|c0=c2'], []]);
    expect((precheck ?? []).filter((arg) => arg === '-af')).toEqual([]);
    // The selection is of an integer 0 to 63; outside it nothing is made.
    expect([...CHANNEL_SELECTIONS].every((text, index) => text === `pan=mono|c0=c${String(index)}`)).toBe(true);
    for (const outside of [-1, 64, 1.5, Number.NaN]) expect(() => linuxChannelSelection(outside)).toThrow('a value of the Linux microphone helper is not of its shape');
    // The device is of two integers 0 to 31; text in their place makes nothing.
    expect([...LINUX_DEVICES].every((text) => /^dems_\d{1,2}_\d{1,2}$/.test(text))).toBe(true);
    expect(LINUX_DEVICES.size).toBe(1_024);
    for (const outside of [[32, 0], [0, 32], [-1, 0], ['EVO8', 0], [0, '0']] as const) expect(() => linuxMicDeviceArgument(outside[0] as number, outside[1] as number)).toThrow('a value of the Linux microphone helper is not of its shape');
    // No literal of the Linux table holds a bar or names a card.
    expect(MIC_LINUX_HELPER_TABLE.literals.filter((literal) => /[|:=,]|hw|CARD|DEV/.test(literal) && literal !== '-c:a' && literal !== 'pipe:1')).toEqual([]);

    // Controls. The bar stays forbidden in every list that is not of the Linux table, the selection included.
    const local = lists[6] ?? [];
    expect(violations([...local, '-af', 'pan=mono|c0=c1'])).toEqual(['not of the table: -af', 'not of the table: pan=mono|c0=c1', 'forbidden: pan=mono|c0=c1']);
    const swap = (args: readonly string[], from: string, to: string): string[] => args.map((arg) => (arg === from ? to : arg));
    const good = octo ?? [];
    // A selection that mixes, one beyond channel 63, one that is not after `-af`, and a second one.
    expect(violations(swap(good, 'pan=mono|c0=c2', 'pan=mono|c0=c2+c3'), true)).toEqual(['not of the table: pan=mono|c0=c2+c3', 'forbidden: pan=mono|c0=c2+c3']);
    expect(violations(swap(good, 'pan=mono|c0=c2', 'pan=mono|c0=c64'), true)).toEqual(['not of the table: pan=mono|c0=c64', 'forbidden: pan=mono|c0=c64']);
    expect(violations([...good, 'pan=mono|c0=c2'], true)).toEqual(['not of the table: pan=mono|c0=c2', 'forbidden: pan=mono|c0=c2', 'more than one argument holds a bar']);
    // A device made of a card name, of a descriptor, or of the hardware directly; a count that is no word of the table.
    expect(violations(swap(good, 'dems_2_0', 'dems_EVO8_0'), true)).toEqual(['not of the table: dems_EVO8_0']);
    expect(violations(swap(good, 'dems_2_0', 'hw:CARD=EVO8,DEV=0'), true)).toEqual(['not of the table: hw:CARD=EVO8,DEV=0']);
    expect(violations(swap(good, 'dems_2_0', 'dems_2_0|x'), true)).toEqual(['not of the table: dems_2_0|x', 'forbidden: dems_2_0|x', 'more than one argument holds a bar']);
    expect(violations(swap(good, '8C', '65C'), true)).toEqual(['not of the table: 65C']);
    // Row 79b (controls): the refused word of the row before C89, a bare count in the layout's place, the small-c
    // spelling (a default layout: another meaning, and no word for most counts) and a named layout are each seen.
    expect(violations(swap(good, '-ch_layout', '-channels'), true)).toEqual(['not of the table: -channels']);
    expect(violations(swap(good, '8C', '8'), true)).toEqual(['not of the table: 8']);
    expect(violations(swap(good, '8C', '8c'), true)).toEqual(['not of the table: 8c']);
    expect(violations(swap(good, '8C', '7.1'), true)).toEqual(['not of the table: 7.1']);
    // Every other mark stays forbidden in a Linux list too, and a format outside the six is seen.
    expect(violations([...good, 'x; rm -rf /'], true)).toEqual(['not of the table: x; rm -rf /', 'forbidden: x; rm -rf /']);
    expect(violations(swap(good, 'alsa', 'pulse'), true)).toEqual(['not of the table: pulse', 'format: pulse']);
    // The 64 channel counts of the Linux table are not literals of the other lists (row 79b: nor are its 64 layout words).
    expect(violations([...(lists[0] ?? []), '64'])).toEqual(['not of the table: 64']);
    expect(violations([...(lists[0] ?? []), '64C'])).toEqual(['not of the table: 64C']);
    // The Linux table lives in the file of the microphone tables, and `alsa` is named by no other file of the folder.
    expect(places(capture, /'alsa'/g)).toEqual([`${LOCAL}mic-helper-args.ts`]);
  });

  // Task 4 row 67 (its request of batch 7, served in batch 8): G-R12 as amended by SR-4, place 3 with AD-07 (2), held at the ONE caller of the
  // Linux table - "the two integers are read from the live listing; no text of it is passed on". Additive: no rule above is changed.
  it('SR-4 at the production microphone adapter: each table function is called once, with integers of the live listing and the stored input number only; the guard\'s vector is the helper path and a list of the table, unchanged', () => {
    const PRODUCTION_MIC = 'src/capture/adapters/audio/usb-audio-production.ts';
    const adapter = (capture.find((file) => file.path === PRODUCTION_MIC)?.text ?? '').replace(/\s+/g, ' ');
    const membersOf = (call: string): string[] => (new RegExp(`\\b${call}\\(\\{([^}]*)\\}\\)`).exec(adapter)?.[1] ?? '').split(',').map((part) => part.trim()).filter((part) => part !== '');
    // (a) One call each; the members are numbers of the located card, the stored input NUMBER, the pipe the adapter made and the registry id. No name, no USB id, no descriptor.
    expect(adapter.match(/\blinuxMicPushArguments\s*\(/g)).toHaveLength(1);
    expect(adapter.match(/\blinuxMicPrecheckArguments\s*\(/g)).toHaveLength(1);
    expect(membersOf('linuxMicPushArguments')).toEqual(['cardIndex: located.card.cardIndex', 'deviceIndex: located.card.deviceIndex', 'channelCount: located.card.channelCount', 'inputNumber: located.stored.inputNumber', 'pipePath', 'deviceId: inputId']);
    expect(membersOf('linuxMicPrecheckArguments')).toEqual(['cardIndex: located.card.cardIndex', 'deviceIndex: located.card.deviceIndex', 'channelCount: located.card.channelCount']);
    // (b) The door is called at three places: the pipe maker's own short list, the guarded push list, the guarded pre-check list.
    expect(adapter.match(/\bdoor\(\{[^}]*\}\)/g)).toEqual([
      'door({ command: asked.command, args: asked.args, env: environment, message: null, timers })',
      'door({ command: guardProgram, args: guardedArguments(helperProgram, helperArguments), env: environment, message: null, timers, onOutput: (chunk) => watch.push(chunk) })',
      'door({ command: guardProgram, args, env: environment, message: null, timers })',
    ]);
    expect(adapter.match(/\bawait runShort\([^;]*;/g)).toEqual(['await runShort(inputId, guardedArguments(helperProgram, args), config.environment, signal);']);
    expect(adapter.match(/\b(?:helperArguments|args) = [^;]*;/g)?.map((text) => text.slice(0, text.indexOf('(')))).toEqual(['helperArguments = linuxMicPushArguments', 'args = linuxMicPrecheckArguments']);
    // (c) The guard's vector: the configured helper path, then a list of the Linux table UNCHANGED. Nothing is added, joined or rewritten on the way.
    expect(adapter).toContain('export function guardedArguments(helperProgram: string, helperArguments: readonly string[]): readonly string[] { return Object.freeze([helperProgram, ...helperArguments]); }');
    expect(adapter.match(/\bguardedArguments\([^)]*\)/g)).toEqual(['guardedArguments(helperProgram: string, helperArguments: readonly string[])', 'guardedArguments(helperProgram, helperArguments)', 'guardedArguments(helperProgram, args)']);
    // Control: a descriptor string or a card id in a member, and a list that was touched, are seen by the same patterns.
    const planted = 'helperArguments = linuxMicPushArguments({ cardIndex: located.card.cardIndex, deviceIndex: located.card.deviceIndex, channelCount: located.card.channelCount, inputNumber: located.stored.inputNumber, pipePath, deviceId: located.card.cardId, }); door({ command: guardProgram, args: [helperProgram, ...helperArguments, located.card.name], env: environment, message: null, timers })';
    expect(/\blinuxMicPushArguments\(\{([^}]*)\}\)/.exec(planted)?.[1]).toContain('deviceId: located.card.cardId');
    expect(planted.match(/\bdoor\(\{[^}]*\}\)/g)).toEqual(['door({ command: guardProgram, args: [helperProgram, ...helperArguments, located.card.name], env: environment, message: null, timers })']);
  });

  // Task 4 row 85c (decision C60 (3)): the runner of the card listing program. G-R12 / SR-4 "no argument from data", held at the row of
  // the table and at its ONE caller. Additive: no rule above is changed; the count of all lists moves by this delta (13 -> 14).
  it('row 85c: the card listing row is FIXED - one program literal, one argument literal, no parameter; its one caller hands it to the production door unchanged, with an empty environment and no start message', () => {
    const TABLE_FILE = `${LOCAL}mic-helper-args.ts`;
    const PARTS = 'src/capture/fence/production-parts.ts';
    const flat = (path: string): string => (production.find((file) => file.path === path)?.text ?? '').replace(/\s+/g, ' ');
    const row = linuxCardListingArguments();
    expect([...lists, ...linuxLists, row]).toHaveLength(14);
    // (a) The row: a literal of its own table, nothing forbidden, no address, no bar; the program an absolute literal.
    expect(row).toEqual(['-l']);
    expect([...CARD_LISTING_HELPER_TABLE.literals]).toEqual(['-l']);
    expect(row.filter((arg) => !CARD_LISTING_HELPER_TABLE.literals.includes(arg) || FORBIDDEN.test(arg) || arg.includes('://'))).toEqual([]);
    expect(CARD_LISTING_HELPER_TABLE.program).toBe('/usr/bin/arecord');
    expect(places(capture, /'\/usr\/bin\/arecord'/g)).toEqual([TABLE_FILE]);
    // (b) The table function has NO parameter and builds nothing: it answers the literals.
    expect(flat(TABLE_FILE)).toContain("const LINUX_CARD_LISTING = ['-l'] as const;");
    expect(flat(TABLE_FILE)).toContain('export function linuxCardListingArguments(): readonly string[] { return Object.freeze([...LINUX_CARD_LISTING]); }');
    expect(linuxCardListingArguments.length).toBe(0);
    // (c) ONE caller in the product, and its one door call: the program, the table's row as it is, an empty environment, no message.
    expect(places(production, /\blinuxCardListingArguments\s*\(/g)).toEqual([TABLE_FILE, PARTS]);
    expect(flat(PARTS).match(/\blinuxCardListingArguments\s*\([^)]*\)/g)).toEqual(['linuxCardListingArguments()']);
    expect(flat(PARTS).match(/\bparts\.door\([^;]*;/g)).toEqual(['parts.door({ command: program, args: linuxCardListingArguments(), env: {}, message: null, timers: parts.timers });']);
    expect(flat(PARTS)).toContain('const program = parts.program ?? LINUX_CARD_LISTING_PROGRAM;');
    // (d) No production file hands the runner another program: the override is a test's. The composition names the platform, the door and the timers.
    expect(places(production, /\b(?:cardListingProgramsOf|hostCardEnumeratorOf)\s*\(/g)).toEqual(['src/capture-composition.ts', PARTS]);
    // Row N7 (decision C123) moved the literal by ONE member: the configured audio helper, read by the fence on `darwin` only (case "row N7").
    expect(flat('src/capture-composition.ts').match(/\b(?:cardListingProgramsOf|hostCardEnumeratorOf)\s*\([^)]*\)/g)).toEqual(['hostCardEnumeratorOf({ platform: input.platform, door, timers, helperProgram: ports.audioHelperProgram })']);
    expect(flat(PARTS).match(/\bcardListingProgramsOf\s*\([^)]*\)/g)).toEqual(['cardListingProgramsOf(parts: CardListingRunnerParts)', 'cardListingProgramsOf(host)']);
    // The fence file starts nothing itself and imports no process module (G-R2 and G-R8 are unchanged: their lists did not grow).
    expect([...flat(PARTS).matchAll(PROCESS_START)]).toEqual([]);
    expect([...flat(PARTS).matchAll(PROCESS_MODULE)]).toEqual([]);
    // Controls: an argument from data, a second argument, and a program handed in by a product file are seen by the same patterns.
    const planted = 'parts.door({ command: program, args: [...linuxCardListingArguments(), String(cardIndex)], env: {}, message: null, timers: parts.timers }); hostCardEnumeratorOf({ platform: input.platform, door, timers, program: config.captureHelperFfmpegPath })';
    expect(planted.match(/\bparts\.door\([^;]*;/g)).not.toEqual(['parts.door({ command: program, args: linuxCardListingArguments(), env: {}, message: null, timers: parts.timers });']);
    expect(planted.match(/\b(?:cardListingProgramsOf|hostCardEnumeratorOf)\s*\([^)]*\)/g)).toEqual(['hostCardEnumeratorOf({ platform: input.platform, door, timers, program: config.captureHelperFfmpegPath })']);
    expect(['-l', 'hw:CARD=EVO8'].filter((arg) => !CARD_LISTING_HELPER_TABLE.literals.includes(arg))).toEqual(['hw:CARD=EVO8']);
  });

  // Task 4 row 111b (decisions C78, C87): the two commissioning rows - the neighbour table and the echo. G-R12 / SR-4 "no argument from
  // data" is held as for the Linux microphone table: every argument is a literal of its row, except ONE value made by ONE table function
  // from INTEGERS - here THE ADDRESS, four integers 0 to 255 of a private range with a host part 1 to 254, the form the address helper's
  // request line is made in. This is a NEW PLACE of the rule (a network address that is not the loopback listener becomes an argument):
  // PROPOSED NAMED AMENDMENT SR-12, put to the controller by the row's record. Additive: no rule above is changed; the count of all
  // lists moves by this delta (14 -> 16).
  it('row 111b: the two commissioning rows are FIXED but for ONE address made from four integers by the table; no row names an interface; their one caller hands each to the production door unchanged, with the address THE DESTINATION RULE returned, on linux only', () => {
    const TABLE_FILE = `${LOCAL}mic-helper-args.ts`;
    const PARTS = 'src/capture/fence/production-parts.ts';
    const COMPOSING = 'src/capture-composition.ts';
    const flat = (path: string): string => (production.find((file) => file.path === path)?.text ?? '').replace(/\s+/g, ' ');
    const ADDRESS = '192.168.50.21';
    const neighbour = linuxNeighbourArguments(ADDRESS);
    const echo = linuxEchoArguments(ADDRESS);
    expect([...lists, ...linuxLists, linuxCardListingArguments(), neighbour, echo]).toHaveLength(16);
    /** The rule over one commissioning row: its literals in their order, then exactly ONE argument, of the address shape of the table; nothing forbidden. */
    const rowViolations = (args: readonly string[], literals: readonly string[]): string[] => [
      ...(args.length === literals.length + 1 ? [] : [`${String(args.length)} arguments for a row of ${String(literals.length)} literals and one address`]),
      ...args.slice(0, literals.length).filter((arg, index) => arg !== literals[index]).map((arg) => `not the literal of its place: ${arg}`),
      ...args.slice(literals.length).filter((arg) => !COMMISSIONING_HELPER_TABLE.addressArgument.test(arg)).map((arg) => `not an address of the table: ${arg}`),
      ...args.filter((arg) => FORBIDDEN.test(arg) || arg.includes('://') || arg.includes('/')).map((arg) => `forbidden: ${arg}`),
    ];
    // (a) The rows, verbatim; each program an absolute literal, named by the table file alone.
    expect([COMMISSIONING_HELPER_TABLE.neighbour.program, ...neighbour]).toEqual(['/usr/sbin/ip', '-4', 'neigh', 'show', 'to', ADDRESS]);
    expect([COMMISSIONING_HELPER_TABLE.echo.program, ...echo]).toEqual(['/usr/bin/ping', '-n', '-q', '-c', '1', '-W', '1', ADDRESS]);
    expect(rowViolations(neighbour, COMMISSIONING_HELPER_TABLE.neighbour.literals)).toEqual([]);
    expect(rowViolations(echo, COMMISSIONING_HELPER_TABLE.echo.literals)).toEqual([]);
    expect(places(capture, /'\/usr\/sbin\/ip'/g)).toEqual([TABLE_FILE]);
    expect(places(capture, /'\/usr\/bin\/ping'/g)).toEqual([TABLE_FILE]);
    // No row names an interface, a source, a count from data or a second address: the literals are these and no other.
    expect(flat(TABLE_FILE)).toContain("const LINUX_NEIGHBOUR = ['-4', 'neigh', 'show', 'to'] as const;");
    expect(flat(TABLE_FILE)).toContain("const LINUX_ECHO = ['-n', '-q', '-c', '1', '-W', '1'] as const;");
    expect([...COMMISSIONING_HELPER_TABLE.neighbour.literals, ...COMMISSIONING_HELPER_TABLE.echo.literals].filter((literal) => /^(?:dev|-I|-S|-s|-p|-f|-i|-b|-B|-m|-t|-M|flush|add|del|replace|change)$/.test(literal))).toEqual([]);
    // (b) Each table function takes ONE parameter and joins nothing: its literals, then what the ONE address function made.
    expect(flat(TABLE_FILE)).toContain('export function linuxNeighbourArguments(address: string): readonly string[] { return Object.freeze([...LINUX_NEIGHBOUR, commissioningAddressArgument(address)]); }');
    expect(flat(TABLE_FILE)).toContain('export function linuxEchoArguments(address: string): readonly string[] { return Object.freeze([...LINUX_ECHO, commissioningAddressArgument(address)]); }');
    expect([linuxNeighbourArguments.length, linuxEchoArguments.length, commissioningAddressArgument.length]).toEqual([1, 1, 1]);
    // The address function answers a text it WROTE from four numbers - never its parameter.
    expect(flat(TABLE_FILE)).toContain('return `${String(a)}.${String(b)}.${String(c)}.${String(d)}`; }');
    expect(flat(TABLE_FILE).match(/\bcommissioningAddressArgument\s*\(/g)).toHaveLength(3);
    for (const outside of ['8.8.8.8', '127.0.0.1', '192.168.50.0', '192.168.50.255', '192.168.050.21', '192.168.50.21/24', '-I', 'eth1', 'camera.local', '192.168.50.21 -f']) {
      expect(() => linuxNeighbourArguments(outside), outside).toThrow('an address of a commissioning row is not of its shape');
      expect(() => linuxEchoArguments(outside), outside).toThrow('an address of a commissioning row is not of its shape');
    }
    // (c) ONE caller in the product, and its two door calls: the program, the table's row made from `target`, an empty environment, no message.
    expect(places(production, /\b(?:linuxNeighbourArguments|linuxEchoArguments|commissioningAddressArgument)\b/g).sort()).toEqual([TABLE_FILE, PARTS].sort());
    expect(flat(PARTS).match(/(?<![.\w])door\(\{[^;]*;/g)).toEqual([
      // Row N7 (decision C123): the runner of the three macOS listing rows - pinned in the SR-15 case "row N7".
      // MOVED BY ROW N5b (decision C131): + the row's own cap per call and the process group of its program.
      'door({ command: program, args, env: {}, message: null, timers, outputCapBytes: capBytes, processGroup: true });',
      'door({ command: neighbourProgram, args: argumentsOf(linuxNeighbourArguments, target), env: {}, message: null, timers: host.timers });',
      'door({ command: echoProgram, args: argumentsOf(linuxEchoArguments, target), env: {}, message: null, timers: host.timers });',
    ]);
    expect(flat(PARTS)).toContain('const neighbourProgram = host.neighbourProgram ?? LINUX_NEIGHBOUR_PROGRAM;');
    expect(flat(PARTS)).toContain('const echoProgram = host.echoProgram ?? LINUX_ECHO_PROGRAM;');
    expect(flat(PARTS)).toContain('const argumentsOf = (make: (address: string) => readonly string[], target: string): readonly string[] => { try { return make(target); } catch { throw new CommissioningInputError(CommissioningInputFailure.ADDRESS_REFUSED); } };');
    // `target` is, at each of its two origins, the address the destination rule RETURNED on the facts of the host now; a refusal throws before the door.
    expect(flat(PARTS).match(/\bconst target = [^;]*;/g)).toEqual(['const target = admitted(purpose, address, signal);', 'const target = admitted(DestinationPurpose.SET_IP, address, signal);']);
    expect(flat(PARTS)).toContain('const decision = decideDestination({ purpose, address }, facts ?? HOST_NOT_CONFIGURED); if (!decision.allowed) throw new CommissioningInputError(CommissioningInputFailure.ADDRESS_REFUSED); return decision.destination.address;');
    expect(flat(PARTS).match(/\b(?:readNeighbour|echoed)\((?!target\b)[^)]*\)/g)).toBeNull();
    // The platform seam: off linux the function answers null before it reads a door, a program or a bound.
    expect(flat(PARTS)).toContain("export const COMMISSIONING_INPUTS_PLATFORM = 'linux';");
    expect(flat(PARTS)).toContain('export function hostCommissioningInputsOf(host: CommissioningHostParts): CommissioningHostInputs | null { if (host.platform !== COMMISSIONING_INPUTS_PLATFORM) return null; const door = host.door ?? startProductionProcess;');
    // (d) No production file hands the function a door, a program or a bound: those members are a test's. The composition names the
    // platform, the timers, the facts reader and the stored interface; its seam member is named by the composing file alone.
    expect(places(production, /\bhostCommissioningInputsOf\s*\(/g).sort()).toEqual([COMPOSING, PARTS].sort());
    expect(flat(COMPOSING).match(/\bhostCommissioningInputsOf\s*\(\{[^}]*\}\)/g)).toEqual(['hostCommissioningInputsOf({ platform: input.platform, timers, network, cameraInterface: () => stored.storedInterface() })']);
    expect(places(production, /\bcommissioningInputs\b/g)).toEqual([COMPOSING]);
    expect(places(production, /\b(?:neighbourProgram|echoProgram|neighbourBoundMs|echoBoundMs)\b/g)).toEqual([PARTS]);
    // The fence file starts nothing itself and imports no process module (G-R2 and G-R8 are unchanged: their lists did not grow).
    expect([...flat(PARTS).matchAll(PROCESS_START)]).toEqual([]);
    expect([...flat(PARTS).matchAll(PROCESS_MODULE)]).toEqual([]);

    // Controls: each is seen by the same rule or pattern.
    // An interface, a second address, a text in the place of the address, a prefix, an option after the address, a public address.
    expect(rowViolations(['-4', 'neigh', 'show', 'to', ADDRESS, 'dev', 'eth1'], COMMISSIONING_HELPER_TABLE.neighbour.literals)).toEqual(['7 arguments for a row of 4 literals and one address', 'not an address of the table: dev', 'not an address of the table: eth1']);
    expect(rowViolations(['-n', '-q', '-c', '1', '-W', '1', '-I', 'eth1', ADDRESS], COMMISSIONING_HELPER_TABLE.echo.literals)).toEqual(['9 arguments for a row of 6 literals and one address', 'not an address of the table: -I', 'not an address of the table: eth1']);
    expect(rowViolations(['-n', '-q', '-c', '5', '-W', '1', ADDRESS], COMMISSIONING_HELPER_TABLE.echo.literals)).toEqual(['not the literal of its place: 5']);
    expect(rowViolations(['-4', 'neigh', 'show', 'to', 'camera.local'], COMMISSIONING_HELPER_TABLE.neighbour.literals)).toEqual(['not an address of the table: camera.local']);
    expect(rowViolations(['-4', 'neigh', 'show', 'to', `${ADDRESS}/24`], COMMISSIONING_HELPER_TABLE.neighbour.literals)).toEqual([`not an address of the table: ${ADDRESS}/24`, `forbidden: ${ADDRESS}/24`]);
    expect(rowViolations(['-4', 'neigh', 'show', 'to', '8.8.8.8'], COMMISSIONING_HELPER_TABLE.neighbour.literals)).toEqual(['not an address of the table: 8.8.8.8']);
    expect(rowViolations(['-4', 'neigh', 'show', 'to', '127.0.0.1'], COMMISSIONING_HELPER_TABLE.neighbour.literals)).toEqual(['not an address of the table: 127.0.0.1']);
    expect(rowViolations(['-4', 'neigh', 'flush', 'to', ADDRESS], COMMISSIONING_HELPER_TABLE.neighbour.literals)).toEqual(['not the literal of its place: flush']);
    // A door call whose argument is the caller's text, one with an added argument, and a composition that hands in a program, are not the pinned texts.
    const planted = 'const running = door({ command: neighbourProgram, args: [...linuxNeighbourArguments(target), "dev", cameraInterface], env: {}, message: null, timers: host.timers }); const other = door({ command: echoProgram, args: argumentsOf(linuxEchoArguments, address), env: {}, message: null, timers: host.timers }); const target = address; hostCommissioningInputsOf({ platform: input.platform, timers, network, cameraInterface: () => stored.storedInterface(), echoProgram: app.config.captureHelperFfmpegPath })';
    expect(planted.match(/(?<![.\w])door\(\{[^;]*;/g)).toEqual([
      'door({ command: neighbourProgram, args: [...linuxNeighbourArguments(target), "dev", cameraInterface], env: {}, message: null, timers: host.timers });',
      'door({ command: echoProgram, args: argumentsOf(linuxEchoArguments, address), env: {}, message: null, timers: host.timers });',
    ]);
    expect(planted.match(/\bconst target = [^;]*;/g)).toEqual(['const target = address;']);
    expect(planted.match(/\bhostCommissioningInputsOf\s*\(\{[^}]*\}\)/g)).toEqual(['hostCommissioningInputsOf({ platform: input.platform, timers, network, cameraInterface: () => stored.storedInterface(), echoProgram: app.config.captureHelperFfmpegPath })']);
    expect('await readNeighbour(address, cameraInterface, signal); await echoed(typed, signal);'.match(/\b(?:readNeighbour|echoed)\((?!target\b)[^)]*\)/g)).toEqual(['readNeighbour(address, cameraInterface, signal)', 'echoed(typed, signal)']);
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

// Task 4 row N4 (wave 12). NAMED AMENDMENT SR-15 of rule G-R12 as amended by SR-4 and SR-12, in its FINAL WORDS
// (verification/08b section 8; decision C110; design masterplan/06 revision 3, sections 4.3.1 and 4.3.2). It is for the
// production microphone of kind `USB_AUDIO` on `darwin`, in a KIND OF LIST OF ITS OWN - neither a development list nor a
// Linux list. ADDITIVE: no rule above is changed, no pin above moves, and the lists of this block are counted here alone.
//
// (2), (3) THE PUSH LIST AND THE PRE-CHECK LIST ARE WHOLE TEMPLATES, COMPARED WORD FOR WORD. The templates stand below
// in this file's OWN words (not read from the table). Their only computed places are `<D>` the device word, `<S>` the
// selection and `<P>` the pipe. There is no set of admitted words beside the template.
// THE FORBIDDEN LIST stays as a rule of its own (design 4.2a; decision C107: an option that pads, stretches or re-times
// would make the sample count read "100%" by inventing audio). Each of its lines fails a macOS production list WHEREVER
// the word stands, and each line has ITS OWN planted control: the rule ids are pinned, every id has a control, and a
// control must be refused BY ITS OWN LINE (row T2 found rule statements that could be deleted with their self-test
// green). The mutation each line was seen RED on is in implementation/n4_mic_table_and_rule.md.
describe('SR-15 (named amendment of G-R12; decision C110): the macOS production microphone lists are whole templates with three computed places; the forbidden list holds wherever a word stands', () => {
  const TABLE_FILE = 'src/capture/adapters/local/mic-helper-args.ts';
  const flat = (path: string): string => (production.find((file) => file.path === path)?.text ?? '').replace(/\s+/g, ' ');
  const PIPE_1 = '/data/dems/run/capture/SES-20261009-0001/MIC-01.pcm';
  const PIPE_2 = '/data/dems/run/capture/SES-20261009-0001/MIC-02.pcm';
  type MacKind = 'PUSH' | 'PRECHECK';

  // THE TEMPLATES, one word per position (design 4.3.2): a head of 11 words and one or two sections of 22; 26 words.
  const PUSH_HEAD = '-hide_banner -nostdin -nostats -loglevel info -thread_queue_size 1024 -f avfoundation -i <D>'.split(' ');
  const PUSH_SECTION = '-map 0:a -af <S> -ac 1 -ar 48000 -c:a pcm_f32le -f fifo -fifo_format f32le -drop_pkts_on_overflow 1 -queue_size 32 -format_opts flush_packets=1 -y <P>'.split(' ');
  const PRECHECK = '-hide_banner -nostdin -nostats -loglevel info -f avfoundation -i <D> -t 1 -map 0:a -af <S> -ac 1 -ar 48000 -c:a pcm_f32le -f f32le -flush_packets 1 -'.split(' ');
  /** SR-15 (1): `none:`, then one whole number 0 to 31 in canonical decimal - no sign, no leading zero, no text. */
  const DEVICE_WORD = /^none:(?:[0-9]|[12][0-9]|3[01])$/;
  /** SR-15 (2): one of the 64 words of SR-4 (2). */
  const SELECTION = /^pan=mono\|c0=c(?:[0-9]|[1-5][0-9]|6[0-3])$/;
  const COMPUTED_PLACES = new Map<string, (word: string) => boolean>([
    ['<D>', (word) => DEVICE_WORD.test(word)],
    ['<S>', (word) => SELECTION.test(word)],
    ['<P>', (word) => isMicPipeArgument(word)],
  ]);
  const templateOf = (kind: MacKind, args: readonly string[]): readonly string[] | null => {
    if (kind === 'PRECHECK') return args.length === PRECHECK.length ? PRECHECK : null;
    const sections = (args.length - PUSH_HEAD.length) / PUSH_SECTION.length;
    return sections === 1 || sections === 2 ? [...PUSH_HEAD, ...Array.from({ length: sections }, () => PUSH_SECTION).flat()] : null;
  };
  /** The template rule over one list: the count, every word of its place, and the three rules over the sections. */
  const templateViolations = (kind: MacKind, args: readonly string[]): string[] => {
    const template = templateOf(kind, args);
    if (template === null) return [`${kind}: ${String(args.length)} words are no form of the template`];
    const at = (place: string): string[] => args.filter((_word, index) => template[index] === place);
    const channels = at('<S>').map((word) => Number(word.slice(word.lastIndexOf('c') + 1)));
    return [
      ...template.flatMap((place, index) => ((COMPUTED_PLACES.get(place)?.(args[index] ?? '') ?? args[index] === place) ? [] : [`${kind}: word ${String(index + 1)} is ${args[index] ?? ''} where the template has ${place}`])),
      ...(new Set(at('<S>')).size === at('<S>').length ? [] : [`${kind}: a selection stands twice`]),
      ...(channels.every((channel, index) => index === 0 || !(channel < (channels[index - 1] ?? 0))) ? [] : [`${kind}: the sections do not ascend`]),
      ...(new Set(at('<P>')).size === at('<P>').length ? [] : [`${kind}: a pipe stands twice`]),
    ];
  };

  // THE FORBIDDEN LIST. One line per rule: its id, and what it finds in a list. No line leans on the template.
  const words = (pattern: RegExp) => (args: readonly string[]): string[] => args.filter((arg) => pattern.test(arg));
  /** An option whose value is not the one word of the template: found as `<option> <value>`. */
  const valued = (option: string, only: string) => (args: readonly string[]): string[] => args.flatMap((arg, index) => (arg === option && args[index + 1] !== only ? [`${option} ${args[index + 1] ?? ''}`] : []));
  const twice = (pattern: RegExp, text: string) => (args: readonly string[]): string[] => (args.filter((arg) => pattern.test(arg)).length > 1 ? [text] : []);
  const FORMATS_OF: Record<MacKind, readonly string[]> = { PUSH: ['avfoundation', 'fifo'], PRECHECK: ['avfoundation', 'f32le'] };
  const FORBIDDEN_RULES: readonly (readonly [id: string, found: (args: readonly string[], kind: MacKind) => readonly string[]])[] = [
    ['asetpts', words(/asetpts/i)],
    ['aresample', words(/aresample/i)],
    ['async', words(/^-async(?::|$)|\basync\s*=/i)],
    ['apad', words(/apad/i)],
    ['atempo', words(/atempo/i)],
    ['asetrate', words(/asetrate/i)],
    ['adelay', words(/adelay/i)],
    ['aloop', words(/aloop/i)],
    ['channelsplit', words(/channelsplit/i)],
    ['-use_wallclock_as_timestamps', words(/^-use_wallclock_as_timestamps$/)],
    ['-fflags', words(/^-fflags(?::|$)/)],
    ['-copyts', words(/^-copyts$/)],
    ['-itsoffset', words(/^-itsoffset$/)],
    ['-re', words(/^-re$/)],
    ['-ss', words(/^-ss$/)],
    ['-shortest', words(/^-shortest$/)],
    ['-t in a push list', (args, kind) => (kind === 'PUSH' ? args.filter((arg) => arg === '-t') : [])],
    ['-t of the pre-check', (args, kind) => (kind === 'PRECHECK' ? [...valued('-t', '1')(args), ...twice(/^-t$/, '-t twice')(args)] : [])],
    ['-progress', words(/^-progress$/)],
    ['a filter option in another spelling or from a file', (args) => args.filter((arg) => arg !== '-af' && /^-\/?(?:af|vf|filter|lavfi|filter_complex|filter_script|filter_complex_script)(?::.*)?$/.test(arg))],
    ['a second -af in a section', (args) => args.join('\n').split(/(?:^|\n)-map(?:\n|$)/).filter((section) => section.split('\n').filter((arg) => arg === '-af').length > 1).map(() => '-af twice')],
    ['filter text that is not the one selection', (args) => args.filter((arg, index) => args[index - 1] === '-af' && !SELECTION.test(arg))],
    ['-ch_layout', words(/^-ch_layout$/)],
    ['-channels', words(/^-channels$/)],
    ['-audio_device_index', words(/^-audio_device_index$/)],
    ['-video_device_index', words(/^-video_device_index$/)],
    ['default as a device', words(/^(?:default|[^:]*:default|default:[^:]*)$/i)],
    ['-i that is not none:<n>', (args) => args.flatMap((arg, index) => (arg === '-i' && !DEVICE_WORD.test(args[index + 1] ?? '') ? [`-i ${args[index + 1] ?? ''}`] : []))],
    ['a second -i', twice(/^-i$/, '-i twice')],
    ['-drop_pkts_on_overflow', valued('-drop_pkts_on_overflow', '1')],
    ['-queue_size', valued('-queue_size', '32')],
    ['-fifo_format', valued('-fifo_format', 'f32le')],
    ['-format_opts', valued('-format_opts', 'flush_packets=1')],
    ['-attempt_recovery', words(/^-attempt_recovery$/)],
    ['-max_recovery_attempts', words(/^-max_recovery_attempts$/)],
    ['-recovery_wait_streamtime', words(/^-recovery_wait_streamtime$/)],
    ['-recovery_wait_time', words(/^-recovery_wait_time$/)],
    ['-recover_any_error', words(/^-recover_any_error$/)],
    ['-restart_with_keyframe', words(/^-restart_with_keyframe$/)],
    ['-timeshift', words(/^-timeshift$/)],
    ['-loglevel', valued('-loglevel', 'info')],
    ['-v', words(/^-v$/)],
    ['a second log level', twice(/^-(?:loglevel|v)$/, 'a log level twice')],
    ['a format outside the kind', (args, kind) => args.flatMap((arg, index) => (arg === '-f' && !FORMATS_OF[kind].includes(args[index + 1] ?? '') ? [`-f ${args[index + 1] ?? ''}`] : []))],
  ];
  const forbiddenViolations = (kind: MacKind, args: readonly string[]): string[] => FORBIDDEN_RULES.flatMap(([id, found]) => found(args, kind).map((word) => `forbidden (${id}): ${word}`));
  const macViolations = (kind: MacKind, args: readonly string[]): string[] => [...templateViolations(kind, args), ...forbiddenViolations(kind, args)];

  const one = macMicPushArguments({ audioIndex: 0, channelCount: 6, sections: [{ inputNumber: 1, pipePath: PIPE_1 }] });
  const two = macMicPushArguments({ audioIndex: 0, channelCount: 6, sections: [{ inputNumber: 1, pipePath: PIPE_1 }, { inputNumber: 2, pipePath: PIPE_2 }] });
  const precheck = macMicPrecheckArguments({ audioIndex: 0, channelCount: 6, inputNumber: 1 });
  // Plantings: a word is put where it would ACT.
  const beforeInput = (args: readonly string[], ...planted: string[]): string[] => [...args.slice(0, args.indexOf('-i')), ...planted, ...args.slice(args.indexOf('-i'))];
  const inSection = (args: readonly string[], ...planted: string[]): string[] => [...args.slice(0, args.indexOf('-ac')), ...planted, ...args.slice(args.indexOf('-ac'))];
  const swap = (args: readonly string[], from: string, to: string): string[] => { const index = args.indexOf(from); return args.map((arg, at) => (at === index ? to : arg)); };
  const after = (args: readonly string[], option: string, value: string): string[] => { const index = args.indexOf(option) + 1; return args.map((arg, at) => (at === index ? value : arg)); };
  const inSelection = (args: readonly string[], text: string): string[] => swap(args, 'pan=mono|c0=c0', `pan=mono|c0=c0${text}`);

  it('the two templates, verbatim: 33 words with one section, 55 with two, 26 for the pre-check; the lengths of the table are those', () => {
    expect([...one]).toEqual(['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'info', '-thread_queue_size', '1024', '-f', 'avfoundation', '-i', 'none:0', '-map', '0:a', '-af', 'pan=mono|c0=c0', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'fifo', '-fifo_format', 'f32le', '-drop_pkts_on_overflow', '1', '-queue_size', '32', '-format_opts', 'flush_packets=1', '-y', PIPE_1]);
    expect([...two]).toEqual([...one, '-map', '0:a', '-af', 'pan=mono|c0=c1', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'fifo', '-fifo_format', 'f32le', '-drop_pkts_on_overflow', '1', '-queue_size', '32', '-format_opts', 'flush_packets=1', '-y', PIPE_2]);
    expect([...precheck]).toEqual(['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'info', '-f', 'avfoundation', '-i', 'none:0', '-t', '1', '-map', '0:a', '-af', 'pan=mono|c0=c0', '-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-']);
    expect([one.length, two.length, precheck.length]).toEqual([33, 55, 26]);
    expect([PUSH_HEAD.length, PUSH_SECTION.length, PRECHECK.length]).toEqual([11, 22, 26]);
    expect([MIC_MACOS_HELPER_TABLE.headLength, MIC_MACOS_HELPER_TABLE.sectionLength, MIC_MACOS_HELPER_TABLE.precheckLength, MIC_MACOS_HELPER_TABLE.sectionsMax]).toEqual([11, 22, 26, 2]);
    // The three computed places stand where the template has them and nowhere else: once, once per section, once per section.
    expect([PUSH_HEAD.indexOf('<D>'), PUSH_SECTION.indexOf('<S>'), PUSH_SECTION.indexOf('<P>'), PRECHECK.indexOf('<D>'), PRECHECK.indexOf('<S>')]).toEqual([10, 3, 21, 8, 14]);
    expect([...PUSH_HEAD, ...PUSH_SECTION, ...PRECHECK].filter((word) => word.startsWith('<'))).toEqual(['<D>', '<S>', '<P>', '<D>', '<S>']);
    // Every literal of the table is a word of a template, and every literal word of a template is of the table.
    expect([...MIC_MACOS_HELPER_TABLE.literals].sort()).toEqual([...new Set([...PUSH_HEAD, ...PUSH_SECTION, ...PRECHECK].filter((word) => !word.startsWith('<')))].sort());
  });

  it('SR-15 (1) to (5): EVERY list the table can make equals its template - every device word, every selection, one section and two; none holds a forbidden word', () => {
    // The two closed sets, as text: 32 device words and the 64 selections of SR-4 (2) (the same array as the Linux table).
    expect([...MIC_MACOS_HELPER_TABLE.deviceWords]).toEqual(Array.from({ length: 32 }, (_unused, index) => `none:${String(index)}`));
    expect(MIC_MACOS_HELPER_TABLE.channelSelections).toBe(MIC_LINUX_HELPER_TABLE.channelSelections);
    expect([...MIC_MACOS_HELPER_TABLE.channelSelections]).toEqual(Array.from({ length: 64 }, (_unused, index) => `pan=mono|c0=c${String(index)}`));
    expect(MIC_MACOS_HELPER_TABLE.deviceWords.filter((word) => !DEVICE_WORD.test(word))).toEqual([]);
    expect(MIC_MACOS_HELPER_TABLE.channelSelections.filter((word) => !SELECTION.test(word))).toEqual([]);
    let lists = 0;
    const bad: string[] = [];
    const hold = (kind: MacKind, args: readonly string[], whole: boolean): void => {
      lists += 1;
      const found = whole ? macViolations(kind, args) : templateViolations(kind, args);
      if (found.length > 0 && bad.length < 5) bad.push(`${args.join(' ')} -> ${found.join('; ')}`);
    };
    for (let audioIndex = 0; audioIndex <= 31; audioIndex += 1) {
      for (let first = 1; first <= 64; first += 1) {
        const pushed = macMicPushArguments({ audioIndex, channelCount: 64, sections: [{ inputNumber: first, pipePath: PIPE_1 }] });
        const checked = macMicPrecheckArguments({ audioIndex, channelCount: 64, inputNumber: first });
        // The computed words are the ones of the two numbers, at their places.
        if (pushed[10] !== `none:${String(audioIndex)}` || pushed[14] !== `pan=mono|c0=c${String(first - 1)}` || checked[8] !== pushed[10] || checked[14] !== pushed[14]) bad.push(`computed words of ${String(audioIndex)} / ${String(first)}`);
        hold('PUSH', pushed, true);
        hold('PRECHECK', checked, true);
        // Two sections: every pair, handed in in DESCENDING order - the list states them ascending. The forbidden list runs on every pair of device 0 and 31.
        for (let second = first + 1; second <= 64; second += 1) hold('PUSH', macMicPushArguments({ audioIndex, channelCount: 64, sections: [{ inputNumber: second, pipePath: PIPE_2 }, { inputNumber: first, pipePath: PIPE_1 }] }), audioIndex === 0 || audioIndex === 31);
      }
    }
    expect(bad).toEqual([]);
    expect(lists).toBe(32 * (64 + 64 + (64 * 63) / 2));
    // (3) `-t` stands in the pre-check list and in no other; (4) `fifo` stands in a push section only; (5) one log level, no progress report.
    expect([one, two, precheck].map((args) => args.filter((arg) => arg === '-t').length)).toEqual([0, 0, 1]);
    expect([one, two, precheck].map((args) => args.filter((arg) => arg === 'fifo').length)).toEqual([1, 2, 0]);
    expect([one, two, precheck].map((args) => args.filter((arg) => arg.includes('|')))).toEqual([['pan=mono|c0=c0'], ['pan=mono|c0=c0', 'pan=mono|c0=c1'], ['pan=mono|c0=c0']]);
    // A kind of list of its own: the development table and the Linux table are as they were, and lend nothing but the selection function.
    expect(MIC_HELPER_TABLE.literals.filter((literal) => /^(?:fifo|info|-map|0:a|-af|-fifo_format|-drop_pkts_on_overflow|-queue_size|-format_opts|flush_packets=1|-thread_queue_size)$/.test(literal))).toEqual([]);
    expect(MIC_LINUX_HELPER_TABLE.literals.filter((literal) => /^(?:fifo|info|-map|0:a|avfoundation|-fifo_format|-drop_pkts_on_overflow|-queue_size|-format_opts|flush_packets=1)$/.test(literal))).toEqual([]);
    expect(MIC_MACOS_HELPER_TABLE.literals.filter((literal) => /^(?:warning|-progress|pipe:1|-vn|null|alsa|lavfi|-re|-ch_layout|-sample_rate|-stream_loop)$/.test(literal))).toEqual([]);
  });

  it('the template rule, line by line (controls): a word, the count, a third section, a selection twice, a pipe twice, descending sections, and each computed place', () => {
    expect(templateViolations('PUSH', one)).toEqual([]);
    expect(templateViolations('PUSH', two)).toEqual([]);
    expect(templateViolations('PRECHECK', precheck)).toEqual([]);
    // A word of a place: the log level, the queue's values, the order of two words.
    expect(templateViolations('PUSH', after(one, '-loglevel', 'warning'))).toEqual(['PUSH: word 5 is warning where the template has info']);
    expect(templateViolations('PUSH', after(one, '-drop_pkts_on_overflow', '0'))).toEqual(['PUSH: word 27 is 0 where the template has 1']);
    expect(templateViolations('PRECHECK', after(precheck, '-t', '2'))).toEqual(['PRECHECK: word 11 is 2 where the template has 1']);
    expect(templateViolations('PUSH', [one[0] ?? '', one[2] ?? '', one[1] ?? '', ...one.slice(3)])).toEqual(['PUSH: word 2 is -nostats where the template has -nostdin', 'PUSH: word 3 is -nostdin where the template has -nostats']);
    // The count: a word more, a word less, no section, a THIRD section, a push list in the place of a pre-check.
    expect(templateViolations('PUSH', [...one, '-shortest'])).toEqual(['PUSH: 34 words are no form of the template']);
    expect(templateViolations('PUSH', one.slice(0, -1))).toEqual(['PUSH: 32 words are no form of the template']);
    expect(templateViolations('PUSH', one.slice(0, 11))).toEqual(['PUSH: 11 words are no form of the template']);
    expect(templateViolations('PUSH', [...two, ...two.slice(33).map((arg) => (arg === 'pan=mono|c0=c1' ? 'pan=mono|c0=c2' : arg === PIPE_2 ? PIPE_2.replace('MIC-02', 'MIC-03') : arg))])).toEqual(['PUSH: 77 words are no form of the template']);
    expect(templateViolations('PRECHECK', one)).toEqual(['PRECHECK: 33 words are no form of the template']);
    expect(templateViolations('PRECHECK', precheck.slice(0, -1))).toEqual(['PRECHECK: 25 words are no form of the template']);
    // The sections: the same selection twice, the same pipe twice, descending order.
    expect(templateViolations('PUSH', swap(two, 'pan=mono|c0=c1', 'pan=mono|c0=c0'))).toEqual(['PUSH: a selection stands twice']);
    expect(templateViolations('PUSH', swap(two, PIPE_2, PIPE_1))).toEqual(['PUSH: a pipe stands twice']);
    expect(templateViolations('PUSH', swap(swap(two, 'pan=mono|c0=c0', 'pan=mono|c0=c5'), 'pan=mono|c0=c1', 'pan=mono|c0=c2'))).toEqual(['PUSH: the sections do not ascend']);
    // <D>: the controls of the review's SM-08 (e) - beyond the set, a leading zero, a sign, the video place, a tail, a name, `default`, nothing.
    for (const word of ['none:32', 'none:01', 'none:-1', 'none:+1', '0:none', 'none:1x', 'none:1 ', 'none:', ':0', '0', 'none:USB Audio Interface', 'default', 'none:default', 'none:0:1']) {
      expect(templateViolations('PUSH', swap(one, 'none:0', word)), word).toEqual([`PUSH: word 11 is ${word} where the template has <D>`]);
      expect(templateViolations('PRECHECK', swap(precheck, 'none:0', word)), word).toEqual([`PRECHECK: word 9 is ${word} where the template has <D>`]);
    }
    // <S>: a mix, a channel beyond 63, a second output channel, a gain, filter text after a comma or a semicolon, another filter.
    for (const word of ['pan=mono|c0=c0+c1', 'pan=mono|c0=c64', 'pan=mono|c0=c00', 'pan=stereo|c0=c0|c1=c1', 'pan=mono|c0=0.5*c0', 'pan=mono|c0=c0,apad', 'pan=mono|c0=c0;apad', 'anull', '']) {
      expect(templateViolations('PUSH', swap(one, 'pan=mono|c0=c0', word)), word).toEqual([`PUSH: word 15 is ${word} where the template has <S>`]);
    }
    // <P>: anything that is not a pipe of the transport - a file, a dot-dot path, an address, standard output, an option.
    for (const word of ['/tmp/x.wav', '/data/dems/run/capture/../MIC-01.pcm', 'tcp://127.0.0.1:9000', '-', 'pipe:1', '-shortest']) {
      expect(templateViolations('PUSH', swap(one, PIPE_1, word)), word).toEqual([`PUSH: word 33 is ${word} where the template has <P>`]);
    }
  });

  it('the forbidden list: its ids are pinned, every id has its own control, and every control is refused BY ITS OWN LINE and by the template', () => {
    expect(forbiddenViolations('PUSH', one)).toEqual([]);
    expect(forbiddenViolations('PUSH', two)).toEqual([]);
    expect(forbiddenViolations('PRECHECK', precheck)).toEqual([]);
    // The ids, written out: a rule line that is taken away is missed HERE, and its control below then finds no line that refuses it.
    expect(FORBIDDEN_RULES.map(([id]) => id)).toEqual([
      'asetpts', 'aresample', 'async', 'apad', 'atempo', 'asetrate', 'adelay', 'aloop', 'channelsplit',
      '-use_wallclock_as_timestamps', '-fflags', '-copyts', '-itsoffset', '-re', '-ss', '-shortest', '-t in a push list', '-t of the pre-check', '-progress',
      'a filter option in another spelling or from a file', 'a second -af in a section', 'filter text that is not the one selection',
      '-ch_layout', '-channels', '-audio_device_index', '-video_device_index', 'default as a device', '-i that is not none:<n>', 'a second -i',
      '-drop_pkts_on_overflow', '-queue_size', '-fifo_format', '-format_opts',
      '-attempt_recovery', '-max_recovery_attempts', '-recovery_wait_streamtime', '-recovery_wait_time', '-recover_any_error', '-restart_with_keyframe', '-timeshift',
      '-loglevel', '-v', 'a second log level', 'a format outside the kind',
    ]);
    /** id of the rule line, the kind of list, the planted list, the word the line must name. */
    const CONTROLS: readonly (readonly [id: string, kind: MacKind, planted: readonly string[], found: string])[] = [
      // Invented or re-timed audio (design 4.2a; decision C107): filter text after a comma or a semicolon INSIDE the selection word, an output option inside a section, an input option before `-i`.
      ['asetpts', 'PUSH', inSelection(two, ',asetpts=N/SR/TB'), 'pan=mono|c0=c0,asetpts=N/SR/TB'],
      ['aresample', 'PUSH', inSelection(two, ',aresample=async=1'), 'pan=mono|c0=c0,aresample=async=1'],
      ['aresample', 'PUSH', inSelection(two, ';aresample=48000'), 'pan=mono|c0=c0;aresample=48000'],
      ['async', 'PUSH', inSelection(two, ',aresample=async=1'), 'pan=mono|c0=c0,aresample=async=1'],
      ['async', 'PUSH', inSection(two, '-async', '1'), '-async'],
      ['apad', 'PUSH', inSelection(two, ';apad'), 'pan=mono|c0=c0;apad'],
      ['apad', 'PRECHECK', inSelection(precheck, ',apad=whole_dur=1'), 'pan=mono|c0=c0,apad=whole_dur=1'],
      ['atempo', 'PUSH', inSelection(two, ',atempo=1.1'), 'pan=mono|c0=c0,atempo=1.1'],
      ['asetrate', 'PUSH', inSelection(two, ',asetrate=48000'), 'pan=mono|c0=c0,asetrate=48000'],
      ['adelay', 'PUSH', inSelection(two, ',adelay=10'), 'pan=mono|c0=c0,adelay=10'],
      ['aloop', 'PUSH', inSelection(two, ',aloop=1'), 'pan=mono|c0=c0,aloop=1'],
      ['channelsplit', 'PUSH', inSection(two, '-filter_complex', 'channelsplit'), 'channelsplit'],
      ['-use_wallclock_as_timestamps', 'PUSH', beforeInput(two, '-use_wallclock_as_timestamps', '1'), '-use_wallclock_as_timestamps'],
      ['-fflags', 'PUSH', beforeInput(two, '-fflags', '+genpts'), '-fflags'],
      ['-copyts', 'PUSH', inSection(two, '-copyts'), '-copyts'],
      ['-itsoffset', 'PUSH', beforeInput(two, '-itsoffset', '0.1'), '-itsoffset'],
      ['-re', 'PUSH', beforeInput(two, '-re'), '-re'],
      // Cuts.
      ['-ss', 'PUSH', inSection(two, '-ss', '1'), '-ss'],
      ['-shortest', 'PUSH', inSection(two, '-shortest'), '-shortest'],
      ['-t in a push list', 'PUSH', inSection(two, '-t', '10'), '-t'],
      ['-t of the pre-check', 'PRECHECK', after(precheck, '-t', '3600'), '-t 3600'],
      ['-t of the pre-check', 'PRECHECK', inSection(precheck, '-t', '1'), '-t twice'],
      ['-progress', 'PUSH', beforeInput(two, '-progress', 'pipe:1'), '-progress'],
      // Another filter: every spelling of a filter option, one whose value is read from a file (08b HB-4), a second `-af`, other text after `-af`.
      ['a filter option in another spelling or from a file', 'PUSH', inSection(two, '-filter:a', 'volume=2'), '-filter:a'],
      ['a filter option in another spelling or from a file', 'PUSH', inSection(two, '-filter_complex', 'amix'), '-filter_complex'],
      ['a filter option in another spelling or from a file', 'PUSH', inSection(two, '-lavfi', 'amix'), '-lavfi'],
      ['a filter option in another spelling or from a file', 'PUSH', inSection(two, '-/af', '/data/x.txt'), '-/af'],
      ['a filter option in another spelling or from a file', 'PUSH', inSection(two, '-/filter:a', '/data/x.txt'), '-/filter:a'],
      ['a filter option in another spelling or from a file', 'PUSH', inSection(two, '-filter_script:a', '/data/x.txt'), '-filter_script:a'],
      ['a filter option in another spelling or from a file', 'PUSH', inSection(two, '-af:0', 'volume=2'), '-af:0'],
      ['a second -af in a section', 'PUSH', inSection(two, '-af', 'pan=mono|c0=c2'), '-af twice'],
      ['filter text that is not the one selection', 'PUSH', swap(two, 'pan=mono|c0=c0', 'pan=mono|c0=c0+c1'), 'pan=mono|c0=c0+c1'],
      ['filter text that is not the one selection', 'PUSH', swap(two, 'pan=mono|c0=c0', 'volume=2'), 'volume=2'],
      // Another device or layout.
      ['-ch_layout', 'PUSH', beforeInput(two, '-ch_layout', '6C'), '-ch_layout'],
      ['-channels', 'PUSH', beforeInput(two, '-channels', '6'), '-channels'],
      ['-audio_device_index', 'PUSH', beforeInput(two, '-audio_device_index', '1'), '-audio_device_index'],
      ['-video_device_index', 'PUSH', beforeInput(two, '-video_device_index', '0'), '-video_device_index'],
      ['default as a device', 'PUSH', swap(two, 'none:0', 'default'), 'default'],
      ['default as a device', 'PUSH', swap(two, 'none:0', 'none:default'), 'none:default'],
      ['default as a device', 'PRECHECK', swap(precheck, 'none:0', ':default'), ':default'],
      ['-i that is not none:<n>', 'PUSH', swap(two, 'none:0', 'none:USB Audio Interface'), '-i none:USB Audio Interface'],
      ['-i that is not none:<n>', 'PUSH', swap(two, 'none:0', 'none:32'), '-i none:32'],
      ['-i that is not none:<n>', 'PUSH', swap(two, 'none:0', 'none:01'), '-i none:01'],
      ['-i that is not none:<n>', 'PUSH', swap(two, 'none:0', 'none:-1'), '-i none:-1'],
      ['-i that is not none:<n>', 'PUSH', swap(two, 'none:0', '0:none'), '-i 0:none'],
      ['-i that is not none:<n>', 'PUSH', swap(two, 'none:0', 'none:1x'), '-i none:1x'],
      ['-i that is not none:<n>', 'PRECHECK', swap(precheck, 'none:0', 'default'), '-i default'],
      ['-i that is not none:<n>', 'PUSH', inSection(two, '-i', '/data/x.wav'), '-i /data/x.wav'],
      ['a second -i', 'PUSH', inSection(two, '-i', 'none:1'), '-i twice'],
      // The queue: the blocking form, another size, another target, another option of the target, and every further option the pinned
      // program's `-h muxer=fifo` names beside the four of the row (08b HB-3; the list is in the record).
      ['-drop_pkts_on_overflow', 'PUSH', after(two, '-drop_pkts_on_overflow', '0'), '-drop_pkts_on_overflow 0'],
      ['-drop_pkts_on_overflow', 'PUSH', after(two, '-drop_pkts_on_overflow', 'false'), '-drop_pkts_on_overflow false'],
      ['-queue_size', 'PUSH', after(two, '-queue_size', '60'), '-queue_size 60'],
      ['-queue_size', 'PUSH', after(two, '-queue_size', '1024'), '-queue_size 1024'],
      ['-fifo_format', 'PUSH', after(two, '-fifo_format', 'wav'), '-fifo_format wav'],
      ['-format_opts', 'PUSH', after(two, '-format_opts', 'flush_packets=0'), '-format_opts flush_packets=0'],
      ['-attempt_recovery', 'PUSH', inSection(two, '-attempt_recovery', '1'), '-attempt_recovery'],
      ['-max_recovery_attempts', 'PUSH', inSection(two, '-max_recovery_attempts', '3'), '-max_recovery_attempts'],
      ['-recovery_wait_streamtime', 'PUSH', inSection(two, '-recovery_wait_streamtime', '1'), '-recovery_wait_streamtime'],
      ['-recovery_wait_time', 'PUSH', inSection(two, '-recovery_wait_time', '1'), '-recovery_wait_time'],
      ['-recover_any_error', 'PUSH', inSection(two, '-recover_any_error', '1'), '-recover_any_error'],
      ['-restart_with_keyframe', 'PUSH', inSection(two, '-restart_with_keyframe', '1'), '-restart_with_keyframe'],
      ['-timeshift', 'PUSH', inSection(two, '-timeshift', '2'), '-timeshift'],
      // Shape: the log level and the formats.
      ['-loglevel', 'PUSH', after(two, '-loglevel', 'warning'), '-loglevel warning'],
      ['-loglevel', 'PRECHECK', after(precheck, '-loglevel', 'quiet'), '-loglevel quiet'],
      ['-v', 'PUSH', beforeInput(two, '-v', 'debug'), '-v'],
      ['a second log level', 'PUSH', beforeInput(two, '-loglevel', 'info'), 'a log level twice'],
      ['a format outside the kind', 'PUSH', swap(two, 'fifo', 'f32le'), '-f f32le'],
      ['a format outside the kind', 'PUSH', swap(two, 'avfoundation', 'lavfi'), '-f lavfi'],
      ['a format outside the kind', 'PRECHECK', swap(precheck, 'f32le', 'null'), '-f null'],
      ['a format outside the kind', 'PRECHECK', swap(precheck, 'f32le', 'fifo'), '-f fifo'],
    ];
    expect([...new Set(CONTROLS.map(([id]) => id))]).toEqual(FORBIDDEN_RULES.map(([id]) => id));
    for (const [id, kind, planted, found] of CONTROLS) {
      expect(forbiddenViolations(kind, planted), `${id}: ${planted.join(' ')}`).toContain(`forbidden (${id}): ${found}`);
      // A control the template passes is a failed rule (SM-08 (2)).
      expect(templateViolations(kind, planted).length, `${id}: ${planted.join(' ')}`).toBeGreaterThan(0);
    }
    // The options of the queue in the pinned program (`-h muxer=fifo`, FFmpeg 9.0.2): eleven. Four are the row's, seven are refused above.
    const FIFO_OPTIONS = ['-attempt_recovery', '-drop_pkts_on_overflow', '-fifo_format', '-format_opts', '-max_recovery_attempts', '-queue_size', '-recovery_wait_streamtime', '-recovery_wait_time', '-recover_any_error', '-restart_with_keyframe', '-timeshift'];
    expect(FIFO_OPTIONS.filter((option) => !FORBIDDEN_RULES.some(([id]) => id === option))).toEqual([]);
    expect(FIFO_OPTIONS.filter((option) => PUSH_SECTION.includes(option))).toEqual(['-drop_pkts_on_overflow', '-fifo_format', '-format_opts', '-queue_size']);
    expect(PUSH_SECTION.slice(PUSH_SECTION.indexOf('fifo'), PUSH_SECTION.indexOf('-y'))).toEqual(['fifo', '-fifo_format', 'f32le', '-drop_pkts_on_overflow', '1', '-queue_size', '32', '-format_opts', 'flush_packets=1']);
  });

  it('SR-15 (1) at the table: the device word is made by ONE function from ONE whole number; the selection is the Linux row\'s own function; no text is a parameter', () => {
    const table = flat(TABLE_FILE);
    expect(table).toContain("const MACOS_DEVICE_WORDS: readonly string[] = Object.freeze(Array.from({ length: MACOS_MIC_DEVICE_INDEX_MAX + 1 }, (_unused, index) => `none:${String(index)}`));");
    expect(table).toContain('export function macMicDeviceWord(audioIndex: number): string { const word = isWholeIn(audioIndex, 0, MACOS_MIC_DEVICE_INDEX_MAX) ? MACOS_DEVICE_WORDS[audioIndex] : undefined; if (word === undefined) throw new MacMicArgumentError(\'DEVICE_INDEX\'); return word; }');
    expect(table).toContain('export const MACOS_MIC_DEVICE_INDEX_MAX = 31;');
    expect(table).toContain('export const MACOS_MIC_SECTIONS_MAX = 2;');
    expect(macMicDeviceWord.length).toBe(1);
    // `none:` is written in ONE place of the macOS table (the development row's `none:${name}` is the other, older one), the selection text in ONE place of the file.
    expect(table.match(/`none:\$\{[^}]*\}`/g)).toEqual(['`none:${name}`', '`none:${String(index)}`']);
    expect(table.match(/pan=mono/g)).toHaveLength(1);
    expect(table.match(/\bmacMicDeviceWord\s*\(/g)).toHaveLength(2);
    // The five literal groups of the two templates, as the table file writes them.
    expect(table).toContain("const MACOS_PUSH_HEAD = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'info', '-thread_queue_size', '1024', '-f', 'avfoundation', '-i'] as const;");
    expect(table).toContain("const MACOS_SECTION_HEAD = ['-map', '0:a', '-af'] as const;");
    expect(table).toContain("const MACOS_SECTION_TAIL = ['-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'fifo', '-fifo_format', 'f32le', '-drop_pkts_on_overflow', '1', '-queue_size', '32', '-format_opts', 'flush_packets=1', '-y'] as const;");
    expect(table).toContain("const MACOS_PRECHECK_HEAD = ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'info', '-f', 'avfoundation', '-i'] as const;");
    expect(table).toContain("const MACOS_PRECHECK_SELECT = ['-t', '1', '-map', '0:a', '-af'] as const;");
    expect(table).toContain("const MACOS_PRECHECK_TAIL = ['-ac', '1', '-ar', '48000', '-c:a', 'pcm_f32le', '-f', 'f32le', '-flush_packets', '1', '-'] as const;");
    // (4) the queue's options are named by the table file alone in the capture folder (the bare word 'fifo' is also the pipe files' kind of a file entry).
    expect(places(capture, /'-fifo_format'|'-drop_pkts_on_overflow'|'-queue_size'|'-format_opts'|'-f', 'fifo'/g)).toEqual([TABLE_FILE]);
    // Text in the place of a number makes nothing; so does a number outside 0 to 31.
    for (const outside of [-1, 32, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '0', '00', 'default', 'USB Audio Interface', null, undefined]) expect(() => macMicDeviceWord(outside as number), String(outside)).toThrow('a value of the macOS microphone helper is not of its shape');
    // BEFORE THE CALLER EXISTS (row N9 is not built): no production source but the table file names a function of the macOS
    // table. The row that adds the ONE caller moves this pin and pins its call (SM-08 (3): once per launch, once more for the one retry).
    // MOVED BY ROW N7 (decision C123): the three LISTING rows have their one caller, the fence's runner - pinned in the case
    // "row N7" below; the push, pre-check and device-word functions still have none.
    // MOVED BY ROW NB (design 06 row N13): the boot's mount names the two program constants to hold them to the path rule (never runs them).
    expect(places(production, /\b(?:macUsbTreeArguments|macSystemAudioArguments|macMicDeviceListArguments|MACOS_USB_TREE_PROGRAM|MACOS_SYSTEM_AUDIO_PROGRAM)\b/g)).toEqual([TABLE_FILE, 'src/capture/boot/index.ts', 'src/capture/fence/production-parts.ts']);
    // MOVED BY ROW N5b for row N9 (decision C134; N9's request line 550): the ONE caller of the push and pre-check functions is the
    // macOS adapter, each at ONE call site (the retry runs the same site again, SM-08 (3)); the device word still has no caller
    // outside the table. Control: a second call site in a planted copy is counted and refused.
    const MAC_ADAPTER = 'src/capture/adapters/audio/usb-audio-macos.ts';
    expect(places(production, /\bmacMicDeviceWord\b/g)).toEqual([TABLE_FILE]);
    expect(places(production, /\b(?:macMicPushArguments|macMicPrecheckArguments)\b/g).sort()).toEqual([MAC_ADAPTER, TABLE_FILE].sort());
    const PUSH_CALL = /\bmacMicPushArguments\s*\(/g;
    const PRECHECK_CALL = /\bmacMicPrecheckArguments\s*\(/g;
    const PUSH_SITE = 'macMicPushArguments({ audioIndex: card.cardIndex, channelCount: card.channelCount, sections: launched.map((member) => ({ inputNumber: member.located.stored.inputNumber, pipePath: member.pipePath, deviceId: member.deviceId })) })';
    const PRECHECK_SITE = 'macMicPrecheckArguments({ audioIndex: located.card.cardIndex, channelCount: located.card.channelCount, inputNumber: located.stored.inputNumber, deviceId: located.stored.deviceId })';
    const adapter = flat(MAC_ADAPTER);
    expect([adapter.match(PUSH_CALL)?.length, adapter.match(PRECHECK_CALL)?.length]).toEqual([1, 1]);
    expect(adapter).toContain(PUSH_SITE);
    expect(adapter).toContain(PRECHECK_SITE);
    const planted = `${adapter} const again = ${PUSH_SITE}; const twice = ${PRECHECK_SITE};`;
    expect([planted.match(PUSH_CALL)?.length, planted.match(PRECHECK_CALL)?.length]).toEqual([2, 2]);
  });

  it('SR-15 (6): the three listing rows are FIXED and take nothing - the USB tree in its PROPERTY-LIST form, the audio facts as JSON, the helper\'s own device list unchanged; the two programs are literals of the table file alone', () => {
    const table = flat(TABLE_FILE);
    /** The rule over one listing start: the program is one of the two literals and the list is ITS row, word for word. */
    const ROWS = new Map<string, readonly string[]>([
      ['/usr/sbin/ioreg', ['-r', '-c', 'IOUSBHostDevice', '-l', '-d', '2', '-a']],
      ['/usr/sbin/system_profiler', ['SPAudioDataType', '-json']],
    ]);
    const listingViolations = (program: string, args: readonly string[]): string[] => {
      const row = ROWS.get(program);
      if (row === undefined) return [`no listing program of the table: ${program}`];
      return args.length === row.length && args.every((arg, index) => arg === row[index]) ? [] : [`not the row of ${program}: ${args.join(' ')}`];
    };
    const tree = macUsbTreeArguments();
    const audio = macSystemAudioArguments();
    expect([MACOS_LISTING_HELPER_TABLE.usbTree.program, ...tree]).toEqual(['/usr/sbin/ioreg', '-r', '-c', 'IOUSBHostDevice', '-l', '-d', '2', '-a']);
    expect([MACOS_LISTING_HELPER_TABLE.systemAudio.program, ...audio]).toEqual(['/usr/sbin/system_profiler', 'SPAudioDataType', '-json']);
    expect(listingViolations(MACOS_LISTING_HELPER_TABLE.usbTree.program, tree)).toEqual([]);
    expect(listingViolations(MACOS_LISTING_HELPER_TABLE.systemAudio.program, audio)).toEqual([]);
    expect([...MACOS_LISTING_HELPER_TABLE.usbTree.literals]).toEqual([...tree]);
    expect([...MACOS_LISTING_HELPER_TABLE.systemAudio.literals]).toEqual([...audio]);
    // The bounds of SR-15 (6): 5,000 ms, 10,000 ms, 5,000 ms.
    expect([MACOS_LISTING_HELPER_TABLE.usbTree.boundMs, MACOS_LISTING_HELPER_TABLE.systemAudio.boundMs, MACOS_LISTING_HELPER_TABLE.deviceList.boundMs]).toEqual([5_000, 10_000, 5_000]);
    // L3: the EXISTING device-list row, unchanged - the very array of the camera table. It names no device.
    expect(macMicDeviceListArguments()).toBe(deviceListArguments());
    expect([...macMicDeviceListArguments()]).toEqual(['-hide_banner', '-nostdin', '-f', 'avfoundation', '-list_devices', 'true', '-i', '']);
    expect([...MACOS_LISTING_HELPER_TABLE.deviceList.literals]).toEqual([...deviceListArguments()]);
    // No function of a row has a parameter, and each answers its literals.
    expect([macUsbTreeArguments.length, macSystemAudioArguments.length, macMicDeviceListArguments.length]).toEqual([0, 0, 0]);
    expect(table).toContain("const MACOS_USB_TREE = ['-r', '-c', 'IOUSBHostDevice', '-l', '-d', '2', '-a'] as const;");
    expect(table).toContain("const MACOS_SYSTEM_AUDIO = ['SPAudioDataType', '-json'] as const;");
    expect(table).toContain('export function macUsbTreeArguments(): readonly string[] { return Object.freeze([...MACOS_USB_TREE]); }');
    expect(table).toContain('export function macSystemAudioArguments(): readonly string[] { return Object.freeze([...MACOS_SYSTEM_AUDIO]); }');
    expect(table).toContain('export function macMicDeviceListArguments(): readonly string[] { return deviceListArguments(); }');
    // The two programs: absolute literals, named by the table file alone in the whole server.
    expect(table).toContain("export const MACOS_USB_TREE_PROGRAM = '/usr/sbin/ioreg';");
    expect(table).toContain("export const MACOS_SYSTEM_AUDIO_PROGRAM = '/usr/sbin/system_profiler';");
    expect(places(production, /['"`][^'"`\n]*\bioreg\b/g)).toEqual([TABLE_FILE]);
    expect(places(production, /['"`][^'"`\n]*\bsystem_profiler\b/g)).toEqual([TABLE_FILE]);
    // The words of the rows as ARGUMENTS stand in the table file alone (the reader of the audio facts names `SPAudioDataType` too, as the top member of the JSON it reads: no argument).
    expect(places(production, /IOUSBHostDevice|'-json'|'SPAudioDataType', /g)).toEqual([TABLE_FILE]);

    // Controls, each seen by the rule.
    // The TEXT form of the USB tree (review SM-02: forgeable by a device's product string) - the row without `-a`; the long form of revision 1.
    expect(listingViolations('/usr/sbin/ioreg', ['-r', '-c', 'IOUSBHostDevice', '-l', '-d', '2'])).toEqual(['not the row of /usr/sbin/ioreg: -r -c IOUSBHostDevice -l -d 2']);
    expect(listingViolations('/usr/sbin/ioreg', ['-p', 'IOUSB', '-l'])).toEqual(['not the row of /usr/sbin/ioreg: -p IOUSB -l']);
    // A further argument of a row: a name, a depth from data, a width.
    expect(listingViolations('/usr/sbin/ioreg', [...tree, '-n', 'USB Audio Interface'])).toEqual(['not the row of /usr/sbin/ioreg: -r -c IOUSBHostDevice -l -d 2 -a -n USB Audio Interface']);
    expect(listingViolations('/usr/sbin/ioreg', tree.map((arg) => (arg === '2' ? '9' : arg)))).toEqual(['not the row of /usr/sbin/ioreg: -r -c IOUSBHostDevice -l -d 9 -a']);
    expect(listingViolations('/usr/sbin/ioreg', ['-r -c', 'IOUSBHostDevice -l', '-d', '2', '-a', '', ''])).toEqual(['not the row of /usr/sbin/ioreg: -r -c IOUSBHostDevice -l -d 2 -a  ']);
    // Another data type, another form, a third argument.
    expect(listingViolations('/usr/sbin/system_profiler', ['SPUSBDataType', '-json'])).toEqual(['not the row of /usr/sbin/system_profiler: SPUSBDataType -json']);
    expect(listingViolations('/usr/sbin/system_profiler', ['SPAudioDataType', '-xml'])).toEqual(['not the row of /usr/sbin/system_profiler: SPAudioDataType -xml']);
    expect(listingViolations('/usr/sbin/system_profiler', ['SPAudioDataType'])).toEqual(['not the row of /usr/sbin/system_profiler: SPAudioDataType']);
    expect(listingViolations('/usr/sbin/system_profiler', [...audio, '-detailLevel', 'full'])).toEqual(['not the row of /usr/sbin/system_profiler: SPAudioDataType -json -detailLevel full']);
    // A program that is not a literal of the table: by name, by another folder, the row of one under the program of the other.
    expect(listingViolations('ioreg', tree)).toEqual(['no listing program of the table: ioreg']);
    expect(listingViolations('/usr/local/bin/ioreg', tree)).toEqual(['no listing program of the table: /usr/local/bin/ioreg']);
    expect(listingViolations('/usr/sbin/system_profiler', tree)).toEqual(['not the row of /usr/sbin/system_profiler: -r -c IOUSBHostDevice -l -d 2 -a']);
  });

  it('SR-15 (7), as a rule over a start vector: the first word the guard is handed is the helper, and what follows is a list of the template unchanged (control: nice, taskpolicy, a shell)', () => {
    const HELPER = '/opt/dems/helpers/ffmpeg';
    /** The rule: `[<helper>, ...list]`. Anything before the helper - a wrapper that sets a scheduling class, a shell - is seen (design 4.2, MM3 s6: a background class lowers the delivery to 11 to 27% without a line). */
    const launchViolations = (kind: MacKind, vector: readonly string[]): string[] => [...(vector[0] === HELPER ? [] : [`before the helper: ${vector[0] ?? ''}`]), ...macViolations(kind, vector.slice(1))];
    expect(launchViolations('PUSH', [HELPER, ...two])).toEqual([]);
    expect(launchViolations('PRECHECK', [HELPER, ...precheck])).toEqual([]);
    expect(launchViolations('PUSH', ['/usr/bin/nice', '-n', '10', HELPER, ...two])[0]).toBe('before the helper: /usr/bin/nice');
    expect(launchViolations('PUSH', ['/usr/sbin/taskpolicy', '-b', HELPER, ...two])[0]).toBe('before the helper: /usr/sbin/taskpolicy');
    expect(launchViolations('PUSH', ['/bin/sh', '-c', `${HELPER} ${two.join(' ')}`])[0]).toBe('before the helper: /bin/sh');
    expect(launchViolations('PUSH', ['/usr/bin/nice', '-n', '10', HELPER, ...two]).length).toBeGreaterThan(1);
    // The pin of the ONE caller's start line is the caller's row (N9): there is no caller in the product yet (see the pin above).
  });

  // Task 4 row N7 (wave 12; decision C123: the ONE named entry this row adds to this list). SR-15 (6) AT ITS ONE CALLER: each
  // listing row is handed to the production door unchanged, with an empty environment and no start message, by the fence's
  // runner alone, on `darwin` alone (SM-21: the platform chooses, no key of the configuration), and no production file hands
  // the runner another program. The mutation each line was seen RED on is in implementation/n7_macos_platform_seam.md.
  it('row N7: the three listing rows have ONE caller, the fence\'s runner - each table function called once with nothing, ONE door call with the row unchanged, an empty environment and no message; the platform alone chooses; the program overrides are a test\'s', () => {
    const PARTS = 'src/capture/fence/production-parts.ts';
    const parts = flat(PARTS);
    const ROW_CALLS = /\b(?:macUsbTreeArguments|macSystemAudioArguments|macMicDeviceListArguments)\s*\([^)]*\)/g;
    const DOOR_CALL = /(?<![.\w])door\(\{(?:[^{}]|\{[^{}]*\})*\}\)/g;
    const SOURCE_LINES = /\b(?:usbTree|systemAudio): \(\) => macosListingRowText\([^;]*?\)\),|\breturn macosListingRowText\([^;]*;/g;
    // (a) Each row's function once, with no argument; the runner's one door call; the three places that hand a row to it.
    expect(parts.match(ROW_CALLS)).toEqual(['macUsbTreeArguments()', 'macSystemAudioArguments()', 'macMicDeviceListArguments()']);
    // MOVED BY ROW N5b (decision C131): the runner's call names the row's cap and the process group; still no key, no message.
    expect(parts.match(DOOR_CALL)).toEqual(['door({ command: program, args, env: {}, message: null, timers, outputCapBytes: capBytes, processGroup: true })', 'door({ command: neighbourProgram, args: argumentsOf(linuxNeighbourArguments, target), env: {}, message: null, timers: host.timers })', 'door({ command: echoProgram, args: argumentsOf(linuxEchoArguments, target), env: {}, message: null, timers: host.timers })']);
    expect(parts.match(SOURCE_LINES)).toEqual([
      'usbTree: () => macosListingRowText(parts, MacosListingRow.USB_TREE, usbTreeProgram, macUsbTreeArguments()),',
      'systemAudio: () => macosListingRowText(parts, MacosListingRow.SYSTEM_AUDIO, systemAudioProgram, macSystemAudioArguments()),',
      'return macosListingRowText(parts, MacosListingRow.CAPTURE_DEVICES, parts.helperProgram, macMicDeviceListArguments());',
    ]);
    expect(parts).toContain('const usbTreeProgram = parts.usbTreeProgram ?? MACOS_USB_TREE_PROGRAM;');
    expect(parts).toContain('const systemAudioProgram = parts.systemAudioProgram ?? MACOS_SYSTEM_AUDIO_PROGRAM;');
    // (b) The helper is vouched for by the path rule before the start of its row (SM-10 (6)).
    expect(parts).toMatch(/refusal = helperProgramRefusal\(inspect\(parts\.helperProgram\)\);.*if \(refusal !== null\) throw new CardListingProgramError\(CardListingProgramFailure\.NOT_STARTED, MacosListingRow\.CAPTURE_DEVICES\); return macosListingRowText/);
    // (c) SM-21: the platform word alone chooses, read from what the entry states; this file reads no process fact and no configuration key.
    expect(parts).toContain("export const MACOS_CARD_LISTING_PLATFORM = 'darwin';");
    expect(parts).toContain('if (host.platform === MACOS_CARD_LISTING_PLATFORM) {');
    expect(parts).not.toMatch(/process\.(?:platform|env)|DEMS_CAPTURE_AUDIO_HELPER/);
    // (d) Only the fence makes the runner; no production file hands it another program or other limits (they are a test's).
    expect(places(production, /\b(?:macosListingSourceOf|macosCardEnumeratorOf|macosListingRowText)\s*\(/g)).toEqual([PARTS]);
    expect(places(production, /\b(?:usbTreeProgram|systemAudioProgram)\s*[?:]/g)).toEqual([PARTS]);
    expect(parts.match(/\blimits\?\.\[row\]|\blimits\?:/g)).toEqual(['limits?:', 'limits?.[row]']);
    // Controls, each seen by the same patterns: an argument from data, a program from the configuration, a second door call with a key.
    const planted = "usbTree: () => macosListingRowText(parts, MacosListingRow.USB_TREE, config.captureUsbTreePath, [...macUsbTreeArguments(), name]), door({ command: program, args, env: { DYLD_INSERT_LIBRARIES: x }, message: null, timers })";
    expect(planted.match(SOURCE_LINES)).not.toEqual(['usbTree: () => macosListingRowText(parts, MacosListingRow.USB_TREE, usbTreeProgram, macUsbTreeArguments()),']);
    expect(planted.match(DOOR_CALL)).toEqual(['door({ command: program, args, env: { DYLD_INSERT_LIBRARIES: x }, message: null, timers })']);
    expect('macUsbTreeArguments(name)'.match(ROW_CALLS)).toEqual(['macUsbTreeArguments(name)']);
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

  it('the statements of the server name it, and the one builder of a typed row carries it', () => {
    const statements = columnLists(production);
    expect(statements.map((found) => found.path)).toEqual(['src/capture/fence/statements.ts']);
    expect(statements.filter((found) => !/\badapter_kind\b/.test(found.columns))).toEqual([]);
    // The local-device statement writes the kind as a LITERAL: no bind value can make it write another one.
    const fence = production.find((file) => file.path === 'src/capture/fence/statements.ts')?.text ?? '';
    expect(fence).toMatch(/\$5::boolean, 'LOCAL_DEVICE' /);
    expect(fence).not.toMatch(/UPDATE|DELETE/i);
    // The typed writer (drizzle) is ONE: the mapping of the engine's rows. It names the member on every
    // registry row, and the kind it writes for a device whose slice names none (the five built-ins of a
    // seed among them) is stated there as a literal: the development kind, never the column default.
    const mapping = production.find((file) => file.path === 'src/db/mapping/rows.ts')?.text ?? '';
    expect(mapping).toContain('adapterKind: adapterKindOf(device),');
    expect(mapping).toContain("export const DEFAULT_CAPTURE_ADAPTER_KIND: CaptureAdapterKindValue = 'FAKE';");
    expect(mapping).toContain('if (named === undefined || named === null) return DEFAULT_CAPTURE_ADAPTER_KIND;');
    // The seed builds NO registry row of its own. Its rows are the mapping's (`toRows`), so there is no
    // second builder in which the member could be forgotten or given another kind. (This line read a
    // builder of the seed that nothing called: a guard on dead code guarded nothing. That the seeded
    // built-ins are FAKE on a database is M4-MT-15 of `db/seed/__tests__/seed.db.test.ts`.)
    const seed = production.find((file) => file.path === 'src/db/seed/seed.ts')?.text ?? '';
    expect(seed).toContain('rows = toRows(state, ');
    expect(seed).not.toMatch(/\badapterKind\b|\badapter_kind\b|\bCaptureDeviceRow\b/);
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
    for (const call of ['workerProgramProblemOf(deps.workerProgram', 'deps.probeEvidenceVolume()', 'deps.signingKeyProblem()', 'deps.signingKeyIsDevelopment()', 'await deps.demoPasswordOperators()', 'await deps.handshake()']) {
      expect(checks.indexOf(call, refusal), call).toBeGreaterThan(refusal);
    }
    // The worker is started LAST: after the path rule, the store and the key.
    expect(checks.lastIndexOf('await deps.handshake()')).toBeGreaterThan(checks.lastIndexOf('deps.signingKeyProblem()'));
    // THE PRODUCTION REFUSALS (R88-08 (3); S99-01, ruling D241): the development signing key and the published demo
    // password are each asked in REAL_PRODUCTION only, each refused by its own code, each BEFORE the worker is started.
    expect(checks).toContain('if (operation === CaptureOperation.REAL_PRODUCTION && deps.signingKeyIsDevelopment()) return refuse(CaptureBootRefusal.DEVELOPMENT_SIGNING_KEY, null);');
    const operators = checks.indexOf('const operators = await deps.demoPasswordOperators().catch(() => null);');
    expect(checks.lastIndexOf('if (operation === CaptureOperation.REAL_PRODUCTION) {', operators)).toBeGreaterThan(checks.lastIndexOf('deps.signingKeyProblem()'));
    expect(checks.slice(checks.lastIndexOf('if (operation === CaptureOperation.REAL_PRODUCTION) {', operators), operators)).not.toContain('}');
    expect([...checks.matchAll(/\bdeps\.demoPasswordOperators\s*\(/g)]).toHaveLength(1);
    expect(checks).toContain('return refuse(CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, OPERATORS_UNREADABLE);');
    expect(checks).toContain('if (operators > 0) return refuse(CaptureBootRefusal.DEMO_PASSWORD_IN_PRODUCTION, `operators=${operators}`, { operators });');
    expect(checks.lastIndexOf('await deps.handshake()')).toBeGreaterThan(operators);
    // The published password is NAMED by one file of the capture folder, which hands it to the verifier and to nothing else;
    // its value is in no file of the folder; the pure checks never see it.
    const naming = capture.filter((file) => new RegExp(`\\b${join('DEMO_OPERATOR', '_PASSWORD')}\\b`).test(file.text)).map((file) => file.path);
    expect(naming).toEqual([`${BOOT}index.ts`]);
    expect([...mount.matchAll(new RegExp(`.*\\b${join('DEMO_OPERATOR', '_PASSWORD')}\\b.*`, 'g'))].map((match) => match[0].trim())).toEqual([
      `import { ${join('DEMO_OPERATOR', '_PASSWORD')} } from '@dems/shared/sim';`,
      `if (await verify(${join('DEMO_OPERATOR', '_PASSWORD')}, { algorithm: row.algorithm, memoryKib: row.memory_kib, passes: row.passes, parallelism: row.parallelism, salt: row.salt, hash: row.hash })) count += 1;`,
    ]);
    const published: string = DEMO_OPERATOR_PASSWORD;
    expect(tree.filter((file) => file.path.startsWith('src/capture/') && file.text.includes(published)).map((file) => file.path)).toEqual([]);
    // The boot folder starts no process and names no timer itself: the channel and the timers are handed in (G-R8).
    expect(places(capture.filter((file) => file.path.startsWith(BOOT)), PROCESS_START)).toEqual([]);
    expect(places(capture.filter((file) => file.path.startsWith(BOOT)), GLOBAL_TIMER)).toEqual([]);
  });
});

// Task 4 row 80 (WP-20). Decision C17 left open whether SR-1 must also cover the process-starting file of row 80.
// DECIDED FOR ROW 80: it must not. SR-1 admits exactly three files and its own open point 4 names the route - the
// runner is INJECTED. So no list above gained an entry for the host checks; this block holds the route instead.
describe('row 80: the host checks ask the host through an injected runner; no list of G-R2 or G-R8 grew for them', () => {
  const HOST_CHECKS = 'src/capture/boot/host-checks.ts';
  /** Task 4 row 85 (C46): the maker of the host facts the entry point hands in, and the one caller of the runner over a door. */
  const HOST_FACTS = 'src/capture/boot/host-facts.ts';
  const CHECKS = 'src/capture/boot/checks.ts';
  const text = (path: string): string => capture.find((file) => file.path === path)?.text ?? '';

  it('the file imports types only, names no process module, no file system, no socket, no timer and no environment; it logs nothing', () => {
    const file = text(HOST_CHECKS);
    expect(file.match(/^import .*$/gm)).toEqual(["import type { HelperDoor } from '../adapters/local';", "import type { CaptureTimers } from '../types';"]);
    const own = capture.filter((entry) => entry.path === HOST_CHECKS);
    for (const pattern of [PROCESS_MODULE, PROCESS_START, FILE_SYSTEM, SOCKET_OR_THREAD, GLOBAL_TIMER, ENVIRONMENT, SYSTEM_TIME, RANDOM]) expect(occurrences(own, pattern), String(pattern)).toEqual([]);
    expect(logCalls(file)).toEqual([]);
  });

  it('every question is a row of the one table: an absolute program as a literal, and the runner is called in one place with a row of it', () => {
    const file = text(HOST_CHECKS);
    expect([...file.matchAll(/\brun\(([^)]*)\)/g)].map((match) => match[1])).toEqual(['check.command']);
    // Task 4 row HC3 (decision C103): the named entry row HC had here for the packet filter's tool (the listing of the loopback
    // table) is GONE with its row. The Core's unit has no capability and the kernel refuses that listing, so the tool has no
    // admitted use: it is in the refused list below like every program that can change the host, and the literals are eight again.
    expect([...new Set(file.match(/'\/(?:usr|bin|sbin)\/[^']*'/g) ?? [])].sort()).toEqual(["'/usr/bin/arping'", "'/usr/bin/dpkg'", "'/usr/bin/grep'", "'/usr/bin/id'", "'/usr/bin/stat'", "'/usr/bin/systemctl'", "'/usr/bin/timedatectl'", "'/usr/sbin/sysctl'"]);
    // No program that changes the host, and no shell.
    expect(file.match(/'(?:\/usr)?\/s?bin\/(?:sh|bash|env|sudo|nft|ufw|ip|usermod|install|tee)'|\bdaemon-reload\b|'(?:enable|disable|start|stop|restart|mask|-w|--write)'/g)).toBeNull();
    // The door of the runner is a parameter: the file calls it and builds none.
    expect(file).toContain('const child = door({ command: command.program, args: command.args });');
  });

  it('the boot asks the host in REAL_PRODUCTION only, once, after the operators and before the worker; the runner over a door has no caller in the product yet', () => {
    const checks = text(CHECKS);
    const asked = 'if (operation === CaptureOperation.REAL_PRODUCTION && deps.host !== undefined) {';
    expect(checks.split(asked)).toHaveLength(2);
    expect([...checks.matchAll(/\bhostCheckOutcomeOf\s*\(/g)]).toHaveLength(1);
    expect(checks.indexOf(asked)).toBeGreaterThan(checks.indexOf('const operators = await deps.demoPasswordOperators().catch(() => null);'));
    expect(checks.indexOf('hostCheckOutcomeOf(deps.host', checks.indexOf(asked))).toBeGreaterThan(checks.indexOf(asked));
    expect(checks.lastIndexOf('await deps.handshake()')).toBeGreaterThan(checks.indexOf('hostCheckOutcomeOf(deps.host'));
    // Who hands a door to the host runner is a decision of the composition (the local door, as the process listing uses it).
    // Task 4 row 85 (C46) wired it: beside the declaration, the ONE caller is the maker of the entry point's host facts.
    expect(places(production, /\bhostCommandRunnerOver\s*\(/g)).toEqual([HOST_CHECKS, HOST_FACTS]);
    expect(text(HOST_FACTS).match(/\bhostCommandRunnerOver\s*\([^)]*\)/g)).toEqual(['hostCommandRunnerOver(startHelperProcess, timers)']);
    // Task 4 row 106c (decision C82, NAMED AMENDMENT SR-11): WHO GETS A RUNNER moved by exactly one caller. The ONE call
    // above now stands in a maker of its own (`captureHostRunnerOf`), which the host facts use and which the entry point
    // calls ONCE MORE, as a member of the composition's statement, for the single purpose of reading the address helper's
    // interface file. The door did not leave the capture unit (rule A-5 of the adapter layer is untouched): the entry
    // gets a runner, never the means to start a program. A fourth caller of the maker fails here (D62 took the third seat, 2026-11-05).
    const MAKER_CALL = /\bcaptureHostRunnerOf\s*\([^)]*\)/g;
    // Decision D62 (2026-11-05) adds the THIRD caller: the capture-discovery module, for the ONE fixed neighbour row
    // of the SMART ATTACH sweep (`segment-scan.ts`), behind the configuration flag. The door still did not leave the
    // capture unit: the module gets a runner, never the means to start a program, and the row it runs is pinned in the G-R13 block.
    expect(places(production, /\bcaptureHostRunnerOf\s*\(/g)).toEqual([HOST_FACTS, 'src/index.ts', 'src/modules/capture-discovery/index.ts']);
    expect(text(HOST_FACTS).match(MAKER_CALL)).toEqual(['captureHostRunnerOf(timers: CaptureTimers)', 'captureHostRunnerOf(timers)']);
    expect(text(HOST_FACTS)).toMatch(/export function captureHostRunnerOf\(timers: CaptureTimers\): OwnHostFacts\['run'\] \{\n {2}return hostCommandRunnerOver\(startHelperProcess, timers\);\n\}/);
    expect(text(HOST_FACTS)).toContain('    run: captureHostRunnerOf(timers),');
    const entry = production.find((file) => file.path === 'src/index.ts')?.text ?? '';
    expect(entry.match(MAKER_CALL)).toEqual(['captureHostRunnerOf(createSystemTimers()']);
    expect(entry.match(/\bcaptureHostRunnerOf\b/g)).toHaveLength(2);
    // The runner over a door and the door itself are named by no production source outside the capture unit.
    expect(places(production.filter((file) => !file.path.startsWith('src/capture/')), /\b(?:hostCommandRunnerOver|startHelperProcess)\b/g)).toEqual([]);
  });

  // Task 4 row 106c (decision C82, NAMED AMENDMENT SR-11). The runner the entry hands to the composing file has ONE use
  // there: it goes, unchanged, to the source of the interface file together with the FIXED row of the program checks
  // (`/usr/bin/cat` and the one path: no argument from data, rules G-R12 / SR-4), on `linux` only. Every line of the
  // composing file that names the runner, its type, its maker, the door or the row is pinned; a second use is a new line.
  const COMPOSING = 'src/capture-composition.ts';
  const RUNNER_NAMES = /\b(?:hostRunner|HostCommandRunner|HostCommand|hostCommandRunnerOver|captureHostRunnerOf|startHelperProcess|INTERFACE_FILE_COMMAND)\b/;
  const RUNNER_LINES: readonly string[] = [
    "import { CapturePhase, INTERFACE_FILE_COMMAND, createSystemTimers, type CaptureTimers, type HostCommandRunner } from './capture';",
    'readonly hostRunner?: HostCommandRunner;',
    "return input.aliasInterfaceFile ?? hostAliasInterfaceFileSourceOf(input.platform === 'linux' ? (input.hostRunner ?? null) : null, INTERFACE_FILE_COMMAND);",
  ];
  const runnerViolations = (files: readonly SourceFile[]): string[] =>
    files
      .filter((file) => file.path === COMPOSING)
      .flatMap((file) => {
        const lines = file.text.split('\n').map((line) => line.trim());
        const named = lines.filter((line) => RUNNER_NAMES.test(line));
        return [
          ...named.filter((line) => !RUNNER_LINES.includes(line)).map((line) => `${COMPOSING} uses the host runner a second time: ${line}`),
          ...RUNNER_LINES.filter((pinned) => named.filter((line) => line === pinned).length !== 1).map((pinned) => `${COMPOSING} does not hold once: ${pinned}`),
          // The whole input is never spread or taken apart: the runner would travel under another name.
          ...lines.filter((line) => /\.\.\.\s*input\b(?!\s*\.)|\}\s*=\s*input\b(?!\s*\.)/.test(line)).map((line) => `${COMPOSING} takes the input apart: ${line}`),
        ];
      });

  it('SR-11 control: a second use of the runner from the composing file is seen - another question, the runner handed on, a second runner made, the input taken apart, the one use taken away', () => {
    const composing = RUNNER_LINES.join('\n');
    const planted = (body: string): SourceFile[] => [{ path: COMPOSING, text: body }];
    expect(runnerViolations(planted(composing))).toEqual([]);
    const second = "const table = await input.hostRunner?.({ program: '/usr/sbin/ip', args: ['addr', 'show'] });";
    expect(runnerViolations(planted(`${composing}\n${second}`))).toEqual([`${COMPOSING} uses the host runner a second time: ${second}`]);
    expect(runnerViolations(planted(`${composing}\ncaptureFactoryScanControl(app).provide({ run: input.hostRunner });`))).toEqual([`${COMPOSING} uses the host runner a second time: captureFactoryScanControl(app).provide({ run: input.hostRunner });`]);
    expect(runnerViolations(planted(`${composing}\nconst other = hostCommandRunnerOver(door, timers);`))).toEqual([`${COMPOSING} uses the host runner a second time: const other = hostCommandRunnerOver(door, timers);`]);
    expect(runnerViolations(planted(`${composing}\nconst own = captureHostRunnerOf(timers);`))).toEqual([`${COMPOSING} uses the host runner a second time: const own = captureHostRunnerOf(timers);`]);
    expect(runnerViolations(planted(`${composing}\nconst asked = await run(INTERFACE_FILE_COMMAND);`))).toEqual([`${COMPOSING} uses the host runner a second time: const asked = await run(INTERFACE_FILE_COMMAND);`]);
    expect(runnerViolations(planted(`${composing}\nconst { platform, ...rest } = input;`))).toEqual([`${COMPOSING} takes the input apart: const { platform, ...rest } = input;`]);
    expect(runnerViolations(planted(`${composing}\nmount({ ...input });`))).toEqual([`${COMPOSING} takes the input apart: mount({ ...input });`]);
    // The one use twice, and the one use on every platform (the `linux` condition taken away), are not the pinned line.
    expect(runnerViolations(planted(`${composing}\n${RUNNER_LINES[2] ?? ''}`))).toEqual([`${COMPOSING} does not hold once: ${RUNNER_LINES[2] ?? ''}`]);
    const everywhere = 'return input.aliasInterfaceFile ?? hostAliasInterfaceFileSourceOf(input.hostRunner ?? null, INTERFACE_FILE_COMMAND);';
    expect(runnerViolations(planted(composing.replace(RUNNER_LINES[2] ?? '', everywhere)))).toEqual([`${COMPOSING} uses the host runner a second time: ${everywhere}`, `${COMPOSING} does not hold once: ${RUNNER_LINES[2] ?? ''}`]);
  });

  it('SR-11: the composing file names the runner in three lines - its import, its member, its ONE use with the fixed row on linux; the row is one program and one path; no other production source is handed the runner', () => {
    expect(runnerViolations(production)).toEqual([]);
    // The member is named by the entry (once, in the statement) and the composing file (the two lines above), and by no other source.
    expect(places(production, /\bhostRunner\b/g)).toEqual([COMPOSING, 'src/index.ts']);
    expect((production.find((file) => file.path === 'src/index.ts')?.text ?? '').match(/\bhostRunner\b/g)).toHaveLength(1);
    // THE FIXED ROW: declared once, in the program checks of the boot; a literal program, a literal path, no parameter.
    const PROGRAM_CHECKS = 'src/capture/boot/program-checks.ts';
    expect(text(PROGRAM_CHECKS)).toContain("export const INTERFACE_FILE_COMMAND: HostCommand = Object.freeze({ program: '/usr/bin/cat', args: Object.freeze([INTERFACE_FILE]) });");
    expect(text(PROGRAM_CHECKS)).toContain("const INTERFACE_FILE = '/etc/dems/netalias-interface';");
    // Who names the row under src/: its declaration, the two barrels it leaves the unit through, and the composing file.
    expect(places(production, /\bINTERFACE_FILE_COMMAND\b/g).sort()).toEqual([PROGRAM_CHECKS, 'src/capture/boot/index.ts', 'src/capture/index.ts', COMPOSING].sort());
  });

  // Task 4 row 85 (WP-13b; design addendum 1.6 #2, 6.4; AD-02 (2), AD-08). The production registry builder takes product
  // dependencies only. A production source that calls it hands in members of the closed list below and nothing else: no
  // door, no inspector, no clock, no "permissive" anything. SINCE THE LIFT (row 88, AM-1) the ONE production call is the
  // boot step's wiring in the fence (`wireProductionRegistry`), with the two members of rows 85c / 85d added by name
  // (`reader`, `onAdmission`); without the composition's parts the boot step builds the empty registry.
  it('row 85 / row 88: the production registry builder is called by the boot step\'s wiring alone, never with a seam argument; without the composition\'s parts the boot builds the empty production registry', () => {
    const BUILDER_CALL = /\bbuildProductionRegistryOf\s*(?:<[^(]*>)?\(\s*\{([^}]*)\}/g;
    const MEMBERS = ['operation', 'executor', 'reader', 'dependencies', 'load', 'audioCards', 'checkCamera', 'locked', 'onAdmission'];
    const violations = (files: readonly SourceFile[]): string[] =>
      files.flatMap((file) =>
        [...file.text.matchAll(BUILDER_CALL)].flatMap((match) =>
          [...(match[1] ?? '').matchAll(/(?:^|[,{\n])\s*(?:\.\.\.)?([A-Za-z_$][\w$]*)/g)]
            .map((member) => member[1] ?? '')
            .filter((member) => !MEMBERS.includes(member))
            .map((member) => `${file.path} hands the builder the member ${member}`),
        ),
      );
    // Control: a seam, a permissive rule and a spread of anything are each seen; the product's own members are not.
    expect(violations([
      { path: 'src/capture/fence/index.ts', text: 'built = await buildProductionRegistryOf({ operation, executor, dependencies, load, audioCards, locked: mount.locked });' },
      { path: 'src/capture/x.ts', text: 'await buildProductionRegistryOf({ operation, executor, dependencies, load, audioCards, door: mount.door });' },
      { path: 'src/capture/y.ts', text: 'await buildProductionRegistryOf<Camera, Audio>({\n  operation,\n  permissiveAddressRule,\n  ...mount,\n});' },
    ])).toEqual(['src/capture/x.ts hands the builder the member door', 'src/capture/y.ts hands the builder the member permissiveAddressRule', 'src/capture/y.ts hands the builder the member mount']);
    expect(violations(production)).toEqual([]);
    // Since the lift: two occurrences in the product, the declaration and the ONE call of the wiring, which the boot step's
    // REAL_PRODUCTION branch calls with the composition's parts; without them that branch builds the empty registry.
    const FENCE_INDEX = 'src/capture/fence/index.ts';
    expect(places(production, /\bbuildProductionRegistryOf\b/g)).toEqual([FENCE_INDEX]);
    expect(text(FENCE_INDEX).match(/\bbuildProductionRegistryOf\b/g)).toHaveLength(2);
    expect(text(FENCE_INDEX).match(/\bloaded\.registry = await buildProductionRegistryOf\(\{ operation, executor, reader, dependencies, load, audioCards, checkCamera, locked, onAdmission \}\);/g)).toHaveLength(1);
    expect(places(production, /\bwireProductionRegistry\s*\(/g)).toEqual([FENCE_INDEX]);
    expect(text(FENCE_INDEX)).toMatch(/\} else if \(passed\.operation === CaptureOperation\.REAL_PRODUCTION\) \{\n[^]*?\n {8}built =\n {10}parts === null\n {12}\? buildProductionRegistry\(mount\.locked\)\n {12}: await wireProductionRegistry\(parts, \{/);
    // The parts reach the fence through ONE door, opened by the composing file alone.
    expect(places(production, /\.\s*provideProductionParts\s*\(/g)).toEqual(['src/capture-composition.ts']);
    // The builder refuses another operation before it reads the stored registry or asks the loader.
    const builder = text(FENCE_INDEX).slice(text(FENCE_INDEX).indexOf('export async function buildProductionRegistryOf'));
    const refusal = builder.indexOf('if (input.operation !== CaptureOperation.REAL_PRODUCTION) throw new CaptureAdapterError(CaptureAdapterRefusal.REAL_ADAPTERS_REFUSED);');
    expect(refusal).toBeGreaterThan(0);
    expect(refusal).toBeLessThan(builder.indexOf('readStoredDevices('));
    expect(builder.indexOf('readStoredDevices(')).toBeLessThan(builder.indexOf('input.load('));
    // No file under src/ states a destination rule that admits loopback: the permissive rule of a test lives under test/ (AD-02 (2)).
    expect(tree.filter((file) => file.path.startsWith('src/') && isProductionSource(file.path) && /\bloopback-destination\b|\bpermissive[A-Z]\w*Rule\b/.test(file.text)).map((file) => file.path)).toEqual([]);
    expect(tree.some((file) => file.path === 'test/support/loopback-destination.ts')).toBe(true);
  });

  // Task 4 row N10 (decision C135 (3); design 06 row N10, SM-21). THE macOS MICROPHONE OPENER IS ADMITTED BY A CODE CONSTANT ALONE:
  // `MACOS_MICROPHONE_OPENER_ADMITTED = false` in the fence, flipped only by the M2b gate row (a decision row and a one-line commit).
  // A test may admit it for ONE wiring call by an explicit third argument (`ProductionWiringAdmission`); NO PRODUCTION CALL SITE
  // PASSES ONE - the form row 88 used for `provideProductionParts`'s one caller. Held: the constant's line and its one read, the
  // option named only by its declaration and that read, every production call of the wiring with exactly two arguments.
  // Mutants seen RED: the constant set to `true`; a third argument at the boot step's call.
  describe('row N10: the macOS microphone opener is admitted by the code constant alone; no production call site passes the test\'s admission', () => {
    const FENCE_INDEX = 'src/capture/fence/index.ts';
    const CONSTANT = 'export const MACOS_MICROPHONE_OPENER_ADMITTED = false;';
    const READ = 'const macosAdmitted = parts.platform === MACOS_MICROPHONE_OPENER_PLATFORM && (MACOS_MICROPHONE_OPENER_ADMITTED || admission?.admitMacosMicrophoneOpener === true);';
    /** The arguments of the call that starts at `from` (the index of its open bracket), counted at the call's own depth. */
    const argumentsAt = (text: string, from: number): number => {
      let depth = 0;
      let commas = 0;
      for (let at = from; at < text.length; at += 1) {
        const char = text[at];
        if (char === '(' || char === '{' || char === '[') depth += 1;
        else if (char === ')' || char === '}' || char === ']') {
          depth -= 1;
          if (depth === 0) return text.slice(from + 1, at).trim() === '' ? 0 : commas + 1;
        } else if (char === ',' && depth === 1) commas += 1;
      }
      return -1;
    };
    const violations = (files: readonly SourceFile[]): string[] =>
      files.flatMap((file) => {
        const own = file.path === FENCE_INDEX;
        const found: string[] = [];
        const option = (file.text.match(/\badmitMacosMicrophoneOpener\b/g) ?? []).length;
        if (option !== (own ? 2 : 0)) found.push(`${file.path} names the test's admission ${option} times`);
        const constant = (file.text.match(/\bMACOS_MICROPHONE_OPENER_ADMITTED\b/g) ?? []).length;
        if (constant !== (own ? 2 : 0)) found.push(`${file.path} names the admission constant ${constant} times`);
        if (own && !file.text.includes(CONSTANT)) found.push(`${file.path} states another value of the constant`);
        if (own && !file.text.includes(READ)) found.push(`${file.path} reads the admission otherwise`);
        for (const call of file.text.matchAll(/(?<!function )\bwireProductionRegistry\s*\(/g)) {
          const count = argumentsAt(file.text, (call.index ?? 0) + call[0].length - 1);
          if (count !== 2) found.push(`${file.path} calls the wiring with ${count} arguments`);
        }
        return found;
      });

    it('finds a third argument, a named admission, another value of the constant and an admission read from the environment (control)', () => {
      const fence = production.find((file) => file.path === FENCE_INDEX)?.text ?? '';
      expect(violations([
        { path: 'src/capture/x.ts', text: 'await wireProductionRegistry(parts, environment, { admitMacosMicrophoneOpener: true });' },
        { path: FENCE_INDEX, text: fence.replace(CONSTANT, 'export const MACOS_MICROPHONE_OPENER_ADMITTED = true;') },
        { path: FENCE_INDEX, text: fence.replace(': await wireProductionRegistry(parts, {', ': await wireProductionRegistry(parts, TESTING, {') },
        { path: 'src/capture/y.ts', text: "const open = process.env['DEMS_MACOS_OPENER'] === '1' || MACOS_MICROPHONE_OPENER_ADMITTED;" },
      ])).toEqual([
        "src/capture/x.ts names the test's admission 1 times",
        'src/capture/x.ts calls the wiring with 3 arguments',
        `${FENCE_INDEX} states another value of the constant`,
        `${FENCE_INDEX} calls the wiring with 3 arguments`,
        'src/capture/y.ts names the admission constant 1 times',
      ]);
      expect(argumentsAt('f(a, { b: g(c, d) }, [e, f])', 1)).toBe(3);
    });

    it('the constant is false with its one read; the option is named by its declaration and that read alone; the ONE production call of the wiring hands two arguments', () => {
      expect(violations(production)).toEqual([]);
      expect(places(production, /\bwireProductionRegistry\s*\(/g)).toEqual([FENCE_INDEX]);
      expect([...text(FENCE_INDEX).matchAll(/(?<!function )\bwireProductionRegistry\s*\(/g)]).toHaveLength(1);
      // The test's admission reaches the wiring only through its declared parameter.
      expect(text(FENCE_INDEX)).toContain('export async function wireProductionRegistry(parts: ProductionCaptureParts, environment: ProductionWiringEnvironment, admission?: ProductionWiringAdmission): Promise<BuiltProductionRegistry> {');
    });
  });

  // Task 4 row 85 (decision C46; code review finding F-07; gate M2, decision C50). Before: the capture unit mounted the
  // boot checks without host facts, `checks.ts` then ran neither step 4d nor 4e, and no real start was held to its host.
  // After: the mount ALWAYS hands both steps their dependencies; the facts come through one door that only the entry
  // point opens; with none handed in the host is one that cannot be seen, and a production start is refused.
  it('C46: steps 4d and 4e always get their dependencies; the facts come through ONE door, opened by the entry point alone; nothing under src/ states a host that passes; the two mount calls keep their members', () => {
    const mount = text('src/capture/boot/index.ts');
    // The step builds the host dependencies in every case, from what was handed in or from the host that cannot be seen.
    expect(mount.match(/hostChecksOf\(provided \?\? HOST_NOT_SEEN\)/g)).toHaveLength(1);
    expect(mount).toMatch(/async run\(\) \{\n {6}asked = true;\n {6}const hostChecks = hostChecksOf\(provided \?\? HOST_NOT_SEEN\);\n {6}outcome = await runCaptureBootChecks\(\{/);
    expect(mount).toMatch(/\.\.\.hostChecks,\n {8}sinks: mount\.sinks,/);
    expect(mount).not.toMatch(/facts === undefined|host === undefined/);
    // The host that cannot be seen has nothing in place: no limit, the option variable counts as set, no question is started.
    expect(mount).toMatch(/export const HOST_NOT_SEEN: CaptureBootHostFacts = Object\.freeze\(\{\n {2}platform: 'not-stated',\n {2}coreFileLimit: \(\): number \| null => null,\n {2}startArguments: Object\.freeze\(\[\]\),\n {2}nodeOptionsSet: true,\n {2}run: async \(\) => \(\{ outcome: 'NOT_STARTED' as const \}\),\n\}\);/);
    // No production source states a core-file limit of 0 as a fact: a passing host is the entry point's own process or a test's.
    expect(places(production, /\bcoreFileLimit\s*:\s*\(\s*\)\s*(?::[^=]*)?=>\s*0\b/g)).toEqual([]);
    expect(places([{ path: 'x.ts', text: 'const host = { coreFileLimit: () => 0 };' }], /\bcoreFileLimit\s*:\s*\(\s*\)\s*(?::[^=]*)?=>\s*0\b/g)).toEqual(['x.ts']);
    // The door: declared and implemented in the mount, called by the entry point and by no other production source.
    expect(places(production, /\.\s*provideHost\s*\(/g)).toEqual(['src/index.ts']);
    expect(places(production, /\bcaptureHostOfProcess\s*\(/g)).toEqual([HOST_FACTS, 'src/index.ts']);
    // The maker of the facts reads nothing itself: no process, no environment, no file; its facts are parameters.
    const facts = capture.filter((entry) => entry.path === HOST_FACTS);
    expect(facts).toHaveLength(1);
    for (const pattern of [PROCESS_MODULE, PROCESS_START, FILE_SYSTEM, SOCKET_OR_THREAD, GLOBAL_TIMER, ENVIRONMENT, SYSTEM_TIME, RANDOM]) expect(occurrences(facts, pattern), String(pattern)).toEqual([]);
    expect(text(HOST_FACTS)).not.toMatch(/\bprocess\s*\./);
    expect(text(HOST_FACTS).match(/^import .*$/gm)).toEqual(["import { startHelperProcess } from '../adapters/local';", "import type { CaptureTimers } from '../types';", "import { hostCommandRunnerOver, type CaptureHostDeps } from './host-checks';"]);
    // AD-08 (2): the capture unit's two mount calls hand in what they handed in before - sinks, timers, and the fence's
    // reload - and no seam: the host facts did NOT become a member of the mount call.
    const unit = text('src/capture/index.ts');
    expect([...unit.matchAll(/\bmount(?:CaptureFence|CaptureBootChecks)\(app, \{\n((?: {4}.*\n)+?) {2}\}\);/g)].map((match) => [...(match[1] ?? '').matchAll(/^ {4}(?:async )?([A-Za-z]+)[:(]/gm)].map((member) => member[1]))).toEqual([['timers', 'sinks', 'reloadState'], ['timers', 'sinks']]);
  });
});

// Task 4 row 157 (gate M6; security addendum AD-08 (2), (3); decisions C46, C50, C55 (DD-1, DD-3), C60, C63, C76).
// THE NO-TEST-SEAM RULE. The first full session on doubles (row 89) passes the real boot checks by real means: a signing
// key made by test support under `test/`, fixture operators, stand-in programs in its own configuration. So `src/` gains
// NOTHING for it, and this block holds that in three halves, each a function of a tree with a planted control:
//
//   (a) THE MOUNTS KEEP TODAY'S ARGUMENT MEMBERS. The two mount calls of the capture unit (the fence, the boot checks)
//       and the two statements of the entry point (the composition, the host-facts door) hand in the members of the
//       table `MOUNT_MEMBERS` and no other - by name, at every depth of the argument, each with the decision that
//       admitted it. A member added for a test (an injected check, a door, a clock, a spread) is a name outside the table.
//   (b) NO TEST KEY MAKER IN `src/`. No production source imports anything of `test/`, of a `__tests__` folder or a test
//       file (the key maker of row 89 lives under `test/support/`); the two injected checks of the boot are named by the
//       boot's own two files only (nobody in `src/` hands one in); a signing key is generated in one file.
//   (c) NO KEY, VARIABLE OR COMMAND-LINE WORD. The `DEMS_*` names of the production sources are the closed list
//       `CONFIGURATION_KEYS` (each with the row that admitted it), none of them says "test"; the files that read the
//       environment or the command line are closed lists, and the server's entry reads no command-line word.
//
// AMENDING: a new member or key is a decision - it adds ONE line to its table with the decision's number, never a pattern.
describe('row 157 / AD-08: no seam for the full-session test - mount members, no test key maker in src/, a closed list of configuration keys', () => {
  const UNIT = 'src/capture/index.ts';
  const ENTRY = 'src/index.ts';
  const text = (path: string): string => production.find((file) => file.path === path)?.text ?? '';

  /**
   * The member names an argument list hands in, for every call of `callee` in a source: each member of each object
   * literal of the arguments, with the path of the members above it (`sinks.info`), a spread as `...name`, a computed
   * key as `[computed]`. A function body and a type literal are closed: what a function DOES is not a member.
   */
  const argumentMembers = (source: string, callee: string): string[][] => {
    const calls: string[][] = [];
    for (const call of source.matchAll(new RegExp(`\\b${callee}\\s*\\(`, 'g'))) {
      const members: string[] = [];
      const frames: { object: boolean; closed: boolean; path: string; key: string; expectKey: boolean }[] = [{ object: false, closed: false, path: '', key: '', expectKey: false }];
      let before = '(';
      for (let at = (call.index ?? 0) + call[0].length; at < source.length && frames.length > 0; at += 1) {
        const char = source[at] ?? '';
        const top = frames[frames.length - 1];
        if (top === undefined || /\s/.test(char)) continue;
        if (top.object && !top.closed && top.expectKey && char !== '}') {
          const key = /^(?:async\s+(?=[A-Za-z_$[]))?(\.\.\.)?\s*([A-Za-z_$][\w$]*|\[|'[^']*'|"[^"]*")?/.exec(source.slice(at));
          const name = key?.[2] === '[' ? '[computed]' : `${key?.[1] ?? ''}${key?.[2] ?? '(expression)'}`;
          members.push(`${top.path}${name}`);
          top.key = name;
          top.expectKey = false;
          if (key?.[2] !== '[' && key !== null && key[0].length > 0) {
            at += key[0].length - 1;
            before = 'k';
            continue;
          }
        }
        if (char === "'" || char === '"' || char === '`') {
          at += 1;
          while (at < source.length && source[at] !== char) at += source[at] === '\\' ? 2 : 1;
        } else if (char === '(' || char === '[' || char === '{') {
          const object = char === '{' && /[(,:[?|&]/.test(before);
          frames.push({ object, closed: top.closed || (char === '{' && !object), path: top.object ? `${top.path}${top.key}.` : top.path, key: '', expectKey: object });
        } else if (char === ')' || char === ']' || char === '}') {
          frames.pop();
        } else if (char === ',' && top.object) {
          top.expectKey = true;
        }
        before = char;
      }
      calls.push(members);
    }
    return calls;
  };

  /**
   * TODAY'S MEMBERS, with the decision that admitted each. `where` is the one production file that makes the call.
   * (The declarations of the four functions stand in other files; the call sites are counted below.)
   */
  const MOUNT_MEMBERS: readonly { readonly where: string; readonly callee: string; readonly members: readonly (readonly [member: string, admittedBy: string])[] }[] = [
    {
      where: UNIT,
      callee: 'mountCaptureFence',
      members: [
        ['timers', 'task 3 row 136 (capture spec §A.1.2): the system timers'],
        ['sinks', 'task 3 row 136: the four log sinks of the one file that logs (G-R4)'],
        ['sinks.info', 'task 3 row 136'],
        ['sinks.warn', 'task 3 row 136'],
        ['sinks.error', 'task 3 row 136'],
        ['sinks.persist', 'task 3 row 136: the error log'],
        ['reloadState', 'task 3 row 136: the engine re-reads a device row the boot registered'],
      ],
    },
    {
      where: UNIT,
      callee: 'mountCaptureBootChecks',
      members: [
        ['timers', 'task 3 row 61 (ruling D138): the system timers'],
        ['sinks', 'task 3 row 61: the four log sinks'],
        ['sinks.info', 'task 3 row 61'],
        ['sinks.warn', 'task 3 row 61'],
        ['sinks.error', 'task 3 row 61'],
        ['sinks.persist', 'task 3 row 61: the error log'],
        // Decision C55 (DD-1), kept by C50 / C46: the host facts did NOT become a member here - they go through the door below.
      ],
    },
    {
      where: ENTRY,
      callee: 'composeProductionCaptureOf',
      members: [
        ['platform', 'task 4 row 85b, decisions C55 and C60: the platform of this process'],
        ['network', 'integration pass I-9a, decision C76 (row 108; C60 (4)): the reader of the network facts, handed in and not called'],
        // NAMED AMENDMENT SR-11 (decision C82, row 106c): ONE member more. Its one use in the composing file is pinned in the block of row 80.
        ['hostRunner', 'task 4 row 106c, decision C82 (SR-11): the runner of the host\'s questions, for the single purpose of reading the address helper\'s interface file by a fixed row'],
      ],
    },
    {
      where: ENTRY,
      callee: 'provideHost',
      members: [
        ['platform', 'task 4 row 85, decisions C46 and C55 (DD-1: the door, not an option of `buildApp`)'],
        ['startArguments', 'task 4 row 85, decisions C46 and C55 (DD-1)'],
        ['nodeOptionsSet', 'task 4 row 85, decisions C46 and C55 (DD-1)'],
        ['userLimits', 'task 4 row 85, decisions C46 and C55 (DD-1)'],
      ],
    },
  ];
  const mountViolations = (files: readonly SourceFile[]): string[] =>
    MOUNT_MEMBERS.flatMap((mount) => {
      const allowed = mount.members.map(([member]) => member);
      const calls = files.filter((file) => file.path === mount.where).flatMap((file) => argumentMembers(file.text, mount.callee));
      return [
        ...(calls.length === 1 ? [] : [`${mount.where} calls ${mount.callee} ${calls.length} times`]),
        ...calls.flatMap((members) => [
          ...members.filter((member) => !allowed.includes(member)).map((member) => `${mount.where} hands ${mount.callee} the member ${member}`),
          ...allowed.filter((member) => !members.includes(member)).map((member) => `${mount.where} no longer hands ${mount.callee} the member ${member}`),
        ]),
      ];
    });

  it('(a) control: an extra member of a mount is seen - a top-level one, a nested one, a spread, a computed key, one inside a call; a function body is not a member', () => {
    const fence = "mountCaptureFence(app, {\n  timers: createSystemTimers(),\n  sinks: {\n    info: (fields, message) => app.log.info(fields, message),\n    warn: (fields, message) => app.log.warn(fields, message),\n    error: (fields, message) => app.log.error(fields, message),\n    persist: (entry) => app.errorLog.append(entry),\n  },\n  async reloadState() {\n    if (!app.seams.has('engine')) return;\n    await app.engine.start('resync', { again: true });\n  },\n});";
    const boot = 'mountCaptureBootChecks(app, {\n  timers: createSystemTimers(),\n  sinks: { info, warn, error, persist },\n});';
    const entry = "composeProductionCaptureOf(app, { platform: process.platform, network: captureNetworkFacts(app), hostRunner: captureHostRunnerOf(createSystemTimers()) });\ncaptureBootControl(app).provideHost(\n  captureHostOfProcess(\n    {\n      platform: process.platform,\n      startArguments: process.execArgv,\n      nodeOptionsSet: flag !== undefined,\n      userLimits: () => (report() as { readonly userLimits?: unknown } | undefined)?.userLimits,\n    },\n    createSystemTimers(),\n  ),\n);";
    const planted = (unit: string, entryText: string = entry): SourceFile[] => [{ path: UNIT, text: unit }, { path: ENTRY, text: entryText }];
    // The members as they stand pass, in either layout.
    expect(mountViolations(planted(`${fence}\n${boot}`))).toEqual([]);
    expect(argumentMembers(fence, 'mountCaptureFence')).toEqual([['timers', 'sinks', 'sinks.info', 'sinks.warn', 'sinks.error', 'sinks.persist', 'reloadState']]);
    // AD-08's own example: the boot-check mount with one of the two injected checks.
    expect(mountViolations(planted(`${fence}\n${boot.replace('  sinks:', '  signingKeyIsDevelopment: () => false,\n  sinks:')}`))).toEqual([`${UNIT} hands mountCaptureBootChecks the member signingKeyIsDevelopment`]);
    expect(mountViolations(planted(`${fence}\n${boot.replace('persist }', 'persist, audit }')}`))).toEqual([`${UNIT} hands mountCaptureBootChecks the member sinks.audit`]);
    expect(mountViolations(planted(`${fence}\n${boot.replace('  sinks:', '  ...config.captureTestMount,\n  sinks:')}`))).toEqual([`${UNIT} hands mountCaptureBootChecks the member ...config`]);
    expect(mountViolations(planted(`${fence}\n${boot.replace('  sinks:', '  [seamName]: seam,\n  sinks:')}`))).toEqual([`${UNIT} hands mountCaptureBootChecks the member [computed]`]);
    expect(mountViolations(planted(`${fence.replace('timers: createSystemTimers(),', 'timers: timersOf({ fake: true }),\n  door: testDoor,')}\n${boot}`))).toEqual([`${UNIT} hands mountCaptureFence the member timers.fake`, `${UNIT} hands mountCaptureFence the member door`]);
    // The entry point: a third member of the composition, a fifth host fact, a member taken away, a second call.
    // Since SR-11 (decision C82, row 106c) the statement has three members. The three OPTIONAL members of `ProductionCaptureInput`
    // that stand in the place of a product part (`cardPrograms` of row 85c; `aliasTransport` and `aliasInterfaceFile` of
    // row 106b, decision C82 (3)) are a test's: the entry hands in none of them. So is the runner taken away, or made twice.
    // Row 111b adds the fourth such member, `commissioningInputs` (the host's observations over stand-in programs): a test's too.
    for (const seam of ['cardPrograms', 'aliasTransport', 'aliasInterfaceFile', 'commissioningInputs']) {
      expect(mountViolations(planted(`${fence}\n${boot}`, entry.replace('createSystemTimers()) }', `createSystemTimers()), ${seam}: standIn }`))), seam).toEqual([`${ENTRY} hands composeProductionCaptureOf the member ${seam}`]);
    }
    expect(mountViolations(planted(`${fence}\n${boot}`, entry.replace(', hostRunner: captureHostRunnerOf(createSystemTimers()) }', ' }')))).toEqual([`${ENTRY} no longer hands composeProductionCaptureOf the member hostRunner`]);
    expect(mountViolations(planted(`${fence}\n${boot}`, entry.replace('createSystemTimers()) }', 'createSystemTimers()), aliasRunner: captureHostRunnerOf(createSystemTimers()) }')))).toEqual([`${ENTRY} hands composeProductionCaptureOf the member aliasRunner`]);
    expect(mountViolations(planted(`${fence}\n${boot}`, entry.replace('      platform: process.platform,\n', '      platform: process.platform,\n      coreFileLimit: () => 0,\n')))).toEqual([`${ENTRY} hands provideHost the member coreFileLimit`]);
    expect(mountViolations(planted(`${fence}\n${boot.replace('  timers: createSystemTimers(),\n', '')}`))).toEqual([`${UNIT} no longer hands mountCaptureBootChecks the member timers`]);
    expect(mountViolations(planted(`${fence}\n${boot}\n${boot}`))).toEqual([`${UNIT} calls mountCaptureBootChecks 2 times`]);
  });

  it('(a) the two mount calls of the capture unit and the two statements of the entry point hand in today\'s members and no other; each is called from its one place, with its text as it stands', () => {
    expect(mountViolations(production)).toEqual([]);
    // One call site each, beside the declaration: no second mount with other members anywhere under src/.
    expect(places(production, /\bmountCaptureFence\s*\(/g).sort()).toEqual(['src/capture/fence/index.ts', UNIT]);
    expect(places(production, /\bmountCaptureBootChecks\s*\(/g).sort()).toEqual(['src/capture/boot/index.ts', UNIT]);
    expect(text('src/capture/fence/index.ts').match(/\bmountCaptureFence\s*\(/g)).toHaveLength(1);
    expect(text('src/capture/boot/index.ts').match(/\bmountCaptureBootChecks\s*\(/g)).toHaveLength(1);
    // The VALUES of the members, literally (comments are not read): the system timers, the app's own log and error log, the engine's resync.
    const unit = text(UNIT).replace(/\n\s*\n/g, '\n');
    const sinks = '    sinks: {\n      info: (fields, message) => app.log.info(fields, message),\n      warn: (fields, message) => app.log.warn(fields, message),\n      error: (fields, message) => app.log.error(fields, message),\n      persist: (entry) => app.errorLog.append(entry),\n    },\n';
    expect(unit.split(`  mountCaptureFence(app, {\n    timers: createSystemTimers(),\n${sinks}    async reloadState() {\n      if (!app.seams.has('engine')) return;\n      await app.engine.stop();\n      await app.engine.start('resync');\n    },\n  });\n`)).toHaveLength(2);
    expect(unit.split(`  mountCaptureBootChecks(app, {\n    timers: createSystemTimers(),\n${sinks}  });\n`)).toHaveLength(2);
    // The entry statements are pinned literally in the block 'P25' above (`index.ts: the supervisor boots ...`): C76's text of the composition, C46's four facts.
    // Since row 106c (decision C82, NAMED AMENDMENT SR-11) the composition's text has its third member, the runner of the host's questions.
    expect(text(ENTRY).split('composeProductionCaptureOf(app, { platform: process.platform, network: captureNetworkFacts(app), hostRunner: captureHostRunnerOf(createSystemTimers()) });')).toHaveLength(2);
  });

  // (b) The key maker of the full-session test is test support (row 89: `apps/core-server/test/support/`). Its name does
  // not exist yet, so the rule is held by WHERE it lives and by what it would have to do under `src/`.
  const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;
  const OF_TEST = /(?:^|\/)(?:test|__tests__)(?:\/|$)|\.test(?:\.[cm]?[jt]s)?$|(?:^|\/)(?:test-)?fixtures?(?:\/|$)/;
  const testImports = (files: readonly SourceFile[]): string[] =>
    files.flatMap((file) => [...file.text.matchAll(IMPORT_SPECIFIER)].map((match) => match[1] ?? '').filter((specifier) => OF_TEST.test(specifier)).map((specifier) => `${file.path} imports ${specifier}`));
  /** The two checks a test may inject into the boot (AD-08 (1)): named by the boot's own two files, handed in by no production source. */
  const INJECTED_CHECK = new RegExp(`\\b(?:${join('signingKey', 'IsDevelopment')}|${join('demoPassword', 'Operators')})\\b`, 'g');
  const KEY_GENERATION = new RegExp(`\\b${join('generateKey', 'Pair')}(?:Sync)?\\b`, 'g');
  const KEY_PROVISION = new RegExp(`\\b${join('provision', 'SigningKey')}\\s*\\(`, 'g');

  it('(b) control: an importer of the test support\'s key maker is seen - by a relative path, a dynamic import, a __tests__ folder, a test file; so is a second key generator', () => {
    const planted: SourceFile[] = [
      { path: 'src/capture/boot/index.ts', text: "import { makeProductionSigningKey } from '../../../test/support/production-key';" },
      { path: 'src/sealing/signing.ts', text: "const { makeKey } = await import('../../test/support/production-key.js');\nimport { rig } from './__tests__/key-rig';" },
      { path: 'src/capture/x.ts', text: `import '../sealing/__tests__/production-key.test';\nconst pair = ${join('generateKey', 'Pair')}Sync('ed25519');\nconst check = { ${join('signingKey', 'IsDevelopment')}: () => false };` },
      { path: 'src/capture/y.ts', text: "import { createSystemTimers } from './timers';\nimport { latest } from '../contest/index';" },
    ];
    expect(testImports(planted)).toEqual([
      'src/capture/boot/index.ts imports ../../../test/support/production-key',
      'src/sealing/signing.ts imports ../../test/support/production-key.js',
      'src/sealing/signing.ts imports ./__tests__/key-rig',
      'src/capture/x.ts imports ../sealing/__tests__/production-key.test',
    ]);
    expect(occurrences(planted, KEY_GENERATION)).toEqual(['src/capture/x.ts:2']);
    expect(occurrences(planted, INJECTED_CHECK)).toEqual(['src/capture/x.ts:3']);
  });

  it('(b) no production source under src/ imports test support; the two injected checks are named by the boot alone; a signing key is generated in one file and provisioned from two', () => {
    expect(production.length).toBeGreaterThan(300);
    expect(testImports(production)).toEqual([]);
    // Nobody under src/ hands the boot one of its two injectable checks: the mount (which declares them) and the checks (which ask them).
    expect(places(production, INJECTED_CHECK)).toEqual(['src/capture/boot/checks.ts', 'src/capture/boot/index.ts']);
    // A key maker under src/ would generate a key pair: one file does (the signer's key store, row 83), and its one
    // function is called by the development key of the sealing host only. The production key is made by the commands
    // under `cli/` (outside src/), the test's key by test support.
    expect(places(production, KEY_GENERATION)).toEqual([SIGNER_HOST_KEY]);
    expect(places(production, KEY_PROVISION)).toEqual([SIGNER_HOST_KEY, 'src/sealing/signing.ts']);
  });

  /**
   * (c) THE CLOSED LIST of the configuration keys: every `DEMS_*` name a production source of the server writes in its
   * code (declaration, parser, a sentence of a refusal), with the row that admitted it. As it stands at row 157: 22;
   * +2 on 2026-11-04: the panel bridge URL and the installer's certificate fingerprint (checkpoint f85e9c01);
   * +4 on 2026-11-05: the four keys of SMART ATTACH (decision D62).
   */
  const CONFIGURATION_KEYS: readonly (readonly [key: string, admittedBy: string])[] = [
    ['DEMS_CAMERA_AUTOATTACH', 'decision D62 (ratified 2026-11-05): the flag of SMART ATTACH - `1` turns the segment sweep on, off everywhere else'],
    ['DEMS_CAMERA_DEFAULT_PASSWORD', 'decision D62 (2026-11-05): the bench camera password as a `Secret`, read ONLY to test and store an auto-adopted camera'],
    ['DEMS_CAMERA_DEFAULT_USER', 'decision D62 (2026-11-05): the bench camera user name of the auto-adopt connection test'],
    ['DEMS_CAMERA_SEGMENT_CIDR', 'decision D62 (2026-11-05): the one IPv4 `/24` the sweep reads; required while the sweep is on'],
    ['DEMS_CAPTURE_ALIAS_SOCKET', 'task 4 row 105 (WP-19b): the socket of the address helper'],
    ['DEMS_CAPTURE_AUDIO_HELPER', 'task 4 row 85c (decisions C60 (3), C63 (c)): the audio helper of production capture'],
    ['DEMS_CAPTURE_DEV_FAKE_MIC', 'task 3 fix wave H (ruling D198): what the first generated development microphone plays'],
    ['DEMS_CAPTURE_DEV_SOURCES', 'task 3 row 136 (decisions OD-14, D108): the development flag'],
    ['DEMS_CAPTURE_GUARD', 'task 4 row 21 (WP-02): the guard of a helper'],
    ['DEMS_CAPTURE_HELPER_FFMPEG', 'task 3 row 136 (decisions OD-14, D108): the program of the development helpers'],
    ['DEMS_CAPTURE_MODE', 'task 3 row 58 (decision OD-14; capture spec §I edits 7 to 10)'],
    ['DEMS_CAPTURE_RELAY', 'task 4 row 21 (WP-02): the relay of a camera'],
    ['DEMS_CAPTURE_WORKER', 'task 3 row 58 (decision OD-14)'],
    ['DEMS_CORE_PORT', 'plan row W08 (the frozen configuration)'],
    ['DEMS_DEMO_CONTROLS', 'plan row W08'],
    ['DEMS_DEVICE_CERT_FINGERPRINT', 'the seed factory of the bare-metal installer (`src/db/seed/factory.ts`, 2026-11-03): the fingerprint the pairing screen shows'],
    ['DEMS_INSTALLATION_DEVICE_ID', 'task 3 wave H closing pass Z1 (decision D207)'],
    ['DEMS_INSTALLATION_NAME', 'task 3 wave H closing pass Z1 (decision D207)'],
    ['DEMS_LCD_BACKEND_URL', 'LCD integration (user request 2026-10-19; joined the tree with the task-4 checkpoint f85e9c01 of 2026-11-03): the backend URL of the panel bridge'],
    ['DEMS_LOG_LEVEL', 'plan row W08'],
    ['DEMS_MEDIA_DIR', 'task 3 row 58 (decision OD-14)'],
    ['DEMS_PG_APP_PASSWORD', 'plan row W08: the connection of the app role'],
    ['DEMS_PG_APP_ROLE', 'plan row W08'],
    ['DEMS_PG_DATABASE', 'plan row W08'],
    ['DEMS_PG_HOST', 'plan row W08'],
    ['DEMS_PG_OWNER_PASSWORD', 'the database commands (`src/db/commands/owner-connection.ts`): the owner role'],
    ['DEMS_PG_OWNER_ROLE', 'the database commands: the owner role'],
    ['DEMS_PG_PORT', 'plan row W08'],
  ];
  const KEY_NAME = /\bDEMS_[A-Z0-9_]+\b/g;
  /** A name that says what it is for: a test, a double, a way round a check. `FAKE` is not of the list: `DEMS_CAPTURE_DEV_FAKE_MIC` is a development source, admitted by D198. */
  const SAYS_TEST = /TEST|E2E|FIXTURE|DOUBLE|STUB|MOCK|SEAM|BYPASS|SKIP|FULL_SESSION|INSECURE|UNSAFE/;
  const keyViolations = (files: readonly SourceFile[]): string[] => {
    const allowed = CONFIGURATION_KEYS.map(([key]) => key);
    return [...new Set(files.flatMap((file) => (file.text.match(KEY_NAME) ?? []).filter((key) => !allowed.includes(key)).map((key) => `${file.path} names the key ${key}`)))];
  };
  const ARGUMENT_WORDS = new RegExp(`\\bprocess\\s*\\.\\s*${'argv'}\\b|\\bparse${'Args'}\\s*\\(`, 'g');
  const START_ARGUMENTS = new RegExp(`\\bprocess\\s*\\.\\s*exec${'Argv'}\\b`, 'g');
  const ENVIRONMENT_NAME = new RegExp(`\\bprocess\\s*\\.\\s*${'env'}\\s*(?:\\[\\s*['"]([^'"]+)['"]\\s*\\]|\\.\\s*([A-Za-z_]\\w*))`, 'g');

  it('(c) control: a new DEMS_* key is seen, and a name that says test is seen; so are a new reader of the environment and a new reader of the command line', () => {
    const planted: SourceFile[] = [
      { path: 'src/config.ts', text: "export const ENV_CAPTURE_MODE = 'DEMS_CAPTURE_MODE';\nexport const ENV_CAPTURE_TEST_SIGNING_KEY = 'DEMS_CAPTURE_TEST_SIGNING_KEY';" },
      { path: 'src/capture/boot/index.ts', text: `const skip = process.${'env'}['DEMS_BOOT_CHECKS_SKIP'] === '1' || process.${'env'}.FULL_SESSION;\nconst flag = process.${'argv'}.includes('--full-session');` },
    ];
    expect(keyViolations(planted)).toEqual(['src/config.ts names the key DEMS_CAPTURE_TEST_SIGNING_KEY', 'src/capture/boot/index.ts names the key DEMS_BOOT_CHECKS_SKIP']);
    expect(['DEMS_CAPTURE_TEST_SIGNING_KEY', 'DEMS_BOOT_CHECKS_SKIP', 'DEMS_CAPTURE_E2E', 'DEMS_CAPTURE_DEV_FAKE_MIC', 'DEMS_CAPTURE_AUDIO_HELPER'].filter((key) => SAYS_TEST.test(key))).toEqual(['DEMS_CAPTURE_TEST_SIGNING_KEY', 'DEMS_BOOT_CHECKS_SKIP', 'DEMS_CAPTURE_E2E']);
    expect(occurrences(planted, ENVIRONMENT)).toEqual(['src/capture/boot/index.ts:1', 'src/capture/boot/index.ts:1']);
    expect([...(planted[1]?.text ?? '').matchAll(ENVIRONMENT_NAME)].map((match) => match[1] ?? match[2])).toEqual(['DEMS_BOOT_CHECKS_SKIP', 'FULL_SESSION']);
    expect(occurrences(planted, ARGUMENT_WORDS)).toEqual(['src/capture/boot/index.ts:2']);
  });

  it('(c) the DEMS_* names of src/ are the closed list, none says test; the environment and the command line are read by the closed lists of files; the server\'s entry reads no command-line word', () => {
    expect(keyViolations(production)).toEqual([]);
    const named = [...new Set(production.flatMap((file) => file.text.match(KEY_NAME) ?? []))].sort();
    expect(named).toEqual(CONFIGURATION_KEYS.map(([key]) => key));
    expect(named).toHaveLength(28); // two keys joined with the task-4 checkpoint of 2026-11-03, four with decision D62 of 2026-11-05
    expect(named.filter((key) => SAYS_TEST.test(key))).toEqual([]);
    // The sources of src/ that are not TypeScript name no key either (a script, a JSON file, a statement file).
    expect(tree.filter((file) => isProductionSource(file.path) && !file.path.endsWith('.ts') && KEY_NAME.test(file.text)).map((file) => file.path)).toEqual([]);
    // ENVIRONMENT: the entry point of the server and the three command files of the database; nothing under src/capture/ (G-R8).
    expect(places(production, ENVIRONMENT)).toEqual(['src/db/commands/cli.ts', 'src/db/reset/cli.ts', 'src/db/seed/cli.ts', ENTRY]);
    // A variable read off the environment BY NAME: one, the runtime's own option variable, a fact for the host check (C46).
    expect(production.flatMap((file) => [...file.text.matchAll(ENVIRONMENT_NAME)].map((match) => `${file.path}: ${match[1] ?? match[2]}`))).toEqual([`${ENTRY}: NODE_OPTIONS`]);
    // COMMAND LINE: the two command files that are started as programs of their own. The server's entry reads no word of
    // its command line; it reads the RUNTIME's start arguments once, to judge them (C46), and repeats none.
    expect(places(production, ARGUMENT_WORDS)).toEqual(['src/db/commands/cli.ts', 'src/sealing/dev-key-cli.ts']);
    expect(places(production, START_ARGUMENTS)).toEqual([ENTRY]);
    expect(text(ENTRY).match(START_ARGUMENTS)).toHaveLength(1);
  });
});
