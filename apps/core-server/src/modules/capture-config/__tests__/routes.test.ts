// Operations 76 to 80 without a database (blueprint row 66 / M4-W2; contract C3 §2.2 to §2.4, §4,
// §6; checks M4-LOCK-1 and the server half of M4-SEL-W/T/P).
//
// The real app factory, the REAL access rule (stage 6) and, behind the seam `engine`, a stand-in
// that runs a unit on a real shared simulator (`support.ts`). What is STORED and PUBLISHED is the
// database test's (`capture-config.db.test.ts`); this file holds the route list, the order of the
// refusals, the lock, and the seam of the adapter registry.
import { CAPTURE_CONFIG_CHANGE_OPERATIONS, CAPTURE_CONFIG_OPERATIONS, CoreApiAccessKind, CoreApiAuditNone, SIM_ACTION_OPERATIONS, matchCoreApiOperation, validateCoreApiResponse } from '@dems/shared/api';
import { SessionState } from '@dems/shared/domain';
import { CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS, CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { detailRulesOf, type DetailRule } from '../../../core/audit-details';
import { WEB_ORIGIN } from '../../../../test/support/identity';
import { CaptureOperation, createFakeRegistry, type CaptureDeviceRegistry, CaptureAdapterRefusal } from '../../../capture/adapters';
import { hostedActionsOfOperation } from '../../../engine/hosted-actions';
import { permissionGuard, routePatternOf } from '../../../plugins/permission-guard';
import { bodyOf, errorOf, operatorOf, outcome, signature } from '../../devices/__tests__/support';
import { CAPTURE_CONFIG_MODULE_OPERATIONS, captureConfigControl, captureConfigOperation, CaptureAssignmentRefusal, DEVELOPMENT_SOURCE_NOT_ALLOWED, captureAssignmentRefusalOf } from '../index';
import { CONFIG, CREDENTIAL, DEVICES, cameraSource, primaryMic, selectorUnitApp, type SelectorUnitApp } from './support';
import { CaptureProfileRefusal, PROFILE_WITHOUT_STREAM_REASON, PROFILE_WITHOUT_STREAM_TEXT, ownProfileFindingOf } from '../routes';
import { READ_CAMERA_STREAM_PROFILES, readCameraStreamProfiles } from '../store';

const apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

async function build(...parameters: Parameters<typeof selectorUnitApp>): Promise<SelectorUnitApp> {
  const built = await selectorUnitApp(...parameters);
  apps.push(built.app);
  return built;
}

const get = (built: SelectorUnitApp, url: string): Promise<LightMyRequestResponse> => built.app.inject({ method: 'GET', url });
const post = (built: SelectorUnitApp, url: string, payload?: object | string): Promise<LightMyRequestResponse> =>
  built.app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload }) });

interface Selector {
  cameras: { trackId: string; deviceId: string; profile: string }[];
  // D61 (2026-11-04): the selector plane's mic lines are keyed by the numbered CHANNEL; the two-role lane survives only on SWITCH_AUDIO_SOURCE.to, telemetry and interval records.
  mics: { channel: string; inputId: string; deviceId: string }[];
  locked: boolean;
  updatedAt: number;
}
const selectorOf = (response: LightMyRequestResponse): Selector => response.json() as Selector;
const changes = (built: SelectorUnitApp) => built.engine.state().audit.rows.filter((row) => row.type === 'CAPTURE_CONFIG_CHANGED');

describe('MODG: the route list of the module', () => {
  it('registers operations 76 to 80 with the method, the path and the operation ID of the registry, and nothing else under /capture', async () => {
    const { registered } = await build();
    // Since decision D114 two more units register routes under `/capture`: the camera search
    // (`modules/capture-discovery`, operations 93 and 94) and the local inputs (`modules/capture-inputs`,
    // operation 97). They are named here, so that anything ELSE under `/capture` still fails this test.
    const OTHER_UNITS = ['POST /api/v1/capture/discovery startCaptureDiscovery', 'GET /api/v1/capture/discovery getCaptureDiscovery', 'POST /api/v1/capture/inputs/rescan rescanCaptureInputs',
      // Row 142's connect routes, mounted by `modules/capture-discovery` (operations 95, 96 and 89).
      'POST /api/v1/capture/discovery/candidates/:id/test testCaptureCandidateConnection',
      'POST /api/v1/capture/discovery/candidates/:id/adopt adoptCaptureCandidate',
      'POST /api/v1/capture/devices/:id/credential setCaptureDeviceCredential',
      // Task 4 row 197: the confirmed re-address, mounted by `modules/capture-discovery` (operation 100; `readdress-route.ts`).
      'POST /api/v1/capture/devices/address/confirm confirmCaptureDeviceAddress',
      // Task 4 row 70: the sound-card routes, mounted by `modules/capture-inputs` from its sub-folder `audio-cards` (operations 98 and 99).
      'POST /api/v1/capture/audio-cards/search searchCaptureAudioCards',
      'POST /api/v1/capture/audio-cards/inputs registerCaptureAudioInput',
      // Task 4 row 108: the camera network configuration, mounted by THIS module from its sub-folder `network` (operations 101 and 102;
      // another list of the registry, `CAPTURE_COMMISSIONING_OPERATIONS`). Named here, so that the selector's own list below stays the five.
      'GET /api/v1/capture/network/config getCaptureNetworkConfig',
      'POST /api/v1/capture/network/config updateCaptureNetworkConfig',
      // Task 4 row 107: the commissioning scan, mounted by THIS module from its sub-folder `factory-scan` (operation 103).
      'POST /api/v1/capture/network/scan scanFactoryCameras',
      // Task 4 row 106b: the alias state and its removal, mounted by THIS module from its sub-folder `host-alias` (operations 104 and 105).
      'GET /api/v1/capture/network/alias getHostAlias',
      'POST /api/v1/capture/network/alias/remove removeHostAlias',
      // Task 4 row 111: the set-IP job and its state, mounted by THIS module from its sub-folder `camera-network` (operations 106 and 107).
      'POST /api/v1/capture/network/cameras/address setCameraNetwork',
      'GET /api/v1/capture/network/jobs/:id getCameraNetworkJob',
      // Task 4 row 146b: the stored-credential connection test, mounted by `modules/capture-discovery` (operation 108; `adopted-test-route.ts`).
      'POST /api/v1/capture/devices/:id/test testCaptureDeviceConnection',
      // The live-preview session and the idle microphone-meter lease (bench rows of 2026-11-03/04): mounted by their own modules under /capture.
      'POST /api/v1/capture/devices/:id/preview-sessions createCameraPreviewSession',
      'POST /api/v1/capture/idle-meters/lease holdIdleMeters',
    ];
    const under = registered.filter((route) => route.url.startsWith('/api/v1/capture/')).map((route) => signature(String(route.method), route.url, String(route.config?.operationId)));
    expect(under.filter((route) => OTHER_UNITS.includes(route)).sort()).toEqual([...OTHER_UNITS].sort());
    const own = registered.filter((route) => route.url.startsWith('/api/v1/capture/') && !OTHER_UNITS.includes(signature(String(route.method), route.url, String(route.config?.operationId))));
    const fromModule = own.map((route) => signature(String(route.method), route.url, String(route.config?.operationId)));
    expect(fromModule).toEqual([
      'GET /api/v1/capture/config getCaptureConfig',
      'GET /api/v1/capture/devices getCaptureDevices',
      'POST /api/v1/capture/config updateCaptureConfig',
      'POST /api/v1/capture/cameras/:id/source setCaptureCameraSource',
      'POST /api/v1/capture/mics/:id/primary setPrimaryMic',
    ]);
    expect(fromModule).toEqual(CAPTURE_CONFIG_MODULE_OPERATIONS.map((operationId) => captureConfigOperation(operationId)).map((operation) => signature(operation.method, routePatternOf(operation.path), operation.operationId)));
    // The registry's own list of the selector operations is these five. The credential write
    // (operation 89) is another list of the registry and is NOT registered by this row.
    expect(CAPTURE_CONFIG_OPERATIONS.map((operation) => operation.operationId)).toEqual([...CAPTURE_CONFIG_MODULE_OPERATIONS]);
    for (const route of own) {
      for (const hook of [route.onRequest, route.preParsing, route.preValidation, route.preHandler]) expect(hook, route.url).toBeUndefined();
      expect(Object.keys(route.config ?? {}), route.url).toEqual(['operationId']);
    }
  });

  it('each route is the registry\'s, the guard holds the registry\'s rule for it, and the three edits are the operations of the hosted action', async () => {
    const { app } = await build();
    const rules = permissionGuard(app).registeredRules();
    const rule = (operationId: string) => rules.find((candidate) => candidate.operationId === operationId);
    expect(CAPTURE_CONFIG_MODULE_OPERATIONS.map((operationId) => [operationId, rule(operationId)?.kind, rule(operationId)?.permissions])).toEqual([
      ['getCaptureConfig', CoreApiAccessKind.AUTHENTICATED, []],
      ['getCaptureDevices', CoreApiAccessKind.AUTHENTICATED, []],
      ['updateCaptureConfig', CoreApiAccessKind.PERMISSION, ['CAPTURE_CONFIG']],
      ['setCaptureCameraSource', CoreApiAccessKind.PERMISSION, ['CAPTURE_CONFIG']],
      ['setPrimaryMic', CoreApiAccessKind.PERMISSION, ['CAPTURE_CONFIG']],
    ]);
    expect(CAPTURE_CONFIG_MODULE_OPERATIONS.map((operationId) => captureConfigOperation(operationId)).map((operation) => [operation.audit.success, operation.audit.denial])).toEqual([
      [CoreApiAuditNone.READ, 'ACCESS_DENIED'],
      [CoreApiAuditNone.READ, 'ACCESS_DENIED'],
      ['CAPTURE_CONFIG_CHANGED', 'ACCESS_DENIED'],
      ['CAPTURE_CONFIG_CHANGED', 'ACCESS_DENIED'],
      ['CAPTURE_CONFIG_CHANGED', 'ACCESS_DENIED'],
    ]);
    for (const operationId of CAPTURE_CONFIG_MODULE_OPERATIONS) {
      const operation = captureConfigOperation(operationId);
      expect(matchCoreApiOperation(operation.method.toUpperCase(), operation.path.replace('{id}', 'CAM-01'))?.operation.operationId).toBe(operationId);
    }
    // The hosted pair is reachable only as the contract says: `setCaptureConfig` through 78, 79 and
    // 80, `switchAudioSource` through 81 (registered with its session rules by M5), the reads by none.
    expect(Object.values(CAPTURE_CONFIG_CHANGE_OPERATIONS)).toEqual([...SIM_ACTION_OPERATIONS.setCaptureConfig.operations]);
    for (const operationId of SIM_ACTION_OPERATIONS.setCaptureConfig.operations) expect(hostedActionsOfOperation(operationId)).toEqual(['setCaptureConfig']);
    expect(hostedActionsOfOperation('switchAudioSource')).toEqual(['switchAudioSource']);
    expect([hostedActionsOfOperation('getCaptureConfig'), hostedActionsOfOperation('getCaptureDevices'), hostedActionsOfOperation('setCaptureDeviceCredential')]).toEqual([[], [], []]);
    // Operation 81 is routed since wave D (row 71b, the sessions module): a route of the app, no
    // operation of this module. (Until then this line held that the route did not exist yet.)
    expect(app.hasRoute({ method: 'POST', url: '/api/v1/session/:id/audio-source' })).toBe(true);
    expect((CAPTURE_CONFIG_MODULE_OPERATIONS as readonly string[]).includes('switchAudioSource')).toBe(false);
    // The credential write (operation 89) is routed since row 142, by `modules/capture-discovery`:
    // it is a route of the app and no operation of this module.
    expect(app.hasRoute({ method: 'POST', url: '/api/v1/capture/devices/:id/credential' })).toBe(true);
    expect((CAPTURE_CONFIG_MODULE_OPERATIONS as readonly string[]).includes('setCaptureDeviceCredential')).toBe(false);
  });
});

