/**
 * `FINALIZE_TRANSCRIPT` AS THE RUNNING CORE CALLS IT (blueprint row 71c, decision D153; evidence
 * package spec §E.5, §B.7a; transcript spec §B.7, §D.3; decisions D-EV-1, D110, D223).
 *
 * Row 79's step (`finalizeTranscript`) is a function of its ports. This file is what the
 * composition hands it for ONE session, decided by the session's own STT snapshot and by what the
 * transcription unit says can be had (`SessionRuns.availability`):
 *
 *   snapshot disables STT            the step is DONE at once: `DISABLED` /
 *                                    `DISABLED_BY_CONFIGURATION`. The transcriber is asked nothing.
 *   a transcriber session exists     the transcriber seam on the session's run - `assemble`,
 *                                    `closeOut`, `locate` - within THE SPEC'S BOUND
 *                                    (`FINALIZE_TRANSCRIPT_LIMITS`, row 116; a setting of the
 *                                    composition). It ends `ASSEMBLED`, or `PARTIAL`: with the
 *                                    document of the committed chunks when the transcript had to
 *                                    be closed out at the bound, without a document after the
 *                                    close-out itself failed (row 119).
 *   STT enabled, nothing can be had  (the transcriber could not be built, the provenance of its
 *                                    model is not known, nothing was recorded) and
 *   no snapshot at all               THE SEAL DOES NOT WAIT FOR A TRANSCRIPT THAT CANNOT COME: the
 *                                    step is taken to its bound at once (`NO_TRANSCRIPT_LIMITS`)
 *                                    and ends in row 119's declared absence - `PARTIAL`, no
 *                                    document, `TRANSCRIPT_UNAVAILABLE_AT_SEAL`. No text is made
 *                                    up. The reason is written to the log and the error log.
 *
 * WHY THE LAST CASE GOES THROUGH THE STEP'S OWN BOUND instead of building the block here: the
 * shape of a transcript block, its journal row and its resume rule are row 79's and row 119's,
 * proven there; this file changes none of them. It only says how long there is to wait: nothing.
 *
 * WHAT A SESSION IS, IS DECIDED ONCE PER SESSION AND PROCESS: a seal does not change its mind
 * between two questions of one run.
 */
import {
  FINALIZE_TRANSCRIPT_LIMITS,
  finalizeTranscript,
  type AssembledTranscriptAnswer,
  type AssembledTranscriptSource,
  type FinalizeTranscriptLimits,
  type FinalizeTranscriptPorts,
  type TranscriptFiles,
  type TranscriptStep,
} from '../sealing';
import { isSttSnapshotNotRecorded } from './session-reader';

/** What the seal asks of the transcription unit (`transcriptionControl(app).runs` satisfies it). */
export interface SealTranscriptRuns {
  availability(sessionId: string): Promise<{ readonly kind: 'NO_SNAPSHOT' } | { readonly kind: 'DISABLED' } | { readonly kind: 'UNAVAILABLE'; readonly code: string } | { readonly kind: 'AVAILABLE' }>;
  assemble(sessionId: string): Promise<AssembledTranscriptAnswer>;
  closeOut(sessionId: string, chunkCode: string): Promise<AssembledTranscriptAnswer>;
  locate(sessionId: string): TranscriptFiles;
}

/**
 * The bounds of a step that has NOTHING to wait for: the smallest the step admits. Its first
 * question is answered "not ready", its second finds the bound reached and the close-out
 * impossible, and the next is DONE without a document (`sealWithoutTranscript`, row 119).
 */
export const NO_TRANSCRIPT_LIMITS: FinalizeTranscriptLimits = Object.freeze({ stepLimitMs: 2, callLimitMs: 1, closeOutLimitMs: 1, closeOutAttempts: 1 });

export const SealTranscriptCode = {
  /** The session has no STT snapshot: no transcriber ran for it. */
  SNAPSHOT_MISSING: 'SEALING_STT_SNAPSHOT_MISSING',
  /** STT was enabled for the session and no transcript can be had. */
  TRANSCRIPT_UNAVAILABLE: 'SEALING_TRANSCRIPT_UNAVAILABLE',
  /** The transcription unit could not say what can be had. */
  AVAILABILITY_UNKNOWN: 'SEALING_TRANSCRIPT_AVAILABILITY_UNKNOWN',
} as const;

