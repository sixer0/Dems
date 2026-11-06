/**
 * Test support of the host checks (task 4 row 80; not a test file, imports no Vitest).
 *
 * THE DOUBLE OF THE LINUX HOST: a runner that starts nothing and answers each question of the table
 * with a RECORDED-STYLE output - written by hand from what the host profile states each command
 * prints (`scripts/host/HOST-PROFILE-UBUNTU-24.04.md`). None was recorded on a real host: no Linux
 * host exists in this track (decision U13). What they prove is the Core's judgement of an answer of
 * that form, not that Ubuntu 24.04 answers in that form (hardware checks `9A/H-01`, `9A/H-04`).
 */
import { CaptureHostRefusal, type CaptureHostDeps, type HostCommand, type HostCommandResult } from '../host-checks';

/** A text no result, log line or refusal may ever hold: it is planted in the outputs the checks refuse. */
export const CANARY = 'CANARY-7f3a /home/operator/.secret rtsp-user:hunter2';

const ran = (output: string, exitCode = 0): HostCommandResult => ({ outcome: 'RAN', exitCode, output });

export interface HostAnswers {
  /** The host as the profile leaves it. */
  readonly present: HostCommandResult;
  /** The prerequisite is not there: the answer, and the reason the Core names. */
  readonly absent: readonly { readonly answer: HostCommandResult; readonly reason: string }[];
  /** Answers of another form. Each carries the canary. */
  readonly malformed: readonly HostCommandResult[];
}

/** Per code of a question of the table: what a prepared host answers, what an unprepared one answers, and answers nobody expects. */
export const HOST_ANSWERS: Readonly<Record<string, HostAnswers>> = Object.freeze({
  [CaptureHostRefusal.HOST_LOOPBACK_RULE]: {
    present: ran('active\n'),
    absent: [
      { answer: ran('inactive\n', 3), reason: 'RULE_UNIT_NOT_ACTIVE' },
      { answer: ran('failed\n', 3), reason: 'RULE_UNIT_NOT_ACTIVE' },
      // A unit the service manager does not know (the rule was never installed).
      { answer: ran('inactive\n', 4), reason: 'RULE_UNIT_NOT_ACTIVE' },
    ],
    malformed: [ran(`${CANARY}\n`), ran(''), ran('active\nactive\n'), ran('active\n', 3)],
  },
  [CaptureHostRefusal.HOST_NO_NEW_PRIVILEGES]: {
    present: ran('NoNewPrivs:\t1\n'),
    absent: [{ answer: ran('NoNewPrivs:\t0\n'), reason: 'NO_NEW_PRIVILEGES_OFF' }],
    malformed: [ran('', 1), ran(`NoNewPrivs:\t${CANARY}\n`), ran('NoNewPrivs:\t2\n')],
  },
  [CaptureHostRefusal.HOST_CRASH_COLLECTOR]: {
    present: ran('|/bin/false\n0\n'),
    absent: [
      { answer: ran('|/usr/share/apport/apport -p%p -s%s -c%c -d%d -P%P -u%u -g%g -- %E\n0\n'), reason: 'CORE_PATTERN_PIPES_TO_A_PROGRAM' },
      { answer: ran('|/bin/false\n2\n'), reason: 'SUID_DUMPABLE_NOT_ZERO' },
      { answer: ran('core\n1\n'), reason: 'SUID_DUMPABLE_NOT_ZERO' },
    ],
    malformed: [ran('|/bin/false\n'), ran(`${CANARY}\n0\n0\n`), ran('|/bin/false\n0\n', 255), ran('\n0\n'), ran(`core\n${CANARY}\n`)],
  },
  [CaptureHostRefusal.HOST_FORWARDING]: {
    present: ran('0\n0\n'),
    absent: [
      { answer: ran('1\n0\n'), reason: 'FORWARDING_ON' },
      { answer: ran('0\n1\n'), reason: 'FORWARDING_ON' },
    ],
    malformed: [ran('0\n'), ran(`0\n${CANARY}\n`), ran('0\n0\n', 255), ran('0\n0\n0\n')],
  },
  [CaptureHostRefusal.HOST_ARPING_VARIANT]: {
    present: ran('iputils-arping: /usr/bin/arping\n'),
    absent: [
      { answer: ran('', 1), reason: 'ARPING_NOT_INSTALLED' },
      { answer: ran('arping: /usr/bin/arping\n'), reason: 'ARPING_OF_ANOTHER_PACKAGE' },
    ],
    malformed: [ran(`${CANARY}\n`), ran('iputils-arping: /usr/sbin/arping\n'), ran('iputils-arping: /usr/bin/arping\n', 2), ran('')],
  },
  [CaptureHostRefusal.HOST_AUDIO_GROUP]: {
    present: ran('dems-core audio dems-netalias\n'),
    absent: [{ answer: ran('dems-core dems-netalias\n'), reason: 'NOT_IN_AUDIO_GROUP' }],
    malformed: [ran(''), ran('audio\n', 1), ran(`audio ${CANARY}\n`), ran('dems-core\naudio\n')],
  },
  [CaptureHostRefusal.HOST_TIME_SYNC]: {
    present: ran('yes\n'),
    absent: [{ answer: ran('no\n'), reason: 'CLOCK_NOT_SYNCHRONISED' }],
    malformed: [ran(''), ran(`${CANARY}\n`), ran('yes\n', 1), ran('yes\nyes\n')],
  },
  [CaptureHostRefusal.HOST_SLEEP]: {
    present: ran('masked\nmasked\nmasked\nmasked\n', 1),
    absent: [
      { answer: ran('static\nstatic\nstatic\nstatic\n'), reason: 'SLEEP_TARGET_NOT_MASKED' },
      { answer: ran('masked\nmasked\nstatic\nmasked\n'), reason: 'SLEEP_TARGET_NOT_MASKED' },
    ],
    malformed: [ran('masked\nmasked\nmasked\n', 1), ran(`masked\nmasked\nmasked\n${CANARY}\n`, 1), ran('')],
  },
  [CaptureHostRefusal.HOST_ALIAS_SOCKET]: {
    present: ran('socket root dems-netalias 660\n'),
    absent: [
      { answer: ran('', 1), reason: 'SOCKET_ABSENT' },
      { answer: ran('socket root dems-netalias 666\n'), reason: 'SOCKET_OWNER_GROUP_OR_MODE' },
      { answer: ran('socket dems-core dems-netalias 660\n'), reason: 'SOCKET_OWNER_GROUP_OR_MODE' },
      { answer: ran('socket root root 660\n'), reason: 'SOCKET_OWNER_GROUP_OR_MODE' },
      { answer: ran('regular file root dems-netalias 660\n'), reason: 'SOCKET_OWNER_GROUP_OR_MODE' },
    ],
    malformed: [ran(`${CANARY}\n`), ran('socket root dems-netalias 660\n', 1), ran('socket root dems-netalias\n'), ran('')],
  },
});

