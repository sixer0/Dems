// Row FX-M1, defect E2E-T-1 / ruling R5 (decision D201): one slow or timed-out probe or keep-alive
// is never an outage by itself, and an expected state of the link is never an `error`.
//
// The pure rules of `probe-failure.ts`, then the app's real Live source (`createMobileLive`) over the
// contract-checked fake transport. The typed client's 8 s budget is a wall-clock `setTimeout`: Jest's
// fake timers stand in for the starved JS thread of E2E-T-1 (the Core answered the touch in 28 ms, the
// app's timer ran out first). The Live source's own clock is the fake transport's, so the link stays
// ONLINE throughout, as it did on the tablet (`link: 'ONLINE'` in the record).
//
// No secret is written anywhere: the credentials are the fake transport's placeholders.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CORE_API_EXAMPLES, pickReplicatedState, type AuthSessionInfo, type PairingRedeemed, type ReplicatedState, type SignInResponse } from '@dems/shared/api';
import { FAKE_CREDENTIALS, NO_ANSWER, createFakeTransport, type FakeHttpCall, type FakeReply, type FakeTransport } from '@dems/shared/live/testing';
import { DEFAULT_SEED, createIdleState, type SimErrorReport, type SimState } from '@dems/shared/sim';
import { resetCoreLinkPrefsForTests } from './core-link';
import { resetDebugLaunchForTests } from './debug';
import { runtimeLog, type RuntimeLogRecord } from './log';
import { PROBE_FAILURES_BEFORE_WARN, PROBE_OPERATIONS, isRecheckable, isUnanswered, judgeLiveRejection } from './probe-failure';
import { SECURE_ITEM_KEYS } from './secure-credentials';
import { createMobileLive, logLiveReport, type MobileLive } from './sim-adapters';

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
/** Not a real password: the fake Core accepts any on a paired device. */
const PASSWORD = 'not-a-real-password';
const store = () => globalThis.__DEMS_SECURE_STORE_MOCK__;

/** The record of E2E-T-1 as the Live source reported it (`11_logbox_touch_core_offline_logcat.txt`, 09:52:29.725). */
const E2E_T_1_REPORT: SimErrorReport = {
  level: 'error',
  source: 'live.action.touch',
  message: 'The Core server is unreachable (CORE_OFFLINE).',
  at: 0,
  context: {
    action: 'touch',
    errorName: 'LiveTransportError',
    operationId: 'touchSession',
    status: null,
    code: 'TIMEOUT',
    reason: 'CORE_OFFLINE',
    requestId: null,
    link: 'ONLINE',
  },
};

