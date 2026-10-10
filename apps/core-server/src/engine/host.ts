/**
 * The engine host (plan row W26; hand-built element HB-13, host half; spec §8; decisions D11
 * ADQ-1, D14, D28, D67; `21_core_services.md` §4.2; `20_db_mapping_seed.md` §4).
 *
 * One headless `Sim` of the shared simulator core per server process, with PostgreSQL as its
 * store. Everything that changes its state is ONE unit of the core's serial pipeline (ENG-1):
 *
 *   a command   the actor scope for exactly one hosted action, cleared in a `finally` (ENG-2);
 *               the durable differences, the engine's audit rows and its events written in the
 *               unit's one transaction (ENG-4); the commit; the publication; then the answer;
 *   a tick      `sim.tick()` at the server clock. A tick that changed nothing durable sends no
 *               statement and opens no transaction (94 % of the ticks of a recording). A tick
 *               that writes, writes every durable slice that changed (ONE CUT, below);
 *   a start     the stored rows read after the chain lock, validated, put into a fresh `Sim`,
 *               the epoch moved on and what a process start does to a session written, all in
 *               one unit (spec §8.6);
 *   a stop      what is not written yet (the hardware snapshot) written in a last unit.
 *
 * THE TWO STATES. The `Sim`'s store is the engine's working state; inside a unit it holds what
 * the unit did and is not committed yet. `committed` is what the tables hold and what the
 * published changes sum up to: the durable slices at the last commit, by reference. Reads of the
 * host come from `committed` only, so a reader never sees an uncommitted change, a rolled-back
 * one, or the actor of a command. When a unit is not committed, the store is set back to the
 * reference held before the unit (ENG-5); `committed` was never moved.
 *
 * ONE CUT (finding F71; decision D104). What a unit of the engine commits is the engine's whole
 * durable state at ONE instant: when it writes a record slice, it writes the snapshot slices that
 * changed with it, in the same transaction. `committed`, the tables and what the published
 * changes sum up to are therefore never a mix of two instants (records of now beside the
 * hardware of a second ago). The one thing that waits is a change of snapshot slices ALONE: a
 * tick writes it at most once in a second of the server clock, and until then `committed` is the
 * earlier cut, whole. Rows of a server-native unit are added to the cut as they are committed.
 *
 * ONE CHAIN. The engine keeps a ring of the trail; the tables keep every row. Rows that a
 * server-native unit appended are taken into the ring when that unit commits (`onCommit` of the
 * pipeline), so the engine's next row continues the stored head (AP-6). Before a unit of the
 * engine writes anything, the head the unit locked must be the head the engine holds. If it is
 * not, another writer exists or an earlier commit had an unknown outcome: nothing is stored, the
 * state is set back, the caller gets 503, and the host reloads from the database with a new
 * epoch.
 *
 * The log of this file holds unit numbers and labels, action names, codes, counts, slice names
 * and operator IDs. Never a slice, a row, a message or an argument of a command.
 */
import { isDeepStrictEqual } from 'node:util';
import { stampOf, PipelineFailure, PipelineRefusal, type Clock, type CommittedUnit, type Pipeline, type UnitContext } from '../core';
import {
  captureTelemetryChangesState,
  captureTelemetryIgnored,
  type CaptureLevelSource,
  type AudioSlice,
  type CaptureDeviceStatus,
  type CaptureTelemetryInput,
  type CaptureWarningInput,
  type RegisterCaptureDeviceInput,
  type Sim,
  type SimClock,
  type SimErrorReport,
  type SimState,
  type TabletLinkState,
} from '@dems/shared/sim';
// Seal block (blueprint row 82): the three pure transitions of the Core-driven seal.
import {
  applySealingProgressTransition,
  completeSealTransition,
  recordEvidenceVerificationTransition,
  type CompleteSealInput,
  type EvidenceVerdictInput,
  type SealingProgressInput,
} from '@dems/shared/sim';
import type { EngineSealDoors } from './types';
// Fact block (integration pass D6): the measured evidence volume (CS-09) and the head of a transcript's revisions.
import { applyStorageVolumeTransition, noteTranscriptRevisionTransition, type StorageVolumeInput, type TranscriptRevisionNote } from '@dems/shared/sim';
import { FACT_DOOR_LABEL, type EngineFactDoors } from './fact-doors';
// Source-fact block (integration pass D11): the class and the "is on" of the sources of a real capture operation.
import { applyCaptureSourceFactsTransition, type CaptureSourceFact } from '@dems/shared/sim';
import { asc } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import {
  SNAPSHOT_SLICE_KEYS,
  STORED_SLICE_KEYS,
  operatorFromRow,
  type DurableSliceKey,
  type DurableSlices,
} from '../db/mapping';
import { operators } from '../db/schema';
import { ApiFailure } from '../plugins/error-envelope';
import { describeError, type ErrorLog } from '../plugins/logger';
import type { Principal } from '../plugins/authenticate';
import type { Publication } from '../realtime';
import { withActorScope } from './actor-scope';
import { changedSlices, changesRecords, deltaOps } from './delta';
import { EngineError, engineNotReady, operatorRequired, simCodeOf, simRefusal } from './errors';
import { isHostedAction, type HostedActionArguments, type HostedActionName, type HostedActionResult } from './hosted-actions';
import { bindInternalActions } from './internal-actions';
import {
  CAPTURE_FAULT_KINDS,
  READ_SESSION_HAS_FRAGMENT,
  audioSourceSwitchTransition,
  captureConnectingTransition,
  captureDurableAtRehydrateTransition,
  captureDurableOfSessionTransition,
  clearCaptureFaultsTransition,
  failedCaptureStartTransition,
  interruptedCaptureTransition,
  type AudioSourceSwitch,
  type AudioSourceSwitched,
} from './capture-session';
import { createHeadlessSim, engineClock } from './headless-sim';
import {
  ENGINE_BOOT_STEP,
  ENGINE_TICK_MS,
  ENGINE_UNIT_LABEL,
  HEALTH_SNAPSHOT_INTERVAL_MS,
  RESYNC_RETRY_INTERVAL_MS,
  SNAPSHOT_MIN_INTERVAL_MS,
  SUSPENDED_PROBE_INTERVAL_MS,
} from './limits';
import {
  adoptStoredState,
  applyProcessStart,
  assertValidSlices,
  carryTabletLink,
  clearTamperOverlay,
  readStored,
  type RestartEffects,
  type TabletLink,
} from './rehydrate';
import { TrailMismatch, hasTrail, mergeTrail } from './ring';
import { createScheduler, type Scheduler } from './scheduler';
import { createSystemTimer, type EngineTimer } from './timer';
import type {
  CaptureEndOutcome,
  EngineCaptureDoors,
  EngineChangeCause,
  EngineHost,
  EngineMeterFrame,
  EngineOutcome,
  EngineStartMode,
  EngineStateChange,
  EngineStats,
  EngineUnit,
} from './types';
import { applyPlan, durableOf, planWrite } from './write-plan';

