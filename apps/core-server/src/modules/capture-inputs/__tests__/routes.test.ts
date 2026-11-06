// Operation 97 `rescanCaptureInputs` without a database (blueprint row 133; contract C3 §2.6 op 97,
// §4, §5.2; specs R-10 AC-2, AC-4; decision D80(5); check M4-MIC-RESCAN-1).
//
// The real app factory with this module registered, the REAL access rule (stage 6) and, behind the
// seam `engine`, a stand-in on a real shared simulator (`support.ts`). What is STORED is the
// database test's (`no-device.db.test.ts`). Each `it` holds its negative control.
import { CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS, CAPTURE_SEARCH_ID_PATTERN, CORE_API_OPERATIONS, CoreApiAccessKind, validateCoreApiResponse } from '@dems/shared/api';
import { Permission, createManualClock, createSim } from '@dems/shared/sim'; // the capture-lane driver turned TECHNICIAN: REVOKED 2026-10-29 (0034), re-pinned 2026-11-04
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { captureNotices } from '../../../capture-notices';
import { AudioInputErrorCode } from '../../../capture/adapters';
import { captureDeviceReachTransition } from '../../../engine/internal-actions'; // audit row M97: row 127's pure transition
import { routePatternOf } from '../../../plugins/permission-guard';
import { bodyOf, errorOf, operatorOf, outcome } from '../../devices/__tests__/support';
import { CAPTURE_INPUTS_MODULE_OPERATIONS, CAPTURE_INPUTS_UNIT_LABEL, captureInputsOperation, rescanSearchId } from '../index';
import { CAPTURE_INPUTS_REACH_NOT_WRITTEN, CAPTURE_INPUTS_REACH_UNIT_LABEL, micReachReadingsOf } from '../routes'; // audit row M97
import { RESCAN, inputsUnitApp, stoppableFakes, type InputsUnitApp, type StoppableFakes } from './support';

