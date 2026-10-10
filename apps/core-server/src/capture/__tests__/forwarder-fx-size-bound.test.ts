// Closing pass F-X, item 5 (ruling D179 (a) on review R63-02; fix F-M5 decision 5): the worker's
// ADVISORY warning `FRAGMENT_SIZE_BOUND_REACHED` reaches the operator as the NAMED advisory alert of
// that camera, exactly as `KEYFRAME_INTERVAL_ABOVE_BOUND` does: once per camera per session, never a
// fault, resolved when the session's capture ends. The frame is a LINE of the protocol, read by the
// protocol's decoder, then handed to the real supervisor and the real forwarder. Written RED: the
// forwarder raised nothing for the reason.
import { CAPTURE_PROTOCOL_VERSION, decodeWorkerLine, type WorkerMessage } from '@dems/capture-protocol';
import { CaptureAdvisoryReason } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { capturePlan, fakeLauncher, flush, manualCaptureTimers } from '../../../test/support/capture';
import { createCaptureSupervisor, forwardCaptureEvents, type CaptureReport } from '../index';

const FIRST = 'S-TEST-0001';
const SECOND = 'S-TEST-0002';
const REASON = 'FRAGMENT_SIZE_BOUND_REACHED';

async function rig() {
  const clock = manualCaptureTimers();
  const fake = fakeLauncher({});
  const calls: string[] = [];
  const reports: CaptureReport[] = [];
  const supervisor = createCaptureSupervisor({ now: clock.now, timers: clock.timers, launcher: fake.launcher, limits: {} });
  forwardCaptureEvents({
    capture: supervisor,
    engine: () => ({
      applyCaptureTelemetry: async () => {},
      raiseCaptureWarning: async (warning) => void calls.push(`raise ${warning.code}:${String(warning.subject)}`),
      clearCaptureWarning: async (warning) => void calls.push(`clear ${warning.code}:${String(warning.subject)}`),
      clearCaptureFaults: async () => void calls.push('clear every capture fault'),
    }),
    report: (entry) => void reports.push(entry),
    now: clock.now,
  });
  await supervisor.boot();
  const start = async (sessionId: string): Promise<void> => {
    await supervisor.start(sessionId, capturePlan(sessionId));
    await flush();
    calls.length = 0;
  };
  /** The worker's line as `ingest.c` writes it, through the decoder of the protocol. */
  const sizeBoundLine = (sessionId: string, deviceId: string): void => {
    const line = JSON.stringify({ v: CAPTURE_PROTOCOL_VERSION, type: 'WARNING', sessionId, code: 'CAPTURE_FAULT', reason: REASON, state: 'ACTIVE', subject: deviceId });
    const decoded = decodeWorkerLine(line);
    expect(decoded.ok, JSON.stringify(decoded)).toBe(true);
    const { v: _v, sessionId: _s, ...message } = (decoded as { ok: true; message: WorkerMessage }).message as WorkerMessage & { sessionId: string };
    fake.last().say(message as Parameters<ReturnType<typeof fake.last>['say']>[0], sessionId);
  };
  return { supervisor, calls, reports, start, sizeBoundLine };
}

describe('FRAGMENT_SIZE_BOUND_REACHED reaches the operator as a named advisory alert of the camera', () => {
  it('the shared advisory vocabulary has the member', () => {
    expect(Object.values(CaptureAdvisoryReason)).toContain(REASON);
  });

  it('raised ONCE per camera per session, the other camera is its own alert, never a fault', async () => {
    const h = await rig();
    await h.start(FIRST);
    h.sizeBoundLine(FIRST, 'CAM-02');
    await flush();
    expect(h.calls).toEqual([`raise ${REASON}:CAM-02`]);
    h.sizeBoundLine(FIRST, 'CAM-02');
    await flush();
    expect(h.calls).toEqual([`raise ${REASON}:CAM-02`]);
    h.sizeBoundLine(FIRST, 'CAM-01');
    await flush();
    expect(h.calls).toEqual([`raise ${REASON}:CAM-02`, `raise ${REASON}:CAM-01`]);
    expect(h.calls.filter((call) => call.includes('CAPTURE_FAULT'))).toEqual([]);
    expect(h.reports).toEqual([]);
    expect(h.supervisor.status().phase).toBe('RECORDING');
  });

  it('resolved when the capture of the session ends; a later session raises a new one', async () => {
    const h = await rig();
    await h.start(FIRST);
    h.sizeBoundLine(FIRST, 'CAM-02');
    await flush();
    await h.supervisor.stop(FIRST, 'STOPPED');
    await flush();
    expect(h.calls).toEqual([`raise ${REASON}:CAM-02`, `clear ${REASON}:CAM-02`]);
    await h.start(SECOND);
    h.sizeBoundLine(SECOND, 'CAM-02');
    await flush();
    expect(h.calls).toEqual([`raise ${REASON}:CAM-02`]);
  });

  it('CONTROL: a session in which the worker says nothing of the kind raises and clears no advice', async () => {
    const h = await rig();
    await h.start(FIRST);
    await h.supervisor.stop(FIRST, 'STOPPED');
    await flush();
    expect(h.calls.filter((call) => call.includes(REASON))).toEqual([]);
  });
});
