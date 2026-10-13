/**
 * THE HOST CHECKS OF A PRODUCTION CORE (task 4, blueprint row 80, work package WP-20; the function
 * ported from the `doctor` of input-av). Requirements: BR-12 / RC-5 (the loopback owner rule), AD-09 (1)
 * (no core file, no diagnostic switch), S13-07, S13-09 with decision C19 (the address helper is a root
 * service on a local socket; the Core cannot gain privileges), P12-F12 (c) (the `arping` variant), and
 * the items of `scripts/host/HOST-PROFILE-UBUNTU-24.04.md` the Core can check for itself.
 *
 * THIS FILE STARTS NO PROCESS AND READS NO FILE. Every question to the host is a row of ONE FIXED
 * TABLE (an absolute program, a literal argument list - no value of the configuration, of the database
 * or of a request reaches an argument) and is asked through an INJECTED runner. Static rule SR-1
 * (decisions/003_amendment_rows.md) admits exactly three process files and none of them is here: the
 * composition supplies the runner (`hostCommandRunnerOver` wraps a door it is handed - it calls the
 * door, it is not one), and the tests supply a fake.
 *
 * THE CORE CHECKS, IT NEVER INSTALLS: no row of the table changes anything on the host.
 *
 * WHAT IS SAID ABOUT A FAILURE: a code of `CaptureHostRefusal` and a reason of `HostCheckReason`, both
 * closed sets of fixed words. The output of a command is JUDGED and DROPPED: no part of it, no path
 * and no name of the host is in a result, so none can reach a log line or an answer.
 *
 * A check that cannot see does not answer "in place": a program that is not there, a command that
 * does not end within its bound and an answer of another form are each a failure with its own reason.
 *
 * NOTHING HERE HAS RUN ON A LINUX HOST. The program paths, the output forms and the exit codes are
 * the ones the host profile states; they are proven by the hardware checks `9A/H-01`, `9A/H-04`
 * (a start with one prerequisite removed names exactly that one), `9A/H-05`, `9A/H-25`, `9A/H-27`.
 */
import type { HelperDoor } from '../adapters/local';
import type { CaptureTimers } from '../types';

// ── the injected runner ───────────────────────────────────────────────────────────────────────

/** One question to the host: an absolute program and its whole argument list. Only rows of `HOST_COMMAND_CHECKS` are asked. */
export interface HostCommand {
  readonly program: string;
  readonly args: readonly string[];
}

export type HostCommandResult =
  /** The program ran and ended. `output` is its standard output, bounded by the runner. */
  | { readonly outcome: 'RAN'; readonly exitCode: number; readonly output: string }
  /** The program could not be started (it is not there, or it may not be executed). */
  | { readonly outcome: 'NOT_STARTED' }
  /** The program did not end within the bound and was stopped. */
  | { readonly outcome: 'TIMED_OUT' };

/** Asks the host one question. It must not throw; a runner that does is answered like a program that could not be started. */
export type HostCommandRunner = (command: HostCommand) => Promise<HostCommandResult>;

/** How long one question may take. */
export const HOST_COMMAND_BOUND_MS = 5_000;
/** More output than this is an answer of another form: no check of the table prints more than a few lines. */
export const HOST_ANSWER_LIMIT = 4_096;

/**
 * A runner over a process door THE CALLER HANDS IN (the composition; this file imports no door). The
 * child gets the door's default environment (empty) and no input; standard error is dropped unread.
 */
export function hostCommandRunnerOver(door: HelperDoor, timers: CaptureTimers, boundMs: number = HOST_COMMAND_BOUND_MS): HostCommandRunner {
  return async (command) => {
    const child = door({ command: command.program, args: command.args });
    let timedOut = false;
    const cancel = timers.after(boundMs, () => {
      timedOut = true;
      child.kill('SIGKILL');
    });
    const exit = await child.ended;
    cancel();
    if (timedOut) return { outcome: 'TIMED_OUT' };
    if (exit.spawnFailed) return { outcome: 'NOT_STARTED' };
    // Ended by a signal this runner did not send: an answer no rule understands (exit code -1 matches none).
    return { outcome: 'RAN', exitCode: exit.exitCode ?? -1, output: exit.output };
  };
}

