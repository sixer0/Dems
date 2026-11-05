// The simulator inside a Core that captures itself (`capture: 'external'`): it invents no
// integrity stream, states the host system clock as its time, reports no platform security it
// does not read, and words the restart fault as "the Core was not running". Every case has its
// control on the simulated capture. Home file of these cases (suite consolidation, 2026-10-11);
// the finding ids stay in the titles.
import { describe, expect, it } from 'vitest';
import {
  captureFactsOf,
  createManualClock,
  createSim,
  type SessionCreateInput,
  type SimState,
  HOST_CLOCK_PRECHECK_REASON,
  isHostClockTime,
  isPrecheckNote,
  systemStatus,
  FaultKind,
  HOST_CLOCK_TIME,
  deriveDeviceState,
  CORE_NOT_RUNNING_LABEL,
  CORE_NOT_RUNNING_LABEL_KEY,
  CORE_NOT_RUNNING_SENTENCE,
  coreNotRunningFaultOf,
  coreNotRunningFaultTransition,
  faultKindLabelKey,
  injectFaultTransition,
  isCoreNotRunning,
  isCoreNotRunningKind,
  isPlatformNotReported,
  platformNotReportedTransition,
  type SessionCaptureCheckpoints,
  DIAGNOSTIC_NOT_REPORTED_CHECKS,
  PLATFORM_DEVICE_NOT_REPORTED,
  SECURITY_NOT_REPORTED_PRECHECK_RULE,
  UPDATER_NOT_AVAILABLE_REASON,
  SERVICES_RESTART_NOT_AVAILABLE_REASON,
  isDiagnosticNotReported,
  isLevelNotMeasured,
  isOwnCaptureCoreState,
  isUpdaterNotAvailable,
  platformDevices,
  selectPlatformDevices,
  updaterNotAvailableTransition,
} from '../src/sim';
import {
  ActiveSessionSchema,
  AUDIO_FRAME_NOT_MEASURED_EXAMPLE,
  AudioSliceSchema,
  CORE_NOT_RUNNING_FAULT_EXAMPLE,
  DIAGNOSTIC_NOT_REPORTED_EXAMPLE,
  DiagnosticsSliceSchema,
  FaultsSliceSchema,
  PRECHECK_SECURITY_NOT_REPORTED_EXAMPLE,
  PRECHECK_SECURITY_NOT_REPORTED_RULE,
  PrecheckItemSchema,
  SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE,
  SESSION_CAPTURE_CHECKPOINTS_EXAMPLE,
  SecuritySliceSchema,
  UPDATE_NOT_AVAILABLE_EXAMPLE,
  UPDATE_NOT_AVAILABLE_REASON,
  UpdateSliceSchema,
} from '../src/api';
import { en } from '../src/i18n';
import * as ownCaptureBed from './support/own-capture-bed';

// Fix wave H, driver A, finding G75-01 (gate 75; rulings D197, D199): where the capture is the
// Core's own (`CreateSimOptions.capture: 'external'`) NO simulator generator writes an integrity,
// hash, write-verified, timestamp-confirmed or auto-save row or fact. Those rows come from the
// capture / sealing side or do not exist. The simulator's own capture keeps its demo stream.
//
// Every claim has its control: the SAME run in `'simulated'` capture holds the rows.
describe('the generator invents nothing', () => {
  const START = Date.UTC(2026, 9, 1, 3, 0, 0);
  const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0008', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
  /** The rows and timeline kinds only a simulator generator writes. */
  const INVENTED_AUDIT = ['FRAME_HASH', 'WRITE_VERIFIED', 'TIMESTAMP_CONFIRMED'];
  const INVENTED_EVENTS = ['AUTOSAVE', 'STORAGE_WRITE_VERIFIED', 'TIME_SYNC'];
  const INVENTED_TIMELINE = ['AUTOSAVE', 'CHECK', 'HEALTH'];
  function recorded(capture: 'simulated' | 'external') {
    const clock = createManualClock(START);
    const sim = createSim({ clock, storage: null, authStorage: null, capture });
    sim.actions.signIn('budi.santoso', 'demo-2026');
    const state = (): SimState => sim.store.getState();
    const run = (ms: number, step = 250): void => {
      for (let elapsed = 0; elapsed < ms; elapsed += step) {
        clock.advance(step);
        sim.tick();
      }
    };
    // The seed holds rows of the demo history: what THIS run writes is told by the row IDs.
    const seed = state();
    // Idle first: the idle stream of the generator runs here.
    run(10 * 60_000, 1_000);
    const idle = state();
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(5_000, 50);
    expect(state().session?.state).toBe('ARMED');
    sim.actions.startRecording();
    const sessionId = state().session?.id ?? '';
    // Six minutes of recording: the simulated stream writes about 45 arrivals in that time.
    run(6 * 60_000);
    const seedEvents = new Set(seed.events.map((row) => row.id));
    const seedAudit = new Set(seed.audit.rows.map((row) => row.id));
    const newEvents = (at: SimState): string[] => at.events.filter((row) => !seedEvents.has(row.id)).map((row) => row.type);
    const newAudit = (at: SimState): string[] => at.audit.rows.filter((row) => !seedAudit.has(row.id)).map((row) => row.type);
    return { idle, recording: state(), sessionId, newEvents, newAudit };
  }
  const auditTypes = (state: SimState, sessionId: string | null): string[] => state.audit.rows.filter((row) => sessionId === null || row.sessionId === sessionId).map((row) => row.type);
  const count = (values: readonly string[], wanted: readonly string[]): number => values.filter((value) => wanted.includes(value)).length;

  describe('G75-01: no invented integrity stream where the capture is the Core\'s own', () => {
    it('external capture: a recording session holds no FRAME_HASH / WRITE_VERIFIED / TIMESTAMP_CONFIRMED row, no AUTOSAVE event, no AUTOSAVE / CHECK / HEALTH timeline item, and the storage slice states no verified write', () => {
      const h = recorded('external');
      expect(h.recording.session?.state).toBe('RECORDING');
      expect(count(h.newAudit(h.recording), INVENTED_AUDIT)).toBe(0);
      expect(count(h.newEvents(h.recording), INVENTED_EVENTS)).toBe(0);
      expect(count((h.recording.session?.timeline ?? []).map((item) => item.kind), INVENTED_TIMELINE)).toBe(0);
      expect(h.recording.storage.lastWriteVerifiedAt).toBe(h.idle.storage.lastWriteVerifiedAt);
      // The rows of the session that ARE acts of an operator or of the machine stay.
      expect(auditTypes(h.recording, h.sessionId)).toContain('RECORDING_STARTED');
    });

    it('external capture: the idle stream states no storage integrity check and no time synchronisation', () => {
      const h = recorded('external');
      expect(count(h.newEvents(h.idle), ['STORAGE_WRITE_VERIFIED', 'TIME_SYNC'])).toBe(0);
      // Pin moved by closing pass Z1 (ruling D203 (4)): the health-check event is not written either.
      expect(h.newEvents(h.idle)).not.toContain('HEALTH_CHECK_OK');
    });

    it('CONTROL - simulated capture keeps its demo stream: the same run holds every one of those rows', () => {
      const h = recorded('simulated');
      const session = auditTypes(h.recording, h.sessionId);
      for (const type of INVENTED_AUDIT) expect(session, type).toContain(type);
      expect(h.newEvents(h.recording)).toContain('AUTOSAVE');
      const kinds = (h.recording.session?.timeline ?? []).map((item) => item.kind);
      for (const kind of INVENTED_TIMELINE) expect(kinds, kind).toContain(kind);
      expect(h.recording.storage.lastWriteVerifiedAt).not.toBe(h.idle.storage.lastWriteVerifiedAt);
      expect(count(h.newEvents(h.idle), ['STORAGE_WRITE_VERIFIED', 'TIME_SYNC'])).toBeGreaterThan(0);
    });
  });

  describe('the capture facts a session surface may state', () => {
    it('a session without the member is the simulator\'s own capture: no capture facts', () => {
      expect(captureFactsOf(null)).toBeNull();
      expect(captureFactsOf({ state: 'RECORDING' })).toBeNull();
    });

    it('a session that carries the member states the capture state and, sealed, that it was encrypted at the seal - never before', () => {
      expect(captureFactsOf({ state: 'RECORDING', captureDurable: false })).toEqual({ capture: 'CONNECTING', protection: 'AT_SEAL' });
      expect(captureFactsOf({ state: 'RECORDING', captureDurable: true })).toEqual({ capture: 'DURABLE', protection: 'AT_SEAL' });
      expect(captureFactsOf({ state: 'FINALIZING', captureDurable: true })).toEqual({ capture: 'ENDED', protection: 'AT_SEAL' });
      expect(captureFactsOf({ state: 'FAULT', captureDurable: false })).toEqual({ capture: 'NOTHING_RECORDED', protection: 'NOTHING_RECORDED' });
      expect(captureFactsOf({ state: 'SEALED', captureDurable: true })).toEqual({ capture: 'ENDED', protection: 'SEALED' });
    });
  });
});

