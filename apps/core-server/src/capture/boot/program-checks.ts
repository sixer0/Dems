/**
 * THE BOOT CHECKS OF THE DELIVERED PROGRAMS (task 4, blueprint row 81, work package WP-20; design
 * addendum 2.5 (e) and F10 (d); decision C19 with `decisions/103_helper_privilege_form.md` 6.1; items
 * HOST-44 to HOST-46 of `scripts/host/HOST-PROFILE-UBUNTU-24.04.md`).
 *
 * FOUR CHECKS, asked in REAL_PRODUCTION only, after the host checks of row 80 (`host-checks.ts`) and
 * before the worker is started:
 *
 *   1. THE RELAY: the path rule of check 2 once more (nothing is started from a path that fails it),
 *      then ITS STATED MEDIA LIBRARY. The relay is started the way a session starts it - no argument -
 *      and is given NO start message. Its interface answers with an exit code (`relay.h`, `RelayCode`):
 *      12 says "the libavformat I run with is not the one I was built for"; 10 or 11 says it came past
 *      that statement and then found no start message. Nothing of a camera is contacted: it has no
 *      address. Asked on every platform (the exit codes are the relay's own).
 *   2. THE HELPER FILE of the address helper: a regular file, owner root, not writable by group or
 *      others, in a directory of root that they cannot write either (HOST-45).
 *   3. THE GRANT (decision C19: a root service on a local socket, no sudoers line): the directory of
 *      the socket and the two unit files, each owned by root and not writable by group or others
 *      (HOST-44). The socket node itself is row 80's question (`CAPTURE_HOST_ALIAS_SOCKET`).
 *   4. THE INTERFACE FILE against THE STORED ROW: the one line of the root-owned interface file names
 *      the interface that `capture_network_config.interface_name` names (HOST-46). A file that names
 *      another interface than the row is the named refusal `CAPTURE_HOST_INTERFACE_FILE_MISMATCH` /
 *      `INTERFACE_FILE_DIFFERS_FROM_ROW`. A database with no stored interface has nothing to agree
 *      with: the file is not read, and that is a status (`NOT_ASKED`), not a pass.
 *
 * THIS FILE STARTS NO PROCESS AND READS NO FILE AND NO DATABASE. Every question goes through the
 * INJECTED runner of row 80 (`HostCommandRunner`; static rule SR-1 is not extended), the stored
 * interface through an injected reader. Checks 2 to 4 are questions to a Linux host and are asked on
 * `linux` only.
 *
 * WHAT IS SAID ABOUT A FAILURE: a code and a reason, both fixed words. An output is judged and
 * dropped: no path, no owner name and NO INTERFACE NAME is in a result, so none reaches a log line.
 *
 * NOTHING HERE HAS RUN ON A LINUX HOST. Hardware checks `9A/H-04`, `9A/H-05`.
 */
import type { HostCommand, HostCommandResult, HostCommandRunner } from './host-checks';

// ── the vocabulary ────────────────────────────────────────────────────────────────────────────

/** One code per check. They are members of the boot refusals (`checks.ts` spreads them in). */
export const CaptureProgramRefusal = {
  /** F10 (d): the relay did not show that it runs on the media library it was built for. */
  PROGRAM_RELAY_LIBRARY: 'CAPTURE_HOST_RELAY_LIBRARY_UNVERIFIED',
  /** HOST-45: the file of the address helper, or its directory, is not root's alone to write. */
  PROGRAM_ALIAS_HELPER: 'CAPTURE_HOST_ALIAS_HELPER_UNSAFE',
  /** HOST-44, decision C19: the directory of the helper's socket or a unit file is not root's alone to write. */
  PROGRAM_ALIAS_GRANT: 'CAPTURE_HOST_ALIAS_GRANT_UNSAFE',
  /** HOST-46: the interface file does not agree with the stored network configuration. */
  PROGRAM_INTERFACE_FILE: 'CAPTURE_HOST_INTERFACE_FILE_MISMATCH',
} as const;
export type CaptureProgramRefusal = (typeof CaptureProgramRefusal)[keyof typeof CaptureProgramRefusal];

