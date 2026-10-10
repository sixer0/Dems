/**
 * The types of the engine host (plan row W26). Types only; `index.ts` re-exports them, and that
 * is where other units import from.
 */
import type { AudioSlice, AuditRow, CaptureTelemetryInput, CaptureWarningInput, SimEvent, TabletLinkState } from '@dems/shared/sim';
import type { UnitContext } from '../core';
import type { DurableSliceKey, DurableSlices } from '../db/mapping';
import type { Principal } from '../plugins/authenticate';
import type { HostedActionArguments, HostedActionName, HostedActionResult } from './hosted-actions';

// ── What the engine hands to `app.publish` ─────────────────────────────────────────────────────

/**
 * One operation of a state change, in the shape of the realtime contract's `DeltaOp` (spec §9.3
 * RT-3; `@dems/shared/api`, `DeltaOpSchema`): `replace` one whole slice, or `append` rows to
 * `audit` or `events`. Values are the engine's own slices BY REFERENCE: nothing is copied, so a
 * receiver must not change them.
 */
export type EngineDeltaOp =
  | { readonly [Key in DurableSliceKey]: { readonly op: 'replace'; readonly slice: Key; readonly value: DurableSlices[Key] } }[DurableSliceKey]
  | {
      readonly op: 'append';
      readonly slice: 'audit';
      readonly rows: readonly AuditRow[];
      readonly head: string;
      readonly total: number;
      readonly dropped: number;
    }
  | { readonly op: 'append'; readonly slice: 'events'; readonly rows: readonly SimEvent[] };

/** What caused a state change. For the delta pacing of the realtime channel (RT-P11). */
export type EngineChangeCause =
  /** A start, a reset or a reload: a NEW EPOCH. `revision` is 0 and `ops` is empty: send a `snapshot`. */
  | 'start'
  /** A hosted command (or a unit a module ran through `engine.run`). */
  | 'command'
  /** An engine tick: the 1 Hz steps and the engine's own records. */
  | 'tick'
  /** Rows a server-native unit appended to the trail (a sign-in, a denial, a pairing). */
  | 'native'
  /** The operators table changed and was mirrored into the engine (ENG-3). */
  | 'operators'
  /** The last write of a stop. */
  | 'stop';

/** One committed change of the replicated state: the source of a `delta` (spec §9.3). */
export interface EngineStateChange {
  readonly epoch: number;
  /** Exactly the previous revision plus 1 within the epoch (RT-2); 0 for `cause: 'start'`. */
  readonly revision: number;
  /** The server clock at the commit: `serverTime` of the delta. */
  readonly at: number;
  readonly cause: EngineChangeCause;
  /**
   * True when a record changed (a class S slice), false when only snapshot slices did (RT-P11).
   * A change with `records: true` also holds every snapshot slice that changed with the record:
   * what a unit commits is one cut of the whole state (finding F71, decision D104).
   */
  readonly records: boolean;
  /** Applied in order. Empty only for `cause: 'start'`. */
  readonly ops: readonly EngineDeltaOp[];
}

/** One 20 Hz meter frame; never stored (spec §8.7). `audio` is the engine's slice by reference. */
export interface EngineMeterFrame {
  readonly at: number;
  /** Counts the frames the engine produced in this process, from 1. */
  readonly seq: number;
  readonly audio: AudioSlice;
}

// ── The host ───────────────────────────────────────────────────────────────────────────────────

/** What `endCapture` did to the session (blueprint row 71). */
export type CaptureEndOutcome = 'FAILED_START' | 'INTERRUPTED' | 'IGNORED';

/**
 * How a start treats the stored state (spec §8.6, §12.4; database contract §7.4, §8.5 R-9):
 *
 *   `boot`    the process started. The epoch is the stored one plus 1. A session that was in
 *             flight when the process stopped is moved to FAULT at the last committed instant;
 *             the tablet link is OFFLINE.
 *   `reset`   the reset routine rebuilt the database and already wrote the new epoch: it is
 *             adopted as stored. The session is not touched (a scenario may be RECORDING).
 *   `resync`  the engine reloads what the tables hold after its chain head diverged, or after
 *             a reset that failed. The epoch is the stored one plus 1, so every client asks for
 *             a snapshot. The session is not touched.
 *
 * EVERY mode builds the engine's ring again from the table and raises the floor of the server
 * clock to the newest stored instant (decision D110). So in every mode a stored `AUDIT_TAMPER`
 * fault is cleared, with its alert and one `FAULT_CLEARED` row: the overlay it stood for is gone
 * (finding F73, decision D106).
 *
 * THE TABLET LINK is a fact of the open sockets, not of the stored rows (spec §6.8). At the
 * first start of a process no socket is open: `boot` writes the link OFFLINE, with its row when
 * the stored value was CONNECTED (§8.6); `reset` and `resync` leave the stored value. At every
 * later start of the same process, in every mode, the engine begins with the link it held when
 * it stopped, and writes no row for that (§12.4 "Recomputed from the open sockets"): the first
 * snapshot of the new epoch already says what is true (finding F78, decision D119).
 */
