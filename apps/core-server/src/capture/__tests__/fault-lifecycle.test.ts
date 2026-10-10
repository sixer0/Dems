// The fault life cycle of the capture side and what protocol 4 added to the supervisor (blueprint
// row 71, Core half; decisions D72(h), D84 R-1 to R-4, D85, D127 (2), D58-7; row 61's request for the
// proof-build mark). In memory: the real supervisor and the real forwarder on a `FakeWorkerProcess`,
// manual timers, an engine that records its calls. Each rule has the case that could fail beside it.
import { CAPTURE_PROTOCOL_VERSION, CaptureMicRole, CaptureWarningCode, CaptureWarningReason, type AudioSourceIntervalRecord } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import { capturePlan, fakeLauncher, flush, manualCaptureTimers } from '../../../test/support/capture';
import { CAPTURE_WARNING_CLEAR_HOLD_MS, CapturePhase, CaptureNoticeCode, ForwarderReportCode, WorkerDownCode, createCaptureSupervisor, forwardCaptureEvents, type CaptureNotice, type CaptureReport } from '../index';

const FIRST = 'S-TEST-0001';
const SECOND = 'S-TEST-0002';

async function rig(limits: Record<string, number> = {}, behaviour: Parameters<typeof fakeLauncher>[0] = {}) {
  const clock = manualCaptureTimers();
  const fake = fakeLauncher(behaviour);
  const calls: string[] = [];
  const reports: CaptureReport[] = [];
  const notices: CaptureNotice[] = [];
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits });
  forwardCaptureEvents({
    capture: supervisor,
    engine: () => ({
      applyCaptureTelemetry: async () => {},
      raiseCaptureWarning: async (warning) => void calls.push(`raise ${warning.code}:${String(warning.subject)}`),
      clearCaptureWarning: async (warning) => void calls.push(`clear ${warning.code}:${String(warning.subject)}`),
      clearCaptureFaults: async () => void calls.push('clear every capture fault'),
    }),
    report: (entry) => void reports.push(entry),
    notice: (entry) => void notices.push(entry),
    now: clock.now,
  });
  await supervisor.boot();
  /** Lets the hold pass and the next telemetry frame apply what stayed cleared. */
  const hold = async (): Promise<void> => {
    // A sign of life first: the hold is longer than half the heartbeat limit.
    fake.last().heartbeat();
    clock.advance(CAPTURE_WARNING_CLEAR_HOLD_MS);
    fake.last().heartbeat();
    fake.last().telemetry(1);
    await flush();
  };
  return { clock, fake, supervisor, calls, reports, notices, hold };
}

describe('D84 R-1 and R-2: one subject form, never nothing', () => {
  it('R-1: a MIC_SILENT that names no microphone never reaches the engine: the supervisor ends the worker that says it (no frame of protocol 4 has no subject)', async () => {
    const { fake, supervisor, calls, reports } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    calls.length = 0;
    const worker = fake.last();
    worker.say({ type: 'WARNING', code: 'MIC_SILENT', reason: 'MIC_LEVEL_BELOW_THRESHOLD', state: 'ACTIVE', subject: null as unknown as string });
    await flush();
    // The supervisor refuses a subject that is no device of the plan: the worker is ended, nothing reaches the engine.
    expect(calls.filter((call) => call.startsWith('raise MIC_SILENT'))).toEqual([]);
    expect(supervisor.status().lastCrash).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'WARNING_SUBJECT_UNKNOWN' });
    expect(reports.filter((report) => report.code === ForwarderReportCode.WARNING_FAILED)).toEqual([]);
  });

  it('R-2: a mic role is no subject (protocol 4) - the worker that says one is ended; the same mic by its device ID is ONE fault across raise, clear and raise again', async () => {
    const { fake, supervisor, calls, hold } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    calls.length = 0;
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    await flush();
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01', 'CLEARED');
    await flush();
    await hold();
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'MIC-01');
    await flush();
    // The second silence IS recorded (the navigator's NAV-ALIAS scenario lost it).
    expect(calls).toEqual(['raise MIC_SILENT:MIC-01', 'clear MIC_SILENT:MIC-01', 'raise MIC_SILENT:MIC-01']);
    // CONTROL: the role word ends the worker instead of opening a second entry for the same microphone.
    fake.last().warning(CaptureWarningCode.MIC_SILENT, 'PRIMARY');
    await flush();
    expect(supervisor.status().lastCrash).toMatchObject({ detail: 'WARNING_SUBJECT_UNKNOWN' });
    expect(calls.filter((call) => call.includes('PRIMARY'))).toEqual([]);
  });
});

