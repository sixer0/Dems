/**
 * `TtsFixtureProvider`: the test audio of the transcript checks (transcript spec §B.6; row 12
 * §2.1-2.4). DEV-SIDE ONLY: nothing here ships in the Core product (OmniVoice licence note, §F).
 *
 * TWO JOBS, AND ONLY THE FIRST ONE FEEDS A CHECK:
 *
 *   `provide()`   hands out the SEALED two-voice Indonesian fixture, after proving that the bytes
 *                 on disk are the sealed ones (size + SHA-256). Speech synthesis is not
 *                 deterministic per request, so every check reuses these bytes; a file that
 *                 differs by one byte is refused (`FIXTURE_CORRUPT`), never used.
 *   `generate()`  realises the row-12 recipe for a NEW fixture: one synthesis request per scripted
 *                 turn (voice cloning from a reference voice per speaker), then the turns joined
 *                 with a fixed silence. The result is a different file with a different hash; it
 *                 is written beside the sealed one, never over it, and is not sealed by this code.
 *
 * The reference voices (`say` + `afconvert` in row 12) are INPUTS of `generate()`: this module does
 * not create them. The fixture path, the synthesis model and the server address all come from the
 * caller: none is written here.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { OMLX_PATHS, type OmlxHttp } from '../backends/omlx-http';
import type { SerialQueue } from '../cpu-priority';
import type { TranscriberLog } from '../log';
import { TRANSCRIBER_LANGUAGE, TranscriberError, TranscriberErrorCode } from '../types';
import { readWavFacts } from '../wav';

export type FixtureSpeaker = 'A' | 'B';

export interface FixtureTurn {
  readonly id: string;
  readonly speaker: FixtureSpeaker;
  readonly text: string;
}

/**
 * The script of the sealed fixture: 13 sentences, two voices (A = examiner, B = subject). Numbers
 * and acronyms are spelled out, as the synthesis engine needs.
 */
export const TWO_SPEAKER_SCRIPT: readonly FixtureTurn[] = Object.freeze([
  { id: 'A1', speaker: 'A', text: 'Selamat pagi, terima kasih sudah hadir pada wawancara hari ini.' },
  { id: 'B1', speaker: 'B', text: 'Selamat pagi, terima kasih atas undangannya.' },
  { id: 'A2', speaker: 'A', text: 'Sebelum kita mulai, tolong jelaskan peran Anda di gudang.' },
  { id: 'B2', speaker: 'B', text: 'Saya bekerja sebagai operator penerimaan barang dan memeriksa jumlah setiap kiriman.' },
  { id: 'A3', speaker: 'A', text: 'Berapa lama proses penerimaan biasanya berlangsung?' },
  { id: 'B3', speaker: 'B', text: 'Umumnya sekitar satu jam, tergantung padatnya kiriman.' },
  { id: 'A4', speaker: 'A', text: 'Apa harapan Anda terhadap sistem yang baru?' },
  { id: 'B4', speaker: 'B', text: 'Saya berharap pencatatan lebih cepat dan setiap bukti penerimaan tersimpan rapi.' },
  { id: 'A5', speaker: 'A', text: 'Sekarang saya ingin mendengar kendala teknis yang Anda alami sehari-hari.' },
  { id: 'B5', speaker: 'B', text: 'Kadang jaringan di gudang lambat, sehingga pemindaian harus diulang beberapa kali.' },
  { id: 'A6', speaker: 'A', text: 'Apakah ada saran perbaikan dari sisi pengguna?' },
  { id: 'B6', speaker: 'B', text: 'Sebaiknya perangkat pemindai diganti secara berkala dan pelatihan singkat diadakan rutin.' },
  { id: 'A7', speaker: 'A', text: 'Baik, wawancara kita tutup dengan rekaman ini, terima kasih atas kerja samanya.' },
] as const);

/** The seal of the row-12 fixture (transcript spec §B.6, §E.2). */
export const SEALED_TWO_SPEAKER_FIXTURE = Object.freeze({
  id: 'fixture-two-speaker-id',
  sha256: '6743181a7d976ca24c03ad8e427d6d7093fbb0b9f72257e6e2f91dcfc0f4fe71',
  bytes: 3_154_638,
  scriptedSentences: TWO_SPEAKER_SCRIPT.length,
  language: TRANSCRIBER_LANGUAGE,
});

/** The silence between two turns of a generated fixture. */
export const FIXTURE_GAP_MS = 400;

export interface ProvidedFixture {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly durationMs: number;
  readonly sampleRateHz: number;
  readonly sealed: boolean;
  readonly turns: readonly FixtureTurn[];
}

export interface ReferenceVoice {
  /** Raw audio of the reference voice. */
  readonly audio: Uint8Array;
  /** What the reference voice says: the engine needs both. */
  readonly text: string;
}

export interface TurnSynthesiser {
  /** One WAV (mono, signed 16-bit) of one turn. */
  synthesise(turn: FixtureTurn, voice: ReferenceVoice | null): Promise<Uint8Array>;
}

export interface TtsFixtureProviderOptions {
  /** The absolute path of the sealed fixture file. From the caller, never from this module. */
  readonly fixturePath: string;
  /** The seal to hold the file against. Default: the row-12 seal. Another seal is for a test of this provider. */
  readonly seal?: { readonly sha256: string; readonly bytes: number };
  readonly synthesiser?: TurnSynthesiser;
  readonly voices?: Partial<Record<FixtureSpeaker, ReferenceVoice>>;
}

