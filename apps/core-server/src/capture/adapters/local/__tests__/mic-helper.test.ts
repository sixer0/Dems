// The lifecycle and the error mapping of the microphone helper (blueprint row 135; capture spec
// §A.7.1 ML-1, ML-5, ML-7, ML-8; §A.6.4 HL-8, HL-10, HL-11; checks M4-SEC-HELPER-1, M4-LOCAL-MIC-1
// support). The FFmpeg program is PLAYED from a script: NO device is opened by any test in this file,
// and the device list is the text the real program prints, not a call. `mkfifo` and the file system
// are real, so the pipe the stream names is a real pipe.
import { existsSync, lstatSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { CaptureMicInputKind } from '@dems/capture-protocol';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../../errors';
import { CaptureAdapterKind, CaptureOperation, CaptureSourceClass, sourceClassOf } from '../../kinds';
import { MIC_TRANSPORTS, micPipePath } from '../../mic-transport';
import { createCaptureDeviceRegistry } from '../../registry';
import { AudioInputErrorCode } from '../../types';
import { LocalSourceError, LocalSourceErrorCode, LocalSourceErrorReason } from '../errors';
import { LOCAL_MIC_DEVICE_NAME, MicGeneratedTone, micPrecheckArguments, micPushArguments } from '../mic-helper-args';
import { createMicHelper, MIC_HELPER_LIMITS, type LocalMicStream, type MicHelperOptions } from '../mic-helper';
import { createLocalMicAdapter } from '../mic-adapter';
import { exitOf, deviceListText, manualTimers, scriptedDoor, temporaryRoot, trustedInspector, type DoorCall, type ProcessScript, type ScriptedDoor } from './mic-support';

const PROGRAM = '/opt/test/ffmpeg';
const NAME = LOCAL_MIC_DEVICE_NAME;
const GOOD_LIST = deviceListText([NAME], ['MacBook Air Camera', 'MacBook Air Desk View Camera', 'Capture screen 0', 'Capture screen 1']);
const uid = process.getuid?.() ?? 501;

const tmp = temporaryRoot();
afterAll(() => tmp.remove());
let counter = 0;

interface Rig {
  readonly door: ScriptedDoor;
  readonly timers: ReturnType<typeof manualTimers>;
  readonly runDir: string;
  readonly options: MicHelperOptions;
}

function rig(list: string | ((n: number) => string | ProcessScript) = GOOD_LIST, push: (call: DoorCall, index: number) => ProcessScript = () => ({ lives: true }), over: Partial<MicHelperOptions> = {}): Rig {
  const timers = manualTimers();
  const door = scriptedDoor(list, push);
  const runDir = `${tmp.root}/case-${(counter += 1)}/run/capture`;
  const options: MicHelperOptions = { program: PROGRAM, runDir, timers, door: door.door, inspect: trustedInspector(uid), ...over };
  return { door, timers, runDir, options };
}

async function until(condition: () => boolean, label: string): Promise<void> {
  for (let attempt = 0; attempt < 400 && !condition(); attempt += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  if (!condition()) throw new Error(`timed out waiting for ${label}`);
}

/** Starts the helper and, if it is still alive, lets the settle time pass. Resolves with the error, or null when the start worked. */
async function startAndSettle(stream: LocalMicStream, timers: Rig['timers'], settleMs = MIC_HELPER_LIMITS.settleMs): Promise<LocalSourceError | null> {
  const outcome = stream.start().then(
    () => null,
    (error: unknown) => error as LocalSourceError,
  );
  await Promise.race([until(() => timers.pending().includes(settleMs), 'the settle timer'), outcome]);
  timers.fire(settleMs);
  return outcome;
}

async function failureOf(promise: Promise<unknown>): Promise<LocalSourceError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(LocalSourceError);
    return error as LocalSourceError;
  }
  throw new Error('expected a named error');
}

const prepareDevice = (helperRig: Rig, deviceId = 'MIC-03', sessionId = 'SES-1'): Promise<LocalMicStream> =>
  createMicHelperOf(helperRig).prepare({ deviceId, sessionId, source: { kind: 'DEVICE', name: NAME } });
