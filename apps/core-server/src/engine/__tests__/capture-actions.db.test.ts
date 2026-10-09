// The two INTERNAL capture entry points of the engine host, against PostgreSQL as `dems_app`
// (task 3 blueprint row 58; register SH-18 / CS-04; `capture-spec §B.1`, §E.1; OD-11):
// `engine.applyCaptureTelemetry` and `engine.raiseCaptureWarning`, on the precedent of
// `engine.setTabletLink` (`commands.db.test.ts`, "the tablet link").
//
// The worker sends telemetry about 20 times a second. What this file holds the host to: a frame
// that changes nothing the tables hold sends NO statement and moves NO revision; the levels go out
// as meter frames, never as a row; a warning is written once while it is active and never
// switches the audio source.
import { SimNotFoundError, type CaptureTelemetryInput } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { readHead, readTrail, verifyTrail } from '../../../test/support/core';
import { engineApp, meterFrames, stateChanges, storedSlices, type EngineApp } from './support';

const db = useTestDatabase({ template: 'seed' });

interface Booted extends EngineApp {
  readonly owner: Pool;
}

/** A process start on a fresh clone of the seed. */
async function booted(slug: string, captureMode?: 'simulated' | 'real'): Promise<Booted> {
  const target = await db.another({ template: 'seed', slug });
  const host = await engineApp(target, db.run.dataDir, captureMode === undefined ? {} : { captureMode });
  await host.app.readiness.boot();
  return { ...host, owner: target.ownerPool() };
}

const SESSION_INPUT = {
  caseNumber: 'LP/2026/1001-0058',
  subjectType: 'SAKSI',
  subjectName: 'Test Subject',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
} as const;

/** From idle to a running recording, through hosted commands only. */
async function startRecording(host: Booted): Promise<void> {
  const investigator = host.principal('INVESTIGATOR');
  await host.engine.setTabletLink('CONNECTED');
  await host.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
  await host.engine.command(investigator, 'beginPrecheck');
  await host.drive(5_000);
  if (host.engine.slice('session')?.state === 'PRECHECK') await host.engine.command(investigator, 'acknowledgePrecheckWarnings');
  await host.engine.command(investigator, 'startRecording');
  expect(host.engine.slice('session')?.state).toBe('RECORDING');
}

const frame = (patch: Partial<CaptureTelemetryInput> = {}): CaptureTelemetryInput => ({ levels: [], ingest: [], fragments: [], ...patch });

const cameras = (host: Booted) => host.engine.slice('captureDevices').devices.filter((device) => device.kind === 'CAMERA').map(({ id, online, streamState }) => ({ id, online, streamState }));

