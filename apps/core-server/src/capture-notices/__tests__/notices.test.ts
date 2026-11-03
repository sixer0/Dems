// Blueprint row 133: the no-device notifier, the reachability probe and the pre-check gate, JOINED
// to a real simulator (the one the engine host runs) and to the fake adapters of row 65. No
// database, no socket, no process: the engine stand-in only turns a call into the simulator's
// INTERNAL action, as `capture/__tests__/forwarder-engine.test.ts` does.
//
// Checks: M4-NODEV-A-1, M4-NODEV-B-1, M4-PRECHK-RULE-1 (the server half: the gate and the session
// machine together), M4-AUD-1 for CAPTURE_DEVICE_UNREACHABLE. Each `it` holds a negative control.
import { CAPTURE_DISCOVERY_ALERT_TARGET, CAPTURE_DISCOVERY_EMPTY_REASON, captureDeviceUnreachableDetails } from '@dems/shared/api';
import { CAPTURE_NOTICE_DISCOVERY_TARGET, CaptureNoticeReason, createManualClock, createSim, type SessionCreateInput, type Sim, type SimState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { createLaneSourceRig } from '../../../test/support/lane-source-rig';
import { AudioInputErrorCode, createFakeRegistry, type AudioInputAdapter, type CameraAdapter, type FakeRegistry } from '../../capture/adapters';
import { LIVING_PROGRESS, deviceListText, scriptedDoor, trustedInspector } from '../../capture/adapters/local/__tests__/mic-support';
import { buildDevelopmentRegistry } from '../../capture/fence';
import { HELPER, LOCAL, SEEDED } from '../../capture/fence/__tests__/support';
import {
  NoticeReportCode,
  PrecheckReportCode,
  captureNotices,
  causeOfProbeError,
  createNoDeviceNotifier,
  createPrecheckGate,
  probeOfAdapters,
  type CaptureNoticesApp,
  type CaptureReachabilityProbe,
  type ClosedSearch,
  type NoticeEngine,
  type NoticeReport,
  type PrecheckSearchOwner,
  type PrecheckSearchSeam,
} from '../index';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
const SUPERVISOR: PrecheckSearchOwner = { operatorId: 'OPR-002', authSessionId: 'AS-1', deviceId: null };
/** An operator with SESSION_START and without CAPTURE_CONFIG, on a paired tablet. */
const INVESTIGATOR: PrecheckSearchOwner = { operatorId: 'OPR-001', authSessionId: 'AS-2', deviceId: 'TAB-01' };

const simulatorEngineOf = (sim: Sim): NoticeEngine => simulatorEngine(sim);
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

/** A camera adapter whose read answers or not, as the test says: "one configured fake camera stopped". */
function stoppable(fakes: FakeRegistry) {
  const stopped = new Map<string, unknown>();
  const reads: string[] = [];
  const cameras: CameraAdapter[] = fakes.cameras.map((camera) => ({
    ...camera,
    async profiles(deviceId: string) {
      reads.push(deviceId);
      if (stopped.has(deviceId)) throw stopped.get(deviceId);
      return camera.profiles(deviceId);
    },
  }));
  return { cameras, reads, stop: (deviceId: string, error: unknown = new Error('no answer')) => void stopped.set(deviceId, error), start: (deviceId: string) => void stopped.delete(deviceId) };
}

function searchService(answer: (owner: PrecheckSearchOwner) => ClosedSearch | null | Promise<ClosedSearch | null>) {
  const calls: Array<{ owner: PrecheckSearchOwner; sessionId: string }> = [];
  const seam: PrecheckSearchSeam = {
    async runPrecheckSearch(owner, recording) {
      calls.push({ owner, sessionId: recording.sessionId });
      return answer(owner);
    },
  };
  return { seam, calls };
}

/**
 * Fix wave M (ruling D232): the adapters a DEVELOPMENT Core really has - the fence's registry with
 * its GENERATED test sources - behind the lane's source rig, whose switch is the text `set` writes
 * (what `lane.sh source-rig` writes into the switch file). The helper program is a scripted door:
 * nothing is listed, opened or started.
 */
function riggedDevelopmentSources() {
  let text: string | null = null;
  const scripted = scriptedDoor(deviceListText(['MacBook Air Microphone'], ['MacBook Air Camera']), () => ({ lives: true, reports: LIVING_PROGRESS }));
  const said: string[] = [];
  const rig = createLaneSourceRig({ read: () => text, generated: () => ['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02'], report: (_level, code, _message, context) => void said.push(`${code} ${String(context['deviceId'])}`) });
  const built = buildDevelopmentRegistry({
    devices: [...SEEDED, ...LOCAL],
    local: { cameraId: 'CAM-03', micId: 'MIC-03' },
    program: HELPER,
    runDir: '/nonexistent/wave-m/run',
    now: () => START,
    timers: { after: () => () => {} },
    door: scripted.door,
    inspect: trustedInspector(),
    sourceUnreachable: (deviceId) => rig.unreachable(deviceId),
  });
  const adapters = built.probeAdapters();
  if (adapters === null) throw new Error('the development registry offers no adapters');
  return { probe: probeOfAdapters(adapters), set: (next: string | null) => void (text = next), said, scripted };
}

function harness(options: { discovery?: PrecheckSearchSeam | null; probe?: CaptureReachabilityProbe } = {}) {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const fakes = createFakeRegistry({ runDir: '/nonexistent/row133' });
  const cameras = stoppable(fakes);
  const probe: CaptureReachabilityProbe = options.probe ?? probeOfAdapters({ cameras: cameras.cameras, microphones: fakes.mics });
  const reports: NoticeReport[] = [];
  const report = (entry: NoticeReport): void => void reports.push(entry);
  const notifier = createNoDeviceNotifier({ engine: () => simulatorEngine(sim), report });
  let discovery: PrecheckSearchSeam | null = options.discovery ?? null;
  const gate = createPrecheckGate({ state: () => sim.store.getState(), notifier, probe: () => probe, discovery: () => discovery, report });
  const state = (): SimState => sim.store.getState();
  const run = (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      clock.advance(50);
      sim.tick();
    }
  };
  const notices = (reason: string, active?: boolean) => state().alerts.filter((alert) => alert.kind === 'SYSTEM' && alert.params?.['reason'] === reason && (active === undefined || alert.active === active));
  const rowsOf = (type: string) => state().audit.rows.filter((row) => row.type === type);
  /** One pre-check run as the sessions routes do it: the gate, then the hosted action. */
  const precheck = async (owner: PrecheckSearchOwner = SUPERVISOR, retry = false) => {
    if (!retry) sim.actions.createSession(INPUT);
    const sessionId = state().session?.id ?? '';
    const outcome = await gate.beforePrecheck({ sessionId, owner, kind: retry ? 'RETRY' : 'BEGIN' });
    if (retry) sim.actions.retryPrecheck();
    else sim.actions.beginPrecheck();
    run(5_000);
    return { outcome, sessionId, item: (id: string) => state().session?.precheck.items.find((candidate) => candidate.id === id) };
  };
  return { sim, clock, fakes, cameras, probe, notifier, gate, reports, state, run, notices, rowsOf, precheck, setDiscovery: (seam: PrecheckSearchSeam | null) => void (discovery = seam) };
}

