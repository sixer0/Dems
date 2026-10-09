/**
 * The design constants of the transcript pipeline (transcript spec §0.2). Every one of them is a
 * PROPOSAL of that table unless the spec marks it decided; calibration is class C (C-7). None of
 * them is a speed or an accuracy figure (D230).
 */

/** §0.2 `VAD_MAX_CHUNK_MS`: no chunk is longer. */
export const VAD_MAX_CHUNK_MS = 30_000;
/** §0.2 `VAD_THRESHOLD`: the speech probability above which Silero calls a frame speech. */
export const VAD_THRESHOLD = 0.5;
/** §0.2 `VAD_MIN_SPEECH_MS`. */
export const VAD_MIN_SPEECH_MS = 250;
/** §A.2: a speech run longer than the maximum is split by the VAD at a silence above this. */
export const VAD_MIN_SILENCE_MS = 98;
/** §0.2 `VAD_SPEECH_PAD_MS`: what the VAD adds on both sides of a speech run. */
export const VAD_SPEECH_PAD_MS = 30;
/** §0.2 `VAD_OVERLAP_MS`: what two chunks share where a cut falls INSIDE speech or inside a fixed window. */
export const VAD_OVERLAP_MS = 100;
/** §0.2 `STT_CHUNK_RETRIES`: a failing chunk is tried this many times MORE, then marked FAILED. */
export const STT_CHUNK_RETRIES = 2;
/**
 * While the audio still grows, the VAD does not decide about the last part of what is there: a
 * speech run that touches the end may go on. PROPOSAL of this row (no spec value).
 */
export const VAD_TAIL_GUARD_MS = 2_000;

/**
 * The longest stretch of audio one VAD run is given. Longer audio is planned in several runs, so
 * the memory of a pass does not grow with the length of a recording. PROPOSAL of this row.
 */
export const VAD_WINDOW_MAX_MS = 300_000;

/** §0.2 `TRANSCRIPT_CHECKPOINT_PATH`: the file name under the session scratch directory. */
export const TRANSCRIPT_CHECKPOINT_FILE = 'transcript-checkpoint.json';
/** The form of the checkpoint file. Another value is refused, never guessed at. */
export const TRANSCRIPT_CHECKPOINT_VERSION = 'dems.transcript-checkpoint/1';

/** The qa flags this row sets (§A.1, §A.2). The document of row 78 carries them. */
export const QaFlag = {
  /** §A.2: the VAD model is absent or the VAD failed; fixed windows were used. */
  VAD_FALLBACK: 'vad_fallback',
  /** §A.2: the VAD found no speech in audio that is complete. Not an error. */
  NO_SPEECH: 'no_speech',
  /** §A.1: the audio-source intervals are missing or overlap. */
  INTERVALS_INCOMPLETE: 'intervals_incomplete',
} as const;
export type QaFlag = (typeof QaFlag)[keyof typeof QaFlag];
