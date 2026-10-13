/**
 * THE LIFECYCLE of the ONE temporary host address (task 4 row 106, WP-19b; security items S13-08,
 * S13-09, S13-10; decisions C19, C53 (4), C64, C67).
 *
 * It stands on row 105's caller (`createHostAliasCaller`) and gives it its three parts: the
 * journal (`journal.ts`: the stored row, one intent and one result audit entry per action), the
 * facts reader (`facts.ts`) and the transport it is handed. Rows 107 and 111 use `acquire` and
 * `release`; operation 104 reads `state`; the composition calls `boot` and `shutdown`.
 *
 * WHEN AN ADDRESS IS TAKEN AWAY
 *   end of a job      `release({ removeReason: JOB_DONE })`, in the job's `finally`;
 *   by the technician `release({ removeReason: MANUAL })` (operation 105);
 *   end of lifetime   a timer of this file at the stored `expires_at` asks the helper to remove
 *                     (`EXPIRED`). THIS IS THE CORE'S SECOND LINE, NOT THE GUARANTEE: the guarantee
 *                     is the kernel lifetime the helper sets (hypothesis H-S, `9A/H-06`), and if H-S
 *                     fails, root's own timer in the helper (S13-10 (a)) - never the Core's memory;
 *   shutdown          `shutdown()`: no further `acquire`, the timer is dropped, the open row is removed;
 *   boot              `boot()`: THE SWEEP, below.
 * A removal that fails leaves the row OPEN with the code and arms a retry (at most
 * `HOST_ALIAS_REMOVE_RETRIES`, every `HOST_ALIAS_REMOVE_RETRY_MS`); then it is reported and left to
 * the kernel lifetime and to the next boot.
 *
 * `effect: UNKNOWN` IS "POSSIBLY IN PLACE". An `add` whose effect is not known (no answer, an
 * answer not of the table, a tool of the helper that did not answer) or whose result entry could
 * not be written keeps its open row, and a removal is attempted AT ONCE, with its own intent and
 * result. The address is never recorded as absent on a guess.
 *
 * THE BOOT SWEEP. Every open row is an address that may be on the host (a Core that died between
 * the intent and the result of an `add` left exactly that): each is removed through the helper
 * with `BOOT_SWEEP` and closed. Then every address the Core has NO ROW of and that may be marked:
 *   - what the camera interface holds now outside the camera subnet (the Core's own reading of the
 *     interface table), and
 *   - what the stored configuration can produce (when the composition hands that list in).
 * THE HELPER CANNOT LIST ITS MARKS (verbs `add`, `del`, root's `check`) and the Core does not read
 * the helper's folder. RESIDUAL: a marked address that is neither in a row, nor on the interface
 * the Core's row names, nor derivable from the configuration (a typed address whose row was lost,
 * with the interface file and the row disagreeing) is not swept; the helper's kernel lifetime
 * (at most 480 minutes) ends it, and the next `add` answers `HELPER_ALIAS_LIMIT_REACHED`, which is
 * reported as `HOST_ALIAS_UNRECORDED_MARK_SUSPECTED`.
 *
 * WHILE A SESSION IS OPEN an `add` and the technician's removal are refused and write nothing
 * (looked at here, and again inside the unit of the intent). The system's removals (end of job,
 * end of lifetime, shutdown, boot) are NOT held back: taking the temporary address away is the
 * safe direction (record 105 D-5, decision C53 (4)). DRIVER DECISION D-1 of row 106; the set
 * `REFUSED_WHILE_A_SESSION_IS_OPEN` is the one place.
 *
 * ONE AT A TIME. Actions run one after another (a queue, so row 105's `CALL_IN_PROGRESS` is never
 * met from here); an `add` while a row is open is refused before anything is sent, and the
 * table's own index refuses it again inside the intent.
 *
 * This file starts no process, opens no socket and no file, names no global timer (the capture
 * unit's `CaptureTimers` is handed in), reads no system time (the host's clock) and logs nothing
 * (`host.report`, codes and counts only).
 */
