// The production process door at run time (task 4 blueprint row 21, WP-02; addendum 2.3 step 4;
// S13-02 (b) (d), AD-03 point 6, AD-09 point 3, BR-07 (4)).
//
// THE DOUBLE. No relay exists yet (rows 40 to 43) and no Linux host is used: every child here is
// `test/support/production-door-double.mjs`, a node script started with `process.execPath`. It
// reports what it was started with and what it read, never reads, or exits at once. What this
// proves is the DOOR: what leaves the Core, through which channel, and what is left of it.
//
// The serialiser is wrapped (not replaced): the test keeps the buffer the door was given, to see
// that the door cleared it, and a copy made before the door had it, to compare with what arrived.
// Byte and value comparisons are asserted as booleans, so a failing run prints `false`, not a value.
import { resolve } from 'node:path';
import { inspect } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { createSystemTimers } from '../../timers';
import { CREDENTIAL_MARK, credentialAtInjection, sealCredential, streamLocator, type StartMessage } from '../credential';
import {
  PRODUCTION_ENVIRONMENT_KEYS,
  ProductionDoorError,
  ProductionDoorRefusal,
  coreFileLimitOfThisProcess,
  startProductionProcess,
  type ProductionEnvironment,
  type ProductionProcess,
  type ProductionProcessOptions,
} from '../production-door';
// Row N5 (masterplan 06 revision 3): the observer of standard error. Its cases are the last four blocks of this file.
import type { CaptureTimers } from '../../types';
import {
  PRODUCTION_DIAGNOSTICS_LIFE_LINES,
  PRODUCTION_DIAGNOSTICS_LINES_PER_SECOND,
  PRODUCTION_DIAGNOSTICS_LINE_CHARS,
  PRODUCTION_DIAGNOSTICS_SECOND_MS,
  PRODUCTION_OUTPUT_CAP_BYTES,
  // Row N5b (decision C131): the per-call cap and the process group. Its cases are the last block of this file.
  PRODUCTION_OUTPUT_CAP_MAX_BYTES,
  type ProductionDiagnosticsEvent,
} from '../production-door';

const made = vi.hoisted(() => ({ handed: [] as Buffer[], copies: [] as Buffer[] }));
vi.mock('../credential', async (importOriginal) => {
  const original = await importOriginal<typeof import('../credential')>();
  return {
    ...original,
    startMessageBytes: (message: StartMessage): Buffer => {
      const bytes = original.startMessageBytes(message);
      made.copies.push(Buffer.from(bytes));
      made.handed.push(bytes);
      return bytes;
    },
  };
});

const DOUBLE = resolve(__dirname, '../../../../test/support/production-door-double.mjs');
const NODE = process.execPath;
const CANARY = { username: 'canary-user-21a7c3', secret: 'canary-secret-21f09e' } as const;
const LOCATOR = streamLocator({ host: '192.0.2.21', port: 554, path: 'stream/main' });
const NEEDLES = [CANARY.username, CANARY.secret, LOCATOR, '192.0.2.21'];
/** Set by the child's own runtime on macOS when it starts; the door hands over no such key. */
const SET_BY_THE_CHILD_ITSELF = '__CF_USER_TEXT_ENCODING';
/** Larger than any pipe of this host holds: a child that does not read leaves the write open. */
const LARGE = 'x'.repeat(4 * 1024 * 1024);

const timers = createSystemTimers();
const access = (): StartMessage => ({ type: 'start', slot: 1, access: credentialAtInjection(LOCATOR, sealCredential(CANARY)) });
const start = (mode: string, patch: Partial<ProductionProcessOptions> = {}): ProductionProcess =>
  startProductionProcess({ command: NODE, args: [DOUBLE, mode, '--slot', 'A'], message: null, timers, ...patch });