// Fix wave H, closing pass Z1, items 1 and 2 (rulings D203 (1) and D203 (4)).
//
// Item 1 - TRUTHFUL TIME: where the capture is the Core's own (`CreateSimOptions.capture:
// 'external'`) the `time` slice says what the Core has: the host system clock. Never GNSS, never
// locked. `RECORDING_STARTED.timeSource`, the session's `startTimeSource` and the START node follow
// the slice. The pre-check TIME item is a NOTE: WARN level, "Time source: host system clock (no
// GNSS)", and it neither blocks the start, nor asks for an acknowledgement, nor counts as a warning.
//
// Item 2 - the idle `HEALTH_CHECK_OK` event is not written there either.
//
// Every claim has its control: the SAME run in `'simulated'` capture keeps the demo values.
describe('the time is the host system clock', () => {
  const START = Date.UTC(2026, 9, 1, 3, 0, 0);
  const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0009', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
  function bed(capture: 'simulated' | 'external') {
    const clock = createManualClock(START);
    const sim = createSim({ clock, storage: null, authStorage: null, capture });
    sim.actions.signIn('budi.santoso', 'demo-2026');
    const state = (): SimState => sim.store.getState();
    const run = (ms: number, step = 250): void => {
      for (let elapsed = 0; elapsed < ms; elapsed += step) {
        clock.advance(step);
        sim.tick();
      }
    };
    return { sim, state, run };
  }
  function armed(capture: 'simulated' | 'external') {
    const h = bed(capture);
    h.run(2_000);
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    h.run(5_000, 50);
    return h;
  }

  describe('item 1: the time slice of a Core in its own capture is the host system clock', () => {
    it('external capture: the slice says host clock - source RTC, not locked, no GNSS lock, no satellites, no NTP - from the first state on', () => {
      const h = bed('external');
      // BEFORE any tick: no state of this Core ever says GNSS.
      expect(h.state().time.source).toBe('RTC');
      h.run(60_000, 1_000);
      const time = h.state().time;
      expect(isHostClockTime(time)).toBe(true);
      expect(time).toMatchObject({ hostClock: true, source: 'RTC', locked: false, gnss: { locked: false, satellites: 0 }, ntp: { reachable: false } });
      // Nothing is measured: no offset drifts and no history point is invented.
      expect(time.offsetMs).toBe(0);
      expect(time.history).toEqual([]);
    });

    it('external capture: the host clock is no fallback - systemStatus raises no TIME_FALLBACK flag', () => {
      const h = bed('external');
      h.run(5_000, 1_000);
      expect(systemStatus(h.state()).flags.map((flag) => flag.id)).not.toContain('TIME_FALLBACK');
    });

    it('external capture: the pre-check TIME item is a NOTE - WARN level, the truthful sentence, outcome PASS, ARMED without an acknowledgement', () => {
      const h = armed('external');
      const session = h.state().session;
      const item = session?.precheck.items.find((candidate) => candidate.id === 'TIME');
      expect(item).toMatchObject({ status: 'WARN', value: 'HOST_SYSTEM_CLOCK', reason: HOST_CLOCK_PRECHECK_REASON, reasonCode: null, params: { rule: 'TIME_HOST_CLOCK', source: 'RTC' } });
      expect(HOST_CLOCK_PRECHECK_REASON).toBe('Time source: host system clock (no GNSS)');
      expect(item !== undefined && isPrecheckNote(item)).toBe(true);
      // It does not block, it is not a failed pre-check, and nobody has to acknowledge it.
      expect(session?.precheck.outcome).toBe('PASS');
      expect(session?.precheck.warningsAcknowledged).toBe(false);
      expect(session?.state).toBe('ARMED');
      const passed = h.state().audit.rows.filter((row) => row.type === 'PRECHECK_PASSED' && row.sessionId === session?.id);
      expect(passed).toHaveLength(1);
      expect(passed[0]?.details).toMatchObject({ warnings: 0, acknowledged: false });
    });

    it('external capture: RECORDING_STARTED, the session and the START node say RTC - never GNSS', () => {
      const h = armed('external');
      h.sim.actions.startRecording();
      const state = h.state();
      const row = state.audit.rows.find((candidate) => candidate.type === 'RECORDING_STARTED' && candidate.sessionId === state.session?.id);
      expect(row?.details).toEqual({ timeSource: 'RTC' });
      expect(state.session?.startTimeSource).toBe('RTC');
      expect(state.session?.timeline.find((node) => node.kind === 'START')?.params).toMatchObject({ timeSource: 'RTC' });
      expect(JSON.stringify(state.audit.rows.filter((candidate) => candidate.sessionId === state.session?.id))).not.toContain('GNSS');
    });

    it('CONTROL - simulated capture keeps its demo time: GNSS locked, TIME passes with GNSS, RECORDING_STARTED says GNSS', () => {
      const h = armed('simulated');
      expect(isHostClockTime(h.state().time)).toBe(false);
      expect(h.state().time).toMatchObject({ source: 'GNSS', locked: true });
      expect(h.state().time.history.length).toBeGreaterThan(0);
      const item = h.state().session?.precheck.items.find((candidate) => candidate.id === 'TIME');
      expect(item).toMatchObject({ status: 'PASS', value: 'GNSS' });
      expect(item !== undefined && isPrecheckNote(item)).toBe(false);
      h.sim.actions.startRecording();
      const state = h.state();
      expect(state.audit.rows.find((candidate) => candidate.type === 'RECORDING_STARTED' && candidate.sessionId === state.session?.id)?.details).toEqual({ timeSource: 'GNSS' });
    });

    it('CONTROL - a real warning beside the note still asks for its acknowledgement, and the note is not counted with it', () => {
      const h = bed('external');
      h.run(2_000);
      h.sim.actions.inject('STORAGE_LOW');
      h.sim.actions.createSession(INPUT);
      h.sim.actions.beginPrecheck();
      h.run(5_000, 50);
      expect(h.state().session?.precheck.outcome).toBe('WARN');
      expect(h.state().session?.state).toBe('PRECHECK');
      h.sim.actions.acknowledgePrecheckWarnings();
      const state = h.state();
      expect(state.session?.state).toBe('ARMED');
      expect(state.audit.rows.find((row) => row.type === 'PRECHECK_PASSED' && row.sessionId === state.session?.id)?.details).toMatchObject({ warnings: 1, acknowledged: true });
    });
  });

  describe('item 2: the idle HEALTH_CHECK_OK event is not the generator\'s to write in the Core\'s own capture', () => {
    const idleEvents = (capture: 'simulated' | 'external'): string[] => {
      const h = bed(capture);
      const seed = new Set(h.state().events.map((row) => row.id));
      h.run(30 * 60_000, 1_000);
      return h.state().events.filter((row) => !seed.has(row.id)).map((row) => row.type);
    };

    it('external capture: thirty idle minutes write no HEALTH_CHECK_OK (and still no storage / time statement)', () => {
      const types = idleEvents('external');
      expect(types.filter((type) => ['HEALTH_CHECK_OK', 'STORAGE_WRITE_VERIFIED', 'TIME_SYNC'].includes(type))).toEqual([]);
    });

    it('CONTROL - simulated capture keeps its idle stream, the health check among it', () => {
      const types = idleEvents('simulated');
      expect(types).toContain('HEALTH_CHECK_OK');
      expect(types).toContain('TIME_SYNC');
    });
  });
});

