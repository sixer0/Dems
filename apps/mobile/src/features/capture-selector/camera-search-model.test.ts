// Task 3 row 138 — the pure rules of the camera search (ux spec §8c; checks M4-UX-UNIT, the software
// half of M4-DISC-T / -P, M4-DISC-EMPTY-T / -P, M4-DISC-RBAC-T / -P). No React.
import { describe, expect, it } from '@jest/globals';
import { simCaptureCandidates, simCaptureDiscoverySearch, type CaptureCandidate, type CaptureDiscoveryStateBody } from '@dems/shared/api';
import {
  SEARCH_POLL_MS,
  candidateGroups,
  candidateRows,
  classifySearchAnswer,
  discoveryStateOf,
  isDrawnResult,
  searchFactsOf,
  searchGate,
  searchPanelState,
  searchProgress,
  searchWindowSeconds,
} from './camera-search-model';

const facts = (status: number | null, reason: string | null = null) => ({ status, code: null, reason, retryAfterS: null });
const T0 = 1_780_000_000_000;
const search = (over: Partial<ReturnType<typeof simCaptureDiscoverySearch>> = {}) => ({ ...simCaptureDiscoverySearch('DSC-000001', T0, T0 + 600_000, true), ...over });
const view = (over: Partial<CaptureDiscoveryStateBody> = {}): CaptureDiscoveryStateBody => ({ search: search(), candidates: simCaptureCandidates(), truncated: false, ...over });
const candidate = (over: Partial<CaptureCandidate>): CaptureCandidate => ({ ...simCaptureCandidates()[0]!, ...over });

describe('what an answer of operation 93 / 94 means (§8c.2)', () => {
  it('maps each answer to its state; the two 409s are told apart by the reason', () => {
    expect(classifySearchAnswer(facts(202))).toBe('ok');
    expect(classifySearchAnswer(facts(200))).toBe('ok');
    expect(classifySearchAnswer(facts(409, 'DISCOVERY_IN_PROGRESS'))).toBe('busy');
    expect(classifySearchAnswer(facts(409, 'DISCOVERY_NOT_ALLOWED_WHILE_RECORDING'))).toBe('recording');
    expect(classifySearchAnswer(facts(429, 'DISCOVERY_RATE_LIMITED'))).toBe('limited');
    expect(classifySearchAnswer(facts(503, 'DISCOVERY_NOT_READY'))).toBe('unavailable');
    expect(classifySearchAnswer(facts(403))).toBe('denied');
    expect(classifySearchAnswer(facts(401))).toBe('signedOut');
    expect(classifySearchAnswer(facts(null))).toBe('offline');
    expect(classifySearchAnswer(facts(500))).toBe('failed');
  });

  it('reads the reason and the seconds of a refusal; the header wins over `retryInMs`; a body that is no envelope gives nulls', () => {
    const body = { error: { code: 'RATE_LIMITED', message: 'x', details: { reason: 'DISCOVERY_RATE_LIMITED', retryInMs: 4_200 } } };
    expect(searchFactsOf(429, body)).toEqual({ status: 429, code: 'RATE_LIMITED', reason: 'DISCOVERY_RATE_LIMITED', retryAfterS: 5 });
    expect(searchFactsOf(429, body, 9).retryAfterS).toBe(9);
    expect(searchFactsOf(500, 'boom')).toEqual({ status: 500, code: null, reason: null, retryAfterS: null });
  });

  it('accepts operation 94 only as the contract shapes it: an unknown member or a missing one is no state', () => {
    expect(discoveryStateOf(view())).not.toBeNull();
    expect(discoveryStateOf({ search: null, candidates: [], truncated: false })).toEqual({ search: null, candidates: [], truncated: false });
    expect(discoveryStateOf({ search: null, candidates: [] })).toBeNull();
    expect(discoveryStateOf({ ...view(), secret: 'x' })).toBeNull();
    expect(discoveryStateOf(null)).toBeNull();
  });
});

