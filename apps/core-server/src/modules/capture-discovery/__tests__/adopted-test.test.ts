// The connection test of an ADOPTED camera with its STORED credential, on doubles (task 4 blueprint
// row 146; security addendum 04 W-6, AD-03 (5), AD-12 "S13-04 (d)"; AD-02 (1) for the stored
// address). No database, no socket, no process, no clock.
//
// THE DOUBLES. The reader is a SPY that answers an opaque credential of a synthetic account or
// throws the code the test says; the tester is a SPY that answers what the test says; the stored
// row is an object of this file. REAL: the limits (`connect/limits.ts`, on a manual clock) and the
// destination rule (`decideDestination`, purpose of a stored camera, on hand-written host facts).
// The real relay, the test camera and the reader through its wiring on PostgreSQL are in
// `src/modules/capture-config/__tests__/adopted-camera-test.db.test.ts` (the folder whose tests may
// import the wiring of the credential holders).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS, CAPTURE_CONNECTION_TEST_MAX_FAILURES, CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS, CAPTURE_CONNECTION_TEST_TIMEOUT_MS, CAPTURE_DISCOVERY_OPERATIONS, CaptureConnectionOutcome } from '@dems/shared/api';
import { describe, expect, it } from 'vitest';
import { codeOnly } from '../../../../test/static/scan';
import { CaptureAdapterError, CaptureAdapterRefusal, SealedCredential, StreamTestReason, sealCredential, type CameraCandidate, type StoredCameraAddressRule } from '../../../capture/adapters';
import { DestinationPurpose, decideDestination, type DestinationContext } from '../../../capture/destination-rule';
import { storedCameraAddressRuleOf } from '../../../capture/fence';
import type { AuditEntry } from '../../../core';
import { SERVER_AUDIT_DETAIL_RULES } from '../../../core/audit-details';
import { auditInputOf } from '../../../core/audit-writer';
import type { Principal } from '../../../plugins/authenticate';
import { ApiFailure } from '../../../plugins/error-envelope';
import { ADOPTED_TEST_FAULT, ADOPTED_TEST_NOT_SENT, ADOPTED_TEST_OUTCOME_NOT_RECORDED, READ_ADOPTED_CAMERA, adoptedCameraOf, registerAdoptedCameraTest, testAdoptedCamera, type AdoptedCameraTestCaller, type AdoptedCameraTestSeams } from '../adopted-test';
import { CAPTURE_DEVICE_TEST_MODULE_OPERATION, captureDeviceTestOperation } from '../adopted-test-route';
import { createConnectionTestLimits, type ConnectionAttempt, type ConnectionTestLimits } from '../connect';

const ACCOUNT = { username: ['row146', 'unit', 'account'].join('-'), secret: ['row146', 'unit', 'placeholder', 'Vb4Ns8'].join('-') } as const;
const HOST_FACTS: DestinationContext = {
  cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.50.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 24 }],
  hostAddresses: ['10.20.0.5'],
};
const REAL_RULE: StoredCameraAddressRule = (host, port) => decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address: host, ...(port === undefined ? {} : { port }) }, HOST_FACTS);
const CAMERA_HOST = '192.168.50.20';
const ENDPOINT = 'urn:uuid:14600000-0000-4000-8000-000000000146';
const NEEDLES = [ACCOUNT.username, ACCOUNT.secret];
const everything = (value: unknown): string => [String(value), JSON.stringify(value) ?? '', inspect(value, { depth: 8, showHidden: true, getters: true }), value instanceof Error ? `${value.message}\n${value.stack ?? ''}` : ''].join('\n');
const leaks = (value: unknown): string[] => NEEDLES.filter((needle) => everything(value).includes(needle));

const operator = (sessionId: string, operatorId = 'OPR-002'): AdoptedCameraTestCaller => ({ principal: { kind: 'OPERATOR', operatorId, sessionId, deviceId: null, role: 'TECHNICIAN' } as Extract<Principal, { kind: 'OPERATOR' }> });
const CALLER = operator('SESSION-A');
const outcomeOf = async (pending: Promise<unknown>): Promise<unknown> => pending.then((value) => value, (error: unknown) => error);

type StoredRow = { kind: string; adapter_kind: string; address: string | null; onvif_uuid: string | null };
const REFUSED_AT_THE_STREAM: ConnectionAttempt = { outcome: CaptureConnectionOutcome.AUTHENTICATION_FAILED, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 1, reason: StreamTestReason.STREAM_CREDENTIAL_REFUSED };

interface World {
  readonly seams: AdoptedCameraTestSeams;
  readonly limits: ConnectionTestLimits;
  /** The order of what was asked: `query`, `rule`, `reader`, `tester`. */
  readonly calls: string[];
  readonly queries: { text: string; values: unknown[] }[];
  readonly reads: { deviceId: string; operatorId: string; extra: number }[];
  readonly contacted: { camera: CameraCandidate; credential: SealedCredential | null; signal: AbortSignal; sourceAddress?: string | undefined }[];
  readonly notes: Record<string, unknown>[];
  readonly persisted: Record<string, unknown>[];
  /** Row 146b: the outcome entries handed to the host's one unit, in order. */
  readonly recorded: AuditEntry[];
  /** Row 146b: what the unit of the outcome entry throws instead of committing. */
  recordFails: Error | null;
  readonly timers: { delayMs: number; fire(): void; cancelled: boolean }[];
  rows: Record<string, StoredRow | undefined>;
  answer: ConnectionAttempt | Error | 'HANG';
  /** What the reader throws instead of answering: a code word of the credential reader. */
  readerFails: string | null;
  sessionOpen: boolean;
  provided: { parts: boolean; tester: boolean };
  now: number;
}

function world(): World {
  const state: World = {
    seams: undefined as unknown as AdoptedCameraTestSeams,
    limits: undefined as unknown as ConnectionTestLimits,
    calls: [],
    queries: [],
    reads: [],
    contacted: [],
    notes: [],
    persisted: [],
    recorded: [],
    recordFails: null,
    timers: [],
    rows: { 'CAM-07': { kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address: CAMERA_HOST, onvif_uuid: ENDPOINT } },
    answer: { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: true, usableProfiles: ['HEVC_1080P'], rejectedCredentialRequests: 0, streams: [{ code: 'HEVC_1080P', codec: 'HEVC', width: 1920, height: 1080, onvifProfileToken: 'profile_1', videoSourceToken: null, lens: 1 }] },
    readerFails: null,
    sessionOpen: false,
    provided: { parts: true, tester: true },
    now: 1_800_000_000_000,
  };
  const limits = createConnectionTestLimits({ now: () => state.now });
  const seams: AdoptedCameraTestSeams = {
    host: {
      now: () => state.now,
      state: () => ({
        session: state.sessionOpen ? ({ state: 'RECORDING' } as never) : null,
        captureDevices: { devices: [{ id: 'CAM-07', kind: 'CAMERA' }, { id: 'CAM-08', kind: 'CAMERA' }, { id: 'MIC-01', kind: 'MIC' }] } as never,
      }),
      query: async (text, values) => {
        state.calls.push('query');
        state.queries.push({ text, values });
        const row = state.rows[String(values[0])];
        return { rows: row === undefined ? [] : [row] };
      },
      after: (delayMs, callback) => {
        const timer = { delayMs, fire: callback, cancelled: false };
        state.timers.push(timer);
        return () => {
          timer.cancelled = true;
        };
      },
      note: (fields) => void state.notes.push({ ...fields }),
      persist: (entry) => void state.persisted.push({ ...entry }),
      record: async (entry) => {
        state.calls.push('record');
        if (state.recordFails !== null) throw state.recordFails;
        state.recorded.push(entry);
      },
    },
    limits,
    tester: () =>
      state.provided.tester
        ? {
            test: (camera, credential, signal, sourceAddress) => {
              state.calls.push('tester');
              state.contacted.push({ camera, credential, signal, sourceAddress });
              if (state.answer === 'HANG') return new Promise((resolve) => signal.addEventListener('abort', () => resolve({ outcome: CaptureConnectionOutcome.UNREACHABLE, authenticated: true, usableProfiles: [] })));
              return state.answer instanceof Error ? Promise.reject(state.answer) : Promise.resolve(state.answer);
            },
          }
        : null,
    parts: () =>
      state.provided.parts
        ? {
            reader: {
              connectionTest: (...given: unknown[]) => {
                state.calls.push('reader');
                state.reads.push({ deviceId: String(given[0]), operatorId: String(given[1]), extra: given.length - 2 });
                if (state.readerFails !== null) return Promise.reject(Object.assign(new Error(`no credential for ${ACCOUNT.username}`), { code: state.readerFails }));
                return Promise.resolve(sealCredential(ACCOUNT));
              },
            },
            storedAddress: (host, port) => {
              state.calls.push('rule');
              return REAL_RULE(host, port);
            },
          }
        : null,
  };
  return Object.assign(state, { seams, limits });
}

