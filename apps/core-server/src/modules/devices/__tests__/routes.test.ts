// The routes of the devices module against the contract registry (plan row W36; module gate
// MODG; spec §7.10 operations 44 to 52, §7.2, §7.17). In-process, no database: the real app
// factory with every stage registered, a principal the test chooses behind stage 4, the REAL
// access rule (stage 6), and a recording stand-in behind the seam `engine`.
//
// What is proven here: the route list is the registry's; each handler is one read of the
// committed state or one hosted command with the caller's principal; an answer of the engine
// leaves unchanged; the schema stage refuses a malformed path ID or body before the engine is
// reached. The same operations against PostgreSQL and the real engine: `devices.db.test.ts`.
import {
  CORE_API_OPERATIONS,
  CoreApiAccessKind,
  CoreApiAuditNone,
  CoreApiTag,
  DEVICE_COMMAND_OPERATIONS,
  HARDWARE_DEVICE_ID_PATTERN,
  SIM_ACTION_OPERATIONS,
  matchCoreApiOperation,
  validateCoreApiResponse,
} from '@dems/shared/api';
import { DeviceCommand, SimErrorCode, SimNotFoundError, SimTransitionError, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { hostedActionsOfOperation, simRefusal } from '../../../engine';
import { notReady } from '../../../plugins/error-envelope';
import { permissionGuard, routePatternOf } from '../../../plugins/permission-guard';
import { WEB_ORIGIN } from '../../../../test/support/identity';
import { DEVICES_OPERATIONS, DEVICE_COMMAND_OF_OPERATION, audioStatusOf, deviceHealthOf, deviceInventoryOf, operationOf, videoStatusOf } from '../index';
import {
  ACTIVE_CAMERA,
  ANONYMOUS,
  AUDIO,
  CLIP_RESET,
  DOUBLE_EPOCH,
  DOUBLE_REVISION,
  HEALTH,
  INVENTORY,
  VIDEO,
  bodyOf,
  committedOf,
  errorOf,
  identify,
  moduleRoutes,
  operationNumber,
  operatorOf,
  outcome,
  registryEntries,
  restart,
  scenarioState,
  signature,
  testSignal,
  unitApp,
  type UnitApp,
} from './support';

const ROLES = ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const satisfies readonly OperatorRole[];
const apps: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

async function build(...parameters: Parameters<typeof unitApp>): Promise<UnitApp> {
  const built = await unitApp(...parameters);
  apps.push(built.app);
  return built;
}

const get = (built: UnitApp, url: string): Promise<LightMyRequestResponse> => built.app.inject({ method: 'GET', url });
/** A command as the web console sends it: its `Origin`, and a JSON body when there is one. */
const post = (built: UnitApp, url: string, payload?: object | string, headers: Record<string, string> = {}): Promise<LightMyRequestResponse> =>
  built.app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN, ...headers }, ...(payload === undefined ? {} : { payload }) });

