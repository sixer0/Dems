// Task 3 R-9..R-11, blueprint row 132 (decision D106): what the in-app simulator answers for
// operations 93-97 (masterplan/03_api_contract.md §2.6 "Simulator"), and its REST facade of
// operations 78-80 and 89 after the alignment with the hosted action `setCaptureConfig`
// (decision D106 (3)).
//
// The simulator opens no socket and waits on no timer, so every value below is fixed: the parity
// tests of the clients compare them.
import { describe, expect, it } from 'vitest';
import {
  CaptureAudioCardSearchSchema,
  CaptureInputScanSchema,
  CAPTURE_CONNECTION_TEST_VALIDITY_MS,
  CAPTURE_DISCOVERY_RESULT_TTL_MS,
  CaptureConnectionOutcome,
  SIM_ADOPTED_DEVICE_ID,
  SIM_CAPTURE_AUDIO_CARD_IDS,
  SIM_CAPTURE_CANDIDATE_IDS,
  SIM_TYPED_ADDRESS_CANDIDATE_ID,
  SIM_TYPED_ADDRESS_EXAMPLE,
  simCaptureAudioCards,
  simCaptureCandidates,
  validateCoreApiResponse,
  type CaptureAudioCardSearch,
  type CaptureCandidateAdoption,
  type CaptureConnectionTest,
  type CaptureDiscoverySearch,
  type CaptureDiscoveryStateBody,
  type CaptureInputScan,
  CAPTURE_ENDPOINT_REF_PATTERN,
  captureCandidateAdoptedDetails,
  captureConnectionTestedDetails,
} from '../src/api';
import {
  DEMO_OPERATOR_PASSWORD,
  READDRESS_CAPTURE_DEVICE_ACTION,
  REGISTERED_MICROPHONE_MODEL_PATTERN,
  createManualClock,
  createSim,
  nextCaptureCameraId,
  nextCaptureMicrophoneId,
  readdressCaptureDeviceTransition,
  registerCaptureMicrophoneTransition,
  setSimConnectionTestOutcome,
  type AuditRow,
} from '../src/sim';
import { CAPTURE_AUDIO_CARD_TEXT_PATTERN, SIM_ACTION_OPERATIONS, SimActionExecution } from '../src/api';
import { LIVE_BINDINGS, LiveActionFlow } from '../src/live/source/bindings';

const AT = Date.UTC(2026, 9, 1, 3, 0, 0);
const DISCOVERY = '/api/v1/capture/discovery';
const RESCAN = '/api/v1/capture/inputs/rescan';
const AUDIO_CARDS = '/api/v1/capture/audio-cards/search';
const AUDIO_INPUTS = '/api/v1/capture/audio-cards/inputs';
const FRESH = `${DISCOVERY}/candidates/${SIM_CAPTURE_CANDIDATE_IDS.fresh}`;
const REGISTERED = `${DISCOVERY}/candidates/${SIM_CAPTURE_CANDIDATE_IDS.registered}`;
const CANARY_USER = 'canary-user-7f3a';
const CANARY_SECRET = 'canary-secret-9c1e';

function harness(options: { deviceConsole?: boolean } = {}) {
  const clock = createManualClock(AT);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario: 'idle', scheduler: () => () => {}, ...options });
  const call = <Body>(method: 'GET' | 'POST', path: string, body?: unknown): { status: number; body: Body } => {
    const response = sim.request({ method, path, body });
    return { status: response.status, body: response.body as Body };
  };
  const rows = (type: string): AuditRow[] => sim.store.getState().audit.rows.filter((row) => row.type === type);
  return { sim, clock, call, rows, state: () => sim.store.getState() };
}

const signIn = (h: ReturnType<typeof harness>, username: string): void => {
  expect(h.sim.actions.signIn(username, DEMO_OPERATOR_PASSWORD).ok).toBe(true);
};
const reasonOf = (body: unknown): string | undefined => (body as { error?: { details?: { reason?: string } } }).error?.details?.reason;
const codeOf = (body: unknown): string | undefined => (body as { error?: { code?: string } }).error?.code;

