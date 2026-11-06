/**
 * The smallest WAV handling the adapter needs: wrap chunk PCM for an engine that reads files, and
 * read the facts of a RIFF header. No resampling and no decoding happens here: the audio intake
 * stage (§A.1) owns both.
 */
import { STT_SAMPLE_RATE_HZ, TranscriberError, TranscriberErrorCode, type TranscriberChunk } from './types';

const HEADER_BYTES = 44;

/** A canonical 44-byte-header WAV of mono signed 16-bit little-endian PCM. */
export function encodeWavPcm16(samples: Int16Array, sampleRateHz: number): Buffer {
  const dataBytes = samples.length * 2;
  const out = Buffer.alloc(HEADER_BYTES + dataBytes);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(36 + dataBytes, 4);
  out.write('WAVE', 8, 'ascii');
  out.write('fmt ', 12, 'ascii');
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); // PCM
  out.writeUInt16LE(1, 22); // mono
  out.writeUInt32LE(sampleRateHz, 24);
  out.writeUInt32LE(sampleRateHz * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < samples.length; index += 1) out.writeInt16LE(samples[index] ?? 0, HEADER_BYTES + index * 2);
  return out;
}

export interface WavFacts {
  /** 1 = integer PCM; 0xFFFE = the extensible form. */
  readonly formatTag: number;
  readonly sampleRateHz: number;
  readonly channels: number;
  readonly bitsPerSample: number;
  readonly dataOffset: number;
  readonly dataBytes: number;
  /** The size the `data` chunk STATES. `dataBytes` is what of it lies inside the bytes that were handed in. */
  readonly declaredDataBytes: number;
  readonly durationMs: number;
}

/** Walks the RIFF chunks of a WAV. Throws `BAD_ENGINE_OUTPUT`-free, typed `FIXTURE_CORRUPT` on a non-WAV. */
export function readWavFacts(bytes: Uint8Array): WavFacts {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bad = (reason: string): never => {
    throw new TranscriberError(TranscriberErrorCode.FIXTURE_CORRUPT, 'the audio is not a readable WAV file', { reason });
  };
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return bad('NOT_RIFF_WAVE');
  let offset = 12;
  let format: { formatTag: number; sampleRateHz: number; channels: number; bitsPerSample: number } | null = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (body + 16 > buffer.length) return bad('FMT_TRUNCATED');
      format = { formatTag: buffer.readUInt16LE(body), channels: buffer.readUInt16LE(body + 2), sampleRateHz: buffer.readUInt32LE(body + 4), bitsPerSample: buffer.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      if (format === null) return bad('DATA_BEFORE_FMT');
      const dataBytes = Math.min(size, buffer.length - body);
      const bytesPerSecond = format.sampleRateHz * format.channels * (format.bitsPerSample / 8);
      if (bytesPerSecond <= 0) return bad('FMT_ZERO_RATE');
      return { ...format, dataOffset: body, dataBytes, declaredDataBytes: size, durationMs: Math.round((dataBytes / bytesPerSecond) * 1000) };
    }
    offset = body + size + (size % 2);
  }
  return bad('NO_DATA_CHUNK');
}

/** How much of a file is read to judge its header. The `data` chunk of a capture or fixture WAV starts well inside it. */
export const WAV_HEAD_BYTES = 65_536;
const WAV_FORMAT_PCM = 1;
const WAV_FORMAT_EXTENSIBLE = 0xfffe;

function unsupported(reason: string, extra: Record<string, number> = {}): never {
  throw new TranscriberError(TranscriberErrorCode.AUDIO_FORMAT_UNSUPPORTED, 'the chunk audio is not in a form the engine is given', { reason, ...extra });
}

/**
 * Fails closed on chunk audio the engines are not given (N-13). PCM: signed 16-bit samples at
 * exactly 16 kHz (one channel by construction), not empty. A file: a RIFF/WAVE of integer PCM,
 * 16 bit, ONE channel; its rate is the container's (the engine resamples a file itself, which is
 * how the sealed 24 kHz fixture is read). `fileHead` is the first `WAV_HEAD_BYTES` of the file.
 */
export function assertChunkAudio(chunk: TranscriberChunk, fileHead: Uint8Array | null): void {
  if (chunk.audio.kind === 'pcm16') {
    if (!(chunk.audio.samples instanceof Int16Array)) unsupported('PCM_NOT_SIGNED_16_BIT');
    if (chunk.sampleRateHz !== STT_SAMPLE_RATE_HZ) unsupported('PCM_SAMPLE_RATE_NOT_16000', { sampleRateHz: Number(chunk.sampleRateHz) });
    if (chunk.audio.samples.length === 0) unsupported('PCM_EMPTY');
    return;
  }
  if (fileHead === null) unsupported('WAV_HEADER_UNREADABLE');
  let facts: WavFacts;
  try {
    facts = readWavFacts(fileHead);
  } catch {
    return unsupported('NOT_A_WAV_FILE');
  }
  if (facts.formatTag !== WAV_FORMAT_PCM && facts.formatTag !== WAV_FORMAT_EXTENSIBLE) unsupported('WAV_NOT_INTEGER_PCM', { formatTag: facts.formatTag });
  if (facts.bitsPerSample !== 16) unsupported('WAV_NOT_16_BIT', { bitsPerSample: facts.bitsPerSample });
  if (facts.channels !== 1) unsupported('WAV_NOT_MONO', { channels: facts.channels });
  if (facts.sampleRateHz <= 0 || facts.dataBytes <= 0) unsupported('WAV_EMPTY');
}
