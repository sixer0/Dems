/**
 * Rehydration: the stored rows back into an engine state, and what a process start does to it
 * (plan row W26; spec §8.6; database contract §2.6 MR-1 to MR-5, §7.4; decisions D14, D28 D-1,
 * D62 DN-1, DN-3; `17_db_schema_migrations.md` §10).
 *
 * Pure, except `readStored`, which sends the reader's statements through the caller's unit.
 *
 * A STORED STATE THAT IS REJECTED IS FATAL. The simulator, given a snapshot it does not accept,
 * silently starts on a fresh demo dataset (finding F-5 of the headless proof). The server must
 * never come up serving a state it could not validate, so every refusal here is an
 * `EngineError` that stops the start: the rows do not form a state, a slice fails its schema of
 * the contract registry, or the simulator's own acceptance test fails. The log gets the code,
 * the slice names and counts; never a value.
 */
import { REPLICATED_SLICE_SCHEMAS } from '@dems/shared/api';
import {
  FAULTABLE_STATES,
  FaultKind,
  TabletLinkState,
  clearFaultTransition,
  deriveDeviceState,
  enterFault,
  coreNotRunningFaultTransition,
  injectFaultTransition,
  isUsableSnapshot,
  toSnapshot,
  type Sim,
  type SimState,
} from '@dems/shared/sim';
import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { UnitContext } from '../core';
import { DURABLE_SLICE_KEYS, MappingError, fromRows, storedValuesOfLoadCorrections, type DurableSliceKey, type DurableSlices, type FromRowsOptions, type LoadCorrectedSnapshotKey, type StoredRows } from '../db/mapping';
import { activeSession, auditLog, authSessions, biometricTokens, events, hardwareSnapshot, pairedDevices, pairingCodes } from '../db/schema';
import { readStoredRows } from '../db/store';
import { EngineError } from './errors';
import { endRestartFaultTransition } from './restart-fault';

/** What a start read: the durable slices and the instants the restart rules need. */
export interface StoredState {
  readonly slices: DurableSlices;
  /** The one stored member of the `pairing` slice (`core_device.certificate_fingerprint`). */
  readonly certificateFingerprint: string;
  /**
   * The latest instant at which the engine is known to have committed: the greatest of the
   * hardware snapshot's `written_at`, the active session's `updated_at`, and `at` of the newest
   * stored audit row and event (decision D28 D-1; the migration row's ruling).
   */
  readonly lastCommittedAt: number;
  /**
   * The newest instant ANY stored row was written with: the floor of the server clock (decision
   * D110; security finding CPS1-1, guarantees G1 and G2). Never below `lastCommittedAt`.
   */
  readonly clockFloor: number;
  /**
   * Audit row 92 cycle 2 (D80): what the TABLES hold, slice by slice - `slices` itself, except a hardware slice the
   * read corrected (D64 widening, the mic devices taken from `capture_config`), which holds the stored value here.
   * The first write of a start plans from this, so a correction of the read reaches `hardware_snapshot` in the
   * rehydration unit, through the one write-through, exactly once. The same object as `slices` when nothing was corrected.
   */
  readonly tableSlices: DurableSlices;
  /** The hardware slices the read corrected (names only, for the log); empty when none. */
  readonly corrected: readonly LoadCorrectedSnapshotKey[];
}

