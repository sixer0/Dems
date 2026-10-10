// Fix pass F-M5 (review row 63 R63-03, controller decision D179; review row 74 R74-03 "degraded
// start"). The real supervisor and the real forwarder on a fake worker, an engine that records its
// calls. Each rule has the case that could fail beside it.
//
//   KEYFRAME_INTERVAL_ABOVE_BOUND   the worker's ADVISORY warning (or the record that carries the
//                                   number) raises the NAMED advisory alert of the camera, once
//   AV_OFFSET_NEAR_BOUND            the `nearBound` flag of the telemetry raises it; resolved when
//                                   the flag is false again
//   both                            never a fault; resolved when the session's capture ends
//   CAMERA_NOT_CONNECTED            is NOT raised as a critical capture fault of the camera: the
//                                   degraded start is the WARNING of the session-start notice
import { CaptureMicRole, CaptureWarningCode, CaptureWarningReason } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import { capturePlan, fakeLauncher, flush, manualCaptureTimers } from '../../../test/support/capture';
import { ForwarderReportCode, createCaptureSupervisor, forwardCaptureEvents, type CaptureReport } from '../index';

const FIRST = 'S-TEST-0001';
const SECOND = 'S-TEST-0002';

async function rig(engineFails = false) {
  const clock = manualCaptureTimers();
  const fake = fakeLauncher({});
  const calls: string[] = [];
  const reports: CaptureReport[] = [];
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits: {} });
  forwardCaptureEvents({
    capture: supervisor,
    engine: () => ({
      applyCaptureTelemetry: async () => {},
      raiseCaptureWarning: async (warning) => {
        calls.push(`raise ${warning.code}:${String(warning.subject)}`);
        if (engineFails) throw new Error('the engine refused');
      },
      clearCaptureWarning: async (warning) => void calls.push(`clear ${warning.code}:${String(warning.subject)}`),
      clearCaptureFaults: async () => void calls.push('clear every capture fault'),
    }),
    report: (entry) => void reports.push(entry),
    now: clock.now,
  });
  await supervisor.boot();
  const frame = (nearBound: boolean, deviceId = 'CAM-01'): void =>
    fake.last().say({
      type: 'TELEMETRY',
      levels: [{ deviceId: 'MIC-01', role: CaptureMicRole.PRIMARY, dbfs: -20, clipped: false, ratePpm: 10 }],
      ingest: [],
      fragments: [],
      clocks: [{ deviceId, lagMs: 31.5, trendPpm: null, nearBound }],
      tapActive: false,
    });
  const start = async (sessionId: string): Promise<void> => {
    await supervisor.start(sessionId, capturePlan(sessionId));
    await flush();
    calls.length = 0;
  };
  return { clock, fake, supervisor, calls, reports, frame, start };
}

const keyframeWarning = (h: Awaited<ReturnType<typeof rig>>, deviceId: string): void => h.fake.last().warning(CaptureWarningCode.CAPTURE_FAULT, deviceId, 'ACTIVE', CaptureWarningReason.KEYFRAME_INTERVAL_ABOVE_BOUND);
const keyframeRecord = (h: Awaited<ReturnType<typeof rig>>, deviceId: string, aboveBound: boolean): void =>
  h.fake.last().record({ kind: 'KEYFRAME_INTERVAL', deviceId, observedMs: aboveBound ? 5_000 : 2_000, boundMs: 2_000, intervals: 1, complete: true, aboveBound });

