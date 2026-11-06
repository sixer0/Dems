// Blueprint row 139 (NEW SCOPE R-10, situation C): what the capture of a session says at its start,
// turned into the operator's notices. JOINED to a real simulator (the one the engine host runs), as
// `notices.test.ts` does: the engine stand-in only turns a call into the simulator's INTERNAL action.
// No database, no socket, no process, no worker: the events are the ones `src/capture-session` tells.
//
// Checks: M5-NODEV-C-1 (the notice half: one alert and one audit row for a failed start, one warning
// for one camera of two, nothing announced before the session records). Each `it` holds its control.
import { createManualClock, createSim, type Sim, type SimAlert, type SimState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import type { SessionCaptureEvent } from '../../capture-session';
import { SessionStartReportCode, captureNotices, createNoDeviceNotifier, createSessionStartWatch, type CaptureNoticesApp, type NoticeEngine, type NoticeReport, type SessionStartEvent, type SessionStartSource } from '../index';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const SESSION = 'SES-20261001-0001';
const NEXT_SESSION = 'SES-20261001-0002';

function simulatorEngine(sim: Sim): NoticeEngine {
  return {
    async raiseCaptureWarning(warning) {
      sim.actions.raiseCaptureWarning(warning);
    },
    async clearCaptureWarning(warning) {
      sim.actions.clearCaptureWarning(warning);
    },
  };
}

function harness(options: { state?: () => Pick<SimState, 'alerts'> | null } = {}) {
  const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null });
  const reports: NoticeReport[] = [];
  const report = (entry: NoticeReport): void => void reports.push(entry);
  const notifier = createNoDeviceNotifier({ engine: () => simulatorEngine(sim), report });
  const watch = createSessionStartWatch({ notifier, state: options.state ?? (() => sim.store.getState()), report });
  const state = (): SimState => sim.store.getState();
  const notices = (deviceId: string, active?: boolean): SimAlert[] =>
    state().alerts.filter((alert) => alert.kind === 'SYSTEM' && alert.params?.['reason'] === 'CAPTURE_DEVICE_UNREACHABLE' && alert.target === deviceId && (active === undefined || alert.active === active));
  const faults = (active?: boolean): SimAlert[] => state().alerts.filter((alert) => alert.kind === 'CAPTURE_FAULT' && (active === undefined || alert.active === active));
  const rowsOf = (type: string) => state().audit.rows.filter((row) => row.type === type);
  const camera = (deviceId: string) => state().captureDevices.devices.find((device) => device.id === deviceId);
  return { sim, watch, notifier, reports, state, notices, faults, rowsOf, camera };
}

const connecting = (sessionId: string): SessionStartEvent => ({ type: 'CONNECTING', sessionId });
const started = (sessionId: string, cameras: string[], camerasNotOpened: string[]): SessionStartEvent => ({ type: 'STARTED', sessionId, cameras, camerasNotOpened });
const durable = (sessionId: string): SessionStartEvent => ({ type: 'DURABLE', sessionId });

describe('one definition: the events are the capture-session unit\'s', () => {
  it('every event of `SessionCaptureEvent` is an event this watch takes', () => {
    // Compile-time: a member renamed in `src/capture-session` stops this file from typechecking.
    const take = (event: SessionCaptureEvent): SessionStartEvent => event;
    expect(take({ type: 'FAILED_START', sessionId: SESSION, cause: 'NO_CAMERA_CONNECTED' })).toEqual({ type: 'FAILED_START', sessionId: SESSION, cause: 'NO_CAMERA_CONNECTED' });
  });
});

