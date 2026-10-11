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
} from '../src/sim';
import { ActiveSessionSchema, CORE_NOT_RUNNING_FAULT_EXAMPLE, FaultsSliceSchema, PrecheckItemSchema, SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE, SESSION_CAPTURE_CHECKPOINTS_EXAMPLE, SecuritySliceSchema } from '../src/api';
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
  const { bed } = ownCaptureBed;

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