describe('D84 R-3: two sessions that fail in a row are two faults', () => {
  it('each failed session raises its own CAPTURE_FAULT: the held one is cleared, then the new one is raised (two FAULT_RAISED rows)', async () => {
    const { fake, supervisor, calls } = await rig({ maxRestarts: 0 });
    fake.failNext(1, false);
    await expect(supervisor.start(FIRST, capturePlan(FIRST))).rejects.toMatchObject({ code: 'CAPTURE_FAULT' });
    await flush();
    fake.failNext(1, false);
    await expect(supervisor.start(SECOND, capturePlan(SECOND))).rejects.toMatchObject({ code: 'CAPTURE_FAULT' });
    await flush();
    expect(calls).toEqual(['raise CAPTURE_FAULT:null', 'clear CAPTURE_FAULT:null', 'raise CAPTURE_FAULT:null']);
  });

  it('CONTROL: the SAME session saying its fault again writes nothing (one occurrence, one row)', async () => {
    const { fake, supervisor, calls } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    calls.length = 0;
    fake.last().warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02');
    fake.last().heartbeat();
    await flush();
    fake.last().warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02');
    await flush();
    expect(calls).toEqual(['raise CAPTURE_FAULT:CAM-02']);
  });
});

describe('D84 R-4: a capture fault this forwarder did not raise is cleared when a session records', () => {
  it('the first RECORDING of every session clears EVERY capture fault of the engine, once; a restart inside the session does not', async () => {
    const { fake, supervisor, calls } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    expect(calls).toEqual(['clear every capture fault']);
    // A worker that goes down before anything is durable is replaced: RECORDING again, the same session.
    fake.last().exit(1);
    await flush();
    expect(supervisor.status().phase).toBe(CapturePhase.RESTARTING);
    await supervisor.stop(FIRST, 'STOPPED');
    await supervisor.start(SECOND, capturePlan(SECOND));
    await flush();
    expect(calls.filter((call) => call === 'clear every capture fault')).toHaveLength(2);
  });
});