describe('operations 76 and 77: the reads', () => {
  it('every role reads the two slices; the answers are the contract\'s and hold nothing that reads like a credential', async () => {
    const built = await build();
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) {
      built.actAs(operatorOf(role));
      const config = await get(built, CONFIG);
      const devices = await get(built, DEVICES);
      expect([config.statusCode, devices.statusCode], role).toEqual([200, 200]);
      expect(validateCoreApiResponse('getCaptureConfig', 200, bodyOf(config)), role).toEqual({ ok: true });
      expect(validateCoreApiResponse('getCaptureDevices', 200, bodyOf(devices)), role).toEqual({ ok: true });
      expect(selectorOf(config)).toMatchObject({ locked: false, cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }, { trackId: 'VIDEO-03', deviceId: 'CAM-03' }, { trackId: 'VIDEO-04', deviceId: 'CAM-04' }], mics: [{ inputId: 'MIC-01', channel: 'MIC-01' }, { inputId: 'MIC-02', channel: 'MIC-02' }, { inputId: 'MIC-03', channel: 'MIC-03' }, { inputId: 'MIC-04', channel: 'MIC-04' }] }); // D60: four built-in cameras; D61 (2026-11-04): four numbered microphone channels
      expect((devices.json() as { devices: { id: string }[] }).devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'POE-SWITCH']); // D60: four cameras; D61 (2026-11-04): NINE built-ins - four numbered microphones and the switch
      expect(`${config.body}${devices.body}`).not.toMatch(/secret|password|username|credential|rtsp:\/\/[^"]*@/i);
    }
    expect(built.engine.units).toEqual([]);
    expect(built.engine.commands).toEqual([]);
    // Nobody signed in: stage 6 refuses before a handler.
    built.actAs({ kind: 'ANONYMOUS', retiredDeviceId: null });
    expect(outcome(await get(built, CONFIG))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcome(await get(built, DEVICES))).toEqual([401, 'NOT_SIGNED_IN']);
  });

  it('M4-LOCK-1, the read half: while a session is open the reads answer, and the selector says `locked: true`', async () => {
    const built = await build('recording');
    built.actAs(operatorOf('INVESTIGATOR'));
    const config = await get(built, CONFIG);
    expect(config.statusCode).toBe(200);
    expect(selectorOf(config).locked).toBe(true);
    expect(validateCoreApiResponse('getCaptureConfig', 200, bodyOf(config))).toEqual({ ok: true });
    expect((await get(built, DEVICES)).statusCode).toBe(200);
    // The stored slice never holds the lock: it is computed per answer.
    expect(built.engine.state().captureConfig.locked).toBe(false);
  });

  it('AC-B-70 (generalized by D61): a selector the stored row read back with the transcribed channel LAST is answered in input order; the engine\'s slice is not touched', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const held = built.engine.state().captureConfig;
    const reversed = [...held.mics].reverse(); // D61 (2026-11-04): the channel is a member of the line - the order test needs no key rewrite
    built.engine.sim.store.setState({ captureConfig: { ...held, mics: reversed } });
    const config = await get(built, CONFIG);
    expect(selectorOf(config).mics.map((mic) => [mic.inputId, mic.channel])).toEqual([
      ['MIC-01', 'MIC-01'],
      ['MIC-02', 'MIC-02'],
      ['MIC-03', 'MIC-03'],
      ['MIC-04', 'MIC-04'],
    ]);
    expect(built.engine.state().captureConfig.mics).toBe(reversed);
    // An edit that changes nothing answers in the same order and writes nothing: channel 1 already holds MIC-01.
    const same = await post(built, primaryMic('MIC-01'));
    expect(selectorOf(same).mics.map((mic) => mic.inputId)).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']);
    expect(changes(built)).toEqual([]);
  });

  it('an engine that is not running is 503 NOT_READY on every operation of the module', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    built.engine.running = false;
    expect(outcome(await get(built, CONFIG))).toEqual([503, 'NOT_READY']);
    expect(outcome(await get(built, DEVICES))).toEqual([503, 'NOT_READY']);
    expect(outcome(await post(built, primaryMic('MIC-02')))).toEqual([503, 'NOT_READY']);
    expect(outcome(await post(built, cameraSource('CAM-01'), { trackId: 'VIDEO-01' }))).toEqual([503, 'NOT_READY']);
    expect(outcome(await post(built, CONFIG, { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] }))).toEqual([503, 'NOT_READY']);
  });
});