export interface TtsFixtureProvider {
  provide(): Promise<ProvidedFixture>;
  generate(outputPath: string): Promise<ProvidedFixture>;
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

export function createTtsFixtureProvider(options: TtsFixtureProviderOptions): TtsFixtureProvider {
  const seal = options.seal ?? SEALED_TWO_SPEAKER_FIXTURE;

  async function provide(): Promise<ProvidedFixture> {
    let bytes: Buffer;
    try {
      bytes = await readFile(options.fixturePath);
    } catch {
      throw new TranscriberError(TranscriberErrorCode.FIXTURE_NOT_FOUND, 'the sealed fixture file is absent', { reason: 'FIXTURE_NOT_FOUND' });
    }
    const actual = sha256(bytes);
    if (bytes.length !== seal.bytes || actual !== seal.sha256) {
      throw new TranscriberError(TranscriberErrorCode.FIXTURE_CORRUPT, 'the fixture bytes are not the sealed ones', {
        reason: 'FIXTURE_HASH_MISMATCH',
        expectedSha256: seal.sha256,
        actualSha256: actual,
        expectedBytes: seal.bytes,
        actualBytes: bytes.length,
      });
    }
    const facts = readWavFacts(bytes);
    return { path: options.fixturePath, sha256: actual, bytes: bytes.length, durationMs: facts.durationMs, sampleRateHz: facts.sampleRateHz, sealed: true, turns: TWO_SPEAKER_SCRIPT };
  }

  async function generate(outputPath: string): Promise<ProvidedFixture> {
    const synthesiser = options.synthesiser;
    if (synthesiser === undefined) {
      throw new TranscriberError(TranscriberErrorCode.CONFIG_INVALID, 'generating a fixture needs a speech synthesiser', { reason: 'SYNTHESISER_MISSING' });
    }
    if (resolve(outputPath) === resolve(options.fixturePath)) {
      throw new TranscriberError(TranscriberErrorCode.CONFIG_INVALID, 'a generated fixture is never written over the sealed one', { reason: 'WOULD_OVERWRITE_SEALED_FIXTURE' });
    }
    const parts: Buffer[] = [];
    let rate: number | null = null;
    for (const turn of TWO_SPEAKER_SCRIPT) {
      // One request at a time, in script order: the synthesiser serialises on the shared server.
      const wav = await synthesiser.synthesise(turn, options.voices?.[turn.speaker] ?? null);
      const facts = readWavFacts(wav);
      if (facts.channels !== 1 || facts.bitsPerSample !== 16 || (rate !== null && rate !== facts.sampleRateHz)) {
        throw new TranscriberError(TranscriberErrorCode.BAD_ENGINE_OUTPUT, 'a synthesised turn is not mono 16-bit audio of one rate', { reason: 'TURN_FORMAT_MISMATCH', turn: turn.id });
      }
      rate = facts.sampleRateHz;
      if (parts.length > 0) parts.push(Buffer.alloc(Math.round((rate * FIXTURE_GAP_MS) / 1000) * 2));
      parts.push(Buffer.from(wav.buffer, wav.byteOffset + facts.dataOffset, facts.dataBytes));
    }
    const data = Buffer.concat(parts);
    const header = Buffer.alloc(44);
    const sampleRateHz = rate ?? 0;
    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVEfmt ', 8, 'ascii');
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRateHz, 24);
    header.writeUInt32LE(sampleRateHz * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(data.length, 40);
    const file = Buffer.concat([header, data]);
    await writeFile(outputPath, file, { flag: 'wx' }); // never replaces an existing file
    return { path: outputPath, sha256: sha256(file), bytes: file.length, durationMs: readWavFacts(file).durationMs, sampleRateHz, sealed: false, turns: TWO_SPEAKER_SCRIPT };
  }

  return { provide, generate };
}

export interface OmlxTtsSynthesiserOptions {
  readonly http: OmlxHttp;
  /** The synthesis model the server serves. From the caller. */
  readonly model: string;
  readonly log: TranscriberLog;
  /** The queue of the oMLX calls of this process (D7(d): STT and TTS calls are serialised). */
  readonly queue: SerialQueue;
}

/** The synthesiser of the installed server: `POST /v1/audio/speech`, one turn per request. */
export function createOmlxTtsSynthesiser(options: OmlxTtsSynthesiserOptions): TurnSynthesiser {
  return {
    synthesise: (turn, voice) =>
      options.queue.run(async () => {
        const body = {
          model: options.model,
          input: turn.text,
          language: TRANSCRIBER_LANGUAGE,
          response_format: 'wav',
          ...(voice === null ? {} : { ref_audio: Buffer.from(voice.audio).toString('base64'), ref_text: voice.text }),
        };
        try {
          const response = await options.http.postJson(OMLX_PATHS.SPEECH, body);
          if (response.status !== 200) {
            throw new TranscriberError(TranscriberErrorCode.ENGINE_FAILED, 'the speech server answered with an error', { reason: 'HTTP_ERROR', status: response.status, turn: turn.id });
          }
          return response.body;
        } catch (error) {
          options.log.error({ source: 'transcriber.ttsFixture.synthesise', message: 'fixture turn synthesis failed', error, context: { turn: turn.id, model: options.model } });
          throw error;
        }
      }),
  };
}
