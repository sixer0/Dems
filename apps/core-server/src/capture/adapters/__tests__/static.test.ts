// Static rules of the adapter layer (blueprint row 65 / M4-W1; capture spec §A.1 "class-C adapters
// must never load in a test", §A.6 SEC35-04, §G; D86 C-5). The rules of the whole capture folder
// (G-R1 to G-R8: no file system, process, socket, timer, clock, random or environment; no
// credential-shaped text; no log call) already hold for `src/capture/adapters/**` through
// `src/capture/__tests__/static.test.ts`. This file adds what is the adapter layer's own:
//
//   A-1  the class-C adapter files are imported by the loader `real.ts` only; the loader is
//        imported by no production file statically and by no test but its own refusal test;
//   A-2  the two members of a credential are read in `credential.ts` only, and no file composes a
//        locator with a user part;
//   A-3  the statement of the microphone transport is held to the worker's source;
//   A-4  the device commands are the contract's, and the operation map is the contract's inverted;
//   A-5  the layer is reached by the units that wire it (a pinned list), and from outside the
//        capture unit through its index only (row 61 closed the earlier "wired into nothing yet").
//   A-7  the adapter kinds of this layer are the value set of `capture_devices.adapter_kind` in
//        the typed schema, compared with each other directly (row 97; A-6 is the codec word).
//   A-8  the start message is made into bytes by the production door only, which makes no text of
//        them and hands them to nothing but the write and the zero-fill (task 4 row 21; AD-03 (6)).
//   A-9  the production adapters built beside the class-C stubs are named by no production source
//        before the lift (task 4 row 46; addendum 6.2). A-2 names the one caller of the injection point.
//
// Each rule has a control on a planted source that must be found.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEVICE_COMMAND_OPERATIONS } from '@dems/shared/api';
import { DeviceCommand } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { relativeImports } from '../../../../test/static/imports';
import { REPOSITORY, SCAN_COVERS, WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, scanCoverage, type SourceFile } from '../../../../test/static/scan';
import { CAPTURE_ADAPTER_KIND } from '../../../db/schema/value-sets';
import { DEVICE_COMMAND_OF_OPERATION } from '../../../modules/devices';
import { CAPTURE_DEVICE_COMMANDS, SEAM_OF_DEVICE_COMMAND, operationOfDeviceCommand } from '../commands';
import { CAPTURE_ADAPTER_KINDS, CaptureAdapterKind } from '../kinds';
import { MIC_CLOCK_COMPENSATION_PPM, MIC_EXACT_SOURCE_BITS, MIC_LATENESS_TARGET_MS, MIC_PCM24_SCALE, MIC_TRANSPORTS, MIC_WORKER_BUFFER_CAP_MS, micPipePath, withinMicClockRange } from '../mic-transport';

const ADAPTERS = 'src/capture/adapters/';
const tree = codeOnly(readTree(WORKSPACE).filter((file) => /\.[cm]?tsx?$/.test(file.path)));
const adapters = tree.filter((file) => file.path.startsWith(ADAPTERS) && isProductionSource(file.path));

/** The class-C adapter files, without extension (structured §9 C-1 to C-4). */
const CLASS_C = [`${ADAPTERS}camera/onvif-rtsp`, `${ADAPTERS}audio/usb-audio`, `${ADAPTERS}poe/snmp-poe`];
const LOADER = `${ADAPTERS}real`;
const LOADER_TEST = `${ADAPTERS}__tests__/real.test.ts`;

/** A-1, as a function of a tree, so that the control can run it on planted files. */
function classCViolations(files: readonly SourceFile[]): string[] {
  const imports = relativeImports(files);
  const naming = imports.filter((entry) => CLASS_C.includes(entry.target) && entry.file !== `${LOADER}.ts`).map((entry) => `${entry.file}:${entry.line} imports a class-C adapter`);
  const loading = imports
    .filter((entry) => entry.target === LOADER && entry.file !== LOADER_TEST)
    .map((entry) => `${entry.file}:${entry.line} imports the class-C loader`);
  return [...naming, ...loading];
}