describe('operations 78, 79, 80: an edit is one unit of the engine with the hosted action setCaptureConfig', () => {
  it.each(['TECHNICIAN'] as const)('%s edits: the answer is the new selector, one audited row per changed line, the caller is the actor', async (role) => {
    const built = await build();
    const principal = operatorOf(role);
    built.actAs(principal);

    const primary = await post(built, primaryMic('MIC-02'));
    expect(primary.statusCode).toBe(200);
    expect(validateCoreApiResponse('setPrimaryMic', 200, bodyOf(primary))).toEqual({ ok: true });
    // AC-B-70 (generalized by D61, 2026-11-04): the mic inputs are listed in input order, whichever numbered channel each fills; setPrimaryMic(MIC-02) moves it onto channel MIC-01 and displaces MIC-01 to channel MIC-02.
    expect(selectorOf(primary).mics.map((mic) => [mic.inputId, mic.channel])).toEqual([
      ['MIC-01', 'MIC-02'],
      ['MIC-02', 'MIC-01'],
      ['MIC-03', 'MIC-03'],
      ['MIC-04', 'MIC-04'],
    ]);
    expect(selectorOf(primary).locked).toBe(false);

    const swapped = await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] });
    expect(swapped.statusCode).toBe(200);
    expect(validateCoreApiResponse('updateCaptureConfig', 200, bodyOf(swapped))).toEqual({ ok: true });
    expect(selectorOf(swapped).cameras.map((camera) => [camera.trackId, camera.deviceId])).toEqual([
      ['VIDEO-01', 'CAM-02'],
      ['VIDEO-02', 'CAM-01'],
      // D60 (2026-11-04): the two further lines are untouched by this body and keep their built-ins.
      ['VIDEO-03', 'CAM-03'],
      ['VIDEO-04', 'CAM-04'],
    ]);

    // One camera on both tracks needs two profiles (OD-05): 79 alone is refused here, 78 can say it.
    expect(outcome(await post(built, cameraSource('CAM-01'), { trackId: 'VIDEO-01' }))).toEqual([422, 'INVALID_INPUT']);
    const dual = await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_720P25' }] });
    expect(dual.statusCode).toBe(200);
    const back = await post(built, cameraSource('CAM-02'), { trackId: 'VIDEO-02' });
    expect(back.statusCode).toBe(200);
    expect(validateCoreApiResponse('setCaptureCameraSource', 200, bodyOf(back))).toEqual({ ok: true });

    const rows = changes(built);
    expect(rows.map((row) => [row.actorId, row.details?.['operationId'], row.details?.['scope'], row.details?.['field'], row.details?.['from'], row.details?.['to'], row.details?.['permission']])).toEqual([
      [principal.kind === 'OPERATOR' ? principal.operatorId : null, 'setPrimaryMic', 'MIC', 'CHANNEL', 'MIC-02', 'MIC-01', 'CAPTURE_CONFIG'], // D61 (2026-11-04): the operation moved the transcribed channel
      [principal.kind === 'OPERATOR' ? principal.operatorId : null, 'updateCaptureConfig', 'CAMERA', 'SOURCE', 'CAM-01', 'CAM-02', 'CAPTURE_CONFIG'],
      [principal.kind === 'OPERATOR' ? principal.operatorId : null, 'updateCaptureConfig', 'CAMERA', 'SOURCE', 'CAM-02', 'CAM-01', 'CAPTURE_CONFIG'],
      [principal.kind === 'OPERATOR' ? principal.operatorId : null, 'updateCaptureConfig', 'CAMERA', 'SOURCE', 'CAM-02', 'CAM-01', 'CAPTURE_CONFIG'],
      [principal.kind === 'OPERATOR' ? principal.operatorId : null, 'setCaptureCameraSource', 'CAMERA', 'SOURCE', 'CAM-01', 'CAM-02', 'CAPTURE_CONFIG'],
    ]);
    // One unit per request, one hosted action per unit that reached it, always `setCaptureConfig`.
    expect(built.engine.units).toEqual(['captureConfig.setPrimaryMic', 'captureConfig.updateCaptureConfig', 'captureConfig.setCaptureCameraSource', 'captureConfig.updateCaptureConfig', 'captureConfig.setCaptureCameraSource']);
    expect(built.engine.commands.map((command) => command.action)).toEqual(Array.from({ length: 5 }, () => 'setCaptureConfig'));
    // Between two commands nobody is signed in on the engine (the actor scope).
    expect(built.engine.state().auth.operatorId).toBeNull();
    // The read after the edits is the selector the last edit answered.
    expect(selectorOf(await get(built, CONFIG))).toEqual(selectorOf(back));
  });

  it('D30 K-6 (row 155): a two-line mic swap by operation 78 writes exactly ONE CHANNEL row - the row operation 80 writes on the same selector; the transports stay with their inputs; a single line keeps its SOURCE row', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const before = built.engine.state().captureConfig.mics;
    const transportOf = (mics: typeof before, inputId: string) => mics.find((mic) => mic.inputId === inputId)?.transport;
    // The contract's `swap` example: channels MIC-01 and MIC-02 trade their two microphones.
    const swapped = await post(built, CONFIG, { mics: [{ channel: 'MIC-01', inputId: 'MIC-02', deviceId: 'MIC-02' }, { channel: 'MIC-02', inputId: 'MIC-01', deviceId: 'MIC-01' }] });
    expect(swapped.statusCode, swapped.body).toBe(200);
    expect(validateCoreApiResponse('updateCaptureConfig', 200, bodyOf(swapped))).toEqual({ ok: true });
    expect(selectorOf(swapped).mics.map((mic) => [mic.inputId, mic.channel])).toEqual([
      ['MIC-01', 'MIC-02'],
      ['MIC-02', 'MIC-01'],
      ['MIC-03', 'MIC-03'],
      ['MIC-04', 'MIC-04'],
    ]);
    const after = built.engine.state().captureConfig.mics;
    for (const inputId of ['MIC-01', 'MIC-02']) expect(transportOf(after, inputId), inputId).toBe(transportOf(before, inputId));
    expect(changes(built).map((row) => row.details)).toEqual([
      { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'CHANNEL', inputId: 'MIC-02', deviceId: 'MIC-02', from: 'MIC-02', to: 'MIC-01', permission: 'CAPTURE_CONFIG' },
    ]);
    // PARITY with operation 80 on a fresh Core: the same selector, the same details but the operation id.
    const primary = await build();
    primary.actAs(operatorOf('TECHNICIAN'));
    expect((await post(primary, primaryMic('MIC-02'))).statusCode).toBe(200);
    expect(primary.engine.state().captureConfig.mics).toEqual(after);
    const { operationId: primaryOperation, ...primaryDetails } = changes(primary)[0]?.details ?? {};
    const { operationId: swapOperation, ...swapDetails } = changes(built)[0]?.details ?? {};
    expect([primaryOperation, swapOperation]).toEqual(['setPrimaryMic', 'updateCaptureConfig']);
    expect(swapDetails).toEqual(primaryDetails);
    // CONTROL - swapping back is again one CHANNEL row; a single line by channel is still refused when it names a held microphone, and nothing is written.
    expect((await post(built, CONFIG, { mics: [{ channel: 'MIC-01', inputId: 'MIC-01', deviceId: 'MIC-01' }, { channel: 'MIC-02', inputId: 'MIC-02', deviceId: 'MIC-02' }] })).statusCode).toBe(200);
    expect(changes(built).map((row) => [row.details?.['field'], row.details?.['inputId'], row.details?.['from'], row.details?.['to']])).toEqual([
      ['CHANNEL', 'MIC-02', 'MIC-02', 'MIC-01'],
      ['CHANNEL', 'MIC-01', 'MIC-02', 'MIC-01'],
    ]);
    expect(outcome(await post(built, CONFIG, { mics: [{ channel: 'MIC-01', inputId: 'MIC-02', deviceId: 'MIC-02' }] }))).toEqual([422, 'INVALID_INPUT']);
    expect(changes(built)).toHaveLength(2);
  });

  it('an edit that changes nothing answers 200 with the selector as it is and writes no row', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const before = selectorOf(await get(built, CONFIG));
    for (const response of [await post(built, primaryMic('MIC-01')), await post(built, cameraSource('CAM-01'), { trackId: 'VIDEO-01' }), await post(built, CONFIG, {})]) {
      expect(response.statusCode).toBe(200);
      expect(selectorOf(response)).toEqual(before);
    }
    expect(changes(built)).toEqual([]);
    expect(built.log.lines().filter((line) => line['code'] === 'CAPTURE_CONFIG_CHANGED')).toEqual([]);
    // Control: an edit that changes something says so once, with names and codes only.
    expect((await post(built, primaryMic('MIC-02'))).statusCode).toBe(200);
    expect(built.log.lines().filter((line) => line['code'] === 'CAPTURE_CONFIG_CHANGED').map((line) => [line['operationId'], line['kind'], line['source']])).toEqual([['setPrimaryMic', 'PRIMARY_MIC', 'captureConfig.edit']]);
  });

  it('INVESTIGATOR never reaches a handler on the three edits: no unit, no change; a caller that holds CAPTURE_CONFIG does, whatever the role says', async () => {
    const built = await build();
    built.actAs(operatorOf('INVESTIGATOR'));
    const before = built.engine.state();
    const edits: [string, object | undefined][] = [[primaryMic('MIC-02'), undefined], [cameraSource('CAM-01'), { trackId: 'VIDEO-01' }], [CONFIG, { mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02' }] }]];
    for (const [url, payload] of edits) {
      // Without a database the guard cannot write its ACCESS_DENIED row, so its answer here is not
      // the 403 of the database test (`capture-config.db.test.ts`); what holds in both is that the
      // handler does not run.
      expect((await post(built, url, payload)).statusCode, url).toBeGreaterThanOrEqual(400);
    }
    expect(built.engine.units).toEqual([]);
    expect(built.engine.state()).toBe(before);
    // Control: the refusal is the access rule's. The simulator's own check still reads the ROLE, so
    // an INVESTIGATOR who were handed the permission is refused by the action (403), inside a unit.
    built.actAs(operatorOf('INVESTIGATOR', ['CAPTURE_CONFIG']));
    const refused = await post(built, primaryMic('MIC-02'));
    expect(outcome(refused)).toEqual([403, 'NOT_PERMITTED']);
    expect(errorOf(refused).details).toMatchObject({ permission: 'CAPTURE_CONFIG', simCode: 'NOT_PERMITTED' });
    expect(built.engine.units).toEqual(['captureConfig.setPrimaryMic']);
    expect(changes(built)).toEqual([]);
  });

  it('M4-LOCK-1: while a session is open the three edits answer 409 CAPTURE_CONFIG_LOCKED - the action is never called, no row, no change', async () => {
    const built = await build('recording');
    built.actAs(operatorOf('TECHNICIAN'));
    const before = built.engine.state();
    const rows = before.audit.rows.length;
    const refused = [
      await post(built, primaryMic('MIC-02')),
      await post(built, cameraSource('CAM-01'), { trackId: 'VIDEO-02' }),
      await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] }),
    ];
    for (const response of refused) {
      expect(outcome(response)).toEqual([409, 'CAPTURE_CONFIG_LOCKED']);
      expect(validateCoreApiResponse(matchCoreApiOperation('POST', response.raw.req.url ?? '')?.operation.operationId ?? '', 409, bodyOf(response))).toEqual({ ok: true });
    }
    expect(built.engine.commands).toEqual([]);
    expect(built.engine.state().audit.rows).toHaveLength(rows);
    expect(built.engine.state().captureConfig).toBe(before.captureConfig);
    // The simulator's order: an unknown path ID is 404 also while locked; a bad body is the schema stage's 422.
    expect(outcome(await post(built, cameraSource('CAM-99'), { trackId: 'VIDEO-02' }))).toEqual([404, 'NOT_FOUND']);
    expect(outcome(await post(built, primaryMic('MIC-09')))).toEqual([404, 'NOT_FOUND']);
    expect(outcome(await post(built, cameraSource('CAM-01'), { trackId: 'VIDEO-09' }))).toEqual([422, 'INVALID_INPUT']);

    // Control: the same three requests on an idle Core are accepted.
    const idle = await build('idle');
    idle.actAs(operatorOf('TECHNICIAN'));
    expect((await post(idle, primaryMic('MIC-02'))).statusCode).toBe(200);
    expect((await post(idle, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] })).statusCode).toBe(200);
    expect(idle.engine.commands).toHaveLength(2);
  });

  it('404 for a path ID the registry does not hold; 422 for a body or a line outside the contract; nothing is kept of a refused edit', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const before = built.engine.state().captureConfig;
    expect(outcome(await post(built, cameraSource('CAM-99'), { trackId: 'VIDEO-01' }))).toEqual([404, 'NOT_FOUND']);
    // A microphone is no camera; a PoE switch is no mic input.
    expect(outcome(await post(built, cameraSource('MIC-01'), { trackId: 'VIDEO-01' }))).toEqual([404, 'NOT_FOUND']);
    expect(outcome(await post(built, primaryMic('POE-SWITCH')))).toEqual([404, 'NOT_FOUND']);
    const invalid: [string, object | string | undefined][] = [
      [cameraSource('cam-01'), { trackId: 'VIDEO-01' }],
      [cameraSource('CAM-01'), { trackId: 'VIDEO-09' }],
      [cameraSource('CAM-01'), { trackId: 'VIDEO-01', extra: true }],
      [cameraSource('CAM-01'), {}],
      [CONFIG, { cameras: [] }],
      [CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }], other: 1 }],
      // A discovery candidate, an unknown device and a device of the wrong class are no devices to assign.
      [CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CND-0001' }] }],
      [CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-77' }] }],
      [CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'MIC-01' }] }],
      [CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'h264-1080p25' }] }],
      // A good line before a bad one.
      [CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-77' }] }],
      // A microphone input holds the microphone of the same ID: the stored row has no other form.
      [CONFIG, { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-02' }] }],
    ];
    for (const [url, payload] of invalid) expect(outcome(await post(built, url, payload)), `${url} ${JSON.stringify(payload)}`).toEqual([422, 'INVALID_INPUT']);
    expect(outcome(await post(built, CONFIG, '[1]'))).toEqual([400, 'INVALID_JSON']);
    expect(built.engine.state().captureConfig).toBe(before);
    expect(changes(built)).toEqual([]);
    // The credential write is not this row's (row 142 routes it). With no credential store behind
    // this app it is refused, and it changes nothing of the selector.
    expect((await post(built, CREDENTIAL, { username: 'a', secret: 'b' })).statusCode).toBe(503);
    expect(built.engine.state().captureConfig).toBe(before);
    expect(changes(built)).toEqual([]);
  });
});

