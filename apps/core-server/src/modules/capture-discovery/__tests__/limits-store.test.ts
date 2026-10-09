// Blueprint row 132: the bounds of a search (check M4-SEC-RATE-1, search half; C3 §2.6 "Rate
// limits", §7; SEC35-39) and the candidate store (check M4-DISC-LIFE-1, unit half; C3 §2.6
// "Candidate state"). Pure units on a clock that is a number: no app, no socket, no database.
import {
  CAPTURE_CANDIDATE_ID_PATTERN,
  CAPTURE_CONNECTION_TEST_VALIDITY_MS,
  CAPTURE_DISCOVERY_MAX_CANDIDATES,
  CAPTURE_DISCOVERY_RESULT_TTL_MS,
  CaptureDiscoveryStateSchema,
} from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { CaptureAdapterKind, type CameraCandidate } from '../../../capture/adapters';
import { SearchBound, createCandidateStore, createSearchLimiter, type FoundCandidate } from '../index';

const T0 = 1_760_000_000_000;

describe('M4-SEC-RATE-1 (search): one case per bound; the call at the bound is accepted, the call over it refused with the wait', () => {
  it('per operator session: 10 s between two starts', () => {
    const limiter = createSearchLimiter();
    expect(limiter.check('S-A', T0)).toEqual({ allowed: true });
    limiter.record('S-A', T0);
    expect(limiter.check('S-A', T0 + 9_999)).toEqual({ allowed: false, bound: SearchBound.SESSION_SPACING, retryAfterMs: 1 });
    expect(limiter.check('S-A', T0 + 1)).toEqual({ allowed: false, bound: SearchBound.SESSION_SPACING, retryAfterMs: 9_999 });
    expect(limiter.check('S-A', T0 + 10_000)).toEqual({ allowed: true });
  });

  it('per Core: 5 s between two starts, whatever the session', () => {
    const limiter = createSearchLimiter();
    limiter.record('S-A', T0);
    expect(limiter.check('S-B', T0 + 4_999)).toEqual({ allowed: false, bound: SearchBound.CORE_SPACING, retryAfterMs: 1 });
    expect(limiter.check('S-B', T0 + 5_000)).toEqual({ allowed: true });
  });

  it('per Core: 6 starts in a minute, all sessions together; the seventh waits for the oldest to leave the minute', () => {
    const limiter = createSearchLimiter();
    for (let index = 0; index < 6; index += 1) {
      expect(limiter.check(`S-${index}`, T0 + index * 5_000), `start ${index + 1}`).toEqual({ allowed: true });
      limiter.record(`S-${index}`, T0 + index * 5_000);
    }
    // 30 s after the first: spacing holds (5 s after the sixth), the minute does not.
    expect(limiter.check('S-9', T0 + 30_000)).toEqual({ allowed: false, bound: SearchBound.CORE_PER_MINUTE, retryAfterMs: 30_000 });
    expect(limiter.check('S-9', T0 + 59_999)).toEqual({ allowed: false, bound: SearchBound.CORE_PER_MINUTE, retryAfterMs: 1 });
    expect(limiter.check('S-9', T0 + 60_000)).toEqual({ allowed: true });
  });

  it('per operator session: 30 starts in an hour', () => {
    const limiter = createSearchLimiter();
    // One start every 100 s: inside every other bound.
    for (let index = 0; index < 30; index += 1) {
      expect(limiter.check('S-A', T0 + index * 100_000), `start ${index + 1}`).toEqual({ allowed: true });
      limiter.record('S-A', T0 + index * 100_000);
    }
    const at = T0 + 30 * 100_000;
    expect(limiter.check('S-A', at)).toEqual({ allowed: false, bound: SearchBound.SESSION_PER_HOUR, retryAfterMs: 3_600_000 - 30 * 100_000 });
    // Another session is not held by it; the same session is free again when its first start is an hour old.
    expect(limiter.check('S-B', at)).toEqual({ allowed: true });
    expect(limiter.check('S-A', T0 + 3_600_000)).toEqual({ allowed: true });
  });

  it('a refused call counts nothing, and the memory is bounded: a session whose starts are an hour old is forgotten', () => {
    const limiter = createSearchLimiter();
    limiter.record('S-A', T0);
    for (let index = 0; index < 50; index += 1) expect(limiter.check('S-A', T0 + 100).allowed).toBe(false);
    expect(limiter.check('S-A', T0 + 10_000)).toEqual({ allowed: true });
    expect(limiter.heldSessions()).toBe(1);
    limiter.check('S-B', T0 + 3_600_000);
    expect(limiter.heldSessions()).toBe(0);
    limiter.record('S-C', T0);
    limiter.forgetSession('S-C');
    expect(limiter.heldSessions()).toBe(0);
  });
});

