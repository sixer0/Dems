// The level of an idle microphone (decisions D51/D53; row 91c): the worker's math over 50 ms windows
// of interleaved float samples. Pure; the two constants are read from the worker's own source.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY } from '../../../../../test/static/scan';
import {
  IDLE_LEVEL_CLIP_PEAK,
  IDLE_LEVEL_FLOOR_DBFS,
  IDLE_LEVEL_WINDOW_FRAMES,
  IDLE_LEVEL_WINDOW_MS,
  createIdleLevelReader,
  windowLevel,
  type InputWindowLevel,
} from '../idle-level';

/** Interleaved frames as little-endian float 32 bytes. */
function bytesOf(frames: readonly (readonly number[])[]): Buffer {
  const channels = frames[0]?.length ?? 0;
  const out = Buffer.alloc(frames.length * channels * 4);
  frames.forEach((frame, at) => frame.forEach((sample, channel) => out.writeFloatLE(sample, (at * channels + channel) * 4)));
  return out;
}

const collect = (channelCount: number, inputs: number[], windowFrames?: number) => {
  const windows: (readonly InputWindowLevel[])[] = [];
  const reader = createIdleLevelReader({ channelCount, inputs, onWindow: (levels) => windows.push(levels), ...(windowFrames === undefined ? {} : { windowFrames }) });
  return { reader, windows };
};

describe('the worker\'s constants (apps/capture-worker/src/audio.c, function telemetry)', () => {
  const WORKER_AUDIO = resolve(REPOSITORY, 'apps/capture-worker/src/audio.c');

  it('the floor, the clamp and the clip threshold are the worker\'s own', () => {
    expect(existsSync(WORKER_AUDIO)).toBe(true);
    const source = readFileSync(WORKER_AUDIO, 'utf8');
    const formula = /double db = m->sumsq > 0 \? 10\.0 \* log10\(m->sumsq \/ m->n_meter\) : (-?\d+(?:\.\d+)?);/.exec(source);
    const floor = /if \(db < (-?\d+(?:\.\d+)?)\) db = (-?\d+(?:\.\d+)?);/.exec(source);
    const ceiling = /if \(db > (-?\d+(?:\.\d+)?)\) db = (-?\d+(?:\.\d+)?);/.exec(source);
    const clip = /m->peak >= (\d+(?:\.\d+)?)f \?/.exec(source);
    expect(Number(formula?.[1])).toBe(IDLE_LEVEL_FLOOR_DBFS);
    expect([Number(floor?.[1]), Number(floor?.[2])]).toEqual([IDLE_LEVEL_FLOOR_DBFS, IDLE_LEVEL_FLOOR_DBFS]);
    expect([Number(ceiling?.[1]), Number(ceiling?.[2])]).toEqual([0, 0]);
    expect(Number(clip?.[1])).toBe(IDLE_LEVEL_CLIP_PEAK);
    // The worker sums the squares and the largest absolute value of each sample it takes.
    expect(source).toContain('sumsq += (double)v * v;');
    expect(source).toContain('if (fabsf(v) > m->peak) m->peak = fabsf(v);');
    // Control: a worker that changed a number would be seen.
    expect(Number(/m->peak >= (\d+(?:\.\d+)?)f \?/.exec(source.replace('m->peak >= 0.999f', 'm->peak >= 0.99f'))?.[1])).not.toBe(IDLE_LEVEL_CLIP_PEAK);
  });

  it('a window is 50 ms of 48 kHz frames', () => {
    expect(IDLE_LEVEL_WINDOW_MS).toBe(50);
    expect(IDLE_LEVEL_WINDOW_FRAMES).toBe(2_400);
  });
});

describe('windowLevel: the math of one window', () => {
  it('known vectors: full-scale square wave 0 dBFS, half scale -6.02, a sine of amplitude 1 -3.01, a tenth -20', () => {
    expect(windowLevel(4, 4, 1)).toEqual({ dbfs: 0, clipped: true });
    expect(windowLevel(4 * 0.25, 4, 0.5)?.dbfs).toBeCloseTo(-6.0206, 4);
    // A sine of amplitude 1 over whole periods: mean square 0.5.
    const sine = Array.from({ length: 4_800 }, (_unused, n) => Math.fround(Math.sin((2 * Math.PI * 1_000 * n) / 48_000)));
    const sumsq = sine.reduce((sum, value) => sum + value * value, 0);
    expect(windowLevel(sumsq, sine.length, 1)?.dbfs).toBeCloseTo(-3.0103, 3);
    expect(windowLevel(0.01 * 10, 10, 0.1)?.dbfs).toBeCloseTo(-20, 9);
    expect(windowLevel(0.01 * 10, 10, 0.1)?.clipped).toBe(false);
  });

  it('silence is the floor; below the floor is the floor; above full scale is full scale; no sample is no level', () => {
    expect(windowLevel(0, 2_400, 0)).toEqual({ dbfs: IDLE_LEVEL_FLOOR_DBFS, clipped: false });
    expect(windowLevel(1e-20, 2_400, 1e-10)).toEqual({ dbfs: IDLE_LEVEL_FLOOR_DBFS, clipped: false });
    expect(windowLevel(16, 4, 2)).toEqual({ dbfs: 0, clipped: true });
    expect(windowLevel(0, 0, 0)).toBeNull();
  });

  it('clip: the largest absolute sample at or above 0.999 in single precision, as the worker compares it', () => {
    expect(windowLevel(1, 1, Math.fround(0.999))?.clipped).toBe(true);
    expect(windowLevel(1, 1, Math.fround(0.9989))?.clipped).toBe(false);
    expect(windowLevel(1, 1, 1)?.clipped).toBe(true);
  });
});

