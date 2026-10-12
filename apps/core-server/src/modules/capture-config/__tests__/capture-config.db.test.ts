// Operations 76 to 80 against PostgreSQL and the REAL engine (blueprint row 66 / M4-W2; contract
// C3 §2.2 to §2.4, §4, §5.2, §6; specs R-1; checks M4-LOCK-1 and the server half of M4-SEL-W/T/P).
//
// The real app factory on a clone of the seed, as `dems_app`, with EVERY stage as the server has
// it: nothing of the request pipeline is replaced. The engine is booted on a manual clock and a
// manual timer. The three seeded operators are signed in on the web console. What is stored is
// read as `dems_owner`. Every count is relative to the trail after the boot and the sign-ins.
import { validateCoreApiResponse, CaptureConfigSliceSchema } from '@dems/shared/api';
import type { AuditRow, OperatorRole } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import { beforeAll, describe, expect, it, afterAll } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { storedSlices, FIXED_NOW, engineApp, manualTimer, stateChanges } from '../../../../test/support/engine';
import { forgetCounters, WEB_ORIGIN, cookieValue, webSignIn } from '../../../../test/support/identity';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { bodyOf, devicesApp, errorOf, outcome, type DevicesApp } from '../../devices/__tests__/support';
import { createCaptureConfigStore, captureConfigControl } from '../index';
import { CONFIG, DEVICES, cameraSource, primaryMic } from './support';
import type { Pool } from 'pg';
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
  cameras: { trackId: string; deviceId: string; profile: string; online: boolean; streamState: string }[];
  mics: { inputId: string; deviceId: string; role: string; transport: string; online: boolean }[];
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
 * two mic rows of the selector back in input order (`db/mapping/rows.ts`, `captureConfigFromRow`),
 * as the engine holds them (AC-B-70), also while MIC-02 is PRIMARY. The exclusion that sorted both
 * sides by input id before comparing is removed; `storedMicOrderDiffers` stays as the printed fact.
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