const helpers = new WeakMap<Rig, ReturnType<typeof createMicHelper>>();
function createMicHelperOf(helperRig: Rig): ReturnType<typeof createMicHelper> {
  let helper = helpers.get(helperRig);
  if (helper === undefined) {
    helper = createMicHelper(helperRig.options);
    helpers.set(helperRig, helper);
  }
  return helper;
}

describe('ML-1: the device is opened only when exactly one listed AUDIO entry equals the name', () => {
  const refusals: Array<[string, string, LocalSourceErrorReason]> = [
    ['an empty list (the command sandbox lists nothing, HL-13)', deviceListText([], []), LocalSourceErrorReason.NAME_ABSENT],
    ['no list at all', 'nothing printed\n', LocalSourceErrorReason.NAME_ABSENT],
    ['a near-match name', deviceListText(['MacBook Air Microphone 2']), LocalSourceErrorReason.NAME_ABSENT],
    ['a different case', deviceListText(['macbook air microphone']), LocalSourceErrorReason.NAME_ABSENT],
    ['a trailing space in the list (not equal)', deviceListText(['MacBook Air Microphone ']), LocalSourceErrorReason.NAME_ABSENT],
    ['another entry that begins with the name (the device layer matches by prefix)', deviceListText([NAME, `${NAME} Pro`]), LocalSourceErrorReason.NAME_AMBIGUOUS],
    ['the name twice', deviceListText([NAME, NAME]), LocalSourceErrorReason.NAME_AMBIGUOUS],
    ['the name only as a VIDEO entry', deviceListText(['Other Mic'], [NAME]), LocalSourceErrorReason.NAME_ABSENT],
    ['only screen captures and cameras', deviceListText([], ['MacBook Air Camera', 'Capture screen 0']), LocalSourceErrorReason.NAME_ABSENT],
  ];

  for (const [title, list, reason] of refusals) {
    it(`${title}: DEVICE_NOT_FOUND, no helper, no pipe, no directory`, async () => {
      const r = rig(list);
      const error = await failureOf(prepareDevice(r));
      expect(error.code).toBe(LocalSourceErrorCode.DEVICE_NOT_FOUND);
      expect(error.reason).toBe(reason);
      expect(error.deviceId).toBe('MIC-03');
      // The only process that ran is the list call: nothing was pushed and mkfifo never ran.
      expect(r.door.calls).toHaveLength(1);
      expect(r.door.calls[0]?.args).toContain('-list_devices');
      expect(r.door.pushes()).toEqual([]);
      expect(existsSync(r.runDir)).toBe(false);
      expect(createMicHelperOf(r).openIds()).toEqual([]);
    });
  }

  it('control: exactly one entry that equals the name, among cameras and screens, opens', async () => {
    const r = rig();
    const stream = await prepareDevice(r);
    expect(stream.deviceId).toBe('MIC-03');
    await stream.close();
  });

  it('a configured name that could be an index, a keyword or a screen is refused before the list is even read for it', async () => {
    for (const name of ['0', 'default', 'none', 'Capture screen 0', '-f lavfi', 'a:b']) {
      const r = rig(deviceListText([name]));
      const error = await failureOf(createMicHelperOf(r).prepare({ deviceId: 'MIC-03', sessionId: 'SES-1', source: { kind: 'DEVICE', name } }));
      expect(error.code, name).toBe(LocalSourceErrorCode.DEVICE_NOT_FOUND);
      expect(error.reason, name).toBe(LocalSourceErrorReason.NAME_NOT_ALLOWED);
      expect(r.door.pushes()).toEqual([]);
    }
  });
});