describe('the pure rules (R5)', () => {
  it('re-checks a probe that timed out, and nothing else', () => {
    expect([...PROBE_OPERATIONS].sort()).toEqual(['getAuthSession', 'getDeviceRegistration', 'getServiceHealth', 'getSignInStatus', 'touchSession']);
    expect(isRecheckable('touchSession', { ok: false, kind: 'TIMEOUT' })).toBe(true);
    expect(isRecheckable('getServiceHealth', { ok: false, kind: 'TIMEOUT' })).toBe(true);
    // A lost connection, a refusal, an answer: no re-check.
    expect(isRecheckable('getServiceHealth', { ok: false, kind: 'NETWORK' })).toBe(false);
    expect(isRecheckable('getServiceHealth', { ok: false, kind: 'RATE_LIMITED' })).toBe(false);
    expect(isRecheckable('getServiceHealth', { ok: true })).toBe(false);
    // A command is never sent twice.
    expect(isRecheckable('createSession', { ok: false, kind: 'TIMEOUT' })).toBe(false);
    expect(isRecheckable('archiveEvidence', { ok: false, kind: 'TIMEOUT' })).toBe(false);
  });

  it('counts only "no answer at all" as a probe failure in a row', () => {
    expect(isUnanswered({ ok: false, status: null })).toBe(true);
    expect(isUnanswered({ ok: false })).toBe(true);
    expect(isUnanswered({ ok: false, status: 503 })).toBe(false);
    expect(isUnanswered({ ok: true, status: 200 })).toBe(false);
  });

  it('the E2E-T-1 record, link ONLINE: the first failed keep-alive is info, not an outage, and never an error', () => {
    const judged = judgeLiveRejection(E2E_T_1_REPORT, () => 1);
    expect(judged).toEqual({
      level: 'info',
      message: 'The background touch got no answer in time while the Core link was up; not an outage (R5).',
      context: { linkView: 'up', failuresInARow: 1 },
    });
  });

  it('consecutive failures while the link is up: warn from the second in a row, still never an error', () => {
    expect(PROBE_FAILURES_BEFORE_WARN).toBe(2);
    expect(judgeLiveRejection(E2E_T_1_REPORT, () => 2)?.level).toBe('warn');
    expect(judgeLiveRejection(E2E_T_1_REPORT, () => 7)?.level).toBe('warn');
    // A count the client could not give (0) counts as this one failure.
    expect(judgeLiveRejection(E2E_T_1_REPORT, () => 0)?.level).toBe('info');
  });

  it('the link decides what an outage is: down → the record keeps its words as a warning; settling → no outage', () => {
    for (const link of ['OFFLINE', 'STALE']) {
      expect(judgeLiveRejection({ ...E2E_T_1_REPORT, context: { ...E2E_T_1_REPORT.context, link } }, () => 1)).toEqual({
        level: 'warn',
        message: 'The Core server is unreachable (CORE_OFFLINE).',
        context: { linkView: 'down' },
      });
    }
    for (const link of ['CONNECTING', 'RESYNCING']) {
      expect(judgeLiveRejection({ ...E2E_T_1_REPORT, context: { ...E2E_T_1_REPORT.context, link } }, () => 1)?.level).toBe('info');
    }
  });

  it('a command that got no answer is a warning (the refusal presenter words it on screen), never an error', () => {
    const command: SimErrorReport = { ...E2E_T_1_REPORT, source: 'live.action.archiveEvidence', context: { ...E2E_T_1_REPORT.context, action: 'archiveEvidence', operationId: 'archiveEvidence' } };
    expect(judgeLiveRejection(command, () => 9)).toEqual({ level: 'warn', message: 'The Core server is unreachable (CORE_OFFLINE).', context: { linkView: 'up' } });
  });

  it('leaves everything else as it was: a refusal, a thrown error, a socket report', () => {
    expect(judgeLiveRejection({ ...E2E_T_1_REPORT, level: 'warn', context: { ...E2E_T_1_REPORT.context, errorName: 'CoreRefusalError' } }, () => 1)).toBeNull();
    expect(judgeLiveRejection({ ...E2E_T_1_REPORT, source: 'live.listener.onLiveChange' }, () => 1)).toBeNull();
    expect(judgeLiveRejection({ level: 'warn', source: 'live.socket', message: 'The live socket reported SYNC_TIMEOUT.', at: 0 }, () => 1)).toBeNull();
  });

  it('logLiveReport writes the judgement: the level, the message and the link view replace the report’s', () => {
    const before = runtimeLog.records().length;
    logLiveReport(E2E_T_1_REPORT, judgeLiveRejection(E2E_T_1_REPORT, () => 1));
    const record = runtimeLog.records().slice(before).at(-1)!;
    expect(record.level).toBe('info');
    expect(record.source).toBe('live.action.touch');
    expect(record.message).not.toMatch(/unreachable/);
    expect(record.context).toMatchObject({ linkView: 'up', failuresInARow: 1, errorCode: 'TIMEOUT', reason: 'CORE_OFFLINE', link: 'ONLINE' });
    // Without a judgement the report is written as it came (every other report).
    logLiveReport({ level: 'warn', source: 'live.socket', message: 'The live socket reported SYNC_TIMEOUT.', at: 0 });
    expect(runtimeLog.records().at(-1)).toMatchObject({ level: 'warn', source: 'live.socket' });
  });
});

// ---------------------------------------------------------------------------------------------
// The app's Live source over the fake transport
// ---------------------------------------------------------------------------------------------

let fake: FakeTransport;
let mobile: MobileLive | undefined;
let coreSession: { token: string; info: AuthSessionInfo } | null = null;
let state: SimState;
/** The answers of `touchSession` and `getServiceHealth`, in order; `NO_ANSWER` leaves a request hanging until the client aborts it. */
let touchReplies: FakeReply[] = [];
let healthReplies: FakeReply[] = [];

const bearerOf = (headers: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};

async function flush(turns = 60): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
}
async function elapse(ms: number, step = 250): Promise<void> {
  for (let done = 0; done < ms; done += step) {
    fake.clock.advance(Math.min(step, ms - done));
    await flush(20);
  }
}

