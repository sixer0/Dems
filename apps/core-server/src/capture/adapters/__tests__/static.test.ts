// Static rules of the adapter layer (blueprint row 65 / M4-W1; capture spec §A.1 "class-C adapters
// must never load in a test", §A.6 SEC35-04, §G; D86 C-5). The rules of the whole capture folder
// (G-R1 to G-R8: no file system, process, socket, timer, clock, random or environment; no
// credential-shaped text; no log call) already hold for `src/capture/adapters/**` through
// `src/capture/__tests__/static.test.ts`. This file adds what is the adapter layer's own:
//
//   A-1  the class-C adapter files are imported by the loader `real.ts` only; the loader is
//        imported by no test but its own refusal test and, since the lift (task 4 row 88), by ONE
//        production file - the fence, for its types and by ONE dynamic import in the boot step;
//        the retired camera stub is imported by no file;
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
//   A-9  the production adapters built beside the class-C stubs are named by a closed list of
//        production sources: before the lift by none (task 4 row 46; addendum 6.2); since the lift
//        (row 88) by the loader and, for the watch and the card match, the fence's boot step.
//        A-2 names the one caller of the injection point.
//   A-10 the destination rule on a STORED camera address (task 4 row 143; AD-02 points 1 and 2):
//        `src/` holds no permissive value, the judgement is asked by a closed list of files, and in
//        each of them it stands before the use of the address.
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

/**
 * The adapter files WITHOUT an opener the loader builds, without extension (structured §9 C-3, C-4). Task 4 row 88 (THE
 * LIFT, AM-1; specification 6.3 "class-C files ... the two files leave the class-C list; `poe/snmp-poe.ts` stays"): the
 * camera stub left the list - it is RETIRED, named by no file; `audio/usb-audio` stays, as the `USB_AUDIO` adapter of a
 * host without a production microphone opener (AM-1 (3)(h) with the erratum of C135: every platform but `linux`).
 */
const CLASS_C = [`${ADAPTERS}audio/usb-audio`, `${ADAPTERS}poe/snmp-poe`];
/** Row 88: the stub the built camera adapter replaced. No file imports it; its removal is the controller's. */
const RETIRED = [`${ADAPTERS}camera/onvif-rtsp`];
const LOADER = `${ADAPTERS}real`;
const LOADER_TEST = `${ADAPTERS}__tests__/real.test.ts`;
/** Row 88 (request line 280 of row 85): the ONE production importer of the loader - its types, and its value by ONE dynamic import in the boot step. */
const LOADER_IMPORTER = 'src/capture/fence/index.ts';
/** A static import of the loader that is not a type import. */
const STATIC_VALUE_IMPORT_OF_LOADER = /^import\s+(?!type\b)[^;]*from\s+'\.\.\/adapters\/real'/;

