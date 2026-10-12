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
