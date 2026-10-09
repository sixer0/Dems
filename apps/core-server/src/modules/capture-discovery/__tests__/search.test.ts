// Blueprint row 132: the search runner on a scripted adapter and a clock that is a number
// (checks M4-DISC-TRIG-1, M4-DISC-REC-1 (a) and the decision of (b), M4-SEC-RATE-1 "0 datagrams",
// M4-AUD-1 for CAPTURE_DISCOVERY_SEARCHED, M4-SEC-DISC-2 "shape"; C3 §2.6, §5.2; D83, D86 C-4).
// The count of `discover` calls stands for "datagrams": the adapter sends none unless it is called.
import { CAPTURE_DISCOVERY_WINDOW_MS, CaptureDiscoveryReason } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { CaptureAdapterKind, DiscoveryNotRunError, type OnvifCandidate, type OnvifDiscoveryAdapter, type RegisteredLookup, type WsDiscoveryResult } from '../../../capture/adapters';
import type { AuditEntry } from '../../../core';
import { SERVER_AUDIT_DETAIL_RULES } from '../../../core';
import { adoptionAddressOf, createCandidateStore, createSearchLimiter, createSearchRunner, registeredIndexOf, type RegisteredCamera, type SearchClosed, type SearchRequest } from '../index';

const T0 = 1_760_000_000_000;
const MANUAL = (sessionId: string, operatorId = 'OPR-003'): SearchRequest => ({ sessionId, operatorId, deviceId: null, trigger: 'MANUAL' });
const PRECHECK = (sessionId: string): SearchRequest => ({ sessionId, operatorId: 'OPR-001', deviceId: 'DEV-0001', trigger: 'PRECHECK' });

const answer = (host: string, more: Partial<OnvifCandidate> = {}): OnvifCandidate => ({
  adapterKind: CaptureAdapterKind.ONVIF_RTSP,
  host,
  serviceAddress: `http://${host}/onvif/device_service`,
  endpointRef: `urn:uuid:${host}`,
  vendor: 'Vendor',
  model: 'Model',
  name: 'Camera',
  testable: true,
  conflict: false,
  reason: null,
  registered: false,
  addressChanged: false,
  types: [],
  profileHints: [],
  locationHints: [],
  macHint: null,
  serialHint: null,
  ...more,
});
const resultOf = (candidates: OnvifCandidate[], more: Partial<WsDiscoveryResult> = {}): WsDiscoveryResult => ({
  candidates,
  responderCount: candidates.length,
  interfaceCount: 1,
  truncated: false,
  counts: { datagramsReceived: candidates.length * 4, datagramsAccepted: candidates.length, dropped: {}, repeats: candidates.length * 3, matchesSkipped: 0, respondersOverCap: 0, lookupErrors: 0, datagramsSent: 4, sendErrors: 0, handlerErrors: 0 },
  ...more,
});

function rig(options: { duringRecordingEnabled?: boolean; ready?: boolean; registered?: RegisteredCamera[]; auditFails?: boolean } = {}) {
  let now = T0;
  let session: { id: string; state: string } | null = null;
  let ready = options.ready ?? true;
  const calls: Array<{ windowMs: number; lookup: RegisteredLookup; settle: (outcome: WsDiscoveryResult | Error) => void; signal: AbortSignal }> = [];
  const audits: AuditEntry[] = [];
  const logs: Array<{ level: string; fields: Record<string, unknown>; message: string }> = [];
  const persisted: Array<Record<string, unknown>> = [];
  const closed: SearchClosed[] = [];
  let registryReads = 0;
  const store = createCandidateStore({ randomBytes: (() => { let next = 0; return (size: number) => Uint8Array.from({ length: size }, (_u, index) => (index === size - 1 ? ++next : 7)); })() });
  const adapterOf = (lookup: RegisteredLookup): OnvifDiscoveryAdapter =>
    ({
      discover: (search: { windowMs: number; signal: AbortSignal }) =>
        new Promise<WsDiscoveryResult>((resolve, reject) => {
          calls.push({ windowMs: search.windowMs, lookup, signal: search.signal, settle: (outcome) => (outcome instanceof Error ? reject(outcome) : resolve(outcome)) });
        }),
    }) as unknown as OnvifDiscoveryAdapter;
  const runner = createSearchRunner({
    store,
    limiter: createSearchLimiter(),
    now: () => now,
    ready: () => ready,
    adapter: (lookup) => (ready ? adapterOf(lookup) : null),
    registeredCameras: async () => {
      registryReads += 1;
      return options.registered ?? [];
    },
    openSession: () => session,
    duringRecordingEnabled: options.duringRecordingEnabled ?? true,
    audit: async (entry) => {
      if (options.auditFails) throw new Error('the database does not answer');
      audits.push(entry);
    },
    log: { info: (fields, message) => void logs.push({ level: 'info', fields, message }), error: (fields, message) => void logs.push({ level: 'error', fields, message }) },
    persist: (entry) => void persisted.push(entry),
  });
  runner.onClosed((event) => void closed.push(event));
  return {
    runner,
    store,
    calls,
    audits,
    logs,
    persisted,
    closed,
    registryReads: () => registryReads,
    advance: (ms: number) => void (now += ms),
    now: () => now,
    setSession: (value: { id: string; state: string } | null) => void (session = value),
    setReady: (value: boolean) => void (ready = value),
    /** Lets the registry read and the call of `discover` happen. */
    settle: async () => {
      for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
    },
  };
}

