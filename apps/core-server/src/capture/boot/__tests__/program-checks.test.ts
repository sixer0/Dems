// Task 4 row 81 (WP-20): the boot checks of the DELIVERED PROGRAMS, on fixture outputs.
//
// The four checks (`program-checks.ts`), each with a passing and a failing fixture - the eight cases
// of the row's cell are block 1 - and then every other answer the double knows. The double is the
// runner of `host-support.ts`: it starts nothing; its answers are written by hand from what the host
// profile states `stat` and `cat` print and from the relay's header. No Linux host exists in this
// track (decision U13): what is proven is the Core's judgement of an answer of that form.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY, WORKSPACE, stripComments } from '../../../../test/static/scan';
import type { HostCommand, HostCommandResult } from '../host-checks';
import {
  CaptureProgramRefusal,
  INTERFACE_FILE_COMMAND,
  PROGRAM_OWNERSHIP_CHECKS,
  PROGRAM_REFUSAL_TEXT,
  ProgramCheckReason,
  ProgramCheckStatus,
  RELAY_EXIT,
  deliveredProgramOutcomeOf,
  deliveredProgramResults,
  type DeliveredProgramDeps,
} from '../program-checks';
import { CANARY, PREPARED_INTERFACE, PROGRAM_ANSWERS } from './host-support';

const RELAY = '/srv/dems/relay';
const sameCommand = (a: HostCommand, b: HostCommand): boolean => a.program === b.program && a.args.join('\u0000') === b.args.join('\u0000');
/** The key of a question in `PROGRAM_ANSWERS`. */
const keyOf = (command: HostCommand): string | undefined => {
  if (command.program === RELAY && command.args.length === 0) return 'RELAY';
  if (sameCommand(command, INTERFACE_FILE_COMMAND)) return 'INTERFACE';
  return PROGRAM_OWNERSHIP_CHECKS.find((check) => sameCommand(check.command, command))?.code;
};

interface Host {
  readonly deps: DeliveredProgramDeps;
  readonly asked: string[];
  /** How often the stored interface was read. */
  reads(): number;
}

function host(options: { readonly answers?: Readonly<Record<string, HostCommandResult>>; readonly platform?: string; readonly relayProgram?: string | null; readonly stored?: string | null | (() => Promise<string | null>) } = {}): Host {
  const asked: string[] = [];
  let reads = 0;
  const deps: DeliveredProgramDeps = {
    platform: options.platform ?? 'linux',
    relayProgram: options.relayProgram === undefined ? RELAY : options.relayProgram,
    run: async (command) => {
      asked.push([command.program, ...command.args].join(' '));
      const key = keyOf(command);
      if (key === undefined) return { outcome: 'NOT_STARTED' };
      return options.answers?.[key] ?? PROGRAM_ANSWERS[key]?.present ?? { outcome: 'NOT_STARTED' };
    },
    storedInterface: async () => {
      reads += 1;
      return typeof options.stored === 'function' ? options.stored() : options.stored === undefined ? PREPARED_INTERFACE : options.stored;
    },
  };
  return { deps, asked, reads: () => reads };
}

/** The path rule of the boot, as a stand-in: usable unless the program is unset. */
const usable = (program: string | null): string | null => (program === null ? 'NOT_SET' : null);
const answerOf = (key: string, index = 0): HostCommandResult => {
  const answer = PROGRAM_ANSWERS[key]?.absent[index]?.answer;
  if (answer === undefined) throw new Error(`no failing answer ${key}[${String(index)}]`);
  return answer;
};
const statusOf = async (deps: DeliveredProgramDeps, code: string): Promise<{ status: string; reason: string | null } | undefined> => {
  const found = (await deliveredProgramResults(deps, usable)).find((entry) => entry.code === code);
  return found === undefined ? undefined : { status: found.status, reason: found.reason };
};

// ── 1. The row's cell: each of the four checks with a passing and a failing fixture ────────────