describe('the gate of G13 (§8c.6)', () => {
  const open = { roleKnown: true, permitted: true, linkDown: false, recording: false, refusedWhileRecording: false };
  it('orders checking → waiting → denied → recording → allowed; an unknown role is never "denied"', () => {
    expect(searchGate({ ...open, roleKnown: false, permitted: false })).toBe('checking');
    expect(searchGate({ ...open, linkDown: true, permitted: false })).toBe('waiting');
    expect(searchGate({ ...open, permitted: false, recording: true })).toBe('denied');
    expect(searchGate({ ...open, recording: true })).toBe('recording');
    expect(searchGate({ ...open, refusedWhileRecording: true })).toBe('recording');
    expect(searchGate(open)).toBe('allowed');
  });
});

describe('the state of the panel comes from operation 94, never from a clock (§8c.2)', () => {
  const base = { gate: 'allowed' as const, read: true, hadResult: false, readFailed: false };
  it('S1, S2, S3, S4, S5, S8, S12, S13', () => {
    expect(searchPanelState({ ...base, gate: 'checking', view: null })).toBe('checking');
    expect(searchPanelState({ ...base, gate: 'denied', view: view() })).toBe('denied');
    expect(searchPanelState({ ...base, read: false, view: null })).toBe('loading');
    expect(searchPanelState({ ...base, view: view({ search: null, candidates: [] }) })).toBe('idle');
    expect(searchPanelState({ ...base, view: view({ search: search({ state: 'RUNNING' }), candidates: [] }) })).toBe('searching');
    expect(searchPanelState({ ...base, view: view() })).toBe('results');
    expect(searchPanelState({ ...base, view: view({ search: search({ responderCount: 0, newCount: 0, registeredCount: 0 }), candidates: [] }) })).toBe('empty');
    expect(searchPanelState({ ...base, view: view({ search: search({ state: 'FAILED', failureReason: 'SOCKET_ERROR' }), candidates: [] }) })).toBe('failed');
    expect(searchPanelState({ ...base, readFailed: true, view: view() })).toBe('failed');
    expect(searchPanelState({ ...base, hadResult: true, view: view({ search: null, candidates: [] }) })).toBe('expired');
  });

  it('S6: only registered cameras is a result with rows, never the empty state', () => {
    const registered = simCaptureCandidates().filter((entry) => entry.status === 'REGISTERED');
    const state = searchPanelState({ ...base, view: view({ search: search({ responderCount: 1, newCount: 0, registeredCount: 1 }), candidates: registered }) });
    expect(state).toBe('results');
    expect(isDrawnResult(state)).toBe(true);
    expect(isDrawnResult('searching')).toBe(false);
  });

  it('with the link down and nothing read, the idle body is drawn (the button carries the waiting sentence)', () => {
    expect(searchPanelState({ ...base, gate: 'waiting', read: false, view: null })).toBe('idle');
  });
});

describe('the bar of a running search is forward-only and reads Core instants (§8c.8)', () => {
  const running = { startedAt: T0, windowMs: 3_000 };
  it('grows with the Core clock, is clamped to 0..100, and never goes back when the clock does', () => {
    expect(searchProgress(running, T0 - 500)).toBe(0);
    expect(searchProgress(running, T0 + 1_500)).toBe(50);
    expect(searchProgress(running, T0 + 9_000)).toBe(100);
    // The Core clock estimate moved backwards (a new offset reading): the bar keeps its value.
    expect(searchProgress(running, T0 + 600, 50)).toBe(50);
    expect(searchProgress(running, T0 + 2_400, 50)).toBe(80);
    // Negative control: without `previous` the same instant reads lower.
    expect(searchProgress(running, T0 + 600)).toBe(20);
  });

  it('a search with no window is complete; the hint is a fixed whole number of seconds', () => {
    expect(searchProgress({ startedAt: T0, windowMs: 0 }, T0)).toBe(100);
    expect(searchWindowSeconds({ windowMs: 3_000 })).toBe(3);
    expect(searchWindowSeconds({ windowMs: 2_100 })).toBe(3);
    expect(searchWindowSeconds({ windowMs: 0 })).toBe(1);
  });

  it('operation 94 is read no faster than once per second while a search runs', () => {
    expect(SEARCH_POLL_MS).toBeGreaterThanOrEqual(1_000);
  });
});