describe('prepare: the transport the plan takes, and no helper yet', () => {
  it('hands out the pipe kind the worker reads, at <runDir>/<sessionId>/<deviceId>.pcm, and states the transport', async () => {
    const r = rig();
    const stream = await prepareDevice(r);
    expect(stream.input).toEqual({ kind: CaptureMicInputKind.PCM_FIFO, path: micPipePath(r.runDir, 'SES-1', 'MIC-03') });
    expect(stream.transport).toBe(MIC_TRANSPORTS.PCM_FIFO);
    expect(lstatSync(stream.input.path).isFIFO()).toBe(true);
    expect(lstatSync(stream.input.path).mode & 0o777).toBe(0o600);
    // The input is frozen: a caller cannot move the pipe.
    expect(Object.isFrozen(stream.input)).toBe(true);
    // Not started: no helper, no pid, "is on" already reports the claim.
    expect(r.door.pushes()).toEqual([]);
    expect(stream.started()).toBe(false);
    expect(stream.helperPid()).toBeNull();
    expect(createMicHelperOf(r).openIds()).toEqual(['MIC-03']);
    await stream.close();
  });

  it('a bad id or session id is refused with the locator error and nothing is started', async () => {
    const r = rig();
    for (const bad of [{ deviceId: 'CAM-03', sessionId: 'SES-1' }, { deviceId: 'MIC-03', sessionId: '../x' }]) {
      let caught: unknown;
      try {
        await createMicHelperOf(r).prepare({ ...bad, source: { kind: 'DEVICE', name: NAME } });
      } catch (error) {
        caught = error;
      }
      expect((caught as CaptureAdapterError).code).toBe(CaptureAdapterRefusal.LOCATOR_INVALID);
    }
    expect(r.door.pushes()).toEqual([]);
    expect(createMicHelperOf(r).openIds()).toEqual([]);
  });

  it('the program path is held to the rule: a writable directory on the way ends it before any process', async () => {
    const writable = (): ReturnType<ReturnType<typeof trustedInspector>> => ({ ...trustedInspector(uid)(), directoriesAsWritten: [{ ownerUid: 0, mode: 0o775 }] });
    const r = rig(GOOD_LIST, undefined, { inspect: writable });
    const error = await failureOf(prepareDevice(r));
    expect(error.code).toBe(LocalSourceErrorCode.OPEN_FAILED);
    expect(error.reason).toBe(LocalSourceErrorReason.PROGRAM_REFUSED);
    expect(r.door.calls).toEqual([]);
  });

  it('a device list that does not end is killed at its bound: OPEN_FAILED / LIST_UNAVAILABLE', async () => {
    const r = rig(() => ({ lives: true }));
    const pending = failureOf(prepareDevice(r));
    await until(() => r.timers.pending().includes(MIC_HELPER_LIMITS.listTimeoutMs), 'the list bound');
    r.timers.fire(MIC_HELPER_LIMITS.listTimeoutMs);
    const error = await pending;
    expect(error.code).toBe(LocalSourceErrorCode.OPEN_FAILED);
    expect(error.reason).toBe(LocalSourceErrorReason.LIST_UNAVAILABLE);
    expect(r.door.ffmpeg[0]?.signals).toEqual(['SIGKILL']);
    expect(createMicHelperOf(r).openIds()).toEqual([]);
  });

  it('a program that cannot be started: OPEN_FAILED / PROGRAM_REFUSED', async () => {
    const r = rig(() => ({ ends: exitOf({ exitCode: null, spawnFailed: true }) }));
    const error = await failureOf(prepareDevice(r));
    expect(error.reason).toBe(LocalSourceErrorReason.PROGRAM_REFUSED);
  });

  it('one microphone is prepared once at a time, also when two calls race; after close it can be prepared again', async () => {
    const r = rig();
    const helper = createMicHelperOf(r);
    const request = { deviceId: 'MIC-03', sessionId: 'SES-1', source: { kind: 'DEVICE', name: NAME } } as const;
    const results = await Promise.allSettled([helper.prepare(request), helper.prepare(request)]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const refused = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect((refused.reason as LocalSourceError).code).toBe(LocalSourceErrorCode.DEVICE_BUSY);
    expect((refused.reason as LocalSourceError).reason).toBe(LocalSourceErrorReason.ALREADY_OPEN);
    const first = (results.find((result) => result.status === 'fulfilled') as PromiseFulfilledResult<LocalMicStream>).value;
    await first.close();
    await (await helper.prepare(request)).close();
  });

  it('a call that was aborted before it began starts nothing', async () => {
    const r = rig();
    const controller = new AbortController();
    controller.abort();
    const error = await failureOf(createMicHelperOf(r).prepare({ deviceId: 'MIC-03', sessionId: 'SES-1', source: { kind: 'DEVICE', name: NAME }, signal: controller.signal }));
    expect(error.reason).toBe(LocalSourceErrorReason.ABORTED);
    expect(r.door.calls).toEqual([]);
  });
});

describe('start: the helper is launched with the fixed table and nothing else', () => {
  it('pushes the exact argument list, with an EMPTY environment, and reads the list again before it', async () => {
    const r = rig();
    const stream = await prepareDevice(r);
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    const [push] = r.door.pushes();
    expect(push?.command).toBe(PROGRAM);
    expect([...(push?.args ?? [])]).toEqual([...micPushArguments({ source: { kind: 'DEVICE', name: NAME }, pipePath: stream.input.path })]);
    expect(push?.env).toEqual({});
    // List before prepare, list before start: every open follows a list (HL-10).
    expect(r.door.calls.filter((call) => call.args.includes('-list_devices'))).toHaveLength(2);
    expect(stream.started()).toBe(true);
    expect(stream.helperPid()).toBe(4002);
    expect(createMicHelperOf(r).livePids()).toEqual(new Set([4002]));
    await stream.close();
    expect(createMicHelperOf(r).livePids()).toEqual(new Set());
  });

  it('the device vanished between prepare and start: DEVICE_NOT_FOUND and no helper', async () => {
    const r = rig((n) => (n === 0 ? GOOD_LIST : deviceListText([])));
    const stream = await prepareDevice(r);
    const error = await failureOf(stream.start());
    expect(error.code).toBe(LocalSourceErrorCode.DEVICE_NOT_FOUND);
    expect(r.door.pushes()).toEqual([]);
    await stream.close();
  });

  it('starts only once', async () => {
    const r = rig();
    const stream = await prepareDevice(r);
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    const error = await failureOf(stream.start());
    expect(error.reason).toBe(LocalSourceErrorReason.ALREADY_OPEN);
    expect(r.door.pushes()).toHaveLength(1);
    await stream.close();
  });

  it('a generated source needs no device list, no permission and starts the generator through the same output line', async () => {
    const r = rig('not a device list\n');
    const stream = await createMicHelperOf(r).prepare({ deviceId: 'MIC-04', sessionId: 'SES-1', source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_880 } });
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    expect(r.door.calls.filter((call) => call.args.includes('-list_devices'))).toEqual([]);
    expect([...(r.door.pushes()[0]?.args ?? [])]).toContain('sine=frequency=880:sample_rate=48000');
    await stream.close();
  });
});