/** Starts a search, lets the adapter be called, closes the window with `outcome`. */
async function runSearch(r: ReturnType<typeof rig>, request: SearchRequest, outcome: WsDiscoveryResult | Error) {
  const start = await r.runner.start(request);
  if (!start.started) throw new Error(`the search did not start: ${JSON.stringify(start.refusal)}`);
  await r.settle();
  r.advance(CAPTURE_DISCOVERY_WINDOW_MS);
  r.calls.at(-1)?.settle(outcome);
  await start.closed;
  return start;
}

describe('M4-DISC-TRIG-1: a search is started by its two triggers and by nothing else', () => {
  it('nothing is called before a trigger: building the runner, reading the store and the passing of an hour send nothing', async () => {
    const r = rig();
    r.advance(3_600_000);
    r.store.stateOf('S-A', r.now());
    r.store.find('S-A', 'CND-000000000001', r.now());
    await r.settle();
    expect([r.calls.length, r.registryReads(), r.runner.started(), r.audits.length]).toEqual([0, 0, 0, 0]);
  });

  it('one MANUAL start: one registry read, one call of discover with the 3,000 ms window, the answer at once with a RUNNING search', async () => {
    const r = rig();
    const start = await r.runner.start(MANUAL('S-A'));
    expect(start).toMatchObject({ started: true, created: true, search: { searchId: 'DSC-000001', trigger: 'MANUAL', state: 'RUNNING', scope: 'CAMERA_NETWORK', startedAt: T0, windowMs: 3_000, created: true } });
    await r.settle();
    expect([r.calls.length, r.registryReads(), r.calls[0]?.windowMs]).toEqual([1, 1, CAPTURE_DISCOVERY_WINDOW_MS]);
    // Nothing is written while the window is open.
    expect(r.audits).toEqual([]);
    // Positive control of the counting: a second runner that is started twice calls twice.
    const other = rig();
    await runSearch(other, MANUAL('S-A'), resultOf([]));
    other.advance(10_000);
    await runSearch(other, MANUAL('S-A'), resultOf([]));
    expect(other.calls.length).toBe(2);
  });

  it('the pre-check\'s search is the second trigger: trigger PRECHECK, owned by the session of the operator who started the pre-check, with the same one row', async () => {
    const r = rig();
    const start = await runSearch(r, PRECHECK('S-P'), resultOf([answer('192.0.2.20')]));
    expect(start.search).toMatchObject({ trigger: 'PRECHECK', searchId: 'DSC-000001' });
    expect(r.store.stateOf('S-P', r.now()).candidates).toHaveLength(1);
    expect(r.audits.map((entry) => [entry.type, entry.actorId, entry.deviceId, entry.details])).toEqual([
      ['CAPTURE_DISCOVERY_SEARCHED', 'OPR-001', 'DEV-0001', { searchId: 'DSC-000001', scope: 'CAMERA_NETWORK', trigger: 'PRECHECK', outcome: 'COMPLETE', responderCount: 1, newCount: 1, registeredCount: 0, interfaceCount: 1 }],
    ]);
  });
});