describe('protocol 4: a fault per cause, advisory reasons, notices', () => {
  it('ruling D146 (migration 0013): two causes on one camera are TWO faults of the engine - each raised when it begins and cleared, after the hold, when IT ended', async () => {
    const { fake, supervisor, calls, hold } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    calls.length = 0;
    const worker = fake.last();
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await flush();
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_CLOCK_OUT_OF_BOUND);
    await flush();
    expect(calls).toEqual(['raise CAPTURE_FAULT:CAM-02', 'raise CAPTURE_FAULT:CAM-02']);
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'CLEARED', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await flush();
    await hold();
    // One cause ended: ONE clear. The other cause is another fault and stays raised.
    expect(calls).toEqual(['raise CAPTURE_FAULT:CAM-02', 'raise CAPTURE_FAULT:CAM-02', 'clear CAPTURE_FAULT:CAM-02']);
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'CLEARED', CaptureWarningReason.CAMERA_CLOCK_OUT_OF_BOUND);
    await flush();
    await hold();
    expect(calls).toEqual(['raise CAPTURE_FAULT:CAM-02', 'raise CAPTURE_FAULT:CAM-02', 'clear CAPTURE_FAULT:CAM-02', 'clear CAPTURE_FAULT:CAM-02']);
  });

  it('a microphone that is disconnected AND at its rate limit: the fault of the first and the advice of the second (pass D9) are raised and ended each on its own', async () => {
    const { fake, supervisor, calls, hold } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    calls.length = 0;
    const worker = fake.last();
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'MIC-02', 'ACTIVE', CaptureWarningReason.MIC_DISCONNECTED);
    await flush();
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'MIC-02', 'ACTIVE', CaptureWarningReason.MIC_RATE_AT_LIMIT);
    await flush();
    expect(calls).toEqual(['raise CAPTURE_FAULT:MIC-02', 'raise MIC_RATE_AT_LIMIT:MIC-02']);
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'MIC-02', 'CLEARED', CaptureWarningReason.MIC_DISCONNECTED);
    await flush();
    await hold();
    expect(calls).toEqual(['raise CAPTURE_FAULT:MIC-02', 'raise MIC_RATE_AT_LIMIT:MIC-02', 'clear CAPTURE_FAULT:MIC-02']);
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'MIC-02', 'CLEARED', CaptureWarningReason.MIC_RATE_AT_LIMIT);
    await flush();
    expect(calls).toEqual(['raise CAPTURE_FAULT:MIC-02', 'raise MIC_RATE_AT_LIMIT:MIC-02', 'clear CAPTURE_FAULT:MIC-02', 'clear MIC_RATE_AT_LIMIT:MIC-02']);
  });

  it('D127 (2): KEYFRAME_INTERVAL_ABOVE_BOUND raises NO fault - the camera is not faulted; the record gives the operator the number; a real loss of that camera IS a fault', async () => {
    const { fake, supervisor, calls, notices } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    calls.length = 0;
    const worker = fake.last();
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.KEYFRAME_INTERVAL_ABOVE_BOUND);
    worker.record({ kind: 'KEYFRAME_INTERVAL', deviceId: 'CAM-02', observedMs: 5_000, boundMs: 2_000, intervals: 1, complete: true, aboveBound: true });
    await flush();
    expect(calls).toEqual([]);
    expect(notices).toEqual([{ code: CaptureNoticeCode.KEYFRAME_INTERVAL_ABOVE_BOUND, sessionId: FIRST, correlationId: `cap:${FIRST}:1`, deviceId: 'CAM-02', value: 5_000, bound: 2_000 }]);
    // CONTROL: the same camera with a reason that is no advisory one.
    worker.warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await flush();
    expect(calls).toEqual(['raise CAPTURE_FAULT:CAM-02']);
  });

  it('a keyframe interval inside the bound is no notice', async () => {
    const { fake, supervisor, notices } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    fake.last().record({ kind: 'KEYFRAME_INTERVAL', deviceId: 'CAM-01', observedMs: 2_000, boundMs: 2_000, intervals: 3, complete: true, aboveBound: false });
    await flush();
    expect(notices).toEqual([]);
  });

  it('D58-7 and D85: nearBound and a rate at +-5,000 ppm are said ONCE per episode, with the device and the number, and again after they ended', async () => {
    const { fake, supervisor, notices } = await rig();
    await supervisor.start(FIRST, capturePlan(FIRST));
    const frame = (nearBound: boolean, ratePpm: number): void =>
      fake.last().say({
        type: 'TELEMETRY',
        levels: [{ deviceId: 'MIC-01', role: CaptureMicRole.PRIMARY, dbfs: -20, clipped: false, ratePpm }],
        ingest: [],
        fragments: [],
        clocks: [{ deviceId: 'CAM-01', lagMs: 31.5, trendPpm: null, nearBound }],
        tapActive: false,
      });
    for (const [near, rate] of [[false, 120], [true, 5_000], [true, 5_000], [false, 4_999], [true, -5_000]] as const) {
      frame(near, rate);
      await flush();
    }
    expect(notices.map((entry) => `${entry.code} ${entry.deviceId} ${entry.value}`)).toEqual([
      'CAPTURE_CLOCK_NEAR_BOUND CAM-01 31.5',
      'CAPTURE_MIC_RATE_AT_LIMIT MIC-01 5000',
      'CAPTURE_CLOCK_NEAR_BOUND CAM-01 31.5',
      'CAPTURE_MIC_RATE_AT_LIMIT MIC-01 -5000',
    ]);
  });
});