// Fix wave H (ruling D198): the development speech microphone plays a file through the same helper.
describe('the speech fixture source: no device list, the fixture held to the path rule, the file input started', () => {
  const FIXTURE = '/work/.data/dev-fixtures/speech-mic/dialogue.wav';

  it('prepares and starts without a device list; the push list reads the fixture in real time, looped, and names no device layer', async () => {
    const r = rig('not a device list\n');
    const stream = await createMicHelperOf(r).prepare({ deviceId: 'MIC-01', sessionId: 'SES-1', source: { kind: 'FIXTURE', path: FIXTURE } });
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    expect(r.door.calls.filter((call) => call.args.includes('-list_devices'))).toEqual([]);
    const args = [...(r.door.pushes()[0]?.args ?? [])];
    expect(args.slice(args.indexOf('-re'), args.indexOf('-i') + 2)).toEqual(['-re', '-stream_loop', '-1', '-f', 'wav', '-i', FIXTURE]);
    expect(args).not.toContain('avfoundation');
    await stream.close();
  });

  it('a fixture that is absent or that another user could replace is refused by name BEFORE a pipe is made or a helper is started', async () => {
    const absent = { ...trustedInspector(uid)(), exists: false, file: null };
    const writable = { ...trustedInspector(uid)(), file: { ownerUid: uid, mode: 0o666 } };
    for (const facts of [absent, writable]) {
      const r = rig('not a device list\n', () => ({ lives: true }), { inspect: (path) => (path === FIXTURE ? facts : trustedInspector(uid)()) });
      const error = await failureOf(createMicHelperOf(r).prepare({ deviceId: 'MIC-01', sessionId: 'SES-1', source: { kind: 'FIXTURE', path: FIXTURE } }));
      expect([error.code, error.reason, error.deviceId]).toEqual([LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.FIXTURE_REFUSED, 'MIC-01']);
      expect(r.door.calls).toEqual([]);
      expect(createMicHelperOf(r).openIds()).toEqual([]);
    }
  });

  it('the fixture is asked again at the start: one that was replaced after the prepare is not played', async () => {
    let replaced = false;
    const r = rig('not a device list\n', () => ({ lives: true }), { inspect: (path) => (path === FIXTURE && replaced ? { ...trustedInspector(uid)(), file: { ownerUid: uid + 1, mode: 0o644 } } : trustedInspector(uid)()) });
    const stream = await createMicHelperOf(r).prepare({ deviceId: 'MIC-01', sessionId: 'SES-1', source: { kind: 'FIXTURE', path: FIXTURE } });
    replaced = true;
    const error = await failureOf(stream.start());
    expect(error.reason).toBe(LocalSourceErrorReason.FIXTURE_REFUSED);
    expect(r.door.pushes()).toEqual([]);
    await stream.close();
  });
});