describe('operations 93 and 94: the search and its candidates', () => {
  it('before the first search the read answers `search: null`; the search answers 202, already COMPLETE, with two fixed candidates', () => {
    const h = harness();
    signIn(h, 'rina.wijaya');
    expect(h.call('GET', DISCOVERY)).toEqual({ status: 200, body: { search: null, candidates: [], truncated: false } });

    const started = h.call<CaptureDiscoverySearch>('POST', DISCOVERY);
    expect(started).toEqual({
      status: 202,
      body: {
        searchId: 'DSC-000001',
        scope: 'CAMERA_NETWORK',
        trigger: 'MANUAL',
        state: 'COMPLETE',
        startedAt: AT,
        windowMs: 0,
        completesAt: AT,
        expiresAt: AT + CAPTURE_DISCOVERY_RESULT_TTL_MS,
        responderCount: 2,
        newCount: 1,
        registeredCount: 1,
        interfaceCount: 0,
        failureReason: null,
        created: true,
      },
    });

    const read = h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY);
    expect(read.status).toBe(200);
    expect(read.body.search).toEqual({ ...started.body, created: false });
    expect(read.body.truncated).toBe(false);
    expect(read.body.candidates.map((candidate) => [candidate.candidateId, candidate.status, candidate.deviceId, candidate.adapter, candidate.sourceClass, candidate.host])).toEqual([
      ['CND-000000000001', 'NEW', null, 'FAKE', 'DEVELOPMENT', '127.0.0.1'],
      ['CND-000000000002', 'REGISTERED', 'CAM-01', 'FAKE', 'DEVELOPMENT', '127.0.0.1'],
    ]);
    expect(read.body.candidates[0]).toMatchObject({ testable: true, conflict: false, addressChanged: false, lastTest: null, adoptable: false });
    expect(validateCoreApiResponse('getCaptureDiscovery', 200, read.body)).toEqual({ ok: true });
  });

  it('writes one CAPTURE_DISCOVERY_SEARCHED row per search with exactly the keys of C3 §5.2: counts and codes, no address, no device text', () => {
    const h = harness();
    signIn(h, 'rina.wijaya');
    h.call('POST', DISCOVERY);
    expect(h.rows('CAPTURE_DISCOVERY_SEARCHED').map((row) => [row.actorId, row.details])).toEqual([
      [
        'OPR-003',
        {
          searchId: 'DSC-000001',
          scope: 'CAMERA_NETWORK',
          trigger: 'MANUAL',
          outcome: 'COMPLETE',
          responderCount: 2,
          newCount: 1,
          registeredCount: 1,
          interfaceCount: 0,
          operationId: 'startCaptureDiscovery',
          permission: 'CAPTURE_CONFIG',
        },
      ],
    ]);
    // The read writes nothing; a second search is a new search with a new id and a second row.
    h.call('GET', DISCOVERY);
    expect(h.rows('CAPTURE_DISCOVERY_SEARCHED')).toHaveLength(1);
    expect(h.call<CaptureDiscoverySearch>('POST', DISCOVERY).body.searchId).toBe('DSC-000002');
    expect(h.rows('CAPTURE_DISCOVERY_SEARCHED')).toHaveLength(2);
    expect(JSON.stringify(h.rows('CAPTURE_DISCOVERY_SEARCHED'))).not.toMatch(/127\.0\.0\.1|Test camera|urn:uuid/);
    // A search raises no alert in the simulator (the list is not empty) and registers nothing.
    expect(h.state().captureDevices.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH']);
    expect(h.state().alerts.filter((alert) => alert.target === 'CAPTURE_DISCOVERY')).toEqual([]);
  });

  it('M4-DISC-LIFE-1 (simulator): the list belongs to the session that searched and is gone at its end, at `expiresAt` and after a demo reset', () => {
    const h = harness();
    signIn(h, 'rina.wijaya');
    h.call('POST', DISCOVERY);
    expect(h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY).body.candidates).toHaveLength(2);

    // Another operator session: its own, empty state; the first session's candidate id is one 404.
    h.sim.actions.signOut();
    signIn(h, 'andi.pratama');
    expect(h.call('GET', DISCOVERY).body).toEqual({ search: null, candidates: [], truncated: false });
    expect(h.call('POST', `${FRESH}/test`, {}).status).toBe(404);
    // The same operator signing in again is a new session too: the old list did not survive the sign-out.
    h.sim.actions.signOut();
    signIn(h, 'rina.wijaya');
    expect(h.call('GET', DISCOVERY).body).toEqual({ search: null, candidates: [], truncated: false });

    // The life of the result.
    h.call('POST', DISCOVERY);
    h.clock.advance(CAPTURE_DISCOVERY_RESULT_TTL_MS - 1);
    expect(h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY).body.search?.searchId).toBe('DSC-000002');
    h.clock.advance(1);
    expect(h.call('GET', DISCOVERY).body).toEqual({ search: null, candidates: [], truncated: false });
    expect(h.call('POST', `${FRESH}/test`, {}).status).toBe(404);

    // A demo reset replaces the dataset: the search is gone with it.
    signIn(h, 'andi.pratama');
    h.call('POST', DISCOVERY);
    h.sim.actions.resetDemo();
    expect(h.call('GET', DISCOVERY).body).toEqual({ search: null, candidates: [], truncated: false });
  });

  it('a search is allowed while a session is open; candidates never appear in operation 77', () => {
    const h = harness();
    signIn(h, 'andi.pratama');
    h.sim.actions.loadScenario('recording');
    expect(h.state().session?.state).toBe('RECORDING');
    expect(h.call('POST', DISCOVERY).status).toBe(202);
    expect(h.rows('CAPTURE_DISCOVERY_SEARCHED').at(-1)?.details).toMatchObject({ sessionId: h.state().session?.id });
    const devices = h.call<{ devices: { id: string }[] }>('GET', '/api/v1/capture/devices').body.devices.map((device) => device.id);
    expect(devices.filter((id) => id.startsWith('CND-'))).toEqual([]);
    // The connect steps are locked while the session is open: 409, no audit row.
    const before = h.state().audit.rows.length;
    expect(codeOf(h.call('POST', `${FRESH}/test`, {}).body)).toBe('CAPTURE_CONFIG_LOCKED');
    expect(codeOf(h.call('POST', `${FRESH}/adopt`, {}).body)).toBe('CAPTURE_CONFIG_LOCKED');
    expect(h.state().audit.rows).toHaveLength(before);
  });

  // ── Task 4 row 94 (WP-12; AM-3): the optional typed address ──────────────────────────────────

  it('row 94: a search without the member answers exactly as before - no body, `{}` and a body without `address` give the same search, list and audit row', () => {
    const answers = [undefined, {}, '{}'].map((body) => {
      const h = harness();
      signIn(h, 'rina.wijaya');
      const started = h.call<CaptureDiscoverySearch>('POST', DISCOVERY, body);
      return { started, list: h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY).body, rows: h.rows('CAPTURE_DISCOVERY_SEARCHED').map((row) => row.details), devices: h.state().captureDevices };
    });
    // The values of the first case of this block, which this row did not touch: two responders, one new.
    expect(answers[0]?.started.status).toBe(202);
    expect(answers[0]?.started.body).toMatchObject({ searchId: 'DSC-000001', responderCount: 2, newCount: 1, registeredCount: 1, state: 'COMPLETE' });
    expect(answers[0]?.list.candidates.map((candidate) => candidate.candidateId)).toEqual(['CND-000000000001', 'CND-000000000002']);
    for (const answer of answers.slice(1)) expect(answer).toEqual(answers[0]);
  });

  it('row 94: with a typed address the simulator adds ONE synthetic candidate whose host is that address; it probes nothing, and the audit row holds counts only', () => {
    const h = harness();
    signIn(h, 'rina.wijaya');
    const started = h.call<CaptureDiscoverySearch>('POST', DISCOVERY, { address: SIM_TYPED_ADDRESS_EXAMPLE });
    expect(started.status).toBe(202);
    expect(started.body).toMatchObject({ searchId: 'DSC-000001', state: 'COMPLETE', windowMs: 0, interfaceCount: 0, responderCount: 3, newCount: 2, registeredCount: 1, created: true });
    expect(validateCoreApiResponse('startCaptureDiscovery', 202, started.body)).toEqual({ ok: true });

    const read = h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY);
    expect(validateCoreApiResponse('getCaptureDiscovery', 200, read.body)).toEqual({ ok: true });
    // The two fixed candidates are what they were; the third is last and says what it is.
    expect(read.body.candidates.slice(0, 2)).toEqual(simCaptureCandidates());
    expect(read.body.candidates.map((candidate) => [candidate.candidateId, candidate.status, candidate.deviceId, candidate.adapter, candidate.sourceClass, candidate.host, candidate.vendor, candidate.name])).toEqual([
      ['CND-000000000001', 'NEW', null, 'FAKE', 'DEVELOPMENT', '127.0.0.1', 'DEMS', 'Test camera 3'],
      ['CND-000000000002', 'REGISTERED', 'CAM-01', 'FAKE', 'DEVELOPMENT', '127.0.0.1', 'DEMS', 'Test camera 1'],
      [SIM_TYPED_ADDRESS_CANDIDATE_ID, 'NEW', null, 'FAKE', 'DEVELOPMENT', SIM_TYPED_ADDRESS_EXAMPLE, 'DEMS', 'Test camera at the typed address'],
    ]);

    // One row, the same ten keys, counts and codes: the typed address is in no audit row, and nothing was registered.
    const rows = h.rows('CAPTURE_DISCOVERY_SEARCHED');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.details).toEqual({
      searchId: 'DSC-000001',
      scope: 'CAMERA_NETWORK',
      trigger: 'MANUAL',
      outcome: 'COMPLETE',
      responderCount: 3,
      newCount: 2,
      registeredCount: 1,
      interfaceCount: 0,
      operationId: 'startCaptureDiscovery',
      permission: 'CAPTURE_CONFIG',
    });
    expect(JSON.stringify(h.state().audit.rows)).not.toContain(SIM_TYPED_ADDRESS_EXAMPLE);
    expect(h.state().captureDevices.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH']);

    // The next search without the member is the old search again: the synthetic candidate is gone.
    const plain = h.call<CaptureDiscoverySearch>('POST', DISCOVERY);
    expect(plain.body).toMatchObject({ searchId: 'DSC-000002', responderCount: 2, newCount: 1 });
    expect(h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY).body.candidates).toEqual(simCaptureCandidates());
  });

  it('row 94: a candidate like any other - it is tested and adopted by the unchanged operations 95 and 96, and a later search for its address reads REGISTERED', () => {
    const h = harness();
    signIn(h, 'rina.wijaya');
    const address = '10.20.30.40';
    h.call('POST', DISCOVERY, { address });
    const typed = `${DISCOVERY}/candidates/${SIM_TYPED_ADDRESS_CANDIDATE_ID}`;
    expect(h.call<CaptureConnectionTest>('POST', `${typed}/test`, {}).body).toMatchObject({ candidateId: SIM_TYPED_ADDRESS_CANDIDATE_ID, outcome: 'REACHABLE' });
    const adopted = h.call<CaptureCandidateAdoption>('POST', `${typed}/adopt`, {});
    expect([adopted.status, adopted.body.deviceId, adopted.body.device.host, adopted.body.device.adapter]).toEqual([201, 'CAM-03', address, 'FAKE']);

    const again = h.call<CaptureDiscoverySearch>('POST', DISCOVERY, { address });
    expect(again.body).toMatchObject({ responderCount: 3, newCount: 1, registeredCount: 2 });
    expect(h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY).body.candidates.at(-1)).toMatchObject({ candidateId: SIM_TYPED_ADDRESS_CANDIDATE_ID, status: 'REGISTERED', deviceId: 'CAM-03', host: address });
    // Another address is another, new candidate: no address is followed or re-pointed by a search.
    h.call('POST', DISCOVERY, { address: '10.20.30.41' });
    expect(h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY).body.candidates.at(-1)).toMatchObject({ status: 'NEW', deviceId: null, host: '10.20.30.41' });
    expect(h.state().captureDevices.devices.find((device) => device.id === 'CAM-03')?.host).toBe(address);
  });

  it('row 94: the refusals - outside the form 422, a form the stand-in rule refuses 422 DISCOVERY_ADDRESS_NOT_ALLOWED; each quotes nothing, starts no search and writes no row', () => {
    const h = harness();
    signIn(h, 'rina.wijaya');
    const before = h.state().audit.rows.length;
    const outsideTheForm: unknown[] = ['camera-1.local', 'localhost', '192.168.050.101', '192.168.50.256', '192.168.50.101:80', '192.168.50.101/24', 'http://192.168.50.101/', '::ffff:192.168.50.101', ' 192.168.50.101', '', 3_232_248_421, null, ['192.168.50.101']];
    for (const address of outsideTheForm) {
      const refused = h.call('POST', DISCOVERY, { address });
      expect([refused.status, codeOf(refused.body), reasonOf(refused.body)], JSON.stringify(address)).toEqual([422, 'INVALID_INPUT', undefined]);
      expect(validateCoreApiResponse('startCaptureDiscovery', 422, refused.body)).toEqual({ ok: true });
      if (typeof address === 'string' && address.trim() !== '') expect(JSON.stringify(refused.body)).not.toContain(address.trim());
    }
    // A member the contract does not have is refused as before: a strict object.
    for (const stray of [{ host: '192.168.10.20' }, { address: SIM_TYPED_ADDRESS_EXAMPLE, port: 3702 }, { subnet: '192.168.10.0/24' }, { timeout: 1 }]) {
      expect(h.call('POST', DISCOVERY, stray).status, JSON.stringify(stray)).toBe(422);
    }
    for (const address of ['127.0.0.1', '8.8.8.8', '224.0.0.1', '169.254.1.1', '255.255.255.255', '0.0.0.0', '192.168.10.0', '192.168.10.255', '172.32.0.1']) {
      const refused = h.call('POST', DISCOVERY, { address });
      expect([refused.status, codeOf(refused.body), reasonOf(refused.body)], address).toEqual([422, 'INVALID_INPUT', 'DISCOVERY_ADDRESS_NOT_ALLOWED']);
      expect(validateCoreApiResponse('startCaptureDiscovery', 422, refused.body)).toEqual({ ok: true });
      expect(JSON.stringify(refused.body)).not.toContain(address);
    }
    // Nothing happened: no search, no id spent, no row.
    expect(h.call('GET', DISCOVERY).body).toEqual({ search: null, candidates: [], truncated: false });
    expect(h.state().audit.rows).toHaveLength(before);
    expect(h.call<CaptureDiscoverySearch>('POST', DISCOVERY).body.searchId).toBe('DSC-000001');
  });

  it('row 94 (decision C10): the typed address is web console only - a tablet or phone session is refused 403 WEB_CONSOLE_ONLY for it and still searches without it; a role without CAPTURE_CONFIG is refused for the role first', () => {
    const tablet = harness({ deviceConsole: true });
    signIn(tablet, 'rina.wijaya');
    const before = tablet.state().audit.rows.length;
    // Whatever the value is: the presence of the member decides, before its value is read.
    for (const address of [SIM_TYPED_ADDRESS_EXAMPLE, '127.0.0.1', 'camera-1.local', 7]) {
      const refused = tablet.call('POST', DISCOVERY, { address });
      expect([refused.status, codeOf(refused.body), reasonOf(refused.body)], String(address)).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
      expect(validateCoreApiResponse('startCaptureDiscovery', 403, refused.body)).toEqual({ ok: true });
      expect(JSON.stringify(refused.body)).not.toContain(String(address));
    }
    expect(tablet.call('GET', DISCOVERY).body).toEqual({ search: null, candidates: [], truncated: false });
    expect(tablet.state().audit.rows).toHaveLength(before);
    // The search itself stays open to the device console.
    expect(tablet.call<CaptureDiscoverySearch>('POST', DISCOVERY).body).toMatchObject({ searchId: 'DSC-000001', responderCount: 2 });
    expect(tablet.call<CaptureDiscoverySearch>('POST', DISCOVERY, {}).status).toBe(202);

    const investigator = harness();
    signIn(investigator, 'budi.santoso');
    const denied = investigator.call('POST', DISCOVERY, { address: SIM_TYPED_ADDRESS_EXAMPLE });
    expect([denied.status, codeOf(denied.body), reasonOf(denied.body)]).toEqual([403, 'NOT_PERMITTED', undefined]);
  });
});