export type EngineStartMode = 'boot' | 'reset' | 'resync';

/** What a unit of the host answers with: the value, and the state position of spec API-7. */
export interface EngineOutcome<Value> {
  readonly value: Value;
  /** For the header `x-dems-epoch`. */
  readonly epoch: number;
  /**
   * For the header `x-dems-revision`: the revision of the change that holds the unit's effect,
   * or the current revision when nothing replicated changed (API-7, RT-5).
   */
  readonly revision: number;
}

/**
 * The tools of one unit that a module runs through `engine.run`: hosted actions and the module's
 * own rows, committed together or not at all.
 */
export interface EngineUnit {
  /**
   * The unit of work of the core pipeline. Server-native rows go through `unit.audit.append`
   * and `unit.events.append`, the module's own statements through `unit.db` or `unit.query`.
   * `unit.afterCommit` is for the module's own publications.
   */
  readonly unit: UnitContext;
  /**
   * Runs one hosted action as `principal` and writes its effect through this unit. Resolves
   * with what the simulator returned (a refusal in a result type included: it may have written
   * an audit row). Throws the mapped `ApiFailure` when the simulator refused by throwing.
   */
  command<Action extends HostedActionName>(
    principal: Principal,
    action: Action,
    ...args: HostedActionArguments<Action>
  ): Promise<HostedActionResult<Action>>;
  /**
   * The engine's state INSIDE the unit: it holds what this unit did and is not committed yet.
   * For a decision inside the unit only; never the source of an answer.
   */
  pending(): DurableSlices;
}

/** Counters of the host, for the health of the process, the tests and the measurements. */
export interface EngineStats {
  readonly phase: 'stopped' | 'starting' | 'running' | 'stopping';
  /** Ticks that ran, with or without a write. */
  readonly ticks: number;
  /** Ticks that sent at least one statement. */
  readonly ticksWritten: number;
  /** Timer calls that submitted nothing because a tick was still queued or running (ENG-1). */
  readonly ticksSkipped: number;
  /** Ticks whose unit was not committed. The engine's state was set back each time (ENG-5). */
  readonly ticksFailed: number;
  /** True while ticks are suspended after a write that failed. */
  readonly suspended: boolean;
  /** Probes sent while suspended. */
  readonly probes: number;
  readonly commands: number;
  /** Commands the simulator refused by throwing. */
  readonly commandsRefused: number;
  /** State changes handed to `app.publish`. */
  readonly publications: number;
  readonly meterFrames: number;
  /** Rows of server-native units taken into the ring. */
  readonly nativeRowsMerged: number;
  readonly healthSnapshots: number;
  /** Reloads after a diverged chain head. */
  readonly resyncs: number;
  /** What the simulator's subsystems reported as caught errors. */
  readonly simErrors: number;
}

/**
 * The seam `app.engine` (P25): the shared simulator core, hosted headless, with PostgreSQL as
 * its store (spec §8). One per server process.
 */
export interface EngineHost {
  /** The stored epoch plus 1 at every process start (spec §8.6); 0 while the host never started. */
  readonly epoch: number;
  /** Revision of the newest committed state change; a POST answer carries it (API-7). */
  readonly revision: number;
  /** True between a start that ended well and the next stop. */
  readonly running: boolean;

  /**
   * ONE hosted action as one unit of work: the actor scope for exactly this call, the action,
   * the scope cleared in a `finally`, the durable differences and the engine's audit rows and
   * events written in one transaction, the commit, the publication. Resolves after the commit.
   *
   * Rejects with the mapped `ApiFailure` (`details.simCode`) when the simulator refused by
   * throwing, with 503 `NOT_READY` when the unit could not be run or committed (nothing is
   * stored and the engine's state is set back), with 401 `NOT_SIGNED_IN` for a principal that
   * is not an operator.
   */
  command<Action extends HostedActionName>(
    principal: Principal,
    action: Action,
    ...args: HostedActionArguments<Action>
  ): Promise<EngineOutcome<HostedActionResult<Action>>>;

  /**
   * One unit in which hosted actions and server-native rows commit together. `label` is a name
   * chosen in the code, as for `app.pipeline.run`. The host owns the unit: it must NOT be called
   * from inside another unit (`PIPELINE_REENTRANT`).
   */
  run<Value>(label: string, work: (scope: EngineUnit) => Promise<Value> | Value): Promise<EngineOutcome<Value>>;

  /**
   * The server sets the tablet link from real connections (spec §6.8, X-2): the hosted
   * `setTabletLink` with no actor. Writes `TABLET_LINK_CHANGED` when the state changes.
   */
  setTabletLink(state: TabletLinkState): Promise<EngineOutcome<void>>;

