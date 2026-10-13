// THE LIVE PATH OF OPERATION 100 `confirmCaptureDeviceAddress` (task 4 blueprint row 197, M8 /
// WP-12; contract of row 194; the rule of row 97; the engine door of row 196), on ONE booted Core
// against PostgreSQL as `dems_app`, with the FAKE ONVIF DEVICE of the lane (the stub on loopback).
//
// THE SCENE. The stub is found by a search and added as a camera (operations 93 to 96): the Core
// stores its address and its endpoint reference. Then the camera "moves": as a FIXTURE the stored
// address is set to another one (192.168.50.20) through the engine's own door, so the row and the
// running engine agree on the old address. The next search lists the stub as THE REGISTERED CAMERA
// AT A CHANGED ADDRESS - and the Core follows nothing by itself.
//
//   NEVER AUTOMATIC   two searches that list the moved camera write no address and no entry
//   REFUSALS          each its named code, 0 audit entries of the type, the address unchanged:
//                     a candidate that is not the caller's (404), the destination rule (422: the
//                     PRODUCT's rule on injected facts refuses the loopback address of the stub),
//                     another address than the one shown (409), a device that is no camera of the
//                     registry (404), a role without the permission (403, the guard's one row),
//                     a body outside its schema (422)
//   CONFIRMED         with the test's permissive rule (AD-02 (2): a value under `test/`, the only
//                     way a loopback device can pass): 200, ONE `CAPTURE_DEVICE_ADDRESS_CHANGED`
//                     entry, the row and the engine's slice hold the new address, the statement
//                     the production camera adapter reads at EVERY open answers the new address,
//                     the credential row and the endpoint reference are untouched, and NOTHING was
//                     sent to the device
//   AGAIN             the same confirmation: 409 `READDRESS_ADDRESS_UNCHANGED`, still one entry
//   AFTER             the next search lists the camera as registered at its address
//   LOCKED            with a session open: 409 `CAPTURE_CONFIG_LOCKED`, nothing written
//
// NO SOCKET OUTSIDE LOOPBACK: the loopback guard is on for the whole file. No real camera, no real
// credential (the stub's account is made per run and is in no log line).
import type { LightMyRequestResponse } from 'fastify';
import type { CaptureDiscoveryStateBody } from '@dems/shared/api';
import { ROLE_PERMISSIONS, createManualClock } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { readTrail, verifyTrail, readHead } from '../../../../test/support/core';
import { FIXED_NOW, manualTimer } from '../../../../test/support/engine';
import { WEB_ORIGIN, signInOnWeb, type IdentityApp } from '../../../../test/support/identity';
import { prepareLaneCameraStub, type LaneCameraStub } from '../../../../test/support/lane-camera-stub';
import { loopbackDestination } from '../../../../test/support/loopback-destination';
import { buildApp } from '../../../app';
import { READ_STORED_CAMERA } from '../../../capture-composition';
import { installLoopbackGuard, type LoopbackGuard } from '../../../capture/adapters/camera/__tests__/support';
import { realBootFixture } from '../../../capture/boot/__tests__/support';
import type { DestinationContext } from '../../../capture/fence';
import { engineControl, readdressCaptureDeviceIn } from '../../../engine';
import type { Principal } from '../../../plugins/authenticate';
import { captureReaddressControl } from '../index';

const db = useTestDatabase({ template: 'seed' });
const fixture = realBootFixture('r197_readdress');
fixture.provisionKey();
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const DISCOVERY = '/api/v1/capture/discovery';
const CONFIRM = '/api/v1/capture/devices/address/confirm';
const OLD_ADDRESS = '192.168.50.20';
const CHANGED = 'CAPTURE_DEVICE_ADDRESS_CHANGED';
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The host facts the PRODUCT's rule is given in this file: a camera interface on 192.168.50.0/24. Synthetic. */
const HOST_FACTS: DestinationContext = {
  cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.50.1', alias: false }],
  otherInterfaceSubnets: [],
  hostAddresses: ['192.168.50.1'],
};

let app: ReturnType<typeof buildApp>;
let owner: Pool;
let log: CapturedLog;
let stub: LaneCameraStub;
let guard: LoopbackGuard;
let clock: ReturnType<typeof createManualClock>;
let technician: Record<string, string>;
let supervisor: Record<string, string>;
let investigator: Record<string, string>;
/** The camera the first case adds, the address the search shows for it, and the candidate of the technician's live search. */
let deviceId = '';
let shown = '';
let candidateId = '';

const post = (cookie: Record<string, string>, url: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> =>
  app.inject({ method: 'POST', url, headers: { ...cookie, origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload }) });