const camera = (host: string, more: Partial<CameraCandidate> = {}): CameraCandidate => ({
  adapterKind: CaptureAdapterKind.FAKE,
  host,
  serviceAddress: `http://${host}:8560/onvif/device_service`,
  endpointRef: `urn:uuid:00000000-0000-4000-8000-0000000000${host.slice(-2).replace('.', '0')}`,
  vendor: null,
  model: 'Model',
  name: 'Name',
  testable: true,
  conflict: false,
  ...more,
});
const found = (host: string, more: Partial<FoundCandidate> = {}): FoundCandidate => {
  const record = camera(host);
  return {
    adapter: 'FAKE',
    sourceClass: 'DEVELOPMENT',
    host,
    endpointRef: record.endpointRef,
    vendor: null,
    model: 'Model',
    name: 'Name',
    status: 'NEW',
    deviceId: null,
    testable: true,
    conflict: false,
    addressChanged: false,
    camera: record,
    ...more,
  };
};
/** A random source that counts up: every ID differs, and the test can predict none of them from the candidate. */
function counting(): (size: number) => Uint8Array {
  let next = 0;
  return (size) => {
    next += 1;
    return Uint8Array.from({ length: size }, (_unused, index) => (index === size - 1 ? next & 0xff : index === size - 2 ? next >> 8 : 0xa0 + index));
  };
}
const begin = (store: ReturnType<typeof createCandidateStore>, sessionId: string, searchId: string, startedAt = T0) =>
  store.begin({ sessionId, searchId, trigger: 'MANUAL', startedAt, windowMs: 3_000, interfaceCount: 0 });
const complete = (store: ReturnType<typeof createCandidateStore>, searchId: string, candidates: FoundCandidate[], completedAt = T0 + 3_000) =>
  store.complete(searchId, candidates, { responderCount: candidates.length, interfaceCount: 1, truncated: false, completedAt });