describe('MODG: the route list of the module equals its registry operations', () => {
  it('registers operations 44 to 52 with the method, the path and the operation ID of the registry, and nothing else under its three paths', async () => {
    const { registered } = await build();
    const fromRegistry = registryEntries().map((operation) => signature(operation.method, routePatternOf(operation.path), operation.operationId));
    const own = registered.filter((route) => /^\/api\/v1\/(?:device|audio|video)\//.test(route.url));
    const fromModule = own.map((route) => signature(String(route.method), route.url, String(route.config?.operationId)));

    expect(fromModule).toEqual(fromRegistry);
    expect(fromModule).toEqual([
      'GET /api/v1/device/health getDeviceHealth',
      'GET /api/v1/audio/status getAudioStatus',
      'GET /api/v1/video/status getVideoStatus',
      'GET /api/v1/device/inventory getDeviceInventory',
      'POST /api/v1/device/:id/restart restartDevice',
      'POST /api/v1/device/:id/test-signal testDeviceSignal',
      'POST /api/v1/device/:id/identify identifyDevice',
      'POST /api/v1/video/active-camera setActiveCamera',
      'POST /api/v1/audio/clip/reset resetMicClip',
    ]);
    expect(moduleRoutes(registered)).toEqual(own);
    console.info(`[w36] MODG routes of src/modules/devices: ${fromModule.join(' | ')}`);
    console.info(`[w36] MODG registry, operations 44 to 52:  ${fromRegistry.join(' | ')}`);
  });

  it('the area of the registry: these nine operations plus the six of the capture-config module (row 52/66), the three of the STT configuration module (row 113) and the five of the camera search (rows 132 / 133 / 142), in registry order', () => {
    const area = CORE_API_OPERATIONS.filter((operation) => operation.tag === CoreApiTag.DEVICE);
    // Schema v2 (C3 §2.2): the Device tag grew by operations 76 to 80 and 89 - the selector and
    // the credential write, which the capture-config module answers (row 66), not this one. The
    // module's nine stay the first entries of the area, in registry order.
    const CAPTURE_CONFIG_AREA = ['getCaptureConfig', 'getCaptureDevices', 'updateCaptureConfig', 'setCaptureCameraSource', 'setPrimaryMic', 'setCaptureDeviceCredential'];
    // Blueprint row 113 (C3 §2.5): operations 90 to 92 carry the Device tag too and are answered by
    // `modules/stt-config`, not by this module.
    const STT_CONFIG_AREA = ['getSttConfig', 'updateSttConfig', 'testSttConnection'];
    // Blueprint row 132 (decision D106; C3 §2.6): operations 93 to 97 carry the Device tag too and are
    // answered by `modules/capture-discovery` (93, 94) and by rows 142 (95, 96) and 133 (97).
    const CAPTURE_DISCOVERY_AREA = ['startCaptureDiscovery', 'getCaptureDiscovery', 'testCaptureCandidateConnection', 'adoptCaptureCandidate', 'rescanCaptureInputs'];
    // Task 4 blueprint row 63 (design addendum 4.2): operations 98 and 99 carry the Device tag too.
    // The contract only: no module answers them yet (the microphone registration module is row 70).
    const AUDIO_CARD_AREA = ['searchCaptureAudioCards', 'registerCaptureAudioInput'];
    // Task 4 blueprint row 194: operation 100 (the confirmed re-address) carries the Device tag too.
    // The contract only: no module answers it yet (rows 196, 197).
    const READDRESS_AREA = ['confirmCaptureDeviceAddress'];
    // Task 4 blueprint row 102: operations 101 to 107 (the commissioning functions) carry the Device
    // tag too. The contract only: no module answers them yet (rows 106 to 111).
    const COMMISSIONING_AREA = ['getCaptureNetworkConfig', 'updateCaptureNetworkConfig', 'scanFactoryCameras', 'getHostAlias', 'removeHostAlias', 'setCameraNetwork', 'getCameraNetworkJob'];
    // Task 4 row V3 (blueprint row 146): operation 108 (the connection test of a registered camera with
    // its stored credential) carries the Device tag too. The contract only: no route answers it yet.
    const DEVICE_TEST_AREA = ['testCaptureDeviceConnection'];
    // Task 4 blueprint row 116: operations 109 and 110 (the acceptance of the installation and its
    // revocation) carry the Device tag too. The contract only: no route answers them yet (row 117).
    const ACCEPTANCE_AREA = ['acceptInstallation', 'revokeInstallationAcceptance'];
    // Task 4 row RD2: operation 111 (the retirement of a device) carries the Device tag too. The contract
    // only: no route answers it yet (row RD3).
    const RETIRE_AREA = ['retireCaptureDevice'];
    expect(area.map((operation) => operation.operationId)).toEqual([
      ...DEVICES_OPERATIONS, ...CAPTURE_CONFIG_AREA, ...STT_CONFIG_AREA, ...CAPTURE_DISCOVERY_AREA, ...AUDIO_CARD_AREA, ...READDRESS_AREA, ...COMMISSIONING_AREA, ...DEVICE_TEST_AREA, ...ACCEPTANCE_AREA, ...RETIRE_AREA,
    ]);
    expect(area.map(operationNumber).slice(0, DEVICES_OPERATIONS.length)).toEqual([null, null, null, 47, 48, 49, 50, 51, 52]);
    expect(area.slice(0, 3).map((operation) => operation.source)).toEqual(['Design book §21.2', 'Design book §21.2', 'Design book §21.2']);
    for (const operationId of DEVICES_OPERATIONS) expect(operationOf(operationId).operationId).toBe(operationId);
  });

  it('each route is the registry\'s route of the operation it names, and the guard holds the registry\'s rule for it', async () => {
    const { app, registered } = await build();
    const rules = permissionGuard(app).registeredRules();
    for (const route of moduleRoutes(registered)) {
      const operationId = String(route.config?.operationId);
      const operation = operationOf(operationId as (typeof DEVICES_OPERATIONS)[number]);
      const url = operation.path.replace('{id}', 'CAM-01');
      expect(matchCoreApiOperation(String(route.method), url)?.operation.operationId).toBe(operationId);
      expect(rules.find((rule) => rule.operationId === operationId)).toMatchObject({ method: route.method, url: route.url, kind: operation.access.kind });
    }
    const rule = (operationId: string) => rules.find((candidate) => candidate.operationId === operationId);
    expect(DEVICES_OPERATIONS.map((operationId) => [operationId, rule(operationId)?.kind, rule(operationId)?.permissions])).toEqual([
      ['getDeviceHealth', CoreApiAccessKind.AUTHENTICATED, []],
      ['getAudioStatus', CoreApiAccessKind.AUTHENTICATED, []],
      ['getVideoStatus', CoreApiAccessKind.AUTHENTICATED, []],
      ['getDeviceInventory', CoreApiAccessKind.AUTHENTICATED, []],
      ['restartDevice', CoreApiAccessKind.PERMISSION, ['DEVICE_MANAGE']],
      ['testDeviceSignal', CoreApiAccessKind.PERMISSION, ['DIAGNOSTICS_RUN']],
      ['identifyDevice', CoreApiAccessKind.PERMISSION, ['DIAGNOSTICS_RUN']],
      ['setActiveCamera', CoreApiAccessKind.AUTHENTICATED, []],
      ['resetMicClip', CoreApiAccessKind.AUTHENTICATED, []],
    ]);
  });

  it('the audit rule of the registry: the reads write nothing, the three device commands DEVICE_COMMAND, the two view commands nothing (parity)', () => {
    expect(registryEntries().map((operation) => [operation.operationId, operation.audit.success, operation.audit.denial])).toEqual([
      ['getDeviceHealth', CoreApiAuditNone.READ, 'ACCESS_DENIED'],
      ['getAudioStatus', CoreApiAuditNone.READ, 'ACCESS_DENIED'],
      ['getVideoStatus', CoreApiAuditNone.READ, 'ACCESS_DENIED'],
      ['getDeviceInventory', CoreApiAuditNone.READ, 'ACCESS_DENIED'],
      ['restartDevice', 'DEVICE_COMMAND', 'ACCESS_DENIED'],
      ['testDeviceSignal', 'DEVICE_COMMAND', 'ACCESS_DENIED'],
      ['identifyDevice', 'DEVICE_COMMAND', 'ACCESS_DENIED'],
      ['setActiveCamera', CoreApiAuditNone.PARITY, 'ACCESS_DENIED'],
      ['resetMicClip', CoreApiAuditNone.PARITY, 'ACCESS_DENIED'],
    ]);
  });

  it('no route carries a check of its own: no hook beside the stage hook of the server', async () => {
    const { registered } = await build();
    const routes = moduleRoutes(registered);
    expect(routes).toHaveLength(9);
    for (const route of routes) {
      expect(route.onRequest, route.url).toBeUndefined();
      expect(route.preParsing, route.url).toBeUndefined();
      expect(route.preValidation, route.url).toBeUndefined();
      expect(route.preHandler, route.url).toBeUndefined();
      expect(Object.keys(route.config ?? {}), route.url).toEqual(['operationId']);
    }
  });
});

describe('which device command each of the three operations runs (the contract table DEVICE_COMMAND_OPERATIONS; W83 closed the adapter of gap 3)', () => {
  it('the table has exactly the three operations the contract lists for deviceCommand, and each command exactly once', () => {
    expect(Object.keys(DEVICE_COMMAND_OF_OPERATION)).toEqual([...SIM_ACTION_OPERATIONS.deviceCommand.operations]);
    // Schema v2 (E-12; C3 §0/§3 op 48): POE_CYCLE joins the contract's command vocabulary and reaches
    // restartDevice too, but operation 48 decides RESTART versus PoE cycle from the body and the
    // stream state INSIDE the server-side path - the hosted ACTION `deviceCommand` still carries three
    // commands, so the server's per-operation map keeps them and excludes POE_CYCLE by decision
    // (`devices/operations.ts`, row 48). The reverse lookup therefore holds for the three action
    // commands; POE_CYCLE is asserted absent with its reason.
    for (const [command, operationId] of Object.entries(DEVICE_COMMAND_OPERATIONS)) {
      if (command === DeviceCommand.POE_CYCLE) continue;
      expect(DEVICE_COMMAND_OF_OPERATION[operationId], operationId).toBe(command);
    }
    expect(DEVICE_COMMAND_OPERATIONS[DeviceCommand.POE_CYCLE], 'POE_CYCLE names a contract operation').toBeDefined();
    expect(Object.values(DEVICE_COMMAND_OF_OPERATION).sort()).toEqual([DeviceCommand.IDENTIFY, DeviceCommand.RESTART, DeviceCommand.TEST_SIGNAL]);
    expect(DEVICE_COMMAND_OF_OPERATION).toEqual({ restartDevice: 'RESTART', testDeviceSignal: 'TEST_SIGNAL', identifyDevice: 'IDENTIFY' });
  });

  it('each command is the one its operation\'s path names, and the one the registry entry says the server runs', () => {
    for (const [operationId, command] of Object.entries(DEVICE_COMMAND_OF_OPERATION)) {
      const operation = operationOf(operationId as keyof typeof DEVICE_COMMAND_OF_OPERATION);
      // `/api/v1/device/{id}/test-signal` names TEST_SIGNAL.
      const verb = operation.path.split('/').at(-1) ?? '';
      expect(verb.toUpperCase().replaceAll('-', '_'), operation.path).toBe(command);
      expect(operation.path, operationId).toBe(`/api/v1/device/{id}/${verb}`);
      expect(operation.description, operationId).toContain(`deviceCommand(deviceId, '${command}')`);
      expect(operation.description, operationId).toContain(`\`details.command: ${command}\``);
      expect(operation.pathParam?.pattern, operationId).toBe(HARDWARE_DEVICE_ID_PATTERN);
    }
  });

  it('the hosted action of every operation of the module, as the contract maps it (spec §7.17)', () => {
    expect(DEVICES_OPERATIONS.map((operationId) => [operationId, hostedActionsOfOperation(operationId)])).toEqual([
      ['getDeviceHealth', []],
      ['getAudioStatus', []],
      ['getVideoStatus', []],
      ['getDeviceInventory', []],
      ['restartDevice', ['deviceCommand']],
      ['testDeviceSignal', ['deviceCommand']],
      ['identifyDevice', ['deviceCommand']],
      ['setActiveCamera', ['setActiveCamera']],
      ['resetMicClip', ['resetClip']],
    ]);
  });
});

// Task 4 row 53 (WP-10b): the ROUTES of a Core in real capture hand the flag on - the three reads that name a camera
// state the stored stream statement of each track's slot. The pure mapping is held in `status.test.ts`; this is the wiring.
describe('row 53: operations 44, 46 and 47 of a Core in REAL capture state the stream facts of the selector slots', () => {
  it('an HEVC slot is answered HEVC with no rate, an H.264 one as before, valid against the contract; a SIMULATED Core on the same state answers its slice', async () => {
    const seeded = committedOf(scenarioState('idle'));
    const state = { ...seeded, captureConfig: { ...seeded.captureConfig, cameras: seeded.captureConfig.cameras.map((camera) => ({ ...camera, profile: camera.trackId === 'VIDEO-01' ? 'HEVC_1080P' : 'H264_1080P25' })) } };
    const facts = (cameras: readonly { readonly resolution: string | null; readonly fps: number | null; readonly codec: string | null }[]): unknown[] => cameras.map((camera) => [camera.resolution, camera.fps, camera.codec]);
    const STREAM = [['1080p', null, 'HEVC'], ['1080p', 25, 'H.264']];
    const SLICE = facts(seeded.cameras);
    // A real capture operation (the demo controls off, as the one function of the flags requires); then a SIMULATED Core.
    for (const [config, expected] of [[{ captureMode: 'real', demoControls: false }, STREAM], [{}, SLICE]] as const) {
      const built = await build(state, config);
      built.actAs(operatorOf('SUPERVISOR'));
      const video = await get(built, VIDEO);
      expect(video.statusCode, video.body).toBe(200);
      expect(facts((video.json() as { tracks: Parameters<typeof facts>[0] }).tracks)).toEqual(expected);
      expect(validateCoreApiResponse('getVideoStatus', 200, video.json())).toEqual({ ok: true });
      const health = await get(built, HEALTH);
      expect(facts((health.json() as { cameras: Parameters<typeof facts>[0] }).cameras)).toEqual(expected);
      expect(validateCoreApiResponse('getDeviceHealth', 200, health.json())).toEqual({ ok: true });
      const inventory = await get(built, INVENTORY);
      expect(facts((inventory.json() as { cameras: Parameters<typeof facts>[0] }).cameras)).toEqual(expected);
      expect(validateCoreApiResponse('getDeviceInventory', 200, inventory.json())).toEqual({ ok: true });
      expect(built.engine.commands).toEqual([]);
    }
  });

  // Wave 12, row CB (review 060c finding R-01; decision C36): the WIRING of the bitrate rule - the pure mapping is in
  // `status.test.ts`. Seen RED on: the flag not handed to one read (`videoStatusOf(state, captureSlotsOf(state))`,
  // `deviceHealthOf(...)` without it, `deviceInventoryOf(app.engine.state())`) - that read then answers 9 in real capture.
  it('row CB (R-01): on a Core in REAL capture each of the three reads that carry a camera\'s bitrate answers null, valid against the contract; a SIMULATED Core on the same state answers the simulator\'s 9', async () => {
    const state = committedOf(scenarioState('idle'));
    expect(state.cameras.map((camera) => camera.bitrateMbps)).toEqual([9, 9]);
    const bitrates = (entries: readonly { readonly bitrateMbps: number | null }[]): unknown[] => entries.map((entry) => entry.bitrateMbps);
    for (const [config, expected] of [[{ captureMode: 'real', demoControls: false }, [null, null]], [{}, [9, 9]]] as const) {
      const built = await build(state, config);
      built.actAs(operatorOf('SUPERVISOR'));
      const video = await get(built, VIDEO);
      expect(video.statusCode, video.body).toBe(200);
      expect(bitrates((video.json() as { tracks: Parameters<typeof bitrates>[0] }).tracks)).toEqual(expected);
      expect(validateCoreApiResponse('getVideoStatus', 200, video.json())).toEqual({ ok: true });
      const health = await get(built, HEALTH);
      expect(health.statusCode, health.body).toBe(200);
      expect(bitrates((health.json() as { cameras: Parameters<typeof bitrates>[0] }).cameras)).toEqual(expected);
      expect(validateCoreApiResponse('getDeviceHealth', 200, health.json())).toEqual({ ok: true });
      const inventory = await get(built, INVENTORY);
      expect(inventory.statusCode, inventory.body).toBe(200);
      expect(bitrates((inventory.json() as { cameras: Parameters<typeof bitrates>[0] }).cameras)).toEqual(expected);
      expect(validateCoreApiResponse('getDeviceInventory', 200, inventory.json())).toEqual({ ok: true });
      // The member is PRESENT and null - not left out: a reader that goes by null finds it.
      expect((video.json() as { tracks: object[] }).tracks.every((track) => Object.hasOwn(track, 'bitrateMbps'))).toBe(true);
    }
  });
});

describe('operations 44 to 47: a read answers from the committed state of the engine', () => {
  it.each(ROLES)('%s reads all four: 200, the pure mapping of the committed state, valid against the contract; no command, no statement', async (role) => {
    const state = committedOf(scenarioState('recording'));
    const built = await build(state);
    built.actAs(operatorOf(role));

    const before = Date.now();
    const health = await get(built, HEALTH);
    const after = Date.now();
    expect(health.statusCode).toBe(200);
    const serverTime = Date.parse((health.json() as { serverTime: string }).serverTime);
    expect(serverTime).toBeGreaterThanOrEqual(before);
    expect(serverTime).toBeLessThanOrEqual(after);
    expect(health.json()).toEqual(deviceHealthOf(state, serverTime));
    expect(validateCoreApiResponse('getDeviceHealth', 200, health.json())).toEqual({ ok: true });

    const audio = await get(built, AUDIO);
    expect(audio.statusCode).toBe(200);
    expect(audio.json()).toEqual(audioStatusOf(state, serverTime));
    expect(validateCoreApiResponse('getAudioStatus', 200, audio.json())).toEqual({ ok: true });

    const video = await get(built, VIDEO);
    expect(video.statusCode).toBe(200);
    expect(video.json()).toEqual(videoStatusOf(state));
    expect(validateCoreApiResponse('getVideoStatus', 200, video.json())).toEqual({ ok: true });

    const inventory = await get(built, INVENTORY);
    expect(inventory.statusCode).toBe(200);
    expect(inventory.json()).toEqual(JSON.parse(JSON.stringify(deviceInventoryOf(state))));
    expect(validateCoreApiResponse('getDeviceInventory', 200, inventory.json())).toEqual({ ok: true });
    // Schema v2 (C3 §3 op 47; SH-12): the selector snapshot joins the answer (E-04: its own slice,
    // never the paired-client registry; RK-12: no credential member anywhere in it).
    expect(Object.keys(inventory.json() as object)).toEqual(['device', 'cameras', 'mics', 'otherDevices', 'ports', 'activeCameraId', 'tabletLink', 'captureConfig']);

    expect(built.engine.reads).toBe(4);
    expect(built.engine.commands).toEqual([]);
    expect(built.queries).toEqual([]);
    // API-7 names the state position on a POST's 2xx; a read carries neither header.
    for (const response of [health, audio, video, inventory]) {
      expect(response.headers['x-dems-revision']).toBeUndefined();
      expect(response.headers['x-dems-epoch']).toBeUndefined();
      expect(response.headers['x-dems-simulated']).toBeUndefined();
    }
  });

  it('a read follows the committed state: what the engine holds at the call is what is answered', async () => {
    const built = await build(committedOf(scenarioState('idle')));
    built.actAs(operatorOf('TECHNICIAN'));
    expect((await get(built, VIDEO)).json()).toMatchObject({ tracks: [{ recState: null }, { recState: null }] });
    expect((await get(built, INVENTORY)).json()).toMatchObject({ activeCameraId: 'VIDEO-01' });

    built.engine.state = committedOf({ ...scenarioState('fault-demo'), activeCameraId: 'VIDEO-02' });
    expect((await get(built, VIDEO)).json()).toMatchObject({ tracks: [{ recState: 'REC', online: true }, { recState: 'LOST', online: false, lens: 'FAULT' }] });
    expect((await get(built, AUDIO)).json()).toMatchObject({ channels: [{ state: 'READY', clip: false }, { state: 'CLIP', clip: true }] });
    expect((await get(built, HEALTH)).json()).toMatchObject({ systemState: 'CRITICAL' });
    expect((await get(built, INVENTORY)).json()).toMatchObject({ activeCameraId: 'VIDEO-02' });
  });

  it('operations 44 and 45 answer the levels of the engine\'s newest meter frame; before the first frame, those the committed state decides', async () => {
    const state = committedOf(scenarioState('idle'));
    const built = await build(state);
    built.actAs(operatorOf('TECHNICIAN'));
    const levels = (body: unknown): unknown => (body as { channels: Array<{ dbfs: number; peak: number }> }).channels.map((channel) => [channel.dbfs, channel.peak]);

    // The double answers null: no frame yet.
    const before = (await get(built, AUDIO)).json() as unknown;
    expect(before).toEqual(audioStatusOf(state, 0));

    let asked = 0;
    // Schema v2 (SH-17/SH-25; E-02): the engine's meter frame carries the mic INPUTS, keyed by
    // MIC-01/MIC-02, plus the active input - the re-keyed `meters.audio` slice.
    const frame = {
      at: 1,
      seq: 1,
      audio: {
        inputs: {
          'MIC-01': { seq: 1, at: 1, dbfs: -18.5, peak: -17.25, clip: false, noSignal: false },
          'MIC-02': { seq: 1, at: 1, dbfs: -33.75, peak: -30.5, clip: false, noSignal: false },
        },
        activeInputId: 'MIC-01',
      },
    } as const;
    built.engine.host.meters = () => {
      asked += 1;
      return frame;
    };
    const audio = (await get(built, AUDIO)).json() as unknown;
    expect(levels(audio)).toEqual([
      [-18.5, -17.25],
      [-33.75, -30.5],
    ]);
    expect(audio).toEqual(audioStatusOf(state, 0, frame));
    expect(validateCoreApiResponse('getAudioStatus', 200, audio)).toEqual({ ok: true });
    const health = (await get(built, HEALTH)).json() as { audio: unknown };
    expect(health.audio).toEqual((audio as { channels: unknown }).channels);
    expect(asked).toBe(2);
    // The two reads without audio channels do not ask for a frame.
    await get(built, VIDEO);
    await get(built, INVENTORY);
    expect(asked).toBe(2);
  });

  it('while the engine is not running every read answers 503 NOT_READY, as the engine seam refuses', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    built.engine.running = false;
    built.engine.notRunning = notReady();
    for (const [operationId, url] of [
      ['getDeviceHealth', HEALTH],
      ['getAudioStatus', AUDIO],
      ['getVideoStatus', VIDEO],
      ['getDeviceInventory', INVENTORY],
    ] as const) {
      const response = await get(built, url);
      expect(outcome(response), url).toEqual([503, 'NOT_READY']);
      expect(validateCoreApiResponse(operationId, 503, response.json()), url).toEqual({ ok: true });
    }
  });

  it('a state the contract refuses never leaves the server: the response schema answers 500 without a detail', async () => {
    const state = scenarioState('idle');
    const marker = 'MARK-w36-not-a-lens';
    const broken = committedOf({ ...state, cameras: state.cameras.map((camera) => ({ ...camera, lens: marker as typeof camera.lens })) });
    const built = await build(broken);
    built.actAs(operatorOf('INVESTIGATOR'));
    for (const url of [VIDEO, HEALTH, INVENTORY]) {
      const response = await get(built, url);
      expect(outcome(response), url).toEqual([500, 'INTERNAL_ERROR']);
      expect(response.body, url).not.toContain(marker);
    }
    // The audio answer does not hold a camera: it is still served.
    expect((await get(built, AUDIO)).statusCode).toBe(200);
  });
});

