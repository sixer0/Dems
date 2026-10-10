/**
 * THE TRANSCRIBER SESSION OF A RECORDING, FROM CAPTURE START TO THE SEAL (blueprint row 71c,
 * decision D153; transcript spec §B.7, §C, §D.3; evidence package spec §E.5; decisions D90, D110,
 * D113; notes 54 "to wire", 55 "the production close-out does not exist").
 *
 * WHO CALLS IT.
 *   begin(sessionId)        the capture session, when the capture worker acknowledged the start (the
 *                           tap exists from then on). The session's own snapshot decides:
 *                             no snapshot / disabled   nothing is opened, nothing runs;
 *                             enabled                  `openSession` (row 115), then the runner is
 *                                                      stepped as the tap grows (`final: false`).
 *   end(sessionId, how)     the capture session, ON EVERY EXIT PATH of a capture:
 *                             `recorded: true`    a stop or an interrupted recording: the tap is
 *                                                 whole now, the runner is stepped to its end
 *                                                 (`final: true`) in the background, then closed;
 *                             `recorded: false`   a failed start: nothing was recorded; the session
 *                                                 is closed and nothing more runs for it.
 *   availability / assemble / closeOut / locate
 *                           the seal's transcript step (`sealing-host`). After a restart of the Core
 *                           the run of a session is not in memory: `availability` opens the session
 *                           again from its snapshot and its checkpoint (row 115's resume rule) and
 *                           finishes it, so a RECOVERY seal reads the same seam.
 *
 * NOTHING HERE IS ON THE PATH OF A SESSION START OR A STOP: `begin` and `end` never throw and never
 * wait for an engine; what goes wrong is written to the log and the persistent error log with a
 * code and the session ID. The transcriber's own entries (blanked, codes only) stay the
 * transcriber log's.
 *
 * WHAT IS STATED ONLY WHERE IT HAS A SOURCE (never made up):
 *   model provenance   manifest fields 84 to 87 (name, version, quantisation, SHA-256 of the model).
 *                      A PORT here (`modelProvenance`); the mount's default is the production
 *                      provider (`model-provenance.ts`, integration passes D8 / D9: which member
 *                      comes from where; for a SERVER backend the name and three nulls, D160). A session for which one member has no source is transcribed
 *                      while it records (its chunk rows are real) but NO DOCUMENT is assembled for
 *                      it: `availability` answers UNAVAILABLE with the provider's code (which
 *                      member, why), or `MODEL_PROVENANCE_UNKNOWN` for a port that gives no
 *                      reason, and the seal records the declared absence at once - it never waits
 *                      for a transcript that cannot be assembled.
 *   speaker engine     the embedding engine of the diarization post-pass: a PORT, default null
 *                      (speaker labels UNAVAILABLE with the transcriber's own reason, D90).
 *
 * No figure of how long anything took is kept or written anywhere (D230).
 */
import { join } from 'node:path';
import {
  TRANSCRIPT_DOCUMENT_FILE,
  TRANSCRIPT_SRT_FILE,
  TRANSCRIPT_VTT_FILE,
  TranscriberError,
  assembleTranscript,
  createCheckpointStore,
  type DocumentInterval,
  type SpeakerEmbeddingEngine,
  type TranscriberLog,
  type TranscriptModelProvenance,
  type TranscriptSealRecord,
} from '@dems/transcriber';
import { ModelProvenanceCode, isProvenanceUnknown, provenanceFitsBackend, type ModelProvenanceAnswer } from './model-provenance';
import type { EnabledSessionTranscription, SessionTranscription } from './session';

/** How often the runner of a recording session is stepped while the tap grows. A bound, never a measurement. */
export const SESSION_RUN_STEP_INTERVAL_MS = 5_000;

export const SessionRunCode = {
  /** Fields 84 to 87 are not known for this session and the port gave no reason: no document can be assembled. */
  MODEL_PROVENANCE_UNKNOWN: 'MODEL_PROVENANCE_UNKNOWN',
  /** A step of the runner threw: the run stops; the seal closes the transcript out at its bound. */
  STEP_FAILED: 'TRANSCRIBER_STEP_FAILED',
  /** `openSession` itself threw (a defect: it answers UNAVAILABLE for every reason of the configuration). */
  OPEN_FAILED: 'TRANSCRIBER_OPEN_FAILED',
  OPENED: 'TRANSCRIBER_SESSION_OPENED',
  CLOSED: 'TRANSCRIBER_SESSION_CLOSED',
  NOT_OPENED: 'TRANSCRIBER_SESSION_NOT_OPENED',
} as const;