// ── the vocabulary ────────────────────────────────────────────────────────────────────────────

/** One code per prerequisite. They are members of the boot refusals (`checks.ts` spreads them in). */
export const CaptureHostRefusal = {
  /** AD-09 (1), HOST-35: the core-file limit of the Core is not 0, or cannot be read. */
  HOST_CORE_FILE_LIMIT: 'CAPTURE_HOST_CORE_FILE_LIMIT',
  /** AD-09 (1), HOST-36: the Core was started with a diagnostic-report, heap or debugger switch. */
  HOST_DIAGNOSTIC_SWITCH: 'CAPTURE_HOST_DIAGNOSTIC_SWITCH',
  /** HOST-15: the camera relay program is not configured or fails the path rule. */
  HOST_RELAY_PROGRAM: 'CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE',
  /** HOST-15: the guard program is not configured or fails the path rule. */
  HOST_GUARD_PROGRAM: 'CAPTURE_HOST_GUARD_PROGRAM_UNUSABLE',
  /** BR-12 / RC-5, HOST-25, HOST-41: the loopback owner rule is not in place, or its state cannot be read. */
  HOST_LOOPBACK_RULE: 'CAPTURE_HOST_LOOPBACK_RULE_MISSING',
  /** Decision C19, HOST-38: the Core can still gain privileges. */
  HOST_NO_NEW_PRIVILEGES: 'CAPTURE_HOST_CAN_GAIN_PRIVILEGES',
  /** AD-09 (1), HOST-37: a crash collector takes memory images whatever the limit says. */
  HOST_CRASH_COLLECTOR: 'CAPTURE_HOST_CRASH_COLLECTOR',
  /** S13-03 (b), HOST-20: the host forwards packets. */
  HOST_FORWARDING: 'CAPTURE_HOST_FORWARDING_ON',
  /** P12-F12 (c), HOST-18: the conflict-check tool is absent or is not the iputils one. */
  HOST_ARPING_VARIANT: 'CAPTURE_HOST_ARPING_VARIANT',
  /** HOST-26, HOST-40: the Core does not run with the audio group. */
  HOST_AUDIO_GROUP: 'CAPTURE_HOST_AUDIO_GROUP',
  /** HOST-31: the clock of the host is not synchronised. */
  HOST_TIME_SYNC: 'CAPTURE_HOST_CLOCK_NOT_SYNCHRONISED',
  /** HOST-29: the host may sleep or hibernate. */
  HOST_SLEEP: 'CAPTURE_HOST_MAY_SLEEP',
  /** Decision C19, HOST-44: the socket of the address helper is absent, or has another owner, group or mode. */
  HOST_ALIAS_SOCKET: 'CAPTURE_HOST_ALIAS_SOCKET',
} as const;
export type CaptureHostRefusal = (typeof CaptureHostRefusal)[keyof typeof CaptureHostRefusal];

const PRODUCTION = 'This host is not prepared for a production Core (DEMS_CAPTURE_MODE=real without DEMS_CAPTURE_DEV_SOURCES)';
const REMEDY = 'The Core checks and never installs: apply the item of the host profile (scripts/host/HOST-PROFILE-UBUNTU-24.04.md) as the administrator, then start again.';