// Pass H-Y (found by the seal e2e's new assertion: a product-sealed audit extract said
// `RECORDING_STARTED.timeSource: GNSS` in one of two real seals).
//
// THE DEFECT. Wave H Z1 (ruling D203 (1)) made the `time` slice of a Core in its own capture the
// host system clock, in the first state and again at every health tick (1 Hz). But every session
// change, fault change and tablet-link carry runs `deriveDeviceState`, whose time rule said "no
// GNSS_LOSS fault -> source GNSS, locked" WITHOUT asking whose clock the slice is. So between a
// session change and the next health tick the slice said GNSS again, and a recording started inside
// that second wrote GNSS into its audit row, its session and its START node. The Z1 tests ticked
// between every action and never saw it.
//
// THE RULE. A host-clock time slice is no time service: the derivation leaves it as it is, fault or
// no fault. CONTROL: the same steps in `'simulated'` capture keep the demo's GNSS and its fall-back.
describe('the host-clock time slice and the derivations', () => {
  const START = Date.UTC(2026, 9, 1, 3, 0, 0);
  const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0010', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
  function bed(capture: 'simulated' | 'external') {
    const clock = createManualClock(START);
    const sim = createSim({ clock, storage: null, authStorage: null, capture });
    sim.actions.signIn('budi.santoso', 'demo-2026');
    const state = (): SimState => sim.store.getState();
    const run = (ms: number, step = 50): void => {
      for (let elapsed = 0; elapsed < ms; elapsed += step) {
        clock.advance(step);
        sim.tick();
      }
    };
    return { sim, state, run, clock };
  }

  describe('a host-clock time slice survives every derivation, with no tick in between', () => {
    it('the derivation itself: the slice comes back the same object, without and with a GNSS_LOSS fault in the state', () => {
      const h = bed('external');
      const before = h.state();
      expect(before.time).toMatchObject({ hostClock: true, source: 'RTC', locked: false });
      expect(deriveDeviceState(before).time).toBe(before.time);
      const faulted: SimState = { ...before, faults: { ...before.faults, active: [...before.faults.active, { kind: FaultKind.GNSS_LOSS, since: START, target: 'NTP' }] } };
      expect(deriveDeviceState(faulted).time).toBe(before.time);
    });

    it('a session is created (a session change) and NO tick follows: the slice still says the host clock', () => {
      const h = bed('external');
      h.run(2_000);
      h.sim.actions.createSession(INPUT);
      expect(h.state().time).toEqual(HOST_CLOCK_TIME);
      expect(isHostClockTime(h.state().time)).toBe(true);
    });

    it('a recording started in the same instant as the last session change says RTC in its audit row, its session and its START node', () => {
      const h = bed('external');
      h.run(2_000);
      h.sim.actions.createSession(INPUT);
      h.sim.actions.beginPrecheck();
      h.run(5_000);
      if (h.state().session?.state === 'PRECHECK') h.sim.actions.acknowledgePrecheckWarnings();
      expect(h.state().session?.state).toBe('ARMED');
      // A derivation runs (what any session change, fault change or link carry does) and NO tick follows before the start.
      h.sim.store.setState(deriveDeviceState(h.state()), true);
      h.sim.actions.startRecording();
      const state = h.state();
      expect(state.session).toMatchObject({ state: 'RECORDING', startTimeSource: 'RTC' });
      const started = state.audit.rows.filter((row) => row.type === 'RECORDING_STARTED' && row.sessionId === state.session?.id);
      expect(started.map((row) => row.details)).toEqual([{ timeSource: 'RTC' }]);
      expect(state.session?.timeline.filter((node) => node.kind === 'START').map((node) => node.params)).toEqual([{ sessionId: state.session?.id, timeSource: 'RTC' }]);
      expect(state.time).toEqual(HOST_CLOCK_TIME);
    });

    it('CONTROL - simulated capture: the same steps keep GNSS, and the derivation still falls back on a GNSS_LOSS fault', () => {
      const h = bed('simulated');
      h.run(2_000);
      h.sim.actions.createSession(INPUT);
      expect(h.state().time).toMatchObject({ source: 'GNSS', locked: true });
      const before = h.state();
      const faulted: SimState = { ...before, faults: { ...before.faults, active: [...before.faults.active, { kind: FaultKind.GNSS_LOSS, since: START, target: 'NTP' }] } };
      expect(deriveDeviceState(faulted).time).toMatchObject({ source: 'NTP', locked: true, gnss: { locked: false } });
    });
  });
});