// Task 4 row 29 (WP-13a; decisions C14, C18, C25; security requirement AD-10; names register of row
// 161, section 4). Until this row the contract's schema accepted `unassign` and the Core answered
// 200 with NOTHING changed: the route forwarded `cameras` and `mics` only. The route now hands the
// member to the hosted action (`setCaptureConfig`, row 162), under the rules every body of
// operation 78 has: the permission, the lock read before the action, the audit type.
describe('operation 78 `unassign`: a selector slot is cleared - same permission, same lock, same audit type (task 4 row 29, AD-10)', () => {
  // D61 (2026-11-04): the selector has EIGHT slots - four video tracks and four numbered microphone channels (`unassign` 1..8; six under D60).
  const SLOTS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const;
  const HELD = { 'VIDEO-01': 'CAM-01', 'VIDEO-02': 'CAM-02', 'VIDEO-03': 'CAM-03', 'VIDEO-04': 'CAM-04', 'MIC-01': 'MIC-01', 'MIC-02': 'MIC-02', 'MIC-03': 'MIC-03', 'MIC-04': 'MIC-04' } as const;
  /** The row of a cleared slot (names register 4.4): the track or the input, and `from`; no `to`, no `deviceId`. */
  const clearedRow = (slot: (typeof SLOTS)[number]) =>
    slot.startsWith('VIDEO') // D60 (2026-11-04): four video slots
      ? { operationId: 'updateCaptureConfig', scope: 'CAMERA', field: 'SOURCE', trackId: slot, from: HELD[slot], permission: 'CAPTURE_CONFIG' }
      : { operationId: 'updateCaptureConfig', scope: 'MIC', field: 'SOURCE', channel: slot, inputId: HELD[slot], from: HELD[slot], permission: 'CAPTURE_CONFIG' }; // D61 (2026-11-04): the row names the cleared channel
  /** The lines a selector holds, as `slot device`. */
  const linesOf = (selector: Selector): string[] => [...selector.cameras.map((camera) => `${camera.trackId} ${camera.deviceId}`), ...selector.mics.map((mic) => `${mic.channel} ${mic.deviceId}`)].sort(); // D61: the channel labels the line
  const allLines = SLOTS.map((slot) => `${slot} ${HELD[slot]}`).sort();
  /** Every detail key of a row is a key of the closed list of its type, in the form the list holds it to (implementation/019). */
  const expectClosedKeys = (details: Readonly<Record<string, Parameters<DetailRule['accepts']>[0]>>): void => {
    const rules = detailRulesOf('CAPTURE_CONFIG_CHANGED') ?? {};
    for (const [key, value] of Object.entries(details)) {
      expect(Object.hasOwn(rules, key), key).toBe(true);
      expect(rules[key]?.accepts(value), `${key}=${String(value)}`).toBe(true);
    }
    for (const [key, rule] of Object.entries(rules)) if (rule.required) expect(Object.hasOwn(details, key), key).toBe(true);
  };

  it.each(SLOTS)('THE INTERIM STATE IS ENDED - %s: the slot is cleared, the answer is the selector WITHOUT its line, ONE row with the track or input and `from`; assigned again, the line is back', async (slot) => {
    const built = await build();
    const principal = operatorOf('TECHNICIAN');
    built.actAs(principal);
    const cleared = await post(built, CONFIG, { unassign: [slot] });
    expect(cleared.statusCode, cleared.body).toBe(200);
    expect(validateCoreApiResponse('updateCaptureConfig', 200, bodyOf(cleared))).toEqual({ ok: true });
    // An unassigned slot is an ABSENT line: three lines are left, and no member of the answer is empty.
    expect(linesOf(selectorOf(cleared))).toEqual(allLines.filter((line) => !line.startsWith(`${slot} `)));
    expect(cleared.body).not.toMatch(/null|""/);
    expect(selectorOf(cleared).locked).toBe(false);
    // The action received the member as the body named it, in ONE unit; the engine holds the same selector; the read answers it.
    expect(built.engine.units).toEqual(['captureConfig.updateCaptureConfig']);
    expect(built.engine.commands.map((command) => [command.action, command.args])).toEqual([['setCaptureConfig', [{ kind: 'UPDATE', unassign: [slot] }]]]);
    expect(linesOf(built.engine.state().captureConfig)).toEqual(linesOf(selectorOf(cleared)));
    expect(selectorOf(await get(built, CONFIG))).toEqual(selectorOf(cleared));
    // AD-10 (1): one row, of the one audit type, by the caller, with the closed keys.
    const rows = changes(built);
    expect(rows.map((row) => [row.actorId, row.details])).toEqual([[principal.kind === 'OPERATOR' ? principal.operatorId : null, clearedRow(slot)]]);
    expectClosedKeys(rows[0]?.details ?? {});
    expect(built.log.lines().filter((line) => line['code'] === 'CAPTURE_CONFIG_CHANGED').map((line) => [line['operationId'], line['kind']])).toEqual([['updateCaptureConfig', 'UPDATE']]);

    // Clearing it AGAIN changes nothing: 200, the same selector, no row, no log line (AD-10 (1), second half).
    const held = built.engine.state().captureConfig;
    const again = await post(built, CONFIG, { unassign: [slot] });
    expect(again.statusCode).toBe(200);
    expect(selectorOf(again)).toEqual(selectorOf(cleared));
    expect(built.engine.state().captureConfig).toBe(held);
    expect(changes(built)).toHaveLength(1);

    // RE-ASSIGNING WORKS (the hosted action finds the slot by its track or its channel, D61): the line is back, its row states no `from`.
    const device = HELD[slot];
    const body = slot.startsWith('VIDEO') ? { cameras: [{ trackId: slot, deviceId: device, profile: 'H264_1080P25' }] } : { mics: [{ inputId: device, deviceId: device, channel: slot }] }; // D60: four video slots; D61 (2026-11-04): the mic line names its channel
    const assigned = await post(built, CONFIG, body);
    expect(assigned.statusCode, assigned.body).toBe(200);
    expect(validateCoreApiResponse('updateCaptureConfig', 200, bodyOf(assigned))).toEqual({ ok: true });
    expect(linesOf(selectorOf(assigned))).toEqual(allLines);
    const back = changes(built)[1]?.details ?? {};
    expect([back['scope'], back['field'], back['to'], back['deviceId'], Object.hasOwn(back, 'from')]).toEqual([slot.startsWith('VIDEO') ? 'CAMERA' : 'MIC', 'SOURCE', device, device, false]);
    expectClosedKeys(back);
    expect(changes(built)).toHaveLength(2);
  });

  it('GATE CONDITION: an unassign of two slots writes 2 rows and an unassign of an empty slot writes 0; all eight in one body leave an empty selector the contract accepts, and they all come back (D60, D61)', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const two = await post(built, CONFIG, { unassign: ['VIDEO-02', 'MIC-02'] });
    expect(two.statusCode, two.body).toBe(200);
    expect(linesOf(selectorOf(two))).toEqual(['MIC-01 MIC-01', 'MIC-03 MIC-03', 'MIC-04 MIC-04', 'VIDEO-01 CAM-01', 'VIDEO-03 CAM-03', 'VIDEO-04 CAM-04']); // D60/D61: the further lines are untouched
    expect(changes(built).map((row) => row.details)).toEqual([clearedRow('VIDEO-02'), clearedRow('MIC-02')]);
    // The same two again, both empty now: 0 rows, the same state.
    const held = built.engine.state().captureConfig;
    expect((await post(built, CONFIG, { unassign: ['VIDEO-02', 'MIC-02'] })).statusCode).toBe(200);
    expect(changes(built)).toHaveLength(2);
    expect(built.engine.state().captureConfig).toBe(held);
    // One empty and one held: only the held one is a row.
    const rest = await post(built, CONFIG, { unassign: [...SLOTS] });
    expect(rest.statusCode, rest.body).toBe(200);
    expect(changes(built).slice(2).map((row) => row.details)).toEqual([clearedRow('VIDEO-01'), clearedRow('VIDEO-03'), clearedRow('VIDEO-04'), clearedRow('MIC-01'), clearedRow('MIC-03'), clearedRow('MIC-04')]); // D61 (2026-11-04): six lines were still held when the eight-slot body ran
    expect(selectorOf(rest)).toMatchObject({ cameras: [], mics: [], locked: false });
    expect(validateCoreApiResponse('updateCaptureConfig', 200, bodyOf(rest))).toEqual({ ok: true });
    expect(validateCoreApiResponse('getCaptureConfig', 200, bodyOf(await get(built, CONFIG)))).toEqual({ ok: true });
    for (const row of changes(built)) expectClosedKeys(row.details ?? {});

    // A clear and an assignment of ANOTHER slot in one body are one edit; a microphone channel is assignable alone (C21 (8), keyed by channel since D61).
    const refill = await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_1080P25' }], mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-02' }] });
    expect(refill.statusCode, refill.body).toBe(200);
    expect(linesOf(selectorOf(refill))).toEqual(['MIC-02 MIC-02', 'VIDEO-02 CAM-02']);
    const mixed = await post(built, CONFIG, { unassign: ['VIDEO-02'], cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_1080P25' }], mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-01' }] });
    expect(mixed.statusCode, mixed.body).toBe(200);
    expect(linesOf(selectorOf(mixed))).toEqual(['MIC-01 MIC-01', 'MIC-02 MIC-02', 'VIDEO-01 CAM-01']);
    expect((await post(built, cameraSource('CAM-02'), { trackId: 'VIDEO-02' })).statusCode).toBe(200);
    // D60/D61: VIDEO-03, VIDEO-04, MIC-03 and MIC-04 went with the eight-slot clear above and are filled again before the closed comparison.
    expect((await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-03', deviceId: 'CAM-03', profile: 'H264_1080P25' }, { trackId: 'VIDEO-04', deviceId: 'CAM-04', profile: 'H264_1080P25' }], mics: [{ inputId: 'MIC-03', deviceId: 'MIC-03', channel: 'MIC-03' }, { inputId: 'MIC-04', deviceId: 'MIC-04', channel: 'MIC-04' }] })).statusCode).toBe(200); // D61 (2026-11-04): the two further channels come back too
    expect(linesOf(selectorOf(await get(built, CONFIG)))).toEqual(allLines);
  });

  it('AD-10 (2), the lock table: in EVERY session state but SEALED an unassign is 409 CAPTURE_CONFIG_LOCKED - the action is never called, 0 rows, no change; with a SEALED session and with none it is accepted', async () => {
    const built = await build('recording');
    built.actAs(operatorOf('TECHNICIAN'));
    const open = built.engine.state().session;
    if (open === null) throw new Error('the scenario holds no session');
    const states = Object.values(SessionState);
    expect([...states].sort()).toEqual(['ARMED', 'CREATE', 'FAULT', 'FINALIZING', 'PRECHECK', 'RECORDING', 'RECOVERY', 'SEALED', 'STOPPING']);
    const table: [string, number, string | null][] = [];
    for (const state of states.filter((candidate) => candidate !== SessionState.SEALED)) {
      built.engine.sim.store.setState({ session: { ...open, state } });
      const before = built.engine.state();
      for (const body of [{ unassign: ['VIDEO-01'] }, { unassign: ['VIDEO-02'] }, { unassign: ['MIC-01'] }, { unassign: ['MIC-02'] }, { unassign: [...SLOTS] }]) {
        const refused = await post(built, CONFIG, body);
        table.push([state, refused.statusCode, errorOf(refused).code]);
        expect(validateCoreApiResponse('updateCaptureConfig', 409, bodyOf(refused)), state).toEqual({ ok: true });
      }
      // SEC35-19: a state refusal - no CAPTURE_CONFIG_CHANGED row, no other row, the selector untouched, the lock said by the read.
      expect(built.engine.state().audit.rows, state).toBe(before.audit.rows);
      expect(built.engine.state().captureConfig, state).toBe(before.captureConfig);
      expect(selectorOf(await get(built, CONFIG)).locked, state).toBe(true);
    }
    expect(table).toHaveLength(8 * 5);
    expect(table.filter(([, status, code]) => status !== 409 || code !== 'CAPTURE_CONFIG_LOCKED')).toEqual([]);
    // The sealing states are in the table by name: a clear cannot take a source from a session that is being sealed.
    expect([...new Set(table.map(([state]) => state))]).toEqual(expect.arrayContaining(['RECORDING', 'STOPPING', 'FINALIZING', 'FAULT', 'RECOVERY']));
    expect(built.engine.commands).toEqual([]);
    expect(linesOf(built.engine.state().captureConfig)).toEqual(allLines);

    // CONTROL 1: the same body once the session is SEALED - accepted, eight rows (D60, D61).
    built.engine.sim.store.setState({ session: { ...open, state: SessionState.SEALED } });
    const rowsBefore = changes(built).length;
    const sealed = await post(built, CONFIG, { unassign: [...SLOTS] });
    expect(sealed.statusCode, sealed.body).toBe(200);
    expect(linesOf(selectorOf(sealed))).toEqual([]);
    expect(changes(built).slice(rowsBefore).map((row) => row.details)).toEqual(SLOTS.map((slot) => clearedRow(slot)));
    // CONTROL 2: with no session at all.
    const idle = await build('idle');
    idle.actAs(operatorOf('TECHNICIAN'));
    expect(idle.engine.state().session).toBeNull();
    expect((await post(idle, CONFIG, { unassign: ['MIC-01'] })).statusCode).toBe(200);
  });

  it('AD-10 (3): a body that clears and fills ONE slot is 422 - by the schema where it sees it, by the action (details.reason SLOT_UNASSIGNED_AND_ASSIGNED) otherwise; nothing is kept', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const before = built.engine.state().captureConfig;
    const bySchema: object[] = [
      { unassign: ['VIDEO-01'], cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] },
      { unassign: ['MIC-01'], mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02', channel: 'MIC-01' }, { inputId: 'MIC-01', deviceId: 'MIC-01', channel: 'MIC-02' }] },
      { unassign: ['MIC-02', 'MIC-02'] },
      { unassign: [] },
      // D60 admitted 'VIDEO-03', D61 admits 'MIC-01' - what the eight-slot schema still refuses is a slot of no era.
      { unassign: ['MIC-05'] },
      { unassign: 'VIDEO-01' },
      { unassign: ['VIDEO-01', 'VIDEO-02', 'MIC-01', 'MIC-02', 'VIDEO-01'] },
    ];
    for (const body of bySchema) expect(outcome(await post(built, CONFIG, body)), JSON.stringify(body)).toEqual([422, 'INVALID_INPUT']);
    // The schema stage answered: no unit was run.
    expect(built.engine.units).toEqual([]);
    // The form the schema cannot see: a mic line WITHOUT `channel` edits the input the cleared channel holds (D61).
    const byAction = await post(built, CONFIG, { unassign: ['MIC-01'], mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] });
    expect(outcome(byAction)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(byAction).details).toMatchObject({ reason: CAPTURE_CONFIG_SLOT_UNASSIGNED_AND_ASSIGNED });
    expect(built.engine.units).toEqual(['captureConfig.updateCaptureConfig']);
    // ENG-5: the refused unit left nothing - not the cleared slot either.
    expect(built.engine.state().captureConfig).toBe(before);
    expect(changes(built)).toEqual([]);
  });

  it('AD-10 (5), who may call it: the registry entry of operation 78 is unchanged (CAPTURE_CONFIG, no client-kind condition); INVESTIGATOR never reaches the handler; an unassign assigns nothing, so the adapter registry is not asked', async () => {
    const built = await build();
    // The guard's rule of operation 78 is the permission and nothing else, and it is the rule of operations 79 and 80 to the letter.
    const rules = permissionGuard(built.app).registeredRules();
    const ruleOf = (operationId: string) => {
      const found = rules.find((candidate) => candidate.operationId === operationId);
      if (found === undefined) throw new Error(`the guard holds no rule for ${operationId}`);
      // What a rule says beside the route it is for (its ID, method, path and path-ID pattern).
      const { operationId: _own, method: _method, url: _url, idPattern: _pattern, ...rest } = found;
      return rest;
    };
    expect([ruleOf('updateCaptureConfig').kind, ruleOf('updateCaptureConfig').permissions]).toEqual([CoreApiAccessKind.PERMISSION, ['CAPTURE_CONFIG']]);
    expect(ruleOf('updateCaptureConfig')).toEqual(ruleOf('setCaptureCameraSource'));
    expect(ruleOf('updateCaptureConfig')).toEqual(ruleOf('setPrimaryMic'));
    expect(captureConfigOperation('updateCaptureConfig').audit).toEqual({ success: 'CAPTURE_CONFIG_CHANGED', denial: 'ACCESS_DENIED' });

    built.actAs(operatorOf('INVESTIGATOR'));
    const before = built.engine.state();
    expect((await post(built, CONFIG, { unassign: ['VIDEO-01'] })).statusCode).toBeGreaterThanOrEqual(400);
    expect(built.engine.units).toEqual([]);
    expect(built.engine.state()).toBe(before);
    built.actAs({ kind: 'ANONYMOUS', retiredDeviceId: null });
    expect(outcome(await post(built, CONFIG, { unassign: ['VIDEO-01'] }))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(built.engine.units).toEqual([]);

    // A registry that refuses EVERY device: an unassign still passes, because it names none (rule RG-3 has nothing to ask).
    const asked: string[] = [];
    captureConfigControl(built.app).provideDeviceRegistry({
      assertAssignable(deviceClass, deviceId) {
        asked.push(`${deviceClass} ${deviceId}`);
        return createFakeRegistry({ runDir: '/nonexistent/dems-run/capture' }).registry.assertAssignable(deviceClass, 'CAM-99');
      },
    });
    for (const role of ['TECHNICIAN'] as const) {
      built.actAs(operatorOf(role));
      const cleared = await post(built, CONFIG, { unassign: ['VIDEO-01', 'MIC-01'] });
      await post(built, CONFIG, { unassign: ['VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-02', 'MIC-03', 'MIC-04'] }); // one editor does every line (`0034`); D60: the camera lines; D61 (2026-11-04): the two further channels go with it
      expect(cleared.statusCode, `${role} ${cleared.body}`).toBe(200);
    }
    expect(asked).toEqual([]);
    expect(changes(built)).toHaveLength(8); // D61 (2026-11-04): eight cleared slots, eight rows (six under D60)
    // CONTROL: the same registry IS asked for an assignment, and refuses it - the slot stays empty.
    expect(outcome(await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_1080P25' }] }))).toEqual([422, 'INVALID_INPUT']);
    expect(asked).toEqual(['CAMERA CAM-01']);
    expect(built.engine.state().captureConfig.cameras).toEqual([]);
  });
});

describe('the seam of the adapter registry (rule RG-3): provided by the wiring, asked for every assignment', () => {
  it('without a registry no assignment is refused by class; with one, a device the running operation does not serve is 422 with the reason of THAT refusal (fix wave I, G70b-01: CAPTURE_DEVICE_NOT_SERVED, no longer DEVELOPMENT_SOURCE_NOT_ALLOWED for every refusal)', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const control = captureConfigControl(built.app);
    expect(control.hasDeviceRegistry()).toBe(false);
    expect((await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] })).statusCode).toBe(200);

    // REAL_PRODUCTION registers no development kind: the seeded devices are `FAKE`, so none is served.
    const asked: string[] = [];
    const production = createFakeRegistry({ runDir: '/nonexistent/dems-run/capture' }).registry;
    const refusing: Pick<CaptureDeviceRegistry, 'assertAssignable'> = {
      assertAssignable(deviceClass, deviceId) {
        asked.push(`${deviceClass} ${deviceId}`);
        if (deviceId === 'CAM-01' || deviceId === 'MIC-02') {
          // What the real registry answers for a device another operation's adapters serve.
          return createFakeRegistry({ runDir: '/nonexistent/dems-run/capture', operation: CaptureOperation.REAL_DEVELOPMENT, topology: 'DUAL_LENS' }).registry.assertAssignable(deviceClass, deviceId === 'CAM-01' ? 'CAM-02' : 'MIC-99');
        }
        return production.assertAssignable(deviceClass, deviceId);
      },
    };
    control.provideDeviceRegistry(refusing);
    expect(control.hasDeviceRegistry()).toBe(true);
    expect(() => control.provideDeviceRegistry(refusing)).toThrow(/twice/);

    const before = built.engine.state().captureConfig;
    const commands = built.engine.commands.length;
    const refused = await post(built, cameraSource('CAM-01'), { trackId: 'VIDEO-01' });
    expect(outcome(refused)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(refused).details).toMatchObject({ in: 'body', reason: 'CAPTURE_DEVICE_NOT_SERVED', deviceId: 'CAM-01' });
    expect(errorOf(await post(built, CONFIG, { mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02' }] })).details).toMatchObject({ in: 'body', reason: 'CAPTURE_DEVICE_NOT_SERVED', deviceId: 'MIC-02' });
    expect(built.engine.commands).toHaveLength(commands);
    expect(built.engine.state().captureConfig).toBe(before);
    // A device the registry serves is assigned; a channel move (D61: was the role change) assigns nothing and asks nothing.
    expect((await post(built, cameraSource('CAM-02'), { trackId: 'VIDEO-01' })).statusCode).toBe(200);
    const askedBefore = asked.length;
    expect((await post(built, primaryMic('MIC-02'))).statusCode).toBe(200);
    expect(asked).toHaveLength(askedBefore);
    // An unknown path ID never reaches the registry: it is the 404 of the operation.
    expect(outcome(await post(built, cameraSource('CAM-99'), { trackId: 'VIDEO-01' }))).toEqual([404, 'NOT_FOUND']);
    expect(asked).not.toContain('CAMERA CAM-99');
  });

  // Row R2 (ruling C93 on review finding F3-11; D60 of 2026-11-04: the rule is PAIRWISE on the pair (device, profile) over the four tracks):
  // on a Core with a device registry one camera fills a second video track ONLY with a distinct profile (the dual-lens case, OD-05); the same
  // profile twice is refused before the action. The simulator's rule (two profiles admit it) stands where no registry is provided - it now agrees.
  it('C93 (D60, pairwise): with a registry, the SAME camera on two tracks WITH THE SAME PROFILE is 422 CAMERA_ON_BOTH_TRACKS by operation 78 and by 79 - before the action, nothing changed; distinct profiles admit it, a swap and a move after a clear pass; without a registry the simulator\'s rule stands (control)', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const control = captureConfigControl(built.app);
    const devicesOf = (): string[][] => built.engine.state().captureConfig.cameras.map((camera) => [camera.trackId, camera.deviceId]);
    expect(devicesOf()).toEqual([['VIDEO-01', 'CAM-01'], ['VIDEO-02', 'CAM-02'], ['VIDEO-03', 'CAM-03'], ['VIDEO-04', 'CAM-04']]); // D60 (2026-11-04): four built-in lines

    // CONTROL, no registry (Simulated mode): one camera on both tracks with two profiles is the simulator's admitted state, as before.
    expect(control.hasDeviceRegistry()).toBe(false);
    expect((await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-01', profile: 'H264_720P25' }] })).statusCode).toBe(200);
    expect(devicesOf()).toEqual([['VIDEO-01', 'CAM-01'], ['VIDEO-02', 'CAM-01'], ['VIDEO-03', 'CAM-03'], ['VIDEO-04', 'CAM-04']]);

    // A registry that serves both cameras and both microphones: every refusal below is this rule's, none the registry's.
    control.provideDeviceRegistry(createFakeRegistry({ runDir: '/nonexistent/dems-run/capture', operation: CaptureOperation.REAL_DEVELOPMENT }).registry);
    // A selector that held the state BEFORE the rule: an edit elsewhere is not refused (the start rule of the plan builder holds it) ...
    expect((await post(built, primaryMic('MIC-02'))).statusCode).toBe(200);
    // ... D60: the line that names the camera again UNDER ITS OWN PROFILE passes (the dual-lens pair stands) ...
    expect((await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_1080P25' }] })).statusCode).toBe(200);
    // ... and the edit that would leave the SAME profile behind two tracks is refused, naming the line that does it.
    const again = await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_720P25' }] });
    expect(outcome(again)).toEqual([422, 'INVALID_INPUT']);
    expect(errorOf(again).details).toEqual({ in: 'body', reason: 'CAMERA_ON_BOTH_TRACKS', deviceId: 'CAM-01', trackId: 'VIDEO-01' });
    // The dual-lens state ends: VIDEO-02 takes its own camera at the seeded profile.
    expect((await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_1080P25' }] })).statusCode).toBe(200);
    expect(devicesOf()).toEqual([['VIDEO-01', 'CAM-01'], ['VIDEO-02', 'CAM-02'], ['VIDEO-03', 'CAM-03'], ['VIDEO-04', 'CAM-04']]);

    // THE REFUSALS - each one the SAME profile on two tracks. Each leaves the committed selector the same object and calls no action.
    const before = built.engine.state().captureConfig;
    const commands = built.engine.commands.length;
    const refusals: readonly [string, () => Promise<Awaited<ReturnType<typeof post>>>, string, string][] = [
      ['79: the camera of VIDEO-01 into VIDEO-02 (the slot keeps its profile, the pair collides)', () => post(built, cameraSource('CAM-01'), { trackId: 'VIDEO-02' }), 'CAM-01', 'VIDEO-02'],
      ['79: the camera of VIDEO-02 into VIDEO-01', () => post(built, cameraSource('CAM-02'), { trackId: 'VIDEO-01' }), 'CAM-02', 'VIDEO-01'],
      ['78: one line, the profile the other track already states for it', () => post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-01', profile: 'H264_1080P25' }] }), 'CAM-01', 'VIDEO-02'],
      ['78: two lines, one camera, one profile', () => post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02', profile: 'H264_1080P25' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02', profile: 'H264_1080P25' }] }), 'CAM-02', 'VIDEO-01'],
      ['78: the other slot cleared in the same body is NOT the slot the line fills twice', () => post(built, CONFIG, { unassign: ['MIC-01'], cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }] }), 'CAM-02', 'VIDEO-01'],
      // D60 (2026-11-04): the rule is pairwise OVER THE FOUR - a third track colliding like the second did.
      ['78: VIDEO-03 against VIDEO-01, the same camera and profile', () => post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-03', deviceId: 'CAM-01', profile: 'H264_1080P25' }] }), 'CAM-01', 'VIDEO-03'],
    ];
    for (const [label, send, deviceId, trackId] of refusals) {
      const refused = await send();
      expect(outcome(refused), label).toEqual([422, 'INVALID_INPUT']);
      expect(errorOf(refused).details, label).toEqual({ in: 'body', reason: CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS, deviceId, trackId });
      expect(errorOf(refused).message, label).toBe('One camera fills one video slot with one profile: this camera is already assigned to another track with this profile (the dual-lens case needs two profiles).'); // D60 (2026-11-04): the pairwise wording
    }
    expect(CAPTURE_CONFIG_CAMERA_ON_BOTH_TRACKS).toBe('CAMERA_ON_BOTH_TRACKS');
    expect(built.engine.commands).toHaveLength(commands);
    expect(built.engine.state().captureConfig).toBe(before);

    // NOT REFUSED: the two cameras swapped in one body; the dual-lens pair with DISTINCT profiles (D60: the registry now admits what the simulator admits); a camera moved into the other slot after its own slot was cleared by the same body.
    expect((await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] })).statusCode).toBe(200);
    expect(devicesOf()).toEqual([['VIDEO-01', 'CAM-02'], ['VIDEO-02', 'CAM-01'], ['VIDEO-03', 'CAM-03'], ['VIDEO-04', 'CAM-04']]);
    expect((await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_720P25' }] })).statusCode).toBe(200); // D60: same device as VIDEO-02, distinct profile
    expect((await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02', profile: 'H264_1080P25' }] })).statusCode).toBe(200);
    expect((await post(built, CONFIG, { unassign: ['VIDEO-01'], cameras: [{ trackId: 'VIDEO-02', deviceId: 'CAM-02' }] })).statusCode).toBe(200);
    expect(devicesOf()).toEqual([['VIDEO-02', 'CAM-02'], ['VIDEO-03', 'CAM-03'], ['VIDEO-04', 'CAM-04']]); // D60: the two further lines stand
    // And the cleared slot takes the other camera, not the same one at the same profile.
    // D60: operation 79 states no profile and the empty slot holds none, so the gate cannot name the colliding pair - the ACTION's own
    // dual-lens rule refuses it, under the same reason and without the pair in its details.
    expect(errorOf(await post(built, cameraSource('CAM-02'), { trackId: 'VIDEO-01' })).details).toMatchObject({ reason: 'CAMERA_ON_BOTH_TRACKS' });
    expect((await post(built, cameraSource('CAM-01'), { trackId: 'VIDEO-01' })).statusCode).toBe(200);
    expect(devicesOf()).toEqual([['VIDEO-01', 'CAM-01'], ['VIDEO-02', 'CAM-02'], ['VIDEO-03', 'CAM-03'], ['VIDEO-04', 'CAM-04']]);
  });
});

describe('G70b-01: the reason of a refused assignment (wave I, driver A2)', () => {
  // FIX WAVE I, DRIVER A2 - finding G70b-01, second half (re-gate 70): every refusal of the adapter
  // registry is answered under ITS OWN reason. Before the fix `routes.ts` answered every one of them
  // as `DEVELOPMENT_SOURCE_NOT_ALLOWED`, so a camera the registry did not serve yet read "this source
  // can only be used in the development configuration" on a Core in that very configuration.

  describe('G70b-01: the reason of a refused assignment (operations 78 / 79)', () => {
    it('a device the registry does not serve is CAPTURE_DEVICE_NOT_SERVED - on a development Core never the development reason', () => {
      // The gate's case: an adopted FAKE camera (stored class DEVELOPMENT) on REAL_DEVELOPMENT, unknown to the registry.
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'DEVELOPMENT', CaptureOperation.REAL_DEVELOPMENT)).toBe('CAPTURE_DEVICE_NOT_SERVED');
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'DEVELOPMENT', CaptureOperation.REAL_DEVELOPMENT)).not.toBe(DEVELOPMENT_SOURCE_NOT_ALLOWED);
      // A production camera on a production Core of this phase: no adapter (class C), not a class refusal.
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'PRODUCTION', CaptureOperation.REAL_PRODUCTION)).toBe('CAPTURE_DEVICE_NOT_SERVED');
      // A built-in carries no stored class in the slice; a registry that does not say its operation.
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, undefined, CaptureOperation.REAL_DEVELOPMENT)).toBe('CAPTURE_DEVICE_NOT_SERVED');
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'DEVELOPMENT', undefined)).toBe('CAPTURE_DEVICE_NOT_SERVED');
    });

    it('a class refusal names the class of the DEVICE, in both directions', () => {
      // C3 §4: a DEVELOPMENT device named while the Core does not run development sources.
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, 'DEVELOPMENT', CaptureOperation.REAL_PRODUCTION)).toBe(DEVELOPMENT_SOURCE_NOT_ALLOWED);
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'DEVELOPMENT', CaptureOperation.REAL_PRODUCTION)).toBe(DEVELOPMENT_SOURCE_NOT_ALLOWED);
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, undefined, CaptureOperation.REAL_PRODUCTION)).toBe(DEVELOPMENT_SOURCE_NOT_ALLOWED);
      // The other direction: a production device on a development Core.
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, 'PRODUCTION', CaptureOperation.REAL_DEVELOPMENT)).toBe('PRODUCTION_SOURCE_NOT_ALLOWED');
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_UNKNOWN, 'PRODUCTION', CaptureOperation.REAL_DEVELOPMENT)).toBe('PRODUCTION_SOURCE_NOT_ALLOWED');
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, undefined, CaptureOperation.REAL_DEVELOPMENT)).toBe('PRODUCTION_SOURCE_NOT_ALLOWED');
      // A registry that states no operation and a device with no stored class: the earlier reading stands.
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED, undefined, undefined)).toBe(DEVELOPMENT_SOURCE_NOT_ALLOWED);
    });

    it('a class mismatch and every other refusal keep their own word; the four reasons are four different codes', () => {
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.DEVICE_CLASS_MISMATCH, 'DEVELOPMENT', CaptureOperation.REAL_DEVELOPMENT)).toBe('CAPTURE_DEVICE_CLASS_MISMATCH');
      expect(captureAssignmentRefusalOf(CaptureAdapterRefusal.SOURCE_KIND_NOT_RECORDABLE, 'DEVELOPMENT', CaptureOperation.REAL_DEVELOPMENT)).toBe('SOURCE_KIND_NOT_RECORDABLE');
      expect(new Set(Object.values(CaptureAssignmentRefusal)).size).toBe(4);
      for (const reason of Object.values(CaptureAssignmentRefusal)) expect(reason).toMatch(/^[A-Z][A-Z0-9_]*$/);
    });
  });
});

