/**
 * THE LEVEL OF AN IDLE MICROPHONE (decisions D51/D53; row 91c). Pure: no process, no file, no time.
 *
 * While no session is active the capture worker sends no telemetry, so the meters of the Devices &
 * Inputs page would show NO SIGNAL for a microphone that works. The idle meter (`idle-meter.ts`)
 * opens the card through the shared capture and hands the samples it reads here: 32-bit float,
 * little-endian, ALL native channels of the card interleaved (the idle level output of the Linux
 * table, `linuxMicLevelArguments`). This file cuts them into windows and answers, per requested
 * input, the level THE WORKER WOULD REPORT for the same samples (`apps/capture-worker/src/audio.c`,
 * function `telemetry`):
 *
 *   dbfs     sumsq > 0 ? 10 * log10(sumsq / n) : -120, then held to -120 .. 0;
 *   clipped  the largest absolute sample of the window >= 0.999 (single precision, as the worker's `0.999f`).
 *
 * The two numbers are read from the worker's source by a test (`__tests__/idle-level.test.ts`), so a
 * change on one side is seen. The worker's window is its telemetry period; the idle window is
 * `IDLE_LEVEL_WINDOW_MS` of samples, counted by FRAMES and never by a clock: the level of a window is
 * the same whatever the chunks of the pipe were.
 *
 * Nothing is kept: a window is summed and dropped. A sample that is no finite number counts as
 * silence (the worker's samples are always finite; the helper's are too, but this file is given
 * bytes).
 */

/** The rate of the shared capture the helper reads (the transport's, `MIC_TRANSPORTS.PCM_FIFO`). */
export const IDLE_LEVEL_SAMPLE_RATE_HZ = 48_000;
/** One level per this many milliseconds of samples. */
export const IDLE_LEVEL_WINDOW_MS = 50;
/** The frames of one window: 2,400 at 48 kHz. */
export const IDLE_LEVEL_WINDOW_FRAMES = (IDLE_LEVEL_SAMPLE_RATE_HZ * IDLE_LEVEL_WINDOW_MS) / 1_000;
/** The worker's floor and its value for a window of silence (`-120.0` in `audio.c`). */
export const IDLE_LEVEL_FLOOR_DBFS = -120;
/** The worker's ceiling: a level is never above full scale. */
export const IDLE_LEVEL_CEILING_DBFS = 0;
/** The worker's clip threshold on the largest absolute sample (`0.999f` in `audio.c`). */
export const IDLE_LEVEL_CLIP_PEAK = 0.999;
/** The threshold as the worker compares it: a single-precision number. */
const CLIP_PEAK_SINGLE = Math.fround(IDLE_LEVEL_CLIP_PEAK);
/** The most channels a card is opened with (the Linux table's bound). */
export const IDLE_LEVEL_CHANNELS_MAX = 64;
const BYTES_PER_SAMPLE = 4;

/** The level of one window: what the worker would say of the same samples. */
export interface WindowLevel {
  readonly dbfs: number;
  readonly clipped: boolean;
}

/**
 * THE MATH of one window, the worker's own: the sum of the squares, the number of samples and the
 * largest absolute sample. No sample (n = 0) is no level: null.
 */
export function windowLevel(sumOfSquares: number, samples: number, peak: number): WindowLevel | null {
  if (!Number.isInteger(samples) || samples <= 0) return null;
  let dbfs = sumOfSquares > 0 ? 10 * Math.log10(sumOfSquares / samples) : IDLE_LEVEL_FLOOR_DBFS;
  if (!Number.isFinite(dbfs) || dbfs < IDLE_LEVEL_FLOOR_DBFS) dbfs = IDLE_LEVEL_FLOOR_DBFS;
  if (dbfs > IDLE_LEVEL_CEILING_DBFS) dbfs = IDLE_LEVEL_CEILING_DBFS;
  return Object.freeze({ dbfs, clipped: peak >= CLIP_PEAK_SINGLE });
}

/** The level of one input of the card for one window. */
export interface InputWindowLevel extends WindowLevel {
  /** The input of the card, numbered from 1 (channel = input - 1). */
  readonly inputNumber: number;
}

