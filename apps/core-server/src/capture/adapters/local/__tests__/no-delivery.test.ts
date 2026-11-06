// No silent wait (integration pass C2; hypothesis H-18; decisions D118, D119).
//
// WHAT WAS OBSERVED (D118): started from an app that macOS does not ask for the camera, the helper
// stayed alive, printed nothing and pushed nothing, with no end. NO DEVICE IS OPENED HERE: the
// "device that never delivers" is a GENERATED stand-in - a two-line program that ignores its
// arguments and blocks - started through the REAL process door, exactly as the helper is.
//
// Part 1 reads the progress report (numbers only). Part 2 holds the bound with a door that starts
// nothing. Part 3 is the real door: the stand-in is stopped after 8 s and the loss is a named error;
// the control runs the same stand-in with the bound moved away and shows the old behaviour (alive,
// nothing reported); the positive runs the real FFmpeg program with the generated tone past the bound.
import { chmodSync, createReadStream, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createSystemTimers } from '../../../timers';
import { createLocalCameraAdapter } from '../camera-adapter';
import { CAMERA_HELPER_LIMITS, FIRST_DELIVERY_MS, FIRST_DELIVERY_SECONDS, NO_DELIVERY_REASON, createCameraHelpers, createDeliveryWatch, errorOfNoDelivery } from '../camera-helper';
import { PROGRESS_ARGUMENTS, cameraPushArguments } from '../camera-helper-args';
import type { LocalSourceError } from '../errors';
import { MicGeneratedTone, micPushArguments } from '../mic-helper-args';
import { MIC_HELPER_LIMITS, createMicHelper } from '../mic-helper';
import { inspectProgram, type HelperDoor, type HelperExit, type HelperProcessOptions, type ProgramInspector } from '../process-door';
import { FFMPEG, deviceListText, exitOf, manualTimers, trustedInspector } from './mic-support';

