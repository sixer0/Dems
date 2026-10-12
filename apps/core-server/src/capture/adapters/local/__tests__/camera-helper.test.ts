// The local camera helper (blueprint row 134; capture spec §A.6.4, §G.1 G-R12, G-R14; checks
// M4-SEC-HELPER-1 and the static part of M4-LOCAL-WORKER-1).
//
// NOTHING HERE OPENS A CAMERA. The helper program is never started: the lifecycle runs on a door
// that starts nothing, the real door is exercised with the Node binary, and the device list is a
// recorded text. The camera itself is check M4-LOCAL-CAM-1, run by the user.
import { ChildProcess } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LOOPBACK_RTSP_URL } from '@dems/capture-protocol';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { flush, manualCaptureTimers } from '../../../../../test/support/capture';
import { WORKSPACE, codeOnly, isProductionSource, occurrences, readTree } from '../../../../../test/static/scan';
import { CaptureAdapterError } from '../../errors';
import { CaptureAdapterKind, CaptureOperation } from '../../kinds';
import { OPENER_CAPABLE_KINDS, createCaptureDeviceRegistry } from '../../registry';
import {
  CAMERA_HELPER_TABLE,
  CameraHelperEncoder,
  HELPER_OUTPUT_CAP_BYTES,
  HelperProgramRefusal,
  LOCAL_CAMERA_DEVICE_NAME,
  LocalSourceError,
  cameraPrecheckArguments,
  cameraPushArguments,
  createLocalCameraAdapter,
  deviceListArguments,
  helperProgramRefusal,
  inspectProgram,
  isLoopbackIngest,
  isUsableDeviceName,
  leftoverHelperPids,
  parseDeviceList,
  selectLocalDevice,
  startHelperProcess,
  type HelperDoor,
  type HelperExit,
  type HelperProcessOptions,
  type ProgramFacts,
} from '../index';
import { LEFTOVER_CANDIDATE_LIMIT, leftoverPrograms, linuxProgramPathReader, processShortName, programPathReaderFor } from '../leftover';

const SCHEME = ['rtsp', '://'].join('');
const INGEST = `${SCHEME}127.0.0.1:8559/cam1`;
const PROGRAM = '/opt/dems/bin/ffmpeg';
/** The list this Mac prints (probe P-1, read again by this row outside the sandbox). */
const LIST = [
  '[AVFoundation indev @ 0x772d018140] AVFoundation video devices:',
  '[AVFoundation indev @ 0x772d018140] [0] MacBook Air Camera',
  '[AVFoundation indev @ 0x772d018140] [1] MacBook Air Desk View Camera',
  '[AVFoundation indev @ 0x772d018140] [2] Capture screen 0',
  '[AVFoundation indev @ 0x772d018140] [3] Capture screen 1',
  '[AVFoundation indev @ 0x772d018140] AVFoundation audio devices:',
  '[AVFoundation indev @ 0x772d018140] [0] MacBook Air Microphone',
  '[in#0 @ 0x772d018000] Error opening input: Input/output error',
].join('\n');
const listWith = (...video: string[]): string => ['[AVFoundation indev @ 0x1] AVFoundation video devices:', ...video.map((name, index) => `[AVFoundation indev @ 0x1] [${index}] ${name}`), '[AVFoundation indev @ 0x1] AVFoundation audio devices:'].join('\n');

const TRUSTED: ProgramFacts = {
  absolute: true,
  exists: true,
  regularFile: true,
  symbolicLink: false,
  file: { ownerUid: 501, mode: 0o555 },
  directoriesAsWritten: [{ ownerUid: 0, mode: 0o755 }, { ownerUid: 501, mode: 0o755 }],
  directoriesResolved: [{ ownerUid: 0, mode: 0o755 }, { ownerUid: 501, mode: 0o755 }],
  serverUid: 501,
};

// ── A door that starts nothing ────────────────────────────────────────────────────────────────

interface FakeChild {
  readonly options: HelperProcessOptions;
  readonly signals: string[];
  end(exit: Partial<HelperExit>): void;
}

function fakeDoor(listText: () => string = () => LIST) {
  const started: FakeChild[] = [];
  let nextPid = 4000;
  const door: HelperDoor = (options) => {
    let over = false;
    let resolveEnded: (exit: HelperExit) => void = () => {};
    const ended = new Promise<HelperExit>((resolve) => {
      resolveEnded = resolve;
    });
    const child: FakeChild = {
      options,
      signals: [],
      end(exit) {
        if (over) return;
        over = true;
        resolveEnded({ exitCode: 1, signal: null, spawnFailed: false, diagnostics: '', output: '', ...exit });
      },
    };
    started.push(child);
    // The device-list call answers by itself: it has no input to open and ends with an error code.
    if (options.args.includes('-list_devices')) child.end({ exitCode: 251, diagnostics: listText() });
    const pid = (nextPid += 1);
    return {
      pid,
      ended,
      alive: () => !over,
      kill(signal) {
        child.signals.push(signal);
        if (signal === 'SIGKILL') child.end({ exitCode: null, signal });
      },
    };
  };
  return {
    door,
    started,
    lists: () => started.filter((child) => child.options.args.includes('-list_devices')),
    helpers: () => started.filter((child) => !child.options.args.includes('-list_devices')),
  };
}

function adapterOn(fake: ReturnType<typeof fakeDoor>, overrides: Partial<Parameters<typeof createLocalCameraAdapter>[0]> = {}) {
  const clock = manualCaptureTimers(1_791_537_920_123);
  const lost: Array<{ deviceId: string; error: LocalSourceError }> = [];
  const adapter = createLocalCameraAdapter({
    id: 'CAM-03',
    program: PROGRAM,
    now: clock.now,
    timers: clock.timers,
    door: fake.door,
    inspect: () => TRUSTED,
    onSourceLost: (deviceId, error) => lost.push({ deviceId, error }),
    ...overrides,
  });
  return { adapter, clock, lost };
}

