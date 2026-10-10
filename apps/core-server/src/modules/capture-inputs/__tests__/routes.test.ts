// Operation 97 `rescanCaptureInputs` without a database (blueprint row 133; contract C3 §2.6 op 97,
// §4, §5.2; specs R-10 AC-2, AC-4; decision D80(5); check M4-MIC-RESCAN-1).
//
// The real app factory with this module registered, the REAL access rule (stage 6) and, behind the
// seam `engine`, a stand-in on a real shared simulator (`support.ts`). What is STORED is the
// database test's (`no-device.db.test.ts`). Each `it` holds its negative control.
import { CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS, CAPTURE_SEARCH_ID_PATTERN, CORE_API_OPERATIONS, CoreApiAccessKind, validateCoreApiResponse } from '@dems/shared/api';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { captureNotices } from '../../../capture-notices';
import { AudioInputErrorCode } from '../../../capture/adapters';
import { routePatternOf } from '../../../plugins/permission-guard';
import { bodyOf, errorOf, operatorOf, outcome } from '../../devices/__tests__/support';
import { CAPTURE_INPUTS_MODULE_OPERATIONS, CAPTURE_INPUTS_UNIT_LABEL, captureInputsOperation, rescanSearchId } from '../index';
import { RESCAN, inputsUnitApp, stoppableFakes, type InputsUnitApp, type StoppableFakes } from './support';

const apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

async function build(options: Parameters<typeof inputsUnitApp>[0] = {}, withProbe = true): Promise<InputsUnitApp & { adapters: StoppableFakes }> {
  const built = await inputsUnitApp(options);
  apps.push(built.app);
  const adapters = stoppableFakes();
  if (withProbe) captureNotices(built.app).provideProbe(adapters.probe);
  return Object.assign(built, { adapters });
}

interface Scan {
  scannedAt: number;
  inputs: { deviceId: string; inputId: string | null; present: boolean; adapter?: string; sourceClass?: string; errorCode: string | null }[];
  unregisteredCount: number;
}

describe('the route of the module', () => {
  it('is operation 97 of the registry: POST, its path, CAPTURE_CONFIG, and it has no hook of its own', () => {
    const operation = captureInputsOperation('rescanCaptureInputs');
    expect([operation.method, routePatternOf(operation.path)]).toEqual(['post', RESCAN]);
    expect(operation.access).toMatchObject({ kind: CoreApiAccessKind.PERMISSION, permission: 'CAPTURE_CONFIG' });
    expect(CORE_API_OPERATIONS.filter((candidate) => candidate.path === operation.path).map((candidate) => candidate.operationId)).toEqual([...CAPTURE_INPUTS_MODULE_OPERATIONS]);
  });

  it('the ID of a re-read fits the search-ID pattern and is never an ID of a six-digit counter', () => {
    const id = rescanSearchId(Date.UTC(2026, 9, 1, 3, 0, 0));
    expect(id).toMatch(CAPTURE_SEARCH_ID_PATTERN);
    expect(id).toHaveLength('DSC-'.length + 13);
    expect(rescanSearchId(1)).toBe('DSC-0000000000001');
  });
});