describe('operations 95 and 96: the connection test and the adoption', () => {
  function searched() {
    const h = harness();
    signIn(h, 'rina.wijaya');
    h.call('POST', DISCOVERY);
    return h;
  }

  it('the new candidate answers REACHABLE; `authenticated` says whether a credential was sent, and nothing of the pair is kept', () => {
    const h = searched();
    const plain = h.call<CaptureConnectionTest>('POST', `${FRESH}/test`, {});
    expect(plain).toEqual({
      status: 200,
      body: { candidateId: 'CND-000000000001', outcome: 'REACHABLE', authenticated: false, testedAt: AT, usableProfileCount: 1, failedAttemptsRemaining: 2 },
    });
    const withPair = h.call<CaptureConnectionTest>('POST', `${FRESH}/test`, { credential: { username: CANARY_USER, secret: CANARY_SECRET } });
    expect(withPair.body).toMatchObject({ outcome: 'REACHABLE', authenticated: true });

    expect(h.rows('CAPTURE_CONNECTION_TESTED').map((row) => row.details)).toEqual([
      { candidateId: 'CND-000000000001', searchId: 'DSC-000001', outcome: 'REACHABLE', authenticated: false, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', operationId: 'testCaptureCandidateConnection', permission: 'CAPTURE_CONFIG' },
      { candidateId: 'CND-000000000001', searchId: 'DSC-000001', outcome: 'REACHABLE', authenticated: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', operationId: 'testCaptureCandidateConnection', permission: 'CAPTURE_CONFIG' },
    ]);
    // The candidate shows its last test; the canaries are in no answer, no state and no audit row.
    const candidate = h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY).body.candidates[0];
    expect(candidate).toMatchObject({ lastTest: { outcome: 'REACHABLE', authenticated: true, testedAt: AT }, adoptable: true });
    const everything = JSON.stringify([plain, withPair, candidate, h.state()]);
    expect(everything).not.toContain(CANARY_USER);
    expect(everything).not.toContain(CANARY_SECRET);
  });

  it('the refusals: an unknown id 404, the registered candidate 409 with its device, a body outside the schema 422', () => {
    const h = searched();
    const before = h.state().audit.rows.length;
    expect(h.call('POST', `${DISCOVERY}/candidates/CND-00000000BEEF/test`, {}).status).toBe(404);
    expect(h.call('POST', `${DISCOVERY}/candidates/192.0.2.10/test`, {}).status).toBe(404);
    const registered = h.call('POST', `${REGISTERED}/test`, {});
    expect([registered.status, codeOf(registered.body), reasonOf(registered.body)]).toEqual([409, 'INVALID_STATE', 'CANDIDATE_ALREADY_REGISTERED']);
    expect((registered.body as { error: { details: { deviceId: string } } }).error.details.deviceId).toBe('CAM-01');
    for (const body of [{ host: '192.0.2.10' }, { credential: { username: CANARY_USER } }, { credential: { username: 'adm<in', secret: CANARY_SECRET } }]) {
      const refused = h.call('POST', `${FRESH}/test`, body);
      expect([refused.status, codeOf(refused.body)], JSON.stringify(Object.keys(body))).toEqual([422, 'INVALID_INPUT']);
      // E-30: the refusal names where, never what.
      expect(JSON.stringify(refused.body)).not.toMatch(/canary|192\.0\.2\.10|adm</);
    }
    // None of these is an accepted attempt: no audit row.
    expect(h.state().audit.rows).toHaveLength(before);
  });

  it('the fixture: every outcome of C3 §2.6 can be shown, and only REACHABLE makes the candidate adoptable', () => {
    const h = searched();
    for (const outcome of Object.values(CaptureConnectionOutcome)) {
      setSimConnectionTestOutcome(h.sim.store, outcome);
      const tested = h.call<CaptureConnectionTest>('POST', `${FRESH}/test`, {});
      expect(tested.body).toMatchObject({ outcome, usableProfileCount: outcome === 'REACHABLE' ? 1 : 0 });
      expect(validateCoreApiResponse('testCaptureCandidateConnection', 200, tested.body)).toEqual({ ok: true });
      expect(h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY).body.candidates[0]?.adoptable).toBe(outcome === 'REACHABLE');
    }
    expect(h.rows('CAPTURE_CONNECTION_TESTED').map((row) => row.details?.['outcome'])).toEqual(Object.values(CaptureConnectionOutcome));
    // After a failed test the adoption answers CANDIDATE_NOT_TESTED and registers nothing.
    const refused = h.call('POST', `${FRESH}/adopt`, {});
    expect([refused.status, reasonOf(refused.body)]).toEqual([409, 'CANDIDATE_NOT_TESTED']);
    setSimConnectionTestOutcome(h.sim.store, null);
    expect(h.call<CaptureConnectionTest>('POST', `${FRESH}/test`, {}).body.outcome).toBe('REACHABLE');
  });

  it('the adoption: 409 before a test, 201 after one, CAM-03 in `captureDevices`, the selector untouched, a repeat 409', () => {
    const h = searched();
    const untested = h.call('POST', `${FRESH}/adopt`, {});
    expect([untested.status, reasonOf(untested.body)]).toEqual([409, 'CANDIDATE_NOT_TESTED']);
    expect(h.state().captureDevices.devices).toHaveLength(5);

    h.call('POST', `${FRESH}/test`, {});
    const selector = h.state().captureConfig;
    const adopted = h.call<CaptureCandidateAdoption>('POST', `${FRESH}/adopt`, {});
    expect(adopted.status).toBe(201);
    expect(adopted.body).toEqual({
      deviceId: SIM_ADOPTED_DEVICE_ID,
      device: { id: 'CAM-03', kind: 'CAMERA', model: 'Test source', firmware: null, host: '127.0.0.1', poePort: null, online: true, streamState: null, capabilities: ['VIDEO'], adapter: 'FAKE', sourceClass: 'DEVELOPMENT' },
      credentialSet: false,
    });
    expect(h.state().captureDevices.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH', 'CAM-03']);
    // Adoption is not assignment: no track changed.
    expect(h.state().captureConfig).toBe(selector);
    expect(h.rows('CAPTURE_CANDIDATE_ADOPTED').map((row) => [row.deviceId, row.details])).toEqual([
      ['CAM-03', { deviceId: 'CAM-03', candidateId: 'CND-000000000001', searchId: 'DSC-000001', adapter: 'FAKE', sourceClass: 'DEVELOPMENT', credentialSet: false, operationId: 'adoptCaptureCandidate', permission: 'CAPTURE_CONFIG' }],
    ]);
    // The verification row of the adoption beside the row of the test; no credential row without a credential.
    expect(h.rows('CAPTURE_CONNECTION_TESTED').map((row) => row.details?.['operationId'])).toEqual(['testCaptureCandidateConnection', 'adoptCaptureCandidate']);
    expect(h.rows('CAPTURE_CREDENTIAL_SET')).toEqual([]);

    // At most one device per candidate.
    const repeat = h.call('POST', `${FRESH}/adopt`, {});
    expect([repeat.status, reasonOf(repeat.body), (repeat.body as { error: { details: { deviceId?: string } } }).error.details.deviceId]).toEqual([409, 'CANDIDATE_ALREADY_REGISTERED', 'CAM-03']);
    expect(h.state().captureDevices.devices).toHaveLength(6);
    // The new device is assignable like any registered camera (operation 79), a candidate id is not.
    expect(h.call('POST', '/api/v1/capture/cameras/CAM-03/source', { trackId: 'VIDEO-02' }).status).toBe(200);
    expect(h.call('POST', `/api/v1/capture/cameras/${SIM_CAPTURE_CANDIDATE_IDS.fresh}/source`, { trackId: 'VIDEO-02' }).status).toBe(404);
    // A later search lists the adopted candidate as REGISTERED; a demo reset removes the device.
    h.call('POST', DISCOVERY);
    expect(h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY).body.candidates.map((candidate) => [candidate.status, candidate.deviceId])).toEqual([
      ['REGISTERED', 'CAM-03'],
      ['REGISTERED', 'CAM-01'],
    ]);
    h.sim.actions.signOut();
    signIn(h, 'andi.pratama');
    h.sim.actions.resetDemo();
    expect(h.state().captureDevices.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH']);
  });

  it('with a credential: 201, `credentialSet: true`, one CAPTURE_CREDENTIAL_SET row naming the device only, and the pair is nowhere', () => {
    const h = searched();
    h.call('POST', `${FRESH}/test`, { credential: { username: CANARY_USER, secret: CANARY_SECRET } });
    const adopted = h.call<CaptureCandidateAdoption>('POST', `${FRESH}/adopt`, { credential: { username: CANARY_USER, secret: CANARY_SECRET } });
    expect([adopted.status, adopted.body.credentialSet]).toEqual([201, true]);
    expect(h.rows('CAPTURE_CREDENTIAL_SET').map((row) => [row.deviceId, row.details])).toEqual([
      ['CAM-03', { operationId: 'adoptCaptureCandidate', deviceId: 'CAM-03', permission: 'CAPTURE_CONFIG' }],
    ]);
    expect(h.rows('CAPTURE_CANDIDATE_ADOPTED')[0]?.details).toMatchObject({ credentialSet: true });
    const everything = JSON.stringify([adopted, h.state()]);
    expect(everything).not.toContain(CANARY_USER);
    expect(everything).not.toContain(CANARY_SECRET);
  });

  it('a passing test is valid for five minutes: after that the candidate is not adoptable', () => {
    const h = searched();
    h.call('POST', `${FRESH}/test`, {});
    h.clock.advance(CAPTURE_CONNECTION_TEST_VALIDITY_MS - 1);
    expect(h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY).body.candidates[0]?.adoptable).toBe(true);
    h.clock.advance(1);
    expect(h.call<CaptureDiscoveryStateBody>('GET', DISCOVERY).body.candidates[0]?.adoptable).toBe(false);
    expect(reasonOf(h.call('POST', `${FRESH}/adopt`, {}).body)).toBe('CANDIDATE_NOT_TESTED');
  });
});

