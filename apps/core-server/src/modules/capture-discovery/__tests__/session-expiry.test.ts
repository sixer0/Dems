// The expiry watch of the candidate lists (integration pass C1; `session-expiry.ts`), without a
// database: what starts a check, what a check discards, and what a failed read leaves alone.
import { CaptureDiscoveryTrigger } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { createCandidateStore } from '../store';
import { createSearchLimiter } from '../limits';
import { READ_ENDED_SESSIONS, createSessionExpiryWatch, readEndedSessions } from '../session-expiry';

const expired = { auditRows: [{ type: 'AUTH_SIGNED_IN' }, { type: 'AUTH_EXPIRED' }] };

function harness(endedInTable: () => readonly string[]) {
  let byte = 0;
  const store = createCandidateStore({ randomBytes: (size) => Uint8Array.from({ length: size }, () => (byte = (byte + 1) % 256)) });
  const limiter = createSearchLimiter();
  const asked: string[][] = [];
  const failures: unknown[] = [];
  const watch = createSessionExpiryWatch({
    ownerSessions: () => [...new Set([...store.sessionIds(), ...limiter.sessionIds()])],
    endedAmong: async (sessionIds) => {
      asked.push([...sessionIds]);
      return endedInTable();
    },
    discard: (sessionId) => {
      store.discardSession(sessionId);
      limiter.forgetSession(sessionId);
    },
    failed: (error) => void failures.push(error),
  });
  /** One whole search of a session: a list is held, one start is counted. */
  const search = (sessionId: string, at: number): void => {
    const begun = store.begin({ sessionId, searchId: `SRCH-${sessionId}-${at}`, trigger: CaptureDiscoveryTrigger.MANUAL, startedAt: at, windowMs: 3_000, interfaceCount: 1 });
    limiter.record(sessionId, at);
    store.complete(begun.searchId, [], { responderCount: 0, interfaceCount: 1, truncated: false, completedAt: at + 3_000 });
  };
  return { store, limiter, watch, asked, failures, search };
}

describe('the expiry watch', () => {
  it('a commit with an AUTH_EXPIRED row frees the list and the starts of the session that ended, and of no other', async () => {
    const h = harness(() => ['session-a']);
    h.search('session-a', 1_000);
    h.search('session-b', 20_000);
    expect([h.store.size(), h.limiter.heldSessions()]).toEqual([2, 2]);
    h.watch.committed(expired);
    await h.watch.settled();
    expect(h.asked).toEqual([['session-a', 'session-b']]);
    expect(h.store.sessionIds()).toEqual(['session-b']);
    expect(h.limiter.sessionIds()).toEqual(['session-b']);
    expect(h.watch.stats()).toEqual({ checks: 1, discarded: 1 });
    expect(h.failures).toEqual([]);
  });

  it('CONTROL: a commit without that row asks nothing and frees nothing; neither does one while nothing is held', async () => {
    const h = harness(() => ['session-a']);
    h.watch.committed(expired);
    await h.watch.settled();
    expect(h.asked).toEqual([]);
    h.search('session-a', 1_000);
    for (const type of ['AUTH_SIGNED_OUT', 'CAPTURE_DISCOVERY_SEARCHED', 'auth_expired', 'AUTH_EXPIRED ']) h.watch.committed({ auditRows: [{ type }] });
    h.watch.committed({ auditRows: [] });
    await h.watch.settled();
    expect(h.asked).toEqual([]);
    expect(h.store.size()).toBe(1);
    expect(h.watch.stats()).toEqual({ checks: 0, discarded: 0 });
  });

  it('a session of the same operator that is still open keeps its list: the table decides, not the row', async () => {
    const h = harness(() => []);
    h.search('session-a', 1_000);
    h.watch.committed(expired);
    await h.watch.settled();
    expect(h.asked).toEqual([['session-a']]);
    expect(h.store.sessionIds()).toEqual(['session-a']);
    expect(h.watch.stats()).toEqual({ checks: 1, discarded: 0 });
  });

  it('a read that fails frees nothing, is reported once, and does not stop the next check', async () => {
    let fail = true;
    const h = harness(() => {
      if (fail) throw Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
      return ['session-a'];
    });
    h.search('session-a', 1_000);
    h.watch.committed(expired);
    await h.watch.settled();
    expect(h.store.size()).toBe(1);
    expect(h.failures).toHaveLength(1);
    expect(h.watch.stats()).toEqual({ checks: 0, discarded: 0 });
    fail = false;
    h.watch.committed(expired);
    await h.watch.settled();
    expect(h.store.size()).toBe(0);
    expect(h.failures).toHaveLength(1);
  });

  it('the read: one statement, the ids as one bound array, and never an id that was not asked for', async () => {
    const calls: Array<{ text: string; values: readonly unknown[] }> = [];
    const reader = {
      query: async (text: string, values: readonly unknown[]) => {
        calls.push({ text, values });
        return { rows: [{ id: 'b' }, { id: 'zz' }, { id: 7 }] };
      },
    };
    expect(await readEndedSessions(reader, ['a', 'b'])).toEqual(['b']);
    expect(calls).toEqual([{ text: READ_ENDED_SESSIONS, values: [['a', 'b']] }]);
    expect(READ_ENDED_SESSIONS).toMatch(/^SELECT /);
    expect(READ_ENDED_SESSIONS).not.toMatch(/INSERT|UPDATE|DELETE/i);
    // Nothing held: no statement at all.
    expect(await readEndedSessions(reader, [])).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});