const apps: FastifyInstance[] = [];
/** Audit row M97: the clock of an earlier (stale) reach reading. */
const FIXED_STALE = 1_000;
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
    built.actAs(operatorOf('TECHNICIAN')); // REVOKED 2026-10-29 (0034): CAPTURE_CONFIG is the installing technician's
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
        // D61 (2026-11-04): the four numbered channels are all registered and all read.
        { deviceId: 'MIC-03', inputId: 'MIC-03', present: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', errorCode: null },
        { deviceId: 'MIC-04', inputId: 'MIC-04', present: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', errorCode: null },
      ],
      unregisteredCount: 0,
    });
    // The re-read is enumerate and nothing else: no camera was asked, no search was run.
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([1, 1, 1, 1]); // D61 (2026-11-04): four channels
    expect(built.adapters.fakes.mics.flatMap((mic) => mic.calls.opened)).toEqual([]);
    expect(built.adapters.reads).toEqual([]);
    expect(built.adapters.fakes.cameras.map((camera) => camera.calls.discover)).toEqual([0, 0, 0, 0]); // D60 (2026-11-04): four fake cameras registered, none asked

    expect(built.units).toEqual([CAPTURE_INPUTS_UNIT_LABEL]);
    expect(built.appended).toHaveLength(1);
    const [row] = built.appended;
    expect(row).toMatchObject({ type: 'CAPTURE_DISCOVERY_SEARCHED', actorId: operatorOf('TECHNICIAN').kind === 'OPERATOR' ? 'OPR-003' : null, deviceId: null }); // D60 sweep 2026-11-04: the driver is the technician (RINA)
    expect(row?.details).toEqual({
      searchId: rescanSearchId(built.clock.now()),
      scope: 'MIC_LOCAL',
      trigger: 'MANUAL',
      outcome: 'COMPLETE',
      responderCount: 4, // D61 (2026-11-04): the four numbered channels all answer
      newCount: 0,
      registeredCount: 4,
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
      { deviceId: 'MIC-03', inputId: 'MIC-03', present: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', errorCode: null },
      { deviceId: 'MIC-04', inputId: 'MIC-04', present: true, adapter: 'FAKE', sourceClass: 'DEVELOPMENT', errorCode: null },
    ]); // D61 (2026-11-04): four channels
    expect(online()).toEqual([['MIC-01', true], ['MIC-02', false], ['MIC-03', true], ['MIC-04', true]]); // D61 (2026-11-04)
    expect(built.appended.at(-1)?.details).toMatchObject({ responderCount: 3, registeredCount: 4 }); // D61 (2026-11-04): four channels registered, the removed one answers as absent (was one of two)
    // Presence only: the alert of an unreachable microphone belongs to a pre-check run.
    expect(built.sim.store.getState().alerts.filter((alert) => alert.kind === 'SYSTEM')).toEqual([]);
    expect(built.sim.store.getState().audit.rows.filter((row) => row.type === 'CAPTURE_DEVICE_UNREACHABLE')).toEqual([]);

    built.adapters.fakes.mics[1]?.setPresent(true);
    built.clock.advance(CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS);
    const second = (await built.post()).json() as Scan;
    expect(second.inputs.map((input) => [input.deviceId, input.present, input.errorCode])).toEqual([['MIC-01', true, null], ['MIC-02', true, null], ['MIC-03', true, null], ['MIC-04', true, null]]); // D61 (2026-11-04)
    expect(online()).toEqual([['MIC-01', true], ['MIC-02', true], ['MIC-03', true], ['MIC-04', true]]); // D61 (2026-11-04)
  });

  it('allowed while a session is open, and the row names that session', async () => {
    const built = await build();
    built.sim.actions.signIn('budi.santoso', 'demo-2026');
    built.sim.actions.createSession({ caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' });
    const sessionId = built.sim.store.getState().session?.id;
    built.actAs(operatorOf('TECHNICIAN')); // REVOKED 2026-10-29 (0034)
    expect((await built.post()).statusCode).toBe(200);
    expect(built.appended.at(-1)?.details).toMatchObject({ sessionId });
  });

  it('the spacing limit: a second re-read inside the interval is 429 with retry-after, reads nothing and writes no row; after it, 200', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN')); // REVOKED 2026-10-29 (0034)
    expect((await built.post()).statusCode).toBe(200);

    built.clock.advance(CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS - 1_500);
    const limited = await built.post();
    expect(outcome(limited)).toEqual([429, 'RATE_LIMITED']);
    expect(errorOf(limited).details).toEqual({ reason: 'INPUT_RESCAN_RATE_LIMITED' });
    expect(limited.headers['retry-after']).toBe('2');
    expect(built.appended).toHaveLength(1);
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([1, 1, 1, 1]); // D61 (2026-11-04): four channels
    // Another operator is the same Core: still limited. (A supervisor WITH the permission granted by hand: the revocation of 0034 stands, the limiter is what this case judges.)
    built.actAs(operatorOf('SUPERVISOR', [Permission.CAPTURE_CONFIG]));
    expect(outcome(await built.post())).toEqual([429, 'RATE_LIMITED']);

    // Control: once the interval has passed the same request is a re-read again.
    built.clock.advance(1_500);
    expect((await built.post()).statusCode).toBe(200);
    expect(built.appended).toHaveLength(2);
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([2, 2, 2, 2]); // D61 (2026-11-04)
  });
});