describe('protocol 4 in the supervisor: whose device a record names, and the record of a switch', () => {
  const interval = (patch: Partial<AudioSourceIntervalRecord>): AudioSourceIntervalRecord => ({
    kind: 'AUDIO_SOURCE_INTERVAL',
    deviceId: 'MIC-01',
    role: 'PRIMARY',
    index: 1,
    fromSample: 0,
    sampleRateHz: 48_000,
    capturedAtMs: 1_760_000_000_000,
    reason: 'SESSION_START',
    correlationId: null,
    appliedDelayUs: null,
    ...patch,
  });

  it('an interval record names a MICROPHONE of the plan and a timeline end names nothing: both are handed on (the first record of every version-4 session)', async () => {
    const { fake, supervisor } = await rig();
    const seen: string[] = [];
    supervisor.on('record', (event) => void seen.push(event.record.kind));
    await supervisor.start(FIRST, capturePlan(FIRST));
    fake.last().record(interval({}));
    fake.last().record({ kind: 'AUDIO_TIMELINE_END', samples: 96_000, sampleRateHz: 48_000, intervals: 1 });
    await flush();
    expect(seen).toEqual(['AUDIO_SOURCE_INTERVAL', 'AUDIO_TIMELINE_END']);
    expect(supervisor.status().lastCrash).toBeNull();
  });

  it('CONTROL: an interval that names a camera, and a fragment that names a microphone, end the worker', async () => {
    for (const record of [interval({ deviceId: 'CAM-01' }), { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'MIC-01', bytes: 1 } as const]) {
      const { fake, supervisor } = await rig();
      await supervisor.start(FIRST, capturePlan(FIRST));
      fake.last().record(record);
      await flush();
      expect(supervisor.status().lastCrash, record.kind).toMatchObject({ code: WorkerDownCode.PROTOCOL_VIOLATION, detail: 'RECORD_SUBJECT_UNKNOWN' });
    }
  });

  it('switchAudioSource resolves with the interval record the worker wrote for THAT command; a switch that changed nothing resolves null', async () => {
    const { fake, supervisor } = await rig({}, { ackSwitch: false });
    await supervisor.start(FIRST, capturePlan(FIRST));
    const worker = fake.last();
    const switching = supervisor.switchAudioSource(FIRST, CaptureMicRole.STANDBY);
    await flush();
    const command = worker.commands('SWITCH_AUDIO_SOURCE')[0];
    expect(command).toMatchObject({ v: CAPTURE_PROTOCOL_VERSION, to: 'STANDBY' });
    // The worker writes the record BEFORE the acknowledgement.
    const written = interval({ deviceId: 'MIC-02', role: 'STANDBY', index: 2, fromSample: 96_000, reason: 'OPERATOR_SWITCH', correlationId: command?.correlationId ?? null, appliedDelayUs: 9_800 });
    worker.record(written);
    worker.ack(true, undefined, command);
    await expect(switching).resolves.toEqual(written);

    // The role that already feeds the track: acknowledged, no record.
    const again = supervisor.switchAudioSource(FIRST, CaptureMicRole.STANDBY);
    await flush();
    worker.ack(true, undefined, worker.commands('SWITCH_AUDIO_SOURCE')[1]);
    await expect(again).resolves.toBeNull();
  });

  it('a record of ANOTHER command is not handed to this switch', async () => {
    const { fake, supervisor } = await rig({}, { ackSwitch: false });
    await supervisor.start(FIRST, capturePlan(FIRST));
    const worker = fake.last();
    const switching = supervisor.switchAudioSource(FIRST, CaptureMicRole.STANDBY);
    await flush();
    worker.record(interval({ deviceId: 'MIC-02', role: 'STANDBY', index: 2, fromSample: 480, reason: 'OPERATOR_SWITCH', correlationId: 'cap:somebody-else:9', appliedDelayUs: 1 }));
    worker.ack(true, undefined, worker.commands('SWITCH_AUDIO_SOURCE')[0]);
    await expect(switching).resolves.toBeNull();
  });
});

describe('a proof build of the worker is never recorded with (row 61, pair-58 F-10)', () => {
  it('a HELLO whose version carries the proof mark ends the worker, is not retried, and the start is refused with CAPTURE_WORKER_PROOF_BUILD', async () => {
    const { fake, supervisor, clock } = await rig({}, { hello: false });
    const starting = supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    fake.last().say({ type: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: 'capture-worker/0.4.0-proof' });
    await expect(starting).rejects.toMatchObject({ code: 'CAPTURE_FAULT', detail: 'CAPTURE_WORKER_PROOF_BUILD' });
    expect(fake.last().received).toEqual([]);
    clock.advance(600_000);
    await flush();
    expect(fake.calls()).toBe(1);
    expect(supervisor.status()).toMatchObject({ phase: CapturePhase.IDLE, lastCrash: { code: WorkerDownCode.PROOF_BUILD } });
  });

  it('CONTROL: the same HELLO with a release version starts the session', async () => {
    const { fake, supervisor } = await rig({}, { hello: false });
    const starting = supervisor.start(FIRST, capturePlan(FIRST));
    await flush();
    fake.last().say({ type: 'HELLO', protocolVersion: CAPTURE_PROTOCOL_VERSION, workerVersion: 'capture-worker/0.4.0' });
    await expect(starting).resolves.toBeUndefined();
    expect(supervisor.status().phase).toBe(CapturePhase.RECORDING);
  });
});