describe('one camera of two: a degraded session with ONE warning naming the missing camera', () => {
  it('nothing is announced before the session records; from the first durable fragment: one alert, one audit row, the camera reads not connected', async () => {
    const h = harness();
    const auditBefore = h.state().audit.rows.length;
    await h.watch.handle(connecting(SESSION));
    await h.watch.handle(started(SESSION, ['CAM-01'], ['CAM-02']));
    // CONTROL (D84): the capture is not durable yet, so nothing says "the session is recording one camera only".
    expect(h.state().alerts.filter((alert) => alert.active)).toEqual([]);
    expect(h.state().audit.rows).toHaveLength(auditBefore);

    await h.watch.handle(durable(SESSION));
    const alerts = h.notices('CAM-02');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      severity: 'WARNING',
      kind: 'SYSTEM',
      target: 'CAM-02',
      active: true,
      // R-10 AC-6: the device ID, never a label or an address.
      message: 'CAM-02 is not connected',
      params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'SESSION_START', cause: 'NOT_CONNECTED' },
    });
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE').map((row) => row.details)).toEqual([{ deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'SESSION_START', reason: 'NOT_CONNECTED', degraded: true, sessionId: SESSION }]);
    // The tile of that camera reads NO SIGNAL from this; the other camera is untouched.
    expect(h.camera('CAM-02')).toMatchObject({ online: false, streamState: 'LOST' });
    expect(h.notices('CAM-01')).toEqual([]);
    // WARNING, not a fault: the session is not faulted by it and no fault alert exists.
    expect(h.faults()).toEqual([]);
    expect(h.state().faults.active).toEqual([]);

    // Said once: a second DURABLE or STARTED of the same session adds nothing.
    await h.watch.handle(durable(SESSION));
    await h.watch.handle(started(SESSION, ['CAM-01'], ['CAM-02']));
    expect(h.notices('CAM-02')).toHaveLength(1);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);
    expect(h.reports).toEqual([]);
  });

  it('DURABLE before STARTED (the first camera delivered while the second was still being opened): the same one warning', async () => {
    const h = harness();
    await h.watch.handle(connecting(SESSION));
    await h.watch.handle(durable(SESSION));
    // CONTROL: durable alone names no camera.
    expect(h.notices('CAM-02')).toEqual([]);
    await h.watch.handle(started(SESSION, ['CAM-01'], ['CAM-02']));
    expect(h.notices('CAM-02', true)).toHaveLength(1);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);
  });

  it('a pre-check notice of the same camera gives way to the session-start one: one active alert for the device, a second audit row', async () => {
    const h = harness();
    await h.notifier.deviceUnreachable({ deviceId: 'CAM-02', phase: 'PRECHECK', cause: 'UNREACHABLE', degraded: true, sessionId: SESSION });
    expect(h.notices('CAM-02', true).map((alert) => alert.params?.['phase'])).toEqual(['PRECHECK']);

    await h.watch.handle(connecting(SESSION));
    await h.watch.handle(started(SESSION, ['CAM-01'], ['CAM-02']));
    await h.watch.handle(durable(SESSION));
    expect(h.notices('CAM-02').map((alert) => [alert.params?.['phase'], alert.active])).toEqual([
      ['PRECHECK', false],
      ['SESSION_START', true],
    ]);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE').map((row) => row.details['phase'])).toEqual(['PRECHECK', 'SESSION_START']);
    expect(h.camera('CAM-02')).toMatchObject({ online: false });
  });
});