describe('what a start decides before anything is sent (C3 §2.6 op 93)', () => {
  it('no adapter: DISCOVERY_NOT_READY, and nothing is read, counted or written', async () => {
    const r = rig({ ready: false });
    expect(await r.runner.start(MANUAL('S-A'))).toEqual({ started: false, refusal: { kind: 'NOT_READY', reason: CaptureDiscoveryReason.DISCOVERY_NOT_READY } });
    await r.settle();
    expect([r.calls.length, r.registryReads(), r.runner.started(), r.audits.length, r.store.size()]).toEqual([0, 0, 0, 0, 0]);
    // A refusal took no place in the bounds: with an adapter the very next call starts.
    r.setReady(true);
    expect((await r.runner.start(MANUAL('S-A'))).started).toBe(true);
  });

  it('M4-DISC-REC-1 (a): with the lift OFF a search during RECORDING is refused - 0 calls, no row, no alert - and accepted in every other open state', async () => {
    const r = rig({ duringRecordingEnabled: false });
    r.setSession({ id: 'SES-20261009-0003', state: 'RECORDING' });
    expect(await r.runner.start(MANUAL('S-A'))).toEqual({ started: false, refusal: { kind: 'RECORDING', reason: 'DISCOVERY_NOT_ALLOWED_WHILE_RECORDING' } });
    expect(await r.runner.start(PRECHECK('S-P'))).toMatchObject({ started: false, refusal: { kind: 'RECORDING' } });
    await r.settle();
    expect([r.calls.length, r.registryReads(), r.audits.length, r.closed.length, r.runner.started()]).toEqual([0, 0, 0, 0, 0]);
    for (const state of ['CREATE', 'PRECHECK', 'ARMED', 'STOPPING', 'FINALIZING', 'SEALED', 'FAULT', 'RECOVERY']) {
      r.setSession({ id: 'SES-20261009-0003', state });
      r.advance(10_000);
      await runSearch(r, MANUAL('S-A'), resultOf([]));
    }
    expect(r.calls.length).toBe(8);
    // The row of a search made while a session is open names that session.
    expect(r.audits.at(-1)?.details).toMatchObject({ sessionId: 'SES-20261009-0003' });
  });

  it('M4-DISC-REC-1 (c), the decision: with the lift ON the same call during RECORDING is a search like any other', async () => {
    const r = rig({ duringRecordingEnabled: true });
    r.setSession({ id: 'SES-20261009-0003', state: 'RECORDING' });
    const start = await runSearch(r, MANUAL('S-A'), resultOf([answer('192.0.2.20')]));
    expect(start.search.state).toBe('RUNNING');
    expect([r.calls.length, r.audits.length]).toEqual([1, 1]);
    expect(r.audits[0]?.details).toMatchObject({ sessionId: 'SES-20261009-0003', outcome: 'COMPLETE', responderCount: 1 });
  });

  it('single-flight: the caller\'s own running search is answered again with `created: false` and no second probe; another session gets DISCOVERY_IN_PROGRESS', async () => {
    const r = rig();
    const first = await r.runner.start(MANUAL('S-A'));
    await r.settle();
    const again = await r.runner.start(MANUAL('S-A'));
    expect(again).toMatchObject({ started: true, created: false, search: { searchId: 'DSC-000001', state: 'RUNNING', created: false } });
    expect(await r.runner.start(MANUAL('S-B'))).toEqual({ started: false, refusal: { kind: 'IN_PROGRESS', reason: 'DISCOVERY_IN_PROGRESS' } });
    // The pre-check's search is single-flight too: it is not started while another runs.
    expect(await r.runner.start(PRECHECK('S-P'))).toMatchObject({ started: false, refusal: { kind: 'IN_PROGRESS' } });
    await r.settle();
    expect([r.calls.length, r.runner.started()]).toEqual([1, 1]);
    r.calls[0]?.settle(resultOf([]));
    if (first.started) await first.closed;
    expect(r.audits).toHaveLength(1);
  });

  it('M4-SEC-RATE-1: over a bound the answer is DISCOVERY_RATE_LIMITED with the wait - 0 calls, no row; the pre-check\'s search is outside the bounds and takes no place in them', async () => {
    const r = rig();
    await runSearch(r, MANUAL('S-A'), resultOf([]));
    // 3 s after the start (the window just closed): the session's 10 s are not over.
    expect(await r.runner.start(MANUAL('S-A'))).toEqual({ started: false, refusal: { kind: 'RATE_LIMITED', reason: 'DISCOVERY_RATE_LIMITED', bound: 'SESSION_SPACING', retryAfterMs: 7_000 } });
    // Another session, 3 s after the Core's last start: the Core's 5 s are not over.
    expect(await r.runner.start(MANUAL('S-B'))).toMatchObject({ started: false, refusal: { kind: 'RATE_LIMITED', bound: 'CORE_SPACING', retryAfterMs: 2_000 } });
    await r.settle();
    expect([r.calls.length, r.audits.length]).toEqual([1, 1]);
    // The pre-check's search starts at that same instant, although both spacing bounds refuse a manual one.
    await runSearch(r, PRECHECK('S-A'), resultOf([]));
    expect(r.calls.length).toBe(2);
    // Six pre-check searches in a row do not use up the Core's six per minute: a manual search of a third session still starts.
    for (let index = 0; index < 6; index += 1) await runSearch(r, PRECHECK(`S-P${index}`), resultOf([]));
    r.advance(1);
    const manual = await r.runner.start(MANUAL('S-C'));
    expect(manual.started).toBe(true);
  });
});