describe('row 81 (1): the four checks, a passing and a failing fixture each', () => {
  it('1 pass - the relay, started with no argument and no start message, came past its library statement (exit code 10)', async () => {
    const prepared = host();
    expect(await statusOf(prepared.deps, CaptureProgramRefusal.PROGRAM_RELAY_LIBRARY)).toEqual({ status: 'IN_PLACE', reason: null });
    expect(prepared.asked[0]).toBe(RELAY);
  });

  it('1 fail - a relay on another media library says so with its own exit code: refused RELAY_LIBRARY_VERSION_MISMATCH', async () => {
    const outcome = await deliveredProgramOutcomeOf(host({ answers: { RELAY: answerOf('RELAY') } }).deps, usable);
    expect(outcome.failure).toEqual({ code: 'CAPTURE_HOST_RELAY_LIBRARY_UNVERIFIED', reason: 'RELAY_LIBRARY_VERSION_MISMATCH' });
  });

  it('2 pass - the helper file is a regular file of root, and neither it nor its directory can be written by group or others', async () => {
    expect(await statusOf(host().deps, CaptureProgramRefusal.PROGRAM_ALIAS_HELPER)).toEqual({ status: 'IN_PLACE', reason: null });
  });

  it('2 fail - a helper file owned by the service user is refused NOT_OWNED_BY_ROOT', async () => {
    const outcome = await deliveredProgramOutcomeOf(host({ answers: { [CaptureProgramRefusal.PROGRAM_ALIAS_HELPER]: answerOf(CaptureProgramRefusal.PROGRAM_ALIAS_HELPER, 3) } }).deps, usable);
    expect(outcome.failure).toEqual({ code: 'CAPTURE_HOST_ALIAS_HELPER_UNSAFE', reason: 'NOT_OWNED_BY_ROOT' });
  });

  it('3 pass - the grant: the directory of the socket and the two unit files are root\'s and not writable by group or others', async () => {
    expect(await statusOf(host().deps, CaptureProgramRefusal.PROGRAM_ALIAS_GRANT)).toEqual({ status: 'IN_PLACE', reason: null });
  });

  it('3 fail - a unit file the service user can write is refused', async () => {
    const outcome = await deliveredProgramOutcomeOf(host({ answers: { [CaptureProgramRefusal.PROGRAM_ALIAS_GRANT]: answerOf(CaptureProgramRefusal.PROGRAM_ALIAS_GRANT, 1) } }).deps, usable);
    expect(outcome.failure).toEqual({ code: 'CAPTURE_HOST_ALIAS_GRANT_UNSAFE', reason: 'NOT_OWNED_BY_ROOT' });
  });

  it('4 pass - the interface file names the interface of the stored row', async () => {
    const prepared = host();
    expect(await statusOf(prepared.deps, CaptureProgramRefusal.PROGRAM_INTERFACE_FILE)).toEqual({ status: 'IN_PLACE', reason: null });
    expect(prepared.reads()).toBe(1);
    await expect(deliveredProgramOutcomeOf(host().deps, usable)).resolves.toEqual({ failure: null, inPlace: 4, notAsked: 0 });
  });

  it('4 fail - A MISMATCH OF FILE AND ROW IS A NAMED REFUSAL: CAPTURE_HOST_INTERFACE_FILE_MISMATCH / INTERFACE_FILE_DIFFERS_FROM_ROW, and neither name is said', async () => {
    const outcome = await deliveredProgramOutcomeOf(host({ answers: { INTERFACE: answerOf('INTERFACE', 1) } }).deps, usable);
    expect(outcome.failure).toEqual({ code: 'CAPTURE_HOST_INTERFACE_FILE_MISMATCH', reason: 'INTERFACE_FILE_DIFFERS_FROM_ROW' });
    // The same from the other side: the row names another interface than the file.
    const other = await deliveredProgramOutcomeOf(host({ stored: 'enp9s0' }).deps, usable);
    expect(other.failure).toEqual({ code: 'CAPTURE_HOST_INTERFACE_FILE_MISMATCH', reason: 'INTERFACE_FILE_DIFFERS_FROM_ROW' });
    expect(JSON.stringify([outcome, other])).not.toMatch(/enp[0-9]s0/);
  });
});

// ── 2. Every other answer the double knows ──────────────────────────────────────────

