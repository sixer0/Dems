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
  redactCredentials,
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

// Task 3 blueprint row 113 (C3 §2.5; SEC35-14; E-31): the STT server credential has no prefix of this
// product, so the list blanks it by where it stands. One of the two log-blanking lists; the other is
// the web error sink, which holds the same forms.
describe('the STT credential forms (task 3 row 113)', () => {
  // Synthetic markers, built from parts: nothing here is a real key.
  const KEY = ['sk', 'MARKER', 'stt', 'K3y.9f8e/7d='].join('-');
  const REF = ['omlx-settings', 'auth.MARKER_ref'].join(':');

  it('blanks a value after Bearer, under a credential-named member, and the write-only credential of updateSttConfig', () => {
    expect(redactCredentials(`Bearer ${KEY} was refused`)).toBe('Bearer *** was refused');
    expect(redactCredentials(`Authorization: Bearer ${KEY}`)).not.toContain('MARKER');
    expect(redactCredentials(`{"apiKey":"${KEY}","model":"m"}`)).toBe('{"apiKey":"***","model":"m"}');
    expect(redactCredentials(`api_key=${KEY}&x=1`)).toBe('api_key=***&x=1');
    expect(redactCredentials(`credentialRef: ${REF}, next`)).toBe('credentialRef: ***, next');
    expect(redactCredentials(`{"revision":1,"credential":{"kind":"SECRET","value":"${KEY} with spaces"}}`)).toBe('{"revision":1,"credential":{"kind":"SECRET","value":"***"}}');
    expect(redactCredentials(`{"credential":{"kind":"REFERENCE","ref":"${REF}"}}`)).toBe('{"credential":{"kind":"REFERENCE","ref":"***"}}');
    // A token of this server keeps its own rule, and prose is left alone.
    expect(redactCredentials('Bearer ses_Abc-123_xyz')).toBe('Bearer ses_***');
    expect(redactCredentials('a bearer of news; the secret of success; credentialSet: true, credentialKind: REFERENCE')).toBe(
      'a bearer of news; the secret of success; credentialSet: true, credentialKind: REFERENCE',
    );
  });

  it('a record keeps none of it: the message, the stack and the context, with the credential-named context keys dropped', () => {
    const error = new Error(`refused: {"credential":{"kind":"SECRET","value":"${KEY}"}}`);
    error.stack = `Error: fetch failed with Authorization: Bearer ${KEY}\n    at call`;
    const record = toRuntimeLogRecord({
      level: 'error',
      source: 'live.action.updateSttConfig',
      error,
      context: { apiKey: KEY, api_key: KEY, authorization: `Bearer ${KEY}`, credentialRef: REF, note: `api_key=${KEY}`, status: 503 },
      at: 0,
    });
    expect(JSON.stringify(record)).not.toContain('MARKER');
    expect(record.message).toBe('refused: {"credential":{"kind":"SECRET","value":"***"}}');
    expect(record.context).toEqual({ note: 'api_key=***', status: 503 });
    expect(sanitizeLogContext({ apiKey: KEY, 'api-key': KEY, Authorization: KEY, backend: 'cpu-local' })).toEqual({ backend: 'cpu-local' });
    // Negative control: the same search finds the marker in what was GIVEN to the log.
    expect(JSON.stringify({ apiKey: KEY })).toContain('MARKER');
  });

  // Fix round 1, navigator finding N-1: the forms the first list let through. Every one of them
  // must lose the marker; none may throw.
  const N1_KEY = ['NAV', 'MARKER', '7f3a', 'Zq9Lm2Xw8Rt5'].join('-');
  const N1_REF = ['navstore', 'MARKER/zz9.key'].join(':');
  const N1_FORMS: ReadonlyArray<readonly [string, string]> = [
    ['members in the other order (SECRET)', `{"revision":1,"credential":{"value":"${N1_KEY}","kind":"SECRET"}}`],
    ['members in the other order (REFERENCE)', `{"revision":1,"credential":{"ref":"${N1_REF}","kind":"REFERENCE"}}`],
    ['bare object in the other order', `sent {"value":"${N1_KEY}","kind":"SECRET"} to the Core`],
    ['JSON inside a JSON string', JSON.stringify(JSON.stringify({ credential: { kind: 'SECRET', value: N1_KEY } }))],
    ['JSON inside a JSON string, twice', JSON.stringify(JSON.stringify(JSON.stringify({ credential: { kind: 'REFERENCE', ref: N1_REF } })))],
    ['a value holding a double quote', `{"credential":{"kind":"SECRET","value":"pre\\"${N1_KEY}"}}`],
    ['a value holding an apostrophe', `{"credential":{"kind":"SECRET","value":"it's ${N1_KEY}"}}`],
    ['an apostrophe-quoted value holding a double quote', `{ kind: 'SECRET', value: 'a"${N1_KEY}' }`],
    ['credential as a text member', `{"credential":"${N1_KEY}"}`],
    ['credential=', `credential=${N1_KEY}`],
    ['a dotted path to the member', `body.credential.value=${N1_KEY}`],
    ['a query string', `kind=SECRET&value=${N1_KEY}`],
    ['a query string in the other order', `value=${N1_KEY}&kind=SECRET`],
    ['value: beside its kind', `kind: SECRET, value: ${N1_KEY}`],
    ['a secret of two words', `{"secret":"two words ${N1_KEY}"}`],
    ['authorization with another scheme', `authorization: Basic ${N1_KEY}`],
    ['authorization in JSON with another scheme', `{"authorization":"Basic ${N1_KEY}"}`],
    ['x-api-key header', `x-api-key: ${N1_KEY}`],
    ['an unterminated value', `{"credential":{"kind":"SECRET","value":"${N1_KEY}`],
  ];

  it.each(N1_FORMS)('N-1: %s is blanked', (_name, text) => {
    const blanked = redactCredentials(text);
    expect(blanked).not.toContain('MARKER');
    expect(blanked).not.toContain('Zq9Lm2Xw8Rt5');
    expect(blanked).toContain('***');
  });

  it('N-1: text that only looks alike is left alone', () => {
    for (const text of [
      'credentialSet: true, credentialKind: REFERENCE',
      'the kind of value we expect; a reference value: 42',
      'credentials: same-origin',
      'the secretary said so; a secret of success',
      'value: 42, ref: main',
      '{"kind":"PACKAGE","value":"EXPJ-000001"}',
    ]) expect(redactCredentials(text)).toBe(text);
  });

  it('N-1, N-16: a record built from such texts keeps none of it, and a value or ref beside a credential kind is dropped from the context', () => {
    for (const [, text] of N1_FORMS) {
      const record = toRuntimeLogRecord({ level: 'warn', source: 'live.action.updateSttConfig', error: new Error(text), context: { note: text }, at: 0 });
      expect(JSON.stringify(record)).not.toContain('MARKER');
    }
    expect(sanitizeLogContext({ kind: 'SECRET', value: N1_KEY, status: 503 })).toEqual({ kind: 'SECRET', status: 503 });
    expect(sanitizeLogContext({ ref: N1_REF, kind: 'REFERENCE' })).toEqual({ kind: 'REFERENCE' });
    // Beside a kind that is no credential kind, value and ref are ordinary members.
    expect(sanitizeLogContext({ kind: 'PACKAGE', value: 'EXPJ-000001', ref: 'main' })).toEqual({ kind: 'PACKAGE', value: 'EXPJ-000001', ref: 'main' });
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
