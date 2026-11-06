// Row 224 (G172-2, D188): the tablet's owed-sign-out port (`./owed-sign-out.ts`) on the real wrapper
// `./secure-credentials` and the in-memory secure store of `jest.setup.ts` (TS-16). It stores the
// debt of a link-down sign-out with its session token, presents that token until the debt is
// settled, pays it once, and clears it after paying; no token reaches a log call. The end-to-end
// proof (op 5 sent once at the link-up, as the operator) is live-settings-boundary.test.tsx LIVE-only (2).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { LiveOwedSignOut } from '@dems/shared/live/source';
import { reportRuntimeIssue } from './log';
import { createMobileOwedSignOut, type MobileOwedSignOut } from './owed-sign-out';
import { OWED_SIGN_OUT_ITEM_KEY, deleteOwedSignOut, readOwedSignOut, writeOwedSignOut } from './secure-credentials';

jest.mock('./log', () => ({ reportRuntimeIssue: jest.fn() }));

const reported = jest.mocked(reportRuntimeIssue);
const secure = globalThis.__DEMS_SECURE_STORE_MOCK__;

// A synthetic token of the real form (`SESSION_TOKEN_PATTERN`): nothing here was ever issued.
const TOKEN = ['ses_', 'OWEDMARKER', 'a'.repeat(33)].join('');
const DEBT: LiveOwedSignOut = { operatorId: 'OPR-001', issuedAt: 1_793_900_000_000, reason: 'USER', at: 1_793_900_060_000 };

const wrapper = { read: () => readOwedSignOut(), write: writeOwedSignOut, remove: () => deleteOwedSignOut() };

function portWith(session: { token: string | null }): MobileOwedSignOut {
  return createMobileOwedSignOut({ store: wrapper, sessionToken: () => session.token });
}

/** Every argument of every log call this test saw, and every console call, as one text. */
function everythingLogged(consoles: ReturnType<typeof jest.spyOn>[]): string {
  return JSON.stringify([reported.mock.calls, ...consoles.map((spy) => spy.mock.calls)], (_key, value: unknown) =>
    value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value,
  );
}

describe('the owed-sign-out port of the tablet (row 224, G172-2)', () => {
  let consoles: ReturnType<typeof jest.spyOn>[];

  beforeEach(() => {
    secure.reset();
    reported.mockClear();
    consoles = (['log', 'info', 'warn', 'error', 'debug'] as const).map((name) => jest.spyOn(console, name).mockImplementation(() => undefined));
  });

  afterEach(() => {
    // No token in any captured log call, in every case of this file.
    expect(everythingLogged(consoles)).not.toContain('OWEDMARKER');
    for (const spy of consoles) spy.mockRestore();
  });

  it('stores: a USER debt keeps the session token (memory and the secure item), and the record handed back holds no token', async () => {
    const session = { token: TOKEN as string | null };
    const owed = portWith(session);
    expect(owed.port.read()).toBeNull();
    expect(owed.token()).toBeNull();

    owed.port.write(DEBT);
    // `sessionCleared` empties the session slot right after: the port keeps its own copy.
    session.token = null;
    expect(owed.token()).toBe(TOKEN);
    expect(owed.port.read()).toEqual(DEBT);
    expect(JSON.stringify(owed.port.read())).not.toContain('OWEDMARKER');

    await owed.idle();
    expect(secure.has(OWED_SIGN_OUT_ITEM_KEY)).toBe(true);
    expect(secure.isProtected(OWED_SIGN_OUT_ITEM_KEY)).toBe(false);
    expect(JSON.parse(secure.peek(OWED_SIGN_OUT_ITEM_KEY)!)).toEqual({ ...DEBT, sessionToken: TOKEN });

    // A cold start: a new port finds the debt and its token before the source starts.
    const restarted = portWith({ token: null });
    await restarted.load();
    expect(restarted.port.read()).toEqual(DEBT);
    expect(restarted.token()).toBe(TOKEN);
  });

  it('pays once: the token is presented until the debt is settled, and never after', async () => {
    const owed = portWith({ token: TOKEN });
    owed.port.write({ ...DEBT, reason: 'LOCK' });
    // What `settleDebt` does at each OPERATOR socket: send op 5 with the presented token, then `clear`.
    const sent: string[] = [];
    const linkUp = (): void => {
      const token = owed.token();
      if (token === null) return;
      sent.push(token);
      owed.port.clear();
    };
    linkUp();
    linkUp();
    linkUp();
    expect(sent).toEqual([TOKEN]);
    await owed.idle();
    // A cold start after the payment owes nothing either.
    const restarted = portWith({ token: null });
    await restarted.load();
    expect(restarted.token()).toBeNull();
    expect(restarted.port.read()).toBeNull();
  });

  it('clears after paying: memory at once, the secure item when the store has finished', async () => {
    const owed = portWith({ token: TOKEN });
    owed.port.write(DEBT);
    await owed.idle();
    expect(secure.has(OWED_SIGN_OUT_ITEM_KEY)).toBe(true);

    owed.port.clear();
    expect(owed.token()).toBeNull();
    expect(owed.port.read()).toBeNull();
    await owed.idle();
    expect(secure.has(OWED_SIGN_OUT_ITEM_KEY)).toBe(false);
    expect(reported.mock.calls.filter(([level]) => level === 'error')).toEqual([]);
  });

  it('a reckoned expiry owes no sign-out: no token is kept, and an older item goes', async () => {
    const owed = portWith({ token: TOKEN });
    owed.port.write(DEBT);
    owed.port.write({ ...DEBT, reason: 'IDLE_EXPIRED' });
    expect(owed.token()).toBeNull();
    expect(owed.port.read()).toBeNull();
    await owed.idle();
    expect(secure.has(OWED_SIGN_OUT_ITEM_KEY)).toBe(false);
  });

  it('the store calls are made in the order asked: a late delete never erases a newer debt', async () => {
    const owed = portWith({ token: TOKEN });
    owed.port.write(DEBT);
    owed.port.clear();
    owed.port.write({ ...DEBT, at: DEBT.at + 1 });
    await owed.idle();
    expect(JSON.parse(secure.peek(OWED_SIGN_OUT_ITEM_KEY)!)).toEqual({ ...DEBT, at: DEBT.at + 1, sessionToken: TOKEN });
  });

  it('a stored item that cannot be read is deleted and owes nothing (one warn, by code)', async () => {
    secure.seed(OWED_SIGN_OUT_ITEM_KEY, `not json ${TOKEN}`);
    const owed = portWith({ token: null });
    await owed.load();
    await owed.idle();
    expect(owed.port.read()).toBeNull();
    expect(owed.token()).toBeNull();
    expect(secure.has(OWED_SIGN_OUT_ITEM_KEY)).toBe(false);
    expect(reported.mock.calls.some(([level, source]) => level === 'warn' && source === 'runtime.live.owedSignOut')).toBe(true);
  });

  it('a failed store write is logged by code; the debt is still owed in memory', async () => {
    secure.failNext('write');
    const owed = portWith({ token: TOKEN });
    owed.port.write(DEBT);
    await owed.idle();
    expect(owed.token()).toBe(TOKEN);
    expect(reported.mock.calls.some(([level, source]) => level === 'error' && source === 'runtime.live.owedSignOut')).toBe(true);
  });
});