/** A read of a credential member: `.secret` or `.username` after any expression. */
const CREDENTIAL_MEMBER = /\.\s*(?:secret|username)\b/g;
/** A locator composed with a user part: two slashes, then an interpolation or a joined value, then `@`. */
const USER_PART_COMPOSED = /\/\/\$\{[^}]*\}(?::\$\{[^}]*\})?@|['"`]@['"`]\s*\+|\+\s*['"`]@/g;

describe('the scan itself', () => {
  it('reads the adapter layer: every production file of the folder, the class-C adapters among them', () => {
    expect(scanCoverage(adapters, [ADAPTERS])).toEqual(SCAN_COVERS);
    for (const path of CLASS_C) expect(adapters.some((file) => file.path === `${path}.ts`), path).toBe(true);
  });
});

describe('A-1: the class-C adapters never load in a test', () => {
  it('finds a planted import of a class-C adapter and of the loader (control)', () => {
    const UP = '..';
    const planted: SourceFile[] = [
      { path: `${ADAPTERS}__tests__/x.test.ts`, text: `import { createOnvifRtspCameraAdapter } from '${UP}/camera/onvif-rtsp';\n` },
      { path: 'test/support/y.ts', text: `const real = await import('${UP}/../src/capture/adapters/poe/snmp-poe');\n` },
      { path: `${ADAPTERS}index.ts`, text: `export { loadProductionAdapters } from './real';\n` },
      { path: 'src/modules/capture-config/z.ts', text: `import { createUsbAudioInputAdapter } from '${UP}/../capture/adapters/audio/usb-audio';\n` },
      { path: `${ADAPTERS}fake/index.ts`, text: `import { loadProductionAdapters } from '${UP}/real';\n` },
      // Allowed: the loader's own imports, and its own refusal test.
      { path: `${LOADER}.ts`, text: `await import('./camera/onvif-rtsp');\n` },
      { path: LOADER_TEST, text: `import { loadProductionAdapters } from '${UP}/real';\n` },
    ];
    expect(classCViolations(planted)).toEqual([
      `${ADAPTERS}__tests__/x.test.ts:1 imports a class-C adapter`,
      'test/support/y.ts:1 imports a class-C adapter',
      'src/modules/capture-config/z.ts:1 imports a class-C adapter',
      `${ADAPTERS}index.ts:1 imports the class-C loader`,
      `${ADAPTERS}fake/index.ts:1 imports the class-C loader`,
    ]);
  });

  it('no file of the workspace but the loader names a class-C adapter; nothing but its refusal test imports the loader', () => {
    expect(classCViolations(tree)).toEqual([]);
    // The loader does name all three, and only through an import that runs when it is called.
    const loader = tree.find((file) => file.path === `${LOADER}.ts`)?.text ?? '';
    expect(relativeImports([{ path: `${LOADER}.ts`, text: loader }]).filter((entry) => CLASS_C.includes(entry.target)).map((entry) => entry.target)).toEqual(CLASS_C);
    expect(loader).not.toMatch(/^import\s[^;]*from\s+'\.\/(?:camera|audio|poe)\//m);
    expect(loader.indexOf('REAL_ADAPTERS_REFUSED')).toBeGreaterThan(0);
    expect(loader.indexOf('REAL_ADAPTERS_REFUSED')).toBeLessThan(loader.indexOf('import('));
  });

  it('a class-C adapter has no opener and builds nothing: no import but the layer\'s own files', () => {
    for (const path of CLASS_C) {
      const text = tree.find((file) => file.path === `${path}.ts`)?.text ?? '';
      expect(text, path).toMatch(/hasOpener: false,|seam: 'POE'/);
      expect([...text.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]).filter((specifier) => !/^\.\.\/(?:errors|kinds|types)$/.test(specifier ?? '')), path).toEqual([]);
    }
  });
});

describe('A-2: a credential is read in one file, and no locator is composed with a user part (SEC35-04)', () => {
  it('finds a planted read and a planted composition (control)', () => {
    const planted: SourceFile[] = [
      { path: 'a.ts', text: 'const text = `${scheme}//${credential.username}:${credential.secret}@${host}/${path}`;\n' },
      { path: 'b.ts', text: "const url = scheme + '//' + user + ':' + pass + '@' + host;\n" },
      { path: 'c.ts', text: 'log.info({ who: request.body.credential.username });\n' },
    ];
    expect(occurrences(planted, CREDENTIAL_MEMBER)).toEqual(['a.ts:1', 'a.ts:1', 'c.ts:1']);
    expect(occurrences(planted, USER_PART_COMPOSED)).toEqual(['a.ts:1', 'b.ts:1']);
  });

  it('only credential.ts reads a credential member; no file of the capture folder composes a user part', () => {
    const capture = tree.filter((file) => file.path.startsWith('src/capture/') && isProductionSource(file.path));
    expect([...new Set(occurrences(capture, CREDENTIAL_MEMBER).map((place) => place.replace(/:\d+$/, '')))]).toEqual([`${ADAPTERS}credential.ts`]);
    expect(occurrences(capture, USER_PART_COMPOSED)).toEqual([]);
  });

  // Task 4 row 46 (addendum 2.3 step 3 and 2.6 "callers of `credentialAtInjection` outside `credential.ts`: 1 file";
  // the request of row 45): until row 46 this case read "no caller in the product yet". The one caller is the relay
  // start of the production camera adapter, once; that adapter is registered nowhere before the lift (A-9).
  it('the injection point has exactly one caller in the product, the relay start of the production camera adapter, at one line', () => {
    const production = tree.filter((file) => isProductionSource(file.path));
    const INJECTION = /\bcredentialAtInjection\s*\(/g;
    const RELAY_START = `${ADAPTERS}camera/relay-start.ts`;
    const callers = occurrences(production, INJECTION).map((place) => place.replace(/:\d+$/, ''));
    expect([...new Set(callers)].sort()).toEqual([RELAY_START, `${ADAPTERS}credential.ts`]);
    // In `credential.ts` the one place is the declaration; in the relay start it is one call, whose result is a member of the start message.
    expect(callers.filter((path) => path === RELAY_START)).toHaveLength(1);
    const relayStart = tree.find((file) => file.path === RELAY_START)?.text ?? '';
    expect(relayStart).toMatch(/^ {4}access: credentialAtInjection\(start\.locator, start\.sealed\),$/m);
    // The relay is started with no argument and an empty environment: the message is the one carrier.
    expect(relayStart).toMatch(/return start\.door\(\{ command: start\.program, args: \[\], env: \{\}, message, timers: start\.timers, onOutput: start\.onOutput \}\);/);
    // Control: a second caller would be seen.
    expect(occurrences([{ path: 'x.ts', text: 'const access = credentialAtInjection(locator, sealed);' }], INJECTION)).toEqual(['x.ts:1']);
  });
});

