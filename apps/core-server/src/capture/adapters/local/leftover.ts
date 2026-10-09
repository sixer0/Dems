/**
 * Helpers left by an earlier run (blueprint row 134 for row 136; capture spec §A.6.4 HL-8, erratum
 * PE-128-63; SEC35-43; check `M4-SEC-HELPER-1`).
 *
 * At boot in development mode the Core looks for processes of the helper program that it did not
 * start, and refuses to start capture while one is left. It KILLS NOTHING it did not start: this
 * function only counts. The process table is read through the door, by the fixed program below;
 * a program is recognised by the exact path it was started with.
 */
import type { CaptureTimers } from '../../types';
import type { HelperDoor } from './process-door';

const PROCESS_TABLE = '/bin/ps';
const PROCESS_TABLE_ARGUMENTS = ['-axo', 'pid=,comm='] as const;

/** The pids of live processes whose program is exactly `program` and that are not in `own`. Null when the table could not be read. */
export async function leftoverHelperPids(door: HelperDoor, timers: CaptureTimers, program: string, own: ReadonlySet<number> = new Set()): Promise<readonly number[] | null> {
  const child = door({ command: PROCESS_TABLE, args: PROCESS_TABLE_ARGUMENTS });
  const cancel = timers.after(5_000, () => child.kill('SIGKILL'));
  const exit = await child.ended;
  cancel();
  if (exit.spawnFailed || exit.exitCode !== 0) return null;
  const pids: number[] = [];
  for (const line of exit.output.split('\n')) {
    const row = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (row === null || row[2] !== program) continue;
    const pid = Number(row[1]);
    if (!own.has(pid)) pids.push(pid);
  }
  return Object.freeze(pids);
}