const closed = (responderCount: number, patch: Partial<ClosedSearch> = {}): ClosedSearch => ({ searchId: 'DSC-000001', trigger: 'MANUAL', outcome: 'COMPLETE', responderCount, ...patch });

describe('one definition: the notice names of this row are the contract values row 132 landed', () => {
  it('the target and the reason of situation A, and the audit keys of situation B', () => {
    expect(CAPTURE_NOTICE_DISCOVERY_TARGET).toBe(CAPTURE_DISCOVERY_ALERT_TARGET);
    expect(CaptureNoticeReason.CAPTURE_DISCOVERY_EMPTY).toBe(CAPTURE_DISCOVERY_EMPTY_REASON);
    const h = harness();
    h.sim.actions.raiseCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: 'CAM-02', phase: 'PRECHECK', cause: 'UNREACHABLE', degraded: true, sessionId: 'SES-20261001-0001' });
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')[0]?.details).toEqual(
      captureDeviceUnreachableDetails({ deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', reason: 'UNREACHABLE', degraded: true, sessionId: 'SES-20261001-0001' }),
    );
  });
});

describe('situation A: an empty search (M4-NODEV-A-1)', () => {
  it('an empty search raises exactly one alert and writes NO audit row; five leave one; a registered-only result raises nothing', async () => {
    const h = harness();
    const auditBefore = h.state().audit.rows.length;
    // A search that found only registered cameras has responders: nothing is raised.
    expect(await h.notifier.searchClosed(closed(2))).toBe(true);
    expect(h.notices('CAPTURE_DISCOVERY_EMPTY')).toHaveLength(0);

    for (let index = 1; index <= 5; index += 1) expect(await h.notifier.searchClosed(closed(0, { searchId: `DSC-00000${index}` }))).toBe(true);
    const alerts = h.notices('CAPTURE_DISCOVERY_EMPTY');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: 'WARNING', kind: 'SYSTEM', target: 'CAPTURE_DISCOVERY', active: true, params: { reason: 'CAPTURE_DISCOVERY_EMPTY', searchId: 'DSC-000001', trigger: 'MANUAL' } });
    // D80(8): the notifier adds no audit row of its own (the search row is the discovery module's).
    expect(h.state().audit.rows).toHaveLength(auditBefore);
    expect(h.reports).toEqual([]);
  });

  it('a later non-empty search clears it, with no audit row; a FAILED search neither raises nor clears; the next empty one is a NEW alert', async () => {
    const h = harness();
    await h.notifier.searchClosed(closed(0));
    const auditBefore = h.state().audit.rows.length;
    // FAILED with 0 responders says nothing about the network.
    expect(await h.notifier.searchClosed(closed(0, { outcome: 'FAILED', searchId: 'DSC-000002' }))).toBe(false);
    expect(await h.notifier.searchClosed(closed(3, { outcome: 'FAILED', searchId: 'DSC-000003' }))).toBe(false);
    expect(h.notices('CAPTURE_DISCOVERY_EMPTY', true)).toHaveLength(1);

    await h.notifier.searchClosed(closed(1, { searchId: 'DSC-000004' }));
    expect(h.notices('CAPTURE_DISCOVERY_EMPTY', true)).toHaveLength(0);
    expect(h.state().audit.rows).toHaveLength(auditBefore);

    await h.notifier.searchClosed(closed(0, { searchId: 'DSC-000005', trigger: 'PRECHECK' }));
    const all = h.notices('CAPTURE_DISCOVERY_EMPTY');
    expect(all.map((alert) => alert.active)).toEqual([false, true]);
    expect(all[1]?.params).toMatchObject({ searchId: 'DSC-000005', trigger: 'PRECHECK' });
    expect(all[0]?.id).not.toBe(all[1]?.id);
  });

  it('with no engine, or an engine that refuses, the caller is not failed and the failure is reported with ids only', async () => {
    const reports: NoticeReport[] = [];
    const none = createNoDeviceNotifier({ engine: () => null, report: (entry) => void reports.push(entry) });
    expect(await none.searchClosed(closed(0))).toBe(false);
    expect(reports.map((entry) => [entry.code, entry.searchId])).toEqual([[NoticeReportCode.NO_ENGINE, 'DSC-000001']]);

    const refusing = createNoDeviceNotifier({
      engine: () => ({ raiseCaptureWarning: async () => Promise.reject(new Error('down')), clearCaptureWarning: async () => Promise.reject(new Error('down')) }),
      report: (entry) => {
        reports.push(entry);
        throw new Error('the report itself fails');
      },
    });
    expect(await refusing.deviceUnreachable({ deviceId: 'CAM-01', phase: 'PRECHECK', cause: 'UNREACHABLE', degraded: false, sessionId: 'SES-1' })).toBe(false);
    expect(await refusing.deviceReachable('CAM-01', 'PRECHECK')).toBe(false);
    expect(reports.slice(1).map((entry) => [entry.code, entry.deviceId, entry.sessionId])).toEqual([
      [NoticeReportCode.RAISE_FAILED, 'CAM-01', 'SES-1'],
      [NoticeReportCode.RESOLVE_FAILED, 'CAM-01', null],
    ]);
  });
});