describe('web console only: operations 89, 95 and 96 inside a tablet or phone app (C3 §2.6 "Simulator"; D80(3))', () => {
  it('a device console is refused 403 NOT_PERMITTED with `details.reason: WEB_CONSOLE_ONLY`, before the body is looked at; 93, 94 and 97 are allowed', () => {
    const h = harness({ deviceConsole: true });
    signIn(h, 'rina.wijaya');
    expect(h.call('POST', DISCOVERY).status).toBe(202);
    expect(h.call('GET', DISCOVERY).status).toBe(200);
    expect(h.call('POST', RESCAN).status).toBe(200);
    const before = h.state().audit.rows.length;
    const canary = { credential: { username: CANARY_USER, secret: CANARY_SECRET } };
    const refusals = [
      h.call('POST', `${FRESH}/test`, canary),
      h.call('POST', `${FRESH}/adopt`, canary),
      h.call('POST', '/api/v1/capture/devices/CAM-01/credential', canary.credential),
      // Also with a body that is outside the schema, and for an id that does not exist: the condition is decided first.
      h.call('POST', `${FRESH}/test`, { stray: CANARY_SECRET }),
      h.call('POST', `${DISCOVERY}/candidates/CND-00000000BEEF/adopt`, canary),
    ];
    for (const refused of refusals) {
      expect([refused.status, codeOf(refused.body), reasonOf(refused.body)]).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
      expect(JSON.stringify(refused.body)).not.toMatch(/canary/);
    }
    expect(h.state().audit.rows).toHaveLength(before);
    expect(JSON.stringify(h.state())).not.toMatch(/canary/);
    expect(validateCoreApiResponse('testCaptureCandidateConnection', 403, refusals[0]?.body)).toEqual({ ok: true });
  });

  it('negative control: the same calls on the web console pass the condition (200, 201, 200), and a role without CAPTURE_CONFIG is refused for the role first', () => {
    const web = harness();
    signIn(web, 'rina.wijaya');
    web.call('POST', DISCOVERY);
    expect(web.call('POST', `${FRESH}/test`, {}).status).toBe(200);
    expect(web.call('POST', `${FRESH}/adopt`, {}).status).toBe(201);
    expect(web.call('POST', '/api/v1/capture/devices/CAM-01/credential', { username: 'onvif', secret: 'placeholder' }).status).toBe(200);

    const tablet = harness({ deviceConsole: true });
    signIn(tablet, 'budi.santoso');
    const refused = tablet.call('POST', `${FRESH}/test`, {});
    expect([refused.status, codeOf(refused.body), reasonOf(refused.body)]).toEqual([403, 'NOT_PERMITTED', undefined]);
  });
});

