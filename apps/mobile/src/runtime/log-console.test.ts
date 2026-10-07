// Row FX-M1, finding F80 / ruling R6 (decision D201): in a debug build React Native's LogBox turns
// every `console.warn` into the "Open debugger to view warnings" toast over the bottom of the screen
// (nearly every capture of the end-to-end round), and every `console.error` into a red one. The
// runtime log's `warn` records are expected operational states (link down, revoked, refused or
// unanswered calls): they stay in the log and reach the console as `console.info`. Only an `error`
// record, a fault of the app, reaches `console.error`.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createRuntimeLog, toRuntimeLogRecord, type LogStorage } from './log';

const memory = (): LogStorage => {
  const items = new Map<string, string>();
  return {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value);
    },
  };
};

let warn: jest.SpiedFunction<typeof console.warn>;
let error: jest.SpiedFunction<typeof console.error>;
let info: jest.SpiedFunction<typeof console.info>;
const originalWorker = process.env.JEST_WORKER_ID;

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  warn.mockRestore();
  error.mockRestore();
  info.mockRestore();
  process.env.JEST_WORKER_ID = originalWorker;
});

/** The records of a normal Live run that showed the warnings toast (`.cache/manual/metro.log`, 09:52 to 10:38). */
const OPERATIONAL = [
  { source: 'live.client', message: 'No answer within 8000 ms. The command may or may not have been applied.', context: { operationId: 'touchSession', kind: 'TIMEOUT' } },
  { source: 'live.client', message: 'No answer within 8000 ms. The command may or may not have been applied.', context: { operationId: 'getServiceHealth', kind: 'TIMEOUT' } },
  { source: 'live.socket', message: 'The live socket reported SYNC_TIMEOUT.', context: { waiting: 'hello', errorCode: 'SYNC_TIMEOUT' } },
  { source: 'features.sessionNew.create', message: 'createSession refused: NOT_PERMITTED', context: { reason: 'NOT_PERMITTED', state: 'SEALED' } },
  { source: 'live.action.touch', message: 'The background touch got no answer in time while the Core link was up; not an outage (R5).', context: { linkView: 'up' } },
] as const;

describe('which console a record reaches (R6)', () => {
  it('a warn record never reaches console.warn: it stays in the log, with its level', () => {
    const log = createRuntimeLog({ storage: memory(), flushMs: 60_000 });
    for (const record of OPERATIONAL) log.write(toRuntimeLogRecord({ level: 'warn', source: record.source, error: record.message, context: record.context }));
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(log.records().map((record) => [record.level, record.source])).toEqual(OPERATIONAL.map((record) => ['warn', record.source]));
  });

  it('outside Jest a warn record is mirrored as console.info (Metro and logcat keep it), never as a warning', () => {
    // The module decides "in Jest" once, at load: load a fresh copy without the Jest marker.
    delete process.env.JEST_WORKER_ID;
    let fresh: typeof import('./log') | undefined;
    jest.isolateModules(() => {
      fresh = jest.requireActual<typeof import('./log')>('./log');
    });
    const log = fresh!.createRuntimeLog({ storage: memory(), flushMs: 60_000 });
    log.write(fresh!.toRuntimeLogRecord({ level: 'warn', source: 'live.socket', error: 'The live socket reported SYNC_TIMEOUT.' }));
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]![0]).toBe('[runtime]');
    expect(info.mock.calls[0]![1]).toMatchObject({ level: 'warn', source: 'live.socket' });
  });

  it('an error record, a fault of the app, still reaches console.error', () => {
    const log = createRuntimeLog({ storage: memory(), flushMs: 60_000 });
    log.write(toRuntimeLogRecord({ level: 'error', source: 'runtime.live.pairingListener', error: new Error('a listener threw') }));
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]![0]).toBe('[runtime]');
    expect(warn).not.toHaveBeenCalled();
  });

  it('with the mirror off (tests that assert on the console) nothing is printed at any level', () => {
    const log = createRuntimeLog({ storage: memory(), flushMs: 60_000, console: false });
    log.write(toRuntimeLogRecord({ level: 'error', source: 'x', error: 'y' }));
    log.write(toRuntimeLogRecord({ level: 'warn', source: 'x', error: 'y' }));
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
