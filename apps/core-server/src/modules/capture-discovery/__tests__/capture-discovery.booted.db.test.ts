// THE BOOTED-ORDER SCENARIOS OF THE CAMERA SEARCH (adopt, then assign, then pre-check) on ONE booted
// development Core. This file was `wave-i-a2-adopt-assign.db.test.ts`; its cases are unchanged
// (test-suite consolidation, D233: a protected scenario file under the name of what it holds).
//
// FIX WAVE I, DRIVER A2 - finding G70b-01 of re-gate 70 (`gateway_check/09b_m4_regate.md` section 6):
// a camera added through operation 96 must be ASSIGNABLE AT ONCE through the selector (operations
// 79 / 78) on a BOOTED development Core - not only after a restart of the Core.
//
// WHY THE EARLIER TEST MISSED IT. `capture-discovery.db.test.ts` assigns an adopted camera and gets
// 200, on a SIMULATED Core: no adapter registry is provided there, so rule RG-3 is never asked. On
// a Core booted in REAL_DEVELOPMENT the capture fence builds the adapter registry ONCE, from the
// stored devices of that moment; the camera adopted afterwards had no adapter until the next boot,
// and the selector answered 422 with the reason of another refusal.
//
// The Core here is the one of `lane-camera-stub.db.test.ts`: the real app factory on PostgreSQL as
// `dems_app`, booted in REAL_DEVELOPMENT (row 61's boot fixture; `/bin/echo` as the helper
// program - no camera and no microphone is listed, opened or asked for), with the lane's camera
// stub on loopback. NO SOCKET OUTSIDE LOOPBACK: the loopback guard is on for the whole file.
// No session start is made and nothing is opened: the selector only stores, and the ONE pre-check
// of this file (fix wave M, follow-up M-S2) runs on the two GENERATED cameras and the two generated
// microphones of the seed's selector - their reachability read opens nothing. No local device is
// on a track at any moment.
import type { LightMyRequestResponse } from 'fastify';
import { CAPTURE_CONNECTION_TESTED_SCHEME_REFUSAL_EXAMPLE, type CaptureDiscoveryStateBody } from '@dems/shared/api';
import { createManualClock, type AuditRow } from '@dems/shared/sim';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { FIXED_NOW, TICK_MS, manualTimer } from '../../../../test/support/engine';
import { WEB_ORIGIN, signInOnWeb, type IdentityApp } from '../../../../test/support/identity';
import { LaneCameraStubPreset, prepareLaneCameraStub, type LaneCameraStub } from '../../../../test/support/lane-camera-stub';
import { buildApp } from '../../../app';
import { installLoopbackGuard, type LoopbackGuard } from '../../../capture/adapters/camera/__tests__/support';
import { realBootFixture } from '../../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../../capture/fence';
import { engineControl } from '../../../engine';

const db = useTestDatabase({ template: 'seed' });
const fixture = realBootFixture('waveia2_adopt');
fixture.provisionKey();
// Task 4 row 228b: the fixture is a temporary directory and goes with the file, passed or failed.
afterAll(() => fixture.remove());
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const DISCOVERY = '/api/v1/capture/discovery';
const CONFIG = '/api/v1/capture/config';
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let app: ReturnType<typeof buildApp>;
let log: CapturedLog;
let stub: LaneCameraStub;
let guard: LoopbackGuard;
let clock: ReturnType<typeof createManualClock>;
let cookie: Record<string, string>;
let timer: ReturnType<typeof manualTimer>;
/** The camera the first G70b-01 case adopted: the M-S2 case pre-checks it. */
let adoptedId: string | null = null;

const get = (url: string): Promise<LightMyRequestResponse> => app.inject({ method: 'GET', url, headers: cookie });
const post = (url: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> => app.inject({ method: 'POST', url, headers: { ...cookie, origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload }) });
const errorOf = (response: LightMyRequestResponse): { code: string; details?: Record<string, unknown> } => response.json<{ error: { code: string; details?: Record<string, unknown> } }>().error;
const selector = async (): Promise<string[][]> => (await get(CONFIG)).json<{ cameras: { trackId: string; deviceId: string }[] }>().cameras.map((camera) => [camera.trackId, camera.deviceId]);