describe('the five named errors, mapped from what the helper says (H-18: the patterns are a hypothesis until the user denies once)', () => {
  const cases: Array<[string, ProcessScript, LocalSourceErrorCode, LocalSourceErrorReason]> = [
    ['a refused permission', { ends: exitOf({ exitCode: 1, diagnostics: '[AVFoundation indev @ 0x1] Failed: not authorized to access the microphone' }) }, LocalSourceErrorCode.PERMISSION_DENIED, LocalSourceErrorReason.PATTERN],
    ['a refused permission, other words', { ends: exitOf({ exitCode: 1, diagnostics: 'Operation not permitted' }) }, LocalSourceErrorCode.PERMISSION_DENIED, LocalSourceErrorReason.PATTERN],
    ['a device in use', { ends: exitOf({ exitCode: 1, diagnostics: 'The device is in use by another application' }) }, LocalSourceErrorCode.DEVICE_BUSY, LocalSourceErrorReason.PATTERN],
    ['an open that failed with words nobody pinned', { ends: exitOf({ exitCode: 1, diagnostics: 'Error opening input: Input/output error' }) }, LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.EXIT_AT_START],
    ['an open that failed with no words at all', { ends: exitOf({ exitCode: 1 }) }, LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.EXIT_AT_START],
    ['a program that does not start', { ends: exitOf({ exitCode: null, spawnFailed: true }) }, LocalSourceErrorCode.OPEN_FAILED, LocalSourceErrorReason.PROGRAM_REFUSED],
  ];
  for (const [title, script, code, reason] of cases) {
    it(`${title}: ${code}`, async () => {
      const r = rig(GOOD_LIST, () => script);
      const stream = await prepareDevice(r);
      const error = await startAndSettle(stream, r.timers);
      expect(error?.code).toBe(code);
      expect(error?.reason).toBe(reason);
      expect(error?.deviceId).toBe('MIC-03');
      // The error is safe in a log: no helper text, no device name, no path.
      expect(JSON.stringify([error?.message, error?.code, error?.reason, error?.deviceId])).not.toMatch(/MacBook|AVFoundation|nobody|\/|input/i);
      await stream.close();
      expect(existsSync(stream.input.path)).toBe(false);
    });
  }

  it('a helper that was alive and then ends is HELPER_EXITED, told once to the listener; a stop of ours is not', async () => {
    const r = rig();
    const stream = await prepareDevice(r);
    const told: LocalSourceError[] = [];
    stream.onLost((error) => told.push(error));
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    r.door.ffmpeg[r.door.ffmpeg.length - 1]?.endNow(exitOf({ exitCode: 1, diagnostics: 'Broken pipe' }));
    await until(() => told.length > 0, 'the loss report');
    expect(told).toHaveLength(1);
    expect(told[0]?.code).toBe(LocalSourceErrorCode.HELPER_EXITED);
    expect(told[0]?.reason).toBe(LocalSourceErrorReason.EXIT_IN_SESSION);
    await stream.close();
    expect(told).toHaveLength(1);

    // Control: a helper stopped by close() reports nothing.
    const quiet = rig();
    const calm = await prepareDevice(quiet);
    const heard: LocalSourceError[] = [];
    calm.onLost((error) => heard.push(error));
    expect(await startAndSettle(calm, quiet.timers)).toBeNull();
    await calm.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(heard).toEqual([]);
  });

  it('a permission that is refused after the settle time is still PERMISSION_DENIED, not a guess', async () => {
    const r = rig();
    const stream = await prepareDevice(r);
    const told: LocalSourceError[] = [];
    stream.onLost((error) => told.push(error));
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    r.door.ffmpeg[r.door.ffmpeg.length - 1]?.endNow(exitOf({ exitCode: 1, diagnostics: 'not authorized' }));
    await until(() => told.length > 0, 'the loss report');
    expect(told[0]?.code).toBe(LocalSourceErrorCode.PERMISSION_DENIED);
    await stream.close();
  });
});

