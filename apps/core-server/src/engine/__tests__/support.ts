/**
 * Test support of the engine host (plan row W26; not a test file). Nothing here imports Vitest.
 *
 * What tests of several rows use (the manual timer, the counting pool, the engine app, the
 * readers of the stored slices and of the row counts) moved to the neutral folder
 * `test/support/engine.ts` in fix round B1 (review finding CPB1-12) and is RE-EXPORTED below, so
 * that every existing import of this path keeps working. Import `test/support/engine` in new
 * code.
 *
 * What stays here is private to the engine's own tests: seeding a scenario into a schema-only
 * clone, the meter frames among the publications, and the replay of state changes.
 */
import { AUDIT_RING_SIZE, EVENT_RING_SIZE, type ScenarioName } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { FIXED_NOW } from '../../../test/support/engine';
import type { DurableSlices } from '../../db/mapping';
import { seedDatabase } from '../../db/seed/seed';
import type { Publication } from '../../realtime';
import type { EngineStateChange } from '../index';

export * from '../../../test/support/engine';

// ── Seeding a scenario ─────────────────────────────────────────────────────────────────────────

export interface SeedTarget {
  ownerPool(): Pool;
}

/** Seeds a schema-only clone with a scenario at `now`, as the reset routine would leave it. */
export async function seedScenario(target: SeedTarget, scenario: ScenarioName, now: number = FIXED_NOW): Promise<void> {
  await seedDatabase(target.ownerPool(), { now, scenario, target: 'test' });
}

/** The meter frames among the publications. */
export function meterFrames(publications: readonly Publication[]) {
  return publications.flatMap((publication) => (publication.kind === 'meters' ? [publication.frame] : []));
}

/**
 * Applies the operations of state changes to a state, as a client of the realtime channel does
 * (spec §9.3): `replace` sets a slice, `append` adds rows to the ring of `audit` or `events`.
 */
export function applyChanges(start: DurableSlices, changes: readonly EngineStateChange[]): DurableSlices {
  const state: Record<string, unknown> = { ...start };
  for (const change of changes) {
    for (const op of change.ops) {
      if (op.op === 'replace') {
        state[op.slice] = op.value;
      } else if (op.slice === 'audit') {
        const audit = state['audit'] as DurableSlices['audit'];
        const rows = [...audit.rows, ...op.rows];
        state['audit'] = { rows: rows.slice(Math.max(0, rows.length - AUDIT_RING_SIZE)), head: op.head, total: op.total, dropped: op.dropped };
      } else {
        const events = [...(state['events'] as DurableSlices['events']), ...op.rows];
        state['events'] = events.slice(Math.max(0, events.length - EVENT_RING_SIZE));
      }
    }
  }
  return state as unknown as DurableSlices;
}