/** What the seal is told about the transcript of a session before it asks for it. */
export type SessionTranscriptAvailability =
  /** The session took no snapshot: no transcriber ever ran for it. */
  | { readonly kind: 'NO_SNAPSHOT' }
  /** The snapshot disables STT: a declared absence. */
  | { readonly kind: 'DISABLED' }
  /** The snapshot enables STT and no transcript can be had: `code` says why. Nothing is waited for. */
  | { readonly kind: 'UNAVAILABLE'; readonly code: string }
  /** A transcriber session exists: `assemble` / `closeOut` answer for it. */
  | { readonly kind: 'AVAILABLE' };

export interface SessionTranscriptFiles {
  readonly json: string;
  readonly srt: string;
  readonly vtt: string;
}

/** The answer of the seal's two questions: member for member `AssembledTranscriptAnswer` of the sealing unit. */
export type SessionTranscriptAnswer = { readonly kind: 'NOT_READY' } | { readonly kind: 'ASSEMBLED'; readonly record: TranscriptSealRecord; readonly files: SessionTranscriptFiles; readonly failedChunkCodes: readonly string[] };

export type SessionRunPhase =
  /** `begin` is opening the session. */
  | 'OPENING'
  /** Stepped as the tap grows. */
  | 'RUNNING'
  /** The capture ended: stepped with `final: true` until the plan is complete. */
  | 'FINISHING'
  /** The plan is complete: every chunk is DONE or FAILED. */
  | 'COMPLETE'
  /** A step threw; nothing more is stepped. */
  | 'FAILED'
  /** The seal closed the transcript out. */
  | 'CLOSED_OUT'
  /** A failed start: nothing was recorded, nothing runs. */
  | 'ABANDONED'
  /** Nothing was opened: no snapshot, disabled, or the transcriber could not be built. */
  | 'NOT_OPENED';

export interface SessionRunStatus {
  readonly sessionId: string;
  readonly phase: SessionRunPhase;
  /** What `openSession` answered: `ENABLED`, `DISABLED`, `NO_SNAPSHOT`, `UNAVAILABLE`; null while opening. */
  readonly opened: SessionTranscription['state'] | null;
  /** Why nothing can be assembled, or null. */
  readonly code: string | null;
  /** True once `close()` of the session was called (its telemetry subscription is ended). */
  readonly closed: boolean;
}

export interface SessionRunDeps {
  open(sessionId: string): Promise<SessionTranscription>;
  scratchDirFor(sessionId: string): string;
  /** Fields 84 to 87 for the session; or why one of them has no source (a code); or null: not known, no reason. */
  modelProvenance(session: EnabledSessionTranscription): Promise<ModelProvenanceAnswer>;
  /** The speaker embedding engine of this Core, or null: none. */
  speakerEngine(session: EnabledSessionTranscription): SpeakerEmbeddingEngine | null;
  /** The rows of `session_audio_intervals` of the session, in media time. */
  intervals(sessionId: string): Promise<readonly DocumentInterval[]>;
  /** The transcriber's own log: what the assembly writes to. */
  readonly transcriberLog: TranscriberLog;
  /** The server's log and persistent error log, by code. */
  report(level: 'info' | 'warn' | 'error', code: string, message: string, sessionId: string, more?: Readonly<Record<string, string | number | boolean | null>>, error?: unknown): void;
  /** `fire` once after `ms`, unless the returned function was called first. */
  readonly timer: { after(ms: number, fire: () => void): () => void };
  readonly stepIntervalMs?: number;
}

