// Wave H closing pass Z1, item 8 (driver E decision 5; ruling D201 (5)): the speech fixture is held
// to its FORMAT at boot, not only to the path rule. A file at the fixture path that is not RIFF /
// WAVE audio - a text file renamed `.wav` - passed the boot and failed only at the session start,
// where it read as a lost microphone. It is now `DEV_SPEECH_FIXTURE_UNUSABLE` with the reason, at
// boot. The format the helper is given: integer PCM, mono, 48,000 Hz.
//
// The bytes are read through the ONE file-system door of the capture folder (`readFileHead`,
// `adapters/local/process-door.ts`); the rule itself is pure (`speechFixtureFormatProblem`).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CaptureOperation } from '../../adapters';
import { readFileHead } from '../../adapters/local';
import { temporaryRoot, trustedInspector } from '../../adapters/local/__tests__/mic-support';
import { CaptureFenceError, FakeMicRefusal, FakeMicSource, SPEECH_FIXTURE_HEAD_BYTES, SpeechFixtureProblem, fakeMicDecisionOf, runCaptureFenceBoot, speechFixtureFormatProblem } from '../index';
import { HELPER, SEEDED, SEEDED_SELECTOR, configOf, fakeTables, keptSinks } from './support';

const trusted = trustedInspector();

/** A canonical 44-byte WAV header and `samples` zero samples. */
function wav(options: { format?: number; channels?: number; rate?: number; bits?: number; samples?: number; riff?: string; wave?: string; filler?: number } = {}): Buffer {
  const { format = 1, channels = 1, rate = 48_000, bits = 16, samples = 4_800, riff = 'RIFF', wave = 'WAVE', filler = 0 } = options;
  const data = Buffer.alloc(samples * channels * (bits / 8));
  const fmt = Buffer.alloc(24);
  fmt.write('fmt ', 0, 'ascii');
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(format, 8);
  fmt.writeUInt16LE(channels, 10);
  fmt.writeUInt32LE(rate, 12);
  fmt.writeUInt32LE(rate * channels * (bits / 8), 16);
  fmt.writeUInt16LE(channels * (bits / 8), 20);
  fmt.writeUInt16LE(bits, 22);
  // A filler chunk between `fmt ` and `data`, as some writers put one (macOS `FLLR`).
  const fill = filler === 0 ? Buffer.alloc(0) : Buffer.concat([Buffer.from('FLLR', 'ascii'), Buffer.from(Uint32Array.of(filler).buffer), Buffer.alloc(filler)]);
  const dataHead = Buffer.alloc(8);
  dataHead.write('data', 0, 'ascii');
  dataHead.writeUInt32LE(data.length, 4);
  const body = Buffer.concat([Buffer.from(wave, 'ascii'), fmt, fill, dataHead, data]);
  const head = Buffer.alloc(8);
  head.write(riff, 0, 'ascii');
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}

describe('speechFixtureFormatProblem: RIFF / WAVE, integer PCM, mono, 48 kHz', () => {
  it('the fixture as the set-up writes it passes; a filler chunk before the audio is read over', () => {
    expect(speechFixtureFormatProblem(wav())).toBeNull();
    expect(speechFixtureFormatProblem(wav({ filler: 1_000 }))).toBeNull();
  });

  it.each([
    ['a text file renamed .wav', Buffer.from('This is not audio. It is a text file that was renamed dialogue.wav.\n'.repeat(4), 'utf8'), SpeechFixtureProblem.NOT_WAV],
    ['an empty file', Buffer.alloc(0), SpeechFixtureProblem.NOT_WAV],
    ['RIFF of another form (AVI)', wav({ wave: 'AVI ' }), SpeechFixtureProblem.NOT_WAV],
    ['a big-endian RIFX file', wav({ riff: 'RIFX' }), SpeechFixtureProblem.NOT_WAV],
    ['a header cut short', wav().subarray(0, 30), SpeechFixtureProblem.NOT_WAV],
    ['floating-point samples', wav({ format: 3, bits: 32 }), SpeechFixtureProblem.WAV_NOT_PCM],
    ['compressed audio (MP3 in WAV)', wav({ format: 85 }), SpeechFixtureProblem.WAV_NOT_PCM],
    ['stereo', wav({ channels: 2 }), SpeechFixtureProblem.WAV_NOT_MONO],
    ['24 kHz (the row-12 file)', wav({ rate: 24_000 }), SpeechFixtureProblem.WAV_NOT_48KHZ],
    ['8-bit samples', wav({ bits: 8 }), SpeechFixtureProblem.WAV_NOT_16BIT],
    ['a header and no sample', wav({ samples: 0 }), SpeechFixtureProblem.WAV_NO_AUDIO],
  ] as const)('%s is refused: %s', (_name, bytes, problem) => {
    expect(speechFixtureFormatProblem(bytes.subarray(0, SPEECH_FIXTURE_HEAD_BYTES))).toBe(problem);
  });

  it('a file that could not be read is UNREADABLE, never accepted', () => {
    expect(speechFixtureFormatProblem(null)).toBe(SpeechFixtureProblem.UNREADABLE);
  });
});