beforeAll(async () => {
  guard = installLoopbackGuard();
  const target = await db.another({ template: 'seed', slug: 'waveia2_adopt' });
  const owner = target.ownerPool();
  // No speech runtime on a test host (a real-capture boot resolves the stored selection first).
  await owner.query('UPDATE public.stt_config SET enabled = false');
  // One registered PRODUCTION camera nobody assigned: the registry of a development Core serves none.
  await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('CAM-11', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP')");
  log = captureLog();
  app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, logLevel: 'info', captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: '/bin/echo', captureWorkerPath: fixture.worker('worker-waveia2-adopt', 'capture-worker/0.4.0') }),
    logStream: log.stream,
  });
  target.onCleanup(() => app.close());
  // THE LAUNCHER'S ORDER: the fence and the stub first, then ready, then the factory, then the boot.
  stub = await prepareLaneCameraStub(app);
  await app.ready();
  stub.announce();
  clock = createManualClock(FIXED_NOW);
  app.seams.replace('clock', clock);
  app.seams.replace('publish', () => {});
  timer = manualTimer();
  engineControl(app).useTimer(timer.timer);
  await app.readiness.boot();
  await app.pipeline.drain();
  cookie = (await signInOnWeb({ app, cookieName: app.config.sessionCookieName } as unknown as IdentityApp, 'rina.wijaya')).cookie;
});
afterAll(() => {
  guard.restore();
});

/** One whole search: the start, the real 3 s window, the audit row. Answers the first candidate. */
async function searched(): Promise<CaptureDiscoveryStateBody['candidates'][number]> {
  clock.advance(130_000);
  expect((await post(DISCOVERY)).statusCode).toBe(202);
  await delay(3_400);
  for (let turn = 0; turn < 20; turn += 1) {
    await delay(10);
    await app.pipeline.drain();
  }
  const candidate = (await get(DISCOVERY)).json<CaptureDiscoveryStateBody>().candidates[0];
  if (candidate === undefined) throw new Error('the search listed no candidate');
  return candidate;
}
const testedRows = (): AuditRow[] => app.engine.slice('audit').rows.filter((row) => row.type === 'CAPTURE_CONNECTION_TESTED');

// G70b-02 and G70b-05 (re-gate 70), the SERVER facts the web sentences are drawn from
// (`delegation_progress/contract_wave_i_a2.md` sections 1 and 2).
describe('G70b-02 / G70b-05: what the Core says of a test that sent no credential, and of a scheme refusal', () => {
  it('no credential: AUTHENTICATION_FAILED with `authenticated: false` and no reason; scheme refusal: the reason in the answer AND in the audit row; neither counts against the guard; a refused credential does', async () => {
    const account = stub.account;
    if (account === null || stub.stub === null) throw new Error('the stub was not admitted');
    const candidate = await searched();
    const test = async (credential?: { username: string; secret: string }): Promise<Record<string, unknown>> => {
      clock.advance(30_000);
      const response = await post(`${DISCOVERY}/candidates/${candidate.candidateId}/test`, credential === undefined ? {} : { credential });
      expect(response.statusCode, response.body).toBe(200);
      await app.pipeline.drain();
      return response.json<Record<string, unknown>>();
    };

    // G70b-02: the stub has ONE fixture account (spec ST-3). A test without a credential is refused by the
    // device; the Core says that no credential was sent (`authenticated: false`) - the fact the web words.
    const without = await test();
    expect(without).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', authenticated: false, failedAttemptsRemaining: 2 });
    expect(without).not.toHaveProperty('reason');
    expect(testedRows().at(-1)?.details).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', authenticated: false, guardTripped: false });
    expect(testedRows().at(-1)?.details).not.toHaveProperty('reason');

    // G70b-05: a camera that accepts only a sign-in method the Core does not answer. The credential is NOT sent.
    await stub.apply(LaneCameraStubPreset.AUTH_SCHEME);
    const scheme = await test(account);
    expect(scheme).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', authenticated: true, reason: 'SCHEME_NOT_ALLOWED', failedAttemptsRemaining: 2 });
    // THE AUDIT ROW tells it from a refused credential (before the fix both rows were the same).
    expect(testedRows().at(-1)?.details).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', authenticated: true, guardTripped: false, reason: 'SCHEME_NOT_ALLOWED' });
    expect(stub.stub.violations().filter((violation) => violation.code === 'PASSWORD_IN_CLEAR')).toEqual([]);

    // CONTROL: a wrong account IS a refused credential - it counts, and its row carries no reason.
    await stub.apply(LaneCameraStubPreset.NORMAL);
    const wrong = await test({ username: account.username, secret: `${account.secret}x` });
    expect(wrong).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', authenticated: true, failedAttemptsRemaining: 1 });
    expect(wrong).not.toHaveProperty('reason');
    expect(testedRows().at(-1)?.details).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', authenticated: true, guardTripped: false });
    expect(testedRows().at(-1)?.details).not.toHaveProperty('reason');
    // The audit type set did not grow for it: three rows of the one type.
    expect(testedRows()).toHaveLength(3);
    // The contract example of the new member is of the Core's own rule.
    expect(CAPTURE_CONNECTION_TESTED_SCHEME_REFUSAL_EXAMPLE).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', reason: 'SCHEME_NOT_ALLOWED' });
  });
});

