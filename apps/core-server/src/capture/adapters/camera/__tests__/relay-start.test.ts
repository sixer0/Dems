// The preview start of the relay (task 4 row 89; decisions D51, D53): `startCameraPreview` of
// `relay-start.ts`. A fake pipeline door records what it was handed and gives back two children whose
// ends the test settles; nothing is started. What is proven: the start message of PREVIEW mode is made
// by the one maker (no ingest, the source stated), the credential stands in the relay's message and
// nowhere else, the encoder's argument list is the fixed one of a closed codec set, and the handle's
// chunk delivery, stop and end reasons.
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import type { CaptureTimers } from '../../../types';
import { sealCredential, startMessageBytes, streamLocator, type StartMessage } from '../../credential';
import { CaptureAdapterError } from '../../errors';
import type { ProductionExit, ProductionPipeline, ProductionPipelineDoor, ProductionPipelineFirst, ProductionPipelineSecond, ProductionProcess } from '../../production-door';
import {
  CAMERA_PREVIEW_CODECS,
  CameraPreviewEndReason,
  PREVIEW_STOP_BOUND_MS,
  previewEncoderArguments,
  startCameraPreview,
  type CameraPreviewCodec,
  type CameraPreviewStart,
} from '../relay-start';

const CANARY = { username: 'canary-user-89b1f2', secret: 'canary-secret-89c4d7' } as const;
const LOCATOR = streamLocator({ host: '192.0.2.89', port: 554, path: 'stream/preview' });
const NEEDLES = [CANARY.username, CANARY.secret, LOCATOR, '192.0.2.89', 'stream/preview'];
const RELAY = '/opt/dems/core/apps/capture-worker/build/capture-relay';
const GUARD = '/opt/dems/core/apps/capture-worker/build/capture-guard';
const FFMPEG = '/opt/dems/ffmpeg-9.0.2/bin/ffmpeg';

/** Timers the test fires by hand. */
function manualTimers(): CaptureTimers & { fire(): void; pending(): number[] } {
  const waiting = new Map<number, { delayMs: number; callback: () => void }>();
  let next = 0;
  return {
    after(delayMs, callback) {
      const id = next++;
      waiting.set(id, { delayMs, callback });
      return () => waiting.delete(id);
    },
    fire() {
      const all = [...waiting.values()];
      waiting.clear();
      for (const timer of all) timer.callback();
    },
    pending: () => [...waiting.values()].map((timer) => timer.delayMs),
  };
}

const exitOf = (exitCode: number | null, signal: string | null = null, spawnFailed = false): ProductionExit => ({ exitCode, signal, spawnFailed, diagnostics: '', output: '' });

interface FakeChild extends ProductionProcess {
  finish(exit: ProductionExit): void;
  readonly signals: string[];
  inputEnded: boolean;
}

function fakeChild(pid: number | null, started: Promise<void>): FakeChild {
  let finish: (exit: ProductionExit) => void = () => {};
  let over = false;
  const ended = new Promise<ProductionExit>((resolve) => {
    finish = (exit) => {
      over = true;
      resolve(exit);
    };
  });
  started.catch(() => {});
  const child: FakeChild = {
    pid,
    started,
    ended,
    alive: () => !over,
    endInput() {
      child.inputEnded = true;
    },
    kill(signal) {
      child.signals.push(signal);
    },
    finish: (exit) => finish(exit),
    signals: [],
    inputEnded: false,
  };
  return child;
}

interface Recorded {
  first: ProductionPipelineFirst | null;
  second: ProductionPipelineSecond | null;
  relay: FakeChild;
  encoder: FakeChild;
  calls: number;
}

/** A pipeline door that starts nothing. `refuse`: the start rejects as the door's would. */
function fakeDoor(refuse = false): { door: ProductionPipelineDoor; seen: Recorded } {
  const startedRelay = refuse ? Promise.reject(new Error('PRODUCTION_START_MESSAGE_TIMEOUT')) : Promise.resolve();
  const seen: Recorded = { first: null, second: null, relay: fakeChild(4101, startedRelay), encoder: fakeChild(4102, Promise.resolve()), calls: 0 };
  const door: ProductionPipelineDoor = (first, second) => {
    seen.calls += 1;
    seen.first = first;
    seen.second = second;
    const started = Promise.all([seen.relay.started, seen.encoder.started]).then(() => undefined);
    started.catch(() => {});
    const pipeline: ProductionPipeline = {
      first: seen.relay,
      second: seen.encoder,
      started,
      ended: Promise.all([seen.relay.ended, seen.encoder.ended]).then(([a, b]) => ({ first: a, second: b })),
      alive: () => seen.relay.alive() || seen.encoder.alive(),
      endInput: () => seen.relay.endInput(),
      kill(signal) {
        seen.relay.kill(signal);
        seen.encoder.kill(signal);
      },
    };
    return pipeline;
  };
  return { door, seen };
}

