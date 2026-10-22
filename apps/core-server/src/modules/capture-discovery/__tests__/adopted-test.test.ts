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
import { READ_STORED_CAMERA_PROFILES, READ_STORED_CAMERA_STREAMS, StoredProfilesVerdict, compareStoredProfiles, storedProfilesWords } from '../adopted-profiles';
import { ADOPTED_TEST_FAULT, ADOPTED_TEST_NOT_SENT, ADOPTED_TEST_OUTCOME_NOT_RECORDED, ADOPTED_TEST_PROFILES_NOT_STORED, ADOPTED_TEST_PROFILE_DIFFERS, READ_ADOPTED_CAMERA, adoptedCameraOf, registerAdoptedCameraTest, testAdoptedCamera, type AdoptedCameraTestCaller, type AdoptedCameraTestSeams } from '../adopted-test';
import { CAPTURE_DEVICE_TEST_MODULE_OPERATION, captureDeviceTestOperation } from '../adopted-test-route';
import { INSERT_ADOPTED_CAMERA_STREAM, SET_ADOPTED_CAMERA_COLUMNS, type AdoptedCameraStream } from '../adoption';
import { createConnectionTestLimits, type ConnectionAttempt, type ConnectionTestLimits } from '../connect';

const ACCOUNT = { username: ['row146', 'unit', 'account'].join('-'), secret: ['row146', 'unit', 'placeholder', 'Vb4Ns8'].join('-') } as const;
const HOST_FACTS: DestinationContext = {
  cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.50.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 24 }],
  // R-FLEX NW-C1 (row 104): every eligible interface of the host - STORED_CAMERA is global.
  interfaceSubnets: [
    { name: 'eth0', address: '192.168.50.1', network: '192.168.50.0', prefixLength: 24 },
    { name: 'eth1', address: '10.20.0.5', network: '10.20.0.0', prefixLength: 24 },
  ],
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
/** Row PR: the stored statement of one camera, as the two tables hold it. */
type StoredStream = { profile: string; codec: unknown; width: unknown; height: unknown; onvif_profile_token?: unknown; video_source_token?: unknown; lens?: unknown; stream_role?: unknown; read_at?: unknown };
type StoredProfiles = { profiles: unknown; streams: StoredStream[]; transport?: unknown; onvif_uuid?: unknown; last_seen_at?: unknown };
const HEVC = { code: 'HEVC_1080P', codec: 'HEVC', width: 1920, height: 1080, onvifProfileToken: 'profile_1', videoSourceToken: null, lens: 1 } as const satisfies AdoptedCameraStream;
const AVC = { code: 'H264_720P25', codec: 'H264', width: 1280, height: 720, onvifProfileToken: 'profile_2', videoSourceToken: 'source_1', lens: 2 } as const satisfies AdoptedCameraStream;
// The streams as a tester hands them on. The cast admits what the type refuses on purpose: a hostile case hands in a codec that is a device's text.
const reachableWith = (...streams: AdoptedCameraStream[]): ConnectionAttempt => ({ outcome: CaptureConnectionOutcome.REACHABLE, authenticated: true, usableProfiles: streams.map((stream) => stream.code), rejectedCredentialRequests: 0, streams: streams as ConnectionAttempt['streams'] & object });
const storedOf = (...streams: AdoptedCameraStream[]): StoredProfiles => ({ profiles: streams.map((stream) => stream.code), streams: streams.map((stream) => ({ profile: stream.code, codec: stream.codec, width: stream.width, height: stream.height })) });
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
  /** Row PR: what is STORED for a camera - its profile list and its stream rows. Changed only by a unit that committed. */
  stored: Record<string, StoredProfiles | undefined>;
  /** Row PR: every statement asked INSIDE the unit of a test that judged a stream, in order. */
  readonly unitQueries: { text: string; values: unknown[] }[];
  /** Row PR: units opened for a test that judged a stream (`host.settle`). */
  settled: number;
  /** Row V7: what the engine's door was told, by units that committed: the device entry's stored profile list. */
  readonly engineLists: { deviceId: string; profiles: string[] }[];
  /** Row PR: a session that opened while the camera was being asked - seen by the unit only. */
  sessionOpensInUnit: boolean;
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
    // The default answer below judges ONE stream; what is stored for CAM-07 agrees with it (case (c): nothing is stored).
    stored: { 'CAM-07': storedOf(HEVC) },
    unitQueries: [],
    engineLists: [],
    settled: 0,
    sessionOpensInUnit: false,
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
      // Row PR: ONE unit. Its statements are answered from `stored`; its writes are kept aside and reach `stored` only
      // when the work AND the append succeeded - a unit that fails leaves nothing, as a rolled-back transaction does.
      settle: async (work) => {
        state.calls.push('record');
        state.settled += 1;
        const pending: (() => void)[] = [];
        const entry = await work({
          unit: {
            query: async (text: string, values: readonly unknown[] = []) => {
              state.unitQueries.push({ text, values: [...values] });
              const held = state.stored[String(values[0])];
              if (text === READ_STORED_CAMERA_PROFILES) return { rows: held === undefined ? [] : [{ onvif_uuid: state.rows[String(values[0])]?.onvif_uuid ?? null, profiles: held.profiles }], rowCount: held === undefined ? 0 : 1 };
              if (text === READ_STORED_CAMERA_STREAMS) return { rows: held?.streams ?? [], rowCount: held?.streams.length ?? 0 };
              if (text === SET_ADOPTED_CAMERA_COLUMNS) {
                if (held === undefined) return { rows: [], rowCount: 0 };
                pending.push(() => Object.assign(held, { transport: values[1], onvif_uuid: values[2], profiles: JSON.parse(String(values[3])) as unknown, last_seen_at: values[4] }));
                return { rows: [], rowCount: 1 };
              }
              if (text === INSERT_ADOPTED_CAMERA_STREAM) {
                pending.push(() => void held?.streams.push({ profile: String(values[1]), onvif_profile_token: values[2], video_source_token: values[3], lens: values[4], stream_role: values[5], codec: values[6], width: values[7], height: values[8], read_at: values[9] }));
                return { rows: [], rowCount: 1 };
              }
              throw new Error('a statement the unit of a connection test does not make');
            },
          } as never,
          pending: () => ({ session: state.sessionOpen || state.sessionOpensInUnit ? ({ state: 'RECORDING' } as never) : null }),
          // Row V7: the engine's door for the device entry's list, bound to the unit. Kept aside like a write: it
          // reaches `engineLists` only when the unit committed.
          storeProfiles: async (change) => {
            const said = { deviceId: change.deviceId, profiles: [...change.profiles] };
            pending.push(() => void state.engineLists.push(said));
          },
        });
        if (state.recordFails !== null) throw state.recordFails;
        for (const apply of pending) apply();
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
      // R-FLEX (row 104): STORED_CAMERA is global - a private address no interface holds is NW-R1 (was OUTSIDE_CAMERA_SUBNET);
      // another interface's subnet (was OTHER_INTERFACE_SUBNET) is admitted from that interface (RM-N1), asserted below.
      ['192.168.60.20', 'NO_SOURCE_INTERFACE'],
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
    expect(REAL_RULE('10.20.0.77', undefined)).toMatchObject({ allowed: true, destination: { address: '10.20.0.77', sourceAddress: '10.20.0.5', viaAlias: false } });
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
    // The closed facts: five members, each a code, a flag or a count - and, since row V7 (request of row PR), the closed word of the stored profiles with its three counts.
    const facts = /interface OutcomeFacts \{\n([\s\S]*?)\n\}/.exec(code)?.[1] ?? '';
    expect(facts.match(/readonly [A-Za-z]+\??: [A-Za-z]+;/g)).toEqual([
      'readonly outcome: CaptureConnectionOutcome;',
      'readonly guardTripped?: boolean;',
      'readonly reason?: CaptureConnectionTestReason;',
      'readonly unreachableReason?: CaptureDeviceTestUnreachableReason;',
      'readonly usableProfileCount?: number;',
      'readonly profiles?: CaptureDeviceTestProfiles;',
      'readonly storedProfileCount?: number;',
      'readonly statedProfileCount?: number;',
      'readonly differingProfileCount?: number;',
    ]);
    // The builder is handed the registry id, the adapter kind, the class, those facts and the permission - nothing else.
    const built = /captureDeviceConnectionTestedDetails\(\{\n([\s\S]*?)\n {4}\}\),\n/.exec(code)?.[1] ?? '';
    expect(built.split('\n').map((line) => line.trim())).toEqual(['deviceId,', 'adapter,', 'sourceClass: CaptureSourceClass.PRODUCTION,', '...facts,', 'permission: Permission.CAPTURE_CONFIG,']);
    // Every call hands in `camera.adapterKind` and nothing else of the camera; of the attempt only its outcome, and the ONE count of the answer.
    const calls = [...code.matchAll(/await recordOutcome\(host, caller, deviceId, camera\.adapterKind, \{([\s\S]*?)\}\);\n/g)].map((match) => match[1] ?? '');
    // Row PR (C117): the facts of the FOURTH end - the tester answered - are ONE object, handed to exactly one of two
    // writers: `settleOutcome` when a stream was judged (the entry in the unit that meets what is stored), else `recordOutcome`.
    expect(calls).toHaveLength(3);
    expect(calls.slice(0, 3).map((call) => call.trim())).toEqual([
      'outcome: CaptureConnectionOutcome.UNREACHABLE, unreachableReason: CaptureDeviceTestUnreachableReason.CREDENTIAL_NOT_READ',
      'outcome: CaptureConnectionOutcome.UNREACHABLE, unreachableReason: CaptureDeviceTestUnreachableReason.NOT_SENT',
      'outcome: CaptureConnectionOutcome.UNREACHABLE',
    ]);
    calls[3] = /const facts: OutcomeFacts = \{([\s\S]*?)\n {2}\};\n/.exec(code)?.[1] ?? '';
    expect([...new Set(calls[3]?.match(/\battempt\.[A-Za-z]+/g))]).toEqual(['attempt.outcome']);
    expect(calls[3]).toMatch(/\n {4}usableProfileCount,$/);
    expect(code).toMatch(/const profiles = stated\.length === 0 \? null : await settleOutcome\(host, caller, deviceId, camera\.adapterKind, facts, stated, testedAt\);\n {2}if \(profiles === null\) await recordOutcome\(host, caller, deviceId, camera\.adapterKind, facts\);\n/);
    // The unit of a test that judged a stream is the host's, asked ONCE; the file still appends nothing and holds no statement.
    expect(code.match(/\bhost\.settle\(/g)).toHaveLength(1);
    expect(code.match(/\boutcomeEntryOf\(/g)).toHaveLength(3); // its definition and one call in each writer
    expect(code.match(/\bsettleStatedProfiles\(/g)).toHaveLength(1);
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

// ── Row PR (wave 12; decision C117; rulings C36, C61 (1); AD-06) ────────────────────────────────────
// What a test that JUDGED A STREAM does with what is stored for the camera. The unit is the world's
// `settle`: its statements are answered from `stored`, and its writes reach `stored` only when the
// work and the append succeeded. MUTATIONS each case was seen RED on are named in the case.
describe('row PR (C117): a test that judged a stream meets what is stored - nothing stored: it is stored; another statement stored: nothing is; the same: nothing', () => {
  const DETAILS = (count: number): Record<string, unknown> => ({ deviceId: 'CAM-07', outcome: 'REACHABLE', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', usableProfileCount: count, permission: 'CAPTURE_CONFIG' });
  const writesOf = (w: World): string[] => w.unitQueries.map((query) => query.text).filter((text) => text === SET_ADOPTED_CAMERA_COLUMNS || text === INSERT_ADOPTED_CAMERA_STREAM);
  const emptyWorld = (): World => {
    const w = world();
    w.stored = { 'CAM-07': { profiles: [], streams: [] } };
    return w;
  };

  it('(a) NO STORED PROFILE: the judged statement is stored by the adoption\'s own statements - the list, then one stream row per stream - in the unit of the ONE outcome entry, whose message says how many; the answer and the details are the contract\'s', async () => {
    // RED ON: `compareStoredProfiles` answering PROFILES_AGREE for an empty list (nothing written); `settleStatedProfiles`
    // returning before `writeAdoptedCameraColumns` (the list stays empty); `storedProfilesWords` answering '' (the message).
    const w = emptyWorld();
    w.answer = reachableWith(HEVC, AVC);
    const answer = await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    // Row V7 (request of row PR): the answer SAYS that the profiles were stored, in the contract's closed word.
    expect(answer).toEqual({ deviceId: 'CAM-07', outcome: 'REACHABLE', authenticated: true, testedAt: w.now, usableProfileCount: 2, failedAttemptsRemaining: CAPTURE_CONNECTION_TEST_MAX_FAILURES, profiles: 'PROFILES_STORED' });
    // Row V7: the engine's door was told the SAME codes, in the order written, in that unit - the device entry every client reads.
    // MUTATION SEEN RED: `settleStatedProfiles` without its call of `scope.storeProfiles`.
    expect(w.engineLists).toEqual([{ deviceId: 'CAM-07', profiles: ['HEVC_1080P', 'H264_720P25'] }]);
    // The statements of the unit, in order: the two reads, the adoption's UPDATE, one INSERT per stream. Nothing else.
    expect(w.unitQueries.map((query) => query.text)).toEqual([READ_STORED_CAMERA_PROFILES, READ_STORED_CAMERA_STREAMS, SET_ADOPTED_CAMERA_COLUMNS, INSERT_ADOPTED_CAMERA_STREAM, INSERT_ADOPTED_CAMERA_STREAM]);
    // The adoption's statement with the transport it stores, the endpoint reference the row ALREADY holds, the minted codes.
    expect(w.unitQueries[2]?.values).toEqual(['CAM-07', 'RTSP', ENDPOINT, JSON.stringify(['HEVC_1080P', 'H264_720P25']), w.now]);
    expect(w.unitQueries.slice(3).map((query) => query.values)).toEqual([
      ['CAM-07', 'HEVC_1080P', 'profile_1', null, 1, 'MAIN', 'HEVC', 1920, 1080, w.now],
      ['CAM-07', 'H264_720P25', 'profile_2', 'source_1', 2, 'MAIN', 'H264', 1280, 720, w.now],
    ]);
    expect(w.stored['CAM-07']?.profiles).toEqual(['HEVC_1080P', 'H264_720P25']);
    expect(w.stored['CAM-07']?.streams.map((stream) => [stream.profile, stream.codec, stream.width, stream.height])).toEqual([['HEVC_1080P', 'HEVC', 1920, 1080], ['H264_720P25', 'H264', 1280, 720]]);
    // EXACTLY ONE outcome entry, by the unit (never beside `record`): the contract's details, and the message says "stored".
    expect(w.settled).toBe(1);
    expect(w.calls.filter((call) => call === 'record')).toHaveLength(1);
    expect(w.recorded).toEqual([{ type: 'CAPTURE_DEVICE_CONNECTION_TESTED', message: 'Registered camera connection tested (REACHABLE); profiles stored: 2', actorId: 'OPR-002', deviceId: null, details: { ...DETAILS(2), profiles: 'PROFILES_STORED', storedProfileCount: 0, statedProfileCount: 2, differingProfileCount: 0 } }]);
    const entry = w.recorded[0];
    if (entry === undefined) throw new Error('no entry');
    expect(() => auditInputOf(entry)).not.toThrow();
    // The log line says it in a code and counts; nothing goes to the error log: a stored statement is no fault.
    expect(w.notes).toEqual([{ code: 'CAPTURE_STORED_CONNECTION_TESTED', source: 'captureAdoptedTest', deviceId: 'CAM-07', outcome: 'REACHABLE', guardTripped: false, testReason: null, judgedStreams: 2, profiles: 'PROFILES_STORED', storedProfiles: 0, differingProfiles: 0, profilesCause: null }]);
    expect(w.persisted).toEqual([]);
    // No code of a stream, no token and no address is in the entry, the note or the answer.
    for (const absent of ['HEVC_1080P', 'H264_720P25', 'profile_1', 'source_1', CAMERA_HOST, ENDPOINT]) expect(JSON.stringify([w.recorded, w.notes, answer]).includes(absent), absent).toBe(false);

    // THE SECOND TEST of the same camera: what was stored agrees - case (c), nothing written, the entry of rows 146b / 146c.
    nextInterval(w);
    const before = w.unitQueries.length;
    await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    expect(w.unitQueries.slice(before).map((query) => query.text)).toEqual([READ_STORED_CAMERA_PROFILES, READ_STORED_CAMERA_STREAMS]);
    expect(w.recorded[1]?.message).toBe('Registered camera connection tested (REACHABLE)');
    expect(w.stored['CAM-07']?.streams).toHaveLength(2);
  });

  it('(a) is ONE unit with its entry: an entry that cannot be appended leaves NOTHING stored - the fault of rows 146b / 146c, by its code; the next test stores', async () => {
    // RED ON: the world's unit applying its writes before the append (a store outside the entry's unit would look like that).
    const w = emptyWorld();
    w.recordFails = Object.assign(new Error('the unit did not commit'), { code: 'AUDIT_APPEND_FAILED' });
    const failed = await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07'));
    expect(failed).toBe(w.recordFails);
    expect(writesOf(w)).toEqual([SET_ADOPTED_CAMERA_COLUMNS, INSERT_ADOPTED_CAMERA_STREAM]);
    expect(w.stored['CAM-07']).toEqual({ profiles: [], streams: [] });
    // Row V7: the device entry is told nothing by a unit that did not commit.
    expect(w.engineLists).toEqual([]);
    expect(w.recorded).toEqual([]);
    expect(w.persisted).toEqual([{ code: ADOPTED_TEST_OUTCOME_NOT_RECORDED, message: expect.any(String) as unknown, context: { deviceId: 'CAM-07', outcome: 'REACHABLE', cause: 'AUDIT_APPEND_FAILED' } }]);
    expect(w.limits.busy()).toBe(false);
    w.recordFails = null;
    nextInterval(w);
    await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    expect(w.stored['CAM-07']?.profiles).toEqual(['HEVC_1080P']);
    expect(w.recorded.map((entry) => entry.message)).toEqual(['Registered camera connection tested (REACHABLE); profiles stored: 1']);
  });

  it('(b) A STORED STATEMENT AND A STREAM THAT STATES SOMETHING ELSE: nothing is stored - another set, another picture or codec for a code, a listed code with no stream row; ONE entry with `STREAM_PROFILE_DIFFERS` and three counts, one code in the error log; the outcome stays the test\'s own', async () => {
    // RED ON: `compareStoredProfiles` never counting a difference (PROFILES_AGREE for every non-empty list: no word, no
    // error-log code); the comparison dropping the width / height / codec test (the second and third rows below);
    // a "replace what differs" mutant - `settleStatedProfiles` writing when the verdict is the difference (the writes).
    const OTHER_PICTURE: AdoptedCameraStream = { ...HEVC, width: 2560, height: 1440 };
    const cases: { name: string; stored: StoredProfiles; stated: AdoptedCameraStream[]; counts: [number, number, number] }[] = [
      { name: 'another set of codes', stored: storedOf(HEVC), stated: [AVC], counts: [1, 1, 2] },
      { name: 'one more stream than is stored', stored: storedOf(HEVC), stated: [HEVC, AVC], counts: [1, 2, 1] },
      { name: 'one stream fewer than is stored', stored: storedOf(HEVC, AVC), stated: [HEVC], counts: [2, 1, 1] },
      { name: 'the same code, another picture', stored: storedOf(HEVC), stated: [OTHER_PICTURE], counts: [1, 1, 1] },
      { name: 'the same code, another codec in its row', stored: { profiles: ['HEVC_1080P'], streams: [{ profile: 'HEVC_1080P', codec: 'H264', width: 1920, height: 1080 }] }, stated: [HEVC], counts: [1, 1, 1] },
      { name: 'a listed code with NO stream row (C61 (1): a kept string no stream stated)', stored: { profiles: ['HEVC_1080P'], streams: [] }, stated: [HEVC], counts: [1, 1, 1] },
      { name: 'an EMPTY list beside a stream row: a stored statement too, not written over', stored: { profiles: [], streams: [{ profile: 'HEVC_1080P', codec: 'HEVC', width: 1920, height: 1080 }] }, stated: [HEVC], counts: [0, 1, 1] },
      { name: 'a column that is no list of codes', stored: { profiles: ['profile_1'], streams: [] }, stated: [HEVC], counts: [0, 1, 1] },
    ];
    for (const one of cases) {
      const w = world();
      w.stored = { 'CAM-07': structuredClone(one.stored) };
      w.answer = reachableWith(...one.stated);
      const answer = await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
      const [stored, stated, differing] = one.counts;
      // The outcome is the test's own, and the count is what the stream states NOW. Row V7 (request of row PR): the contract
      // has a member for the word since that row - the answer and the entry's details say `STREAM_PROFILE_DIFFERS`.
      expect(answer, one.name).toEqual({ deviceId: 'CAM-07', outcome: 'REACHABLE', authenticated: true, testedAt: w.now, usableProfileCount: one.stated.length, failedAttemptsRemaining: CAPTURE_CONNECTION_TEST_MAX_FAILURES, profiles: 'STREAM_PROFILE_DIFFERS' });
      expect(w.engineLists, one.name).toEqual([]);
      expect(writesOf(w), one.name).toEqual([]);
      expect(w.stored['CAM-07'], one.name).toEqual(one.stored);
      expect(w.recorded, one.name).toEqual([
        { type: 'CAPTURE_DEVICE_CONNECTION_TESTED', message: `Registered camera connection tested (REACHABLE); STREAM_PROFILE_DIFFERS: stored ${String(stored)}, stated ${String(stated)}, differing ${String(differing)}; nothing stored`, actorId: 'OPR-002', deviceId: null, details: { ...DETAILS(one.stated.length), profiles: 'STREAM_PROFILE_DIFFERS', storedProfileCount: stored, statedProfileCount: stated, differingProfileCount: differing } },
      ]);
      expect(w.notes.at(-1), one.name).toMatchObject({ profiles: 'STREAM_PROFILE_DIFFERS', storedProfiles: stored, differingProfiles: differing, judgedStreams: one.stated.length });
      expect(w.persisted, one.name).toEqual([{ code: ADOPTED_TEST_PROFILE_DIFFERS, message: expect.any(String) as unknown, context: { deviceId: 'CAM-07', cause: null, stored: String(stored), stated: String(stated), differing: String(differing) } }]);
      // Counts only: no code of either statement is in the entry, the note or the persisted line.
      for (const absent of ['HEVC_1080P', 'H264_720P25', 'profile_1', '2560', '1440']) expect(JSON.stringify([w.recorded, w.notes, w.persisted]).includes(absent), `${one.name}: ${absent}`).toBe(false);
    }
  });

  it('(c) STORED AND STATED AGREE: nothing is stored and nothing is said - the entry, the note and the error log of rows 146b / 146c, with two reads in the unit; the ORDER of the list does not matter', async () => {
    // RED ON: `compareStoredProfiles` comparing the lists by position (the reversed list below read as a difference).
    const w = world();
    w.stored = { 'CAM-07': { profiles: ['H264_720P25', 'HEVC_1080P'], streams: storedOf(HEVC, AVC).streams } };
    w.answer = reachableWith(HEVC, AVC);
    const kept = structuredClone(w.stored['CAM-07']);
    await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    expect(w.unitQueries.map((query) => query.text)).toEqual([READ_STORED_CAMERA_PROFILES, READ_STORED_CAMERA_STREAMS]);
    expect(w.stored['CAM-07']).toEqual(kept);
    expect(w.recorded).toEqual([{ type: 'CAPTURE_DEVICE_CONNECTION_TESTED', message: 'Registered camera connection tested (REACHABLE)', actorId: 'OPR-002', deviceId: null, details: DETAILS(2) }]);
    expect(w.notes).toEqual([{ code: 'CAPTURE_STORED_CONNECTION_TESTED', source: 'captureAdoptedTest', deviceId: 'CAM-07', outcome: 'REACHABLE', guardTripped: false, testReason: null, judgedStreams: 2 }]);
    expect(w.persisted).toEqual([]);
  });

  it('A TEST THAT JUDGED NO STREAM compares nothing and stores nothing: the four other outcomes, and REACHABLE by the ONVIF half alone (a Core without a relay program) - no unit of the store is opened, the entry goes by `record`', async () => {
    // RED ON: `stated` read from `attempt.streams` whatever the outcome (the first row below would store a stream of a
    // camera that refused the credential); `stated.length === 0 ? null :` dropped (a unit opened for no stream).
    const answers: ConnectionAttempt[] = [
      { outcome: CaptureConnectionOutcome.AUTHENTICATION_FAILED, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 1, streams: [HEVC] },
      { outcome: CaptureConnectionOutcome.WRONG_PROFILE, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 0, streams: [HEVC] },
      { outcome: CaptureConnectionOutcome.NOT_H264, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 0, streams: [HEVC] },
      { outcome: CaptureConnectionOutcome.UNREACHABLE, authenticated: true, usableProfiles: [], rejectedCredentialRequests: 0, streams: [HEVC] },
      // The ONVIF half's own answer: tokens of the camera as `usableProfiles`, and NO judged stream. No code exists (C36).
      { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: true, usableProfiles: ['profile_1', 'profile_2'], rejectedCredentialRequests: 0 },
      { outcome: CaptureConnectionOutcome.REACHABLE, authenticated: true, usableProfiles: ['profile_1'], rejectedCredentialRequests: 0, streams: [] },
    ];
    const w = emptyWorld();
    for (const answer of answers) {
      w.answer = answer;
      await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
      w.now += 60_000 + CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS;
    }
    expect(w.settled).toBe(0);
    expect(w.unitQueries).toEqual([]);
    expect(w.stored['CAM-07']).toEqual({ profiles: [], streams: [] });
    expect(w.recorded.map((entry) => entry.message)).toEqual(['AUTHENTICATION_FAILED', 'WRONG_PROFILE', 'NOT_H264', 'UNREACHABLE', 'REACHABLE', 'REACHABLE'].map((outcome) => `Registered camera connection tested (${outcome})`));
    expect(w.recorded).toHaveLength(answers.length);
  });

  it('EVERY REFUSAL IS UNCHANGED and reaches no unit: before the reader (the lock, 503, 404, not a production camera, a refused address, the spacing, the guard) 0 entries; after it (nothing read, not sent, a fault) ONE entry by `record` - a camera WITHOUT a stored profile gets none from a test that asked no camera', async () => {
    // RED ON: the settle call moved before the reader (a unit opened for a refused test).
    const refused: { name: string; arrange(w: World): void; status: number | null; entries: number }[] = [
      { name: 'a session is open', arrange: (w) => void (w.sessionOpen = true), status: 409, entries: 0 },
      { name: 'no parts', arrange: (w) => void (w.provided.parts = false), status: 503, entries: 0 },
      { name: 'no tester', arrange: (w) => void (w.provided.tester = false), status: 503, entries: 0 },
      { name: 'not a production camera', arrange: (w) => void (w.rows['CAM-07'] = { kind: 'CAMERA', adapter_kind: 'FAKE', address: CAMERA_HOST, onvif_uuid: null }), status: 409, entries: 0 },
      { name: 'a stored loopback address', arrange: (w) => void (w.rows['CAM-07'] = { kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', address: '127.0.0.1', onvif_uuid: ENDPOINT }), status: 409, entries: 0 },
      { name: 'nothing stored for the credential', arrange: (w) => void (w.readerFails = 'CAPTURE_CREDENTIAL_NOT_STORED'), status: 409, entries: 1 },
      { name: 'the store not readable', arrange: (w) => void (w.readerFails = 'CAPTURE_CREDENTIAL_REVEAL_FAILED'), status: 503, entries: 1 },
      { name: 'the adapter refused before a request', arrange: (w) => void (w.answer = new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'refused')), status: 409, entries: 1 },
      { name: 'the tester failed', arrange: (w) => void (w.answer = new Error('a fault')), status: null, entries: 1 },
    ];
    for (const one of refused) {
      const w = emptyWorld();
      one.arrange(w);
      const outcome = await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07'));
      expect(failureOf(outcome)?.statusCode ?? null, one.name).toBe(one.status);
      expect(w.recorded, one.name).toHaveLength(one.entries);
      expect([w.settled, w.unitQueries.length], one.name).toEqual([0, 0]);
      expect(w.stored['CAM-07'], one.name).toEqual({ profiles: [], streams: [] });
    }
    // 404, the spacing (429) and the lock-out guard (429): the same.
    const w = emptyWorld();
    expect(failureOf(await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-99')))?.statusCode).toBe(404);
    await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    const after = { settled: w.settled, entries: w.recorded.length };
    expect(failureOf(await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07')))).toMatchObject({ statusCode: 429, reason: 'CONNECTION_TEST_RATE_LIMITED' });
    w.answer = REFUSED_AT_THE_STREAM;
    for (let attempt = 0; attempt < CAPTURE_CONNECTION_TEST_MAX_FAILURES; attempt += 1) {
      w.now += 60_000 + CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS;
      await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
    }
    w.now += 60_000 + CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS;
    w.answer = reachableWith(HEVC, AVC);
    expect(failureOf(await outcomeOf(testAdoptedCamera(w.seams, CALLER, 'CAM-07')))).toMatchObject({ statusCode: 429, reason: 'CONNECTION_TEST_LOCKOUT_GUARD' });
    expect(w.settled).toBe(after.settled);
    expect(w.recorded).toHaveLength(after.entries + CAPTURE_CONNECTION_TEST_MAX_FAILURES);
    expect(w.stored['CAM-07']?.profiles).toEqual(['HEVC_1080P']);
  });

  it('(a) WAS DUE AND NOTHING IS WRITTEN: a session that opened while the camera was asked, a row that is gone, a judged stream outside the bounds of its table - `PROFILES_NOT_STORED` with a closed cause, the plain entry, one code in the error log; the test keeps its outcome', async () => {
    // RED ON: the session check of the unit removed (the first row stores under an open session); `assertAdoptedProfiles`
    // not asked before the statement (the third row: the adoption's refusal would fail the unit - a fault, not an answer).
    const ends: { name: string; arrange(w: World): void; cause: string; stated: number }[] = [
      { name: 'a session opened meanwhile', arrange: (w) => void (w.sessionOpensInUnit = true), cause: 'SESSION_ACTIVE', stated: 1 },
      { name: 'the row is gone', arrange: (w) => void (w.stored = {}), cause: 'ROW_ABSENT', stated: 1 },
      { name: 'a lens outside 1 to 4', arrange: (w) => void (w.answer = reachableWith({ ...HEVC, lens: 5 })), cause: 'STREAM_OUT_OF_BOUNDS', stated: 1 },
      { name: 'two streams of one code', arrange: (w) => void (w.answer = reachableWith(HEVC, { ...HEVC, onvifProfileToken: 'profile_9' })), cause: 'STREAM_OUT_OF_BOUNDS', stated: 2 },
    ];
    for (const one of ends) {
      const w = emptyWorld();
      one.arrange(w);
      const answer = await testAdoptedCamera(w.seams, CALLER, 'CAM-07');
      expect(answer.outcome, one.name).toBe('REACHABLE');
      expect(writesOf(w), one.name).toEqual([]);
      expect(w.recorded.map((entry) => entry.message), one.name).toEqual(['Registered camera connection tested (REACHABLE)']);
      expect(w.notes.at(-1), one.name).toMatchObject({ profiles: 'PROFILES_NOT_STORED', profilesCause: one.cause });
      expect(w.persisted, one.name).toEqual([{ code: ADOPTED_TEST_PROFILES_NOT_STORED, message: expect.any(String) as unknown, context: { deviceId: 'CAM-07', cause: one.cause, stored: '0', stated: String(one.stated), differing: '0' } }]);
    }
  });

  it('AD-06, the hostile descriptions of row 154 on THIS path: a stream whose code, token, codec or picture is a device\'s text - markup, lower case, 300 characters - is never stored and is in no entry, note, persisted line, answer or error; against a stored statement it is a COUNT', async () => {
    // RED ON: the pre-check of the code rule removed TOGETHER WITH the adoption's own (`assertAdoptedProfiles` a no-op):
    // the hostile code reaches the UPDATE's values. With only the pre-check removed the adoption's refusal still holds
    // the text out of the store (the unit fails as a fault): two walls, and the case above holds the first.
    const MARK = '<script>alert(1)</script>';
    const hostile = (head: string): string => `${head}${MARK}${'q'.repeat(300 - head.length - MARK.length)}`;
    const texts = [hostile('h265'), hostile('profile'), hostile('HEVC_1080P'), 'hevc_1080p', 'HEVC_1080P; DROP TABLE capture_devices', `HEVC_1080P\n${MARK}`];
    const streamsOf = (text: string): AdoptedCameraStream[] => [
      { ...HEVC, code: text },
      { ...HEVC, onvifProfileToken: text },
      { ...HEVC, videoSourceToken: text },
      { ...HEVC, codec: text },
      { ...HEVC, width: text as unknown as number },
    ];
    for (const text of texts) {
      for (const stream of streamsOf(text)) {
        // (a) nothing stored: the hostile stream is NOT stored.
        const empty = emptyWorld();
        empty.answer = reachableWith(stream);
        const first = await outcomeOf(testAdoptedCamera(empty.seams, CALLER, 'CAM-07'));
        // ONE text of the list is a well-formed ONVIF token (`hevc_1080p`: the token form admits lower case, 1 to 64): as a
        // TOKEN it is the camera's own name of the stream and is stored in the token column, as the adoption stores it -
        // the LIST holds the minted code only, and the token is in no entry, note or persisted line (below).
        const asToken = /^[A-Za-z0-9_.:-]{1,64}$/.test(text) && (stream.onvifProfileToken === text || stream.videoSourceToken === text);
        if (asToken) {
          expect(empty.stored['CAM-07']?.profiles).toEqual(['HEVC_1080P']);
          expect(empty.notes.at(-1)).toMatchObject({ profiles: 'PROFILES_STORED' });
        } else {
          expect(writesOf(empty)).toEqual([]);
          expect(empty.stored['CAM-07']).toEqual({ profiles: [], streams: [] });
          expect(empty.notes.at(-1)).toMatchObject({ profiles: 'PROFILES_NOT_STORED', profilesCause: 'STREAM_OUT_OF_BOUNDS' });
        }
        // (b) / (c) a stored statement: the hostile text is compared and counted, or not looked at (a token) - never written.
        const held = world();
        held.answer = reachableWith(stream);
        const second = await outcomeOf(testAdoptedCamera(held.seams, CALLER, 'CAM-07'));
        expect(writesOf(held)).toEqual([]);
        expect(held.stored['CAM-07']).toEqual(storedOf(HEVC));
        for (const w of [empty, held]) {
          const said = JSON.stringify([w.recorded, w.notes, w.persisted]) + everything(first) + everything(second);
          // The answer's `usableProfiles` is the double's own echo of the attempt and never leaves `testAdoptedCamera`: the answer holds a count.
          for (const needle of [MARK, 'qqqqqqqq', 'DROP TABLE', 'hevc_1080p']) expect(said.includes(needle), needle).toBe(false);
          expect(w.recorded).toHaveLength(1);
        }
      }
    }
  });

  it('the judgement and its words, pure: the verdicts of a closed list, whole numbers, and the ONE definition of the word `STREAM_PROFILE_DIFFERS`', () => {
    expect(Object.values(StoredProfilesVerdict)).toEqual(['PROFILES_STORED', 'STREAM_PROFILE_DIFFERS', 'PROFILES_AGREE', 'PROFILES_NOT_STORED']);
    expect(compareStoredProfiles([], [], [HEVC, AVC])).toEqual({ verdict: 'PROFILES_STORED', stored: 0, stated: 2, differing: 0 });
    expect(compareStoredProfiles(['HEVC_1080P'], storedOf(HEVC).streams, [HEVC])).toEqual({ verdict: 'PROFILES_AGREE', stored: 1, stated: 1, differing: 0 });
    // A stale stream row of a code the list no longer names is ignored, as the table's own note says.
    expect(compareStoredProfiles(['HEVC_1080P'], storedOf(HEVC, AVC).streams, [HEVC]).verdict).toBe('PROFILES_AGREE');
    expect(compareStoredProfiles(null, [], [HEVC]).verdict).toBe('STREAM_PROFILE_DIFFERS');
    expect(compareStoredProfiles('HEVC_1080P', [], [HEVC]).verdict).toBe('STREAM_PROFILE_DIFFERS');
    expect(storedProfilesWords({ verdict: 'PROFILES_STORED', stored: 0, stated: 3, differing: 0 })).toBe('; profiles stored: 3');
    expect(storedProfilesWords({ verdict: 'STREAM_PROFILE_DIFFERS', stored: 2, stated: 3, differing: 1 })).toBe('; STREAM_PROFILE_DIFFERS: stored 2, stated 3, differing 1; nothing stored');
    expect(storedProfilesWords({ verdict: 'PROFILES_AGREE', stored: 2, stated: 2, differing: 0 })).toBe('');
    expect(storedProfilesWords({ verdict: 'PROFILES_NOT_STORED', stored: 0, stated: 2, differing: 0, cause: 'SESSION_ACTIVE' })).toBe('');
    // The sources: the file that judges holds no write statement and mints nothing; its one write is the adoption's function.
    const [source] = codeOnly([{ path: 'adopted-profiles.ts', text: readFileSync(join(import.meta.dirname, '..', 'adopted-profiles.ts'), 'utf8') }]);
    const code = source?.text ?? '';
    expect(code.length).toBeGreaterThan(2_000);
    expect(code).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+[a-z_.]+\s+SET|DELETE\s+FROM|TRUNCATE)\b/i);
    expect(code).not.toMatch(/\bprofileOf\b|\bstreamProfileOf\b|\bstreamFactsOf\b|\.audit\b|\.append\s*\(|\bpipeline\b/);
    expect(code.match(/\bwriteAdoptedCameraColumns\(/g)).toHaveLength(1);
    expect(code.match(/'STREAM_PROFILE_DIFFERS'/g)).toBeNull();
    expect(code.match(/\bSTREAM_PROFILE_DIFFERS_REASON\b/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
