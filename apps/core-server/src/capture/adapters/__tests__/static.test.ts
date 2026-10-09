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
//   A-5  the layer is registered nowhere: no file outside the folder imports it yet.
//
// Each rule has a control on a planted source that must be found.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEVICE_COMMAND_OPERATIONS } from '@dems/shared/api';
import { DeviceCommand } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { relativeImports } from '../../../../test/static/imports';
import { REPOSITORY, WORKSPACE, codeOnly, isProductionSource, occurrences, readTree, type SourceFile } from '../../../../test/static/scan';
import { DEVICE_COMMAND_OF_OPERATION } from '../../../modules/devices';
import { CAPTURE_DEVICE_COMMANDS, SEAM_OF_DEVICE_COMMAND, operationOfDeviceCommand } from '../commands';
import { MIC_CLOCK_COMPENSATION_PPM, MIC_LATENESS_TARGET_MS, MIC_TRANSPORTS, MIC_WORKER_BUFFER_CAP_MS, micPipePath, withinMicClockRange } from '../mic-transport';

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
  it('reads the adapter layer: exactly these production files', () => {
    expect(adapters.map((file) => file.path)).toEqual(
      ['audio/usb-audio.ts', 'camera/discovery-collector.ts', 'camera/onvif-cam.d.ts', 'camera/onvif-discovery.ts', 'camera/onvif-rtsp.ts', 'camera/onvif-session.ts', 'camera/probe-answer.ts', 'camera/ws-discovery.ts', 'camera/xml2js.d.ts', 'commands.ts', 'credential.ts', 'errors.ts', 'fake/audio.ts', 'fake/camera.ts', 'fake/index.ts', 'fake/poe.ts', 'index.ts', 'kinds.ts', 'local/camera-adapter.ts', 'local/camera-helper-args.ts', 'local/camera-helper.ts', 'local/device-list.ts', 'local/errors.ts', 'local/helper-program.ts', 'local/index.ts', 'local/leftover.ts', 'local/mic-adapter.ts', 'local/mic-helper-args.ts', 'local/mic-helper.ts', 'local/mic-pipe.ts', 'local/pipe-files.ts', 'local/process-door.ts', 'mic-transport.ts', 'poe/snmp-poe.ts', 'real.ts', 'registry.ts', 'types.ts'].map(
        (name) => `${ADAPTERS}${name}`,
      ),
    );
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

  it('the injection point has no caller in the product yet: recording a real camera is class C-2', () => {
    const production = tree.filter((file) => isProductionSource(file.path));
    const callers = occurrences(production, /\bcredentialAtInjection\s*\(/g).map((place) => place.replace(/:\d+$/, ''));
    expect([...new Set(callers)]).toEqual([`${ADAPTERS}credential.ts`]);
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

describe('A-5: the layer is wired into nothing yet (rows 66 and 71 do that)', () => {
  it('no production file outside the folder imports it', () => {
    const outside = relativeImports(tree.filter((file) => isProductionSource(file.path) && !file.path.startsWith(ADAPTERS))).filter((entry) => entry.target.startsWith('src/capture/adapters'));
    expect(outside.map((entry) => `${entry.file}:${entry.line}`)).toEqual([]);
  });
});
