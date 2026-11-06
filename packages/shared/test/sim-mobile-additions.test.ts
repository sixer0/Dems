// Mobile additions (SCR-02; 04_mobile_specs.md §3.7, §4.2, §4.7-§4.9, §4.12, §6.3):
// pairing with audit rows and lockout, biometric sign-in, lastSealedSessionId +
// acknowledgeSummary, sessionHistory including incomplete sessions, the tabletLink input.
import { describe, expect, it } from 'vitest';
import {
  createManualClock,
  createSim,
  DEMO_PAIRING_CODE,
  selectEvidenceStats,
  selectLastSealedSession,
  selectPendingSummaryId,
  selectSessionHistory,
  selectSystemState,
  type SessionCreateInput,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB
const INPUT: SessionCreateInput = {
  caseNumber: 'LP/2026/1001-0008',
  subjectType: 'TERSANGKA',
  subjectName: 'Mobile Tersangka',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
};

function harness(initialPairing: 'PAIRED' | 'UNPAIRED' = 'PAIRED') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, initialPairing });
  const run = (ms: number, step = 50) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const state = () => sim.store.getState();
  const rows = (type: string) => state().audit.rows.filter((row) => row.type === type);
  const record = () => {
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(5_000);
    sim.actions.startRecording();
    run(15_000);
  };
  return { sim, clock, run, state, rows, record };
}

describe('pairing (§4.2: 3 failures → 60 s lockout, audited, the code never stored)', () => {
  it('starts UNPAIRED on request, pairs with the demo code, and audits every attempt', () => {
    const h = harness('UNPAIRED');
    expect(h.state().pairing).toMatchObject({ state: 'UNPAIRED', pairedAt: null });
    expect(h.sim.actions.pair('000000')).toEqual({ ok: false, reason: 'INVALID_CODE', attemptsRemaining: 2 });
    expect(h.state().pairing.state).toBe('FAILED');
    expect(h.sim.actions.pair('12345')).toEqual({ ok: false, reason: 'INVALID_CODE', attemptsRemaining: 1 });
    expect(h.sim.actions.pair('111111')).toEqual({ ok: false, reason: 'LOCKED', lockedUntil: START + 60_000, retryInMs: 60_000 });
    expect(h.rows('PAIRING_FAILED')).toHaveLength(3);
    expect(h.rows('PAIRING_FAILED').at(-1)?.details).toMatchObject({ lockedUntil: START + 60_000 });

    // Even the right code is rejected while locked; each attempt writes PAIRING_LOCKED.
    h.clock.advance(30_000);
    expect(h.sim.actions.pair(DEMO_PAIRING_CODE)).toMatchObject({ ok: false, reason: 'LOCKED', retryInMs: 30_000 });
    expect(h.rows('PAIRING_LOCKED')).toHaveLength(1);

    h.clock.advance(30_000);
    expect(h.sim.actions.pair(DEMO_PAIRING_CODE)).toEqual({ ok: true, pairedAt: START + 60_000 });
    expect(h.state().pairing).toMatchObject({ state: 'PAIRED', pairedAt: START + 60_000, failures: [], lockedUntil: null });
    expect(h.rows('PAIRING_SUCCESS')).toHaveLength(1);
    expect(h.rows('PAIRING_SUCCESS')[0]).toMatchObject({ category: 'PAIRING', deviceId: 'TABLET' });
    expect(JSON.stringify(h.state())).not.toContain(DEMO_PAIRING_CODE);
  });

  it('pair() while paired is a quiet success; unpair() writes UNPAIRED once', () => {
    const h = harness('PAIRED');
    const pairedAt = h.state().pairing.pairedAt;
    const total = h.state().audit.total;
    expect(h.sim.actions.pair('999999')).toEqual({ ok: true, pairedAt });
    expect(h.state().audit.total).toBe(total);
    h.sim.actions.unpair();
    h.sim.actions.unpair();
    expect(h.state().pairing).toMatchObject({ state: 'UNPAIRED', pairedAt: null });
    expect(h.rows('UNPAIRED')).toHaveLength(1);
  });
});

describe('biometric sign-in (§6.3)', () => {
  it('signInWithBiometric writes AUTH_SUCCESS with method BIOMETRIC; a failed prompt counts toward the lockout', () => {
    const h = harness();
    expect(h.sim.actions.recordBiometricFailure('OPR-001')).toMatchObject({ ok: false, attemptsRemaining: 4 });
    expect(h.sim.actions.signInWithBiometric('OPR-001')).toMatchObject({ ok: true, method: 'BIOMETRIC', role: 'INVESTIGATOR' });
    expect(h.rows('AUTH_SUCCESS').at(-1)).toMatchObject({ actorId: 'OPR-001', details: { method: 'BIOMETRIC' } });
  });
});

