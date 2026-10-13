// The terminal secret prompt (task 4 blueprint row 213; SX-04; R-X2-2, R-X2-3).
//
// HOW IT IS TESTED, AND WHAT IS NOT:
//   - THE READ PATH is tested through the port's own seams: a scripted terminal double and a double
//     of the three interruptions. NO PSEUDO-TERMINAL is opened, by this file or by an agent (R-X2-9).
//   - THE REFUSAL PATHS are tested FOR REAL: the file's process entry is started with standard input
//     a pipe, a file and no input at all, with a lifting-looking flag and a lifting-looking variable.
//   - NOT TESTED HERE: the real raw mode of a real terminal with a person at it. That is the
//     attended check of design 3.11 (`npx tsx cli/secret-prompt.ts`), one per host kind.
//
// EVERY TYPED VALUE IS MADE FROM RANDOMNESS IN THIS RUN. No value is a literal of this file, and
// the one file the entry test writes (random bytes, in a temporary folder) is removed in `afterAll`.
import { spawnSync } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { closeSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ATTENDED_CHECK_EXIT,
  SECRET_ENTRY_REFUSAL,
  SECRET_LINE_MAX_BYTES,
  SECRET_PROMPT_FAILURE,
  SecretPromptError,
  createSecretPrompt,
  processInterruptions,
  runAttendedCheck,
  type SecretInterruption,
  type SecretInterruptions,
  type SecretLine,
  type SecretPromptPort,
  type SecretTerminal,
  type SecretTerminalHandlers,
} from '../../cli/secret-prompt';

const WORKSPACE = resolve(import.meta.dirname, '..', '..');
const ENTRY = join(WORKSPACE, 'cli', 'secret-prompt.ts');
const LABEL = 'Hidden line: ';
const ENTER = Buffer.from([0x0d]);

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_.:+';
/** A printable value made in this run. */
function runValue(length = 20): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

interface Rig {
  readonly prompt: SecretPromptPort;
  readonly terminal: SecretTerminal;
  readonly interruptions: SecretInterruptions;
  /** Every `setRawMode` argument, in order. */
  readonly rawModes: boolean[];
  /** Everything the prompt wrote to the terminal, in order. */
  readonly writes: string[];
  readonly counts: { asked: number; listens: number; stops: number; watches: number; unwatches: number };
  type(bytes: Buffer | readonly number[]): Buffer;
  endInput(): void;
  failInput(): void;
  interrupt(cause: SecretInterruption): void;
  listening(): boolean;
  watching(): boolean;
}

function rig(options: { terminal?: boolean; failRawOn?: boolean; failListen?: boolean } = {}): Rig {
  const rawModes: boolean[] = [];
  const writes: string[] = [];
  const counts = { asked: 0, listens: 0, stops: 0, watches: 0, unwatches: 0 };
  let handlers: SecretTerminalHandlers | null = null;
  let restore: ((cause: SecretInterruption) => void) | null = null;
  const terminal: SecretTerminal = {
    isTerminal() {
      counts.asked += 1;
      return options.terminal ?? true;
    },
    setRawMode(raw) {
      rawModes.push(raw);
      if (options.failRawOn === raw) throw new Error('the double refuses this mode');
    },
    listen(given) {
      counts.listens += 1;
      if (options.failListen === true) throw new Error('the double cannot be listened to');
      handlers = given;
      return () => {
        counts.stops += 1;
        handlers = null;
      };
    },
    write(text) {
      writes.push(text);
    },
  };
  const interruptions: SecretInterruptions = {
    watch(given) {
      counts.watches += 1;
      restore = given;
      return () => {
        counts.unwatches += 1;
        restore = null;
      };
    },
  };
  return {
    prompt: createSecretPrompt({ terminal, interruptions }),
    terminal,
    interruptions,
    rawModes,
    writes,
    counts,
    type(bytes) {
      const chunk = Buffer.from(bytes as readonly number[]);
      handlers?.data(chunk);
      return chunk;
    },
    endInput: () => handlers?.end(),
    failInput: () => handlers?.error(),
    interrupt: (cause) => restore?.(cause),
    listening: () => handlers !== null,
    watching: () => restore !== null,
  };
}