// Row S86a (caution C-1 of the security review row 86; decision C127): a production camera's profile is judged against its
// stored list AND its stored stream rows. The route on PostgreSQL is the database test's (block 5, last case); here the pure
// judgement, the seam's word and sentence, and the reader's statement and fail-closed parse.
describe('row S86a (C-1): a listed code without its stored stream row is refused at assignment', () => {
  const OWN = 'HEVC_2160P25_MAIN';
  const RAW = 'PROFILE_1'; // C61: a raw token in code form

  it('the judgement: none -> NOT_STATED, unlisted -> NOT_OF_DEVICE, listed without a stream row -> WITHOUT_STREAM, listed with one -> admitted', () => {
    const listed = [OWN, RAW, 'H264_1080P25_MAIN'];
    const streamed = new Set([OWN, 'H264_720P25']);
    expect(ownProfileFindingOf(undefined, listed, streamed)).toBe('NOT_STATED');
    expect(ownProfileFindingOf('H264_720P25', listed, streamed)).toBe('NOT_OF_DEVICE');
    expect(ownProfileFindingOf(RAW, listed, streamed)).toBe('WITHOUT_STREAM');
    expect(ownProfileFindingOf('H264_1080P25_MAIN', listed, streamed)).toBe('WITHOUT_STREAM');
    expect(ownProfileFindingOf(OWN, listed, streamed)).toBeNull();
    // Fail closed: a camera the reads do not hold has no list and no stream row.
    expect(ownProfileFindingOf(OWN, [], new Set())).toBe('NOT_OF_DEVICE');
    expect(ownProfileFindingOf(OWN, [OWN], new Set())).toBe('WITHOUT_STREAM');
  });

  it('the word: its own (row V7c, C130: `common.captureSlotRefusal.CAMERA_PROFILE_WITHOUT_STREAM`), and a sentence of its own that names re-adoption and says a connection test does not repair it', () => {
    expect(PROFILE_WITHOUT_STREAM_REASON).toBe('CAMERA_PROFILE_WITHOUT_STREAM');
    expect(Object.values(CaptureProfileRefusal)).toContain(PROFILE_WITHOUT_STREAM_REASON);
    expect(PROFILE_WITHOUT_STREAM_TEXT).toMatch(/Adopt the camera again/);
    expect(PROFILE_WITHOUT_STREAM_TEXT).toMatch(/connection test does not repair/);
    expect(PROFILE_WITHOUT_STREAM_TEXT).not.toMatch(/PROFILE_|HEVC|H264|token/i);
  });

  it('the reader: one statement on the stream table, key columns only, no parameter, no credential table; codes by camera, a row that is no text states nothing', async () => {
    expect(READ_CAMERA_STREAM_PROFILES).toContain('public.capture_device_streams');
    expect(READ_CAMERA_STREAM_PROFILES).not.toMatch(/credential|token|address|\$1/);
    const asked: string[] = [];
    const reader = {
      async query<Row>(text: string): Promise<{ rows: Row[] }> {
        asked.push(text);
        return { rows: [{ id: 'CAM-11', profile: OWN }, { id: 'CAM-11', profile: 'H264_720P25' }, { id: 'CAM-12', profile: RAW }, { id: 7, profile: OWN }, { id: 'CAM-13', profile: null }] as Row[] };
      },
    };
    const byCamera = await readCameraStreamProfiles(reader);
    expect(asked).toEqual([READ_CAMERA_STREAM_PROFILES]);
    expect([...byCamera.keys()].sort()).toEqual(['CAM-11', 'CAM-12']);
    expect([...(byCamera.get('CAM-11') ?? [])].sort()).toEqual(['H264_720P25', OWN]);
    // Per camera: CAM-12's code is not CAM-11's.
    expect(byCamera.get('CAM-11')?.has(RAW)).toBe(false);
    expect(byCamera.get('CAM-13')).toBeUndefined();
  });
});