describe('the probe: adapters only, no socket, no substitute', () => {
  it('a microphone is what enumerate says, with its named cause; a camera read that fails names the cause its error carries', async () => {
    const h = harness();
    h.fakes.mics[1]?.setPresent(false, AudioInputErrorCode.DEVICE_BUSY);
    const inputs = await h.probe.microphones();
    expect(inputs).toEqual({
      microphones: [
        { deviceId: 'MIC-01', present: true, errorCode: null, adapterKind: 'FAKE', sourceClass: 'DEVELOPMENT' },
        { deviceId: 'MIC-02', present: false, errorCode: 'DEVICE_BUSY', adapterKind: 'FAKE', sourceClass: 'DEVELOPMENT' },
      ],
      unregisteredCount: 0,
    });
    // 0 probes: a re-read of the microphones searches nothing and asks no camera.
    expect(h.fakes.cameras.map((camera) => camera.calls.discover)).toEqual([0, 0]);
    expect(h.cameras.reads).toEqual([]);

    const signal = new AbortController().signal;
    expect(await h.probe.camera('CAM-01', signal)).toEqual({ reachable: true });
    h.cameras.stop('CAM-01', Object.assign(new Error('refused'), { code: 'PERMISSION_DENIED' }));
    expect(await h.probe.camera('CAM-01', signal)).toEqual({ reachable: false, cause: 'PERMISSION_DENIED' });
    h.cameras.stop('CAM-01', Object.assign(new Error('weird'), { code: 'rtsp://user:pw@10.0.0.9/' }));
    // A code that is not one of the five is never copied: it could be device text.
    expect(await h.probe.camera('CAM-01', signal)).toEqual({ reachable: false, cause: 'UNREACHABLE' });
    expect(await h.probe.camera('CAM-77', signal)).toEqual({ reachable: false, cause: 'UNREACHABLE' });
    expect(causeOfProbeError(null)).toBe('UNREACHABLE');
  });

  it('a camera read that never answers is unreachable when the bound ends, and its signal is aborted', async () => {
    const fakes = createFakeRegistry({ runDir: '/nonexistent/row133' });
    let fire: (() => void) | null = null;
    let aborted = false;
    const probe = probeOfAdapters({
      cameras: fakes.cameras,
      microphones: fakes.mics,
      readCamera: (_adapter, _deviceId, signal) =>
        new Promise(() => {
          signal.addEventListener('abort', () => void (aborted = true));
        }),
      setTimer: (run) => {
        fire = run;
        return () => {};
      },
    });
    const pending = probe.camera('CAM-01', new AbortController().signal);
    let settled = false;
    void pending.then(() => void (settled = true));
    await Promise.resolve();
    // Control: before the bound ends nothing is decided.
    expect(settled).toBe(false);
    (fire as (() => void) | null)?.();
    expect(await pending).toEqual({ reachable: false, cause: 'UNREACHABLE' });
    expect(aborted).toBe(true);
  });

  it('D47: a camera and a microphone admitted AFTER the build (only in `admittedDevices()`, `devices` stays the first list) are read through their adapter; CONTROL: before the admission the camera is UNREACHABLE and the microphone is not listed', async () => {
    const fakes = createFakeRegistry({ runDir: '/nonexistent/row133' });
    const laterCameras: { id: string }[] = [];
    const laterMics: { id: string }[] = [];
    const camera = fakes.cameras[0] as CameraAdapter;
    const mic = fakes.mics[0] as AudioInputAdapter;
    // The production adapters' shape: the first list frozen at the build, the later ones apart.
    const productionCamera = { ...camera, devices: [], admittedDevices: () => [...laterCameras] } as unknown as CameraAdapter;
    const productionMic = {
      ...mic,
      devices: [],
      admittedDevices: () => [...laterMics],
      enumerate: async () => [{ inputId: 'MIC-05', present: true, errorCode: null }],
    } as unknown as AudioInputAdapter;
    const reads: string[] = [];
    const probe = probeOfAdapters({
      cameras: [productionCamera],
      microphones: [productionMic],
      readCamera: async (_adapter, deviceId) => void reads.push(deviceId),
    });
    const signal = new AbortController().signal;
    expect(await probe.camera('CAM-03', signal)).toEqual({ reachable: false, cause: 'UNREACHABLE' });
    expect(reads).toEqual([]);
    expect((await probe.microphones()).microphones).toEqual([]);

    laterCameras.push({ id: 'CAM-03' });
    laterMics.push({ id: 'MIC-05' });
    expect(await probe.camera('CAM-03', signal)).toEqual({ reachable: true });
    expect(reads).toEqual(['CAM-03']);
    expect((await probe.microphones()).microphones).toEqual([{ deviceId: 'MIC-05', present: true, errorCode: null, adapterKind: 'FAKE', sourceClass: 'DEVELOPMENT' }]);
  });

  it('a microphone list that cannot be read makes every microphone of that adapter absent, never present', async () => {
    const fakes = createFakeRegistry({ runDir: '/nonexistent/row133' });
    const broken: AudioInputAdapter = { ...(fakes.mics[0] as AudioInputAdapter), enumerate: async () => Promise.reject(Object.assign(new Error('x'), { code: 'HELPER_EXITED' })) };
    const probe = probeOfAdapters({ cameras: [], microphones: [broken, fakes.mics[1] as AudioInputAdapter], countUnregistered: async () => 2 });
    expect(await probe.microphones()).toEqual({
      microphones: [
        { deviceId: 'MIC-01', present: false, errorCode: 'HELPER_EXITED', adapterKind: 'FAKE', sourceClass: 'DEVELOPMENT' },
        { deviceId: 'MIC-02', present: true, errorCode: null, adapterKind: 'FAKE', sourceClass: 'DEVELOPMENT' },
      ],
      unregisteredCount: 2,
    });
  });
});