describe('engine.applyCaptureTelemetry (SH-18, CS-04): about 20 frames a second', () => {
  it('a frame that changes nothing the tables hold sends no statement, moves no revision and publishes no state; the levels go out as meter frames', async () => {
    const host = await booted('r58_telemetry_idle');
    expect(cameras(host)).toEqual([
      { id: 'CAM-01', online: true, streamState: 'LIVE' },
      { id: 'CAM-02', online: true, streamState: 'LIVE' },
    ]);
    const head = await readHead(host.owner);
    const sent = host.database.statements.length;
    const revision = host.engine.revision;
    const changes = stateChanges(host.publications).length;
    const units = vi.spyOn(host.app.pipeline, 'run');

    // One second of the worker: levels that move, fragment counters that grow, ingests as stored.
    for (let index = 0; index < 20; index += 1) {
      const outcome = await host.engine.applyCaptureTelemetry(
        frame({
          levels: [{ role: 'PRIMARY', dbfs: -6.25, clipped: false }, { role: 'STANDBY', dbfs: -30 - index, clipped: false }],
          ingest: [{ deviceId: 'CAM-01', state: 'CONNECTED' }, { deviceId: 'CAM-02', state: 'CONNECTED' }],
          fragments: [{ deviceId: 'CAM-01', count: index, bytes: index * 500_000 }],
        }),
      );
      expect(outcome).toEqual({ value: undefined, epoch: host.engine.epoch, revision });
    }
    expect(host.database.statements).toHaveLength(sent);
    expect(host.engine.revision).toBe(revision);
    expect(stateChanges(host.publications)).toHaveLength(changes);
    expect(await readHead(host.owner)).toEqual(head);
    // Not even an empty unit: twenty frames a second never wait in the pipeline's queue.
    expect(units.mock.calls.map(([label]) => label)).toEqual([]);

    // The level is on the next meter frame (the streamed slice), as the worker measured it.
    expect(meterFrames(host.publications).some((meter) => meter.audio.inputs['MIC-01'].dbfs === -6.25)).toBe(false);
    await host.drive(50);
    expect(meterFrames(host.publications).at(-1)?.audio.inputs['MIC-01']).toMatchObject({ dbfs: -6.25, noSignal: false });
    expect(host.engine.meters()?.audio.inputs['MIC-01'].dbfs).toBe(-6.25);

    // Control: a frame that DOES change a stored slice is a unit: statements, one revision, one publication.
    const before = host.database.statements.length;
    const moved = await host.engine.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-02', state: 'WAITING' }] }));
    expect(host.database.statements.length).toBeGreaterThan(before);
    expect(units.mock.calls.map(([label]) => label).filter((label) => label !== 'engine.tick')).toEqual(['engine.applyCaptureTelemetry']);
    expect(moved.revision).toBe(host.engine.revision);
    expect(host.engine.revision).toBeGreaterThan(revision);
    const change = stateChanges(host.publications).at(-1);
    expect(change?.cause).toBe('command');
    // ONE CUT (F71): the unit also carries the snapshot slices the tick before it left unwritten.
    expect(change?.ops.map((op) => op.slice)).toEqual(expect.arrayContaining(['captureConfig', 'captureDevices']));
    expect(change?.ops.map((op) => op.slice)).not.toEqual(expect.arrayContaining(['audit']));
    expect(cameras(host)).toEqual([
      { id: 'CAM-01', online: true, streamState: 'LIVE' },
      { id: 'CAM-02', online: false, streamState: 'LOST' },
    ]);
    // What a restart would read is what the engine holds; telemetry is no audit matter.
    const stored = await storedSlices(host.owner);
    expect(stored.captureDevices).toEqual(host.engine.slice('captureDevices'));
    expect(stored.captureConfig).toEqual(host.engine.slice('captureConfig'));
    expect(await readHead(host.owner)).toEqual(head);

    // And the same frame again is nothing again.
    const again = host.database.statements.length;
    const held = host.engine.revision;
    expect(await host.engine.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-02', state: 'WAITING' }] }))).toMatchObject({ revision: held });
    expect(host.database.statements).toHaveLength(again);
  });

  it('frames that arrive while a telemetry unit waits join it: one unit, one revision, and the newest frame is the one applied', async () => {
    const host = await booted('r58_telemetry_join');
    const revision = host.engine.revision;
    const changes = stateChanges(host.publications).length;
    const outcomes = await Promise.all([
      host.engine.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-01', state: 'WAITING' }] })),
      host.engine.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-01', state: 'WAITING' }, { deviceId: 'CAM-02', state: 'WAITING' }] })),
      host.engine.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-01', state: 'CONNECTED' }, { deviceId: 'CAM-02', state: 'WAITING' }] })),
    ]);
    expect(outcomes.map((outcome) => outcome.revision)).toEqual([revision + 1, revision + 1, revision + 1]);
    expect(host.engine.revision).toBe(revision + 1);
    expect(stateChanges(host.publications)).toHaveLength(changes + 1);
    expect(cameras(host)).toEqual([
      { id: 'CAM-01', online: true, streamState: 'LIVE' },
      { id: 'CAM-02', online: false, streamState: 'LOST' },
    ]);
    // The slot is free again: the next changing frame is a unit of its own.
    await host.engine.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-02', state: 'CONNECTED' }] }));
    expect(host.engine.revision).toBe(revision + 2);
  });

  it('a stopped engine refuses the three entry points with 503 NOT_READY', async () => {
    const host = await booted('r58_stopped');
    await host.engine.stop();
    await expect(host.engine.applyCaptureTelemetry(frame())).rejects.toMatchObject({ statusCode: 503, code: 'NOT_READY' });
    await expect(host.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null })).rejects.toMatchObject({ statusCode: 503, code: 'NOT_READY' });
    await expect(host.engine.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: null })).rejects.toMatchObject({ statusCode: 503, code: 'NOT_READY' });
  });
});