import type { CaptureTimers } from '../types';
import { createHostAliasCaller, type HostAliasFacts, type HostAliasOutcome, type HostAliasTransport } from './caller';
import { aliasAddressesHeld, hostAliasFactsReaderOf, type HostAliasFactSources } from './facts';
import { createHostAliasJournal, type HostAliasActor, type HostAliasHost, type HostAliasSubject, type HostAliasToken } from './journal';
import { aliasQuadOf, dottedOf } from './protocol';
import { HostAliasReason, HostAliasRemoveReason, createHostAliasStore, type HostAliasStore, type StoredHostAlias } from './store';

/** A retry of a removal that failed. */
export const HOST_ALIAS_REMOVE_RETRY_MS = 60_000;
export const HOST_ALIAS_REMOVE_RETRIES = 5;
export const HOST_ALIAS_READ_LABEL = 'hostAlias.read';

/** What is refused while a session is open. Everything else of this file only takes an address away. */
export const REFUSED_WHILE_A_SESSION_IS_OPEN: readonly string[] = Object.freeze(['ADD', HostAliasRemoveReason.MANUAL]);

/** The refusals of this file, beside those of row 105's caller and of the journal. */
export const HostAliasLifecycleRefusal = {
  // Row 106b: the CODE is not the text of a credential reveal reason (rule R-5 of the capture-config module keeps that
  // text to the reader, the audit writer and its fixture). The same value as the journal's.
  SESSION_OPEN: 'SESSION_IS_OPEN',
  ALIAS_ALREADY_OPEN: 'ALIAS_ALREADY_OPEN',
  SHUTTING_DOWN: 'SHUTTING_DOWN',
  /** The stored state could not be read: nothing was asked of the helper. */
  STATE_UNREADABLE: 'STATE_UNREADABLE',
  REASON_NOT_OF_SET: 'REASON_NOT_OF_SET',
  ACTOR_NOT_STATED: 'ACTOR_NOT_STATED',
  /** The helper was asked and its result entry could not be written. */
  RESULT_NOT_RECORDED: 'RESULT_NOT_RECORDED',
  UNNAMED_FAILURE: 'UNNAMED_FAILURE',
} as const;
export type HostAliasLifecycleRefusal = (typeof HostAliasLifecycleRefusal)[keyof typeof HostAliasLifecycleRefusal];

/** The alias in place, as operation 104 answers it. `address` has no prefix length (always /24). */
export interface HostAliasRecord {
  readonly aliasId: string;
  readonly address: string;
  readonly reason: HostAliasReason;
  readonly addedAt: number;
  readonly expiresAt: number;
  readonly removeError: string | null;
}

export interface HostAliasAcquireRequest {
  /** The temporary address, a dotted quad without prefix: anything. Judged by row 105's caller. */
  readonly address: unknown;
  /** The lifetime in minutes: anything. Only an integer 5 to 480 passes. */
  readonly minutes: unknown;
  readonly reason: HostAliasReason;
  readonly actor: HostAliasActor;
}

export type HostAliasAcquired =
  | { readonly ok: true; readonly alias: HostAliasRecord }
  | {
      readonly ok: false;
      /** A CODE: of this file, of the journal, or of row 105's caller. */
      readonly refusal: string;
      /** True when an address may be on the host after this call (the removal of a possibly-added address failed, or another alias is open). */
      readonly stillInPlace: boolean;
    };

export interface HostAliasReleaseRequest {
  readonly removeReason: typeof HostAliasRemoveReason.JOB_DONE | typeof HostAliasRemoveReason.MANUAL;
  /** null: the system. */
  readonly actor: HostAliasActor | null;
}

export type HostAliasReleased =
  | { readonly ok: true; /** False: none was in place; nothing was asked and nothing written. */ readonly removed: boolean }
  | { readonly ok: false; readonly refusal: string; /** True when a row is (or may be) still open. */ readonly stillInPlace: boolean };

export interface HostAliasSwept {
  /** Dotted quad, no prefix. */
  readonly address: string;
  readonly hadRow: boolean;
  readonly attempted: boolean;
  readonly effect: HostAliasOutcome['effect'];
  readonly refusal: string | null;
  readonly resultRecorded: boolean;
}