export interface FakeHost {
  readonly deps: CaptureHostDeps;
  /** Every question that was asked, as `program arg arg ...`. */
  readonly asked: string[];
}

export interface FakeHostOptions extends Partial<Omit<CaptureHostDeps, 'run' | 'coreFileLimit'>> {
  readonly coreFileLimit?: () => number | null;
  /** Another answer for the question of a code. Everything else answers as a prepared host. */
  readonly answers?: Readonly<Record<string, HostCommandResult | (() => Promise<HostCommandResult>)>>;
  /** The table of the questions, to find the code of a command: handed in so that this file stays a plain double. */
  readonly codeOf: (command: HostCommand) => string | undefined;
}

/** A prepared Linux production host, and a runner that starts nothing. */
export function fakeHost(options: FakeHostOptions): FakeHost {
  const asked: string[] = [];
  const deps: CaptureHostDeps = {
    platform: options.platform ?? 'linux',
    coreFileLimit: options.coreFileLimit ?? (() => 0),
    startArguments: options.startArguments ?? ['--import', 'tsx'],
    nodeOptionsSet: options.nodeOptionsSet ?? false,
    relayProgram: options.relayProgram === undefined ? '/srv/dems/relay' : options.relayProgram,
    guardProgram: options.guardProgram === undefined ? '/srv/dems/guard' : options.guardProgram,
    run: async (command) => {
      asked.push([command.program, ...command.args].join(' '));
      const code = options.codeOf(command);
      // A question that is not of the table is a program that is not there: the double answers nothing it was not asked to.
      if (code === undefined) return { outcome: 'NOT_STARTED' };
      const other = options.answers?.[code];
      if (other !== undefined) return typeof other === 'function' ? other() : other;
      return HOST_ANSWERS[code]?.present ?? { outcome: 'NOT_STARTED' };
    },
  };
  return { deps, asked };
}

// ── Task 4 row 81: the delivered programs (`program-checks.ts`) ───────────────────────────────────
//
// The same kind of double: RECORDED-STYLE answers written by hand from what the host profile states
// (`stat -c '%F %U %G %a'` prints one line per path; `cat` prints the file) and from the relay's own
// header (its exit codes). None was recorded on a Linux host (decision U13).