const read = async (cookie: Record<string, string>): Promise<CaptureDiscoveryStateBody> => (await app.inject({ method: 'GET', url: DISCOVERY, headers: cookie })).json<CaptureDiscoveryStateBody>();
/** One whole search of a session: the start, the real 3 s window, the audit row. */
async function search(cookie: Record<string, string>): Promise<CaptureDiscoveryStateBody> {
  clock.advance(130_000);
  const started = await post(cookie, DISCOVERY);
  expect(started.statusCode, started.body).toBe(202);
  await delay(3_400);
  for (let turn = 0; turn < 20; turn += 1) {
    await delay(10);
    await app.pipeline.drain();
  }
  return read(cookie);
}
const confirm = (cookie: Record<string, string>, body: Record<string, unknown>): Promise<LightMyRequestResponse> => post(cookie, CONFIRM, body);
const errorOf = (response: LightMyRequestResponse): { code: string; reason: string | null; message: string } => {
  const body = response.json<{ error: { code: string; message: string; details?: { reason?: string } } }>();
  return { code: body.error.code, reason: body.error.details?.reason ?? null, message: body.error.message };
};

interface Stored {
  readonly address: string | null;
  readonly sliceHost: string | null;
  readonly entries: number;
  readonly credentials: string;
  readonly uuid: string | null;
}
/** What a refusal must leave as it was: the row, the slice, the entries of the type, the credential rows, the endpoint reference. */
async function stored(): Promise<Stored> {
  await app.pipeline.drain();
  const { rows } = await owner.query<{ address: string | null; onvif_uuid: string | null }>('SELECT address, onvif_uuid FROM public.capture_devices WHERE id = $1', [deviceId]);
  const credentials = await owner.query<{ sum: string | null }>("SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS sum FROM public.capture_device_credentials t");
  return {
    address: rows[0]?.address ?? null,
    sliceHost: app.engine.slice('captureDevices').devices.find((entry) => entry.id === deviceId)?.host ?? null,
    entries: (await readTrail(owner)).filter((row) => row.type === CHANGED).length,
    credentials: credentials.rows[0]?.sum ?? '',
    uuid: rows[0]?.onvif_uuid ?? null,
  };
}
const denials = async (): Promise<number> => (await readTrail(owner)).filter((row) => row.type === 'ACCESS_DENIED').length;

beforeAll(async () => {
  guard = installLoopbackGuard();
  const target = await db.another({ template: 'seed', slug: 'r197_readdress' });
  owner = target.ownerPool();
  // No speech runtime on a test host (a real-capture boot resolves the stored selection first).
  await owner.query('UPDATE public.stt_config SET enabled = false');
  log = captureLog();
  app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, logLevel: 'info', captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: '/bin/echo', captureWorkerPath: fixture.worker('worker-r197', 'capture-worker/0.4.0') }),
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
  engineControl(app).useTimer(manualTimer().timer);
  await app.readiness.boot();
  await app.pipeline.drain();
  const identity = { app, cookieName: app.config.sessionCookieName } as unknown as IdentityApp;
  technician = (await signInOnWeb(identity, 'rina.wijaya')).cookie;
  supervisor = (await signInOnWeb(identity, 'andi.pratama')).cookie;
  investigator = (await signInOnWeb(identity, 'budi.santoso')).cookie;
});
afterAll(() => {
  fixture.remove();
  guard.restore();
});