const failureOf = (value: unknown): { statusCode: number; code: string; reason: unknown } | null => (value instanceof ApiFailure ? { statusCode: value.statusCode, code: value.code, reason: (value.details as { reason?: unknown } | undefined)?.reason } : null);
const nextInterval = (w: World): void => {
  w.now += CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS;
};

describe('one test of an adopted camera: the stored address, the reader with its bound reason, both halves', () => {
  it('the order: stored facts, the destination rule, the reader ONCE, the tester ONCE - at the stored address, with the reader\'s own opaque credential', async () => {
    const w = world();
    const result = await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    // Row 146b: and the outcome entry LAST, once - after the reader (whose reveal entry is its own) and after the camera answered.
    expect(w.calls).toEqual(['query', 'rule', 'reader', 'tester', 'record']);
    expect(w.queries).toEqual([{ text: READ_ADOPTED_CAMERA, values: ['CAM-07'] }]);
    // The reader is handed the device and the operator of the session: no reason, no session, nothing else.
    expect(w.reads).toEqual([{ deviceId: 'CAM-07', operatorId: 'OPR-002', extra: 0 }]);
    expect(w.contacted).toHaveLength(1);
    expect(w.contacted[0]?.camera).toEqual({ adapterKind: 'ONVIF_RTSP', host: CAMERA_HOST, serviceAddress: `http://${CAMERA_HOST}/onvif/device_service`, endpointRef: ENDPOINT, vendor: null, model: null, name: null, testable: true, conflict: false });
    expect(w.contacted[0]?.credential).toBeInstanceOf(SealedCredential);
    // Row 143b: the tester is handed the camera-interface address the rule named, and binds every dial of both halves to it.
    expect(w.contacted[0]?.sourceAddress).toBe(HOST_FACTS.cameraAddresses[0]?.address);
    expect(result).toEqual({ deviceId: 'CAM-07', outcome: 'REACHABLE', authenticated: true, testedAt: w.now, usableProfileCount: 1, failedAttemptsRemaining: CAPTURE_CONNECTION_TEST_MAX_FAILURES });
    // The deadline of the whole test was asked for once and is cancelled.
    expect(w.timers.map((timer) => [timer.delayMs, timer.cancelled])).toEqual([[CAPTURE_CONNECTION_TEST_TIMEOUT_MS, true]]);
    expect(w.notes).toEqual([{ code: 'CAPTURE_STORED_CONNECTION_TESTED', source: 'captureAdoptedTest', deviceId: 'CAM-07', outcome: 'REACHABLE', guardTripped: false, testReason: null, judgedStreams: 1 }]);
    expect(w.persisted).toEqual([]);
    expect(w.limits.busy()).toBe(false);
  });

  it('THE STORED ADDRESS ONLY: the function takes a device id and nothing a caller could aim it with; a stored port travels in the service address', async () => {
    expect(testAdoptedCamera).toHaveLength(3);
    const w = world();
    w.rows['CAM-07'] = { kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address: `${CAMERA_HOST}:80`, onvif_uuid: null };
    // A caller that passes more is not heard: the fourth argument does not exist for the function.
    await (testAdoptedCamera as unknown as (...given: unknown[]) => Promise<unknown>)(w.seams, CALLER, 'CAM-07', { host: '127.0.0.1', credential: ACCOUNT });
    expect(w.contacted[0]?.camera).toMatchObject({ host: CAMERA_HOST, serviceAddress: `http://${CAMERA_HOST}:80/onvif/device_service`, endpointRef: null });
  });

  it('the stored row as a candidate: a camera of a production kind at an address of the stored form, or nothing', () => {
    const row = (patch: Partial<StoredRow>): StoredRow[] => [{ kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address: CAMERA_HOST, onvif_uuid: null, ...patch }];
    expect(adoptedCameraOf(row({}))?.host).toBe(CAMERA_HOST);
    for (const rows of [[], [...row({}), ...row({})], [null], ['CAM-07'], row({ kind: 'MIC' }), row({ adapter_kind: 'FAKE' }), row({ adapter_kind: 'LOCAL_CAMERA' }), row({ adapter_kind: 'NOT_A_KIND' }), row({ address: null }), row({ address: '' }), row({ address: `http://${CAMERA_HOST}` }), row({ address: `${CAMERA_HOST}/x` })]) {
      expect(adoptedCameraOf(rows as unknown[]), JSON.stringify(rows)).toBeNull();
    }
  });
});