describe('HL-8: stopping', () => {
  it('SIGTERM first; a helper that obeys is gone and the grace timer is cancelled', async () => {
    const r = rig();
    const stream = await prepareDevice(r);
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    const helper = r.door.ffmpeg[r.door.ffmpeg.length - 1];
    await stream.close();
    expect(helper?.signals).toEqual(['SIGTERM']);
    expect(r.timers.pending()).not.toContain(MIC_HELPER_LIMITS.stopGraceMs);
    expect(existsSync(stream.input.path)).toBe(false);
    expect(createMicHelperOf(r).openIds()).toEqual([]);
  });

  it('a helper blocked at a pipe nobody reads ignores SIGTERM: SIGKILL after the grace, and not before', async () => {
    const r = rig(GOOD_LIST, () => ({ lives: true, ignoresTerm: true }));
    const stream = await prepareDevice(r);
    expect(await startAndSettle(stream, r.timers)).toBeNull();
    const helper = r.door.ffmpeg[r.door.ffmpeg.length - 1];
    let done = false;
    const closing = stream.close().then(() => {
      done = true;
    });
    await until(() => r.timers.pending().includes(MIC_HELPER_LIMITS.stopGraceMs), 'the grace timer');
    expect(helper?.signals).toEqual(['SIGTERM']);
    expect(done).toBe(false);
    r.timers.fire(MIC_HELPER_LIMITS.stopGraceMs);
    await closing;
    expect(helper?.signals).toEqual(['SIGTERM', 'SIGKILL']);
    expect(helper?.alive()).toBe(false);
    expect(existsSync(stream.input.path)).toBe(false);
  });

  it('close is safe twice and returns the same promise; close before start starts nothing', async () => {
    const r = rig();
    const stream = await prepareDevice(r);
    const first = stream.close();
    expect(stream.close()).toBe(first);
    await first;
    expect(r.door.pushes()).toEqual([]);
    expect(existsSync(stream.input.path)).toBe(false);
    // A closed stream cannot be started.
    const error = await failureOf(stream.start());
    expect(error.reason).toBe(LocalSourceErrorReason.ABORTED);
  });

  it('closeAll stops every helper and removes every pipe', async () => {
    const r = rig();
    const helper = createMicHelperOf(r);
    const one = await helper.prepare({ deviceId: 'MIC-03', sessionId: 'SES-1', source: { kind: 'DEVICE', name: NAME } });
    const two = await helper.prepare({ deviceId: 'MIC-04', sessionId: 'SES-1', source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_440 } });
    expect(await startAndSettle(two, r.timers)).toBeNull();
    await helper.closeAll();
    expect(existsSync(one.input.path)).toBe(false);
    expect(existsSync(two.input.path)).toBe(false);
    expect(helper.openIds()).toEqual([]);
    expect(r.door.ffmpeg.every((process) => !process.alive())).toBe(true);
  });

  it('an abort during the settle time kills the helper and reports ABORTED', async () => {
    const r = rig();
    const stream = await prepareDevice(r);
    const controller = new AbortController();
    const outcome = failureOf(stream.start(controller.signal));
    await until(() => r.timers.pending().includes(MIC_HELPER_LIMITS.settleMs), 'the settle timer');
    controller.abort();
    const error = await outcome;
    expect(error.reason).toBe(LocalSourceErrorReason.ABORTED);
    expect(r.door.ffmpeg[r.door.ffmpeg.length - 1]?.signals).toEqual(['SIGKILL']);
    await stream.close();
  });
});

