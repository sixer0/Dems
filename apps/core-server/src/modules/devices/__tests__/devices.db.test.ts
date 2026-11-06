// Operations 44 to 52 against PostgreSQL and the REAL engine (plan row W36; module gate MODG;
// spec §7.10, §7.2, §7.3, §7.17; engine host finding F-11).
//
// The real app factory on a clone of the seed, as `dems_app`, with EVERY stage as the server has
// it: nothing of the request pipeline is replaced. The engine is booted and runs on a manual
// clock and a manual timer, so it ticks exactly when a test fires it. The three seeded operators
// are signed in on the web console with the seeded credential; a request carries the cookie, a
// command also the web console `Origin`. What is stored is read as `dems_owner`.
//
// Every count is relative to the trail AFTER the boot and the three sign-ins (the first start on
// a fresh seed writes a row of its own). No credential is printed.
import { validateCoreApiResponse } from '@dems/shared/api';
import { verifyAuditChain, type AuditRow, type OperatorRole } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { withoutNegativeZeros } from '../../../../test/support/seed';
import { storedSlices } from '../../../../test/support/engine';
import { FOREIGN_ORIGIN, WEB_ORIGIN, forgetCounters } from '../../../../test/support/identity';
import { audioStatusOf, deviceHealthOf, deviceInventoryOf, videoStatusOf } from '../index';
import {
  ACTIVE_CAMERA,
  AUDIO,
  CLIP_RESET,
  HEALTH,
  INVENTORY,
  VIDEO,
  bodyOf,
  devicesApp,
  errorOf,
  identify,
  outcome,
  restart,
  testSignal,
  type DevicesApp,
} from './support';

const db = useTestDatabase({ template: 'seed' });
let server: DevicesApp;

const ROLES = ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const satisfies readonly OperatorRole[];
/** The devices of the Core that the simulator restarts and sends a test signal to. */
const HARDWARE = ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'POE-SWITCH', 'REC-INDICATOR', 'TABLET'] as const; // D60/D61 (2026-11-04): four tracks and four channels of built-ins
/** The platform devices: they accept IDENTIFY only. */
const PLATFORM = ['GNSS', 'TPM', 'FRONT-PANEL'] as const;

beforeAll(async () => {
  server = await devicesApp(db);
});

const operatorId = (role: OperatorRole): string => server.principal(role).operatorId;
const commandRows = (rows: readonly AuditRow[]): AuditRow[] => rows.filter((row) => row.type === 'DEVICE_COMMAND');
const denials = (rows: readonly AuditRow[]): AuditRow[] => rows.filter((row) => row.type === 'ACCESS_DENIED');

/** The published state change that appended an audit row of this type for this device, newest first. */
function changeOf(type: string, deviceId: string | null) {
  return [...server.stateChanges()].reverse().find((change) =>
    change.ops.some((op) => op.op === 'append' && op.slice === 'audit' && op.rows.some((row) => row.type === type && row.deviceId === deviceId)),
  );
}

/** What the tables hold equals the committed state of the engine, and the stored chain verifies. */
async function expectStoredEqualsCommitted(): Promise<void> {
  await server.app.pipeline.drain();
  const stored = await storedSlices(server.owner);
  expect(stored).toStrictEqual(withoutNegativeZeros(server.engine.state()));
  const rows = await readTrail(server.owner);
  const head = await readHead(server.owner);
  expect(linkProblems(rows)).toEqual([]);
  expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
  expect(server.engine.slice('audit')).toMatchObject({ total: head.seq, head: head.hash });
  expect(verifyAuditChain(server.engine.slice('audit'))).toMatchObject({ ok: true });
}