export interface EngineHostDependencies {
  /** The serial pipeline. A function: a test may put another one behind the seam. */
  readonly pipeline: () => Pipeline;
  /** The server clock (`app.clock`), followed through the seam. The engine's ONE time base (decision D110). */
  readonly clock: Clock;
  /**
   * Raises the floor of the SERVER clock: after the call, `clock.now()` is never below `instant`,
   * for the engine and for everything else that reads `app.clock`. Every start calls it with the
   * newest instant a stored row was written with, before it reads the time. False when the clock
   * behind the seam is behind `instant` and cannot take a floor: the start then stops.
   */
  readonly raiseClockFloor: (instant: number) => boolean;
  /** `app.publish`, read through the seam at each call. */
  readonly publish: (publication: Publication) => void;
  /** Sets `ready.engine` of the health answer. */
  readonly setReady: (ready: boolean) => void;
  readonly log: FastifyBaseLogger;
  readonly errorLog: ErrorLog;
  /** Default: the system timer. A test passes a manual one (`EngineControl.useTimer`). */
  readonly timer?: EngineTimer;
  /**
   * Told the position of every committed unit that a caller ran (a command, `run`, the mirror of
   * the operators; never a tick): the source of the two headers of API-7 for the request that
   * ran it (`api-headers.ts`).
   */
  readonly noteOutcome?: (position: { readonly epoch: number; readonly revision: number }) => void;
  /**
   * Where the meter levels come from (register CS-04; decision D72, finding A-4): `'external'`
   * in capture mode `real`, where the simulator must generate none. Default `'simulated'`.
   */
  readonly captureLevels?: CaptureLevelSource;
}

/**
 * What the host offers beside the seam, for tests and for the operator of the process. Reached
 * with `engineControl(app)`; a module never needs it.
 */
export interface EngineControl {
  /** Replaces the timer of the scheduler. Only while the host is stopped. */
  useTimer(timer: EngineTimer): void;
  /** The hosted `Sim`, or null while the host is stopped. Read it; never change it. */
  simulator(): Sim | null;
  /** One timer call, as the timer makes it. */
  fire(): void;
  /** Resolves when no tick and no probe of the scheduler is queued or running. */
  idle(): Promise<void>;
  /** Resolves when a reload that is under way has ended. */
  settled(): Promise<void>;
}

const CONTROL = Symbol('engine host of src/engine');

/** True for the host this folder builds: a test may have put another object behind the seam. */
export function isEngineControl(value: unknown): value is EngineHost & EngineControl & EngineCaptureDoors {
  return typeof value === 'object' && value !== null && CONTROL in value;
}

type Phase = EngineStats['phase'];

/** The hosted simulator of one start. A stop or a reload ends it; a new start builds another. */
interface Live {
  readonly sim: Sim;
  readonly clock: SimClock;
  readonly scheduler: Scheduler;
}

/** What a unit of the engine is: the cause of the change it publishes, or a probe, which changes nothing. */
type UnitKind = Exclude<EngineChangeCause, 'start' | 'native'> | 'probe';

/** A capture telemetry frame whose unit waits for its turn: later frames replace `telemetry`. */
interface TelemetrySlot {
  readonly live: Live;
  telemetry: CaptureTelemetryInput;
}

/** One unit of work of the engine. */
interface Scope {
  readonly unit: UnitContext;
  readonly live: Live;
  readonly cause: UnitKind;
  /** The store's state when the unit began: what a unit that is not committed puts back (ENG-5). */
  readonly before: SimState;
  /** What the tables held when the unit began. */
  readonly base: DurableSlices;
  /** What they hold inside the unit now. */
  flushed: DurableSlices;
  /** How many rows of `unit.audit.appended()` and `unit.events.appended()` the ring already holds. */
  seenAudit: number;
  seenEvents: number;
  /** True once the operators were mirrored in this unit (ENG-3). */
  mirrored: boolean;
  /** The instant the unit wrote the hardware snapshot at, if it did. */
  snapshotAt: number | null;
  /** True when the unit wrote the 60 s health snapshot. */
  intervalWritten: boolean;
  healthRows: number;
  /** True when the unit sent a statement of the write-through. */
  wrote: boolean;
  /** The instant of the unit's last write, or of its start. */
  at: number;
  /** The revision after the unit's commit, set when it settles. */
  revision: number | null;
}

/**
 * The second of the server clock an instant lies in. A tick that changed snapshot slices ONLY
 * writes them at most once per such second, so that write follows the simulator's own 1 Hz step
 * (which falls on whole seconds) in the same unit as the session's progress: one transaction a
 * second while recording.
 */
const snapshotSecond = (at: number): number => Math.floor(at / SNAPSHOT_MIN_INTERVAL_MS);

/** The two classes of durable slices: records (class S) and the hardware snapshot (class SN). */
const STORED_KEYS: readonly DurableSliceKey[] = STORED_SLICE_KEYS;
const SNAPSHOT_KEYS: readonly DurableSliceKey[] = SNAPSHOT_SLICE_KEYS;

const NO_EFFECTS: RestartEffects = { faultedFrom: null, tamperCleared: false, tabletLinkReset: false, tabletLinkCarried: false };

const codeOf = (error: unknown): string => {
  const description = describeError(error);
  return description.code ?? description.errorName;
};

/** The frames of a stack, without its first line: that line quotes the error's message. */
function framesOf(stack: string | undefined): string | undefined {
  const frames = (stack ?? '')
    .split('\n')
    .filter((line) => /^\s+at /.test(line))
    .join('\n');
  return frames === '' ? undefined : frames;
}

