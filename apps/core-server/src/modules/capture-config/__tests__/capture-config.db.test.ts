// Operations 76 to 80 against PostgreSQL and the REAL engine (blueprint row 66 / M4-W2; contract
// C3 §2.2 to §2.4, §4, §5.2, §6; specs R-1; checks M4-LOCK-1 and the server half of M4-SEL-W/T/P).
//
// The real app factory on a clone of the seed, as `dems_app`, with EVERY stage as the server has
// it: nothing of the request pipeline is replaced. The engine is booted on a manual clock and a
// manual timer. The three seeded operators are signed in on the web console. What is stored is
// read as `dems_owner`. Every count is relative to the trail after the boot and the sign-ins.
import { validateCoreApiResponse, CaptureConfigSliceSchema, CoreApiAccessKind } from '@dems/shared/api';
import { SessionState } from '@dems/shared/domain';
import { ROLE_PERMISSIONS, type AuditRow, type OperatorRole } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import { beforeAll, describe, expect, it, afterAll } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { storedSlices, FIXED_NOW, engineApp, manualTimer, stateChanges } from '../../../../test/support/engine';
import { forgetCounters, WEB_ORIGIN, cookieValue, webSignIn } from '../../../../test/support/identity';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { bodyOf, devicesApp, errorOf, outcome, type DevicesApp } from '../../devices/__tests__/support';
import { createCaptureConfigStore, captureConfigControl, captureConfigOperation } from '../index';
import { PROFILE_WITHOUT_STREAM_REASON, PROFILE_WITHOUT_STREAM_TEXT } from '../routes';
import { CONFIG, DEVICES, cameraSource, primaryMic } from './support';
import { detailRulesOf, type DetailRule } from '../../../core/audit-details';
import type { Principal } from '../../../plugins/authenticate';
import type { Pool } from 'pg';
import { provideTestCaptureHost, testHostPrograms } from '../../../../test/support/capture-host';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { buildApp } from '../../../app';
import { realBootFixture } from '../../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../../capture/fence';
import type { ConfigInput } from '../../../config';
import { engineControl } from '../../../engine';
import { BootError } from '../../../plugins/readiness';
import { hashPassword } from '../../identity/password-hash';

const db = useTestDatabase({ template: 'seed' });
let server: DevicesApp;

beforeAll(async () => {
  server = await devicesApp(db);
});

interface Selector {
  cameras: { trackId: string; deviceId: string; profile: string; online: boolean; streamState: string | null }[];
  // D61 (2026-11-04): the mic lines of the selector plane are keyed by the numbered CHANNEL (0040); the two-role lane survives only on SWITCH_AUDIO_SOURCE.to, telemetry and interval records.
  mics: { channel: string; inputId: string; deviceId: string; transport: string; online: boolean }[];
  locked: boolean;
  updatedAt: number;
}
const selectorOf = (response: LightMyRequestResponse): Selector => response.json() as Selector;
const operatorId = (role: OperatorRole): string => server.principal(role).operatorId;
const changed = (rows: readonly AuditRow[]): AuditRow[] => rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED');

/** The published state changes that replace slice `captureConfig`, in order. */
const selectorPublications = () => server.stateChanges().filter((change) => change.ops.some((op) => op.op === 'replace' && op.slice === 'captureConfig'));

/**
 * What the tables hold equals the committed state of the engine, and the stored chain verifies.
 *
 * NO difference is taken out any more (row 129b, decision D106 (1)): the durable mapping reads the
 * mic rows of the selector back in CHANNEL order (`db/mapping/rows.ts`, `captureConfigFromRow`),
 * as the engine holds them (AC-B-70 generalized by D61 of 2026-11-04: the ordered pair became the
 * ordered four, keyed by channel). The HTTP answer of operations 76 to 80 keeps listing the lines
 * in INPUT order (`micsInInputOrder`, routes.ts). `storedMicOrderDiffers` stays as the printed fact.
 */
let storedMicOrderDiffers = false;
async function expectStoredEqualsCommitted(): Promise<void> {
  await server.app.pipeline.drain();
  const stored = await storedSlices(server.owner);
  const committed = withoutNegativeZeros(server.engine.state());
  storedMicOrderDiffers = JSON.stringify(stored.captureConfig.mics.map((mic) => mic.inputId)) !== JSON.stringify(committed.captureConfig.mics.map((mic) => mic.inputId));
  expect(stored).toStrictEqual(committed);
  const rows = await readTrail(server.owner);
  const head = await readHead(server.owner);
  expect(linkProblems(rows)).toEqual([]);
  expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
}