export interface SealTranscriptStepOptions {
  /** The transcription unit's runs; null: no transcription composition in this app. */
  readonly runs: () => SealTranscriptRuns | null;
  /** Everything of row 79's ports but the transcriber seam, which this file decides. */
  readonly ports: Omit<FinalizeTranscriptPorts, 'transcript'>;
  /** THE BOUND'S SETTING for a session whose transcript can be had. Absent: `FINALIZE_TRANSCRIPT_LIMITS`. */
  readonly limits?: () => FinalizeTranscriptLimits;
  /** The log and the persistent error log of the composition. */
  readonly report: (level: 'warn' | 'error', code: string, message: string, sessionId: string, more: Readonly<Record<string, string | number | boolean | null>>) => void;
}

type Kind = { readonly kind: 'AVAILABLE' } | { readonly kind: 'NOTHING'; readonly why: string };

export function createSealTranscriptStep(options: SealTranscriptStepOptions): TranscriptStep {
  const decided = new Map<string, Kind>();

  const locate = (sessionId: string): TranscriptFiles => {
    const runs = options.runs();
    if (runs === null) throw new Error('no transcript files: this Core has no transcription composition');
    return runs.locate(sessionId);
  };

  /** The seam of a session whose transcriber session exists. */
  const live: AssembledTranscriptSource = {
    assemble: async (sessionId) => (await options.runs()?.assemble(sessionId)) ?? { kind: 'NOT_READY' },
    closeOut: async (sessionId, call) => (await options.runs()?.closeOut(sessionId, call.chunkCode)) ?? { kind: 'NOT_READY' },
    locate,
  };
  /** The seam of a session for which nothing can be handed over: it answers what is true, and `locate` only reads. */
  const nothing: AssembledTranscriptSource = {
    assemble: async () => ({ kind: 'NOT_READY' }),
    closeOut: async () => ({ kind: 'NOT_READY' }),
    locate,
  };

  async function decide(sessionId: string, snapshotRecorded: boolean): Promise<Kind> {
    const known = decided.get(sessionId);
    if (known !== undefined) return known;
    let kind: Kind;
    if (!snapshotRecorded) {
      kind = { kind: 'NOTHING', why: 'NO_SNAPSHOT' };
      options.report('error', SealTranscriptCode.SNAPSHOT_MISSING, 'the session has no STT snapshot: no transcriber ran for it; it is sealed without a transcript document, as unavailable at the seal', sessionId, {});
    } else {
      const runs = options.runs();
      let answer: Awaited<ReturnType<SealTranscriptRuns['availability']>>;
      try {
        answer = runs === null ? { kind: 'UNAVAILABLE', code: 'TRANSCRIPTION_NOT_MOUNTED' } : await runs.availability(sessionId);
      } catch {
        // `availability` never throws; a double that does is a transcriber that cannot say.
        answer = { kind: 'UNAVAILABLE', code: SealTranscriptCode.AVAILABILITY_UNKNOWN };
      }
      if (answer.kind === 'AVAILABLE') kind = { kind: 'AVAILABLE' };
      else if (answer.kind === 'NO_SNAPSHOT') {
        // The transcription unit holds the session's own row: it has none (R80-07 - said by the unit, not read from a member).
        kind = { kind: 'NOTHING', why: 'NO_SNAPSHOT' };
        options.report('error', SealTranscriptCode.SNAPSHOT_MISSING, 'the session has no STT snapshot: no transcriber ran for it; it is sealed without a transcript document, as unavailable at the seal', sessionId, {});
      } else {
        // The session record says STT was enabled: an answer that says otherwise is not believed over it.
        const why = answer.kind === 'UNAVAILABLE' ? answer.code : `SNAPSHOT_DISAGREES_${answer.kind}`;
        kind = { kind: 'NOTHING', why };
        options.report('error', SealTranscriptCode.TRANSCRIPT_UNAVAILABLE, 'STT was enabled for the session and no transcript can be had: it is sealed without a transcript document, and the seal does not wait', sessionId, { cause: why });
      }
    }
    decided.set(sessionId, kind);
    return kind;
  }

  return {
    async finalize(input) {
      // Disabled by the session's own configuration: row 79's step is DONE at once and asks the transcriber nothing.
      if (!input.sttSnapshot.enabled) return finalizeTranscript(input, { ...options.ports, transcript: nothing });
      const kind = await decide(input.sessionId, !isSttSnapshotNotRecorded(input.sttSnapshot));
      if (kind.kind === 'AVAILABLE') return finalizeTranscript({ ...input, limits: options.limits?.() ?? FINALIZE_TRANSCRIPT_LIMITS }, { ...options.ports, transcript: live });
      return finalizeTranscript({ ...input, limits: NO_TRANSCRIPT_LIMITS, sealWithoutTranscript: true }, { ...options.ports, transcript: nothing });
    },
  };
}
