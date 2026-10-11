// FIX WAVE I, DRIVER A2 - finding G70b-07 of re-gate 70: the search IDs restarted with the Core
// (`DSC-000001` once per process), so one audit chain held the same ID twice. The first search of
// a process now reads the highest camera-search number of the stored chain and goes on from it.
import { CAPTURE_DISCOVERY_WINDOW_MS, CAPTURE_SEARCH_ID_PATTERN, CaptureDiscoveryTrigger } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import type { OnvifDiscoveryAdapter, WsDiscoveryResult } from '../../../capture/adapters';
import type { AuditEntry } from '../../../core';
import { createSearchLimiter } from '../limits';
import { createSearchRunner, type SearchRequest } from '../search';
import { READ_LAST_SEARCH_NUMBER, readLastSearchNumber, searchIdOf } from '../search-ids';
import { createCandidateStore } from '../store';

const T0 = 1_760_000_000_000;
const EMPTY: WsDiscoveryResult = {
  candidates: [],
  responderCount: 0,
  interfaceCount: 1,
  truncated: false,
  counts: { datagramsReceived: 0, datagramsAccepted: 0, dropped: {}, repeats: 0, matchesSkipped: 0, respondersOverCap: 0, lookupErrors: 0, datagramsSent: 4, sendErrors: 0, handlerErrors: 0 },
};
const REQUEST: SearchRequest = { sessionId: 'AS-1', operatorId: 'OPR-003', deviceId: null, trigger: CaptureDiscoveryTrigger.MANUAL };

/** One PROCESS: a runner with its own in-memory counter, on a chain (`audits`) that outlives it. */
function processOn(audits: AuditEntry[], lastStored: (() => Promise<number>) | undefined) {
  let now = T0 + audits.length * 200_000;
  const settles: Array<(outcome: WsDiscoveryResult) => void> = [];
  const logs: Array<Record<string, unknown>> = [];
  const persisted: Array<Record<string, unknown>> = [];
  const runner = createSearchRunner({
    store: createCandidateStore({ randomBytes: (size) => new Uint8Array(size).fill(7) }),
    limiter: createSearchLimiter(),
    now: () => now,
    ready: () => true,
    adapter: () => ({ discover: () => new Promise<WsDiscoveryResult>((resolve) => void settles.push(resolve)) }) as unknown as OnvifDiscoveryAdapter,
    registeredCameras: async () => [],
    openSession: () => null,
    duringRecordingEnabled: true,
    audit: async (entry) => void audits.push(entry),
    log: { info: () => undefined, error: (fields) => void logs.push(fields) },
    persist: (entry) => void persisted.push(entry),
    ...(lastStored === undefined ? {} : { lastStoredSearchNumber: lastStored }),
  });
  const search = async (): Promise<string> => {
    now += 200_000;
    const start = await runner.start(REQUEST);
    if (!start.started) throw new Error(`the search did not start: ${JSON.stringify(start.refusal)}`);
    for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
    now += CAPTURE_DISCOVERY_WINDOW_MS;
    settles.at(-1)?.(EMPTY);
    await start.closed;
    return start.search.searchId;
  };
  return { runner, search, logs, persisted };
}
/** What `readLastSearchNumber` answers for a chain: the statement's rule, in memory. */
const lastOf = (audits: readonly AuditEntry[]) => async (): Promise<number> =>
  readLastSearchNumber({
    query: async (text) => {
      expect(text).toBe(READ_LAST_SEARCH_NUMBER);
      const numbers = audits.flatMap((row) => (row.type === 'CAPTURE_DISCOVERY_SEARCHED' && /^DSC-[0-9]{6,9}$/.test(String(row.details?.['searchId'])) ? [Number(String(row.details?.['searchId']).slice(4))] : []));
      return { rows: [{ last: numbers.length === 0 ? null : String(Math.max(...numbers)) }] };
    },
  });
const idsOf = (audits: readonly AuditEntry[]): string[] => audits.map((row) => String(row.details?.['searchId']));

