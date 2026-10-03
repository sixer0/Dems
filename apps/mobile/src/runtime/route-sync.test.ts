// T-M06 (04_mobile_specs §3.7; MA-08): the state-routed resync table, row by row, plus the
// forced-transition rule and the table applied to the real simulator's states.
import { describe, expect, it } from '@jest/globals';
import type { SessionState } from '@dems/shared/domain';
import { selectPendingSummaryId } from '@dems/shared/sim';
import { hrefPath, isForcedTransition, resyncNavigation, resyncTarget } from './route-sync';
import { selectActiveSessionInfo } from './sim-runtime-provider';
import { createTestSim } from './testing/test-sim';

describe('resyncTarget: the §3.7 table', () => {
  it.each<[string, SessionState | null, { sessionId?: string | null; summaryAcknowledged?: boolean }, string | null]>([
    ['no session', null, {}, null],
    ['SEALED, summary acknowledged', 'SEALED', { sessionId: 'SES-20261001-0024', summaryAcknowledged: true }, null],
    ['CREATE', 'CREATE', { sessionId: 'SES-20261001-0024' }, '/session/new?step=1'],
    ['PRECHECK', 'PRECHECK', { sessionId: 'SES-20261001-0024' }, '/session/new?step=2'],
    ['ARMED', 'ARMED', { sessionId: 'SES-20261001-0024' }, '/session/new?step=3'],
    ['RECORDING', 'RECORDING', { sessionId: 'SES-20261001-0024' }, '/session/live'],
    ['STOPPING', 'STOPPING', { sessionId: 'SES-20261001-0024' }, '/session/finalizing'],
    ['FINALIZING', 'FINALIZING', { sessionId: 'SES-20261001-0024' }, '/session/finalizing'],
    [
      'SEALED, summary not acknowledged',
      'SEALED',
      { sessionId: 'SES-20261001-0024', summaryAcknowledged: false },
      '/session/summary/SES-20261001-0024',
    ],
    ['FAULT', 'FAULT', { sessionId: 'SES-20261001-0024' }, '/session/recovery'],
    ['RECOVERY', 'RECOVERY', { sessionId: 'SES-20261001-0024' }, '/session/recovery'],
  ])('%s → %s', (_name, state, context, target) => {
    expect(resyncTarget(state, context)).toBe(target);
  });

  it('treats an unknown acknowledgement as acknowledged, so an idle app never jumps to an old summary', () => {
    expect(resyncTarget('SEALED', { sessionId: 'SES-20261001-0024' })).toBeNull();
  });
});

describe('isForcedTransition (§3.7 trigger 3)', () => {
  it.each<[SessionState | null, SessionState | null, boolean]>([
    ['STOPPING', 'FINALIZING', true],
    ['FINALIZING', 'SEALED', true],
    ['RECORDING', 'FAULT', true],
    ['PRECHECK', 'FAULT', true],
    ['FINALIZING', 'FAULT', true],
    // Never yank the operator otherwise (the live mini-bar shows instead).
    [null, 'RECORDING', false],
    ['ARMED', 'RECORDING', false],
    ['RECORDING', 'STOPPING', false],
    ['RECORDING', 'FINALIZING', false],
    ['FAULT', 'RECOVERY', false],
    ['RECOVERY', null, false],
    ['SEALED', null, false],
    ['RECORDING', 'RECORDING', false],
    ['FAULT', 'FAULT', false],
  ])('%s → %s forces navigation: %s', (prev, next, forced) => {
    expect(isForcedTransition(prev, next)).toBe(forced);
  });
});

describe('resyncNavigation', () => {
  it('navigates only when the current path is not the target path', () => {
    expect(resyncNavigation('/evidence', 'RECORDING', { sessionId: 'S' })).toBe('/session/live');
    expect(resyncNavigation('/session/live', 'RECORDING', { sessionId: 'S' })).toBeNull();
    expect(resyncNavigation('/session/new', 'PRECHECK', { sessionId: 'S' })).toBeNull();
    expect(resyncNavigation('/home', null)).toBeNull();
    expect(hrefPath('/session/new?step=2')).toBe('/session/new');
  });
});

describe('the table applied to the simulator (MA-08 unit form)', () => {
  const targetOf = (sim: ReturnType<typeof createTestSim>['sim']) => {
    const info = selectActiveSessionInfo(sim.store.getState());
    return resyncTarget(info.state, info);
  };

  it('recording → monitor; stop → finalizing → sealed summary → acknowledged', () => {
    const { sim, advance } = createTestSim();
    sim.actions.signIn('budi.santoso', 'demo-2026');
    sim.actions.loadScenario('recording');
    const id = sim.store.getState().session!.id;
    expect(id).toBe('SES-20261001-0024');
    expect(targetOf(sim)).toBe('/session/live');

    sim.actions.stopRecording('Interview complete');
    expect(sim.store.getState().session?.state).toBe('STOPPING');
    expect(targetOf(sim)).toBe('/session/finalizing');

    advance(10_000); // SEALED ≤ 8.7 s after the stop (13_sim_engine §2.2)
    expect(sim.store.getState().session?.state).toBe('SEALED');
    expect(selectPendingSummaryId(sim.store.getState())).toBe(id);
    expect(targetOf(sim)).toBe(`/session/summary/${id}`);

    sim.actions.acknowledgeSummary(id);
    expect(targetOf(sim)).toBeNull();
  });

  it('a critical fault → recovery; recovery ends with no session', () => {
    const { sim, advance } = createTestSim();
    sim.actions.loadScenario('recording');
    sim.actions.inject('POWER_FAIL');
    expect(sim.store.getState().session?.state).toBe('FAULT');
    expect(targetOf(sim)).toBe('/session/recovery');
    sim.actions.recover();
    expect(targetOf(sim)).toBe('/session/recovery');
    advance(4_000);
    expect(sim.store.getState().session).toBeNull();
    expect(targetOf(sim)).toBeNull();
  });
});
