/**
 * Helpers left by an earlier run (blueprint row 134 for row 136; capture spec §A.6.4 HL-8, erratum
 * PE-128-63; SEC35-43; check `M4-SEC-HELPER-1`).
 *
 * At boot in development mode the Core looks for processes of the helper program that it did not
 * start, and refuses to start capture while one is left. It KILLS NOTHING it did not start: this
 * function only counts. The process table is read through the door, by the fixed program below;
 * a program is recognised by the exact path it was started with.
 *
 * THE PLATFORM SEAM (task 4, blueprint row 24, WP-02; requirement HA-12, review finding P12-F12 b).
 * The table's second column is not the same thing on the two hosts:
 *   - macOS prints the path the program was started with, so a row is compared with the program;
 *   - Linux prints the SHORT NAME (the first 15 characters of the file name), so a comparison with
 *     a path never matches. There a row that carries the short name of a program is a CANDIDATE,
 *     and the program path of that process is read through `ProgramPathReader`.
 * The reader is injected. `programPathReaderFor` hands out the Linux reading (the link
 * `/proc/<pid>/exe`, read by a fixed program through the same door) and nothing for macOS. The
 * Linux reading has run against a double only: the real one is hardware check `9A/H-24`.
 */
import type { CaptureTimers } from '../../types';
import type { HelperDoor } from './process-door';

const PROCESS_TABLE = '/bin/ps';
const PROCESS_TABLE_ARGUMENTS = ['-axo', 'pid=,comm='] as const;
/** Reads one link and prints its target. Linux only (`programPathReaderFor`). */
const PROGRAM_LINK = '/usr/bin/readlink';
/** How long one reading through the door may take. */
const READING_BOUND_MS = 5_000;
/** The length of a short name in the Linux process table (the kernel keeps 16 bytes, the last is the end mark). */
const SHORT_NAME_LENGTH = 15;
/** What Linux appends to the link of a process whose program file was replaced or removed after it started. */
const REMOVED_MARK = ' (deleted)';

/**
 * At most this many candidates are asked for their program path in one check. More than that is
 * answered like a table that could not be read (null): the check never starts an unbounded number
 * of processes.
 */
export const LEFTOVER_CANDIDATE_LIMIT = 64;

/** A live process of one of the programs looked for, that the Core did not start. */
export interface LeftoverProcess {
  readonly pid: number;
  /** The program of the list it is counted under. */
  readonly program: string;
}

/**
 * The seam: the absolute path of the program a process runs, or null when it cannot be read (the
 * process has ended, it belongs to another user, the reading failed). It must not throw.
 */
export type ProgramPathReader = (pid: number) => Promise<string | null>;

/** The name the Linux process table prints for a program: its file name, cut at 15 characters. */
export function processShortName(program: string): string {
  return program.slice(program.lastIndexOf('/') + 1).slice(0, SHORT_NAME_LENGTH);
}

/** The Linux reading of a program path: the target of `/proc/<pid>/exe`, read through the door. */
export function linuxProgramPathReader(door: HelperDoor, timers: CaptureTimers): ProgramPathReader {
  return async (pid) => {
    if (!Number.isSafeInteger(pid) || pid <= 0) return null;
    const child = door({ command: PROGRAM_LINK, args: [`/proc/${pid}/exe`] });
    const cancel = timers.after(READING_BOUND_MS, () => child.kill('SIGKILL'));
    const exit = await child.ended;
    cancel();
    if (exit.spawnFailed || exit.exitCode !== 0) return null;
    const target = exit.output.endsWith('\n') ? exit.output.slice(0, -1) : exit.output;
    if (!target.startsWith('/') || target.includes('\n')) return null;
    return target.endsWith(REMOVED_MARK) ? target.slice(0, -REMOVED_MARK.length) : target;
  };
}

/**
 * The reader of a platform (`process.platform` of the caller: this file reads nothing of the
 * process). Linux: the link reading. Every other platform: none, the table's own column is the path.
 */
export function programPathReaderFor(platform: string, door: HelperDoor, timers: CaptureTimers): ProgramPathReader | undefined {
  return platform === 'linux' ? linuxProgramPathReader(door, timers) : undefined;
}

/**
 * The live processes of `programs` (absolute paths) that are not in `own`, each named by its
 * program. Null when the table could not be read, or when it holds more candidates than
 * `LEFTOVER_CANDIDATE_LIMIT`. Nothing is killed.
 *
 * A row equal to a program is that program (the macOS form). With a reader, a row that carries the
 * short name of a program is asked for its path (the Linux form): an equal path is that program,
 * another path is somebody else's program of the same name and is not counted, and a path that
 * CANNOT BE READ is counted under the program whose short name it carries - a check that cannot
 * see does not answer "nothing is left".
 */
export async function leftoverPrograms(
  door: HelperDoor,
  timers: CaptureTimers,
  programs: readonly string[],
  own: ReadonlySet<number> = new Set(),
  readProgramPath?: ProgramPathReader,
): Promise<readonly LeftoverProcess[] | null> {
  const child = door({ command: PROCESS_TABLE, args: PROCESS_TABLE_ARGUMENTS });
  const cancel = timers.after(READING_BOUND_MS, () => child.kill('SIGKILL'));
  const exit = await child.ended;
  cancel();
  if (exit.spawnFailed || exit.exitCode !== 0) return null;
  const found: LeftoverProcess[] = [];
  let asked = 0;
  for (const line of exit.output.split('\n')) {
    const row = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (row === null) continue;
    const pid = Number(row[1]);
    const name = row[2] ?? '';
    if (own.has(pid)) continue;
    if (programs.includes(name)) {
      found.push({ pid, program: name });
      continue;
    }
    if (readProgramPath === undefined) continue;
    const sameName = programs.filter((program) => processShortName(program) === name);
    const first = sameName[0];
    if (first === undefined) continue;
    asked += 1;
    if (asked > LEFTOVER_CANDIDATE_LIMIT) return null;
    const path = await readProgramPath(pid);
    if (path === null) found.push({ pid, program: first });
    else if (sameName.includes(path)) found.push({ pid, program: path });
  }
  return Object.freeze(found.map((process) => Object.freeze(process)));
}

/**
 * The pids of live processes whose program is exactly `program` and that are not in `own`. Null when the table could not be read.
 * Without `readProgramPath` only the macOS form of the table is recognised (see the head of this file).
 */
export async function leftoverHelperPids(
  door: HelperDoor,
  timers: CaptureTimers,
  program: string,
  own: ReadonlySet<number> = new Set(),
  readProgramPath?: ProgramPathReader,
): Promise<readonly number[] | null> {
  const found = await leftoverPrograms(door, timers, [program], own, readProgramPath);
  return found === null ? null : Object.freeze(found.map((process) => process.pid));
}
