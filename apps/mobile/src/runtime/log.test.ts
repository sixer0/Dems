// The persistent runtime log: structured records, privacy filter, debounced AsyncStorage writes,
// ring capacity, one-time load, and the motion/navigation/simulator sinks routed into it.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { reportMotionIssue } from '@/motion/log';
import { reportNavigationIssue } from '@/navigation/log';
import {
  LAUNCH_ID,
  RUNTIME_LOG_KEY,
  createRuntimeLog,
  installRuntimeLogSinks,
  newCorrelationId,
  runtimeLog,
  sanitizeLogContext,
  toRuntimeLogRecord,
  type LogStorage,
} from './log';
import { logSimError } from './sim-runtime-provider';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: LogStorage & { data: Map<string, string> } = {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
  };
  return storage;
}

afterEach(() => {
  jest.useRealTimers();
});

describe('records', () => {
  it('carry timestamp, level, source, message, stack, context and a correlation id', () => {
    const error = new Error('boom');
    const record = toRuntimeLogRecord({ level: 'error', source: 'runtime.test', error, context: { key: 'dems.sim.v1', count: 2 }, at: 0 });
    expect(record).toMatchObject({
      timestamp: '1970-01-01T00:00:00.000Z',
      level: 'error',
      source: 'runtime.test',
      message: 'boom',
      context: { key: 'dems.sim.v1', count: 2 },
      correlationId: LAUNCH_ID,
    });
    expect(record.stack).toContain('boom');
    expect(newCorrelationId('signin')).toMatch(new RegExp(`^${LAUNCH_ID}/signin-\\d+$`));
  });

  it('drops credential-like and personal keys and non-primitive values', () => {
    expect(
      sanitizeLogContext({
        password: 'demo-2026',
        username: 'budi.santoso',
        pairingCode: '482913',
        code: '482913',
        token: 't',
        secret: 's',
        pin: '1234',
        nested: { a: 1 },
        state: 'RECORDING',
        attempts: 3,
        ok: false,
      }),
    ).toEqual({ state: 'RECORDING', attempts: 3, ok: false });
    expect(sanitizeLogContext({ password: 'x' })).toBeUndefined();
  });
});

describe('credential prefixes (W100-1, row PT)', () => {
  // Synthetic marker values shaped like a session token, a device credential and a biometric token.
  const SES = 'ses_T3stSess10n-abc';
  const DVC = 'dvc_T3stDev1ce_xyz';
  const BIO = 'bio_T3stB10-q_9';
  const leaky = (): Error => {
    const error = new Error(`refused ${SES} for ${DVC} and ${BIO}`);
    error.stack = `Error: refused ${SES}\n    at sign-in (${DVC}.js:1:1)\n    at enrol (${BIO})`;
    return error;
  };
  const expectBlanked = (text: string | undefined): void => {
    expect(text).toBeDefined();
    for (const marker of [SES, DVC, BIO]) expect(text).not.toContain(marker);
    for (const marker of [SES, DVC, BIO]) expect(text).not.toContain(marker.slice(4));
  };

  it('blanks ses_, dvc_ and bio_ values in the message, the stack and string context of a record', () => {
    const record = toRuntimeLogRecord({ level: 'error', source: 'runtime.test', error: leaky(), context: { reason: `got ${DVC}` }, at: 0 });
    expectBlanked(record.message);
    expectBlanked(record.stack);
    expectBlanked(record.context?.reason as string);
    expect(record.message).toBe('refused ses_*** for dvc_*** and bio_***');
    expect(JSON.stringify(record)).not.toMatch(/\b(ses|dvc|bio)_(?!\*\*\*)/);
  });

  it('blanks them in motion and navigation records routed into the app log too', () => {
    const log = createRuntimeLog({ storage: memoryStorage(), console: false });
    const uninstall = installRuntimeLogSinks(log);
    try {
      reportMotionIssue('warn', 'motion.prefs.write', leaky(), { note: SES });
      reportNavigationIssue('error', 'navigation.railPrefs.read', leaky());
    } finally {
      uninstall();
    }
    expect(log.records()).toHaveLength(2);
    for (const record of log.records()) {
      expectBlanked(record.message);
      expectBlanked(record.stack);
    }
    expect(JSON.stringify(log.records())).not.toMatch(/\b(ses|dvc|bio)_(?!\*\*\*)/);
  });
});