export interface SessionRuns {
  /** CAPTURE START. Never throws, never waits for an engine. */
  begin(sessionId: string): Promise<SessionRunStatus>;
  /** CAPTURE END, on every exit path. Returns at once. Does nothing for a session that has no run. */
  end(sessionId: string, how: { readonly recorded: boolean }): void;
  status(sessionId: string): SessionRunStatus | null;
  /** THE SEAL, first: what can be had. Opens the session again when its run is not in memory (a restart). Never throws. */
  availability(sessionId: string): Promise<SessionTranscriptAvailability>;
  /** THE SEAL: the assembled transcript, or `NOT_READY` while a chunk is still to decode. Throws for any other failure. */
  assemble(sessionId: string): Promise<SessionTranscriptAnswer>;
  /** THE SEAL STOPS WAITING: every chunk that is not committed is given up, then the assembly. */
  closeOut(sessionId: string, chunkCode: string): Promise<SessionTranscriptAnswer>;
  /** Where the three files of the session are. Computes and starts nothing. */
  locate(sessionId: string): SessionTranscriptFiles;
  /** Resolves when no step of any run is under way and no run waits to be stepped to its end. */
  idle(): Promise<void>;
  /** Ends every run: no step is started any more and every open session is closed. For a shutdown. */
  shutdown(): void;
}

interface Run {
  readonly sessionId: string;
  phase: SessionRunPhase;
  opened: SessionTranscription['state'] | null;
  session: EnabledSessionTranscription | null;
  provenance: TranscriptModelProvenance | null;
  /** Why `provenance` is null for an opened session. Kept apart from `code`, which a failed step overwrites. */
  provenanceCode: string | null;
  code: string | null;
  closed: boolean;
  /** Set by `end`: the capture is over; `recorded` says whether a tap exists. */
  ended: { readonly recorded: boolean } | null;
  /** The loop of this run, when one is under way. */
  loop: Promise<void> | null;
  /** Cancels the wait between two steps. */
  wake: (() => void) | null;
  opening: Promise<void> | null;
}