/** The text of each refusal: the item of the host profile and the remedy. No path of the host, no output of a command. */
export const HOST_REFUSAL_TEXT: Readonly<Record<CaptureHostRefusal, string>> = Object.freeze({
  CAPTURE_HOST_CORE_FILE_LIMIT: `${PRODUCTION}: the core-file limit of the Core is not 0, so a crash could write its memory - keys and camera credentials included - to a file (item HOST-35: LimitCORE=0 in the unit of the Core). ${REMEDY}`,
  CAPTURE_HOST_DIAGNOSTIC_SWITCH: `${PRODUCTION}: the Core was started with a diagnostic-report, heap-snapshot, heap-profile or debugger switch, or with NODE_OPTIONS set (item HOST-36). Remove the switch from the start command and from the environment file, then start again.`,
  CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE: `${PRODUCTION}: the camera relay program in DEMS_CAPTURE_RELAY cannot be used. It must be set to an absolute path of a regular executable file owned by root or by the user of the server, not writable by group or others, with no directory on the way to it writable by them (items HOST-05, HOST-15).`,
  CAPTURE_HOST_GUARD_PROGRAM_UNUSABLE: `${PRODUCTION}: the guard program in DEMS_CAPTURE_GUARD cannot be used. It must be set to an absolute path of a regular executable file owned by root or by the user of the server, not writable by group or others, with no directory on the way to it writable by them (items HOST-05, HOST-15).`,
  CAPTURE_HOST_LOOPBACK_RULE_MISSING: `${PRODUCTION}: the loopback rule is not in place, or its state cannot be read. Without it any account of the host can connect to the camera listeners of the capture worker (items HOST-25, HOST-41: the unit dems-loopback-rule.service is active). ${REMEDY}`,
  CAPTURE_HOST_CAN_GAIN_PRIVILEGES: `${PRODUCTION}: the Core runs without the no-new-privileges state (item HOST-38: NoNewPrivileges=yes in the unit of the Core). ${REMEDY}`,
  CAPTURE_HOST_CRASH_COLLECTOR: `${PRODUCTION}: the crash handling of the host can take a memory image of the Core whatever its core-file limit says - the core pattern hands images to a program, or images of privileged programs are allowed (item HOST-37). ${REMEDY}`,
  CAPTURE_HOST_FORWARDING_ON: `${PRODUCTION}: the host forwards packets, so the camera network is not isolated from the other networks of the host (item HOST-20). ${REMEDY}`,
  CAPTURE_HOST_ARPING_VARIANT: `${PRODUCTION}: the address conflict check needs the arping of the package iputils-arping; it is absent, or another package provides it and gives the same option another meaning (item HOST-18). ${REMEDY}`,
  CAPTURE_HOST_AUDIO_GROUP: `${PRODUCTION}: the Core does not run with the audio group, so it cannot open the sound devices without a desktop session (items HOST-26, HOST-40). ${REMEDY}`,
  CAPTURE_HOST_CLOCK_NOT_SYNCHRONISED: `${PRODUCTION}: the clock of the host is not synchronised, and every record of the Core carries its time (item HOST-31). ${REMEDY}`,
  CAPTURE_HOST_MAY_SLEEP: `${PRODUCTION}: the host may sleep or hibernate, which ends a recording without a word (item HOST-29: the four sleep targets are masked). ${REMEDY}`,
  CAPTURE_HOST_ALIAS_SOCKET: `${PRODUCTION}: the socket of the address helper is absent, or its owner, group or mode is not the delivered one (item HOST-44; the helper is installed by its own procedure, after its security review). ${REMEDY}`,
});

/** Why a check failed. Fixed words; none is made from an output. */
export const HostCheckReason = {
  /** The program of the check could not be started. */
  COMMAND_NOT_STARTED: 'HOST_COMMAND_NOT_STARTED',
  COMMAND_TIMED_OUT: 'HOST_COMMAND_TIMED_OUT',
  /** The program answered in another form than the one the host profile states. */
  ANSWER_NOT_UNDERSTOOD: 'HOST_ANSWER_NOT_UNDERSTOOD',
  LIMIT_ABOVE_ZERO: 'LIMIT_ABOVE_ZERO',
  LIMIT_UNREADABLE: 'LIMIT_UNREADABLE',
  DIAGNOSTIC_SWITCH_SET: 'DIAGNOSTIC_SWITCH_SET',
  NODE_OPTIONS_SET: 'NODE_OPTIONS_SET',
  RULE_UNIT_NOT_ACTIVE: 'RULE_UNIT_NOT_ACTIVE',
  NO_NEW_PRIVILEGES_OFF: 'NO_NEW_PRIVILEGES_OFF',
  CORE_PATTERN_PIPES_TO_A_PROGRAM: 'CORE_PATTERN_PIPES_TO_A_PROGRAM',
  SUID_DUMPABLE_NOT_ZERO: 'SUID_DUMPABLE_NOT_ZERO',
  FORWARDING_ON: 'FORWARDING_ON',
  ARPING_NOT_INSTALLED: 'ARPING_NOT_INSTALLED',
  ARPING_OF_ANOTHER_PACKAGE: 'ARPING_OF_ANOTHER_PACKAGE',
  NOT_IN_AUDIO_GROUP: 'NOT_IN_AUDIO_GROUP',
  CLOCK_NOT_SYNCHRONISED: 'CLOCK_NOT_SYNCHRONISED',
  SLEEP_TARGET_NOT_MASKED: 'SLEEP_TARGET_NOT_MASKED',
  SOCKET_ABSENT: 'SOCKET_ABSENT',
  SOCKET_OWNER_GROUP_OR_MODE: 'SOCKET_OWNER_GROUP_OR_MODE',
} as const;
export type HostCheckReason = (typeof HostCheckReason)[keyof typeof HostCheckReason];