/** The terminal is as it was: hidden input was switched on once and off last, nobody listens, nobody watches. */
function expectRestored(r: Rig): void {
  expect(r.rawModes).toEqual([true, false]);
  expect(r.listening()).toBe(false);
  expect(r.watching()).toBe(false);
  expect(r.counts.watches).toBe(1);
  expect(r.counts.unwatches).toBe(1);
}

// ── No echo anywhere: the process streams, the console and (there is none) a log sink ──────────────
const captured: string[] = [];
const text = (part: unknown): string => (typeof part === 'string' ? part : Buffer.isBuffer(part) ? part.toString('latin1') : part instanceof Error ? `${part.message}\n${part.stack ?? ''}` : JSON.stringify(part) ?? String(part));
/** Every value this file typed into a double; none may appear in anything captured. */
const typed: string[] = [];
const remember = (value: string): string => {
  typed.push(value);
  return value;
};

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    captured.push(text(chunk));
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    captured.push(text(chunk));
    return true;
  });
  for (const method of ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const) {
    vi.spyOn(console, method).mockImplementation((...parts: unknown[]) => {
      captured.push(parts.map(text).join(' '));
    });
  }
});
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(() => {
  // Checked once, over the whole file: nothing typed into a double reached a process stream or the console.
  const all = captured.join('\n');
  for (const value of typed) {
    if (all.includes(value)) throw new Error('a typed value reached a process stream or the console');
    if (all.includes(Buffer.from(value, 'utf8').toString('latin1'))) throw new Error('the bytes of a typed value reached a process stream or the console');
  }
});

describe('a line typed at the terminal', () => {
  it('is returned as its bytes; nothing is written while it is typed; the terminal is restored; every copy but the caller\'s is zeroed', async () => {
    const r = rig();
    const value = remember(runValue(24));
    const answer = r.prompt.readSecretLine(LABEL);
    expect(r.writes).toEqual([LABEL]);
    const chunks: Buffer[] = [];
    // Typed in pieces of one to five bytes: after every piece the terminal has received nothing new.
    const bytes = Buffer.from(value, 'utf8');
    for (let at = 0; at < bytes.length; ) {
      const size = 1 + randomInt(5);
      chunks.push(r.type(bytes.subarray(at, at + size)));
      at += size;
      expect(r.writes).toEqual([LABEL]);
      expect(r.rawModes).toEqual([true]);
    }
    chunks.push(r.type(ENTER));
    const line = await answer;
    expect(line.kind).toBe('LINE');
    if (line.kind !== 'LINE') return;
    expect(Buffer.isBuffer(line.secret)).toBe(true);
    expect(line.secret.equals(bytes)).toBe(true);
    // Bytes written while typing: 0. After the entry: one line break, and nothing of the value.
    expect(r.writes).toEqual([LABEL, '\n']);
    expect(r.writes.join('').includes(value)).toBe(false);
    expectRestored(r);
    // Every chunk the prompt was handed is zeroed; the caller zeroes the one buffer it was given.
    for (const chunk of chunks) expect(chunk.every((byte) => byte === 0)).toBe(true);
    line.secret.fill(0);
    expect(line.secret.every((byte) => byte === 0)).toBe(true);
  });

  it('a character whose bytes arrive in two reads is joined, for two, three and four bytes', async () => {
    for (const character of [String.fromCodePoint(0xe9), String.fromCodePoint(0x20ac), String.fromCodePoint(0x1f511)]) {
      const encoded = Buffer.from(character, 'utf8');
      for (let cut = 1; cut < encoded.length; cut += 1) {
        const r = rig();
        const head = remember(runValue(6));
        const tail = remember(runValue(6));
        const answer = r.prompt.readSecretLine(LABEL);
        r.type(Buffer.concat([Buffer.from(head, 'utf8'), encoded.subarray(0, cut)]));
        r.type(Buffer.concat([encoded.subarray(cut), Buffer.from(tail, 'utf8')]));
        r.type(ENTER);
        const line = await answer;
        expect(line.kind).toBe('LINE');
        if (line.kind !== 'LINE') continue;
        expect(line.secret.toString('utf8')).toBe(`${head}${character}${tail}`);
        expect(r.writes).toEqual([LABEL, '\n']);
        expectRestored(r);
        line.secret.fill(0);
      }
    }
  });

  it('a line end of two bytes in one read ends the line; an empty line is a line of no bytes', async () => {
    const r = rig();
    const value = remember(runValue());
    const answer = r.prompt.readSecretLine(LABEL);
    r.type(Buffer.concat([Buffer.from(value, 'utf8'), Buffer.from([0x0d, 0x0a])]));
    const line = await answer;
    expect(line.kind === 'LINE' && line.secret.toString('utf8') === value).toBe(true);
    const empty = rig();
    const none = empty.prompt.readSecretLine(LABEL);
    empty.type([0x0a]);
    const nothing = await none;
    expect(nothing.kind === 'LINE' && nothing.secret.length === 0).toBe(true);
    expectRestored(empty);
  });

  it('the prompt can be used again after a line, and refuses a second read while one is open', async () => {
    const r = rig();
    const first = r.prompt.readSecretLine(LABEL);
    await expect(r.prompt.readSecretLine(LABEL)).rejects.toMatchObject({ code: 'BUSY' });
    r.type(Buffer.from(remember(runValue()), 'utf8'));
    r.type(ENTER);
    expect((await first).kind).toBe('LINE');
    const value = remember(runValue());
    const second = r.prompt.readSecretLine(LABEL);
    r.type(Buffer.from(value, 'utf8'));
    r.type(ENTER);
    const line = await second;
    expect(line.kind === 'LINE' && line.secret.toString('utf8') === value).toBe(true);
    expect(r.rawModes).toEqual([true, false, true, false]);
  });
});