  /**
   * One TELEMETRY frame of the capture worker (task 3, register SH-18 / CS-04; `capture-spec
   * §B.1`): the INTERNAL `applyCaptureTelemetry` with no actor. The worker sends about 20 a second,
   * so the host looks before it opens a unit:
   *
   *   - a frame that changes no stored slice (the usual one: levels, and ingest states the state
   *     already holds) runs NO unit. The levels go to the meters, which the next tick publishes;
   *     no statement is sent and the revision does not move. Resolves at once with the current
   *     position;
   *   - a frame that changes `captureDevices` or `captureConfig` is one unit, committed and
   *     published like `setTabletLink`. While such a unit waits for its turn, later frames join it
   *     (the newest frame is the one applied) and resolve with its outcome: at most one telemetry
   *     unit is ever queued.
   *
   * An ID or role of the frame that the Core does not know is ignored, and the host says so ONCE
   * per engine run and value: a warn line and an error-log entry (`context.ignored`).
   *
   * Writes no audit row and no event. Rejects with 503 `NOT_READY` when the engine is not running
   * or the unit was not committed.
   */
  applyCaptureTelemetry(telemetry: CaptureTelemetryInput): Promise<EngineOutcome<void>>;

  /**
   * A warning of the capture layer (register SH-18; `capture-spec §E.1`): the INTERNAL
   * `raiseCaptureWarning` with no actor, one unit. Writes the alert, the FAULT_RAISED audit row
   * and the event of the fault `MIC_SILENT` or `CAPTURE_FAULT`; while that fault is active for the
   * same subject it writes no statement and the revision does not move. It NEVER switches the
   * audio source (OD-11). Rejects with the simulator's `SimNotFoundError` for a subject the Core
   * does not know (nothing is stored; the failure is in the error log), and with 503 `NOT_READY`
   * as above.
   */
  raiseCaptureWarning(warning: CaptureWarningInput): Promise<EngineOutcome<void>>;

  /**
   * The condition of a capture warning is over (register SH-18; decision D72, finding A-2): the
   * INTERNAL `clearCaptureWarning` with no actor, one unit. Clears that fault as operation 74 does
   * (alert resolved, FAULT_CLEARED audit row and event) but is reachable from the capture side
   * only; operation 74 stays the demo control. When that fault is not active it writes no
   * statement and the revision does not move. A later `raiseCaptureWarning` for the same subject
   * is a NEW fault. Rejects as `raiseCaptureWarning` does.
   */
  clearCaptureWarning(warning: CaptureWarningInput): Promise<EngineOutcome<void>>;

  /**
   * Mirrors the operators table into the engine and publishes the slice when it changed (ENG-3).
   * Call it after the unit that changed an operator has committed. Every command does the same
   * before its action, so this is only for the publication.
   */
  mirrorOperators(): Promise<EngineOutcome<boolean>>;

  /**
   * The COMMITTED replicated state: the 28 slices as the tables hold them and as the published
   * changes sum up to, at `revision`. By reference; a reader must not change it. No transaction,
   * no pipeline. Throws 503 `NOT_READY` while the host is not running.
   */
  state(): DurableSlices;
  /** One slice of `state()`. */
  slice<Key extends DurableSliceKey>(name: Key): DurableSlices[Key];

  /**
   * The newest meter frame the engine produced in this start: what it last handed to
   * `app.publish` as `{ kind: 'meters' }`, the SAME object. Null before the first tick of this
   * start. Never stored (spec §8.7); by reference: a reader must not change it. Throws 503
   * `NOT_READY` while the host is not running, as `state()` does (decision D89, finding F66;
   * required since decision D122).
   */
  meters(): EngineMeterFrame | null;

  /**
   * Rehydrates from PostgreSQL and starts the scheduler (see `EngineStartMode`). The boot step
   * calls it with `boot`: the entry of a PROCESS start. Rejects, and stays stopped, when the
   * stored state cannot be read or is rejected.
   */
  start(mode: EngineStartMode): Promise<void>;
  /**
   * The entry for the caller of a reset or a scenario load (`start('reset')`): rehydrates from
   * the database the reset routine built, on the pool the caller reopened, and takes the stored
   * epoch AS IT IS. The routine has already written the previous epoch plus 1 (AC-B-57 "by
   * exactly 1"); no second 1 is added, no restart fault is applied, and the ring is rebuilt from
   * the stored head and the stored event counter.
   */
  reload(): Promise<void>;
  /**
   * Stops the scheduler, lets the engine's queued unit end, writes what is not written yet (the
   * hardware snapshot) in a last unit and refuses commands from then on. Idempotent, and not
   * tied to closing the app: nothing of the engine is scheduled or queued when it resolves, so
   * the caller of a reset may close the pool right after it.
   */
  stop(): Promise<void>;