// Closing pass J of fix wave I (decisions D216, D217 (5), (7)).
//   `security.platformNotReported`  a Core in its own capture states that it reads no TPM,
//                                   Secure Boot or posture; the simulated device is unchanged;
//   `coreNotRunning`                the restart fault of a Core in its own capture says "the Core
//                                   was not running", on every record, with the kind unchanged.
// Batch N (verification row 98; ruling D241).
//   V98-09: `session.captureCheckpoints` has an exported contract example; the client tests import it.
//   V98-08: `reasonCode` and `params` of a pre-check item are members of the STATE SLICE `session`
//           (topic `state`); operation 27's `PrecheckItem` is the design-book shape and keeps its four
//           members (API-1). A read of operation 27 that shows no `params` is the contract, not a gap.
describe('batch N: the checkpoint example, and where a pre-check item carries `params`', () => {
  it('V98-09: SESSION_CAPTURE_CHECKPOINTS_EXAMPLE is the member of the contract - it parses as `session.captureCheckpoints`, its cameras add up to its totals, and a member more or less does not parse', () => {
    const member = ActiveSessionSchema.shape.captureCheckpoints;
    expect(member.safeParse(SESSION_CAPTURE_CHECKPOINTS_EXAMPLE).success).toBe(true);
    expect(member.safeParse(undefined).success).toBe(true);
    const { cameras, fragments, bytes } = SESSION_CAPTURE_CHECKPOINTS_EXAMPLE;
    expect(cameras.reduce((sum, camera) => sum + camera.fragments, 0)).toBe(fragments);
    expect(cameras.reduce((sum, camera) => sum + camera.bytes, 0)).toBe(bytes);
    expect(cameras.map((camera) => camera.deviceId)).toEqual(['CAM-01', 'CAM-02']);
    // CONTROL: the schema is strict - the example is not accepted by accident.
    expect(member.safeParse({ ...SESSION_CAPTURE_CHECKPOINTS_EXAMPLE, bytesWritten: 1 }).success).toBe(false);
    const { lastAt: _lastAt, ...withoutInstant } = SESSION_CAPTURE_CHECKPOINTS_EXAMPLE;
    expect(member.safeParse(withoutInstant).success).toBe(false);
    // The simulator's type of the member takes it as it is (a client spreads it into a session).
    const typed: SessionCaptureCheckpoints = { ...SESSION_CAPTURE_CHECKPOINTS_EXAMPLE, cameras: [...SESSION_CAPTURE_CHECKPOINTS_EXAMPLE.cameras] };
    expect(typed.fragments).toBe(24);
  });

  it('V98-08: a pre-check item of the SLICE carries `reasonCode` and `params` (`{ deviceId, rule }`); the item of operation 27 has exactly id, status, value, reason and drops anything else', () => {
    const sliceItem = { id: 'LENS_2', status: 'WARN', value: 'UNREACHABLE', reason: 'CAM-05 is not reachable', reasonCode: null, params: { deviceId: 'CAM-05', rule: 'oneCamera' }, resolvesAt: null };
    const items = ActiveSessionSchema.shape.precheck.shape.items;
    expect(items.safeParse([sliceItem]).success).toBe(true);
    expect(items.safeParse([{ ...sliceItem, params: undefined }]).success).toBe(true);
    // Operation 27 (API-1: the design-book operations keep their response schema): four members, nothing more on the wire.
    expect(Object.keys(PrecheckItemSchema.shape).sort()).toEqual(['id', 'reason', 'status', 'value']);
    expect(PrecheckItemSchema.parse(sliceItem)).toEqual({ id: 'LENS_2', status: 'WARN', value: 'UNREACHABLE', reason: 'CAM-05 is not reachable' });
  });
});