describe('operations 48 to 52: one hosted command with the caller\'s principal, answered 204 with the state position', () => {
  it.each([
    ['restartDevice', restart('CAM-02'), 'TECHNICIAN', ['CAM-02', 'RESTART']],
    ['testDeviceSignal', testSignal('MIC-01'), 'INVESTIGATOR', ['MIC-01', 'TEST_SIGNAL']],
    ['identifyDevice', identify('FRONT-PANEL'), 'SUPERVISOR', ['FRONT-PANEL', 'IDENTIFY']],
  ] as const)('%s runs deviceCommand(id, command) once', async (operationId, url, role, args) => {
    const built = await build();
    const principal = operatorOf(role);
    built.actAs(principal);

    const response = await post(built, url);
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
    expect(validateCoreApiResponse(operationId, 204, bodyOf(response))).toEqual({ ok: true });
    expect(built.engine.commands).toEqual([{ principal, action: 'deviceCommand', args }]);
    // The principal of the request, as it is: not a copy, not a request field.
    expect(built.engine.commands[0]?.principal).toBe(principal);
    // API-7: the epoch and the revision of the command's outcome.
    expect(response.headers['x-dems-epoch']).toBe(String(DOUBLE_EPOCH));
    expect(response.headers['x-dems-revision']).toBe(String(DOUBLE_REVISION + 1));
    expect(built.engine.reads).toBe(0);
    expect(built.queries).toEqual([]);
  });

  it('setActiveCamera runs setActiveCamera(cameraId), resetMicClip runs resetClip(channel); every role may call both', async () => {
    const built = await build();
    for (const role of ROLES) {
      const principal = operatorOf(role);
      built.actAs(principal);
      built.engine.commands.length = 0;

      const camera = await post(built, ACTIVE_CAMERA, { cameraId: 'VIDEO-02' });
      expect(camera.statusCode, role).toBe(204);
      expect(camera.body).toBe('');
      expect(validateCoreApiResponse('setActiveCamera', 204, bodyOf(camera))).toEqual({ ok: true });
      const clip = await post(built, CLIP_RESET, { channel: 'AUDIO-01' });
      expect(clip.statusCode, role).toBe(204);
      expect(validateCoreApiResponse('resetMicClip', 204, bodyOf(clip))).toEqual({ ok: true });

      expect(built.engine.commands).toEqual([
        { principal, action: 'setActiveCamera', args: ['VIDEO-02'] },
        { principal, action: 'resetClip', args: ['AUDIO-01'] },
      ]);
      // The principal of the request, as it is.
      expect(built.engine.commands.every((command) => command.principal === principal), role).toBe(true);
      expect(Number(clip.headers['x-dems-revision'])).toBe(Number(camera.headers['x-dems-revision']) + 1);
      expect(clip.headers['x-dems-epoch']).toBe(String(DOUBLE_EPOCH));
    }
  });

  it('a body key the schema does not know is dropped, and a device command ignores a body: the action gets its own arguments only', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    expect((await post(built, ACTIVE_CAMERA, { cameraId: 'VIDEO-01', actorId: 'OPR-001', at: 1, revision: 99 })).statusCode).toBe(204);
    expect((await post(built, CLIP_RESET, { channel: 'AUDIO-02', deviceId: 'MIC-01' })).statusCode).toBe(204);
    expect((await post(built, restart('CAM-01'), { command: 'IDENTIFY', deviceId: 'CAM-02', actorId: 'OPR-002' })).statusCode).toBe(204);
    expect(built.engine.commands.map((command) => [command.action, command.args])).toEqual([
      ['setActiveCamera', ['VIDEO-01']],
      ['resetClip', ['AUDIO-02']],
      ['deviceCommand', ['CAM-01', 'RESTART']],
    ]);
  });

  it.each([
    ['restartDevice', restart('CAM-01'), new SimTransitionError('RECORDING', 'deviceCommand', 'restart is unavailable while recording', SimErrorCode.RECORDING_ACTIVE), [409, 'RECORDING_ACTIVE'], { simCode: 'RECORDING_ACTIVE', from: 'RECORDING', event: 'deviceCommand' }],
    ['restartDevice', restart('GNSS'), new SimTransitionError(null, 'deviceCommand', 'GNSS accepts IDENTIFY only', SimErrorCode.COMMAND_UNSUPPORTED), [409, 'COMMAND_UNSUPPORTED'], { simCode: 'COMMAND_UNSUPPORTED', from: null, event: 'deviceCommand' }],
    ['testDeviceSignal', testSignal('TPM'), new SimTransitionError(null, 'deviceCommand', 'TPM accepts IDENTIFY only', SimErrorCode.COMMAND_UNSUPPORTED), [409, 'COMMAND_UNSUPPORTED'], { simCode: 'COMMAND_UNSUPPORTED', from: null, event: 'deviceCommand' }],
    ['restartDevice', restart('CAM-99'), new SimNotFoundError('device', 'CAM-99'), [404, 'NOT_FOUND'], { simCode: 'NOT_FOUND' }],
    ['testDeviceSignal', testSignal('MIC-09'), new SimNotFoundError('device', 'MIC-09'), [404, 'NOT_FOUND'], { simCode: 'NOT_FOUND' }],
    ['identifyDevice', identify('NOPE'), new SimNotFoundError('device', 'NOPE'), [404, 'NOT_FOUND'], { simCode: 'NOT_FOUND' }],
  ] as const)('%s %s: a refusal of the simulator leaves as the engine mapped it', async (operationId, url, thrown, expected, details) => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    built.engine.refuseWith = simRefusal(thrown);

    const response = await post(built, url);
    expect(outcome(response)).toEqual(expected);
    expect(errorOf(response).details).toEqual(details);
    expect(validateCoreApiResponse(operationId, response.statusCode, response.json())).toEqual({ ok: true });
    // The answer names no part of the input and nothing of the simulator's own text.
    expect(response.body).not.toContain(thrown.message);
    // API-7 speaks of 2xx answers: a refusal carries neither header.
    expect(response.headers['x-dems-revision']).toBeUndefined();
    expect(response.headers['x-dems-epoch']).toBeUndefined();
    expect(built.engine.commands).toHaveLength(1);
  });

  it('a unit the server could not run or commit answers 503 NOT_READY; anything else the engine throws answers 500 without a detail', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    for (const [operationId, url, payload] of [
      ['restartDevice', restart('CAM-01'), undefined],
      ['testDeviceSignal', testSignal('MIC-01'), undefined],
      ['identifyDevice', identify('TPM'), undefined],
      ['setActiveCamera', ACTIVE_CAMERA, { cameraId: 'VIDEO-02' }],
      ['resetMicClip', CLIP_RESET, { channel: 'AUDIO-01' }],
    ] as const) {
      built.engine.refuseWith = notReady();
      const unavailable = await post(built, url, payload);
      expect(outcome(unavailable), operationId).toEqual([503, 'NOT_READY']);
      expect(validateCoreApiResponse(operationId, 503, unavailable.json()), operationId).toEqual({ ok: true });

      const marker = 'MARK-w36-engine-defect';
      built.engine.refuseWith = new Error(`a defect ${marker}`);
      const failed = await post(built, url, payload);
      expect(outcome(failed), operationId).toEqual([500, 'INTERNAL_ERROR']);
      expect(failed.body, operationId).not.toContain(marker);
      expect(validateCoreApiResponse(operationId, 500, failed.json()), operationId).toEqual({ ok: true });
      expect(failed.headers['x-dems-revision'], operationId).toBeUndefined();
    }
    // The unexpected failure is on the persistent error path of the envelope: one error line each.
    expect(built.log.lines().filter((line) => line['msg'] === 'unexpected error while handling a request')).toHaveLength(5);
  });
});