describe('operations 78, 79, 80: SUPERVISOR and TECHNICIAN edit, audited; INVESTIGATOR is refused, audited', () => {
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
    // AC-B-70: the two mic inputs are listed MIC-01, MIC-02, whichever holds the PRIMARY role.
    expect(selectorOf(primary).mics.map((mic) => [mic.inputId, mic.deviceId, mic.role])).toEqual([
      ['MIC-01', 'MIC-01', 'STANDBY'],
      ['MIC-02', 'MIC-02', 'PRIMARY'],
    ]);
    expect(selectorOf(primary)).toEqual({ ...server.engine.slice('captureConfig'), locked: false });
    let rows = await server.since(before);
    expect(rows.map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['CAPTURE_CONFIG_CHANGED', operatorId('TECHNICIAN'), { operationId: 'setPrimaryMic', scope: 'MIC', field: 'ROLE', inputId: 'MIC-02', deviceId: 'MIC-02', from: 'STANDBY', to: 'PRIMARY', permission: 'CAPTURE_CONFIG' }],
    ]);
    // Published once, in the SAME change as its audit row (one cut of the state), at the revision the answer names.
    expect(selectorPublications()).toHaveLength(publications + 1);
    const change = selectorPublications().at(-1);
    expect(change?.ops.some((op) => op.op === 'append' && op.slice === 'audit' && op.rows.some((row) => row.type === 'CAPTURE_CONFIG_CHANGED'))).toBe(true);
    expect(change?.ops.find((op) => op.op === 'replace' && op.slice === 'captureConfig')).toMatchObject({ value: server.engine.slice('captureConfig') });
    expect(Number(primary.headers['x-dems-revision'])).toBe(change?.revision);
    expect(Number(primary.headers['x-dems-revision'])).toBe(server.engine.revision);
    await expectStoredEqualsCommitted();
    // The engine holds input order. The stored row reads back PRIMARY first: with MIC-02 PRIMARY
    // that is the other order, until the mapping reads back in input order (row 129, requested).
    // Printed, not asserted: a test must not turn red because a defect was fixed.
    expect(server.engine.slice('captureConfig').mics.map((mic) => mic.inputId)).toEqual(['MIC-01', 'MIC-02']);
    console.info(`[row66] stored selector reads its mic rows back in another order than the engine holds: ${String(storedMicOrderDiffers)}`);

    // 78 as SUPERVISOR: the two cameras change tracks in one edit, two lines, two rows, one publication.
    before = await server.trailLength();
    publications = selectorPublications().length;
    const swapped = await server.post('SUPERVISOR', CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] });
    expect(swapped.statusCode).toBe(200);
    expect(validateCoreApiResponse('updateCaptureConfig', 200, bodyOf(swapped))).toEqual({ ok: true });
    rows = await server.since(before);
    expect(rows.map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['CAPTURE_CONFIG_CHANGED', operatorId('SUPERVISOR'), { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-01', deviceId: 'CAM-02', from: 'CAM-01', to: 'CAM-02', permission: 'CAPTURE_CONFIG' }],
      ['CAPTURE_CONFIG_CHANGED', operatorId('SUPERVISOR'), { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-02', deviceId: 'CAM-01', from: 'CAM-02', to: 'CAM-01', permission: 'CAPTURE_CONFIG' }],
    ]);
    expect(selectorPublications()).toHaveLength(publications + 1);
    await expectStoredEqualsCommitted();

    // 79 as SUPERVISOR, after 78 gave VIDEO-01 a second profile (one camera on both tracks, OD-05).
    expect(outcome(await server.post('SUPERVISOR', cameraSource('CAM-01'), { trackId: 'VIDEO-01' }))).toEqual([422, 'INVALID_INPUT']);
    expect((await server.post('SUPERVISOR', CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_720P25' }] })).statusCode).toBe(200);
    before = await server.trailLength();
    const source = await server.post('SUPERVISOR', cameraSource('CAM-02'), { trackId: 'VIDEO-02' });
    expect(source.statusCode).toBe(200);
    expect(validateCoreApiResponse('setCaptureCameraSource', 200, bodyOf(source))).toEqual({ ok: true });
    expect(selectorOf(source).cameras.map((camera) => [camera.trackId, camera.deviceId, camera.profile])).toEqual([
      ['VIDEO-01', 'CAM-01', 'H264_720P25'],
      ['VIDEO-02', 'CAM-02', 'H264_1080P25'],
    ]);
    expect((await server.since(before)).map((row) => [row.type, row.actorId, row.details])).toEqual([
      ['CAPTURE_CONFIG_CHANGED', operatorId('SUPERVISOR'), { operationId: 'setCaptureCameraSource', scope: 'CAMERA', field: 'SOURCE', trackId: 'VIDEO-02', deviceId: 'CAM-02', from: 'CAM-01', to: 'CAM-02', permission: 'CAPTURE_CONFIG' }],
    ]);
    await expectStoredEqualsCommitted();

    // The next start of the server reads what these edits stored: the module's boot load accepts it
    // and forms the same selector (no edit may store what the boot step would refuse).
    const reloaded = await createCaptureConfigStore().load({ query: async <Row>(text: string) => ({ rows: (await server.owner.query(text)).rows as Row[] }) });
    expect(reloaded.builtInBaseline).toBe(false);
    expect({ cameras: reloaded.captureConfig.cameras.map((camera) => [camera.trackId, camera.deviceId, camera.profile]), mics: reloaded.captureConfig.mics.map((mic) => [mic.inputId, mic.deviceId, mic.role]) }).toEqual({
      cameras: server.engine.slice('captureConfig').cameras.map((camera) => [camera.trackId, camera.deviceId, camera.profile]),
      mics: server.engine.slice('captureConfig').mics.map((mic) => [mic.inputId, mic.deviceId, mic.role]),
    });
  });

  it('an edit that changes nothing: 200, no row, no publication, the revision does not move', async () => {
    const before = await server.trailLength();
    const publications = selectorPublications().length;
    const revision = server.engine.revision;
    const current = selectorOf(await server.get('SUPERVISOR', CONFIG));
    const primaryInput = current.mics.find((mic) => mic.role === 'PRIMARY')?.inputId ?? '';
    const same = await server.post('SUPERVISOR', primaryMic(primaryInput));
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
    const primaryInput = selector.mics.find((mic) => mic.role === 'STANDBY')?.inputId ?? '';
    const edits: [string, string, object | undefined][] = [
      ['setPrimaryMic', primaryMic(primaryInput), undefined],
      ['setCaptureCameraSource', cameraSource('CAM-01'), { trackId: 'VIDEO-01' }],
      ['updateCaptureConfig', CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02', profile: 'H264_720P25' }] }],
    ];
    for (const role of ['SUPERVISOR', 'TECHNICIAN'] as const) {
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
      expect(selectorOf(config), role).toEqual({ ...selector, locked: true });
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
    const accepted = await server.post('SUPERVISOR', primaryMic(primaryInput));
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
    const current = server.engine.slice('captureConfig').mics.find((mic) => mic.role === 'STANDBY')?.inputId ?? 'MIC-02';
    let before = await server.trailLength();
    // A principal as stage 4 resolves it for a paired device's session: the same operator, bound to DEV-0001.
    await server.engine.command({ ...technician, deviceId: 'DEV-0001' }, 'setCaptureConfig', { kind: 'PRIMARY_MIC', inputId: current });
    await server.app.pipeline.drain();
    const fromDevice = changed(await server.since(before));
    expect(fromDevice.map((row) => [row.actorId, row.deviceId, row.details['operationId'], row.details['deviceId']])).toEqual([[technician.operatorId, 'DEV-0001', 'setPrimaryMic', current]]);

    const other = server.engine.slice('captureConfig').mics.find((mic) => mic.role === 'STANDBY')?.inputId ?? 'MIC-01';
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
//   1. THE MIC INPUT ID RULE (decisions D106 (4), D115 (2)): a stored selector whose PRIMARY is the
//      local microphone row `MIC-03` REHYDRATES (it stopped the boot at `engine.rehydrate` while the
//      shared contract named a mic input by exactly `MIC-01` / `MIC-02`), an edit of it is
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
describe('D130 (integration C1): MIC-03 in the selector, and the adapter registry behind operations 78 and 79', () => {
  const HELPER = '/bin/echo';
  // A whole boot in capture mode real passes the boot checks of row 61 (`capture.boot`): a worker
  // program that passes the path rule and says HELLO, a private media root and a provisioned signing
  // key. Row 61's fixture gives the three below `.data/`; the worker is a stand-in script and is
  // never asked to capture.
  const realBoot = realBootFixture('c1');
  realBoot.provisionKey();
  afterAll(() => realBoot.remove());
  const DEVELOPMENT = { captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: HELPER, dataDir: realBoot.dataDir, captureWorkerPath: realBoot.worker('capture-worker', 'capture-worker/0.3.0') } as const;

  type Clone = Awaited<ReturnType<typeof db.another>>;

  /** What row 136's development boot registers, written by the owner as a fixture. */
  const addLocalRows = (owner: Pool): Promise<unknown> =>
    owner.query("INSERT INTO public.capture_devices (id, kind, transport, model, enabled, adapter_kind) VALUES ('CAM-03', 'CAMERA', 'AVFOUNDATION', 'MacBook Air Camera', false, 'LOCAL_DEVICE'), ('MIC-03', 'MIC', 'AVFOUNDATION', 'MacBook Air Microphone', false, 'LOCAL_DEVICE')");
  const storedSelector = async (owner: Pool): Promise<Record<string, unknown> | undefined> =>
    (await owner.query('SELECT video_01_device_id, video_02_device_id, mic_primary_id, mic_standby_id FROM public.capture_config')).rows[0] as Record<string, unknown> | undefined;
  const changedRows = async (owner: Pool): Promise<number> => Number((await owner.query("SELECT count(*)::int AS n FROM public.audit_log WHERE type = 'CAPTURE_CONFIG_CHANGED'")).rows[0]?.n);

  describe('1. a capture configuration with MIC-03 as PRIMARY rehydrates and replicates', () => {
    it('boot, the selector in input order, an edit published and stored, and the same selector after a restart', async () => {
      const target = await db.another({ template: 'seed', slug: 'c1-mic03' });
      const owner = target.ownerPool();
      await addLocalRows(owner);
      await owner.query("UPDATE public.capture_config SET mic_primary_id = 'MIC-03'");

      const first = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + 60_000 });
      // RED BEFORE THIS PASS: BootError at step `engine.rehydrate` (ENGINE_SNAPSHOT_REJECTED).
      await first.app.readiness.boot();
      await first.engine.idle();
      const rehydrated = first.engine.slice('captureConfig');
      expect(rehydrated.mics.map((mic) => [mic.inputId, mic.deviceId, mic.role, mic.transport])).toEqual([
        ['MIC-02', 'MIC-02', 'STANDBY', 'USB'],
        ['MIC-03', 'MIC-03', 'PRIMARY', 'AVFOUNDATION'],
      ]);
      // The rules that stay: exactly one PRIMARY and one STANDBY line; a mic line's device is its input (D106 (4)).
      expect(rehydrated.mics.map((mic) => mic.role).sort()).toEqual(['PRIMARY', 'STANDBY']);
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
      expect((replaced[0] as typeof rehydrated).mics.map((mic) => [mic.inputId, mic.role])).toEqual([
        ['MIC-02', 'PRIMARY'],
        ['MIC-03', 'STANDBY'],
      ]);
      expect(await storedSelector(owner)).toMatchObject({ mic_primary_id: 'MIC-02', mic_standby_id: 'MIC-03' });
      // And back to the local microphone as PRIMARY: the state a restart must bring back.
      first.clock.advance(1_000);
      await first.engine.run('test.c1.primaryMic', (scope) => scope.command(technician, 'setCaptureConfig', { kind: 'PRIMARY_MIC', inputId: 'MIC-03' }));
      await first.app.pipeline.drain();
      expect(await storedSelector(owner)).toMatchObject({ mic_primary_id: 'MIC-03', mic_standby_id: 'MIC-02' });
      expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(first.engine.state()));
      const held = first.engine.slice('captureConfig');
      await first.app.close();

      const second = await engineApp(target, db.run.dataDir, { startAt: FIXED_NOW + 120_000 });
      await second.app.readiness.boot();
      await second.engine.idle();
      expect(second.engine.slice('captureConfig')).toEqual(held);
      expect(second.engine.slice('captureDevices').devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'MIC-01', 'MIC-02', 'MIC-03', 'POE-SWITCH']);
      await second.app.pipeline.drain();
      expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(second.engine.state()));
    });

    it('CONTROL: a selector that names a device which is no microphone still stops the start, by name', async () => {
      const target = await db.another({ template: 'seed', slug: 'c1-mic-control' });
      const owner = target.ownerPool();
      // The stored CHECKs and keys are the owner's to bend for a fixture: the engine must refuse what they would let through.
      const bent = await owner.query("UPDATE public.capture_config SET mic_primary_id = 'CAM-02'").then(
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
// OPERATION 78 ASSIGNS THE MICROPHONE INPUTS BY PAIR REPLACEMENT. The mic lines carry `role` and
// are the new pair (`deviceId == inputId`, exactly one PRIMARY and one STANDBY, any `MIC-NN` the
// adapter registry of the running capture operation accepts).
//
//   1. REAL_DEVELOPMENT: the local microphone the boot registered (`MIC-03` on the seed) is put
//      behind the capture THROUGH THE API - no fixture writes the selector. The slot carries the
//      transport of its registry row, the stored row follows, stored state equals committed state,
//      and a restarted Core holds the same selector.
//   2. ELSEWHERE the same body answers the contract's `422 INVALID_INPUT` and nothing is stored:
//      a registry that does not hold `MIC-03` (SIMULATED on the seed), and a microphone the
//      registry of the running operation refuses (a production microphone in REAL_DEVELOPMENT,
//      `details.reason: PRODUCTION_SOURCE_NOT_ALLOWED` - the registry check of pass C1 stays; fix
//      wave I, finding G70b-01: the reason is the refusal's own, not the development one).
//   3. The form without `role` is still accepted and still cannot name a new input.
//
// The helper program of the development boots is `/bin/echo` (row 136's fixture): a root-owned
// program that passes the path rule and is never asked to capture.
describe('D133 (1) (integration D1b): operation 78 replaces the microphone pair', () => {
  const HELPER = '/bin/echo';
  // A whole boot in capture mode real passes the boot checks of row 61 (`capture.boot`): a worker
  // program that passes the path rule and says HELLO, a private media root and a provisioned signing
  // key. Row 61's fixture gives the three below `.data/`; the worker is a stand-in script and is
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
    mics: { inputId: string; deviceId: string; role: string; transport: string }[];
  }

  const storedSelector = async (owner: Pool): Promise<Record<string, unknown> | undefined> =>
    (await owner.query('SELECT mic_primary_id, mic_standby_id FROM public.capture_config')).rows[0] as Record<string, unknown> | undefined;
  const changedRows = async (owner: Pool): Promise<Record<string, unknown>[]> =>
    (await owner.query("SELECT details FROM public.audit_log WHERE type = 'CAPTURE_CONFIG_CHANGED' ORDER BY seq")).rows.map((row: { details: Record<string, unknown> }) => row.details);

  const pair = (primary: string, standby: string) => ({
    mics: [
      { inputId: primary, deviceId: primary, role: 'PRIMARY' },
      { inputId: standby, deviceId: standby, role: 'STANDBY' },
    ],
  });

  /** The devices the seed builds in: their stored rows surface no adapter (`captureDeviceFromRow`, db/mapping/rows.ts). */
  const BUILT_IN_SOURCES = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'];

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
    it('REAL_DEVELOPMENT: MIC-03 is selected through the API, stored, equal to the committed state, and held across a restart', async () => {
      const target = await clone('d1b-pair-dev');
      const owner = target.ownerPool();
      const server = await booted(target, DEVELOPMENT);
      expect(captureFenceControl(server.app).operation).toBe('REAL_DEVELOPMENT');
      // The boot registered this Mac's microphone as a NEW device with its own id (D106 (4)).
      expect(captureFenceControl(server.app).outcome()?.local?.micId).toBe('MIC-03');
      expect(await storedSelector(owner)).toEqual({ mic_primary_id: 'MIC-01', mic_standby_id: 'MIC-02' });
      const rowsBefore = (await changedRows(owner)).length;

      const answer = await server.post(CONFIG, pair('MIC-03', 'MIC-02'));
      expect(answer.statusCode, answer.body).toBe(200);
      expect(CaptureConfigSliceSchema.safeParse(answer.json()).success).toBe(true);
      // In input order; the new slot says the transport of its registry row, which the line did not name.
      expect((answer.json() as SelectorBody).mics.map((mic) => [mic.inputId, mic.deviceId, mic.role, mic.transport])).toEqual([
        ['MIC-02', 'MIC-02', 'STANDBY', 'USB'],
        ['MIC-03', 'MIC-03', 'PRIMARY', 'AVFOUNDATION'],
      ]);
      await server.app.pipeline.drain();
      expect(await storedSelector(owner)).toEqual({ mic_primary_id: 'MIC-03', mic_standby_id: 'MIC-02' });
      expect((await changedRows(owner)).slice(rowsBefore)).toEqual([
        { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', inputId: 'MIC-03', deviceId: 'MIC-03', from: 'MIC-01', to: 'MIC-03', permission: 'CAPTURE_CONFIG' },
      ]);
      expect(await storedSlices(owner)).toStrictEqual(withoutBootDerivedSourceFacts(server.app.engine.state()));
      // CONTROL of the exclusion: without it the comparison is NOT equal - the members are there.
      expect(await storedSlices(owner)).not.toStrictEqual(withoutNegativeZeros(server.app.engine.state()));

      // REFUSED on the same server, nothing written: a pair that is not a pair, a microphone that is not registered.
      // (Task 4 row 29: until decision C21 (8) this list began with ONE line by role,
      // `{ mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', role: 'PRIMARY' }] }`. A microphone role is assignable
      // alone since the contract of row 28 and the hosted action of row 162 (rule MIC-ASSIGN of the names register,
      // "one line: was 422, now valid"), so that body is no refusal any more; the block "task 4 row 29" below holds it.)
      for (const body of [
        { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', role: 'PRIMARY' }, { inputId: 'MIC-02', deviceId: 'MIC-02' }] },
        { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', role: 'PRIMARY' }, { inputId: 'MIC-02', deviceId: 'MIC-02', role: 'PRIMARY' }] },
        { mics: [{ inputId: 'MIC-03', deviceId: 'MIC-01', role: 'PRIMARY' }, { inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY' }] },
        pair('MIC-07', 'MIC-02'),
        // The earlier form edits an input the selector holds: MIC-01 is not one any more.
        { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] },
      ]) {
        const refused = await server.post(CONFIG, body);
        expect([refused.statusCode, (refused.json() as ErrorBody).error.code], JSON.stringify(body)).toEqual([422, 'INVALID_INPUT']);
      }
      // The earlier form is still accepted for an input the selector holds (a line that changes nothing: 200, no row).
      expect((await server.post(CONFIG, { mics: [{ inputId: 'MIC-03', deviceId: 'MIC-03' }] })).statusCode).toBe(200);
      await server.app.pipeline.drain();
      expect(await storedSelector(owner)).toEqual({ mic_primary_id: 'MIC-03', mic_standby_id: 'MIC-02' });
      expect(await changedRows(owner)).toHaveLength(rowsBefore + 1);

      const held = server.app.engine.slice('captureConfig');
      await server.app.close();
      const restarted = await booted(target, DEVELOPMENT);
      expect(restarted.app.engine.slice('captureConfig')).toEqual(held);
      await restarted.app.pipeline.drain();
      expect(await storedSlices(owner)).toStrictEqual(withoutBootDerivedSourceFacts(restarted.app.engine.state()));
    });

    it('ELSEWHERE, SIMULATED on the seed: the registry holds no MIC-03 - 422 INVALID_INPUT, nothing stored; CONTROL: the built-in pair trades roles by the same body', async () => {
      const target = await clone('d1b-pair-sim');
      const owner = target.ownerPool();
      const server = await booted(target, { demoControls: true });
      expect(captureFenceControl(server.app).registry()).toBeNull();
      const rowsBefore = (await changedRows(owner)).length;
      const refused = await server.post(CONFIG, pair('MIC-03', 'MIC-02'));
      expect([refused.statusCode, (refused.json() as ErrorBody).error.code], refused.body).toEqual([422, 'INVALID_INPUT']);
      await server.app.pipeline.drain();
      expect(await storedSelector(owner)).toEqual({ mic_primary_id: 'MIC-01', mic_standby_id: 'MIC-02' });
      expect(await changedRows(owner)).toHaveLength(rowsBefore);

      const traded = await server.post(CONFIG, pair('MIC-02', 'MIC-01'));
      expect(traded.statusCode, traded.body).toBe(200);
      await server.app.pipeline.drain();
      expect(await storedSelector(owner)).toEqual({ mic_primary_id: 'MIC-02', mic_standby_id: 'MIC-01' });
      expect((await changedRows(owner)).slice(rowsBefore)).toEqual([
        { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'ROLE', inputId: 'MIC-02', deviceId: 'MIC-02', from: 'STANDBY', to: 'PRIMARY', permission: 'CAPTURE_CONFIG' },
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
      expect(await storedSelector(owner)).toEqual({ mic_primary_id: 'MIC-01', mic_standby_id: 'MIC-02' });
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
  const realBoot = realBootFixture('row29');
  realBoot.provisionKey();
  afterAll(() => realBoot.remove());
  const PRODUCTION = { captureMode: 'real', demoControls: false, dataDir: realBoot.dataDir, captureWorkerPath: realBoot.worker('capture-worker', 'capture-worker/0.3.0') } as const;
  const DEVELOPMENT = { ...PRODUCTION, captureDevSources: true, captureHelperFfmpegPath: HELPER } as const;
  const SIMULATED = { demoControls: true } as const;

  type Clone = Awaited<ReturnType<typeof db.another>>;
  const SLOTS = ['VIDEO-01', 'VIDEO-02', 'PRIMARY', 'STANDBY'] as const;
  type Slot = (typeof SLOTS)[number];
  const SEEDED = { video_01_device_id: 'CAM-01', video_01_profile: 'H264_1080P25', video_02_device_id: 'CAM-02', video_02_profile: 'H264_1080P25', mic_primary_id: 'MIC-01', mic_standby_id: 'MIC-02' } as const;
  const COLUMNS_OF: Readonly<Record<Slot, readonly (keyof typeof SEEDED)[]>> = {
    'VIDEO-01': ['video_01_device_id', 'video_01_profile'],
    'VIDEO-02': ['video_02_device_id', 'video_02_profile'],
    PRIMARY: ['mic_primary_id'],
    STANDBY: ['mic_standby_id'],
  };
  const HELD: Readonly<Record<Slot, string>> = { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-02', PRIMARY: 'MIC-01', STANDBY: 'MIC-02' };
  /** The seeded row with the columns of the named slots NULL. */
  const rowWithout = (unassigned: readonly Slot[]): Record<string, string | null> => {
    const row: Record<string, string | null> = { ...SEEDED };
    for (const slot of unassigned) for (const column of COLUMNS_OF[slot]) row[column] = null;
    return row;
  };
  /** The row of a cleared slot (names register of row 161, 4.4): the track or the input, and `from`; no `to`, no `deviceId`. */
  const clearedRow = (slot: Slot, from: string = HELD[slot]) =>
    slot === 'VIDEO-01' || slot === 'VIDEO-02'
      ? { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: slot, from, permission: 'CAPTURE_CONFIG' }
      : { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', inputId: from, from, permission: 'CAPTURE_CONFIG' };

  const storedSlots = async (owner: Pool): Promise<Record<string, unknown> | undefined> =>
    (await owner.query('SELECT video_01_device_id, video_01_profile, video_02_device_id, video_02_profile, mic_primary_id, mic_standby_id FROM public.capture_config')).rows[0] as Record<string, unknown> | undefined;
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
  const linesOf = (selector: Pick<Selector, 'cameras' | 'mics'>): string[] => [...selector.cameras.map((camera) => `${camera.trackId} ${camera.deviceId}`), ...selector.mics.map((mic) => `${mic.role} ${mic.deviceId}`)].sort();
  const ALL_LINES = SLOTS.map((slot) => `${slot} ${HELD[slot]}`).sort();

  describe('1. a stored selector with NULL slots boots: the steps `capture.config` and `engine.rehydrate` pass, by name', () => {
    const OPERATIONS = [
      ['SIMULATED', SIMULATED, false],
      ['REAL_DEVELOPMENT', DEVELOPMENT, false],
      ['REAL_PRODUCTION', PRODUCTION, true],
    ] as const;

    it.each(OPERATIONS)('GATE CONDITION AD-04, %s: a selector row of six NULLs - the Core starts, the selector is two empty lists, operation 76 answers it', async (operation, config, production) => {
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
      // Nothing was assigned by the boot: the stored row is still six NULLs.
      await core.app.pipeline.drain();
      expect(await storedSlots(owner)).toEqual(rowWithout(SLOTS));
    });

    it.each([OPERATIONS[0], OPERATIONS[1]])('AD-04 (2), %s: only VIDEO-02 and only a STANDBY microphone stored - those two lines and no other, in the load and in the engine (nothing by position)', async (operation, config) => {
      const target = await clone(`r29-two-${operation.toLowerCase().replace('_', '-')}`, (owner) => unassignStored(owner, ['VIDEO-01', 'PRIMARY']));
      const core = await booted(target, config);
      expect(captureFenceControl(core.app).operation).toBe(operation);
      expect(core.steps).toEqual(expect.arrayContaining(['capture.config', 'engine.rehydrate']));
      const expected = ['STANDBY MIC-02', 'VIDEO-02 CAM-02'];
      expect(linesOf(captureConfigControl(core.app).snapshot().captureConfig)).toEqual(expected);
      expect(linesOf(core.app.engine.slice('captureConfig'))).toEqual(expected);
      expect(linesOf(selectorOf(await core.get(CONFIG)))).toEqual(expected);
      expect(core.app.engine.slice('captureConfig').mics.map((mic) => [mic.inputId, mic.role])).toEqual([['MIC-02', 'STANDBY']]);
    });
  });

  describe('2. operation 78 `unassign` clears a slot for real, and the slot is assigned again', () => {
    it('SIMULATED on the seed: each of the four slots - the answer without the line, NULL stored, ONE row with `from`; stored = committed; a restarted Core boots on the six NULLs the product wrote; all four are assigned again', async () => {
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
      // AD-10 (1): one stored row per cleared slot, with the closed keys the trail accepts (the engine refuses any other).
      expect((await changedRows(owner)).slice(rowsBefore)).toEqual(SLOTS.map((slot) => clearedRow(slot)));
      // Clearing empty slots: 200, the same selector, 0 rows, nothing written.
      const again = await first.post(CONFIG, { unassign: [...SLOTS] });
      expect(again.statusCode, again.body).toBe(200);
      expect(selectorOf(again)).toMatchObject({ cameras: [], mics: [] });
      await first.app.pipeline.drain();
      expect(await changedRows(owner)).toHaveLength(rowsBefore + 4);
      expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(first.app.engine.state()));
      const trail = await readTrail(owner);
      expect(linkProblems(trail)).toEqual([]);
      await first.app.close();

      // A RESTART on what the product itself wrote: the Core boots, and holds the empty selector.
      const second = await booted(target, SIMULATED);
      expect(second.steps).toEqual(expect.arrayContaining(['capture.config', 'engine.rehydrate']));
      expect(linesOf(second.app.engine.slice('captureConfig'))).toEqual([]);
      expect(linesOf(captureConfigControl(second.app).snapshot().captureConfig)).toEqual([]);

      // RE-ASSIGNING: each slot by its track or its role; a microphone role alone (C21 (8)).
      const camera1 = await second.post(CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_1080P25' }] });
      expect(camera1.statusCode, camera1.body).toBe(200);
      expect(linesOf(selectorOf(camera1))).toEqual(['VIDEO-01 CAM-01']);
      const standby = await second.post(CONFIG, { mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY' }] });
      expect(standby.statusCode, standby.body).toBe(200);
      expect(linesOf(selectorOf(standby))).toEqual(['STANDBY MIC-02', 'VIDEO-01 CAM-01']);
      await second.app.pipeline.drain();
      expect(await storedSlots(owner)).toEqual(rowWithout(['VIDEO-02', 'PRIMARY']));
      const rest = await second.post(CONFIG, { cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_1080P25' }], mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', role: 'PRIMARY' }] });
      expect(rest.statusCode, rest.body).toBe(200);
      expect(linesOf(selectorOf(rest))).toEqual(ALL_LINES);
      expect(selectorOf(rest).mics.map((mic) => [mic.inputId, mic.role, mic.transport])).toEqual([
        ['MIC-01', 'PRIMARY', 'USB'],
        ['MIC-02', 'STANDBY', 'USB'],
      ]);
      await second.app.pipeline.drain();
      // The stored row is the seeded one again, column for column.
      expect(await storedSlots(owner)).toEqual(SEEDED);
      // Four assignments into empty slots: four rows, none of them states a `from` (nothing was there).
      const assigned = (await changedRows(owner)).slice(rowsBefore + 4);
      expect(assigned.map((row) => [row['scope'], row['field'], row['to'], Object.hasOwn(row, 'from')])).toEqual([
        ['CAMERA', 'SOURCE', 'CAM-01', false],
        ['MIC', 'SOURCE', 'MIC-02', false],
        ['CAMERA', 'SOURCE', 'CAM-02', false],
        ['MIC', 'SOURCE', 'MIC-01', false],
      ]);
      expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(second.app.engine.state()));
      const after = await readTrail(owner);
      expect(linkProblems(after)).toEqual([]);
      expect(verifyTrail(after, await readHead(owner))).toMatchObject({ ok: true });
    });

    it('REAL_PRODUCTION: a Core with one production camera assigned and three slots unassigned boots; the camera is unassigned through operation 78 (one row), a development source is still refused, and the restarted Core boots on six NULLs', async () => {
      const target = await clone('r29-unassign-prod', async (owner) => {
        await owner.query("INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('CAM-11', 'CAMERA', 'RTSP', true, 'ONVIF_RTSP')");
        await owner.query("UPDATE public.capture_config SET video_01_device_id = 'CAM-11'");
        await unassignStored(owner, ['VIDEO-02', 'PRIMARY', 'STANDBY']);
        await ownCredentials(owner);
      });
      const owner = target.ownerPool();
      const first = await booted(target, PRODUCTION, OWN_PASSWORD);
      expect(captureFenceControl(first.app).operation).toBe('REAL_PRODUCTION');
      expect(first.steps).toEqual(expect.arrayContaining(['capture.fence', 'capture.config', 'engine.rehydrate']));
      expect(linesOf(first.app.engine.slice('captureConfig'))).toEqual(['VIDEO-01 CAM-11']);
      const rowsBefore = (await changedRows(owner)).length;

      const answer = await first.post(CONFIG, { unassign: ['VIDEO-01', 'STANDBY'] });
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
  });

  describe('3. the lock, and a session on an incomplete selector in Simulated mode', () => {
    const SESSION_INPUT = { caseNumber: 'LP/2026/1001-0029', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;

    it('SIMULATED: the STANDBY slot is unassigned; a session is created and STARTS as before (C21 (6)); created and RECORDING, every unassign is 409 CAPTURE_CONFIG_LOCKED with 0 rows and nothing stored (AD-10 (2))', async () => {
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

      expect((await post({ unassign: ['STANDBY'] })).statusCode).toBe(200);
      await core.app.pipeline.drain();
      expect(await storedSlots(owner)).toEqual(rowWithout(['STANDBY']));
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
        expect(await storedSlots(owner), label).toEqual(rowWithout(['STANDBY']));
      };

      const investigator = core.principal('INVESTIGATOR');
      const created = await core.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
      expect(created.value).toMatchObject({ ok: true, created: true });
      await expectLocked('CREATE');

      // The session starts on the selector with the unassigned STANDBY slot, as it did before WP-13a in Simulated mode.
      // (A tablet is "connected" by the engine's own door, as the session tests do: the pre-check item CORE needs the link.)
      await core.engine.setTabletLink('CONNECTED');
      await core.engine.command(investigator, 'beginPrecheck');
      await core.drive(5_000);
      // The pre-check of a Simulated Core says of the unassigned role what it said before WP-13a: a WARN, never the BLOCK of real capture.
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
});
