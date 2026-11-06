/**
 * THE SEALING CONTROLLER (blueprint row 82): one run of the pipeline per session at a time, the
 * engine side of the pipeline's port, and the decision what a session needs after a restart.
 *
 * WHO CALLS IT.
 *   seal(sessionId, 'STOPPED')       the capture of a session ended by the operator's stop: the
 *                                    worker has exited (its files are closed) or its lossless
 *                                    `SEAL_COMPLETE` record arrived. Never a `PROGRESS` value.
 *   seal(sessionId, 'INTERRUPTED')   THE ONE CALL OF THE OD-08 PATH: the capture of a RECORDING
 *                                    session ended for good with a durable fragment (the engine's
 *                                    `endCapture` answered `INTERRUPTED`: the session is in FAULT
 *                                    with `captureDurable: true`). The durable prefix is sealed.
 *   resume()                         once after the engine started: a session a process start
 *                                    left in FAULT, RECOVERY or FINALIZING is sealed from where
 *                                    its rows of `sealing_jobs` stand, or as an interrupted
 *                                    recording when it was recording. AND (row 82c, F-86-2): a
 *                                    session that is SEALED while its rows are not all DONE - the
 *                                    process ended after the commit of the item - has its last
 *                                    step FINISHED: nothing is committed again, the plaintext
 *                                    recordings the package accounts for are removed, the DONE
 *                                    row is written.
 *
 * A second call for a session whose run is under way joins that run. A run that ends FAILED is
 * over; the next call starts another attempt.
 *
 * This file imports no unit of the server but the engine's types: the engine, the transcript
 * store of the committing unit and the pipeline are handed in.
 */
import type { CompleteSealInput, SealingProgressInput } from '@dems/shared/sim';
import type { UnitContext } from '../../core';
import type { FinalizedTranscript } from '../finalize-transcript/contract';
import type { SealCause, SealEngine, SealOutcome, SealingPipeline } from './contract';

/** The members of the engine host the sealing side uses (`EngineHost` satisfies it). */
export interface SealingEngineHost {
  applySealingProgress(input: SealingProgressInput): Promise<unknown>;
  completeSeal(input: CompleteSealInput, also?: (unit: UnitContext, evidenceId: string) => Promise<void>): Promise<unknown>;
  state(): {
    readonly session: { readonly id: string; readonly state: string; readonly stoppedAt: number | null; readonly fault: { readonly fromState: string } | null } | null;
    readonly evidence: readonly SealedItemOfState[];
  };
}

/** What the controller reads of an evidence item of the engine's state. */
export interface SealedItemOfState {
  readonly sessionId: string;
  readonly manifestHash: string;
  readonly integritySource?: string;
  /** The stored custody of the item: the seal of an interrupted recording writes `RECORDING_INTERRUPTED` in the unit that commits the item. */
  readonly custody?: readonly { readonly action: string }[];
  /** The sealed manifest's own flag, where the Core states it on the item (`engine/sealed-facts-doors.ts`). */
  readonly interrupted?: boolean;
}

/** Custody action the seal of an interrupted recording writes (`@dems/shared/sim` `CUSTODY_RECORDING_INTERRUPTED`). */
const CUSTODY_RECORDING_INTERRUPTED = 'RECORDING_INTERRUPTED';

/**
 * THE INTERRUPTED FACT OF A SEALED SESSION, read from its committed item (closing pass Z1, item 7).
 * `stoppedAt` cannot say it: since wave H driver B the seal of an interrupted recording writes
 * `stoppedAt` (the end of the durable media) AT SEALED, so a sealed interrupted session has one as a
 * stopped session has. The same rule as the shared `interruptedFactOf`: the sealed manifest's flag
 * is the answer where the item states it; otherwise the custody entry of the seal.
 */
export function sealedItemInterrupted(item: SealedItemOfState): boolean {
  if (typeof item.interrupted === 'boolean') return item.interrupted;
  return (item.custody ?? []).some((entry) => entry.action === CUSTODY_RECORDING_INTERRUPTED);
}

/**
 * The pipeline's engine port over the engine host. `commitTranscript` writes the row of
 * `transcripts` in the unit that commits the item (`commitSealedTranscript` over
 * `createTranscriptStore(unit)`): the item and its transcript commit together or not at all.
 */