describe('bytes that are not part of a line', () => {
  it('both abort bytes abort, at the start and in the middle of an entry, and nothing typed comes back', async () => {
    for (const [byte, cause] of [[0x03, 'INTERRUPT_BYTE'], [0x04, 'END_BYTE']] as const) {
      for (const before of [0, 9]) {
        const r = rig();
        const answer = r.prompt.readSecretLine(LABEL);
        if (before > 0) r.type(Buffer.from(remember(runValue(before)), 'utf8'));
        r.type([byte]);
        expect(await answer).toEqual({ kind: 'ABORTED', cause });
        expect(r.writes).toEqual([LABEL, '\n']);
        expectRestored(r);
      }
    }
  });

  it('an abort byte aborts even inside an entry that is already refused', async () => {
    const r = rig();
    const answer = r.prompt.readSecretLine(LABEL);
    r.type([0x41, 0x08, 0x42]);
    r.type([0x03]);
    expect(await answer).toEqual({ kind: 'ABORTED', cause: 'INTERRUPT_BYTE' });
    expectRestored(r);
  });

  it('a control character refuses the entry: backspace, delete, tab, NUL, a control key, and one of the second block', async () => {
    for (const control of [[0x08], [0x7f], [0x09], [0x00], [0x15], [0x1a], [0xc2, 0x85], [0xc2, 0x9f]]) {
      const r = rig();
      const head = remember(runValue(7));
      const tail = remember(runValue(7));
      const answer = r.prompt.readSecretLine(LABEL);
      r.type(Buffer.from(head, 'utf8'));
      r.type(control);
      // What is typed after the bad key belongs to the refused entry: it is read to the line end and thrown away.
      r.type(Buffer.from(tail, 'utf8'));
      expect(r.writes).toEqual([LABEL]);
      r.type(ENTER);
      const line: SecretLine = await answer;
      expect(line).toEqual({ kind: 'ENTRY_REFUSED', code: 'CONTROL_CHARACTER' });
      expect(JSON.stringify(line).includes(head) || JSON.stringify(line).includes(tail)).toBe(false);
      expectRestored(r);
    }
  });

  it('an escape sequence refuses the entry: an arrow key, a function key, a bracketed paste', async () => {
    const pasted = remember(runValue(12));
    const sequences = [
      [0x1b, 0x5b, 0x41],
      [0x1b, 0x4f, 0x50],
      [0x1b, 0x5b, 0x32, 0x30, 0x30, 0x7e, ...Buffer.from(pasted, 'utf8'), 0x1b, 0x5b, 0x32, 0x30, 0x31, 0x7e],
    ];
    for (const sequence of sequences) {
      const r = rig();
      const answer = r.prompt.readSecretLine(LABEL);
      r.type(Buffer.from(remember(runValue(5)), 'utf8'));
      r.type(sequence);
      r.type(ENTER);
      expect(await answer).toEqual({ kind: 'ENTRY_REFUSED', code: 'ESCAPE_SEQUENCE' });
      expectRestored(r);
    }
  });

  it('after a refused entry the next read starts empty', async () => {
    const r = rig();
    const refused = r.prompt.readSecretLine(LABEL);
    r.type(Buffer.from(remember(runValue(8)), 'utf8'));
    r.type([0x7f]);
    r.type(ENTER);
    expect((await refused).kind).toBe('ENTRY_REFUSED');
    const value = remember(runValue(14));
    const next = r.prompt.readSecretLine(LABEL);
    r.type(Buffer.from(value, 'utf8'));
    r.type(ENTER);
    const line = await next;
    expect(line.kind === 'LINE' && line.secret.toString('utf8') === value).toBe(true);
  });

  it('text that is not well formed, a line above the bound and input after the line end refuse the entry', async () => {
    const broken = rig();
    const first = broken.prompt.readSecretLine(LABEL);
    broken.type([0x41, 0xc3]);
    broken.type(ENTER);
    expect(await first).toEqual({ kind: 'ENTRY_REFUSED', code: 'INVALID_TEXT' });
    expectRestored(broken);

    const long = rig();
    const second = long.prompt.readSecretLine(LABEL);
    long.type(Buffer.alloc(SECRET_LINE_MAX_BYTES, 0x61));
    expect(long.writes).toEqual([LABEL]);
    long.type([0x61]);
    long.type(ENTER);
    expect(await second).toEqual({ kind: 'ENTRY_REFUSED', code: 'TOO_LONG' });
    expectRestored(long);

    const exact = rig();
    const atBound = exact.prompt.readSecretLine(LABEL);
    exact.type(Buffer.alloc(SECRET_LINE_MAX_BYTES, 0x61));
    exact.type(ENTER);
    const full = await atBound;
    expect(full.kind === 'LINE' && full.secret.length === SECRET_LINE_MAX_BYTES).toBe(true);

    const two = rig();
    const third = two.prompt.readSecretLine(LABEL);
    two.type(Buffer.concat([Buffer.from(remember(runValue(9)), 'utf8'), ENTER, Buffer.from(remember(runValue(9)), 'utf8'), ENTER]));
    expect(await third).toEqual({ kind: 'ENTRY_REFUSED', code: 'INPUT_AFTER_LINE_END' });
    expectRestored(two);
  });
});