describe('row 197: operation 100 on a booted Core with the fake ONVIF device', () => {
  it('SCENE: the stub is added as a camera; a registered camera that did not move cannot be re-addressed; then it "moves" and two searches follow nothing', async () => {
    const account = stub.account;
    if (account === null || stub.stub === null) throw new Error('the stub was not admitted');
    // Without a reader of the network facts every re-address is refused by the rule: said before anything else.
    expect(captureReaddressControl(app).factsProvided()).toBe(false);

    const first = await search(technician);
    const found = first.candidates[0];
    if (found === undefined) throw new Error('the search listed no candidate');
    expect([found.status, found.host]).toEqual(['NEW', '127.0.0.1']);
    clock.advance(30_000);
    const tested = await post(technician, `${DISCOVERY}/candidates/${found.candidateId}/test`, { credential: account });
    expect(tested.json<{ outcome: string }>().outcome, tested.body).toBe('REACHABLE');
    clock.advance(30_000);
    const adopted = await post(technician, `${DISCOVERY}/candidates/${found.candidateId}/adopt`, { credential: account });
    expect(adopted.statusCode, adopted.body).toBe(201);
    const adoption = adopted.json<{ deviceId: string; device: { host: string } }>();
    deviceId = adoption.deviceId;
    shown = adoption.device.host;
    expect(shown).toMatch(/^127\.0\.0\.1:\d+$/);
    const atAdoption = await stored();
    expect([atAdoption.address, atAdoption.sliceHost, atAdoption.entries]).toEqual([shown, shown, 0]);
    expect(atAdoption.uuid).not.toBeNull();

    // The registered camera at its stored address: no changed address, nothing to confirm (the answer of a development Core, by the contract).
    const unmoved = await confirm(technician, { deviceId, candidateId: found.candidateId, address: shown });
    expect(unmoved.statusCode, unmoved.body).toBe(409);
    expect(errorOf(unmoved)).toMatchObject({ code: 'INVALID_STATE', reason: 'READDRESS_NOT_THE_REGISTERED_CAMERA', message: 'The search did not find this camera at a new address.' });
    expect(await stored()).toEqual(atAdoption);

    // THE CAMERA "MOVES" (fixture): the stored address becomes another one, in the row and in the engine together.
    await app.engine.run('test.fixture.moved', async (scope) => {
      await readdressCaptureDeviceIn(scope, { deviceId, address: OLD_ADDRESS });
    });
    const moved = await stored();
    expect([moved.address, moved.sliceHost, moved.entries]).toEqual([OLD_ADDRESS, OLD_ADDRESS, 0]);

    // NEVER AUTOMATIC: two searches list the registered camera at a changed address and write nothing.
    for (const turn of [1, 2]) {
      const state = await search(technician);
      expect(state.candidates.map((candidate) => [candidate.status, candidate.deviceId, candidate.addressChanged, candidate.host]), `search ${turn}`).toEqual([['REGISTERED', deviceId, true, '127.0.0.1']]);
      candidateId = state.candidates[0]?.candidateId ?? '';
      expect(await stored(), `search ${turn}`).toEqual(moved);
    }
    expect(candidateId).not.toBe('');
  });

  it('REFUSALS: each answers its named code with 0 audit entries of the type and the address unchanged', async () => {
    const before = await stored();
    expect([before.address, before.entries]).toEqual([OLD_ADDRESS, 0]);
    const body = { deviceId, candidateId, address: shown };
    const sentBefore = stub.stub?.requestLog().length ?? -1;

    // (a) NO NETWORK FACTS WERE HANDED IN: fail-closed, the rule refuses (422), whatever the address.
    const unconfigured = await confirm(technician, body);
    expect(unconfigured.statusCode, unconfigured.body).toBe(422);
    expect(errorOf(unconfigured)).toEqual({ code: 'INVALID_INPUT', reason: 'DISCOVERY_ADDRESS_NOT_ALLOWED', message: 'This address is not allowed for a camera.' });
    expect(await stored()).toEqual(before);

    // (b) THE PRODUCT'S RULE ON INJECTED FACTS: the stub answers from loopback, which the rule refuses on any facts.
    const control = captureReaddressControl(app);
    control.provideNetworkFacts(() => HOST_FACTS);
    expect(control.factsProvided()).toBe(true);
    expect(() => control.provideNetworkFacts(() => HOST_FACTS)).toThrow('handed in already');
    const ruled = await confirm(technician, body);
    expect(ruled.statusCode, ruled.body).toBe(422);
    expect(errorOf(ruled)).toEqual({ code: 'INVALID_INPUT', reason: 'DISCOVERY_ADDRESS_NOT_ALLOWED', message: 'This address is not allowed for a camera.' });
    // One sentence, never the address, never the rule's own word.
    expect(ruled.body).not.toContain('127.0.0.1');
    expect(ruled.body).not.toMatch(/LOOPBACK|NOT_CONFIGURED|SUBNET/);
    expect(await stored()).toEqual(before);

    // From here the rule is the test's permissive one: every refusal below is NOT the rule's.
    control.replaceForTest({ addressRule: (host, port) => loopbackDestination(host, port ?? 80) });

    // (c) A CANDIDATE THAT IS NOT THE CALLER'S: the supervisor holds CAPTURE_CONFIG and names the technician's candidate.
    const notOwn = await confirm(supervisor, body);
    expect(notOwn.statusCode, notOwn.body).toBe(404);
    expect(errorOf(notOwn)).toEqual({ code: 'NOT_FOUND', reason: null, message: 'No camera or candidate has this ID.' });
    expect(await stored()).toEqual(before);
    // ... and an id no search made: the same answer.
    const unknown = await confirm(technician, { ...body, candidateId: `${candidateId.slice(0, -4)}${candidateId.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA'}` });
    expect([unknown.statusCode, errorOf(unknown).code], unknown.body).toEqual([404, 'NOT_FOUND']);

    // (d) ANOTHER ADDRESS THAN THE ONE THE SEARCH SHOWS: the body is a confirmation, not a target.
    for (const address of ['127.0.0.1', '192.168.50.41', `127.0.0.1:${Number(shown.split(':')[1]) === 65_535 ? 65_534 : Number(shown.split(':')[1]) + 1}`]) {
      const mismatch = await confirm(technician, { ...body, address });
      expect(mismatch.statusCode, mismatch.body).toBe(409);
      expect(errorOf(mismatch)).toMatchObject({ code: 'INVALID_STATE', reason: 'READDRESS_CONFIRMATION_MISMATCH' });
    }
    expect(await stored()).toEqual(before);

    // (e) A DEVICE THAT IS NO CAMERA OF THE REGISTRY (404, the answer of an unknown candidate); another camera than the candidate's (409).
    const noDevice = await confirm(technician, { ...body, deviceId: 'CAM-99' });
    expect([noDevice.statusCode, errorOf(noDevice).code], noDevice.body).toEqual([404, 'NOT_FOUND']);
    const otherCamera = await confirm(technician, { ...body, deviceId: 'CAM-01' });
    expect([otherCamera.statusCode, errorOf(otherCamera).reason], otherCamera.body).toEqual([409, 'READDRESS_NOT_THE_REGISTERED_CAMERA']);
    expect(app.engine.slice('captureDevices').devices.find((entry) => entry.id === 'CAM-01')?.host).toBe('127.0.0.1:8554');

    // (f) THE BODY (stage 7): a microphone id, a name, a URL, a member too many, a member missing.
    for (const bad of [{ ...body, deviceId: 'MIC-01' }, { ...body, address: 'camera.local' }, { ...body, address: 'http://127.0.0.1/' }, { ...body, address: '127.0.0.1/24' }, { ...body, force: true }, { deviceId, candidateId }]) {
      const invalid = await confirm(technician, bad);
      expect([invalid.statusCode, errorOf(invalid).code], JSON.stringify(Object.keys(bad))).toEqual([422, 'INVALID_INPUT']);
    }
    expect(await stored()).toEqual(before);

    // (g) RBAC: a role without CAPTURE_CONFIG is refused by the guard with its ONE row; nobody signed in: 401.
    const deniedBefore = await denials();
    const denied = await confirm(investigator, body);
    expect([denied.statusCode, errorOf(denied).code], denied.body).toEqual([403, 'NOT_PERMITTED']);
    await app.pipeline.drain();
    expect(await denials()).toBe(deniedBefore + 1);
    const anonymous = await confirm({}, body);
    expect(anonymous.statusCode, anonymous.body).toBe(401);
    expect(await stored()).toEqual(before);

    // Nothing was sent to the device by any of these requests.
    expect(stub.stub?.requestLog().length).toBe(sentBefore);
  });

  it('CONFIRMED: ONE audit entry, the row and the slice hold the new address, the next open reads it, the credential stays, nothing is sent; AGAIN: unchanged, still one entry', async () => {
    const before = await stored();
    const head = await readHead(owner);
    const sentBefore = stub.stub?.requestLog().length ?? -1;
    const connectionsBefore = guard.connections().length;
    const datagramsBefore = guard.datagrams().length;
    const revision = app.engine.revision;
    // What the production camera adapter's reader answers before: the camera at the OLD address.
    expect((await owner.query<{ address: string }>(READ_STORED_CAMERA, [deviceId])).rows.map((row) => row.address)).toEqual([OLD_ADDRESS]);

    const confirmed = await confirm(technician, { deviceId, candidateId, address: shown });
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    const answer = confirmed.json<{ deviceId: string; device: { id: string; host: string; kind: string } }>();
    expect(answer).toMatchObject({ deviceId, device: { id: deviceId, kind: 'CAMERA', host: shown } });
    // No credential, no endpoint reference in the answer.
    expect(confirmed.body).not.toContain(stub.account?.secret ?? 'no account');
    expect(confirmed.body).not.toContain(before.uuid ?? 'no reference');

    const after = await stored();
    // THE ROW AND THE SLICE, TOGETHER; the credential rows and the endpoint reference as they were.
    expect(after).toEqual({ address: shown, sliceHost: shown, entries: 1, credentials: before.credentials, uuid: before.uuid });
    expect(app.engine.revision).toBe(revision + 1);

    // EXACTLY ONE ENTRY, the operator's, with the two IP literals and the code for why - no port, no reference.
    const trail = await readTrail(owner);
    const written = trail.filter((row) => row.seq > head.seq);
    expect(written.map((row) => row.type)).toEqual([CHANGED]);
    expect(written[0]).toMatchObject({
      type: CHANGED,
      actorId: 'OPR-003',
      deviceId,
      details: { deviceId, fromAddress: OLD_ADDRESS, toAddress: '127.0.0.1', reason: 'OPERATOR_CONFIRMED', operationId: 'confirmCaptureDeviceAddress', permission: 'CAPTURE_CONFIG' },
    });
    expect(Object.keys(written[0]?.details ?? {}).sort()).toEqual(['deviceId', 'fromAddress', 'operationId', 'permission', 'reason', 'toAddress']);
    expect(verifyTrail(trail, await readHead(owner))).toMatchObject({ ok: true });

    // THE NEXT OPEN OF THAT CAMERA USES THE NEW ADDRESS: the statement the production camera adapter's reader runs
    // at every open (`READ_STORED_CAMERA` of the composition) answers it, with the same endpoint reference.
    expect((await owner.query<{ address: string; endpointRef: string }>(READ_STORED_CAMERA, [deviceId])).rows).toMatchObject([{ address: shown, endpointRef: before.uuid }]);

    // NOTHING WAS SENT: no request reached the device, no datagram and no connection left the Core.
    expect(stub.stub?.requestLog().length).toBe(sentBefore);
    expect(guard.connections().length).toBe(connectionsBefore);
    expect(guard.datagrams().length).toBe(datagramsBefore);

    // AGAIN, the same confirmation (the dialog was submitted twice): the address is the stored one, still one entry.
    const again = await confirm(technician, { deviceId, candidateId, address: shown });
    expect(again.statusCode, again.body).toBe(409);
    expect(errorOf(again)).toEqual({ code: 'INVALID_STATE', reason: 'READDRESS_ADDRESS_UNCHANGED', message: 'The camera already has this address.' });
    expect(await stored()).toEqual(after);

    // AFTER: the next search lists the camera as registered where it is.
    const next = await search(technician);
    expect(next.candidates.map((candidate) => [candidate.status, candidate.deviceId, candidate.addressChanged === true])).toEqual([['REGISTERED', deviceId, false]]);
    expect(await stored()).toEqual(after);

    // No log line of the Core carries the old address, the endpoint reference or the stub's account.
    expect(log.text()).not.toContain(OLD_ADDRESS);
    expect(log.text()).not.toContain(before.uuid ?? 'no reference');
    expect(log.text()).not.toContain(stub.account?.secret ?? 'no account');
    expect(log.text()).toContain('camera address changed by an operator');
    expect(guard.refused()).toEqual([]);
  });

  it('LOCKED: while a session is open the operation answers 409 CAPTURE_CONFIG_LOCKED and writes nothing - no camera of an open session is re-addressed', async () => {
    // The camera "moves" once more and the search lists it, so that only the lock stands between the request and a write.
    await app.engine.run('test.fixture.moved.again', async (scope) => {
      await readdressCaptureDeviceIn(scope, { deviceId, address: OLD_ADDRESS });
    });
    const state = await search(technician);
    expect(state.candidates.map((candidate) => [candidate.status, candidate.addressChanged])).toEqual([['REGISTERED', true]]);
    const candidate = state.candidates[0]?.candidateId ?? '';

    const operator = app.engine.slice('operators').find((entry) => entry.role === 'INVESTIGATOR');
    if (operator === undefined) throw new Error('the seed holds no investigator');
    const principal: Extract<Principal, { kind: 'OPERATOR' }> = { kind: 'OPERATOR', operatorId: operator.id, sessionId: 'test-session', deviceId: null, role: 'INVESTIGATOR', permissions: ROLE_PERMISSIONS.INVESTIGATOR };
    const engine = engineControl(app);
    await engine.setTabletLink('CONNECTED');
    await engine.command(principal, 'createSession', { caseNumber: 'LP/2026/1001-0197', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: operator.id });
    expect(app.engine.slice('session')).not.toBeNull();

    const before = await stored();
    const lockedOut = await confirm(technician, { deviceId, candidateId: candidate, address: shown });
    expect(lockedOut.statusCode, lockedOut.body).toBe(409);
    expect(errorOf(lockedOut)).toEqual({ code: 'CAPTURE_CONFIG_LOCKED', reason: null, message: 'The capture configuration cannot be changed while a session is open.' });
    expect(await stored()).toEqual(before);
    expect(before.address).toBe(OLD_ADDRESS);
  });
});