export interface HostAliasSweepReport {
  /** False: the stored rows could not be read; nothing was asked. */
  readonly stateRead: boolean;
  /** False: the interface table was not known; only rows and the configuration's candidates were asked. */
  readonly interfaceTableRead: boolean;
  readonly swept: readonly HostAliasSwept[];
  /** True when a row is still open after the sweep (its removal failed): a retry is armed. */
  readonly stillOpen: boolean;
}

export interface HostAliasLifecycle {
  /** The alias in place, or null: a plain read of the open row. Rejects only with what the read threw. */
  state(): Promise<HostAliasRecord | null>;
  /** Never rejects. */
  acquire(request: HostAliasAcquireRequest): Promise<HostAliasAcquired>;
  /** Never rejects. */
  release(request: HostAliasReleaseRequest): Promise<HostAliasReleased>;
  /** The boot sweep. Never rejects. */
  boot(): Promise<HostAliasSweepReport>;
  /** The shutdown removal; after it every `acquire` is refused. Never rejects. */
  shutdown(): Promise<HostAliasReleased>;
}

export interface HostAliasLifecycleDeps {
  /** The platform's transport (`hostAliasSocketTransportOf` of `src/host-alias-socket.ts`), made outside the capture area. */
  readonly transport: HostAliasTransport;
  readonly host: HostAliasHost;
  readonly sources: HostAliasFactSources;
  readonly timers: CaptureTimers;
  /** Left out: the folder's own statements. */
  readonly store?: HostAliasStore;
  /**
   * Every address the stored configuration can produce as a temporary address
   * (`aliasCandidatesOfConfiguration`), read at the sweep. Left out: the sweep asks about the rows
   * and the interface table only.
   */
  readonly configuredCandidates?: () => Promise<readonly unknown[]> | readonly unknown[];
}

const NOT_MARKED = 'HELPER_NOT_MARKED';
const LIMIT_REACHED = 'HELPER_ALIAS_LIMIT_REACHED';
const literalOf = (address: string): string => (address.endsWith('/24') ? address.slice(0, -3) : address);
const recordOf = (row: StoredHostAlias): HostAliasRecord =>
  Object.freeze({ aliasId: row.id, address: literalOf(row.address), reason: row.reason, addedAt: row.addedAt, expiresAt: row.expiresAt, removeError: row.removeError });
const isActor = (actor: unknown): actor is HostAliasActor =>
  typeof actor === 'object' && actor !== null && typeof (actor as HostAliasActor).operatorId === 'string' && typeof (actor as HostAliasActor).operationId === 'string' && typeof (actor as HostAliasActor).permission === 'string';

/**
 * THE ALIAS STATE AS A PLAIN READ (operation 104): the one open row, or null. No helper call, no
 * write, no lifecycle object needed: a route hands in the Core's read and nothing else. Rejects
 * only with what the read threw (`HostAliasRowError` for a row outside the table's definition).
 */
export async function readHostAliasState(host: Pick<HostAliasHost, 'read'>, store: HostAliasStore = createHostAliasStore()): Promise<HostAliasRecord | null> {
  const rows = await host.read(HOST_ALIAS_READ_LABEL, (db) => store.readOpen(db));
  return rows[0] === undefined ? null : recordOf(rows[0]);
}