describe('the terminal is restored on every exit path', () => {
  const open = (r: Rig): Promise<SecretLine> => {
    const answer = r.prompt.readSecretLine(LABEL);
    r.type(Buffer.from(remember(runValue(10)), 'utf8'));
    expect(r.rawModes).toEqual([true]);
    return answer;
  };

  it('1 success', async () => {
    const r = rig();
    const answer = open(r);
    r.type(ENTER);
    expect((await answer).kind).toBe('LINE');
    expectRestored(r);
  });

  it('2 error: the terminal reports an error while a line is typed', async () => {
    const r = rig();
    const answer = open(r);
    r.failInput();
    await expect(answer).rejects.toBeInstanceOf(SecretPromptError);
    await expect(answer).rejects.toMatchObject({ code: 'TERMINAL_ERROR', message: SECRET_PROMPT_FAILURE.TERMINAL_ERROR });
    expectRestored(r);
  });

  it('3 abort: an abort byte, and the end of the input', async () => {
    const byByte = rig();
    const first = open(byByte);
    byByte.type([0x03]);
    expect(await first).toEqual({ kind: 'ABORTED', cause: 'INTERRUPT_BYTE' });
    expectRestored(byByte);
    const byEnd = rig();
    const second = open(byEnd);
    byEnd.endInput();
    expect(await second).toEqual({ kind: 'ABORTED', cause: 'INPUT_ENDED' });
    expectRestored(byEnd);
  });

  it('4 SIGTERM, 5 SIGHUP, 6 an uncaught error', async () => {
    for (const cause of ['SIGTERM', 'SIGHUP', 'UNCAUGHT_ERROR'] as const) {
      const r = rig();
      const answer = open(r);
      r.interrupt(cause);
      // Restored at once, inside the interruption, before anything else of the process runs.
      expect(r.rawModes).toEqual([true, false]);
      expect(await answer).toEqual({ kind: 'ABORTED', cause });
      expectRestored(r);
    }
  });

  it('also when hidden input cannot be switched on, when the terminal cannot be listened to, and when it cannot be switched off', async () => {
    const noRaw = rig({ failRawOn: true });
    await expect(noRaw.prompt.readSecretLine(LABEL)).rejects.toMatchObject({ code: 'TERMINAL_ERROR' });
    // Hidden input never came on, so nothing is typed into an echoing terminal: the label was not written and nobody listens.
    expect(noRaw.rawModes).toEqual([true]);
    expect(noRaw.writes).toEqual(['\n']);
    expect(noRaw.counts.listens).toBe(0);
    expect(noRaw.watching()).toBe(false);

    const noListen = rig({ failListen: true });
    await expect(noListen.prompt.readSecretLine(LABEL)).rejects.toMatchObject({ code: 'TERMINAL_ERROR' });
    expectRestored(noListen);

    const noRestore = rig({ failRawOn: false });
    const answer = noRestore.prompt.readSecretLine(LABEL);
    const value = remember(runValue());
    noRestore.type(Buffer.from(value, 'utf8'));
    noRestore.type(ENTER);
    // A line was typed, but the terminal could not be restored: the line is NOT handed out, and the error holds no value.
    const failure = await answer.then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(SecretPromptError);
    expect((failure as SecretPromptError).code).toBe('TERMINAL_ERROR');
    expect(`${(failure as Error).message}${(failure as Error).stack ?? ''}`.includes(value)).toBe(false);
    expect(noRestore.listening()).toBe(false);
    expect(noRestore.watching()).toBe(false);
  });

  it('the real watch of the process: SIGTERM, SIGHUP and the uncaught-error monitor call the restore, and the listeners are removed', () => {
    const counts = () => ['SIGTERM', 'SIGHUP', 'uncaughtExceptionMonitor'].map((name) => process.listenerCount(name));
    const before = counts();
    // A second listener of each signal stands in for "the command has its own": then the signal is not sent again by the watch.
    const other = (): void => undefined;
    process.on('SIGTERM', other);
    process.on('SIGHUP', other);
    try {
      for (const [event, cause] of [['SIGTERM', 'SIGTERM'], ['SIGHUP', 'SIGHUP'], ['uncaughtExceptionMonitor', 'UNCAUGHT_ERROR']] as const) {
        const seen: SecretInterruption[] = [];
        const earlier = new Set<unknown>(process.listeners(event as 'SIGTERM'));
        const stop = processInterruptions().watch((given) => seen.push(given));
        expect(counts()).toEqual([before[0]! + 2, before[1]! + 2, before[2]! + 1]);
        // The watch's own listener is called directly: the event is not emitted, so no listener of the test runner is disturbed.
        const added = process.listeners(event as 'SIGTERM').filter((listener) => !earlier.has(listener));
        expect(added).toHaveLength(1);
        (added[0] as unknown as (...given: unknown[]) => void)(event === 'uncaughtExceptionMonitor' ? new Error('synthetic') : event, 'uncaughtException');
        expect(seen).toEqual([cause]);
        stop();
        expect(counts()).toEqual([before[0]! + 1, before[1]! + 1, before[2]!]);
      }
    } finally {
      process.off('SIGTERM', other);
      process.off('SIGHUP', other);
    }
    expect(counts()).toEqual(before);
  });
});