  stats(): EngineStats;
}

/**
 * The doors of the capture of a REAL recording (blueprint row 71; `capture-session.ts`). The host
 * of `src/engine` offers them beside the seam; they are reached with `captureDoorsOf(app.engine)`
 * and are NOT members of `EngineHost`: only the capture side calls them, in capture mode `real`,
 * and an object a test put behind the seam does not have to know them.
 */
export interface EngineCaptureDoors {
  /**
   * The first durable fragment of that session (the supervisor's `FIRST_DURABLE_FRAGMENT`): the
   * session payload says `captureDurable: true`, one unit. From then on the clients present
   * 'recording' (decisions D84, D91 R-1 option A). Resolves false, and writes nothing, when that
   * session is not the open RECORDING session or says so already. No audit row.
   */
  markCaptureDurable(sessionId: string): Promise<EngineOutcome<boolean>>;

  /**
   * The capture of that session ended for good while the session is RECORDING (the supervisor's
   * `FAULTED`, or a start that was refused), one unit:
   *
   *   `durable: false`   a FAILED START - FAULT, `startedAt` null again, 0 bytes: the recovery of
   *                      that session makes no evidence item (`FAILED_START`);
   *   `durable: true`    an INTERRUPTED recording - FAULT with the bytes so far; the sealing row
   *                      seals what is on the disk (`INTERRUPTED`).
   *
   * A session that already says `captureDurable: true` is never turned into a failed start,
   * whatever the caller says: `INTERRUPTED`. `IGNORED` when that session is not the open RECORDING
   * session. The fault's audit row is the capture warning's (`raiseCaptureWarning`), not this call's.
   *
   * `cause` (row 71c): the code the capture ended with. A failed start writes it on the session's
   * fault row as `reason`, beside `evidenceFiles: 0` (C3 §5.3: `NO_CAMERA_CONNECTED`).
   */
  endCapture(sessionId: string, end: { readonly durable: boolean; readonly cause?: string | null }): Promise<EngineOutcome<CaptureEndOutcome>>;

  /**
   * Clears every active `MIC_SILENT` / `CAPTURE_FAULT`, each with its FAULT_CLEARED row, one unit
   * (decision D84 R-4): the capture side calls it when a session reaches RECORDING and at boot, so
   * a fault that outlived its worker (a Core restart) does not stay raised and its next occurrence
   * is a new fault. Resolves with how many were cleared; 0 writes nothing.
   */
  clearCaptureFaults(): Promise<EngineOutcome<number>>;
}

/**
 * The doors of the seal of a REAL recording (blueprint row 82; register SH-18, CS-04). Like the
 * capture doors they stand beside the seam and are NOT members of `EngineHost`: only the sealing
 * pipeline and the real verification call them. Reached with `sealDoorsOf(app.engine)`.
 */
export interface EngineSealDoors {
  /**
   * Where the Core's sealing pipeline stands (the INTERNAL `applySealingProgress`, no actor, one
   * unit): the step states of `sealing_jobs`, forward-only inside one attempt. The first call
   * moves the session to FINALIZING - from STOPPING, or from FAULT / RECOVERY for the interrupted
   * durable-prefix seal and for a seal resumed after a restart - and from then on no timed
   * transition of the simulator advances or seals it. A report that changes nothing sends no
   * statement. Rejects with the mapped refusal of the session machine (another session, a session
   * that cannot be sealed) and with 503 `NOT_READY` while the engine is not running.
   */
  applySealingProgress(input: import('@dems/shared/sim').SealingProgressInput): Promise<EngineOutcome<void>>;

  /**
   * FINALIZING -> SEALED with the item of the REAL package (the INTERNAL `completeSeal`, one
   * unit): the evidence item, the session history entry and the audit row EVIDENCE_SEALED. Called
   * by the sealing pipeline when its last step has made the package durable - the trigger is the
   * pipeline's own completion, never a progress value (decision D67). `also` runs in the same unit
   * AFTER the item's row is written (the row of `transcripts` hangs on it): when it rejects,
   * nothing of the seal commits.
   */
  completeSeal(input: import('@dems/shared/sim').CompleteSealInput, also?: (unit: UnitContext, evidenceId: string) => Promise<void>): Promise<EngineOutcome<{ readonly evidenceId: string }>>;

  /**
   * Records a verdict the Core computed for an item with a REAL package (the INTERNAL
   * `recordEvidenceVerification`; decision D107 (1)): the item's verification state, the custody
   * entry, and the audit row + event of the hosted `verify` with the same keys. Refused for every
   * other item: the hosted action computes its own verdict for those.
   */
  recordEvidenceVerification(verdict: import('@dems/shared/sim').EvidenceVerdictInput): Promise<EngineOutcome<void>>;
}
