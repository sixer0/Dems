/**
 * WHAT A TEST MICROPHONE PLAYS (fix wave H, driver E; ruling D198 on gate 81, condition C1; capture
 * spec §A.7.1 "Fake microphone of slot 2", §A.1.2).
 *
 * The generated microphones of development capture play a tone. A tone carries no speech: the
 * voice-activity stage of the transcriber plans no chunk and the speech engine never starts, so no
 * development session can show a transcript with segments. The DEVELOPMENT setting
 *
 *     DEMS_CAPTURE_DEV_FAKE_MIC = tone | speech        (default: tone)
 *
 * makes the FIRST generated microphone play the speech fixture instead:
 * `<dataDir>/dev-fixtures/speech-mic/dialogue.wav`, synthetic speech made on this machine by
 * `npm run capture:dev-setup` (git-ignored, never committed). The path is NOT a setting: it is
 * built from the data directory and two literals, so no value of the environment becomes an
 * argument of the helper. Every other generated microphone keeps its tone.
 *
 * `fakeMicDecisionOf` IS THE ONLY READER of the setting (the test beside this file scans for a
 * second one). It is asked ONCE, by the boot step of the fence, with the capture operation the one
 * function decided:
 *
 *   setting   operation           answer
 *   tone      any                 TONE
 *   speech    REAL_DEVELOPMENT    SPEECH with the fixture path - or the refusal
 *                                 DEV_SPEECH_FIXTURE_UNUSABLE when the file is absent, is not
 *                                 mono 16-bit 48 kHz PCM WAVE audio (closing pass Z1: a text file
 *                                 renamed `.wav` is refused HERE, with the reason), or fails the
 *                                 path rule of the helper program (SEC35-43 (a): the file and every
 *                                 directory on the way owned by root or the server's user, none
 *                                 writable by group or others) - a file another local user could
 *                                 replace is never played into a recording
 *   speech    anything else       the refusal DEV_FAKE_MIC_NEEDS_DEV_SOURCES: a production or a
 *                                 simulated configuration never carries a development setting
 *
 * A REFUSED ANSWER PLAYS THE TONE, never the fixture: a reader that forgot to look at `refusal`
 * hands no file to a helper. The boot fence stops the start for both refusals.
 *
 * No device is involved anywhere: the fixture is a file input of the same helper program, through
 * the same output line (`adapters/local/mic-helper-args.ts`). Pure but for the inspector and the
 * head reader it is handed (both of `adapters/local/process-door.ts`, the one file-system door):
 * no file is read here, no clock, no environment.
 */
import { CaptureOperation } from '../adapters/kinds';
import { HelperProgramRefusal, helperProgramRefusal, isSpeechFixtureArgument, speechFixturePath, type FileHeadReader, type ProgramInspector } from '../adapters/local';

export const FakeMicSource = { TONE: 'TONE', SPEECH: 'SPEECH' } as const;
export type FakeMicSource = (typeof FakeMicSource)[keyof typeof FakeMicSource];

export const FakeMicRefusal = {
  /** `speech` in an operation that is not development capture. */
  DEV_FAKE_MIC_NEEDS_DEV_SOURCES: 'DEV_FAKE_MIC_NEEDS_DEV_SOURCES',
  /** `speech` in development capture, and the fixture is absent or fails the path rule. */
  DEV_SPEECH_FIXTURE_UNUSABLE: 'DEV_SPEECH_FIXTURE_UNUSABLE',
} as const;
export type FakeMicRefusal = (typeof FakeMicRefusal)[keyof typeof FakeMicRefusal];

/**
 * Why the fixture cannot be played: a rule of the path rule, a data directory whose path is not of
 * the argument's shape, or (closing pass Z1) the file's own FORMAT - see `speechFixtureFormatProblem`.
 */
export const SpeechFixtureProblem = {
  ...HelperProgramRefusal,
  PATH_SHAPE: 'PATH_SHAPE',
  /** The head of the file could not be read. */
  UNREADABLE: 'UNREADABLE',
  /** Not a RIFF / WAVE file with a `fmt ` chunk (a text file renamed `.wav`, another container, a cut header). */
  NOT_WAV: 'NOT_WAV',
  /** WAVE, but the samples are not integer PCM (float, a compressed format). */
  WAV_NOT_PCM: 'WAV_NOT_PCM',
  WAV_NOT_MONO: 'WAV_NOT_MONO',
  WAV_NOT_48KHZ: 'WAV_NOT_48KHZ',
  WAV_NOT_16BIT: 'WAV_NOT_16BIT',
  /** The `data` chunk holds no sample. */
  WAV_NO_AUDIO: 'WAV_NO_AUDIO',
} as const;
export type SpeechFixtureProblem = (typeof SpeechFixtureProblem)[keyof typeof SpeechFixtureProblem];

/** The members of the configuration the decision reads. `CoreServerConfig` satisfies it; an absent setting is `tone`. */
export interface FakeMicInput {
  readonly captureDevFakeMic?: 'tone' | 'speech';
  readonly dataDir?: string;
}

export interface FakeMicDecision {
  readonly source: FakeMicSource;
  /** The file the first generated microphone plays; null for the tone and for every refusal. */
  readonly fixturePath: string | null;
  readonly refusal: FakeMicRefusal | null;
  /** For `DEV_SPEECH_FIXTURE_UNUSABLE`: which rule failed. */
  readonly problem: SpeechFixtureProblem | null;
}