describe('stage 7: a malformed path ID or body is refused before the engine is reached', () => {
  it('a device ID outside the registry\'s pattern answers 422 INVALID_INPUT for all three commands', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const malformed = ['cam-01', 'CAM_01', '1CAM', '-CAM', 'CAM.01', 'CAM%2001', 'CAM-01%00', 'DEV-0001x', `A${'B'.repeat(32)}`, 'Kamera-1', '%F0%9F%8E%A5'];
    for (const id of malformed) {
      expect(HARDWARE_DEVICE_ID_PATTERN.test(decodeURIComponent(id)), id).toBe(false);
      for (const [operationId, url] of [
        ['restartDevice', restart(id)],
        ['testDeviceSignal', testSignal(id)],
        ['identifyDevice', identify(id)],
      ] as const) {
        const response = await post(built, url);
        expect(outcome(response), url).toEqual([422, 'INVALID_INPUT']);
        expect(errorOf(response).details, url).toEqual({ in: 'params' });
        expect(validateCoreApiResponse(operationId, 422, response.json()), url).toEqual({ ok: true });
        // The answer does not repeat the input.
        expect(response.body, url).not.toContain(decodeURIComponent(id));
      }
    }
    expect(built.engine.commands).toEqual([]);
  });

  it('every ID of the pattern reaches the engine as it was sent: whether the Core has such a device is the simulator\'s answer', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const wellFormed = ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02', 'POE-SWITCH', 'GNSS', 'TPM', 'FRONT-PANEL', 'X', 'DEV-0001', `A${'B'.repeat(31)}`];
    for (const id of wellFormed) expect((await post(built, identify(id))).statusCode, id).toBe(204);
    expect(built.engine.commands.map((command) => command.args)).toEqual(wellFormed.map((id) => [id, 'IDENTIFY']));
  });

  it('a device command takes no body, but a body that is no JSON object is still refused by the parser: 400 INVALID_JSON, and the engine is not reached', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN'));
    const json = { 'content-type': 'application/json' };
    for (const [operationId, url] of [
      ['restartDevice', restart('CAM-01')],
      ['testDeviceSignal', testSignal('MIC-01')],
      ['identifyDevice', identify('GNSS')],
    ] as const) {
      for (const payload of ['{"command":', '["RESTART"]', '"RESTART"', 'null']) {
        const response = await post(built, url, payload, json);
        expect(outcome(response), `${operationId} ${payload}`).toEqual([400, 'INVALID_JSON']);
      }
      // Gap W36-1, closed by the contract close-out W83: the 400 of a body that is no JSON object is
      // an envelope-level answer of every POST, so the contract accepts it.
      const verdict = validateCoreApiResponse(operationId, 400, (await post(built, url, '{"command":', json)).json());
      expect(verdict, operationId).toEqual({ ok: true });
      // An empty body and an empty object are what a client sends: both run the command.
      expect((await post(built, url, '', json)).statusCode, operationId).toBe(204);
      expect((await post(built, url, {})).statusCode, operationId).toBe(204);
    }
    expect(built.engine.commands).toHaveLength(6);
  });

  it('setActiveCamera and resetMicClip: a body outside the schema answers 422, a body that is no JSON object 400', async () => {
    const built = await build();
    built.actAs(operatorOf('INVESTIGATOR'));
    const cases: ReadonlyArray<readonly [operationId: 'setActiveCamera' | 'resetMicClip', url: string, payload: object | string | undefined, expected: [number, string]]> = [
      ['setActiveCamera', ACTIVE_CAMERA, undefined, [422, 'INVALID_INPUT']],
      ['setActiveCamera', ACTIVE_CAMERA, {}, [422, 'INVALID_INPUT']],
      ['setActiveCamera', ACTIVE_CAMERA, { cameraId: 'VIDEO-03' }, [422, 'INVALID_INPUT']],
      ['setActiveCamera', ACTIVE_CAMERA, { cameraId: 'AUDIO-01' }, [422, 'INVALID_INPUT']],
      ['setActiveCamera', ACTIVE_CAMERA, { cameraId: 'video-01' }, [422, 'INVALID_INPUT']],
      ['setActiveCamera', ACTIVE_CAMERA, { cameraId: 1 }, [422, 'INVALID_INPUT']],
      ['setActiveCamera', ACTIVE_CAMERA, { cameraId: ['VIDEO-01'] }, [422, 'INVALID_INPUT']],
      ['setActiveCamera', ACTIVE_CAMERA, { cameraId: null }, [422, 'INVALID_INPUT']],
      ['setActiveCamera', ACTIVE_CAMERA, '["VIDEO-01"]', [400, 'INVALID_JSON']],
      ['setActiveCamera', ACTIVE_CAMERA, '{"cameraId":', [400, 'INVALID_JSON']],
      ['resetMicClip', CLIP_RESET, undefined, [422, 'INVALID_INPUT']],
      ['resetMicClip', CLIP_RESET, {}, [422, 'INVALID_INPUT']],
      ['resetMicClip', CLIP_RESET, { channel: 'AUDIO-03' }, [422, 'INVALID_INPUT']],
      ['resetMicClip', CLIP_RESET, { channel: 'VIDEO-01' }, [422, 'INVALID_INPUT']],
      ['resetMicClip', CLIP_RESET, { channel: 'MIC-01' }, [422, 'INVALID_INPUT']],
      ['resetMicClip', CLIP_RESET, { channel: true }, [422, 'INVALID_INPUT']],
      ['resetMicClip', CLIP_RESET, '"AUDIO-01"', [400, 'INVALID_JSON']],
      ['resetMicClip', CLIP_RESET, 'channel=AUDIO-01', [400, 'INVALID_JSON']],
    ];
    for (const [operationId, url, payload, expected] of cases) {
      const response = await post(built, url, payload, typeof payload === 'string' ? { 'content-type': 'application/json' } : {});
      expect(outcome(response), `${operationId} ${JSON.stringify(payload)}`).toEqual(expected);
      expect(validateCoreApiResponse(operationId, response.statusCode, response.json()), `${operationId} ${JSON.stringify(payload)}`).toEqual({ ok: true });
      if (response.statusCode === 422) expect(errorOf(response).details).toEqual({ in: 'body' });
    }
    expect(built.engine.commands).toEqual([]);
  });
});