export interface IdleLevelReaderOptions {
  /** The card's NATIVE channel count: the interleave of the samples. 1 to 64. */
  readonly channelCount: number;
  /** The inputs whose level is wanted, numbered from 1, each at most the channel count. */
  readonly inputs: readonly number[];
  /** Told once per complete window, with one entry per requested input in the order given. The observer must not throw; a throw is dropped. */
  readonly onWindow: (levels: readonly InputWindowLevel[]) => void;
  /** Default `IDLE_LEVEL_WINDOW_FRAMES`. A test passes a small one. */
  readonly windowFrames?: number;
}

export interface IdleLevelReader {
  /** Hands the next bytes of standard output, in order, cut anywhere. */
  push(chunk: Uint8Array): void;
}

export class IdleLevelArgumentError extends Error {
  readonly code = 'IDLE_LEVEL_ARGUMENT_REFUSED' as const;
  constructor() {
    super('a value of the idle level reader is not of its shape');
    this.name = 'IdleLevelArgumentError';
  }
}

const wholeIn = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

/**
 * A reader of interleaved float samples. It keeps the bytes of at most one incomplete frame and the
 * three sums of the window in progress, nothing else.
 */
export function createIdleLevelReader(options: IdleLevelReaderOptions): IdleLevelReader {
  const { channelCount } = options;
  if (!wholeIn(channelCount, 1, IDLE_LEVEL_CHANNELS_MAX)) throw new IdleLevelArgumentError();
  const inputs = [...options.inputs];
  if (inputs.length === 0 || inputs.some((input) => !wholeIn(input, 1, channelCount)) || new Set(inputs).size !== inputs.length) throw new IdleLevelArgumentError();
  const windowFrames = options.windowFrames ?? IDLE_LEVEL_WINDOW_FRAMES;
  if (!wholeIn(windowFrames, 1, IDLE_LEVEL_SAMPLE_RATE_HZ)) throw new IdleLevelArgumentError();

  const frameBytes = channelCount * BYTES_PER_SAMPLE;
  const sums = new Float64Array(inputs.length);
  const peaks = new Float64Array(inputs.length);
  let frames = 0;
  /** The bytes of a frame that a chunk cut: fewer than `frameBytes`. */
  let carry = new Uint8Array(0);

  const emit = (): void => {
    const levels: InputWindowLevel[] = [];
    inputs.forEach((inputNumber, at) => {
      const level = windowLevel(sums[at] ?? 0, frames, peaks[at] ?? 0);
      if (level !== null) levels.push(Object.freeze({ inputNumber, dbfs: level.dbfs, clipped: level.clipped }));
    });
    sums.fill(0);
    peaks.fill(0);
    frames = 0;
    try {
      options.onWindow(Object.freeze(levels));
    } catch {
      // An observer never stops the reading.
    }
  };

  const frame = (view: DataView, offset: number): void => {
    inputs.forEach((inputNumber, at) => {
      const raw = view.getFloat32(offset + (inputNumber - 1) * BYTES_PER_SAMPLE, true);
      const sample = Number.isFinite(raw) ? raw : 0;
      sums[at] = (sums[at] ?? 0) + sample * sample;
      const magnitude = Math.abs(sample);
      if (magnitude > (peaks[at] ?? 0)) peaks[at] = magnitude;
    });
    frames += 1;
    if (frames >= windowFrames) emit();
  };

  return {
    push(chunk) {
      if (!(chunk instanceof Uint8Array) || chunk.byteLength === 0) return;
      let bytes = chunk;
      if (carry.byteLength > 0) {
        const joined = new Uint8Array(carry.byteLength + chunk.byteLength);
        joined.set(carry, 0);
        joined.set(chunk, carry.byteLength);
        bytes = joined;
      }
      const whole = bytes.byteLength - (bytes.byteLength % frameBytes);
      const view = new DataView(bytes.buffer, bytes.byteOffset, whole);
      for (let offset = 0; offset < whole; offset += frameBytes) frame(view, offset);
      carry = bytes.slice(whole);
    },
  };
}