/** How much of the fixture the fence reads: the RIFF header, the `fmt ` chunk and any filler before the audio. */
export const SPEECH_FIXTURE_HEAD_BYTES = 8_192;
/** The format the helper is given the fixture as (`mic-helper-args.ts`, `-f wav`), as the set-up writes it. */
export const SPEECH_FIXTURE_FORMAT = Object.freeze({ sampleRateHz: 48_000, channels: 1, bitsPerSample: 16 });

const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;
const tag = (bytes: Uint8Array, at: number): string => (at + 4 <= bytes.length ? String.fromCharCode(bytes[at] ?? 0, bytes[at + 1] ?? 0, bytes[at + 2] ?? 0, bytes[at + 3] ?? 0) : '');
const u16 = (bytes: Uint8Array, at: number): number => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
const u32 = (bytes: Uint8Array, at: number): number => ((bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8) | ((bytes[at + 2] ?? 0) << 16)) + (bytes[at + 3] ?? 0) * 0x1000000;

/**
 * THE FORMAT RULE OF THE SPEECH FIXTURE (closing pass Z1; driver E decision 5, ruling D201 (5)),
 * over the first bytes of the file: little-endian RIFF of form WAVE, a `fmt ` chunk that says
 * integer PCM, one channel, 48,000 Hz, 16 bits, and - where the `data` chunk lies inside the bytes
 * read - at least one sample. Null when the file passes. Pure: no file is read here.
 *
 * WHY AT BOOT. The path rule says who may replace the file, not what it is. A file at the path that
 * is no audio passed the boot; the helper then refused it (`-f wav`) at the first session start,
 * and the session read as a lost microphone - a development setting that fails as a device fault.
 */
export function speechFixtureFormatProblem(head: Uint8Array | null): SpeechFixtureProblem | null {
  if (head === null) return SpeechFixtureProblem.UNREADABLE;
  if (head.length < 12 || tag(head, 0) !== 'RIFF' || tag(head, 8) !== 'WAVE') return SpeechFixtureProblem.NOT_WAV;
  let at = 12;
  let format: { code: number; channels: number; rate: number; bits: number } | null = null;
  while (at + 8 <= head.length) {
    const id = tag(head, at);
    const size = u32(head, at + 4);
    const body = at + 8;
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > head.length) return SpeechFixtureProblem.NOT_WAV;
      let code = u16(head, body);
      // WAVE_FORMAT_EXTENSIBLE carries the real code in the first two bytes of its sub-format.
      if (code === WAVE_FORMAT_EXTENSIBLE && size >= 40 && body + 26 <= head.length) code = u16(head, body + 24);
      format = { code, channels: u16(head, body + 2), rate: u32(head, body + 4), bits: u16(head, body + 14) };
    } else if (id === 'data') {
      if (format === null) return SpeechFixtureProblem.NOT_WAV;
      if (size === 0) return SpeechFixtureProblem.WAV_NO_AUDIO;
      break;
    }
    // Chunks are word-aligned.
    at = body + size + (size % 2);
  }
  if (format === null) return SpeechFixtureProblem.NOT_WAV;
  if (format.code !== WAVE_FORMAT_PCM) return SpeechFixtureProblem.WAV_NOT_PCM;
  if (format.channels !== SPEECH_FIXTURE_FORMAT.channels) return SpeechFixtureProblem.WAV_NOT_MONO;
  if (format.rate !== SPEECH_FIXTURE_FORMAT.sampleRateHz) return SpeechFixtureProblem.WAV_NOT_48KHZ;
  if (format.bits !== SPEECH_FIXTURE_FORMAT.bitsPerSample) return SpeechFixtureProblem.WAV_NOT_16BIT;
  return null;
}

/** A decision that was handed no reader reads nothing, and so accepts nothing (`UNREADABLE`). */
const READS_NOTHING: FileHeadReader = () => null;

const TONE: FakeMicDecision = Object.freeze({ source: FakeMicSource.TONE, fixturePath: null, refusal: null, problem: null });
const refused = (refusal: FakeMicRefusal, problem: SpeechFixtureProblem | null = null): FakeMicDecision => Object.freeze({ source: FakeMicSource.TONE, fixturePath: null, refusal, problem });

/** THE one reader of the setting. See the table in the header. */
export function fakeMicDecisionOf(config: FakeMicInput, operation: CaptureOperation, inspect: ProgramInspector, readHead: FileHeadReader = READS_NOTHING): FakeMicDecision {
  // Anything but the literal `speech` is the tone: a configuration built by hand cannot turn speech on by accident.
  if (config.captureDevFakeMic !== 'speech') return TONE;
  if (operation !== CaptureOperation.REAL_DEVELOPMENT) return refused(FakeMicRefusal.DEV_FAKE_MIC_NEEDS_DEV_SOURCES);
  const path = typeof config.dataDir === 'string' ? speechFixturePath(config.dataDir) : '';
  if (!isSpeechFixtureArgument(path)) return refused(FakeMicRefusal.DEV_SPEECH_FIXTURE_UNUSABLE, SpeechFixtureProblem.PATH_SHAPE);
  const problem = helperProgramRefusal(inspect(path));
  if (problem !== null) return refused(FakeMicRefusal.DEV_SPEECH_FIXTURE_UNUSABLE, problem);
  // The file is the server's own and nobody else can replace it: now WHAT it is (closing pass Z1). Read after the path rule, never before.
  const format = speechFixtureFormatProblem(readHead(path, SPEECH_FIXTURE_HEAD_BYTES));
  if (format !== null) return refused(FakeMicRefusal.DEV_SPEECH_FIXTURE_UNUSABLE, format);
  return Object.freeze({ source: FakeMicSource.SPEECH, fixturePath: path, refusal: null, problem: null });
}
