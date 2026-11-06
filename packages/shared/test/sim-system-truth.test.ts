// `sim/system-truth.ts` (fix wave J; decision D243; truth rule 3c; findings JT-01, JW-05, JA2-04): the ONE
// statement of system state for every surface that says it at a glance. Each case that says "not READY" has
// its control: the SAME state without the fact reads READY and "all operational".
import { describe, expect, it } from 'vitest';
import {
  CORE_LINK_LOST_SENTENCE,
  CaptureNoticeReason,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  SEAL_BLOCKED_EXAMPLE_SESSION_ID,
  SEAL_RETRYING_EXAMPLE_FINALIZATION,
  SEAL_UNSEALABLE_EXAMPLE_ALERT,
  SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED,
  SYSTEM_FACT_CORE_LINK_LOST,
  SYSTEM_FACT_SEAL_RETRYING,
  SYSTEM_STATE_UNKNOWN,
  injectFaultTransition,
  raiseCaptureNoticeTransition,
  clearCaptureNoticeTransition,
  systemStatus,
  systemTruthFactsOf,
  systemTruthOf,
  type ActiveSession,
  type SimState,
} from '../src/sim';
import * as ownCaptureBed from './support/own-capture-bed';

const { bed, START } = ownCaptureBed;

/** A real-capture simulator at rest: READY, nothing to say. */
function rest(): SimState {
  const h = bed({ capture: 'external' });
  h.run(2_000);
  return h.state();
}

/** The same state with a session whose seal is in the given finalization. */
function finalizing(state: SimState, finalization: ActiveSession['finalization']): SimState {
  const h = bed({ capture: 'external' });
  h.armed();
  h.sim.actions.startRecording();
  h.run(3_000);
  const open = h.state().session as ActiveSession;
  return { ...state, session: { ...open, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization } };
}

