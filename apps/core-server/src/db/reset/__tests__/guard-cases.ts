/**
 * The cases of step R-0 and of the refusals that follow it, on stand-in pools (plan row W29; not
 * a test file; nothing here imports Vitest).
 *
 * They need no database: a script answers the statements. That is how the role check is proven
 * without a superuser connection (T-RS-4; HC-1: nothing under `apps/core-server` connects as the
 * bootstrap superuser), and how a refusal is proven that the real server cannot be brought to
 * without one (a database that belongs to another role).
 *
 * The same cases run in the project `unit` (every gate, no database) and in the project `db`
 * (the row's own command, with T-RS-1 to T-RS-6 in one run).
 */
import type { ResetCheckpoint } from '../errors';
import { ResetError } from '../errors';
import { resetDatabase, type ResetLogEntry } from '../routine';
import { healthy, scriptOf, stubPools, type StubPools, type StubRow, type StubScript } from './pools';

export interface GuardRun {
  readonly error: ResetError | null;
  readonly pools: StubPools;
  readonly checkpoints: ResetCheckpoint[];
  readonly logged: ResetLogEntry[];
  readonly quiesced: number;
  readonly clockReads: number;
}

/** Runs the routine for `dems_lane_3` on stand-in pools and reports everything it did. */
export async function runOnStub(script: StubScript, options: { connectError?: Error; database?: string } = {}): Promise<GuardRun> {
  const pools = stubPools(script, options);
  const checkpoints: ResetCheckpoint[] = [];
  const logged: ResetLogEntry[] = [];
  let quiesced = 0;
  let clockReads = 0;
  const outcome = await resetDatabase(
    {
      database: options.database ?? 'dems_lane_3',
      // A directory that does not exist: with a stand-in pool the owner file is never read.
      dataDir: '/nonexistent/dems-w29',
      sessionDrainMs: 30,
      quiesce: () => void (quiesced += 1),
      clock: () => ((clockReads += 1), Date.UTC(2026, 9, 1, 4, 0, 0)),
      onCheckpoint: (checkpoint) => void checkpoints.push(checkpoint),
      log: (entry) => logged.push(entry),
    },
    { openPool: pools.openPool },
  ).then(
    () => null,
    (error: unknown) => error,
  );
  if (outcome !== null && !(outcome instanceof ResetError)) throw outcome;
  return { error: outcome, pools, checkpoints, logged, quiesced, clockReads };
}

/** T-RS-4: what `pg_roles` could answer for a connection that must not run a reset. */
export const PRIVILEGED_ANSWERS: ReadonlyArray<readonly [label: string, rows: StubRow[]]> = [
  ['the bootstrap superuser', [{ rolname: 'dems_admin', rolsuper: true }]],
  ['the owner role, were it ever made a superuser', [{ rolname: 'dems_owner', rolsuper: true }]],
  ['the runtime role', [{ rolname: 'dems_app', rolsuper: false }]],
  ['any other role', [{ rolname: 'postgres', rolsuper: false }]],
  ['no row at all', []],
  ['two rows', [{ rolname: 'dems_owner', rolsuper: false }, { rolname: 'dems_owner', rolsuper: false }]],
  ['a superuser flag that is not a boolean', [{ rolname: 'dems_owner', rolsuper: 'f' }]],
];

export const ROLE_CHECK = 'SELECT rolname::text AS rolname, rolsuper FROM pg_roles WHERE rolname = current_user';

/** A server that passes R-0 and R-1, and answers the catalog question of R-2 with `catalog`. */
export function upToCatalog(catalog: StubRow[]): StubScript {
  return scriptOf([
    ['FROM pg_roles', healthy.role()],
    ['pg_try_advisory_lock', healthy.lock()],
    ['server_version', healthy.version()],
    ['FROM pg_stat_activity', healthy.noSession()],
    ['FROM pg_database', catalog],
    ['pg_advisory_unlock', [{ unlocked: true }]],
  ]);
}