function bootCore(): void {
  fake = createFakeTransport({ epoch: 2, revision: 10 });
  state = createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED });
  coreSession = null;
  touchReplies = [];
  healthReplies = [];
  fake.answer('getAuthSession', (call: FakeHttpCall) =>
    coreSession !== null && bearerOf(call.headers) === coreSession.token
      ? { status: 200, body: { ...coreSession.info, serverTime: fake.clock.now() } }
      : fake.example('getAuthSession', 401),
  );
  fake.answer('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  fake.answer('getDeviceRegistration', () => ({
    status: 200,
    body: { deviceId: STORED.deviceId, name: 'Android device', state: 'PAIRED', pairedAt: STORED.pairedAt, credentialRotatedAt: null, core: STORED.core },
  }));
  fake.answer('signIn', () => {
    const info: AuthSessionInfo = { ...DEVICE_SESSION, issuedAt: fake.clock.now(), lastActivityAt: fake.clock.now(), serverTime: fake.clock.now() };
    coreSession = { token: FAKE_CREDENTIALS.sessionToken, info };
    return { status: 200, body: { session: info, sessionToken: FAKE_CREDENTIALS.sessionToken } satisfies SignInResponse };
  });
  fake.answer('touchSession', () => touchReplies.shift() ?? fake.example('touchSession'));
  fake.answer('getServiceHealth', () => healthReplies.shift() ?? fake.example('getServiceHealth'));
  fake.answer('archiveEvidence', () => NO_ANSWER);
  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
    const bearer = bearerOf(connection.headers);
    if (coreSession !== null && bearer === coreSession.token) {
      connection.startOperator(pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState)).heartbeat();
    } else if (bearer === STORED.deviceCredential) connection.startDevice().heartbeat();
    else connection.startAnonymous().heartbeat();
    connection.beatEvery();
  });
}

function createLive(): MobileLive {
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  return created;
}

/** A paired tablet, started, signed in, its operator socket ONLINE. */
async function signedInTablet(): Promise<MobileLive> {
  store().seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
  const live = createLive();
  await live.start();
  await flush();
  await elapse(1500);
  expect(live.getPairing().state).toBe('PAIRED');
  const result = await live.live.actions.signIn('andi.pratama', PASSWORD);
  expect(result).toMatchObject({ ok: true });
  await flush();
  await elapse(1500);
  expect(live.live.link).toBe('ONLINE');
  return live;
}

const recordsSince = (from: number): RuntimeLogRecord[] => runtimeLog.records().slice(from);

/** Runs `body` with the client's wall clock faked: `starve(ms)` is a JS thread that did not get to run for `ms`. */
async function withStarvableClock(body: (starve: (ms: number) => Promise<void>) => Promise<void>): Promise<void> {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  try {
    await body(async (ms) => {
      jest.advanceTimersByTime(ms);
      await flush();
    });
  } finally {
    jest.useRealTimers();
  }
}

let consoleError: jest.SpiedFunction<typeof console.error>;
let consoleWarn: jest.SpiedFunction<typeof console.warn>;

beforeEach(async () => {
  await AsyncStorage.clear();
  store().reset();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  bootCore();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  mobile?.stop();
  mobile = undefined;
  consoleError.mockRestore();
  consoleWarn.mockRestore();
  fake.assertNoViolations();
});

describe('E2E-T-1 on the real Live source: a keep-alive whose timer ran out on a starved thread', () => {
  it('is re-checked once and answered: no rejection, no error record, nothing on console.error or console.warn', async () => {
    const live = await signedInTablet();
    const from = runtimeLog.records().length;
    // The first touch "gets no answer" in time (the thread was starved); the re-check is answered.
    touchReplies = [NO_ANSWER];
    await withStarvableClock(async (starve) => {
      await live.live.actions.touch();
      await flush();
      expect(fake.log.requestsOf('touchSession')).toHaveLength(1);
      await starve(8_000);
      await flush();
    });
    expect(fake.log.requestsOf('touchSession')).toHaveLength(2);
    const records = recordsSince(from);
    // The first time-out is a note of the client; the re-check says the network answered.
    expect(records.filter((record) => record.source === 'live.client')).toEqual([
      expect.objectContaining({ level: 'info', message: 'No answer within 8000 ms. The command may or may not have been applied.', context: expect.objectContaining({ probe: true, operationId: 'touchSession', kind: 'TIMEOUT' }) }),
    ]);
    expect(records.filter((record) => record.source === 'live.client.recheck')).toEqual([
      expect.objectContaining({ level: 'info', context: expect.objectContaining({ operationId: 'touchSession', status: 200, failuresInARow: 0 }) }),
    ]);
    expect(records.filter((record) => record.source === 'live.action.touch')).toEqual([]);
    expect(records.filter((record) => record.level === 'error')).toEqual([]);
    expect(records.some((record) => /unreachable/i.test(record.message))).toBe(false);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(live.live.link).toBe('ONLINE');
  });

  it('no answer to the attempt nor to the re-check, link still ONLINE: the rejection is info ("not an outage"), never an error', async () => {
    const live = await signedInTablet();
    const from = runtimeLog.records().length;
    touchReplies = [NO_ANSWER, NO_ANSWER];
    await withStarvableClock(async (starve) => {
      await live.live.actions.touch();
      await flush();
      await starve(8_000);
      await starve(8_000);
      await flush();
    });
    expect(fake.log.requestsOf('touchSession')).toHaveLength(2);
    const records = recordsSince(from);
    const touch = records.filter((record) => record.source === 'live.action.touch');
    expect(touch).toEqual([
      expect.objectContaining({
        level: 'info',
        message: 'The background touch got no answer in time while the Core link was up; not an outage (R5).',
        context: expect.objectContaining({ linkView: 'up', failuresInARow: 1, link: 'ONLINE', errorName: 'LiveTransportError' }),
      }),
    ]);
    expect(records.filter((record) => record.source === 'live.client.recheck')).toEqual([
      expect.objectContaining({ level: 'warn', context: expect.objectContaining({ operationId: 'touchSession', status: null, failuresInARow: 1 }) }),
    ]);
    expect(records.filter((record) => record.level === 'error')).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });
});