describe('R63-03: the keyframe-interval advisory reaches the operator as a named alert', () => {
  it('the ACTIVE warning raises the advisory of that camera ONCE; the record of the same condition and a repeated warning raise nothing more; no fault', async () => {
    const h = await rig();
    await h.start(FIRST);
    keyframeWarning(h, 'CAM-02');
    await flush();
    expect(h.calls).toEqual(['raise KEYFRAME_INTERVAL_ABOVE_BOUND:CAM-02']);
    keyframeRecord(h, 'CAM-02', true);
    keyframeWarning(h, 'CAM-02');
    await flush();
    expect(h.calls).toEqual(['raise KEYFRAME_INTERVAL_ABOVE_BOUND:CAM-02']);
    expect(h.calls.filter((call) => call.includes('CAPTURE_FAULT'))).toEqual([]);
    // The other camera is its own alert.
    keyframeWarning(h, 'CAM-01');
    await flush();
    expect(h.calls).toEqual(['raise KEYFRAME_INTERVAL_ABOVE_BOUND:CAM-02', 'raise KEYFRAME_INTERVAL_ABOVE_BOUND:CAM-01']);
    expect(h.reports).toEqual([]);
  });

  it('the record alone (an interval that completed above the bound, no warning seen) raises it too; a record inside the bound raises nothing', async () => {
    const h = await rig();
    await h.start(FIRST);
    // (The supervisor hands on one KEYFRAME_INTERVAL record per camera: the two cases use the two cameras.)
    keyframeRecord(h, 'CAM-02', false);
    await flush();
    expect(h.calls).toEqual([]);
    keyframeRecord(h, 'CAM-01', true);
    await flush();
    expect(h.calls).toEqual(['raise KEYFRAME_INTERVAL_ABOVE_BOUND:CAM-01']);
  });

  it('it is resolved when the capture of the session ends, and a later session raises a new one', async () => {
    const h = await rig();
    await h.start(FIRST);
    keyframeWarning(h, 'CAM-02');
    await flush();
    await h.supervisor.stop(FIRST, 'STOPPED');
    await flush();
    expect(h.calls).toEqual(['raise KEYFRAME_INTERVAL_ABOVE_BOUND:CAM-02', 'clear KEYFRAME_INTERVAL_ABOVE_BOUND:CAM-02']);
    await h.start(SECOND);
    keyframeWarning(h, 'CAM-02');
    await flush();
    expect(h.calls).toEqual(['raise KEYFRAME_INTERVAL_ABOVE_BOUND:CAM-02']);
  });

  it('an engine that refuses is reported once per raise and never thrown; the advisory is asked again at the next statement', async () => {
    const h = await rig(true);
    await h.start(FIRST);
    keyframeWarning(h, 'CAM-02');
    await flush();
    expect(h.reports.map((report) => report.code)).toEqual([ForwarderReportCode.ADVISORY_FAILED]);
    keyframeWarning(h, 'CAM-02');
    await flush();
    expect(h.calls).toEqual(['raise KEYFRAME_INTERVAL_ABOVE_BOUND:CAM-02', 'raise KEYFRAME_INTERVAL_ABOVE_BOUND:CAM-02']);
    expect(h.supervisor.status().phase).toBe('RECORDING');
  });
});

describe('R63-03: the clock near the audio / video bound reaches the operator as a named alert', () => {
  it('nearBound true raises AV_OFFSET_NEAR_BOUND of that camera once per episode; false resolves it; the next episode is raised again', async () => {
    const h = await rig();
    await h.start(FIRST);
    for (const near of [false, true, true, false, false, true]) {
      h.frame(near);
      await flush();
    }
    expect(h.calls).toEqual(['raise AV_OFFSET_NEAR_BOUND:CAM-01', 'clear AV_OFFSET_NEAR_BOUND:CAM-01', 'raise AV_OFFSET_NEAR_BOUND:CAM-01']);
    expect(h.calls.filter((call) => call.includes('CAPTURE_FAULT'))).toEqual([]);
    expect(h.reports).toEqual([]);
  });

  it('it is resolved when the capture of the session ends', async () => {
    const h = await rig();
    await h.start(FIRST);
    h.frame(true, 'CAM-02');
    await flush();
    await h.supervisor.stop(FIRST, 'STOPPED');
    await flush();
    expect(h.calls).toEqual(['raise AV_OFFSET_NEAR_BOUND:CAM-02', 'clear AV_OFFSET_NEAR_BOUND:CAM-02']);
  });

  it('CONTROL: a frame that never says nearBound raises nothing', async () => {
    const h = await rig();
    await h.start(FIRST);
    h.frame(false);
    h.frame(false);
    await flush();
    expect(h.calls).toEqual([]);
  });
});

describe('R74-03: a camera that did not connect at a degraded start is not a critical capture fault', () => {
  it('CAMERA_NOT_CONNECTED raises no fault of the camera (its WARNING is the session-start notice); a camera that STOPPED delivering is a fault', async () => {
    const h = await rig();
    await h.start(FIRST);
    h.fake.last().warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_NOT_CONNECTED);
    await flush();
    expect(h.calls).toEqual([]);
    // CONTROL: the same camera, another reason.
    h.fake.last().warning(CaptureWarningCode.CAPTURE_FAULT, 'CAM-02', 'ACTIVE', CaptureWarningReason.CAMERA_STREAM_ENDED);
    await flush();
    expect(h.calls).toEqual(['raise CAPTURE_FAULT:CAM-02']);
  });
});