const PRODUCTION = 'This host is not prepared for a production Core (DEMS_CAPTURE_MODE=real without DEMS_CAPTURE_DEV_SOURCES)';
const REMEDY = 'The Core checks and never installs: apply the item of the host profile (scripts/host/HOST-PROFILE-UBUNTU-24.04.md) as the administrator, then start again.';

/** The text of each refusal: the item of the host profile and the remedy. No path of the host, no output of a command. */
export const PROGRAM_REFUSAL_TEXT: Readonly<Record<CaptureProgramRefusal, string>> = Object.freeze({
  CAPTURE_HOST_RELAY_LIBRARY_UNVERIFIED: `${PRODUCTION}: the camera relay program in DEMS_CAPTURE_RELAY did not show that the libavformat it runs with on this host is the version it was built and verified against (the version of the capture worker). Build the relay again on this host (make -C apps/capture-worker) or restore the media library version it was built with; then start again.`,
  CAPTURE_HOST_ALIAS_HELPER_UNSAFE: `${PRODUCTION}: the file of the address helper is absent, is not a regular file of root, or it or its directory can be written by group or others (item HOST-45; the helper is installed by its own procedure, after its security review). ${REMEDY}`,
  CAPTURE_HOST_ALIAS_GRANT_UNSAFE: `${PRODUCTION}: the directory of the address helper's socket or one of its two unit files is absent, is not root's, or can be written by group or others (item HOST-44). ${REMEDY}`,
  CAPTURE_HOST_INTERFACE_FILE_MISMATCH: `${PRODUCTION}: the interface file of the address helper does not agree with the camera interface of the stored network configuration, or one of the two cannot be read (item HOST-46). The helper would change another interface than the one the Core believes it does. ${REMEDY}`,
});

/** Why a check failed. Fixed words; none is made from an output. */
export const ProgramCheckReason = {
  COMMAND_NOT_STARTED: 'HOST_COMMAND_NOT_STARTED',
  COMMAND_TIMED_OUT: 'HOST_COMMAND_TIMED_OUT',
  ANSWER_NOT_UNDERSTOOD: 'HOST_ANSWER_NOT_UNDERSTOOD',
  /** The relay's own word (exit code 12). */
  RELAY_LIBRARY_VERSION_MISMATCH: 'RELAY_LIBRARY_VERSION_MISMATCH',
  /** The relay could not set its own core-file limit to 0 (exit code 13; AD-09 (2)). */
  RELAY_CORE_FILE_LIMIT_NOT_SET: 'RELAY_CORE_FILE_LIMIT_NOT_SET',
  FILE_ABSENT: 'FILE_ABSENT',
  /** A link, a directory where a file is delivered, a file where a directory is. */
  NOT_THE_DELIVERED_KIND: 'NOT_THE_DELIVERED_KIND',
  NOT_OWNED_BY_ROOT: 'NOT_OWNED_BY_ROOT',
  WRITABLE_BY_GROUP_OR_OTHERS: 'WRITABLE_BY_GROUP_OR_OTHERS',
  INTERFACE_ROW_UNREADABLE: 'INTERFACE_ROW_UNREADABLE',
  INTERFACE_FILE_ABSENT: 'INTERFACE_FILE_ABSENT',
  INTERFACE_FILE_NOT_ONE_NAME: 'INTERFACE_FILE_NOT_ONE_NAME',
  /** THE NAMED MISMATCH of file and row. */
  INTERFACE_FILE_DIFFERS_FROM_ROW: 'INTERFACE_FILE_DIFFERS_FROM_ROW',
} as const;
export type ProgramCheckReason = (typeof ProgramCheckReason)[keyof typeof ProgramCheckReason];

// ── what the delivery fixes ───────────────────────────────────────────────────────────────────

/** The relay's exit codes this check reads (`apps/capture-worker/src/relay/relay.h`, `RelayCode`; held equal by a test). */
export const RELAY_EXIT = Object.freeze({ START_MESSAGE_INVALID: 10, START_MESSAGE_TIMEOUT: 11, LIBAVFORMAT_VERSION_MISMATCH: 12, HYGIENE_FAILED: 13 });