describe('who may call is the guard\'s question, answered before the handler', () => {
  const calls = (): ReadonlyArray<readonly [operationId: (typeof DEVICES_OPERATIONS)[number], method: 'GET' | 'POST', url: string, payload?: object]> => [
    ['getDeviceHealth', 'GET', HEALTH],
    ['getAudioStatus', 'GET', AUDIO],
    ['getVideoStatus', 'GET', VIDEO],
    ['getDeviceInventory', 'GET', INVENTORY],
    ['restartDevice', 'POST', restart('CAM-01')],
    ['testDeviceSignal', 'POST', testSignal('MIC-01')],
    ['identifyDevice', 'POST', identify('GNSS')],
    ['setActiveCamera', 'POST', ACTIVE_CAMERA, { cameraId: 'VIDEO-02' }],
    ['resetMicClip', 'POST', CLIP_RESET, { channel: 'AUDIO-01' }],
  ];
  const call = (built: UnitApp, method: 'GET' | 'POST', url: string, payload?: object | string): Promise<LightMyRequestResponse> =>
    method === 'GET' ? get(built, url) : post(built, url, payload);

  it('nobody without a session reaches a handler: 401 NOT_SIGNED_IN on all nine, also for a paired device without an operator', async () => {
    const built = await build();
    for (const principal of [ANONYMOUS, { kind: 'DEVICE', deviceId: 'DEV-0001' } as const]) {
      built.actAs(principal);
      for (const [operationId, method, url, payload] of calls()) {
        const response = await call(built, method, url, payload);
        expect(outcome(response), `${principal.kind} ${operationId}`).toEqual([401, 'NOT_SIGNED_IN']);
        expect(validateCoreApiResponse(operationId, 401, response.json()), operationId).toEqual({ ok: true });
      }
    }
    expect(built.engine.reads).toBe(0);
    expect(built.engine.commands).toEqual([]);
  });

  it('SR-44: a caller without a session is refused before the body and the path ID are looked at', async () => {
    const built = await build();
    expect(outcome(await post(built, restart('not a device id')))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcome(await post(built, ACTIVE_CAMERA, { cameraId: 'VIDEO-99' }))).toEqual([401, 'NOT_SIGNED_IN']);
    expect(outcome(await post(built, CLIP_RESET, '{"channel":', { 'content-type': 'application/json' }))).toEqual([401, 'NOT_SIGNED_IN']);
  });

  it('an operator whose permissions lack the one the registry names never reaches the engine; one who holds it does, whatever the role says', async () => {
    const built = await build();
    for (const [url, permission] of [
      [restart('CAM-01'), 'DEVICE_MANAGE'],
      [testSignal('MIC-01'), 'DIAGNOSTICS_RUN'],
      [identify('TPM'), 'DIAGNOSTICS_RUN'],
    ] as const) {
      built.engine.commands.length = 0;
      // Without a database the guard cannot write its ACCESS_DENIED row, so its answer here is
      // not the 403 of the database test; what holds in both is that the handler does not run.
      built.actAs(operatorOf('TECHNICIAN', ['EVIDENCE_VIEW', 'MAINTENANCE']));
      expect((await post(built, url)).statusCode, url).toBeGreaterThanOrEqual(400);
      expect(built.engine.commands, url).toEqual([]);

      built.actAs(operatorOf('INVESTIGATOR', [permission]));
      expect((await post(built, url)).statusCode, url).toBe(204);
      expect(built.engine.commands, url).toHaveLength(1);
    }
  });
});