describe('engine.raiseCaptureWarning (SH-18; capture-spec §E.1; OD-11)', () => {
  it('MIC_SILENT is stored once with no actor, raises one alert, and never switches the audio source; raised again while active it sends no statement', async () => {
    const host = await booted('r58_warning');
    await startRecording(host);
    const before = await readHead(host.owner);
    const source = host.engine.slice('session')?.audioSource;
    const active = host.engine.meters()?.audio.activeInputId;

    const outcome = await host.engine.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'PRIMARY' });
    expect(outcome).toMatchObject({ epoch: host.engine.epoch, revision: host.engine.revision });
    const trail = await readTrail(host.owner);
    expect(trail.at(-1)).toMatchObject({ seq: before.seq + 1, type: 'FAULT_RAISED', actorId: null, severity: 'WARNING', details: { kind: 'MIC_SILENT', target: 'AUDIO-01' } });
    expect(verifyTrail(trail, await readHead(host.owner))).toMatchObject({ ok: true });
    expect(host.engine.slice('alerts').filter((alert) => alert.kind === 'MIC_SILENT')).toMatchObject([{ severity: 'WARNING', active: true, target: 'AUDIO-01' }]);
    expect((await storedSlices(host.owner)).alerts).toEqual(host.engine.slice('alerts'));
    expect(host.engine.slice('faults').active.filter((fault) => fault.kind === 'MIC_SILENT')).toHaveLength(1);
    // OD-11: the warning changed neither the session's audio source nor the session.
    expect(host.engine.slice('session')?.audioSource).toEqual(source);
    expect(host.engine.slice('session')?.state).toBe('RECORDING');
    await host.drive(50);
    expect(host.engine.meters()?.audio.activeInputId).toBe(active);
    expect((await readTrail(host.owner)).filter((row) => row.type === 'AUDIO_SOURCE_SWITCHED')).toEqual([]);

    // The same warning while it is active: nothing is written twice.
    const sent = host.database.statements.length;
    const revision = host.engine.revision;
    expect(await host.engine.raiseCaptureWarning({ code: 'MIC_SILENT', subject: 'PRIMARY' })).toMatchObject({ revision });
    expect(host.database.statements).toHaveLength(sent);
    expect((await readTrail(host.owner)).filter((row) => row.type === 'FAULT_RAISED' && row.details?.['kind'] === 'MIC_SILENT')).toHaveLength(1);

    // Control: another subject IS another warning, so the line above is not a dead entry point.
    await host.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    expect(host.engine.revision).toBeGreaterThan(revision);
    const fault = (await readTrail(host.owner)).at(-1);
    expect(fault).toMatchObject({ type: 'FAULT_RAISED', actorId: null, deviceId: 'CAM-02', severity: 'CRITICAL', details: { kind: 'CAPTURE_FAULT', target: 'CAM-02' } });
    // SH-06 is not this row's: a capture fault is an alert here and the recording goes on.
    expect(host.engine.slice('session')?.state).toBe('RECORDING');
  });

  it('a subject the Core does not know is refused: nothing is stored, the engine state is set back, and the failure is in the error log', async () => {
    const host = await booted('r58_warning_unknown');
    const head = await readHead(host.owner);
    const revision = host.engine.revision;
    const alerts = host.engine.slice('alerts');
    const persisted = vi.spyOn(host.app.errorLog, 'append');

    await expect(host.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-99' })).rejects.toBeInstanceOf(SimNotFoundError);

    expect(await readHead(host.owner)).toEqual(head);
    expect(host.engine.revision).toBe(revision);
    expect(host.engine.slice('alerts')).toBe(alerts);
    expect(persisted.mock.calls.map(([entry]) => entry)).toMatchObject([{ level: 'error', source: 'engine.host', context: { label: 'engine.raiseCaptureWarning' } }]);
    // The engine goes on: the next warning is taken.
    await host.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01' });
    expect(host.engine.revision).toBe(revision + 1);
  });
});