const STAT = '/usr/bin/stat';
/** Kind, owner, group, permission bits: one line per path. */
const STAT_FORM = '%F %U %G %a';
/** What `scripts/host/netalias/` delivers and its procedure installs (record 104; HOST-44, HOST-45, HOST-46). */
const HELPER_FILE = '/usr/local/sbin/dems-core-netalias';
const HELPER_DIRECTORY = '/usr/local/sbin';
const SOCKET_DIRECTORY = '/run/dems-core-netalias';
const SOCKET_UNIT = '/etc/systemd/system/dems-core-netalias.socket';
const SERVICE_UNIT = '/etc/systemd/system/dems-core-netalias@.service';
const INTERFACE_FILE = '/etc/dems/netalias-interface';
/** The form of an interface name: the helper's own pattern and the CHECK of the stored column. */
const INTERFACE_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,14}$/;
const GROUP_OR_OTHER_WRITE = 0o022;
/** More output than this is an answer of another form (the bound of row 80). */
const ANSWER_LIMIT = 4_096;

type Kind = 'regular file' | 'directory';

/** A question whose answer is one `stat` line per path, each held to "this kind, root's, not writable by group or others". */
export interface OwnershipCheck {
  readonly code: CaptureProgramRefusal;
  readonly items: readonly string[];
  readonly command: HostCommand;
  /** The kind each path must be, in the order of the command. */
  readonly kinds: readonly Kind[];
}

const ownership = (code: CaptureProgramRefusal, items: readonly string[], paths: ReadonlyArray<readonly [string, Kind]>): OwnershipCheck =>
  Object.freeze({ code, items, command: Object.freeze({ program: STAT, args: Object.freeze(['-c', STAT_FORM, ...paths.map(([path]) => path)]) }), kinds: Object.freeze(paths.map(([, kind]) => kind)) });

/** THE TWO OWNERSHIP QUESTIONS, in the order they are asked. Literal paths only: no value of the configuration reaches an argument. */
export const PROGRAM_OWNERSHIP_CHECKS: readonly OwnershipCheck[] = Object.freeze([
  ownership(CaptureProgramRefusal.PROGRAM_ALIAS_HELPER, ['HOST-45'], [[HELPER_FILE, 'regular file'], [HELPER_DIRECTORY, 'directory']]),
  ownership(CaptureProgramRefusal.PROGRAM_ALIAS_GRANT, ['HOST-44'], [[SOCKET_DIRECTORY, 'directory'], [SOCKET_UNIT, 'regular file'], [SERVICE_UNIT, 'regular file']]),
]);

/** The question of check 4: the file's content. */
export const INTERFACE_FILE_COMMAND: HostCommand = Object.freeze({ program: '/usr/bin/cat', args: Object.freeze([INTERFACE_FILE]) });

// ── the checks ────────────────────────────────────────────────────────────────────────────────

export interface DeliveredProgramDeps {
  /** `process.platform` of the Core. Checks 2 to 4 are asked on `linux` only. */
  readonly platform: string;
  /** `config.captureRelayPath`. Started without an argument and without a start message. */
  readonly relayProgram: string | null;
  /** The runner of row 80. */
  readonly run: HostCommandRunner;
  /**
   * The interface the stored network configuration names (`capture_network_config.interface_name`), or
   * null when no row exists or it names none. A reader that cannot read REJECTS: the check then refuses.
   */
  storedInterface(): Promise<string | null>;
}

export const ProgramCheckStatus = { IN_PLACE: 'IN_PLACE', MISSING: 'MISSING', NOT_ASKED: 'NOT_ASKED' } as const;
export type ProgramCheckStatus = (typeof ProgramCheckStatus)[keyof typeof ProgramCheckStatus];

/** One line of the diagnostics: fixed words only. */
export interface ProgramCheckResult {
  readonly code: CaptureProgramRefusal;
  readonly items: readonly string[];
  readonly status: ProgramCheckStatus;
  /** The reason of `MISSING` (a word of `ProgramCheckReason`, or of the path rule for the relay); null otherwise. */
  readonly reason: string | null;
}

