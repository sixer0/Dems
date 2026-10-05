/**
 * Write-through: what one unit of work writes when the engine's state moved (plan row W26; spec
 * ENG-4, ENG-10, §8.7; database contract MR-1, MR-6 to MR-8, §6.4 AP-6; `21_core_services.md`
 * §4.2; `20_db_mapping_seed.md` §4).
 *
 * THE RULE. `flushed` is what the tables hold inside this unit: the engine's durable slices at
 * the last write, by reference. `target` is what they shall hold. The one mapping module turns
 * the two into row changes; a slice whose reference did not change costs one comparison and
 * yields nothing (ENG-4). This file adds nothing to that mapping and holds no column name.
 *
 * WHO WRITES WHAT.
 *   audit rows   `unit.audit.appendPrepared`: the rows above the last written total, exactly as
 *                the shared chain built them (MR-7). An altered ring row is never among them, so
 *                the `AUDIT_TAMPER` demo fault cannot reach the table (SR-59);
 *   events       `unit.events.appendPrepared`;
 *   the rest     `applyChanges` of the store, on the unit's own database object. Inserts into
 *                the two tables above through that object are refused by the unit;
 *   health rows  one INSERT into `health_snapshots` per row (E-25).
 *
 * WHAT IS NEVER WRITTEN. `audio` (the 20 Hz meter frames), `clock`, `auth`, `authLockout` and
 * `pairing` are not durable slices: the mapping does not know them, and nothing here names them.
 * `operators` is durable and server-owned: it is mirrored INTO the engine and never written out.
 *
 * ONE CUT (finding F71; decision D104). The target of a plan is always the engine's WHOLE durable
 * state: a unit that writes a record slice writes the snapshot slices that changed with it. There
 * is no plan for the records alone. What the host may postpone is a unit that would write
 * snapshot slices only (at most one such write a second by a tick); it then plans nothing at all.
 */
import type { AuditRow, SimEvent, SimState } from '@dems/shared/sim';
import type { UnitContext } from '../core';
import {
  diffSlices,
  healthSnapshotToRow,
  newAuditRows,
  newEvents,
  pickDurable,
  type DurableSlices,
  type HealthSnapshotCause,
  type RowChange,
} from '../db/mapping';
import { healthSnapshots, type NewHealthSnapshotRow } from '../db/schema';
import { applyChanges } from '../db/store';

/** What a unit sends for one move of the engine's state. */
export interface WritePlan {
  /** The durable slices the tables hold once the plan is applied. */
  readonly target: DurableSlices;
  /** The engine's new audit rows, in chain order. */
  readonly auditRows: AuditRow[];
  readonly events: SimEvent[];
  /** Every other row change, in write order. */
  readonly rowChanges: RowChange[];
  readonly healthRows: NewHealthSnapshotRow[];
  /** True when the plan updates the hardware snapshot row. */
  readonly writesSnapshot: boolean;
  /** True when the plan sends no statement at all. */
  readonly empty: boolean;
}

type FaultEntry = SimState['faults']['active'][number];

const sameFault = (a: FaultEntry, b: FaultEntry): boolean => a.kind === b.kind && a.target === b.target;

/**
 * One health snapshot row per fault that `next` holds and `previous` did not (raised), and per
 * fault that `previous` held and `next` does not (cleared), in that order (spec §8.7).
 */
export function faultCauses(previous: Pick<SimState, 'faults'>, next: Pick<SimState, 'faults'>): HealthSnapshotCause[] {
  if (previous.faults === next.faults) return [];
  const raised = next.faults.active.filter((fault) => !previous.faults.active.some((old) => sameFault(old, fault)));
  const cleared = previous.faults.active.filter((old) => !next.faults.active.some((fault) => sameFault(old, fault)));
  return [
    ...raised.map((fault): HealthSnapshotCause => ({ cause: 'FAULT_RAISED', faultKind: fault.kind })),
    ...cleared.map((fault): HealthSnapshotCause => ({ cause: 'FAULT_CLEARED', faultKind: fault.kind })),
  ];
}

export interface PlanOptions {
  /** The server clock instant of the write: `updated_at`, `written_at`, and `at` of a health row. */
  readonly at: number;
  /** The engine's whole state: the source of a health snapshot row. */
  readonly state: SimState;
  /** True when the 60 s health snapshot is due. */
  readonly intervalSnapshot?: boolean;
}

/**
 * The plan that brings the tables from `flushed` to `target`. Pure; throws a `MappingError`
 * when the move cannot be written exactly (a sealed column changed, a ring lost rows, a value
 * PostgreSQL cannot store): the caller sets the engine's state back.
 */
export function planWrite(flushed: DurableSlices, target: DurableSlices, options: PlanOptions): WritePlan {
  const changes = diffSlices(flushed, target, options.at);
  const rowChanges = changes.filter((change) => change.table !== 'auditLog' && change.table !== 'events');
  const auditRows = newAuditRows(flushed, target);
  const events = newEvents(flushed, target);
  const causes: HealthSnapshotCause[] = [...faultCauses(flushed, target)];
  if (options.intervalSnapshot === true) causes.push({ cause: 'INTERVAL' });
  const healthRows = causes.map((cause) => healthSnapshotToRow(options.state, options.at, cause));
  return {
    target,
    auditRows,
    events,
    rowChanges,
    healthRows,
    writesSnapshot: rowChanges.some((change) => change.table === 'hardwareSnapshot'),
    empty: changes.length === 0 && healthRows.length === 0,
  };
}

/** The durable slices of the engine's state, by reference. */
export function durableOf(state: SimState): DurableSlices {
  return pickDurable(state);
}

/**
 * Sends a plan through `unit`, in this order: the audit rows (they must continue the unit's
 * head, AP-6), the events, the other changes parents first, the health rows. A plan that is
 * empty sends nothing and opens no transaction.
 */
export async function applyPlan(unit: UnitContext, plan: WritePlan): Promise<void> {
  if (plan.empty) return;
  await unit.audit.appendPrepared(plan.auditRows);
  await unit.events.appendPrepared(plan.events);
  await applyChanges(unit.db, plan.rowChanges);
  for (const row of plan.healthRows) await unit.db.insert(healthSnapshots).values(row);
}