describe('M4-MIC-RESCAN-1: one call re-reads the local inputs', () => {
  // Fix wave H (G70-01, decision D196): `adapter` / `sourceClass` are stated by a Core that captures
  // for real and by no other. The two cases that read them run in real capture since then; what a
  // SIMULATED Core answers is pinned by the two cases at the end of this block.
  it('one entry per registered microphone, the shape of the contract, ONE search row with scope MIC_LOCAL, 0 camera probes and 0 searches', async () => {
    const built = await build({ captureMode: 'real' });
    built.actAs(operatorOf('SUPERVISOR'));
    const devicesBefore = built.sim.store.getState().captureDevices.devices.map((device) => device.id);
    const response = await built.post();
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('rescanCaptureInputs', 200, bodyOf(response))).toEqual({ ok: true });
    const scan = response.json() as Scan;
    expect(scan).toEqual({
      scannedAt: built.clock.now(),
      inputs: [
        { deviceId: 'MIC-01', inputId: 'MIC-01', present: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', errorCode: null },
        { deviceId: 'MIC-02', inputId: 'MIC-02', present: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', errorCode: null },
      ],
      unregisteredCount: 0,
    });
    // The re-read is enumerate and nothing else: no camera was asked, no search was run.
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([1, 1]);
    expect(built.adapters.fakes.mics.flatMap((mic) => mic.calls.opened)).toEqual([]);
    expect(built.adapters.reads).toEqual([]);
    expect(built.adapters.fakes.cameras.map((camera) => camera.calls.discover)).toEqual([0, 0]);

    expect(built.units).toEqual([CAPTURE_INPUTS_UNIT_LABEL]);
    expect(built.appended).toHaveLength(1);
    const [row] = built.appended;
    expect(row).toMatchObject({ type: 'CAPTURE_DISCOVERY_SEARCHED', actorId: operatorOf('SUPERVISOR').kind === 'OPERATOR' ? 'OPR-002' : null, deviceId: null });
    expect(row?.details).toEqual({
      searchId: rescanSearchId(built.clock.now()),
      scope: 'MIC_LOCAL',
      trigger: 'MANUAL',
      outcome: 'COMPLETE',
      responderCount: 2,
      newCount: 0,
      registeredCount: 2,
      interfaceCount: 0,
      operationId: 'rescanCaptureInputs',
      permission: 'CAPTURE_CONFIG',
    });
    // It registers nothing and raises nothing.
    expect(built.sim.store.getState().captureDevices.devices.map((device) => device.id)).toEqual(devicesBefore);
    expect(built.sim.store.getState().alerts.filter((alert) => alert.kind === 'SYSTEM')).toEqual([]);
  });

  it('a removed microphone is reported absent with its named cause and reads not online; it is never replaced; plugged back it reads online again', async () => {
    const built = await build({ captureMode: 'real' });
    built.actAs(operatorOf('TECHNICIAN'));
    const online = () => built.sim.store.getState().captureDevices.devices.filter((device) => device.kind === 'MIC').map((device) => [device.id, device.online]);
    built.adapters.fakes.mics[1]?.setPresent(false, AudioInputErrorCode.PERMISSION_DENIED);

    const first = (await built.post()).json() as Scan;
    expect(first.inputs).toEqual([
      { deviceId: 'MIC-01', inputId: 'MIC-01', present: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', errorCode: null },
      { deviceId: 'MIC-02', inputId: 'MIC-02', present: false, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', errorCode: 'PERMISSION_DENIED' },
    ]);
    expect(online()).toEqual([['MIC-01', true], ['MIC-02', false]]);
    expect(built.appended.at(-1)?.details).toMatchObject({ responderCount: 1, registeredCount: 2 });
    // Presence only: the alert of an unreachable microphone belongs to a pre-check run.
    expect(built.sim.store.getState().alerts.filter((alert) => alert.kind === 'SYSTEM')).toEqual([]);
    expect(built.sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_DEVICE_UNREACHABLE')).toEqual([]);

    built.adapters.fakes.mics[1]?.setPresent(true);
    built.clock.advance(CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS);
    const second = (await built.post()).json() as Scan;
    expect(second.inputs.map((input) => [input.deviceId, input.present, input.errorCode])).toEqual([['MIC-01', true, null], ['MIC-02', true, null]]);
    expect(online()).toEqual([['MIC-01', true], ['MIC-02', true]]);
  });

  it('allowed while a session is open, and the row names that session', async () => {
    const built = await build();
    built.sim.actions.signIn('budi.santoso', 'demo-2026');
    built.sim.actions.createSession({ caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
    const sessionId = built.sim.store.getState().session?.id;
    built.actAs(operatorOf('SUPERVISOR'));
    expect((await built.post()).statusCode).toBe(200);
    expect(built.appended.at(-1)?.details).toMatchObject({ sessionId });
  });

  it('the spacing limit: a second re-read inside the interval is 429 with retry-after, reads nothing and writes no row; after it, 200', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    expect((await built.post()).statusCode).toBe(200);

    built.clock.advance(CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS - 1_500);
    const limited = await built.post();
    expect(outcome(limited)).toEqual([429, 'RATE_LIMITED']);
    expect(errorOf(limited).details).toEqual({ reason: 'INPUT_RESCAN_RATE_LIMITED' });
    expect(limited.headers['retry-after']).toBe('2');
    expect(built.appended).toHaveLength(1);
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([1, 1]);
    // Another operator is the same Core: still limited.
    built.actAs(operatorOf('TECHNICIAN'));
    expect(outcome(await built.post())).toEqual([429, 'RATE_LIMITED']);

    // Control: once the interval has passed the same request is a re-read again.
    built.clock.advance(1_500);
    expect((await built.post()).statusCode).toBe(200);
    expect(built.appended).toHaveLength(2);
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([2, 2]);
  });
});

describe('who may call, and when it is not ready', () => {
  it('INVESTIGATOR never reaches the handler: nothing is read, no unit runs; no session is 401; SUPERVISOR and TECHNICIAN pass', async () => {
    const built = await build();
    built.actAs(operatorOf('INVESTIGATOR'));
    // Without a database the guard cannot write its ACCESS_DENIED row, so its answer here is not
    // the 403 of the database test (`no-device.db.test.ts`); what holds in both is that the
    // handler does not run.
    expect((await built.post()).statusCode).toBeGreaterThanOrEqual(400);
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([0, 0]);
    expect(built.appended).toEqual([]);
    expect(built.units).toEqual([]);

    built.actAs({ kind: 'ANONYMOUS', retiredDeviceId: null });
    expect(outcome(await built.post())).toEqual([401, 'NOT_SIGNED_IN']);

    built.actAs(operatorOf('TECHNICIAN'));
    expect((await built.post()).statusCode).toBe(200);
    built.clock.advance(CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS);
    built.actAs(operatorOf('SUPERVISOR'));
    expect((await built.post()).statusCode).toBe(200);
  });

  it('real capture with no probe wired: 503 NOT_READY (CAPTURE_NOT_READY), no row; the refusal takes no spacing slot', async () => {
    const built = await build({ captureMode: 'real' }, false);
    built.actAs(operatorOf('SUPERVISOR'));
    const refused = await built.post();
    expect(outcome(refused)).toEqual([503, 'NOT_READY']);
    expect(errorOf(refused).details).toEqual({ reason: 'CAPTURE_NOT_READY' });
    expect(built.appended).toEqual([]);
    // Control: with the probe provided the next call, at the same instant, is a re-read.
    captureNotices(built.app).provideProbe(built.adapters.probe);
    expect((await built.post()).statusCode).toBe(200);
  });

  it('G70-01 - simulated capture with no probe: the device state, NO adapter and NO source class, and still one search row', async () => {
    const built = await build({}, false);
    built.actAs(operatorOf('SUPERVISOR'));
    built.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: 'MIC-02', phase: 'PRESENCE' });
    const response = await built.post();
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('rescanCaptureInputs', 200, bodyOf(response))).toEqual({ ok: true });
    expect((response.json() as Scan).inputs).toEqual([
      { deviceId: 'MIC-01', inputId: 'MIC-01', present: true, errorCode: null },
      { deviceId: 'MIC-02', inputId: 'MIC-02', present: false, errorCode: null },
    ]);
    expect(response.body).not.toMatch(/"adapter"|"sourceClass"|DEVELOPMENT|FAKE/);
    expect(built.appended.map((row) => row.details['scope'])).toEqual(['MIC_LOCAL']);
    // No adapter was asked.
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([0, 0]);
  });

  it('G70-01 - simulated capture with a probe handed in (a test rig; the product hands none): the adapters are asked, and the answer still states no adapter and no class', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    built.adapters.fakes.mics[1]?.setPresent(false, AudioInputErrorCode.DEVICE_BUSY);
    const response = await built.post();
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('rescanCaptureInputs', 200, bodyOf(response))).toEqual({ ok: true });
    expect((response.json() as Scan).inputs).toEqual([
      { deviceId: 'MIC-01', inputId: 'MIC-01', present: true, errorCode: null },
      { deviceId: 'MIC-02', inputId: 'MIC-02', present: false, errorCode: 'DEVICE_BUSY' },
    ]);
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([1, 1]);
  });

  it('the engine is not running: 503, nothing read, no spacing slot taken', async () => {
    const built = await build();
    built.actAs(operatorOf('SUPERVISOR'));
    built.running = false;
    expect(outcome(await built.post())).toEqual([503, 'NOT_READY']);
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([0, 0]);
    built.running = true;
    expect((await built.post()).statusCode).toBe(200);
  });
});