describe('standard input is not a terminal', () => {
  it('the port refuses and touches nothing: no mode, no listener, no watch, no write', async () => {
    const r = rig({ terminal: false });
    const failure = await r.prompt.readSecretLine(LABEL).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(SecretPromptError);
    expect((failure as SecretPromptError).code).toBe('NOT_A_TERMINAL');
    expect((failure as Error).message).toBe(SECRET_PROMPT_FAILURE.NOT_A_TERMINAL);
    expect(r.counts).toEqual({ asked: 1, listens: 0, stops: 0, watches: 0, unwatches: 0 });
    expect(r.rawModes).toEqual([]);
    expect(r.writes).toEqual([]);
  });

  describe('the process entry, started for real', () => {
    const folder = mkdtempSync(join(tmpdir(), 'dems-secret-prompt-'));
    afterAll(() => rmSync(folder, { recursive: true, force: true }));
    const REFUSAL = `refused (NOT_A_TERMINAL): ${SECRET_PROMPT_FAILURE.NOT_A_TERMINAL}\n`;
    /** What a person might hope lifts the refusal. None is known to the file; all get the same answer. */
    const FLAGS = ['--no-tty', '--allow-pipe', '--stdin', '--force', '--password-stdin', '-y'];
    const VARIABLES = ['DEMS_ALLOW_PIPE', 'DEMS_SECRET_PROMPT_ALLOW_PIPE', 'DEMS_NO_TTY', 'FORCE_TTY', 'CI'];
    const environment = (lifted: boolean): NodeJS.ProcessEnv => {
      const base: NodeJS.ProcessEnv = { PATH: process.env['PATH'], HOME: process.env['HOME'], TMPDIR: process.env['TMPDIR'] };
      if (lifted) for (const name of VARIABLES) base[name] = '1';
      return base;
    };
    const start = (stdin: 'pipe' | 'ignore' | number, input: Buffer | undefined, flags: readonly string[], lifted: boolean) =>
      spawnSync(process.execPath, ['--import', 'tsx', ENTRY, ...flags], {
        cwd: WORKSPACE,
        env: environment(lifted),
        stdio: [stdin, 'pipe', 'pipe'],
        ...(input === undefined ? {} : { input }),
        encoding: 'utf8',
        timeout: 60_000,
      });
    const cases = [
      ['as it is', [], false],
      ['with lifting-looking flags', FLAGS, false],
      ['with lifting-looking variables', [], true],
    ] as const;

    it('a pipe: exit 1 with the fixed refusal, nothing on standard output, nothing of the piped bytes anywhere - also with a flag and with a variable', () => {
      for (const [, flags, lifted] of cases) {
        const piped = runValue(32);
        const answer = start('pipe', Buffer.from(`${piped}\n${piped}\n`, 'utf8'), flags, lifted);
        expect(answer.error).toBeUndefined();
        expect([answer.status, answer.stdout, answer.stderr]).toEqual([ATTENDED_CHECK_EXIT.NOT_READ, '', REFUSAL]);
        expect(`${answer.stdout}${answer.stderr}`.includes(piped)).toBe(false);
      }
    }, 120_000);

    it('a file: the same refusal, and NO BYTE WAS READ - the file is still at its first byte afterwards; also with a flag and with a variable', () => {
      for (const [, flags, lifted] of cases) {
        const content = randomBytes(64);
        const path = join(folder, `input-${randomBytes(4).toString('hex')}`);
        writeFileSync(path, content, { mode: 0o600 });
        const descriptor = openSync(path, 'r');
        try {
          const answer = start(descriptor, undefined, flags, lifted);
          expect(answer.error).toBeUndefined();
          expect([answer.status, answer.stdout, answer.stderr]).toEqual([ATTENDED_CHECK_EXIT.NOT_READ, '', REFUSAL]);
          // The child had THIS open file, with its one shared position. A read from the current position
          // gives the whole content only if the child read nothing.
          const rest = Buffer.alloc(content.length + 1);
          const count = readSync(descriptor, rest, 0, rest.length, null);
          expect(count).toBe(content.length);
          expect(rest.subarray(0, count).equals(content)).toBe(true);
        } finally {
          closeSync(descriptor);
          rmSync(path, { force: true });
        }
      }
    }, 120_000);

    it('no input at all: the same refusal', () => {
      const answer = start('ignore', undefined, [], false);
      expect([answer.status, answer.stdout, answer.stderr]).toEqual([ATTENDED_CHECK_EXIT.NOT_READ, '', REFUSAL]);
    }, 60_000);
  });
});