export function sealEngineOf(host: () => SealingEngineHost, commitTranscript: (unit: UnitContext, evidenceId: string, transcript: FinalizedTranscript, sealedAt: number) => Promise<void>): SealEngine {
  const sealedAlready = (sessionId: string, manifestSha256?: string): boolean =>
    host()
      .state()
      .evidence.some((item) => item.sessionId === sessionId && item.integritySource === 'REAL' && (manifestSha256 === undefined || item.manifestHash === manifestSha256));
  return Object.freeze({
    async applySealingProgress(input: SealingProgressInput): Promise<void> {
      const session = host().state().session;
      // A run that was stopped after the commit of the item reports its last step once more.
      if (session !== null && session.id === input.sessionId && session.state === 'SEALED' && sealedAlready(input.sessionId)) return;
      await host().applySealingProgress(input);
    },
    async completeSeal(input: CompleteSealInput, transcript: FinalizedTranscript): Promise<'SEALED' | 'ALREADY_SEALED'> {
      if (sealedAlready(input.sessionId, input.manifestSha256)) return 'ALREADY_SEALED';
      await host().completeSeal(input, (unit, evidenceId) => commitTranscript(unit, evidenceId, transcript, input.sealedAt));
      return 'SEALED';
    },
    isSealed: (sessionId: string, manifestSha256: string): boolean => sealedAlready(sessionId, manifestSha256),
  });
}

export interface SealingControllerOptions {
  readonly pipeline: SealingPipeline;
  readonly engine: () => SealingEngineHost;
  /** True when a camera file or a fragment row of that session exists: what "durable" means after a restart (the file is the truth). */
  readonly hasDurableMedia: (sessionId: string) => Promise<boolean>;
  /** True when the session has a row of `sealing_jobs`. */
  readonly hasSealingRows: (sessionId: string) => Promise<boolean>;
  /** True when the session has rows of `sealing_jobs` and not all six say DONE: a seal that began and whose journal is not closed. */
  readonly hasOpenSealingRows: (sessionId: string) => Promise<boolean>;
  /** Told the end of every run (the composition writes it to the log; a FAILED run is in the error log already). */
  readonly onOutcome?: (outcome: SealOutcome) => void;
}

export type ResumeDecision =
  /** No session, a sealed one whose journal is closed, or one that never recorded. */
  | { readonly action: 'NONE' }
  | { readonly action: 'SEAL'; readonly sessionId: string; readonly cause: SealCause }
  /** The item of the session is committed and its journal is not closed (F-86-2): the last step is finished, nothing is committed again. */
  | { readonly action: 'FINISH'; readonly sessionId: string; readonly cause: SealCause };

export interface SealingController {
  seal(sessionId: string, cause: SealCause): Promise<SealOutcome>;
  /** What the session of the committed state needs now, without doing it. */
  decide(): Promise<ResumeDecision>;
  /** `decide`, and the seal it names. Null when there is nothing to do. */
  resume(): Promise<SealOutcome | null>;
  /** The session whose run is under way, or null. */
  running(): string | null;
}

const RECORDED_STATES: readonly string[] = ['RECORDING', 'STOPPING', 'FINALIZING'];