describe('operations 76 and 77: the reads answer the committed slices', () => {
  it.each(['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const)('%s reads both: 200, the contract\'s shape, no row written', async (role) => {
    const before = await server.trailLength();
    const config = await server.get(role, CONFIG);
    const devices = await server.get(role, DEVICES);
    expect([config.statusCode, devices.statusCode]).toEqual([200, 200]);
    expect(validateCoreApiResponse('getCaptureConfig', 200, bodyOf(config))).toEqual({ ok: true });
    expect(validateCoreApiResponse('getCaptureDevices', 200, bodyOf(devices))).toEqual({ ok: true });
    expect(selectorOf(config)).toEqual({ ...server.engine.slice('captureConfig'), locked: false });
    expect(devices.json()).toEqual(server.engine.slice('captureDevices'));
    expect(await server.trailLength()).toBe(before);
  });

  it('without a session the reads are 401 NOT_SIGNED_IN', async () => {
    expect(outcome(await server.get(null, CONFIG))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcome(await server.get(null, DEVICES))).toEqual([401, 'NOT_SIGNED_IN']);
  });
});

describe('operations 78, 79, 80: TECHNICIAN edits, audited; SUPERVISOR (`0034`) and INVESTIGATOR are refused, audited', () => {
  it('an edit is one committed unit: the answer, the stored row, ONE CAPTURE_CONFIG_CHANGED row and ONE publication of slice captureConfig', async () => {
    forgetCounters(server.identity);
    await expectStoredEqualsCommitted();

    // 80 as TECHNICIAN.
    let before = await server.trailLength();
    let publications = selectorPublications().length;
    server.clock.advance(1_000);
    const primary = await server.post('TECHNICIAN', primaryMic('MIC-02'));
    expect(primary.statusCode).toBe(200);
    expect(validateCoreApiResponse('setPrimaryMic', 200, bodyOf(primary))).toEqual({ ok: true });
    // AC-B-70 (generalized by D61, 2026-11-04): the mic inputs are listed in input order, whichever numbered channel each fills — the ordered pair became the ordered four.
    expect(selectorOf(primary).mics.map((mic) => [mic.inputId, mic.deviceId, mic.channel])).toEqual([
      ['MIC-01', 'MIC-01', 'MIC-02'],
      ['MIC-02', 'MIC-02', 'MIC-01'],
      ['MIC-03', 'MIC-03', 'MIC-03'],
      ['MIC-04', 'MIC-04', 'MIC-04'],
    ]);
    // D61 (2026-11-04): the engine holds the lines in channel order, the answer lists them by input — compare after putting the engine's own slice in input order.
    expect(selectorOf(primary)).toEqual({ ...server.engine.slice('captureConfig'), mics: [...(server.engine.slice('captureConfig')?.mics ?? [])].sort((left, right) => (left.inputId < right.inputId ? -1 : left.inputId > right.inputId ? 1 : 0)), locked: false });
    let rows = await server.since(before);
    expect(rows.map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['CAPTURE_CONFIG_CHANGED', operatorId('TECHNICIAN'), { operationId: 'setPrimaryMic', scope: 'MIC', field: 'CHANNEL', inputId: 'MIC-02', deviceId: 'MIC-02', from: 'MIC-02', to: 'MIC-01', permission: 'CAPTURE_CONFIG' }], // D61: the operation moves the transcribed channel
    ]);
    // Published once, in the SAME change as its audit row (one cut of the state), at the revision the answer names.
    expect(selectorPublications()).toHaveLength(publications + 1);
    const change = selectorPublications().at(-1);
    expect(change?.ops.some((op) => op.op === 'append' && op.slice === 'audit' && op.rows.some((row) => row.type === 'CAPTURE_CONFIG_CHANGED'))).toBe(true);
    expect(change?.ops.find((op) => op.op === 'replace' && op.slice === 'captureConfig')).toMatchObject({ value: server.engine.slice('captureConfig') });
    expect(Number(primary.headers['x-dems-revision'])).toBe(change?.revision);
    expect(Number(primary.headers['x-dems-revision'])).toBe(server.engine.revision);
    await expectStoredEqualsCommitted();
    // D61 (2026-11-04): the engine holds the lines in CHANNEL order and the mapping reads them back
    // the same way (`captureConfigFromRow`) — after the swap the transcribed channel carries MIC-02.
    expect(server.engine.slice('captureConfig').mics.map((mic) => mic.inputId)).toEqual(['MIC-02', 'MIC-01', 'MIC-03', 'MIC-04']);
    console.info(`[row66] stored selector reads its mic rows back in another order than the engine holds: ${String(storedMicOrderDiffers)}`);

    // 78 as TECHNICIAN — the ONE editor since `0034` (OD-10 revoked SUPERVISOR's CAPTURE_CONFIG on
    // 2026-10-29: the topology is the installing technician's layer, the supervisor keeps the reads).
    // The two cameras change tracks in one edit, two lines, two rows, one publication.
    before = await server.trailLength();
    publications = selectorPublications().length;
    const swapped = await server.post('TECHNICIAN', CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] });
    expect(swapped.statusCode).toBe(200);
    expect(validateCoreApiResponse('updateCaptureConfig', 200, bodyOf(swapped))).toEqual({ ok: true });
    rows = await server.since(before);
    expect(rows.map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['CAPTURE_CONFIG_CHANGED', operatorId('TECHNICIAN'), { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-01', deviceId: 'CAM-02', from: 'CAM-01', to: 'CAM-02', permission: 'CAPTURE_CONFIG' }],
      ['CAPTURE_CONFIG_CHANGED', operatorId('TECHNICIAN'), { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-02', deviceId: 'CAM-01', from: 'CAM-02', to: 'CAM-01', permission: 'CAPTURE_CONFIG' }],
    ]);
    expect(selectorPublications()).toHaveLength(publications + 1);
    await expectStoredEqualsCommitted();

    // 79 as TECHNICIAN, after 78 gave VIDEO-01 a second profile (one camera on both tracks, OD-05).
    expect(outcome(await server.post('TECHNICIAN', cameraSource('CAM-01'), { trackId: 'VIDEO-01' }))).toEqual([422, 'INVALID_INPUT']);
    expect((await server.post('TECHNICIAN', CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_720P25' }] })).statusCode).toBe(200);
    before = await server.trailLength();
    const source = await server.post('TECHNICIAN', cameraSource('CAM-02'), { trackId: 'VIDEO-02' });
    expect(source.statusCode).toBe(200);
    expect(validateCoreApiResponse('setCaptureCameraSource', 200, bodyOf(source))).toEqual({ ok: true });
    expect(selectorOf(source).cameras.map((camera) => [camera.trackId, camera.deviceId, camera.profile])).toEqual([
      ['VIDEO-01', 'CAM-01', 'H264_720P25'],
      ['VIDEO-02', 'CAM-02', 'H264_1080P25'],
      ['VIDEO-03', 'CAM-03', 'H264_1080P25'], // D60 (2026-11-04): the seed's four tracks answer
      ['VIDEO-04', 'CAM-04', 'H264_1080P25'],
    ]);
    expect((await server.since(before)).map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['CAPTURE_CONFIG_CHANGED', operatorId('TECHNICIAN'), { operationId: 'setCaptureCameraSource', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-02', deviceId: 'CAM-02', from: 'CAM-01', to: 'CAM-02', permission: 'CAPTURE_CONFIG' }],
    ]);
    await expectStoredEqualsCommitted();

    // The next start of the server reads what these edits stored: the module's boot load accepts it
    // and forms the same selector (no edit may store what the boot step would refuse).
    const reloaded = await createCaptureConfigStore().load({ query: async <Row>(text: string) => ({ rows: (await server.owner.query(text)).rows as Row[] }) });
    expect(reloaded.builtInBaseline).toBe(false);
    expect({ cameras: reloaded.captureConfig.cameras.map((camera) => [camera.trackId, camera.deviceId, camera.profile]), mics: reloaded.captureConfig.mics.map((mic) => [mic.inputId, mic.deviceId, mic.channel]) }).toEqual({
      cameras: server.engine.slice('captureConfig').cameras.map((camera) => [camera.trackId, camera.deviceId, camera.profile]),
      mics: server.engine.slice('captureConfig').mics.map((mic) => [mic.inputId, mic.deviceId, mic.channel]),
    });
  });

  it('an edit that changes nothing: 200, no row, no publication, the revision does not move', async () => {
    const before = await server.trailLength();
    const publications = selectorPublications().length;
    const revision = server.engine.revision;
    const current = selectorOf(await server.get('SUPERVISOR', CONFIG));
    const primaryInput = current.mics.find((mic) => mic.channel === 'MIC-01')?.inputId ?? ''; // D61: the transcribed channel
    // The write is TECHNICIAN's (`0034`); the read above stays the supervisor's - the revocation kept 76 and 77.
    const same = await server.post('TECHNICIAN', primaryMic(primaryInput));
    expect(same.statusCode).toBe(200);
    expect(selectorOf(same)).toEqual(current);
    expect(await server.trailLength()).toBe(before);
    expect(selectorPublications()).toHaveLength(publications);
    expect(server.engine.revision).toBe(revision);
  });

  it('INVESTIGATOR is refused on the three edits with 403 NOT_PERMITTED and exactly ONE ACCESS_DENIED row each; nothing changes', async () => {
    forgetCounters(server.identity);
    const selector = server.engine.slice('captureConfig');
    const edits: [string, string, object | undefined][] = [
      ['setPrimaryMic', primaryMic('MIC-01'), undefined],
      ['setCaptureCameraSource', cameraSource('CAM-01'), { trackId: 'VIDEO-02' }],
      ['updateCaptureConfig', CONFIG, { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] }],
    ];
    for (const [operationId, url, payload] of edits) {
      const before = await server.trailLength();
      const response = await server.post('INVESTIGATOR', url, payload);
      expect(outcome(response), operationId).toEqual([403, 'NOT_PERMITTED']);
      expect(errorOf(response).details, operationId).toMatchObject({ permission: 'CAPTURE_CONFIG' });
      expect(validateCoreApiResponse(operationId, 403, response.json()), operationId).toEqual({ ok: true });
      expect(response.headers['x-dems-revision'], operationId).toBeUndefined();
      expect((await server.since(before)).map((row) => [row.type, row.actorId, row.details]), operationId).toEqual([
        ['ACCESS_DENIED', operatorId('INVESTIGATOR'), { operationId, permission: 'CAPTURE_CONFIG', role: 'INVESTIGATOR' }],
      ]);
    }
    expect(server.engine.slice('captureConfig')).toBe(selector);
    await expectStoredEqualsCommitted();
  });

  it('refusals of the edit itself write no row: 404 for an unknown path ID, 422 for a line the selector cannot hold', async () => {
    const before = await server.trailLength();
    const selector = server.engine.slice('captureConfig');
    const refused: [string, object | undefined, [number, string]][] = [
      [cameraSource('CAM-99'), { trackId: 'VIDEO-01' }, [404, 'NOT_FOUND']],
      [primaryMic('MIC-09'), undefined, [404, 'NOT_FOUND']],
      [CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-77' }] }, [422, 'INVALID_INPUT']],
      [CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CND-0001' }] }, [422, 'INVALID_INPUT']],
      [CONFIG, { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-02' }] }, [422, 'INVALID_INPUT']],
      [cameraSource('CAM-01'), { trackId: 'VIDEO-09' }, [422, 'INVALID_INPUT']],
    ];
    for (const [url, payload, expected] of refused) {
      const response = await server.post('TECHNICIAN', url, payload);
      expect(outcome(response), `${url} ${JSON.stringify(payload)}`).toEqual(expected);
      expect(response.headers['x-dems-revision'], url).toBeUndefined();
    }
    expect(await server.trailLength()).toBe(before);
    expect(server.engine.slice('captureConfig')).toBe(selector);
    await expectStoredEqualsCommitted();
  });
});

describe('M4-LOCK-1: the selector is locked while a session is open', () => {
  const SESSION_INPUT = { caseNumber: 'LP/2026/1001-0066', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;

  it('409 CAPTURE_CONFIG_LOCKED on 78, 79 and 80 with NO audit row, no publication and no state change; the reads answer `locked: true`; closed, the edits are accepted again', async () => {
    forgetCounters(server.identity);
    const investigator = server.principal('INVESTIGATOR');
    const created = await server.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
    expect(created.value).toMatchObject({ ok: true, created: true });
    expect(server.engine.slice('session')).not.toBeNull();
    await server.app.pipeline.drain();

    const before = await server.trailLength();
    const publications = selectorPublications().length;
    const revision = server.engine.revision;
    const selector = server.engine.slice('captureConfig');
    const primaryInput = selector.mics.find((mic) => mic.channel === 'MIC-02')?.inputId ?? ''; // D61: the channel behind the transcribed one (was STANDBY)
    const edits: [string, string, object | undefined][] = [
      ['setPrimaryMic', primaryMic(primaryInput), undefined],
      ['setCaptureCameraSource', cameraSource('CAM-01'), { trackId: 'VIDEO-01' }],
      ['updateCaptureConfig', CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02', profile: 'H264_720P25' }] }],
    ];
    // TECHNICIAN alone: SUPERVISOR lost CAPTURE_CONFIG with `0034`, and the permission guard answers
    // BEFORE the lock - its 403 is an ACCESS_DENIED row, not the state refusal this case is about.
    for (const role of ['TECHNICIAN'] as const) {
      for (const [operationId, url, payload] of edits) {
        const response = await server.post(role, url, payload);
        expect(outcome(response), `${role} ${operationId}`).toEqual([409, 'CAPTURE_CONFIG_LOCKED']);
        expect(validateCoreApiResponse(operationId, 409, response.json()), operationId).toEqual({ ok: true });
        expect(response.headers['x-dems-revision'], operationId).toBeUndefined();
      }
    }
    // SEC35-19: neither CAPTURE_CONFIG_CHANGED nor ACCESS_DENIED - the lock is a state refusal.
    expect(await server.trailLength()).toBe(before);
    expect(selectorPublications()).toHaveLength(publications);
    expect(server.engine.revision).toBe(revision);
    expect(server.engine.slice('captureConfig')).toBe(selector);

    // The reads are allowed, for every role, and say the lock.
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) {
      const config = await server.get(role, CONFIG);
      expect(config.statusCode, role).toBe(200);
      // D61 (2026-11-04): the answer lists the lines by input, the engine holds them by channel — compare after input-ordering the slice.
      expect(selectorOf(config), role).toEqual({ ...selector, mics: [...selector.mics].sort((left, right) => (left.inputId < right.inputId ? -1 : left.inputId > right.inputId ? 1 : 0)), locked: true });
      expect(validateCoreApiResponse('getCaptureConfig', 200, bodyOf(config)), role).toEqual({ ok: true });
      expect((await server.get(role, DEVICES)).statusCode, role).toBe(200);
    }
    // INVESTIGATOR is still an ACCESS refusal while locked: the guard answers before the handler.
    expect(outcome(await server.post('INVESTIGATOR', primaryMic(primaryInput)))).toEqual([403, 'NOT_PERMITTED']);
    await expectStoredEqualsCommitted();

    // Control: the same edit is accepted once the session is closed.
    await server.engine.command(investigator, 'cancel');
    expect(server.engine.slice('session')).toBeNull();
    const after = await server.trailLength();
    const accepted = await server.post('TECHNICIAN', primaryMic(primaryInput));
    expect(accepted.statusCode).toBe(200);
    expect(selectorOf(accepted).locked).toBe(false);
    expect(changed(await server.since(after))).toHaveLength(1);
    expect(selectorPublications()).toHaveLength(publications + 1);
    await expectStoredEqualsCommitted();
  });
});

// Fix wave H, driver D (gate 70 finding G70-05): a selector edit sent from a tablet or a phone
// carried no sending device in its row, while the search row of the same device did. The engine
// runs the hosted action under the caller's identity AND its paired device (`withActorScope`); the
// action names that device in the row's own `deviceId`. The stored row is read here.
describe('G70-05: the row of a selector edit names the paired device that sent it', () => {
  it('an edit of a device session carries its device; the same edit of a web console session carries none (control); the details are the same', async () => {
    const technician = server.principal('TECHNICIAN');
    const current = server.engine.slice('captureConfig').mics.find((mic) => mic.channel === 'MIC-02')?.inputId ?? 'MIC-02'; // D61: was the STANDBY role
    let before = await server.trailLength();
    // A principal as stage 4 resolves it for a paired device's session: the same operator, bound to DEV-0001.
    await server.engine.command({ ...technician, deviceId: 'DEV-0001' }, 'setCaptureConfig', { kind: 'PRIMARY_MIC', inputId: current });
    await server.app.pipeline.drain();
    const fromDevice = changed(await server.since(before));
    expect(fromDevice.map((row) => [row.actorId, row.deviceId, row.details['operationId'], row.details['deviceId']])).toEqual([[technician.operatorId, 'DEV-0001', 'setPrimaryMic', current]]);

    const other = server.engine.slice('captureConfig').mics.find((mic) => mic.channel === 'MIC-02')?.inputId ?? 'MIC-01'; // D61: was the STANDBY role
    before = await server.trailLength();
    await server.engine.command(technician, 'setCaptureConfig', { kind: 'PRIMARY_MIC', inputId: other });
    await server.app.pipeline.drain();
    const fromWeb = changed(await server.since(before));
    expect(fromWeb.map((row) => [row.actorId, row.deviceId ?? null, row.details['operationId']])).toEqual([[technician.operatorId, null, 'setPrimaryMic']]);
    expect(Object.keys(fromDevice[0]?.details ?? {}).sort()).toEqual(Object.keys(fromWeb[0]?.details ?? {}).sort());
    await expectStoredEqualsCommitted();
  });
});

// ═══ Moved here from `integration-c1.db.test.ts` (test-suite consolidation, D233): the cases as they were, under one describe. ═══
// Integration pass C1 (decision D120) on PostgreSQL, AS THE RUNTIME ROLE, on throw-away clones.
//
//   1. THE MIC INPUT ID RULE (decisions D106 (4), D115 (2)): a stored selector whose transcribed
//      channel `MIC-01` (D61, 2026-11-04: was the PRIMARY role) is the local microphone row `MIC-05` REHYDRATES (D60/D61: `MIC-03` became a seeded built-in with the four-channel plane, so the case names the next free id), an edit of it is
//      published and stored, and a restarted Core holds the same selector.
//   2. OPERATIONS 78 / 79 ASK THE ADAPTER REGISTRY (decision D115 (3); check M4-LOCAL-SEL-1, API
//      half): in `REAL_DEVELOPMENT` the boot step of the capture-config module takes the registry
//      of the capture fence, and an assignment of a production camera answers
//      `422 INVALID_INPUT`, `details.reason: PRODUCTION_SOURCE_NOT_ALLOWED` (fix wave I, finding
//      G70b-01: the reason of THIS refusal; it read `DEVELOPMENT_SOURCE_NOT_ALLOWED` before, which
//      is false for a production camera on a development Core); nothing is stored.
//
// A "restart" is what it is in production: the app is closed and a NEW app is built on the same
// database and booted. The helper program of the development boots is `/bin/echo` (row 136's
// fixture): a root-owned program that passes the path rule and is never asked to capture.
describe('D130 (integration C1): MIC-05 in the selector, and the adapter registry behind operations 78 and 79', () => {
  const HELPER = '/bin/echo';
  // A whole boot in capture mode real passes the boot checks of row 61 (`capture.boot`): a worker
  // program that passes the path rule and says HELLO, a private media root and a provisioned signing
  // key. Row 61's fixture gives the three (the key in a temporary directory, row 228b); the worker is a stand-in script and is
  // never asked to capture.
  const realBoot = realBootFixture('c1');
  realBoot.provisionKey();
  afterAll(() => realBoot.remove());
  const DEVELOPMENT = { captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER, dataDir: realBoot.dataDir, captureWorkerPath: realBoot.worker('capture-worker', 'capture-worker/0.3.0') } as const;

  type Clone = Awaited<ReturnType<typeof db.another>>;

  /** What row 136's development boot registers, written by the owner as a fixture. D60/D61 (2026-11-04):
   *  `CAM-03`/`MIC-03` are seeded built-ins of the widened planes — the local rows take the next free ids. */
  const addLocalRows = (owner: Pool): Promise<unknown> =>
    owner.query("INSERT INTO public.capture_devices (id, kind, transport, model, enabled, adapter_kind) VALUES ('CAM-05', 'CAMERA', 'AVFOUNDATION', 'MacBook Air Camera', false, 'LOCAL_DEVICE'), ('MIC-05', 'MIC', 'AVFOUNDATION', 'MacBook Air Microphone', false, 'LOCAL_DEVICE')");
  const storedSelector = async (owner: Pool): Promise<Record<string, unknown> | undefined> =>
    (await owner.query('SELECT video_01_device_id, video_02_device_id, mic_01_id, mic_02_id FROM public.capture_config')).rows[0] as Record<string, unknown> | undefined; // D61 (2026-11-04): 0040 renamed the role columns to the channel columns
  const changedRows = async (owner: Pool): Promise<number> => Number((await owner.query("SELECT count(*)::int AS n FROM public.audit_log WHERE type = 'CAPTURE_CONFIG_CHANGED'")).rows[0]?.n);

  describe('1. a capture configuration with MIC-05 on the transcribed channel MIC-01 rehydrates and replicates (D60/D61)', () => {
    it('boot, the selector in input order, an edit published and stored, and the same selector after a restart', async () => {
      const target = await db.another({ template: 'seed', slug: 'c1-mic03' });
      const owner = target.ownerPool();
      await addLocalRows(owner);
      await owner.query("UPDATE public.capture_config SET mic_01_id = 'MIC-05'"); // D60/D61 (2026-11-04): the next free local id

      const first = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + 60_000 });
      // RED BEFORE THIS PASS: BootError at step `engine.rehydrate` (ENGINE_SNAPSHOT_REJECTED).
      await first.app.readiness.boot();
      await first.engine.idle();
      const rehydrated = first.engine.slice('captureConfig');
      expect(rehydrated.mics.map((mic) => [mic.inputId, mic.deviceId, mic.channel, mic.transport])).toEqual([
        ['MIC-05', 'MIC-05', 'MIC-01', 'AVFOUNDATION'],
        ['MIC-02', 'MIC-02', 'MIC-02', 'USB'],
        ['MIC-03', 'MIC-03', 'MIC-03', 'USB'],
        ['MIC-04', 'MIC-04', 'MIC-04', 'USB'],
      ]); // D61 (2026-11-04): the numbered channels replaced the roles; the engine lists the four lines in channel order
      // The rules that stay: one line per assigned channel, no channel twice; a mic line's device is its input (D106 (4)).
      expect(rehydrated.mics.map((mic) => mic.channel).sort()).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']);
      expect(rehydrated.mics.every((mic) => mic.deviceId === mic.inputId)).toBe(true);
      expect(CaptureConfigSliceSchema.safeParse(rehydrated).success).toBe(true);
      // The module's own boot step (`capture.config`) read the same rows into the same selector.
      expect(captureConfigControl(first.app).snapshot().captureConfig.mics).toEqual(rehydrated.mics);
      await first.app.pipeline.drain();
      expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(first.engine.state()));

      // REPLICATES: an edit is one published replacement of slice `captureConfig`, and the stored row follows.
      const publishedBefore = stateChanges(first.publications).length;
      const technician = first.principal('TECHNICIAN');
      first.clock.advance(1_000);
      await first.engine.run('test.c1.primaryMic', (scope) => scope.command(technician, 'setCaptureConfig', { kind: 'PRIMARY_MIC', inputId: 'MIC-02' }));
      await first.app.pipeline.drain();
      const replaced = stateChanges(first.publications)
        .slice(publishedBefore)
        .flatMap((change) => change.ops.flatMap((op) => (op.op === 'replace' && op.slice === 'captureConfig' ? [op.value] : [])));
      expect(replaced).toHaveLength(1);
      expect(CaptureConfigSliceSchema.safeParse(replaced[0]).success).toBe(true);
      expect((replaced[0] as typeof rehydrated).mics.map((mic) => [mic.inputId, mic.channel])).toEqual([
        ['MIC-02', 'MIC-01'],
        ['MIC-05', 'MIC-02'],
        ['MIC-03', 'MIC-03'],
        ['MIC-04', 'MIC-04'],
      ]); // D61: the swap moved the transcribed channel; D60/D61: all four channels are listed, in channel order
      expect(await storedSelector(owner)).toMatchObject({ mic_01_id: 'MIC-02', mic_02_id: 'MIC-05' });
      // And back to the local microphone on the transcribed channel: the state a restart must bring back.
      first.clock.advance(1_000);
      await first.engine.run('test.c1.primaryMic', (scope) => scope.command(technician, 'setCaptureConfig', { kind: 'PRIMARY_MIC', inputId: 'MIC-05' }));
      await first.app.pipeline.drain();
      expect(await storedSelector(owner)).toMatchObject({ mic_01_id: 'MIC-05', mic_02_id: 'MIC-02' });
      expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(first.engine.state()));
      const held = first.engine.slice('captureConfig');
      await first.app.close();

      const second = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + 120_000 });
      await second.app.readiness.boot();
      await second.engine.idle();
      expect(second.engine.slice('captureConfig')).toEqual(held);
      expect(second.engine.slice('captureDevices').devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'CAM-05', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'MIC-05', 'POE-SWITCH']); // D60/D61 (2026-11-04): nine built-ins plus the two local rows
      await second.app.pipeline.drain();
      expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(second.engine.state()));
    });

    it('CONTROL: a selector that names a device which is no microphone still stops the start, by name', async () => {
      const target = await db.another({ template: 'seed', slug: 'c1-mic-control' });
      const owner = target.ownerPool();
      // The stored CHECKs and keys are the owner's to bend for a fixture: the engine must refuse what they would let through.
      const bent = await owner.query("UPDATE public.capture_config SET mic_01_id = 'CAM-02'").then(
        () => true,
        () => false,
      );
      expect(bent).toBe(true);
      const host = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + 60_000 });
      const error = await host.app.readiness.boot().then(
        () => null,
        (thrown: unknown) => thrown,
      );
      expect(error).toBeInstanceOf(BootError);
      expect((error as BootError).stepId).toBe('engine.rehydrate');
    });
  });

  describe('2. operations 78 and 79 ask the adapter registry of the running capture operation', () => {
    async function booted(target: Clone, overrides: Partial<ConfigInput>) {
      const log = captureLog();
      const app = buildApp({ config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'info', ...overrides }), logStream: log.stream });
      target.onCleanup(() => app.close());
      await app.ready();
      // A booted engine RUNS (decision D77): on the system timer it ticks every 50 ms and its health
      // sampler moves between a read of the tables and a read of `engine.state()` (the red of run 12,
      // test/12 R1). On a manual timer nobody fires, the committed state moves only by the commands of the case.
      engineControl(app).useTimer(manualTimer().timer);
      await app.readiness.boot();
      const signedIn = await webSignIn(app, 'rina.wijaya');
      expect(signedIn.statusCode).toBe(200);
      const token = cookieValue(signedIn, app.config.sessionCookieName);
      if (token === null) throw new Error('the web sign-in set no session cookie');
      const headers = { cookie: `${app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN };
      return {
        app,
        post: (url: string, payload: object) => app.inject({ method: 'POST', url, headers, payload }),
      };
    }
    /** A clone with speech-to-text off (a real-capture boot resolves the stored selection first) and one unassigned production camera. */
    async function clone(slug: string): Promise<Clone> {
      const target = await db.another({ template: 'seed', slug });
      const owner = target.ownerPool();
      await owner.query('UPDATE public.stt_config SET enabled = false');
      await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('CAM-11', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP')");
      return target;
    }

    it('REAL_DEVELOPMENT: a production camera is refused by both operations with the contract\'s reason, nothing is stored; the local camera is assigned', async () => {
      const target = await clone('c1-registry-dev');
      const owner = target.ownerPool();
      const server = await booted(target, DEVELOPMENT);
      expect(captureFenceControl(server.app).operation).toBe('REAL_DEVELOPMENT');
      expect(captureConfigControl(server.app).hasDeviceRegistry()).toBe(true);
      // The wiring leaves the one-provider rule in place: a second registry is still a mistake.
      expect(() => captureConfigControl(server.app).provideDeviceRegistry({ assertAssignable: () => { throw new Error('unused'); } })).toThrow(/twice/);
      const before = await storedSelector(owner);
      const rows = await changedRows(owner);

      const byCamera = await server.post(cameraSource('CAM-11'), { trackId: 'VIDEO-02' });
      const byConfig = await server.post(CONFIG, { cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-11' }] });
      for (const refused of [byCamera, byConfig]) {
        expect(refused.statusCode, refused.body).toBe(422);
        const error = (refused.json() as { error: { code: string; details?: Record<string, unknown> } }).error;
        expect(error.code).toBe('INVALID_INPUT');
        expect(error.details).toMatchObject({ reason: 'PRODUCTION_SOURCE_NOT_ALLOWED', deviceId: 'CAM-11' });
      }
      await server.app.pipeline.drain();
      expect(await storedSelector(owner)).toEqual(before);
      expect(await changedRows(owner)).toBe(rows);

      // CONTROL: a development source of the running operation is assigned by the same route.
      // The boot registered the local camera under the next free id (CAM-11 is taken by the fixture).
      const localCamera = captureFenceControl(server.app).outcome()?.local?.cameraId ?? '';
      expect(localCamera).toBe('CAM-12');
      const local = await server.post(cameraSource(localCamera), { trackId: 'VIDEO-02' });
      expect(local.statusCode, local.body).toBe(200);
      await server.app.pipeline.drain();
      expect(await storedSelector(owner)).toMatchObject({ video_02_device_id: localCamera });
      expect(await changedRows(owner)).toBe(rows + 1);
    });

    it('CONTROL, SIMULATED: no adapter is registered, no registry is taken, and no assignment is refused by source class (as before this pass in every operation)', async () => {
      const target = await clone('c1-registry-sim');
      const owner = target.ownerPool();
      const server = await booted(target, { demoControls: true });
      expect(captureFenceControl(server.app).registry()).toBeNull();
      expect(captureConfigControl(server.app).hasDeviceRegistry()).toBe(false);
      const assigned = await server.post(cameraSource('CAM-11'), { trackId: 'VIDEO-02' });
      expect(assigned.statusCode, assigned.body).toBe(200);
      await server.app.pipeline.drain();
      expect(await storedSelector(owner)).toMatchObject({ video_02_device_id: 'CAM-11' });
    });
  });
});

// ═══ Moved here from `integration-d1b.db.test.ts` (test-suite consolidation, D233): the cases as they were, under one describe. ═══
// Integration pass D1b (decision D133 (1)) on PostgreSQL, AS THE RUNTIME ROLE, on throw-away clones.
//
// OPERATION 78 ASSIGNS THE MICROPHONE INPUTS BY CHANNEL REPLACEMENT (D61, 2026-11-04: the lines
// carry `channel` - was `role` - and are the new pair (`deviceId == inputId`, at most one line per
// channel, any `MIC-NN` the adapter registry of the running capture operation accepts).
//
//   1. REAL_DEVELOPMENT: the local microphone the boot registered (`MIC-05` on the seed since D60/D61 of
//      2026-11-04 made `MIC-03` a built-in of the four-channel plane) is put
//      behind the capture THROUGH THE API - no fixture writes the selector. The slot carries the
//      transport of its registry row, the stored row follows, stored state equals committed state,
//      and a restarted Core holds the same selector.
//   2. ELSEWHERE the same body answers the contract's `422 INVALID_INPUT` and nothing is stored:
//      a registry that does not hold `MIC-05` (SIMULATED on the seed), and a microphone the
//      registry of the running operation refuses (a production microphone in REAL_DEVELOPMENT,
//      `details.reason: PRODUCTION_SOURCE_NOT_ALLOWED` - the registry check of pass C1 stays; fix
//      wave I, finding G70b-01: the reason is the refusal's own, not the development one).
//   3. The form without `channel` is still accepted and still cannot name a new input (D61).
//
// The helper program of the development boots is `/bin/echo` (row 136's fixture): a root-owned
// program that passes the path rule and is never asked to capture.
describe('D133 (1) (integration D1b): operation 78 replaces the microphone pair', () => {
  const HELPER = '/bin/echo';
  // A whole boot in capture mode real passes the boot checks of row 61 (`capture.boot`): a worker
  // program that passes the path rule and says HELLO, a private media root and a provisioned signing
  // key. Row 61's fixture gives the three (the key in a temporary directory, row 228b); the worker is a stand-in script and is
  // never asked to capture.
  const realBoot = realBootFixture('d1b');
  realBoot.provisionKey();
  afterAll(() => realBoot.remove());
  const DEVELOPMENT = { captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER, dataDir: realBoot.dataDir, captureWorkerPath: realBoot.worker('capture-worker', 'capture-worker/0.3.0') } as const;

  type Clone = Awaited<ReturnType<typeof db.another>>;
  interface ErrorBody {
    error: { code: string; details?: Record<string, unknown> };
  }
  interface SelectorBody {
    mics: { channel: string; inputId: string; deviceId: string; transport: string }[]; // D61 (2026-11-04): the line names its channel
  }

  const storedSelector = async (owner: Pool): Promise<Record<string, unknown> | undefined> =>
    (await owner.query('SELECT mic_01_id, mic_02_id FROM public.capture_config')).rows[0] as Record<string, unknown> | undefined; // D61 (2026-11-04): the role columns became the channel columns
  const changedRows = async (owner: Pool): Promise<Record<string, unknown>[]> =>
    (await owner.query("SELECT details FROM public.audit_log WHERE type = 'CAPTURE_CONFIG_CHANGED' ORDER BY seq")).rows.map((row: { details: Record<string, unknown> }) => row.details);

  // D61 (2026-11-04): the pair is assigned BY CHANNEL (rule MIC-ASSIGN of task 4 generalized by D61).
  const pair = (primary: string, standby: string) => ({
    mics: [
      { inputId: primary, deviceId: primary, channel: 'MIC-01' },
      { inputId: standby, deviceId: standby, channel: 'MIC-02' },
    ],
  });

  /** The devices the seed builds in: their stored rows surface no adapter (`captureDeviceFromRow`, db/mapping/rows.ts). D60/D61 (2026-11-04): four tracks, four channels. */
  const BUILT_IN_SOURCES = ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'];

  /**
   * The committed state WITHOUT the members the Core DERIVES AT BOOT (pass E3 item 2).
   *
   * The round trip "stored slices = committed state" holds for what the tables hold. Three members of
   * a device are not table facts, by the database contract (dbc-4 N.2, decision D-DB-11: "the source
   * class is not stored: it is derived from the adapter kind by one function") and by C3 2.6:
   *
   *   `adapter` / `sourceClass` on a BUILT-IN device  the registry of the RUNNING capture operation says
   *       them (boot step `devices.sourceFacts`, pass D11 item 1): `FAKE` / `DEVELOPMENT` in
   *       REAL_DEVELOPMENT, nothing in REAL_PRODUCTION and SIMULATED. The stored row of a built-in
   *       surfaces none, so the same tables read back without them under another operation;
   *   `sourceOpen`  what the fence holds open now; a process start begins with none.
   *
   * A device that is NOT built in (`MIC-03`, an adopted camera) keeps `adapter` / `sourceClass` in the
   * comparison: its row stores the adapter kind. The exclusion is exact - a built-in that carried
   * anything but `FAKE` / `DEVELOPMENT` here fails the case, and so does one that carried nothing.
   */
  function withoutBootDerivedSourceFacts(state: Parameters<typeof withoutNegativeZeros>[0]): ReturnType<typeof withoutNegativeZeros> {
    const durable = withoutNegativeZeros(state);
    const builtIns = durable.captureDevices.devices.filter((device) => BUILT_IN_SOURCES.includes(device.id));
    expect(builtIns.map((device) => [device.id, device.adapter, device.sourceClass])).toEqual(BUILT_IN_SOURCES.map((id) => [id, 'FAKE', 'DEVELOPMENT']));
    return {
      ...durable,
      captureDevices: {
        devices: durable.captureDevices.devices.map((device) => {
          const { sourceOpen: _open, ...kept } = device;
          if (!BUILT_IN_SOURCES.includes(device.id)) return kept;
          const { adapter: _adapter, sourceClass: _class, ...stored } = kept;
          return stored;
        }),
      },
    };
  }

  /** A clone with speech-to-text off: a real-capture boot resolves the stored selection first. */
  async function clone(slug: string): Promise<Clone> {
    const target = await db.another({ template: 'seed', slug });
    await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
    return target;
  }

  async function booted(target: Clone, overrides: Partial<ConfigInput>) {
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'info', ...overrides }), logStream: log.stream });
    target.onCleanup(() => app.close());
    await app.ready();
    // A booted engine RUNS (decision D77): on the system timer it ticks every 50 ms and its health
    // sampler moves between a read of the tables and a read of `engine.state()` (the red of run 12,
    // test/12 R1). On a manual timer nobody fires, the committed state moves only by the commands of the case.
    engineControl(app).useTimer(manualTimer().timer);
    await app.readiness.boot();
    const signedIn = await webSignIn(app, 'rina.wijaya');
    expect(signedIn.statusCode).toBe(200);
    const token = cookieValue(signedIn, app.config.sessionCookieName);
    if (token === null) throw new Error('the web sign-in set no session cookie');
    const headers = { cookie: `${app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN };
    return { app, post: (url: string, payload: object) => app.inject({ method: 'POST', url, headers, payload }) };
  }

  describe('operation 78: pair replacement of the microphone inputs', () => {
    it('REAL_DEVELOPMENT: MIC-05 is selected through the API, stored, equal to the committed state, and held across a restart', async () => {
      const target = await clone('d1b-pair-dev');
      const owner = target.ownerPool();
      const server = await booted(target, DEVELOPMENT);
      expect(captureFenceControl(server.app).operation).toBe('REAL_DEVELOPMENT');
      // The boot registered this Mac's microphone as a NEW device with its own id (D106 (4)); D60/D61 (2026-11-04): `MIC-03` is a built-in now, so the next free id of the class is `MIC-05`.
      expect(captureFenceControl(server.app).outcome()?.local?.micId).toBe('MIC-05');
      expect(await storedSelector(owner)).toEqual({ mic_01_id: 'MIC-01', mic_02_id: 'MIC-02' });
      const rowsBefore = (await changedRows(owner)).length;

      const answer = await server.post(CONFIG, pair('MIC-05', 'MIC-02'));
      expect(answer.statusCode, answer.body).toBe(200);
      expect(CaptureConfigSliceSchema.safeParse(answer.json()).success).toBe(true);
      // In input order; the new slot says the transport of its registry row, which the line did not name. D60/D61 (2026-11-04): the four channels answer, the moved one on channel MIC-01.
      expect((answer.json() as SelectorBody).mics.map((mic) => [mic.inputId, mic.deviceId, mic.channel, mic.transport])).toEqual([
        ['MIC-02', 'MIC-02', 'MIC-02', 'USB'],
        ['MIC-03', 'MIC-03', 'MIC-03', 'USB'],
        ['MIC-04', 'MIC-04', 'MIC-04', 'USB'],
        ['MIC-05', 'MIC-05', 'MIC-01', 'AVFOUNDATION'],
      ]); // D61 (2026-11-04): input order, the channel a member of the line
      await server.app.pipeline.drain();
      expect(await storedSelector(owner)).toEqual({ mic_01_id: 'MIC-05', mic_02_id: 'MIC-02' });
      expect((await changedRows(owner)).slice(rowsBefore)).toEqual([
        { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: 'MIC-01', inputId: 'MIC-05', deviceId: 'MIC-05', from: 'MIC-01', to: 'MIC-05', permission: 'CAPTURE_CONFIG' }, // D61: the row names the channel it edited
      ]);
      expect(await storedSlices(owner)).toStrictEqual(withoutBootDerivedSourceFacts(server.app.engine.state()));
      // CONTROL of the exclusion: without it the comparison is NOT equal - the members are there.
      expect(await storedSlices(owner)).not.toStrictEqual(withoutNegativeZeros(server.app.engine.state()));

      // REFUSED on the same server, nothing written: a pair that is not a pair, a microphone that is not registered.
      // (Task 4 row 29: until decision C21 (8) this list began with ONE line by role - the channel
      // of D61, 2026-11-04. A microphone channel is assignable alone since the contract of row 28 and
      // the hosted action of row 162 (rule MIC-ASSIGN of the names register, "one line: was 422, now
      // valid"), so that body is no refusal any more; the block "task 4 row 29" below holds it.)
      for (const body of [
        { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-01' }, { inputId: 'MIC-02', deviceId: 'MIC-02' }] },
        { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-01' }, { inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-01' }] }, // the same channel twice
        { mics: [{ inputId: 'MIC-05', deviceId: 'MIC-01', channel: 'MIC-01' }, { inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-02' }] }, // a line whose deviceId contradicts its input
        pair('MIC-07', 'MIC-02'),
        // The earlier form (no `channel`, D61) edits an input the selector holds: MIC-01 is not one any more.
        { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] },
      ]) {
        const refused = await server.post(CONFIG, body);
        expect([refused.statusCode, (refused.json() as ErrorBody).error.code], JSON.stringify(body)).toEqual([422, 'INVALID_INPUT']);
      }
      // The earlier form is still accepted for an input the selector holds (a line that changes nothing: 200, no row).
      expect((await server.post(CONFIG, { mics: [{ inputId: 'MIC-03', deviceId: 'MIC-03' }] })).statusCode).toBe(200);
      await server.app.pipeline.drain();
      expect(await storedSelector(owner)).toEqual({ mic_01_id: 'MIC-05', mic_02_id: 'MIC-02' });
      expect(await changedRows(owner)).toHaveLength(rowsBefore + 1);

      const held = server.app.engine.slice('captureConfig');
      await server.app.close();
      const restarted = await booted(target, DEVELOPMENT);
      expect(restarted.app.engine.slice('captureConfig')).toEqual(held);
      await restarted.app.pipeline.drain();
      expect(await storedSlices(owner)).toStrictEqual(withoutBootDerivedSourceFacts(restarted.app.engine.state()));
    });

    it('ELSEWHERE, SIMULATED on the seed: the registry holds no MIC-05 - 422 INVALID_INPUT, nothing stored; CONTROL: the built-in pair trades channels by the same body (D61)', async () => {
      const target = await clone('d1b-pair-sim');
      const owner = target.ownerPool();
      const server = await booted(target, { demoControls: true });
      expect(captureFenceControl(server.app).registry()).toBeNull();
      const rowsBefore = (await changedRows(owner)).length;
      const refused = await server.post(CONFIG, pair('MIC-05', 'MIC-02')); // D60/D61 (2026-11-04): `MIC-03` is a seeded built-in now; the unheld id is the next free one
      expect([refused.statusCode, (refused.json() as ErrorBody).error.code], refused.body).toEqual([422, 'INVALID_INPUT']);
      await server.app.pipeline.drain();
      expect(await storedSelector(owner)).toEqual({ mic_01_id: 'MIC-01', mic_02_id: 'MIC-02' });
      expect(await changedRows(owner)).toHaveLength(rowsBefore);

      const traded = await server.post(CONFIG, pair('MIC-02', 'MIC-01'));
      expect(traded.statusCode, traded.body).toBe(200);
      await server.app.pipeline.drain();
      expect(await storedSelector(owner)).toEqual({ mic_01_id: 'MIC-02', mic_02_id: 'MIC-01' });
      // D61 (2026-11-04): trading the pair is TWO channel replacements, in channel order (was ONE row by role).
      expect((await changedRows(owner)).slice(rowsBefore)).toEqual([
        { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: 'MIC-01', inputId: 'MIC-02', deviceId: 'MIC-02', from: 'MIC-01', to: 'MIC-02', permission: 'CAPTURE_CONFIG' },
        { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: 'MIC-02', inputId: 'MIC-01', deviceId: 'MIC-01', from: 'MIC-02', to: 'MIC-01', permission: 'CAPTURE_CONFIG' },
      ]);
      expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(server.app.engine.state()));
    });

    it('ELSEWHERE, REAL_DEVELOPMENT: a production microphone is refused by the adapter registry with the contract\'s reason, nothing stored', async () => {
      const target = await clone('d1b-pair-prod-mic');
      const owner = target.ownerPool();
      await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('MIC-11', 'MIC', 'USB', true, 'USB_AUDIO')");
      const server = await booted(target, DEVELOPMENT);
      expect(captureFenceControl(server.app).operation).toBe('REAL_DEVELOPMENT');
      const rowsBefore = (await changedRows(owner)).length;
      const refused = await server.post(CONFIG, pair('MIC-11', 'MIC-02'));
      expect(refused.statusCode, refused.body).toBe(422);
      const error = (refused.json() as ErrorBody).error;
      expect(error.code).toBe('INVALID_INPUT');
      expect(error.details).toMatchObject({ reason: 'PRODUCTION_SOURCE_NOT_ALLOWED', deviceId: 'MIC-11' });
      await server.app.pipeline.drain();
      expect(await storedSelector(owner)).toEqual({ mic_01_id: 'MIC-01', mic_02_id: 'MIC-02' });
      expect(await changedRows(owner)).toHaveLength(rowsBefore);
    });
  });
});