/**
 * The newest instant of the PAST that a stored row was written with, in one statement (security
 * finding CPS1-1, guarantees G1, G2 and G8). Every instant that a later statement compares its
 * own time with is in it:
 *
 *   audit_log.at, events.at                               the one chain: no row before its predecessor;
 *   hardware_snapshot.written_at, active_session.updated_at   the engine's last commit;
 *   auth_sessions.issued_at, last_seen_at, ended_at       CHECK `auth_sessions_times_check`;
 *   pairing_codes.issued_at, closed_at                    CHECK `pairing_codes_times_check`;
 *   paired_devices.paired_at, last_seen_at                the device registry's activity;
 *   biometric_tokens.issued_at, used_at                   CHECK `biometric_tokens_times_check`.
 *
 * NEVER A DEADLINE. `auth_sessions.absolute_expires_at`, `pairing_codes.expires_at` and
 * `biometric_tokens.expires_at` lie in the future by design: a floor taken from one of them would
 * expire every session at the start.
 *
 * It reads; it changes no row and needs no privilege beyond the runtime role's SELECT. `greatest`
 * and `max` skip NULL: an empty table and an open row give no instant. The value travels as text,
 * so a `bigint` keeps every digit. The tables and columns are the typed ones of the schema: a
 * column that is renamed there is a compile error here, not a statement that fails at a start.
 */
const newestOf = (table: PgTable, ...instants: AnyColumn[]): SQL => sql`(SELECT max(greatest(${sql.join(instants, sql`, `)})) FROM ${table})`;

export const NEWEST_STORED_INSTANT: SQL = sql`SELECT greatest(${sql.join(
  [
    newestOf(auditLog, auditLog.at),
    newestOf(events, events.at),
    newestOf(hardwareSnapshot, hardwareSnapshot.writtenAt),
    newestOf(activeSession, activeSession.updatedAt),
    newestOf(authSessions, authSessions.issuedAt, authSessions.lastSeenAt, authSessions.endedAt),
    newestOf(pairingCodes, pairingCodes.issuedAt, pairingCodes.closedAt),
    newestOf(pairedDevices, pairedDevices.pairedAt, pairedDevices.lastSeenAt),
    newestOf(biometricTokens, biometricTokens.issuedAt, biometricTokens.usedAt),
  ],
  sql`, `,
)})::text AS newest`;

/**
 * Asks the database for the newest stored instant, inside `unit`. 0 when no table holds one. A
 * value that is not an instant a row could be stamped with (it is not a whole, safe, non-negative
 * number of milliseconds) is `ENGINE_STATE_UNREADABLE`: the start stops, as for any stored state
 * the server cannot use (guarantee G5).
 */
export async function readNewestStoredInstant(unit: Pick<UnitContext, 'db'>): Promise<number> {
  const answer = await unit.db.execute<{ newest: string | null }>(NEWEST_STORED_INSTANT);
  const text = answer.rows[0]?.newest ?? null;
  if (text === null) return 0;
  const newest = Number(text);
  if (!Number.isSafeInteger(newest) || newest < 0) {
    throw new EngineError('ENGINE_STATE_UNREADABLE', 'the stored rows hold a write instant that is not a whole, non-negative number of milliseconds', {
      rule: 'CLOCK_FLOOR',
    });
  }
  return newest;
}

/**
 * Reads the rows of the durable slices inside `unit`: after the chain lock, so no writer is in
 * between. The unit's transaction is opened first, by itself: a database that does not answer is
 * then the pipeline's own refusal (503 `NOT_READY`, reported once as an outage, with
 * `ready.database` following the probe), not a failed read of some table.
 */
export async function readStored(unit: UnitContext, options: FromRowsOptions = {}): Promise<StoredState> {
  await unit.audit.head();
  const rows = await readStoredRows(unit.db);
  return storedStateOf(rows, await readNewestStoredInstant(unit), options);
}

/**
 * The state the rows hold. Throws `ENGINE_STATE_UNREADABLE` when they do not form one.
 * `newestStoredInstant` is what `readNewestStoredInstant` answered; without it the floor of the
 * clock is the engine's own last committed instant.
 */