// ── the table of the questions ────────────────────────────────────────────────────────────────

/** What a rule is handed: the lines of the answer (line ends and trailing blanks removed, no empty last line) and the exit code. */
type Judge = (lines: readonly string[], exitCode: number) => HostCheckReason | null;

export interface HostCommandCheck {
  readonly code: CaptureHostRefusal;
  /** The items of the host profile whose took-effect check this row repeats. */
  readonly items: readonly string[];
  readonly command: HostCommand;
  /** Null: in place. Otherwise the reason. */
  readonly judge: Judge;
}

const UNCLEAR = HostCheckReason.ANSWER_NOT_UNDERSTOOD;
const one = (lines: readonly string[]): string | null => (lines.length === 1 ? (lines[0] ?? null) : null);
const SERVICE_MANAGER = '/usr/bin/systemctl';
const KERNEL_SETTINGS = '/usr/sbin/sysctl';
/** The states the service manager names for a unit that is not active. */
const NOT_ACTIVE = ['inactive', 'failed', 'activating', 'deactivating', 'reloading', 'maintenance', 'refreshing', 'unknown'];
/** The pattern of file C of the host profile: every memory image is handed to a program that discards it. */
const DISCARDING_PATTERN = '|/bin/false';
const ARPING = '/usr/bin/arping';
const SLEEP_TARGETS = ['sleep.target', 'suspend.target', 'hibernate.target', 'hybrid-sleep.target'] as const;
/** What the delivery of the address helper fixes (`scripts/host/netalias/dems-core-netalias.socket`). */
const ALIAS_SOCKET = '/run/dems-core-netalias/socket';
const ALIAS_SOCKET_STATE = 'socket root dems-netalias 660';

/**
 * THE QUESTIONS, in the order they are asked. Each repeats the took-effect check of its item of the
 * host profile, with the same program and the same expected answer. Where the profile's check needs
 * the administrator (`sudo`), the question is the one the Core's own account can ask.
 */