describe('operation 97: the local inputs, read again', () => {
  it('one entry per registered microphone, `present` from the device state, one CAPTURE_DISCOVERY_SEARCHED row with scope MIC_LOCAL', () => {
    const h = harness();
    signIn(h, 'rina.wijaya');
    const scan = h.call<CaptureInputScan>('POST', RESCAN);
    expect(scan).toEqual({
      status: 200,
      body: {
        scannedAt: AT,
        inputs: [
          // Pin moved by wave H closing pass Z1, item 6 (ruling D206 (2); C3 §2.6 erratum PE-WH-01): simulated
          // capture states NO adapter and NO source class on any operation - the in-app simulator as the SIMULATED Core.
          { deviceId: 'MIC-01', inputId: 'MIC-01', present: true, errorCode: null },
          { deviceId: 'MIC-02', inputId: 'MIC-02', present: true, errorCode: null },
        ],
        unregisteredCount: 0,
      },
    });
    expect(h.rows('CAPTURE_DISCOVERY_SEARCHED').map((row) => row.details)).toEqual([
      { searchId: 'DSC-000001', scope: 'MIC_LOCAL', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 2, newCount: 0, registeredCount: 2, interfaceCount: 0, operationId: 'rescanCaptureInputs', permission: 'CAPTURE_CONFIG' },
    ]);
    for (const entry of scan.body.inputs) {
      expect(entry).not.toHaveProperty('adapter');
      expect(entry).not.toHaveProperty('sourceClass');
    }
    // The body is still one of the contract (the two members are optional there).
    expect(CaptureInputScanSchema.safeParse(scan.body).success).toBe(true);
    // It registers nothing and is no camera search: the candidate read stays empty.
    expect(h.state().captureDevices.devices).toHaveLength(5);
    expect(h.call('GET', DISCOVERY).body).toEqual({ search: null, candidates: [], truncated: false });
  });
});

