// Operations 76 to 80 without a database (blueprint row 66 / M4-W2; contract C3 §2.2 to §2.4, §4,
// §6; checks M4-LOCK-1 and the server half of M4-SEL-W/T/P).
//
// The real app factory, the REAL access rule (stage 6) and, behind the seam `engine`, a stand-in
// that runs a unit on a real shared simulator (`support.ts`). What is STORED and PUBLISHED is the
// database test's (`capture-config.db.test.ts`); this file holds the route list, the order of the
// refusals, the lock, and the seam of the adapter registry.
import { CAPTURE_CONFIG_CHANGE_OPERATIONS, CAPTURE_CONFIG_OPERATIONS, CoreApiAccessKind, CoreApiAuditNone, SIM_ACTION_OPERATIONS, matchCoreApiOperation, validateCoreApiResponse } from '@dems/shared/api';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { WEB_ORIGIN } from '../../../../test/support/identity';
import { CaptureOperation, createFakeRegistry, type CaptureDeviceRegistry } from '../../../capture/adapters';
import { hostedActionsOfOperation } from '../../../engine/hosted-actions';
import { permissionGuard, routePatternOf } from '../../../plugins/permission-guard';
import { bodyOf, errorOf, operatorOf, outcome, signature } from '../../devices/__tests__/support';
import { CAPTURE_CONFIG_MODULE_OPERATIONS, captureConfigControl, captureConfigOperation } from '../index';
import { CONFIG, CREDENTIAL, DEVICES, cameraSource, primaryMic, selectorUnitApp, type SelectorUnitApp } from './support';

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
  mics: { inputId: string; deviceId: string; role: string }[];
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
      expect(selectorOf(config)).toMatchObject({ locked: false, cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-01' }, { trackId: 'VIDEO-02', deviceId: 'CAM-02' }], mics: [{ inputId: 'MIC-01', role: 'PRIMARY' }, { inputId: 'MIC-02', role: 'STANDBY' }] });
      expect((devices.json() as { devices: { id: string }[] }).devices.map((device) => device.id)).toEqual(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH']);
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

  it('AC-B-70: a selector the stored row read back PRIMARY first (MIC-02) is answered in input order; the engine\'s slice is not touched', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const held = built.engine.state().captureConfig;
    const reversed = [...held.mics].reverse().map((mic) => ({ ...mic, role: mic.inputId === 'MIC-02' ? ('PRIMARY' as const) : ('STANDBY' as const) }));
    built.engine.sim.store.setState({ captureConfig: { ...held, mics: reversed } });
    const config = await get(built, CONFIG);
    expect(selectorOf(config).mics.map((mic) => [mic.inputId, mic.role])).toEqual([
      ['MIC-01', 'STANDBY'],
      ['MIC-02', 'PRIMARY'],
    ]);
    expect(built.engine.state().captureConfig.mics).toBe(reversed);
    // An edit that changes nothing answers in the same order and writes nothing.
    const same = await post(built, primaryMic('MIC-02'));
    expect(selectorOf(same).mics.map((mic) => mic.inputId)).toEqual(['MIC-01', 'MIC-02']);
    expect(changes(built)).toEqual([]);
  });

  it('an engine that is not running is 503 NOT_READY on every operation of the module', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    built.engine.running = false;
    expect(outcome(await get(built, CONFIG))).toEqual([503, 'NOT_READY']);
    expect(outcome(await get(built, DEVICES))).toEqual([503, 'NOT_READY']);
    expect(outcome(await post(built, primaryMic('MIC-02')))).toEqual([503, 'NOT_READY']);
    expect(outcome(await post(built, cameraSource('CAM-01'), { trackId: 'VIDEO-01' }))).toEqual([503, 'NOT_READY']);
    expect(outcome(await post(built, CONFIG, { mics: [{ inputId: 'MIC-01', deviceId: 'MIC-01' }] }))).toEqual([503, 'NOT_READY']);
  });
});

describe('operations 78, 79, 80: an edit is one unit of the engine with the hosted action setCaptureConfig', () => {
  it.each(['SUPERVISOR', 'TECHNICIAN'] as const)('%s edits: the answer is the new selector, one audited row per changed line, the caller is the actor', async (role) => {
    const built = await build();
    const principal = operatorOf(role);
    built.actAs(principal);

    const primary = await post(built, primaryMic('MIC-02'));
    expect(primary.statusCode).toBe(200);
    expect(validateCoreApiResponse('setPrimaryMic', 200, bodyOf(primary))).toEqual({ ok: true });
    // AC-B-70: the two mic inputs are listed MIC-01, MIC-02, whichever holds the PRIMARY role.
    expect(selectorOf(primary).mics.map((mic) => [mic.inputId, mic.role])).toEqual([
      ['MIC-01', 'STANDBY'],
      ['MIC-02', 'PRIMARY'],
    ]);
    expect(selectorOf(primary).locked).toBe(false);

    const swapped = await post(built, CONFIG, { cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02' }, { trackId: 'VIDEO-02', deviceId: 'CAM-01' }] });
    expect(swapped.statusCode).toBe(200);
    expect(validateCoreApiResponse('updateCaptureConfig', 200, bodyOf(swapped))).toEqual({ ok: true });
    expect(selectorOf(swapped).cameras.map((camera) => [camera.trackId, camera.deviceId])).toEqual([
      ['VIDEO-01', 'CAM-02'],
      ['VIDEO-02', 'CAM-01'],
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
      [principal.kind === 'OPERATOR' ? principal.operatorId : null, 'setPrimaryMic', 'MIC', 'ROLE', 'STANDBY', 'PRIMARY', 'CAPTURE_CONFIG'],
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
    built.actAs(operatorOf('SUPERVISOR'));
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
    idle.actAs(operatorOf('SUPERVISOR'));
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

describe('the seam of the adapter registry (rule RG-3): provided by the wiring, asked for every assignment', () => {
  it('without a registry no assignment is refused by class; with one, a device the running operation does not serve is 422 DEVELOPMENT_SOURCE_NOT_ALLOWED', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
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
    expect(errorOf(refused).details).toMatchObject({ reason: 'DEVELOPMENT_SOURCE_NOT_ALLOWED', deviceId: 'CAM-01' });
    expect(errorOf(await post(built, CONFIG, { mics: [{ inputId: 'MIC-02', deviceId: 'MIC-02' }] })).details).toMatchObject({ reason: 'DEVELOPMENT_SOURCE_NOT_ALLOWED', deviceId: 'MIC-02' });
    expect(built.engine.commands).toHaveLength(commands);
    expect(built.engine.state().captureConfig).toBe(before);
    // A device the registry serves is assigned; a role change assigns nothing and asks nothing.
    expect((await post(built, cameraSource('CAM-02'), { trackId: 'VIDEO-01' })).statusCode).toBe(200);
    const askedBefore = asked.length;
    expect((await post(built, primaryMic('MIC-02'))).statusCode).toBe(200);
    expect(asked).toHaveLength(askedBefore);
    // An unknown path ID never reaches the registry: it is the 404 of the operation.
    expect(outcome(await post(built, cameraSource('CAM-99'), { trackId: 'VIDEO-01' }))).toEqual([404, 'NOT_FOUND']);
    expect(asked).not.toContain('CAMERA CAM-99');
  });
});