export function storedStateOf(rows: StoredRows, newestStoredInstant = 0, options: FromRowsOptions = {}): StoredState {
  let slices: DurableSlices;
  try {
    // Device-list block (fix F-M4, finding R69-03): `options` carries the device-list rule of the running capture operation.
    slices = fromRows(rows, options);
  } catch (error) {
    if (error instanceof MappingError) {
      throw new EngineError(
        'ENGINE_STATE_UNREADABLE',
        'the stored rows do not form an engine state; seed the database (npm run db:seed) or reset it (npm run db:reset)',
        { rule: error.code },
        error,
      );
    }
    throw error;
  }
  const device = rows.coreDevice[0];
  if (device === undefined) {
    throw new EngineError('ENGINE_STATE_UNREADABLE', 'the stored rows do not form an engine state: the Core device record is missing', { rule: 'ROW_SHAPE' });
  }
  const lastCommittedAt = lastCommittedInstant(rows);
  // Audit row 92 cycle 2 (D80): `fromRows` held the single snapshot row to one, so [0] is that row.
  const snapshotRow = rows.hardwareSnapshot[0];
  const storedValues = snapshotRow === undefined ? {} : storedValuesOfLoadCorrections(snapshotRow, slices);
  const corrected = (Object.keys(storedValues) as LoadCorrectedSnapshotKey[]).sort();
  const tableSlices = corrected.length === 0 ? slices : { ...slices, ...storedValues };
  return { slices, certificateFingerprint: device.certificateFingerprint, lastCommittedAt, clockFloor: Math.max(lastCommittedAt, newestStoredInstant), tableSlices, corrected };
}

/** The greatest stored write instant (see `StoredState.lastCommittedAt`). 0 when the rows hold none. */
export function lastCommittedInstant(rows: Pick<StoredRows, 'hardwareSnapshot' | 'activeSession' | 'auditLog' | 'events'>): number {
  const instants = [
    ...rows.hardwareSnapshot.map((row) => row.writtenAt),
    ...rows.activeSession.map((row) => row.updatedAt),
    ...rows.auditLog.map((row) => row.at),
    ...rows.events.map((row) => row.at),
  ];
  return instants.reduce((greatest, instant) => (instant > greatest ? instant : greatest), 0);
}

export interface RejectedSlice {
  readonly slice: DurableSliceKey;
  /** How many rules of the slice's schema the stored value breaks. */
  readonly issues: number;
  /** The first broken rule: the schema library's code and the path of member names and positions. */
  readonly rule: string;
  readonly path: string;
}

/**
 * Checks each durable slice against its schema of the contract registry (contract B; the text
 * rule API-13 included). The result names slices, rules and paths; it never holds a value.
 */
export function rejectedSlices(slices: DurableSlices): RejectedSlice[] {
  const rejected: RejectedSlice[] = [];
  for (const key of DURABLE_SLICE_KEYS) {
    const result = REPLICATED_SLICE_SCHEMAS[key].safeParse(slices[key]);
    if (result.success) continue;
    const first = result.error.issues[0];
    rejected.push({
      slice: key,
      issues: result.error.issues.length,
      rule: first?.code ?? 'unknown',
      path: (first?.path ?? []).map((part) => String(part)).join('.'),
    });
  }
  return rejected;
}

/** Throws `ENGINE_SNAPSHOT_REJECTED` when a stored slice fails its schema. */
export function assertValidSlices(slices: DurableSlices): void {
  const rejected = rejectedSlices(slices);
  const first = rejected[0];
  if (first === undefined) return;
  throw new EngineError('ENGINE_SNAPSHOT_REJECTED', 'the stored state was rejected by the slice schemas of the contract', {
    slices: rejected.map((entry) => entry.slice).join(','),
    rejected: rejected.length,
    firstSlice: first.slice,
    firstRule: first.rule,
    firstPath: first.path,
    issues: rejected.reduce((sum, entry) => sum + entry.issues, 0),
  });
}

/**
 * Puts the stored state into a fresh `Sim` with the epoch the start decided, and re-derives the
 * random streams from the seed and that epoch (spec §8.6 "Fresh"). The transient slices (`audio`,
 * `clock`, `auth`) and the two the server does not use (`authLockout`, `pairing`) stay as the
 * fresh `Sim` built them; `pairing` takes the stored certificate fingerprint.
 *
 * Before the state is set, the simulator's OWN acceptance test for a stored snapshot is applied
 * (`isUsableSnapshot`: every key, the shape version, the seed). The simulator's hydration would
 * fall back to a fresh dataset when it fails; here it is fatal.
 */