describe('createIdleLevelReader: interleaved float samples, windows by frames', () => {
  it('reads each requested input of a 4-channel card and none of the others', () => {
    const { reader, windows } = collect(4, [1, 2], 4);
    // Input 1 half scale, input 2 a clipping burst, inputs 3 and 4 full scale (never asked for).
    reader.push(bytesOf([[0.5, 0, 1, 1], [-0.5, 1, 1, 1], [0.5, 0, 1, 1], [-0.5, 0, 1, 1]]));
    expect(windows).toHaveLength(1);
    expect(windows[0]?.map((level) => level.inputNumber)).toEqual([1, 2]);
    expect(windows[0]?.[0]?.dbfs).toBeCloseTo(-6.0206, 4);
    expect(windows[0]?.[0]?.clipped).toBe(false);
    expect(windows[0]?.[1]?.dbfs).toBeCloseTo(-6.0206, 4);
    expect(windows[0]?.[1]?.clipped).toBe(true);
  });

  it('a chunk may cut a sample and a frame anywhere: the same windows', () => {
    const frames = Array.from({ length: 12 }, (_unused, n) => [Math.fround(Math.sin(n)), Math.fround(0.25 * Math.cos(n))]);
    const whole = collect(2, [1, 2], 4);
    whole.reader.push(bytesOf(frames));
    const cut = collect(2, [1, 2], 4);
    const bytes = bytesOf(frames);
    for (let at = 0; at < bytes.length; at += 3) cut.reader.push(bytes.subarray(at, Math.min(at + 3, bytes.length)));
    expect(whole.windows).toHaveLength(3);
    expect(cut.windows).toEqual(whole.windows);
  });

  it('an incomplete window says nothing; the next bytes complete it', () => {
    const { reader, windows } = collect(1, [1], 4);
    reader.push(bytesOf([[0.1], [0.1], [0.1]]));
    expect(windows).toEqual([]);
    reader.push(bytesOf([[0.1]]));
    expect(windows).toHaveLength(1);
    expect(windows[0]?.[0]?.dbfs).toBeCloseTo(-20, 4);
  });

  it('the default window is 2,400 frames (50 ms)', () => {
    const { reader, windows } = collect(1, [1]);
    reader.push(bytesOf(Array.from({ length: 2_399 }, () => [0])));
    expect(windows).toEqual([]);
    reader.push(bytesOf([[0]]));
    expect(windows).toEqual([[{ inputNumber: 1, dbfs: IDLE_LEVEL_FLOOR_DBFS, clipped: false }]]);
  });

  it('a sample that is no finite number counts as silence; an observer that throws stops nothing', () => {
    let calls = 0;
    const reader = createIdleLevelReader({
      channelCount: 1,
      inputs: [1],
      windowFrames: 2,
      onWindow: () => {
        calls += 1;
        throw new Error('observer');
      },
    });
    reader.push(bytesOf([[Number.NaN], [Number.POSITIVE_INFINITY], [0], [0]]));
    expect(calls).toBe(2);
    const seen = collect(1, [1], 2);
    seen.reader.push(bytesOf([[Number.NaN], [0]]));
    expect(seen.windows).toEqual([[{ inputNumber: 1, dbfs: IDLE_LEVEL_FLOOR_DBFS, clipped: false }]]);
  });

  it('refuses a channel count, an input or a window that is not of its shape', () => {
    for (const options of [
      { channelCount: 0, inputs: [1] },
      { channelCount: 65, inputs: [1] },
      { channelCount: 4, inputs: [] },
      { channelCount: 4, inputs: [5] },
      { channelCount: 4, inputs: [0] },
      { channelCount: 4, inputs: [1, 1] },
      { channelCount: 4, inputs: [1.5] },
      { channelCount: 4, inputs: [1], windowFrames: 0 },
    ]) {
      expect(() => createIdleLevelReader({ ...options, onWindow: () => {} }), JSON.stringify(options)).toThrow('a value of the idle level reader is not of its shape');
    }
  });
});