describe('cleared by the capture side only: the camera connects in a later session (D72(h))', () => {
  async function degradedOnce() {
    const h = harness();
    await h.watch.handle(connecting(SESSION));
    await h.watch.handle(started(SESSION, ['CAM-01'], ['CAM-02']));
    await h.watch.handle(durable(SESSION));
    await h.watch.handle({ type: 'STOPPED', sessionId: SESSION });
    expect(h.notices('CAM-02', true)).toHaveLength(1);
    return h;
  }

  it('the warning outlives its session and is resolved, with no audit row, when that camera is opened in a session that records', async () => {
    const h = await degradedOnce();
    const auditBefore = h.state().audit.rows.length;
    await h.watch.handle(connecting(NEXT_SESSION));
    await h.watch.handle(started(NEXT_SESSION, ['CAM-01', 'CAM-02'], []));
    // CONTROL: opened is not connected; only a session that records resolves it.
    expect(h.notices('CAM-02', true)).toHaveLength(1);
    await h.watch.handle(durable(NEXT_SESSION));
    expect(h.notices('CAM-02', true)).toEqual([]);
    expect(h.notices('CAM-02', false)).toHaveLength(1);
    expect(h.state().audit.rows).toHaveLength(auditBefore);
    expect(h.camera('CAM-02')).toMatchObject({ online: true, streamState: 'LIVE' });
  });

  it('a later occurrence is a NEW alert and a new audit row', async () => {
    const h = await degradedOnce();
    await h.watch.handle(connecting(NEXT_SESSION));
    await h.watch.handle(started(NEXT_SESSION, ['CAM-01', 'CAM-02'], []));
    await h.watch.handle(durable(NEXT_SESSION));
    await h.watch.handle({ type: 'STOPPED', sessionId: NEXT_SESSION });
    const third = 'SES-20261001-0003';
    await h.watch.handle(connecting(third));
    await h.watch.handle(started(third, ['CAM-01'], ['CAM-02']));
    await h.watch.handle(durable(third));
    const all = h.notices('CAM-02');
    expect(all.map((alert) => alert.active)).toEqual([false, true]);
    expect(all[0]?.id).not.toBe(all[1]?.id);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE').map((row) => row.details['sessionId'])).toEqual([SESSION, third]);
  });

  it('NOT resolved: a pre-check notice (a later pre-check resolves that one), and a camera a fault names', async () => {
    const precheck = harness();
    await precheck.notifier.deviceUnreachable({ deviceId: 'CAM-02', phase: 'PRECHECK', cause: 'UNREACHABLE', degraded: true, sessionId: SESSION });
    await precheck.watch.handle(connecting(SESSION));
    await precheck.watch.handle(started(SESSION, ['CAM-01', 'CAM-02'], []));
    await precheck.watch.handle(durable(SESSION));
    expect(precheck.notices('CAM-02', true).map((alert) => alert.params?.['phase'])).toEqual(['PRECHECK']);

    const faulted = await degradedOnce();
    await faulted.watch.handle(connecting(NEXT_SESSION));
    await faulted.watch.handle(started(NEXT_SESSION, ['CAM-01', 'CAM-02'], []));
    faulted.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    await faulted.watch.handle(durable(NEXT_SESSION));
    expect(faulted.notices('CAM-02', true)).toHaveLength(1);
  });
});

describe('no camera connected: a failed start with ONE alert and ONE audit row', () => {
  it('the capture side raised its fault: this watch adds nothing - no warning for either camera, no second alert, no second row', async () => {
    const h = harness();
    // The demo history of the simulator holds fault rows of its own: counted from here.
    const faultRowsBefore = h.rowsOf('FAULT_RAISED').length;
    await h.watch.handle(connecting(SESSION));
    // The worker listened and no camera source could be opened; then it ended the session itself.
    await h.watch.handle(started(SESSION, [], ['CAM-01', 'CAM-02']));
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null });
    const auditAfterFault = h.state().audit.rows.length;
    await h.watch.handle({ type: 'FAILED_START', sessionId: SESSION, cause: 'NO_CAMERA_CONNECTED' });

    expect(h.faults()).toHaveLength(1);
    expect(h.faults()[0]).toMatchObject({ severity: 'CRITICAL', active: true });
    expect(h.rowsOf('FAULT_RAISED')).toHaveLength(faultRowsBefore + 1);
    expect(h.state().audit.rows).toHaveLength(auditAfterFault);
    // The session never recorded: no "recording one camera only" for anybody.
    expect(h.notices('CAM-01')).toEqual([]);
    expect(h.notices('CAM-02')).toEqual([]);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toEqual([]);
    expect(h.reports).toEqual([]);

    // A DURABLE that arrives late for the failed session announces nothing either.
    await h.watch.handle(durable(SESSION));
    expect(h.state().alerts.filter((alert) => alert.active)).toHaveLength(1);
  });

  it('one camera was opened and never delivered: still a failed start with the one critical alert, never a degraded warning', async () => {
    const h = harness();
    await h.watch.handle(connecting(SESSION));
    await h.watch.handle(started(SESSION, ['CAM-01'], ['CAM-02']));
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null });
    await h.watch.handle({ type: 'FAILED_START', sessionId: SESSION, cause: 'NO_CAMERA_CONNECTED' });
    expect(h.notices('CAM-02')).toEqual([]);
    expect(h.state().alerts.filter((alert) => alert.active).map((alert) => alert.kind)).toEqual(['CAPTURE_FAULT']);
  });

  it('the net: a failed start that has NO capture fault alert gets it from the notifier, and the error log is told', async () => {
    const h = harness();
    const faultRowsBefore = h.rowsOf('FAULT_RAISED').length;
    await h.watch.handle(connecting(SESSION));
    // CONTROL: before the failed start nothing is raised.
    expect(h.faults()).toEqual([]);
    await h.watch.handle({ type: 'FAILED_START', sessionId: SESSION, cause: 'CAPTURE_WORKER_NOT_STARTED' });
    expect(h.faults(true)).toHaveLength(1);
    expect(h.faults()[0]).toMatchObject({ severity: 'CRITICAL', target: null });
    expect(h.rowsOf('FAULT_RAISED')).toHaveLength(faultRowsBefore + 1);
    expect(h.reports.map((entry) => [entry.source, entry.code, entry.sessionId, entry.deviceId])).toEqual([['captureNotices.sessionStart', SessionStartReportCode.FAULT_RAISED_HERE, SESSION, null]]);
    // Codes only: the cause of a caller is not copied into the report.
    const said = h.reports[0]?.err;
    expect(said instanceof Error ? said.message : '').not.toContain('CAPTURE_WORKER_NOT_STARTED');
    expect(said).toBeInstanceOf(Error);
  });
});