/** A-1, as a function of a tree, so that the control can run it on planted files. */
function classCViolations(files: readonly SourceFile[]): string[] {
  const imports = relativeImports(files);
  const naming = imports.filter((entry) => CLASS_C.includes(entry.target) && entry.file !== `${LOADER}.ts`).map((entry) => `${entry.file}:${entry.line} imports a class-C adapter`);
  const retired = imports.filter((entry) => RETIRED.includes(entry.target)).map((entry) => `${entry.file}:${entry.line} imports a retired stub`);
  const loading = imports
    .filter((entry) => entry.target === LOADER && entry.file !== LOADER_TEST && entry.file !== LOADER_IMPORTER)
    .map((entry) => `${entry.file}:${entry.line} imports the class-C loader`);
  const importer = files
    .filter((file) => file.path === LOADER_IMPORTER)
    .flatMap((file) => file.text.split('\n').flatMap((line, index) => (STATIC_VALUE_IMPORT_OF_LOADER.test(line) ? [`${file.path}:${index + 1} imports the loader's value statically`] : [])));
  return [...naming, ...retired, ...loading, ...importer];
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
      // Row 88: the retired camera stub, named anywhere - the loader included; the fence's loader import as a VALUE.
      { path: `${LOADER}.ts`, text: `await import('./camera/onvif-rtsp');\n` },
      { path: LOADER_IMPORTER, text: `import { loadProductionAdapters } from '../adapters/real';\n` },
      // Allowed: the loader's own imports, its own refusal test, and the fence's type import and dynamic import.
      { path: `${LOADER}.ts`, text: `await import('./audio/usb-audio');\n` },
      { path: LOADER_TEST, text: `import { loadProductionAdapters } from '${UP}/real';\n` },
      { path: LOADER_IMPORTER, text: `import type { ProductionAdapters } from '../adapters/real';\nconst real = await import('../adapters/real');\n` },
    ];
    expect(classCViolations(planted)).toEqual([
      'test/support/y.ts:1 imports a class-C adapter',
      'src/modules/capture-config/z.ts:1 imports a class-C adapter',
      `${ADAPTERS}__tests__/x.test.ts:1 imports a retired stub`,
      `${LOADER}.ts:1 imports a retired stub`,
      `${ADAPTERS}index.ts:1 imports the class-C loader`,
      `${ADAPTERS}fake/index.ts:1 imports the class-C loader`,
      `${LOADER_IMPORTER}:1 imports the loader's value statically`,
    ]);
  });

  it('no file of the workspace but the loader names a class-C adapter, none names the retired stub; the loader is imported by its refusal test and - types, and ONE dynamic import - by the fence alone', () => {
    expect(classCViolations(tree)).toEqual([]);
    // The loader names the two adapters without an opener, and the two built ones, only through an import that runs when it is called.
    const loader = tree.find((file) => file.path === `${LOADER}.ts`)?.text ?? '';
    const named = relativeImports([{ path: `${LOADER}.ts`, text: loader }]).map((entry) => entry.target);
    expect(named.filter((target) => CLASS_C.includes(target)).sort()).toEqual([...CLASS_C].sort());
    expect(named.filter((target) => /camera\/onvif-relay$|audio\/usb-audio-production$/.test(target)).sort()).toEqual([`${ADAPTERS}audio/usb-audio-production`, `${ADAPTERS}audio/usb-audio-production`, `${ADAPTERS}camera/onvif-relay`, `${ADAPTERS}camera/onvif-relay`]);
    expect(loader).not.toMatch(/^import\s+(?!type\b)[^;]*from\s+'\.\/(?:camera|audio|poe)\//m);
    expect(loader.indexOf('REAL_ADAPTERS_REFUSED')).toBeGreaterThan(0);
    expect(loader.indexOf('REAL_ADAPTERS_REFUSED')).toBeLessThan(loader.indexOf('import('));
    // The fence: one dynamic import of the loader, inside the wiring of the boot step.
    const fence = tree.find((file) => file.path === LOADER_IMPORTER)?.text ?? '';
    expect(fence.match(/\bimport\('\.\.\/adapters\/real'\)/g)).toHaveLength(1);
    expect(fence.indexOf("import('../adapters/real')")).toBeGreaterThan(fence.indexOf('export async function wireProductionRegistry'));
  });

  it('a class-C adapter (and the retired stub) has no opener and builds nothing: no import but the layer\'s own files', () => {
    for (const path of [...CLASS_C, ...RETIRED]) {
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
    // MOVED BY ROW N5b (decision C131 (2)): the cap is the call's, held to 1 byte to 1 MiB and 64 KiB when none is named.
    expect(door).toMatch(/const part = chunk\.subarray\(0, capBytes - size\);/);
    expect(door).toMatch(/const capBytes = options\.outputCapBytes \?\? PRODUCTION_OUTPUT_CAP_BYTES;/);
    expect(door).toMatch(/text: \(\) => blankCredentialLocators\(Buffer\.concat\(kept\)\.toString\('utf8'\)\),/);
    // Every argument of the start is the caller's list, spread once; the door adds none and computes none.
    expect(door).toMatch(/child = spawn\(options\.command, \[\.\.\.options\.args\], \{/);
    expect(door.match(/\boptions\s*\.\s*args\b/g)).toHaveLength(1);
    // A refusal is built from its code alone: no cause, no second argument.
    expect(door.match(/new ProductionDoorError\([^)]*\)/g)?.every((call) => /^new ProductionDoorError\((?:code|spawnFailed \? ProductionDoorRefusal\.PROGRAM_NOT_STARTED : refusal)\)$/.test(call))).toBe(true);
    // The door logs nothing and names no log sink.
    expect(door).not.toMatch(/\bconsole\b|\blog\s*\.|\.(?:warn|info|error|debug)\s*\(/);
  });

  // C-6 / C139 (verification 086 caution C-6): the relay's start hands the door no `onDiagnostics`. The observer of standard error
  // lines is an option of the door that nothing in the relay's unit asks for today; a relay that listened to the child's error output
  // would carry the lines of a process that holds a credential. The rule sees the call of the door in `relay-start.ts` (code only, no comment).
  describe('C-6: the relay start never hands onDiagnostics to the production door', () => {
    const RELAY_START = `${ADAPTERS}camera/relay-start.ts`;
    /** Every line of the file that names the observer, and every `.door(` statement (to its semicolon) that names it. */
    const handsOnDiagnostics = (text: string): string[] => [
      ...text.split('\n').flatMap((line, index) => (/\bonDiagnostics\b/.test(line) ? [`:${index + 1} names onDiagnostics`] : [])),
      ...[...text.matchAll(/\.door\s*\([^;]*;/g)].filter((call) => /\bonDiagnostics\b/.test(call[0])).map(() => 'a door call carries onDiagnostics'),
    ];

    it('finds a door call that carries onDiagnostics, a spread-in member and a bare name (control)', () => {
      const planted = [
        'return start.door({ command: start.program, args: [], env: {}, message, timers: start.timers, onOutput: start.onOutput, onDiagnostics: start.onDiagnostics });',
        'const observer = start.onDiagnostics;',
      ].join('\n');
      expect(handsOnDiagnostics(planted)).toEqual([':1 names onDiagnostics', ':2 names onDiagnostics', 'a door call carries onDiagnostics']);
      expect(handsOnDiagnostics('return start.door({ command: start.program, args: [], env: {}, message, timers: start.timers, onOutput: start.onOutput });')).toEqual([]);
    });

    it('the relay start calls the door once, with the members it has today, and names onDiagnostics nowhere', () => {
      const relayStart = tree.find((file) => file.path === RELAY_START)?.text ?? '';
      expect(relayStart.length).toBeGreaterThan(1_000);
      expect(relayStart.match(/\.door\s*\(/g)).toHaveLength(1);
      expect(relayStart).toMatch(/start\.door\(\{ command: start\.program, args: \[\], env: \{\}, message, timers: start\.timers, onOutput: start\.onOutput \}\)/);
      expect(handsOnDiagnostics(relayStart)).toEqual([]);
    });
  });
});

// Task 4 row 46 (design addendum 6.2: "new files, stubs untouched"; blueprint 9.2 L-5). The production adapters
// are BUILT in new files beside the class-C stubs and were REGISTERED NOWHERE until the lift (WP-13, rows 85 and 88).
// REWRITTEN BY ROW 88 (THE LIFT, AM-1) together with A-1: the loader names the two built adapters (dynamic imports);
// the fence's boot step names the microphone loss watch it builds and the card match of the microphone adapter (two
// pure functions); every other production source still names none of them. The macOS adapter stays named by none (N10).
const FENCE_INDEX = 'src/capture/fence/index.ts';
describe('A-9: the built production adapters are named by a closed list of production sources (since the lift: the loader and the fence\'s boot step)', () => {
  /** Each built file, without extension, with the files that may name it. */
  const BUILT: Readonly<Record<string, readonly string[]>> = {
    [`${ADAPTERS}camera/onvif-relay`]: [`${LOADER}.ts`],
    // Task 4 row 50 (amendment AM-2): the stream half of the CONNECTION TEST starts the relay in probe mode through the
    // same relay start (the one caller of the injection point, rule A-2). It is no adapter and is registered nowhere:
    // the connect flow hands it its door, and no stream is opened without a credential and a configured relay program.
    [`${ADAPTERS}camera/relay-start`]: [`${ADAPTERS}camera/onvif-relay.ts`, `${ADAPTERS}camera/stream-probe.ts`],
    // Task 4 row 67 (its request, served by row 46): the production microphone adapter beside the stub `audio/usb-audio`.
    // Task 4 row N9 (design 06 section 4.4: "may be shared AS CODE"): the macOS adapter imports from it the match of a
    // stored row, the refusal codes and their error class, the row's shape rule and the guard's vector - no adapter of it.
    // Row 88: the loader builds it on `linux`; the fence takes its card match for the loss watch.
    [`${ADAPTERS}audio/usb-audio-production`]: [`${ADAPTERS}audio/usb-audio-macos.ts`, `${LOADER}.ts`, FENCE_INDEX],
    // Task 4 row N9: the macOS production microphone adapter of kind USB_AUDIO, registered nowhere until row N10 (by
    // platform), and its pure gate, which only that adapter names.
    [`${ADAPTERS}audio/usb-audio-macos`]: [],
    [`${ADAPTERS}audio/macos-launch-gate`]: [`${ADAPTERS}audio/usb-audio-macos.ts`],
    // Task 4 row 68 (its request, served by integration pass I-7): the microphone loss watch, built beside that
    // adapter and wired by no production source until the composition (row 85). It imports no adapter: the match is handed in.
    // Row 88: the boot step of the fence builds it where the host has a microphone opener.
    [`${ADAPTERS}audio/mic-loss`]: [FENCE_INDEX],
  };
  const violations = (files: readonly SourceFile[]): string[] =>
    relativeImports(files.filter((file) => isProductionSource(file.path)))
      .filter((entry) => Object.hasOwn(BUILT, entry.target) && !(BUILT[entry.target] ?? []).includes(entry.file))
      .map((entry) => `${entry.file}:${entry.line} names a built production adapter`);

  it('finds a planted import by the layer index, by the fence, by the capture unit and by the loader (control)', () => {
    const planted: SourceFile[] = [
      { path: `${ADAPTERS}index.ts`, text: "export { createOnvifRelayCameraAdapter } from './camera/onvif-relay';\n" },
      { path: FENCE_INDEX, text: "import { startCameraRelay } from '../adapters/camera/relay-start';\n" },
      { path: FENCE_INDEX, text: "\nimport { createOnvifRelayCameraAdapter } from '../adapters/camera/onvif-relay';\n" },
      { path: 'src/capture/index.ts', text: "import { createMicLossWatch } from './adapters/audio/mic-loss';\n" },
      { path: `${LOADER}.ts`, text: "await import('./audio/usb-audio-macos');\n" },
      // Allowed: the loader names the two built adapters; the fence the loss watch and the card match; the adapter its own relay start; a test the adapter.
      { path: `${LOADER}.ts`, text: "await import('./camera/onvif-relay');\nawait import('./audio/usb-audio-production');\n" },
      { path: FENCE_INDEX, text: "import { createMicLossWatch } from '../adapters/audio/mic-loss';\nimport { identifyRegisteredCard } from '../adapters/audio/usb-audio-production';\n" },
      { path: `${ADAPTERS}camera/onvif-relay.ts`, text: "import { startCameraRelay } from './relay-start';\n" },
      { path: `${ADAPTERS}camera/__tests__/onvif-relay.test.ts`, text: "import { createOnvifRelayCameraAdapter } from '../onvif-relay';\n" },
    ];
    expect(violations(planted)).toEqual([
      `${ADAPTERS}index.ts:1 names a built production adapter`,
      `${FENCE_INDEX}:1 names a built production adapter`,
      `${FENCE_INDEX}:2 names a built production adapter`,
      'src/capture/index.ts:1 names a built production adapter',
      `${LOADER}.ts:1 names a built production adapter`,
    ]);
  });

  it('no production source outside the closed list names a built production adapter; each exists, the camera adapter states its opener, and the retired stub states none', () => {
    expect(violations(tree)).toEqual([]);
    for (const path of Object.keys(BUILT)) expect(tree.some((file) => file.path === `${path}.ts`), path).toBe(true);
    const camera = tree.find((file) => file.path === `${ADAPTERS}camera/onvif-relay.ts`)?.text ?? '';
    expect(camera).toMatch(/^ {4}hasOpener: true,$/m);
    expect(camera).toMatch(/^ {4}kind: CaptureAdapterKind\.ONVIF_RTSP,$/m);
    // The retired stub is unchanged in what it states (A-1: named by no file).
    expect(tree.find((file) => file.path === `${ADAPTERS}camera/onvif-rtsp.ts`)?.text).toMatch(/hasOpener: false,/);
  });
});

// Task 4 row 143 (security addendum 04, requirement AD-02 points 1 and 2; GATE CONDITION AD-02: "a search of `src/`
// for a permissive rule value finds 0"). The stored address of a camera is untrusted, so the destination rule is
// asked before every use of it. Three statements, each with a control:
//   (a) an ADMISSION is written as a value in a closed list of production files, each with its count. One more
//       `allowed: true` anywhere under `src/` is a decision, not a habit: it may be a rule that admits by itself;
//   (b) no production source names a rule of the tests, and none hands a stored-address rule on as anything but the
//       dependency it was given (the composition that BINDS the product's rule joins the list below by decision);
//   (c) the judgement is called by a closed list of files, once in each, on the line before the address is used.
describe('A-10: no permissive destination value under src/; the judgement of a stored camera address stands before each use (AD-02)', () => {
  const production = tree.filter((file) => isProductionSource(file.path));
  /** An admission written as a VALUE: `allowed: true` that is not a member of a type (`readonly allowed: true`). */
  const ADMISSION_VALUE = /(?<!readonly\s)\ballowed\s*:\s*true\b/g;
  /**
   * Where an admission is a value today, with how often, and why it is not a permissive destination:
   *   destination-rule.ts      the rule itself: the destination it admits after every refusal (1), the address it lets
   *                            a camera be given (1), the spacing of two attempts (2);
   *   camera/stored-address.ts the judgement's own answer, returned only after the handed-in rule admitted that address;
   *   capture-discovery/limits the spacing of two searches; permission-guard/decision the access decision. Neither is a destination.
   */
  const ADMISSION_VALUES: Readonly<Record<string, number>> = {
    'src/capture/destination-rule.ts': 4,
    [`${ADAPTERS}camera/stored-address.ts`]: 1,
    'src/modules/capture-discovery/limits.ts': 1,
    'src/plugins/permission-guard/decision.ts': 1,
  };
  const admissionCounts = (files: readonly SourceFile[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const place of occurrences(files, ADMISSION_VALUE)) {
      const path = place.replace(/:\d+$/, '');
      counts[path] = (counts[path] ?? 0) + 1;
    }
    return counts;
  };
  /** A rule of the tests, by its name, and the word a permissive value would carry. */
  const TEST_RULE = /\b(?:loopbackDestination|loopbackStoredCameraAddress|TEST_RULE_\w+|permissive\w*|allowLoopback\w*|ALLOW_LOOPBACK\w*|admitAny\w*|allowAny\w*)\b/gi;
  /** A stored-address rule handed on with a value of the file's own making (a shorthand member, a type member and a parameter are not this). */
  const RULE_GIVEN_A_VALUE = /(?<!readonly\s)\bstoredAddress\s*:\s*(?!StoredCameraAddressRule\b)\S/g;
  /**
   * THE BINDING of the product's rule: `decideDestination` named with the purpose of a stored camera. A file that
   * writes this IS a binder, however it hands the bound rule on (a function it exports is not a `storedAddress:` member,
   * so the pattern above alone did not see it: decision C60 (1), "a rule that is green because its pattern does not
   * see the binder is not met").
   */
  const RULE_BINDING = /\bDestinationPurpose\s*\.\s*STORED_CAMERA\b/g;
  /**
   * The production files that give the rule a value, or bind it. NAMED ENTRY SR-8 (decision C60 (1); task 4 row 143b):
   * `src/capture/fence/production-parts.ts` - the capture unit's own part of the production composition, the ONE place
   * where the rule is bound to the host's network facts (`storedCameraAddressRuleOf`). Every other file takes the bound
   * rule from it. One more entry is a decision.
   */
  const RULE_BINDERS: readonly string[] = ['src/capture/fence/production-parts.ts'];
  const JUDGEMENT_CALL = /\bjudgeStoredCamera\s*\(/g;
  /** The callers of the judgement, with the line each calls it on and the line that must FOLLOW the judgement somewhere below it. */
  const JUDGEMENT_CALLERS: Readonly<Record<string, { readonly call: RegExp; readonly use: RegExp }>> = {
    [`${ADAPTERS}camera/onvif-relay.ts`]: {
      call: /^ {6}const judged = judgeStoredCamera\(stored\.candidate, dependencies\.storedAddress\);$/m,
      use: /^ {8}sealed = await until\(credentials\.sessionOpen\(deviceId, sessionId\)\);$/m,
    },
    [`${ADAPTERS}camera/camera-watch.ts`]: {
      // Row 143c: the judgement is kept (its source half is taken from it); what follows it is the one answer that hands a camera on.
      call: /^ {4}const judged = judgeStoredCamera\(target, dependencies\.storedAddress\);$/m,
      use: /^ {4}return Object\.freeze\(\{ camera: target, from: from\.sourceAddress \}\);$/m,
    },
    // Task 4 row 146: the connection test of an adopted camera with its stored credential. The judgement stands before
    // the bounds are asked, and so before the reader and before the tester.
    'src/modules/capture-discovery/adopted-test.ts': {
      call: /^ {2}const judged = judgeStoredCamera\(camera, parts\.storedAddress\);$/m,
      use: /^ {2}const refusal = limits\.refusal\(camera\.host, sessionId\);$/m,
    },
    // Task 4 row 143c (decision C65): the connection test of a candidate that is NOT STORED YET, on a production Core. The
    // judgement stands in the function that answers the tester of the attempt, before the bounds are taken.
    'src/modules/capture-discovery/connect/service.ts': {
      call: /^ {2}const judged = judgeStoredCamera\(resolved\.candidate\.camera, binding\.rule\);$/m,
      use: /^ {2}const turn = limits\.begin\(candidate\.camera\.host, sessionId\);$/m,
    },
  };
  const DECLARATION = `${ADAPTERS}camera/stored-address.ts`;

  it('finds a planted admission, a planted test rule, a planted binder and a planted second caller (control)', () => {
    const planted: SourceFile[] = [
      { path: 'src/capture/fence/index.ts', text: 'const storedAddress = () => ({ allowed: true });\nconst deps = { storedAddress: () => ({ allowed: true }) };\n' },
      { path: 'src/modules/capture-config/x.ts', text: 'import { loopbackStoredCameraAddress } from "y";\nconst permissiveRule = 1;\nif (judgeStoredCamera(candidate, rule).allowed) dial();\n' },
      // Not found: a type member, a shorthand member, a parameter, a refusal.
      { path: 'src/modules/capture-config/z.ts', text: 'type D = { readonly allowed: true } | { readonly allowed: false };\nconst deps = { unit, storedAddress, query };\ninterface I { readonly storedAddress?: StoredCameraAddressRule; }\nconst no = { allowed: false, refusal };\n' },
      // SR-8: a second binding of the product's rule, handed on as a function and not as a member.
      { path: 'src/modules/capture-config/w.ts', text: 'export const ruleOf = (facts) => (host) =>\n  decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address: host }, facts);\nconst other = DestinationPurpose.TYPED_PROBE;\n' },
    ];
    expect(occurrences(planted, RULE_BINDING)).toEqual(['src/modules/capture-config/w.ts:2']);
    expect(admissionCounts(planted)).toEqual({ 'src/capture/fence/index.ts': 2 });
    expect(occurrences(planted, TEST_RULE)).toEqual(['src/modules/capture-config/x.ts:1', 'src/modules/capture-config/x.ts:2']);
    expect(occurrences(planted, RULE_GIVEN_A_VALUE)).toEqual(['src/capture/fence/index.ts:2']);
    expect(occurrences(planted, JUDGEMENT_CALL)).toEqual(['src/modules/capture-config/x.ts:3']);
  });

  it('(a) an admission is a value in the pinned files only, with the pinned counts: `src/` holds no rule that admits by itself', () => {
    expect(production.length).toBeGreaterThan(200);
    expect(admissionCounts(production)).toEqual(ADMISSION_VALUES);
  });

  it('(b) no production source names a rule of the tests or a permissive value; none gives a stored-address rule a value of its own', () => {
    expect(occurrences(production, TEST_RULE)).toEqual([]);
    // SR-8 (C60 (1)): a file that gives the rule a value of its own OR binds the product's rule is a binder, and the binders are the named list.
    const pathsOf = (pattern: RegExp): string[] => occurrences(production, pattern).map((place) => place.replace(/:\d+$/, ''));
    expect([...new Set([...pathsOf(RULE_GIVEN_A_VALUE), ...pathsOf(RULE_BINDING)])].sort()).toEqual([...RULE_BINDERS].sort());
    // The one binder binds ONCE, and it is seen by the pattern that names it (the entry is not a name the rule cannot find).
    expect(pathsOf(RULE_BINDING)).toEqual(['src/capture/fence/production-parts.ts']);
    expect(pathsOf(RULE_GIVEN_A_VALUE)).toEqual([]);
    // The judgement file itself: one import (a type of the layer), no host fact, no address, no rule of its own.
    const judgement = tree.find((file) => file.path === DECLARATION)?.text ?? '';
    expect(relativeImports([{ path: DECLARATION, text: judgement }]).map((entry) => entry.target)).toEqual([`${ADAPTERS}types`]);
    expect(judgement).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\bdecideDestination\b|\bnetworkInterfaces\b|\bDestinationPurpose\b/);
    // Without a rule it refuses: the first statement of the judgement, before anything of the candidate is read.
    expect(judgement).toMatch(/\{\n {2}if \(typeof rule !== 'function'\) return refused\(StoredCameraRefusal\.RULE_ABSENT\);\n/);
  });

  it('(c) the judgement is called by the pinned files, once in each, and in each it stands before the use of the stored address', () => {
    const callers = occurrences(production, JUDGEMENT_CALL).map((place) => place.replace(/:\d+$/, '')).filter((path) => path !== DECLARATION);
    expect([...callers].sort()).toEqual(Object.keys(JUDGEMENT_CALLERS).sort());
    for (const [path, { call, use }] of Object.entries(JUDGEMENT_CALLERS)) {
      const text = tree.find((file) => file.path === path)?.text ?? '';
      const judged = call.exec(text);
      expect(judged, `${path}: the call of the judgement`).not.toBeNull();
      const used = use.exec(text.slice(judged?.index ?? 0));
      expect(used, `${path}: the use of the address after the judgement`).not.toBeNull();
      // And no use of that form stands BEFORE it in the same function: the first one of the file follows the judgement.
      expect(use.exec(text)?.index ?? -1, path).toBeGreaterThan(judged?.index ?? Number.MAX_SAFE_INTEGER);
    }
    // The watch reads a stored camera in ONE place, the function the judgement stands in: every heartbeat, `check` and clock read goes through it.
    const watch = tree.find((file) => file.path === `${ADAPTERS}camera/camera-watch.ts`)?.text ?? '';
    expect(watch.match(/\bawait candidate\(/g)).toHaveLength(1);
    expect(watch.match(/\breader\s*\.\s*read\s*\(/g)).toHaveLength(1);
    // In the declaration the name stands once, as the function itself.
    expect(occurrences([{ path: DECLARATION, text: tree.find((file) => file.path === DECLARATION)?.text ?? '' }], JUDGEMENT_CALL)).toHaveLength(1);
  });

  // Task 4 row 143b (S13-11 point 2): THE SOURCE HALF. The judgement names the camera-interface address a connection
  // must be made FROM. Each caller of the judgement that DIALS takes its source from that judgement and hands it to
  // every dial; the ONVIF session gives it to its sockets; a record start of the relay is refused without it.
  // Row 143c: `camera/camera-watch.ts` joined - its time read is the third dial of a stored camera. Every caller of the
  // judgement is a taker now.
  const SOURCE_TAKERS: Readonly<Record<string, { readonly take: RegExp; readonly refuse: RegExp; readonly dials: readonly RegExp[]; readonly unbound: RegExp }>> = {
    [`${ADAPTERS}camera/camera-watch.ts`]: {
      take: /^ {4}const from = storedCameraSourceOf\(judged\);$/m,
      refuse: /^ {4}if \('refusal' in from\) \{\n {6}report\(CameraWatchReportCode\.ADDRESS_REFUSED, deviceId\);\n {6}if \(strict\) throw new CameraClockError\(CameraClockRefusal\.ADDRESS_REFUSED, deviceId\);\n {6}return ADDRESS_REFUSED;\n {4}\}$/m,
      // What the judgement function hands on is the judged camera WITH its source, as one frozen answer; the one read of
      // the file (a function declared above it, called only with such an answer) takes both members of it - held below.
      dials: [/\breturn Object\.freeze\(\{ camera: target, from: from\.sourceAddress \}\);/g],
      unbound: /\breader\.read\((?!target\.camera, bound\.signal, target\.from\))/g,
    },
    [`${ADAPTERS}camera/onvif-relay.ts`]: {
      take: /^ {6}const from = storedCameraSourceOf\(judged\);$/m,
      refuse: /^ {6}if \('refusal' in from\) throw new CameraOpenError\(CameraOpenRefusal\.ADDRESS_REFUSED, deviceId, from\.refusal\);$/m,
      dials: [/\blocator\.locate\(stored\.candidate, sealed, stored\.onvifProfileToken, inner\.signal, from\.sourceAddress\)/g, /\bstartCameraRelay\(\{[^\n]*\bsource: from\.sourceAddress,[^\n]*\}\);/g],
      unbound: /\blocator\.locate\((?![^\n]*from\.sourceAddress\))|\bstartCameraRelay\((?![^\n]*source: from\.sourceAddress)/g,
    },
    'src/modules/capture-discovery/adopted-test.ts': {
      take: /^ {2}const sourceAddress = !judged\.allowed \? null : judged\.sourceAddress;$/m,
      refuse: /^ {2}if \(!judged\.allowed \|\| sourceAddress === null\) \{$/m,
      dials: [/\btester\.test\(camera, sealed, deadline\.signal, sourceAddress\)/g],
      unbound: /\btester\.test\((?![^\n]*, sourceAddress\))/g,
    },
    // Row 143c (C65): where a bound test is required, the tester of the attempt is the provided one BOUND to the source
    // (`boundTo`), and the provided tester itself is never called or taken out of `resolved` by the function that dials.
    'src/modules/capture-discovery/connect/service.ts': {
      take: /^ {2}const fromAddress = !judged\.allowed \? null : judged\.sourceAddress;$/m,
      refuse: /^ {2}if \(!judged\.allowed \|\| fromAddress === null\) \{$/m,
      dials: [/\bgiven\.boundTo\(fromAddress\)/g],
      unbound: /\b(?:resolved\.tester|given)\.test\(|\bconst \{[^}\n]*\btester\b[^}\n]*\} = resolved;/g,
    },
  };
  const sourceHalfFaults = (text: string, spec: (typeof SOURCE_TAKERS)[string]): string[] => {
    const faults: string[] = [];
    const taken = spec.take.exec(text);
    const refused = spec.refuse.exec(text);
    if (taken === null) faults.push('the source is not taken from the judgement');
    if (refused === null) faults.push('an admission without a source is not refused');
    for (const dial of spec.dials) {
      const places = [...text.matchAll(new RegExp(dial.source, 'g'))];
      if (places.length !== 1) faults.push(`a dial is made ${places.length} times with the source`);
      else if ((places[0]?.index ?? -1) < Math.max(taken?.index ?? Number.MAX_SAFE_INTEGER, refused?.index ?? Number.MAX_SAFE_INTEGER)) faults.push('a dial stands before the source was taken');
    }
    if ([...text.matchAll(new RegExp(spec.unbound.source, 'g'))].length > 0) faults.push('a dial is made without the source');
    return faults;
  };

  it('(d) finds a dial without the source, a dial before it, and a source that is not refused when absent (control)', () => {
    const spec = SOURCE_TAKERS['src/modules/capture-discovery/adopted-test.ts'];
    if (spec === undefined) throw new Error('the list has no entry of the adopted test');
    const good = "  const sourceAddress = !judged.allowed ? null : judged.sourceAddress;\n  if (!judged.allowed || sourceAddress === null) {\n    throw notTestable();\n  }\n    attempt = await tester.test(camera, sealed, deadline.signal, sourceAddress);\n";
    expect(sourceHalfFaults(good, spec)).toEqual([]);
    expect(sourceHalfFaults(good.replace(', sourceAddress);', ');'), spec)).toEqual(['a dial is made 0 times with the source', 'a dial is made without the source']);
    expect(sourceHalfFaults(`${good}    again = await tester.test(camera, sealed, deadline.signal);\n`, spec)).toEqual(['a dial is made without the source']);
    expect(sourceHalfFaults(good.replace('  if (!judged.allowed || sourceAddress === null) {', '  if (!judged.allowed) {'), spec)).toContain('an admission without a source is not refused');
    expect(sourceHalfFaults(`    attempt = await tester.test(camera, sealed, deadline.signal, sourceAddress);\n${good.split('\n').slice(0, 4).join('\n')}\n`, spec)).toEqual(['a dial stands before the source was taken']);
  });

  it('(d) row 143b: every caller of the judgement that dials takes the source address from it, refuses when it names none, and hands it to every dial', () => {
    for (const [path, spec] of Object.entries(SOURCE_TAKERS)) expect(sourceHalfFaults(tree.find((file) => file.path === path)?.text ?? '', spec), path).toEqual([]);
    // Every taker is a caller of the judgement, and (row 143c) every caller is a taker: no dial of a stored camera is left unbound.
    expect(Object.keys(JUDGEMENT_CALLERS).filter((path) => !Object.hasOwn(SOURCE_TAKERS, path))).toEqual([]);
    expect(Object.keys(SOURCE_TAKERS).sort()).toEqual(Object.keys(JUDGEMENT_CALLERS).sort());
    // The watch: ONE read, with the camera and the source of ONE answer of the judgement function; that answer is made in
    // one place, and the seam's read cannot be written without the address (a required parameter).
    const watchText = tree.find((file) => file.path === `${ADAPTERS}camera/camera-watch.ts`)?.text ?? '';
    expect(watchText.match(/\breader\.read\([^\n]*?\)/g)).toEqual(['reader.read(target.camera, bound.signal, target.from)']);
    expect(watchText.match(/\bcamera: target\b/g)).toHaveLength(1);
    expect(watchText).toMatch(/^ {2}read\(candidate: CameraCandidate, signal: AbortSignal, fromAddress: string\): Promise<CameraTimeAnswer>;$/m);
    expect(watchText).toMatch(/const readOnce = async \(deviceId: string, target: ReadTarget, outer: AbortSignal \| null\): Promise<Read> => \{/);
    // The ONVIF session: ONE place gives a socket its local address, from the one parameter of the exchange; the three
    // calls of the facades hand that parameter in, and a text that is no source address is refused before the exchange.
    const session = tree.find((file) => file.path === `${ADAPTERS}camera/onvif-session.ts`)?.text ?? '';
    expect(session.match(/\blocalAddress\b/g)).toHaveLength(1);
    expect(session).toMatch(/const bound = sourceAddress === undefined \? connectionOptions : \{ \.\.\.connectionOptions, localAddress: sourceAddress, family: 4 \};\n\s+const socket = connect\.call\(agent, bound, callback\)/);
    expect(session.match(/\bconnect\.call\(/g)).toHaveLength(1);
    expect(session.match(/^ {4}\}, sourceAddress\);$/gm)).toHaveLength(3);
    expect(session).toMatch(/if \(sourceAddress !== undefined && !isSourceAddress\(sourceAddress\)\) return Promise\.reject\(new CaptureAdapterError\(CaptureAdapterRefusal\.LOCATOR_INVALID\)\);/);
    // The relay start: a RECORD start without a source address makes no start message; a probe hands on what it was given, or nothing.
    const start = tree.find((file) => file.path === `${ADAPTERS}camera/relay-start.ts`)?.text ?? '';
    expect(start).toMatch(/export function startCameraRelay\(start: CameraRelayStart\): ProductionProcess \{\n(?:\s*\n)*\s*if \(!isSourceAddress\(start\.source\)\) throw new CaptureAdapterError\(CaptureAdapterRefusal\.START_MESSAGE_INVALID\);/);
    expect(start).toMatch(/if \(start\.source !== undefined && !isSourceAddress\(start\.source\)\) throw new CaptureAdapterError\(CaptureAdapterRefusal\.START_MESSAGE_INVALID\);/);
    expect(start.match(/\bcredentialAtInjection\s*\(/g)).toHaveLength(1);
    // The stream half of the connection test: the ONE source of a test goes to its three dials.
    const probe = tree.find((file) => file.path === `${ADAPTERS}camera/stream-probe.ts`)?.text ?? '';
    expect(probe).toMatch(/onvif\.test\(candidate, credential, signal, \.\.\.from\)/);
    expect(probe).toMatch(/locator\.locate\(candidate, credential, profile\.token, signal, \.\.\.from\)/);
    expect(probe).toMatch(/probe\(relayProgram, address, credential, signal, sourceAddress\)/);
    expect(probe.match(/\bstartCameraProbe\s*\(/g)).toHaveLength(1);
    expect(probe).toMatch(/startCameraProbe\(\{[^\n]*\.\.\.\(sourceAddress === undefined \? \{\} : \{ source: sourceAddress \}\)[^\n]*\}\);/);
    // Row 143c (C65): the bound tester is that same `test` with the address, held to the form of a source address when it is bound.
    expect(probe).toMatch(/const boundTo = \(fromAddress: string\): Pick<StreamConnectionTester, 'test'> => \{\n\s+if \(!isSourceAddress\(fromAddress\)\) throw new CaptureAdapterError\(CaptureAdapterRefusal\.LOCATOR_INVALID\);\n\s+return Object\.freeze\(\{ test: \([^\n]*\) => test\(candidate, credential, signal, fromAddress\) \}\);/);
    // The candidate's test: the ONE way to the unbound tester is the answer "not required"; the makers of that answer are the
    // one maker of an app's seams (from the capture operation) and the constant of seams that state nothing (the flow's own tests).
    const connect = tree.find((file) => file.path === 'src/modules/capture-discovery/connect/service.ts')?.text ?? '';
    expect(connect).toMatch(/const binding = seams\.candidateSource\?\.\(\) \?\? NOT_REQUIRED;\n {2}if \(!binding\.required\) return resolved\.tester;\n/);
    expect(connect.match(/\bresolved\.tester\b/g)).toHaveLength(2);
    expect(production.filter((file) => /(?<!readonly\s)\brequired\s*:\s*false\b/.test(file.text) && /\bcandidateSource\b|\bCandidateSourceBinding\b/.test(file.text)).map((file) => file.path).sort()).toEqual(['src/modules/capture-discovery/connect/index.ts', 'src/modules/capture-discovery/connect/service.ts']);
    const connectIndex = tree.find((file) => file.path === 'src/modules/capture-discovery/connect/index.ts')?.text ?? '';
    expect(connectIndex).toContain('candidateSource: () => (production ? { required: true, rule: control.candidateRule } : { required: false }),');
    expect(connectIndex).toContain('const production = isProductionCaptureOperation(captureOperationOf(app.config));');
  });
});

// A-11 (task 4 row 85d; decision C63 (g)): THE DOOR OF A LATER DEVICE. The fence's builder finds it BY NAME on a built
// adapter (`lateDoorOf` of `capture/fence/index.ts`), so a renamed member would end the admission without an error. The
// two built production adapters have it; the class-C stubs and the development adapters have none (a device of theirs is
// never admitted after the boot); and in each built adapter every refusal stands before the one change.
describe('A-11: the door of a later device is a member of the two built production adapters, by the name the fence asks for', () => {
  const DOOR = /\badmitDevice\b/;
  // Task 4 row N9: the macOS microphone adapter states the same door, by the Linux adapter's shape, so that a microphone
  // registered on a running Core on this Mac is served by the same adapter (row 85d's rule; registered by row N10).
  const BUILT = [`${ADAPTERS}camera/onvif-relay.ts`, `${ADAPTERS}audio/usb-audio-production.ts`, `${ADAPTERS}audio/usb-audio-macos.ts`];

  it('the adapter files that name the member are the built ones; the fence asks for that name', () => {
    expect(adapters.filter((file) => DOOR.test(file.text)).map((file) => file.path).sort()).toEqual([...BUILT].sort());
    const fence = tree.find((file) => file.path === 'src/capture/fence/index.ts')?.text ?? '';
    expect(fence).toContain("const member = (adapter as unknown as Record<string, unknown>)['admitDevice'];");
    // CONTROL: the pattern sees a member of another spelling as absent.
    expect(DOOR.test('admitDevices: () => []')).toBe(false);
    expect(DOOR.test('    admitDevice,')).toBe(true);
  });

  it.each(BUILT)('%s: the member is handed out as it is declared; in it, the last refusal stands before the one statement that takes the device', (path) => {
    const text = tree.find((file) => file.path === path)?.text ?? '';
    expect(text.match(/^ {2}function admitDevice\(entry: CaptureDeviceEntry\): void \{$/gm)).toHaveLength(1);
    expect(text.match(/^ {4}admitDevice,$/gm)).toHaveLength(1);
    const body = text.slice(text.indexOf('  function admitDevice(entry: CaptureDeviceEntry): void {'));
    const door = body.slice(0, body.indexOf('\n  }\n'));
    const taken = door.indexOf('admittedLater.push(');
    expect(taken).toBeGreaterThan(0);
    expect(door.match(/\badmittedLater\.push\(/g)).toHaveLength(1);
    expect(door.lastIndexOf('throw new CaptureAdapterError(')).toBeLessThan(taken);
    // Refused by the class, a stated kind and a stated source class; and nothing of the host is asked: no await, no call of a dependency.
    for (const refusal of ['DEVICE_UNKNOWN', 'DEVICE_CLASS_MISMATCH', 'ADAPTER_KIND_NOT_ALLOWED', 'SOURCE_CLASS_NOT_ALLOWED']) expect(door, refusal).toContain(`CaptureAdapterRefusal.${refusal}`);
    expect(door).not.toMatch(/\bawait\b|\boptions\.|\bdependencies\.|\bdoor\(|\bcredentials\b|\blocator\b|\bstream\(/);
  });
});

// Task 4 row N9 (masterplan/06 revision 3 section 8.1; security addendum 08b SM-20, SM-21, SM-40; decision U25 (3)): WHERE THE
// CODE MARKS THE macOS MICROPHONE PATH AS THE BENCH FORM. The macOS adapter is a file of its own whose head says what it is;
// it exports the two words of the source facts and no other file of the layer builds them; it hands the worker the GAPPED
// pipe kind and never the continuous one; and it imports no file of the development class (SM-21; design 4.4).
describe('A-12: the macOS microphone adapter marks the bench form, and no other file of the layer makes its words', () => {
  const MACOS = `${ADAPTERS}audio/usb-audio-macos.ts`;
  const WORDS = /['"](?:AVFOUNDATION|NOT_CONTINUOUS)['"]/g;
  /** The development files design 4.4 keeps out of the production path: the dev adapter, its helper, its delivery watch and its list parser. */
  const DEVELOPMENT = [`${ADAPTERS}local/mic-adapter`, `${ADAPTERS}local/mic-helper`, `${ADAPTERS}local/camera-helper`, `${ADAPTERS}local/device-list`, `${ADAPTERS}local/camera-adapter`];
  const violations = (files: readonly SourceFile[]): string[] => [
    ...occurrences(files.filter((file) => file.path !== MACOS), WORDS).map((place) => `${place} builds a word of the bench form`),
    ...relativeImports(files.filter((file) => file.path === MACOS))
      .filter((entry) => DEVELOPMENT.includes(entry.target))
      .map((entry) => `${entry.file}:${entry.line} imports a development file`),
  ];

  it('finds a planted word in another file and a planted development import (control)', () => {
    const planted: SourceFile[] = [
      { path: `${ADAPTERS}audio/usb-audio-production.ts`, text: "const layer = 'AVFOUNDATION';\n" },
      { path: MACOS, text: "import { createMicHelper } from '../local/mic-helper';\nconst a = 'NOT_CONTINUOUS';\n" },
    ];
    expect(violations(planted)).toEqual([`${ADAPTERS}audio/usb-audio-production.ts:1 builds a word of the bench form`, `${MACOS}:1 imports a development file`]);
  });

  it('the head says it, the two words are made in this file alone, once each; the pipe kind is the gapped one; no development file is imported', () => {
    expect(violations(adapters)).toEqual([]);
    const code = adapters.find((file) => file.path === MACOS)?.text ?? '';
    expect(code.match(/^export const MACOS_CAPTURE_LAYER = 'AVFOUNDATION';$/gm)).toHaveLength(1);
    expect(code.match(/^export const MACOS_SAMPLE_CONTINUITY = 'NOT_CONTINUOUS';$/gm)).toHaveLength(1);
    expect(code.match(WORDS)).toHaveLength(2);
    // Stated in the source facts by the constants, never by a second spelling.
    expect(code).toMatch(/^ {8}captureLayer: MACOS_CAPTURE_LAYER,$/m);
    expect(code).toMatch(/^ {8}sampleContinuity: MACOS_SAMPLE_CONTINUITY,$/m);
    // The worker is handed the GAPPED kind (design 8.2 (b)); the continuous kind and its transport are not named.
    expect(code).toMatch(/^export const MACOS_MIC_PIPE_KIND = 'PCM_FIFO_GAPPED';$/m);
    expect(code).not.toMatch(/\bMIC_TRANSPORTS\b|CaptureMicInputKind\.PCM_FIFO\b|['"]PCM_FIFO['"]/);
    // No progress report and no delivery watch of the development helper (design 4.2: the row has none).
    expect(code).not.toMatch(/\bcreateDeliveryWatch\b|\bstartHelperProcess\b|-progress/);
    const head = readFileSync(resolve(WORKSPACE, MACOS), 'utf8').slice(0, 1_200);
    expect(head).toContain('THE BENCH FORM OF THIS MAC: NOT THE HARDENED LINUX FORM; THE AUDIO OF THIS PATH IS NOT');
    expect(head).toContain('SAMPLE-CONTINUOUS');
  });
});