export const HOST_COMMAND_CHECKS: readonly HostCommandCheck[] = Object.freeze([
  {
    // HOST-25 asks the rule set itself, which a Core with an empty capability set cannot list (request of row 76):
    // the Core asks the state of the unit that loads the rule (HOST-41 makes the Core's unit require it).
    code: CaptureHostRefusal.HOST_LOOPBACK_RULE,
    items: ['HOST-25', 'HOST-41'],
    command: { program: SERVICE_MANAGER, args: ['is-active', 'dems-loopback-rule.service'] },
    judge: (lines, exitCode) => {
      const state = one(lines);
      if (state === 'active') return exitCode === 0 ? null : UNCLEAR;
      return state !== null && NOT_ACTIVE.includes(state) ? HostCheckReason.RULE_UNIT_NOT_ACTIVE : UNCLEAR;
    },
  },
  {
    // The state is inherited by every child and can never be given up again: the child's line is the Core's.
    code: CaptureHostRefusal.HOST_NO_NEW_PRIVILEGES,
    items: ['HOST-38'],
    command: { program: '/usr/bin/grep', args: ['-E', '^NoNewPrivs:', '/proc/self/status'] },
    judge: (lines) => {
      const state = /^NoNewPrivs:\s+([01])$/.exec(one(lines) ?? '')?.[1];
      if (state === undefined) return UNCLEAR;
      return state === '1' ? null : HostCheckReason.NO_NEW_PRIVILEGES_OFF;
    },
  },
  {
    code: CaptureHostRefusal.HOST_CRASH_COLLECTOR,
    items: ['HOST-37'],
    command: { program: KERNEL_SETTINGS, args: ['-n', 'kernel.core_pattern', 'fs.suid_dumpable'] },
    judge: (lines, exitCode) => {
      const [pattern, dumpable] = lines;
      if (exitCode !== 0 || lines.length !== 2 || pattern === undefined || pattern === '' || dumpable === undefined || !/^[012]$/.test(dumpable)) return UNCLEAR;
      // A pattern that names a file writes nothing while the limit is 0 (HOST-35). One that starts a program is served whatever the limit says.
      if (pattern.startsWith('|') && pattern !== DISCARDING_PATTERN) return HostCheckReason.CORE_PATTERN_PIPES_TO_A_PROGRAM;
      return dumpable === '0' ? null : HostCheckReason.SUID_DUMPABLE_NOT_ZERO;
    },
  },
  {
    code: CaptureHostRefusal.HOST_FORWARDING,
    items: ['HOST-20'],
    command: { program: KERNEL_SETTINGS, args: ['-n', 'net.ipv4.ip_forward', 'net.ipv6.conf.all.forwarding'] },
    judge: (lines, exitCode) => {
      if (exitCode !== 0 || lines.length !== 2 || !lines.every((line) => line === '0' || line === '1')) return UNCLEAR;
      return lines.every((line) => line === '0') ? null : HostCheckReason.FORWARDING_ON;
    },
  },
  {
    code: CaptureHostRefusal.HOST_ARPING_VARIANT,
    items: ['HOST-18'],
    command: { program: '/usr/bin/dpkg', args: ['-S', ARPING] },
    judge: (lines, exitCode) => {
      // The package database knows no owner of the path: the tool is not installed from a package.
      if (exitCode === 1) return HostCheckReason.ARPING_NOT_INSTALLED;
      const owner = /^([a-z0-9][a-z0-9+.-]*)(?::[a-z0-9-]+)?: (\S+)$/.exec(one(lines) ?? '');
      if (exitCode !== 0 || owner === null || owner[2] !== ARPING) return UNCLEAR;
      return owner[1] === 'iputils-arping' ? null : HostCheckReason.ARPING_OF_ANOTHER_PACKAGE;
    },
  },
  {
    // The groups of THIS process (no account is named): what the unit of the Core gave it (HOST-40).
    code: CaptureHostRefusal.HOST_AUDIO_GROUP,
    items: ['HOST-26', 'HOST-40'],
    command: { program: '/usr/bin/id', args: ['-nG'] },
    judge: (lines, exitCode) => {
      const groups = (one(lines) ?? '').split(' ').filter((group) => group !== '');
      if (exitCode !== 0 || groups.length === 0 || !groups.every((group) => /^[A-Za-z0-9_][A-Za-z0-9_.$-]*$/.test(group))) return UNCLEAR;
      return groups.includes('audio') ? null : HostCheckReason.NOT_IN_AUDIO_GROUP;
    },
  },
  {
    code: CaptureHostRefusal.HOST_TIME_SYNC,
    items: ['HOST-31'],
    command: { program: '/usr/bin/timedatectl', args: ['show', '-p', 'NTPSynchronized', '--value'] },
    judge: (lines, exitCode) => {
      const state = one(lines);
      if (exitCode !== 0 || (state !== 'yes' && state !== 'no')) return UNCLEAR;
      return state === 'yes' ? null : HostCheckReason.CLOCK_NOT_SYNCHRONISED;
    },
  },
  {
    // The exit code is not judged: the service manager answers a masked unit with a code other than 0.
    code: CaptureHostRefusal.HOST_SLEEP,
    items: ['HOST-29'],
    command: { program: SERVICE_MANAGER, args: ['is-enabled', ...SLEEP_TARGETS] },
    judge: (lines) => {
      if (lines.length !== SLEEP_TARGETS.length || !lines.every((line) => /^[a-z][a-z-]*$/.test(line))) return UNCLEAR;
      return lines.every((line) => line === 'masked') ? null : HostCheckReason.SLEEP_TARGET_NOT_MASKED;
    },
  },
  {
    code: CaptureHostRefusal.HOST_ALIAS_SOCKET,
    items: ['HOST-44'],
    command: { program: '/usr/bin/stat', args: ['-c', '%F %U %G %a', ALIAS_SOCKET] },
    judge: (lines, exitCode) => {
      // The tool names nothing on standard output when the node is not there (or cannot be reached).
      if (exitCode === 1 && lines.length === 0) return HostCheckReason.SOCKET_ABSENT;
      const state = one(lines);
      if (exitCode !== 0 || state === null || !/^[a-z][a-z ]* \S+ \S+ [0-7]{3,4}$/.test(state)) return UNCLEAR;
      return state === ALIAS_SOCKET_STATE ? null : HostCheckReason.SOCKET_OWNER_GROUP_OR_MODE;
    },
  },
]);