describe('what the end of the window writes (C3 §5.2 CAPTURE_DISCOVERY_SEARCHED; D80(8); M4-AUD-1)', () => {
  it('"nothing found" is COMPLETE with 0 and one row; "could not run" is FAILED with its reason and one row with outcome FAILED', async () => {
    const empty = rig();
    await runSearch(empty, MANUAL('S-A'), resultOf([]));
    expect(empty.store.stateOf('S-A', empty.now())).toMatchObject({ search: { state: 'COMPLETE', responderCount: 0, failureReason: null }, candidates: [] });
    expect(empty.audits.map((entry) => entry.details)).toEqual([
      { searchId: 'DSC-000001', scope: 'CAMERA_NETWORK', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 0, newCount: 0, registeredCount: 0, interfaceCount: 1, operationId: 'startCaptureDiscovery', permission: 'CAPTURE_CONFIG' },
    ]);
    expect(empty.closed.map((event) => [event.search.state, event.search.responderCount, event.sessionId])).toEqual([['COMPLETE', 0, 'S-A']]);

    for (const [error, reason] of [[new DiscoveryNotRunError('NO_ELIGIBLE_INTERFACE'), 'NO_ELIGIBLE_INTERFACE'], [new DiscoveryNotRunError('SOCKET_ERROR'), 'SOCKET_ERROR']] as const) {
      const failed = rig();
      await runSearch(failed, MANUAL('S-A'), error);
      expect(failed.store.stateOf('S-A', failed.now())).toMatchObject({ search: { state: 'FAILED', failureReason: reason, responderCount: 0 }, candidates: [] });
      expect(failed.audits.map((entry) => [entry.severity, entry.details])).toEqual([
        ['WARNING', { searchId: 'DSC-000001', scope: 'CAMERA_NETWORK', trigger: 'MANUAL', outcome: 'FAILED', responderCount: 0, newCount: 0, registeredCount: 0, interfaceCount: 0, failureReason: reason, operationId: 'startCaptureDiscovery', permission: 'CAPTURE_CONFIG' }],
      ]);
      expect(failed.closed.map((event) => event.search.state)).toEqual(['FAILED']);
    }
  });

  it('an error that is none of the named ones: FAILED with SEARCH_FAILED, logged and persisted by its code, never by its text', async () => {
    const r = rig();
    await runSearch(r, MANUAL('S-A'), Object.assign(new Error('bind EADDRINUSE 192.0.2.1:3702 for admin:hunter2'), { code: 'EADDRINUSE' }));
    expect(r.store.stateOf('S-A', r.now()).search).toMatchObject({ state: 'FAILED', failureReason: 'SEARCH_FAILED' });
    expect(r.persisted).toEqual([{ source: 'captureDiscovery.search', message: 'a camera search failed', code: 'EADDRINUSE', context: { searchId: 'DSC-000001', trigger: 'MANUAL' } }]);
    expect(JSON.stringify([r.logs, r.persisted, r.audits, r.store.stateOf('S-A', r.now())])).not.toMatch(/192\.0\.2\.1|hunter2|bind /);
  });

  it('every row passes the audit writer\'s list for its type; the log line holds counts and reason names only', async () => {
    const r = rig();
    r.setSession({ id: 'SES-20261009-0003', state: 'PRECHECK' });
    await runSearch(r, MANUAL('S-A'), resultOf([answer('192.0.2.20', { name: 'Lobby <script>', vendor: 'ACME', model: 'X-1' })]));
    const rules = SERVER_AUDIT_DETAIL_RULES.CAPTURE_DISCOVERY_SEARCHED;
    for (const entry of r.audits) {
      for (const [key, value] of Object.entries(entry.details)) expect([key, (rules as Record<string, { accepts(v: unknown): boolean }>)[key]?.accepts(value)]).toEqual([key, true]);
      for (const [key, rule] of Object.entries(rules)) if (rule.required) expect(Object.keys(entry.details)).toContain(key);
    }
    const line = r.logs.find((entry) => entry.fields['code'] === 'CAPTURE_DISCOVERY_SEARCHED');
    expect(line?.fields).toMatchObject({ searchId: 'DSC-000001', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 1, durationMs: 3_000 });
    // No address, no endpoint reference and no device text in a row, a log line or the event of the listeners.
    expect(JSON.stringify([r.audits, r.logs, r.closed.map((event) => event.search)])).not.toMatch(/192\.0\.2\.20|urn:uuid|Lobby|ACME|X-1|onvif/);
  });

  it('a row that cannot be written does not undo the search: the list stands, the fault is logged and persisted with the search ID', async () => {
    const r = rig({ auditFails: true });
    await runSearch(r, MANUAL('S-A'), resultOf([answer('192.0.2.20')]));
    expect(r.store.stateOf('S-A', r.now()).candidates).toHaveLength(1);
    expect(r.persisted).toEqual([{ source: 'captureDiscovery.search', message: 'the audit row of a camera search could not be written', code: 'CAPTURE_DISCOVERY_AUDIT_FAILED', context: { searchId: 'DSC-000001', trigger: 'MANUAL' } }]);
    expect(r.closed).toHaveLength(1);
  });

  it('the server stops while a search runs: the adapter is told to end it, and the search closes FAILED (SEARCH_ABORTED)', async () => {
    const r = rig();
    const start = await r.runner.start(MANUAL('S-A'));
    await r.settle();
    r.runner.abort();
    expect(r.calls[0]?.signal.aborted).toBe(true);
    r.calls[0]?.settle(new Error('aborted'));
    if (start.started) await start.closed;
    expect(r.store.stateOf('S-A', r.now()).search).toMatchObject({ state: 'FAILED', failureReason: 'SEARCH_ABORTED' });
    expect(r.persisted).toEqual([]);
  });
});