describe('M4-DISC-LIFE-1 (store): a candidate list is data of one operator session, and it ends', () => {
  it('RUNNING: the counts are 0 and the list is empty; COMPLETE: the list, in the order given, with minted IDs; every answer parses', () => {
    const store = createCandidateStore({ randomBytes: counting() });
    const search = begin(store, 'S-A', 'DSC-000001');
    expect(search).toMatchObject({ state: 'RUNNING', created: true, startedAt: T0, windowMs: 3_000, completesAt: T0 + 3_000, expiresAt: T0 + 3_000 + CAPTURE_DISCOVERY_RESULT_TTL_MS, responderCount: 0, newCount: 0, registeredCount: 0 });
    expect(store.stateOf('S-A', T0 + 1_000)).toMatchObject({ search: { state: 'RUNNING', created: false }, candidates: [], truncated: false });
    expect(store.running()?.sessionId).toBe('S-A');

    complete(store, 'DSC-000001', [found('192.0.2.11', { status: 'REGISTERED', deviceId: 'CAM-01' }), found('192.0.2.12'), found('192.0.2.13', { conflict: true, testable: false })]);
    const state = store.stateOf('S-A', T0 + 3_000);
    expect(CaptureDiscoveryStateSchema.safeParse(state).success).toBe(true);
    expect(state.search).toMatchObject({ state: 'COMPLETE', responderCount: 3, newCount: 2, registeredCount: 1, interfaceCount: 1, failureReason: null });
    expect(state.candidates.map((candidate) => [candidate.host, candidate.status, candidate.deviceId, candidate.testable, candidate.conflict, candidate.lastTest, candidate.adoptable])).toEqual([
      ['192.0.2.11', 'REGISTERED', 'CAM-01', true, false, null, false],
      ['192.0.2.12', 'NEW', null, true, false, null, false],
      ['192.0.2.13', 'NEW', null, false, true, null, false],
    ]);
    const ids = state.candidates.map((candidate) => candidate.candidateId);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(CAPTURE_CANDIDATE_ID_PATTERN);
    // No answer of the store carries the service address or the adapter's record.
    expect(JSON.stringify(state)).not.toMatch(/onvif\/device_service|serviceAddress|camera"/);
    expect(store.running()).toBeNull();
  });

  it('owner only: another session reads `search: null`, and gets null for the first session\'s candidate ID - the answer of an unknown and of an expired one', () => {
    const store = createCandidateStore({ randomBytes: counting() });
    begin(store, 'S-A', 'DSC-000001');
    complete(store, 'DSC-000001', [found('192.0.2.12')]);
    const id = store.stateOf('S-A', T0 + 3_000).candidates[0]?.candidateId ?? '';
    expect(store.find('S-A', id, T0 + 3_000)?.camera.serviceAddress).toBe('http://192.0.2.12:8560/onvif/device_service');
    expect(store.stateOf('S-B', T0 + 3_000)).toEqual({ search: null, candidates: [], truncated: false });
    expect([store.find('S-B', id, T0 + 3_000), store.find('S-A', 'CND-0000000000FF', T0 + 3_000)]).toEqual([null, null]);
    // A write by another session's ID changes nothing.
    expect(store.recordTest('S-B', id, { outcome: 'REACHABLE', authenticated: false, testedAt: T0 + 3_000, profiles: ['P'] }, T0 + 3_000)).toBe(false);
    expect(store.markRegistered('S-B', id, 'CAM-03', T0 + 3_000)).toBe(false);
    expect(store.stateOf('S-A', T0 + 3_000).candidates[0]).toMatchObject({ lastTest: null, status: 'NEW' });
  });

  it('gone at `expiresAt`, when the owner searches again, when the owner session ends, and on clear', () => {
    const store = createCandidateStore({ randomBytes: counting() });
    begin(store, 'S-A', 'DSC-000001');
    complete(store, 'DSC-000001', [found('192.0.2.12')]);
    const first = store.stateOf('S-A', T0 + 3_000).candidates[0]?.candidateId ?? '';
    const expiresAt = T0 + 3_000 + CAPTURE_DISCOVERY_RESULT_TTL_MS;
    expect(store.find('S-A', first, expiresAt - 1)).not.toBeNull();
    expect(store.find('S-A', first, expiresAt)).toBeNull();
    expect(store.stateOf('S-A', expiresAt)).toEqual({ search: null, candidates: [], truncated: false });
    expect(store.size()).toBe(0);

    // A new search replaces the list: the old candidate ID dies with it, also while the new one runs.
    begin(store, 'S-A', 'DSC-000002', T0);
    complete(store, 'DSC-000002', [found('192.0.2.12')]);
    const second = store.stateOf('S-A', T0 + 3_000).candidates[0]?.candidateId ?? '';
    begin(store, 'S-A', 'DSC-000003', T0 + 20_000);
    expect(store.find('S-A', second, T0 + 20_001)).toBeNull();
    complete(store, 'DSC-000003', [found('192.0.2.12')], T0 + 23_000);
    const third = store.stateOf('S-A', T0 + 23_000).candidates[0]?.candidateId ?? '';
    expect(third).not.toBe(second);
    expect(store.find('S-A', second, T0 + 23_000)).toBeNull();

    // The owner session ends: gone at once.
    store.discardSession('S-A');
    expect([store.find('S-A', third, T0 + 23_000), store.size()]).toEqual([null, 0]);
    // It ends while its search runs: nothing is readable, the Core's one search still counts as running, and the list is dropped when the window closes.
    begin(store, 'S-A', 'DSC-000004', T0 + 40_000);
    store.discardSession('S-A');
    expect(store.stateOf('S-A', T0 + 40_001)).toEqual({ search: null, candidates: [], truncated: false });
    expect(store.running()?.search.searchId).toBe('DSC-000004');
    expect(complete(store, 'DSC-000004', [found('192.0.2.12')], T0 + 43_000)?.state).toBe('COMPLETE');
    expect([store.size(), store.running()]).toEqual([0, null]);

    begin(store, 'S-B', 'DSC-000005', T0 + 50_000);
    store.clear();
    expect([store.size(), store.running()]).toEqual([0, null]);
  });

  it('one RUNNING search per Core; a search that could not run is FAILED with its reason and no candidate, never an empty COMPLETE', () => {
    const store = createCandidateStore({ randomBytes: counting() });
    begin(store, 'S-A', 'DSC-000001');
    expect(() => begin(store, 'S-B', 'DSC-000002')).toThrow(/one search per Core/);
    const failed = store.fail('DSC-000001', 'NO_ELIGIBLE_INTERFACE', T0 + 5);
    expect(failed).toMatchObject({ state: 'FAILED', failureReason: 'NO_ELIGIBLE_INTERFACE', responderCount: 0 });
    expect(store.stateOf('S-A', T0 + 10)).toMatchObject({ search: { state: 'FAILED', failureReason: 'NO_ELIGIBLE_INTERFACE' }, candidates: [] });
    // Closing a search twice, or one that does not exist, changes nothing.
    expect([store.fail('DSC-000001', 'SOCKET_ERROR', T0 + 6), complete(store, 'DSC-000009', [])]).toEqual([null, null]);
  });

  it('at most 64 candidates are kept, in the order given, and the state says `truncated`', () => {
    const store = createCandidateStore({ randomBytes: counting() });
    begin(store, 'S-A', 'DSC-000001');
    const many = Array.from({ length: 70 }, (_unused, index) => found(`192.0.2.${index + 1}`));
    store.complete('DSC-000001', many, { responderCount: 300, interfaceCount: 1, truncated: false, completedAt: T0 + 3_000 });
    const state = store.stateOf('S-A', T0 + 3_000);
    expect([state.candidates.length, state.truncated, state.search?.responderCount]).toEqual([CAPTURE_DISCOVERY_MAX_CANDIDATES, true, 300]);
    expect(state.candidates.map((candidate) => candidate.host)).toEqual(many.slice(0, 64).map((candidate) => candidate.host));
    expect(new Set(state.candidates.map((candidate) => candidate.candidateId)).size).toBe(64);
  });

  it('the seam of the connect flow: a test outcome and its profile codes are kept, `adoptable` follows the age of a REACHABLE test, a registered candidate reads REGISTERED', () => {
    const store = createCandidateStore({ randomBytes: counting() });
    begin(store, 'S-A', 'DSC-000001');
    complete(store, 'DSC-000001', [found('192.0.2.12')]);
    const at = T0 + 3_000;
    const id = store.stateOf('S-A', at).candidates[0]?.candidateId ?? '';
    expect(store.recordTest('S-A', id, { outcome: 'AUTHENTICATION_FAILED', authenticated: true, testedAt: at, profiles: ['IGNORED'] }, at)).toBe(true);
    expect(store.find('S-A', id, at)?.lastTest).toEqual({ outcome: 'AUTHENTICATION_FAILED', authenticated: true, testedAt: at, profiles: [] });
    expect(store.stateOf('S-A', at).candidates[0]?.adoptable).toBe(false);
    store.recordTest('S-A', id, { outcome: 'REACHABLE', authenticated: true, testedAt: at, profiles: ['H264_MAIN'] }, at);
    expect(store.find('S-A', id, at)).toMatchObject({ searchId: 'DSC-000001', registeredDeviceId: null, lastTest: { outcome: 'REACHABLE', profiles: ['H264_MAIN'] } });
    expect(store.stateOf('S-A', at + CAPTURE_CONNECTION_TEST_VALIDITY_MS - 1).candidates[0]).toMatchObject({ adoptable: true, lastTest: { outcome: 'REACHABLE', authenticated: true, testedAt: at } });
    expect(store.stateOf('S-A', at + CAPTURE_CONNECTION_TEST_VALIDITY_MS).candidates[0]?.adoptable).toBe(false);
    // The API view of a test has three members: no profile code and nothing of a credential.
    expect(Object.keys(store.stateOf('S-A', at).candidates[0]?.lastTest ?? {})).toEqual(['outcome', 'authenticated', 'testedAt']);
    store.markRegistered('S-A', id, 'CAM-03', at);
    expect(store.stateOf('S-A', at).candidates[0]).toMatchObject({ status: 'REGISTERED', deviceId: 'CAM-03', adoptable: false });
    expect(store.find('S-A', id, at)?.registeredDeviceId).toBe('CAM-03');
  });

  it('a random source that repeats itself, or returns another length, is refused: no ID is ever reused or shortened', () => {
    const repeating = createCandidateStore({ randomBytes: (size) => new Uint8Array(size) });
    begin(repeating, 'S-A', 'DSC-000001');
    expect(() => complete(repeating, 'DSC-000001', [found('192.0.2.11'), found('192.0.2.12')])).toThrow(/repeats itself/);
    const short = createCandidateStore({ randomBytes: () => new Uint8Array(2) });
    begin(short, 'S-A', 'DSC-000001');
    expect(() => complete(short, 'DSC-000001', [found('192.0.2.11')])).toThrow(/another length/);
  });
});