// ── the checks ────────────────────────────────────────────────────────────────────────────────

/** A start argument of the runtime that writes memory or state of the Core to a file, or opens a debugger (HOST-36). */
const DIAGNOSTIC_SWITCH = /^--(?:report|diagnostic|heap|inspect)/;

/** What the composition hands in about the host and the Core's own process. This file reads none of it itself. */
export interface CaptureHostDeps {
  /** `process.platform` of the Core. The questions of the table are asked on `linux` only. */
  readonly platform: string;
  /** The soft core-file limit of the Core (0, a number above it, `Infinity`), or null when it cannot be read. */
  coreFileLimit(): number | null;
  /** The runtime's own start arguments (`process.execArgv`). Judged and never repeated. */
  readonly startArguments: readonly string[];
  /** True when the runtime's option variable is set in the Core's environment, whatever it holds. */
  readonly nodeOptionsSet: boolean;
  /** `config.captureRelayPath` and `config.captureGuardPath`. */
  readonly relayProgram: string | null;
  readonly guardProgram: string | null;
  readonly run: HostCommandRunner;
}

export const HostCheckStatus = { IN_PLACE: 'IN_PLACE', MISSING: 'MISSING', NOT_ASKED: 'NOT_ASKED' } as const;
export type HostCheckStatus = (typeof HostCheckStatus)[keyof typeof HostCheckStatus];

/** One line of the diagnostics: fixed words only. */
export interface HostCheckResult {
  readonly code: CaptureHostRefusal;
  readonly items: readonly string[];
  readonly status: HostCheckStatus;
  /** The reason of `MISSING` (a word of `HostCheckReason`, or of the path rule for a program); null otherwise. */
  readonly reason: string | null;
}

/** The first failure of a boot, or none; and whether the questions of the table were asked at all. */
export interface HostCheckOutcome {
  readonly failure: { readonly code: CaptureHostRefusal; readonly reason: string } | null;
  /** `NOT_LINUX`: the table was not asked, the profile is one of a Linux host. The checks of the Core's own process and programs ran. */
  readonly commands: 'ASKED' | 'NOT_LINUX';
  /** How many checks were found in place. */
  readonly inPlace: number;
}

/** The path rule of a program, handed in by the boot checks (ONE rule for the worker, the relay and the guard). Null: usable. */
export type ProgramProblemOf = (program: string | null) => string | null;