const startWith = (door: ProductionPipelineDoor, timers: CaptureTimers, patch: Partial<CameraPreviewStart> = {}): ReturnType<typeof startCameraPreview> =>
  startCameraPreview({
    pipelineDoor: door,
    program: RELAY,
    guard: GUARD,
    ffmpeg: FFMPEG,
    timers,
    locator: LOCATOR,
    sealed: sealCredential(CANARY),
    attempt: 31,
    source: '192.168.50.1',
    codec: 'HEVC',
    ...patch,
  });

const free = (text: string): boolean => NEEDLES.every((needle) => !text.includes(needle));

describe('row 89: the preview start message and the encoder argument list', () => {
  it('the relay gets the preview message (no ingest, the source stated) through its standard input only: no argument, an empty environment, no output observer', () => {
    const { door, seen } = fakeDoor();
    startWith(door, manualTimers());
    expect(seen.calls).toBe(1);
    const first = seen.first;
    if (first === null) throw new Error('no first child');
    expect(first.command).toBe(RELAY);
    expect(first.args).toEqual([]);
    expect(first.env).toEqual({});
    expect('onOutput' in first).toBe(false);
    expect(first.processGroup).toBeUndefined();
    const message = first.message as StartMessage;
    // The bytes the door would write: the one serialiser, members in the relay's order, the credential inside the access.
    const line = startMessageBytes(message).toString('utf8');
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(Object.keys(parsed)).toEqual(['type', 'mode', 'attempt', 'source', 'access']);
    expect(parsed.type).toBe('start');
    expect(parsed.mode).toBe('preview');
    expect(parsed.attempt).toBe(31);
    expect(parsed.source).toBe('192.168.50.1');
    expect('ingest' in parsed).toBe(false);
    expect(line.includes(CANARY.secret) && line.includes(CANARY.username) && line.includes(LOCATOR)).toBe(true);
    // Nothing of the credential or the locator in the argument list, the environment or a printed form of the options.
    expect(free(JSON.stringify(first.args) + JSON.stringify(first.env))).toBe(true);
  });

  it('the encoder: the guard with the fixed FFmpeg list of the codec, an empty environment, its own process group, no message, nothing of the camera', () => {
    for (const codec of CAMERA_PREVIEW_CODECS) {
      const { door, seen } = fakeDoor();
      startWith(door, manualTimers(), { codec });
      const second = seen.second;
      if (second === null) throw new Error('no second child');
      expect(second.command).toBe(GUARD);
      expect(second.args).toEqual([FFMPEG, '-hide_banner', '-nostdin', '-loglevel', 'error', '-f', codec === 'H264' ? 'h264' : 'hevc', '-i', 'pipe:0', '-an', '-vf', 'fps=8,scale=640:-2', '-q:v', '7', '-f', 'mpjpeg', 'pipe:1']);
      expect(second.env).toEqual({});
      expect(second.processGroup).toBe(true);
      expect('message' in second).toBe(false);
      expect(typeof second.onOutput).toBe('function');
      expect(free(inspect(second, { depth: 5 }))).toBe(true);
    }
    expect(previewEncoderArguments(FFMPEG, 'H264')).toEqual(previewEncoderArguments(FFMPEG, 'H264'));
    expect(Object.isFrozen(previewEncoderArguments(FFMPEG, 'HEVC'))).toBe(true);
  });

  it('a codec outside the closed set, a source that is no source address, or none: refused before the door is called, with no message made', () => {
    for (const patch of [{ codec: 'VP8' as unknown as CameraPreviewCodec }, { codec: 'h264' as unknown as CameraPreviewCodec }, { source: '0.0.0.0' }, { source: 'camera-if' }, { source: undefined as unknown as string }]) {
      const { door, seen } = fakeDoor();
      let error: unknown = null;
      try {
        startWith(door, manualTimers(), patch);
      } catch (thrown) {
        error = thrown;
      }
      expect(error).toBeInstanceOf(CaptureAdapterError);
      expect((error as CaptureAdapterError).code).toBe('CAPTURE_START_MESSAGE_INVALID');
      expect(seen.calls).toBe(0);
    }
  });
});

