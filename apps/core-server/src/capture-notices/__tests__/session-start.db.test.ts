// Blueprint row 139 (NEW SCOPE R-10, situation C), on PostgreSQL as `dems_app`, capture mode `real`:
// check M5-NODEV-C-1 through the capture-session test seam with the fake worker.
//
//   0 cameras  -> the session FAULTS as a failed start: ONE alert, ONE audit row, 0 evidence files,
//                 0 evidence items, and the session never said it records (`captureDurable` never true)
//   1 camera   -> the session records, with ONE warning naming the missing camera
//
// WHAT IS REAL: the app factory and its boot in REAL_DEVELOPMENT, the engine host and its audit
// chain, the real supervisor and forwarder, the capture-session unit, and THIS unit as the app
// builds it (its boot registration attaches it to `sessionCapture(app)` when the app is ready,
// integration pass D8: nothing here calls `captureNotices(app)` before a start, and nothing calls
// `watchSessionStarts`). WHAT STANDS IN: the worker (`FakeWorkerProcess`) and the devices (the fake
// adapters). The rig is the one of `src/capture-session/__tests__/session-capture.db.test.ts`, cut
// to what this row asks.
import { existsSync, readdirSync } from 'node:fs';
import { createManualClock } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { fakeLauncher, flush, type FakeLauncher } from '../../../test/support/capture';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { FIXED_NOW, TICK_MS, manualTimer } from '../../../test/support/engine';
import { buildApp } from '../../app';
import { createCaptureSupervisor, createSystemTimers, forwardCaptureEvents } from '../../capture';
import { CaptureOperation, createCaptureDeviceRegistry } from '../../capture/adapters';
import { createFakeAudioInputAdapter, createFakeCameraAdapter } from '../../capture/adapters/fake';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../capture/fence';
import { sessionCapture, sessionMediaFolder, type SessionCaptureEvent } from '../../capture-session';
import { captureDoorsOf, engineControl } from '../../engine';
import type { Principal } from '../../plugins/authenticate';
import { captureNotices } from '../index';

const db = useTestDatabase({ template: 'seed' });
const fixture = realBootFixture('row139');
fixture.provisionKey();
afterAll(() => fixture.remove());

interface RigOptions {
  /** Cameras whose source cannot be opened: "not connected". */
  readonly camerasNotOpening?: readonly string[];
  /** False: the capture side's forwarder is NOT mounted, so only this unit can raise the fault of a failed start. */
  readonly forwarder?: boolean;
}

let caseSeq = 0;