export function adoptStoredState(sim: Sim, stored: StoredState, epoch: number): void {
  const fresh = sim.store.getState();
  const meta = { ...stored.slices.meta, epoch };
  const pairing = { ...fresh.pairing, certificateFingerprint: stored.certificateFingerprint };
  const candidate = { ...toSnapshot(fresh), ...stored.slices, meta, pairing };
  if (!isUsableSnapshot(candidate, sim.seed)) {
    throw new EngineError('ENGINE_SNAPSHOT_REJECTED', 'the stored state was rejected by the simulator (shape version, seed or a missing slice)', {
      rule: 'SIM_SNAPSHOT',
    });
  }
  sim.store.setState({ ...stored.slices, meta, pairing });
  sim.rng.reseed(epoch);
}

/** What a start did to the stored state, for the log (names and states, never content). */
export interface RestartEffects {
  /** The session state the restart fault found, or null when it did nothing. */
  readonly faultedFrom: string | null;
  readonly tamperCleared: boolean;
  /** A process start found the stored link CONNECTED and wrote it OFFLINE, with its row (spec §8.6). */
  readonly tabletLinkReset: boolean;
  /** The link the engine held before this start replaced the stored one, without a row (spec §12.4). */
  readonly tabletLinkCarried: boolean;
  /**
   * Fix wave I (G75b-03): a process start of a Core in its OWN capture found the stored link
   * CONNECTED and put it OFFLINE in the state WITHOUT a row. Absent reads as false.
   */
  readonly tabletLinkOfflineUnwritten?: boolean;
  /**
   * Fix wave K (G75c-01): the start found a STORED restart fault ("the Core was not running") whose
   * session had ended, and cleared it - one `FAULT_CLEARED` row, its alert resolved. Absent reads as false.
   */
  readonly restartFaultEnded?: boolean;
}

/** What a process start is told of the Core it runs in. */
export interface ProcessStartOptions {
  /**
   * True on a Core in its OWN capture (capture mode `real`; the engine's `captureLevels:
   * 'external'`). Fix wave I, re-gate 75 finding G75b-03, ruling D216 (3): there the simulator's
   * restart model must not put a power failure or a tablet fault into the audit chain of a Core
   * that was simply stopped and started. Absent / false: simulated capture, unchanged.
   */
  readonly ownCapture?: boolean;
}

/**
 * The session states the restart fault leaves alone on a Core in its OWN capture (fix wave I,
 * G75b-03). FINALIZING: the recording had ended before the process stopped; nothing was being
 * recorded, nothing is lost, and the seal goes on from its stored rows at this start
 * (`sealing-host`, step `sealing.resume`: `decide()` reads a plain FINALIZING session). A fault
 * there would state a power failure that nobody observed.
 * NOT in the list, on purpose: PRECHECK, ARMED, RECORDING and STOPPING. A session in one of those
 * cannot stay as it was - no capture worker and no pre-check gate holds it after a process start -
 * so the restart fault still moves it. Its KIND is still the simulator's `POWER_FAIL` (ruling
 * D217 (5): no new cause now), but since closing pass J its rows say what the Core knows - "The
 * Core was not running while this session was active" - and carry `coreNotRunning: true`
 * (`@dems/shared/sim` `core-not-running.ts`).
 */
export const OWN_CAPTURE_STATES_KEPT_AT_START: readonly string[] = Object.freeze(['FINALIZING']);

/** The engine's `tabletLink` slice. */
export type TabletLink = DurableSlices['tabletLink'];