describe('the attended check, with a port handed in', () => {
  const run = async (line: SecretLine | SecretPromptError, terminal = true) => {
    const out: string[] = [];
    const err: string[] = [];
    let asked = 0;
    const prompt: SecretPromptPort = {
      readSecretLine: () => {
        asked += 1;
        return line instanceof SecretPromptError ? Promise.reject(line) : Promise.resolve(line);
      },
    };
    const status = await runAttendedCheck({ isTerminal: () => terminal, prompt, out: (text_) => out.push(text_), err: (text_) => err.push(text_) });
    return { status, out, err, asked };
  };

  it('a line: exit 0, the buffer is zeroed, and neither the value nor its length is printed', async () => {
    const value = remember(runValue(37));
    const secret = Buffer.from(value, 'utf8');
    const seen = await run({ kind: 'LINE', secret });
    expect(seen.status).toBe(ATTENDED_CHECK_EXIT.LINE_READ);
    expect(secret.every((byte) => byte === 0)).toBe(true);
    const printed = [...seen.out, ...seen.err].join('\n');
    expect(printed.includes(value)).toBe(false);
    expect(/\d/.test(printed)).toBe(false);
    expect(seen.err).toEqual([]);
  });

  it('a refused entry, an abort and a failure of the terminal: exit 1 with the fixed words', async () => {
    const refused = await run({ kind: 'ENTRY_REFUSED', code: 'ESCAPE_SEQUENCE' });
    expect([refused.status, refused.err]).toEqual([1, [`entry refused (ESCAPE_SEQUENCE): ${SECRET_ENTRY_REFUSAL.ESCAPE_SEQUENCE}`]]);
    const aborted = await run({ kind: 'ABORTED', cause: 'INTERRUPT_BYTE' });
    expect(aborted.status).toBe(1);
    expect(aborted.err[0]).toMatch(/^aborted \(INTERRUPT_BYTE\)/);
    const failed = await run(new SecretPromptError('TERMINAL_ERROR'));
    expect([failed.status, failed.err]).toEqual([1, [`refused (TERMINAL_ERROR): ${SECRET_PROMPT_FAILURE.TERMINAL_ERROR}`]]);
  });

  it('not a terminal: exit 1 and the port is never asked', async () => {
    const seen = await run({ kind: 'ABORTED', cause: 'INPUT_ENDED' }, false);
    expect([seen.status, seen.asked, seen.out]).toEqual([1, 0, []]);
    expect(seen.err).toEqual([`refused (NOT_A_TERMINAL): ${SECRET_PROMPT_FAILURE.NOT_A_TERMINAL}`]);
  });
});