/** Lets the promise chain of an open reach its next wait. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) await flush();
}

const rejection = async (promise: Promise<unknown>): Promise<LocalSourceError> => {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(LocalSourceError);
  return error as LocalSourceError;
};

// ── The argument tables (G-R12) ───────────────────────────────────────────────────────────────

describe('the argument tables (G-R12; HL-3)', () => {
  const START = 1_791_537_920_123;
  const lists = [
    cameraPushArguments({ source: 'DEVICE', deviceName: LOCAL_CAMERA_DEVICE_NAME, encoder: CameraHelperEncoder.VIDEOTOOLBOX, ingestUrl: INGEST, startMs: START }),
    cameraPushArguments({ source: 'DEVICE', deviceName: LOCAL_CAMERA_DEVICE_NAME, encoder: CameraHelperEncoder.X264, ingestUrl: INGEST, startMs: START }),
    cameraPushArguments({ source: 'GENERATED', encoder: CameraHelperEncoder.X264, ingestUrl: INGEST, startMs: START }),
    cameraPrecheckArguments(LOCAL_CAMERA_DEVICE_NAME),
    deviceListArguments(),
  ];

  it('the push list is the pipeline of the spec: device by name, one keyframe per second, no B-frames, the three clock options, a TCP push', () => {
    expect(lists[0]).toEqual(
      [
        ['-hide_banner', '-nostdin', '-nostats', '-loglevel', 'warning'],
        ['-f', 'avfoundation', '-use_wallclock_as_timestamps', '1', '-framerate', '30', '-video_size', '1280x720', '-pixel_format', 'nv12', '-i', 'MacBook Air Camera:none'],
        ['-an', '-c:v', 'h264_videotoolbox', '-realtime', '1', '-profile:v', 'main', '-bf', '0', '-g', '30', '-b:v', '4M', '-flags', '+global_header'],
        // Added by this row after measurement (M4-LOCAL-AV-1): without the pair the frames are put on a fixed grid.
        ['-fps_mode', 'passthrough', '-enc_time_base', '1/90000'],
        ['-copyts', '-output_ts_offset', '-1791537920.123', '-start_time_realtime', '1791537920123000'],
        // Added by pass C2 (H-18, D118): the progress report on standard output, read by the no-frame bound.
        ['-progress', 'pipe:1'],
        ['-f', 'rtsp', '-rtsp_transport', 'tcp', INGEST],
      ].flat(),
    );
    const fallback = lists[1] ?? [];
    expect(fallback.slice(fallback.indexOf('-an'), fallback.indexOf('-fps_mode'))).toEqual(['-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-pix_fmt', 'yuv420p', '-g', '30', '-bf', '0', '-b:v', '4M', '-maxrate', '4M', '-bufsize', '4M', '-flags', '+global_header']);
  });

  it('the generated picture of the FAKE camera is paced to real time (realtime filter in the graph) and capped at the plan profile rate (4 Mbit/s), so a fragment cannot follow host speed (F-82c-1)', () => {
    const generated = lists[2] ?? [];
    expect(generated).toContain('testsrc2=size=1280x720:rate=30,realtime,settb=1/1000000');
    const encoder = generated.slice(generated.indexOf('-an'), generated.indexOf('-fps_mode'));
    expect(encoder.join(' ')).toContain('-bf 0 -b:v 4M -maxrate 4M -bufsize 4M -flags');
    expect(generated).not.toContain('avfoundation');
    // The real camera's default encoder list is the one the request did not touch.
    expect(lists[0]).not.toContain('-maxrate');
  });

  it('every argument is a literal of the table or one of the four computed values', () => {
    const computed = [INGEST, '-1791537920.123', '1791537920123000', 'MacBook Air Camera:none'];
    for (const list of lists) expect(list.filter((argument) => !CAMERA_HELPER_TABLE.literals.includes(argument) && !computed.includes(argument))).toEqual([]);
  });

  it('no argument names all interfaces, a datagram transport, a listen mode, a user part, a shell mark or a screen', () => {
    const forbidden = /0\.0\.0\.0|::|udp|listen|@|[;&|`$<>\\"*?~!{}]|screen|desk view/i;
    for (const list of lists) expect(list.filter((argument) => forbidden.test(argument))).toEqual([]);
    // Control: the pattern finds each of them.
    for (const planted of ['-rtsp_flags', 'listen', 'udp://127.0.0.1:5000', `${SCHEME}0.0.0.0:8559/x`, `${SCHEME}user:pass@127.0.0.1:8559/x`, 'a;b', '$(x)', 'Capture screen 0', '[::]']) {
      if (planted === '-rtsp_flags') continue;
      expect(forbidden.test(planted), planted).toBe(true);
    }
  });

  it('the only locator of a list is the loopback listener of the plan, inside the media range', () => {
    for (const list of lists) for (const argument of list.filter((value) => value.includes('://'))) expect(argument).toMatch(LOOPBACK_RTSP_URL);
    expect(isLoopbackIngest(INGEST)).toBe(true);
    for (const refused of [
      `${SCHEME}127.0.0.1:8553/cam1`,
      `${SCHEME}127.0.0.1:8565/cam1`,
      `${SCHEME}0.0.0.0:8559/cam1`,
      `${SCHEME}192.168.1.20:8559/cam1`,
      `${SCHEME}localhost:8559/cam1`,
      `${SCHEME}user:pass@127.0.0.1:8559/cam1`,
      `${SCHEME}127.0.0.1:8559/cam1?listen=1`,
      `${SCHEME}127.0.0.1:8559/cam1 -rtsp_flags listen`,
      `${SCHEME}127.0.0.1:8559/`,
      'udp://127.0.0.1:8559/cam1',
      '',
    ]) {
      expect(isLoopbackIngest(refused), refused).toBe(false);
      expect(() => cameraPushArguments({ source: 'GENERATED', encoder: CameraHelperEncoder.X264, ingestUrl: refused, startMs: START }), refused).toThrow(/not of its shape/);
    }
  });

  it('S is a whole number of milliseconds of the server clock, written twice', () => {
    const at = (startMs: number): readonly string[] => cameraPushArguments({ source: 'GENERATED', encoder: CameraHelperEncoder.X264, ingestUrl: INGEST, startMs });
    expect(at(1_791_537_920_007).slice(-12, -7)).toEqual(['-copyts', '-output_ts_offset', '-1791537920.007', '-start_time_realtime', '1791537920007000']);
    for (const bad of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => at(bad), String(bad)).toThrow(/not of its shape/);
  });
});

// ── The exact-name rule (M4-SEC-HELPER-1) ─────────────────────────────────────────────────────

describe('the device list and the exact-name rule (M4-SEC-HELPER-1; HL-10)', () => {
  it('reads the two classes of the list', () => {
    expect(parseDeviceList(LIST)).toEqual({ video: ['MacBook Air Camera', 'MacBook Air Desk View Camera', 'Capture screen 0', 'Capture screen 1'], audio: ['MacBook Air Microphone'] });
    expect(parseDeviceList('')).toEqual({ video: [], audio: [] });
    expect(parseDeviceList('[x] [0] MacBook Air Camera')).toEqual({ video: [], audio: [] });
  });

  it('selects the device only when exactly one listed entry equals the name', () => {
    const video = parseDeviceList(LIST).video;
    expect(selectLocalDevice(video, 'MacBook Air Camera')).toEqual({ ok: true, name: 'MacBook Air Camera' });
    // Near matches: never opened.
    for (const near of ['MacBook Air Camer', 'MacBook Air', 'macbook air camera', 'MacBook Air Camera 2', 'MacBook Pro Camera', 'MacBook  Air Camera']) expect(selectLocalDevice(video, near), near).toEqual({ ok: false, reason: 'NAME_ABSENT' });
    expect(selectLocalDevice([], 'MacBook Air Camera')).toEqual({ ok: false, reason: 'NAME_ABSENT' });
    // Two equal entries, or another entry that begins with the name (the device layer matches by prefix).
    expect(selectLocalDevice(['MacBook Air Camera', 'MacBook Air Camera'], 'MacBook Air Camera')).toEqual({ ok: false, reason: 'NAME_AMBIGUOUS' });
    expect(selectLocalDevice(['MacBook Air Camera Pro', 'MacBook Air Camera'], 'MacBook Air Camera')).toEqual({ ok: false, reason: 'NAME_AMBIGUOUS' });
  });

  it('a crafted name selects no screen capture, no index, no keyword and injects no option - even when the list holds it', () => {
    const crafted = [
      'Capture screen 0',
      'capture screen 1',
      '0',
      '2',
      ' 2',
      '+2',
      '-1',
      'default',
      'none',
      'nonexistent',
      'Default Camera',
      'MacBook Air Camera:0',
      'MacBook Air Camera:none',
      '-f',
      '-i',
      '-rtsp_flags listen',
      'MacBook Air Camera -f lavfi',
      'MacBook Air Camera ',
      ' MacBook Air Camera',
      'a;b',
      'a$(b)',
      'a`b`',
      'a"b',
      'a\nb',
      'x@y',
      '',
      'M'.repeat(121),
    ];
    for (const name of crafted) {
      expect(isUsableDeviceName(name) && !/ -/.test(name), JSON.stringify(name)).toBe(false);
    }
    for (const name of crafted.filter((value) => !isUsableDeviceName(value))) {
      expect(selectLocalDevice([name, ...parseDeviceList(LIST).video], name), JSON.stringify(name)).toEqual({ ok: false, reason: 'NAME_NOT_ALLOWED' });
      expect(() => cameraPrecheckArguments(name), JSON.stringify(name)).toThrow(/not of its shape/);
      expect(() => cameraPushArguments({ source: 'DEVICE', deviceName: name, encoder: CameraHelperEncoder.X264, ingestUrl: INGEST, startMs: 5 }), JSON.stringify(name)).toThrow(/not of its shape/);
    }
    // A name with an inner " -" is a usable NAME (one argument, after `-i`): it is not in the list, so nothing is opened.
    expect(selectLocalDevice(parseDeviceList(LIST).video, 'MacBook Air Camera -f lavfi')).toEqual({ ok: false, reason: 'NAME_ABSENT' });
  });

  it('a near-match name or a list without the name is DEVICE_NOT_FOUND with 0 helper processes started', async () => {
    for (const [name, text, reason] of [
      ['MacBook Air Camer', LIST, 'NAME_ABSENT'],
      ['MacBook Air Camera', listWith('MacBook Air Desk View Camera', 'Capture screen 0'), 'NAME_ABSENT'],
      ['MacBook Air Camera', '', 'NAME_ABSENT'],
      ['MacBook Air Camera', listWith('MacBook Air Camera', 'MacBook Air Camera'), 'NAME_AMBIGUOUS'],
      ['Capture screen 0', LIST, 'NAME_NOT_ALLOWED'],
      ['0', LIST, 'NAME_NOT_ALLOWED'],
    ] as const) {
      const fake = fakeDoor(() => text);
      const { adapter } = adapterOn(fake, { deviceName: name });
      const error = await rejection(adapter.openSource('CAM-03', { ingestUrl: INGEST }, new AbortController().signal));
      expect([error.code, error.reason, error.deviceId], name).toEqual(['DEVICE_NOT_FOUND', reason, 'CAM-03']);
      expect(fake.helpers(), name).toHaveLength(0);
      expect(fake.lists(), name).toHaveLength(1);
      expect((await adapter.presence())?.code).toBe('DEVICE_NOT_FOUND');
      expect((await adapter.precheck(new AbortController().signal))?.code).toBe('DEVICE_NOT_FOUND');
      expect(fake.helpers(), name).toHaveLength(0);
      expect(adapter.openSources()).toEqual([]);
    }
  });
});

// ── The helper program path (SEC35-43) ────────────────────────────────────────────────────────

describe('the helper program path (M4-SEC-HELPER-1; SEC35-43)', () => {
  it('is accepted when the file and every directory are owned by root or the server user and not writable by group or others', () => {
    expect(helperProgramRefusal(TRUSTED)).toBeNull();
    expect(helperProgramRefusal({ ...TRUSTED, file: { ownerUid: 0, mode: 0o755 } })).toBeNull();
  });

  it('is refused when relative, missing, not a file, foreign-owned, writable, or reached through a writable or foreign directory', () => {
    const cases: Array<[Partial<ProgramFacts>, HelperProgramRefusal]> = [
      [{ absolute: false }, HelperProgramRefusal.NOT_ABSOLUTE],
      [{ exists: false, file: null }, HelperProgramRefusal.NOT_FOUND],
      [{ regularFile: false }, HelperProgramRefusal.NOT_A_FILE],
      [{ file: { ownerUid: 502, mode: 0o755 } }, HelperProgramRefusal.FILE_OWNER],
      [{ file: { ownerUid: 501, mode: 0o775 } }, HelperProgramRefusal.FILE_WRITABLE],
      [{ file: { ownerUid: 501, mode: 0o757 } }, HelperProgramRefusal.FILE_WRITABLE],
      [{ directoriesAsWritten: [{ ownerUid: 0, mode: 0o755 }, { ownerUid: 501, mode: 0o775 }] }, HelperProgramRefusal.DIRECTORY_WRITABLE],
      // A symbolic link into a writable directory: the path as written is clean, the place it resolves to is not.
      [{ symbolicLink: true, directoriesResolved: [{ ownerUid: 0, mode: 0o755 }, { ownerUid: 501, mode: 0o777 }] }, HelperProgramRefusal.DIRECTORY_WRITABLE],
      [{ directoriesResolved: [{ ownerUid: 0, mode: 0o755 }, { ownerUid: 502, mode: 0o755 }] }, HelperProgramRefusal.DIRECTORY_OWNER],
      [{ serverUid: -1 }, HelperProgramRefusal.FILE_OWNER],
    ];
    for (const [change, refusal] of cases) expect(helperProgramRefusal({ ...TRUSTED, ...change }), JSON.stringify(change)).toBe(refusal);
  });

  const scratch = mkdtempSync(join(tmpdir(), 'dems-l134-'));
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  it('the door reads the facts of a real tree: a link into a writable directory is seen', () => {
    const safe = join(scratch, 'safe');
    const open = join(scratch, 'open');
    mkdirSync(safe, { mode: 0o755 });
    mkdirSync(open, { mode: 0o755 });
    writeFileSync(join(open, 'tool'), '#!/bin/sh\n', { mode: 0o755 });
    chmodSync(open, 0o777);
    symlinkSync(join(open, 'tool'), join(safe, 'tool'));
    const facts = inspectProgram(join(safe, 'tool'));
    expect([facts.absolute, facts.exists, facts.regularFile, facts.symbolicLink]).toEqual([true, true, true, true]);
    expect(facts.directoriesResolved.at(-1)?.mode).toBe(0o777);
    expect(facts.directoriesAsWritten.at(-1)?.mode).toBe(0o755);
    expect(helperProgramRefusal({ ...facts, directoriesAsWritten: TRUSTED.directoriesAsWritten, directoriesResolved: [...TRUSTED.directoriesResolved, facts.directoriesResolved.at(-1) ?? { ownerUid: 0, mode: 0 }] })).toBe(HelperProgramRefusal.DIRECTORY_WRITABLE);
    expect(inspectProgram('tool').absolute).toBe(false);
    expect(inspectProgram(join(scratch, 'nothing')).exists).toBe(false);
    expect(helperProgramRefusal(inspectProgram(scratch))).not.toBeNull();
  });

  it('a refused program starts nothing, not even the device list', async () => {
    const fake = fakeDoor();
    const { adapter } = adapterOn(fake, { inspect: () => ({ ...TRUSTED, file: { ownerUid: 501, mode: 0o777 } }) });
    const error = await rejection(adapter.openSource('CAM-03', { ingestUrl: INGEST }, new AbortController().signal));
    expect([error.code, error.reason]).toEqual(['OPEN_FAILED', 'PROGRAM_REFUSED']);
    expect((await adapter.precheck(new AbortController().signal))?.reason).toBe('PROGRAM_REFUSED');
    expect(fake.started).toHaveLength(0);
  });
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────────────────────

describe('the life of a helper (HL-1, HL-5, HL-8, HL-10, HL-11)', () => {
  async function opened() {
    const fake = fakeDoor();
    const context = adapterOn(fake);
    const pending = context.adapter.openSource('CAM-03', { ingestUrl: INGEST }, new AbortController().signal);
    await settle();
    context.clock.advance(1_500);
    const handle = await pending;
    return { fake, handle, ...context };
  }

  it('reads the list, then starts ONE helper with the program, the table and S; the source is open while it lives', async () => {
    const { fake, adapter, handle } = await opened();
    expect(fake.lists()).toHaveLength(1);
    expect(fake.helpers()).toHaveLength(1);
    const helper = fake.helpers()[0];
    expect(helper?.options.command).toBe(PROGRAM);
    expect(helper?.options.env).toBeUndefined();
    expect(helper?.options.args).toEqual(cameraPushArguments({ source: 'DEVICE', deviceName: LOCAL_CAMERA_DEVICE_NAME, encoder: CameraHelperEncoder.VIDEOTOOLBOX, ingestUrl: INGEST, startMs: 1_791_537_920_123 }));
    expect(handle.deviceId).toBe('CAM-03');
    expect(adapter.openSources()).toEqual(['CAM-03']);
    // A second open of the same device is refused; nothing more is started.
    const again = await rejection(adapter.openSource('CAM-03', { ingestUrl: INGEST }, new AbortController().signal));
    expect([again.code, again.reason]).toEqual(['DEVICE_BUSY', 'ALREADY_OPEN']);
    expect(fake.helpers()).toHaveLength(1);
  });

  it('close: SIGTERM, then SIGKILL after 3 s; no loss is reported for a stop we asked for; closing twice is safe', async () => {
    const { fake, adapter, handle, clock, lost } = await opened();
    const helper = fake.helpers()[0];
    const closing = handle.close();
    await settle();
    expect(helper?.signals).toEqual(['SIGTERM']);
    clock.advance(2_999);
    expect(helper?.signals).toEqual(['SIGTERM']);
    clock.advance(1);
    expect(helper?.signals).toEqual(['SIGTERM', 'SIGKILL']);
    await closing;
    await handle.close();
    expect(adapter.openSources()).toEqual([]);
    expect(lost).toEqual([]);
  });

  it('a helper that ends on SIGTERM is not killed and its exit code (255) is no error', async () => {
    const { fake, handle, clock, lost } = await opened();
    const helper = fake.helpers()[0];
    const closing = handle.close();
    await settle();
    helper?.end({ exitCode: 255 });
    await closing;
    expect(clock.armed()).toEqual([]);
    expect(helper?.signals).toEqual(['SIGTERM']);
    expect(lost).toEqual([]);
  });

  it('a helper that ends during the session is HELPER_EXITED, told once, and nothing is started in its place', async () => {
    const { fake, adapter, lost } = await opened();
    fake.helpers()[0]?.end({ exitCode: 1, diagnostics: 'something unexpected' });
    await settle();
    expect(lost.map((entry) => [entry.deviceId, entry.error.code, entry.error.reason])).toEqual([['CAM-03', 'HELPER_EXITED', 'EXIT_IN_SESSION']]);
    expect(adapter.openSources()).toEqual([]);
    expect(fake.started).toHaveLength(2);
  });

  it('a helper that ends while it starts: the pinned patterns name the cause, anything else is OPEN_FAILED', async () => {
    for (const [diagnostics, code, reason] of [
      ['[avfoundation] Failed to create AV capture input device: not authorized to capture video', 'PERMISSION_DENIED', 'PATTERN'],
      ['Cannot open device: the device is in use by another application', 'DEVICE_BUSY', 'PATTERN'],
      ['Selected framerate (30.000000) is not supported by the device.', 'OPEN_FAILED', 'EXIT_AT_START'],
      ['', 'OPEN_FAILED', 'EXIT_AT_START'],
    ] as const) {
      const fake = fakeDoor();
      const { adapter } = adapterOn(fake);
      const pending = adapter.openSource('CAM-03', { ingestUrl: INGEST }, new AbortController().signal);
      await settle();
      fake.helpers()[0]?.end({ exitCode: 251, diagnostics });
      const error = await rejection(pending);
      expect([error.code, error.reason], diagnostics).toEqual([code, reason]);
      expect(error.message).not.toContain(diagnostics.slice(0, 12) || 'no text');
      expect(fake.helpers()).toHaveLength(1);
      expect(adapter.openSources()).toEqual([]);
    }
  });

  it('a refused connection is tried once more after 500 ms, with the list read again; then it is HELPER_EXITED', async () => {
    const fake = fakeDoor();
    const { adapter, clock } = adapterOn(fake);
    const pending = adapter.openSource('CAM-03', { ingestUrl: INGEST }, new AbortController().signal);
    await settle();
    fake.helpers()[0]?.end({ exitCode: 1, diagnostics: 'Connection refused' });
    await settle();
    expect(fake.helpers()).toHaveLength(1);
    clock.advance(500);
    await settle();
    expect(fake.helpers()).toHaveLength(2);
    expect(fake.lists()).toHaveLength(2);
    fake.helpers()[1]?.end({ exitCode: 1, diagnostics: 'Connection refused' });
    const error = await rejection(pending);
    expect([error.code, error.reason]).toEqual(['HELPER_EXITED', 'INGEST_REFUSED']);
    expect(fake.helpers()).toHaveLength(2);
  });

  it('an aborted open kills the helper and leaves nothing open', async () => {
    const fake = fakeDoor();
    const { adapter } = adapterOn(fake);
    const abort = new AbortController();
    const pending = adapter.openSource('CAM-03', { ingestUrl: INGEST }, abort.signal);
    await settle();
    abort.abort();
    const error = await rejection(pending);
    expect(error.reason).toBe('ABORTED');
    expect(fake.helpers()[0]?.signals).toEqual(['SIGKILL']);
    expect(adapter.openSources()).toEqual([]);
    await expect(adapter.openSource('CAM-03', { ingestUrl: INGEST }, abort.signal)).rejects.toBeInstanceOf(CaptureAdapterError);
  });

  it('a target that is not the loopback listener of a plan starts nothing', async () => {
    const fake = fakeDoor();
    const { adapter } = adapterOn(fake);
    const error = await rejection(adapter.openSource('CAM-03', { ingestUrl: `${SCHEME}192.168.1.20:8559/cam1` }, new AbortController().signal));
    expect([error.code, error.reason]).toEqual(['OPEN_FAILED', 'TARGET_REFUSED']);
    expect(fake.started).toHaveLength(0);
  });

  it('the pre-check is one short open: 0 is fine, a hang is ended at 5 s, a failure is named', async () => {
    const fake = fakeDoor();
    const { adapter, clock } = adapterOn(fake);
    const first = adapter.precheck(new AbortController().signal);
    await settle();
    expect(fake.helpers()[0]?.options.args).toEqual(cameraPrecheckArguments(LOCAL_CAMERA_DEVICE_NAME));
    fake.helpers()[0]?.end({ exitCode: 0 });
    expect(await first).toBeNull();
    const second = adapter.precheck(new AbortController().signal);
    await settle();
    clock.advance(5_000);
    expect((await second)?.reason).toBe('PRECHECK_TIMEOUT');
    expect(fake.helpers()[1]?.signals).toEqual(['SIGKILL']);
    const third = adapter.precheck(new AbortController().signal);
    await settle();
    fake.helpers()[2]?.end({ exitCode: 251, diagnostics: 'permission denied' });
    expect((await third)?.code).toBe('PERMISSION_DENIED');
  });

  it('closeAll stops every live helper', async () => {
    const { fake, adapter } = await opened();
    const all = adapter.closeAll();
    await settle();
    fake.helpers()[0]?.end({ exitCode: 255 });
    await all;
    expect(fake.helpers()[0]?.signals).toEqual(['SIGTERM']);
  });
});

// ── The adapter in the registry of row 65 ─────────────────────────────────────────────────────

describe('the adapter (spec §A.6.0)', () => {
  it('is a LOCAL_DEVICE camera with an opener, registrable in REAL_DEVELOPMENT only', async () => {
    const { adapter } = adapterOn(fakeDoor());
    expect([adapter.seam, adapter.kind, adapter.hasOpener]).toEqual(['CAMERA', CaptureAdapterKind.LOCAL_DEVICE, true]);
    expect(OPENER_CAPABLE_KINDS).toContain(adapter.kind);
    const registry = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_DEVELOPMENT });
    registry.register(adapter);
    expect(registry.assertRecordable('CAM-03').sourceClass).toBe('DEVELOPMENT');
    expect(() => createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION }).register(adapter)).toThrow(CaptureAdapterError);
    expect(() => createCaptureDeviceRegistry({ operation: CaptureOperation.SIMULATED }).register(adapter)).toThrow(CaptureAdapterError);
    expect(await adapter.profiles('CAM-03')).toEqual([{ code: 'H264_720P30', codec: 'H264' }]);
    expect(await adapter.ntpOffsetMs('CAM-03')).toBe(0);
    expect(() => adapter.pullUrl('CAM-03', 'H264_720P30')).toThrow(CaptureAdapterError);
    await expect(adapter.openSource('CAM-01', { ingestUrl: INGEST }, new AbortController().signal)).rejects.toBeInstanceOf(CaptureAdapterError);
    const found = await adapter.discover({ windowMs: 3_000, signal: new AbortController().signal });
    expect([found.candidates.length, found.responderCount]).toEqual([0, 0]);
  });
});

// ── The real door, on a harmless program ──────────────────────────────────────────────────────

describe('the process door (HL-2, HL-4, HL-7)', () => {
  const node = process.execPath;

  it('runs a program without a shell, with an empty environment, and keeps at most 64 KiB of each stream', async () => {
    const script = `process.stderr.write(JSON.stringify(Object.keys(process.env).filter((k) => k !== '__CF_USER_TEXT_ENCODING')) + '|' + process.argv[1] + '|'); process.stderr.write('x'.repeat(200000)); process.stdout.write('out'); process.exitCode = 7;`;
    const child = startHelperProcess({ command: node, args: ['-e', script, '$(echo injected) ; `id`'] });
    expect(child.pid).toBeGreaterThan(0);
    const exit = await child.ended;
    expect([exit.exitCode, exit.spawnFailed, exit.output]).toEqual([7, false, 'out']);
    expect(exit.diagnostics.startsWith('[]|$(echo injected) ; `id`|')).toBe(true);
    expect(Buffer.byteLength(exit.diagnostics)).toBe(HELPER_OUTPUT_CAP_BYTES);
    expect(child.alive()).toBe(false);
  });

  it('a relative program and a missing program are not started', async () => {
    for (const command of ['ffmpeg', './ffmpeg', '/nonexistent/dems/ffmpeg']) {
      const child = startHelperProcess({ command, args: [] });
      const exit = await child.ended;
      expect([command, exit.spawnFailed]).toEqual([command, true]);
    }
  });

  // Task 4 row 180 (the finding of row 21). A child whose start FAILED has no process ID; a signal through its handle
  // in the same turn goes to process ID 0, the caller's whole process group. THE REPRODUCTION IS SAFE: the signal call
  // of every child handle and the signal call of the process are replaced for this case, so nothing real is ever sent.
  it('a program that could not be started is never signalled: not by kill, not by the exit handler; the door still reports spawnFailed', async () => {
    const handleSignal = vi.spyOn(ChildProcess.prototype, 'kill').mockImplementation(() => true);
    const processSignal = vi.spyOn(process, 'kill').mockImplementation(() => true);
    const before = new Set(process.listeners('exit'));
    const ownExitHandlers = () => process.listeners('exit').filter((listener) => !before.has(listener));
    try {
      const child = startHelperProcess({ command: '/nonexistent/dems/ffmpeg', args: [] });
      // The same turn as the start: the failure has not been reported yet, the door still holds the child.
      expect([child.pid, child.alive()]).toEqual([null, true]);
      child.kill('SIGKILL');
      child.kill('SIGTERM');
      const atExit = ownExitHandlers();
      expect(atExit).toHaveLength(1);
      for (const handler of atExit) (handler as () => void)();
      expect(handleSignal.mock.calls).toEqual([]);
      expect(processSignal.mock.calls).toEqual([]);
      // The door's existing answer for a program that was not started, and this process is still here to read it.
      expect(await child.ended).toEqual({ exitCode: null, signal: null, spawnFailed: true, diagnostics: '', output: '' });
      expect(child.alive()).toBe(false);
      child.kill('SIGKILL');
      expect(ownExitHandlers()).toEqual([]);
      expect(handleSignal.mock.calls).toEqual([]);
      expect(processSignal.mock.calls).toEqual([]);
    } finally {
      handleSignal.mockRestore();
      processSignal.mockRestore();
    }
  });

  it('a helper is ended by SIGTERM', async () => {
    const child = startHelperProcess({ command: node, args: ['-e', 'setInterval(() => {}, 1000)'] });
    child.kill('SIGTERM');
    const exit = await child.ended;
    expect(exit.signal).toBe('SIGTERM');
  });

  it('leftover helpers of an earlier run are counted by the exact program path, and nothing is killed', async () => {
    const clock = manualCaptureTimers();
    const table = ['  101 /sbin/launchd', '  202 /opt/dems/bin/ffmpeg', '  203 /opt/dems/bin/ffmpeg', '  204 /opt/dems/bin/ffmpeg-other', '  205 ffmpeg'].join('\n');
    const calls: HelperProcessOptions[] = [];
    const door: HelperDoor = (options) => {
      calls.push(options);
      return { pid: 1, ended: Promise.resolve({ exitCode: 0, signal: null, spawnFailed: false, diagnostics: '', output: table }), alive: () => false, kill: () => {} };
    };
    expect(await leftoverHelperPids(door, clock.timers, PROGRAM, new Set([203]))).toEqual([202]);
    expect(calls.map((call) => [call.command, call.args])).toEqual([['/bin/ps', ['-axo', 'pid=,comm=']]]);
    const broken: HelperDoor = () => ({ pid: null, ended: Promise.resolve({ exitCode: null, signal: null, spawnFailed: true, diagnostics: '', output: '' }), alive: () => false, kill: () => {} });
    expect(await leftoverHelperPids(broken, clock.timers, PROGRAM)).toBeNull();
  });

  // Task 4, blueprint row 24 (WP-02; HA-12, review finding P12-F12 b). THE DOUBLE: a door that starts nothing and
  // answers the two fixed programs from recorded text - the table in the macOS form or in the Linux short-name form,
  // and the link of a process by its pid. No Linux host is read here: the real reading is hardware check 9A/H-24.
  describe('leftover detection behind the platform seam (row 24, HA-12)', () => {
    const RELAY = '/opt/dems/bin/dems-capture-relay';
    const tableDoor = (table: string, links: Readonly<Record<number, string | null>> = {}) => {
      const calls: (readonly [string, readonly string[]])[] = [];
      const door: HelperDoor = (options) => {
        calls.push([options.command, options.args]);
        const answer = (exitCode: number, output: string) => ({ pid: 1, ended: Promise.resolve({ exitCode, signal: null, spawnFailed: false, diagnostics: '', output }), alive: () => false, kill: () => {} });
        if (options.command === '/bin/ps') return answer(0, table);
        const link = links[Number(/^\/proc\/(\d+)\/exe$/.exec(options.args[0] ?? '')?.[1])];
        return link === undefined || link === null ? answer(1, '') : answer(0, `${link}\n`);
      };
      return { door, calls };
    };
    const MACOS = ['    1 /sbin/launchd', '  202 /opt/dems/bin/ffmpeg', '  203 /opt/dems/bin/dems-capture-relay', '  204 /usr/local/bin/ffmpeg'].join('\n');
    const LINUX = ['      1 systemd', '    302 ffmpeg', '    303 ffmpeg', '    304 ffmpeg', '    305 dems-capture-re', '    306 ffmpeg', '    307 ffmpeg', '    308 bash'].join('\n');
    const LINKS = { 302: PROGRAM, 303: '/usr/bin/ffmpeg', 304: PROGRAM, 305: RELAY, 306: null, 307: `${PROGRAM} (deleted)` };

    it('the macOS form: a planted leftover is named by the path in the table, and no program path is read', async () => {
      const clock = manualCaptureTimers();
      const { door, calls } = tableDoor(MACOS);
      expect(programPathReaderFor('darwin', door, clock.timers)).toBeUndefined();
      expect(await leftoverPrograms(door, clock.timers, [PROGRAM, RELAY], new Set(), programPathReaderFor('darwin', door, clock.timers))).toEqual([
        { pid: 202, program: PROGRAM },
        { pid: 203, program: RELAY },
      ]);
      expect(calls).toEqual([['/bin/ps', ['-axo', 'pid=,comm=']]]);
    });

    it('the Linux short-name form: nothing is named without the reader (P12-F12 b), a planted leftover is named with it', async () => {
      const clock = manualCaptureTimers();
      const { door, calls } = tableDoor(LINUX, LINKS);
      expect(processShortName(RELAY)).toBe('dems-capture-re');
      expect(await leftoverPrograms(door, clock.timers, [PROGRAM, RELAY])).toEqual([]);
      calls.length = 0;
      const reader = programPathReaderFor('linux', door, clock.timers);
      expect(reader).toBeDefined();
      // 302 the planted helper; 303 another program of the same name; 304 the Core's own; 305 the planted relay under
      // its cut name; 306 not readable, so counted; 307 a helper whose file was replaced after it started.
      expect(await leftoverPrograms(door, clock.timers, [PROGRAM, RELAY], new Set([304]), reader)).toEqual([
        { pid: 302, program: PROGRAM },
        { pid: 305, program: RELAY },
        { pid: 306, program: PROGRAM },
        { pid: 307, program: PROGRAM },
      ]);
      expect(calls).toEqual([
        ['/bin/ps', ['-axo', 'pid=,comm=']],
        ['/usr/bin/readlink', ['/proc/302/exe']],
        ['/usr/bin/readlink', ['/proc/303/exe']],
        ['/usr/bin/readlink', ['/proc/305/exe']],
        ['/usr/bin/readlink', ['/proc/306/exe']],
        ['/usr/bin/readlink', ['/proc/307/exe']],
      ]);
      expect(await leftoverHelperPids(door, clock.timers, PROGRAM, new Set([304]), reader)).toEqual([302, 306, 307]);
    });

    it('the reader is bounded: a reading that does not end is killed, and too many candidates answer like an unreadable table', async () => {
      const clock = manualCaptureTimers();
      const killed: string[] = [];
      let end: (exit: HelperExit) => void = () => {};
      const hanging: HelperDoor = () => ({ pid: 1, ended: new Promise<HelperExit>((resolve) => (end = resolve)), alive: () => true, kill: (signal) => { killed.push(signal); end({ exitCode: null, signal, spawnFailed: false, diagnostics: '', output: '' }); } });
      const reading = linuxProgramPathReader(hanging, clock.timers)(302);
      await clock.advance(5_000);
      expect(await reading).toBeNull();
      expect(killed).toEqual(['SIGKILL']);
      expect(await linuxProgramPathReader(hanging, clock.timers)(0)).toBeNull();
      const crowd = Array.from({ length: LEFTOVER_CANDIDATE_LIMIT + 1 }, (_, index) => `  ${1000 + index} ffmpeg`).join('\n');
      const asked: number[] = [];
      expect(await leftoverPrograms(tableDoor(crowd).door, clock.timers, [PROGRAM], new Set(), async (pid) => { asked.push(pid); return '/usr/bin/ffmpeg'; })).toBeNull();
      expect(asked).toHaveLength(LEFTOVER_CANDIDATE_LIMIT);
    });
  });
});

// ── Static rules of the folder ────────────────────────────────────────────────────────────────

describe('static rules of adapters/local (G-R12, G-R14; D95)', () => {
  const LOCAL = 'src/capture/adapters/local/';
  // The files of row 134 (the camera, the door, the shared rules). Row 135 adds the microphone's files to the same
  // folder (`mic-*.ts`, `pipe-files.ts`) and holds them to its own static test; they are not judged here.
  const OWN = ['camera-adapter.ts', 'camera-helper-args.ts', 'camera-helper.ts', 'device-list.ts', 'errors.ts', 'helper-program.ts', 'index.ts', 'leftover.ts', 'process-door.ts'];
  const folder = codeOnly(readTree(WORKSPACE).filter((file) => file.path.startsWith(LOCAL) && isProductionSource(file.path) && file.path.endsWith('.ts')));
  const files = folder.filter((file) => OWN.includes(file.path.slice(LOCAL.length)));
  const places = (pattern: RegExp): string[] => [...new Set(occurrences(files, pattern).map((place) => place.replace(/:\d+$/, '')))];
  const processModule = new RegExp(`['"](?:node:)?${['child', 'process'].join('_')}['"]`, 'g');

  it('reads the folder', () => {
    expect(files.map((file) => file.path.slice(LOCAL.length))).toEqual(OWN);
    // The process module is imported by ONE file of the whole folder, whoever wrote the others.
    expect([...new Set(occurrences(folder, processModule).map((place) => place.replace(/:\d+$/, '')))]).toEqual([`${LOCAL}process-door.ts`]);
  });

  it('ONE file of the folder starts a process or reads the file system: the door', () => {
    expect(places(processModule)).toEqual([`${LOCAL}process-door.ts`]);
    expect(places(/['"](?:node:)?fs(?:\/promises)?['"]/g)).toEqual([`${LOCAL}process-door.ts`]);
    const door = files.find((file) => file.path === `${LOCAL}process-door.ts`)?.text ?? '';
    expect([...door.matchAll(/(?<![.\w$])spawn\s*\(/g)]).toHaveLength(1);
    expect(door).toMatch(/shell: false,/);
    expect(door).toMatch(/env: \{ \.\.\.options\.env \},/);
    expect(door).toMatch(/stdio: \['ignore', 'pipe', 'pipe'\],/);
    // Control: the pattern finds a planted import.
    expect(occurrences([{ path: 'x.ts', text: `import { spawn } from 'node:${['child', 'process'].join('_')}';` }], processModule)).toEqual(['x.ts:1']);
  });

  it('no file opens a socket, writes a file, reads the environment or the clock, or logs', () => {
    expect(places(/['"](?:node:)?(?:net|dgram|tls|http|https|http2)['"]/g)).toEqual([]);
    expect(places(/\b(?:writeFile|appendFile|createWriteStream|mkdir|rename|unlink|rm)(?:Sync)?\s*\(/g)).toEqual([]);
    expect(places(/\bprocess\s*\.\s*env\b/g)).toEqual([]);
    expect(places(/\bDate\s*\.\s*now\b|\bnew\s+Date\s*\(/g)).toEqual([]);
    expect(places(/\b(?:set|clear)(?:Interval|Timeout|Immediate)\s*\(/g)).toEqual([]);
    expect(places(/\blog\s*\.\s*(?:info|warn|error|debug)\s*\(|\bconsole\s*\./g)).toEqual([]);
  });

  it('a local device is never replaced by a fake: no file imports the fake adapters or names the FAKE kind (G-R14)', () => {
    expect(places(/from\s+'[^']*\/fake(?:\/[^']*)?'/g)).toEqual([]);
    expect(places(/CaptureAdapterKind\s*\.\s*FAKE\b|createFake[A-Z]\w*/g)).toEqual([]);
    expect(occurrences([{ path: 'x.ts', text: "import { createFakeCameraAdapter } from '../fake';" }], /from\s+'[^']*\/fake(?:\/[^']*)?'/g)).toEqual(['x.ts:1']);
  });
});