describe('the candidates of the contract (C3 §2.6 `CaptureCandidate`; D83 D-DB-15; SEC35-28)', () => {
  const REGISTERED: RegisteredCamera[] = [
    { id: 'CAM-01', address: '192.0.2.31:8080', onvifUuid: null },
    { id: 'CAM-02', address: '192.0.2.32', onvifUuid: 'urn:uuid:known' },
    { id: 'CAM-05', address: null, onvifUuid: null },
  ];

  it('"already registered" is the endpoint reference, else the WHOLE address adoption would store; never a part of one', async () => {
    const r = rig({ registered: REGISTERED });
    await runSearch(
      r,
      MANUAL('S-A'),
      resultOf([
        // By endpoint reference, answering from another address than the stored one.
        answer('192.0.2.99', { endpointRef: 'urn:uuid:known', registered: true, addressChanged: true }),
        // By the whole address: host and the port of its service address.
        answer('192.0.2.31', { serviceAddress: 'http://192.0.2.31:8080/onvif/device_service' }),
        // The same host with another port, and with no port: not the stored address.
        answer('192.0.2.31', { endpointRef: 'urn:uuid:other-port', serviceAddress: 'http://192.0.2.31:9000/onvif/device_service' }),
        answer('192.0.2.31', { endpointRef: 'urn:uuid:no-port', serviceAddress: 'http://192.0.2.31/onvif/device_service' }),
        // A host that is a prefix of a stored one, and a new device.
        answer('192.0.2.3'),
        answer('192.0.2.40'),
      ]),
    );
    const state = r.store.stateOf('S-A', r.now());
    expect(state.candidates.map((candidate) => [candidate.host, candidate.status, candidate.deviceId, candidate.addressChanged])).toEqual([
      ['192.0.2.99', 'REGISTERED', 'CAM-02', true],
      ['192.0.2.31', 'REGISTERED', 'CAM-01', false],
      ['192.0.2.31', 'NEW', null, false],
      ['192.0.2.31', 'NEW', null, false],
      ['192.0.2.3', 'NEW', null, false],
      ['192.0.2.40', 'NEW', null, false],
    ]);
    expect(state.search).toMatchObject({ responderCount: 6, registeredCount: 2, newCount: 4 });
    // The adapter's lookup (registered-first cap, `addressChanged`): by reference with the stored host, by the whole host, else null.
    const { lookup } = registeredIndexOf(REGISTERED);
    expect(lookup({ endpointRef: 'urn:uuid:known', host: '192.0.2.99' })).toEqual({ storedHost: '192.0.2.32', byEndpointRef: true });
    expect(lookup({ endpointRef: 'urn:uuid:x', host: '192.0.2.32' })).toEqual({ storedHost: '192.0.2.32', byEndpointRef: false });
    expect(lookup({ endpointRef: 'urn:uuid:x', host: '192.0.2.3' })).toBeNull();
    expect([adoptionAddressOf('192.0.2.31', 'http://192.0.2.31:8080/x'), adoptionAddressOf('192.0.2.31', 'http://192.0.2.31/x'), adoptionAddressOf('192.0.2.31', null), adoptionAddressOf('192.0.2.31', 'not a url')]).toEqual([
      '192.0.2.31:8080',
      '192.0.2.31',
      '192.0.2.31',
      '192.0.2.31',
    ]);
  });

  it('adapter, class, conflict and testability: PRODUCTION for ONVIF_RTSP, DEVELOPMENT for FAKE; a conflicting answer and one without a service address are listed and never testable', async () => {
    const r = rig();
    await runSearch(
      r,
      MANUAL('S-A'),
      resultOf(
        [
          answer('192.0.2.20'),
          answer('127.0.0.1', { adapterKind: CaptureAdapterKind.FAKE }),
          // A clone: one endpoint reference from two addresses. Both rows are listed, neither replaces the other.
          answer('192.0.2.21', { endpointRef: 'urn:uuid:clone', conflict: true, testable: false }),
          answer('192.0.2.22', { endpointRef: 'urn:uuid:clone', conflict: true, testable: false }),
          answer('192.0.2.23', { serviceAddress: null, testable: false, reason: 'ADDRESS_MISMATCH' }),
          // Defence in depth: an adapter that said "testable" on a conflicting or address-less answer is not believed.
          answer('192.0.2.24', { conflict: true, testable: true }),
          answer('192.0.2.25', { serviceAddress: null, testable: true }),
        ],
        { truncated: true, responderCount: 300 },
      ),
    );
    const state = r.store.stateOf('S-A', r.now());
    expect(state.candidates.map((candidate) => [candidate.host, candidate.adapter, candidate.sourceClass, candidate.conflict, candidate.testable])).toEqual([
      ['192.0.2.20', 'ONVIF_RTSP', 'PRODUCTION', false, true],
      ['127.0.0.1', 'FAKE', 'DEVELOPMENT', false, true],
      ['192.0.2.21', 'ONVIF_RTSP', 'PRODUCTION', true, false],
      ['192.0.2.22', 'ONVIF_RTSP', 'PRODUCTION', true, false],
      ['192.0.2.23', 'ONVIF_RTSP', 'PRODUCTION', false, false],
      ['192.0.2.24', 'ONVIF_RTSP', 'PRODUCTION', true, false],
      ['192.0.2.25', 'ONVIF_RTSP', 'PRODUCTION', false, false],
    ]);
    expect([state.truncated, state.search?.responderCount]).toEqual([true, 300]);
    // The announced texts are carried as the adapter cleaned them; no service address is in the answer.
    expect(state.candidates[0]).toMatchObject({ vendor: 'Vendor', model: 'Model', name: 'Camera', endpointRef: 'urn:uuid:192.0.2.20' });
    expect(JSON.stringify(state)).not.toContain('device_service');
  });
});