export function createEngineHost(dependencies: EngineHostDependencies): EngineHost & EngineControl & EngineCaptureDoors {
  const { log, errorLog } = dependencies;

  let timer: EngineTimer = dependencies.timer ?? createSystemTimer();
  let phase: Phase = 'stopped';
  let live: Live | null = null;
  let committed: DurableSlices | null = null;
  let epoch = 0;
  let revision = 0;
  let offCommit: (() => void) | null = null;
  let starting: Promise<void> | null = null;
  let stopping: Promise<void> | null = null;

  /** The last write of the hardware snapshot, on the engine clock. */
  let lastSnapshotAt = Number.NEGATIVE_INFINITY;
  let nextHealthAt = Number.POSITIVE_INFINITY;
  let meterSeq = 0;
  let lastAudio: AudioSlice | null = null;
  /** The newest meter frame of this start: the object that was published. Never stored (decision D89). */
  let lastFrame: EngineMeterFrame | null = null;
  // The one capture telemetry unit that waits for its turn, and what its callers were promised.
  let telemetrySlot: TelemetrySlot | null = null;
  let telemetryOutcome: Promise<EngineOutcome<void>> | null = null;
  /** What telemetry named that the Core does not know, said once per engine run (`noteIgnoredTelemetry`). */
  const ignoredTelemetry = new Set<string>();
  /**
   * The tablet link the engine had committed when it last ended a run in THIS process; null
   * while it never ran. It outlives a stop: the sockets of the process do (finding F78).
   */
  let heldLink: TabletLink | null = null;
  /** Source-fact block (pass D11): the list `applyCaptureSourceFacts` last took in THIS process; null while none was handed in. */
  let heldSourceFacts: readonly CaptureSourceFact[] | null = null;
  /** The outcome of an earlier commit is not known: the next unit compares the stored head first. */
  let suspect = false;
  /** A reload after a diverged head that is under way, and how to end its wait between two tries. */
  let reloading: Promise<void> | null = null;
  let reloadAbandoned = false;
  let endPause: (() => void) | null = null;
  /** The units of the engine that are queued or running. Their rows are in the ring already. */
  const ownUnits = new Set<number>();
  const reportedSources = new Set<string>();

  const counters = {
    ticksWritten: 0,
    commands: 0,
    commandsRefused: 0,
    publications: 0,
    meterFrames: 0,
    nativeRowsMerged: 0,
    healthSnapshots: 0,
    resyncs: 0,
    simErrors: 0,
  };

  function persist(level: 'error' | 'warn', message: string, error: unknown, context: Record<string, string | number | boolean | null>): void {
    errorLog.append({ level, source: 'engine.host', message, ...describeError(error), context });
  }

  // ── Publications ─────────────────────────────────────────────────────────────────────────────

  function publish(publication: Publication): void {
    try {
      dependencies.publish(publication);
    } catch (error) {
      // The seam promises not to throw. A commit is never undone by its publication.
      log.error({ code: codeOf(error), kind: publication.kind }, 'a publication of the engine failed');
      persist('error', 'a publication of the engine failed', error, { kind: publication.kind });
    }
  }

  function publishChange(cause: EngineChangeCause, at: number, ops: EngineStateChange['ops']): void {
    const change: EngineStateChange = { epoch, revision, at, cause, records: changesRecords(ops), ops };
    counters.publications += 1;
    publish({ kind: 'state', change });
  }

  function publishMeters(current: Live): void {
    const audio = current.sim.store.getState().audio;
    if (audio === lastAudio) return;
    lastAudio = audio;
    meterSeq += 1;
    counters.meterFrames += 1;
    const frame: EngineMeterFrame = { at: current.clock.now(), seq: meterSeq, audio };
    // Kept for `meters()` before it is handed on: a reader that the publication wakes sees it.
    lastFrame = frame;
    publish({ kind: 'meters', frame });
  }

  /**
   * `applyCaptureTelemetry` ignores an ID or a role the Core does not know (one bad entry must not
   * drop a 20 Hz frame). It is said here once per engine run and value, so a worker that speaks
   * the wrong vocabulary (a track ID where a capture-device ID belongs) is seen in the error log.
   */
  function noteIgnoredTelemetry(current: Live, telemetry: CaptureTelemetryInput): void {
    for (const ignored of captureTelemetryIgnored(current.sim.store.getState(), telemetry)) {
      // Bounded: a worker cannot grow the set with invented names.
      if (ignoredTelemetry.has(ignored) || ignoredTelemetry.size >= 64) continue;
      ignoredTelemetry.add(ignored);
      log.warn({ ignored }, 'capture telemetry names what the Core does not know; it is ignored');
      persist('warn', 'capture telemetry names what the Core does not know; it is ignored', null, { ignored: ignored.slice(0, 96), label: ENGINE_UNIT_LABEL.captureTelemetry });
    }
  }

  // ── The simulator's own error sink ───────────────────────────────────────────────────────────

  function reportSimError(report: SimErrorReport): void {
    counters.simErrors += 1;
    // A subsystem that throws does so at every tick: one line per source and start.
    if (reportedSources.has(report.source)) return;
    reportedSources.add(report.source);
    log.error({ code: 'ENGINE_SUBSYSTEM_ERROR', source: report.source, level: report.level }, 'the engine caught an error of a subsystem');
    errorLog.append({
      level: report.level,
      source: 'engine.sim',
      message: 'the engine caught an error of a subsystem',
      code: 'ENGINE_SUBSYSTEM_ERROR',
      stackTrace: framesOf(report.stack),
      context: { source: report.source },
    });
  }

  // ── A diverged chain head: reload ────────────────────────────────────────────────────────────

  function endLive(): void {
    live?.scheduler.stop();
    offCommit?.();
    offCommit = null;
    live = null;
    // What the channel last drove the link to: the next start of this process begins with it.
    if (committed !== null) heldLink = committed.tabletLink;
    committed = null;
    lastFrame = null;
  }

  async function reloadOnce(): Promise<boolean> {
    try {
      await start('resync');
      counters.resyncs += 1;
      return true;
    } catch (error) {
      log.error({ code: error instanceof PipelineFailure ? error.reason : codeOf(error) }, 'the engine could not reload from the database; it stays not ready');
      return false;
    }
  }

  /** One period of the timer, or less when the host is stopped meanwhile. */
  function retryPause(): Promise<void> {
    return new Promise<void>((resolve) => {
      const cancel = timer.every(RESYNC_RETRY_INTERVAL_MS, () => endPause?.());
      endPause = () => {
        endPause = null;
        cancel();
        resolve();
      };
    });
  }

  /**
   * Reloads until one reload succeeds, the host is stopped, or somebody else started it (the
   * caller of a reset, between two tries). Never rejects.
   */
  async function reloadUntilDone(): Promise<void> {
    while (!reloadAbandoned && live === null) {
      if (phase === 'stopped' && (await reloadOnce())) return;
      if (reloadAbandoned || live !== null) return;
      await retryPause();
    }
  }

  /**
   * The engine's ring is not what the tables hold. Commands are refused from now on (503), and
   * the host builds its state again from the database, with a new epoch, so that every client
   * asks for a snapshot.
   */
  function requestReload(code: string, detail: Record<string, number>): void {
    if (reloading !== null || phase !== 'running') return;
    log.error({ code, ...detail }, 'the engine ring does not match the stored chain; reloading from the database');
    errorLog.append({
      level: 'error',
      source: 'engine.host',
      message: 'the engine ring does not match the stored chain; reloading from the database',
      code,
      context: detail,
    });
    dependencies.setReady(false);
    endLive();
    phase = 'stopped';
    reloadAbandoned = false;
    const attempt = reloadUntilDone().finally(() => {
      if (reloading === attempt) reloading = null;
    });
    reloading = attempt;
  }

  function diverged(unit: UnitContext, engineSeq: number, storedSeq: number): PipelineFailure {
    log.error(
      { unit: unit.id, label: unit.label, code: PipelineRefusal.AUDIT_HEAD_DIVERGED, headSeq: storedSeq, engineSeq },
      'audit head diverged: the stored head is not the head the engine holds',
    );
    return new PipelineFailure(PipelineRefusal.AUDIT_HEAD_DIVERGED);
  }

  // ── Inside a unit ────────────────────────────────────────────────────────────────────────────

  /** Takes the rows the unit's own writers appended (a module's server-native rows) into the ring. */
  function syncNative(scope: Scope): void {
    const rows = scope.unit.audit.appended();
    const events = scope.unit.events.appended();
    if (rows.length === scope.seenAudit && events.length === scope.seenEvents) return;
    const store = scope.live.sim.store;
    let merged;
    try {
      merged = mergeTrail(store.getState(), rows.slice(scope.seenAudit), events.slice(scope.seenEvents));
    } catch (error) {
      if (error instanceof TrailMismatch) throw diverged(scope.unit, error.engineSeq, error.rowSeq - 1);
      throw error;
    }
    counters.nativeRowsMerged += rows.length - scope.seenAudit;
    scope.seenAudit = rows.length;
    scope.seenEvents = events.length;
    if (!hasTrail(merged)) return;
    store.setState(merged);
    // The writers stored these rows in this unit's transaction: the tables hold them.
    scope.flushed = { ...scope.flushed, ...merged };
  }

  /** AP-6, checked by the host for every write: the head the unit locked is the engine's head. */
  async function checkHead(scope: Scope): Promise<void> {
    const head = await scope.unit.audit.head();
    const held = scope.flushed.audit;
    if (head.seq !== held.total || head.hash !== held.head) throw diverged(scope.unit, held.total, head.seq);
    // The stored head is the engine's: a commit whose outcome was not known did not happen.
    suspect = false;
  }

  /** ENG-3: the engine's `operators` slice equals the operators table. True when it changed. */
  async function mirrorOperatorsIn(scope: Scope): Promise<boolean> {
    const rows = await scope.unit.db
      .select({
        id: operators.id,
        username: operators.username,
        rank: operators.rank,
        name: operators.name,
        displayName: operators.displayName,
        initials: operators.initials,
        roleId: operators.roleId,
      })
      .from(operators)
      .orderBy(asc(operators.id));
    scope.mirrored = true;
    const mirrored = rows.map(operatorFromRow);
    const store = scope.live.sim.store;
    if (isDeepStrictEqual(store.getState().operators, mirrored)) return false;
    store.setState({ operators: mirrored });
    return true;
  }

  /**
   * Writes the WHOLE difference between what the tables hold and the engine's state through the
   * unit: every durable slice that changed, records and snapshot alike (ONE CUT; finding F71).
   */
  async function flush(scope: Scope, options: { readonly interval?: boolean } = {}): Promise<void> {
    const state = scope.live.sim.store.getState();
    const target = durableOf(state);
    const at = stampOf(scope.live.clock);
    const plan = planWrite(scope.flushed, target, { at, state, intervalSnapshot: options.interval === true });
    if (!plan.empty) {
      await checkHead(scope);
      await applyPlan(scope.unit, plan);
      scope.seenAudit += plan.auditRows.length;
      scope.seenEvents += plan.events.length;
      scope.healthRows += plan.healthRows.length;
      if (plan.writesSnapshot) scope.snapshotAt = at;
      if (options.interval === true) scope.intervalWritten = true;
      scope.wrote = true;
    }
    scope.flushed = target;
    scope.at = at;
  }

  /** After the commit, before the next unit: the committed state moves on and the change is published. */
  function settle(scope: Scope): void {
    const current = scope.live;
    if (live !== current) return;
    committed = scope.flushed;
    if (scope.snapshotAt !== null) lastSnapshotAt = scope.snapshotAt;
    if (scope.intervalWritten) {
      nextHealthAt += HEALTH_SNAPSHOT_INTERVAL_MS;
      // After a long suspension: one row now, not one per missed minute.
      if (nextHealthAt <= scope.at) nextHealthAt = scope.at + HEALTH_SNAPSHOT_INTERVAL_MS;
    }
    counters.healthSnapshots += scope.healthRows;
    if (scope.wrote) {
      if (scope.cause === 'tick') counters.ticksWritten += 1;
      // A write of the engine committed: ticks that were suspended may go on (ENG-5).
      current.scheduler.resume();
    }
    const ops = deltaOps(scope.base, scope.flushed);
    if (ops.length > 0) {
      revision += 1;
      publishChange(scope.cause === 'probe' ? 'tick' : scope.cause, scope.at, ops);
    }
    scope.revision = revision;
    if (scope.cause === 'tick') publishMeters(current);
  }

  /** The unit was not committed: the engine's state is set back to the reference held before it (ENG-5). */
  function undo(scope: Scope, error: unknown): void {
    scope.live.sim.store.setState(scope.before, true);
    const where = { unit: scope.unit.id, label: scope.unit.label };
    const reason = error instanceof PipelineFailure ? error.reason : undefined;
    if (reason === PipelineRefusal.AUDIT_HEAD_DIVERGED || reason === PipelineRefusal.AUDIT_CHAIN_REFUSED) {
      requestReload(reason, { unit: scope.unit.id });
      return;
    }
    if (reason === PipelineRefusal.UNIT_TIMEOUT || reason === PipelineRefusal.COMMIT_FAILED) suspect = true;
    if (reason !== undefined) {
      // The pipeline reported and persisted the failure. This line says what the engine did.
      log.warn({ ...where, code: reason }, 'engine state set back: the unit was not committed');
    } else if (error instanceof ApiFailure) {
      // A refusal: of the simulator or of the module that ran the unit. Its caller answers it.
      log.debug({ ...where, code: error.code, simCode: simCodeOf(error) }, 'engine state set back: the unit was refused');
    } else {
      log.error({ ...where, code: codeOf(error) }, 'engine state set back: the unit failed');
      persist('error', 'a unit of the engine failed; the engine state was set back', error, where);
    }
  }

  /**
   * Runs `work` as one unit of the pipeline. The unit's effect on the engine is all or nothing:
   * committed and published, or set back.
   */
  async function inUnit<Value>(label: string, cause: UnitKind, work: (scope: Scope) => Promise<Value> | Value): Promise<EngineOutcome<Value>> {
    const current = live;
    const accepted = phase === 'running' || (phase === 'stopping' && cause === 'stop');
    if (current === null || committed === null || !accepted) throw engineNotReady();
    const holder: { scope: Scope | null } = { scope: null };
    try {
      const value = await dependencies.pipeline().run(label, async (unit) => {
        // The engine may have been stopped or reloaded while this unit waited for its turn.
        if (live !== current || committed === null) throw engineNotReady();
        ownUnits.add(unit.id);
        const scope: Scope = {
          unit,
          live: current,
          cause,
          before: current.sim.store.getState(),
          base: committed,
          flushed: committed,
          seenAudit: 0,
          seenEvents: 0,
          mirrored: false,
          snapshotAt: null,
          intervalWritten: false,
          healthRows: 0,
          wrote: false,
          at: stampOf(current.clock),
          revision: null,
        };
        holder.scope = scope;
        const result = await work(scope);
        // Rows a module appended after its last hosted action belong to the ring too.
        syncNative(scope);
        unit.afterCommit(() => settle(scope));
        return result;
      });
      const outcome: EngineOutcome<Value> = { value, epoch, revision: holder.scope?.revision ?? revision };
      // The position of this outcome, for the answer of the request that ran the unit (API-7).
      if (cause === 'command' || cause === 'operators') dependencies.noteOutcome?.({ epoch: outcome.epoch, revision: outcome.revision });
      return outcome;
    } catch (error) {
      if (holder.scope !== null) undo(holder.scope, error);
      throw error;
    } finally {
      if (holder.scope !== null) ownUnits.delete(holder.scope.unit.id);
    }
  }

  // ── Hosted commands ──────────────────────────────────────────────────────────────────────────

  async function commandIn<Action extends HostedActionName>(
    scope: Scope,
    principal: Principal,
    action: Action,
    args: HostedActionArguments<Action>,
  ): Promise<HostedActionResult<Action>> {
    if (principal.kind !== 'OPERATOR') throw operatorRequired();
    if (!isHostedAction(action)) {
      throw new EngineError('ENGINE_ACTION_NOT_HOSTED', 'this simulator action is not hosted: the engine runs the 33 hosted actions of the specification');
    }
    const where = { unit: scope.unit.id, label: scope.unit.label, action };
    // Before the action: the ring holds what this unit already appended, the stored head is the
    // engine's, and the operators are the table's (ENG-3).
    syncNative(scope);
    await checkHead(scope);
    if (!scope.mirrored) await mirrorOperatorsIn(scope);

    const { sim, clock } = scope.live;
    counters.commands += 1;
    let result: HostedActionResult<Action>;
    try {
      const run = sim.actions[action] as (...parameters: HostedActionArguments<Action>) => HostedActionResult<Action>;
      result = withActorScope(sim.store, principal.operatorId, stampOf(clock), () => run(...args));
    } catch (error) {
      const refusal = simRefusal(error);
      if (refusal !== null) {
        counters.commandsRefused += 1;
        log.debug({ ...where, code: refusal.code, simCode: simCodeOf(refusal) }, 'hosted action refused');
        throw refusal;
      }
      log.error({ ...where, code: codeOf(error) }, 'hosted action failed');
      persist('error', 'a hosted action failed', error, where);
      throw error;
    }
    // A command writes its whole effect at once, the snapshot slices included (read-your-writes, RT-5).
    await flush(scope);
    log.debug({ ...where, operatorId: principal.operatorId }, 'hosted action ran');
    return result;
  }

  /**
   * The INTERNAL action `registerCaptureDevice` in a module's own unit (C3 §2.6 "Adoption";
   * `internal-actions.ts`): the steps of a hosted command without an actor - the action checks no
   * permission, the operation that runs it (96) has passed stage 6 - and the registry entry it added.
   */
  async function registerCaptureDeviceInScope(scope: Scope, device: RegisterCaptureDeviceInput): Promise<CaptureDeviceStatus> {
    const where = { unit: scope.unit.id, label: scope.unit.label, action: 'registerCaptureDevice' };
    syncNative(scope);
    await checkHead(scope);
    const { sim } = scope.live;
    counters.commands += 1;
    try {
      sim.actions.registerCaptureDevice(device);
    } catch (error) {
      const refusal = simRefusal(error);
      if (refusal !== null) {
        counters.commandsRefused += 1;
        log.debug({ ...where, code: refusal.code, simCode: simCodeOf(refusal) }, 'internal action refused');
        throw refusal;
      }
      log.error({ ...where, code: codeOf(error) }, 'internal action failed');
      persist('error', 'an internal action failed', error, where);
      throw error;
    }
    await flush(scope);
    const registered = sim.store.getState().captureDevices.devices.find((entry) => entry.id === device.id);
    if (registered === undefined) throw new EngineError('ENGINE_ACTION_NOT_HOSTED', 'the registered capture device is not in the state after its action');
    return registered;
  }

  function engineUnitOf(scope: Scope): EngineUnit {
    return bindInternalActions(
      {
        unit: scope.unit,
        command: (principal, action, ...args) => commandIn(scope, principal, action, args),
        pending: () => durableOf(scope.live.sim.store.getState()),
      },
      {
        registerCaptureDevice: (device) => registerCaptureDeviceInScope(scope, device),
        // Capture block (blueprint row 71): the two in-unit doors of the session wiring.
        markCaptureConnecting: (sessionId) => markCaptureConnectingInScope(scope, sessionId),
        switchCaptureAudioSource: (change) => switchCaptureAudioSourceInScope(scope, change),
      },
    );
  }

  // ── Capture block (blueprint row 71): the capture of a REAL recording ───────────────────────────
  // Pure transitions of `capture-session.ts`, applied to the hosted `Sim` inside a unit of the
  // host and written through it like every other change. None of them runs in capture mode
  // `simulated`: the session wiring calls them in mode `real` only.

  /** Applies a pure transition in the unit and writes it. True when the state changed. */
  async function applyCaptureTransition(scope: Scope, transition: (state: SimState, now: number) => SimState): Promise<boolean> {
    syncNative(scope);
    const store = scope.live.sim.store;
    const before = store.getState();
    const next = transition(before, stampOf(scope.live.clock));
    if (next === before) return false;
    store.setState(next, true);
    await flush(scope);
    return true;
  }

  /** `markCaptureConnectingIn`: `captureDurable: false` beside the RECORDING this unit persists. */
  function markCaptureConnectingInScope(scope: Scope, sessionId: string): Promise<boolean> {
    return applyCaptureTransition(scope, (state) => captureConnectingTransition(state, sessionId));
  }

  /** `switchCaptureAudioSourceIn`: the acknowledged switch as state, without an audit row of the engine. */
  async function switchCaptureAudioSourceInScope(scope: Scope, change: AudioSourceSwitch): Promise<AudioSourceSwitched | null> {
    let switched: AudioSourceSwitched | null = null;
    await applyCaptureTransition(scope, (state, now) => {
      const result = audioSourceSwitchTransition(state, now, change);
      switched = result.switched;
      return result.state;
    });
    return switched;
  }

  // ── Seal block (blueprint row 82) ────────────────────────────────────────────────────────────

  /**
   * One INTERNAL sealing action in its unit: the pure transition of the shared session machine,
   * written whole. A refusal of the machine (another session, a state that cannot be sealed, a
   * value that is no digest) is the mapped `ApiFailure`, as for a hosted action; anything else is
   * a failure and goes to the error log by its action name only.
   */
  async function applySealTransition(scope: Scope, action: string, transition: (state: SimState, now: number) => SimState): Promise<boolean> {
    syncNative(scope);
    // The head is checked by `flush` when there is something to write: a report that changes
    // nothing sends no statement (the pipeline reports often).
    const store = scope.live.sim.store;
    const before = store.getState();
    counters.commands += 1;
    let next: SimState;
    try {
      next = transition(before, stampOf(scope.live.clock));
    } catch (error) {
      const where = { unit: scope.unit.id, label: scope.unit.label, action };
      const refusal = simRefusal(error);
      if (refusal !== null) {
        counters.commandsRefused += 1;
        log.debug({ ...where, code: refusal.code, simCode: simCodeOf(refusal) }, 'internal action refused');
        throw refusal;
      }
      log.error({ ...where, code: codeOf(error) }, 'internal action failed');
      persist('error', 'an internal action failed', error, where);
      throw error;
    }
    if (next === before) return false;
    store.setState(next, true);
    await flush(scope);
    return true;
  }

  // ── Ticks ────────────────────────────────────────────────────────────────────────────────────

  async function tickWork(scope: Scope): Promise<void> {
    // An earlier commit had an unknown outcome: the stored head decides, before the state moves.
    if (suspect) await checkHead(scope);
    const { sim, clock } = scope.live;
    sim.tick();
    const durable = durableOf(sim.store.getState());
    const now = stampOf(clock);
    const interval = now >= nextHealthAt;
    const storedChanged = changedSlices(scope.flushed, durable, STORED_KEYS).length > 0;
    const snapshotChanged = changedSlices(scope.flushed, durable, SNAPSHOT_KEYS).length > 0;
    // A change of snapshot slices ALONE is written by a tick at most once in a second of the
    // server clock; at once when a fault was raised or cleared.
    const faultsChanged = durable.faults !== scope.flushed.faults;
    const snapshotDue = snapshotChanged && (faultsChanged || snapshotSecond(now) > snapshotSecond(lastSnapshotAt));
    // Nothing durable to write now: no statement, no transaction (ENG-4).
    if (!storedChanged && !snapshotDue && !interval) return;
    // ONE CUT (finding F71): a tick that writes at all writes every slice that changed, so the
    // committed state is never a record of now beside the hardware of a moment ago.
    await flush(scope, { interval });
  }

  function createLiveScheduler(): Scheduler {
    const scheduler: Scheduler = createScheduler({
      timer,
      clock: dependencies.clock,
      intervalMs: ENGINE_TICK_MS,
      probeIntervalMs: SUSPENDED_PROBE_INTERVAL_MS,
      tick: async () => {
        await inUnit(ENGINE_UNIT_LABEL.tick, 'tick', tickWork);
      },
      probe: async () => {
        // The probe writes nothing: that its unit opens, reads the head and commits is what it asks.
        await inUnit(ENGINE_UNIT_LABEL.probe, 'probe', checkHead);
      },
      onSuspended(error) {
        if (live?.scheduler !== scheduler) return;
        log.error({ code: error instanceof PipelineFailure ? error.reason : codeOf(error) }, 'engine ticks suspended: a tick was not committed');
        persist('error', 'engine ticks suspended: a tick was not committed', error, {});
      },
      onResumed() {
        if (live?.scheduler !== scheduler) return;
        log.info('engine ticks resumed');
      },
    });
    return scheduler;
  }

  // ── Rows of server-native units ──────────────────────────────────────────────────────────────

  function onCommit(unit: CommittedUnit): void {
    if (ownUnits.has(unit.id)) return;
    const current = live;
    if (current === null || committed === null) return;
    let merged;
    try {
      merged = mergeTrail(current.sim.store.getState(), unit.auditRows, unit.events);
    } catch (error) {
      if (!(error instanceof TrailMismatch)) throw error;
      requestReload(PipelineRefusal.AUDIT_HEAD_DIVERGED, { unit: unit.id, engineSeq: error.engineSeq, rowSeq: error.rowSeq });
      return;
    }
    if (!hasTrail(merged)) return;
    counters.nativeRowsMerged += unit.auditRows.length;
    current.sim.store.setState(merged);
    const next: DurableSlices = { ...committed, ...merged };
    const ops = deltaOps(committed, next);
    committed = next;
    if (ops.length === 0) return;
    revision += 1;
    publishChange('native', stampOf(current.clock), ops);
  }

  // ── Start and stop ───────────────────────────────────────────────────────────────────────────

  async function rehydrate(mode: EngineStartMode): Promise<void> {
    const pipeline = dependencies.pipeline();
    let rehydrateUnit: number | null = null;
    try {
      await pipeline.run(ENGINE_UNIT_LABEL.rehydrate, async (unit) => {
        rehydrateUnit = unit.id;
        ownUnits.add(unit.id);
        // The reader's statements follow the chain lock of this unit: no writer is in between.
        const stored = await readStored(unit);
        assertValidSlices(stored.slices);

        // ONE time base (decision D110; security finding CPS1-1). A server clock that is behind
        // the stored state (the system time was set back while the process was down) would stamp
        // rows before rows that are stored, and a session, a pairing code or a biometric token
        // issued "in the future" could not be ended. The floor goes into the SERVER clock itself,
        // inside this unit (no writer is in between) and before anything of this start reads the
        // time. From there the clock runs on at the real rate.
        const behindMs = stored.clockFloor - dependencies.clock.now();
        if (!dependencies.raiseClockFloor(stored.clockFloor)) {
          // Never the server's own clock: a clock without a floor that somebody put behind the
          // seam. Going on would bring the two time bases back, so the start stops (fail closed).
          throw new EngineError(
            'ENGINE_CLOCK_WITHOUT_FLOOR',
            'the clock behind the seam is behind the stored state and cannot take a floor; put a server clock (createSystemClock) behind the seam',
            { behindMs },
          );
        }
        if (behindMs > 0) {
          const message = 'the system time is behind the stored state; the server clock runs on from the newest stored instant';
          log.warn({ code: 'ENGINE_CLOCK_BEHIND', behindMs }, message);
          errorLog.append({ level: 'warn', source: 'engine.host', message, code: 'ENGINE_CLOCK_BEHIND', context: { mode, behindMs } });
        }
        const clock = engineClock(dependencies.clock);
        const now = stampOf(clock);

        reportedSources.clear();
        const sim = await createHeadlessSim({ seed: stored.slices.meta.seed, clock, onError: reportSimError, capture: dependencies.captureLevels ?? 'simulated' });
        ignoredTelemetry.clear();
        const nextEpoch = mode === 'reset' ? stored.slices.meta.epoch : stored.slices.meta.epoch + 1;
        adoptStoredState(sim, stored, nextEpoch);
        // A process start faults a session that was in flight and takes the tablet link down. EVERY
        // start rebuilt the ring from the table, so every start clears the fault of the tamper
        // overlay: the fault list and the audit view agree after it (finding F73, decision D106).
        // And EVERY start of a process whose engine already ran begins with the link it held: the
        // first state of the new epoch says what the open sockets say (finding F78, decision D119).
        const effects: RestartEffects =
          mode === 'boot'
            ? applyProcessStart(sim, stored.lastCommittedAt, now, heldLink)
            : { ...NO_EFFECTS, tamperCleared: clearTamperOverlay(sim, now), tabletLinkCarried: heldLink !== null && carryTabletLink(sim, heldLink) };

        // Capture block (blueprint row 71; D91 R-1 option A): no column holds `captureDurable`, so
        // in capture mode `real` it is derived here from the stored fragment rows of the session
        // (`captureDurableAtRehydrateTransition` says what that value may and may not decide).
        if (dependencies.captureLevels === 'external') {
          const open = sim.store.getState().session;
          if (open !== null) {
            const hasFragmentRow = (await unit.query(READ_SESSION_HAS_FRAGMENT, [open.id])).rows.length > 0;
            const derived = captureDurableAtRehydrateTransition(sim.store.getState(), hasFragmentRow);
            if (derived !== sim.store.getState()) sim.store.setState(derived, true);
          }
        }

        // Source-fact block (integration pass D11; `fact-doors.ts`): no row holds the class of a
        // built-in test source or `sourceOpen`, so the list the Core last handed in is applied to the
        // state this start read. A PROCESS start knows none: nothing is open after a boot until the
        // caller says so again (a source never reads "on" from an earlier process).
        if (mode === 'boot') heldSourceFacts = null;
        else if (heldSourceFacts !== null) {
          const marked = applyCaptureSourceFactsTransition(sim.store.getState(), heldSourceFacts);
          if (marked !== sim.store.getState()) sim.store.setState(marked, true);
        }

        const state = sim.store.getState();
        const target = durableOf(state);
        const plan = planWrite(stored.slices, target, { at: now, state });
        await applyPlan(unit, plan);

        unit.afterCommit(() => {
          const scheduler = createLiveScheduler();
          live = { sim, clock, scheduler };
          committed = target;
          epoch = nextEpoch;
          revision = 0;
          lastSnapshotAt = plan.writesSnapshot ? now : Number.NEGATIVE_INFINITY;
          nextHealthAt = now + HEALTH_SNAPSHOT_INTERVAL_MS;
          counters.healthSnapshots += plan.healthRows.length;
          meterSeq = 0;
          lastAudio = state.audio;
          lastFrame = null;
          suspect = false;
          offCommit = pipeline.onCommit(onCommit);
          phase = 'running';
          log.info(
            {
              mode,
              epoch,
              auditTotal: target.audit.total,
              session: target.session?.state ?? null,
              restartFault: effects.faultedFrom,
              tamperCleared: effects.tamperCleared,
              tabletLinkReset: effects.tabletLinkReset,
              tabletLinkCarried: effects.tabletLinkCarried,
              auditRows: plan.auditRows.length,
            },
            'engine started',
          );
          scheduler.start();
          dependencies.setReady(true);
          // A new epoch: every operator connection needs a snapshot (RT-7).
          publishChange('start', now, []);
        });
      });
    } finally {
      if (rehydrateUnit !== null) ownUnits.delete(rehydrateUnit);
    }
  }

  function start(mode: EngineStartMode): Promise<void> {
    if (phase !== 'stopped') {
      return Promise.reject(new EngineError('ENGINE_ALREADY_STARTED', 'the engine host is started or starting; stop it first'));
    }
    phase = 'starting';
    const attempt = rehydrate(mode).catch((error: unknown) => {
      if (phase === 'starting') phase = 'stopped';
      // The form of a failed boot check (`boot check failed`): the step, a code, and for a
      // refusal of the host itself its fixed text, which names the command that helps. Never a
      // value of the stored state.
      const refusal = error instanceof EngineError ? { ...error.detail, detail: error.message } : {};
      const code = error instanceof PipelineFailure ? error.reason : codeOf(error);
      log.error({ step: ENGINE_BOOT_STEP, mode, code, ...refusal }, 'engine not started');
      persist('error', 'the engine could not start from the stored state', error, { step: ENGINE_BOOT_STEP, mode, ...refusal });
      throw error;
    });
    const ended = attempt.then(
      () => undefined,
      () => undefined,
    );
    starting = ended;
    void ended.then(() => {
      if (starting === ended) starting = null;
    });
    return attempt;
  }

  async function stopNow(): Promise<void> {
    // A start that is under way ends first: its unit is in the queue.
    reloadAbandoned = true;
    endPause?.();
    if (reloading !== null) await reloading;
    if (starting !== null) await starting;
    if (phase !== 'running') {
      phase = 'stopped';
      return;
    }
    phase = 'stopping';
    dependencies.setReady(false);
    const current = live;
    if (current !== null) {
      current.scheduler.stop();
      await current.scheduler.idle();
      try {
        // The last write: what a tick left for the next second (the hardware snapshot).
        await inUnit(ENGINE_UNIT_LABEL.stop, 'stop', (scope) => flush(scope));
      } catch (error) {
        log.error({ code: error instanceof PipelineFailure ? error.reason : codeOf(error) }, 'the last write of the engine was not committed');
        persist('error', 'the last write of the engine was not committed', error, {});
      }
    }
    endLive();
    phase = 'stopped';
    log.info({ epoch, revision }, 'engine stopped');
  }

  function stop(): Promise<void> {
    if (phase === 'stopped' && starting === null && reloading === null) return Promise.resolve();
    stopping ??= stopNow().finally(() => {
      stopping = null;
    });
    return stopping;
  }

  // ── The seam ─────────────────────────────────────────────────────────────────────────────────

  function committedState(): DurableSlices {
    if (phase !== 'running' || committed === null) throw engineNotReady();
    return committed;
  }

  const host: EngineHost & EngineControl & EngineCaptureDoors & EngineSealDoors & EngineFactDoors & { readonly [CONTROL]: true } = {
    [CONTROL]: true,

    get epoch() {
      return epoch;
    },
    get revision() {
      return revision;
    },
    get running() {
      return phase === 'running';
    },

    command(principal, action, ...args) {
      // Refused before a unit is submitted: neither needs the pipeline.
      if (principal.kind !== 'OPERATOR') return Promise.reject(operatorRequired());
      if (!isHostedAction(action)) {
        return Promise.reject(
          new EngineError('ENGINE_ACTION_NOT_HOSTED', 'this simulator action is not hosted: the engine runs the 33 hosted actions of the specification'),
        );
      }
      return inUnit(`engine.${action}`, 'command', (scope) => commandIn(scope, principal, action, args));
    },

    run(label, work) {
      return inUnit(label, 'command', (scope) => work(engineUnitOf(scope)));
    },

    setTabletLink(state: TabletLinkState) {
      return inUnit(ENGINE_UNIT_LABEL.tabletLink, 'command', async (scope) => {
        scope.live.sim.actions.setTabletLink(state);
        await flush(scope);
      });
    },

    applyCaptureTelemetry(telemetry: CaptureTelemetryInput) {
      const current = live;
      if (current === null || committed === null || phase !== 'running') return Promise.reject(engineNotReady());
      // A unit of an earlier frame still waits for its turn: this frame takes its place in it.
      if (telemetrySlot !== null && telemetrySlot.live === current && telemetryOutcome !== null) {
        telemetrySlot.telemetry = telemetry;
        return telemetryOutcome;
      }
      try {
        noteIgnoredTelemetry(current, telemetry);
        if (!captureTelemetryChangesState(current.sim.store.getState(), telemetry)) {
          // Nothing the tables hold would change: the action sets the levels of the meters and
          // leaves the store alone, so there is nothing to commit and no unit is opened.
          current.sim.actions.applyCaptureTelemetry(telemetry);
          return Promise.resolve({ value: undefined, epoch, revision });
        }
      } catch (error) {
        // A frame the simulator could not read. Nothing was stored; the next frame is tried anew.
        log.error({ code: codeOf(error) }, 'a capture telemetry frame was not applied');
        persist('error', 'a capture telemetry frame was not applied', error, { label: ENGINE_UNIT_LABEL.captureTelemetry });
        return Promise.reject(error instanceof Error ? error : new Error('a capture telemetry frame was not applied'));
      }
      const slot: TelemetrySlot = { live: current, telemetry };
      telemetrySlot = slot;
      const outcome = inUnit(ENGINE_UNIT_LABEL.captureTelemetry, 'command', async (scope) => {
        // From here on a new frame opens a unit of its own: this one applies the frame it holds now.
        if (telemetrySlot === slot) telemetrySlot = null;
        scope.live.sim.actions.applyCaptureTelemetry(slot.telemetry);
        await flush(scope);
      }).finally(() => {
        if (telemetrySlot === slot) telemetrySlot = null;
      });
      telemetryOutcome = outcome;
      return outcome;
    },

    raiseCaptureWarning(warning: CaptureWarningInput) {
      return inUnit(ENGINE_UNIT_LABEL.captureWarning, 'command', async (scope) => {
        scope.live.sim.actions.raiseCaptureWarning(warning);
        await flush(scope);
      });
    },

    clearCaptureWarning(warning: CaptureWarningInput) {
      return inUnit(ENGINE_UNIT_LABEL.captureWarningClear, 'command', async (scope) => {
        scope.live.sim.actions.clearCaptureWarning(warning);
        await flush(scope);
      });
    },

    // Capture block (blueprint row 71): the three doors of the capture session, each one unit.
    markCaptureDurable(sessionId: string) {
      return inUnit(ENGINE_UNIT_LABEL.captureDurable, 'command', (scope) => applyCaptureTransition(scope, (state) => captureDurableOfSessionTransition(state, sessionId)));
    },

    endCapture(sessionId: string, end: { readonly durable: boolean; readonly cause?: string | null }) {
      return inUnit(ENGINE_UNIT_LABEL.captureEnded, 'command', async (scope): Promise<CaptureEndOutcome> => {
        const session = scope.live.sim.store.getState().session;
        // A session that says it holds a durable fragment is NEVER a failed start, whatever the
        // caller reports: evidence on the disk is sealed as interrupted, not dropped (D84).
        const durable = end.durable || session?.captureDurable === true;
        const changed = await applyCaptureTransition(scope, (state, now) => (durable ? interruptedCaptureTransition(state, now, sessionId) : failedCaptureStartTransition(state, now, sessionId, end.cause ?? null)));
        const outcome: CaptureEndOutcome = !changed ? 'IGNORED' : durable ? 'INTERRUPTED' : 'FAILED_START';
        log.info({ label: scope.unit.label, sessionId, outcome }, 'the capture of a session ended');
        return outcome;
      });
    },

    clearCaptureFaults() {
      return inUnit(ENGINE_UNIT_LABEL.captureFaultsClear, 'command', async (scope) => {
        const active = scope.live.sim.store.getState().faults.active.filter((fault) => CAPTURE_FAULT_KINDS.includes(fault.kind)).length;
        if (active === 0) return 0;
        await applyCaptureTransition(scope, clearCaptureFaultsTransition);
        return active;
      });
    },

    // Seal block (blueprint row 82; register SH-18, CS-04): the INTERNAL actions of the sealing
    // pipeline and the verdict of a real verification. No actor, no permission: the caller is the
    // Core itself. Each is one unit; a transition that changes nothing sends no statement.
    applySealingProgress(input: SealingProgressInput) {
      return inUnit(ENGINE_UNIT_LABEL.sealingProgress, 'command', async (scope) => {
        await applySealTransition(scope, 'applySealingProgress', (state, now) => applySealingProgressTransition(state, now, input));
      });
    },

    completeSeal(input: CompleteSealInput, also?: (unit: UnitContext, evidenceId: string) => Promise<void>) {
      return inUnit(ENGINE_UNIT_LABEL.sealComplete, 'command', async (scope) => {
        await applySealTransition(scope, 'completeSeal', (state, now) => completeSealTransition(state, now, input));
        const evidenceId = scope.live.sim.store.getState().session?.evidenceId ?? null;
        if (evidenceId === null) throw new EngineError('ENGINE_ACTION_NOT_HOSTED', 'the sealed session names no evidence item after its seal');
        // The item's row is written by now: rows that hang on it (the sealed transcript) commit in
        // the same unit, or the seal does not commit at all.
        if (also !== undefined) await also(scope.unit, evidenceId);
        return { evidenceId };
      });
    },

    recordEvidenceVerification(verdict: EvidenceVerdictInput) {
      return inUnit(ENGINE_UNIT_LABEL.evidenceVerdict, 'command', async (scope) => {
        await applySealTransition(scope, 'recordEvidenceVerification', (state, now) => recordEvidenceVerificationTransition(state, now, verdict));
      });
    },

    // Fact block (integration pass D6; `fact-doors.ts`): two facts only a Core knows, each one unit
    // with no actor and no audit row. A call that changes nothing sends no statement.
    applyStorageVolume(volume: StorageVolumeInput) {
      return inUnit(FACT_DOOR_LABEL.storageVolume, 'command', (scope) => applyCaptureTransition(scope, (state) => applyStorageVolumeTransition(state, volume)));
    },

    noteTranscriptRevision(note: TranscriptRevisionNote) {
      return inUnit(FACT_DOOR_LABEL.transcriptRevision, 'command', (scope) => applyCaptureTransition(scope, (state) => noteTranscriptRevisionTransition(state, note)));
    },

    // Source-fact block (integration pass D11): the list is kept for the next rehydrate of this
    // process, then applied as one unit with no actor and no audit row. Nothing is stored.
    applyCaptureSourceFacts(facts: readonly CaptureSourceFact[]) {
      heldSourceFacts = facts.map((fact) => ({ ...fact }));
      return inUnit(FACT_DOOR_LABEL.captureSourceFacts, 'command', (scope) => applyCaptureTransition(scope, (state) => applyCaptureSourceFactsTransition(state, facts)));
    },

    mirrorOperators() {
      return inUnit(ENGINE_UNIT_LABEL.operators, 'operators', async (scope) => {
        const changed = await mirrorOperatorsIn(scope);
        if (changed) scope.flushed = { ...scope.flushed, operators: scope.live.sim.store.getState().operators };
        return changed;
      });
    },

    state: committedState,
    slice: <Key extends DurableSliceKey>(name: Key): DurableSlices[Key] => committedState()[name],

    meters(): EngineMeterFrame | null {
      // Not running: 503, as for a read of the state. A frame of an earlier start is never served.
      if (phase !== 'running' || committed === null) throw engineNotReady();
      return lastFrame;
    },

    start,
    reload: () => start('reset'),
    stop,

    stats(): EngineStats {
      const scheduler = live?.scheduler.stats();
      return {
        phase,
        ticks: scheduler?.ticks ?? 0,
        ticksWritten: counters.ticksWritten,
        ticksSkipped: scheduler?.skipped ?? 0,
        ticksFailed: scheduler?.ticksFailed ?? 0,
        suspended: scheduler?.suspended ?? false,
        probes: scheduler?.probes ?? 0,
        commands: counters.commands,
        commandsRefused: counters.commandsRefused,
        publications: counters.publications,
        meterFrames: counters.meterFrames,
        nativeRowsMerged: counters.nativeRowsMerged,
        healthSnapshots: counters.healthSnapshots,
        resyncs: counters.resyncs,
        simErrors: counters.simErrors,
      };
    },

    // ── Control ────────────────────────────────────────────────────────────────────────────────

    useTimer(next) {
      if (phase !== 'stopped') throw new EngineError('ENGINE_TIMER_IN_USE', 'the timer of the engine host is replaced only while the host is stopped');
      timer = next;
    },
    simulator: () => live?.sim ?? null,
    fire: () => live?.scheduler.fire(),
    idle: async () => {
      await live?.scheduler.idle();
    },
    settled: async () => {
      while (reloading !== null) await reloading;
      if (starting !== null) await starting;
    },
  };
  return host;
}