describe('the boot holds the fixture to its format', () => {
  const tmp = temporaryRoot();
  afterAll(() => tmp.remove());
  const folder = (name: string): { dataDir: string; file: string } => {
    const dataDir = join(tmp.root, name, '.data');
    mkdirSync(join(dataDir, 'dev-fixtures', 'speech-mic'), { recursive: true });
    return { dataDir, file: join(dataDir, 'dev-fixtures', 'speech-mic', 'dialogue.wav') };
  };
  const DEVELOPMENT = { captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER } as const;
  const boot = async (dataDir: string): Promise<{ code: string | null; problem: unknown; fixturePath: string | null; persisted: readonly { code: string; context: Record<string, string | number> }[] }> => {
    const sinks = keptSinks();
    try {
      const outcome = await runCaptureFenceBoot({ config: { ...configOf(DEVELOPMENT), captureDevFakeMic: 'speech', dataDir }, inUnit: fakeTables(SEEDED, SEEDED_SELECTOR).inUnit, inspect: trusted, readHead: readFileHead, labels: { CAMERA: 'MacBook Air Camera', MIC: 'MacBook Air Microphone' }, listed: async () => true, sinks });
      return { code: null, problem: null, fixturePath: outcome.fakeMic.fixturePath, persisted: sinks.persisted };
    } catch (error) {
      if (!(error instanceof CaptureFenceError)) throw error;
      return { code: error.code, problem: error.fixtureProblem, fixturePath: null, persisted: sinks.persisted };
    }
  };

  it('A TEXT FILE RENAMED .wav: the boot is refused DEV_SPEECH_FIXTURE_UNUSABLE with the reason NOT_WAV - not a lost microphone at the session start', async () => {
    const at = folder('text');
    writeFileSync(at.file, 'Selamat pagi. This is the reference text, saved under the wrong name.\n'.repeat(20), { mode: 0o600 });
    // The decision itself, through the real reader ...
    expect(fakeMicDecisionOf({ captureDevFakeMic: 'speech', dataDir: at.dataDir }, CaptureOperation.REAL_DEVELOPMENT, trusted, readFileHead)).toEqual({
      source: FakeMicSource.TONE,
      fixturePath: null,
      refusal: FakeMicRefusal.DEV_SPEECH_FIXTURE_UNUSABLE,
      problem: SpeechFixtureProblem.NOT_WAV,
    });
    // ... and the boot: refused by name, the reason in the persistent error log.
    const booted = await boot(at.dataDir);
    expect([booted.code, booted.problem]).toEqual(['DEV_SPEECH_FIXTURE_UNUSABLE', 'NOT_WAV']);
    expect(booted.persisted.some((entry) => entry.code === 'DEV_SPEECH_FIXTURE_UNUSABLE' && JSON.stringify(entry.context).includes('NOT_WAV'))).toBe(true);
  });

  it('a WAV of the wrong format is refused with ITS reason (stereo; 24 kHz)', async () => {
    const stereo = folder('stereo');
    writeFileSync(stereo.file, wav({ channels: 2 }), { mode: 0o600 });
    expect((await boot(stereo.dataDir)).problem).toBe('WAV_NOT_MONO');
    const slow = folder('rate');
    writeFileSync(slow.file, wav({ rate: 24_000 }), { mode: 0o600 });
    expect((await boot(slow.dataDir)).problem).toBe('WAV_NOT_48KHZ');
  });

  it('CONTROL - a mono 16-bit 48 kHz PCM WAV at the path boots, and the first test microphone is given that file', async () => {
    const at = folder('good');
    writeFileSync(at.file, wav(), { mode: 0o600 });
    const booted = await boot(at.dataDir);
    expect(booted.code).toBeNull();
    expect(booted.fixturePath).toBe(at.file);
  });

  it('a decision that is handed no reader accepts nothing: UNREADABLE (fail closed)', () => {
    const at = folder('no-reader');
    writeFileSync(at.file, wav(), { mode: 0o600 });
    expect(fakeMicDecisionOf({ captureDevFakeMic: 'speech', dataDir: at.dataDir }, CaptureOperation.REAL_DEVELOPMENT, trusted)).toMatchObject({ refusal: FakeMicRefusal.DEV_SPEECH_FIXTURE_UNUSABLE, problem: SpeechFixtureProblem.UNREADABLE });
  });

  it('the reader reads the head only, and answers null for a path that is no readable regular file', () => {
    const at = folder('reader');
    writeFileSync(at.file, wav({ samples: 48_000 }), { mode: 0o600 });
    expect(readFileHead(at.file, SPEECH_FIXTURE_HEAD_BYTES)?.length).toBe(SPEECH_FIXTURE_HEAD_BYTES);
    expect(readFileHead(join(at.dataDir, 'absent.wav'), SPEECH_FIXTURE_HEAD_BYTES)).toBeNull();
    expect(readFileHead(at.dataDir, SPEECH_FIXTURE_HEAD_BYTES)).toBeNull();
    expect(readFileHead('relative/dialogue.wav', SPEECH_FIXTURE_HEAD_BYTES)).toBeNull();
  });
});