/** The questions of row 81, by a key of this file: the relay (`RELAY`), the two ownership questions (their code), the interface file (`INTERFACE`). */
export const PROGRAM_ANSWERS: Readonly<Record<string, HostAnswers>> = Object.freeze({
  // The relay answers with its exit code alone: 10 = "no start message" (it came past its library statement).
  RELAY: {
    present: ran('', 10),
    absent: [
      { answer: ran('', 12), reason: 'RELAY_LIBRARY_VERSION_MISMATCH' },
      { answer: ran('', 13), reason: 'RELAY_CORE_FILE_LIMIT_NOT_SET' },
    ],
    malformed: [ran(`${CANARY}\n`, 0), ran('', 2), ran('', 127), ran('', -1)],
  },
  CAPTURE_HOST_ALIAS_HELPER_UNSAFE: {
    present: ran('regular file root root 755\ndirectory root root 755\n'),
    absent: [
      { answer: ran('directory root root 755\n', 1), reason: 'FILE_ABSENT' },
      { answer: ran('', 1), reason: 'FILE_ABSENT' },
      { answer: ran('symbolic link root root 777\ndirectory root root 755\n'), reason: 'NOT_THE_DELIVERED_KIND' },
      { answer: ran('regular file dems-core root 755\ndirectory root root 755\n'), reason: 'NOT_OWNED_BY_ROOT' },
      { answer: ran('regular file root dems-core 775\ndirectory root root 755\n'), reason: 'WRITABLE_BY_GROUP_OR_OTHERS' },
      { answer: ran('regular file root root 757\ndirectory root root 755\n'), reason: 'WRITABLE_BY_GROUP_OR_OTHERS' },
      { answer: ran('regular file root root 755\ndirectory root staff 775\n'), reason: 'WRITABLE_BY_GROUP_OR_OTHERS' },
      { answer: ran('regular file root root 755\ndirectory dems-core root 755\n'), reason: 'NOT_OWNED_BY_ROOT' },
    ],
    malformed: [ran(`${CANARY}\ndirectory root root 755\n`), ran('regular file root root 755\ndirectory root root 755\n', 2), ran('regular file root root 755\ndirectory root root 755\nsocket root root 660\n'), ran('regular file root root\ndirectory root root 755\n')],
  },
  CAPTURE_HOST_ALIAS_GRANT_UNSAFE: {
    present: ran('directory root root 755\nregular file root root 644\nregular file root root 644\n'),
    absent: [
      { answer: ran('directory root root 755\nregular file root root 644\n', 1), reason: 'FILE_ABSENT' },
      // A unit file the service user can write.
      { answer: ran('directory root root 755\nregular file dems-core root 644\nregular file root root 644\n'), reason: 'NOT_OWNED_BY_ROOT' },
      { answer: ran('directory root root 755\nregular file root root 644\nregular file root dems-netalias 664\n'), reason: 'WRITABLE_BY_GROUP_OR_OTHERS' },
      { answer: ran('directory root root 757\nregular file root root 644\nregular file root root 644\n'), reason: 'WRITABLE_BY_GROUP_OR_OTHERS' },
      { answer: ran('directory dems-core root 755\nregular file root root 644\nregular file root root 644\n'), reason: 'NOT_OWNED_BY_ROOT' },
      { answer: ran('symbolic link root root 777\nregular file root root 644\nregular file root root 644\n'), reason: 'NOT_THE_DELIVERED_KIND' },
    ],
    malformed: [ran(`directory root root 755\n${CANARY}\nregular file root root 644\n`), ran(''), ran('directory root root 755\nregular file root root 644\nregular file root root 644\n', 3)],
  },
  INTERFACE: {
    present: ran('enp3s0\n'),
    absent: [
      { answer: ran('', 1), reason: 'INTERFACE_FILE_ABSENT' },
      // THE NAMED MISMATCH: the file names another interface than the stored row.
      { answer: ran('enp4s0\n'), reason: 'INTERFACE_FILE_DIFFERS_FROM_ROW' },
      { answer: ran('enp3s0\nenp4s0\n'), reason: 'INTERFACE_FILE_NOT_ONE_NAME' },
      { answer: ran(''), reason: 'INTERFACE_FILE_NOT_ONE_NAME' },
      { answer: ran(`${CANARY}\n`), reason: 'INTERFACE_FILE_NOT_ONE_NAME' },
      { answer: ran('../enp3s0\n'), reason: 'INTERFACE_FILE_NOT_ONE_NAME' },
    ],
    malformed: [ran('enp3s0\n', 2), ran(`${'x'.repeat(5_000)}\n`)],
  },
});

/** The interface the prepared host's file names and its stored row names. */
export const PREPARED_INTERFACE = 'enp3s0';

export interface FakeProductionHostOptions extends FakeHostOptions {
  /** Another answer for a question of row 81, by its key of `PROGRAM_ANSWERS`. */
  readonly programAnswers?: Readonly<Record<string, HostCommandResult>>;
  /** The key of a question of row 81, or undefined for a command that is none: handed in, as `codeOf` is. */
  readonly programKeyOf: (command: HostCommand) => string | undefined;
}

/** A prepared Linux production host that answers the questions of BOTH tables (rows 80 and 81) through one runner. */
export function fakeProductionHost(options: FakeProductionHostOptions): FakeHost {
  const base = fakeHost(options);
  const run: CaptureHostDeps['run'] = async (command) => {
    const key = options.programKeyOf(command);
    if (key === undefined) return base.deps.run(command);
    base.asked.push([command.program, ...command.args].join(' '));
    return options.programAnswers?.[key] ?? PROGRAM_ANSWERS[key]?.present ?? { outcome: 'NOT_STARTED' };
  };
  return { deps: { ...base.deps, run }, asked: base.asked };
}