describe('G70b-01: a camera adopted on a BOOTED development Core', () => {
  it('is assignable through the selector at once (operations 79 and 78), with no restart; the registry serves it like a stored test camera', async () => {
    const account = stub.account;
    if (account === null) throw new Error('the stub was not admitted');
    expect(captureFenceControl(app).operation).toBe('REAL_DEVELOPMENT');
    const registry = captureFenceControl(app).registry();
    if (registry === null) throw new Error('the booted development Core has no adapter registry');

    // M-S2: BEFORE the adoption the Core is asked for its inputs once (operation 97, what opening the
    // Devices screen does). From here on the notices unit has read the probe of the running operation.
    const rescanned = await post('/api/v1/capture/inputs/rescan');
    expect(rescanned.statusCode, rescanned.body).toBe(200);

    // SEARCH, TEST, ADD AS CAMERA - the gate's steps.
    await stub.apply(LaneCameraStubPreset.NORMAL);
    const candidate = await searched();
    clock.advance(30_000);
    const tested = await post(`${DISCOVERY}/candidates/${candidate.candidateId}/test`, { credential: account });
    expect(tested.json(), tested.body).toMatchObject({ outcome: 'REACHABLE', authenticated: true });
    clock.advance(30_000);
    const adopted = await post(`${DISCOVERY}/candidates/${candidate.candidateId}/adopt`, { credential: account });
    expect(adopted.statusCode, adopted.body).toBe(201);
    const { deviceId } = adopted.json<{ deviceId: string }>();
    expect(deviceId).toMatch(/^CAM-\d\d$/);
    adoptedId = deviceId;
    const before = await selector();

    // THE FINDING. Before the fix: 422 `DEVELOPMENT_SOURCE_NOT_ALLOWED` until the Core restarts.
    const assigned = await post(`/api/v1/capture/cameras/${deviceId}/source`, { trackId: 'VIDEO-02' });
    expect(assigned.statusCode, assigned.body).toBe(200);
    expect(await selector()).toEqual([['VIDEO-01', before[0]?.[1]], ['VIDEO-02', deviceId]]);
    // The registry of the running Core serves it: a generated test source, as a stored `FAKE` camera gets at a boot.
    expect(registry.describe(deviceId)).toMatchObject({ id: deviceId, deviceClass: 'CAMERA', adapterKind: 'FAKE', sourceClass: 'DEVELOPMENT', hasOpener: true });
    expect(registry.list().map((device) => device.id)).toContain(deviceId);
    // The reachability probe of the pre-check knows it too (nothing is opened by this read).
    expect(captureFenceControl(app).probeAdapters()?.cameras.some((camera) => camera.devices.some((device) => device.id === deviceId))).toBe(true);
    // Operation 78 takes it as well; then the selector goes back to the built-in camera.
    const second = before[1]?.[1] ?? 'CAM-02';
    expect((await post(`/api/v1/capture/cameras/${second}/source`, { trackId: 'VIDEO-02' })).statusCode).toBe(200);
    const byConfig = await post(CONFIG, { cameras: [{ trackId: 'VIDEO-02', deviceId }] });
    expect(byConfig.statusCode, byConfig.body).toBe(200);
    expect((await post(`/api/v1/capture/cameras/${second}/source`, { trackId: 'VIDEO-02' })).statusCode).toBe(200);
    await app.pipeline.drain();

    // One audit row per accepted edit, and the adoption's own rows; the account is in no log line.
    const rows = app.engine.slice('audit').rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED');
    expect(rows.filter((row) => row.details['to'] === deviceId)).toHaveLength(2);
    expect(log.text()).not.toContain(account.secret);
    expect(log.text()).not.toContain(account.username);
    expect(guard.connections().filter((host) => host !== '127.0.0.1')).toEqual([]);
    expect(guard.refused()).toEqual([]);
  });

  // FIX WAVE M, FOLLOW-UP M-S2 (the hypothesis of `implementation/158_fix_wave_m_s.md` section 10).
  // The notices unit had kept the FIRST probe the fence answered - a copy of the camera adapters of
  // that moment. A camera adopted afterwards was in the registry (assignable, case above) and not in
  // that copy: its pre-check read `UNREACHABLE` ("no adapter serves it") until the Core restarted -
  // a false notification B. The case above read the probe (operation 97) BEFORE it adopted.
  it('M-S2: the adopted camera, assigned to a video track, PASSES the next pre-check of the same run - no restart, no CAPTURE_DEVICE_UNREACHABLE alert or row; CONTROL: the stored test camera on the other track passes by the same read', async () => {
    const deviceId = adoptedId;
    if (deviceId === null) throw new Error('the case above adopted no camera');
    const assigned = await post(`/api/v1/capture/cameras/${deviceId}/source`, { trackId: 'VIDEO-02' });
    expect(assigned.statusCode, assigned.body).toBe(200);
    const tracks = await selector();
    expect(tracks[1]).toEqual(['VIDEO-02', deviceId]);
    // Nothing of this Mac is on a track: the read of a generated source opens nothing.
    const kinds = new Map(captureFenceControl(app).registry()?.list().map((device) => [device.id, device.adapterKind]));
    expect(tracks.map(([, id]) => kinds.get(id ?? ''))).toEqual(['FAKE', 'FAKE']);

    const investigator = app.engine.slice('operators').find((operator) => operator.role === 'INVESTIGATOR');
    if (investigator === undefined) throw new Error('the seed has no investigator');
    const asInvestigator = (await signInOnWeb({ app, cookieName: app.config.sessionCookieName } as unknown as IdentityApp, 'budi.santoso')).cookie;
    const send = (url: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> => app.inject({ method: 'POST', url, headers: { ...asInvestigator, origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload }) });
    const created = await send('/api/v1/session', { caseNumber: 'LP/2026/1011-0161', subjectType: 'SAKSI', subjectName: 'Test Subject', investigatorId: investigator.id, room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
    expect(created.statusCode, created.body).toBe(201);
    const { sessionId } = created.json<{ sessionId: string }>();
    try {
      const begun = await send(`/api/v1/session/${sessionId}/precheck`);
      expect(begun.statusCode, begun.body).toBe(202);
      // The checks resolve on the engine's ticks; the gate's one search (none is needed here) and its alerts follow.
      for (let elapsed = 0; elapsed < 5_000; elapsed += TICK_MS) {
        clock.advance(TICK_MS);
        timer.fire();
        await engineControl(app).idle();
      }
      for (let round = 0; round < 5; round += 1) {
        await new Promise((resolve) => setImmediate(resolve));
        await engineControl(app).idle();
        await app.pipeline.drain();
      }

      const items = app.engine.slice('session')?.precheck?.items ?? [];
      const row = (id: string): unknown => items.find((item) => item.id === id);
      // CONTROL: the camera that existed at the boot.
      expect(row('LENS_1')).toMatchObject({ status: 'PASS' });
      // THE FINDING. Before the fix: `status: WARN, value: UNREACHABLE, params.rule: oneCamera`.
      expect(row('LENS_2')).toMatchObject({ status: 'PASS' });
      expect(app.engine.slice('captureDevices').devices.find((device) => device.id === deviceId)).toMatchObject({ online: true });
      expect(app.engine.slice('alerts').filter((alert) => alert.params?.['reason'] === 'CAPTURE_DEVICE_UNREACHABLE')).toEqual([]);
      expect(app.engine.slice('audit').rows.filter((entry) => entry.type === 'CAPTURE_DEVICE_UNREACHABLE')).toEqual([]);
    } finally {
      // The session is left by its own operation and the selector goes back, so the control below reads what it read before.
      await send(`/api/v1/session/${sessionId}/cancel`);
      await app.pipeline.drain();
      await post('/api/v1/capture/cameras/CAM-02/source', { trackId: 'VIDEO-02' });
    }
    expect(guard.connections().filter((host) => host !== '127.0.0.1')).toEqual([]);
  });

  it('NEGATIVE CONTROL: a refusal names its own reason - a production camera on this development Core is PRODUCTION_SOURCE_NOT_ALLOWED, never DEVELOPMENT_SOURCE_NOT_ALLOWED; nothing is stored', async () => {
    const before = await selector();
    const refused = await post('/api/v1/capture/cameras/CAM-11/source', { trackId: 'VIDEO-02' });
    expect(refused.statusCode, refused.body).toBe(422);
    expect(errorOf(refused).code).toBe('INVALID_INPUT');
    expect(errorOf(refused).details).toMatchObject({ in: 'body', reason: 'PRODUCTION_SOURCE_NOT_ALLOWED', deviceId: 'CAM-11' });
    expect(await selector()).toEqual(before);
  });
});