describe('platform security not reported, and the restart fault', () => {
  const { bed, INPUT } = ownCaptureBed;

  describe('security.platformNotReported (G75b-06, D217 (7))', () => {
    it('a Core in its own capture states it from its first state, and keeps it through ticks and a derived security change', () => {
      const h = bed({ capture: 'external' });
      expect(h.state().security.platformNotReported).toBe(true);
      expect(isPlatformNotReported(h.state().security)).toBe(true);
      h.run(3_000);
      h.sim.actions.inject('TAMPER');
      h.run(1_000);
      expect(h.state().security.tamper).toBe(true);
      expect(h.state().security.platformNotReported).toBe(true);
      expect(SecuritySliceSchema.safeParse(h.state().security).success).toBe(true);
    });

    it('CONTROL - the simulated device does not carry the member and its slice is what it was', () => {
      const h = bed();
      h.run(3_000);
      expect(h.state().security).not.toHaveProperty('platformNotReported');
      expect(isPlatformNotReported(h.state().security)).toBe(false);
      expect(h.state().security).toMatchObject({ posture: 'SECURE', tpm: { ok: true }, secureBoot: true });
    });

    it('the transition writes once; the contract example is the member and passes the schema; any other value is refused', () => {
      const h = bed();
      const stated = platformNotReportedTransition(h.state());
      expect(stated.security).toEqual({ ...h.state().security, ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE });
      expect(platformNotReportedTransition(stated)).toBe(stated);
      expect(SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE).toEqual({ platformNotReported: true });
      expect(SecuritySliceSchema.safeParse(stated.security).success).toBe(true);
      expect(SecuritySliceSchema.safeParse({ ...h.state().security, platformNotReported: false }).success).toBe(false);
      expect(isPlatformNotReported(null)).toBe(false);
    });

    it('the shared words exist once', () => {
      expect(en.common.platformNotReported.value).toBe('Not reported');
      expect(en.common.platformNotReported.tpm).toBe('TPM: not reported');
      expect(en.common.platformNotReported.secureBoot).toBe('Secure Boot: not reported');
    });
  });

  // Fix wave J (decision D243; truth rule 3c; findings JW-04 / JT-03): every answer of the Core that stated a PASS
  // over hardware it does not read says "not reported" itself. Each case has its control on the simulated device.
  describe('fix wave J: no answer of a Core in its own capture states a platform PASS', () => {
    it('JW-04: the pre-check SECURITY item is a NOTE "not reported" - never READY / PASS - and the run still passes', () => {
      const h = bed({ capture: 'external' });
      h.armed();
      const item = h.state().session?.precheck.items.find((entry) => entry.id === 'SECURITY');
      expect(item).toMatchObject({ status: 'WARN', value: 'NOT_REPORTED', reasonCode: null, params: { rule: SECURITY_NOT_REPORTED_PRECHECK_RULE } });
      expect(item).toMatchObject({ status: PRECHECK_SECURITY_NOT_REPORTED_EXAMPLE.status, value: PRECHECK_SECURITY_NOT_REPORTED_EXAMPLE.value, reason: PRECHECK_SECURITY_NOT_REPORTED_EXAMPLE.reason, params: PRECHECK_SECURITY_NOT_REPORTED_EXAMPLE.params });
      expect(SECURITY_NOT_REPORTED_PRECHECK_RULE).toBe(PRECHECK_SECURITY_NOT_REPORTED_RULE);
      expect(isPrecheckNote(item!)).toBe(true);
      expect(PrecheckItemSchema.safeParse(item).success).toBe(true);
      // A note is no warning: nothing to acknowledge, the session is ARMED.
      expect(h.state().session).toMatchObject({ state: 'ARMED', precheck: { outcome: 'PASS', warningsAcknowledged: false } });
      // No item of the run says READY / PASS about security.
      expect(h.state().session?.precheck.items.filter((entry) => entry.id === 'SECURITY' && (entry.status === 'PASS' || entry.value === 'READY'))).toEqual([]);
    });

    it('JW-04 CONTROL - the simulated device keeps "SECURITY READY PASS", and a security FAULT still blocks on a Core in its own capture', () => {
      const simulated = bed();
      simulated.armed();
      expect(simulated.state().session?.precheck.items.find((entry) => entry.id === 'SECURITY')).toMatchObject({ status: 'PASS', value: 'READY' });
      const own = bed({ capture: 'external' });
      own.sim.actions.inject('SECURITY_FAULT');
      own.sim.actions.createSession(INPUT);
      own.sim.actions.beginPrecheck();
      own.run(6_000);
      expect(own.state().session?.precheck.items.find((entry) => entry.id === 'SECURITY')).toMatchObject({ status: 'BLOCK', value: 'FAULT' });
      expect(own.state().session?.precheck.outcome).toBe('BLOCK');
    });

    it('JT-03: the diagnostics rows over SMART, the fan, PoE and the platform say "not reported"; the others are evaluated; the run counts no warning', () => {
      const h = bed({ capture: 'external' });
      h.sim.actions.signOut();
      h.sim.actions.signIn('rina.wijaya', 'demo-2026');
      h.sim.actions.runDiagnostics();
      h.run(20_000);
      const run = h.state().diagnostics;
      expect(run?.completedAt).not.toBeNull();
      const byId = Object.fromEntries((run?.checks ?? []).map((check) => [check.id, check]));
      for (const id of DIAGNOSTIC_NOT_REPORTED_CHECKS) {
        expect(byId[id], id).toMatchObject({ status: 'WARN', detail: DIAGNOSTIC_NOT_REPORTED_EXAMPLE.detail, params: DIAGNOSTIC_NOT_REPORTED_EXAMPLE.params });
        expect(isDiagnosticNotReported(byId[id]), id).toBe(true);
      }
      expect([...DIAGNOSTIC_NOT_REPORTED_CHECKS]).toEqual(['STORAGE', 'FAN', 'NETWORK', 'SECURITY']);
      // No row says PASS about hardware the Core does not read.
      expect((run?.checks ?? []).filter((check) => check.status === 'PASS').map((check) => check.id).filter((id) => DIAGNOSTIC_NOT_REPORTED_CHECKS.includes(id))).toEqual([]);
      for (const id of ['CPU', 'CAMERA', 'AUDIO']) expect(isDiagnosticNotReported(byId[id]), id).toBe(false);
      expect(DiagnosticsSliceSchema.safeParse(run).success).toBe(true);
      const done = h.state().events.filter((event) => event.type === 'DIAGNOSTICS_COMPLETED').at(-1);
      expect(done?.params).toMatchObject({ notReported: 4, fail: 0 });
      expect(done?.severity).not.toBe('SUCCESS');
      expect(done?.message).not.toContain('all passed');
    });

    it('JT-03 CONTROL - the simulated device answers all eight rows and none is "not reported"', () => {
      const h = bed();
      h.sim.actions.signOut();
      h.sim.actions.signIn('rina.wijaya', 'demo-2026');
      h.sim.actions.runDiagnostics();
      h.run(20_000);
      const checks = h.state().diagnostics?.checks ?? [];
      expect(checks.filter((check) => isDiagnosticNotReported(check))).toEqual([]);
      expect(checks.find((check) => check.id === 'SECURITY')).toMatchObject({ status: 'PASS', detail: 'TPM 2.0 and Secure Boot OK' });
      expect(isDiagnosticNotReported(null)).toBe(false);
      expect(isDiagnosticNotReported({ status: 'PASS', params: { rule: 'NOT_REPORTED' } })).toBe(false);
    });

    it('the platform device list and operation `getDeviceStatus` say NOT_REPORTED for the TPM (the readers wave I left)', () => {
      const own = bed({ capture: 'external' });
      expect(platformDevices(own.state()).find((device) => device.id === 'TPM')).toEqual({ id: 'TPM', name: expect.any(String), online: false, status: PLATFORM_DEVICE_NOT_REPORTED, satellites: null });
      expect(selectPlatformDevices(own.state()).find((device) => device.id === 'TPM')?.status).toBe('NOT_REPORTED');
      const answer = own.sim.request({ method: 'GET', path: '/api/v1/device/health' });
      expect(answer.status).toBe(200);
      expect((answer.body as { security: unknown }).security).toMatchObject({ platformNotReported: true });
      const simulated = bed();
      expect(platformDevices(simulated.state()).find((device) => device.id === 'TPM')).toMatchObject({ online: true, status: 'OK' });
      expect((simulated.sim.request({ method: 'GET', path: '/api/v1/device/health' }).body as { security: object }).security).not.toHaveProperty('platformNotReported');
    });

    it('JW-07: ONE reader says whether the Core is in its own capture - false for the simulated device (everything it shows is a demonstration)', () => {
      expect(isOwnCaptureCoreState(bed({ capture: 'external' }).state())).toBe(true);
      expect(isOwnCaptureCoreState(bed().state())).toBe(false);
      expect(isOwnCaptureCoreState({ time: { hostClock: true }, security: {} })).toBe(true);
      expect(isOwnCaptureCoreState({ time: {}, security: { platformNotReported: true } })).toBe(true);
      expect(isOwnCaptureCoreState({})).toBe(false);
      expect(isOwnCaptureCoreState(null)).toBe(false);
    });
  });

  // Fix wave J (findings JT-06 / JW-06): "Install update" is the simulator's demonstration. A Core in its own capture has no updater.
  describe('fix wave J: no software updater on a Core in its own capture', () => {
    const technician = (h: ReturnType<typeof bed>): void => {
      h.sim.actions.signOut();
      h.sim.actions.signIn('rina.wijaya', 'demo-2026');
    };

    it('JT-06: the update slice states `updaterNotAvailable` from the first state, and `startSoftwareUpdate` is refused - nothing starts, no row', () => {
      const h = bed({ capture: 'external' });
      expect(h.state().update).toMatchObject(UPDATE_NOT_AVAILABLE_EXAMPLE);
      expect(isUpdaterNotAvailable(h.state().update)).toBe(true);
      expect(UpdateSliceSchema.safeParse(h.state().update).success).toBe(true);
      technician(h);
      const before = h.state();
      let thrown: unknown = null;
      try {
        h.sim.actions.startSoftwareUpdate();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toMatchObject({ name: 'SimTransitionError', code: 'COMMAND_UNSUPPORTED', reason: UPDATER_NOT_AVAILABLE_REASON });
      expect(UPDATER_NOT_AVAILABLE_REASON).toBe(UPDATE_NOT_AVAILABLE_REASON);
      expect(h.state().update).toEqual(before.update);
      expect(h.state().audit.total).toBe(before.audit.total);
      h.run(15_000);
      expect(h.state().update.state).toBe('IDLE');
      expect(h.state().audit.rows.some((row) => row.type === 'UPDATE_STARTED')).toBe(false);
    });

    it('JT-06: a stored state that holds a running demonstration update is put right - nothing is installing', () => {
      const h = bed();
      technician(h);
      h.sim.actions.startSoftwareUpdate();
      expect(h.state().update.state).toBe('RUNNING');
      const stated = updaterNotAvailableTransition(h.state());
      expect(stated.update).toMatchObject({ state: 'IDLE', startedAt: null, completedAt: null, updaterNotAvailable: true });
      expect(updaterNotAvailableTransition(stated)).toBe(stated);
    });

    it('JT-06 CONTROL - the simulated device keeps its demonstration update: no member, and the update runs', () => {
      const h = bed();
      expect(h.state().update).not.toHaveProperty('updaterNotAvailable');
      expect(isUpdaterNotAvailable(h.state().update)).toBe(false);
      technician(h);
      h.sim.actions.startSoftwareUpdate();
      expect(h.state().update.state).toBe('RUNNING');
      expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'UPDATE_STARTED' });
      expect(UpdateSliceSchema.safeParse({ ...h.state().update, updaterNotAvailable: false }).success).toBe(false);
    });
  });

  // Row 104c2 (finding RT-1, ruling D81): operation 66 ran the simulator's restart on a Core in its own capture and the
  // console stated the model's service count; a "(simulated)" DEVICE_COMMAND row entered the production chain.
  describe('row 104c2: no services restart on a Core in its own capture', () => {
    const technician = (h: ReturnType<typeof bed>): void => {
      h.sim.actions.signOut();
      h.sim.actions.signIn('rina.wijaya', 'demo-2026');
    };
    const deviceCommands = (h: ReturnType<typeof bed>): number => h.state().audit.rows.filter((row) => row.type === 'DEVICE_COMMAND').length;

    it('RT-1: `restartServices` is refused (COMMAND_UNSUPPORTED, SERVICES_RESTART_NOT_AVAILABLE) - no service restarts, no row, no count', () => {
      const h = bed({ capture: 'external' });
      expect(isOwnCaptureCoreState(h.state())).toBe(true);
      technician(h);
      const before = h.state();
      const commands = deviceCommands(h);
      let thrown: unknown = null;
      try {
        h.sim.actions.restartServices();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toMatchObject({ name: 'SimTransitionError', code: 'COMMAND_UNSUPPORTED', reason: SERVICES_RESTART_NOT_AVAILABLE_REASON });
      expect(h.state().services).toEqual(before.services);
      expect(h.state().audit.total).toBe(before.audit.total);
      expect(deviceCommands(h)).toBe(commands);
    });

    it('RT-1 CONTROL - the simulated device keeps its demonstration restart: a count and one DEVICE_COMMAND row', () => {
      const h = bed();
      expect(isOwnCaptureCoreState(h.state())).toBe(false);
      technician(h);
      const before = h.state().audit.total;
      expect(h.sim.actions.restartServices()).toBeGreaterThan(0);
      expect(h.state().audit.total).toBe(before + 1);
      expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'DEVICE_COMMAND', details: { scope: 'CORE_SERVICES' } });
    });
  });

  // Fix wave J (finding JW-08): both microphones read "NO SIGNAL" beside "READY - PASS" whenever no capture was open.
  describe('fix wave J: a level that is not measured is not NO SIGNAL', () => {
    it('JW-08: at rest a Core in its own capture states `notMeasured` on all four inputs, and never `noSignal`', () => {
      const h = bed({ capture: 'external' });
      h.run(2_000);
      const frames = Object.values(h.state().audio.inputs);
      expect(frames).toHaveLength(4); // D61 (2026-11-04): four simultaneous channels, four unmeasured frames
      for (const frame of frames) {
        expect(frame).toMatchObject({ notMeasured: true, noSignal: false, dbfs: -90, peak: -90 });
        expect(isLevelNotMeasured(frame)).toBe(true);
      }
      expect(AudioSliceSchema.safeParse(h.state().audio).success).toBe(true);
      expect(frames[0]).toMatchObject({ noSignal: AUDIO_FRAME_NOT_MEASURED_EXAMPLE.noSignal, notMeasured: AUDIO_FRAME_NOT_MEASURED_EXAMPLE.notMeasured, dbfs: AUDIO_FRAME_NOT_MEASURED_EXAMPLE.dbfs });
      // Through a pre-check too: the Core measures nothing until a capture is open.
      h.armed();
      expect(Object.values(h.state().audio.inputs).every((frame) => frame.notMeasured === true && !frame.noSignal)).toBe(true);
    });

    it('JW-08: while a capture is OPEN an input without a fresh measured level IS "no signal" - the fault word keeps its meaning', () => {
      const h = bed({ capture: 'external' });
      h.armed();
      h.sim.actions.startRecording();
      h.run(2_000);
      expect(h.state().session?.state).toBe('RECORDING');
      for (const frame of Object.values(h.state().audio.inputs)) {
        expect(frame.noSignal).toBe(true);
        expect(frame).not.toHaveProperty('notMeasured');
      }
    });

    it('JW-08 CONTROL - the simulated device generates a level at all times and never sets the member', () => {
      const h = bed();
      h.run(2_000);
      for (const frame of Object.values(h.state().audio.inputs)) {
        expect(frame).not.toHaveProperty('notMeasured');
        expect(frame.noSignal).toBe(false);
        expect(isLevelNotMeasured(frame)).toBe(false);
      }
      expect(isLevelNotMeasured(null)).toBe(false);
    });
  });

  describe('coreNotRunning: the restart fault of a Core in its own capture (G75b-03, D217 (5))', () => {
    function recording() {
      const h = bed({ capture: 'external' });
      h.armed();
      h.sim.actions.startRecording();
      h.run(2_000);
      expect(h.state().session?.state).toBe('RECORDING');
      return h;
    }

    it('same kind, same move, same fromState - other words, and the member on every record', () => {
      const h = recording();
      const before = h.state();
      const at = h.clock.now();
      const next = coreNotRunningFaultTransition(before, at);

      expect(next.session).toMatchObject({ state: 'FAULT', fault: { kind: 'POWER_FAIL', at, fromState: 'RECORDING', coreNotRunning: true } });
      expect(next.session?.fault).not.toHaveProperty('reason');
      const active = next.faults.active.filter((fault) => fault.kind === 'POWER_FAIL');
      expect(active).toEqual([{ kind: 'POWER_FAIL', since: at, target: null, coreNotRunning: true }]);
      expect(coreNotRunningFaultOf(next)).toEqual(active[0]);

      const alert = next.alerts.findLast((candidate) => candidate.kind === 'POWER_FAIL');
      expect(alert).toMatchObject({ severity: 'CRITICAL', active: true, message: CORE_NOT_RUNNING_SENTENCE, params: { kind: 'POWER_FAIL', coreNotRunning: true } });
      expect(alert?.params).not.toHaveProperty('reason');

      const row = next.audit.rows.at(-1);
      expect(row).toMatchObject({ type: 'FAULT_RAISED', message: CORE_NOT_RUNNING_SENTENCE, sessionId: before.session?.id, details: { kind: 'POWER_FAIL', fromState: 'RECORDING', coreNotRunning: true } });
      expect(next.audit.rows.length).toBe(before.audit.rows.length + 1);

      const item = next.session?.timeline.at(-1);
      expect(item).toMatchObject({ kind: 'FAULT', label: CORE_NOT_RUNNING_LABEL, params: { kind: 'POWER_FAIL', coreNotRunning: true } });

      // Nothing the Core wrote for it says "power fail".
      const written = [alert?.message, row?.message, item?.label, ...next.events.slice(before.events.length).map((event) => event.message)];
      for (const text of written) expect(String(text)).not.toMatch(/power\s*fail/i);

      // The shapes of the contract hold, and the examples are the member.
      expect(ActiveSessionSchema.shape.fault.safeParse(next.session?.fault).success).toBe(true);
      expect(FaultsSliceSchema.safeParse(next.faults).success).toBe(true);
      expect(CORE_NOT_RUNNING_FAULT_EXAMPLE).toEqual({ coreNotRunning: true });
      expect(ActiveSessionSchema.shape.fault.safeParse({ kind: 'POWER_FAIL', at, fromState: 'RECORDING', ...CORE_NOT_RUNNING_FAULT_EXAMPLE }).success).toBe(true);
      expect(ActiveSessionSchema.shape.fault.safeParse({ kind: 'POWER_FAIL', at, fromState: 'RECORDING', coreNotRunning: false }).success).toBe(false);

      // Idempotent like every raise.
      expect(coreNotRunningFaultTransition(next, at + 5)).toBe(next);
    });

    it('CONTROL - the simulator\'s own power failure is unchanged: its words, no member', () => {
      const h = recording();
      const at = h.clock.now();
      const next = injectFaultTransition(h.state(), at, 'POWER_FAIL');
      expect(next.session?.fault).toEqual({ kind: 'POWER_FAIL', at, fromState: 'RECORDING' });
      expect(next.faults.active.filter((fault) => fault.kind === 'POWER_FAIL')).toEqual([{ kind: 'POWER_FAIL', since: at, target: null }]);
      expect(next.audit.rows.at(-1)).toMatchObject({ type: 'FAULT_RAISED', message: 'Power fail detected — recovery marker written' });
      expect(next.audit.rows.at(-1)?.details).not.toHaveProperty('coreNotRunning');
      expect(next.session?.timeline.at(-1)).toMatchObject({ label: 'Critical fault: POWER_FAIL' });
      expect(coreNotRunningFaultOf(next)).toBeNull();
    });

    it('a recovery of that fault writes no "after power fail" row; the simulator\'s recovery still does', () => {
      for (const own of [true, false]) {
        const h = recording();
        const at = h.clock.now();
        h.sim.store.setState(own ? coreNotRunningFaultTransition(h.state(), at) : injectFaultTransition(h.state(), at, 'POWER_FAIL'));
        const rowsBefore = h.state().audit.rows.length;
        h.sim.actions.recover();
        const cleared = h.state().audit.rows.slice(rowsBefore).find((row) => row.type === 'FAULT_CLEARED' && row.details['kind'] === 'POWER_FAIL');
        expect(cleared, String(own)).toBeDefined();
        if (own) {
          expect(cleared?.message).not.toMatch(/power\s*fail/i);
          expect(cleared?.details).toMatchObject({ coreNotRunning: true });
        } else expect(cleared?.message).toBe('Power fail detected — recovery marker written — cleared');
        const boot = h.state().audit.rows.slice(rowsBefore).find((row) => row.type === 'SYSTEM_BOOT');
        expect(boot, String(own)).toBeDefined();
        if (own) {
          expect(boot?.message).not.toMatch(/power\s*fail/i);
          expect(boot?.message).toMatch(/was not running while this session was active/);
          expect(boot?.details).toMatchObject({ afterFault: 'POWER_FAIL', coreNotRunning: true });
        } else {
          expect(boot?.message).toMatch(/restarted after power fail/);
          expect(boot?.details).toEqual({ afterFault: 'POWER_FAIL' });
        }
      }
    });

    it('the readers: a surface words the kind from the member, by name', () => {
      expect(faultKindLabelKey('POWER_FAIL', { kind: 'POWER_FAIL', coreNotRunning: true })).toBe(CORE_NOT_RUNNING_LABEL_KEY);
      expect(faultKindLabelKey('POWER_FAIL', null, { coreNotRunning: true })).toBe(CORE_NOT_RUNNING_LABEL_KEY);
      expect(faultKindLabelKey('POWER_FAIL', { kind: 'POWER_FAIL' })).toBe('common.faultKind.POWER_FAIL');
      expect(faultKindLabelKey('POWER_FAIL')).toBe('common.faultKind.POWER_FAIL');
      expect(isCoreNotRunning({ coreNotRunning: 'true' })).toBe(false);
      expect(en.common.coreNotRunning).toEqual({ label: CORE_NOT_RUNNING_LABEL, sentence: CORE_NOT_RUNNING_SENTENCE });
      const h = recording();
      const next = coreNotRunningFaultTransition(h.state(), h.clock.now());
      expect(isCoreNotRunningKind(next, 'POWER_FAIL')).toBe(true);
      expect(isCoreNotRunningKind(next, 'CAMERA_LOSS')).toBe(false);
      expect(isCoreNotRunningKind(h.state(), 'POWER_FAIL')).toBe(false);
    });
  });
});
