// The host checks of a production Core (task 4 row 80, WP-20; BR-12 / RC-5, AD-09 (1), C19, P12-F12 (c)).
// No Linux host exists in this track: every question goes to a runner that starts nothing and answers with
// recorded-style outputs (`host-support.ts`). What is proven is the Core's judgement and its wording.
import { describe, expect, it } from 'vitest';
import type { HelperDoor, HelperExit } from '../../adapters/local';
import {
  CaptureHostRefusal,
  HOST_ANSWER_LIMIT,
  HOST_COMMAND_BOUND_MS,
  HOST_COMMAND_CHECKS,
  HOST_REFUSAL_TEXT,
  HostCheckReason,
  HostCheckStatus,
  hostCheckOutcomeOf,
  hostCheckResults,
  hostCommandRunnerOver,
  type HostCommand,
  type HostCommandResult,
} from '../host-checks';
import { CANARY, HOST_ANSWERS, fakeHost, type FakeHostOptions } from './host-support';

const codeOf = (command: HostCommand): string | undefined => HOST_COMMAND_CHECKS.find((check) => check.command.program === command.program && check.command.args.join(' ') === command.args.join(' '))?.code;
const host = (options: Omit<FakeHostOptions, 'codeOf'> = {}): ReturnType<typeof fakeHost> => fakeHost({ ...options, codeOf });
/** The path rule double: every program that is set is usable. */
const usable = (program: string | null): string | null => (program === null ? 'NOT_SET' : null);
const OWN_PROCESS_CHECKS = 4;
const ALL_CHECKS = OWN_PROCESS_CHECKS + HOST_COMMAND_CHECKS.length;