// Task 4, blueprint row 63 (design addendum 4.2): what the in-app simulator answers for the two
// sound-card operations. It reads no host and captures from no sound card.
describe('operations 98 and 99: the sound cards and the registration of an input (task 4 row 63)', () => {
  const FIRST_INPUT = { cardId: SIM_CAPTURE_AUDIO_CARD_IDS.four, deviceIndex: 0, inputNumber: 1 };

  it('98: the fixed listing of two test cards, and one CAPTURE_DISCOVERY_SEARCHED row with scope AUDIO_CARDS that holds counts and codes only', () => {
    const h = harness();
    signIn(h, 'rina.wijaya');
    const listed = h.call<CaptureAudioCardSearch>('POST', AUDIO_CARDS);
    expect(listed).toEqual({ status: 200, body: { searchedAt: AT, cards: simCaptureAudioCards(), truncated: false } });
    expect(CaptureAudioCardSearchSchema.safeParse(listed.body).success).toBe(true);
    expect(validateCoreApiResponse('searchCaptureAudioCards', 200, listed.body)).toEqual({ ok: true });
    // Fixed: a second call answers the same cards, and writes its own row.
    h.clock.advance(1_000);
    expect(h.call<CaptureAudioCardSearch>('POST', AUDIO_CARDS).body.cards).toEqual(listed.body.cards);
    const rows = h.rows('CAPTURE_DISCOVERY_SEARCHED');
    expect(rows.map((row) => row.details)).toEqual([
      { searchId: 'DSC-000001', scope: 'AUDIO_CARDS', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 2, newCount: 2, registeredCount: 0, interfaceCount: 0, operationId: 'searchCaptureAudioCards', permission: 'CAPTURE_CONFIG' },
      { searchId: 'DSC-000002', scope: 'AUDIO_CARDS', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 2, newCount: 2, registeredCount: 0, interfaceCount: 0, operationId: 'searchCaptureAudioCards', permission: 'CAPTURE_CONFIG' },
    ]);
    // No product name and no card id reaches a row: not in the details, not in the message.
    const written = JSON.stringify(rows);
    for (const card of listed.body.cards) {
      expect(written).not.toContain(card.cardId);
      expect(written).not.toContain(card.product);
    }
    // It registers nothing and is no camera search.
    expect(h.state().captureDevices.devices).toHaveLength(5);
    expect(h.call('GET', DISCOVERY).body).toEqual({ search: null, candidates: [], truncated: false });
  });

  it('99: the simulator registers nothing - 404 for an unknown card, 409 for an input beyond the card, 409 for any input it has; no row, no device, no change of state', () => {
    const h = harness();
    signIn(h, 'rina.wijaya');
    const before = h.state();
    const unknown = h.call('POST', AUDIO_INPUTS, { ...FIRST_INPUT, cardId: 'OTHER_CARD' });
    expect([unknown.status, codeOf(unknown.body)]).toEqual([404, 'NOT_FOUND']);
    const otherDevice = h.call('POST', AUDIO_INPUTS, { ...FIRST_INPUT, deviceIndex: 1 });
    expect(otherDevice.status).toBe(404);
    const beyond = h.call('POST', AUDIO_INPUTS, { ...FIRST_INPUT, inputNumber: 5 });
    expect([beyond.status, codeOf(beyond.body), reasonOf(beyond.body)]).toEqual([409, 'INVALID_STATE', 'AUDIO_INPUT_BEYOND_CARD']);
    // The second test card has two inputs: its third is beyond it.
    expect(reasonOf(h.call('POST', AUDIO_INPUTS, { cardId: SIM_CAPTURE_AUDIO_CARD_IDS.two, deviceIndex: 0, inputNumber: 3 }).body)).toBe('AUDIO_INPUT_BEYOND_CARD');
    for (const inputNumber of [1, 2, 3, 4]) {
      const refused = h.call('POST', AUDIO_INPUTS, { ...FIRST_INPUT, inputNumber });
      expect([refused.status, codeOf(refused.body), reasonOf(refused.body)], String(inputNumber)).toEqual([409, 'INVALID_STATE', 'AUDIO_INPUT_NOT_REGISTRABLE']);
      expect(validateCoreApiResponse('registerCaptureAudioInput', 409, refused.body)).toEqual({ ok: true });
    }
    // A body outside the schema is 422 and names where, never what.
    for (const body of [{}, { ...FIRST_INPUT, inputNumber: 0 }, { ...FIRST_INPUT, cardId: 'hw:1,0' }, { ...FIRST_INPUT, product: CANARY_USER }]) {
      const answer = h.call('POST', AUDIO_INPUTS, body);
      expect([answer.status, codeOf(answer.body)]).toEqual([422, 'INVALID_INPUT']);
      expect(JSON.stringify(answer.body)).not.toContain(CANARY_USER);
    }
    // Nothing happened: the same state object, so no audit row, no device and no selector change.
    expect(h.state()).toBe(before);
    expect(h.rows('CAPTURE_AUDIO_INPUT_CHANGED')).toEqual([]);
    expect(h.state().captureDevices.devices).toHaveLength(5);
  });

  it('who may call: signed out 401, a role without CAPTURE_CONFIG 403, a tablet or phone 403 WEB_CONSOLE_ONLY, a session open 409 CAPTURE_CONFIG_LOCKED - each before the body is used and with no row', () => {
    const calls = (h: ReturnType<typeof harness>) => {
      const before = h.state().audit.rows.length;
      const answers = [h.call('POST', AUDIO_CARDS), h.call('POST', AUDIO_INPUTS, { not: 'a request' })];
      expect(h.state().audit.rows).toHaveLength(before);
      return answers;
    };
    const signedOut = harness();
    expect(calls(signedOut).map((answer) => [answer.status, codeOf(answer.body)])).toEqual([[401, 'NOT_SIGNED_IN'], [401, 'NOT_SIGNED_IN']]);
    const investigator = harness();
    signIn(investigator, 'budi.santoso');
    expect(calls(investigator).map((answer) => [answer.status, codeOf(answer.body)])).toEqual([[403, 'NOT_PERMITTED'], [403, 'NOT_PERMITTED']]);
    const tablet = harness({ deviceConsole: true });
    signIn(tablet, 'rina.wijaya');
    expect(calls(tablet).map((answer) => [answer.status, codeOf(answer.body), reasonOf(answer.body)])).toEqual([
      [403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY'],
      [403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY'],
    ]);
    const open = harness();
    signIn(open, 'andi.pratama');
    open.sim.actions.loadScenario('recording');
    expect(open.state().session?.state).toBe('RECORDING');
    expect(calls(open).map((answer) => [answer.status, codeOf(answer.body)])).toEqual([[409, 'CAPTURE_CONFIG_LOCKED'], [409, 'CAPTURE_CONFIG_LOCKED']]);
  });
});

describe('operation 89 after the alignment (decision D106 (3); erratum PE-128-27)', () => {
  it('the credential is held to the contract\'s schema: a character outside printable ASCII, or a member too many, is 422 and writes no row', () => {
    const h = harness();
    signIn(h, 'rina.wijaya');
    const path = '/api/v1/capture/devices/CAM-01/credential';
    const before = h.state().audit.rows.length;
    for (const body of [{ username: 'adm<in', secret: 's' }, { username: 'admin', secret: 'pässword' }, { username: 'admin', secret: 's', host: '192.0.2.1' }, { username: 'admin' }]) {
      expect(h.call('POST', path, body).status, JSON.stringify(Object.keys(body))).toBe(422);
    }
    expect(h.state().audit.rows).toHaveLength(before);
    expect(h.call('POST', path, { username: 'onvif', secret: 'placeholder' }).status).toBe(200);
    expect(h.rows('CAPTURE_CREDENTIAL_SET')).toHaveLength(1);
    // Registered devices only: a candidate id is never a device id (404).
    expect(h.call('POST', `/api/v1/capture/devices/${SIM_CAPTURE_CANDIDATE_IDS.fresh}/credential`, { username: 'onvif', secret: 'placeholder' }).status).toBe(404);
  });
});

describe('the INTERNAL action `registerCaptureDevice` (C3 §2.6 "Adoption"; the Core runs it inside operation 96)', () => {
  it('appends the camera to `captureDevices` with its adapter and class, writes no audit row and no event, and leaves the selector alone', () => {
    const h = harness();
    const before = h.state();
    h.sim.actions.registerCaptureDevice({ id: 'CAM-03', model: null, host: '192.0.2.10:8080', adapter: 'ONVIF_RTSP' });
    const after = h.state();
    expect(after.captureDevices.devices.at(-1)).toEqual({ id: 'CAM-03', kind: 'CAMERA', model: null, firmware: null, host: '192.0.2.10:8080', poePort: null, online: true, streamState: null, capabilities: ['VIDEO'], adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' });
    expect(after.captureDevices.devices).toHaveLength(6);
    expect([after.audit, after.events, after.captureConfig]).toEqual([before.audit, before.events, before.captureConfig]);
    expect(nextCaptureCameraId(after.captureDevices.devices)).toBe('CAM-04');
    expect(nextCaptureCameraId([{ id: 'CAM-09' }, { id: 'CAM-120' }, { id: 'MIC-200' }])).toBe('CAM-121');
  });

  it('refuses a duplicate id, an id that is no CAM-NN, a host that is a URL or carries a user part, and an adapter that is no code: nothing changes', () => {
    const h = harness();
    const before = h.state();
    for (const device of [
      { id: 'CAM-01', model: null, host: '192.0.2.10', adapter: 'FAKE' },
      { id: 'MIC-03', model: null, host: '192.0.2.10', adapter: 'FAKE' },
      { id: 'CND-000000000001', model: null, host: '192.0.2.10', adapter: 'FAKE' },
      { id: 'CAM-03', model: null, host: 'http://192.0.2.10/onvif', adapter: 'FAKE' },
      { id: 'CAM-03', model: null, host: 'admin:pass@192.0.2.10', adapter: 'FAKE' },
      { id: 'CAM-03', model: null, host: '', adapter: 'FAKE' },
      { id: 'CAM-03', model: null, host: '192.0.2.10', adapter: 'onvif' },
      { id: 'CAM-03', model: 'x'.repeat(121), host: '192.0.2.10', adapter: 'FAKE' },
    ]) {
      expect(() => h.sim.actions.registerCaptureDevice(device), JSON.stringify(device)).toThrow(/Illegal session transition/);
    }
    expect(h.state()).toBe(before);
  });
});

// Task 4 row 185 (design addendum 04 section 4.2; AD-07; RG-4): the microphone's equivalent.
describe('the INTERNAL action `registerCaptureMicrophone` (the Core runs it inside operation 99)', () => {
  const MODEL = 'USB Audio CODEC';

  it('a first registration appends ONE `MIC-NN` device of class MIC and adapter USB_AUDIO, and nothing else changes', () => {
    const h = harness();
    const before = h.state();
    h.sim.actions.registerCaptureMicrophone({ deviceId: null, model: MODEL });
    const after = h.state();
    expect(after.captureDevices.devices).toHaveLength(before.captureDevices.devices.length + 1);
    expect(after.captureDevices.devices.slice(0, -1)).toEqual(before.captureDevices.devices);
    // Decision C43 (3), integration pass I-7: the capability of the built-in pair, not an empty list.
    expect(after.captureDevices.devices.at(-1)).toEqual({ id: 'MIC-03', kind: 'MIC', model: MODEL, firmware: null, host: null, poePort: null, online: true, streamState: null, capabilities: ['AUDIO'], adapter: 'USB_AUDIO', sourceClass: 'PRODUCTION' });
    expect(after.captureDevices.devices.at(-1)?.capabilities).toEqual(before.captureDevices.devices.find((device) => device.id === 'MIC-01')?.capabilities);
    // Every other slice is the SAME object: no audit row, no event, the selector alone (decision C25).
    for (const slice of Object.keys(before) as (keyof typeof before)[]) {
      if (slice !== 'captureDevices') expect(after[slice], slice).toBe(before[slice]);
    }
    // The next id is the highest number plus 1, never a reused one, and a camera id does not count.
    expect(nextCaptureMicrophoneId(after.captureDevices.devices)).toBe('MIC-04');
    expect(nextCaptureMicrophoneId([{ id: 'MIC-09' }, { id: 'MIC-120' }, { id: 'CAM-200' }])).toBe('MIC-121');
    expect(nextCaptureMicrophoneId([])).toBe('MIC-01');
    // A second NEW microphone is another device; the seeded pair and the first one are untouched.
    h.sim.actions.registerCaptureMicrophone({ deviceId: null, model: MODEL });
    expect(h.state().captureDevices.devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH', 'MIC-03', 'MIC-04']);
  });

  it('a second registration of the same device enables it again with the model of the new listing and appends none', () => {
    const h = harness();
    h.sim.actions.registerCaptureMicrophone({ deviceId: null, model: MODEL });
    const registered = h.state();
    // Online with the same model: the SAME state object, so the engine writes nothing.
    h.sim.actions.registerCaptureMicrophone({ deviceId: 'MIC-03', model: MODEL });
    expect(h.state()).toBe(registered);
    // Offline (the telemetry of a lost card), then registered again under another product name.
    const offline = { ...registered, captureDevices: { devices: registered.captureDevices.devices.map((device) => (device.id === 'MIC-03' ? { ...device, online: false } : device)) } };
    const again = registerCaptureMicrophoneTransition(offline, { deviceId: 'MIC-03', model: 'Other card' });
    expect(again.state.captureDevices.devices).toHaveLength(registered.captureDevices.devices.length);
    expect(again.result).toEqual({ ...registered.captureDevices.devices.at(-1), online: true, model: 'Other card' });
    expect(again.state.captureDevices.devices.at(-1)).toBe(again.result);
    expect(again.state.captureDevices.devices.slice(0, -1)).toEqual(registered.captureDevices.devices.slice(0, -1));
    for (const slice of Object.keys(offline) as (keyof typeof offline)[]) {
      if (slice !== 'captureDevices') expect(again.state[slice], slice).toBe(offline[slice]);
    }
  });

  it('refuses a model that is no product name of a card listing, and an id that is no registered USB audio microphone: nothing changes', () => {
    const h = harness();
    h.sim.actions.registerCaptureDevice({ id: 'CAM-03', model: null, host: '192.0.2.10', adapter: 'ONVIF_RTSP' });
    const before = h.state();
    for (const microphone of [
      { deviceId: null, model: '' },
      { deviceId: null, model: 'x'.repeat(65) },
      { deviceId: null, model: 'USB\u0007Audio' },
      { deviceId: null, model: 'USB\nAudio' },
      { deviceId: null, model: 'USB ‮ Audio' },
      { deviceId: null, model: 'Mikrofon ä' },
      // A built-in microphone (no adapter member), a camera, an id the registry does not hold, an id of another form.
      { deviceId: 'MIC-01', model: MODEL },
      { deviceId: 'CAM-03', model: MODEL },
      { deviceId: 'MIC-07', model: MODEL },
      { deviceId: 'MIC-3', model: MODEL },
      { deviceId: '', model: MODEL },
    ]) {
      expect(() => h.sim.actions.registerCaptureMicrophone(microphone), JSON.stringify(microphone)).toThrow(/Illegal session transition/);
    }
    expect(h.state()).toBe(before);
    // A local-device microphone is not this action's either: the adapter is not USB_AUDIO.
    const local = { ...before, captureDevices: { devices: [...before.captureDevices.devices, { id: 'MIC-03', kind: 'MIC' as const, model: 'Core microphone', firmware: null, host: null, poePort: null, online: false, streamState: null, capabilities: [], adapter: 'LOCAL_DEVICE', sourceClass: 'DEVELOPMENT' as const }] } };
    expect(() => registerCaptureMicrophoneTransition(local, { deviceId: 'MIC-03', model: MODEL })).toThrow(/Illegal session transition/);
    // The model rule IS the rule of a product name of the card listing (AD-07 (1)).
    expect(REGISTERED_MICROPHONE_MODEL_PATTERN.source).toBe(CAPTURE_AUDIO_CARD_TEXT_PATTERN.source);
    expect(REGISTERED_MICROPHONE_MODEL_PATTERN.flags).toBe(CAPTURE_AUDIO_CARD_TEXT_PATTERN.flags);
  });

  it('no client may call it: it is INTERNAL with no operation and bound LOCAL, exactly as `registerCaptureDevice`', () => {
    expect(SIM_ACTION_OPERATIONS.registerCaptureMicrophone).toEqual({ operations: [], execution: SimActionExecution.INTERNAL });
    expect(SIM_ACTION_OPERATIONS.registerCaptureMicrophone).toEqual(SIM_ACTION_OPERATIONS.registerCaptureDevice);
    expect(LIVE_BINDINGS.registerCaptureMicrophone.flow).toBe(LiveActionFlow.LOCAL);
    expect(LIVE_BINDINGS.registerCaptureMicrophone.flow).toBe(LIVE_BINDINGS.registerCaptureDevice.flow);
  });

  it('the simulated operation 99 answers as before and does not run it: the simulator registry gains no device', () => {
    const h = harness();
    signIn(h, 'rina.wijaya');
    const before = h.state().captureDevices;
    const answer = h.call('POST', AUDIO_INPUTS, { cardId: SIM_CAPTURE_AUDIO_CARD_IDS.four, cardDevice: 0, inputNumber: 1 });
    expect(answer.status).toBeGreaterThanOrEqual(400);
    expect(h.state().captureDevices).toBe(before);
  });
});

// Task 4 (blueprint row 195, WP-12; finding of row 97): the shared action the engine's door of a
// confirmed re-address runs (row 196). The sibling of the two actions above.
describe('the INTERNAL action `readdressCaptureDevice` (the Core runs it inside operation 100)', () => {
  const ADDRESS = '192.168.10.21';

  it('the address of the named camera changes, and no other member, device or slice does', () => {
    const h = harness();
    const before = h.state();
    const camera = before.captureDevices.devices.find((device) => device.id === 'CAM-01')!;
    expect(camera.host).not.toBe(ADDRESS);
    h.sim.actions.readdressCaptureDevice({ deviceId: 'CAM-01', address: ADDRESS });
    const after = h.state();
    // The one device: every member but `host` is equal, and `host` is the address as given.
    expect(after.captureDevices.devices.find((device) => device.id === 'CAM-01')).toEqual({ ...camera, host: ADDRESS });
    // Every other device is the SAME object, in the same place; none is appended.
    expect(after.captureDevices.devices.map((device) => device.id)).toEqual(before.captureDevices.devices.map((device) => device.id));
    after.captureDevices.devices.forEach((device, index) => {
      if (device.id !== 'CAM-01') expect(device, device.id).toBe(before.captureDevices.devices[index]);
    });
    // Every other slice is the SAME object: no audit row, no event, the selector alone.
    for (const slice of Object.keys(before) as (keyof typeof before)[]) {
      if (slice !== 'captureDevices') expect(after[slice], slice).toBe(before[slice]);
    }
    // The address is taken as the caller gives it: with a port, and an address the destination rule
    // would refuse (the rule is the operation's, not the action's).
    const withPort = readdressCaptureDeviceTransition(after, { deviceId: 'CAM-02', address: '192.168.10.22:8080' });
    expect(withPort.result).toEqual({ ...after.captureDevices.devices.find((device) => device.id === 'CAM-02'), host: '192.168.10.22:8080' });
    expect(readdressCaptureDeviceTransition(after, { deviceId: 'CAM-02', address: '127.0.0.1' }).result.host).toBe('127.0.0.1');
    // The address the camera already holds: the SAME state object, so the engine writes nothing.
    const same = readdressCaptureDeviceTransition(after, { deviceId: 'CAM-01', address: ADDRESS });
    expect(same.state).toBe(after);
    expect(same.result).toBe(after.captureDevices.devices.find((device) => device.id === 'CAM-01'));
    h.sim.actions.readdressCaptureDevice({ deviceId: 'CAM-01', address: ADDRESS });
    expect(h.state()).toBe(after);
    // An adopted camera is re-addressed the same way.
    h.sim.actions.registerCaptureDevice({ id: 'CAM-03', host: '192.168.10.30', model: null, adapter: 'ONVIF_RTSP' });
    h.sim.actions.readdressCaptureDevice({ deviceId: 'CAM-03', address: '192.168.10.31' });
    expect(h.state().captureDevices.devices.find((device) => device.id === 'CAM-03')).toMatchObject({ host: '192.168.10.31', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', online: true });
  });

  it('an unknown id, a microphone, the switch and an address that is no host are refused, and nothing changes', () => {
    const h = harness();
    const before = h.state();
    const refused: Array<[string, unknown, unknown]> = [
      ['an unknown camera', 'CAM-77', ADDRESS],
      ['a microphone', 'MIC-01', ADDRESS],
      ['the other microphone', 'MIC-02', ADDRESS],
      ['the switch', 'POE-SWITCH', ADDRESS],
      ['an empty id', '', ADDRESS],
      ['a candidate id', 'CND-000000000002', ADDRESS],
      ['no id', null, ADDRESS],
      ['an empty address', 'CAM-01', ''],
      ['a URL', 'CAM-01', 'http://192.168.10.21/onvif/device_service'],
      ['a path', 'CAM-01', '192.168.10.21/24'],
      ['user and password', 'CAM-01', 'admin:pass@192.168.10.21'],
      ['a blank inside', 'CAM-01', '192.168.10.21 '],
      ['a text that is too long', 'CAM-01', '1'.repeat(121)],
      ['no address', 'CAM-01', null],
      ['a number', 'CAM-01', 3232238101],
    ];
    for (const [what, deviceId, address] of refused) {
      expect(() => readdressCaptureDeviceTransition(before, { deviceId, address } as never), what).toThrow(/Illegal session transition/);
      expect(() => h.sim.actions.readdressCaptureDevice({ deviceId, address } as never), what).toThrow(/Illegal session transition/);
      expect(h.state(), what).toBe(before);
    }
    // A registered USB microphone is refused as the built-in pair is.
    h.sim.actions.registerCaptureMicrophone({ deviceId: null, model: 'USB Audio CODEC' });
    const withMicrophone = h.state();
    expect(() => h.sim.actions.readdressCaptureDevice({ deviceId: 'MIC-03', address: ADDRESS })).toThrow(/Illegal session transition/);
    expect(h.state()).toBe(withMicrophone);
  });

  it('no client may call it: it is INTERNAL with no operation and bound LOCAL, exactly as `registerCaptureDevice`', () => {
    expect(SIM_ACTION_OPERATIONS.readdressCaptureDevice).toEqual({ operations: [], execution: SimActionExecution.INTERNAL });
    expect(SIM_ACTION_OPERATIONS.readdressCaptureDevice).toEqual(SIM_ACTION_OPERATIONS.registerCaptureDevice);
    expect(LIVE_BINDINGS.readdressCaptureDevice.flow).toBe(LiveActionFlow.LOCAL);
    expect(LIVE_BINDINGS.readdressCaptureDevice.flow).toBe(LIVE_BINDINGS.registerCaptureDevice.flow);
    expect(READDRESS_CAPTURE_DEVICE_ACTION).toBe('readdressCaptureDevice');
  });

  it('the simulated operation 100 does not run it: the simulator registry keeps every address', () => {
    const h = harness();
    signIn(h, 'rina.wijaya');
    const before = h.state().captureDevices;
    expect(h.call('POST', '/api/v1/capture/discovery').status).toBe(202);
    const answer = h.call('POST', '/api/v1/capture/devices/address/confirm', { deviceId: 'CAM-01', candidateId: 'CND-000000000002', address: ADDRESS });
    expect(answer.status).toBe(409);
    expect(h.state().captureDevices).toBe(before);
  });

  // Task 4 row V3 (blueprint row 146; C58): operation 108, the connection test of a registered camera
  // with its stored credential. The simulator holds no credential and contacts nothing.
  // Row V4 (decision C75 (2)): so it answers what a Core server in simulated capture answers - the
  // envelope's `503 NOT_READY`, `DISCOVERY_NOT_READY` - for every id, and never a synthetic REACHABLE.
  it('the simulated operation 108 is web console only, answers the 503 of a Core in simulated capture for every id - never a synthetic result - and changes nothing: no audit row, no event, the same state object', () => {
    const tablet = harness({ deviceConsole: true });
    signIn(tablet, 'rina.wijaya');
    const refused = tablet.call('POST', '/api/v1/capture/devices/CAM-01/test');
    expect([refused.status, codeOf(refused.body), reasonOf(refused.body)]).toEqual([403, 'NOT_PERMITTED', 'WEB_CONSOLE_ONLY']);
    const h = harness();
    signIn(h, 'rina.wijaya');
    const before = h.state();
    // A registered camera, a microphone and an unknown id alike: "not ready" stands BEFORE the device is looked up, as on the Core server.
    for (const id of ['CAM-01', 'CAM-02', 'MIC-01', 'CAM-77']) {
      const answer = h.call('POST', `/api/v1/capture/devices/${id}/test`);
      expect([answer.status, codeOf(answer.body), reasonOf(answer.body)], id).toEqual([503, 'NOT_READY', 'DISCOVERY_NOT_READY']);
      expect((answer.body as { error: { message: string } }).error.message, id).toBe('The connection test of a registered camera is not ready.');
      expect(JSON.stringify(answer.body), id).not.toMatch(/REACHABLE|outcome|usableProfileCount/);
    }
    // Not one audit row of the two the Core server writes, and nothing else: the state is the same object.
    expect(h.state()).toBe(before);
    expect([...h.rows('CAPTURE_DEVICE_CONNECTION_TESTED'), ...h.rows('CAPTURE_CREDENTIAL_REVEALED')]).toEqual([]);
  });
});

// Integration pass D1b (decision D133), seam 8: the audit `endpointRef` of a connection test and an
// adoption is `urn:uuid:<UUID>` or absent (D134).
describe('an audit row carries an endpoint reference only in the form urn:uuid:<UUID> (pass D1b, seam 8)', () => {
  const URN = 'urn:uuid:4f1c2b7a-9d3e-4a56-8b0c-1e2f3a4b5c6d';
  const tested = (endpointRef: string | null, sourceClass: 'PRODUCTION' | 'DEVELOPMENT' = 'PRODUCTION') =>
    captureConnectionTestedDetails({ candidateId: 'CND-000001', searchId: 'SRCH-000001', outcome: 'REACHABLE', authenticated: true, adapter: 'ONVIF_RTSP', sourceClass, operationId: 'testCaptureCandidateConnection', host: '192.0.2.7', endpointRef });
  const adopted = (endpointRef: string | null) =>
    captureCandidateAdoptedDetails({ deviceId: 'CAM-03', candidateId: 'CND-000001', searchId: 'SRCH-000001', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', credentialSet: true, host: '192.0.2.7', endpointRef });

  it('a valid URN stays, in both rows and in either letter case', () => {
    expect(tested(URN)).toMatchObject({ host: '192.0.2.7', endpointRef: URN });
    expect(adopted(URN)).toMatchObject({ host: '192.0.2.7', endpointRef: URN });
    expect(tested(URN.toUpperCase().replace('URN:UUID:', 'urn:uuid:'))['endpointRef']).toBe(URN.toUpperCase().replace('URN:UUID:', 'urn:uuid:'));
    expect(CAPTURE_ENDPOINT_REF_PATTERN.test(URN)).toBe(true);
  });

  it('free text, a uuid: without urn:, a bare UUID and a padded URN are left out; the host stays', () => {
    const refused = ['front door camera', 'uuid:4f1c2b7a-9d3e-4a56-8b0c-1e2f3a4b5c6d', '4f1c2b7a-9d3e-4a56-8b0c-1e2f3a4b5c6d', `${URN} `, `${URN}\n`, `${URN}/admin:secret`, 'urn:uuid:not-a-uuid', 'http://192.0.2.7/onvif/device_service', ''];
    for (const value of refused) {
      for (const details of [tested(value), adopted(value)]) {
        expect('endpointRef' in details, JSON.stringify(value)).toBe(false);
        expect(details['host'], JSON.stringify(value)).toBe('192.0.2.7');
        expect(JSON.stringify(details)).not.toContain('secret');
      }
    }
    expect('endpointRef' in tested(null)).toBe(false);
  });

  it('CONTROL: a candidate that is not PRODUCTION carries neither member, valid URN or not (D86 C-3)', () => {
    const details = tested(URN, 'DEVELOPMENT');
    expect('endpointRef' in details || 'host' in details).toBe(false);
  });
});