export function createHostAliasLifecycle(deps: HostAliasLifecycleDeps): HostAliasLifecycle {
  const { host, timers } = deps;
  const store = deps.store ?? createHostAliasStore();

  // The stored interface of the facts read for the `add` in flight: what the row is opened with.
  let interfaceOfThisAdd: string | null = null;
  const readFacts = hostAliasFactsReaderOf(deps.sources);
  const facts = async (): Promise<HostAliasFacts> => {
    const read = await readFacts();
    interfaceOfThisAdd = typeof read.storedInterface === 'string' ? read.storedInterface : null;
    return read;
  };
  const journal = createHostAliasJournal({ host, store, interfaceName: () => interfaceOfThisAdd });
  const caller = createHostAliasCaller<HostAliasSubject, HostAliasToken>({ transport: deps.transport, journal, facts });

  let closed = false;
  let cancelTimer: (() => void) | null = null;
  let retriesLeft = HOST_ALIAS_REMOVE_RETRIES;

  // ── One action at a time ─────────────────────────────────────────────────────────────────────
  let tail: Promise<unknown> = Promise.resolve();
  function serial<Value>(work: () => Promise<Value>): Promise<Value> {
    const run = tail.then(work, work);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  const report = (code: string, facts_: Readonly<Record<string, string | number | boolean | null>>): void => {
    try {
      host.report(code, facts_);
    } catch {
      // A report that cannot be written changes nothing of the act.
    }
  };
  function sessionOpen(): boolean {
    try {
      return host.sessionOpen();
    } catch {
      // A state that cannot be read is not "idle".
      return true;
    }
  }
  async function openRows(): Promise<readonly StoredHostAlias[] | null> {
    try {
      return await host.read(HOST_ALIAS_READ_LABEL, (db) => store.readOpen(db));
    } catch {
      report('HOST_ALIAS_STATE_UNREADABLE', {});
      return null;
    }
  }

  // ── The timer ────────────────────────────────────────────────────────────────────────────────
  function disarm(): void {
    if (cancelTimer !== null) cancelTimer();
    cancelTimer = null;
  }
  /**
   * `repeated` = the removal a RETRY repeats: it keeps that removal's reason and actor (caution
   * R119-05: a technician's `MANUAL` must not come back as another word with no actor). Without
   * it this is the LIFETIME timer, armed for the stored end: `EXPIRED`, also when the clock reads
   * earlier than that end at the moment it fires (a clock that went back) - no job was done.
   */
  function arm(delayMs: number, repeated: { readonly reasonOf: (row: StoredHostAlias) => HostAliasRemoveReason; readonly actor: HostAliasActor | null } | null = null): void {
    disarm();
    if (closed) return;
    cancelTimer = timers.after(Math.max(0, delayMs), () => {
      cancelTimer = null;
      void serial(async () => {
        if (closed) return;
        await removeOpen(repeated === null ? () => HostAliasRemoveReason.EXPIRED : repeated.reasonOf, repeated === null ? null : repeated.actor, false);
      });
    });
  }

  // ── One removal through the helper ───────────────────────────────────────────────────────────
  interface Removal {
    readonly outcome: HostAliasOutcome;
    readonly refusal: string | null;
    /** True when the address is known to be gone AND its result is on record. */
    readonly gone: boolean;
  }
  async function removeOne(address: string, subject: Extract<HostAliasSubject, { action: 'REMOVE' }>): Promise<Removal> {
    const outcome = await caller.remove({ address, subject });
    const refusal = outcome.attempted ? outcome.refusal : (journal.takeRefusal() ?? outcome.refusal);
    if (outcome.attempted && !outcome.resultRecorded) report('HOST_ALIAS_RESULT_NOT_RECORDED', { action: 'REMOVE', removeReason: subject.removeReason, hadRow: subject.aliasId !== null });
    const gone = outcome.attempted && outcome.resultRecorded && ((outcome.effect === 'DONE' && outcome.refusal === null) || outcome.refusal === NOT_MARKED);
    return { outcome, refusal: outcome.attempted && !outcome.resultRecorded ? HostAliasLifecycleRefusal.RESULT_NOT_RECORDED : refusal, gone };
  }

  /** Removes every open row (one, by the table's index). Arms a retry when one stays open. Not queued: its callers are. */
  async function removeOpen(reasonOf: (row: StoredHostAlias) => HostAliasRemoveReason, actor: HostAliasActor | null, idleOnly: boolean, swept?: HostAliasSwept[]): Promise<HostAliasReleased> {
    const rows = await openRows();
    if (rows === null) return { ok: false, refusal: HostAliasLifecycleRefusal.STATE_UNREADABLE, stillInPlace: true };
    if (rows.length === 0) {
      disarm();
      return { ok: true, removed: false };
    }
    let failed: string | null = null;
    for (const row of rows) {
      const removeReason = reasonOf(row);
      const removal = await removeOne(literalOf(row.address), { action: 'REMOVE', removeReason, aliasId: row.id, actor, idleOnly });
      swept?.push(Object.freeze({ address: literalOf(row.address), hadRow: true, attempted: removal.outcome.attempted, effect: removal.outcome.effect, refusal: removal.outcome.refusal, resultRecorded: removal.outcome.resultRecorded }));
      if (!removal.gone) failed = removal.refusal ?? HostAliasLifecycleRefusal.UNNAMED_FAILURE;
    }
    if (failed === null) {
      disarm();
      retriesLeft = HOST_ALIAS_REMOVE_RETRIES;
      return { ok: true, removed: true };
    }
    if (failed !== HostAliasLifecycleRefusal.SESSION_OPEN) {
      if (retriesLeft > 0) {
        retriesLeft -= 1;
        arm(HOST_ALIAS_REMOVE_RETRY_MS, { reasonOf, actor });
      } else {
        report('HOST_ALIAS_REMOVAL_GIVEN_UP', { failureReason: failed });
      }
    }
    return { ok: false, refusal: failed, stillInPlace: true };
  }

  // ── The door ─────────────────────────────────────────────────────────────────────────────────
  const state = (): Promise<HostAliasRecord | null> => readHostAliasState(host, store);

  const refused = (refusal: string, stillInPlace: boolean): HostAliasAcquired => Object.freeze({ ok: false, refusal, stillInPlace });

  function acquire(request: HostAliasAcquireRequest): Promise<HostAliasAcquired> {
    return serial(async (): Promise<HostAliasAcquired> => {
      try {
        if (closed) return refused(HostAliasLifecycleRefusal.SHUTTING_DOWN, false);
        if (request.reason !== HostAliasReason.FACTORY_SCAN && request.reason !== HostAliasReason.SET_CAMERA_ADDRESS) return refused(HostAliasLifecycleRefusal.REASON_NOT_OF_SET, false);
        if (!isActor(request.actor)) return refused(HostAliasLifecycleRefusal.ACTOR_NOT_STATED, false);
        if (sessionOpen()) return refused(HostAliasLifecycleRefusal.SESSION_OPEN, false);
        const before = await openRows();
        if (before === null) return refused(HostAliasLifecycleRefusal.STATE_UNREADABLE, false);
        if (before.length > 0) return refused(HostAliasLifecycleRefusal.ALIAS_ALREADY_OPEN, true);

        interfaceOfThisAdd = null;
        const outcome = await caller.add({ address: request.address, minutes: request.minutes, subject: { action: 'ADD', reason: request.reason, actor: request.actor } });
        if (!outcome.attempted) return refused(journal.takeRefusal() ?? outcome.refusal ?? HostAliasLifecycleRefusal.UNNAMED_FAILURE, false);
        if (!outcome.resultRecorded) report('HOST_ALIAS_RESULT_NOT_RECORDED', { action: 'ADD' });

        if (outcome.resultRecorded && outcome.effect === 'DONE' && outcome.refusal === null) {
          const after = await openRows();
          const row = after?.[0];
          if (row !== undefined) {
            retriesLeft = HOST_ALIAS_REMOVE_RETRIES;
            arm(row.expiresAt - host.now());
            return Object.freeze({ ok: true, alias: recordOf(row) });
          }
        } else if (outcome.resultRecorded && outcome.effect === 'NOT_DONE') {
          // Certainly nothing was added and the row is closed. A helper that holds a mark the Core has no row of says so here.
          if (outcome.refusal === LIMIT_REACHED) report('HOST_ALIAS_UNRECORDED_MARK_SUSPECTED', {});
          return refused(outcome.refusal ?? HostAliasLifecycleRefusal.UNNAMED_FAILURE, false);
        }
        // UNKNOWN, a result that is not on record, or a row that cannot be read back: POSSIBLY IN PLACE. Take it away now.
        // `ADD_UNCONFIRMED`, the table's own word since schema version 13 (caution R119-05, decision C94 (d)): no job ran.
        const cleaned = await removeOpen(() => HostAliasRemoveReason.ADD_UNCONFIRMED, null, false);
        return refused(outcome.resultRecorded ? (outcome.refusal ?? HostAliasLifecycleRefusal.STATE_UNREADABLE) : HostAliasLifecycleRefusal.RESULT_NOT_RECORDED, !cleaned.ok);
      } catch {
        report('HOST_ALIAS_LIFECYCLE_DEFECT', { action: 'ADD' });
        return refused(HostAliasLifecycleRefusal.UNNAMED_FAILURE, true);
      }
    });
  }

  function release(request: HostAliasReleaseRequest): Promise<HostAliasReleased> {
    return serial(async (): Promise<HostAliasReleased> => {
      try {
        const removeReason = request.removeReason === HostAliasRemoveReason.MANUAL ? HostAliasRemoveReason.MANUAL : HostAliasRemoveReason.JOB_DONE;
        const idleOnly = REFUSED_WHILE_A_SESSION_IS_OPEN.includes(removeReason);
        // Not looked at further: with a session open the technician's removal asks and writes nothing.
        if (idleOnly && sessionOpen()) return { ok: false, refusal: HostAliasLifecycleRefusal.SESSION_OPEN, stillInPlace: true };
        return await removeOpen(() => removeReason, isActor(request.actor) ? request.actor : null, idleOnly);
      } catch {
        report('HOST_ALIAS_LIFECYCLE_DEFECT', { action: 'REMOVE' });
        return { ok: false, refusal: HostAliasLifecycleRefusal.UNNAMED_FAILURE, stillInPlace: true };
      }
    });
  }

  function boot(): Promise<HostAliasSweepReport> {
    return serial(async (): Promise<HostAliasSweepReport> => {
      const swept: HostAliasSwept[] = [];
      let interfaceTableRead = false;
      try {
        const rows = await openRows();
        if (rows === null) return Object.freeze({ stateRead: false, interfaceTableRead, swept: Object.freeze(swept), stillOpen: true });
        const withRow = new Set(rows.map((row) => literalOf(row.address)));
        // 1. Every open row: an address that may be on the host, whatever the Core did before it stopped.
        const released = rows.length === 0 ? null : await removeOpen(() => HostAliasRemoveReason.BOOT_SWEEP, null, false, swept);

        // 2. Every address the Core has no row of and that may be marked.
        const held = aliasAddressesHeld(deps.sources.network);
        interfaceTableRead = held !== null;
        let configured: readonly unknown[] = [];
        try {
          configured = deps.configuredCandidates === undefined ? [] : await deps.configuredCandidates();
        } catch {
          report('HOST_ALIAS_SWEEP_CANDIDATES_UNREADABLE', {});
        }
        const candidates = new Set<string>();
        for (const value of [...(held ?? []), ...(Array.isArray(configured) ? configured : [])]) {
          const decided = aliasQuadOf(value);
          if (decided.ok && !withRow.has(dottedOf(decided.quad))) candidates.add(dottedOf(decided.quad));
        }
        for (const address of candidates) {
          const removal = await removeOne(address, { action: 'REMOVE', removeReason: HostAliasRemoveReason.BOOT_SWEEP, aliasId: null, actor: null, idleOnly: false });
          swept.push(Object.freeze({ address, hadRow: false, attempted: removal.outcome.attempted, effect: removal.outcome.effect, refusal: removal.outcome.refusal, resultRecorded: removal.outcome.resultRecorded }));
          // A helper that cannot be reached is not asked again for the next candidate.
          if (!removal.outcome.attempted) break;
        }
        return Object.freeze({ stateRead: true, interfaceTableRead, swept: Object.freeze(swept), stillOpen: released !== null && !released.ok });
      } catch {
        report('HOST_ALIAS_LIFECYCLE_DEFECT', { action: 'BOOT_SWEEP' });
        return Object.freeze({ stateRead: false, interfaceTableRead, swept: Object.freeze(swept), stillOpen: true });
      }
    });
  }

  function shutdown(): Promise<HostAliasReleased> {
    return serial(async (): Promise<HostAliasReleased> => {
      // From here on nothing is added and no retry is armed: what stays open is the next boot's.
      closed = true;
      disarm();
      try {
        // `SHUTDOWN`, the table's own word since schema version 12 (decision C74 D-2): no job finished here.
        return await removeOpen(() => HostAliasRemoveReason.SHUTDOWN, null, false);
      } catch {
        report('HOST_ALIAS_LIFECYCLE_DEFECT', { action: 'SHUTDOWN' });
        return { ok: false, refusal: HostAliasLifecycleRefusal.UNNAMED_FAILURE, stillInPlace: true };
      }
    });
  }

  return Object.freeze({ state, acquire, release, boot, shutdown });
}
