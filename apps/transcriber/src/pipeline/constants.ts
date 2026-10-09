/**
 * The design constants of the transcript pipeline (transcript spec §0.2). Every one of them is a
 * PROPOSAL of that table unless the spec marks it decided; calibration is class C (C-7). None of
 * them is a speed or an accuracy figure (D230).
 */

/**
 * §0.2 `VAD_MAX_CHUNK_MS`: the length a chunk is PLANNED to at most. A tap chunk is then snapped
 * outwards to the AAC frame grid of the file, so it can be up to two frames (43 ms) longer than
 * this; both engines take that (navigator finding N-11: 30,037 ms was observed).
 */
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

// ── Row 78 (M6-W3): diarization and assembly ───────────────────────────────────────────────

/** §0.2 `DIARIZATION_MAX_SPEAKERS`: the transcript labels two speakers, or none. */
export const DIARIZATION_MAX_SPEAKERS = 2;
/**
 * §0.2 `DIARIZATION_CLUSTER_THRESHOLD` (PROPOSAL of the spec). Used twice, as §A.4 uses it: the
 * cosine distance two speaker clusters must at least lie apart to count as two speakers, and the
 * mean cluster-assignment confidence below which the transcript is sealed unlabelled.
 */
export const DIARIZATION_CLUSTER_THRESHOLD = 0.5;
/** §0.2 `DIARIZATION_MIN_SEGMENTS` (PROPOSAL of the spec): fewer transcript segments are never labelled. */
export const DIARIZATION_MIN_SEGMENTS = 4;
/**
 * The shortest transcript segment that gets a speaker embedding. A shorter one ("Ya.", "Baik.")
 * holds too little voice for a vector that means anything: it is not embedded and carries no
 * label. PROPOSAL of row 78 (no spec value); calibration is class C.
 */
export const DIARIZATION_MIN_EMBED_MS = 1_500;

/** §0.2 `TRANSCRIPT_DOC_VERSION`: the form of the sealed machine transcript. */
export const TRANSCRIPT_DOC_VERSION = 'dems.transcript/1';
/** §A.4: the exact flag text of a transcript that is sealed unlabelled. */
export const SPEAKER_LABELS_UNAVAILABLE_FLAG = 'speaker labels unavailable';

/** The files of an assembled transcript under the session scratch directory (ev §B.7 field 79 names the first). */
export const TRANSCRIPT_DOCUMENT_FILE = 'transcript.json';
export const TRANSCRIPT_SRT_FILE = 'transcript.srt';
export const TRANSCRIPT_VTT_FILE = 'transcript.vtt';