describe('G70b-07: the search IDs are unique across restarts of the Core within one chain', () => {
  it('RED BEFORE THE FIX: a second process on the same chain goes on from the highest stored number - no ID is in the chain twice', async () => {
    const chain: AuditEntry[] = [];
    const first = processOn(chain, lastOf(chain));
    expect([await first.search(), await first.search()]).toEqual(['DSC-000001', 'DSC-000002']);
    // A NEW process: its own counter starts at 0 again.
    const second = processOn(chain, lastOf(chain));
    expect(second.runner.started()).toBe(0);
    expect([await second.search(), await second.search()]).toEqual(['DSC-000003', 'DSC-000004']);
    expect(second.runner.started()).toBe(2);
    const third = processOn(chain, lastOf(chain));
    expect(await third.search()).toBe('DSC-000005');
    expect(idsOf(chain)).toEqual(['DSC-000001', 'DSC-000002', 'DSC-000003', 'DSC-000004', 'DSC-000005']);
    expect(new Set(idsOf(chain)).size).toBe(chain.length);
    for (const id of idsOf(chain)) expect(id).toMatch(CAPTURE_SEARCH_ID_PATTERN);
  });

  it('the chain is read ONCE per process, by the first search; a refused start reads nothing', async () => {
    const chain: AuditEntry[] = [];
    let reads = 0;
    const counted = async (): Promise<number> => {
      reads += 1;
      return 41;
    };
    const run = processOn(chain, counted);
    expect([await run.search(), await run.search(), await run.search()]).toEqual(['DSC-000042', 'DSC-000043', 'DSC-000044']);
    expect(reads).toBe(1);
  });

  it('the microphone re-read IDs (thirteen digits, from the clock) are no counter: they do not move the number', async () => {
    const chain: AuditEntry[] = [
      { type: 'CAPTURE_DISCOVERY_SEARCHED', message: 'Camera search performed', actorId: 'OPR-003', deviceId: null, details: { searchId: 'DSC-000007' } },
      { type: 'CAPTURE_DISCOVERY_SEARCHED', message: 'Microphone inputs read again', actorId: 'OPR-003', deviceId: null, details: { searchId: 'DSC-1760000000000' } },
    ] as unknown as AuditEntry[];
    expect(await lastOf(chain)()).toBe(7);
    expect(await processOn(chain, lastOf(chain)).search()).toBe('DSC-000008');
  });

  it('a read that fails is logged and persisted, the search still runs, and the next search asks again', async () => {
    const chain: AuditEntry[] = [];
    let fail = true;
    const flaky = async (): Promise<number> => {
      if (fail) throw new Error('the database does not answer');
      return 20;
    };
    const run = processOn(chain, flaky);
    expect(await run.search()).toBe('DSC-000001');
    expect(run.logs.map((fields) => fields['code'])).toEqual(['CAPTURE_DISCOVERY_SEARCH_NUMBER_UNREAD']);
    expect(run.persisted.map((entry) => entry['code'])).toEqual(['CAPTURE_DISCOVERY_SEARCH_NUMBER_UNREAD']);
    fail = false;
    expect(await run.search()).toBe('DSC-000022');
  });

  it('CONTROL - a runner that is given no reader numbers from 1, as before; the reader takes only a count', async () => {
    expect(await processOn([], undefined).search()).toBe('DSC-000001');
    for (const last of [null, undefined, 'x', -3, 0]) expect(await readLastSearchNumber({ query: async () => ({ rows: [{ last }] }) })).toBe(0);
    expect(await readLastSearchNumber({ query: async () => ({ rows: [] }) })).toBe(0);
    expect(await readLastSearchNumber({ query: async () => ({ rows: [{ last: '129' }] }) })).toBe(129);
    expect([searchIdOf(1), searchIdOf(129), searchIdOf(1_234_567)]).toEqual(['DSC-000001', 'DSC-000129', 'DSC-1234567']);
  });
});