describe('the table of the questions', () => {
  it('every question is an absolute program with literal arguments; no code is asked twice; every code of the vocabulary has a check and a text', () => {
    for (const check of HOST_COMMAND_CHECKS) {
      expect(check.command.program, check.code).toMatch(/^\/usr\/s?bin\/[a-z]+$/);
      for (const argument of check.command.args) expect(argument, check.code).toMatch(/^[\w%^:./ -]+$/);
      expect(check.items.every((item) => /^HOST-\d\d$/.test(item)), check.code).toBe(true);
    }
    expect(new Set(HOST_COMMAND_CHECKS.map((check) => check.code)).size).toBe(HOST_COMMAND_CHECKS.length);
    expect(Object.keys(HOST_ANSWERS).sort()).toEqual(HOST_COMMAND_CHECKS.map((check) => check.code).sort());
    expect(Object.keys(HOST_REFUSAL_TEXT).sort()).toEqual(Object.values(CaptureHostRefusal).sort());
    expect(Object.values(CaptureHostRefusal)).toHaveLength(ALL_CHECKS);
    // BR-12: the loopback rule is the FIRST question to the host.
    expect(HOST_COMMAND_CHECKS[0]?.code).toBe(CaptureHostRefusal.HOST_LOOPBACK_RULE);
  });

  it('the questions are the took-effect checks of the host profile, word for word', () => {
    expect(HOST_COMMAND_CHECKS.map((check) => [check.command.program, ...check.command.args].join(' '))).toEqual([
      '/usr/bin/systemctl is-active dems-loopback-rule.service',
      '/usr/bin/grep -E ^NoNewPrivs: /proc/self/status',
      '/usr/sbin/sysctl -n kernel.core_pattern fs.suid_dumpable',
      '/usr/sbin/sysctl -n net.ipv4.ip_forward net.ipv6.conf.all.forwarding',
      '/usr/bin/dpkg -S /usr/bin/arping',
      '/usr/bin/id -nG',
      '/usr/bin/timedatectl show -p NTPSynchronized --value',
      '/usr/bin/systemctl is-enabled sleep.target suspend.target hibernate.target hybrid-sleep.target',
      '/usr/bin/stat -c %F %U %G %a /run/dems-core-netalias/socket',
    ]);
  });

  it('no text of a refusal holds a path of the host or a program of the table; each names its item of the profile', () => {
    for (const [code, text] of Object.entries(HOST_REFUSAL_TEXT)) {
      expect(text, code).toMatch(/HOST-\d\d/);
      expect(text, code).not.toMatch(/\/usr\/|\/run\/|\/proc\/|\/etc\/|\/opt\//);
    }
  });
});

describe('a prepared host: every prerequisite is in place (control)', () => {
  it('every check is asked once, in order, and none is missing', async () => {
    const prepared = host();
    const results = await hostCheckResults(prepared.deps, usable);
    expect(results.map((entry) => entry.status)).toEqual(Array.from({ length: ALL_CHECKS }, () => HostCheckStatus.IN_PLACE));
    expect(prepared.asked).toHaveLength(HOST_COMMAND_CHECKS.length);
    await expect(hostCheckOutcomeOf(host().deps, usable)).resolves.toEqual({ failure: null, commands: 'ASKED', inPlace: ALL_CHECKS });
  });
});

describe('each question of the host: present, absent, malformed, command not found, time-out', () => {
  for (const check of HOST_COMMAND_CHECKS) {
    const answers = HOST_ANSWERS[check.code];
    if (answers === undefined) throw new Error(`no recorded-style answers for ${check.code}`);
    const outcomeWith = (answer: HostCommandResult | (() => Promise<HostCommandResult>)) => hostCheckOutcomeOf(host({ answers: { [check.code]: answer } }).deps, usable);

    it(`${check.code}: present`, async () => {
      const results = await hostCheckResults(host().deps, usable);
      expect(results.find((entry) => entry.code === check.code)).toEqual({ code: check.code, items: check.items, status: 'IN_PLACE', reason: null });
    });

    it(`${check.code}: absent - the boot names that prerequisite, by its own code and a fixed reason`, async () => {
      for (const { answer, reason } of answers.absent) {
        const outcome = await outcomeWith(answer);
        expect(outcome.failure, reason).toEqual({ code: check.code, reason });
      }
    });

    it(`${check.code}: malformed - an answer of another form is not "in place", and nothing of it is repeated`, async () => {
      for (const answer of [...answers.malformed, { outcome: 'RAN', exitCode: 0, output: `${CANARY}\n`.repeat(200) } as const, { outcome: 'RAN', exitCode: 0, output: 'x'.repeat(HOST_ANSWER_LIMIT + 1) } as const]) {
        const outcome = await outcomeWith(answer);
        expect(outcome.failure, JSON.stringify(answer)).toEqual({ code: check.code, reason: HostCheckReason.ANSWER_NOT_UNDERSTOOD });
        expect(JSON.stringify(outcome)).not.toContain('CANARY');
      }
    });

    it(`${check.code}: command not found, a runner that throws, and a time-out each have their own word`, async () => {
      await expect(outcomeWith({ outcome: 'NOT_STARTED' })).resolves.toMatchObject({ failure: { code: check.code, reason: 'HOST_COMMAND_NOT_STARTED' } });
      await expect(outcomeWith(() => Promise.reject(new Error(CANARY)))).resolves.toMatchObject({ failure: { code: check.code, reason: 'HOST_COMMAND_NOT_STARTED' } });
      await expect(outcomeWith({ outcome: 'TIMED_OUT' })).resolves.toMatchObject({ failure: { code: check.code, reason: 'HOST_COMMAND_TIMED_OUT' } });
    });
  }

  it('the diagnostics list every check with its status; the boot asks nothing after the first that is missing', async () => {
    const broken = { [CaptureHostRefusal.HOST_FORWARDING]: HOST_ANSWERS[CaptureHostRefusal.HOST_FORWARDING]?.absent[0]?.answer ?? { outcome: 'NOT_STARTED' as const }, [CaptureHostRefusal.HOST_TIME_SYNC]: { outcome: 'TIMED_OUT' as const } };
    const all = host({ answers: broken });
    const results = await hostCheckResults(all.deps, usable);
    expect(results).toHaveLength(ALL_CHECKS);
    expect(results.filter((entry) => entry.status === 'MISSING').map((entry) => [entry.code, entry.reason])).toEqual([
      [CaptureHostRefusal.HOST_FORWARDING, 'FORWARDING_ON'],
      [CaptureHostRefusal.HOST_TIME_SYNC, 'HOST_COMMAND_TIMED_OUT'],
    ]);
    expect(all.asked).toHaveLength(HOST_COMMAND_CHECKS.length);
    const boot = host({ answers: broken });
    await expect(hostCheckOutcomeOf(boot.deps, usable)).resolves.toMatchObject({ failure: { code: CaptureHostRefusal.HOST_FORWARDING } });
    expect(boot.asked).toHaveLength(HOST_COMMAND_CHECKS.findIndex((check) => check.code === CaptureHostRefusal.HOST_FORWARDING) + 1);
  });
});

describe('the checks of the Core\'s own process and programs (no command; every platform)', () => {
  const failureOf = async (options: Omit<FakeHostOptions, 'codeOf'>, programProblem = usable) => (await hostCheckOutcomeOf(host(options).deps, programProblem)).failure;

  it('AD-09 (1): a core-file limit of 0 passes; a limit above 0, an unlimited one and one that cannot be read are named', async () => {
    await expect(failureOf({ coreFileLimit: () => 0 })).resolves.toBeNull();
    for (const limit of [1, 2048, Infinity]) await expect(failureOf({ coreFileLimit: () => limit })).resolves.toEqual({ code: 'CAPTURE_HOST_CORE_FILE_LIMIT', reason: 'LIMIT_ABOVE_ZERO' });
    await expect(failureOf({ coreFileLimit: () => null })).resolves.toEqual({ code: 'CAPTURE_HOST_CORE_FILE_LIMIT', reason: 'LIMIT_UNREADABLE' });
    await expect(failureOf({ coreFileLimit: () => { throw new Error(CANARY); } })).resolves.toEqual({ code: 'CAPTURE_HOST_CORE_FILE_LIMIT', reason: 'LIMIT_UNREADABLE' });
  });

  it('AD-09 (1): a start without a diagnostic switch passes; a report, heap or debugger switch and a set option variable are named, the switch is not repeated', async () => {
    await expect(failureOf({ startArguments: ['--import', 'tsx', '--max-old-space-size=4096'] })).resolves.toBeNull();
    for (const argument of ['--report-on-fatalerror', '--report-uncaught-exception', '--diagnostic-dir=/var/tmp/x', '--heapsnapshot-signal=SIGUSR2', '--heap-prof', '--inspect=0.0.0.0:9229', '--inspect-brk']) {
      await expect(failureOf({ startArguments: ['--import', 'tsx', argument] }), argument).resolves.toEqual({ code: 'CAPTURE_HOST_DIAGNOSTIC_SWITCH', reason: 'DIAGNOSTIC_SWITCH_SET' });
    }
    await expect(failureOf({ nodeOptionsSet: true })).resolves.toEqual({ code: 'CAPTURE_HOST_DIAGNOSTIC_SWITCH', reason: 'NODE_OPTIONS_SET' });
  });

  it('the relay and the guard: present under the path rule passes; not set, or refused by the rule, is named with the word of the rule', async () => {
    const rule = (program: string | null): string | null => (program === null ? 'NOT_SET' : program.endsWith('/bad') ? 'WRITABLE_BY_OTHERS' : null);
    await expect(failureOf({}, rule)).resolves.toBeNull();
    await expect(failureOf({ relayProgram: null }, rule)).resolves.toEqual({ code: 'CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE', reason: 'NOT_SET' });
    await expect(failureOf({ relayProgram: '/srv/dems/bad' }, rule)).resolves.toEqual({ code: 'CAPTURE_HOST_RELAY_PROGRAM_UNUSABLE', reason: 'WRITABLE_BY_OTHERS' });
    await expect(failureOf({ guardProgram: null }, rule)).resolves.toEqual({ code: 'CAPTURE_HOST_GUARD_PROGRAM_UNUSABLE', reason: 'NOT_SET' });
    await expect(failureOf({ guardProgram: '/srv/dems/bad' }, rule)).resolves.toEqual({ code: 'CAPTURE_HOST_GUARD_PROGRAM_UNUSABLE', reason: 'WRITABLE_BY_OTHERS' });
  });

  it('on a host that is not Linux no question is asked and none is answered "in place": the own-process checks still run', async () => {
    const mac = host({ platform: 'darwin' });
    await expect(hostCheckOutcomeOf(mac.deps, usable)).resolves.toEqual({ failure: null, commands: 'NOT_LINUX', inPlace: OWN_PROCESS_CHECKS });
    expect(mac.asked).toEqual([]);
    const results = await hostCheckResults(mac.deps, usable);
    expect(results.slice(OWN_PROCESS_CHECKS).map((entry) => entry.status)).toEqual(HOST_COMMAND_CHECKS.map(() => 'NOT_ASKED'));
    await expect(hostCheckOutcomeOf(host({ platform: 'darwin', coreFileLimit: () => Infinity }).deps, usable)).resolves.toMatchObject({ failure: { code: 'CAPTURE_HOST_CORE_FILE_LIMIT' } });
  });
});

describe('the runner over a door that is handed in (it starts nothing itself)', () => {
  interface DoorScene {
    readonly door: HelperDoor;
    readonly started: Array<{ readonly command: string; readonly args: readonly string[]; readonly env: unknown }>;
    readonly killed: string[];
    readonly timers: { after(delayMs: number, callback: () => void): () => void };
    readonly bounds: number[];
    fire(): void;
    readonly cancelled: () => number;
  }
  function doorScene(exit: Partial<HelperExit> | 'never'): DoorScene {
    const started: DoorScene['started'] = [];
    const killed: string[] = [];
    const bounds: number[] = [];
    let pending: (() => void) | null = null;
    let cancelled = 0;
    let end: (value: HelperExit) => void = () => {};
    const ended = new Promise<HelperExit>((resolve) => (end = resolve));
    const full = (part: Partial<HelperExit>): HelperExit => ({ exitCode: 0, signal: null, spawnFailed: false, diagnostics: '', output: '', ...part });
    return {
      started,
      killed,
      bounds,
      timers: {
        after: (delayMs, callback) => {
          bounds.push(delayMs);
          pending = callback;
          return () => void (cancelled += 1);
        },
      },
      fire: () => pending?.(),
      cancelled: () => cancelled,
      door: (options) => {
        started.push({ command: options.command, args: options.args, env: options.env });
        if (exit !== 'never') end(full(exit));
        return {
          pid: 4242,
          ended,
          alive: () => true,
          kill: (signal) => {
            killed.push(signal);
            end(full({ exitCode: null, signal }));
          },
        };
      },
    };
  }
  const QUESTION: HostCommand = { program: '/usr/bin/id', args: ['-nG'] };

  it('hands the program and the arguments to the door unchanged, with no environment of its own, and returns the output and the exit code', async () => {
    const scene = doorScene({ exitCode: 3, output: 'inactive\n', diagnostics: CANARY });
    const result = await hostCommandRunnerOver(scene.door, scene.timers)(QUESTION);
    expect(result).toEqual({ outcome: 'RAN', exitCode: 3, output: 'inactive\n' });
    expect(scene.started).toEqual([{ command: '/usr/bin/id', args: ['-nG'], env: undefined }]);
    expect(scene.bounds).toEqual([HOST_COMMAND_BOUND_MS]);
    expect(scene.cancelled()).toBe(1);
    expect(scene.killed).toEqual([]);
  });

  it('a program that could not be started is NOT_STARTED; one ended by a signal is an answer no rule understands', async () => {
    await expect(hostCommandRunnerOver(doorScene({ spawnFailed: true, exitCode: null }).door, doorScene('never').timers)(QUESTION)).resolves.toEqual({ outcome: 'NOT_STARTED' });
    await expect(hostCommandRunnerOver(doorScene({ exitCode: null, signal: 'SIGSEGV', output: 'audio\n' }).door, doorScene('never').timers)(QUESTION)).resolves.toEqual({ outcome: 'RAN', exitCode: -1, output: 'audio\n' });
  });

  it('a program that does not end within the bound is stopped and answered TIMED_OUT, whatever it had printed', async () => {
    const scene = doorScene('never');
    const answer = hostCommandRunnerOver(scene.door, scene.timers, 250)(QUESTION);
    scene.fire();
    await expect(answer).resolves.toEqual({ outcome: 'TIMED_OUT' });
    expect(scene.killed).toEqual(['SIGKILL']);
    expect(scene.bounds).toEqual([250]);
  });
});