const lastHanded = (): { handed: Buffer; copy: Buffer } => ({ handed: made.handed.at(-1) ?? Buffer.alloc(1, 1), copy: made.copies.at(-1) ?? Buffer.alloc(0) });
const cleared = (bytes: Buffer): boolean => bytes.length > 0 && bytes.every((byte) => byte === 0);
/** A zombie still answers signal 0; a child that was waited for does not exist. */
const exists = (pid: number | null): boolean => {
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const refusalOf = async (child: ProductionProcess): Promise<unknown> => child.started.then(() => null, (error: unknown) => error);
const free = (text: string): boolean => NEEDLES.every((needle) => !text.includes(needle));

interface Report {
  readonly argv: readonly string[];
  readonly env: Readonly<Record<string, string>>;
  readonly stdinHex: string;
  readonly afterLine: number;
  readonly coreSoft: unknown;
}

/** Starts the double in `report` mode and resolves with its one line. */
function reporting(patch: Partial<ProductionProcessOptions>): { child: ProductionProcess; report: Promise<Report> } {
  let text = '';
  let tell: (report: Report) => void = () => {};
  const report = new Promise<Report>((done) => {
    tell = done;
  });
  const child = start('report', {
    ...patch,
    onOutput: (chunk) => {
      text += chunk.toString('utf8');
      if (text.includes('\n')) tell(JSON.parse(text.slice(0, text.indexOf('\n'))) as Report);
    },
  });
  return { child, report };
}

describe('the production door: the start message goes to standard input and nowhere else', () => {
  it('the host of this run has a core-file limit of 0, as a production Core has (AD-09)', () => {
    expect(coreFileLimitOfThisProcess()).toBe(0);
  });

  it('the message arrives byte-exact on standard input; the argument list and the environment hold none of it; the buffer is cleared; the pipe stays open; the child is waited for', async () => {
    const environment: ProductionEnvironment = { ALSA_CONFIG_PATH: '/data/dems/run/capture/asound.conf' };
    const { child, report } = reporting({ message: access(), env: environment });
    await child.started;
    const { handed, copy } = lastHanded();
    const seen = await report;

    // What arrived is what the serialiser made: one JSON line, the access nested, a line feed last.
    expect(seen.stdinHex === copy.toString('hex')).toBe(true);
    expect(seen.afterLine).toBe(0);
    expect(copy.at(-1)).toBe(0x0a);
    const line = JSON.parse(Buffer.from(seen.stdinHex, 'hex').toString('utf8')) as { type: string; slot: number; access: { locator: string; username: string; secret: string } };
    expect(Object.keys(line)).toEqual(['type', 'slot', 'access']);
    expect(Object.keys(line.access)).toEqual(['locator', 'username', 'secret']);
    expect(line.access.locator === LOCATOR && line.access.username === CANARY.username && line.access.secret === CANARY.secret).toBe(true);

    // Not an argument, not an environment variable.
    expect(seen.argv).toEqual(['report', '--slot', 'A']);
    expect(free(JSON.stringify({ argv: seen.argv, env: seen.env }))).toBe(true);
    // Control: the same search finds the message where it IS, in what the child read.
    expect(free(Buffer.from(seen.stdinHex, 'hex').toString('utf8'))).toBe(false);
    // Exactly the listed keys the caller gave, and nothing of the server's own environment.
    expect(Object.keys(seen.env).filter((key) => key !== SET_BY_THE_CHILD_ITSELF)).toEqual(['ALSA_CONFIG_PATH']);
    expect(Object.keys(process.env).length).toBeGreaterThan(3);
    // The child inherited the limit the door checked.
    expect(seen.coreSoft).toBe(0);

    // The door cleared the bytes it was given, all of them.
    expect(handed.length).toBe(copy.length);
    expect(cleared(handed)).toBe(true);

    // Standard input is still open: the child lives until it ends, and then ends by itself (code 7 of the double).
    expect(child.alive()).toBe(true);
    expect(exists(child.pid)).toBe(true);
    child.endInput();
    const exit = await child.ended;
    expect(exit).toMatchObject({ exitCode: 7, signal: null, spawnFailed: false, diagnostics: '' });
    expect(free(exit.output)).toBe(true);
    expect(child.alive()).toBe(false);
    expect(exists(child.pid)).toBe(false);
  });

  it('with no environment given the child has none; a program without a start message is started with its input open', async () => {
    const { child, report } = reporting({ message: { type: 'start' } });
    await child.started;
    const seen = await report;
    expect(Object.keys(seen.env).filter((key) => key !== SET_BY_THE_CHILD_ITSELF)).toEqual([]);
    expect(Buffer.from(seen.stdinHex, 'hex').toString('utf8')).toBe('{"type":"start"}\n');
    child.kill('SIGKILL');
    expect(await child.ended).toMatchObject({ exitCode: null, signal: 'SIGKILL' });
    expect(exists(child.pid)).toBe(false);

    const silent = start('echo-locator');
    await silent.started;
    silent.endInput();
    const exit = await silent.ended;
    expect(exit.exitCode).toBe(7);
    // S13-02 (b): what is kept of either output stream has the user part of a locator blanked.
    for (const kept of [exit.output, exit.diagnostics]) {
      expect(kept).toContain(`${CREDENTIAL_MARK}@192.0.2.9/stream`);
      expect(kept.includes('something')).toBe(false);
    }
  });
});

describe('the production door: a child that does not take the message never holds the Core', () => {
  it('a child that never reads: the write is given up at the bound, the child is killed and waited for, the bytes are cleared', async () => {
    const child = start('never-read', { message: { type: 'start', filler: LARGE, access: credentialAtInjection(LOCATOR, sealCredential(CANARY)) }, writeBoundMs: 300 });
    const error = await refusalOf(child);
    expect(error).toBeInstanceOf(ProductionDoorError);
    expect((error as ProductionDoorError).code).toBe(ProductionDoorRefusal.START_MESSAGE_TIMEOUT);
    expect(cleared(lastHanded().handed)).toBe(true);
    expect(await child.ended).toMatchObject({ exitCode: null, signal: 'SIGKILL', spawnFailed: false });
    expect(exists(child.pid)).toBe(false);
  });

  it('a child that exits before it took the message: a named refusal, no thrown stream error, the bytes are cleared', async () => {
    const child = start('exit-early', { message: { type: 'start', filler: LARGE, access: credentialAtInjection(LOCATOR, sealCredential(CANARY)) } });
    const error = await refusalOf(child);
    expect((error as ProductionDoorError).code).toBe(ProductionDoorRefusal.START_MESSAGE_NOT_TAKEN);
    expect(cleared(lastHanded().handed)).toBe(true);
    await child.ended;
    expect(exists(child.pid)).toBe(false);
    // The refusal names no part of the message, in any form it can be printed.
    const printed = [String(error), (error as Error).message, (error as Error).stack ?? '', JSON.stringify(error), inspect(error, { depth: 6, showHidden: true })].join('\n');
    expect(free(printed) && !printed.includes(LARGE.slice(0, 64))).toBe(true);
    expect((error as Error).cause).toBeUndefined();
  });

  it('a child that exits after a short message entered the pipe: the start is not refused, the exit is what the caller sees', async () => {
    const child = start('exit-early', { message: access() });
    expect(await refusalOf(child)).toBeNull();
    expect(cleared(lastHanded().handed)).toBe(true);
    expect(await child.ended).toMatchObject({ exitCode: 3, spawnFailed: false });
    expect(exists(child.pid)).toBe(false);
    // Ending the input of a child that is gone, and killing it, do nothing and throw nothing.
    child.endInput();
    child.kill('SIGTERM');
  });
});

describe('the production door: what it refuses before or instead of a start', () => {
  const code = async (child: ProductionProcess): Promise<unknown> => ((await refusalOf(child)) as ProductionDoorError | null)?.code ?? null;

  it('a program that is not an absolute path, and a program that does not exist', async () => {
    const relative = startProductionProcess({ command: 'node', args: [DOUBLE, 'report'], message: null, timers });
    expect(await code(relative)).toBe(ProductionDoorRefusal.PROGRAM_NOT_ABSOLUTE);
    expect(await relative.ended).toMatchObject({ spawnFailed: true });
    expect(relative.pid).toBeNull();

    const before = made.handed.length;
    const missing = startProductionProcess({ command: '/nonexistent/dems/relay', args: [], message: access(), timers });
    // FOUND BY THIS TEST: a start that failed has no process ID, and a signal through its handle goes to
    // process ID 0, the caller's whole process group (the first run of this file ended its own runner).
    // The door signals a child only when it has an ID; this call, in the same turn as the start, is the proof:
    // the run is still here to assert the next line.
    missing.kill('SIGKILL');
    expect(missing.pid).toBeNull();
    expect(await code(missing)).toBe(ProductionDoorRefusal.PROGRAM_NOT_STARTED);
    expect(await missing.ended).toMatchObject({ exitCode: null, signal: null, spawnFailed: true });
    expect(made.handed.length).toBe(before + 1);
    expect(cleared(lastHanded().handed)).toBe(true);
  });

  it('an environment key outside the closed list, and a value that is not an absolute path: nothing is started', async () => {
    expect([...PRODUCTION_ENVIRONMENT_KEYS]).toEqual(['ALSA_CONFIG_PATH']);
    const before = made.handed.length;
    for (const env of [{ PATH: '/usr/bin' }, { LD_PRELOAD: '/tmp/x.so' }, { ALSA_CONFIG_PATH: 'relative/asound.conf' }, { ALSA_CONFIG_PATH: '' }]) {
      const child = start('report', { message: access(), env: env as ProductionEnvironment });
      expect(await code(child), JSON.stringify(env)).toBe(ProductionDoorRefusal.ENVIRONMENT_NOT_ALLOWED);
      expect(child.pid).toBeNull();
    }
    // Refused before the message was made into bytes at all.
    expect(made.handed.length).toBe(before);
  });

  it('a core-file limit of the server that is not 0, or cannot be read: nothing is started', async () => {
    const before = made.handed.length;
    for (const limit of [4_096, Number.POSITIVE_INFINITY, null]) {
      const child = start('report', { message: access(), coreFileLimit: () => limit });
      expect(await code(child), String(limit)).toBe(ProductionDoorRefusal.CORE_FILE_LIMIT_NOT_ZERO);
      expect(child.pid).toBeNull();
    }
    expect(made.handed.length).toBe(before);
  });

  it('a start message the serialiser refuses: nothing is started, and the refusal is the door\'s code', async () => {
    const child = start('report', { message: { type: 'start', nested: { a: 1 } } as unknown as StartMessage });
    const error = await refusalOf(child);
    expect((error as ProductionDoorError).code).toBe(ProductionDoorRefusal.START_MESSAGE_INVALID);
    expect((error as Error).cause).toBeUndefined();
    expect(child.pid).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Row N5 (masterplan 06 revision 3, sections 4.6 and 10.1; SM-12 (3), SM-35 (7)): the observer of standard error.
//
// THE DOUBLE of these blocks is `test/support/production-door-stderr-double.mjs`, a node script that writes to
// standard error: no helper, no device, no network, no port. A write of that script does not return while the
// pipe is full, so a child that says it has written everything was READ the whole time.
//
// The second of the rate bound is ended BY HAND where a case counts lines (`heldSecond`): the door asks the
// timers it was given for that second, so no case depends on how fast this host is. Every other timer is the
// system's. No case above this line was edited for this row.
// ---------------------------------------------------------------------------------------------------------------
const STDERR_DOUBLE = resolve(__dirname, '../../../../test/support/production-door-stderr-double.mjs');
const RATE = PRODUCTION_DIAGNOSTICS_LINES_PER_SECOND;
const LINE = PRODUCTION_DIAGNOSTICS_LINE_CHARS;
const LIFE = PRODUCTION_DIAGNOSTICS_LIFE_LINES;
const SCHEME = ['rt', 'sp'].join('');

/** The system timers, but the second of the rate bound ends when the test says so. `asked` counts every timer the door asked for. */
function heldSecond(holdTurnsToo = false): { timers: CaptureTimers; asked: () => number; endSecond: () => void; runTurns: () => void } {
  const seconds: Array<() => void> = [];
  const turns: Array<() => void> = [];
  let asked = 0;
  return {
    timers: {
      after(delayMs, callback) {
        asked += 1;
        const second = delayMs === PRODUCTION_DIAGNOSTICS_SECOND_MS;
        if (!second && !(holdTurnsToo && delayMs === 0)) return timers.after(delayMs, callback);
        let live = true;
        (second ? seconds : turns).push(() => {
          if (!live) return;
          live = false;
          callback();
        });
        return () => {
          live = false;
        };
      },
    },
    asked: () => asked,
    endSecond: () => {
      for (const end of seconds.splice(0)) end();
    },
    /** With `holdTurnsToo`: the turns in which the observer is told happen only here, each one asking for the next. */
    runTurns: () => {
      for (let turn = turns.shift(); turn !== undefined; turn = turns.shift()) turn();
    },
  };
}

const pause = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
/** Waits for a state, in steps of 2 ms, for at most about a minute. */
async function until(met: () => boolean): Promise<void> {
  for (let step = 0; step < 30_000; step += 1) {
    if (met()) return;
    await pause(2);
  }
  throw new Error('the awaited state did not come');
}

interface Watched {
  readonly child: ProductionProcess;
  readonly events: ProductionDiagnosticsEvent[];
  out(): string;
  texts(): string[];
  lineCount(): number;
  droppedLines(): number;
}

/** Starts the double with an observer that keeps every event; `tell` is what the observer does besides, and returns. */
function watched(args: readonly string[], patch: Partial<ProductionProcessOptions> = {}, tell: (event: ProductionDiagnosticsEvent) => unknown = () => undefined): Watched {
  const events: ProductionDiagnosticsEvent[] = [];
  let out = '';
  let lineCount = 0;
  const child = startProductionProcess({
    command: NODE,
    args: [STDERR_DOUBLE, ...args],
    message: null,
    timers,
    onOutput: (chunk) => {
      out += chunk.toString('utf8');
    },
    onDiagnostics: (event) => {
      events.push(event);
      if (event.kind === 'line') lineCount += 1;
      return tell(event);
    },
    ...patch,
  });
  return {
    child,
    events,
    out: () => out,
    texts: () => events.flatMap((event) => (event.kind === 'line' ? [event.text] : [])),
    lineCount: () => lineCount,
    droppedLines: () => events.reduce((sum, event) => sum + (event.kind === 'dropped' ? event.lines : 0), 0),
  };
}
const numbered = (prefix: string, count: number): string[] => Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
const line = (text: string, cut = false): ProductionDiagnosticsEvent => ({ kind: 'line', text, cut });

describe('the production door, observer of standard error: bounded per line', () => {
  // Seen RED on: the cut taken out of the reader (the line of 5,000 arrived whole); the table of harmless
  // characters made the identity (the escape, zero and bell bytes arrived); the take-off at the cut removed
  // (the cut line ended in a part of the user part).
  it('a line of the bound is whole, a longer one is cut at the bound and marked, once; every byte that is not printable is replaced; a locator\'s user part is blanked, also where the cut goes through it', async () => {
    const seen = watched(['shapes']);
    await until(() => seen.out().includes('one') && seen.lineCount() >= 9);
    seen.child.endInput();
    const exit = await seen.child.ended;
    expect(exit).toMatchObject({ exitCode: 7, signal: null, spawnFailed: false });
    expect(seen.events).toEqual([
      line('a'.repeat(LINE)),
      line('b'.repeat(LINE), true),
      line('c'.repeat(LINE), true),
      line('after'),
      // An escape, a zero byte, a bell, a tab, a two-byte character and a three-byte direction override.
      line('esc?[31mred?? tab?????end'),
      line(`open ${SCHEME}://${CREDENTIAL_MARK}@192.0.2.9/stream failed`),
      line(`${'p'.repeat(490)} ${SCHEME}://`, true),
      // A carriage return ends a line as a line feed does; an empty line is not a line.
      line('cr-one'),
      line('cr-two'),
      // The last line had no line end: it is told when the child has ended, before `ended` settles.
      line('last-without-end'),
    ]);
    for (const text of seen.texts()) {
      expect(text.length).toBeLessThanOrEqual(LINE);
      expect(/^[\x20-\x7e]+$/.test(text)).toBe(true);
      expect(text.includes('someone') || text.includes('something')).toBe(false);
    }
    // Control: the bounded head of the same stream is what it was before this row - the raw bytes, the locator blanked.
    expect(exit.diagnostics).toContain('esc\u001b[31mred\u0000\u0007\ttab');
    expect(exit.diagnostics).toContain(`${CREDENTIAL_MARK}@192.0.2.9/stream failed`);
  }, 60_000);

  // Seen RED on: the cut taken out of the reader (one line of 8 MiB was built and told at the end).
  it('a child that never ends a line: one cut line of the bound is told, the 8 MiB after it are read past and the child is never held', async () => {
    const bytes = 8 * 1024 * 1024;
    const seen = watched(['no-line-end', String(bytes)]);
    await until(() => seen.out().includes(`flushed ${bytes}`));
    await pause(50);
    expect(seen.events).toEqual([line('x'.repeat(LINE), true)]);
    seen.child.endInput();
    const exit = await seen.child.ended;
    expect(exit.exitCode).toBe(7);
    // Nothing more at the end: the rest of a cut line is not a line. The head is the head of before.
    expect(seen.events).toHaveLength(1);
    expect(exit.diagnostics.length).toBe(PRODUCTION_OUTPUT_CAP_BYTES);
  }, 60_000);
});

describe('the production door, observer of standard error: bounded per second', () => {
  // The double writes 100 lines at a time with a pause between the pieces, so the lines that wait are told between
  // two pieces: it is the RATE that holds here, not the bound of the lines that may wait.
  // Seen RED on: the rate taken out of `full` (more than 200 lines of the first burst were told).
  it('the first 200 lines of a second are told in order; the lines over it are counted and the count is told when the second ends; the next second admits again; a count still open is told at the end', async () => {
    const held = heldSecond();
    const seen = watched(['bursts', '5000', '300'], { timers: held.timers });
    await until(() => seen.out().includes('one') && seen.lineCount() >= RATE);
    await pause(50);
    expect(seen.texts()).toEqual(numbered('line', RATE));
    // The second has not ended: no count yet.
    expect(seen.events).toHaveLength(RATE);

    held.endSecond();
    await until(() => seen.events.length > RATE);
    expect(seen.events[RATE]).toEqual({ kind: 'dropped', lines: 5_000 - RATE });

    // SIGTERM is this double's order to write its second burst.
    seen.child.kill('SIGTERM');
    await until(() => seen.out().includes('two') && seen.lineCount() >= 2 * RATE);
    seen.child.endInput();
    expect(await seen.child.ended).toMatchObject({ exitCode: 7, signal: null });
    expect(seen.texts().slice(RATE)).toEqual(numbered('more', RATE));
    expect(seen.events.at(-1)).toEqual({ kind: 'dropped', lines: 300 - RATE });
    expect(seen.events).toHaveLength(2 * RATE + 2);
    // Every line the child wrote is either told or counted.
    expect(seen.lineCount() + seen.droppedLines()).toBe(5_300);
    expect(seen.events.every((event) => event.kind !== 'line' || !event.cut)).toBe(true);
  }, 60_000);
});

describe('the production door, observer of standard error: bounded per life of the child', () => {
  // Seen RED on: the life bound taken out of `admit` (no `quiet` came; the lines went on).
  it('after 20,000 lines the observer is told `quiet` once and nothing more, while the child floods on, is still read and can be killed and waited for', async () => {
    const held = heldSecond();
    const seen = watched(['forever'], { timers: held.timers });
    for (let second = 1; second <= LIFE / RATE; second += 1) {
      await until(() => seen.lineCount() >= second * RATE);
      held.endSecond();
    }
    await until(() => seen.events.at(-1)?.kind === 'quiet');
    const told = seen.events.length;
    expect(seen.lineCount()).toBe(LIFE);
    expect(seen.events.filter((event) => event.kind === 'quiet')).toHaveLength(1);
    expect(seen.droppedLines()).toBeGreaterThan(0);
    expect(seen.events.every((event) => event.kind !== 'dropped' || event.lines > 0)).toBe(true);

    // The child is still read: it goes on reporting what it has written (a pipe that nobody read would hold it).
    const ticks = (): number => (seen.out().match(/tick/g) ?? []).length;
    const before = ticks();
    held.endSecond();
    await until(() => ticks() >= before + 2);
    held.endSecond();
    await pause(50);
    expect(seen.events).toHaveLength(told);
    expect(seen.child.alive()).toBe(true);

    seen.child.kill('SIGKILL');
    expect(await seen.child.ended).toMatchObject({ exitCode: null, signal: 'SIGKILL', spawnFailed: false });
    await pause(30);
    expect(seen.events).toHaveLength(told);
    expect(exists(seen.child.pid)).toBe(false);
  }, 120_000);
});

describe('the production door, observer of standard error: it never holds the child, never throws into the door, and is optional', () => {
  /** About a few milliseconds of work with no clock: an observer that is slow in the turn it is called in. */
  const spin = (): number => {
    let sum = 0;
    for (let step = 0; step < 2_000_000; step += 1) sum += Math.sqrt(step);
    return sum;
  };

  // Seen RED on: the events told in the turn that read the bytes (200 in one turn); the events per turn raised to 200.
  it('a slow observer: it is told at most 8 events in one turn of the event loop, the streams are read between the turns, and the child writes its whole megabyte', async () => {
    let turnNow = 0;
    let beating = true;
    const beat = (): void => {
      turnNow += 1;
      if (beating) setImmediate(beat);
    };
    setImmediate(beat);
    const perTurn = new Map<number, number>();
    const held = heldSecond();
    try {
      const seen = watched(['flood', String(1024 * 1024)], { timers: held.timers }, () => {
        perTurn.set(turnNow, (perTurn.get(turnNow) ?? 0) + 1);
        spin();
      });
      await until(() => /flushed \d+\n/.test(seen.out()) && seen.lineCount() >= RATE);
      const written = Number(/flushed (\d+)\n/.exec(seen.out())?.[1]);
      expect(written).toBeGreaterThan(50_000);
      expect(seen.texts()).toEqual(numbered('flood', RATE));
      expect(Math.max(...perTurn.values())).toBeLessThanOrEqual(8);
      expect(perTurn.size).toBeGreaterThanOrEqual(RATE / 8);
      seen.child.endInput();
      expect((await seen.child.ended).exitCode).toBe(7);
      expect(seen.lineCount() + seen.droppedLines()).toBe(written);
    } finally {
      beating = false;
    }
  }, 60_000);

  // The strongest form of "slow": the turns of the telling are held by the test, so the observer is reached by
  // NOTHING while the child writes 16 MiB and second after second ends. The child writes it all (the stream is
  // read without the observer), and what waited is the bound of the waiting lines, not 200 per ended second.
  // Seen RED on: the bound of the waiting lines taken out of `full` (200 more lines waited for every second that ended).
  it('an observer that is not reached at all: the child writes its 16 MiB, at most 200 lines wait whatever the number of seconds that end, and every other line is counted', async () => {
    const held = heldSecond(true);
    const seen = watched(['flood', String(16 * 1024 * 1024)], { timers: held.timers });
    let secondsEnded = 0;
    await until(() => {
      held.endSecond();
      secondsEnded += 1;
      return /flushed \d+\n/.test(seen.out());
    });
    await pause(50);
    const written = Number(/flushed (\d+)\n/.exec(seen.out())?.[1]);
    expect(secondsEnded).toBeGreaterThan(2);
    expect(seen.events).toEqual([]);

    held.endSecond();
    held.runTurns();
    expect(seen.texts()).toEqual(numbered('flood', RATE));
    expect(seen.lineCount() + seen.droppedLines()).toBe(written);
    seen.child.endInput();
    expect((await seen.child.ended).exitCode).toBe(7);
    expect(seen.lineCount()).toBe(RATE);
  }, 60_000);

  // Seen RED on: the guard taken out of `say` (the throw ended the run as an uncaught error); the answer to a
  // rejecting promise taken out (the run reported unhandled rejections).
  it('an observer that never answers, one that throws and one whose promise rejects: each is told every event all the same, and the child ends as it would', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const ways: ReadonlyArray<() => unknown> = [
        () => new Promise<void>(() => {}),
        () => {
          throw new Error('an observer that throws');
        },
        () => Promise.reject(new Error('an observer whose promise rejects')),
      ];
      for (const way of ways) {
        const held = heldSecond();
        const seen = watched(['flood', String(256 * 1024)], { timers: held.timers }, way);
        await until(() => /flushed \d+\n/.test(seen.out()) && seen.lineCount() >= RATE);
        const written = Number(/flushed (\d+)\n/.exec(seen.out())?.[1]);
        seen.child.endInput();
        const exit = await seen.child.ended;
        expect(exit).toMatchObject({ exitCode: 7, signal: null, spawnFailed: false });
        expect(exit.diagnostics.length).toBe(PRODUCTION_OUTPUT_CAP_BYTES);
        expect(seen.texts()).toEqual(numbered('flood', RATE));
        expect(seen.events.at(-1)).toEqual({ kind: 'dropped', lines: written - RATE });
        expect(exists(seen.child.pid)).toBe(false);
      }
      await pause(30);
      expect(unhandled).toEqual([]);
    } finally {
      process.removeListener('unhandledRejection', onUnhandled);
    }
  }, 60_000);

  // The proof that the door without the observer is the door of before: every case above the N5 line runs
  // unedited, and here the same child ends with the same exit with and without it, and without it no timer is asked for.
  it('without the observer the door asks its timers for nothing and the exit is the same; a start that failed tells an observer nothing', async () => {
    const held = heldSecond();
    let out = '';
    const plain = startProductionProcess({
      command: NODE,
      args: [STDERR_DOUBLE, 'shapes'],
      message: null,
      timers: held.timers,
      onOutput: (chunk) => {
        out += chunk.toString('utf8');
      },
    });
    await until(() => out.includes('one'));
    plain.endInput();
    const plainExit = await plain.ended;
    expect(held.asked()).toBe(0);

    const observed = heldSecond();
    const seen = watched(['shapes'], { timers: observed.timers });
    await until(() => seen.out().includes('one'));
    seen.child.endInput();
    expect(await seen.child.ended).toEqual(plainExit);
    expect(seen.lineCount()).toBe(10);
    // Control: with the observer the door did ask (the second of the rate bound, the turns of the telling).
    expect(observed.asked()).toBeGreaterThan(0);

    const missing = watched([], { command: '/nonexistent/dems/helper', args: [] });
    missing.child.kill('SIGKILL');
    expect(await missing.child.ended).toMatchObject({ exitCode: null, signal: null, spawnFailed: true });
    expect(missing.events).toEqual([]);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------------------------
// Task 4 row N5b (decision C131 (2), (3); review SM-10 (3)): THE PER-CALL CAP and THE PROCESS GROUP. Both optional;
// no case above this line was edited. The children are this runtime (`node -e`, a writer of N bytes) and the
// system's `/bin/sh` and `/bin/sleep` as stand-ins: no device, no network, no port. Every process a case starts
// is ended before the case ends, also when it fails (`finally`). Mutations each case was seen RED on: the record
// `implementation/n5b_door_cap_and_group_kill.md` section 5.
// ---------------------------------------------------------------------------------------------------------------
describe('row N5b: the door\'s cap of each output stream may be named per call - the default stays 64 KiB, an ask above 1 MiB starts nothing', () => {
  // The bytes are `<` and `>`: no character of a locator's scheme. A long run of letters is NOT used here: the blanking of the
  // kept text is quadratic in such a run (measured, record section 4 - a request line to the owner of `credential.ts`).
  const writer = (bytes: number, patch: Partial<ProductionProcessOptions> = {}): ProductionProcess =>
    startProductionProcess({ command: NODE, args: ['-e', `process.stdout.write(Buffer.alloc(${String(bytes)}, 60)); process.stderr.write(Buffer.alloc(${String(bytes)}, 62));`], message: null, timers, ...patch });
  const kept = async (child: ProductionProcess): Promise<readonly number[]> => {
    const exit = await child.ended;
    return [exit.exitCode ?? -1, exit.output.length, exit.diagnostics.length];
  };

  it('without a cap named, each stream keeps 64 KiB, as every caller of before; a named cap is kept exactly, up to 1 MiB', async () => {
    expect([PRODUCTION_OUTPUT_CAP_BYTES, PRODUCTION_OUTPUT_CAP_MAX_BYTES]).toEqual([65_536, 1_048_576]);
    expect(await kept(writer(200_000))).toEqual([0, 65_536, 65_536]);
    expect(await kept(writer(600_000, { outputCapBytes: 512 * 1024 }))).toEqual([0, 524_288, 524_288]);
    expect(await kept(writer(1_300_000, { outputCapBytes: PRODUCTION_OUTPUT_CAP_MAX_BYTES }))).toEqual([0, 1_048_576, 1_048_576]);
    expect(await kept(writer(1_000, { outputCapBytes: 1 }))).toEqual([0, 1, 1]);
    // Under the cap nothing is cut: the whole text is handed on.
    expect(await kept(writer(300_000, { outputCapBytes: 512 * 1024 }))).toEqual([0, 300_000, 300_000]);
  }, 60_000);

  it('a cap above 1 MiB, of 0, negative, not whole or not a number starts NOTHING and is the named refusal', async () => {
    for (const asked of [PRODUCTION_OUTPUT_CAP_MAX_BYTES + 1, 64 * 1024 * 1024, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '65536' as unknown as number]) {
      const child = writer(10, { outputCapBytes: asked });
      expect(child.pid, String(asked)).toBeNull();
      const error = await refusalOf(child);
      expect(error instanceof ProductionDoorError && error.code, String(asked)).toBe(ProductionDoorRefusal.OUTPUT_CAP_NOT_ALLOWED);
      expect(await child.ended).toEqual({ exitCode: null, signal: null, spawnFailed: true, diagnostics: '', output: '' });
    }
  }, 60_000);
});

describe('row N5b: with `processGroup` the door ends the child AND what it forked; without it, the forked child outlives the kill as before; nothing outside the group is ever signalled', () => {
  /** A program that forks a child which keeps standard output open, prints that child's process ID, then hangs. */
  const forking = (patch: Partial<ProductionProcessOptions> = {}): { child: ProductionProcess; grandchild: () => Promise<number> } => {
    let out = '';
    const child = startProductionProcess({
      command: '/bin/sh',
      args: ['-c', '/bin/sleep 30 & echo "$!"; exec /bin/sleep 30'],
      message: null,
      timers,
      onOutput: (chunk) => {
        out += chunk.toString('utf8');
      },
      ...patch,
    });
    return {
      child,
      grandchild: async () => {
        await until(() => out.includes('\n'));
        return Number(out.trim());
      },
    };
  };
  const sleeper = (patch: Partial<ProductionProcessOptions> = {}): ProductionProcess => startProductionProcess({ command: '/bin/sleep', args: ['30'], message: null, timers, ...patch });
  const ends = (pid: number): void => {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
  };

  it('WITHOUT the option (the door of every existing caller): the kill ends the child only - the forked child survives, holds the stream, and the door\'s end waits for it', async () => {
    const { child, grandchild } = forking();
    const forked = await grandchild();
    try {
      expect(Number.isInteger(forked) && forked > 1).toBe(true);
      child.kill('SIGKILL');
      await pause(300);
      expect(exists(forked)).toBe(true);
      expect(child.alive()).toBe(true);
    } finally {
      ends(forked);
    }
    expect(await child.ended).toMatchObject({ exitCode: null, signal: 'SIGKILL', spawnFailed: false });
    await until(() => !exists(forked));
  }, 60_000);

  it('WITH the option: the kill ends the GROUP - 0 survive and the door\'s end comes at once; an unrelated process in the server\'s group and another door child in a group of its own both live on', async () => {
    const bystander = sleeper();
    const otherGroup = sleeper({ processGroup: true });
    const { child, grandchild } = forking({ processGroup: true });
    const forked = await grandchild();
    try {
      expect([child.pid, bystander.pid, otherGroup.pid, forked].every((pid) => typeof pid === 'number' && pid > 1)).toBe(true);
      expect(exists(forked)).toBe(true);
      const killedAt = Date.now();
      child.kill('SIGKILL');
      expect(await child.ended).toMatchObject({ exitCode: null, signal: 'SIGKILL', spawnFailed: false });
      expect(Date.now() - killedAt).toBeLessThan(5_000);
      await until(() => !exists(forked));
      const survivors = [child.pid, forked].filter((pid) => exists(pid));
      expect(survivors).toEqual([]);
      // Nothing outside the group was signalled.
      expect([exists(bystander.pid), bystander.alive(), exists(otherGroup.pid), otherGroup.alive()]).toEqual([true, true, true, true]);
    } finally {
      ends(forked);
      bystander.kill('SIGKILL');
      otherGroup.kill('SIGKILL');
    }
    expect((await bystander.ended).signal).toBe('SIGKILL');
    expect((await otherGroup.ended).signal).toBe('SIGKILL');
  }, 60_000);

  it('with the option a child that ends by itself is the same exit as without; a kill after its end signals nothing', async () => {
    const plain = await startProductionProcess({ command: '/bin/sh', args: ['-c', 'echo one; echo two >&2; exit 3'], message: null, timers }).ended;
    const grouped = startProductionProcess({ command: '/bin/sh', args: ['-c', 'echo one; echo two >&2; exit 3'], message: null, timers, processGroup: true });
    expect(await grouped.ended).toEqual(plain);
    expect(plain).toEqual({ exitCode: 3, signal: null, spawnFailed: false, diagnostics: 'two\n', output: 'one\n' });
    grouped.kill('SIGKILL');
    expect(grouped.alive()).toBe(false);
  }, 60_000);
});

// Row N5c (wave 12; decision C138): the take-off at the cut of a line has the linear form of the
// blanking (credential.ts `USER_PART`). A cut line is at most PRODUCTION_DIAGNOSTICS_LINE_CHARS, so
// the form before cost 0.2 ms there; the case holds the form itself linear, whatever that bound becomes.
// Seen RED on (in memory, the form before put back in production-door.ts): 64 KiB of letters took
// seconds against the 100 ms bound.
describe('row N5c: the take-off of a locator left open at the cut is linear, and its output is the output of before', () => {
  it('64 KiB of letters within 100 ms and 1 MiB within 250 ms, unchanged; the cases and 20,000 seeded short texts give the output of the form before', async () => {
    const { takeOffLocatorOpenAtCut } = await import('../production-door');
    /** THE FORM BEFORE, kept here only as the reference of the output: quadratic, so it is given short texts only. */
    const FORM_BEFORE = /([a-z][a-z0-9+.-]*:\/\/)[^/\s'"<>@]*$/i;
    for (const [text, boundMs] of [
      ['a'.repeat(64 * 1024), 100],
      ['a'.repeat(1024 * 1024), 250],
      ['x1'.repeat(512 * 1024), 250],
    ] as const) {
      const start = performance.now();
      const out = takeOffLocatorOpenAtCut(text);
      expect(performance.now() - start).toBeLessThan(boundMs);
      expect(out).toBe(text);
    }
    const cases: readonly (readonly [string, string])[] = [
      ['failed at rtsp://u:p', 'failed at rtsp://'],
      ['failed at 9rtsp://user', 'failed at 9rtsp://'],
      ['ok rtsp://h/s then rtsp://us', 'ok rtsp://h/s then rtsp://'],
      ['x HTTP://open', 'x HTTP://'],
      ['rtsp://u:p@h', 'rtsp://u:p@h'],
      ['a:/b', 'a:/b'],
    ];
    for (const [text, expected] of cases) {
      expect(takeOffLocatorOpenAtCut(text)).toBe(expected);
      expect(text.replace(FORM_BEFORE, '$1')).toBe(expected);
    }
    const alphabet = [...'aZ19+.-:/@ <x"\'\n'];
    const pieces = ['://', 'rtsp://', 'u:p@', '1x', 'RTSP://', '-1.a+://'];
    let seed = 20_261_014;
    const next = (): number => {
      seed = (Math.imul(seed, 1_103_515_245) + 12_345) >>> 0;
      return seed / 4_294_967_296;
    };
    const differ: string[] = [];
    let changed = 0;
    for (let index = 0; index < 20_000; index += 1) {
      let text = '';
      const length = Math.floor(next() * 48);
      for (let at = 0; at < length; at += 1) text += next() < 0.3 ? pieces[Math.floor(next() * pieces.length)] : alphabet[Math.floor(next() * alphabet.length)];
      const before = text.replace(FORM_BEFORE, '$1');
      if (before !== text) changed += 1;
      if (takeOffLocatorOpenAtCut(text) !== before) differ.push(text);
    }
    expect(differ).toEqual([]);
    expect(changed).toBeGreaterThan(1_000);
  });
});