describe('situation B: the pre-check gate (M4-NODEV-B-1, M4-PRECHK-RULE-1)', () => {
  it('everything reachable: nothing is written, no search runs, the session arms (the control of every case below)', async () => {
    const service = searchService(() => closed(1, { trigger: 'PRECHECK' }));
    const h = harness({ discovery: service.seam });
    const before = h.state();
    const { outcome, item } = await h.precheck();
    expect(outcome).toMatchObject({ asked: true, unreachable: [], search: 'NOT_NEEDED' });
    // Nothing of the capture slices or the alerts moved: the gate opened no unit.
    expect(h.state().captureDevices).toBe(before.captureDevices);
    expect(h.state().alerts).toBe(before.alerts);
    expect(service.calls).toEqual([]);
    expect(h.state().session?.state).toBe('ARMED');
    expect(item('LENS_2')).toMatchObject({ status: 'PASS' });
  });

  it('no probe provided (no adapter registered): the gate asks nothing and writes nothing', async () => {
    const h = harness();
    const gate = createPrecheckGate({ state: () => h.state(), notifier: h.notifier, probe: () => null, discovery: () => null, report: () => {} });
    h.cameras.stop('CAM-01');
    h.sim.actions.createSession(INPUT);
    const before = h.state();
    const sessionId = before.session?.id ?? '';
    expect(await gate.beforePrecheck({ sessionId, owner: SUPERVISOR, kind: 'BEGIN' })).toMatchObject({ asked: false, unreachable: [] });
    expect(h.state()).toBe(before);
    expect(h.cameras.reads).toEqual([]);
    // Control: the same run with the probe asks the stopped camera.
    expect(await h.gate.beforePrecheck({ sessionId, owner: SUPERVISOR, kind: 'BEGIN' })).toMatchObject({ asked: true, unreachable: ['CAM-01'] });
  });

  // Batch N (verification row 98, finding V98-13; ruling D241): FAIL CLOSED. A probe SOURCE that throws used to become
  // "no probe" - the gate then asked nothing and that pre-check judged no reachability at all.
  it('V98-13: a probe SOURCE that throws is not "no probe" - every configured source reads NOT REACHABLE (cameras UNREACHABLE, microphones OPEN_FAILED), the failure is reported by code, and the pre-check does NOT pass', async () => {
    const h = harness();
    const reports: NoticeReport[] = [];
    const canary = ['rtsp', '://', 'admin', ':', 'V9813-MARKER', '@', '10.0.0.5/s'].join('');
    const gate = createPrecheckGate({
      state: () => h.state(),
      notifier: h.notifier,
      probe: () => {
        throw new Error(`the registry could not be read (${canary})`);
      },
      discovery: () => null,
      report: (entry) => void reports.push(entry),
    });
    h.sim.actions.createSession(INPUT);
    const sessionId = h.state().session?.id ?? '';
    const outcome = await gate.beforePrecheck({ sessionId, owner: SUPERVISOR, kind: 'BEGIN' });
    const selector = h.state().session?.captureConfig ?? h.state().captureConfig;
    const configured = [...new Set([...selector.cameras.map((camera) => camera.deviceId), ...selector.mics.map((mic) => mic.deviceId)])];
    expect(configured.length).toBeGreaterThanOrEqual(3);
    expect(outcome.asked).toBe(true);
    expect([...outcome.unreachable].sort()).toEqual([...configured].sort());
    // Said once for the source, by its own code, with the cause; then once per source that could not be asked. No adapter was read.
    expect(reports.map((entry) => entry.code).filter((code) => code === PrecheckReportCode.PROBE_SOURCE_FAILED)).toHaveLength(1);
    expect(reports.find((entry) => entry.code === PrecheckReportCode.PROBE_SOURCE_FAILED)).toMatchObject({ source: 'captureNotices.precheck', deviceId: null, sessionId });
    expect(reports.filter((entry) => entry.code === PrecheckReportCode.PROBE_FAILED).map((entry) => entry.deviceId).filter((id) => id !== null).sort()).toEqual(selector.cameras.map((camera) => camera.deviceId).sort());
    // The per-source lines carry a FIXED error (a code, no text of the cause): the cause is in the one source line only.
    for (const entry of reports.filter((candidate) => candidate.code === PrecheckReportCode.PROBE_FAILED)) expect(String((entry.err as Error).message)).not.toContain('V9813-MARKER');
    expect(h.cameras.reads).toEqual([]);
    // The stored facts and the alerts say so, with the vocabulary a failed read already has; the checks read them and BLOCK.
    await outcome.settled;
    for (const deviceId of configured) expect(h.state().captureDevices.devices.find((device) => device.id === deviceId)?.online, deviceId).toBe(false);
    const alerts = h.notices(CaptureNoticeReason.CAPTURE_DEVICE_UNREACHABLE, true);
    expect(alerts.map((alert) => alert.target).sort()).toEqual([...configured].sort());
    for (const alert of alerts) expect(alert.params?.['cause'], String(alert.target)).toBe(selector.cameras.some((camera) => camera.deviceId === alert.target) ? 'UNREACHABLE' : 'OPEN_FAILED');
    expect(JSON.stringify(h.state().alerts) + JSON.stringify(h.state().audit.rows)).not.toContain('V9813-MARKER');
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    expect(h.state().session?.state).not.toBe('ARMED');
    expect(h.state().session?.precheck.outcome).toBe('BLOCK');
    // CONTROL 1: the same session and the same moment through a source that ANSWERS - the gate of the harness - reads every source reachable again.
    const again = await h.gate.beforePrecheck({ sessionId, owner: SUPERVISOR, kind: 'RETRY' });
    expect(again).toMatchObject({ asked: true, unreachable: [] });
    // CONTROL 2: a source that answers "no adapters" (null) is still "nothing to ask" - the case above this one.
  });

  it('V98-13, the mounted unit: `provideProbeSource` with a source that throws - the pre-check is JUDGED (asked, every source unreachable), while operation 97\'s `probe()` keeps answering null (its 503 by name); the error log names the code and not the cause', async () => {
    const h = harness();
    const said: unknown[] = [];
    const stub = {
      stages: {},
      seams: { has: (name: string) => name === 'engine' },
      log: { error: (...entry: unknown[]) => void said.push(entry) },
      errorLog: { append: (entry: unknown) => void said.push(entry) },
      engine: { ...simulatorEngineOf(h.sim), state: () => h.state() },
    } as unknown as CaptureNoticesApp;
    const mounted = captureNotices(stub);
    let fail = true;
    mounted.provideProbeSource(() => {
      if (fail) throw new Error('the fence registry threw');
      return h.probe;
    });
    h.sim.actions.createSession(INPUT);
    const sessionId = h.state().session?.id ?? '';
    const outcome = await mounted.beforePrecheck({ sessionId, owner: SUPERVISOR, kind: 'BEGIN' });
    expect(outcome.asked).toBe(true);
    expect(outcome.unreachable.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(said.map((entry) => (Array.isArray(entry) ? (entry[0] as { code?: string }).code : (entry as { code?: string }).code)))).toContain('CAPTURE_PRECHECK_PROBE_SOURCE_FAILED');
    // Operation 97 reads the same failing source as "no probe" (503 CAPTURE_NOT_READY by name) and says why.
    expect(mounted.probe()).toBeNull();
    expect(JSON.stringify(said.map((entry) => (Array.isArray(entry) ? (entry[0] as { code?: string }).code : (entry as { code?: string }).code)))).toContain('CAPTURE_PROBE_SOURCE_FAILED');
    // CONTROL: the source answers again - asked at every use, nothing kept: the retry reads every source reachable.
    fail = false;
    await outcome.settled;
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    expect(h.state().session?.precheck.outcome).toBe('BLOCK');
    expect(await mounted.beforePrecheck({ sessionId, owner: SUPERVISOR, kind: 'RETRY' })).toMatchObject({ asked: true, unreachable: [] });
  });

  it('a request the action will refuse probes and searches nothing: another session id, a retry from CREATE, a begin from PRECHECK, checks still running', async () => {
    const service = searchService(() => closed(0));
    const h = harness({ discovery: service.seam });
    h.cameras.stop('CAM-01');
    // No session at all.
    expect((await h.gate.beforePrecheck({ sessionId: 'SES-20261001-0001', owner: SUPERVISOR, kind: 'BEGIN' })).asked).toBe(false);
    h.sim.actions.createSession(INPUT);
    const sessionId = h.state().session?.id ?? '';
    expect((await h.gate.beforePrecheck({ sessionId: 'SES-20261001-9999', owner: SUPERVISOR, kind: 'BEGIN' })).asked).toBe(false);
    expect((await h.gate.beforePrecheck({ sessionId, owner: SUPERVISOR, kind: 'RETRY' })).asked).toBe(false);
    // A warning keeps the session in PRECHECK when its checks end (else it would arm).
    h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' });
    h.sim.actions.beginPrecheck();
    // The checks are running: a retry is refused CHECKS_RUNNING, a begin INVALID_STATE.
    expect((await h.gate.beforePrecheck({ sessionId, owner: SUPERVISOR, kind: 'RETRY' })).asked).toBe(false);
    expect((await h.gate.beforePrecheck({ sessionId, owner: SUPERVISOR, kind: 'BEGIN' })).asked).toBe(false);
    expect(h.cameras.reads).toEqual([]);
    expect(service.calls).toEqual([]);
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(0);
    // Control: once the checks ended, the retry is a run.
    h.run(5_000);
    expect((await h.gate.beforePrecheck({ sessionId, owner: SUPERVISOR, kind: 'RETRY' })).asked).toBe(true);
  });

  it('one camera stopped: WARN and a degraded start; ONE search runs for the starter; one alert with its count and one audit row with degraded true', async () => {
    const service = searchService(() => closed(0, { searchId: 'DSC-000007', trigger: 'PRECHECK' }));
    const h = harness({ discovery: service.seam });
    h.cameras.stop('CAM-02');
    const { outcome, sessionId, item } = await h.precheck();
    await outcome.settled;

    expect(outcome).toMatchObject({ asked: true, unreachable: ['CAM-02'], search: 'STARTED' });
    expect(service.calls).toEqual([{ owner: SUPERVISOR, sessionId }]);
    expect(item('LENS_1')).toMatchObject({ status: 'PASS' });
    expect(item('LENS_2')).toMatchObject({ status: 'WARN', value: 'UNREACHABLE', params: { deviceId: 'CAM-02', rule: 'oneCamera' } });
    expect(h.state().session?.precheck.outcome).toBe('WARN');

    const alerts = h.notices('CAPTURE_DEVICE_UNREACHABLE');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ target: 'CAM-02', severity: 'WARNING', active: true });
    expect(alerts[0]?.params).toEqual({ reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE', searchResponderCount: 0 });
    const rows = h.rowsOf('CAPTURE_DEVICE_UNREACHABLE');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.details).toEqual({ deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', reason: 'UNREACHABLE', degraded: true, sessionId });
    // The search of the pre-check found nothing: situation A is raised too, once.
    expect(h.notices('CAPTURE_DISCOVERY_EMPTY', true)).toHaveLength(1);
    expect(h.reports).toEqual([]);

    h.sim.actions.acknowledgePrecheckWarnings();
    h.sim.actions.startRecording();
    expect(h.state().session?.state).toBe('RECORDING');
  });

  it('both cameras stopped: BLOCK, still ONE search, two alerts, both rows degraded false, and a start is refused', async () => {
    const service = searchService(() => closed(4, { trigger: 'PRECHECK' }));
    const h = harness({ discovery: service.seam });
    h.cameras.stop('CAM-01');
    h.cameras.stop('CAM-02');
    const { outcome, item } = await h.precheck();
    await outcome.settled;
    expect(service.calls).toHaveLength(1);
    expect(h.state().session?.precheck.outcome).toBe('BLOCK');
    expect(item('LENS_1')).toMatchObject({ status: 'BLOCK', params: { rule: 'noCamera' } });
    expect(item('LENS_2')).toMatchObject({ status: 'BLOCK', params: { rule: 'noCamera' } });
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => [alert.target, alert.params?.['searchResponderCount']])).toEqual([
      ['CAM-01', 4],
      ['CAM-02', 4],
    ]);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE').map((row) => row.details['degraded'])).toEqual([false, false]);
    expect(h.rowsOf('PRECHECK_BLOCKED')).toHaveLength(1);
    expect(() => h.sim.actions.startRecording()).toThrow();
    // Four responders: no empty-search alert.
    expect(h.notices('CAPTURE_DISCOVERY_EMPTY')).toHaveLength(0);
  });

  it('the ACTIVE microphone removed: BLOCK, one alert with the named cause, degraded false, and 0 searches and 0 camera probes beyond the reads', async () => {
    const service = searchService(() => closed(0));
    const h = harness({ discovery: service.seam });
    h.fakes.mics[0]?.setPresent(false, AudioInputErrorCode.DEVICE_NOT_FOUND);
    const { outcome, sessionId, item } = await h.precheck();
    await outcome.settled;
    expect(outcome).toMatchObject({ unreachable: ['MIC-01'], search: 'NOT_NEEDED' });
    expect(service.calls).toEqual([]);
    expect(h.fakes.cameras.map((camera) => camera.calls.discover)).toEqual([0, 0]);
    expect(item('MIC_PRIMARY')).toMatchObject({ status: 'BLOCK', value: 'UNREACHABLE', params: { deviceId: 'MIC-01', rule: 'activeMicrophone', other: 'MIC-02' } });
    expect(h.state().session?.precheck.outcome).toBe('BLOCK');
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => alert.params)).toEqual([{ reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'MIC-01', deviceKind: 'MIC', phase: 'PRECHECK', cause: 'DEVICE_NOT_FOUND' }]);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE').map((row) => row.details)).toEqual([{ deviceId: 'MIC-01', deviceKind: 'MIC', phase: 'PRECHECK', reason: 'DEVICE_NOT_FOUND', degraded: false, sessionId }]);
    // No switch at pre-check (D83).
    expect(h.state().audio.activeInputId).toBe('MIC-01');
  });

  it('the STANDBY microphone removed: WARN, one alert, degraded true', async () => {
    const h = harness();
    h.fakes.mics[1]?.setPresent(false, AudioInputErrorCode.PERMISSION_DENIED);
    const { item } = await h.precheck();
    expect(item('MIC_STANDBY')).toMatchObject({ status: 'WARN', params: { deviceId: 'MIC-02', rule: 'noStandby' } });
    expect(item('MIC_PRIMARY')).toMatchObject({ status: 'PASS' });
    expect(h.state().session?.precheck.outcome).toBe('WARN');
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE').map((row) => [row.details['deviceId'], row.details['reason'], row.details['degraded']])).toEqual([['MIC-02', 'PERMISSION_DENIED', true]]);
  });

  // Fix wave M (final re-check 70 finding G70d-01, ruling D232). The generated test sources of a development Core dial
  // nothing, so on a lane no pre-check could ever meet situation B. The lane's source rig makes ONE of them answer as not
  // there through its adapter's own read; everything after that read is the product's own pre-check, unchanged.
  it('THE SOURCE RIG on the generated sources of a development Core: OFF, the pre-check passes (the finding); a switched camera is notification B in full; released and run again, 0 notices; a second occurrence is a NEW alert and row', async () => {
    const service = searchService(() => closed(1, { searchId: 'DSC-000009', trigger: 'PRECHECK' }));
    const lane = riggedDevelopmentSources();
    const h = harness({ discovery: service.seam, probe: lane.probe });

    // CONTROL (the finding G70d-01): nothing is switched - every generated source reads READY / PASS, nothing is written.
    const healthy = await h.precheck();
    await healthy.outcome.settled;
    expect(healthy.outcome).toMatchObject({ asked: true, unreachable: [], search: 'NOT_NEEDED' });
    expect([healthy.item('LENS_1')?.status, healthy.item('LENS_2')?.status, h.state().session?.precheck.outcome]).toEqual(['PASS', 'PASS', 'PASS']);
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(0);
    expect(service.calls).toEqual([]);
    h.sim.actions.cancel();

    // `lane.sh source-rig 2 unreachable CAM-02`
    lane.set('UNREACHABLE CAM-02\n');
    const { outcome, sessionId, item } = await h.precheck();
    await outcome.settled;
    expect(outcome).toMatchObject({ asked: true, unreachable: ['CAM-02'], search: 'STARTED' });
    // The device, the check row and the outcome a client reads.
    expect(h.state().captureDevices.devices.find((device) => device.id === 'CAM-02')).toMatchObject({ online: false });
    expect(item('LENS_1')).toMatchObject({ status: 'PASS' });
    expect(item('LENS_2')).toMatchObject({ status: 'WARN', value: 'UNREACHABLE', params: { deviceId: 'CAM-02', rule: 'oneCamera' } });
    expect(h.state().session?.precheck.outcome).toBe('WARN');
    // Notification B: ONE alert naming the device, with the count of the ONE pre-check search, and ONE audit row.
    expect(service.calls).toEqual([{ owner: SUPERVISOR, sessionId }]);
    const alerts = h.notices('CAPTURE_DEVICE_UNREACHABLE');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: 'SYSTEM', target: 'CAM-02', severity: 'WARNING', active: true, message: 'CAM-02 is not reachable' });
    expect(alerts[0]?.params).toEqual({ reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE', searchResponderCount: 1 });
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE').map((row) => row.details)).toEqual([{ deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', reason: 'UNREACHABLE', degraded: true, sessionId }]);
    expect(h.reports).toEqual([]);
    // Nothing was opened or started for it (the only calls of the scripted door are the product's own LISTING of the local
    // microphone, which every input re-read makes), and the rig said once what it does.
    expect(lane.scripted.pushes()).toEqual([]);
    expect(lane.scripted.calls.every((call) => call.args.includes('-list_devices'))).toBe(true);
    expect(lane.said).toEqual(['LANE_SOURCE_RIG_ON CAM-02']);

    // `lane.sh source-rig 2 release`: nothing changes by itself ...
    lane.set('OFF\n');
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE', true)).toHaveLength(1);
    // ... the next run of the pre-check resolves it: 0 active notices, no row for the resolve, the check passes, the device is online.
    const again = await h.precheck(SUPERVISOR, true);
    await again.outcome.settled;
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE').map((alert) => [alert.active, alert.resolvedAt !== null])).toEqual([[false, true]]);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);
    expect(again.item('LENS_2')).toMatchObject({ status: 'PASS' });
    expect(h.state().captureDevices.devices.find((device) => device.id === 'CAM-02')).toMatchObject({ online: true });
    expect(h.state().session?.state).toBe('ARMED');

    // A second occurrence: a NEW alert and a second row.
    h.sim.actions.cancel();
    lane.set('UNREACHABLE CAM-02\n');
    const second = await h.precheck();
    await second.outcome.settled;
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE').map((alert) => alert.active)).toEqual([false, true]);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(2);
  });

  it('THE SOURCE RIG, the other cases of the start rule: BOTH generated cameras switched block the start; a switched STANDBY microphone warns with DEVICE_NOT_FOUND and no search; the ACTIVE one blocks', async () => {
    const service = searchService(() => closed(1, { trigger: 'PRECHECK' }));
    const lane = riggedDevelopmentSources();
    const h = harness({ discovery: service.seam, probe: lane.probe });

    lane.set('UNREACHABLE CAM-01 CAM-02\n');
    const both = await h.precheck();
    await both.outcome.settled;
    expect([both.item('LENS_1')?.status, both.item('LENS_2')?.status, h.state().session?.precheck.outcome]).toEqual(['BLOCK', 'BLOCK', 'BLOCK']);
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => alert.target)).toEqual(['CAM-01', 'CAM-02']);
    expect(service.calls).toHaveLength(1);
    expect(() => h.sim.actions.startRecording()).toThrow();

    lane.set('UNREACHABLE MIC-02\n');
    const standby = await h.precheck(SUPERVISOR, true);
    await standby.outcome.settled;
    expect(standby.outcome).toMatchObject({ unreachable: ['MIC-02'], search: 'NOT_NEEDED' });
    expect(standby.item('MIC_STANDBY')).toMatchObject({ status: 'WARN', params: { deviceId: 'MIC-02', rule: 'noStandby' } });
    expect(h.state().session?.precheck.outcome).toBe('WARN');
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => alert.params)).toEqual([{ reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'MIC-02', deviceKind: 'MIC', phase: 'PRECHECK', cause: 'DEVICE_NOT_FOUND' }]);
    expect(service.calls).toHaveLength(1);

    lane.set('UNREACHABLE MIC-01\n');
    const active = await h.precheck(SUPERVISOR, true);
    await active.outcome.settled;
    expect(active.item('MIC_PRIMARY')).toMatchObject({ status: 'BLOCK', value: 'UNREACHABLE', params: { deviceId: 'MIC-01', rule: 'activeMicrophone' } });
    expect(active.item('MIC_STANDBY')).toMatchObject({ status: 'PASS' });
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => alert.target)).toEqual(['MIC-01']);
  });

  it('an operator WITHOUT CAPTURE_CONFIG: the search still runs once, for that operator session, and they get the notification only', async () => {
    const service = searchService(() => closed(2, { trigger: 'PRECHECK' }));
    const h = harness({ discovery: service.seam });
    h.cameras.stop('CAM-02');
    const { outcome } = await h.precheck(INVESTIGATOR);
    await outcome.settled;
    // The gate asks no permission: the search of a pre-check is no API operation (D80(2)).
    expect(service.calls.map((call) => call.owner)).toEqual([INVESTIGATOR]);
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => alert.params?.['searchResponderCount'])).toEqual([2]);
    // What the gate hands back holds no candidate and no list: ids and a state word.
    expect(Object.keys(outcome).sort()).toEqual(['asked', 'search', 'settled', 'unreachable']);
  });

  it('raised once per occurrence: a repeat of the run while unreachable adds no alert and no row; reachable again resolves with no row; then a NEW alert and a second row', async () => {
    const h = harness();
    h.cameras.stop('CAM-02');
    await h.precheck();
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE', true)).toHaveLength(1);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);

    // Retry, still stopped: per refresh it would be 2 alerts and 2 rows.
    await h.precheck(SUPERVISOR, true);
    await h.precheck(SUPERVISOR, true);
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);

    // The camera answers again: the next run resolves the alert, writes no row, and the check passes.
    h.cameras.start('CAM-02');
    const { item } = await h.precheck(SUPERVISOR, true);
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE').map((alert) => alert.active)).toEqual([false]);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);
    expect(item('LENS_2')).toMatchObject({ status: 'PASS' });
    expect(h.state().captureDevices.devices.find((device) => device.id === 'CAM-02')).toMatchObject({ online: true, streamState: 'LIVE' });
    expect(h.state().session?.state).toBe('ARMED');

    // A second occurrence after clearing is a NEW alert with its own row.
    h.sim.actions.cancel();
    h.cameras.stop('CAM-02');
    await h.precheck();
    const alerts = h.notices('CAPTURE_DEVICE_UNREACHABLE');
    expect(alerts.map((alert) => alert.active)).toEqual([false, true]);
    expect(alerts[0]?.id).not.toBe(alerts[1]?.id);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(2);
  });

  it('its own allowance: one search per run, none while a search of this gate is open, and a run whose search was not started is not failed', async () => {
    let release: ((search: ClosedSearch | null) => void) | null = null;
    const service = searchService(() => new Promise<ClosedSearch | null>((resolve) => void (release = resolve)));
    const h = harness({ discovery: service.seam });
    h.cameras.stop('CAM-02');
    const first = await h.precheck();
    expect(first.outcome.search).toBe('STARTED');
    // The search is open: no alert yet (it waits for the count), but the check already reads WARN.
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(0);
    expect(first.item('LENS_2')).toMatchObject({ status: 'WARN' });

    // A second run while the first search is open: no second search, the alert is raised without a count.
    const second = await h.precheck(SUPERVISOR, true);
    expect(second.outcome.search).toBe('ALLOWANCE_USED');
    expect(service.calls).toHaveLength(1);
    expect(h.state().session?.precheck.outcome).toBe('WARN');
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => 'searchResponderCount' in (alert.params ?? {}))).toEqual([false]);

    // The first search closes late: the later run already raised; still one alert, one row.
    (release as ((search: ClosedSearch | null) => void) | null)?.(closed(5, { trigger: 'PRECHECK' }));
    await first.outcome.settled;
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);

    // Control: with the search closed, the next run starts a search again.
    const third = await h.precheck(SUPERVISOR, true);
    expect(third.outcome.search).toBe('STARTED');
    expect(service.calls).toHaveLength(2);
  });

  it('a search the service does not start (single flight, limited) or that fails does not fail the pre-check: the alert is raised without a count', async () => {
    const notStarted = searchService(() => null);
    const h = harness({ discovery: notStarted.seam });
    h.cameras.stop('CAM-02');
    const one = await h.precheck();
    await one.outcome.settled;
    expect(h.state().session?.precheck.outcome).toBe('WARN');
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => alert.params)).toEqual([{ reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE' }]);
    expect(h.reports).toEqual([]);

    const failing = searchService(() => Promise.reject(new Error('the socket could not be opened')));
    const g = harness({ discovery: failing.seam });
    g.cameras.stop('CAM-01');
    const two = await g.precheck();
    await two.outcome.settled;
    expect(g.state().session?.precheck.outcome).toBe('WARN');
    expect(g.notices('CAPTURE_DEVICE_UNREACHABLE', true)).toHaveLength(1);
    expect(g.reports.map((entry) => [entry.code, entry.sessionId])).toEqual([[PrecheckReportCode.SEARCH_FAILED, two.sessionId]]);

    // No discovery service at all.
    const n = harness();
    n.cameras.stop('CAM-01');
    const three = await n.precheck();
    expect(three.outcome.search).toBe('NO_SERVICE');
    expect(n.notices('CAPTURE_DEVICE_UNREACHABLE', true)).toHaveLength(1);
  });

  it('no label, address or model text reaches an alert or an audit row of a pre-check (R-10 AC-6)', async () => {
    const h = harness();
    h.cameras.stop('CAM-01');
    h.fakes.mics[1]?.setPresent(false);
    await h.precheck();
    const devices = h.state().captureDevices.devices;
    const written = JSON.stringify([h.notices('CAPTURE_DEVICE_UNREACHABLE'), h.rowsOf('CAPTURE_DEVICE_UNREACHABLE').map((row) => [row.message, row.details])]);
    const texts = devices.flatMap((device) => [device.model, device.host]).filter((text): text is string => typeof text === 'string' && text.length > 0);
    // Control: the registry does hold such text.
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(written).not.toContain(text);
  });
});