describe('HL-12: the pre-check is the only open besides start, and a missing device never reaches it', () => {
  it('opens the device once, with the pre-check table, when exactly one entry matches', async () => {
    const r = rig(GOOD_LIST, () => ({ ends: exitOf({ exitCode: 0 }) }));
    expect(await createMicHelperOf(r).precheck('MIC-03', NAME)).toBeNull();
    expect(r.door.pushes()).toHaveLength(1);
    expect([...(r.door.pushes()[0]?.args ?? [])]).toEqual([...micPrecheckArguments(NAME)]);
    expect(r.door.calls.some((call) => call.command.endsWith('mkfifo'))).toBe(false);
  });

  it('a device that is not listed is DEVICE_NOT_FOUND and nothing is opened', async () => {
    const r = rig(deviceListText([]));
    const error = await createMicHelperOf(r).precheck('MIC-03', NAME);
    expect(error?.code).toBe(LocalSourceErrorCode.DEVICE_NOT_FOUND);
    expect(r.door.pushes()).toEqual([]);
  });

  it('maps a refused permission, a busy device and an open that hangs', async () => {
    const denied = rig(GOOD_LIST, () => ({ ends: exitOf({ exitCode: 1, diagnostics: 'not authorized' }) }));
    expect((await createMicHelperOf(denied).precheck('MIC-03', NAME))?.code).toBe(LocalSourceErrorCode.PERMISSION_DENIED);
    const busy = rig(GOOD_LIST, () => ({ ends: exitOf({ exitCode: 1, diagnostics: 'device is busy' }) }));
    expect((await createMicHelperOf(busy).precheck('MIC-03', NAME))?.code).toBe(LocalSourceErrorCode.DEVICE_BUSY);

    // A bound of its own, so that the list call's bound (5 s) cannot be mistaken for it.
    const hanging = rig(GOOD_LIST, () => ({ lives: true }), { limits: { precheckTimeoutMs: 7_000 } });
    const pending = createMicHelperOf(hanging).precheck('MIC-03', NAME);
    await until(() => hanging.timers.pending().includes(7_000), 'the pre-check bound');
    hanging.timers.fire(7_000);
    const timedOut = await pending;
    expect(timedOut?.reason).toBe(LocalSourceErrorReason.PRECHECK_TIMEOUT);
    expect(hanging.door.pushes()).toHaveLength(1);
  });

  it('presence() reads the list and opens nothing', async () => {
    const r = rig();
    expect(await createMicHelperOf(r).presence('MIC-03', NAME)).toBeNull();
    expect((await createMicHelperOf(rig(deviceListText([]))).presence('MIC-03', NAME))?.code).toBe(LocalSourceErrorCode.DEVICE_NOT_FOUND);
    expect(r.door.pushes()).toEqual([]);
  });
});