export interface ProgramCheckOutcome {
  readonly failure: { readonly code: CaptureProgramRefusal; readonly reason: string } | null;
  /** How many checks were found in place, and how many were not asked (another platform, or no stored interface). */
  readonly inPlace: number;
  readonly notAsked: number;
}

/** The path rule of a program, handed in by the boot checks (ONE rule for the worker, the relay and the guard). Null: usable. */
export type ProgramProblemOf = (program: string | null) => string | null;

const UNCLEAR = ProgramCheckReason.ANSWER_NOT_UNDERSTOOD;

/** The answer of a question, or the reason it has none. A runner that throws is a program that could not be started. */
async function answerOf(command: HostCommand, run: HostCommandRunner): Promise<{ readonly lines: readonly string[]; readonly exitCode: number } | ProgramCheckReason> {
  const result = await run(command).catch((): HostCommandResult => ({ outcome: 'NOT_STARTED' }));
  if (result.outcome === 'NOT_STARTED') return ProgramCheckReason.COMMAND_NOT_STARTED;
  if (result.outcome === 'TIMED_OUT') return ProgramCheckReason.COMMAND_TIMED_OUT;
  if (result.outcome !== 'RAN' || typeof result.output !== 'string' || !Number.isInteger(result.exitCode) || result.output.length > ANSWER_LIMIT) return UNCLEAR;
  const lines = result.output.split('\n').map((line) => line.replace(/[ \t\r]+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return { lines, exitCode: result.exitCode };
}

/** Check 1. The relay's output is not read at all: its answer is its exit code. */
async function relayReason(deps: DeliveredProgramDeps, programProblem: ProgramProblemOf): Promise<string | null> {
  const unusable = programProblem(deps.relayProgram);
  if (unusable !== null || deps.relayProgram === null) return unusable ?? UNCLEAR;
  const result = await deps.run({ program: deps.relayProgram, args: [] }).catch((): HostCommandResult => ({ outcome: 'NOT_STARTED' }));
  if (result.outcome === 'NOT_STARTED') return ProgramCheckReason.COMMAND_NOT_STARTED;
  if (result.outcome === 'TIMED_OUT') return ProgramCheckReason.COMMAND_TIMED_OUT;
  if (result.outcome !== 'RAN') return UNCLEAR;
  if (result.exitCode === RELAY_EXIT.LIBAVFORMAT_VERSION_MISMATCH) return ProgramCheckReason.RELAY_LIBRARY_VERSION_MISMATCH;
  if (result.exitCode === RELAY_EXIT.HYGIENE_FAILED) return ProgramCheckReason.RELAY_CORE_FILE_LIMIT_NOT_SET;
  // Past its statement of the library, and then no start message: the two codes of a relay that was told nothing.
  return result.exitCode === RELAY_EXIT.START_MESSAGE_INVALID || result.exitCode === RELAY_EXIT.START_MESSAGE_TIMEOUT ? null : UNCLEAR;
}

/** Checks 2 and 3. */
async function ownershipReason(check: OwnershipCheck, run: HostCommandRunner): Promise<ProgramCheckReason | null> {
  const answer = await answerOf(check.command, run);
  if (typeof answer === 'string') return answer;
  const { lines, exitCode } = answer;
  // The tool prints a line for every path it found and ends with 1 when one was not there.
  if (exitCode === 1 && lines.length < check.kinds.length) return ProgramCheckReason.FILE_ABSENT;
  if (exitCode !== 0 || lines.length !== check.kinds.length) return UNCLEAR;
  const read = lines.map((line) => /^([a-z][a-z ]*) (\S+) (\S+) ([0-7]{3,4})$/.exec(line));
  if (read.some((entry) => entry === null)) return UNCLEAR;
  for (const [index, entry] of read.entries()) {
    // An empty file is still a regular file to the tool, with one word more.
    const kind = entry?.[1] === 'regular empty file' ? 'regular file' : entry?.[1];
    if (kind !== check.kinds[index]) return ProgramCheckReason.NOT_THE_DELIVERED_KIND;
    if (entry?.[2] !== 'root') return ProgramCheckReason.NOT_OWNED_BY_ROOT;
    if ((Number.parseInt(entry?.[4] ?? '777', 8) & GROUP_OR_OTHER_WRITE) !== 0) return ProgramCheckReason.WRITABLE_BY_GROUP_OR_OTHERS;
  }
  return null;
}

/** Check 4, once a stored interface exists. The two names are compared and dropped. */
async function interfaceReason(stored: string, run: HostCommandRunner): Promise<ProgramCheckReason | null> {
  if (!INTERFACE_NAME.test(stored)) return ProgramCheckReason.INTERFACE_ROW_UNREADABLE;
  const answer = await answerOf(INTERFACE_FILE_COMMAND, run);
  if (typeof answer === 'string') return answer;
  if (answer.exitCode === 1 && answer.lines.length === 0) return ProgramCheckReason.INTERFACE_FILE_ABSENT;
  if (answer.exitCode !== 0) return UNCLEAR;
  const [named] = answer.lines;
  if (answer.lines.length !== 1 || named === undefined || !INTERFACE_NAME.test(named)) return ProgramCheckReason.INTERFACE_FILE_NOT_ONE_NAME;
  return named === stored ? null : ProgramCheckReason.INTERFACE_FILE_DIFFERS_FROM_ROW;
}

/**
 * THE DIAGNOSTICS: the four checks, in order, each with its status. With `stopAtFirstMissing` (the
 * boot) nothing is asked after the first check that is missing.
 */
export async function deliveredProgramResults(deps: DeliveredProgramDeps, programProblem: ProgramProblemOf, options: { readonly stopAtFirstMissing?: boolean } = {}): Promise<readonly ProgramCheckResult[]> {
  const results: ProgramCheckResult[] = [];
  const stopped = (): boolean => options.stopAtFirstMissing === true && results.some((entry) => entry.status === ProgramCheckStatus.MISSING);
  const add = (code: CaptureProgramRefusal, items: readonly string[], reason: string | null | undefined): void => {
    results.push(Object.freeze({ code, items, status: reason === undefined ? ProgramCheckStatus.NOT_ASKED : reason === null ? ProgramCheckStatus.IN_PLACE : ProgramCheckStatus.MISSING, reason: reason ?? null }));
  };
  const linux = deps.platform === 'linux';

  add(CaptureProgramRefusal.PROGRAM_RELAY_LIBRARY, ['HOST-05', 'HOST-15'], await relayReason(deps, programProblem));
  for (const check of PROGRAM_OWNERSHIP_CHECKS) {
    if (stopped()) return Object.freeze(results);
    add(check.code, check.items, linux ? await ownershipReason(check, deps.run) : undefined);
  }
  if (stopped()) return Object.freeze(results);
  if (!linux) add(CaptureProgramRefusal.PROGRAM_INTERFACE_FILE, ['HOST-46'], undefined);
  else {
    let stored: string | null | undefined;
    try {
      stored = await deps.storedInterface();
    } catch {
      // The error of a read is not passed on: it could name a row.
      stored = undefined;
    }
    const reason = stored === undefined || (stored !== null && typeof stored !== 'string') ? ProgramCheckReason.INTERFACE_ROW_UNREADABLE : stored === null ? undefined : await interfaceReason(stored, deps.run);
    add(CaptureProgramRefusal.PROGRAM_INTERFACE_FILE, ['HOST-46'], reason);
  }
  return Object.freeze(results);
}

/** THE BOOT: the first check that is missing, by its code and a fixed reason; or none. */
export async function deliveredProgramOutcomeOf(deps: DeliveredProgramDeps, programProblem: ProgramProblemOf): Promise<ProgramCheckOutcome> {
  const results = await deliveredProgramResults(deps, programProblem, { stopAtFirstMissing: true });
  const missing = results.find((entry) => entry.status === ProgramCheckStatus.MISSING);
  return Object.freeze({
    failure: missing === undefined ? null : Object.freeze({ code: missing.code, reason: missing.reason ?? UNCLEAR }),
    inPlace: results.filter((entry) => entry.status === ProgramCheckStatus.IN_PLACE).length,
    notAsked: results.filter((entry) => entry.status === ProgramCheckStatus.NOT_ASKED).length,
  });
}
