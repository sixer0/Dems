// Pairing model (step 76; 04_mobile_specs §4.2): timeline phases, view state, C-4 statuses, the
// lockout countdown on the simulator clock and the flat selectors (F74-13).
import { describe, expect, it } from '@jest/globals';
import { DEVICE_ID, PairingState, type SimState } from '@dems/shared/sim';
import { createTestSim } from '@/runtime/testing/test-sim';
import {
  PAIR_TIMELINE,
  fingerprintLines,
  leaveTargetFor,
  lockSecondsAt,
  outcomeOf,
  pairingViewFor,
  phaseAt,
  ringStateFor,
  selectLastPairingAudit,
  selectLockSeconds,
  selectReportedCoreDeviceId,
  selectReportedCoreDeviceIdLive,
  stateChipFor,
  stepStatusesFor,
} from './pairing-model';

describe('pairing model', () => {
  it('phases: Discover, then Verify, then the commit at 1.8 s (simulator ms)', () => {
    expect(phaseAt(-5)).toBe('discover');
    expect(phaseAt(0)).toBe('discover');
    expect(phaseAt(PAIR_TIMELINE.verifyAt - 1)).toBe('discover');
    expect(phaseAt(PAIR_TIMELINE.verifyAt)).toBe('verify');
    expect(phaseAt(PAIR_TIMELINE.commitAt - 1)).toBe('verify');
    expect(phaseAt(PAIR_TIMELINE.commitAt)).toBe('commit');
  });

  it('outcomes map the simulator result without the code', () => {
    expect(outcomeOf({ ok: true, pairedAt: 42 })).toEqual({ kind: 'paired', pairedAt: 42 });
    expect(outcomeOf({ ok: false, reason: 'INVALID_CODE', attemptsRemaining: 2 })).toEqual({ kind: 'invalid', attemptsRemaining: 2 });
    expect(outcomeOf({ ok: false, reason: 'LOCKED', lockedUntil: 9, retryInMs: 60_000 })).toEqual({ kind: 'locked' });
  });

  it('view: in-flight wins, then PAIRED, then the lockout, then a rejected code', () => {
    const base = { simState: PairingState.UNPAIRED, phase: null, lockSeconds: 0, outcome: null };
    expect(pairingViewFor(base)).toBe('unpaired');
    expect(pairingViewFor({ ...base, phase: 'verify' })).toBe('pairing');
    expect(pairingViewFor({ ...base, simState: PairingState.PAIRED })).toBe('paired');
    expect(pairingViewFor({ ...base, simState: PairingState.FAILED, lockSeconds: 12, outcome: { kind: 'locked' } })).toBe('locked');
    expect(pairingViewFor({ ...base, simState: PairingState.FAILED, outcome: { kind: 'invalid', attemptsRemaining: 1 } })).toBe('failed');
    // An expired lockout returns to the plain prompt.
    expect(pairingViewFor({ ...base, simState: PairingState.FAILED, outcome: { kind: 'locked' } })).toBe('unpaired');
  });

  it('C-4 statuses, C-1 ring and the state chip per view', () => {
    expect(stepStatusesFor('unpaired', null)).toEqual(['active', 'pending', 'pending']);
    expect(stepStatusesFor('pairing', 'discover')).toEqual(['running', 'pending', 'pending']);
    expect(stepStatusesFor('pairing', 'verify')).toEqual(['done', 'running', 'pending']);
    expect(stepStatusesFor('paired', null)).toEqual(['done', 'done', 'done']);
    expect(stepStatusesFor('failed', null)).toEqual(['done', 'error', 'pending']);
    expect(stepStatusesFor('locked', null)).toEqual(['done', 'warn', 'pending']);
    expect(ringStateFor('paired')).toBe('ready');
    expect(ringStateFor('locked')).toBe('critical');
    expect(ringStateFor('unpaired')).toBe('attention');
    expect(stateChipFor('pairing', PairingState.UNPAIRED)).toEqual({ key: 'mobile.pairing.state.PAIRING', tone: 'accent' });
    expect(stateChipFor('locked', PairingState.FAILED)).toEqual({ key: 'common.pairingState.FAILED', tone: 'danger' });
    expect(stateChipFor('paired', PairingState.PAIRED).tone).toBe('success');
  });

  it('lockout seconds round up on the simulator clock and stop at 0', () => {
    expect(lockSecondsAt(null, 1_000)).toBe(0);
    expect(lockSecondsAt(61_000, 1_000)).toBe(60);
    expect(lockSecondsAt(61_000, 1_001)).toBe(60);
    expect(lockSecondsAt(61_000, 60_001)).toBe(1);
    expect(lockSecondsAt(61_000, 61_000)).toBe(0);
  });

  it('selectors read the simulator: lockout countdown and the newest PAIRING audit row as a flat tuple', () => {
    const test = createTestSim({ initialPairing: PairingState.UNPAIRED });
    const { sim } = test;
    expect(selectLastPairingAudit(sim.store.getState())).toBeNull();
    sim.actions.pair('000000');
    sim.actions.pair('000001');
    sim.actions.pair('000002');
    const state = sim.store.getState();
    const last = selectLastPairingAudit(state);
    expect(last?.[1]).toBe('PAIRING_FAILED');
    expect(last?.[0]).toBe(state.audit.rows[state.audit.rows.length - 1]?.seq);
    expect(selectLockSeconds(state)).toBe(60);
    test.advance(30_000);
    expect(selectLockSeconds(sim.store.getState())).toBe(30);
    test.advance(30_000);
    expect(selectLockSeconds(sim.store.getState())).toBe(0);
  });

  it('fingerprint splits into two mono lines; leave target follows the stack', () => {
    const fp = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';
    expect(fingerprintLines(fp)).toEqual(['AA:BB:CC:DD:EE:FF:00:11', '22:33:44:55:66:77:88:99']);
    expect(fingerprintLines('AA:BB')).toEqual(['AA:BB']);
    expect(leaveTargetFor(true)).toBe('back');
    expect(leaveTargetFor(false)).toBe('boot');
  });

  it('row FX-M1 (E2E-S-1): the signed-out hand-off always goes to the boot router; Cancel and the signed-in hand-off follow the stack', () => {
    // [canGoBack, reason, signedIn, target]
    const table: [boolean, 'handoff' | 'cancel', boolean, 'back' | 'boot'][] = [
      [true, 'handoff', false, 'boot'], // the phone of E2E-S-1: Stack Check underneath, Login is the target
      [false, 'handoff', false, 'boot'],
      [true, 'handoff', true, 'back'], // Settings → Security → Pair: back to Settings
      [false, 'handoff', true, 'boot'],
      [true, 'cancel', false, 'back'], // Cancel goes back to Login (the trust line) or wherever it came from
      [false, 'cancel', false, 'boot'],
      [true, 'cancel', true, 'back'],
      [false, 'cancel', true, 'boot'],
    ];
    for (const [canGoBack, reason, signedIn, target] of table) {
      expect([canGoBack, reason, signedIn, leaveTargetFor(canGoBack, reason, signedIn)]).toEqual([canGoBack, reason, signedIn, target]);
    }
  });

  // M3-10 R1 (row 200; register I6, rule S9 of row 105, row 199's reader; D72, D159, D205): the Core id the pairing card shows.
  it('I6: the reserved id reads null ("Not reported") on a LIVE link and on an own-capture Core; any other id as it is; the simulated lane keeps DEMS-IR-01', () => {
    const base = createTestSim({ initialPairing: PairingState.PAIRED }).sim.store.getState();
    const withId = (id: string, own: 'none' | 'hostClock' | 'platformNotReported' = 'none'): SimState => ({
      ...base,
      pairing: { ...base.pairing, coreDeviceId: id },
      // The seed state is not in its own capture (the CONTROL below holds it); a case only adds the marker.
      time: own === 'hostClock' ? { ...base.time, hostClock: true as const } : base.time,
      security: own === 'platformNotReported' ? { ...base.security, platformNotReported: true as const } : base.security,
    });
    expect(DEVICE_ID).toBe('DEMS-IR-01');
    // CONTROL: the simulated lane keeps the dataset's id (the existing pins of pairing-screen.test.tsx).
    expect(base.pairing.coreDeviceId).toBe(DEVICE_ID);
    expect(selectReportedCoreDeviceId(withId(DEVICE_ID))).toBe(DEVICE_ID);
    // LIVE (no own-capture marker before sign-in, D205): the reserved id is not reported; another id as it is.
    expect(selectReportedCoreDeviceIdLive(withId(DEVICE_ID))).toBeNull();
    expect(selectReportedCoreDeviceIdLive(withId('DEMS-BENCH-01'))).toBe('DEMS-BENCH-01');
    // S9 on the simulated lane: a state in its own capture (host clock, or no platform read) does not report the reserved id.
    expect(selectReportedCoreDeviceId(withId(DEVICE_ID, 'hostClock'))).toBeNull();
    expect(selectReportedCoreDeviceId(withId(DEVICE_ID, 'platformNotReported'))).toBeNull();
    expect(selectReportedCoreDeviceId(withId('DEMS-BENCH-01', 'hostClock'))).toBe('DEMS-BENCH-01');
    // LIVE before pairing: the tablet holds no Core id, and none is invented.
    expect(selectReportedCoreDeviceIdLive(withId(''))).toBe('');
  });
});