describe('who may call, and when it is not ready', () => {
  it('INVESTIGATOR never reaches the handler: nothing is read, no unit runs; no session is 401; SUPERVISOR never reaches it either since the capture-lane revocation, and TECHNICIAN passes', async () => {
    const built = await build();
    // D60 sweep 2026-11-04: SUPERVISOR joined the refusal side - CAPTURE_CONFIG was revoked from it on 2026-10-29 (0034),
    // so the guard stops it before the handler exactly as it stops the INVESTIGATOR.
    for (const denied of ['INVESTIGATOR', 'SUPERVISOR'] as const) {
      built.actAs(operatorOf(denied));
      // Without a database the guard cannot write its ACCESS_DENIED row, so its answer here is not
      // the 403 of the database test (`no-device.db.test.ts`); what holds in both is that the handler
      // does not run.
      expect((await built.post()).statusCode, denied).toBeGreaterThanOrEqual(400);
      expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate), denied).toEqual([0, 0, 0, 0]); // D61 (2026-11-04)
      expect(built.appended, denied).toEqual([]);
      expect(built.units, denied).toEqual([]);
    }

    built.actAs({ kind: 'ANONYMOUS', retiredDeviceId: null });
    expect(outcome(await built.post())).toEqual([401, 'NOT_SIGNED_IN']);

    built.actAs(operatorOf('TECHNICIAN'));
    expect((await built.post()).statusCode).toBe(200);
  });

  it('real capture with no probe wired: 503 NOT_READY (CAPTURE_NOT_READY), no row; the refusal takes no spacing slot', async () => {
    const built = await build({ captureMode: 'real' }, false);
    built.actAs(operatorOf('TECHNICIAN')); // REVOKED 2026-10-29 (0034): the refusal under test is the ROUTE's, so the caller must reach the handler
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
    built.actAs(operatorOf('TECHNICIAN')); // REVOKED 2026-10-29 (0034)
    built.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: 'MIC-02', phase: 'PRESENCE' });
    const response = await built.post();
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('rescanCaptureInputs', 200, bodyOf(response))).toEqual({ ok: true });
    expect((response.json() as Scan).inputs).toEqual([
      { deviceId: 'MIC-01', inputId: 'MIC-01', present: true, errorCode: null },
      { deviceId: 'MIC-02', inputId: 'MIC-02', present: false, errorCode: null },
      { deviceId: 'MIC-03', inputId: 'MIC-03', present: true, errorCode: null }, // D61 (2026-11-04): four channels
      { deviceId: 'MIC-04', inputId: 'MIC-04', present: true, errorCode: null },
    ]);
    expect(response.body).not.toMatch(/"adapter"|"sourceClass"|DEVELOPMENT|FAKE/);
    expect(built.appended.map((row) => row.details['scope'])).toEqual(['MIC_LOCAL']);
    // No adapter was asked.
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([0, 0, 0, 0]); // D61 (2026-11-04)
  });

  it('G70-01 - simulated capture with a probe handed in (a test rig; the product hands none): the adapters are asked, and the answer still states no adapter and no class', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN')); // REVOKED 2026-10-29 (0034)
    built.adapters.fakes.mics[1]?.setPresent(false, AudioInputErrorCode.DEVICE_BUSY);
    const response = await built.post();
    expect(response.statusCode).toBe(200);
    expect(validateCoreApiResponse('rescanCaptureInputs', 200, bodyOf(response))).toEqual({ ok: true });
    expect((response.json() as Scan).inputs).toEqual([
      { deviceId: 'MIC-01', inputId: 'MIC-01', present: true, errorCode: null },
      { deviceId: 'MIC-02', inputId: 'MIC-02', present: false, errorCode: 'DEVICE_BUSY' },
      { deviceId: 'MIC-03', inputId: 'MIC-03', present: true, errorCode: null }, // D61 (2026-11-04): four channels
      { deviceId: 'MIC-04', inputId: 'MIC-04', present: true, errorCode: null },
    ]);
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([1, 1, 1, 1]); // D61 (2026-11-04): four channels
  });

  it('the engine is not running: 503, nothing read, no spacing slot taken', async () => {
    const built = await build();
    built.actAs(operatorOf('TECHNICIAN')); // REVOKED 2026-10-29 (0034)
    built.running = false;
    expect(outcome(await built.post())).toEqual([503, 'NOT_READY']);
    expect(built.adapters.fakes.mics.map((mic) => mic.calls.enumerate)).toEqual([0, 0, 0, 0]); // D61 (2026-11-04)
    built.running = true;
    expect((await built.post()).statusCode).toBe(200);
  });
});

