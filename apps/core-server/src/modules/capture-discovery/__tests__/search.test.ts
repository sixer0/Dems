// Blueprint row 132: the search runner on a scripted adapter and a clock that is a number
// (checks M4-DISC-TRIG-1, M4-DISC-REC-1 (a) and the decision of (b), M4-SEC-RATE-1 "0 datagrams",
// M4-AUD-1 for CAPTURE_DISCOVERY_SEARCHED, M4-SEC-DISC-2 "shape"; C3 §2.6, §5.2; D83, D86 C-4).
// The count of `discover` calls stands for "datagrams": the adapter sends none unless it is called.
import { CAPTURE_DISCOVERY_WINDOW_MS, CaptureDiscoveryReason, captureDiscoverySearchedDetails } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { CaptureAdapterKind, DiscoveryNotRunError, connectionTargetOf, type OnvifCandidate, type OnvifDiscoveryAdapter, type RegisteredLookup, type WsDiscoveryResult } from '../../../capture/adapters';
import type { AuditEntry } from '../../../core';
import { SERVER_AUDIT_DETAIL_RULES } from '../../../core';
import { adoptionAddressOf, createCandidateStore, createSearchLimiter, createSearchRunner, registeredIndexOf, type RegisteredCamera, type SearchClosed, type SearchRequest } from '../index';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SessionState } from '@dems/shared/domain';
import { isSessionActive, type ActiveSession } from '@dems/shared/sim';
import { READ_CAPTURE_STATE } from '../../capture-config/store';
import { addressNotAllowed } from '../routes';
import { openSessionOf, type TypedDestination } from '../search';
import { typedAddressControl } from '../typed-address';

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
  // Task 4 row 96: `unicast` is what the search handed the adapter for a typed address (undefined: the member was absent).
  const calls: Array<{ windowMs: number; lookup: RegisteredLookup; settle: (outcome: WsDiscoveryResult | Error) => void; signal: AbortSignal; unicast: unknown; members: string[] }> = [];
  const audits: AuditEntry[] = [];
  const logs: Array<{ level: string; fields: Record<string, unknown>; message: string }> = [];
  const persisted: Array<Record<string, unknown>> = [];
  const closed: SearchClosed[] = [];
  let registryReads = 0;
  const store = createCandidateStore({ randomBytes: (() => { let next = 0; return (size: number) => Uint8Array.from({ length: size }, (_u, index) => (index === size - 1 ? ++next : 7)); })() });
  const adapterOf = (lookup: RegisteredLookup): OnvifDiscoveryAdapter =>
    ({
      discover: (search: { windowMs: number; signal: AbortSignal; unicast?: unknown }) =>
        new Promise<WsDiscoveryResult>((resolve, reject) => {
          calls.push({ windowMs: search.windowMs, lookup, signal: search.signal, unicast: search.unicast, members: Object.keys(search).sort(), settle: (outcome) => (outcome instanceof Error ? reject(outcome) : resolve(outcome)) });
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
    // The announced texts are carried as the adapter cleaned them.
    expect(state.candidates[0]).toMatchObject({ vendor: 'Vendor', model: 'Model', name: 'Camera', endpointRef: 'urn:uuid:192.0.2.20' });
    // Fix F-M4 (finding R69-12; decision D178): until then this case pinned "no service address is in
    // the answer". The operator confirms the FULL target the Core will connect to, so a testable
    // candidate now carries it - scheme, host, port, path, as the test uses them - and a candidate
    // that is not testable carries none.
    expect(state.candidates.map((candidate) => candidate.connectionTarget ?? null)).toEqual([
      connectionTargetOf(answer('192.0.2.20')),
      connectionTargetOf(answer('127.0.0.1', { adapterKind: CaptureAdapterKind.FAKE })),
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(state.candidates[0]?.connectionTarget).toMatch(/^http:\/\/192\.0\.2\.20:\d+\//);
    for (const candidate of state.candidates) expect('connectionTarget' in candidate).toBe(candidate.testable);
  });
});

describe('G70c-04 and G70c-05: one rule for "a session is open" (wave L, driver L-S)', () => {
  // Fix wave L, driver L-S - re-check 70 notes G70c-04 and G70c-05: ONE RULE for "a session is open".
  //
  // | Rule | Test |
  // |------|------|
  // | G70c-05: a SEALED session is not the session of a camera search - no session, no `sessionId` on the row; every other state names it | 1, 2 |
  // | The rule is the session machine's (`isSessionActive`), state for state | 1 |
  // | The module hands the engine's session through that rule and no other | 3 |
  // | G70c-04: the boot statement of the capture configuration reads "a session that is not SEALED", not "a session row exists" | 4 |

  const SESSION = 'SES-20261011-0037';

  describe('G70c-05: the session a camera search ran in', () => {
    it('1. null for no session and for a SEALED one; the session for every other state - exactly `isSessionActive`', () => {
      expect(openSessionOf(null)).toBeNull();
      for (const state of Object.values(SessionState)) {
        const open = openSessionOf({ id: SESSION, state });
        expect(open === null).toBe(!isSessionActive({ id: SESSION, state } as unknown as ActiveSession));
        if (state === SessionState.SEALED) expect(open).toBeNull();
        else expect(open).toEqual({ id: SESSION, state });
      }
      // CONTROL (the finding): the session of before - "there is a session in the state" - named the sealed one.
      const before = (session: { id: string; state: string } | null) => (session === null ? null : { id: session.id, state: session.state });
      expect(before({ id: SESSION, state: SessionState.SEALED })?.id).toBe(SESSION);
    });

    it('2. the row of a search while the last session is SEALED carries no `sessionId`; while one RECORDS it carries it', () => {
      const details = (open: { id: string } | null) =>
        captureDiscoverySearchedDetails({ searchId: 'DSC-000007', scope: 'CAMERA_NETWORK', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 1, newCount: 0, registeredCount: 1, interfaceCount: 1, failureReason: null, sessionId: open?.id ?? null, operationId: 'startCaptureDiscovery', permission: 'CAPTURE_CONFIG' });
      expect('sessionId' in details(openSessionOf({ id: SESSION, state: SessionState.SEALED }))).toBe(false);
      expect(details(openSessionOf({ id: SESSION, state: SessionState.RECORDING }))).toMatchObject({ sessionId: SESSION });
    });

    it('3. the module reads the engine\'s session through `openSessionOf`, at one place', () => {
      const source = readFileSync(fileURLToPath(new URL('../index.ts', import.meta.url)), 'utf8');
      expect(source.match(/openSessionOf\(app\.engine\.state\(\)\.session\)/g)).toHaveLength(1);
      expect(source).not.toMatch(/session === null \? null : \{ id: session\.id/);
    });
  });

  describe('G70c-04: the boot line `CAPTURE_CONFIG_LOADED ... locked`', () => {
    it('4. the load statement calls a session open while it is NOT SEALED - the rule of operation 76 - and no longer "a row exists"', () => {
      expect(READ_CAPTURE_STATE).toContain("EXISTS (SELECT 1 FROM public.active_session s WHERE s.state <> 'SEALED') AS session_open");
      expect(READ_CAPTURE_STATE).not.toContain('EXISTS (SELECT 1 FROM public.active_session) AS session_open');
      expect(SessionState.SEALED).toBe('SEALED');
    });
  });
});

// Task 4 blueprint row 96 (WP-12; contract of row 94; amended ruling AM-3): the typed address at the
// search runner and at the module's rule holder. The destination below stands for the destination
// rule's answer; the runner must hand it on as it came and read nothing of it.
describe('task 4 row 96: the typed address of a MANUAL search', () => {
  const RULED: TypedDestination = Object.freeze({ address: '192.168.50.20', port: 80, sourceAddress: '192.168.50.1', viaAlias: false });
  const TYPED = (sessionId: string): SearchRequest => ({ ...MANUAL(sessionId), typed: RULED });

  it('the search that is started hands the rule\'s answer to the adapter, the SAME object; the row and the log line hold no address', async () => {
    const r = rig();
    await runSearch(r, TYPED('S-A'), resultOf([answer('192.168.50.20')], { counts: { ...resultOf([]).counts, typedProbesSent: 1 } }));
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]?.unicast).toBe(RULED);
    expect(r.calls[0]?.members).toEqual(['signal', 'unicast', 'windowMs']);
    expect(r.audits).toHaveLength(1);
    const written = JSON.stringify([r.audits, r.logs, r.persisted, r.closed]);
    expect(written.includes('192.168.50')).toBe(false);
    // The adapter's count of the typed probe is in the log line, as a number.
    expect(r.logs.find((line) => line.message === 'camera search closed')?.fields['counts']).toMatchObject({ typedProbesSent: 1 });
  });

  it('the search without a typed address shows 0 changed results: the adapter is asked with the two members it always was', async () => {
    const r = rig();
    const plain = await runSearch(r, MANUAL('S-A'), resultOf([answer('192.168.50.20')]));
    expect(r.calls[0]?.members).toEqual(['signal', 'windowMs']);
    expect(r.calls[0]?.unicast).toBeUndefined();
    const typedRig = rig();
    const typed = await runSearch(typedRig, TYPED('S-A'), resultOf([answer('192.168.50.20')]));
    // The answer of the start, the stored list and the audit row are the same with and without the member.
    expect(typed.started && plain.started ? [typed.search, typed.created] : null).toEqual(plain.started ? [plain.search, plain.created] : undefined);
    expect(typedRig.store.stateOf('S-A', typedRig.now())).toEqual(r.store.stateOf('S-A', r.now()));
    expect(typedRig.audits).toEqual(r.audits);
  });

  it('no probe while the caller\'s own search runs: the answer is that search, and the typed address of the second request reaches no adapter', async () => {
    const r = rig();
    const first = await r.runner.start(MANUAL('S-A'));
    await r.settle();
    const again = await r.runner.start(TYPED('S-A'));
    expect(again).toMatchObject({ started: true, created: false, search: { searchId: 'DSC-000001', created: false } });
    // Another session's typed search while that one runs: refused, nothing sent.
    expect(await r.runner.start(TYPED('S-B'))).toEqual({ started: false, refusal: { kind: 'IN_PROGRESS', reason: 'DISCOVERY_IN_PROGRESS' } });
    await r.settle();
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]?.unicast).toBeUndefined();
    r.calls[0]?.settle(resultOf([]));
    if (first.started) await first.closed;
    // A typed address that was not probed took no place in the typed spacing: the next typed search of another session starts.
    r.advance(5_000);
    const next = await r.runner.start(TYPED('S-B'));
    expect(next.started).toBe(true);
    await r.settle();
    expect(r.calls[1]?.unicast).toBe(RULED);
  });

  it('the spacing of a typed probe is per Core: a second one of ANOTHER session sooner than 10 s is refused with the wait and sends nothing; a search without the member still starts', async () => {
    const r = rig();
    await runSearch(r, TYPED('S-A'), resultOf([]));
    // 5 s after the first typed search started: the Core's own 5 s between searches are over, the typed 10 s are not.
    r.advance(2_000);
    expect(await r.runner.start(TYPED('S-B'))).toEqual({ started: false, refusal: { kind: 'RATE_LIMITED', reason: 'DISCOVERY_RATE_LIMITED', bound: 'CORE_SPACING', retryAfterMs: 5_000 } });
    await r.settle();
    expect([r.calls.length, r.audits.length, r.runner.started()]).toEqual([1, 1, 1]);
    // The refusal took no place anywhere: the same session searches without the member at once.
    await runSearch(r, MANUAL('S-B'), resultOf([]));
    expect(r.calls[1]?.unicast).toBeUndefined();
    // 10 s after the first typed search a third session's typed search starts.
    r.advance(2_000);
    const later = await r.runner.start(TYPED('S-C'));
    expect(later.started).toBe(true);
    await r.settle();
    expect(r.calls[2]?.unicast).toBe(RULED);
  });

  it('a clock that went back never reads as "long ago" (the bounds of the limiter stand in front and refuse it); the pre-check\'s search never carries a typed address', async () => {
    const r = rig();
    await runSearch(r, TYPED('S-A'), resultOf([]));
    r.advance(-60_000);
    expect(await r.runner.start(TYPED('S-B'))).toMatchObject({ started: false, refusal: { kind: 'RATE_LIMITED', reason: 'DISCOVERY_RATE_LIMITED' } });
    expect(r.calls).toHaveLength(1);
    r.advance(60_000 + 10_000);
    await runSearch(r, { ...PRECHECK('S-P'), typed: RULED }, resultOf([]));
    expect(r.calls.at(-1)?.unicast).toBeUndefined();
    expect(r.calls.at(-1)?.members).toEqual(['signal', 'windowMs']);
  });

  it('the module\'s rule holder: with no rule every address is refused; a rule\'s answer is returned as it came; a rule that throws or answers nonsense is a refusal; a second rule is not taken', () => {
    const control = typedAddressControl({ stages: {} });
    expect(control.ruled()).toBe(false);
    for (const address of ['192.168.50.20', '10.0.0.5', '127.0.0.1']) expect(control.decide(address)).toEqual({ allowed: false, refusal: 'NOT_CONFIGURED' });
    const asked: string[] = [];
    control.provideRule((address) => {
      asked.push(address);
      if (address === '192.168.50.20') return { allowed: true, destination: RULED };
      if (address === '192.168.50.66') throw new Error('rule');
      if (address === '192.168.50.67') return null as never;
      if (address === '192.168.50.68') return { allowed: false, refusal: 'not a code word; 192.168.50.68' };
      if (address === '192.168.50.69') return { allowed: true, destination: null as never };
      return { allowed: false, refusal: 'OUTSIDE_CAMERA_SUBNET' };
    });
    expect(control.ruled()).toBe(true);
    const allowed = control.decide('192.168.50.20');
    expect(allowed.allowed && allowed.destination).toBe(RULED);
    expect(control.decide('10.0.0.5')).toEqual({ allowed: false, refusal: 'OUTSIDE_CAMERA_SUBNET' });
    for (const address of ['192.168.50.66', '192.168.50.67', '192.168.50.68', '192.168.50.69']) expect(control.decide(address)).toEqual({ allowed: false, refusal: 'RULE_FAILED' });
    expect(asked).toHaveLength(6);
    expect(() => control.provideRule(() => ({ allowed: true, destination: RULED }))).toThrow('handed in already');
    // One holder per app: the same object from every scope of it.
    const app = { stages: {} };
    expect(typedAddressControl(app)).toBe(typedAddressControl(app));
  });

  it('the one answer of a refused address: 422 INVALID_INPUT with the contract\'s reason, the same whatever the rule refused, and no address in it', () => {
    const failure = addressNotAllowed();
    expect(failure).toMatchObject({ statusCode: 422, code: 'INVALID_INPUT' });
    expect(JSON.stringify([failure.message, failure.details])).toBe(JSON.stringify(['A camera search cannot use this address.', { in: 'body', reason: CaptureDiscoveryReason.DISCOVERY_ADDRESS_NOT_ALLOWED }]));
  });
});