describe('A-3: the microphone transport states the worker\'s clock range and its lateness bound (D72(j), D85 R-3)', () => {
  const WORKER_AUDIO = resolve(REPOSITORY, 'apps/capture-worker/src/audio.c');

  it('the statement: +-5,000 ppm followed; beyond it the lateness is bounded by what the worker\'s buffer holds', () => {
    expect(MIC_TRANSPORTS.PCM_FIFO).toEqual({ kind: 'PCM_FIFO', sampleFormat: 'F32LE', sampleRateHz: 48_000, channels: 1, placement: 'ARRIVAL', clockCompensationPpm: 5_000, latenessBeyondRangeMs: 2_000, reportsOutOfRange: false });
    expect([0, 100, -2_000, 5_000, -5_000].every(withinMicClockRange)).toBe(true);
    expect([5_001, -5_000.5, Number.NaN, Number.POSITIVE_INFINITY].some(withinMicClockRange)).toBe(false);
    expect(MIC_LATENESS_TARGET_MS).toBeLessThan(MIC_WORKER_BUFFER_CAP_MS);
  });

  it('is the worker\'s own: the two numbers are read from apps/capture-worker/src/audio.c', () => {
    expect(existsSync(WORKER_AUDIO)).toBe(true);
    const source = readFileSync(WORKER_AUDIO, 'utf8');
    const ppm = /^#define MIC_MAX_PPM (\d+)\b/m.exec(source);
    const cap = /^#define FIFO_CAP \(SR \* (\d+)\)/m.exec(source);
    expect(Number(ppm?.[1])).toBe(MIC_CLOCK_COMPENSATION_PPM);
    // The buffer is a whole number of seconds of samples: the bound in milliseconds follows.
    expect(Number(cap?.[1]) * 1_000).toBe(MIC_WORKER_BUFFER_CAP_MS);
    // Control: a worker that changed either number would be seen.
    expect(Number(/^#define MIC_MAX_PPM (\d+)\b/m.exec(source.replace('MIC_MAX_PPM 5000', 'MIC_MAX_PPM 4000'))?.[1])).not.toBe(MIC_CLOCK_COMPENSATION_PPM);
  });

  it('E-6: every signed 24-bit sample survives the conversion to the pipe\'s 32-bit float, raw and scaled', () => {
    expect(MIC_TRANSPORTS.PCM_FIFO.sampleFormat).toBe('F32LE');
    expect(MIC_EXACT_SOURCE_BITS).toBe(24);
    expect(MIC_PCM24_SCALE).toBe(2 ** 23);
    const first = -(2 ** 23);
    const last = 2 ** 23 - 1;
    const f32 = new Float32Array(1);
    let checked = 0;
    let equalRaw = 0;
    let equalScaled = 0;
    for (let n = first; n <= last; n++) {
      f32[0] = n; // integer -> float32 (what the pipe holds)
      if (f32[0] === n) equalRaw++;
      f32[0] = n / MIC_PCM24_SCALE; // the scaled form, the one ffmpeg writes
      if (f32[0] * MIC_PCM24_SCALE === n) equalScaled++;
      checked++;
    }
    expect(checked).toBe(16_777_216);
    expect(equalRaw).toBe(16_777_216);
    expect(equalScaled).toBe(16_777_216);
    // Control: the first width that is NOT exact is 25 bits (2^24 + 1 rounds), so the check can fail.
    f32[0] = 2 ** 24 + 1;
    expect(f32[0]).not.toBe(2 ** 24 + 1);
  });

  it('a pipe path stays under the run directory: both IDs are held to their patterns first', () => {
    expect(micPipePath('/data/run/capture/', 'SES-000123', 'MIC-03')).toBe('/data/run/capture/SES-000123/MIC-03.pcm');
    for (const [runDir, sessionId, deviceId] of [
      ['/data/run', '../SES-1', 'MIC-01'],
      ['/data/run', 'SES/1', 'MIC-01'],
      ['/data/run', 'a..b', 'MIC-01'],
      ['/data/run', 'SES-1', 'MIC-01/../x'],
      ['/data/run', 'SES-1', 'CAM-01'],
      ['data/run', 'SES-1', 'MIC-01'],
      ['/data/../etc', 'SES-1', 'MIC-01'],
      ['/data/run', '', 'MIC-01'],
    ] as const) {
      expect(() => micPipePath(runDir, sessionId, deviceId), `${runDir} ${sessionId} ${deviceId}`).toThrow(/host-and-path form/);
    }
  });
});

describe('A-4: the device commands are the contract\'s (E-12)', () => {
  it('every command of the contract table has a seam, and no other command has one', () => {
    expect(CAPTURE_DEVICE_COMMANDS).toEqual(Object.keys(DEVICE_COMMAND_OPERATIONS));
    expect([...CAPTURE_DEVICE_COMMANDS].sort()).toEqual(Object.values(DeviceCommand).sort());
    expect(Object.keys(SEAM_OF_DEVICE_COMMAND).sort()).toEqual([...CAPTURE_DEVICE_COMMANDS].sort());
    expect(Object.entries(SEAM_OF_DEVICE_COMMAND).filter(([, seam]) => seam === 'POE').map(([command]) => command)).toEqual([DeviceCommand.POE_CYCLE]);
  });

  it('the operation of a command is read from the contract table, and the Core\'s operation map is that table inverted', () => {
    for (const command of CAPTURE_DEVICE_COMMANDS) expect(operationOfDeviceCommand(command)).toBe(DEVICE_COMMAND_OPERATIONS[command]);
    for (const [operationId, command] of Object.entries(DEVICE_COMMAND_OF_OPERATION)) expect(DEVICE_COMMAND_OPERATIONS[command]).toBe(operationId);
    // Control: a restated map would be a second list. No file of the layer names an operation of the table.
    const operations = [...new Set(Object.values(DEVICE_COMMAND_OPERATIONS))];
    expect(occurrences(adapters, new RegExp(`['"](?:${operations.join('|')})['"]`, 'g'))).toEqual([]);
    expect(occurrences([{ path: 'x.ts', text: "const map = { restartDevice: 'RESTART' }; const o = 'identifyDevice';" }], new RegExp(`['"](?:${operations.join('|')})['"]`, 'g'))).toEqual(['x.ts:1']);
  });
});

// Block A-5 until row 61: "the layer is wired into nothing yet" (true when row 65 landed, red by
// design from the first importer on; ownership map D95 §7). Row 61 closes it as a pinned rule, the
// same way G-R2 pins its allowlist: WHO may reach the adapter layer, and through WHAT.
describe('A-5: the layer is reached by the units that wire it, and from outside the capture unit through its index only', () => {
  /**
   * The units the blueprint names as the wiring of the layer: the selector and plan builder (row 66),
   * the camera search and connect flow (rows 132, 142), the no-device notices (row 133), the source
   * class of a sealed package (row 141), the session wiring (row 71), and inside the capture unit the
   * fence (row 136) and the boot checks (row 61). Another entry is a decision, not a habit.
   */
  const WIRING = ['src/capture-notices/', 'src/capture-session/', 'src/capture/boot/', 'src/capture/fence/', 'src/evidence-verify/', 'src/modules/capture-config/', 'src/modules/capture-discovery/', 'src/modules/sessions/'];
  /**
   * NAMED FILES (integration pass E3 item 4; rows 61 / 82b / 140 added them after this block was
   * closed). A file, never a folder: its siblings stay refused (the control below). Each reads the
   * layer's INDEX for ONE vocabulary constant and builds, opens or registers no adapter:
   *
   *   src/capture/index.ts        the composition root of the capture unit itself (rows 57 / 61): it
   *                               mounts the two wiring units of this list (`capture/fence`,
   *                               `capture/boot`) and reads `CaptureOperation` to decide whether the
   *                               worker launcher is the real one or the unconfigured one. The
   *                               supervisor's own files (`supervisor.ts`, `ipc.ts`, `forwarder.ts`)
   *                               stay outside the layer.
   *   src/sealing-host/index.ts   the composition of the sealing pipeline (row 82b, ruling D147 (E)):
   *                               it reads `CaptureOperation` to mount NOTHING in `SIMULATED` and to
   *                               choose the manifest notice of a development seal. The operation
   *                               itself comes from the fence's one reader (`captureOperationOf`).
   */
  const NAMED = ['src/capture/index.ts', 'src/sealing-host/index.ts'];
  const CAPTURE_UNIT = 'src/capture/';
  /** What a file outside the capture unit may name: the index of the layer, and nothing inside it. */
  const INDEX = 'src/capture/adapters';

  const violations = (files: readonly SourceFile[]): string[] => {
    const outside = relativeImports(files.filter((file) => isProductionSource(file.path) && !file.path.startsWith(ADAPTERS))).filter((entry) => entry.target.startsWith(INDEX));
    return [
      ...outside.filter((entry) => !WIRING.some((unit) => entry.file.startsWith(unit)) && !(NAMED.includes(entry.file) && entry.target === INDEX)).map((entry) => `${entry.file}:${entry.line} imports the adapter layer and is not a unit that wires it`),
      ...outside.filter((entry) => !entry.file.startsWith(CAPTURE_UNIT) && entry.target !== INDEX).map((entry) => `${entry.file}:${entry.line} reaches into the adapter layer past its index`),
    ];
  };

  it('finds an importer that is no wiring unit, and a deep import from outside the capture unit (control)', () => {
    const UP = '..';
    const planted: SourceFile[] = [
      { path: 'src/modules/evidence/routes.ts', text: `import { CaptureAdapterKind } from '${UP}/${UP}/capture/adapters';\n` },
      { path: 'src/modules/capture-config/plan.ts', text: `import { createFakeCameraAdapter } from '${UP}/${UP}/capture/adapters/fake';\n` },
      { path: 'src/capture/supervisor.ts', text: "import { CaptureOperation } from './adapters/kinds';\n" },
      // A sibling of a named file is not named; a named file past the index is not excused.
      { path: 'src/sealing-host/session-reader.ts', text: `import { CaptureOperation } from '${UP}/capture/adapters';\n` },
      { path: 'src/sealing-host/index.ts', text: `import { CaptureOperation } from '${UP}/capture/adapters/kinds';\n` },
      // Allowed: a named file through the index.
      { path: 'src/capture/index.ts', text: "import { CaptureOperation } from './adapters';\n" },
      // Allowed: a wiring unit through the index, and a folder of the capture unit by file.
      { path: 'src/modules/capture-config/index.ts', text: `import { CaptureAdapterKind } from '${UP}/${UP}/capture/adapters';\n` },
      { path: 'src/capture/fence/boot.ts', text: `import { CaptureOperation } from '${UP}/adapters/kinds';\n` },
    ];
    expect(violations(planted)).toEqual([
      'src/modules/evidence/routes.ts:1 imports the adapter layer and is not a unit that wires it',
      'src/capture/supervisor.ts:1 imports the adapter layer and is not a unit that wires it',
      'src/sealing-host/session-reader.ts:1 imports the adapter layer and is not a unit that wires it',
      'src/sealing-host/index.ts:1 imports the adapter layer and is not a unit that wires it',
      'src/modules/capture-config/plan.ts:1 reaches into the adapter layer past its index',
      'src/sealing-host/index.ts:1 reaches into the adapter layer past its index',
    ]);
  });

  it('every importer is a wiring unit; outside the capture unit only the index is named; the supervisor\'s own files load no adapter', () => {
    expect(violations(tree)).toEqual([]);
    // The layer IS wired now (the old statement of this block would be false): at least the selector and the fence reach it.
    const importers = new Set(relativeImports(tree.filter((file) => isProductionSource(file.path) && !file.path.startsWith(ADAPTERS))).filter((entry) => entry.target.startsWith(INDEX)).map((entry) => entry.file));
    expect([...importers].some((file) => file.startsWith('src/modules/capture-config/'))).toBe(true);
    expect([...importers].some((file) => file.startsWith('src/capture/fence/'))).toBe(true);
    // A named entry that names no importer any more is stale: it goes.
    for (const file of NAMED) expect([...importers], file).toContain(file);
  });
});

// Fix F-M4 (review row 69, question 11 / finding R69-08, the adapter half): the video codec of a
// recorded track is named `H264` | `HEVC` (manifest field 43, erratum PE-D9-03; `fragments.ts`
// reads the init segment so). The profile type of the adapter seam said `'H265'`, which nothing
// produced and nothing read: a second word for one codec, waiting for the first reader to compare
// it with `HEVC`. One vocabulary in the capture unit.
describe('A-6: one word for the second video codec', () => {
  it('no production source of the adapter layer names H265 or H.265; the profile type says HEVC', () => {
    // The raw text: the scan's `code` blanks string literals, and the word in question IS a literal.
    const sources = readTree(WORKSPACE).filter((file) => file.path.startsWith(ADAPTERS) && isProductionSource(file.path));
    expect(sources.length).toBeGreaterThan(10);
    expect(sources.filter((file) => /\bH\.?265\b/.test(file.text)).map((file) => file.path)).toEqual([]);
    const types = sources.find((file) => file.path.endsWith('adapters/types.ts'));
    expect(types?.text).toMatch(/readonly codec: 'H264' \| 'HEVC' \| 'OTHER';/);
  });
});

// Row 97 (hygiene, note 162 item 9). The two lists were each pinned to the same five literal names
// (`registry.test.ts` for this layer, `test/db/set4-rules.test.ts` for the schema) and met only
// through those two literals: a kind added to both pins and to one list would have passed both.
describe('A-7: the adapter kinds of the layer are the value set of the schema', () => {
  it('the same names in the same order, list against list; a list that differs is seen (control)', () => {
    expect([...CAPTURE_ADAPTER_KINDS]).toEqual([...CAPTURE_ADAPTER_KIND]);
    // The object's keys are its values: a member renamed on one side only would be seen here.
    expect(Object.keys(CaptureAdapterKind)).toEqual([...CAPTURE_ADAPTER_KIND]);
    // Control: one more kind, one fewer, and another order each differ.
    const schema: readonly string[] = [...CAPTURE_ADAPTER_KIND];
    expect([...CAPTURE_ADAPTER_KINDS, 'NEW_KIND']).not.toEqual(schema);
    expect(CAPTURE_ADAPTER_KINDS.slice(1)).not.toEqual(schema);
    expect([...CAPTURE_ADAPTER_KINDS].reverse()).not.toEqual(schema);
  });
});

// Task 4 row 21 (WP-02; addendum 2.3 step 4; AD-03 point 6, BR-07 (4), S13-02 (d)). The bytes of a
// start message hold a credential. They are made in ONE production file, the production door, and
// in that file their name stands in a closed list of forms: made, tested for null, written, zero-filled,
// dropped. Any other use - a text, a slice, a copy, an argument, a member of an error or of a log
// call - is another form and fails here.
describe('A-8: the bytes of a start message are made by the production door only, and no text of them is made', () => {
  const DOOR = `${ADAPTERS}production-door.ts`;
  /** A call of the serialiser (its declaration in `credential.ts` is not a call). */
  const SERIALISER_CALL = /(?<!function\s)\bstartMessageBytes\s*\(/g;
  /** Every form the name of the bytes may stand in. */
  const BYTES_FORMS = [
    /^let startBytes: Buffer \| null = null;$/,
    /^startBytes = startMessageBytes\(options\.message\);$/,
    /^startBytes\?\.fill\(0\);$/,
    /^startBytes = null;$/,
    /^\} else if \(startBytes === null\) \{$/,
    /^input\.write\(startBytes, \(error\) => settle\(error \? ProductionDoorRefusal\.START_MESSAGE_NOT_TAKEN : null\)\);$/,
  ];
  /** What would make a text, a copy or a view of bytes, or print a value. */
  const TEXT_MAKERS = /\bJSON\s*\.|\bString\s*\(|\binspect\b|\bTextDecoder\b|\.toString\s*\(|\.(?:slice|subarray|toJSON|toLocaleString|join)\s*\(|\bBuffer\s*\.\s*from\s*\(|\bstructuredClone\b|`[^`]*\$\{/g;
  const violations = (text: string): string[] => {
    const lines = text.split('\n').map((line) => line.trim());
    return [
      ...lines.filter((line) => /\bstartBytes\b/.test(line) && !BYTES_FORMS.some((form) => form.test(line))).map((line) => `another use of the bytes: ${line}`),
      ...lines.filter((line) => /\boptions\s*\.\s*message\b/.test(line) && !/^(?:if \(options\.message !== null\) \{|startBytes = startMessageBytes\(options\.message\);)$/.test(line)).map((line) => `another use of the message: ${line}`),
    ];
  };

  it('finds a text made of the bytes, a copy, an argument and a logged member (control)', () => {
    const planted = [
      'let startBytes: Buffer | null = null;',
      'startBytes = startMessageBytes(options.message);',
      'const text = startBytes.toString();',
      'child = spawn(options.command, [...options.args, String(startBytes)], {});',
      'const copy = Buffer.from(startBytes);',
      'throw new ProductionDoorError(code, { cause: startBytes });',
      'log.warn({ message: options.message }, text);',
      'startBytes?.fill(0);',
    ].join('\n');
    expect(violations(planted)).toEqual([
      'another use of the bytes: const text = startBytes.toString();',
      'another use of the bytes: child = spawn(options.command, [...options.args, String(startBytes)], {});',
      'another use of the bytes: const copy = Buffer.from(startBytes);',
      'another use of the bytes: throw new ProductionDoorError(code, { cause: startBytes });',
      'another use of the message: log.warn({ message: options.message }, text);',
    ]);
    expect(occurrences([{ path: 'x.ts', text: planted }], TEXT_MAKERS)).toEqual(['x.ts:3', 'x.ts:4', 'x.ts:5']);
    expect(occurrences([{ path: 'x.ts', text: 'export function startMessageBytes(message: StartMessage): Buffer {\nconst bytes = startMessageBytes(message);' }], SERIALISER_CALL)).toEqual(['x.ts:2']);
  });

  it('the one caller of the serialiser in the product is the door; the bytes stand in the closed forms only; the argument list is the caller\'s, spread once', () => {
    const production = tree.filter((file) => isProductionSource(file.path));
    expect(occurrences(production, SERIALISER_CALL).map((place) => place.replace(/:\d+$/, ''))).toEqual([DOOR]);
    const door = tree.find((file) => file.path === DOOR)?.text ?? '';
    expect(door.length).toBeGreaterThan(1_000);
    expect(violations(door)).toEqual([]);
    // Each form is there: made once, written once, cleared on every path (a failed start, and the one end of a start).
    expect(door.match(/\bstartBytes = startMessageBytes\(options\.message\);/g)).toHaveLength(1);
    expect(door.match(/\binput\.write\(/g)).toHaveLength(1);
    expect(door.match(/\bstartBytes\?\.fill\(0\);/g)).toHaveLength(2);
    // The one text the file makes is the bounded copy of an OUTPUT stream, and it is blanked before it is handed on.
    expect(occurrences([{ path: DOOR, text: door }], TEXT_MAKERS)).toHaveLength(2);
    expect(door).toMatch(/const part = chunk\.subarray\(0, PRODUCTION_OUTPUT_CAP_BYTES - size\);/);
    expect(door).toMatch(/text: \(\) => blankCredentialLocators\(Buffer\.concat\(kept\)\.toString\('utf8'\)\),/);
    // Every argument of the start is the caller's list, spread once; the door adds none and computes none.
    expect(door).toMatch(/child = spawn\(options\.command, \[\.\.\.options\.args\], \{/);
    expect(door.match(/\boptions\s*\.\s*args\b/g)).toHaveLength(1);
    // A refusal is built from its code alone: no cause, no second argument.
    expect(door.match(/new ProductionDoorError\([^)]*\)/g)?.every((call) => /^new ProductionDoorError\((?:code|spawnFailed \? ProductionDoorRefusal\.PROGRAM_NOT_STARTED : refusal)\)$/.test(call))).toBe(true);
    // The door logs nothing and names no log sink.
    expect(door).not.toMatch(/\bconsole\b|\blog\s*\.|\.(?:warn|info|error|debug)\s*\(/);
  });
});

// Task 4 row 46 (design addendum 6.2: "new files, stubs untouched"; blueprint 9.2 L-5). The production adapters
// are BUILT in new files beside the class-C stubs and REGISTERED NOWHERE until the lift (WP-13, rows 85 and 88):
// no production source names them, so no boot path can load one. Rule A-1 is unchanged: the three stubs stay the
// files the loader names. The row that lifts class C rewrites this block together with A-1.
describe('A-9: the built production adapters are named by no production source before the lift', () => {
  /** Each built file, without extension, with the built files that may name it (its own unit). */
  const BUILT: Readonly<Record<string, readonly string[]>> = {
    [`${ADAPTERS}camera/onvif-relay`]: [],
    // Task 4 row 50 (amendment AM-2): the stream half of the CONNECTION TEST starts the relay in probe mode through the
    // same relay start (the one caller of the injection point, rule A-2). It is no adapter and is registered nowhere:
    // the connect flow hands it its door, and no stream is opened without a credential and a configured relay program.
    [`${ADAPTERS}camera/relay-start`]: [`${ADAPTERS}camera/onvif-relay.ts`, `${ADAPTERS}camera/stream-probe.ts`],
    // Task 4 row 67 (its request, served by row 46): the production microphone adapter beside the stub `audio/usb-audio`.
    [`${ADAPTERS}audio/usb-audio-production`]: [],
    // Task 4 row 68 (its request, served by integration pass I-7): the microphone loss watch, built beside that
    // adapter and wired by no production source until the composition (row 85). It imports no adapter: the match is handed in.
    [`${ADAPTERS}audio/mic-loss`]: [],
  };
  const violations = (files: readonly SourceFile[]): string[] =>
    relativeImports(files.filter((file) => isProductionSource(file.path)))
      .filter((entry) => Object.hasOwn(BUILT, entry.target) && !(BUILT[entry.target] ?? []).includes(entry.file))
      .map((entry) => `${entry.file}:${entry.line} names a built production adapter`);

  it('finds a planted import by the loader, by the layer index and by the fence (control)', () => {
    const planted: SourceFile[] = [
      { path: `${LOADER}.ts`, text: "await import('./camera/onvif-relay');\n" },
      { path: `${ADAPTERS}index.ts`, text: "export { createOnvifRelayCameraAdapter } from './camera/onvif-relay';\n" },
      { path: 'src/capture/fence/index.ts', text: "import { startCameraRelay } from '../adapters/camera/relay-start';\n" },
      { path: `${LOADER}.ts`, text: "\nawait import('./audio/usb-audio-production');\n" },
      { path: 'src/capture/index.ts', text: "import { createMicLossWatch } from './adapters/audio/mic-loss';\n" },
      // Allowed: the adapter names its own relay start; a test names the adapter.
      { path: `${ADAPTERS}camera/onvif-relay.ts`, text: "import { startCameraRelay } from './relay-start';\n" },
      { path: `${ADAPTERS}camera/__tests__/onvif-relay.test.ts`, text: "import { createOnvifRelayCameraAdapter } from '../onvif-relay';\n" },
    ];
    expect(violations(planted)).toEqual([
      `${LOADER}.ts:1 names a built production adapter`,
      `${ADAPTERS}index.ts:1 names a built production adapter`,
      'src/capture/fence/index.ts:1 names a built production adapter',
      `${LOADER}.ts:2 names a built production adapter`,
      'src/capture/index.ts:1 names a built production adapter',
    ]);
  });

  it('no production source names a built production adapter; each exists, and the camera adapter states its opener', () => {
    expect(violations(tree)).toEqual([]);
    for (const path of Object.keys(BUILT)) expect(tree.some((file) => file.path === `${path}.ts`), path).toBe(true);
    const camera = tree.find((file) => file.path === `${ADAPTERS}camera/onvif-relay.ts`)?.text ?? '';
    expect(camera).toMatch(/^ {4}hasOpener: true,$/m);
    expect(camera).toMatch(/^ {4}kind: CaptureAdapterKind\.ONVIF_RTSP,$/m);
    // The stub beside it is not edited: it is still what the loader names (A-1), without an opener.
    expect(tree.find((file) => file.path === `${ADAPTERS}camera/onvif-rtsp.ts`)?.text).toMatch(/hasOpener: false,/);
  });
});