describe('it never throws into the capture session', () => {
  it('a state that cannot be read: nothing is decided, one report with the session ID', async () => {
    const broken = harness({
      state: () => {
        throw new Error('the engine is not running');
      },
    });
    await broken.watch.handle(connecting(SESSION));
    await broken.watch.handle(started(SESSION, ['CAM-01'], ['CAM-02']));
    await expect(broken.watch.handle(durable(SESSION))).resolves.toBeUndefined();
    await expect(broken.watch.handle({ type: 'FAILED_START', sessionId: SESSION, cause: null })).resolves.toBeUndefined();
    expect(broken.state().alerts.filter((alert) => alert.active)).toEqual([]);
    expect(broken.reports.map((entry) => [entry.code, entry.sessionId])).toEqual([
      [SessionStartReportCode.STATE_NOT_READ, SESSION],
      [SessionStartReportCode.STATE_NOT_READ, SESSION],
    ]);

    const stopped = harness({ state: () => null });
    await stopped.watch.handle(connecting(SESSION));
    await stopped.watch.handle(started(SESSION, ['CAM-01'], ['CAM-02']));
    await stopped.watch.handle(durable(SESSION));
    expect(stopped.reports.map((entry) => entry.code)).toEqual([SessionStartReportCode.STATE_NOT_READ]);
  });
});

describe('`captureNotices(app).watchSessionStarts`: the listener of `sessionCapture(app).on(...)`', () => {
  function app(sim: Sim) {
    const errors: unknown[] = [];
    const stub = {
      stages: {},
      // No capture seam: a stand-in app attaches nothing by itself.
      seams: { has: (name: string) => name === 'engine' },
      log: { error: (...entry: unknown[]) => void errors.push(entry) },
      errorLog: { append: (entry: unknown) => void errors.push(entry) },
      engine: { ...simulatorEngine(sim), state: () => sim.store.getState() },
    };
    return { stub: stub as unknown as CaptureNoticesApp, errors };
  }

  function source() {
    const listeners = new Set<(event: SessionStartEvent) => void | Promise<void>>();
    const seam: SessionStartSource = {
      on(listener) {
        listeners.add(listener);
        return () => void listeners.delete(listener);
      },
    };
    return { seam, listeners, tell: async (event: SessionStartEvent) => void (await Promise.all([...listeners].map((listener) => listener(event)))) };
  }

  it('attached once per source, read-only (it only listens), and removed by the function it returns', async () => {
    const sim = createSim({ clock: createManualClock(START), storage: null, authStorage: null });
    const { stub, errors } = app(sim);
    const capture = source();
    const notices = captureNotices(stub);
    expect(capture.listeners.size).toBe(0);
    const off = notices.watchSessionStarts(capture.seam);
    expect(notices.watchSessionStarts(capture.seam)).toBe(off);
    expect(capture.listeners.size).toBe(1);

    await capture.tell(connecting(SESSION));
    await capture.tell(started(SESSION, ['CAM-01'], ['CAM-02']));
    await capture.tell(durable(SESSION));
    const active = sim.store.getState().alerts.filter((alert) => alert.active);
    expect(active.map((alert) => [alert.kind, alert.target, alert.params?.['phase']])).toEqual([['SYSTEM', 'CAM-02', 'SESSION_START']]);

    off();
    expect(capture.listeners.size).toBe(0);
    expect(errors).toEqual([]);
  });
});