// ═══ Task 4 row 29 (WP-13a; decisions C14, C18, C21, C25; security requirements AD-04, AD-10). ═══
// AN UNASSIGNED SELECTOR SLOT AT A BOOTED CORE, on PostgreSQL, AS THE RUNTIME ROLE, on throw-away
// clones of the seed. The seed itself stays fully assigned: every NULL below is written into a clone,
// by the owner as a fixture or by the product through operation 78.
//
//   1. A stored selector with NULL slots BOOTS in each capture operation. Two readers stopped that
//      boot until WP-13a: the module's own load (step `capture.config`, sites A1 and A2 - this row)
//      and the engine rehydration (step `engine.rehydrate`, site A4 - row 166). Both pass, by name.
//   2. Operation 78 `unassign` REALLY clears a slot: the answer has no line for it, the stored
//      columns are NULL, one CAPTURE_CONFIG_CHANGED row per cleared slot states the track or input
//      and `from`; a slot is assigned again by the same operation; a restarted Core holds what the
//      product wrote. (Until this row the schema accepted the member and the Core answered 200
//      with nothing changed.)
//   3. The lock: with a session open - created, and RECORDING - an unassign is `409
//      CAPTURE_CONFIG_LOCKED` with no row and no change. In Simulated mode a session on a selector
//      with an unassigned slot starts as before (decision C21 (6)); the refusal of a start is a
//      rule of real capture (`plan.ts`, held in `plan.test.ts`; the 21 states are row 33's).
//
// The fence files are not touched and no case here asks them for a new answer: the boots below are
// the categories of design addendum 1.5 that boot (1: all unassigned; 2 in REAL_DEVELOPMENT; 3 in
// REAL_PRODUCTION).
describe('task 4 row 29: an unassigned selector slot - the boot, operation 78 `unassign`, the lock', () => {
  const HELPER = '/bin/echo';
  // Task 4 row 228b: this block's own synthetic installation (not a reserved id) - its key names it and its production boots are configured with it.
  const realBoot = realBootFixture('row29', 'DEMS-TEST-ROW29');
  realBoot.provisionKey();
  afterAll(() => realBoot.remove());
  // Task 4 row 85 (C46): a production boot is held to its host - the two stand-in programs here, the explicit TEST host handed in before each boot.
  const PRODUCTION = { captureMode: 'real', demoControls: false, dataDir: realBoot.dataDir, installationDeviceId: realBoot.installationId, captureWorkerPath: realBoot.worker('capture-worker', 'capture-worker/0.3.0'), ...testHostPrograms(realBoot.programsDir) } as const;
  const DEVELOPMENT = { ...PRODUCTION, captureDevSources: true, captureHelperFfmpegPath: HELPER } as const;
  const SIMULATED = { demoControls: true } as const;

  type Clone = Awaited<ReturnType<typeof db.another>>;
  // D61 (2026-11-04): the two mic roles became the four numbered channels and D60 added tracks 3/4 —
  // this walk holds ALL EIGHT slots the seed assigns.
  const SLOTS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const;
  type Slot = (typeof SLOTS)[number];
  const SEEDED = { video_01_device_id: 'CAM-01', video_01_profile: 'H264_1080P25', video_02_device_id: 'CAM-02', video_02_profile: 'H264_1080P25', video_03_device_id: 'CAM-03', video_03_profile: 'H264_1080P25', video_04_device_id: 'CAM-04', video_04_profile: 'H264_1080P25', mic_01_id: 'MIC-01', mic_02_id: 'MIC-02', mic_03_id: 'MIC-03', mic_04_id: 'MIC-04' } as const; // D61: the role columns became the channel columns; D60/D61: the seed assigns all eight slots
  const COLUMNS_OF: Readonly<Record<Slot, readonly (keyof typeof SEEDED)[]>> = {
    'VIDEO-01': ['video_01_device_id', 'video_01_profile'],
    'VIDEO-02': ['video_02_device_id', 'video_02_profile'],
    'VIDEO-03': ['video_03_device_id', 'video_03_profile'], // D60 (2026-11-04): four tracks
    'VIDEO-04': ['video_04_device_id', 'video_04_profile'], // D60
    'MIC-01': ['mic_01_id'], // D61 (2026-11-04): the roles became the numbered channels (0040 renames)
    'MIC-02': ['mic_02_id'], // D61
    'MIC-03': ['mic_03_id'], // D61
    'MIC-04': ['mic_04_id'], // D61
  };
  const HELD: Readonly<Record<Slot, string>> = { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-02', 'VIDEO-03': 'CAM-03', 'VIDEO-04': 'CAM-04', 'MIC-01': 'MIC-01', 'MIC-02': 'MIC-02', 'MIC-03': 'MIC-03', 'MIC-04': 'MIC-04' }; // D60/D61: eight held slots of the seed
  /** The seeded row with the columns of the named slots NULL. */
  const rowWithout = (unassigned: readonly Slot[]): Record<string, string | null> => {
    const row: Record<string, string | null> = { ...SEEDED };
    for (const slot of unassigned) for (const column of COLUMNS_OF[slot]) row[column] = null;
    return row;
  };
  /** The row of a cleared slot (names register of row 161, 4.4): the track or the input, and `from`; no `to`, no `deviceId`. */
  const clearedRow = (slot: Slot, from: string = HELD[slot]) =>
    slot.startsWith('VIDEO') // D60 (2026-11-04): four tracks — the test is by the class of the slot, not by its number
      ? { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: slot, from, permission: 'CAPTURE_CONFIG' }
      : { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: slot, inputId: from, from, permission: 'CAPTURE_CONFIG' }; // D61 (2026-11-04): the row names the cleared channel

  const storedSlots = async (owner: Pool): Promise<Record<string, unknown> | undefined> =>
    (await owner.query('SELECT video_01_device_id, video_01_profile, video_02_device_id, video_02_profile, video_03_device_id, video_03_profile, video_04_device_id, video_04_profile, mic_01_id, mic_02_id, mic_03_id, mic_04_id FROM public.capture_config')).rows[0] as Record<string, unknown> | undefined; // D61 (2026-11-04): the role columns became the channel columns; D60/D61: all twelve columns of the eight slots
  const changedRows = async (owner: Pool): Promise<Record<string, unknown>[]> =>
    (await owner.query("SELECT details FROM public.audit_log WHERE type = 'CAPTURE_CONFIG_CHANGED' ORDER BY seq")).rows.map((row: { details: Record<string, unknown> }) => row.details);
  /** The fixture of a stored unassigned slot: the owner writes NULL into the columns of the named slots. */
  const unassignStored = (owner: Pool, unassigned: readonly Slot[]): Promise<unknown> =>
    owner.query(`UPDATE public.capture_config SET ${unassigned.flatMap((slot) => COLUMNS_OF[slot]).map((column) => `${column} = NULL`).join(', ')}`);

  /**
   * A password of the operators' own (a `REAL_PRODUCTION` Core does not start while one still has
   * the published demonstration password; ruling D241). Built at run time and kept nowhere; every
   * stored hash set is replaced by one the product's hasher derived from it.
   */
  const OWN_PASSWORD = ['own', 'row29', String(process.pid), 'x7Kq'].join('-');
  async function ownCredentials(owner: Pool): Promise<void> {
    const operators = (await owner.query<{ operator_id: string }>('SELECT operator_id FROM public.operator_credentials ORDER BY operator_id')).rows;
    const record = await hashPassword(OWN_PASSWORD);
    for (const { operator_id } of operators) {
      await owner.query('UPDATE public.operator_credentials SET algorithm = $2, memory_kib = $3, passes = $4, parallelism = $5, salt = $6, hash = $7 WHERE operator_id = $1', [operator_id, record.algorithm, record.memoryKib, record.passes, record.parallelism, record.salt, record.hash]);
    }
  }

  /** A clone with speech-to-text off (a real-capture boot resolves the stored selection first), prepared by the owner. */
  async function clone(slug: string, prepare?: (owner: Pool) => Promise<unknown>): Promise<Clone> {
    const target = await db.another({ template: 'seed', slug });
    await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
    await prepare?.(target.ownerPool());
    return target;
  }

  /** The real app on a clone, as `dems_app`, booted on a manual timer, with the TECHNICIAN signed in on the web console. */
  async function booted(target: Clone, overrides: Partial<ConfigInput>, password?: string) {
    const log = captureLog();
    const app = buildApp({ config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'info', ...overrides }), logStream: log.stream });
    target.onCleanup(() => app.close());
    await app.ready();
    provideTestCaptureHost(app);
    engineControl(app).useTimer(manualTimer().timer);
    await app.readiness.boot();
    /** The boot steps that passed, in order. */
    const steps = log.lines().filter((line) => line['msg'] === 'boot step passed').map((line) => String(line['step']));
    const signedIn = password === undefined ? await webSignIn(app, 'rina.wijaya') : await webSignIn(app, 'rina.wijaya', password);
    expect(signedIn.statusCode, signedIn.body).toBe(200);
    const token = cookieValue(signedIn, app.config.sessionCookieName);
    if (token === null) throw new Error('the web sign-in set no session cookie');
    const headers = { cookie: `${app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN };
    return {
      app,
      log,
      steps,
      get: (url: string) => app.inject({ method: 'GET', url, headers }),
      post: (url: string, payload: object) => app.inject({ method: 'POST', url, headers, payload }),
    };
  }
  const linesOf = (selector: Pick<Selector, 'cameras' | 'mics'>): string[] => [...selector.cameras.map((camera) => `${camera.trackId} ${camera.deviceId}`), ...selector.mics.map((mic) => `${mic.channel} ${mic.deviceId}`)].sort(); // D61 (2026-11-04): the channel labels the line
  const ALL_LINES = SLOTS.map((slot) => `${slot} ${HELD[slot]}`).sort();

  describe('1. a stored selector with NULL slots boots: the steps `capture.config` and `engine.rehydrate` pass, by name', () => {
    const OPERATIONS = [
      ['SIMULATED', SIMULATED, false],
      ['REAL_DEVELOPMENT', DEVELOPMENT, false],
      ['REAL_PRODUCTION', PRODUCTION, true],
    ] as const;

    it.each(OPERATIONS)('GATE CONDITION AD-04, %s: a selector row of eight NULLs - the Core starts, the selector is two empty lists, operation 76 answers it', async (operation, config, production) => {
      const target = await clone(`r29-six-${operation.toLowerCase().replace('_', '-')}`, async (owner) => {
        await unassignStored(owner, SLOTS);
        if (production) await ownCredentials(owner);
      });
      const owner = target.ownerPool();
      expect(await storedSlots(owner)).toEqual(rowWithout(SLOTS));
      const core = await booted(target, config, production ? OWN_PASSWORD : undefined);
      expect(captureFenceControl(core.app).operation).toBe(operation);
      // The two former boot-stoppers, each by its step: the module's load (this row) and the engine rehydration (row 166).
      expect(core.steps).toEqual(expect.arrayContaining(['capture.config', 'engine.rehydrate']));
      // No reader read "no row" for "no source": the load is the stored row, not the built-in baseline.
      const snapshot = captureConfigControl(core.app).snapshot();
      expect([snapshot.builtInBaseline, snapshot.captureConfig.cameras, snapshot.captureConfig.mics]).toEqual([false, [], []]);
      expect(core.log.lines().filter((line) => line['code'] === 'CAPTURE_CONFIG_BASELINE' || line['code'] === 'CAPTURE_ROW_INVALID')).toEqual([]);
      const committed = core.app.engine.slice('captureConfig');
      expect([committed.cameras, committed.mics]).toEqual([[], []]);
      const answer = await core.get(CONFIG);
      expect(answer.statusCode, answer.body).toBe(200);
      expect(validateCoreApiResponse('getCaptureConfig', 200, bodyOf(answer))).toEqual({ ok: true });
      expect(selectorOf(answer)).toMatchObject({ cameras: [], mics: [], locked: false });
      // Nothing was assigned by the boot: the stored row is still eight NULLs (D60/D61, 2026-11-04).
      await core.app.pipeline.drain();
      expect(await storedSlots(owner)).toEqual(rowWithout(SLOTS));
    });

    it.each([OPERATIONS[0], OPERATIONS[1]])('AD-04 (2), %s: only VIDEO-02 and only a channel-2 microphone stored (D61) - those two lines and no other, in the load and in the engine (nothing by position)', async (operation, config) => {
      const target = await clone(`r29-two-${operation.toLowerCase().replace('_', '-')}`, (owner) => unassignStored(owner, ['VIDEO-01', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-03', 'MIC-04'])); // D61 (2026-11-04): the slot is the numbered channel; D60/D61: everything but VIDEO-02 and MIC-02 is cleared
      const core = await booted(target, config);
      expect(captureFenceControl(core.app).operation).toBe(operation);
      expect(core.steps).toEqual(expect.arrayContaining(['capture.config', 'engine.rehydrate']));
      const expected = ['MIC-02 MIC-02', 'VIDEO-02 CAM-02']; // D61: the channel labels the line
      expect(linesOf(captureConfigControl(core.app).snapshot().captureConfig)).toEqual(expected);
      expect(linesOf(core.app.engine.slice('captureConfig'))).toEqual(expected);
      expect(linesOf(selectorOf(await core.get(CONFIG)))).toEqual(expected);
      expect(core.app.engine.slice('captureConfig').mics.map((mic) => [mic.inputId, mic.channel])).toEqual([['MIC-02', 'MIC-02']]);
    });
  });

  describe('2. operation 78 `unassign` clears a slot for real, and the slot is assigned again', () => {
    it('SIMULATED on the seed: each of the eight slots - the answer without the line, NULL stored, ONE row with `from`; stored = committed; a restarted Core boots on the eight NULLs the product wrote; all eight are assigned again', async () => {
      const target = await clone('r29-unassign-sim');
      const owner = target.ownerPool();
      const first = await booted(target, SIMULATED);
      expect(await storedSlots(owner)).toEqual(SEEDED);
      const rowsBefore = (await changedRows(owner)).length;

      const cleared: Slot[] = [];
      for (const slot of SLOTS) {
        const answer = await first.post(CONFIG, { unassign: [slot] });
        expect(answer.statusCode, `${slot} ${answer.body}`).toBe(200);
        expect(validateCoreApiResponse('updateCaptureConfig', 200, bodyOf(answer)), slot).toEqual({ ok: true });
        cleared.push(slot);
        // The slice with the ABSENT line: no line of the slot, every other line as it was.
        expect(linesOf(selectorOf(answer)), slot).toEqual(ALL_LINES.filter((line) => !cleared.some((gone) => line.startsWith(`${gone} `))));
        await first.app.pipeline.drain();
        // PERSISTED: NULL in the columns of that slot (device and profile of a video slot together), nothing else moved.
        expect(await storedSlots(owner), slot).toEqual(rowWithout(cleared));
      }
      // AD-10 (1): one stored row per cleared slot, with the closed keys the trail accepts (the engine refuses any other; the mic rows name their channel since D61).
      expect((await changedRows(owner)).slice(rowsBefore)).toEqual(SLOTS.map((slot) => clearedRow(slot)));
      // Clearing empty slots: 200, the same selector, 0 rows, nothing written.
      const again = await first.post(CONFIG, { unassign: [...SLOTS] });
      expect(again.statusCode, again.body).toBe(200);
      expect(selectorOf(again)).toMatchObject({ cameras: [], mics: [] });
      await first.app.pipeline.drain();
      expect(await changedRows(owner)).toHaveLength(rowsBefore + 8); // D60/D61 (2026-11-04): eight slots cleared
      expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(first.app.engine.state()));
      const trail = await readTrail(owner);
      expect(linkProblems(trail)).toEqual([]);
      await first.app.close();

      // A RESTART on what the product itself wrote: the Core boots, and holds the empty selector.
      const second = await booted(target, SIMULATED);
      expect(second.steps).toEqual(expect.arrayContaining(['capture.config', 'engine.rehydrate']));
      expect(linesOf(second.app.engine.slice('captureConfig'))).toEqual([]);
      expect(linesOf(captureConfigControl(second.app).snapshot().captureConfig)).toEqual([]);

      // RE-ASSIGNING: each slot by its track or its channel (D61, 2026-11-04); a microphone channel alone (C21 (8)).
      const camera1 = await second.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_1080P25' }] });
      expect(camera1.statusCode, camera1.body).toBe(200);
      expect(linesOf(selectorOf(camera1))).toEqual(['VIDEO-01 CAM-01']);
      const standby = await second.post(CONFIG, { mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-02' }] }); // D61: the line names its channel
      expect(standby.statusCode, standby.body).toBe(200);
      expect(linesOf(selectorOf(standby))).toEqual(['MIC-02 MIC-02', 'VIDEO-01 CAM-01']);
      await second.app.pipeline.drain();
      expect(await storedSlots(owner)).toEqual(rowWithout(['VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-03', 'MIC-04'])); // D60/D61: six slots still empty here
      const rest = await second.post(CONFIG, { cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_1080P25' }], mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-01' }] });
      expect(rest.statusCode, rest.body).toBe(200);
      // D60/D61 (2026-11-04): the seed's four tracks and four channels — the widened slots come back in one more edit.
      const wide = await second.post(CONFIG, { cameras: [{ trackId: 'VIDEO-03', deviceId: 'CAM-03', profile: 'H264_1080P25' }, { trackId: 'VIDEO-04', deviceId: 'CAM-04', profile: 'H264_1080P25' }], mics: [{ inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-03' }, { inputId: 'MIC-04', deviceId: 'MIC-04', channel: 'MIC-04' }] });
      expect(wide.statusCode, wide.body).toBe(200);
      expect(linesOf(selectorOf(wide))).toEqual(ALL_LINES);
      expect(selectorOf(wide).mics.map((mic) => [mic.inputId, mic.channel, mic.transport])).toEqual([
        ['MIC-01', 'MIC-01', 'USB'],
        ['MIC-02', 'MIC-02', 'USB'],
        ['MIC-03', 'MIC-03', 'USB'],
        ['MIC-04', 'MIC-04', 'USB'],
      ]); // D61 (2026-11-04): the channel replaced the role; the answer lists the four lines by input
      await second.app.pipeline.drain();
      // The stored row is the seeded one again, column for column.
      expect(await storedSlots(owner)).toEqual(SEEDED);
      // Eight assignments into empty slots: eight rows, none of them states a `from` (nothing was there). D60/D61 (2026-11-04).
      const assigned = (await changedRows(owner)).slice(rowsBefore + 8);
      expect(assigned.map((row) => [row['scope'], row['field'], row['to'], Object.hasOwn(row, 'from')])).toEqual([
        ['CAMERA', 'SOURCE', 'CAM-01', false],
        ['MIC', 'SOURCE', 'MIC-02', false],
        ['CAMERA', 'SOURCE', 'CAM-02', false],
        ['MIC', 'SOURCE', 'MIC-01', false],
        ['CAMERA', 'SOURCE', 'CAM-03', false],
        ['CAMERA', 'SOURCE', 'CAM-04', false],
        ['MIC', 'SOURCE', 'MIC-03', false],
        ['MIC', 'SOURCE', 'MIC-04', false],
      ]);
      expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(second.app.engine.state()));
      const after = await readTrail(owner);
      expect(linkProblems(after)).toEqual([]);
      expect(verifyTrail(after, await readHead(owner))).toMatchObject({ ok: true });
    });

    it('REAL_PRODUCTION: a Core with one production camera assigned and seven slots unassigned boots; the camera is unassigned through operation 78 (one row), a development source is still refused, and the restarted Core boots on the empty selector', async () => {
      const target = await clone('r29-unassign-prod', async (owner) => {
        await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('CAM-11', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP')");
        await owner.query("UPDATE public.capture_config SET video_01_device_id = 'CAM-11', video_01_profile = 'H264_1080P25'");
        // D60/D61 (2026-11-04): SEVEN slots unassigned — a FAKE built-in left on any of them refuses the production boot.
        await unassignStored(owner, ['VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']);
        await ownCredentials(owner);
      });
      const owner = target.ownerPool();
      const first = await booted(target, PRODUCTION, OWN_PASSWORD);
      expect(captureFenceControl(first.app).operation).toBe('REAL_PRODUCTION');
      expect(first.steps).toEqual(expect.arrayContaining(['capture.fence', 'capture.config', 'engine.rehydrate']));
      expect(linesOf(first.app.engine.slice('captureConfig'))).toEqual(['VIDEO-01 CAM-11']);
      const rowsBefore = (await changedRows(owner)).length;

      const answer = await first.post(CONFIG, { unassign: ['VIDEO-01', 'MIC-02'] });
      expect(answer.statusCode, answer.body).toBe(200);
      expect(selectorOf(answer)).toMatchObject({ cameras: [], mics: [] });
      await first.app.pipeline.drain();
      expect(await storedSlots(owner)).toEqual(rowWithout(SLOTS));
      // One slot held a source, one was empty: ONE row.
      expect((await changedRows(owner)).slice(rowsBefore)).toEqual([clearedRow('VIDEO-01', 'CAM-11')]);

      // What `unassign` does NOT open: a development source is refused for a production Core as before, nothing is stored.
      const refused = await first.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_1080P25' }] });
      expect([refused.statusCode, (refused.json() as { error: { code: string } }).error.code], refused.body).toEqual([422, 'INVALID_INPUT']);
      await first.app.pipeline.drain();
      expect(await storedSlots(owner)).toEqual(rowWithout(SLOTS));
      expect(await changedRows(owner)).toHaveLength(rowsBefore + 1);
      await first.app.close();

      const second = await booted(target, PRODUCTION, OWN_PASSWORD);
      expect(captureFenceControl(second.app).operation).toBe('REAL_PRODUCTION');
      expect(second.steps).toEqual(expect.arrayContaining(['capture.fence', 'capture.config', 'engine.rehydrate']));
      expect(linesOf(second.app.engine.slice('captureConfig'))).toEqual([]);
    });

    // R-FLEX row 132, open check T-13 (01_specs_rflex_audio.md §10; 01_specs_rflex.md §5.1; D16 Q96-02 (B)):
    // a microphone MOVES from channel 1 to channel 2 in ONE edit of operation 78 - `unassign` of MIC-01 and a MIC-02 line
    // naming the microphone channel 1 held (D61, 2026-11-04: was the roles). Risk R-2: refused if the mic rule does not take `unassign` first.
    it('T-13, SIMULATED: MIC-01 = MIC-01 and MIC-02 empty; ONE edit `{unassign: [MIC-01], MIC-02-line: MIC-01}` - 200, channel 1 empty, channel 2 = MIC-01, stored, two CAPTURE_CONFIG_CHANGED rows of scope MIC', async () => {
      const target = await clone('r132-t13-mic-move', (owner) => unassignStored(owner, ['VIDEO-03', 'VIDEO-04', 'MIC-02', 'MIC-03', 'MIC-04'])); // D60/D61 (2026-11-04): only VIDEO-01/02 and MIC-01 stay assigned
      const owner = target.ownerPool();
      const core = await booted(target, SIMULATED);
      expect(await storedSlots(owner)).toEqual(rowWithout(['VIDEO-03', 'VIDEO-04', 'MIC-02', 'MIC-03', 'MIC-04'])); // D60/D61
      const rowsBefore = (await changedRows(owner)).length;

      const answer = await core.post(CONFIG, { unassign: ['MIC-01'], mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-02' }] }); // D61 (2026-11-04): the move is by channel
      expect(answer.statusCode, answer.body).toBe(200);
      expect(validateCoreApiResponse('updateCaptureConfig', 200, bodyOf(answer))).toEqual({ ok: true });
      expect(linesOf(selectorOf(answer))).toEqual(['MIC-02 MIC-01', 'VIDEO-01 CAM-01', 'VIDEO-02 CAM-02']);
      // The moved line is a new line of the cleared selector: it carries the registered transport (first run: `UNKNOWN` committed, `USB` stored).
      expect(selectorOf(answer).mics.map((mic) => [mic.inputId, mic.channel, mic.transport])).toEqual([['MIC-01', 'MIC-02', 'USB']]);
      await core.app.pipeline.drain();
      expect(await storedSlots(owner)).toEqual({ ...rowWithout(['VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-03', 'MIC-04']), mic_02_id: 'MIC-01' }); // D60/D61: the six other slots stand as the fixture left them
      const rows = (await changedRows(owner)).slice(rowsBefore);
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row['scope'])).toEqual(['MIC', 'MIC']);
      expect(rows).toContainEqual(clearedRow('MIC-01'));
      expect(rows).toContainEqual(expect.objectContaining({ operationId: 'updateCaptureConfig', scope: 'MIC', to: 'MIC-01' }));
      expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(core.app.engine.state()));
    });
  });

  describe('3. the lock, and a session on an incomplete selector in Simulated mode', () => {
    const SESSION_INPUT = { caseNumber: 'LP/2026/1001-0029', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;

    it('SIMULATED: the channel-2 slot is unassigned (D61); a session is created and STARTS as before (C21 (6)); created and RECORDING, every unassign is 409 CAPTURE_CONFIG_LOCKED with 0 rows and nothing stored (AD-10 (2))', async () => {
      const target = await clone('r29-lock-sim');
      const owner = target.ownerPool();
      const core = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + 60_000, logLevel: 'info', config: SIMULATED });
      await core.app.readiness.boot();
      await core.engine.idle();
      const signedIn = await webSignIn(core.app, 'rina.wijaya');
      expect(signedIn.statusCode, signedIn.body).toBe(200);
      const token = cookieValue(signedIn, core.app.config.sessionCookieName);
      if (token === null) throw new Error('the web sign-in set no session cookie');
      const headers = { cookie: `${core.app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN };
      const post = (payload: object) => core.app.inject({ method: 'POST', url: CONFIG, headers, payload });

      expect((await post({ unassign: ['MIC-02'] })).statusCode).toBe(200);
      await core.app.pipeline.drain();
      expect(await storedSlots(owner)).toEqual(rowWithout(['MIC-02'])); // D61 (2026-11-04): channel 2 (was STANDBY)
      const rows = (await changedRows(owner)).length;
      const held = core.engine.slice('captureConfig');

      const bodies = [...SLOTS.map((slot) => ({ unassign: [slot] })), { unassign: [...SLOTS] }];
      const expectLocked = async (label: string): Promise<void> => {
        const trail = (await readTrail(owner)).length;
        for (const body of bodies) {
          const refused = await post(body);
          expect(outcome(refused), `${label} ${JSON.stringify(body)}`).toEqual([409, 'CAPTURE_CONFIG_LOCKED']);
          expect(validateCoreApiResponse('updateCaptureConfig', 409, refused.json()), label).toEqual({ ok: true });
        }
        await core.app.pipeline.drain();
        // SEC35-19: no CAPTURE_CONFIG_CHANGED row and no other row; the selector and its stored row as they were.
        expect((await readTrail(owner)).length, label).toBe(trail);
        expect(await changedRows(owner), label).toHaveLength(rows);
        expect(core.engine.slice('captureConfig'), label).toBe(held);
        expect(await storedSlots(owner), label).toEqual(rowWithout(['MIC-02']));
      };

      const investigator = core.principal('INVESTIGATOR');
      const created = await core.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
      expect(created.value).toMatchObject({ ok: true, created: true });
      await expectLocked('CREATE');

      // The session starts on the selector with the unassigned channel-2 slot, as it did before WP-13a in Simulated mode.
      // (A tablet is "connected" by the engine's own door, as the session tests do: the pre-check item CORE needs the link.)
      await core.engine.setTabletLink('CONNECTED');
      await core.engine.command(investigator, 'beginPrecheck');
      await core.drive(5_000);
      // The pre-check of a Simulated Core says of the unassigned channel what it said before WP-13a: a WARN, never the BLOCK of real capture (the stored check ID keeps the role name, D61).
      const items = core.engine.slice('session')?.precheck?.items ?? [];
      expect(items.filter((item) => item.status === 'BLOCK')).toEqual([]);
      expect(items.filter((item) => item.value === 'NOT_ASSIGNED')).toEqual([]);
      expect(items.find((item) => item.id === 'MIC_STANDBY')?.status).toBe('WARN');
      if (core.engine.slice('session')?.state === 'PRECHECK') await core.engine.command(investigator, 'acknowledgePrecheckWarnings');
      expect(core.engine.slice('session')?.state).toBe('ARMED');
      await core.engine.command(investigator, 'startRecording');
      expect(core.engine.slice('session')?.state).toBe('RECORDING');
      await expectLocked('RECORDING');
    });
  });

  // Task 4 row 158 (AD-10 of verification/04_security_addendum.md): what row 29 left of the `unassign` rules, on
  // PostgreSQL as the runtime role. Row 29 holds, and this block does not repeat: the cleared slot and its row per slot
  // through a web console session; 0 rows for an empty slot; the lock in a unit table of eight states and on PostgreSQL
  // for CREATE and RECORDING; the 422 of a body that clears and fills one slot against the simulator double;
  // `SELECTOR_SHAPE` for every incomplete selector, S-5 (three slots assigned, channel 2 not - D61) by name (`plan.test.ts`).
  describe('4. task 4 row 158 (AD-10): who may unassign, the lock in every session state, the stored row per slot, an unassign against a session that is being opened', () => {
    const SESSION_INPUT = { caseNumber: 'LP/2026/1001-0158', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;
    const BODIES = [...SLOTS.map((slot) => ({ unassign: [slot] })), { unassign: [...SLOTS] }];
    /** Every key of a stored row is a key of the closed list of its type, in the form the list holds it to; every required key is there. */
    const expectClosedKeys = (details: Record<string, unknown>): void => {
      const rules = detailRulesOf('CAPTURE_CONFIG_CHANGED') ?? {};
      for (const [key, value] of Object.entries(details)) {
        expect(Object.hasOwn(rules, key), key).toBe(true);
        expect(rules[key]?.accepts(value as Parameters<DetailRule['accepts']>[0]), `${key}=${String(value)}`).toBe(true);
      }
      for (const [key, rule] of Object.entries(rules)) if (rule.required) expect(Object.hasOwn(details, key), key).toBe(true);
    };
    /** A Simulated Core on a clone, on a manual clock, with the TECHNICIAN signed in on the web console. */
    async function consoleCore(slug: string) {
      const target = await clone(slug);
      const owner = target.ownerPool();
      const core = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + 60_000, logLevel: 'info', config: SIMULATED });
      await core.app.readiness.boot();
      await core.engine.idle();
      const signedIn = await webSignIn(core.app, 'rina.wijaya');
      expect(signedIn.statusCode, signedIn.body).toBe(200);
      const token = cookieValue(signedIn, core.app.config.sessionCookieName);
      if (token === null) throw new Error('the web sign-in set no session cookie');
      const headers = { cookie: `${core.app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN };
      const post = (payload: object) => core.app.inject({ method: 'POST', url: CONFIG, headers, payload });
      const trailLength = async (): Promise<number> => {
        await core.app.pipeline.drain();
        return (await readTrail(owner)).length;
      };
      return { owner, core, post, trailLength, investigator: core.principal('INVESTIGATOR'), supervisor: core.principal('SUPERVISOR') };
    }
    type ConsoleCore = Awaited<ReturnType<typeof consoleCore>>;
    const stateOf = (of: ConsoleCore): string => of.core.engine.slice('session')?.state ?? 'NONE';
    /** A session of the Core, from nothing to ARMED (the pre-check item CORE needs the tablet link, as the session tests give it). */
    async function armed(of: ConsoleCore, onState: () => Promise<void> = async () => {}): Promise<void> {
      const created = await of.core.engine.command(of.investigator, 'createSession', { ...SESSION_INPUT, investigatorId: of.investigator.operatorId });
      expect(created.value).toMatchObject({ ok: true, created: true });
      await onState();
      await of.core.engine.setTabletLink('CONNECTED');
      await of.core.engine.command(of.investigator, 'beginPrecheck');
      await onState();
      await of.core.drive(5_000);
      if (stateOf(of) === 'PRECHECK') await of.core.engine.command(of.investigator, 'acknowledgePrecheckWarnings');
      expect(stateOf(of)).toBe('ARMED');
      await onState();
    }

    it('AD-10 (5), every client kind and role against the access members of the contract: the permission decides and nothing else - a web console session and a session of a paired device alike; a device credential alone, no credential and a retired device never reach the handler; each cleared slot is ONE stored row with the closed keys, by its caller, from its device', async () => {
      const target = await clone('r158-access');
      const owner = target.ownerPool();
      // The REAL app with every stage but stage 4, which hands out the principal the test names - as stage 4 resolves it
      // for that client kind. Stage 6 (the access rule), the handler, the engine and the trail are the product's.
      let current: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
      const app = buildApp({ config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'info', ...SIMULATED }), logStream: captureLog().stream });
      app.stages.replace('authenticate', (request) => {
        request.principal = current;
      });
      target.onCleanup(() => app.close());
      await app.ready();
      engineControl(app).useTimer(manualTimer().timer);
      await app.readiness.boot();
      const post = async (principal: Principal, payload: object) => {
        current = principal;
        const answer = await app.inject({ method: 'POST', url: CONFIG, headers: { origin: WEB_ORIGIN }, payload });
        await app.pipeline.drain();
        return answer;
      };
      const rowsFrom = async (from: number) => (await readTrail(owner)).slice(from);

      // THE CONTRACT'S ACCESS MEMBERS of operation 78: one permission, and NO condition on the kind of client (AD-10 (5):
      // `unassign` is not web-console only; that would be the condition WEB_CONSOLE_SESSION, and it is not there).
      const access = captureConfigOperation('updateCaptureConfig').access;
      expect(access).toEqual({ kind: CoreApiAccessKind.PERMISSION, permission: 'CAPTURE_CONFIG' });
      expect(Object.hasOwn(access, 'conditions')).toBe(false);
      const permission = 'CAPTURE_CONFIG' as const;

      const operatorIdOf = (role: OperatorRole): string => {
        const found = app.engine.slice('operators').find((candidate) => candidate.role === role);
        if (found === undefined) throw new Error(`no operator with role ${role}`);
        return found.id;
      };
      const CLIENTS = [
        ['a web console session', null],
        ['a session of a paired device (tablet or phone)', 'DEV-0001'],
      ] as const;
      const ROLES = ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const satisfies readonly OperatorRole[];
      expect([...ROLES].sort()).toEqual(Object.keys(ROLE_PERMISSIONS).sort());

      const free: Slot[] = [...SLOTS];
      const cleared: Slot[] = [];
      const table: string[] = [];
      for (const [client, deviceId] of CLIENTS) {
        for (const role of ROLES) {
          const label = `${role} on ${client}`;
          const principal: Principal = { kind: 'OPERATOR', operatorId: operatorIdOf(role), sessionId: 'row158-session', deviceId, role, permissions: ROLE_PERMISSIONS[role] };
          const before = (await readTrail(owner)).length;
          // WHAT THE CONTRACT SAYS, computed from its access members and the role table - not from a list in this test.
          const allowed = (ROLE_PERMISSIONS[role] as readonly string[]).includes(access.kind === CoreApiAccessKind.PERMISSION ? access.permission : '');
          const slot = free[0] as Slot;
          const answer = await post(principal, { unassign: [slot] });
          const rows = await rowsFrom(before);
          if (allowed) {
            free.shift();
            cleared.push(slot);
            expect(answer.statusCode, `${label} ${answer.body}`).toBe(200);
            expect(validateCoreApiResponse('updateCaptureConfig', 200, bodyOf(answer)), label).toEqual({ ok: true });
            // AD-10 (1): ONE row, of the one type, by the caller, from the device that sent it (none for the web console),
            // with the track or the input and `from` - and no `to`, no `deviceId` in the details: nothing was assigned.
            expect(rows.map((row) => [row.type, row.actorId, row.deviceId ?? null, row.details]), label).toEqual([['CAPTURE_CONFIG_CHANGED', principal.operatorId, deviceId, clearedRow(slot)]]);
            expectClosedKeys(rows[0]?.details ?? {});
            expect(Object.keys(rows[0]?.details ?? {}).sort(), label).toEqual(['field', 'from', slot.startsWith('VIDEO') ? 'trackId' : 'inputId', 'operationId', 'permission', 'scope'].sort());
          } else {
            expect(outcome(answer), label).toEqual([403, 'NOT_PERMITTED']);
            expect(validateCoreApiResponse('updateCaptureConfig', 403, answer.json()), label).toEqual({ ok: true });
            expect(errorOf(answer).details, label).toMatchObject({ operationId: 'updateCaptureConfig', permission, role });
            // RB-4: the refusal of the access rule is ONE ACCESS_DENIED row; never a CAPTURE_CONFIG_CHANGED row.
            expect(rows.map((row) => [row.type, row.actorId, row.deviceId ?? null, row.details]), label).toEqual([['ACCESS_DENIED', principal.operatorId, deviceId, { operationId: 'updateCaptureConfig', permission, role }]]);
          }
          table.push(`${role} ${deviceId ?? 'WEB'} ${answer.statusCode}`);
          // The stored selector follows the allowed calls only.
          expect(await storedSlots(owner), label).toEqual(rowWithout(cleared));
        }
      }
      // The role table of the contract after `0034` (OD-10 as amended 2026-10-29): TECHNICIAN alone holds
      // CAPTURE_CONFIG - SUPERVISOR and INVESTIGATOR are refused on either kind of client.
      expect(table).toEqual(['INVESTIGATOR WEB 403', 'SUPERVISOR WEB 403', 'TECHNICIAN WEB 200', 'INVESTIGATOR DEV-0001 403', 'SUPERVISOR DEV-0001 403', 'TECHNICIAN DEV-0001 200']);
      // Two allowed calls cleared two slots, one each. The two remaining slots are cleared by TECHNICIAN alone
      // (the one editor since `0034`), so every slot still has its ONE stored row with the closed keys.
      expect(cleared).toEqual(['VIDEO-01', 'VIDEO-02']);
      for (const slot of [...free] as Slot[]) {
        const beforeSlot = (await readTrail(owner)).length;
        const answer = await post({ kind: 'OPERATOR', operatorId: operatorIdOf('TECHNICIAN'), sessionId: 'row158-session', deviceId: null, role: 'TECHNICIAN', permissions: ROLE_PERMISSIONS.TECHNICIAN }, { unassign: [slot] });
        expect(answer.statusCode, slot).toBe(200);
        const rows = await rowsFrom(beforeSlot);
        expect(rows.map((row) => [row.type, row.details]), slot).toEqual([['CAPTURE_CONFIG_CHANGED', clearedRow(slot)]]);
        expectClosedKeys(rows[0]?.details ?? {});
        cleared.push(slot);
      }
      expect(cleared).toEqual([...SLOTS]);
      expect(await storedSlots(owner)).toEqual(rowWithout(SLOTS));

      // THE CALLERS THAT ARE NO OPERATOR, asked for a slot that holds a source again (assigned by the last allowed caller).
      // None reaches the handler; nothing is stored.
      expect((await post({ kind: 'OPERATOR', operatorId: operatorIdOf('TECHNICIAN'), sessionId: 'row158-session', deviceId: null, role: 'TECHNICIAN', permissions: ROLE_PERMISSIONS.TECHNICIAN }, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_1080P25' }] })).statusCode).toBe(200);
      const rowsBefore = (await changedRows(owner)).length;
      const held = await storedSlots(owner);
      expect(held).toEqual(rowWithout(['VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'])); // D61: the numbered channels; D60/D61: every slot but the re-assigned VIDEO-01 stands cleared
      let before = (await readTrail(owner)).length;
      const anonymous = await post({ kind: 'ANONYMOUS', retiredDeviceId: null }, { unassign: ['VIDEO-01'] });
      expect(outcome(anonymous)).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse('updateCaptureConfig', 401, anonymous.json())).toEqual({ ok: true });
      // The credential of a paired device WITHOUT an operator session: the operation needs an operator.
      const deviceOnly = await post({ kind: 'DEVICE', deviceId: 'DEV-0001' }, { unassign: ['VIDEO-01'] });
      expect(outcome(deviceOnly)).toEqual([401, 'NOT_SIGNED_IN']);
      expect(await rowsFrom(before)).toEqual([]);
      // A retired device: refused and audited as that, by the rule every operation shares.
      before = (await readTrail(owner)).length;
      const retired = await post({ kind: 'ANONYMOUS', retiredDeviceId: 'DEV-0002' }, { unassign: ['VIDEO-01'] });
      expect(outcome(retired)).toEqual([403, 'DEVICE_REVOKED']);
      expect((await rowsFrom(before)).map((row) => [row.type, row.actorId ?? null, row.deviceId ?? null, row.details])).toEqual([['ACCESS_DENIED', null, 'DEV-0002', { operationId: 'updateCaptureConfig', reason: 'DEVICE_REVOKED' }]]);
      expect(await storedSlots(owner)).toEqual(held);
      expect(await changedRows(owner)).toHaveLength(rowsBefore);
      // The chain of everything this case wrote links and verifies.
      const trail = await readTrail(owner);
      expect(linkProblems(trail)).toEqual([]);
      expect(verifyTrail(trail, await readHead(owner))).toMatchObject({ ok: true });
    });

    it('AD-10 (2), the lock table ON POSTGRESQL: a real session is taken through EVERY state that holds the lock - CREATE, PRECHECK, ARMED, RECORDING, STOPPING, FINALIZING on the clean path, FAULT and RECOVERY on the other - and in each one every unassign is 409 CAPTURE_CONFIG_LOCKED with 0 rows and nothing stored; SEALED and no session accept it', async () => {
      const table: [string, number, string | null][] = [];
      /** The lock, checked ONCE in every state the session is first seen in. */
      const watch = (of: ConsoleCore) => {
        const seen: string[] = [];
        const check = async (): Promise<void> => {
          const state = stateOf(of);
          if (state === 'NONE' || state === SessionState.SEALED || seen.includes(state)) return;
          seen.push(state);
          const trail = await of.trailLength();
          const held = of.core.engine.slice('captureConfig');
          for (const body of BODIES) {
            const refused = await of.post(body);
            table.push([state, refused.statusCode, (refused.json() as { error?: { code?: string } }).error?.code ?? null]);
            expect(validateCoreApiResponse('updateCaptureConfig', 409, refused.json()), state).toEqual({ ok: true });
          }
          // SEC35-19: a state refusal - no row of any type, the selector and its stored row as they were; the session did not move.
          expect(await of.trailLength(), state).toBe(trail);
          expect(of.core.engine.slice('captureConfig'), state).toBe(held);
          expect(await storedSlots(of.owner), state).toEqual(SEEDED);
          expect(stateOf(of), state).toBe(state);
        };
        /** Drives the engine tick by tick until the session is SEALED (or gone), checking every state it passes. */
        const untilSealed = async (): Promise<void> => {
          for (let tick = 0; tick < 2_000 && stateOf(of) !== SessionState.SEALED && stateOf(of) !== 'NONE'; tick += 1) {
            await of.core.drive(50);
            await check();
          }
        };
        return { seen, check, untilSealed };
      };

      // THE CLEAN PATH.
      const clean = await consoleCore('r158-lock-clean');
      const cleanWatch = watch(clean);
      // CONTROL, no session: accepted (and put back, so that the session below starts on the seeded selector).
      expect(stateOf(clean)).toBe('NONE');
      expect((await clean.post({ unassign: ['MIC-02'] })).statusCode).toBe(200);
      expect((await clean.post({ mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-02' }] })).statusCode).toBe(200); // D61 (2026-11-04): the line names its channel
      await clean.core.app.pipeline.drain();
      expect(await storedSlots(clean.owner)).toEqual(SEEDED);
      await armed(clean, cleanWatch.check);
      await clean.core.engine.command(clean.investigator, 'startRecording');
      await cleanWatch.check();
      await clean.core.drive(2_000);
      await clean.core.engine.command(clean.investigator, 'stopRecording', 'End of the interview');
      await cleanWatch.check();
      await cleanWatch.untilSealed();
      expect(cleanWatch.seen).toEqual(['CREATE', 'PRECHECK', 'ARMED', 'RECORDING', 'STOPPING', 'FINALIZING']);
      // CONTROL, SEALED: the session is still the Core's session, and the same call is accepted - one row.
      expect(stateOf(clean)).toBe(SessionState.SEALED);
      const rowsBefore = (await changedRows(clean.owner)).length;
      const sealed = await clean.post({ unassign: ['MIC-02'] });
      expect(sealed.statusCode, sealed.body).toBe(200);
      await clean.core.app.pipeline.drain();
      expect((await changedRows(clean.owner)).slice(rowsBefore)).toEqual([clearedRow('MIC-02')]);
      expect(await storedSlots(clean.owner)).toEqual(rowWithout(['MIC-02']));

      // THE OTHER PATH: a critical fault while recording, then the recovery.
      const faulted = await consoleCore('r158-lock-fault');
      const faultWatch = watch(faulted);
      await armed(faulted);
      await faulted.core.engine.command(faulted.investigator, 'startRecording');
      await faulted.core.drive(2_000);
      await faulted.core.engine.command(faulted.supervisor, 'inject', 'POWER_FAIL');
      expect(stateOf(faulted)).toBe(SessionState.FAULT);
      await faultWatch.check();
      await faulted.core.engine.command(faulted.investigator, 'recover');
      expect(stateOf(faulted)).toBe(SessionState.RECOVERY);
      await faultWatch.check();
      await faultWatch.untilSealed();
      expect(faultWatch.seen.slice(0, 2)).toEqual(['FAULT', 'RECOVERY']);

      // THE TABLE: every state of the session machine but SEALED was reached by a real session, five bodies each, all refused the same way.
      const reached = [...new Set(table.map(([state]) => state))].sort();
      expect(reached).toEqual(Object.values(SessionState).filter((state) => state !== SessionState.SEALED).sort());
      expect(table.filter(([, status, code]) => status !== 409 || code !== 'CAPTURE_CONFIG_LOCKED')).toEqual([]);
      // (FINALIZING is passed on both paths and so is in the table twice.)
      for (const state of reached) expect(table.filter(([of]) => of === state).length, state).toBeGreaterThanOrEqual(BODIES.length);
    });

    it('AD-10 (3) on PostgreSQL: a body that clears and fills ONE slot is 422 in both forms, with 0 rows and nothing stored; the same clear and the same assignment in TWO calls are accepted', async () => {
      const of = await consoleCore('r158-both');
      const trail = await of.trailLength();
      const refused: [object, string | null][] = [
        // The schema sees it: the slot is the track of a camera line, or the channel of a mic line (D61, 2026-11-04).
        [{ unassign: ['VIDEO-01'], cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02', profile: 'H264_1080P25' }] }, null],
        [{ unassign: ['MIC-02'], mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-02' }] }, null],
        // The schema cannot see it: a mic line without `channel` edits the input the cleared channel holds. The action refuses, and its unit is rolled back.
        [{ unassign: ['MIC-01'], mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] }, 'SLOT_UNASSIGNED_AND_ASSIGNED'],
      ];
      for (const [body, reason] of refused) {
        const answer = await of.post(body);
        expect(outcome(answer), JSON.stringify(body)).toEqual([422, 'INVALID_INPUT']);
        expect(validateCoreApiResponse('updateCaptureConfig', 422, answer.json()), JSON.stringify(body)).toEqual({ ok: true });
        if (reason !== null) expect(errorOf(answer).details).toMatchObject({ reason });
      }
      expect(await of.trailLength()).toBe(trail);
      expect(await storedSlots(of.owner)).toEqual(SEEDED);
      expect(await storedSlices(of.owner)).toStrictEqual(withoutNegativeZeros(of.core.engine.state()));
      // CONTROL: the two halves of the first body as two calls.
      expect((await of.post({ unassign: ['VIDEO-01'] })).statusCode).toBe(200);
      expect((await of.post({ cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_1080P25' }] })).statusCode).toBe(200);
      expect(await of.trailLength()).toBe(trail + 2);
      expect(await storedSlots(of.owner)).toEqual(SEEDED);
    });

    it('an unassign AGAINST a session that is being opened: whichever unit of the engine commits first wins - the loser unassign is 409 with 0 rows, the loser session is opened on the selector WITHOUT the slot; never a session whose sources were taken from under it; an unassign against the START of an armed session always loses', async () => {
      const of = await consoleCore('r158-race');
      const SLOT = 'VIDEO-02';
      const create = () => of.core.engine.command(of.investigator, 'createSession', { ...SESSION_INPUT, investigatorId: of.investigator.operatorId });
      /** `turns` turns of the event loop: how far the request is ahead of the session. */
      const after = async (turns: number): Promise<void> => {
        for (let turn = 0; turn < turns; turn += 1) await new Promise<void>((resolve) => setImmediate(resolve));
      };
      const winners: string[] = [];
      // The request is sent FIRST in every round; the session is created 0, 1, 2 ... turns later, and in the last round
      // only when the request was answered. The lock is read inside the unit of the edit, so what decides is the order
      // of the two units, not the order of the two calls.
      for (const turns of [0, 1, 2, 4, 8, 16, 32, null] as const) {
        const label = `session ${turns === null ? 'after the answer' : `${turns} turn(s) after the request`}`;
        expect(stateOf(of), label).toBe('NONE');
        expect(await storedSlots(of.owner), label).toEqual(SEEDED);
        const trail = await of.trailLength();
        const requested = of.post({ unassign: [SLOT] });
        if (turns === null) await requested;
        else await after(turns);
        const [answer, created] = await Promise.all([requested, create()]);
        await of.core.app.pipeline.drain();
        // THE SESSION IS ALWAYS OPENED: an edit of the selector never refuses a session.
        expect(created.value, label).toMatchObject({ ok: true, created: true });
        const session = of.core.engine.slice('session');
        const snapshot = (session?.captureConfig ?? of.core.engine.slice('captureConfig')).cameras.map((camera) => camera.trackId as string);
        const rows = (await readTrail(of.owner)).slice(trail).map((row) => row.type as string);
        if (answer.statusCode === 200) {
          // THE UNASSIGN WON: one row, written BEFORE the row of the session; the slot is NULL; the session was opened on
          // the selector without the slot - in real capture its pre-check then says BLOCK for it (row 30) and its start is
          // refused (row 163); in Simulated mode it starts as today (C21 (6)).
          winners.push('UNASSIGN');
          expect(rows.filter((type) => type === 'CAPTURE_CONFIG_CHANGED'), label).toHaveLength(1);
          expect(rows.indexOf('CAPTURE_CONFIG_CHANGED'), label).toBeLessThan(rows.indexOf('SESSION_CREATED'));
          expect(await storedSlots(of.owner), label).toEqual(rowWithout([SLOT]));
          expect(snapshot, label).toEqual(['VIDEO-01', 'VIDEO-03', 'VIDEO-04']); // D60 (2026-11-04): four tracks, the raced one absent
        } else {
          // THE SESSION WON: the unassign is the state refusal - no row, nothing stored - and the session holds both cameras.
          winners.push('SESSION');
          expect(outcome(answer), label).toEqual([409, 'CAPTURE_CONFIG_LOCKED']);
          expect(rows.filter((type) => type === 'CAPTURE_CONFIG_CHANGED' || type === 'ACCESS_DENIED'), label).toEqual([]);
          expect(await storedSlots(of.owner), label).toEqual(SEEDED);
          expect(snapshot, label).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04']); // D60 (2026-11-04): all four tracks
        }
        // Whoever won, what is stored is what the engine holds.
        expect(await storedSlices(of.owner), label).toStrictEqual(withoutNegativeZeros(of.core.engine.state()));
        // Back to the start of a round: the session is cancelled and the slot assigned again.
        await of.core.engine.command(of.investigator, 'cancel');
        if (answer.statusCode === 200) expect((await of.post({ cameras: [{ trackId: SLOT, deviceId: 'CAM-02', profile: 'H264_1080P25' }] })).statusCode, label).toBe(200);
        await of.core.app.pipeline.drain();
      }
      // Both outcomes are in the table: a session created in the same turn as the request is opened first (the request
      // still passes the stages before its unit), and a session created after the answer finds the slot cleared.
      expect([winners[0], winners.at(-1)]).toEqual(['SESSION', 'UNASSIGN']);
      // The rounds between the two are decided by how long the stages of the request took (a read of the session in
      // PostgreSQL): either may win there, and every round held the rules of its winner above.
      expect(winners).toHaveLength(8);
    });

    it.each(['UNASSIGN', 'START'] as const)('an unassign against the START of an armed session, %s called first: the session holds the lock already, so the unassign is 409 with 0 rows and the session records from the eight sources it was opened with', async (first) => {
      const of = await consoleCore(`r158-start-${first.toLowerCase()}`);
      await armed(of);
      const trail = await of.trailLength();
      const start = () => of.core.engine.command(of.investigator, 'startRecording');
      const unassign = () => of.post({ unassign: [...SLOTS] });
      // Both are in flight together; only the order in which they were called differs.
      const calls = first === 'UNASSIGN' ? [unassign(), start()] as const : ((started) => [unassign(), started] as const)(start());
      const [answer] = await Promise.all(calls);
      expect(outcome(answer)).toEqual([409, 'CAPTURE_CONFIG_LOCKED']);
      expect(stateOf(of)).toBe('RECORDING');
      await of.core.app.pipeline.drain();
      expect((await readTrail(of.owner)).slice(trail).map((row) => row.type as string).filter((type) => type === 'CAPTURE_CONFIG_CHANGED' || type === 'ACCESS_DENIED')).toEqual([]);
      expect(await storedSlots(of.owner)).toEqual(SEEDED);
      const recording = of.core.engine.slice('session');
      expect([recording?.captureConfig?.cameras.length, recording?.captureConfig?.mics.length]).toEqual([4, 4]); // D60/D61 (2026-11-04): four tracks, four channels
    });
  });

  // Task 4 row 187 (controller ruling C36 (1); design addendum 7, AD-06): in the Core no default profile stands in for the
  // statement of a production camera's own stream. On PostgreSQL as the runtime role, on throw-away clones.
  //
  // THE DOUBLE: the device registry. A REAL_PRODUCTION Core of this phase serves no production camera yet (class C; the
  // builder is row 85), so its own registry would refuse the camera as "not served" before the rule is reached. The case
  // provides a registry that serves the one production camera of the fixture - what the registry is after the lift - through
  // the module's own seam (`provideDeviceRegistry`), before the boot. Everything else is the product: the route, the unit of
  // the engine, the hosted action, the stored rows. The camera's stored profile list is written by the owner (the adoption
  // that mints it is rows 50 / 51).
  describe('5. task 4 row 187 (C36 (1)): a production camera is assigned with a profile of its own, or not at all', () => {
    /** The one profile the stored row of the fixture's production camera lists: a code no seeded line and no constant of the simulator holds. */
    const OWN = 'HEVC_2160P25_MAIN';
    const reasonOf = (response: LightMyRequestResponse): unknown[] => {
      const error = (response.json() as { error: { code: string; details?: Record<string, unknown> } }).error;
      return [response.statusCode, error.code, error.details?.['reason'], error.details?.['deviceId'], error.details?.['trackId']];
    };

    async function productionCore(slug: string, operation: 'REAL_PRODUCTION' | 'SIMULATED' = 'REAL_PRODUCTION') {
      const target = await clone(slug, async (owner) => {
        await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind, profiles) VALUES ('CAM-11', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP', $1::jsonb)", [JSON.stringify([OWN])]);
        // Row S86a (C-1 of row 86): the OWN code is what an adoption leaves - listed AND with its stored stream row. Without the row
        // the assignment is refused since S86a (the case at the end of this block); the cases above it are about the list.
        await owner.query("INSERT INTO public.capture_device_streams (device_id, profile, onvif_profile_token, lens, stream_role, codec, width, height, read_at) VALUES ('CAM-11', $1, 'profile_1', 1, 'MAIN', 'HEVC', 3840, 2160, 1730000000000)", [OWN]);
        await unassignStored(owner, SLOTS);
        if (operation === 'REAL_PRODUCTION') await ownCredentials(owner);
      });
      const owner = target.ownerPool();
      const log = captureLog();
      const app = buildApp({ config: unitTestConfig({ database: target.runtime, dataDir: db.run.dataDir, logLevel: 'info', ...(operation === 'REAL_PRODUCTION' ? PRODUCTION : SIMULATED) }), logStream: log.stream });
      target.onCleanup(() => app.close());
      await app.ready();
      provideTestCaptureHost(app);
      engineControl(app).useTimer(manualTimer().timer);
      const asked: string[] = [];
      if (operation === 'REAL_PRODUCTION') {
        captureConfigControl(app).provideDeviceRegistry({
          operation: 'REAL_PRODUCTION',
          assertAssignable(deviceClass, deviceId) {
            asked.push(`${deviceClass} ${deviceId}`);
            // The registry after the lift: it serves the production camera; anything else is its own refusal, as before.
            if (deviceClass !== 'CAMERA' || deviceId !== 'CAM-11') return captureFenceControl(app).registry()?.assertAssignable(deviceClass, deviceId) as never;
            return { id: deviceId } as never;
          },
        });
      }
      await app.readiness.boot();
      const signedIn = operation === 'REAL_PRODUCTION' ? await webSignIn(app, 'rina.wijaya', OWN_PASSWORD) : await webSignIn(app, 'rina.wijaya');
      expect(signedIn.statusCode, signedIn.body).toBe(200);
      const token = cookieValue(signedIn, app.config.sessionCookieName);
      if (token === null) throw new Error('the web sign-in set no session cookie');
      const headers = { cookie: `${app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN };
      const post = (url: string, payload: object) => app.inject({ method: 'POST', url, headers, payload });
      const stored = async (): Promise<[Record<string, unknown> | undefined, number]> => {
        await app.pipeline.drain();
        return [await storedSlots(owner), (await changedRows(owner)).length];
      };
      return { app, owner, post, stored, asked };
    }

    it('REAL_PRODUCTION: into an EMPTY slot, a production camera WITHOUT a profile and one with a profile that is not its own are refused by a named code - 0 audit rows, the slot still NULL; its OWN code is stored as given', async () => {
      const core = await productionCore('r187-own-profile');
      expect(captureFenceControl(core.app).operation).toBe('REAL_PRODUCTION');
      expect(core.app.engine.slice('captureDevices').devices.find((device) => device.id === 'CAM-11')).toMatchObject({ adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' });
      const [slots, rows] = await core.stored();
      expect(slots).toEqual(rowWithout(SLOTS));

      // 1. No profile: the action would have stored the simulator's default. Refused by operation 78 and by operation 79 (which names none).
      const none = await core.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-11' }] });
      expect(reasonOf(none)).toEqual([422, 'INVALID_INPUT', 'CAMERA_PROFILE_NOT_STATED', 'CAM-11', 'VIDEO-01']);
      const bySource = await core.post(cameraSource('CAM-11'), { trackId: 'VIDEO-02' });
      expect(reasonOf(bySource)).toEqual([422, 'INVALID_INPUT', 'CAMERA_PROFILE_NOT_STATED', 'CAM-11', 'VIDEO-02']);
      // 2. A profile that is not an element of the device's stored profiles: the default's own code, and any other code.
      for (const profile of ['H264_1080P25', 'HEVC_2160P25', 'HEVC_2160P25_MAIN_X']) {
        const foreign = await core.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-11', profile }] });
        expect(reasonOf(foreign), profile).toEqual([422, 'INVALID_INPUT', 'CAMERA_PROFILE_NOT_OF_DEVICE', 'CAM-11', 'VIDEO-01']);
      }
      // Nothing changed: no row of the edit, no denial row, both video slots NULL - and the default profile is nowhere in the stored row.
      expect(await core.stored()).toEqual([rowWithout(SLOTS), rows]);
      expect(JSON.stringify(await storedSlots(core.owner))).not.toContain('H264_1080P25');
      // The registry was asked first each time (its own refusals keep their reasons): five edits, five questions.
      expect(core.asked).toEqual(['CAMERA CAM-11', 'CAMERA CAM-11', 'CAMERA CAM-11', 'CAMERA CAM-11', 'CAMERA CAM-11']);

      // 3. The device's OWN code is stored as given, with ONE row.
      const own = await core.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-11', profile: OWN }] });
      expect(own.statusCode, own.body).toBe(200);
      expect(selectorOf(own).cameras).toEqual([expect.objectContaining({ trackId: 'VIDEO-01', deviceId: 'CAM-11', profile: OWN })]);
      const [after, afterRows] = await core.stored();
      expect(after).toEqual({ ...rowWithout(SLOTS), video_01_device_id: 'CAM-11', video_01_profile: OWN });
      expect(afterRows).toBe(rows + 1);

      // 4. A HELD slot keeps its profile: operation 79 on the slot that holds the camera's own code changes nothing and is no refusal;
      //    a foreign profile for the held slot is still refused, and the slot keeps what it held.
      const same = await core.post(cameraSource('CAM-11'), { trackId: 'VIDEO-01' });
      expect(same.statusCode, same.body).toBe(200);
      const held = await core.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-11', profile: 'H264_1080P25' }] });
      expect(reasonOf(held)).toEqual([422, 'INVALID_INPUT', 'CAMERA_PROFILE_NOT_OF_DEVICE', 'CAM-11', 'VIDEO-01']);
      expect(await core.stored()).toEqual([after, rows + 1]);
    });

    it('REAL_PRODUCTION, the other refusals keep their own reason and come first: a development source is refused by the registry as before, and no profile rule is said for it', async () => {
      const core = await productionCore('r187-registry-first');
      const development = await core.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }] });
      const error = (development.json() as { error: { code: string; details?: Record<string, unknown> } }).error;
      expect([development.statusCode, error.code]).toEqual([422, 'INVALID_INPUT']);
      expect(String(error.details?.['reason'])).not.toMatch(/CAMERA_PROFILE/);
      expect((await core.stored())[0]).toEqual(rowWithout(SLOTS));
    });

    // Row R2 (ruling C93 on review finding F3-11): on a Core in real capture the SAME camera is refused on both video slots - by
    // operation 78 and by 79, with its own profile or none - before the action and before the profile rule; the stored row and the
    // trail are as they were. Moving it (its slot cleared in the same body) is no refusal.
    it('REAL_PRODUCTION, C93: the camera that holds VIDEO-01 is refused for VIDEO-02 by a named code (CAMERA_ON_BOTH_TRACKS) - 0 audit rows, the stored slots unchanged; a move after a clear is stored', async () => {
      const core = await productionCore('r2-one-slot-per-camera');
      const [, rows] = await core.stored();
      expect((await core.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-11', profile: OWN }] })).statusCode).toBe(200);
      const held = { ...rowWithout(SLOTS), video_01_device_id: 'CAM-11', video_01_profile: OWN };
      expect(await core.stored()).toEqual([held, rows + 1]);

      const byUpdate = await core.post(CONFIG, { cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-11', profile: OWN }] });
      expect(reasonOf(byUpdate)).toEqual([422, 'INVALID_INPUT', 'CAMERA_ON_BOTH_TRACKS', 'CAM-11', 'VIDEO-02']);
      // D60 (2026-11-04): C93 became pairwise on (device, profile) — an operation-79 line states no profile and the empty slot holds none, so no pair collides and the profile rule of row 187 answers first. A SECOND profile on the same device is what operation 78 may now state; the same profile is still CAMERA_ON_BOTH_TRACKS above.
      const bySource = await core.post(cameraSource('CAM-11'), { trackId: 'VIDEO-02' });
      expect(reasonOf(bySource)).toEqual([422, 'INVALID_INPUT', 'CAMERA_PROFILE_NOT_STATED', 'CAM-11', 'VIDEO-02']);
      expect(await core.stored()).toEqual([held, rows + 1]);

      const moved = await core.post(CONFIG, { unassign: ['VIDEO-01'], cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-11', profile: OWN }] });
      expect(moved.statusCode, moved.body).toBe(200);
      expect(await core.stored()).toEqual([{ ...rowWithout(SLOTS), video_02_device_id: 'CAM-11', video_02_profile: OWN }, rows + 3]);
    });

    it('CONTROL, SIMULATED - as today: the same production camera row is assigned into an empty slot without a profile, and the simulator\'s hosted action gives it the simulator\'s default', async () => {
      const core = await productionCore('r187-simulated', 'SIMULATED');
      expect(captureConfigControl(core.app).hasDeviceRegistry()).toBe(false);
      const assigned = await core.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-11' }] });
      expect(assigned.statusCode, assigned.body).toBe(200);
      expect((await core.stored())[0]).toEqual({ ...rowWithout(SLOTS), video_01_device_id: 'CAM-11', video_01_profile: 'H264_1080P25' });
      // Operation 79 as well, into the other empty slot (the first is cleared: one camera on both tracks needs two profiles).
      expect((await core.post(CONFIG, { unassign: ['VIDEO-01'] })).statusCode).toBe(200);
      const bySource = await core.post(cameraSource('CAM-11'), { trackId: 'VIDEO-02' });
      expect(bySource.statusCode, bySource.body).toBe(200);
      expect((await core.stored())[0]).toEqual({ ...rowWithout(SLOTS), video_02_device_id: 'CAM-11', video_02_profile: 'H264_1080P25' });
    });

    // Row S86a (caution C-1 of the security review row 86; decision C127): the camera adapter's open refuses a code without its
    // stored stream row (`capture_device_streams`); the assignment now refuses it FIRST, with a sentence that names the remedy
    // (adopt again: operation 108 cannot heal such a code, row PR case (b)). `details.reason` is its own word since row V7c
    // (C130: `CAMERA_PROFILE_WITHOUT_STREAM`, `PROFILE_WITHOUT_STREAM_REASON`); until then the seam answered the list rule's word.
    it('row S86a (C-1): REAL_PRODUCTION - a LISTED code without its stored stream row (a C61 raw token in code form; a code no stream stated) is refused at assignment by 78 and, for a held slot, by 79 - 0 rows, nothing stored, the re-adopt sentence; with its stream row the same code is admitted; a stream row alone admits no unlisted code; SIMULATED unchanged', async () => {
      const RAW = 'PROFILE_1'; // C61: a raw ONVIF token that has the code form; no adoption ever writes its stream row.
      const UNSTATED = 'H264_1080P25_MAIN'; // a code in the list that no stream stated (no stream row).
      const UNLISTED = 'H264_720P25'; // a stream row, but no element of the list.
      const core = await productionCore('s86a-stream-row');
      await core.owner.query("UPDATE public.capture_devices SET profiles = $1::jsonb WHERE id = 'CAM-11'", [JSON.stringify([OWN, RAW, UNSTATED])]);
      const streamRow = (profile: string) =>
        core.owner.query("INSERT INTO public.capture_device_streams (device_id, profile, onvif_profile_token, lens, stream_role, codec, width, height, read_at) VALUES ('CAM-11', $1, 'profile_2', 1, 'SUB', 'H264', 1280, 720, 1730000000000)", [profile]);
      await streamRow(UNLISTED);
      const messageOf = (response: LightMyRequestResponse): string => (response.json() as { error: { message: string } }).error.message;
      const [, rows] = await core.stored();

      // 1. Listed, no stream row: refused at assignment, by the seam's word and the re-adopt sentence. Nothing stored, no row.
      for (const profile of [RAW, UNSTATED]) {
        const refused = await core.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-11', profile }] });
        // Row V7c (C130): the refusal's own word, no longer the list rule's.
        expect(reasonOf(refused), profile).toEqual([422, 'INVALID_INPUT', 'CAMERA_PROFILE_WITHOUT_STREAM', 'CAM-11', 'VIDEO-01']);
        expect(PROFILE_WITHOUT_STREAM_REASON).toBe('CAMERA_PROFILE_WITHOUT_STREAM');
        expect(messageOf(refused), profile).toBe(PROFILE_WITHOUT_STREAM_TEXT);
        expect(messageOf(refused)).toMatch(/Adopt the camera again/);
      }
      // CONTROL: a stream row alone admits no code the list does not hold - the list rule of row 187, its own sentence.
      const unlisted = await core.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-11', profile: UNLISTED }] });
      expect(reasonOf(unlisted)).toEqual([422, 'INVALID_INPUT', 'CAMERA_PROFILE_NOT_OF_DEVICE', 'CAM-11', 'VIDEO-01']);
      expect(messageOf(unlisted)).not.toBe(PROFILE_WITHOUT_STREAM_TEXT);
      expect(await core.stored()).toEqual([rowWithout(SLOTS), rows]);

      // 2. The SAME code with its stream row (what an adoption writes): admitted and stored, ONE row.
      await streamRow(UNSTATED);
      const admitted = await core.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-11', profile: UNSTATED }] });
      expect(admitted.statusCode, admitted.body).toBe(200);
      const held = { ...rowWithout(SLOTS), video_01_device_id: 'CAM-11', video_01_profile: UNSTATED };
      expect(await core.stored()).toEqual([held, rows + 1]);

      // 3. The stream row gone (the owner; the runtime role cannot delete one): operation 79 on the HELD slot keeps a code the open
      //    would refuse - refused now, with the same answer; the slot keeps what it held.
      await core.owner.query("DELETE FROM public.capture_device_streams WHERE device_id = 'CAM-11' AND profile = $1", [UNSTATED]);
      const bySource = await core.post(cameraSource('CAM-11'), { trackId: 'VIDEO-01' });
      expect(reasonOf(bySource)).toEqual([422, 'INVALID_INPUT', 'CAMERA_PROFILE_WITHOUT_STREAM', 'CAM-11', 'VIDEO-01']);
      expect(messageOf(bySource)).toBe(PROFILE_WITHOUT_STREAM_TEXT);
      expect(await core.stored()).toEqual([held, rows + 1]);

      // 4. CONTROL, SIMULATED - unchanged: no registry, no read, no stream rule; the raw token with no stream row is assigned as before.
      const simulated = await productionCore('s86a-simulated', 'SIMULATED');
      await simulated.owner.query("UPDATE public.capture_devices SET profiles = $1::jsonb WHERE id = 'CAM-11'", [JSON.stringify([OWN, RAW])]);
      const raw = await simulated.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-11', profile: RAW }] });
      expect(raw.statusCode, raw.body).toBe(200);
      expect((await simulated.stored())[0]).toEqual({ ...rowWithout(SLOTS), video_01_device_id: 'CAM-11', video_01_profile: RAW });
    });
  });
});
