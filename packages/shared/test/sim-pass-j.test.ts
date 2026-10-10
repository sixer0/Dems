// Closing pass J of fix wave I (decisions D216, D217 (5), (7); request G75b-10).
//   1. `security.platformNotReported`  a Core in its own capture states that it reads no TPM,
//                                      Secure Boot or posture; the simulated device is unchanged;
//   2. `coreNotRunning`                the restart fault of a Core in its own capture says "the Core
//                                      was not running", on every record, with the kind unchanged;
//   3. the generator's hold            no integrity row for a start that is not decided, none for
//                                      a start that failed, the same rows for a start that happened.
import { describe, expect, it } from 'vitest';
import { ActiveSessionSchema, CORE_NOT_RUNNING_FAULT_EXAMPLE, FaultsSliceSchema, SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE, SecuritySliceSchema } from '../src/api';
import { en } from '../src/i18n';
import {
  CORE_NOT_RUNNING_LABEL,
  CORE_NOT_RUNNING_LABEL_KEY,
  CORE_NOT_RUNNING_SENTENCE,
  coreNotRunningFaultOf,
  coreNotRunningFaultTransition,
  createManualClock,
  createSim,
  faultKindLabelKey,
  injectFaultTransition,
  isCoreNotRunning,
  isCoreNotRunningKind,
  isPlatformNotReported,
  platformNotReportedTransition,
  type SessionCreateInput,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0);
const INPUT: SessionCreateInput = { caseNumber: 'LP/2026/1001-0011', subjectType: 'SAKSI', subjectName: 'Test Saksi', investigatorId: 'OPR-001', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' };
const INTEGRITY = ['FRAME_HASH', 'WRITE_VERIFIED', 'TIMESTAMP_CONFIRMED'];

function bed(options: { captureConnectMs?: number; capture?: 'simulated' | 'external' } = {}) {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, ...options });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const run = (ms: number, step = 50): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const armed = (): void => {
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(6_000);
  };
  const state = (): SimState => sim.store.getState();
  const integrityRows = () => state().audit.rows.filter((row) => INTEGRITY.includes(row.type)).map((row) => `${row.type}@${row.at - START}`);
  return { sim, clock, run, armed, state, integrityRows };
}

describe('1. security.platformNotReported (G75b-06, D217 (7))', () => {
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

describe('2. coreNotRunning: the restart fault of a Core in its own capture (G75b-03, D217 (5))', () => {
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

describe('3. the generator holds its integrity rows while a start is not decided (G75b-10)', () => {
  it('a FAILED start of the simulated lane has no FRAME_HASH / WRITE_VERIFIED / TIMESTAMP_CONFIRMED row at all', () => {
    const h = bed({ captureConnectMs: 30_000 });
    h.armed();
    h.sim.actions.startRecording();
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-01' });
    h.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' });
    h.run(29_000);
    expect(h.state().session).toMatchObject({ state: 'RECORDING', captureDurable: false });
    expect(h.integrityRows()).toEqual([]);
    h.run(10_000);
    expect(h.state().session).toMatchObject({ state: 'FAULT', captureDurable: false, startedAt: null });
    expect(h.integrityRows()).toEqual([]);
  });

  it('CONTROL - a start that happened has the same rows, each at its own time, whatever the connecting time was', () => {
    const rowsAfter = (captureConnectMs: number): string[] => {
      const h = bed({ captureConnectMs });
      h.armed();
      h.sim.actions.startRecording();
      h.run(60_000);
      expect(h.state().session?.state).toBe('RECORDING');
      expect(h.state().session).not.toHaveProperty('captureDurable');
      return h.integrityRows();
    };
    const immediate = rowsAfter(0);
    expect(immediate.length).toBeGreaterThan(2);
    expect(rowsAfter(30_000)).toEqual(immediate);
    expect(rowsAfter(1_000)).toEqual(immediate);
  });
});

describe('7. a refused start carries its reason to the client (`503 NOT_READY`, `details.reason`)', () => {
  it('the rebuilt error holds the Core\'s reason code; the reader names the two session-key refusals and nothing else', async () => {
    const { START_REFUSED_SESSION_KEY_EXAMPLE } = await import('../src/api');
    const { START_REFUSED_REASONS, startRefusedReasonOf } = await import('../src/sim');
    const { LiveTransportError } = await import('../src/live');
    const { rebuildRefusal } = await import('../src/live/source/rebuild-error');
    const failure = (details: Record<string, unknown> | undefined) =>
      ({
        ok: false,
        status: START_REFUSED_SESSION_KEY_EXAMPLE.status,
        kind: 'NOT_READY',
        transport: 'CORE_OFFLINE',
        retryAfterSeconds: null,
        requestId: 'req-1',
        error: { code: START_REFUSED_SESSION_KEY_EXAMPLE.code, message: 'refused', ...(details === undefined ? {} : { details }) },
      }) as unknown as Parameters<typeof rebuildRefusal>[0];
    const context = { action: 'startRecording', operationId: 'startSession', entity: null, sessionState: 'ARMED' };

    for (const reason of START_REFUSED_REASONS) {
      const error = rebuildRefusal(failure({ reason }), context);
      expect(error).toBeInstanceOf(LiveTransportError);
      expect((error as InstanceType<typeof LiveTransportError>).detailReason).toBe(reason);
      expect(startRefusedReasonOf(error)).toBe(reason);
      expect(en.common.startRefused[reason]).toMatch(/^This session cannot be started: .*Nothing was recorded\./);
    }
    expect(startRefusedReasonOf(rebuildRefusal(failure(START_REFUSED_SESSION_KEY_EXAMPLE.details), context))).toBe('SESSION_KEY_NOT_OF_SESSION');
    // NEGATIVE CONTROLS: a Core that is starting, another reason, a value that is no code.
    expect(startRefusedReasonOf(rebuildRefusal(failure(undefined), context))).toBeNull();
    expect(startRefusedReasonOf(rebuildRefusal(failure({ reason: 'CAPTURE_HELPERS_LEFT' }), context))).toBeNull();
    expect((rebuildRefusal(failure({ reason: 'not a code; DROP' }), context) as InstanceType<typeof LiveTransportError>).detailReason).toBeNull();
  });

  it('6. the shared development-source sentence is the ruled wording', () => {
    expect(en.common.captureConnect.noPasswordNeeded).toBe('A development source can be tested without a password. If the test asks for one, turn on "Enter a user name and password".');
  });
});