/**
 * The tablet link of a start in a process whose engine ALREADY RAN (finding F78; decision D119;
 * spec §6.8, §12.4). Synchronous; it changes the store and writes nothing. True when the stored
 * link was not the one the engine held.
 *
 * The link says whether a paired device holds an open socket NOW (§6.8). It is a fact of the
 * sockets of this process, not of the rows a start reads. `held` is the slice the engine had
 * committed when it stopped: what the realtime channel, the owner of the sockets, last drove it
 * to. A stop and a start of the engine close no socket, so that is still the link when the engine
 * comes back, and the FIRST state of the new epoch must say so. The shared simulator does the
 * same at its own scenario load: it keeps the link it had (`tabletLink: current.tabletLink`).
 *
 * NO ROW IS WRITTEN FOR IT, and no event. Where the stored link differs from `held`, the stored
 * value is not this Core's: it is the dataset's, written by the reset routine. Nothing connected
 * or disconnected; a `TABLET_LINK_CHANGED` row would record a change that never happened. Spec
 * §12.4 gives the state after a reset as "Recomputed from the open sockets" and the new chain as
 * "the seed history as of the server clock, then one `SCENARIO_LOADED` row". The slice is taken
 * whole, with the instant it changed at, and the entries of the other devices are derived from
 * it by the shared code, as the hosted action does.
 *
 * What the engine cannot know: a socket that opened or closed WHILE it was stopped. The channel
 * compares at its next pace step and drives the link through the hosted action, with the rows
 * of a change that did happen.
 */
export function carryTabletLink(sim: Sim, held: TabletLink): boolean {
  const state = sim.store.getState();
  if (state.tabletLink.state === held.state && state.tabletLink.changedAt === held.changedAt) return false;
  sim.store.setState(deriveDeviceState({ ...state, tabletLink: held }));
  return true;
}

/**
 * What EVERY start does to the state it rehydrated, whatever its mode (finding F73; decision
 * D106): the fault of the tamper overlay is cleared, at `now`. Synchronous; it changes the store
 * and writes nothing. True when there was such a fault.
 *
 * The `AUDIT_TAMPER` demo fault alters one row of the engine's RING and nothing that is stored
 * (the table is append-only and holds the chain as it was appended). What IS stored is the fault
 * in the list of active faults, and its alert. A start builds the ring again from the table, in
 * every mode: `boot` (a new process), `resync` (a reload after a diverged head, or after a reset
 * that failed) and `reset` (the reload after a demo reset). So after any start the audit view
 * verifies, and a fault list that still said "tampered" would contradict it: the list and the
 * view must agree. The shared transition clears the fault, resolves its alert and appends the
 * `FAULT_CLEARED` row without an actor; the caller writes that, and the health snapshot of the
 * clearing, through its unit.
 */
export function clearTamperOverlay(sim: Sim, now: number): boolean {
  const tampered = sim.store.getState().faults.active.some((fault) => fault.kind === FaultKind.AUDIT_TAMPER);
  if (tampered) sim.store.setState(clearFaultTransition(sim.store.getState(), now, FaultKind.AUDIT_TAMPER));
  return tampered;
}

/**
 * What a PROCESS START does to the state it rehydrated (spec §8.6, §12.3). Synchronous; it
 * changes the store and writes nothing. The caller writes the difference through its unit.
 *
 *   the restart fault   a session in PRECHECK, ARMED, RECORDING, STOPPING or FINALIZING when the
 *                       process stopped is moved to FAULT with the power-failure fault, by the
 *                       shared transition, with no actor, at `lastCommittedAt`: the Core
 *                       recorded nothing while the process was down, so the stop is not counted
 *                       as recording (decision D28 D-1). A session in FAULT stays as it is; one
 *                       in RECOVERY completes by its stored deadline at the first tick;
 *   the tamper overlay  what every start does (`clearTamperOverlay`), between the two;
 *   the tablet link     `heldLink` null, which is a process start: no socket is open, so the
 *                       link is OFFLINE until a paired device connects. If the stored value was
 *                       CONNECTED, the hosted action writes the truthful `TABLET_LINK_CHANGED`
 *                       row, at `now` (spec §8.6): the device's link did end when the process
 *                       stopped. `heldLink` given, which is a start in the mode `boot` of a
 *                       process whose engine already ran: the sockets are what they were, and
 *                       the link is the one the engine held (`carryTabletLink`).
 *
 * A CORE IN ITS OWN CAPTURE (`options.ownCapture`; fix wave I, finding G75b-03, ruling D216 (3)):
 *   - a session that was FINALIZING is NOT faulted (`OWN_CAPTURE_STATES_KEPT_AT_START`): no
 *     power-failure row, no alert; it stays FINALIZING and the seal resumes;
 *   - a stored CONNECTED link is put OFFLINE in the STATE and no row is written: the hosted
 *     action's sentence ("Tablet control offline - recording continues") states a tablet fault
 *     and a recording, and a stop of the Core is neither. The row of the link coming BACK is
 *     written by the channel when a paired device connects, as before.
 */