describe('the file itself', () => {
  const source = readFileSync(ENTRY, 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');

  it('imports two built-ins and nothing else: no file system, no logger, no child process, no network', () => {
    const specifiers = [...code.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(specifiers.sort()).toEqual(['node:buffer', 'node:tty']);
  });

  it('reads no environment variable and no argument: the only use of the argument list is "was this file started"', () => {
    expect(code.match(new RegExp(`process\\s*\\.\\s*${'env'}\\b`, 'g'))).toBeNull();
    const argumentLines = code.split('\n').filter((line) => new RegExp(`process\\s*\\.\\s*${'argv'}\\b`).test(line));
    expect(argumentLines.map((line) => line.trim())).toEqual(["const invoked = process.argv[1] !== undefined && /secret-prompt\\.[cm]?[jt]s$/.test(process.argv[1]);"]);
  });

  it('has no console call, writes to a process stream in four places only, and never turns the typed bytes into text', () => {
    expect(code.match(new RegExp(`\\b${'console'}\\s*\\.`, 'g'))).toBeNull();
    // The label and line break of the real terminal; the two line printers of the attended check; its last-resort line.
    expect((code.match(/process\.std(?:out|err)\.write\(/g) ?? []).length).toBe(4);
    expect(code.match(/\.toString\(|new TextDecoder|String\.fromCharCode|\$\{(?:held|secret|chunk)\b/g)).toBeNull();
  });

  it('says what the terminal test is and is not, and names the rule for agents', () => {
    expect(source).toContain('stops the ACCIDENT');
    expect(source).toContain('It does NOT stop a');
    expect(source).toContain('R-X2-9');
  });
});