describe('systemTruthOf: one statement of system state', () => {
  it('CONTROL - at rest with no fact: READY, severity OK, and only then "all operational"', () => {
    const truth = systemTruthOf(rest());
    expect(truth).toMatchObject({ state: 'READY', severity: 'OK', facts: [], allOperational: true });
    expect(truth.flags).toEqual(systemStatus(rest()).flags);
  });

  it('JT-01 (b) / JW-05: a capture source that does not answer - the alert is a fact, the state is ATTENTION, and nothing says "all operational"', () => {
    // A setup is open (the pre-check is what finds the source): "Go to Home, keep the session open" is where the tablet said READY.
    const open = bed({ capture: 'external' });
    open.armed();
    expect(systemTruthOf(open.state())).toMatchObject({ state: 'READY', allOperational: true, facts: [] });
    const state = raiseCaptureNoticeTransition(open.state(), START + 9_000, { code: CaptureNoticeReason.CAPTURE_DEVICE_UNREACHABLE, subject: 'CAM-02', phase: 'PRECHECK', degraded: true, searchResponderCount: 1 });
    // The flag derivation alone still says READY: that is the defect the reader closes.
    expect(systemStatus(state).state).toBe('READY');
    const truth = systemTruthOf(state);
    expect(truth).toMatchObject({ state: 'ATTENTION', severity: 'WARNING', allOperational: false });
    expect(truth.facts).toEqual([expect.objectContaining({ id: 'CAPTURE_DEVICE_UNREACHABLE', severity: 'WARNING', target: 'CAM-02', blocksRecording: null })]);
    expect(truth.facts[0]?.alertId).toMatch(/^ALR-/);
    // When the source answers again and the Core clears its notice, the statement is READY again - at once.
    const cleared = clearCaptureNoticeTransition(state, START + 12_000, { code: CaptureNoticeReason.CAPTURE_DEVICE_UNREACHABLE, subject: 'CAM-02', phase: 'PRECHECK' });
    expect(systemTruthOf(cleared)).toMatchObject({ state: 'READY', allOperational: true, facts: [] });
  });

  it('JT-01 (a): a seal that failed and is being retried is ATTENTION from the first failure - no alert exists for it', () => {
    const state = finalizing(rest(), SEAL_RETRYING_EXAMPLE_FINALIZATION);
    const truth = systemTruthOf(state);
    expect(truth.state).toBe('ATTENTION');
    expect(truth.allOperational).toBe(false);
    expect(truth.facts).toEqual([expect.objectContaining({ id: SYSTEM_FACT_SEAL_RETRYING, severity: 'WARNING', target: SEAL_BLOCKED_EXAMPLE_SESSION_ID, alertId: null })]);
    expect(truth.facts[0]?.message).toContain('retried');
    expect(systemTruthFactsOf(state)).toEqual(truth.facts);
  });

  it('JT-01 (a): a BLOCKED seal is CRITICAL - the Core takes no new session - and it is not also counted as a retry', () => {
    const state = { ...finalizing(rest(), SEAL_BLOCKED_EXAMPLE_FINALIZATION), alerts: [SEAL_BLOCKED_EXAMPLE_ALERT] };
    const truth = systemTruthOf(state);
    expect(truth).toMatchObject({ state: 'CRITICAL', severity: 'CRITICAL', allOperational: false });
    expect(truth.facts.map((fact) => [fact.id, fact.severity, fact.blocksRecording])).toEqual([['SEAL_BLOCKED', 'CRITICAL', true]]);
  });

  it('an unsealable recording that nobody acknowledged: a fact, ATTENTION - never CRITICAL (the Core says recording is not blocked) - and gone once resolved', () => {
    const open = systemTruthOf({ ...rest(), alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] });
    expect(open).toMatchObject({ state: 'ATTENTION', severity: 'WARNING', allOperational: false });
    expect(open.facts).toEqual([expect.objectContaining({ id: 'UNSEALABLE', severity: 'CRITICAL', blocksRecording: false })]);
    expect(systemTruthOf({ ...rest(), alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED] })).toMatchObject({ state: 'READY', allOperational: true, facts: [] });
  });

  it('JA2-04: a client whose link to the Core is lost knows nothing - UNKNOWN, never READY, whatever its stale replica holds', () => {
    const stale = rest();
    expect(systemTruthOf(stale).state).toBe('READY');
    const lost = systemTruthOf(stale, { coreLinkLost: true });
    expect(lost).toMatchObject({ state: SYSTEM_STATE_UNKNOWN, severity: SYSTEM_STATE_UNKNOWN, allOperational: false });
    expect(lost.facts).toEqual([{ id: SYSTEM_FACT_CORE_LINK_LOST, severity: 'CRITICAL', message: CORE_LINK_LOST_SENTENCE, target: null, alertId: null, blocksRecording: null }]);
    expect(CORE_LINK_LOST_SENTENCE).toBe('Core offline — state unknown');
    expect(systemTruthOf(stale, { coreLinkLost: false }).state).toBe('READY');
  });

  it('the flags keep their meaning: a fault of the flag set is still CRITICAL / ATTENTION, and an alert of a FAULT kind is not counted twice as a fact', () => {
    const h = bed();
    h.run(1_000);
    const full = injectFaultTransition(h.state(), START + 2_000, 'STORAGE_FULL');
    const truth = systemTruthOf(full);
    expect(truth.state).toBe('CRITICAL');
    expect(truth.flags.map((flag) => flag.id)).toContain('STORAGE_FULL');
    expect(truth.facts).toEqual([]);
    // An INFO notice and an alert that is not active are no fact.
    const info = { ...SEAL_UNSEALABLE_EXAMPLE_ALERT, severity: 'INFO' as const, params: { reason: 'STREAM_PROFILE_DIFFERS' } };
    expect(systemTruthOf({ ...rest(), alerts: [info, { ...SEAL_BLOCKED_EXAMPLE_ALERT, active: false }] })).toMatchObject({ state: 'READY', facts: [] });
  });

  it('a RECORDING state stays RECORDING with a warning fact, and the severity tells the rest', () => {
    const h = bed({ capture: 'external' });
    h.armed();
    h.sim.actions.startRecording();
    h.run(3_000);
    expect(h.state().session?.state).toBe('RECORDING');
    const state = raiseCaptureNoticeTransition(h.state(), START + 20_000, { code: CaptureNoticeReason.CAPTURE_DEVICE_UNREACHABLE, subject: 'MIC-02', phase: 'SESSION_START', degraded: true });
    const truth = systemTruthOf(state);
    expect([truth.state, truth.severity, truth.allOperational]).toEqual(['RECORDING', 'WARNING', false]);
  });
});