describe('lastSealedSessionId + acknowledgeSummary (§3.7 route-sync, §4.7)', () => {
  it('a seal leaves a pending summary until it is acknowledged, once', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    expect(selectPendingSummaryId(h.state())).toBeNull();
    h.record();
    h.sim.actions.stopRecording('Interview completed');
    h.run(12_000);
    const id = h.state().session?.id ?? '';
    expect(h.state().session?.state).toBe('SEALED');
    expect(selectPendingSummaryId(h.state())).toBe(id);
    expect(selectLastSealedSession(h.state())).toMatchObject({ id, outcome: 'SEALED', evidenceId: 'EV-20261001-0014' });

    h.sim.actions.acknowledgeSummary('SES-19700101-0001'); // another ID: no-op
    expect(selectPendingSummaryId(h.state())).toBe(id);
    h.sim.actions.acknowledgeSummary(id);
    h.sim.actions.acknowledgeSummary(id);
    expect(selectPendingSummaryId(h.state())).toBeNull();
    expect(h.rows('SUMMARY_ACKNOWLEDGED')).toHaveLength(1);
    expect(h.rows('SUMMARY_ACKNOWLEDGED')[0]).toMatchObject({ sessionId: id, actorId: 'OPR-001' });
    // The session stays SEALED (route-sync: "SEALED with the summary acknowledged → stay").
    expect(h.state().session?.state).toBe('SEALED');
  });

  it('creating the next session acknowledges a pending summary implicitly', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.record();
    h.sim.actions.stopRecording('Interview completed');
    h.run(12_000);
    h.sim.actions.createSession({ ...INPUT, subjectName: 'Next Subject' });
    expect(selectPendingSummaryId(h.state())).toBeNull();
  });
});

describe('sessionHistory includes incomplete sessions (§4.8, §4.9)', () => {
  it('a POWER_FAIL during recording → FAULT → recover → INCOMPLETE entry with a RECORDED, unsealed evidence item', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.record();
    const id = h.state().session?.id ?? '';
    h.sim.actions.inject('POWER_FAIL');
    expect(h.state().session?.state).toBe('FAULT');
    expect(selectSystemState(h.state()).state).toBe('CRITICAL');
    h.sim.actions.recover();
    // The reboot restores power: POWER_FAIL clears itself; SYSTEM_BOOT precedes RECOVERY_STARTED.
    expect(h.state().faults.active).toEqual([]);
    const types = h.state().audit.rows.map((row) => row.type);
    expect(types.lastIndexOf('SYSTEM_BOOT')).toBeLessThan(types.lastIndexOf('RECOVERY_STARTED'));
    h.run(3_100);
    const history = selectSessionHistory(h.state());
    expect(history[0]).toMatchObject({ id, outcome: 'INCOMPLETE', faultKind: 'POWER_FAIL' });
    expect(history[0]?.durationMs).toBeGreaterThan(14_000);
    expect(history[0]?.evidenceId).toBe('EV-20261001-0014');
    const item = h.state().evidence.find((entry) => entry.sessionId === id);
    expect(item).toMatchObject({ status: 'RECORDED', sealedAt: null });
    expect(selectEvidenceStats(h.state())).toMatchObject({ pending: 2, sealedToday: 7 });
    expect(history.filter((entry) => entry.outcome === 'INCOMPLETE')).toHaveLength(2);
    // Newest first, and the canonical history is still there.
    expect(history).toHaveLength(14);
  });

  it('a fault before recording started leaves an INCOMPLETE entry without evidence', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    h.sim.actions.inject('TPM_FAILURE');
    h.sim.actions.recover();
    h.run(3_100);
    expect(selectSessionHistory(h.state())[0]).toMatchObject({ outcome: 'INCOMPLETE', evidenceId: null, startedAt: null, durationMs: 0 });
    expect(h.state().evidence).toHaveLength(13);
  });
});

describe('the tabletLink input (§4.12, §5.6, MA-10)', () => {
  it('OFFLINE marks the TABLET row, flags ATTENTION and blocks the Core check of a new precheck', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.sim.actions.setTabletLink('OFFLINE');
    expect(h.state().otherDevices.find((device) => device.id === 'TABLET')).toMatchObject({ online: false, status: 'OFFLINE' });
    expect(selectSystemState(h.state()).flags.map((flag) => flag.id)).toContain('TABLET_OFFLINE');
    h.sim.actions.createSession(INPUT);
    h.sim.actions.beginPrecheck();
    h.run(5_000);
    expect(h.state().session?.precheck.items[0]).toMatchObject({ id: 'CORE', status: 'BLOCK', value: 'OFFLINE' });
    h.sim.actions.setTabletLink('CONNECTED');
    h.sim.actions.retryPrecheck();
    h.run(5_000);
    expect(h.state().session?.state).toBe('ARMED');
  });

  it('a link drop during recording never stops the recording (§5.6 "Core recording continues")', () => {
    const h = harness();
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.record();
    h.sim.actions.setTabletLink('OFFLINE');
    h.run(10_000);
    expect(h.state().session?.state).toBe('RECORDING');
    // Reconnect and resync: the same create input returns the same session, never a second one.
    h.sim.actions.setTabletLink('CONNECTED');
    expect(h.sim.actions.createSession(INPUT)).toEqual({ ok: true, sessionId: h.state().session?.id, created: false });
  });
});