export function applyProcessStart(sim: Sim, lastCommittedAt: number, now: number, heldLink: TabletLink | null = null, options: ProcessStartOptions = {}): RestartEffects {
  const ownCapture = options.ownCapture === true;
  let faultedFrom: string | null = null;
  const session = sim.store.getState().session;
  if (session !== null && FAULTABLE_STATES.includes(session.state) && !(ownCapture && OWN_CAPTURE_STATES_KEPT_AT_START.includes(session.state))) {
    faultedFrom = session.state;
    // Never after `now`: the start raised the floor of the server clock to the newest stored
    // instant, which is at or after the last committed one, before it read `now` (decision D110).
    const at = Math.min(lastCommittedAt, now);
    // Closing pass J (G75b-03, ruling D217 (5)): on a Core in its own capture the fault says what the
    // Core knows - it was not running while the session was active - and carries `coreNotRunning`.
    // Same kind, same key, same move of the session, same `fromState`: only the words differ.
    let next: SimState = ownCapture ? coreNotRunningFaultTransition(sim.store.getState(), at) : injectFaultTransition(sim.store.getState(), at, FaultKind.POWER_FAIL);
    // A stored state that already held the fault flag without the session in FAULT: the flag
    // makes the shared injection a repeat, so the session is moved directly.
    if (next.session !== null && FAULTABLE_STATES.includes(next.session.state)) next = enterFault(next, at, FaultKind.POWER_FAIL);
    sim.store.setState(next);
  }

  // Fix wave K (G75c-01): a stored restart fault whose session has ended is over (`restart-fault.ts`).
  // AFTER the block above: the fault this start raised belongs to an open session and stays. A state
  // without such a fault is not touched, so a start with no session open writes nothing.
  const ended = endRestartFaultTransition(sim.store.getState(), now);
  const restartFaultEnded = ended !== sim.store.getState();
  if (restartFaultEnded) sim.store.setState(ended);
  const healed = restartFaultEnded ? { restartFaultEnded: true } : {};

  const tampered = clearTamperOverlay(sim, now);

  if (heldLink !== null) {
    return { faultedFrom, tamperCleared: tampered, tabletLinkReset: false, tabletLinkCarried: carryTabletLink(sim, heldLink), ...healed };
  }
  const connected = sim.store.getState().tabletLink.state === TabletLinkState.CONNECTED;
  if (connected && ownCapture) {
    // The fact, in the state, with the instant of this start; the other devices' entries are derived from it as the hosted action derives them. No row, no event.
    sim.store.setState(deriveDeviceState({ ...sim.store.getState(), tabletLink: { state: TabletLinkState.OFFLINE, changedAt: now } }));
    return { faultedFrom, tamperCleared: tampered, tabletLinkReset: false, tabletLinkCarried: false, tabletLinkOfflineUnwritten: true, ...healed };
  }
  const tabletLinkReset = connected;
  if (tabletLinkReset) sim.actions.setTabletLink(TabletLinkState.OFFLINE);

  return { faultedFrom, tamperCleared: tampered, tabletLinkReset, tabletLinkCarried: false, ...healed };
}