describe('the booted server', () => {
  it('is ready with a running engine on the manual timer, listens on no port, and holds the idle seed', () => {
    expect(server.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect(server.engine.running).toBe(true);
    expect(server.engine.epoch).toBeGreaterThanOrEqual(1);
    expect(server.timer.active()).toBe(1);
    expect(server.app.server.listening).toBe(false);
    expect(server.engine.slice('session')).toBeNull();
    expect(server.engine.slice('cameras').map((camera) => camera.deviceId)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']); // D60 (2026-11-04): four tracks
    expect(server.engine.slice('mics').map((mic) => mic.deviceId)).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']); // D61 (2026-11-04): four channels
    expect(server.engine.slice('otherDevices').map((device) => device.id)).toEqual(['POE-SWITCH', 'REC-INDICATOR', 'TABLET']);
  });
});

describe('operations 44 to 47: the reads', () => {
  it.each(ROLES)('%s reads all four: 200, the committed state in the contract\'s shape, at the server clock', async (role) => {
    const state = server.engine.state();
    const now = server.clock.now();

    const health = await server.get(role, HEALTH);
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual(deviceHealthOf(state, now));
    expect(validateCoreApiResponse('getDeviceHealth', 200, health.json())).toEqual({ ok: true });

    const audio = await server.get(role, AUDIO);
    expect(audio.statusCode).toBe(200);
    expect(audio.json()).toEqual(audioStatusOf(state, now));
    expect(validateCoreApiResponse('getAudioStatus', 200, audio.json())).toEqual({ ok: true });

    const video = await server.get(role, VIDEO);
    expect(video.statusCode).toBe(200);
    expect(video.json()).toEqual(videoStatusOf(state));
    expect(validateCoreApiResponse('getVideoStatus', 200, video.json())).toEqual({ ok: true });

    const inventory = await server.get(role, INVENTORY);
    expect(inventory.statusCode).toBe(200);
    expect(inventory.json()).toEqual(JSON.parse(JSON.stringify(deviceInventoryOf(state))));
    expect(validateCoreApiResponse('getDeviceInventory', 200, inventory.json())).toEqual({ ok: true });
  });

  it('what a read answers is what the tables hold: the seven slices of the inventory equal the stored ones', async () => {
    await expectStoredEqualsCommitted();
    const stored = await storedSlices(server.owner);
    const inventory = (await server.get('TECHNICIAN', INVENTORY)).json() as Record<string, unknown>;
    for (const slice of ['device', 'cameras', 'mics', 'otherDevices', 'ports', 'activeCameraId', 'tabletLink'] as const) {
      expect(inventory[slice], slice).toEqual(JSON.parse(JSON.stringify(stored[slice])));
    }
    // The process started: the tablet link is OFFLINE until a tablet connects (engine host F-10).
    expect(inventory['tabletLink']).toMatchObject({ state: 'OFFLINE' });
    expect((await server.get('TECHNICIAN', HEALTH)).json()).toMatchObject({ systemState: 'ATTENTION', flags: [{ id: 'TABLET_OFFLINE', severity: 'WARNING' }] });
  });

  it('a read opens no unit of work, writes no row and publishes nothing', async () => {
    const before = { rows: await server.trailLength(), statements: server.database.statements.length, publications: server.publications.length, revision: server.engine.revision };
    for (const url of [HEALTH, AUDIO, VIDEO, INVENTORY]) expect((await server.get('SUPERVISOR', url)).statusCode).toBe(200);
    await server.app.pipeline.drain();
    expect({ rows: await server.trailLength(), statements: server.database.statements.length, publications: server.publications.length, revision: server.engine.revision }).toEqual(before);
  });

  it('nobody without a session reads: 401 NOT_SIGNED_IN on all four, and no row', async () => {
    const before = await server.trailLength();
    for (const [operationId, url] of [
      ['getDeviceHealth', HEALTH],
      ['getAudioStatus', AUDIO],
      ['getVideoStatus', VIDEO],
      ['getDeviceInventory', INVENTORY],
    ] as const) {
      const response = await server.get(null, url);
      expect(outcome(response), url).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse(operationId, 401, response.json()), url).toEqual({ ok: true });
    }
    expect(await server.trailLength()).toBe(before);
  });
});

describe('operations 44 to 47: the documented 403 of a read is the stages\'', () => {
  it('a read with the session cookie and an Origin that is no web console origin: 403 ORIGIN_NOT_ALLOWED on all four, and no row', async () => {
    const before = await server.trailLength();
    for (const [operationId, url] of [
      ['getDeviceHealth', HEALTH],
      ['getAudioStatus', AUDIO],
      ['getVideoStatus', VIDEO],
      ['getDeviceInventory', INVENTORY],
    ] as const) {
      const response = await server.app.inject({ method: 'GET', url, headers: { ...server.sessions.SUPERVISOR, origin: FOREIGN_ORIGIN } });
      expect(outcome(response), url).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
      expect(validateCoreApiResponse(operationId, 403, response.json()), url).toEqual({ ok: true });
      // The same read from the web console's own origin is answered.
      expect((await server.app.inject({ method: 'GET', url, headers: { ...server.sessions.SUPERVISOR, origin: WEB_ORIGIN } })).statusCode, url).toBe(200);
    }
    expect(await server.trailLength()).toBe(before);
  });
});

describe('operations 49 and 50: testDeviceSignal and identifyDevice (DIAGNOSTICS_RUN)', () => {
  it.each(ROLES)('%s identifies a camera, a microphone, another device and every platform device: 204, one DEVICE_COMMAND row each, by the caller, at the server clock', async (role) => {
    for (const id of ['CAM-01', 'MIC-02', 'POE-SWITCH', ...PLATFORM]) {
      const before = await server.trailLength();
      server.clock.advance(1_000);
      const at = server.clock.now();

      const response = await server.post(role, identify(id));
      expect(response.statusCode, id).toBe(204);
      expect(response.body, id).toBe('');
      expect(validateCoreApiResponse('identifyDevice', 204, bodyOf(response)), id).toEqual({ ok: true });

      const rows = await server.since(before);
      expect(rows.map((row) => row.type), id).toEqual(['DEVICE_COMMAND']);
      expect(rows[0], id).toMatchObject({ actorId: operatorId(role), deviceId: id, at, details: { command: 'IDENTIFY', blinks: 3, periodMs: 500 } });
      // API-7: the answer names the epoch and the revision of the change that holds the row.
      expect(response.headers['x-dems-epoch'], id).toBe(String(server.engine.epoch));
      expect(Number(response.headers['x-dems-revision']), id).toBe(changeOf('DEVICE_COMMAND', id)?.revision);
      expect(Number(response.headers['x-dems-revision']), id).toBe(server.engine.revision);
    }
  });

  it.each(ROLES)('%s sends a test signal to each device that takes one: 204 and one DEVICE_COMMAND row with command TEST_SIGNAL', async (role) => {
    for (const id of HARDWARE) {
      const before = await server.trailLength();
      const response = await server.post(role, testSignal(id));
      expect(response.statusCode, id).toBe(204);
      expect(validateCoreApiResponse('testDeviceSignal', 204, bodyOf(response)), id).toEqual({ ok: true });
      const rows = await server.since(before);
      expect(rows.map((row) => [row.type, row.actorId, row.deviceId, row.details]), id).toEqual([['DEVICE_COMMAND', operatorId(role), id, { command: 'TEST_SIGNAL' }]]);
      expect(Number(response.headers['x-dems-revision']), id).toBe(changeOf('DEVICE_COMMAND', id)?.revision);
    }
  });

  it('a platform device takes no test signal: 409 COMMAND_UNSUPPORTED with the simulator\'s code, and nothing is written', async () => {
    const before = { rows: await server.trailLength(), revision: server.engine.revision, state: server.engine.state() };
    for (const id of PLATFORM) {
      const response = await server.post('SUPERVISOR', testSignal(id));
      expect(outcome(response), id).toEqual([409, 'COMMAND_UNSUPPORTED']);
      expect(errorOf(response).details, id).toEqual({ simCode: 'COMMAND_UNSUPPORTED', from: null, event: 'deviceCommand' });
      expect(validateCoreApiResponse('testDeviceSignal', 409, response.json()), id).toEqual({ ok: true });
      expect(response.headers['x-dems-revision'], id).toBeUndefined();
    }
    expect({ rows: await server.trailLength(), revision: server.engine.revision }).toEqual({ rows: before.rows, revision: before.revision });
    // ENG-7: a refused command changes nothing, not even by reference.
    expect(server.engine.state()).toBe(before.state);
  });

  it('a device the Core does not have: 404 NOT_FOUND for both operations, also for the ID of a paired mobile device', async () => {
    const before = await server.trailLength();
    for (const id of ['CAM-09', 'MIC-09', 'DEV-0001', 'NVME-SYS', 'X']) { // D60/D61 (2026-11-04): `CAM-03` is a built-in now; the unknown id of the class is the next free one
      for (const [operationId, url] of [
        ['testDeviceSignal', testSignal(id)],
        ['identifyDevice', identify(id)],
      ] as const) {
        const response = await server.post('TECHNICIAN', url);
        expect(outcome(response), url).toEqual([404, 'NOT_FOUND']);
        expect(errorOf(response).details, url).toEqual({ simCode: 'NOT_FOUND' });
        expect(validateCoreApiResponse(operationId, 404, response.json()), url).toEqual({ ok: true });
        expect(response.body, url).not.toContain(id);
      }
    }
    expect(await server.trailLength()).toBe(before);
  });

  it('a malformed device ID is the schema stage\'s 422 INVALID_INPUT, through the real stages', async () => {
    const before = await server.trailLength();
    for (const id of ['cam-01', 'CAM_01', 'CAM%2001', `A${'B'.repeat(32)}`]) {
      for (const [operationId, url] of [
        ['testDeviceSignal', testSignal(id)],
        ['identifyDevice', identify(id)],
        ['restartDevice', restart(id)],
      ] as const) {
        const response = await server.post('TECHNICIAN', url);
        expect(outcome(response), url).toEqual([422, 'INVALID_INPUT']);
        expect(validateCoreApiResponse(operationId, 422, response.json()), url).toEqual({ ok: true });
      }
    }
    expect(await server.trailLength()).toBe(before);
  });

  it('who may call: every seeded role holds DIAGNOSTICS_RUN; a role that loses the grant is refused with 403 and ONE ACCESS_DENIED row, at once, and allowed again when it is back', async () => {
    forgetCounters(server.identity);
    const before = await server.trailLength();
    // The stored matrix decides at each request (RB-2): the grant is taken away in this clone.
    await server.owner.query("DELETE FROM public.role_permissions WHERE role_id = 'INVESTIGATOR' AND permission_id = 'DIAGNOSTICS_RUN'");
    try {
      for (const [operationId, url] of [
        ['testDeviceSignal', testSignal('MIC-01')],
        ['identifyDevice', identify('CAM-01')],
      ] as const) {
        const response = await server.post('INVESTIGATOR', url);
        expect(outcome(response), operationId).toEqual([403, 'NOT_PERMITTED']);
        expect(validateCoreApiResponse(operationId, 403, response.json()), operationId).toEqual({ ok: true });
        // The other roles are not touched by it.
        expect((await server.post('TECHNICIAN', url)).statusCode, operationId).toBe(204);
      }
    } finally {
      await server.owner.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('INVESTIGATOR', 'DIAGNOSTICS_RUN')");
    }
    const rows = await server.since(before);
    expect(denials(rows).map((row) => [row.actorId, row.details])).toEqual([
      [operatorId('INVESTIGATOR'), { operationId: 'testDeviceSignal', permission: 'DIAGNOSTICS_RUN', role: 'INVESTIGATOR' }],
      [operatorId('INVESTIGATOR'), { operationId: 'identifyDevice', permission: 'DIAGNOSTICS_RUN', role: 'INVESTIGATOR' }],
    ]);
    // The refused calls ran no command: the only DEVICE_COMMAND rows are the TECHNICIAN's two.
    expect(commandRows(rows).map((row) => row.actorId)).toEqual([operatorId('TECHNICIAN'), operatorId('TECHNICIAN')]);
    expect((await server.post('INVESTIGATOR', identify('CAM-01'))).statusCode).toBe(204);
  });
});

describe('operation 48: restartDevice (DEVICE_MANAGE)', () => {
  it('the TECHNICIAN restarts every camera, microphone and other device: 204, one DEVICE_COMMAND row with command RESTART; the devices are as before', async () => {
    const devices = () => ({ cameras: server.engine.slice('cameras'), mics: server.engine.slice('mics'), otherDevices: server.engine.slice('otherDevices'), ports: server.engine.slice('ports') });
    const beforeDevices = devices();
    for (const id of HARDWARE) {
      const before = await server.trailLength();
      const response = await server.post('TECHNICIAN', restart(id));
      expect(response.statusCode, id).toBe(204);
      expect(response.body, id).toBe('');
      expect(validateCoreApiResponse('restartDevice', 204, bodyOf(response)), id).toEqual({ ok: true });
      const rows = await server.since(before);
      expect(rows.map((row) => [row.type, row.actorId, row.deviceId, row.details]), id).toEqual([['DEVICE_COMMAND', operatorId('TECHNICIAN'), id, { command: 'RESTART' }]]);
      expect(response.headers['x-dems-epoch'], id).toBe(String(server.engine.epoch));
      expect(Number(response.headers['x-dems-revision']), id).toBe(changeOf('DEVICE_COMMAND', id)?.revision);
    }
    // The simulated restart is complete with its row: no slice of the devices changed.
    expect(devices()).toStrictEqual(beforeDevices);
    await expectStoredEqualsCommitted();
  });

  it('a platform device cannot be restarted: 409 COMMAND_UNSUPPORTED, and nothing is written', async () => {
    const before = { rows: await server.trailLength(), revision: server.engine.revision };
    for (const id of PLATFORM) {
      const response = await server.post('TECHNICIAN', restart(id));
      expect(outcome(response), id).toEqual([409, 'COMMAND_UNSUPPORTED']);
      expect(errorOf(response).details, id).toEqual({ simCode: 'COMMAND_UNSUPPORTED', from: null, event: 'deviceCommand' });
      expect(validateCoreApiResponse('restartDevice', 409, response.json()), id).toEqual({ ok: true });
    }
    expect({ rows: await server.trailLength(), revision: server.engine.revision }).toEqual(before);
    console.info('[w36] restartDevice and testDeviceSignal on GNSS, TPM and FRONT-PANEL answer 409 COMMAND_UNSUPPORTED with details.simCode COMMAND_UNSUPPORTED; no row, no revision');
  });

  it('a device the Core does not have: 404 NOT_FOUND', async () => {
    for (const id of ['CAM-09', 'DEV-0001']) { // D60/D61 (2026-11-04): `CAM-03` is a built-in now
      const response = await server.post('TECHNICIAN', restart(id));
      expect(outcome(response), id).toEqual([404, 'NOT_FOUND']);
      expect(errorOf(response).details, id).toEqual({ simCode: 'NOT_FOUND' });
      expect(validateCoreApiResponse('restartDevice', 404, response.json()), id).toEqual({ ok: true });
    }
  });

  it('who may call: INVESTIGATOR and SUPERVISOR are refused with 403 NOT_PERMITTED and exactly ONE ACCESS_DENIED row each; no command runs', async () => {
    forgetCounters(server.identity);
    for (const role of ['INVESTIGATOR', 'SUPERVISOR'] as const) {
      const before = await server.trailLength();
      const response = await server.post(role, restart('CAM-01'));
      expect(outcome(response), role).toEqual([403, 'NOT_PERMITTED']);
      expect(errorOf(response).details, role).toMatchObject({ permission: 'DEVICE_MANAGE' });
      expect(validateCoreApiResponse('restartDevice', 403, response.json()), role).toEqual({ ok: true });
      expect(response.headers['x-dems-revision'], role).toBeUndefined();
      const rows = await server.since(before);
      expect(rows.map((row) => [row.type, row.actorId, row.details]), role).toEqual([
        ['ACCESS_DENIED', operatorId(role), { operationId: 'restartDevice', permission: 'DEVICE_MANAGE', role }],
      ]);
    }
  });

  it('the hosted action checks the same permission by the SHARED matrix: a grant that exists only in the stored matrix passes the guard and is refused by the simulator, with its code and without a row', async () => {
    forgetCounters(server.identity);
    const before = { rows: await server.trailLength(), revision: server.engine.revision };
    await server.owner.query("INSERT INTO public.role_permissions (role_id, permission_id) VALUES ('SUPERVISOR', 'DEVICE_MANAGE')");
    try {
      const response = await server.post('SUPERVISOR', restart('CAM-01'));
      expect(outcome(response)).toEqual([403, 'NOT_PERMITTED']);
      // The refusal is the simulator's (`requirePermission`), mapped by the engine: `details.simCode`.
      expect(errorOf(response).details).toEqual({ simCode: 'NOT_PERMITTED', permission: 'DEVICE_MANAGE' });
      expect(validateCoreApiResponse('restartDevice', 403, response.json())).toEqual({ ok: true });
    } finally {
      await server.owner.query("DELETE FROM public.role_permissions WHERE role_id = 'SUPERVISOR' AND permission_id = 'DEVICE_MANAGE'");
    }
    // Nothing ran and nothing was written: not the command's row, and no ACCESS_DENIED row either
    // (the guard let the call through; the module writes none, rule M3).
    expect({ rows: await server.trailLength(), revision: server.engine.revision }).toEqual(before);
    expect(outcome(await server.post('SUPERVISOR', restart('CAM-01')))).toEqual([403, 'NOT_PERMITTED']);
    expect((await server.since(before.rows)).map((row) => row.type)).toEqual(['ACCESS_DENIED']);
  });

  it('SR-44: a caller without the permission learns nothing from the path: a malformed ID and an unknown device answer the same 403', async () => {
    forgetCounters(server.identity);
    const before = await server.trailLength();
    expect(outcome(await server.post('SUPERVISOR', restart('not-a-device-id')))).toEqual([403, 'NOT_PERMITTED']);
    expect(outcome(await server.post('SUPERVISOR', restart('CAM-99')))).toEqual([403, 'NOT_PERMITTED']);
    expect(outcome(await server.post('SUPERVISOR', restart('GNSS')))).toEqual([403, 'NOT_PERMITTED']);
    expect((await server.since(before)).map((row) => row.type)).toEqual(['ACCESS_DENIED', 'ACCESS_DENIED', 'ACCESS_DENIED']);
  });
});

describe('operations 51 and 52: setActiveCamera and resetMicClip (every signed-in role; no audit row)', () => {
  it('setActiveCamera changes the camera the monitor shows for every console, writes no audit row, and a repeat changes nothing', async () => {
    expect(server.engine.slice('activeCameraId')).toBe('VIDEO-01');
    const before = await server.trailLength();

    const second = await server.post('INVESTIGATOR', ACTIVE_CAMERA, { cameraId: 'VIDEO-02' });
    expect(second.statusCode).toBe(204);
    expect(second.body).toBe('');
    expect(validateCoreApiResponse('setActiveCamera', 204, bodyOf(second))).toEqual({ ok: true });
    expect(server.engine.slice('activeCameraId')).toBe('VIDEO-02');
    // API-7: the revision of the change that replaced the slice.
    const change = server.stateChanges().at(-1);
    expect(change?.ops).toEqual([{ op: 'replace', slice: 'activeCameraId', value: 'VIDEO-02' }]);
    expect(Number(second.headers['x-dems-revision'])).toBe(change?.revision);
    expect((await server.get('TECHNICIAN', INVENTORY)).json()).toMatchObject({ activeCameraId: 'VIDEO-02' });

    // The same camera again: 204, the current revision, no publication (API-7, "nothing replicated changed").
    const publications = server.publications.length;
    const repeat = await server.post('SUPERVISOR', ACTIVE_CAMERA, { cameraId: 'VIDEO-02' });
    expect(repeat.statusCode).toBe(204);
    expect(repeat.headers['x-dems-revision']).toBe(second.headers['x-dems-revision']);
    expect(server.publications.length).toBe(publications);

    for (const role of ROLES) expect((await server.post(role, ACTIVE_CAMERA, { cameraId: role === 'SUPERVISOR' ? 'VIDEO-02' : 'VIDEO-01' })).statusCode, role).toBe(204);
    expect(server.engine.slice('activeCameraId')).toBe('VIDEO-01');
    // NONE-P: no audit row for any of the five calls.
    expect(await server.trailLength()).toBe(before);
    // Every video track is untouched by the view selection (D60, 2026-11-04: four).
    expect((await server.get('INVESTIGATOR', VIDEO)).json()).toMatchObject({ tracks: [{ trackId: 'VIDEO-01', online: true }, { trackId: 'VIDEO-02', online: true }, { trackId: 'VIDEO-03', online: true }, { trackId: 'VIDEO-04', online: true }] });
    await expectStoredEqualsCommitted();
  });

  it('resetMicClip with no latch set: 204 for every role, nothing changes and no row is written', async () => {
    const before = { rows: await server.trailLength(), revision: server.engine.revision, mics: server.engine.slice('mics') };
    expect(before.mics.map((mic) => mic.clipLatched)).toEqual([false, false, false, false]); // D61 (2026-11-04): four channels
    for (const role of ROLES) {
      for (const channel of ['AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04']) { // D61 (2026-11-04): v2 records four audio tracks
        const response = await server.post(role, CLIP_RESET, { channel });
        expect(response.statusCode, `${role} ${channel}`).toBe(204);
        expect(validateCoreApiResponse('resetMicClip', 204, bodyOf(response))).toEqual({ ok: true });
        expect(Number(response.headers['x-dems-revision'])).toBe(before.revision);
      }
    }
    expect(server.engine.slice('mics')).toBe(before.mics);
    expect(await server.trailLength()).toBe(before.rows);
  });

  it('a body outside the schema is refused before the engine: 422 INVALID_INPUT, 400 INVALID_JSON; nothing changes', async () => {
    const before = { rows: await server.trailLength(), revision: server.engine.revision };
    const json = { 'content-type': 'application/json', origin: WEB_ORIGIN, ...server.sessions.TECHNICIAN };
    const cases: ReadonlyArray<readonly [operationId: 'setActiveCamera' | 'resetMicClip', url: string, payload: string, expected: [number, string]]> = [
      ['setActiveCamera', ACTIVE_CAMERA, '{}', [422, 'INVALID_INPUT']],
      ['setActiveCamera', ACTIVE_CAMERA, '{"cameraId":"VIDEO-05"}', [422, 'INVALID_INPUT']], // D60 (2026-11-04): VIDEO-03/04 are valid tracks now; outside the enum is VIDEO-05
      ['setActiveCamera', ACTIVE_CAMERA, '{"cameraId":', [400, 'INVALID_JSON']],
      ['resetMicClip', CLIP_RESET, '{}', [422, 'INVALID_INPUT']],
      ['resetMicClip', CLIP_RESET, '{"channel":"VIDEO-01"}', [422, 'INVALID_INPUT']],
      ['resetMicClip', CLIP_RESET, '[]', [400, 'INVALID_JSON']],
    ];
    for (const [operationId, url, payload, expected] of cases) {
      const response = await server.app.inject({ method: 'POST', url, headers: json, payload });
      expect(outcome(response), `${operationId} ${payload}`).toEqual(expected);
      expect(validateCoreApiResponse(operationId, response.statusCode, response.json()), `${operationId} ${payload}`).toEqual({ ok: true });
    }
    expect({ rows: await server.trailLength(), revision: server.engine.revision }).toEqual(before);
  });
});

describe('the five commands: who may call, through the real stages', () => {
  const commands = (): ReadonlyArray<readonly [operationId: string, url: string, payload?: object]> => [
    ['restartDevice', restart('CAM-01')],
    ['testDeviceSignal', testSignal('MIC-01')],
    ['identifyDevice', identify('GNSS')],
    ['setActiveCamera', ACTIVE_CAMERA, { cameraId: 'VIDEO-02' }],
    ['resetMicClip', CLIP_RESET, { channel: 'AUDIO-01' }],
  ];

  it('nobody without a session: 401 NOT_SIGNED_IN on all five, no row, nothing changed', async () => {
    forgetCounters(server.identity);
    const before = { rows: await server.trailLength(), revision: server.engine.revision, camera: server.engine.slice('activeCameraId') };
    for (const [operationId, url, payload] of commands()) {
      const response = await server.post(null, url, payload);
      expect(outcome(response), operationId).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse(operationId, 401, response.json()), operationId).toEqual({ ok: true });
    }
    expect({ rows: await server.trailLength(), revision: server.engine.revision, camera: server.engine.slice('activeCameraId') }).toEqual(before);
  });

  it('a command with a session cookie and an Origin that is no web console origin: 403 ORIGIN_NOT_ALLOWED, nothing runs', async () => {
    const before = { rows: await server.trailLength(), revision: server.engine.revision };
    for (const [operationId, url, payload] of commands()) {
      const response: LightMyRequestResponse = await server.app.inject({
        method: 'POST',
        url,
        headers: { ...server.sessions.TECHNICIAN, origin: FOREIGN_ORIGIN },
        ...(payload === undefined ? {} : { payload }),
      });
      expect(outcome(response), operationId).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
      expect(validateCoreApiResponse(operationId, 403, response.json()), operationId).toEqual({ ok: true });
    }
    expect({ rows: await server.trailLength(), revision: server.engine.revision }).toEqual(before);
  });
});