function linesOf(output: string): readonly string[] | null {
  if (output.length > HOST_ANSWER_LIMIT) return null;
  const lines = output.split('\n').map((line) => line.replace(/[ \t\r]+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

async function ask(check: HostCommandCheck, run: HostCommandRunner): Promise<HostCheckReason | null> {
  const result = await run(check.command).catch((): HostCommandResult => ({ outcome: 'NOT_STARTED' }));
  if (result.outcome === 'NOT_STARTED') return HostCheckReason.COMMAND_NOT_STARTED;
  if (result.outcome === 'TIMED_OUT') return HostCheckReason.COMMAND_TIMED_OUT;
  if (result.outcome !== 'RAN' || typeof result.output !== 'string' || !Number.isInteger(result.exitCode)) return UNCLEAR;
  const lines = linesOf(result.output);
  return lines === null ? UNCLEAR : check.judge(lines, result.exitCode);
}

function ownProcessChecks(deps: CaptureHostDeps, programProblem: ProgramProblemOf): ReadonlyArray<() => HostCheckResult> {
  const result = (code: CaptureHostRefusal, items: readonly string[], reason: string | null): HostCheckResult =>
    Object.freeze({ code, items, status: reason === null ? HostCheckStatus.IN_PLACE : HostCheckStatus.MISSING, reason });
  return [
    () => {
      let limit: number | null = null;
      try {
        limit = deps.coreFileLimit();
      } catch {
        limit = null;
      }
      const reason = limit === 0 ? null : limit === null || Number.isNaN(limit) ? HostCheckReason.LIMIT_UNREADABLE : HostCheckReason.LIMIT_ABOVE_ZERO;
      return result(CaptureHostRefusal.HOST_CORE_FILE_LIMIT, ['HOST-35'], reason);
    },
    () => {
      const reason = deps.startArguments.some((argument) => DIAGNOSTIC_SWITCH.test(argument)) ? HostCheckReason.DIAGNOSTIC_SWITCH_SET : deps.nodeOptionsSet ? HostCheckReason.NODE_OPTIONS_SET : null;
      return result(CaptureHostRefusal.HOST_DIAGNOSTIC_SWITCH, ['HOST-36'], reason);
    },
    () => result(CaptureHostRefusal.HOST_RELAY_PROGRAM, ['HOST-05', 'HOST-15'], programProblem(deps.relayProgram)),
    () => result(CaptureHostRefusal.HOST_GUARD_PROGRAM, ['HOST-05', 'HOST-15'], programProblem(deps.guardProgram)),
  ];
}

/**
 * THE DIAGNOSTICS: every check, in order, each with its status. With `stopAtFirstMissing` (the boot)
 * nothing is asked after the first check that is missing. On a platform other than `linux` the rows
 * of the table are `NOT_ASKED` and no command is run.
 */
export async function hostCheckResults(deps: CaptureHostDeps, programProblem: ProgramProblemOf, options: { readonly stopAtFirstMissing?: boolean } = {}): Promise<readonly HostCheckResult[]> {
  const results: HostCheckResult[] = [];
  const stopped = (): boolean => options.stopAtFirstMissing === true && results.some((entry) => entry.status === HostCheckStatus.MISSING);
  for (const check of ownProcessChecks(deps, programProblem)) {
    if (stopped()) return Object.freeze(results);
    results.push(check());
  }
  for (const check of HOST_COMMAND_CHECKS) {
    if (stopped()) return Object.freeze(results);
    if (deps.platform !== 'linux') {
      results.push(Object.freeze({ code: check.code, items: check.items, status: HostCheckStatus.NOT_ASKED, reason: null }));
      continue;
    }
    const reason = await ask(check, deps.run);
    results.push(Object.freeze({ code: check.code, items: check.items, status: reason === null ? HostCheckStatus.IN_PLACE : HostCheckStatus.MISSING, reason }));
  }
  return Object.freeze(results);
}

/** THE BOOT: the first prerequisite that is missing, by its code and a fixed reason; or none. */
export async function hostCheckOutcomeOf(deps: CaptureHostDeps, programProblem: ProgramProblemOf): Promise<HostCheckOutcome> {
  const results = await hostCheckResults(deps, programProblem, { stopAtFirstMissing: true });
  const missing = results.find((entry) => entry.status === HostCheckStatus.MISSING);
  return Object.freeze({
    failure: missing === undefined ? null : Object.freeze({ code: missing.code, reason: missing.reason ?? HostCheckReason.ANSWER_NOT_UNDERSTOOD }),
    commands: deps.platform === 'linux' ? 'ASKED' : 'NOT_LINUX',
    inPlace: results.filter((entry) => entry.status === HostCheckStatus.IN_PLACE).length,
  });
}