describe('createRuntimeLog', () => {
  it('debounces writes into one JSON array under dems.mobile.log.v1', async () => {
    jest.useFakeTimers();
    const storage = memoryStorage();
    const log = createRuntimeLog({ storage, console: false, flushMs: 2000 });
    log.write(toRuntimeLogRecord({ level: 'warn', source: 'a', error: 'one' }));
    log.write(toRuntimeLogRecord({ level: 'error', source: 'b', error: 'two' }));
    expect(storage.data.has(RUNTIME_LOG_KEY)).toBe(false);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    const stored = JSON.parse(storage.data.get(RUNTIME_LOG_KEY)!) as { source: string }[];
    expect(stored.map((r) => r.source)).toEqual(['a', 'b']);
  });

  it('keeps the newest records up to its capacity and loads earlier launches once', async () => {
    const earlier = [toRuntimeLogRecord({ level: 'warn', source: 'earlier', error: 'x' })];
    const storage = memoryStorage({ [RUNTIME_LOG_KEY]: JSON.stringify(earlier) });
    const log = createRuntimeLog({ storage, console: false, capacity: 3 });
    log.write(toRuntimeLogRecord({ level: 'info', source: 'now-1', error: 'x' }));
    await log.load();
    await log.load(); // a second load adds nothing
    expect(log.records().map((r) => r.source)).toEqual(['earlier', 'now-1']);
    log.write(toRuntimeLogRecord({ level: 'info', source: 'now-2', error: 'x' }));
    log.write(toRuntimeLogRecord({ level: 'info', source: 'now-3', error: 'x' }));
    expect(log.records().map((r) => r.source)).toEqual(['now-1', 'now-2', 'now-3']);
    await log.flush();
    expect(JSON.parse(storage.data.get(RUNTIME_LOG_KEY)!)).toHaveLength(3);
  });

  it('survives a failing storage (records stay in memory)', async () => {
    const log = createRuntimeLog({
      storage: { getItem: async () => 'not json', setItem: async () => Promise.reject(new Error('disk full')) },
      console: false,
    });
    log.write(toRuntimeLogRecord({ level: 'error', source: 'a', error: 'x' }));
    await expect(log.flush()).resolves.toBeUndefined();
    await log.load();
    expect(log.records().map((r) => r.source)).toEqual(['a', 'runtime.log.load']);
  });
});

describe('sinks', () => {
  it('routes motion, navigation and simulator reports into the runtime log', () => {
    const log = createRuntimeLog({ storage: memoryStorage(), console: false });
    const uninstall = installRuntimeLogSinks(log);
    try {
      reportMotionIssue('warn', 'motion.prefs.write', new Error('m'), { key: 'dems.mobile.prefs.v1' });
      reportNavigationIssue('error', 'navigation.railPrefs.read', new Error('n'), { password: 'never' });
    } finally {
      uninstall();
    }
    reportMotionIssue('warn', 'motion.after', new Error('not routed'));
    expect(log.records().map((r) => [r.level, r.source])).toEqual([
      ['warn', 'motion.prefs.write'],
      ['error', 'navigation.railPrefs.read'],
    ]);
    expect(log.records()[1]!.context).toBeUndefined();
  });

  it('turns a simulator error report into a record under sim.<source> in the app log', () => {
    logSimError({ level: 'warn', source: 'store.hydrate', message: 'Stored snapshot rejected', at: 0, context: { tickIndex: 3 } });
    expect(runtimeLog.records().at(-1)).toMatchObject({
      level: 'warn',
      source: 'sim.store.hydrate',
      message: 'Stored snapshot rejected',
      context: { tickIndex: 3 },
    });
  });
});
