// Operations 76 to 80 against PostgreSQL and the REAL engine (blueprint row 66 / M4-W2; contract
// C3 §2.2 to §2.4, §4, §5.2, §6; specs R-1; checks M4-LOCK-1 and the server half of M4-SEL-W/T/P).
//
// The real app factory on a clone of the seed, as `dems_app`, with EVERY stage as the server has
// it: nothing of the request pipeline is replaced. The engine is booted on a manual clock and a
// manual timer. The three seeded operators are signed in on the web console. What is stored is
// read as `dems_owner`. Every count is relative to the trail after the boot and the sign-ins.
import { validateCoreApiResponse } from '@dems/shared/api';
import type { AuditRow, OperatorRole } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { storedSlices } from '../../../../test/support/engine';
import { forgetCounters } from '../../../../test/support/identity';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { bodyOf, devicesApp, errorOf, outcome, type DevicesApp } from '../../devices/__tests__/support';
import { createCaptureConfigStore } from '../index';
import { CONFIG, DEVICES, cameraSource, primaryMic } from './support';

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