// ── Audit row M97 (decisions D104, D116; the engine door of row 127) ─────────────────────────────
// A re-read LISTS the inputs and opens none: it clears a stale NOT_REACHABLE of a microphone it finds again, states
// NOT_REACHABLE for one it misses, and never states REACHABLE. Each case holds its control.
describe('audit row M97: a re-read restates or clears the reach of the listed microphones', () => {
  const reachOf = (built: InputsUnitApp) =>
    built.sim.store
      .getState()
      .captureDevices.devices.filter((device) => device.kind === 'MIC')
      .map((device) => [device.id, device.reach ?? null, device.checkedAt ?? null]);
  const stateReach = (built: InputsUnitApp, deviceId: string, reach: 'REACHABLE' | 'NOT_REACHABLE', checkedAt: number) =>
    built.sim.store.setState(captureDeviceReachTransition(built.sim.store.getState(), { deviceId, reach, checkedAt }));

  it('micReachReadingsOf: present clears a stated NOT_REACHABLE only, absent states NOT_REACHABLE at the clock, never REACHABLE', () => {
    const registered = [{ id: 'MIC-01', reach: 'NOT_REACHABLE' as const }, { id: 'MIC-02', reach: 'REACHABLE' as const }, { id: 'MIC-03' }, { id: 'MIC-04', reach: null }];
    const inputs = [
      { deviceId: 'MIC-01', present: true },
      { deviceId: 'MIC-02', present: true },
      { deviceId: 'MIC-03', present: true },
      { deviceId: 'MIC-04', present: false },
    ];
    const readings = micReachReadingsOf(registered, inputs, 1_000);
    expect(readings).toEqual([
      { deviceId: 'MIC-01', reach: null, checkedAt: null },
      { deviceId: 'MIC-04', reach: 'NOT_REACHABLE', checkedAt: 1_000 },
    ]);
    expect(readings.some((reading) => reading.reach === 'REACHABLE')).toBe(false);
    // Control: every input present and nothing stated -> nothing to write.
    expect(micReachReadingsOf([{ id: 'MIC-01' }], [{ deviceId: 'MIC-01', present: true }], 1_000)).toEqual([]);
  });

  it('the door clears: reach/checkedAt null, published once; a clear of an entry that states nothing is the SAME state', () => {
    const sim = createSim({ clock: createManualClock(1), storage: null, authStorage: null });
    const start = sim.store.getState();
    const stale = captureDeviceReachTransition(start, { deviceId: 'MIC-02', reach: 'NOT_REACHABLE', checkedAt: 5 });
    const cleared = captureDeviceReachTransition(stale, { deviceId: 'MIC-02', reach: null, checkedAt: null });
    expect(cleared.captureDevices.devices.find((device) => device.id === 'MIC-02')).toMatchObject({ reach: null, checkedAt: null });
    // online, streamState and every other device untouched.
    expect(cleared.captureDevices.devices.map((device) => [device.id, device.online, device.streamState])).toEqual(stale.captureDevices.devices.map((device) => [device.id, device.online, device.streamState]));
    expect(captureDeviceReachTransition(cleared, { deviceId: 'MIC-02', reach: null, checkedAt: null })).toBe(cleared);
    // Control: absent members read "not checked" too.
    expect(captureDeviceReachTransition(start, { deviceId: 'MIC-01', reach: null, checkedAt: null })).toBe(start);
  });

  it('THE DEFECT: a stale NOT_REACHABLE on a microphone that op 97 lists present is cleared (not REACHABLE); a stated REACHABLE and no reading stay as they are', async () => {
    const built = await build({ captureMode: 'real' });
    built.actAs(operatorOf('TECHNICIAN'));
    stateReach(built, 'MIC-02', 'NOT_REACHABLE', FIXED_STALE);
    stateReach(built, 'MIC-01', 'REACHABLE', FIXED_STALE);
    const response = await built.post();
    expect(response.statusCode).toBe(200);
    expect(reachOf(built)).toEqual([
      ['MIC-01', 'REACHABLE', FIXED_STALE],
      ['MIC-02', null, null],
      ['MIC-03', null, null],
      ['MIC-04', null, null],
    ]);
    // Its own unit, before the search row; the search row is unchanged (one row).
    expect(built.units).toEqual([CAPTURE_INPUTS_REACH_UNIT_LABEL, CAPTURE_INPUTS_UNIT_LABEL]);
    expect(built.appended).toHaveLength(1);
    // A listing opened nothing.
    expect(built.adapters.fakes.mics.flatMap((mic) => mic.calls.opened)).toEqual([]);
  });

  it('remove -> NOT_REACHABLE at the re-read clock (online false); plug back -> cleared (online true), never REACHABLE', async () => {
    const built = await build({ captureMode: 'real' });
    built.actAs(operatorOf('TECHNICIAN'));
    built.adapters.fakes.mics[1]?.setPresent(false, AudioInputErrorCode.DEVICE_NOT_FOUND);
    expect((await built.post()).statusCode).toBe(200);
    const removedAt = built.clock.now();
    expect(built.sim.store.getState().captureDevices.devices.find((device) => device.id === 'MIC-02')).toMatchObject({ online: false, reach: 'NOT_REACHABLE', checkedAt: removedAt });

    built.adapters.fakes.mics[1]?.setPresent(true);
    built.clock.advance(CAPTURE_INPUT_RESCAN_MIN_INTERVAL_MS);
    expect((await built.post()).statusCode).toBe(200);
    expect(built.sim.store.getState().captureDevices.devices.find((device) => device.id === 'MIC-02')).toMatchObject({ online: true, reach: null, checkedAt: null });
    expect(reachOf(built).some(([, reach]) => reach === 'REACHABLE')).toBe(false);
  });

  it('CONTROL: every microphone present and nothing stated -> no reach unit; simulated capture without a probe states nothing', async () => {
    const real = await build({ captureMode: 'real' });
    real.actAs(operatorOf('TECHNICIAN'));
    expect((await real.post()).statusCode).toBe(200);
    expect(real.units).toEqual([CAPTURE_INPUTS_UNIT_LABEL]);

    const simulated = await build({}, false);
    simulated.actAs(operatorOf('TECHNICIAN'));
    stateReach(simulated, 'MIC-02', 'NOT_REACHABLE', FIXED_STALE);
    expect((await simulated.post()).statusCode).toBe(200);
    // Nothing was read, so nothing is restated: the reading stays the last one.
    expect(simulated.sim.store.getState().captureDevices.devices.find((device) => device.id === 'MIC-02')).toMatchObject({ reach: 'NOT_REACHABLE', checkedAt: FIXED_STALE });
    expect(simulated.units).toEqual([CAPTURE_INPUTS_UNIT_LABEL]);
  });

  it('a reach unit that fails is logged (warn, code, IDs only) and the re-read still answers 200 with its one search row', async () => {
    const built = await build({ captureMode: 'real' });
    built.actAs(operatorOf('TECHNICIAN'));
    stateReach(built, 'MIC-02', 'NOT_REACHABLE', FIXED_STALE);
    const engine = built.app.engine as unknown as { run: (label: string, work: unknown) => Promise<unknown> };
    const run = engine.run.bind(engine);
    engine.run = (label, work) => (label === CAPTURE_INPUTS_REACH_UNIT_LABEL ? Promise.reject(new Error('reach unit refused')) : run(label, work));
    const response = await built.post();
    expect(response.statusCode).toBe(200);
    expect(built.appended).toHaveLength(1);
    const lines = built.log.lines().filter((line) => line['code'] === CAPTURE_INPUTS_REACH_NOT_WRITTEN);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 40, deviceIds: ['MIC-02'] });
    // Control: the stale reading stays (nothing was written).
    expect(built.sim.store.getState().captureDevices.devices.find((device) => device.id === 'MIC-02')).toMatchObject({ reach: 'NOT_REACHABLE' });
  });
});
