// Wave H closing pass Z1, item 8 (driver E decision 5; ruling D201 (5)): the dev set-up step holds
// the speech fixture to its FORMAT, with the same reasons the Core's boot names. A text file renamed
// `dialogue.wav` is `DEV_SPEECH_FIXTURE_UNUSABLE (NOT_WAV ...)`, not a kept fixture.
//
// Nothing is synthesised here: only the KEPT path of the set-up runs (no `say`, no FFmpeg, no device).
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { SpeechFixtureProblem, speechFixtureFormatProblem } from '../../src/capture/fence';

interface SetUp {
  speechFixtureWavProblem(bytes: Uint8Array): string | null;
  prepareSpeechFixture(options: { dataDir: string; ffmpeg: string; renew?: boolean }): { status: string; reason?: string; wav?: string };
}
// The set-up is a plain Node module of the repository (`scripts/capture/`), outside every workspace.
const setUp = (await import(/* @vite-ignore */ new URL('../../../../scripts/capture/speech-fixture.mjs', import.meta.url).href)) as SetUp;

function wav(options: { format?: number; channels?: number; rate?: number; bits?: number; samples?: number } = {}): Buffer {
  const { format = 1, channels = 1, rate = 48_000, bits = 16, samples = 4_800 } = options;
  const data = Buffer.alloc(samples * channels * (bits / 8));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(format, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * channels * (bits / 8), 28);
  header.writeUInt16LE(channels * (bits / 8), 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const TEXT = Buffer.from('Selamat pagi. This is a text file that was renamed dialogue.wav.\n'.repeat(8), 'utf8');
const VECTORS: readonly (readonly [string, Buffer, string | null])[] = [
  ['the fixture as the set-up writes it', wav(), null],
  ['a text file renamed .wav', TEXT, SpeechFixtureProblem.NOT_WAV],
  ['an empty file', Buffer.alloc(0), SpeechFixtureProblem.NOT_WAV],
  ['floating-point samples', wav({ format: 3, bits: 32 }), SpeechFixtureProblem.WAV_NOT_PCM],
  ['stereo', wav({ channels: 2 }), SpeechFixtureProblem.WAV_NOT_MONO],
  ['24 kHz', wav({ rate: 24_000 }), SpeechFixtureProblem.WAV_NOT_48KHZ],
  ['8-bit samples', wav({ bits: 8 }), SpeechFixtureProblem.WAV_NOT_16BIT],
  ['a header and no sample', wav({ samples: 0 }), SpeechFixtureProblem.WAV_NO_AUDIO],
];

describe('the set-up and the boot hold the speech fixture to ONE format rule', () => {
  it.each(VECTORS)('%s: the set-up and the Core give the same answer', (_name, bytes, expected) => {
    expect(setUp.speechFixtureWavProblem(bytes)).toBe(expected);
    expect(speechFixtureFormatProblem(bytes)).toBe(expected);
  });
});

describe.runIf(process.platform === 'darwin')('prepareSpeechFixture: a file that is there is kept only as the audio it must be', () => {
  const root = mkdtempSync(join(tmpdir(), 'dems-speech-setup-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  /** A fixture folder whose reference file names exactly the bytes of `dialogue.wav` (the set-up's own "kept" condition). */
  const folder = (name: string, bytes: Buffer): { dataDir: string; wav: string } => {
    const dataDir = join(root, name);
    const dir = join(dataDir, 'dev-fixtures', 'speech-mic');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(join(dir, 'dialogue.wav'), bytes, { mode: 0o600 });
    writeFileSync(join(dir, 'dialogue.reference.json'), JSON.stringify({ sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, durationMs: 100 }), { mode: 0o600 });
    return { dataDir, wav: join(dir, 'dialogue.wav') };
  };

  it('A TEXT FILE RENAMED .wav is NOT kept: DEV_SPEECH_FIXTURE_UNUSABLE with the reason, and the file is left as it is', () => {
    const at = folder('text', TEXT);
    const outcome = setUp.prepareSpeechFixture({ dataDir: at.dataDir, ffmpeg: '/usr/bin/false' });
    expect(outcome.status).toBe('NOT_CREATED');
    expect(outcome.reason).toMatch(/^DEV_SPEECH_FIXTURE_UNUSABLE \(NOT_WAV: /);
    expect(outcome.reason).toContain('--renew-speech-fixture');
    expect(readFileSync(at.wav).equals(TEXT)).toBe(true);
  });

  it('CONTROL - a mono 16-bit 48 kHz PCM WAV that its reference names is kept', () => {
    const at = folder('good', wav());
    expect(setUp.prepareSpeechFixture({ dataDir: at.dataDir, ffmpeg: '/usr/bin/false' })).toMatchObject({ status: 'KEPT', wav: at.wav });
  });
});
