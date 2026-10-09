// Task 3 R-9..R-11, blueprint row 132 (decision D106): what the in-app simulator answers for
// operations 93-97 (masterplan/03_api_contract.md §2.6 "Simulator"), and its REST facade of
// operations 78-80 and 89 after the alignment with the hosted action `setCaptureConfig`
// (decision D106 (3)).
//
// The simulator opens no socket and waits on no timer, so every value below is fixed: the parity
// tests of the clients compare them.
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_CONNECTION_TEST_VALIDITY_MS,
  CAPTURE_DISCOVERY_RESULT_TTL_MS,
  CaptureConnectionOutcome,
  SIM_ADOPTED_DEVICE_ID,
  SIM_CAPTURE_CANDIDATE_IDS,
  validateCoreApiResponse,
  type CaptureCandidateAdoption,
  type CaptureConnectionTest,
  type CaptureDiscoverySearch,
  type CaptureDiscoveryStateBody,
  type CaptureInputScan,
} from '../src/api';
import { DEMO_OPERATOR_PASSWORD, createManualClock, createSim, nextCaptureCameraId, setSimConnectionTestOutcome, type AuditRow } from '../src/sim';

const AT = Date.UTC(2026, 9, 1, 3, 0, 0);
const DISCOVERY = '/api/v1/capture/discovery';
const RESCAN = '/api/v1/capture/inputs/rescan';
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
          { deviceId: 'MIC-01', inputId: 'MIC-01', present: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', errorCode: null },
          { deviceId: 'MIC-02', inputId: 'MIC-02', present: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', errorCode: null },
        ],
        unregisteredCount: 0,
      },
    });
    expect(h.rows('CAPTURE_DISCOVERY_SEARCHED').map((row) => row.details)).toEqual([
      { searchId: 'DSC-000001', scope: 'MIC_LOCAL', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount: 2, newCount: 0, registeredCount: 2, interfaceCount: 0, operationId: 'rescanCaptureInputs', permission: 'CAPTURE_CONFIG' },
    ]);
    // It registers nothing and is no camera search: the candidate read stays empty.
    expect(h.state().captureDevices.devices).toHaveLength(5);
    expect(h.call('GET', DISCOVERY).body).toEqual({ search: null, candidates: [], truncated: false });
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