export function createSealingController(options: SealingControllerOptions): SealingController {
  const runs = new Map<string, Promise<SealOutcome>>();

  function seal(sessionId: string, cause: SealCause): Promise<SealOutcome> {
    const under = runs.get(sessionId);
    if (under !== undefined) return under;
    const run = options.pipeline
      .run({ sessionId, cause })
      .then((outcome) => {
        options.onOutcome?.(outcome);
        return outcome;
      })
      .finally(() => {
        if (runs.get(sessionId) === run) runs.delete(sessionId);
      });
    runs.set(sessionId, run);
    return run;
  }

  async function decide(): Promise<ResumeDecision> {
    const session = options.engine().state().session;
    if (session === null) return { action: 'NONE' };
    const stopped = session.stoppedAt !== null;
    if (session.state === 'SEALED') {
      // SEALED IS NOT ALWAYS FINISHED (row 82c, F-86-2). A process that ended after the commit of
      // the item and before the DONE row of the last step left `sealing_jobs` saying RUNNING for
      // good, and - when it ended before the removal - the plaintext recordings beside the package.
      // Only a session whose REAL item the engine holds is finished this way.
      const committed = options
        .engine()
        .state()
        .evidence.find((item) => item.sessionId === session.id && item.integritySource === 'REAL');
      if (committed === undefined || !(await options.hasOpenSealingRows(session.id))) return { action: 'NONE' };
      // NOT `stoppedAt` (closing pass Z1): a sealed interrupted session has one too. The committed item says which it was.
      return { action: 'FINISH', sessionId: session.id, cause: sealedItemInterrupted(committed) ? 'INTERRUPTED' : 'STOPPED' };
    }
    const from = session.state === 'FAULT' || session.state === 'RECOVERY' ? (session.fault?.fromState ?? null) : session.state === 'FINALIZING' || session.state === 'STOPPING' ? session.state : null;
    if (from === null || !RECORDED_STATES.includes(from)) return { action: 'NONE' };
    // A seal that had begun goes on from its rows, with the cause its first step recorded (the
    // pipeline keeps `interrupted` in the CLOSE_TRACKS checkpoint once that step is DONE).
    const begun = await options.hasSealingRows(session.id);
    if (begun) return { action: 'SEAL', sessionId: session.id, cause: stopped ? 'STOPPED' : 'INTERRUPTED' };
    // Nothing durable: a failed start, no seal (D84). The pipeline answers the same for a call that comes anyway.
    if (!(await options.hasDurableMedia(session.id))) return { action: 'NONE' };
    return { action: 'SEAL', sessionId: session.id, cause: stopped ? 'STOPPED' : 'INTERRUPTED' };
  }

  return Object.freeze({
    seal,
    decide,
    async resume(): Promise<SealOutcome | null> {
      const decision = await decide();
      // FINISH runs the same pipeline: every step that is DONE is skipped, and the last one finds the item committed.
      return decision.action === 'NONE' ? null : seal(decision.sessionId, decision.cause);
    },
    running: () => runs.keys().next().value ?? null,
  });
}

/** The two hand-off events of the capture side (`sessionCapture(app).on`, row 71b), as far as the seal reads them. */
export type SealHandOffEvent =
  | { readonly type: 'STOPPED'; readonly sessionId: string; readonly fragmentRowsBehind?: readonly string[]; readonly firstVideo?: readonly unknown[] }
  | { readonly type: 'INTERRUPTED'; readonly sessionId: string; readonly cause?: string | null; readonly firstVideo?: readonly unknown[] }
  | { readonly type: string; readonly sessionId: string };

export interface SealHandOffOptions {
  /** `sessionCapture(app)`: the listener is called when the worker has exited and its handles are closed. */
  readonly capture: { on(listener: (event: SealHandOffEvent) => void): () => void };
  readonly controller: Pick<SealingController, 'seal'>;
  /** A run that rejected (a defect, or a stop of the process): the composition writes it to the error log. */
  readonly onError: (sessionId: string, error: unknown) => void;
  /**
   * What the worker said of the start of each camera file (`FIRST_VIDEO_SAMPLE.skipped`,
   * `skippedSpanMs`, protocol 4). The manifest has no member for it (spec question of row 82):
   * the composition keeps it in the log of the seal.
   */
  readonly onFirstVideo?: (sessionId: string, firstVideo: readonly unknown[]) => void;
}

/**
 * THE SEAL'S ENTRY (ruling D144): `STOPPED` starts the normal seal, `INTERRUPTED` the interrupted
 * durable-prefix seal; `FAILED_START` and every other event start nothing (no evidence item).
 * Rows the live recorder is behind with (`fragmentRowsBehind`) need nothing said here: CLOSE_TRACKS
 * always holds the file against the rows and inserts what is missing. Returns the function that
 * removes the listener.
 */
export function sealOnCaptureHandOff(options: SealHandOffOptions): () => void {
  return options.capture.on((event) => {
    const cause: SealCause | null = event.type === 'STOPPED' ? 'STOPPED' : event.type === 'INTERRUPTED' ? 'INTERRUPTED' : null;
    if (cause === null) return;
    const firstVideo = (event as { firstVideo?: readonly unknown[] }).firstVideo;
    if (firstVideo !== undefined && firstVideo.length > 0) options.onFirstVideo?.(event.sessionId, firstVideo);
    // Never awaited by the capture side: the listener returns at once.
    options.controller.seal(event.sessionId, cause).catch((error: unknown) => options.onError(event.sessionId, error));
  });
}