describe('the adapter: AudioInputAdapter of kind LOCAL_DEVICE (row 65 seam)', () => {
  const adapterOver = (list: string | ((n: number) => string | ProcessScript) = GOOD_LIST, extra: Partial<Parameters<typeof createLocalMicAdapter>[0]> = {}): ReturnType<typeof rig> & { adapter: ReturnType<typeof createLocalMicAdapter> } => {
    const r = rig(list);
    const adapter = createLocalMicAdapter({ id: 'MIC-03', program: PROGRAM, runDir: r.runDir, timers: r.timers, door: r.door.door, inspect: trustedInspector(uid), ...extra });
    return { ...r, adapter };
  };

  it('is a development source with an opener, and the registry of REAL_DEVELOPMENT takes it', () => {
    const { adapter } = adapterOver();
    expect(adapter.kind).toBe(CaptureAdapterKind.LOCAL_DEVICE);
    expect(sourceClassOf(adapter.kind)).toBe(CaptureSourceClass.DEVELOPMENT);
    expect(adapter.hasOpener).toBe(true);
    expect(adapter.devices.map((device) => [device.id, device.deviceClass, device.capabilities])).toEqual([['MIC-03', 'MIC', ['AUDIO']]]);
    const registry = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_DEVELOPMENT });
    registry.register(adapter);
    expect(registry.describe('MIC-03')).toMatchObject({ adapterKind: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT', hasOpener: true });
    expect(registry.assertRecordable('MIC-03').id).toBe('MIC-03');
    expect(registry.assertAssignable('MIC', 'MIC-03').id).toBe('MIC-03');
    expect(registry.resolve('MIC', 'MIC-03')).toBe(adapter);
  });

  it('is refused in the operations that record no development source (control)', () => {
    for (const operation of [CaptureOperation.SIMULATED, CaptureOperation.REAL_PRODUCTION]) {
      const { adapter } = adapterOver();
      expect(() => createCaptureDeviceRegistry({ operation }).register(adapter), operation).toThrow(CaptureAdapterError);
    }
  });

  it('enumerate: present when listed; the named cause when not; opens nothing', async () => {
    const present = adapterOver();
    expect(await present.adapter.enumerate()).toEqual([{ inputId: 'MIC-03', present: true, errorCode: null }]);
    expect(present.door.pushes()).toEqual([]);

    const absent = adapterOver(deviceListText([]));
    expect(await absent.adapter.enumerate()).toEqual([{ inputId: 'MIC-03', present: false, errorCode: AudioInputErrorCode.DEVICE_NOT_FOUND }]);

    const refused = adapterOver(GOOD_LIST, { inspect: () => ({ ...trustedInspector(uid)(), exists: false, file: null }) });
    expect(await refused.adapter.enumerate()).toEqual([{ inputId: 'MIC-03', present: false, errorCode: AudioInputErrorCode.OPEN_FAILED }]);
    expect(refused.door.calls).toEqual([]);
  });

  it('open hands out the stream; start launches it; close stops it; "is on" follows', async () => {
    const { adapter, timers, door } = adapterOver();
    const stream = await adapter.open('MIC-03', { sessionId: 'SES-9', signal: new AbortController().signal });
    expect(stream.input.kind).toBe('PCM_FIFO');
    expect(stream.input.path.endsWith('/SES-9/MIC-03.pcm')).toBe(true);
    expect(adapter.openSources()).toEqual(['MIC-03']);
    expect(door.pushes()).toEqual([]);
    expect(await startAndSettle(stream, timers)).toBeNull();
    await stream.close();
    expect(adapter.openSources()).toEqual([]);
  });

  it('open names the cause and never a fake: an absent microphone is DEVICE_NOT_FOUND and the stream does not exist', async () => {
    const { adapter, door } = adapterOver(deviceListText([]));
    const error = await failureOf(adapter.open('MIC-03', { sessionId: 'SES-9', signal: new AbortController().signal }));
    expect(error.code).toBe(LocalSourceErrorCode.DEVICE_NOT_FOUND);
    expect(adapter.openSources()).toEqual([]);
    expect(door.pushes()).toEqual([]);
  });

  it('refuses another device id and an aborted call', async () => {
    const { adapter } = adapterOver();
    let caught: unknown;
    try {
      await adapter.open('MIC-09', { sessionId: 'SES-9', signal: new AbortController().signal });
    } catch (error) {
      caught = error;
    }
    expect((caught as CaptureAdapterError).code).toBe(CaptureAdapterRefusal.DEVICE_UNKNOWN);
    const controller = new AbortController();
    controller.abort();
    try {
      await adapter.open('MIC-03', { sessionId: 'SES-9', signal: controller.signal });
    } catch (error) {
      caught = error;
    }
    expect((caught as CaptureAdapterError).code).toBe(CaptureAdapterRefusal.ABORTED);
  });

  it('tells the layer above when a started microphone is lost; closeAll is the shutdown hook', async () => {
    const lost: Array<[string, LocalSourceErrorCode]> = [];
    const { adapter, timers, door } = adapterOver(GOOD_LIST, { onSourceLost: (id, error) => lost.push([id, error.code]) });
    const stream = await adapter.open('MIC-03', { sessionId: 'SES-9', signal: new AbortController().signal });
    expect(await startAndSettle(stream, timers)).toBeNull();
    door.ffmpeg[door.ffmpeg.length - 1]?.endNow(exitOf({ exitCode: 1 }));
    await until(() => lost.length > 0, 'the loss report');
    expect(lost).toEqual([['MIC-03', LocalSourceErrorCode.HELPER_EXITED]]);
    await adapter.closeAll();
    expect(adapter.openSources()).toEqual([]);
  });

  it('level is the telemetry given in, or null: the helper has no meter', async () => {
    expect(await adapterOver().adapter.level('MIC-03')).toBeNull();
    expect(await adapterOver(GOOD_LIST, { level: () => -23.5 }).adapter.level('MIC-03')).toBe(-23.5);
  });
});