describe('fix round 1 (decision D72): the clear, the ignored IDs, and NO SIGNAL in capture mode real', () => {
  it('A-2: engine.clearCaptureWarning stores FAULT_CLEARED with no actor; not active it sends no statement; the next raise is a NEW audit row and alert', async () => {
    const host = await booted('r58_clear');
    await startRecording(host);
    const mine = async () => (await readTrail(host.owner)).filter((row) => row.details?.['kind'] === 'CAPTURE_FAULT').map((row) => row.type);

    await host.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    await host.drive(3_000);
    const cleared = await host.engine.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    expect(cleared).toMatchObject({ epoch: host.engine.epoch, revision: host.engine.revision });
    expect(await mine()).toEqual(['FAULT_RAISED', 'FAULT_CLEARED']);
    expect((await readTrail(host.owner)).at(-1)).toMatchObject({ type: 'FAULT_CLEARED', actorId: null, details: { kind: 'CAPTURE_FAULT', target: 'CAM-02' } });
    expect(host.engine.slice('faults').active.filter((fault) => fault.kind === 'CAPTURE_FAULT')).toEqual([]);
    expect(host.engine.slice('alerts').filter((alert) => alert.kind === 'CAPTURE_FAULT')).toMatchObject([{ active: false, target: 'CAM-02' }]);

    // Not active: no statement, the same revision.
    const sent = host.database.statements.length;
    const revision = host.engine.revision;
    expect(await host.engine.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' })).toMatchObject({ revision });
    expect(host.database.statements).toHaveLength(sent);

    // The second episode is recorded (NAV-SEM of finding A-2: it used to write nothing).
    await host.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    expect(await mine()).toEqual(['FAULT_RAISED', 'FAULT_CLEARED', 'FAULT_RAISED']);
    expect(host.engine.slice('alerts').filter((alert) => alert.kind === 'CAPTURE_FAULT').map((alert) => alert.active)).toEqual([false, true]);
    expect((await storedSlices(host.owner)).alerts).toEqual(host.engine.slice('alerts'));
    expect(verifyTrail(await readTrail(host.owner), await readHead(host.owner))).toMatchObject({ ok: true });
    expect(host.engine.slice('session')?.state).toBe('RECORDING');

    // A track ID is refused, as for raise.
    await expect(host.engine.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'VIDEO-02' })).rejects.toBeInstanceOf(SimNotFoundError);
  });

  it('A-1: an ID the Core does not know is ignored and said ONCE per value: a warn line and an error-log entry, however many frames name it', async () => {
    const host = await booted('r58_ignored');
    const persisted = vi.spyOn(host.app.errorLog, 'append');
    const sent = host.database.statements.length;
    const revision = host.engine.revision;
    for (let index = 0; index < 20; index += 1) {
      await host.engine.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'VIDEO-02', state: 'WAITING' }, { deviceId: 'CAM-01', state: 'CONNECTED' }], fragments: [{ deviceId: 'VIDEO-02', count: index, bytes: index }] }));
    }
    // Ignored: the camera of that track is as it was, nothing was written.
    expect(cameras(host)).toEqual([
      { id: 'CAM-01', online: true, streamState: 'LIVE' },
      { id: 'CAM-02', online: true, streamState: 'LIVE' },
    ]);
    expect(host.database.statements).toHaveLength(sent);
    expect(host.engine.revision).toBe(revision);
    // Visible: once each.
    expect(persisted.mock.calls.map(([entry]) => [entry.level, entry.source, entry.context?.['ignored']])).toEqual([
      ['warn', 'engine.host', 'ingest:VIDEO-02'],
      ['warn', 'engine.host', 'fragments:VIDEO-02'],
    ]);
    expect(host.log.lines().filter((line) => line['ignored'] !== undefined).map((line) => line['ignored'])).toEqual(['ingest:VIDEO-02', 'fragments:VIDEO-02']);

    // Control: the same frames in the Core's vocabulary are applied and say nothing.
    await host.engine.applyCaptureTelemetry(frame({ ingest: [{ deviceId: 'CAM-02', state: 'WAITING' }] }));
    expect(cameras(host)[1]).toEqual({ id: 'CAM-02', online: false, streamState: 'LOST' });
    expect(persisted).toHaveBeenCalledTimes(2);
  });

  it('A-4: in capture mode real the meters of a recording read NO SIGNAL without a fresh frame (before the first, after the last); in mode simulated they are generated', async () => {
    const real = await booted('r58_real_meters', 'real');
    await startRecording(real);
    await real.drive(1_000);
    const silent = { dbfs: -90, peak: -90, noSignal: true };
    expect(real.engine.meters()?.audio.inputs['MIC-01']).toMatchObject(silent);
    expect(real.engine.meters()?.audio.inputs['MIC-02']).toMatchObject(silent);

    await real.engine.applyCaptureTelemetry(frame({ levels: [{ role: 'PRIMARY', dbfs: -14.5, clipped: false }, { role: 'STANDBY', dbfs: -33, clipped: false }] }));
    await real.drive(50);
    expect(real.engine.meters()?.audio.inputs['MIC-01']).toMatchObject({ dbfs: -14.5, noSignal: false });
    expect(real.engine.meters()?.audio.inputs['MIC-02']).toMatchObject({ dbfs: -33, noSignal: false });

    // The worker is down: no frame for longer than the hold.
    await real.drive(1_200);
    expect(real.engine.meters()?.audio.inputs['MIC-01']).toMatchObject(silent);
    await real.drive(5_000);
    expect(meterFrames(real.publications).slice(-20).every((meter) => meter.audio.inputs['MIC-01'].noSignal && meter.audio.inputs['MIC-02'].noSignal)).toBe(true);
    expect(real.engine.slice('session')?.state).toBe('RECORDING');

    // Control: the default mode keeps the generated levels.
    const simulated = await booted('r58_simulated_meters');
    await startRecording(simulated);
    await simulated.drive(1_000);
    expect(simulated.engine.meters()?.audio.inputs['MIC-01'].noSignal).toBe(false);
  });
});