describe('row 89: the preview handle', () => {
  it('delivers the encoder output to every listener until it is removed; a listener that throws stops nothing', () => {
    const { door, seen } = fakeDoor();
    const preview = startWith(door, manualTimers());
    expect(preview.relayPid).toBe(4101);
    expect(preview.encoderPid).toBe(4102);
    const a: Buffer[] = [];
    const b: Buffer[] = [];
    preview.onChunk(() => {
      throw new Error('a listener that throws');
    });
    const removeA = preview.onChunk((chunk) => a.push(chunk));
    preview.onChunk((chunk) => b.push(chunk));
    seen.second?.onOutput?.(Buffer.from('--ffmpeg\r\n'));
    removeA();
    seen.second?.onOutput?.(Buffer.from('\xff\xd8', 'latin1'));
    expect(Buffer.concat(a).toString('latin1')).toBe('--ffmpeg\r\n');
    expect(Buffer.concat(b).toString('latin1')).toBe('--ffmpeg\r\n\xff\xd8');
  });

  it('stop: the relay is ordered to stop at once, both are killed at the bound if still there, and the end is STOPPED with the relay code', async () => {
    const timers = manualTimers();
    const { door, seen } = fakeDoor();
    const preview = startWith(door, timers);
    await preview.started;
    const stopped = preview.stop();
    expect(preview.stop()).toBe(stopped);
    expect(seen.relay.inputEnded).toBe(true);
    expect(seen.relay.signals).toEqual([]);
    expect(timers.pending()).toEqual([PREVIEW_STOP_BOUND_MS]);
    timers.fire();
    expect(seen.relay.signals).toEqual(['SIGKILL']);
    expect(seen.encoder.signals).toEqual(['SIGKILL']);
    seen.relay.finish(exitOf(0));
    seen.encoder.finish(exitOf(null, 'SIGTERM'));
    await stopped;
    const exit = await preview.exited;
    expect(exit.reason).toBe(CameraPreviewEndReason.STOPPED);
    expect(exit.code).toBe(0);
    expect(exit.encoder.signal).toBe('SIGTERM');
  });

  it('a stop that ends in time cancels the kill', async () => {
    const timers = manualTimers();
    const { door, seen } = fakeDoor();
    const preview = startWith(door, timers);
    const stopped = preview.stop();
    seen.relay.finish(exitOf(0));
    seen.encoder.finish(exitOf(0));
    await stopped;
    expect(timers.pending()).toEqual([]);
  });

  it('the relay ending first by itself is RELAY_ENDED with its code; the encoder ending first is ENCODER_ENDED with the guard\'s code', async () => {
    {
      const { door, seen } = fakeDoor();
      const preview = startWith(door, manualTimers());
      const chunks: Buffer[] = [];
      preview.onChunk((chunk) => chunks.push(chunk));
      seen.relay.finish(exitOf(32));
      await Promise.resolve();
      seen.encoder.finish(exitOf(null, 'SIGTERM'));
      const exit = await preview.exited;
      expect(exit.reason).toBe(CameraPreviewEndReason.RELAY_ENDED);
      expect(exit.code).toBe(32);
      // After the end no listener is told anything.
      seen.second?.onOutput?.(Buffer.from('late'));
      expect(chunks).toEqual([]);
    }
    {
      const { door, seen } = fakeDoor();
      const preview = startWith(door, manualTimers());
      seen.encoder.finish(exitOf(1));
      await Promise.resolve();
      seen.relay.finish(exitOf(0));
      const exit = await preview.exited;
      expect(exit.reason).toBe(CameraPreviewEndReason.ENCODER_ENDED);
      expect(exit.code).toBe(1);
    }
  });

  it('a start the door refused is START_REFUSED, and `started` carries the door\'s error', async () => {
    const { door, seen } = fakeDoor(true);
    const preview = startWith(door, manualTimers());
    await expect(preview.started).rejects.toThrow('PRODUCTION_START_MESSAGE_TIMEOUT');
    seen.relay.finish(exitOf(null, 'SIGKILL'));
    seen.encoder.finish(exitOf(null, 'SIGTERM'));
    const exit = await preview.exited;
    expect(exit.reason).toBe(CameraPreviewEndReason.START_REFUSED);
    expect(exit.code).toBeNull();
  });
});