describe('the cost of one command', () => {
  it('restartDevice is one unit of work: the statements of one transaction, one audit row, one commit', async () => {
    await server.app.pipeline.drain();
    const mark = server.database.statements.length;
    const began = performance.now();
    const response = await server.post('TECHNICIAN', restart('CAM-02'));
    const tookMs = performance.now() - began;
    expect(response.statusCode).toBe(204);
    await server.app.pipeline.drain();

    const sent = server.database.statements.slice(mark).map((text) => text.replace(/\s+/g, ' ').trim());
    const unit = sent.slice(sent.findLastIndex((text) => text.startsWith('BEGIN')));
    expect(unit[0]).toMatch(/^BEGIN/);
    expect(unit.at(-1)).toBe('COMMIT');
    expect(unit.filter((text) => /^insert into "audit_log"/i.test(text))).toHaveLength(1);
    expect(unit.filter((text) => /^insert into "events"/i.test(text))).toHaveLength(0);
    console.info(
      `[w36] one restartDevice through the real stages: ${tookMs.toFixed(1)} ms; statements on unit-of-work connections since the request began: ${sent.length}; ` +
        `the command's unit (${unit.length}): ${unit.map((text) => text.slice(0, 44)).join(' | ')}`,
    );
  });
});

describe('F-11 of the engine host: deviceCommand, setActiveCamera and resetClip ran against PostgreSQL', () => {
  it('after everything above the tables hold exactly the committed state, the stored chain verifies, and no error line was written', async () => {
    await expectStoredEqualsCommitted();
    const written = await server.since(server.rowsAtStart);
    const byType = written.reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.type]: (counts[row.type] ?? 0) + 1 }), {});
    expect(Object.keys(byType).sort()).toEqual(['ACCESS_DENIED', 'DEVICE_COMMAND']);
    // Every DEVICE_COMMAND row names a signed-in operator and a device of the Core.
    for (const row of commandRows(written)) {
      expect(ROLES.map(operatorId)).toContain(row.actorId);
      expect([...HARDWARE, ...PLATFORM] as string[]).toContain(row.deviceId);
      expect(['RESTART', 'TEST_SIGNAL', 'IDENTIFY']).toContain(row.details?.['command']);
    }
    const lines = server.log.lines();
    expect(lines.filter((line) => line['msg'] === 'audit head diverged')).toEqual([]);
    expect(lines.filter((line) => Number(line['level']) >= 50)).toEqual([]);
    console.info(`[w36] rows written by this file after boot and sign-in: ${JSON.stringify(byType)}; stored = committed; chain ok over ${(await readTrail(server.owner)).length} rows`);
  });
});