describe('row 81 (2): every failing and every malformed answer is refused by the check it belongs to; a check that cannot see never answers "in place"', () => {
  const codeOfKey = (key: string): string => (key === 'RELAY' ? CaptureProgramRefusal.PROGRAM_RELAY_LIBRARY : key === 'INTERFACE' ? CaptureProgramRefusal.PROGRAM_INTERFACE_FILE : key);

  it.each(Object.keys(PROGRAM_ANSWERS))('%s: each absent answer gives its reason; each malformed answer, a program that is not there and one that does not end give a reason of their own', async (key) => {
    const answers = PROGRAM_ANSWERS[key];
    if (answers === undefined) throw new Error('no answers');
    for (const entry of answers.absent) {
      const outcome = await deliveredProgramOutcomeOf(host({ answers: { [key]: entry.answer } }).deps, usable);
      expect(outcome.failure, JSON.stringify(entry.answer)).toEqual({ code: codeOfKey(key), reason: entry.reason });
    }
    for (const answer of answers.malformed) {
      const outcome = await deliveredProgramOutcomeOf(host({ answers: { [key]: answer } }).deps, usable);
      expect(outcome.failure, JSON.stringify(answer)).toEqual({ code: codeOfKey(key), reason: ProgramCheckReason.ANSWER_NOT_UNDERSTOOD });
      expect(JSON.stringify(outcome)).not.toMatch(/CANARY|hunter2|\/home\//);
    }
    expect((await deliveredProgramOutcomeOf(host({ answers: { [key]: { outcome: 'NOT_STARTED' } } }).deps, usable)).failure).toEqual({ code: codeOfKey(key), reason: 'HOST_COMMAND_NOT_STARTED' });
    expect((await deliveredProgramOutcomeOf(host({ answers: { [key]: { outcome: 'TIMED_OUT' } } }).deps, usable)).failure).toEqual({ code: codeOfKey(key), reason: 'HOST_COMMAND_TIMED_OUT' });
    expect(CANARY).toMatch(/hunter2/);
  });

  it('a runner that throws is a program that could not be started', async () => {
    const prepared = host();
    const throwing: DeliveredProgramDeps = { ...prepared.deps, run: async () => Promise.reject(new Error(CANARY)) };
    expect((await deliveredProgramOutcomeOf(throwing, usable)).failure).toEqual({ code: 'CAPTURE_HOST_RELAY_LIBRARY_UNVERIFIED', reason: 'HOST_COMMAND_NOT_STARTED' });
  });

  it('the boot stops at the first check that is missing: nothing is asked after it', async () => {
    const unprepared = host({ answers: { [CaptureProgramRefusal.PROGRAM_ALIAS_HELPER]: answerOf(CaptureProgramRefusal.PROGRAM_ALIAS_HELPER) } });
    await deliveredProgramOutcomeOf(unprepared.deps, usable);
    expect(unprepared.asked).toHaveLength(2);
    expect(unprepared.reads()).toBe(0);
    // The diagnostics ask all four.
    const all = host({ answers: { [CaptureProgramRefusal.PROGRAM_ALIAS_HELPER]: answerOf(CaptureProgramRefusal.PROGRAM_ALIAS_HELPER) } });
    expect((await deliveredProgramResults(all.deps, usable)).map((entry) => entry.status)).toEqual(['IN_PLACE', 'MISSING', 'IN_PLACE', 'IN_PLACE']);
    expect(all.asked).toHaveLength(4);
  });

  it('the relay is never started from a path that fails the path rule: the rule\'s word is the reason and no question is asked', async () => {
    const unset = host({ relayProgram: null });
    expect((await deliveredProgramOutcomeOf(unset.deps, usable)).failure).toEqual({ code: 'CAPTURE_HOST_RELAY_LIBRARY_UNVERIFIED', reason: 'NOT_SET' });
    const writable = host();
    expect((await deliveredProgramOutcomeOf(writable.deps, () => 'FILE_WRITABLE')).failure).toEqual({ code: 'CAPTURE_HOST_RELAY_LIBRARY_UNVERIFIED', reason: 'FILE_WRITABLE' });
    expect([...unset.asked, ...writable.asked]).toEqual([]);
  });
});

// ── 3. The stored row ───────────────────────────────────────────────────────────────

describe('row 81 (3): the interface file is held against the stored row, and against nothing else', () => {
  it('a database with no stored interface: the file is NOT read and the check says NOT_ASKED - not "in place"', async () => {
    const fresh = host({ stored: null });
    expect(await statusOf(fresh.deps, CaptureProgramRefusal.PROGRAM_INTERFACE_FILE)).toEqual({ status: 'NOT_ASKED', reason: null });
    expect(fresh.asked.some((question) => question.startsWith('/usr/bin/cat'))).toBe(false);
    await expect(deliveredProgramOutcomeOf(host({ stored: null }).deps, usable)).resolves.toEqual({ failure: null, inPlace: 3, notAsked: 1 });
  });

  it('a stored row that cannot be read refuses the start (fail closed), and nothing of the reader\'s error is passed on', async () => {
    const outcome = await deliveredProgramOutcomeOf(host({ stored: async () => Promise.reject(new Error(CANARY)) }).deps, usable);
    expect(outcome.failure).toEqual({ code: 'CAPTURE_HOST_INTERFACE_FILE_MISMATCH', reason: 'INTERFACE_ROW_UNREADABLE' });
    // A stored value that is no interface name (the column's own constraint forbids it) is not compared with anything.
    for (const stored of ['../etc', 'two words', '', 'x'.repeat(16)]) {
      const odd = host({ stored });
      expect((await deliveredProgramOutcomeOf(odd.deps, usable)).failure, stored).toEqual({ code: 'CAPTURE_HOST_INTERFACE_FILE_MISMATCH', reason: 'INTERFACE_ROW_UNREADABLE' });
      expect(odd.asked.some((question) => question.startsWith('/usr/bin/cat'))).toBe(false);
    }
  });
});

// ── 4. Another platform ───────────────────────────────────────────────────────────

describe('row 81 (4): off Linux the three questions to the host are not asked; the relay still is', () => {
  it('darwin: the relay is asked (its exit codes are its own), the helper, the grant and the interface file are NOT_ASKED, and the stored row is not read', async () => {
    const mac = host({ platform: 'darwin' });
    expect((await deliveredProgramResults(mac.deps, usable)).map((entry) => entry.status)).toEqual(['IN_PLACE', 'NOT_ASKED', 'NOT_ASKED', 'NOT_ASKED']);
    expect(mac.asked).toEqual([RELAY]);
    expect(mac.reads()).toBe(0);
    await expect(deliveredProgramOutcomeOf(host({ platform: 'darwin' }).deps, usable)).resolves.toEqual({ failure: null, inPlace: 1, notAsked: 3 });
    // A relay on another library is refused on every platform.
    expect((await deliveredProgramOutcomeOf(host({ platform: 'darwin', answers: { RELAY: answerOf('RELAY') } }).deps, usable)).failure?.reason).toBe('RELAY_LIBRARY_VERSION_MISMATCH');
  });
});

// ── 5. The tables, the relay's interface and the file itself ──────────────────────────

describe('row 81 (5): what the checks ask and what the file may reach', () => {
  /** The code of the file, comments removed. */
  const source = stripComments(readFileSync(join(WORKSPACE, 'src/capture/boot/program-checks.ts'), 'utf8'));

  it('the questions: `stat` on literal paths of the helper\'s delivery, `cat` on the interface file, the relay with no argument', () => {
    expect(PROGRAM_OWNERSHIP_CHECKS.map((check) => [check.code, check.command.program, ...check.command.args])).toEqual([
      ['CAPTURE_HOST_ALIAS_HELPER_UNSAFE', '/usr/bin/stat', '-c', '%F %U %G %a', '/usr/local/sbin/dems-core-netalias', '/usr/local/sbin'],
      ['CAPTURE_HOST_ALIAS_GRANT_UNSAFE', '/usr/bin/stat', '-c', '%F %U %G %a', '/run/dems-core-netalias', '/etc/systemd/system/dems-core-netalias.socket', '/etc/systemd/system/dems-core-netalias@.service'],
    ]);
    expect(INTERFACE_FILE_COMMAND).toEqual({ program: '/usr/bin/cat', args: ['/etc/dems/netalias-interface'] });
    expect(Object.isFrozen(PROGRAM_OWNERSHIP_CHECKS) && PROGRAM_OWNERSHIP_CHECKS.every((check) => Object.isFrozen(check) && Object.isFrozen(check.command) && Object.isFrozen(check.command.args))).toBe(true);
  });

  it('the paths are the ones the helper\'s delivery fixes (its file, its socket unit and the host profile)', () => {
    const helper = readFileSync(join(REPOSITORY, 'scripts/host/netalias/dems-core-netalias'), 'utf8');
    expect(helper).toContain('INTERFACE_FILE = "/etc/dems/netalias-interface"');
    expect(helper).toMatch(/^INTERFACE_NAME = re\.compile\(r"\\A\[A-Za-z0-9\]\[A-Za-z0-9_\.-\]\{0,14\}\\Z"\)$/m);
    expect(readFileSync(join(REPOSITORY, 'scripts/host/netalias/dems-core-netalias.socket'), 'utf8')).toMatch(/^ListenStream=\/run\/dems-core-netalias\/socket$/m);
    const record = readFileSync(join(REPOSITORY, 'docs/2026-10-12_input_av_core_adapter_plan/implementation/104_alias_helper.md'), 'utf8');
    expect(record).toContain('`/usr/local/sbin/dems-core-netalias`');
    expect(record).toContain('`/etc/systemd/system/`');
  });

  it('the relay\'s exit codes are the ones its header states (the relay\'s INTERFACE: no internal of it is read)', () => {
    const header = readFileSync(join(REPOSITORY, 'apps/capture-worker/src/relay/relay.h'), 'utf8');
    const stated = (name: string): number => Number(new RegExp(`^\\s*${name} = (\\d+),`, 'm').exec(header)?.[1] ?? Number.NaN);
    expect(RELAY_EXIT).toEqual({
      START_MESSAGE_INVALID: stated('RELAY_START_MESSAGE_INVALID'),
      START_MESSAGE_TIMEOUT: stated('RELAY_START_MESSAGE_TIMEOUT'),
      LIBAVFORMAT_VERSION_MISMATCH: stated('RELAY_LIBAVFORMAT_VERSION_MISMATCH'),
      HYGIENE_FAILED: stated('RELAY_HYGIENE_FAILED'),
    });
    expect(RELAY_EXIT).toEqual({ START_MESSAGE_INVALID: 10, START_MESSAGE_TIMEOUT: 11, LIBAVFORMAT_VERSION_MISMATCH: 12, HYGIENE_FAILED: 13 });
  });

  it('the file imports types only: no process module, no file system, no socket, no timer, no environment; it logs nothing; no program that changes the host and no shell', () => {
    expect(source.match(/^import .*$/gm)).toEqual(["import type { HostCommand, HostCommandResult, HostCommandRunner } from './host-checks';"]);
    expect(source).not.toMatch(/\bprocess\s*\.|\brequire\(|\bimport\(|node:|\bsetTimeout\b|\bDate\b|\bMath\.random\b|\bconsole\b|\.(?:warn|info|error|debug)\s*\(/);
    expect([...new Set(source.match(/'\/(?:usr|bin|sbin)\/[^']*'/g) ?? [])].sort()).toEqual(["'/usr/bin/cat'", "'/usr/bin/stat'", "'/usr/local/sbin'", "'/usr/local/sbin/dems-core-netalias'"]);
    expect(source.match(/'(?:\/usr)?\/s?bin\/(?:sh|bash|env|sudo|nft|ufw|ip|usermod|install|tee|chmod|chown)'/g)).toBeNull();
    // The runner is called in two places: a command of a table (through `answerOf`), and the relay with an EMPTY argument list.
    expect([...source.matchAll(/\brun\(([^)]*)\)/g)].map((match) => match[1])).toEqual(['command', '{ program: deps.relayProgram, args: [] }']);
  });

  it('every code has a text that names its item of the host profile and no path of the host; the vocabulary is closed', () => {
    expect(Object.values(CaptureProgramRefusal)).toEqual(['CAPTURE_HOST_RELAY_LIBRARY_UNVERIFIED', 'CAPTURE_HOST_ALIAS_HELPER_UNSAFE', 'CAPTURE_HOST_ALIAS_GRANT_UNSAFE', 'CAPTURE_HOST_INTERFACE_FILE_MISMATCH']);
    expect(Object.keys(PROGRAM_REFUSAL_TEXT).sort()).toEqual(Object.values(CaptureProgramRefusal).sort());
    for (const text of Object.values(PROGRAM_REFUSAL_TEXT)) expect(text).not.toMatch(/\/usr\/|\/run\/|\/etc\/|\/proc\//);
    for (const code of [CaptureProgramRefusal.PROGRAM_ALIAS_HELPER, CaptureProgramRefusal.PROGRAM_ALIAS_GRANT, CaptureProgramRefusal.PROGRAM_INTERFACE_FILE]) expect(PROGRAM_REFUSAL_TEXT[code]).toMatch(/HOST-4[456]/);
    expect(Object.values(ProgramCheckStatus)).toEqual(['IN_PLACE', 'MISSING', 'NOT_ASKED']);
    for (const reason of Object.values(ProgramCheckReason)) expect(reason).toMatch(/^[A-Z][A-Z_]+$/);
  });
});