// Fix pass F-M5 (review R74-03): a camera whose source was OPENED but which the worker could not
// connect (protocol 4 `CAMERA_NOT_CONNECTED`) used to get a CRITICAL capture fault reading "a
// recording file stopped growing". It is the degraded start of ux §8e.2: ONE WARNING naming the camera.
describe('review R74-03: a camera the worker could not connect is the WARNING of a degraded start', () => {
  const notConnected = (sessionId: string, deviceId: string): SessionStartEvent => ({ type: 'CAMERA_NOT_CONNECTED', sessionId, deviceId });

  it('said by the worker before the session records: nothing until DURABLE, then one WARNING and one audit row; no fault', async () => {
    const h = harness();
    await h.watch.handle(connecting(SESSION));
    await h.watch.handle(started(SESSION, ['CAM-01', 'CAM-02'], []));
    await h.watch.handle(notConnected(SESSION, 'CAM-02'));
    // CONTROL: a start that then fails has ONE alert, the critical one - nothing is announced before the session records.
    expect(h.notices('CAM-02')).toEqual([]);
    await h.watch.handle(durable(SESSION));
    expect(h.notices('CAM-02', true)).toMatchObject([{ severity: 'WARNING', params: { phase: 'SESSION_START', cause: 'NOT_CONNECTED' } }]);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE').map((row) => row.details)).toEqual([{ deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'SESSION_START', reason: 'NOT_CONNECTED', degraded: true, sessionId: SESSION }]);
    expect(h.faults()).toEqual([]);
    // The camera that DID connect keeps no warning, and CAM-02 is not treated as connected.
    expect(h.notices('CAM-01')).toEqual([]);
    expect(h.reports).toEqual([]);
  });

  it('said after the session records (the ingest-open window closed later): raised at once, once; with the adapter refusal of the same camera it stays ONE alert', async () => {
    const h = harness();
    await h.watch.handle(connecting(SESSION));
    await h.watch.handle(started(SESSION, ['CAM-01'], ['CAM-02']));
    await h.watch.handle(durable(SESSION));
    expect(h.notices('CAM-02', true)).toHaveLength(1);
    // One event, ONE alert: the worker's statement about the camera the adapter already could not open adds nothing.
    await h.watch.handle(notConnected(SESSION, 'CAM-02'));
    expect(h.notices('CAM-02')).toHaveLength(1);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);

    const other = harness();
    await other.watch.handle(connecting(SESSION));
    await other.watch.handle(started(SESSION, ['CAM-01', 'CAM-02'], []));
    await other.watch.handle(durable(SESSION));
    expect(other.notices('CAM-02')).toEqual([]);
    await other.watch.handle(notConnected(SESSION, 'CAM-02'));
    await other.watch.handle(notConnected(SESSION, 'CAM-02'));
    expect(other.notices('CAM-02', true)).toHaveLength(1);
    expect(other.faults()).toEqual([]);
  });

  it('no camera connected at all: the failed start keeps its ONE critical alert; no warning per camera; a statement of another session is ignored', async () => {
    const h = harness();
    await h.watch.handle(connecting(SESSION));
    await h.watch.handle(started(SESSION, ['CAM-01', 'CAM-02'], []));
    await h.watch.handle(notConnected(SESSION, 'CAM-01'));
    await h.watch.handle(notConnected(SESSION, 'CAM-02'));
    await h.watch.handle({ type: 'FAILED_START', sessionId: SESSION, cause: 'NO_CAMERA_CONNECTED' });
    expect(h.notices('CAM-01')).toEqual([]);
    expect(h.notices('CAM-02')).toEqual([]);
    expect(h.faults(true)).toHaveLength(1);
    // The next session: what the failed one said about its cameras is gone, and a late statement of it changes nothing.
    await h.watch.handle(connecting(NEXT_SESSION));
    await h.watch.handle(started(NEXT_SESSION, ['CAM-01', 'CAM-02'], []));
    await h.watch.handle(notConnected(SESSION, 'CAM-02'));
    await h.watch.handle(durable(NEXT_SESSION));
    expect(h.notices('CAM-02')).toEqual([]);
  });
});