async function rig(slug: string, options: RigOptions = {}) {
  const target = await db.another({ template: 'seed', slug });
  const owner: Pool = target.ownerPool();
  // No speech runtime on a test host: the transcriber is not the subject here.
  await owner.query('UPDATE public.stt_config SET enabled = false');
  const log = captureLog();
  const app = buildApp({
    config: unitTestConfig({
      database: target.runtime,
      dataDir: fixture.dataDir,
      mediaStoreDir: fixture.mediaStoreDir,
      logLevel: 'info',
      captureMode: 'real',
      demoControls: false,
      captureDevSources: true,
      captureHelperFfmpegPath: '/bin/echo',
      captureWorkerPath: fixture.worker(`worker-${slug}`, 'capture-worker/0.4.0'),
    }),
    logStream: log.stream,
  });
  target.onCleanup(() => app.close());
  await app.ready();
  const clock = createManualClock(FIXED_NOW);
  app.seams.replace('clock', clock);
  app.seams.replace('publish', () => {});
  const engine = engineControl(app);
  const timer = manualTimer();
  engine.useTimer(timer.timer);
  await app.readiness.boot();
  expect(captureFenceControl(app).operation).toBe(CaptureOperation.REAL_DEVELOPMENT);

  const fake: FakeLauncher = fakeLauncher();
  const supervisor = createCaptureSupervisor({ now: () => app.clock.now(), timers: createSystemTimers(), launcher: fake.launcher });
  await supervisor.boot();
  app.seams.replace('capture', supervisor);
  if (options.forwarder !== false) {
    forwardCaptureEvents({
      capture: supervisor,
      engine: () => ({
        applyCaptureTelemetry: (telemetry) => app.engine.applyCaptureTelemetry(telemetry),
        raiseCaptureWarning: (warning) => app.engine.raiseCaptureWarning(warning),
        clearCaptureWarning: (warning) => app.engine.clearCaptureWarning(warning),
        clearCaptureFaults: () => captureDoorsOf(app.engine).clearCaptureFaults(),
      }),
      report: () => {},
      now: () => app.clock.now(),
    });
  }
  target.onCleanup(() => supervisor.shutdown());

  const registry = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_DEVELOPMENT });
  for (const id of ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']) { // D60 (2026-11-04): the registry serves every assigned camera of the four-track selector
    const camera = createFakeCameraAdapter({ id });
    registry.register({
      ...camera,
      async openSource(deviceId, to, signal) {
        if (options.camerasNotOpening?.includes(deviceId) === true) throw new Error('the camera did not connect');
        return camera.openSource(deviceId, to, signal);
      },
    });
  }
  for (const id of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) registry.register(createFakeAudioInputAdapter({ id, runDir: `${fixture.dataDir}/run/capture` })); // D61 (2026-11-04): four numbered channels
  const capture = sessionCapture(app);
  capture.replace({ registry: () => registry, leftoverHelpers: async () => [], tapPathFor: async () => null });
  const events: SessionCaptureEvent[] = [];
  capture.on((event) => void events.push(event));
  // A FRESH BOOT: no pre-check ran, no camera search ran, and nothing here uses `captureNotices(app)` before
  // the start. The listener is the one the unit's boot registration attached at `ready()`.

  const operator = engine.slice('operators').find((candidate) => candidate.role === 'INVESTIGATOR');
  if (operator === undefined) throw new Error('the seed has no investigator');
  const investigator: Extract<Principal, { kind: 'OPERATOR' }> = { kind: 'OPERATOR', operatorId: operator.id, sessionId: 'test-session', deviceId: null, role: 'INVESTIGATOR', permissions: [] };
  const drive = async (ms: number): Promise<void> => {
    for (let elapsed = 0; elapsed < ms; elapsed += TICK_MS) {
      clock.advance(TICK_MS);
      timer.fire();
      await engine.idle();
    }
  };
  const settled = async (): Promise<void> => {
    for (let round = 0; round < 6; round += 1) {
      await flush();
      await capture.idle();
      await captureNotices(app).idle();
      await engine.idle();
    }
  };
  const rows = async <Row>(text: string, values: readonly unknown[] = []): Promise<Row[]> => (await owner.query(text, [...values])).rows as Row[];
  const count = async (table: 'evidence_items' | 'session_history' | 'recording_fragments'): Promise<number> => Number((await rows<{ n: string }>(`SELECT count(*) AS n FROM public.${table}`))[0]?.n);

  return {
    app,
    fake,
    events,
    investigator,
    drive,
    settled,
    rows,
    count,
    session: () => app.engine.slice('session'),
    activeAlerts: () => app.engine.state().alerts.filter((alert) => alert.active),
    auditOf: (type: string) => rows<{ details: Record<string, unknown>; session_id: string | null; device_id: string | null }>('SELECT details, session_id, device_id FROM public.audit_log WHERE type = $1 ORDER BY seq', [type]),
    /** The camera files of a session on the disk: the "evidence files" of a failed start. */
    mediaFilesOf(sessionId: string): string[] {
      const folder = `${fixture.mediaStoreDir}/${sessionMediaFolder(sessionId)}`;
      return existsSync(folder) ? readdirSync(folder) : [];
    },
    async arm(): Promise<string> {
      caseSeq += 1;
      await app.engine.setTabletLink('CONNECTED');
      const created = await app.engine.command(investigator, 'createSession', { caseNumber: `LP/2026/1001-09${String(caseSeq).padStart(2, '0')}`, subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25', investigatorId: investigator.operatorId });
      if (!created.value.ok) throw new Error(`the session was not created: ${created.value.reason}`);
      await app.engine.command(investigator, 'beginPrecheck');
      await drive(5_000);
      if (app.engine.slice('session')?.state === 'PRECHECK') await app.engine.command(investigator, 'acknowledgePrecheckWarnings');
      expect(app.engine.slice('session')?.state).toBe('ARMED');
      return created.value.sessionId;
    },
    /** The start as the route makes it: the hosted action and the capture hook in ONE unit, then the commit hook. */
    async start(sessionId: string): Promise<void> {
      await capture.beforeStart();
      await app.engine.run('sessions.startSession', async (scope) => {
        await scope.command(investigator, 'startRecording');
        await capture.recordingStartedIn(scope, sessionId);
      });
      capture.afterStartCommitted(sessionId);
      await settled();
    },
  };
}

describe('M5-NODEV-C-1, 0 cameras: a failed start', () => {
  it('ONE alert, ONE audit row, 0 evidence files, 0 evidence items after the recovery; the session never said it records', async () => {
    const of = await rig('r139_none');
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const evidenceBefore = await of.count('evidence_items');
    const historyBefore = await of.count('session_history');
    const faultRowsBefore = (await of.auditOf('FAULT_RAISED')).length;
    const id = await of.arm();
    await of.start(id);

    // "Connecting cameras…": the stored state is RECORDING and the payload says the capture is NOT durable.
    expect(of.session()).toMatchObject({ id, state: 'RECORDING', captureDurable: false });
    expect(of.activeAlerts()).toEqual([]);

    // The ingest-open window closed with no camera: the worker ends the session itself.
    of.fake.last().say({ type: 'CRASH', code: 'NO_CAMERA_CONNECTED', signal: null, exitCode: null });
    await of.settled();
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED', 'FAILED_START']);
    // D84: never 'recording'. No DURABLE was told, and the faulted session holds no start time and no byte.
    expect(of.session()).toMatchObject({ id, state: 'FAULT', captureDurable: false, startedAt: null, bytesWritten: 0, fault: { kind: 'CAPTURE_FAULT', fromState: 'RECORDING' } });

    // ONE alert: the CRITICAL fault of the capture as a whole. No warning of either camera beside it.
    const alerts = of.activeAlerts();
    expect(alerts.map((alert) => [alert.kind, alert.severity, alert.target ?? null])).toEqual([['CAPTURE_FAULT', 'CRITICAL', null]]);
    // ONE audit row "stating that nothing was recorded": the fault's own FAULT_RAISED.
    const raised = (await of.auditOf('FAULT_RAISED')).slice(faultRowsBefore);
    expect(raised).toHaveLength(1);
    expect(raised[0]?.details).toMatchObject({ kind: 'CAPTURE_FAULT' });
    expect(await of.auditOf('CAPTURE_DEVICE_UNREACHABLE')).toEqual([]);
    // That alert and that row are the capture side's own (the forwarder's): the net of this unit did not have to raise.
    expect(appended.mock.calls.map(([entry]) => entry.source).filter((source) => source.startsWith('captureNotices'))).toEqual([]);

    // 0 evidence files, 0 fragment rows.
    expect(of.mediaFilesOf(id).filter((name) => name.endsWith('.mp4'))).toEqual([]);
    expect(await of.count('recording_fragments')).toBe(0);

    // The session ends: its recovery keeps a history entry and makes NO evidence item (OP-125-5: then idle).
    await of.app.engine.command(of.investigator, 'recover');
    await of.drive(5_000);
    expect(of.session()).toBeNull();
    expect(await of.count('evidence_items')).toBe(evidenceBefore);
    // CONTROL of the count: the recovery did run and did write - one history entry.
    expect(await of.count('session_history')).toBe(historyBefore + 1);
  });

  it('CONTROL: the same session WITH a durable fragment says it records, and its end is not a failed start', async () => {
    const of = await rig('r139_control');
    const id = await of.arm();
    await of.start(id);
    expect(of.session()).toMatchObject({ state: 'RECORDING', captureDurable: false });
    of.fake.last().firstDurableFragment('CAM-01');
    await of.settled();
    // The same read that stayed `false` above turns `true` here: the check above can fail.
    expect(of.session()).toMatchObject({ id, state: 'RECORDING', captureDurable: true });
    expect(of.session()?.startedAt).not.toBeNull();
    expect(of.events.map((event) => event.type)).toEqual(['CONNECTING', 'STARTED', 'DURABLE']);
    expect(of.activeAlerts()).toEqual([]);

    of.fake.last().exit(1);
    await of.settled();
    expect(of.events.at(-1)).toMatchObject({ type: 'INTERRUPTED', sessionId: id });
    expect(of.session()).toMatchObject({ state: 'FAULT', captureDurable: true });
  });

  // Since row 71c the failed-start unit of the engine raises the fault of the capture as a whole itself
  // when the capture side has not (`engine/capture-session.ts failedCaptureStartTransition`), BEFORE the
  // FAILED_START event is told. The net of this unit (`session-start.ts failedStart`) therefore finds the
  // fault active and writes nothing; it stays proven where it can act (`session-start.test.ts`). What this
  // case holds on PostgreSQL: with no forwarder the start still has ONE alert and ONE row, and that alert,
  // made by the failed-start unit, carries the two keys of situation C (C3 section 5.4 row C).
  it('with no forwarder mounted the failed start still gets its ONE alert and ONE row; the alert holds reason NO_CAMERA_CONNECTED and evidenceFiles 0, and this unit\'s net had nothing to raise', async () => {
    const of = await rig('r139_net', { forwarder: false });
    const appended = vi.spyOn(of.app.errorLog, 'append');
    const faultRowsBefore = (await of.auditOf('FAULT_RAISED')).length;
    const id = await of.arm();
    await of.start(id);
    of.fake.last().say({ type: 'CRASH', code: 'NO_CAMERA_CONNECTED', signal: null, exitCode: null });
    await of.settled();
    expect(of.session()).toMatchObject({ id, state: 'FAULT', captureDurable: false });
    expect(of.activeAlerts().map((alert) => [alert.kind, alert.severity, alert.target ?? null])).toEqual([['CAPTURE_FAULT', 'CRITICAL', null]]);
    expect(of.activeAlerts()[0]?.params).toMatchObject({ reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
    expect((await of.auditOf('FAULT_RAISED')).slice(faultRowsBefore)).toHaveLength(1);
    const logged = appended.mock.calls.map(([entry]) => entry).filter((entry) => entry.source === 'captureNotices.sessionStart');
    expect(logged.map((entry) => [entry.level, entry.code])).toEqual([]);
  });
});

describe('M5-NODEV-C-1, 1 camera: a degraded session', () => {
  it('the session records with ONE warning naming the missing camera, raised only when the session records; no fault', async () => {
    const of = await rig('r139_degraded', { camerasNotOpening: ['CAM-02'] });
    const id = await of.arm();
    await of.start(id);
    expect(of.events.at(-1)).toEqual({ type: 'STARTED', sessionId: id, cameras: ['CAM-01', 'CAM-03', 'CAM-04'], camerasNotOpened: ['CAM-02'] }); // D60: the three cameras that did open
    // CONTROL (D84): nothing durable yet, so nothing says the session records one camera only.
    expect(of.session()).toMatchObject({ state: 'RECORDING', captureDurable: false });
    expect(of.activeAlerts()).toEqual([]);
    expect(await of.auditOf('CAPTURE_DEVICE_UNREACHABLE')).toEqual([]);

    of.fake.last().firstDurableFragment('CAM-01');
    await of.settled();
    expect(of.session()).toMatchObject({ id, state: 'RECORDING', captureDurable: true });
    const alerts = of.activeAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: 'SYSTEM', severity: 'WARNING', target: 'CAM-02', message: 'CAM-02 is not connected', params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'SESSION_START', cause: 'NOT_CONNECTED' } });
    const rows = await of.auditOf('CAPTURE_DEVICE_UNREACHABLE');
    expect(rows.map((row) => row.details)).toEqual([{ deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'SESSION_START', reason: 'NOT_CONNECTED', degraded: true, sessionId: id }]);
    // The camera reads not connected for every client; the session is not faulted.
    expect(of.app.engine.state().captureDevices.devices.find((device) => device.id === 'CAM-02')).toMatchObject({ online: false, streamState: 'LOST' });
    expect(of.app.engine.state().faults.active).toEqual([]);
  });
});