describe('the list (§8c.3)', () => {
  it('the order of the rows IS the order of the answer: nothing is sorted, filtered or merged', () => {
    const answer = [
      candidate({ candidateId: 'CND-zz', host: '192.0.2.30', sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP' }),
      candidate({ candidateId: 'CND-aa', host: '192.0.2.4', sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP' }),
      candidate({ candidateId: 'CND-mm', host: '192.0.2.17', sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP' }),
    ];
    expect(candidateRows(answer).map((row) => row.key)).toEqual(['CND-zz', 'CND-aa', 'CND-mm']);
    expect(candidateGroups(answer).network.map((row) => row.key)).toEqual(['CND-zz', 'CND-aa', 'CND-mm']);
    // Negative control: the answer's order is not the sorted order.
    expect(['CND-zz', 'CND-aa', 'CND-mm']).not.toEqual([...['CND-zz', 'CND-aa', 'CND-mm']].sort());
  });

  it('development sources form their own group, in answer order; a production camera never enters it', () => {
    const answer = [
      candidate({ candidateId: 'CND-1', sourceClass: 'DEVELOPMENT', adapter: 'FAKE' }),
      candidate({ candidateId: 'CND-2', sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP' }),
      candidate({ candidateId: 'CND-3', sourceClass: 'DEVELOPMENT', adapter: 'FAKE' }),
    ];
    const groups = candidateGroups(answer);
    expect(groups.network.map((row) => row.key)).toEqual(['CND-2']);
    expect(groups.development.map((row) => row.key)).toEqual(['CND-1', 'CND-3']);
    expect(candidateGroups(answer.filter((entry) => entry.sourceClass === 'PRODUCTION')).development).toEqual([]);
  });

  it('marks: registered, two-devices-one-identity, not-its-own-address, new', () => {
    expect(candidateRows([candidate({ status: 'REGISTERED', deviceId: 'CAM-02' })])[0]).toMatchObject({ mark: 'registered', deviceId: 'CAM-02' });
    expect(candidateRows([candidate({ conflict: true, testable: false })])[0]?.mark).toBe('conflict');
    expect(candidateRows([candidate({ testable: false })])[0]?.mark).toBe('notTestable');
    expect(candidateRows([candidate({})])[0]).toMatchObject({ mark: 'new', deviceId: null });
  });

  it('make and model: a missing part is left out; both missing is null; the announced text is carried unchanged', () => {
    expect(candidateRows([candidate({ vendor: 'Acme', model: 'X1' })])[0]?.makeModel).toBe('Acme X1');
    expect(candidateRows([candidate({ vendor: null, model: 'X1' })])[0]?.makeModel).toBe('X1');
    expect(candidateRows([candidate({ vendor: null, model: null })])[0]?.makeModel).toBeNull();
    const markup = '<b onpress="x">Cam</b> [link](http://x)';
    expect(candidateRows([candidate({ name: markup })])[0]?.name).toBe(markup);
  });

  it('a row carries no id-like or test member a screen could draw by mistake', () => {
    const row = candidateRows([candidate({ lastTest: { outcome: 'REACHABLE', authenticated: true, testedAt: T0 }, adoptable: true })])[0]!;
    expect(Object.keys(row).sort()).toEqual(['adapter', 'address', 'addressChanged', 'development', 'deviceId', 'key', 'makeModel', 'mark', 'name']);
    expect(JSON.stringify(row)).not.toMatch(/urn:uuid|REACHABLE|adoptable|lastTest|DSC-/);
  });
});
