/**
 * The answer of operation 71 `getDemoStatus` (plan row W43; spec §7.16; contract
 * `DemoStatusSchema`).
 *
 * Two sources, and nothing is kept between two calls:
 *
 *   the engine's committed state   `meta.scenario` and `faults.active`, by reference, with the
 *                                  engine's epoch;
 *   one row of `core_state`        when the state was seeded and when it was last reset. Those
 *                                  two instants are bookkeeping of the seed and of the reset
 *                                  routine: no slice of the engine holds them, so they are read
 *                                  where they are stored. The one statement of this folder that
 *                                  names a table, and it is a read.
 *
 * Pure functions; the read itself is done by the module's route.
 */
import type { DemoStatus } from '@dems/shared/api';
import { ScenarioName } from '@dems/shared/sim';
import type { DurableSlices } from '../../db/mapping';

/** `bigint` columns leave as decimal text and are checked here, never rounded by the driver. */
export const READ_SEED_FACTS = 'SELECT seeded_at::text AS seeded_at, last_reset_at::text AS last_reset_at FROM public.core_state';

export interface SeedFactsRow {
  readonly seeded_at: string;
  readonly last_reset_at: string | null;
}

/** When the stored state was seeded, and when a reset or a scenario load last rebuilt it. */
export interface SeedFacts {
  readonly seededAt: number;
  /** Null until the first reset or scenario load. */
  readonly lastResetAt: number | null;
}

function instantOf(text: string, column: string): number {
  const value = /^[0-9]{1,16}$/.test(text) ? Number(text) : Number.NaN;
  if (!Number.isSafeInteger(value)) throw new Error(`core_state.${column} is not an instant in milliseconds`);
  return value;
}

/**
 * The one row of `core_state`. A database without it is not seeded, and the server does not
 * start on one (boot check B-6): reaching this with no row is a defect, answered 500.
 */
export function seedFactsOf(rows: readonly SeedFactsRow[]): SeedFacts {
  const row = rows[0];
  if (rows.length !== 1 || row === undefined) throw new Error(`core_state holds ${rows.length} row(s); a seeded database holds one`);
  return {
    seededAt: instantOf(row.seeded_at, 'seeded_at'),
    lastResetAt: row.last_reset_at === null ? null : instantOf(row.last_reset_at, 'last_reset_at'),
  };
}

/** The scenarios the reset routine can load: the shared vocabulary, in its order. */
export const LOADABLE_SCENARIOS: readonly ScenarioName[] = Object.freeze(Object.values(ScenarioName));

/** `DemoStatus` of the contract, from the engine's committed state and the stored seed facts. */
export function demoStatusOf(state: Pick<DurableSlices, 'meta' | 'faults'>, epoch: number, facts: SeedFacts): DemoStatus {
  return {
    scenarios: [...LOADABLE_SCENARIOS],
    scenario: state.meta.scenario,
    activeFaults: state.faults.active.map((fault) => ({ kind: fault.kind, since: fault.since, target: fault.target })),
    seededAt: facts.seededAt,
    lastResetAt: facts.lastResetAt,
    epoch,
  };
}
