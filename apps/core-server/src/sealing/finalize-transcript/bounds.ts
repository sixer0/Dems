/**
 * THE BOUNDS OF `FINALIZE_TRANSCRIPT` (blueprint row 116; requirement R-8, decisions D20, D-EV-1;
 * evidence package spec §E.5 "sealing does not wait" / "a hard STT failure does not block
 * sealing"; transcript spec §B.7 "Enabled but backend unreachable").
 *
 * SEALING WAITS FOR THE TRANSCRIPT (D223) — BUT NEVER FOR EVER. Three bounds, one after the other:
 *
 *   1. PER CHUNK, in the transcriber: a chunk whose engine fails is tried `STT_CHUNK_RETRIES`
 *      times more (`apps/transcriber/src/pipeline/constants.ts`), then it is FAILED and the
 *      transcript goes on without it. A backend that REFUSES is over quickly this way: every
 *      chunk fails, the transcript is complete and PARTIAL, and this step never waits.
 *
 *   2. PER QUESTION, here: one call of the step waits `callLimitMs` at most for the answer of the
 *      transcriber seam. No answer in that time is "not ready", never a hung seal.
 *
 *   3. THE WHOLE STEP, here: `stepLimitMs`, counted over every call and every attempt of the step
 *      and kept in its journal row. `closeOutLimitMs` of it is reserved for the end: once the
 *      step has waited `stepLimitMs - closeOutLimitMs`, it stops asking for a finished transcript
 *      and asks the transcriber seam to CLOSE THE TRANSCRIPT OUT — every chunk that is not
 *      committed is given up (FAILED, without text) and the document is assembled from the
 *      committed chunks only. That is the D-EV-1 seal: `PARTIAL`, the failed chunks counted, no
 *      text made up.
 *
 * WHAT IS COUNTED. The time the step spent in its calls, plus the time between two calls — a gap
 * longer than `callLimitMs` counts as `callLimitMs`. So a Core that was down for a night does not
 * find its transcript given up at the restart (nothing was transcribing while it was down), and a
 * clock that jumps cannot spend or refill the budget. The caller (the pipeline of row 82) asks
 * again no later than `remainingWaitMs` of a WAITING answer and no slower than `callLimitMs`; then
 * the step is DONE within `stepLimitMs` of its first call.
 *
 *   4. THE LAST RESORT (row 119, decision D110): A RECORDING IS NEVER HELD BACK BY TRANSCRIPTION.
 *      The close-out is itself work of the transcriber and can fail. Every call of the step that
 *      fails AT the bound is counted in the journal row. After `closeOutAttempts` such failures —
 *      or after one, when the caller says so (`sealWithoutTranscript`) — the NEXT call asks the
 *      transcriber nothing more and is DONE: `PARTIAL` WITHOUT a transcript document, reason
 *      `TRANSCRIPT_UNAVAILABLE_AT_SEAL`. No text is made up; nothing of a transcript is sealed.
 *
 * WHERE THEY ARE CONFIGURED. Here, as `FINALIZE_TRANSCRIPT_LIMITS`; the pipeline may state others
 * per call (`FinalizeTranscriptInput.limits`). `config.ts` is frozen (P25) and gains no key. The
 * values are BOUNDS chosen by this row, not measurements of any engine (D230), and a proposal
 * until the milestone review confirms them.
 */
export interface FinalizeTranscriptLimits {
  /** The upper bound of the whole step: waiting and closing out. */
  readonly stepLimitMs: number;
  /** The upper bound of one question to the transcriber seam, and the most a gap between two calls counts. */
  readonly callLimitMs: number;
  /** The part of `stepLimitMs` kept for closing the transcript out. */
  readonly closeOutLimitMs: number;
  /**
   * How many calls of the step may fail at the bound before the next one seals without a
   * transcript (row 119). Absent: `FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS`.
   */
  readonly closeOutAttempts?: number;
}

/** The default of `closeOutAttempts`: a count chosen by row 119, a proposal like the limits below. */
export const FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS = 3;
/** The most `closeOutAttempts` may be: the last resort is reached, always. */
export const FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS_MAX = 100;

export const closeOutAttemptsOf = (limits: FinalizeTranscriptLimits): number => limits.closeOutAttempts ?? FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS;

export const FINALIZE_TRANSCRIPT_LIMITS: FinalizeTranscriptLimits = Object.freeze({
  stepLimitMs: 30 * 60_000,
  callLimitMs: 30_000,
  closeOutLimitMs: 2 * 60_000,
});

/** How long the step waits for a finished transcript before it closes the transcript out. */
export const waitLimitOf = (limits: FinalizeTranscriptLimits): number => limits.stepLimitMs - limits.closeOutLimitMs;

/** Null when the limits can be used; otherwise which rule they break. */
export function limitsFault(limits: FinalizeTranscriptLimits): string | null {
  const whole = (value: number): boolean => Number.isSafeInteger(value) && value > 0;
  if (!whole(limits.stepLimitMs) || !whole(limits.callLimitMs) || !whole(limits.closeOutLimitMs)) return 'NOT_A_POSITIVE_INTEGER';
  if (limits.closeOutLimitMs >= limits.stepLimitMs) return 'NO_TIME_LEFT_TO_WAIT';
  const attempts = limits.closeOutAttempts;
  if (attempts !== undefined && (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > FINALIZE_TRANSCRIPT_CLOSE_OUT_ATTEMPTS_MAX)) return 'CLOSE_OUT_ATTEMPTS_OUT_OF_RANGE';
  return null;
}

/**
 * THE CLOCK OF A BOUND, as a port: `fire` is called once after `ms`, unless the returned function
 * was called first. Production: `systemStepTimer`. A test hands in a clock it moves by hand, so no
 * test waits on the wall clock.
 */
export interface StepTimer {
  after(ms: number, fire: () => void): () => void;
}

export const systemStepTimer: StepTimer = Object.freeze({
  after(ms: number, fire: () => void): () => void {
    const handle = setTimeout(fire, ms);
    // A bound never keeps the process alive: a seal that is being shut down is resumed by RECOVERY.
    handle.unref();
    return () => clearTimeout(handle);
  },
});

/**
 * The failure code of a chunk the close-out gave up: the bound of the seal was reached before its
 * backend answered. It is the transcriber's `TIMEOUT`, and it is read like every other `TIMEOUT`
 * (handler, `isUnreachableCode`): on the server backend the backend could not be reached; on
 * `cpu-local` it is the time bound of an engine that did run.
 */
export const CLOSE_OUT_CHUNK_CODE = 'TIMEOUT';

export type BoundedAnswer<T> = { readonly kind: 'ANSWER'; readonly value: T } | { readonly kind: 'NO_ANSWER' };

/**
 * Runs one question with a bound. The answer, or `NO_ANSWER` after `ms` — then the signal is
 * aborted and whatever the question answers later is dropped (an answer after the bound changes
 * nothing). A question that fails before the bound fails this call.
 */
export function withinBound<T>(timer: StepTimer, ms: number, ask: (signal: AbortSignal) => Promise<T>): Promise<BoundedAnswer<T>> {
  return new Promise((resolve, reject) => {
    const abort = new AbortController();
    const cancel = timer.after(ms, () => {
      abort.abort();
      resolve({ kind: 'NO_ANSWER' });
    });
    Promise.resolve()
      .then(() => ask(abort.signal))
      .then(
        (value) => {
          cancel();
          resolve({ kind: 'ANSWER', value });
        },
        (error: unknown) => {
          cancel();
          reject(error instanceof Error ? error : new Error('the question failed without an error'));
        },
      );
  });
}