describe('restartDevice while a recording runs', () => {
  const SESSION_INPUT = {
    caseNumber: 'LP/2026/1001-0099',
    subjectType: 'SAKSI',
    subjectName: 'Test Subject',
    room: 'Interview Room 1',
    profileId: 'STANDARD_1080P25',
  } as const;

  let recording: DevicesApp;

  /** From idle to a running recording, through hosted commands of the engine only (the sessions routes are another row's). */
  beforeAll(async () => {
    const clone = await db.another({ template: 'seed', slug: 'w36_recording' });
    recording = await devicesApp({ runtime: clone.runtime, run: db.run, onCleanup: (close) => clone.onCleanup(close), ownerPool: () => clone.ownerPool() });
    const investigator = recording.principal('INVESTIGATOR');
    await recording.engine.setTabletLink('CONNECTED');
    const created = await recording.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
    expect(created.value).toMatchObject({ ok: true, created: true });
    await recording.engine.command(investigator, 'beginPrecheck');
    await recording.drive(5_000);
    if (recording.engine.slice('session')?.state === 'PRECHECK') await recording.engine.command(investigator, 'acknowledgePrecheckWarnings');
    expect(recording.engine.slice('session')?.state).toBe('ARMED');
    await recording.engine.command(investigator, 'startRecording');
    expect(recording.engine.slice('session')?.state).toBe('RECORDING');
    await recording.drive(1_000);
  });

  it('answers 409 RECORDING_ACTIVE with the simulator\'s code for every device that could be restarted, and changes nothing', async () => {
    const technician = recording.principal('TECHNICIAN').operatorId;
    const before = { rows: await recording.trailLength(), revision: recording.engine.revision, state: recording.engine.state() };
    for (const id of HARDWARE) {
      const response = await recording.post('TECHNICIAN', restart(id));
      expect(outcome(response), id).toEqual([409, 'RECORDING_ACTIVE']);
      expect(errorOf(response).details, id).toEqual({ simCode: 'RECORDING_ACTIVE', from: 'RECORDING', event: 'deviceCommand' });
      expect(validateCoreApiResponse('restartDevice', 409, response.json()), id).toEqual({ ok: true });
      expect(response.headers['x-dems-revision'], id).toBeUndefined();
      expect(response.headers['x-dems-epoch'], id).toBeUndefined();
    }
    await recording.app.pipeline.drain();
    // Nothing was written and nothing moved: no row names the TECHNICIAN, the session records on.
    expect({ rows: await recording.trailLength(), revision: recording.engine.revision }).toEqual({ rows: before.rows, revision: before.revision });
    expect(recording.engine.state()).toBe(before.state);
    expect((await recording.since(recording.rowsAtStart)).filter((row) => row.actorId === technician)).toEqual([]);
    expect(recording.engine.slice('session')?.state).toBe('RECORDING');
    // Nobody is left signed in on the engine after the refusals (ENG-7, AC-B-53).
    expect(recording.engine.simulator()?.store.getState().auth).toMatchObject({ status: 'SIGNED_OUT', operatorId: null });
    console.info('[w36] restartDevice during a recording: 409 RECORDING_ACTIVE, details { simCode: RECORDING_ACTIVE, from: RECORDING, event: deviceCommand }, for the eight D60/D61 sources, POE-SWITCH, REC-INDICATOR, TABLET; no row, no revision');
  });

  it('the order of the refusals is the hosted action\'s: an unknown device 404, a platform device 409 COMMAND_UNSUPPORTED, then 409 RECORDING_ACTIVE', async () => {
    expect(outcome(await recording.post('TECHNICIAN', restart('CAM-09')))).toEqual([404, 'NOT_FOUND']); // D60/D61 (2026-11-04): an id the Core does not hold
    for (const id of PLATFORM) {
      const response = await recording.post('TECHNICIAN', restart(id));
      expect(outcome(response), id).toEqual([409, 'COMMAND_UNSUPPORTED']);
      expect(errorOf(response).details, id).toEqual({ simCode: 'COMMAND_UNSUPPORTED', from: null, event: 'deviceCommand' });
    }
    expect(outcome(await recording.post('TECHNICIAN', restart('CAM-01')))).toEqual([409, 'RECORDING_ACTIVE']);
    // And who may call is decided before any of it: the SUPERVISOR gets the 403, with its row.
    const before = await recording.trailLength();
    expect(outcome(await recording.post('SUPERVISOR', restart('CAM-01')))).toEqual([403, 'NOT_PERMITTED']);
    expect((await recording.since(before)).filter((row) => row.type === 'ACCESS_DENIED')).toHaveLength(1);
  });

  it('a test signal and an identify are not refused by a recording: 204 and their rows, which carry no session ID', async () => {
    const before = await recording.trailLength();
    expect((await recording.post('INVESTIGATOR', testSignal('MIC-01'))).statusCode).toBe(204);
    expect((await recording.post('SUPERVISOR', identify('CAM-01'))).statusCode).toBe(204);
    expect((await recording.post('TECHNICIAN', identify('FRONT-PANEL'))).statusCode).toBe(204);
    const rows = (await recording.since(before)).filter((row) => row.type === 'DEVICE_COMMAND');
    expect(rows.map((row) => [row.deviceId, row.details?.['command'], row.sessionId])).toEqual([
      ['MIC-01', 'TEST_SIGNAL', null],
      ['CAM-01', 'IDENTIFY', null],
      ['FRONT-PANEL', 'IDENTIFY', null],
    ]);
    expect(recording.engine.slice('session')?.state).toBe('RECORDING');
  });

  it('the reads show the recording: all four tracks and all four channels REC, the system state RECORDING', async () => {
    const health = (await recording.get('INVESTIGATOR', HEALTH)).json() as { systemState: string };
    expect(health.systemState).toBe('RECORDING');
    expect((await recording.get('INVESTIGATOR', VIDEO)).json()).toMatchObject({ tracks: [{ recState: 'REC' }, { recState: 'REC' }, { recState: 'REC' }, { recState: 'REC' }] }); // D60 (2026-11-04): four tracks REC
    expect((await recording.get('INVESTIGATOR', AUDIO)).json()).toMatchObject({ channels: [{ recState: 'REC' }, { recState: 'REC' }, { recState: 'REC' }, { recState: 'REC' }] }); // D61: four channels REC
    expect(validateCoreApiResponse('getDeviceHealth', 200, health)).toEqual({ ok: true });
  });

  it('once the recording has stopped and the evidence is sealed, the restart is accepted again', async () => {
    const investigator = recording.principal('INVESTIGATOR');
    await recording.engine.command(investigator, 'stopRecording', 'Interview completed');
    await recording.drive(15_000, 250);
    expect(recording.engine.slice('session')?.state).toBe('SEALED');
    const before = await recording.trailLength();
    const response = await recording.post('TECHNICIAN', restart('CAM-01'));
    expect(response.statusCode).toBe(204);
    expect((await recording.since(before)).filter((row) => row.type === 'DEVICE_COMMAND').map((row) => [row.deviceId, row.details])).toEqual([['CAM-01', { command: 'RESTART' }]]);

    await recording.app.pipeline.drain();
    const rows = await readTrail(recording.owner);
    const head = await readHead(recording.owner);
    expect(linkProblems(rows)).toEqual([]);
    expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
    expect(recording.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
  });
});