const INGEST = `${['rtsp', '://'].join('')}127.0.0.1:8563/cam1`;
const root = mkdtempSync(join(tmpdir(), 'dems-nodelivery-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
let counter = 0;
const nextRunDir = (): string => join(root, `run-${(counter += 1)}`, 'run', 'capture');

/** A generated "helper": it ignores every argument, optionally says one line on standard error, and blocks. */
function standIn(name: string, firstLine = ''): string {
  const path = join(root, name);
  writeFileSync(path, `#!/bin/sh\n${firstLine === '' ? '' : `echo '${firstLine}' >&2\n`}exec /bin/sleep 120\n`);
  chmodSync(path, 0o700);
  return path;
}

/** The file facts are the real ones; the directory chain of the temporary folder is stated as trusted (the rule has its own tests). */
const realFileFacts: ProgramInspector = (path) => ({ ...inspectProgram(path), directoriesAsWritten: [{ ownerUid: 0, mode: 0o755 }], directoriesResolved: [{ ownerUid: 0, mode: 0o755 }] });

const alive = (pid: number | null): boolean => {
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('the progress report is read for two numbers only', () => {
  const fed = (kind: 'FRAME' | 'SAMPLE', ...chunks: string[]): boolean => {
    const watch = createDeliveryWatch(kind);
    for (const chunk of chunks) watch.push(Buffer.from(chunk));
    return watch.delivered();
  };

  it('the bound is 8 s and the reasons carry the same figure', () => {
    expect([FIRST_DELIVERY_SECONDS, FIRST_DELIVERY_MS, CAMERA_HELPER_LIMITS.firstFrameMs, MIC_HELPER_LIMITS.firstSampleMs]).toEqual([8, 8_000, 8_000, 8_000]);
    expect(NO_DELIVERY_REASON).toEqual({ FRAME: 'NO_FRAME_WITHIN_8S', SAMPLE: 'NO_SAMPLE_WITHIN_8S' });
  });

  it('both push tables ask for the report on standard output, and no other list does', () => {
    expect([...PROGRESS_ARGUMENTS]).toEqual(['-progress', 'pipe:1']);
    const camera = cameraPushArguments({ source: 'GENERATED', encoder: 'X264', ingestUrl: INGEST, startMs: 1_791_537_920_123 });
    const mic = micPushArguments({ source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_880 }, pipePath: '/work/run/capture/SES-1/MIC-03.pcm' });
    for (const list of [camera, mic]) expect(list[list.indexOf('-progress') + 1]).toBe('pipe:1');
  });

  it('a frame count above zero is a delivery; zero, nothing, and other keys are not', () => {
    expect(fed('FRAME', 'frame=22\nfps=0.00\nprogress=continue\n')).toBe(true);
    expect(fed('FRAME', 'frame=0\nfps=0.00\ntotal_size=4096\nout_time_us=733333\nprogress=continue\n')).toBe(false);
    expect(fed('FRAME')).toBe(false);
    expect(fed('FRAME', 'drop_frames=7\ndup_frames=3\nxframe=9\n')).toBe(false);
  });

  it('a line cut across two chunks is read once it is whole; an unfinished line is not', () => {
    expect(fed('FRAME', 'fra', 'me=', '3', '\n')).toBe(true);
    expect(fed('FRAME', 'frame=3')).toBe(false);
  });

  it('a sample delivery is bytes or time written above zero; N/A and zero are not', () => {
    expect(fed('SAMPLE', 'total_size=N/A\nout_time_us=0\nprogress=continue\n')).toBe(false);
    expect(fed('SAMPLE', 'total_size=0\nout_time_us=N/A\n')).toBe(false);
    expect(fed('SAMPLE', 'total_size=8192\n')).toBe(true);
    expect(fed('SAMPLE', 'total_size=N/A\nout_time_us=21333\n')).toBe(true);
    expect(fed('SAMPLE', 'frame=40\n')).toBe(false);
  });

  it('text that is not a number, a negative number and an endless line never count', () => {
    expect(fed('FRAME', 'frame=12abc\nframe=-4\nframe= \nframe=1e9\n')).toBe(false);
    expect(fed('FRAME', `${'x'.repeat(5_000)}frame=9\n`)).toBe(false);
    expect(fed('FRAME', 'x'.repeat(5_000), '\nframe=9\n')).toBe(true);
  });

  it('the named error: the platform word when the helper said it, else the reason of the bound', () => {
    const silent = errorOfNoDelivery(exitOf({ exitCode: null, signal: 'SIGKILL' }), 'FRAME', 'CAM-03');
    expect([silent.code, silent.reason, silent.deviceId]).toEqual(['OPEN_FAILED', 'NO_FRAME_WITHIN_8S', 'CAM-03']);
    const mic = errorOfNoDelivery(exitOf({ exitCode: null, signal: 'SIGKILL' }), 'SAMPLE', 'MIC-03');
    expect([mic.code, mic.reason]).toEqual(['OPEN_FAILED', 'NO_SAMPLE_WITHIN_8S']);
    const refused = errorOfNoDelivery(exitOf({ exitCode: null, signal: 'SIGKILL', diagnostics: 'This app is not authorized to use the camera' }), 'FRAME', 'CAM-03');
    expect([refused.code, refused.reason]).toEqual(['PERMISSION_DENIED', 'PATTERN']);
    // Neither field carries text of the helper.
    expect(JSON.stringify([refused.message, refused.reason, silent.message])).not.toMatch(/authorized|camera helper|sleep/i);
  });
});

// ── A door that starts nothing ────────────────────────────────────────────────────────────────
function quietDoor() {
  const children: Array<{ options: HelperProcessOptions; signals: string[]; say(text: string): void; alive(): boolean }> = [];
  const door: HelperDoor = (options) => {
    let over = false;
    let finish: (exit: HelperExit) => void = () => {};
    const ended = new Promise<HelperExit>((resolve) => {
      finish = resolve;
    });
    const signals: string[] = [];
    children.push({ options, signals, say: (text) => options.onOutput?.(Buffer.from(text)), alive: () => !over });
    // The device-list call answers by itself (it opens nothing): the list of this Mac, on standard error.
    if (options.args.includes('-list_devices')) {
      over = true;
      return { pid: null, ended: Promise.resolve(exitOf({ exitCode: 251, diagnostics: deviceListText(['MacBook Air Microphone'], ['MacBook Air Camera']) })), alive: () => false, kill: () => {} };
    }
    return {
      pid: 5000 + children.length,
      ended,
      alive: () => !over,
      kill(signal) {
        signals.push(signal);
        if (over) return;
        over = true;
        finish(exitOf({ exitCode: null, signal }));
      },
    };
  };
  return { door, children };
}
const turns = async (): Promise<void> => {
  for (let turn = 0; turn < 8; turn += 1) await new Promise((resolve) => setImmediate(resolve));
};

describe('the bound, with a door that starts nothing', () => {
  async function openCamera() {
    const fake = quietDoor();
    const timers = manualTimers();
    const lost: LocalSourceError[] = [];
    const helpers = createCameraHelpers({ program: '/opt/dems/bin/ffmpeg', source: 'GENERATED', now: () => 1_791_537_920_123, timers, door: fake.door, inspect: trustedInspector() });
    const pending = helpers.open('CAM-04', INGEST, new AbortController().signal);
    await turns();
    expect(timers.pending()).toEqual(expect.arrayContaining([CAMERA_HELPER_LIMITS.settleMs, FIRST_DELIVERY_MS]));
    timers.fire(CAMERA_HELPER_LIMITS.settleMs);
    const handle = await pending;
    handle.onExit((error) => lost.push(error));
    return { fake, timers, lost, handle, helpers };
  }

  it('camera: no frame by 8 s -> the helper is killed and the loss is OPEN_FAILED / NO_FRAME_WITHIN_8S, told once', async () => {
    const { fake, timers, lost, handle, helpers } = await openCamera();
    expect(fake.children[0]?.signals).toEqual([]);
    timers.fire(FIRST_DELIVERY_MS);
    await turns();
    expect(fake.children[0]?.signals).toEqual(['SIGKILL']);
    expect(lost.map((error) => [error.code, error.reason, error.deviceId])).toEqual([['OPEN_FAILED', 'NO_FRAME_WITHIN_8S', 'CAM-04']]);
    expect([handle.alive(), helpers.liveCount()]).toEqual([false, 0]);
  });

  it('camera: a report with a frame before the bound -> nothing is killed, nothing is lost (the check can pass)', async () => {
    const { fake, timers, lost, handle } = await openCamera();
    fake.children[0]?.say('frame=0\nprogress=continue\n');
    fake.children[0]?.say('frame=14\nprogress=continue\n');
    timers.fire(FIRST_DELIVERY_MS);
    await turns();
    expect(fake.children[0]?.signals).toEqual([]);
    expect([lost.length, handle.alive()]).toEqual([0, true]);
    await handle.close();
  });

  it('camera: a report that only ever says frame=0 is no delivery', async () => {
    const { fake, timers, lost } = await openCamera();
    fake.children[0]?.say('frame=0\nprogress=continue\nframe=0\nprogress=continue\n');
    timers.fire(FIRST_DELIVERY_MS);
    await turns();
    expect(lost.map((error) => error.reason)).toEqual(['NO_FRAME_WITHIN_8S']);
  });

  it('camera: a helper closed by us before the bound reports no loss, and the bound is withdrawn', async () => {
    const { timers, lost, handle } = await openCamera();
    await handle.close();
    await turns();
    expect(timers.pending()).not.toContain(FIRST_DELIVERY_MS);
    expect(lost).toEqual([]);
  });

  it('camera adapter: the loss reaches onSourceLost and the source is no longer "open"', async () => {
    const fake = quietDoor();
    const timers = manualTimers();
    const lost: Array<[string, string, string]> = [];
    const adapter = createLocalCameraAdapter({ id: 'CAM-04', program: '/opt/dems/bin/ffmpeg', now: () => 1_791_537_920_123, timers, door: fake.door, inspect: trustedInspector(), onSourceLost: (deviceId, error) => lost.push([deviceId, error.code, error.reason]) });
    // The adapter has no generated source of its own: the device list is answered by the door, then ONE helper is started.
    const pending = adapter.openSource('CAM-04', { ingestUrl: INGEST }, new AbortController().signal);
    await turns();
    timers.fire(CAMERA_HELPER_LIMITS.settleMs);
    await pending;
    expect(adapter.openSources()).toEqual(['CAM-04']);
    timers.fire(FIRST_DELIVERY_MS);
    await turns();
    expect(lost).toEqual([['CAM-04', 'OPEN_FAILED', 'NO_FRAME_WITHIN_8S']]);
    expect(adapter.openSources()).toEqual([]);
    expect(fake.children.filter((child) => !child.options.args.includes('-list_devices')).map((child) => child.signals)).toEqual([['SIGKILL']]);
  });
});

// ── The real door ─────────────────────────────────────────────────────────────────────────────
describe.concurrent('the real door: a generated helper that never delivers is stopped at 8 s (H-18)', () => {
  it('camera: OPEN_FAILED / NO_FRAME_WITHIN_8S, the process is gone, and it took the bound', async () => {
    const lost: Array<{ at: number; error: LocalSourceError }> = [];
    const helpers = createCameraHelpers({ program: standIn('cam-silent'), source: 'GENERATED', now: () => Date.now(), timers: createSystemTimers(), inspect: realFileFacts });
    const began = Date.now();
    const handle = await helpers.open('CAM-04', INGEST, new AbortController().signal);
    handle.onExit((error) => lost.push({ at: Date.now() - began, error }));
    const pid = handle.pid;
    expect(alive(pid)).toBe(true);
    await wait(FIRST_DELIVERY_MS - (Date.now() - began) - 1_000);
    expect([alive(pid), lost.length]).toEqual([true, 0]); // one second before the bound: still waiting
    await wait(2_000);
    expect(lost.map((entry) => [entry.error.code, entry.error.reason, entry.error.deviceId])).toEqual([['OPEN_FAILED', 'NO_FRAME_WITHIN_8S', 'CAM-04']]);
    expect(lost[0]?.at).toBeGreaterThanOrEqual(FIRST_DELIVERY_MS - 50);
    expect(lost[0]?.at).toBeLessThan(FIRST_DELIVERY_MS + 800);
    expect([alive(pid), handle.alive(), helpers.liveCount()]).toEqual([false, false, 0]);
  }, 20_000);

  it('camera: when the helper said the pinned permission words, the loss is PERMISSION_DENIED (the words themselves go nowhere)', async () => {
    const lost: LocalSourceError[] = [];
    const helpers = createCameraHelpers({ program: standIn('cam-refused', 'This app is not authorized to use the device'), source: 'GENERATED', now: () => Date.now(), timers: createSystemTimers(), inspect: realFileFacts });
    const handle = await helpers.open('CAM-05', INGEST, new AbortController().signal);
    handle.onExit((error) => lost.push(error));
    await wait(FIRST_DELIVERY_MS - CAMERA_HELPER_LIMITS.settleMs + 800);
    expect(lost.map((error) => [error.code, error.reason])).toEqual([['PERMISSION_DENIED', 'PATTERN']]);
    expect(JSON.stringify(lost.map((error) => [error.message, error.reason, error.deviceId]))).not.toMatch(/authorized/);
    expect(alive(handle.pid)).toBe(false);
  }, 20_000);

  it('microphone: OPEN_FAILED / NO_SAMPLE_WITHIN_8S, the process is gone, the pipe is removed by close', async () => {
    const lost: LocalSourceError[] = [];
    const helper = createMicHelper({ program: standIn('mic-silent'), runDir: nextRunDir(), timers: createSystemTimers(), inspect: realFileFacts });
    const stream = await helper.prepare({ deviceId: 'MIC-04', sessionId: 'SES-NODELIVERY-1', source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_880 } });
    stream.onLost((error) => lost.push(error));
    const began = Date.now();
    await stream.start();
    const pid = stream.helperPid();
    expect(alive(pid)).toBe(true);
    await wait(FIRST_DELIVERY_MS - (Date.now() - began) + 800);
    expect(lost.map((error) => [error.code, error.reason, error.deviceId])).toEqual([['OPEN_FAILED', 'NO_SAMPLE_WITHIN_8S', 'MIC-04']]);
    expect(alive(pid)).toBe(false);
    await stream.close();
    expect(existsSync(stream.input.path)).toBe(false);
    expect(helper.openIds()).toEqual([]);
  }, 20_000);

  it('control: the same stand-in with the bound moved away is the old behaviour - alive after 9.5 s, nothing reported', async () => {
    const lost: LocalSourceError[] = [];
    const helpers = createCameraHelpers({ program: standIn('cam-control'), source: 'GENERATED', now: () => Date.now(), timers: createSystemTimers(), inspect: realFileFacts, limits: { firstFrameMs: 600_000, stopGraceMs: 1_000 } });
    const handle = await helpers.open('CAM-06', INGEST, new AbortController().signal);
    handle.onExit((error) => lost.push(error));
    await wait(FIRST_DELIVERY_MS);
    expect([alive(handle.pid), handle.alive(), lost.length]).toEqual([true, true, 0]);
    await handle.close();
    expect(alive(handle.pid)).toBe(false);
    expect(lost).toEqual([]);
  }, 20_000);

  it.skipIf(!existsSync(FFMPEG))('positive: the real program with the generated tone and a reader lives past the bound and reports no loss', async () => {
    const lost: LocalSourceError[] = [];
    const helper = createMicHelper({ program: FFMPEG, runDir: nextRunDir(), timers: createSystemTimers(), inspect: realFileFacts, limits: { stopGraceMs: 2_000 } });
    const stream = await helper.prepare({ deviceId: 'MIC-05', sessionId: 'SES-NODELIVERY-2', source: { kind: 'GENERATED', tone: MicGeneratedTone.TONE_880 } });
    stream.onLost((error) => lost.push(error));
    const reader = createReadStream(stream.input.path);
    let bytes = 0;
    reader.on('data', (chunk) => {
      bytes += chunk.length;
    });
    reader.on('error', () => {});
    const began = Date.now();
    await stream.start();
    await wait(FIRST_DELIVERY_MS - (Date.now() - began) + 1_200);
    expect([alive(stream.helperPid()), lost.length]).toEqual([true, 0]);
    expect(bytes).toBeGreaterThan(48_000 * 4 * 7);
    reader.destroy();
    await stream.close();
    expect(alive(stream.helperPid())).toBe(false);
  }, 25_000);
});