describe('the other probes and the commands, through the client the pages use', () => {
  it('the service health (the Stack Check poll of E2E-S, 10:13:18): re-checked once, the answer handed on', async () => {
    const live = createLive();
    healthReplies = [NO_ANSWER];
    let answer: { ok: boolean } | undefined;
    await withStarvableClock(async (starve) => {
      const pending = live.live.client.call('getServiceHealth');
      await flush();
      await starve(8_000);
      answer = await pending;
    });
    expect(answer).toMatchObject({ ok: true, status: 200 });
    expect(fake.log.requestsOf('getServiceHealth')).toHaveLength(2);
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('a command that timed out is NOT sent again: one request, the time-out handed on as it was', async () => {
    const live = createLive();
    let answer: { ok: boolean; kind?: unknown } | undefined;
    await withStarvableClock(async (starve) => {
      const pending = live.live.client.call('archiveEvidence', { params: { id: 'EV-20260930-0004' } });
      await flush();
      await starve(8_000);
      answer = await pending;
    });
    expect(answer).toMatchObject({ ok: false, kind: 'TIMEOUT' });
    expect(fake.log.requestsOf('archiveEvidence')).toHaveLength(1);
  });

  it.each([
    ['the wall clock ran 12 s while the 8 s timer waited (a starved JS thread)', 12_000, 'js-starved', 4_000],
    ['the wall clock ran 8 s, as long as the timer (no answer from the network)', 8_000, 'no-answer', 0],
  ])('W93-15 (FXR-M): a command time-out is measured, never re-sent: %s', async (_label, wallMs, verdict, lateMs) => {
    const live = createLive();
    const from = runtimeLog.records().length;
    let answer: { ok: boolean; kind?: unknown } | undefined;
    await withStarvableClock(async (starve) => {
      const pending = live.live.client.call('archiveEvidence', { params: { id: 'EV-20260930-0004' } });
      await flush();
      fake.clock.advance(wallMs);
      await starve(8_000);
      answer = await pending;
    });
    expect(answer).toMatchObject({ ok: false, kind: 'TIMEOUT' });
    expect(fake.log.requestsOf('archiveEvidence')).toHaveLength(1);
    const records = recordsSince(from).filter((record) => record.source === 'live.client.commandTimeout');
    expect(records).toEqual([
      expect.objectContaining({
        level: 'info',
        context: expect.objectContaining({ operationId: 'archiveEvidence', elapsedMs: wallMs, budgetMs: 8_000, timerLateMs: lateMs, verdict }),
      }),
    ]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('W93-15 (FXR-M): a probe time-out is re-checked as before and gets no command-timeout record', async () => {
    const live = createLive();
    const from = runtimeLog.records().length;
    healthReplies = [NO_ANSWER];
    await withStarvableClock(async (starve) => {
      const pending = live.live.client.call('getServiceHealth');
      await flush();
      await starve(8_000);
      await pending;
    });
    expect(recordsSince(from).filter((record) => record.source === 'live.client.commandTimeout')).toEqual([]);
  });

  it('a Core action refused for a link that is not up is judged as well: a warning, never an error (the wiring of onError)', async () => {
    const live = createLive();
    const from = runtimeLog.records().length;
    // Not started: the link is not ONLINE, so the Live source sends nothing and rejects (CL-22).
    await expect(live.live.actions.archiveEvidence('EV-20260930-0004')).rejects.toMatchObject({ name: 'LiveTransportError' });
    const records = recordsSince(from).filter((record) => record.source === 'live.action.archiveEvidence');
    expect(records).toHaveLength(1);
    expect(records[0]!.level).toBe('warn');
    expect(records[0]!.context).toMatchObject({ errorName: 'LiveTransportError' });
  });
});