describe('every refusal comes BEFORE the reveal: 0 reads of the credential, 0 requests, the bounds untouched', () => {
  const untouched = (w: World): void => {
    expect(w.reads).toEqual([]);
    expect(w.contacted).toEqual([]);
    expect(w.limits.busy()).toBe(false);
    expect(w.limits.refusal(CAMERA_HOST, 'SESSION-A')).toBeNull();
    expect(w.limits.remaining(CAMERA_HOST)).toBe(CAPTURE_CONNECTION_TEST_MAX_FAILURES);
  };

  it('a session is open: 409 CAPTURE_CONFIG_LOCKED; a seam is missing: 503; no such camera, or a microphone: 404 - nothing is read at all', async () => {
    const open = world();
    open.sessionOpen = true;
    expect(failureOf(await outcomeOf(testAdoptedCamera(open.seams, CALLER, 'CAM-07')))).toMatchObject({ statusCode: 409, code: 'CAPTURE_CONFIG_LOCKED' });
    expect(open.calls).toEqual([]);
    untouched(open);
    for (const missing of ['parts', 'tester'] as const) {
      const w = world();
      w.provided[missing] = false;
      expect(failureOf(await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07'))), missing).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'DISCOVERY_NOT_READY' });
      expect(w.calls).toEqual([]);
      untouched(w);
    }
    const w = world();
    for (const deviceId of ['CAM-99', 'MIC-01', '', "CAM-07' OR '1'='1"]) expect(failureOf(await outcomeOf(testAdoptedCamera(w.seams, CALLER, deviceId))), deviceId).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
    expect(w.calls).toEqual([]);
    untouched(w);
  });

  it('a stored row that is no production camera at an address of the stored form: 409 CANDIDATE_NOT_TESTABLE; the rule is not even asked', async () => {
    for (const row of [undefined, { kind: 'CAMERA', adapter_kind: 'FAKE', address: '127.0.0.1:8564', onvif_uuid: null }, { kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address: null, onvif_uuid: null }, { kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address: `${CAMERA_HOST}/path`, onvif_uuid: null }]) {
      const w = world();
      w.rows['CAM-08'] = row;
      expect(failureOf(await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-08'))), JSON.stringify(row)).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', reason: 'CANDIDATE_NOT_TESTABLE' });
      expect(w.calls).toEqual(['query']);
      untouched(w);
    }
  });

  it('AD-02 (1): a stored loopback, link-local, public, out-of-subnet or host address is refused by the REAL rule - 0 reveals, 0 requests; said by the rule\'s code in the log and the error log, never by the address', async () => {
    const classes: readonly (readonly [string, string])[] = [
      ['127.0.0.1:8557', 'LOOPBACK'],
      ['0.0.0.0', 'UNSPECIFIED'],
      ['169.254.10.20', 'LINK_LOCAL'],
      ['224.0.0.251', 'MULTICAST'],
      ['192.168.50.1', 'HOST_ADDRESS'],
      ['8.8.8.8', 'PUBLIC_ADDRESS'],
      ['192.168.60.20', 'OUTSIDE_CAMERA_SUBNET'],
      ['10.20.0.77', 'OTHER_INTERFACE_SUBNET'],
      ['camera.room.example', 'HOST_NAME'],
      [`${CAMERA_HOST}:8080`, 'PORT_NOT_LISTED'],
    ];
    for (const [address, refusal] of classes) {
      const w = world();
      w.rows['CAM-07'] = { kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address, onvif_uuid: null };
      const error = await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07'));
      expect(failureOf(error), address).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', reason: 'CANDIDATE_NOT_TESTABLE' });
      expect(w.calls, address).toEqual(['query', 'rule']);
      expect(w.notes).toEqual([{ code: 'CAPTURE_STORED_TEST_ADDRESS_REFUSED', source: 'captureAdoptedTest', deviceId: 'CAM-07', refusal }]);
      expect(w.persisted).toEqual([{ code: 'CAPTURE_STORED_TEST_ADDRESS_REFUSED', message: expect.any(String), context: { deviceId: 'CAM-07', refusal } }]);
      const host = address.replace(/:[0-9]+$/, '');
      expect(`${everything(error)}${JSON.stringify([w.notes, w.persisted])}`.includes(host), address).toBe(false);
      expect(w.reads).toEqual([]);
      expect(w.contacted).toEqual([]);
      expect(w.limits.busy()).toBe(false);
      expect(w.timers).toEqual([]);
    }
  });

  it('the rule is asked at EVERY test, about what is stored then: a row moved to loopback after a passed test is refused, with no second reveal', async () => {
    const w = world();
    expect(await testAdoptedCamera(w.seams, CALLER, 'CAM-07')).toMatchObject({ outcome: 'REACHABLE' });
    nextInterval(w);
    w.rows['CAM-07'] = { kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address: '127.0.0.1', onvif_uuid: ENDPOINT };
    expect(failureOf(await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07')))).toMatchObject({ reason: 'CANDIDATE_NOT_TESTABLE' });
    expect(w.reads).toHaveLength(1);
    expect(w.contacted).toHaveLength(1);
  });

  // Task 4 row 143b (S13-11 point 2): the SOURCE half. A rule that admits the address and names no camera-interface
  // address to connect FROM gives the test nothing to dial with: it is refused as a refused address, before the reveal.
  it('row 143b: an admission that names no source address is 409 CANDIDATE_NOT_TESTABLE - 0 reveals, 0 requests, said as `STORED_ADDRESS_SOURCE_ABSENT`', async () => {
    for (const admission of [{ allowed: true }, { allowed: true, destination: { address: CAMERA_HOST } }, { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: '0.0.0.0' } }, { allowed: true, destination: { address: CAMERA_HOST, sourceAddress: 'camera-interface' } }]) {
      const w = world();
      const reader = w.seams.parts()?.reader;
      if (reader === undefined) throw new Error('the world has no reader');
      const seams: AdoptedCameraTestSeams = { ...w.seams, parts: () => ({ reader, storedAddress: (() => admission) as unknown as StoredCameraAddressRule }) };
      expect(failureOf(await outcomeOf(testAdoptedCamera(seams, CALLER, 'CAM-07')))).toMatchObject({ statusCode: 409, reason: 'CANDIDATE_NOT_TESTABLE' });
      expect(w.calls).toEqual(['query']);
      expect(w.reads).toEqual([]);
      expect(w.contacted).toEqual([]);
      expect(w.persisted).toEqual([expect.objectContaining({ context: { deviceId: 'CAM-07', refusal: 'STORED_ADDRESS_SOURCE_ABSENT' } })]);
      expect(w.limits.busy()).toBe(false);
    }
  });
});

describe('the existing bounds: the SAME limits as operations 95 and 96 (AD-03 (5); AD-12, S13-04 (d))', () => {
  it('THE CELL: the camera refuses the RTSP credential twice - the guard\'s count for that host rises by 2; a third attempt is not sent; a fourth is not sent either', async () => {
    const w = world();
    w.answer = REFUSED_AT_THE_STREAM;
    expect(w.limits.remaining(CAMERA_HOST)).toBe(2);
    const first = await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    expect(first).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', authenticated: true, usableProfileCount: 0, failedAttemptsRemaining: 1 });
    // A refused credential is not the scheme refusal: no reason is told to a client.
    expect(first).not.toHaveProperty('reason');
    expect(w.limits.remaining(CAMERA_HOST)).toBe(1);
    nextInterval(w);
    const second = await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    expect(second).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', failedAttemptsRemaining: 0 });
    expect(w.limits.remaining(CAMERA_HOST)).toBe(0);
    expect(w.notes.map((note) => [note.guardTripped, note.testReason])).toEqual([
      [false, 'STREAM_CREDENTIAL_REFUSED'],
      [true, 'STREAM_CREDENTIAL_REFUSED'],
    ]);
    expect([w.reads.length, w.contacted.length]).toEqual([2, 2]);

    // The third and the fourth attempt: refused by the guard BEFORE the reveal. Nothing is read, nothing is sent.
    for (const attempt of [3, 4]) {
      nextInterval(w);
      const refused = await outcomeOf(testAdoptedCamera(w.seams, attempt === 3 ? CALLER : operator('SESSION-B', 'OPR-003'), 'CAM-07'));
      expect(failureOf(refused), `attempt ${attempt}`).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED', reason: 'CONNECTION_TEST_LOCKOUT_GUARD' });
      expect((refused as ApiFailure).headers?.['retry-after'] ?? (refused as ApiFailure).headers?.['Retry-After']).toMatch(/^[1-9][0-9]*$/);
    }
    expect([w.reads.length, w.contacted.length]).toEqual([2, 2]);
    expect(w.limits.busy()).toBe(false);
    // ONE guard for both paths: a typed test of the same host (operation 95 asks the same object) is refused too.
    expect(w.limits.refusal(CAMERA_HOST, 'ANOTHER-SESSION')).toMatchObject({ reason: 'CONNECTION_TEST_LOCKOUT_GUARD' });
    // And another host is not closed by it.
    expect(w.limits.refusal('192.168.50.21', 'ANOTHER-SESSION')).toBeNull();
    // When the window has passed the camera may be asked again - one reveal for that test.
    w.now += CAPTURE_CONNECTION_TEST_FAILURE_WINDOW_MS;
    w.answer = { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: true, usableProfiles: ['HEVC_1080P'], rejectedCredentialRequests: 0 };
    expect(await testAdoptedCamera(w.seams, CALLER, 'CAM-07')).toMatchObject({ outcome: 'REACHABLE', failedAttemptsRemaining: 2 });
    expect([w.reads.length, w.contacted.length]).toEqual([3, 3]);
  });

  it('what is counted is what the camera refused WITH the credential: both halves refused in one test count 2; a scheme refusal counts 0 and is the one reason told', async () => {
    const both = world();
    both.answer = { ...REFUSED_AT_THE_STREAM, rejectedCredentialRequests: 2 };
    expect(await testAdoptedCamera(both.seams, CALLER, 'CAM-07')).toMatchObject({ failedAttemptsRemaining: 0 });
    nextInterval(both);
    expect(failureOf(await outcomeOf(testAdoptedCamera(both.seams, CALLER, 'CAM-07')))).toMatchObject({ reason: 'CONNECTION_TEST_LOCKOUT_GUARD' });
    expect(both.reads).toHaveLength(1);

    const scheme = world();
    scheme.answer = { outcome: CaptureConnectionOutcome.AUTHENTICATION_FAILED, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 0, reason: 'SCHEME_NOT_ALLOWED' };
    expect(await testAdoptedCamera(scheme.seams, CALLER, 'CAM-07')).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', reason: 'SCHEME_NOT_ALLOWED', failedAttemptsRemaining: 2 });
    // An adapter that gives no count is counted as one: unknown is never "nothing was sent".
    const unknown = world();
    unknown.answer = { outcome: CaptureConnectionOutcome.AUTHENTICATION_FAILED, authenticated: true, usableProfiles: [] };
    expect(await testAdoptedCamera(unknown.seams, CALLER, 'CAM-07')).toMatchObject({ failedAttemptsRemaining: 1 });
  });

  it('single flight and spacing: a second test while one runs is 409, a test inside the interval is 429 - neither reads the credential', async () => {
    const w = world();
    w.answer = 'HANG';
    const running = testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    await new Promise((done) => setImmediate(done));
    expect(w.limits.busy()).toBe(true);
    w.rows['CAM-08'] = { kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address: '192.168.50.21', onvif_uuid: null };
    expect(failureOf(await outcomeOf(testAdoptedCamera(w.seams, operator('SESSION-B'), 'CAM-08')))).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', reason: 'CONNECTION_TEST_IN_PROGRESS' });
    expect(w.reads).toHaveLength(1);
    // The whole-test deadline ends the hanging test: its signal is aborted, the outcome is the contract's.
    expect(w.timers).toHaveLength(1);
    w.timers[0]?.fire();
    expect(await running).toMatchObject({ outcome: 'UNREACHABLE', usableProfileCount: 0 });
    expect(w.contacted[0]?.signal.aborted).toBe(true);
    expect(w.limits.busy()).toBe(false);
    // Inside the interval: the same host by another session, and the same session on another host.
    w.answer = REFUSED_AT_THE_STREAM;
    expect(failureOf(await outcomeOf(testAdoptedCamera(w.seams, operator('SESSION-C'), 'CAM-07')))).toMatchObject({ statusCode: 429, reason: 'CONNECTION_TEST_RATE_LIMITED' });
    expect(failureOf(await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-08')))).toMatchObject({ statusCode: 429, reason: 'CONNECTION_TEST_RATE_LIMITED' });
    expect([w.reads.length, w.contacted.length]).toEqual([1, 1]);
  });
});

describe('the read of the credential: outside any unit, one per test, and a failed read sends nothing', () => {
  it('nothing stored: 409 CREDENTIAL_REQUIRED; the reader\'s own gate: 409 not testable; any other failure: 503 - the tester is not called and the turn is given back', async () => {
    const expected: readonly (readonly [string, number, string])[] = [
      ['CAPTURE_CREDENTIAL_NOT_STORED', 409, 'CREDENTIAL_REQUIRED'],
      ['CAPTURE_CREDENTIAL_DEVICE_REFUSED', 409, 'CANDIDATE_NOT_TESTABLE'],
      ['CAPTURE_CREDENTIAL_ADDRESS_REFUSED', 409, 'CANDIDATE_NOT_TESTABLE'],
      ['CAPTURE_CREDENTIAL_REVEAL_FAILED', 503, 'CREDENTIAL_STORE_NOT_READY'],
      ['CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED', 503, 'CREDENTIAL_STORE_NOT_READY'],
      ['CAPTURE_CREDENTIAL_OPEN_FAILED', 503, 'CREDENTIAL_STORE_NOT_READY'],
      ['not a code word', 503, 'CREDENTIAL_STORE_NOT_READY'],
    ];
    for (const [code, statusCode, reason] of expected) {
      const w = world();
      w.readerFails = code;
      const error = await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07'));
      expect(failureOf(error), code).toMatchObject({ statusCode, reason });
      // Row 146c: the reader was reached, so ONE outcome entry is recorded before the refusal - UNREACHABLE, `CREDENTIAL_NOT_READ`, no count.
      expect(w.calls).toEqual(['query', 'rule', 'reader', 'record']);
      expect(w.recorded.map((entry) => entry.details), code).toEqual([{ deviceId: 'CAM-07', outcome: 'UNREACHABLE', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', unreachableReason: 'CREDENTIAL_NOT_READ', permission: 'CAPTURE_CONFIG' }]);
      expect(w.contacted).toEqual([]);
      expect(w.limits.busy()).toBe(false);
      expect(w.timers).toEqual([]);
      const cause = /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : null;
      expect(w.notes).toEqual([{ code: 'CAPTURE_STORED_TEST_CREDENTIAL_NOT_READ', source: 'captureAdoptedTest', deviceId: 'CAM-07', cause }]);
      expect(w.persisted).toEqual([{ code: 'CAPTURE_STORED_TEST_CREDENTIAL_NOT_READ', message: expect.any(String), context: { deviceId: 'CAM-07', cause } }]);
      // What the reader threw underneath does not travel: its message named a value of this file.
      expect(leaks([error, w.notes, w.persisted])).toEqual([]);
    }
  });

  it('an adapter that refuses before a request: 409 not testable, the turn given back; any other throw travels on and the turn is given back too', async () => {
    const w = world();
    w.answer = new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
    expect(failureOf(await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07')))).toMatchObject({ statusCode: 409, reason: 'CANDIDATE_NOT_TESTABLE' });
    expect(w.limits.busy()).toBe(false);
    nextInterval(w);
    w.answer = new Error('boom');
    expect(await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07'))).toMatchObject({ message: 'boom' });
    expect(w.limits.busy()).toBe(false);
    expect(w.timers.every((timer) => timer.cancelled)).toBe(true);
  });

  it('no value of the credential is in any answer, note, persisted entry or error of all the paths of this file', async () => {
    const w = world();
    const seen: unknown[] = [await testAdoptedCamera(w.seams, CALLER, 'CAM-07')];
    nextInterval(w);
    w.answer = REFUSED_AT_THE_STREAM;
    seen.push(await testAdoptedCamera(w.seams, CALLER, 'CAM-07'));
    nextInterval(w);
    w.readerFails = 'CAPTURE_CREDENTIAL_OPEN_FAILED';
    seen.push(await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07')));
    seen.push(w.notes, w.persisted);
    expect(seen.flatMap(leaks)).toEqual([]);
    // Control: the search does find the value where it is.
    expect(leaks(ACCOUNT)).toEqual([...NEEDLES]);
  });

  it('the sources: no unit of work opened in the file; one read of the credential, one call of the tester, ONE outcome entry handed to the host; the judgement, the bounds, the read, the test, the count and the entry in that order', () => {
    const [source] = codeOnly([{ path: 'adopted-test.ts', text: readFileSync(join(import.meta.dirname, '..', 'adopted-test.ts'), 'utf8') }]);
    const code = source?.text ?? '';
    expect(code.length).toBeGreaterThan(2_000);
    // A read never inside a unit of work: the file names no unit, no pipeline and no engine door, and appends nothing itself.
    expect(code).not.toMatch(/\bpipeline\b|\bnativeUnit\b|\bengineUnit\b|\bafterCommit\b|\.run\s*\(|\.audit\b|\.append\s*\(/);
    // Row 146b: ONE audit type is named, once - the outcome's; it is built by the contract's builder, once, and handed to the host's seam, once.
    expect(code.match(/\bAuditType\.[A-Z_]+/g)).toEqual(['AuditType.CAPTURE_DEVICE_CONNECTION_TESTED']);
    expect(code.match(/\bcaptureDeviceConnectionTestedDetails\(/g)).toHaveLength(1);
    expect(code.match(/\bhost\.record\(/g)).toHaveLength(1);
    // Row 146c: ONE writer, `recordOutcome`, called at the four ends of a test that reached the reader (its definition is the fifth mention).
    expect(code.match(/\brecordOutcome\(/g)).toHaveLength(5);
    const writer = code.slice(code.indexOf('async function recordOutcome('), code.indexOf('export interface AdoptedCameraTestControl'));
    expect(writer.length).toBeGreaterThan(400);
    // The writer is handed the adapter KIND and the closed facts: it sees no camera, no credential and no attempt at all.
    expect(writer).toMatch(/^async function recordOutcome\(host: AdoptedCameraTestHost, caller: AdoptedCameraTestCaller, deviceId: string, adapter: CaptureAdapterKind, facts: OutcomeFacts\): Promise<void> \{/);
    // (The word "camera" stands once, in the fixed sentence of the entry's message: no member of a camera is read.)
    expect(writer.match(/\bcamera\b/g)).toHaveLength(1);
    expect(writer).toContain('`Registered camera connection tested (${');
    expect(writer).not.toMatch(/\bcamera\s*[.[]|\battempt\b|\bsealed\b|\bserviceAddress\b|\bendpointRef\b|\bsourceAddress\b|\bstreams\b|\bvendor\b|\bmodel\b|\bname\b/);
    // The closed facts: five members, each a code, a flag or a count.
    const facts = /interface OutcomeFacts \{\n([\s\S]*?)\n\}/.exec(code)?.[1] ?? '';
    expect(facts.match(/readonly [A-Za-z]+\??: [A-Za-z]+;/g)).toEqual(['readonly outcome: CaptureConnectionOutcome;', 'readonly guardTripped?: boolean;', 'readonly reason?: CaptureConnectionTestReason;', 'readonly unreachableReason?: CaptureDeviceTestUnreachableReason;', 'readonly usableProfileCount?: number;']);
    // The builder is handed the registry id, the adapter kind, the class, those facts and the permission - nothing else.
    const built = /captureDeviceConnectionTestedDetails\(\{\n([\s\S]*?)\n {4}\}\),\n/.exec(code)?.[1] ?? '';
    expect(built.split('\n').map((line) => line.trim())).toEqual(['deviceId,', 'adapter,', 'sourceClass: CaptureSourceClass.PRODUCTION,', '...facts,', 'permission: Permission.CAPTURE_CONFIG,']);
    // Every call hands in `camera.adapterKind` and nothing else of the camera; of the attempt only its outcome, and the ONE count of the answer.
    const calls = [...code.matchAll(/await recordOutcome\(host, caller, deviceId, camera\.adapterKind, \{([\s\S]*?)\}\);\n/g)].map((match) => match[1] ?? '');
    expect(calls).toHaveLength(4);
    expect(calls.slice(0, 3).map((call) => call.trim())).toEqual([
      'outcome: CaptureConnectionOutcome.UNREACHABLE, unreachableReason: CaptureDeviceTestUnreachableReason.CREDENTIAL_NOT_READ',
      'outcome: CaptureConnectionOutcome.UNREACHABLE, unreachableReason: CaptureDeviceTestUnreachableReason.NOT_SENT',
      'outcome: CaptureConnectionOutcome.UNREACHABLE',
    ]);
    expect([...new Set(calls[3]?.match(/\battempt\.[A-Za-z]+/g))]).toEqual(['attempt.outcome']);
    expect(calls[3]).toMatch(/\n {4}usableProfileCount,\n/);
    expect(calls.join('\n')).not.toMatch(/\bsealed\b|\bcamera\b|\bserviceAddress\b|\bendpointRef\b|\bsourceAddress\b|\bstreams\b|\bvendor\b|\bmodel\b|\bname\b|\bunreachableReason: [a-z]/);
    expect(code.match(/const usableProfileCount = reachable \? attempt\.usableProfiles\.length : 0;/g)).toHaveLength(1);
    // It reads no member of a credential and composes no address of its own.
    expect(code).not.toMatch(/\.\s*(?:secret|username)\b|usingCredential|credentialAtInjection|\bhttp:|\brtsp:/);
    expect(code.match(/\bconnectionTest\s*\(/g)).toHaveLength(2); // the reader's shape and the one call
    expect(code.match(/\.reader\.connectionTest\(deviceId, caller\.principal\.operatorId\)/g)).toHaveLength(1);
    expect(code.match(/\btester\.test\(/g)).toHaveLength(1);
    const at = (text: string): number => code.indexOf(text);
    const order = [at('await host.query(READ_ADOPTED_CAMERA, [deviceId])'), at('judgeStoredCamera(camera, parts.storedAddress)'), at('limits.refusal(camera.host, sessionId)'), at('limits.begin(camera.host, sessionId)'), at('parts.reader.connectionTest('), at('unreachableReason: CaptureDeviceTestUnreachableReason.CREDENTIAL_NOT_READ'), at('tester.test(camera, sealed, deadline.signal, sourceAddress)'), at('unreachableReason: CaptureDeviceTestUnreachableReason.NOT_SENT'), at('turn.end(attempt.outcome, attempt.rejectedCredentialRequests ?? null)'), at('    outcome: attempt.outcome,'), at('await host.record(outcomeEntry)')];
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Row 146c: NO writer call stands before the reader's call - a test refused before the reader records nothing.
    expect(at('recordOutcome(')).toBeGreaterThan(at('parts.reader.connectionTest('));
    // And each refusal after the reader is thrown AFTER its entry was recorded.
    expect(code).toMatch(/CREDENTIAL_NOT_READ \}\);\n {4}if \(cause === NOT_STORED\) throw nothingStored\(\);/);
    expect(code).toMatch(/NOT_SENT \}\);\n {6}throw notTestable\(\);/);
    expect(code).toMatch(/\{ outcome: CaptureConnectionOutcome\.UNREACHABLE \}\);\n {4}throw error;/);
    // The statement: one constant, one bind parameter, a read.
    expect(READ_ADOPTED_CAMERA).toBe('SELECT kind, adapter_kind, address, onvif_uuid FROM public.capture_devices WHERE id = $1');
    expect(code).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+[a-z_.]+\s+SET|DELETE\s+FROM)\b/i);
  });
});

describe('rows 146b, 146c: the OUTCOME entry - one per test that REACHED THE READER (after the guard counted when the tester answered); never a credential, a locator or device text', () => {
  /** Past the per-minute bound of the Core as well as the spacing (seven tests run in one case). */
  const nextMinute = (w: World): void => {
    w.now += 60_000 + CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS;
  };
  // Row 146c: the count of usable profiles is stated on every entry of a test the tester answered.
  const KEYS = ['adapter', 'deviceId', 'operationId', 'outcome', 'permission', 'sourceClass', 'usableProfileCount'];

  it('a passed test: ONE entry `CAPTURE_DEVICE_CONNECTION_TESTED` - the device, the outcome, the adapter and its class, the operation, the permission; the operator as its actor; the server\'s own rule accepts it', async () => {
    const w = world();
    await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    expect(w.recorded).toEqual([
      {
        type: 'CAPTURE_DEVICE_CONNECTION_TESTED',
        message: 'Registered camera connection tested (REACHABLE)',
        actorId: 'OPR-002',
        deviceId: null,
        details: { deviceId: 'CAM-07', outcome: 'REACHABLE', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', usableProfileCount: 1, permission: 'CAPTURE_CONFIG' },
      },
    ]);
    // The closed list of the audit writer: the entry as it is, and nothing of it is a key the list does not hold.
    const entry = w.recorded[0];
    if (entry === undefined) throw new Error('no entry');
    expect(() => auditInputOf(entry)).not.toThrow();
    expect(Object.keys(entry.details ?? {}).filter((key) => !Object.hasOwn(SERVER_AUDIT_DETAIL_RULES.CAPTURE_DEVICE_CONNECTION_TESTED, key))).toEqual([]);
    // No stored address, no endpoint reference, no service address, no stream code and no value of the account is in it.
    const text = JSON.stringify(entry);
    for (const absent of [CAMERA_HOST, ENDPOINT, 'onvif', 'HEVC_1080P', 'profile_1', HOST_FACTS.cameraAddresses[0]?.address ?? '?']) expect(text.includes(absent), absent).toBe(false);
    expect(leaks(w.recorded)).toEqual([]);
  });

  it('the five outcomes: `guardTripped` only on the refused credential that closed the host; `reason` only for a credential that was NOT sent; a camera\'s own reason word never travels', async () => {
    const w = world();
    const outcomes = Object.values(CaptureConnectionOutcome);
    expect(outcomes).toHaveLength(5);
    for (const outcome of outcomes.filter((value) => value !== CaptureConnectionOutcome.AUTHENTICATION_FAILED)) {
      // A device's reason text beside the outcome: the entry has no place for it.
      w.answer = { outcome, authenticated: true, usableProfiles: outcome === CaptureConnectionOutcome.REACHABLE ? ['HEVC_1080P'] : [], rejectedCredentialRequests: 0, reason: 'STREAM_NOT_FOUND' } as ConnectionAttempt;
      await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
      nextMinute(w);
    }
    expect(w.recorded.map((entry) => [entry.details?.['outcome'], Object.keys(entry.details ?? {}).sort()])).toEqual(outcomes.filter((value) => value !== 'AUTHENTICATION_FAILED').map((outcome) => [outcome, KEYS]));
    // A scheme refusal: the credential was not sent - the reason is told, the guard is not marked.
    w.answer = { outcome: CaptureConnectionOutcome.AUTHENTICATION_FAILED, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 0, reason: 'SCHEME_NOT_ALLOWED' };
    await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    expect(w.recorded.at(-1)?.details).toEqual({ deviceId: 'CAM-07', outcome: 'AUTHENTICATION_FAILED', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', reason: 'SCHEME_NOT_ALLOWED', usableProfileCount: 0, permission: 'CAPTURE_CONFIG' });
    // Two refused credentials: the first entry carries no mark, the one that closed the host carries `guardTripped: true`.
    for (const expected of [undefined, true]) {
      nextMinute(w);
      w.answer = REFUSED_AT_THE_STREAM;
      await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
      expect(w.recorded.at(-1)?.details).toEqual({ deviceId: 'CAM-07', outcome: 'AUTHENTICATION_FAILED', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', ...(expected === true ? { guardTripped: true } : {}), usableProfileCount: 0, permission: 'CAPTURE_CONFIG' });
    }
    // Every entry of the run passes the server's rule; one per answered test.
    expect(w.recorded).toHaveLength(7);
    for (const entry of w.recorded) expect(() => auditInputOf(entry)).not.toThrow();
    expect(w.calls.filter((call) => call === 'record')).toHaveLength(w.contacted.length);
    // Row 146c: the count is the answer's own - the usable profiles of a REACHABLE test, 0 for every other answer; no entry of an answered test has `unreachableReason`.
    expect(w.recorded.map((entry) => [entry.details?.['outcome'], entry.details?.['usableProfileCount'], entry.details?.['unreachableReason'] ?? null])).toEqual([
      ['REACHABLE', 1, null],
      ['WRONG_PROFILE', 0, null],
      ['NOT_H264', 0, null],
      ['UNREACHABLE', 0, null],
      ['AUTHENTICATION_FAILED', 0, null],
      ['AUTHENTICATION_FAILED', 0, null],
      ['AUTHENTICATION_FAILED', 0, null],
    ]);
  });

  it('row 146c: a camera that did NOT ANSWER after the reveal - the deadline, a stream nobody serves, a relay that could not be started - is an answer of the tester: 200 UNREACHABLE and ONE entry, UNREACHABLE with count 0 and NO `unreachableReason`', async () => {
    const w = world();
    // What the stream half answers for each (`camera/stream-probe.ts`); its reason word is the tester's, and never travels into the entry.
    for (const reason of [StreamTestReason.STREAM_UNREACHABLE, StreamTestReason.RELAY_NOT_STARTED, StreamTestReason.DEADLINE]) {
      w.answer = { outcome: CaptureConnectionOutcome.UNREACHABLE, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 0, reason };
      expect(await testAdoptedCamera(w.seams, CALLER, 'CAM-07'), reason).toMatchObject({ outcome: 'UNREACHABLE', authenticated: true, usableProfileCount: 0, failedAttemptsRemaining: CAPTURE_CONNECTION_TEST_MAX_FAILURES });
      expect(w.recorded.at(-1), reason).toEqual({
        type: 'CAPTURE_DEVICE_CONNECTION_TESTED',
        message: 'Registered camera connection tested (UNREACHABLE)',
        actorId: 'OPR-002',
        deviceId: null,
        details: { deviceId: 'CAM-07', outcome: 'UNREACHABLE', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', usableProfileCount: 0, permission: 'CAPTURE_CONFIG' },
      });
      expect(JSON.stringify(w.recorded.at(-1)).includes(reason), reason).toBe(false);
      nextMinute(w);
    }
    // The whole-test deadline of this file, on a tester that hangs: the same entry.
    w.answer = 'HANG';
    const running = testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    await new Promise((done) => setImmediate(done));
    w.timers.at(-1)?.fire();
    expect(await running).toMatchObject({ outcome: 'UNREACHABLE' });
    expect(w.recorded).toHaveLength(4);
    expect(w.recorded.at(-1)?.details).toEqual(w.recorded[0]?.details);
    // One reveal, one request and one entry per test.
    expect([w.reads.length, w.contacted.length, w.calls.filter((call) => call === 'record').length]).toEqual([4, 4, 4]);
    for (const entry of w.recorded) expect(() => auditInputOf(entry)).not.toThrow();
  });

  it('row 146c: REFUSED BEFORE THE READER writes NOTHING (the contract: "with no audit row") - the lock, 503, 404, a row that is no production camera, a refused stored address, the spacing, single flight, the guard: 0 reads, 0 entries', async () => {
    const refusedBefore = world();
    refusedBefore.sessionOpen = true;
    await outcomeOf(testAdoptedCamera(refusedBefore.seams, CALLER, 'CAM-07'));
    refusedBefore.sessionOpen = false;
    refusedBefore.provided.parts = false;
    expect(failureOf(await outcomeOf(testAdoptedCamera(refusedBefore.seams, CALLER, 'CAM-07')))).toMatchObject({ statusCode: 503, reason: 'DISCOVERY_NOT_READY' });
    refusedBefore.provided.parts = true;
    await outcomeOf(testAdoptedCamera(refusedBefore.seams, CALLER, 'CAM-99'));
    await outcomeOf(testAdoptedCamera(refusedBefore.seams, CALLER, 'MIC-01'));
    refusedBefore.rows['CAM-08'] = { kind: 'CAMERA', adapter_kind: 'FAKE', address: '127.0.0.1:8564', onvif_uuid: null };
    expect(failureOf(await outcomeOf(testAdoptedCamera(refusedBefore.seams, CALLER, 'CAM-08')))).toMatchObject({ statusCode: 409, reason: 'CANDIDATE_NOT_TESTABLE' });
    refusedBefore.rows['CAM-07'] = { kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address: '127.0.0.1', onvif_uuid: null };
    expect(failureOf(await outcomeOf(testAdoptedCamera(refusedBefore.seams, CALLER, 'CAM-07')))).toMatchObject({ statusCode: 409, reason: 'CANDIDATE_NOT_TESTABLE' });
    expect([refusedBefore.recorded, refusedBefore.reads, refusedBefore.calls.filter((call) => call === 'record')]).toEqual([[], [], []]);

    // Single flight and the spacing: ONE test reached the reader, so ONE entry exists; the two refused ones added none.
    const bounded = world();
    bounded.answer = 'HANG';
    const running = testAdoptedCamera(bounded.seams, CALLER, 'CAM-07');
    await new Promise((done) => setImmediate(done));
    bounded.rows['CAM-08'] = { kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address: '192.168.50.21', onvif_uuid: null };
    expect(failureOf(await outcomeOf(testAdoptedCamera(bounded.seams, operator('SESSION-B'), 'CAM-08')))).toMatchObject({ statusCode: 409, reason: 'CONNECTION_TEST_IN_PROGRESS' });
    bounded.timers[0]?.fire();
    await running;
    expect(failureOf(await outcomeOf(testAdoptedCamera(bounded.seams, operator('SESSION-C'), 'CAM-07')))).toMatchObject({ statusCode: 429, reason: 'CONNECTION_TEST_RATE_LIMITED' });
    expect([bounded.reads.length, bounded.recorded.length, bounded.calls.filter((call) => call === 'record').length]).toEqual([1, 1, 1]);
  });

  it('row 146c: NO CAMERA WAS ASKED after the reader was reached - ONE entry each: a read that handed nothing on is `CREDENTIAL_NOT_READ`, an adapter that refused before a request is `NOT_SENT`, a tester that FAILED is a plain UNREACHABLE; none states a count; the refusal or the fault travels on AFTER the entry', async () => {

    // The guard and the spacing: the two tests that were answered have their entry, the refused third has none.
    const guarded = world();
    guarded.answer = { ...REFUSED_AT_THE_STREAM, rejectedCredentialRequests: 2 };
    await testAdoptedCamera(guarded.seams, CALLER, 'CAM-07');
    nextInterval(guarded);
    expect(failureOf(await outcomeOf(testAdoptedCamera(guarded.seams, CALLER, 'CAM-07')))).toMatchObject({ statusCode: 429, reason: 'CONNECTION_TEST_LOCKOUT_GUARD' });
    expect(guarded.recorded.map((entry) => entry.details?.['guardTripped'])).toEqual([true]);

    const BASE = { deviceId: 'CAM-07', outcome: 'UNREACHABLE', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', permission: 'CAPTURE_CONFIG' };
    const unread = world();
    unread.readerFails = 'CAPTURE_CREDENTIAL_NOT_STORED';
    expect(failureOf(await outcomeOf(testAdoptedCamera(unread.seams, CALLER, 'CAM-07')))).toMatchObject({ statusCode: 409, reason: 'CREDENTIAL_REQUIRED' });
    expect(unread.calls).toEqual(['query', 'rule', 'reader', 'record']);
    expect(unread.recorded).toEqual([{ type: 'CAPTURE_DEVICE_CONNECTION_TESTED', message: 'Registered camera connection tested (UNREACHABLE, CREDENTIAL_NOT_READ)', actorId: 'OPR-002', deviceId: null, details: { ...BASE, unreachableReason: 'CREDENTIAL_NOT_READ' } }]);

    // REFUSED BY THE DESTINATION RULE AFTER THE REVEAL CALL: the reader's own gate on the stored address. The same entry, then 409.
    const gated = world();
    gated.readerFails = 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED';
    expect(failureOf(await outcomeOf(testAdoptedCamera(gated.seams, CALLER, 'CAM-07')))).toMatchObject({ statusCode: 409, reason: 'CANDIDATE_NOT_TESTABLE' });
    expect(gated.recorded.map((entry) => entry.details)).toEqual([{ ...BASE, unreachableReason: 'CREDENTIAL_NOT_READ' }]);

    const notSent = world();
    notSent.answer = new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
    expect(failureOf(await outcomeOf(testAdoptedCamera(notSent.seams, CALLER, 'CAM-07')))).toMatchObject({ statusCode: 409, reason: 'CANDIDATE_NOT_TESTABLE' });
    expect(notSent.calls).toEqual(['query', 'rule', 'reader', 'tester', 'record']);
    expect(notSent.recorded).toEqual([{ type: 'CAPTURE_DEVICE_CONNECTION_TESTED', message: 'Registered camera connection tested (UNREACHABLE, NOT_SENT)', actorId: 'OPR-002', deviceId: null, details: { ...BASE, unreachableReason: 'NOT_SENT' } }]);
    // The credential WAS read for it: the log and the persistent error log say so by a code and the adapter's own code word.
    expect(notSent.notes).toEqual([{ code: ADOPTED_TEST_NOT_SENT, source: 'captureAdoptedTest', deviceId: 'CAM-07', cause: 'CAPTURE_DEVICE_UNKNOWN' }]);
    expect(notSent.persisted).toEqual([{ code: ADOPTED_TEST_NOT_SENT, message: expect.any(String), context: { deviceId: 'CAM-07', cause: 'CAPTURE_DEVICE_UNKNOWN' } }]);
    // The guard counted nothing and the turn was given back.
    expect([notSent.limits.remaining(CAMERA_HOST), notSent.limits.busy()]).toEqual([CAPTURE_CONNECTION_TEST_MAX_FAILURES, false]);

    // A FAULT of the tester: what was sent is not known - a plain UNREACHABLE, never "nothing was sent"; the fault itself travels on.
    const threw = world();
    const fault = new Error(`boom for ${ACCOUNT.username}`);
    threw.answer = fault;
    expect(await outcomeOf(testAdoptedCamera(threw.seams, CALLER, 'CAM-07'))).toBe(fault);
    expect(threw.calls).toEqual(['query', 'rule', 'reader', 'tester', 'record']);
    expect(threw.recorded).toEqual([{ type: 'CAPTURE_DEVICE_CONNECTION_TESTED', message: 'Registered camera connection tested (UNREACHABLE)', actorId: 'OPR-002', deviceId: null, details: BASE }]);
    expect(threw.notes).toEqual([{ code: ADOPTED_TEST_FAULT, source: 'captureAdoptedTest', deviceId: 'CAM-07', cause: null }]);
    expect(threw.persisted).toEqual([{ code: ADOPTED_TEST_FAULT, message: expect.any(String), context: { deviceId: 'CAM-07', cause: null } }]);

    // Every one passes the server's own rule, holds no key outside the closed list and no value of the account or the camera.
    for (const w of [unread, gated, notSent, threw]) {
      expect(w.recorded).toHaveLength(1);
      const entry = w.recorded[0];
      if (entry === undefined) throw new Error('no entry');
      expect(() => auditInputOf(entry)).not.toThrow();
      expect(Object.keys(entry.details ?? {}).filter((key) => !Object.hasOwn(SERVER_AUDIT_DETAIL_RULES.CAPTURE_DEVICE_CONNECTION_TESTED, key))).toEqual([]);
      expect(entry.details).not.toHaveProperty('usableProfileCount');
      expect([CAMERA_HOST, ENDPOINT, 'onvif', 'boom'].filter((absent) => JSON.stringify([entry, w.notes, w.persisted]).includes(absent))).toEqual([]);
      expect(leaks([w.recorded, w.notes, w.persisted])).toEqual([]);
    }
  });

  it('NO NETWORK CONFIGURATION (decision C55): the product\'s binding of the rule on a host of which nothing is known refuses the stored address - 409 CANDIDATE_NOT_TESTABLE, said as NOT_CONFIGURED; 0 reveals, 0 requests, no entry', async () => {
    const w = world();
    const unconfigured = storedCameraAddressRuleOf(undefined);
    const seams: AdoptedCameraTestSeams = { ...w.seams, limits: w.limits, parts: () => ({ reader: w.seams.parts()?.reader ?? { connectionTest: () => Promise.reject(new Error('no reader')) }, storedAddress: unconfigured }) };
    expect(failureOf(await outcomeOf(testAdoptedCamera(seams, CALLER, 'CAM-07')))).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', reason: 'CANDIDATE_NOT_TESTABLE' });
    expect(w.persisted).toEqual([{ code: 'CAPTURE_STORED_TEST_ADDRESS_REFUSED', message: expect.any(String), context: { deviceId: 'CAM-07', refusal: 'NOT_CONFIGURED' } }]);
    expect([w.reads, w.contacted, w.recorded]).toEqual([[], [], []]);
    expect(w.limits.refusal(CAMERA_HOST, 'SESSION-A')).toBeNull();
  });

  it('an outcome that cannot be recorded is a FAULT, not an answer: the failure travels on, a code goes to the log and the persistent error log, the guard has counted and the turn is given back', async () => {
    const w = world();
    w.answer = REFUSED_AT_THE_STREAM;
    w.recordFails = Object.assign(new Error(`the unit failed for ${ACCOUNT.username}`), { code: 'AUDIT_CHAIN_BUSY' });
    const error = await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07'));
    expect(error).toBe(w.recordFails);
    expect(failureOf(error)).toBeNull();
    expect(w.calls).toEqual(['query', 'rule', 'reader', 'tester', 'record']);
    expect(w.recorded).toEqual([]);
    // No "tested" line for a test whose outcome is not in the audit: the one note is the fault's, by codes only.
    expect(w.notes).toEqual([{ code: ADOPTED_TEST_OUTCOME_NOT_RECORDED, source: 'captureAdoptedTest', deviceId: 'CAM-07', outcome: 'AUTHENTICATION_FAILED', cause: 'AUDIT_CHAIN_BUSY' }]);
    expect(w.persisted).toEqual([{ code: ADOPTED_TEST_OUTCOME_NOT_RECORDED, message: expect.any(String), context: { deviceId: 'CAM-07', outcome: 'AUTHENTICATION_FAILED', cause: 'AUDIT_CHAIN_BUSY' } }]);
    expect(leaks([w.notes, w.persisted])).toEqual([]);
    // The refused credential was counted before the entry was tried: an unrecorded test does not give the host an attempt back.
    expect(w.limits.remaining(CAMERA_HOST)).toBe(CAPTURE_CONNECTION_TEST_MAX_FAILURES - 1);
    expect(w.limits.busy()).toBe(false);
    expect(w.timers.every((timer) => timer.cancelled)).toBe(true);
  });

  it('row 146c: the same on the ends where NO camera was asked - an entry that cannot be recorded travels on IN PLACE of the 409 / 503 or of the tester\'s fault, said by the code; the turn is given back', async () => {
    const unrecorded = Object.assign(new Error(`the unit failed for ${ACCOUNT.username}`), { code: 'AUDIT_CHAIN_BUSY' });
    const ends: readonly (readonly [string, (w: World) => void, readonly string[]])[] = [
      ['nothing stored', (w) => void (w.readerFails = 'CAPTURE_CREDENTIAL_NOT_STORED'), ['CAPTURE_STORED_TEST_CREDENTIAL_NOT_READ', ADOPTED_TEST_OUTCOME_NOT_RECORDED]],
      ['store not ready', (w) => void (w.readerFails = 'CAPTURE_CREDENTIAL_OPEN_FAILED'), ['CAPTURE_STORED_TEST_CREDENTIAL_NOT_READ', ADOPTED_TEST_OUTCOME_NOT_RECORDED]],
      ['adapter refused', (w) => void (w.answer = new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN)), [ADOPTED_TEST_NOT_SENT, ADOPTED_TEST_OUTCOME_NOT_RECORDED]],
      ['tester failed', (w) => void (w.answer = new Error('boom')), [ADOPTED_TEST_FAULT, ADOPTED_TEST_OUTCOME_NOT_RECORDED]],
    ];
    for (const [name, arrange, codes] of ends) {
      const w = world();
      arrange(w);
      w.recordFails = unrecorded;
      const error = await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07'));
      expect(error, name).toBe(unrecorded);
      expect(w.calls.at(-1), name).toBe('record');
      expect(w.recorded, name).toEqual([]);
      expect(w.notes.map((note) => note.code), name).toEqual(codes);
      expect(w.persisted.map((entry) => entry.code), name).toEqual(codes);
      expect(w.notes.at(-1), name).toEqual({ code: ADOPTED_TEST_OUTCOME_NOT_RECORDED, source: 'captureAdoptedTest', deviceId: 'CAM-07', outcome: 'UNREACHABLE', cause: 'AUDIT_CHAIN_BUSY' });
      expect(leaks([w.notes, w.persisted]), name).toEqual([]);
      expect(w.limits.busy(), name).toBe(false);
      expect(w.timers.every((timer) => timer.cancelled), name).toBe(true);
    }
  });
});

describe('row 146b: the route file of operation 108 - one handler, one call of the control, no body', () => {
  it('the registry entry: POST /api/v1/capture/devices/{id}/test, the access of operation 95, a path parameter, no request body; the file reads no body, no role and no credential', () => {
    const operation = captureDeviceTestOperation();
    const typed = CAPTURE_DISCOVERY_OPERATIONS.find((candidate) => candidate.operationId === 'testCaptureCandidateConnection');
    expect([operation.operationId, operation.method, operation.path, CAPTURE_DEVICE_TEST_MODULE_OPERATION]).toEqual(['testCaptureDeviceConnection', 'post', '/api/v1/capture/devices/{id}/test', 'testCaptureDeviceConnection']);
    expect(operation.access).toEqual(typed?.access);
    expect('requestBody' in operation ? operation.requestBody : undefined).toBeUndefined();
    expect(operation.pathParam?.pattern.test('CAM-01')).toBe(true);
    expect(['cam 01', '192.168.50.20', '', 'CAM-01/../x'].filter((id) => operation.pathParam?.pattern.test(id))).toEqual([]);

    const [source] = codeOnly([{ path: 'adopted-test-route.ts', text: readFileSync(join(import.meta.dirname, '..', 'adopted-test-route.ts'), 'utf8') }]);
    const code = source?.text ?? '';
    expect(code.length).toBeGreaterThan(800);
    // ONE route, ONE call of the control with the principal of the session and the id of the path - nothing else of the request.
    expect(code.match(/\broutes\.route\(/g)).toHaveLength(1);
    expect(code.match(/\bcontrol\.test\(\{ principal \}, request\.params\.id\)/g)).toHaveLength(1);
    expect(code.match(/\brequest\.[A-Za-z]+/g)).toEqual(['request.params']);
    expect(code).not.toMatch(/\bbody\b|\bquery\b|\bheaders\b|\brole\b|\bsealCredential\b|\bconnectionTest\b|\btestAdoptedCamera\b|\bjudgeStoredCamera\b|\bapp\.log\b|\bconsole\b/);
    // It maps no answer of its own: no status, no error code and no audit entry is made in this file.
    expect(code).not.toMatch(/\bApiFailure\b|\bAuditType\b|\.audit\b|\bpipeline\b|\bstatusCode\b/);
  });
});

describe('the control of an app', () => {
  it('not ready until the parts are handed in - a test answers 503 and reads nothing; handed in once; a second hand-in is refused', async () => {
    const w = world();
    const app = { stages: {} };
    const control = registerAdoptedCameraTest(app, { host: w.seams.host, limits: () => w.limits, tester: () => w.seams.tester() });
    expect(control.ready()).toBe(false);
    expect(failureOf(await outcomeOf(control.test(CALLER, 'CAM-07')))).toMatchObject({ statusCode: 503, reason: 'DISCOVERY_NOT_READY' });
    expect(w.calls).toEqual([]);
    const parts = w.seams.parts();
    if (parts === null) throw new Error('the world has parts');
    control.provide(parts);
    expect(control.ready()).toBe(true);
    expect(() => control.provide(parts)).toThrow(/provided twice/);
    expect(await control.test(CALLER, 'CAM-07')).toMatchObject({ outcome: 'REACHABLE' });
    expect(w.calls).toEqual(['query', 'rule', 'reader', 'tester', 'record']);
  });
});