export function createSessionRuns(deps: SessionRunDeps): SessionRuns {
  const runs = new Map<string, Run>();
  const interval = deps.stepIntervalMs ?? SESSION_RUN_STEP_INTERVAL_MS;
  let down = false;

  const statusOf = (run: Run): SessionRunStatus => ({ sessionId: run.sessionId, phase: run.phase, opened: run.opened, code: run.code, closed: run.closed });
  const filesOf = (sessionId: string): SessionTranscriptFiles => {
    const dir = deps.scratchDirFor(sessionId);
    return { json: join(dir, TRANSCRIPT_DOCUMENT_FILE), srt: join(dir, TRANSCRIPT_SRT_FILE), vtt: join(dir, TRANSCRIPT_VTT_FILE) };
  };

  function close(run: Run): void {
    if (run.closed || run.session === null) return;
    run.closed = true;
    try {
      run.session.close();
    } catch (error) {
      deps.report('error', SessionRunCode.STEP_FAILED, 'the transcriber session could not be closed', run.sessionId, {}, error);
    }
    deps.report('info', SessionRunCode.CLOSED, 'the transcriber session of the recording was closed', run.sessionId, { phase: run.phase });
  }

  /** Waits one interval, or until `wake` is called. */
  const pause = (run: Run): Promise<void> =>
    new Promise<void>((resolve) => {
      const cancel = deps.timer.after(interval, () => {
        run.wake = null;
        resolve();
      });
      run.wake = () => {
        cancel();
        run.wake = null;
        resolve();
      };
    });

  /** The one loop of a run: steps while the capture records, then to the end of the plan, then closes. */
  async function loop(run: Run): Promise<void> {
    const session = run.session;
    if (session === null) return;
    try {
      for (;;) {
        if (down || run.phase === 'CLOSED_OUT' || run.phase === 'ABANDONED') return;
        const final = run.ended !== null;
        if (final) run.phase = 'FINISHING';
        const report = await session.step({ final });
        // The seal closed the transcript out, or the capture failed, while this step ran: its answer changes nothing.
        if (down || (run.phase as SessionRunPhase) === 'CLOSED_OUT' || (run.phase as SessionRunPhase) === 'ABANDONED') return;
        if (final && report.complete) {
          run.phase = 'COMPLETE';
          return;
        }
        // The capture ended while the step ran: the next step is the final one, at once.
        if (!final && run.ended !== null) continue;
        await pause(run);
      }
    } catch (error) {
      if (run.phase !== 'CLOSED_OUT' && run.phase !== 'ABANDONED') run.phase = 'FAILED';
      run.code = error instanceof TranscriberError ? error.code : SessionRunCode.STEP_FAILED;
      deps.report('error', SessionRunCode.STEP_FAILED, 'a step of the transcriber session failed; nothing more is transcribed for the session and the seal records what is committed', run.sessionId, { cause: run.code }, error);
    } finally {
      // The runner is not stepped again by this loop: its telemetry subscription is ended. The checkpoint and the files stay.
      if (run.phase !== 'RUNNING') close(run);
    }
  }

  async function open(run: Run): Promise<void> {
    let answer: SessionTranscription;
    try {
      answer = await deps.open(run.sessionId);
    } catch (error) {
      run.phase = 'NOT_OPENED';
      run.opened = 'UNAVAILABLE';
      run.code = SessionRunCode.OPEN_FAILED;
      deps.report('error', SessionRunCode.OPEN_FAILED, 'the transcriber session of the recording could not be opened; the session is not transcribed', run.sessionId, {}, error);
      return;
    }
    run.opened = answer.state;
    if (answer.state !== 'ENABLED') {
      run.phase = 'NOT_OPENED';
      run.code = answer.state === 'UNAVAILABLE' ? answer.code : null;
      // DISABLED is the configuration's choice and is said at level info; the two others are faults of this Core.
      deps.report(answer.state === 'DISABLED' ? 'info' : 'error', SessionRunCode.NOT_OPENED, 'no transcriber session runs for the recording', run.sessionId, { state: answer.state, cause: run.code });
      return;
    }
    run.session = answer;
    let cause: string = SessionRunCode.MODEL_PROVENANCE_UNKNOWN;
    try {
      const stated = await deps.modelProvenance(answer);
      if (isProvenanceUnknown(stated)) cause = stated.unknown;
      // D160: what a provider states is held against the session's backend. A version, a quantisation or
      // a file hash for a server session is a value nobody verified; a missing one for `cpu-local` is a gap.
      else if (stated !== null && !provenanceFitsBackend(answer.snapshot.backend, stated)) cause = ModelProvenanceCode.NOT_FOR_BACKEND;
      else run.provenance = stated;
    } catch (error) {
      run.provenance = null;
      deps.report('error', SessionRunCode.MODEL_PROVENANCE_UNKNOWN, 'the provenance of the STT model could not be read', run.sessionId, {}, error);
    }
    if (run.provenance === null) {
      run.provenanceCode = cause;
      run.code = cause;
      deps.report('error', cause, 'the provenance of the STT model of the session cannot be stated by this Core (manifest fields 84 to 87): the session is transcribed while it records, and no transcript document can be sealed for it', run.sessionId, { backend: answer.snapshot.backend });
    }
    deps.report('info', SessionRunCode.OPENED, 'the transcriber session of the recording was opened', run.sessionId, { backend: answer.snapshot.backend, checkpointsMovedAside: answer.checkpointsMovedAside });
    // A capture that ended while the session was being opened: a failed start runs nothing.
    const ended = run.ended as Run['ended'];
    if (ended !== null && !ended.recorded) {
      run.phase = 'ABANDONED';
      close(run);
      return;
    }
    run.phase = 'RUNNING';
    run.loop = loop(run);
  }

  function runOf(sessionId: string): Run {
    const run: Run = { sessionId, phase: 'OPENING', opened: null, session: null, provenance: null, provenanceCode: null, code: null, closed: false, ended: null, loop: null, wake: null, opening: null };
    runs.set(sessionId, run);
    run.opening = open(run).finally(() => {
      run.opening = null;
    });
    return run;
  }

  async function assembled(run: Run): Promise<SessionTranscriptAnswer> {
    const session = run.session;
    if (session === null || run.provenance === null) return { kind: 'NOT_READY' };
    const intervals = await deps.intervals(run.sessionId);
    try {
      const result = await assembleTranscript({
        sessionScratchDir: session.scratchDir,
        identity: session.assembly.identity,
        source: session.assembly.source,
        diarization: { enabled: session.snapshot.diarization, engine: deps.speakerEngine(session) },
        model: run.provenance,
        intervals,
        log: deps.transcriberLog,
      });
      const checkpoint = createCheckpointStore(session.scratchDir).load(session.assembly.identity);
      const failedChunkCodes = (checkpoint?.chunks ?? []).filter((chunk) => chunk.status === 'FAILED').map((chunk) => chunk.errorCode ?? 'UNKNOWN');
      return { kind: 'ASSEMBLED', record: result.record, files: result.files, failedChunkCodes };
    } catch (error) {
      // An unfinished transcript is never assembled as if it were complete: the seal waits, within its bound.
      if (error instanceof TranscriberError && error.code === 'ASSEMBLY_REFUSED' && (error.detail['reason'] === 'TRANSCRIPT_NOT_COMPLETE' || error.detail['reason'] === 'NO_CHECKPOINT')) return { kind: 'NOT_READY' };
      throw error;
    }
  }

  return {
    async begin(sessionId) {
      const known = runs.get(sessionId);
      const run = known ?? runOf(sessionId);
      await run.opening;
      return statusOf(run);
    },

    end(sessionId, how) {
      const run = runs.get(sessionId);
      if (run === undefined || run.ended !== null) return;
      run.ended = how;
      if (!how.recorded) {
        // A FAILED START: nothing was recorded. Whatever step is under way ends by itself; no other is started.
        if (run.phase === 'RUNNING') run.phase = 'ABANDONED';
        run.wake?.();
        if (run.opening === null) close(run);
        return;
      }
      // The tap is whole: the loop takes its final steps now.
      run.wake?.();
    },

    status(sessionId) {
      const run = runs.get(sessionId);
      return run === undefined ? null : statusOf(run);
    },

    async availability(sessionId) {
      let run = runs.get(sessionId);
      if (run === undefined) {
        // A RESTART: the session is opened again from its snapshot and its checkpoint, and its
        // capture is over (the worker of a session never outlives the Core that recorded it).
        run = runOf(sessionId);
        run.ended = { recorded: true };
      }
      await run.opening;
      if (run.opened === 'NO_SNAPSHOT') return { kind: 'NO_SNAPSHOT' };
      if (run.opened === 'DISABLED') return { kind: 'DISABLED' };
      if (run.session === null) return { kind: 'UNAVAILABLE', code: run.code ?? SessionRunCode.OPEN_FAILED };
      if (run.phase === 'ABANDONED') return { kind: 'UNAVAILABLE', code: 'NOTHING_RECORDED' };
      if (run.provenance === null) return { kind: 'UNAVAILABLE', code: run.provenanceCode ?? SessionRunCode.MODEL_PROVENANCE_UNKNOWN };
      // A seal is only asked for a capture that ended: the run takes its final steps if it did not yet.
      if (run.ended === null) {
        run.ended = { recorded: true };
        run.wake?.();
      }
      return { kind: 'AVAILABLE' };
    },

    async assemble(sessionId) {
      const run = runs.get(sessionId);
      if (run === undefined) return { kind: 'NOT_READY' };
      return assembled(run);
    },

    async closeOut(sessionId, chunkCode) {
      const run = runs.get(sessionId);
      if (run === undefined || run.session === null) return { kind: 'NOT_READY' };
      // The session's own runner is stepped no more: whatever its engine answers from here on is dropped by its loop.
      run.phase = 'CLOSED_OUT';
      run.wake?.();
      close(run);
      if (!(await run.session.closeOut(chunkCode))) return { kind: 'NOT_READY' };
      return assembled(run);
    },

    locate: filesOf,

    async idle() {
      for (;;) {
        const busy = [...runs.values()].flatMap((run) => [run.opening, run.phase === 'FINISHING' || (run.phase === 'RUNNING' && run.ended !== null) ? run.loop : null]).filter((work): work is Promise<void> => work !== null);
        if (busy.length === 0) return;
        await Promise.allSettled(busy);
      }
    },

    shutdown() {
      down = true;
      for (const run of runs.values()) {
        run.wake?.();
        close(run);
      }
    },
  };
}
