/**
 * AUDIO INTAKE (transcript spec §A.1): the samples the pipeline chunks, read from where they are.
 *
 * Two containers, both mono signed 16-bit little-endian PCM:
 *
 *   raw   the capture worker's PCM tap as a REGULAR FILE that the worker appends to. The pipeline
 *         reads it at its own pace; the worker never waits for a reader. A named pipe is NOT read
 *         here on purpose: the worker closes a pipe tap for the whole session when its reader
 *         pauses (pair-58 finding F-7), and an STT run is exactly such a pause.
 *   wav   a RIFF/WAVE file (the sealed fixture of the functional checks; a decoded track).
 *
 * NO RESAMPLING HAPPENS HERE. A chunk is cut at the rate of its source and handed to the engine as
 * a WAV file; both engines resample a file themselves (the same way the sealed 24 kHz fixture is
 * read, row 76 N-13). Nothing in this module decodes a compressed track.
 *
 * FAIL CLOSED: audio that is missing, unreadable or not in this form is
 * `TRANSCRIPT_AUDIO_UNAVAILABLE`, and no transcript is made up for it.
 */
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { TranscriberError, TranscriberErrorCode } from '../types';
import { WAV_HEAD_BYTES, readWavFacts, type WavFacts } from '../wav';
import type { SampleRange } from './media-time';

export type PcmContainer = 'raw' | 'wav';

export interface PcmSourceSpec {
  readonly container: PcmContainer;
  readonly path: string;
  /** `raw`: the rate of the samples (the tap's). `wav`: must equal the rate the header states. */
  readonly sampleRateHz: number;
}

export interface PcmSource {
  readonly sampleRateHz: number;
  /** How many whole samples exist NOW. A tap grows; a number once returned never shrinks. */
  availableSamples(): number;
  /** The samples of `range`. Throws `TRANSCRIPT_AUDIO_UNAVAILABLE` when they are not all there. */
  read(range: SampleRange): Int16Array;
}

const BYTES_PER_SAMPLE = 2;

function unavailable(reason: string, extra: Record<string, number> = {}): TranscriberError {
  return new TranscriberError(TranscriberErrorCode.TRANSCRIPT_AUDIO_UNAVAILABLE, 'the session audio is missing or cannot be read', { reason, ...extra });
}

function withFile<T>(path: string, work: (descriptor: number) => T): T {
  let descriptor: number;
  try {
    descriptor = openSync(path, 'r');
  } catch {
    throw unavailable('AUDIO_FILE_NOT_READABLE');
  }
  try {
    return work(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function wavFactsOf(path: string, sampleRateHz: number): WavFacts {
  return withFile(path, (descriptor) => {
    const head = Buffer.alloc(WAV_HEAD_BYTES);
    const got = readSync(descriptor, head, 0, WAV_HEAD_BYTES, 0);
    let facts: WavFacts;
    try {
      facts = readWavFacts(head.subarray(0, got));
    } catch {
      throw unavailable('AUDIO_NOT_A_WAV_FILE');
    }
    if (facts.channels !== 1 || facts.bitsPerSample !== 16) throw unavailable('AUDIO_NOT_MONO_16_BIT', { channels: facts.channels, bitsPerSample: facts.bitsPerSample });
    if (facts.sampleRateHz !== sampleRateHz) throw unavailable('AUDIO_SAMPLE_RATE_MISMATCH', { stated: facts.sampleRateHz, expected: sampleRateHz });
    // Only the head was read: the data is what the header STATES, bounded by what the file holds.
    const onDisk = fstatSync(descriptor).size - facts.dataOffset;
    return { ...facts, dataBytes: Math.max(0, Math.min(facts.declaredDataBytes, onDisk)) };
  });
}

export function openPcmSource(spec: PcmSourceSpec): PcmSource {
  if (!Number.isInteger(spec.sampleRateHz) || spec.sampleRateHz < 1) throw unavailable('AUDIO_SAMPLE_RATE_INVALID');
  // A WAV is complete when it is opened; a raw tap is asked again on every call.
  const wav = spec.container === 'wav' ? wavFactsOf(spec.path, spec.sampleRateHz) : null;
  const dataOffset = wav?.dataOffset ?? 0;

  const availableSamples = (): number => {
    if (wav !== null) return Math.floor(wav.dataBytes / BYTES_PER_SAMPLE);
    return withFile(spec.path, (descriptor) => {
      const stat = fstatSync(descriptor);
      if (!stat.isFile()) throw unavailable('AUDIO_TAP_NOT_A_REGULAR_FILE');
      return Math.floor(stat.size / BYTES_PER_SAMPLE);
    });
  };

  const read = (range: SampleRange): Int16Array => {
    if (!Number.isInteger(range.from) || !Number.isInteger(range.to) || range.from < 0 || range.to <= range.from) throw unavailable('AUDIO_RANGE_INVALID');
    if (range.to > availableSamples()) throw unavailable('AUDIO_RANGE_NOT_AVAILABLE');
    const count = range.to - range.from;
    const bytes = Buffer.alloc(count * BYTES_PER_SAMPLE);
    const got = withFile(spec.path, (descriptor) => {
      let done = 0;
      while (done < bytes.length) {
        const step = readSync(descriptor, bytes, done, bytes.length - done, dataOffset + range.from * BYTES_PER_SAMPLE + done);
        if (step <= 0) break;
        done += step;
      }
      return done;
    });
    if (got !== bytes.length) throw unavailable('AUDIO_RANGE_SHORT_READ');
    const samples = new Int16Array(count);
    for (let index = 0; index < count; index += 1) samples[index] = bytes.readInt16LE(index * BYTES_PER_SAMPLE);
    return samples;
  };

  return Object.freeze({ sampleRateHz: spec.sampleRateHz, availableSamples, read });
}