describe('situation C: what the session start calls (rows 71 / 139)', () => {
  it('no camera connected raises CAPTURE_FAULT for the capture as a whole; a camera in a later session clears it; then a NEW fault', async () => {
    const h = harness();
    const raisedBefore = h.rowsOf('FAULT_RAISED').length;
    expect(await h.notifier.notifyNoCameraConnected({ sessionId: 'SES-1' })).toBe(true);
    expect(h.state().faults.active).toEqual([expect.objectContaining({ kind: 'CAPTURE_FAULT', target: null })]);
    expect(h.rowsOf('FAULT_RAISED')).toHaveLength(raisedBefore + 1);
    await h.notifier.camerasAvailable();
    expect(h.state().faults.active).toEqual([]);
    expect(h.rowsOf('FAULT_CLEARED')).toHaveLength(1);
    await h.notifier.notifyNoCameraConnected({ sessionId: 'SES-2' });
    expect(h.rowsOf('FAULT_RAISED')).toHaveLength(raisedBefore + 2);
  });

  it('degraded: one WARNING naming the missing camera, phase SESSION_START, cause NOT_CONNECTED; resolved when it connects', async () => {
    const h = harness();
    await h.notifier.notifyCameraNotConnected({ deviceId: 'CAM-02', sessionId: 'SES-20261001-0001' });
    await h.notifier.notifyCameraNotConnected({ deviceId: 'CAM-02', sessionId: 'SES-20261001-0001' });
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE', true).map((alert) => alert.params)).toEqual([{ reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'SESSION_START', cause: 'NOT_CONNECTED' }]);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE').map((row) => row.details)).toEqual([{ deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'SESSION_START', reason: 'NOT_CONNECTED', degraded: true, sessionId: 'SES-20261001-0001' }]);
    await h.notifier.cameraConnected('CAM-02');
    expect(h.notices('CAPTURE_DEVICE_UNREACHABLE', true)).toHaveLength(0);
    expect(h.rowsOf('CAPTURE_DEVICE_UNREACHABLE')).toHaveLength(1);
  });
});
