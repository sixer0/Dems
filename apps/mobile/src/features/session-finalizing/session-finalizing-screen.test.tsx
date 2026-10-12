// Finalization screen (step 80; 04_mobile_specs §4.6, §3.6, §3.7, §7.3; MA-29 finalize part).
// Renders the real `/session/finalizing` route on the real providers with a test simulator in the
// finalizing scenario (session 0024 stopped 1.6 s ago, step 1 running). Import order matters: the
// gorhom mock, then the router harness, then the flow harness.
import './testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { haptics, resetMotionStateForTests } from '@/motion';
import { resetStampedForTests } from '@/features/session-summary/stamp-once';
import { SEALED_HANDOFF_MS } from './finalizing.model';
import { advanceUntilSealed, renderFlowApp, settle, type FlowHarness } from './testing/flow-harness';
import {
  DEMO_OPERATOR_PASSWORD,
  OPERATORS,
  SEAL_BLOCKED_DETAIL_SENTENCE,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  SEAL_BLOCKED_EXAMPLE_SESSION_ID,
  SEAL_RECORDING_KEPT_SENTENCE,
  SEAL_RETRYING_EXAMPLE_FINALIZATION,
  sealAttentionOf,
  type ActiveSession,
  type SimAlert,
  OperatorRole,
  SEAL_AUTOMATIC_RETRIES,
  SEAL_RETRY_HOW_SENTENCE,
  SEAL_RETRY_PERMISSION,
  SEAL_UNSEALABLE_EXAMPLE_ALERT,
  SEAL_UNSEALABLE_EXAMPLE_SESSION_ID,
  SEAL_UNSEALABLE_PLAIN_SENTENCE,
  canRetryBlockedSeal,
  sealStoppedSentence,
} from '@dems/shared/sim';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('session finalizing screen', () => {
unmountBeforeTheHooksOfThisGroup();

beforeEach(() => {
  resetMissingKeys();
  resetStampedForTests();
});

afterEach(() => {
  resetMotionStateForTests();
  jest.restoreAllMocks();
});

type BackListener = Parameters<typeof BackHandler.addEventListener>[1];

/** Captures hardware-Back listeners so a test can press Back (newest first, as Android does). */
function spyHardwareBack() {
  const listeners: BackListener[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    listeners.push(handler);
    return { remove: () => void listeners.splice(listeners.indexOf(handler), 1) };
  });
  return () => {
    let consumed = false;
    act(() => {
      for (const listener of [...listeners].reverse()) {
        if (listener({} as Parameters<BackListener>[0])) {
          consumed = true;
          break;
        }
      }
    });
    return consumed;
  };
}

/** The pipeline step's accessibility label ("Step 2 of 6, Calculate hashes, in progress"). */
function stepLabel(index: number): string {
  return String(screen.getByTestId(`finalizing-pipeline-step-${index}`).props.accessibilityLabel);
}

/**
 * The percent the Core's state gives (blueprint row 87; the rule of operation 83): the mean of the step
 * percents, floored. Before row 87 the screen counted DONE steps only (0 %, 17 %, …); the two
 * assertions below now hold the Core's own percent, and still bound it by the number of DONE steps.
 */
function corePercent(steps: readonly { status: string; progress?: number }[]): number {
  const sum = steps.reduce((total, step) => total + (step.status === 'done' ? 100 : step.status === 'active' ? Math.min(99, Math.floor(step.progress ?? 0)) : 0), 0);
  return Math.floor(sum / steps.length);
}

describe('Finalization (04 §4.6)', () => {
  it('draws the card: title, mono session ID, progress, the six steps with step 1 running, and the session card', async () => {
    const h = renderFlowApp();
    await settle();
    expect(screen.getByTestId('screen-session-finalizing')).toBeTruthy();
    expect(screen.getByText('Finalizing evidence')).toBeTruthy();
    expect(screen.getByTestId('finalizing-session-id')).toHaveTextContent(h.sessionId!);
    const percentAtStart = corePercent(h.sim.store.getState().session!.finalization.steps);
    // No step is DONE yet: below the 16 % of one finished step.
    expect(percentAtStart).toBeLessThan(16);
    expect(screen.getByTestId('finalizing-progress')).toHaveTextContent(`${percentAtStart}% complete`);
    for (const label of [
      'Close tracks',
      'Finalize hashes',
      'Finalize transcript',
      'Build manifest',
      'Sign manifest',
      'Store sealed evidence package',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(stepLabel(0)).toBe('Step 1 of 6, Close tracks, in progress');
    expect(stepLabel(1)).toBe('Step 2 of 6, Finalize hashes, waiting');
    expect(screen.getByTestId('finalizing-keep-open')).toBeTruthy();
    // Session card: case, subject chip (sim code → Indonesian term), evidence ID assigned at FINALIZING.
    const state = h.sim.store.getState();
    expect(within(screen.getByTestId('finalizing-case')).getByText(state.session!.input.caseNumber)).toBeTruthy();
    expect(within(screen.getByTestId('finalizing-evidence')).getByText(state.session!.evidenceId!)).toBeTruthy();
    expect(screen.getByTestId('pane-finalization')).toBeTruthy();
    expect(screen.getByTestId('pane-session')).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });

  it('resolves the steps on the simulator clock: check, duration, progress', async () => {
    const h = renderFlowApp();
    await settle();
    const first = h.sim.store.getState().session!.finalization.steps[0]!;
    h.run(first.durationMs! + 100);
    expect(stepLabel(0)).toBe('Step 1 of 6, Close tracks, completed');
    expect(stepLabel(1)).toBe('Step 2 of 6, Finalize hashes, in progress');
    expect(screen.getByText(`${(first.durationMs! / 1000).toFixed(1)} s`)).toBeTruthy();
    const percentAfterFirst = corePercent(h.sim.store.getState().session!.finalization.steps);
    // One step is DONE and the second runs: from 16 % up to below 33 %.
    expect(percentAfterFirst).toBeGreaterThanOrEqual(16);
    expect(percentAfterFirst).toBeLessThan(33);
    expect(screen.getByTestId('finalizing-progress')).toHaveTextContent(`${percentAfterFirst}% complete`);
  });

  it('MA-29: FINALIZING → SEALED within 10 s, then the route sync opens the Summary with the violet SEALED stamp', async () => {
    const trigger = jest.spyOn(haptics, 'trigger');
    const h = renderFlowApp();
    await settle();
    act(() => advanceUntilSealed(h));
    const session = h.sim.store.getState().session!;
    expect(session.state).toBe('SEALED');
    expect(session.sealedAt! - session.stoppedAt!).toBeLessThanOrEqual(10_000);
    expect(h.app.getPathname()).toBe(`/session/summary/${h.sessionId}`);
    expect(screen.getByTestId('screen-session-summary')).toBeTruthy();
    expect(within(screen.getByTestId('summary-sealed')).getByText('SEALED')).toBeTruthy();
    expect(trigger.mock.calls.filter(([event]) => event === 'sealedStamp')).toHaveLength(1);
  });

  // CF2-A (RF-PH-3): sealed with the summary pending, the Finalizing route draws the Summary IN PLACE at once
  // (the D201 hand-over recipe); the route follows 1.2 s after the seal. Before, it showed the sealed card
  // ("Evidence sealed", "Opening the session summary…") until the route changed, which on the phones took up to
  // 2 s and cut in with an empty frame.
  it('without the route sync, draws the Summary in place at the seal and opens its route itself 1.2 s after it', async () => {
    const h = renderFlowApp({ routeSync: false });
    await settle();
    act(() => advanceUntilSealed(h));
    expect(h.app.getPathname()).toBe('/session/finalizing');
    expect(screen.getByTestId('screen-session-summary')).toBeTruthy();
    expect(within(screen.getByTestId('summary-sealed')).getByText('SEALED')).toBeTruthy();
    expect(screen.queryByText('Evidence sealed')).toBeNull();
    h.run(SEALED_HANDOFF_MS + 100);
    expect(h.app.getPathname()).toBe(`/session/summary/${h.sessionId}`);
    expect(screen.getByTestId('screen-session-summary')).toBeTruthy();
  });

  it('§3.6: Back while FINALIZING is consumed with "Finalizing — please wait" and changes nothing', async () => {
    const pressBack = spyHardwareBack();
    const h = renderFlowApp();
    await settle();
    expect(pressBack()).toBe(true);
    // The kit renders the toast plus a screen-reader status copy of it.
    expect((await screen.findAllByText('Finalizing — please wait')).length).toBeGreaterThan(0);
    expect(h.app.getPathname()).toBe('/session/finalizing');
    expect(h.sim.store.getState().session?.state).toBe('FINALIZING');
  });

  it('P7: a critical fault turns the running step red once and offers the Recovery status calmly', async () => {
    const h = renderFlowApp({ routeSync: false });
    await settle();
    act(() => h.sim.actions.inject('POWER_FAIL'));
    expect(h.sim.store.getState().session?.state).toBe('FAULT');
    expect(screen.getByTestId('finalizing-interrupted')).toBeTruthy();
    expect(screen.getByText('Finalization interrupted')).toBeTruthy();
    expect(screen.getByText(/^Power failure\. Recovery takes over/)).toBeTruthy();
    expect(stepLabel(0)).toBe('Step 1 of 6, Close tracks, interrupted');
    fireEvent.press(screen.getByTestId('finalizing-open-recovery'));
    expect(h.app.getPathname()).toBe('/session/recovery');
  });

  it('with no session, says so and offers Home', async () => {
    const h = renderFlowApp({ scenario: 'idle' });
    await settle();
    expect(screen.getByText('No finalization in progress')).toBeTruthy();
    fireEvent.press(screen.getByTestId('finalizing-idle-action'));
    expect(h.app.getPathname()).toBe('/home');
    expect(getMissingKeys()).toEqual([]);
  });

  it('tablet landscape puts the session card beside the 720 dp pipeline card', async () => {
    renderFlowApp({ window: 'tabletLandscape' });
    await settle();
    expect(screen.getByTestId('pane-finalization')).toBeTruthy();
    expect(screen.getByTestId('pane-session')).toBeTruthy();
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-i-c-seal-blocked.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave I, driver C - re-gate 75 finding G75b-02 (MAJOR; rulings D186 (1), D216): the tablet / phone
// Finalizing screen on a session whose seal is BLOCKED read "Finalizing evidence / 0% complete /
// Resumed after restart", said "Sealing runs on the Core and takes a few seconds. This screen closes
// by itself." and could not be left (Back did nothing).
//
// THE CONTRACT (`delegation_progress/contract_wave_i.md`, driver A1): no member was added. The one
// reading is `sealAttentionOf({ session, alerts })` of `@dems/shared/sim`; the payloads of these tests
// are the contract's OWN examples, imported and never retyped (controller lesson D208):
// `SEAL_BLOCKED_EXAMPLE_ALERT`, `SEAL_BLOCKED_EXAMPLE_FINALIZATION`, `SEAL_RETRYING_EXAMPLE_FINALIZATION`,
// `SEAL_BLOCKED_EXAMPLE_SESSION_ID`.
//
// Held here, on the REAL `/session/finalizing` route over a real test simulator:
//   BLOCKED   the screen states that sealing is blocked, the reason in the Core's words, that the
//             recording is kept on the Core, who resolves it and that the session stays open on the
//             Core; NO percentage, NO "Resumed after restart", NO "takes a few seconds / closes by
//             itself"; "Go to Home" and the hardware Back both leave;
//   RETRYING  the Core's retry sentence and the kept sentence; the screen can be left; no
//             "Resumed after restart" from an attempt count (contract note §4);
//   CONTROL   a seal that simply runs reads as before, and Back is still held ("please wait").
// Written RED. NOT proven here: a device and a Core whose seal is really blocked (re-drive list, note 134).
describe('a blocked seal', () => {
unmountBeforeTheHooksOfThisGroup();
beforeEach(() => resetMissingKeys());
afterEach(() => {
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
});

/** The open session becomes the contract's example session: FINALIZING with the example's steps (and alert). */
function coreSays(h: FlowHarness, finalization: ActiveSession['finalization'], alerts: readonly SimAlert[]): void {
  act(() =>
    h.sim.store.setState((s) => ({
      session: s.session === null ? null : { ...s.session, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization },
      alerts: [...s.alerts, ...alerts],
    })),
  );
}
const texts = (): string => JSON.stringify(screen.toJSON());
/** The live hardware-Back listeners, in the order they were added (the spy below keeps the list). */
type BackListener = Parameters<typeof BackHandler.addEventListener>[1];
const backListeners: BackListener[] = [];
beforeEach(() => {
  backListeners.length = 0;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backListeners.push(handler);
    return { remove: () => void backListeners.splice(backListeners.indexOf(handler), 1) } as ReturnType<typeof BackHandler.addEventListener>;
  });
});
afterEach(() => {
  jest.restoreAllMocks();
});
/** Presses the hardware Back the way Android does: the newest listener first; true = a listener consumed it. */
function hardwareBack(): boolean {
  let consumed = false;
  act(() => {
    for (const listener of [...backListeners].reverse()) {
      if (listener({} as never) === true) {
        consumed = true;
        break;
      }
    }
  });
  return consumed;
}

describe.each(['tabletLandscape', 'phonePortrait'] as const)('G75b-02 on %s: the Finalizing screen of a BLOCKED seal', (window) => {
  it('states blocked, the reason, that the recording is kept, who resolves it and that the session stays open - with no invented progress', async () => {
    const h = renderFlowApp({ window, routeSync: false });
    await settle();
    coreSays(h, SEAL_BLOCKED_EXAMPLE_FINALIZATION, [SEAL_BLOCKED_EXAMPLE_ALERT]);
    await settle();
    const attention = sealAttentionOf(h.sim.store.getState());
    expect(attention).toMatchObject({ kind: 'BLOCKED', sessionId: SEAL_BLOCKED_EXAMPLE_SESSION_ID, detail: 'SESSION_KEY_STORE_UNAVAILABLE' });
    if (attention === null || attention.kind !== 'BLOCKED' || attention.detail === null) throw new Error('the contract example must read BLOCKED with a detail');

    expect(screen.getByTestId('finalizing-title')).toHaveTextContent('Sealing is blocked');
    expect(screen.getByTestId('finalizing-session-id')).toHaveTextContent(SEAL_BLOCKED_EXAMPLE_SESSION_ID);
    const notice = screen.getByTestId('finalizing-seal-blocked');
    // The reason: the Core's own words (the alert's whole message, with what restores the seal) and the fixed sentence of the detail code.
    expect(notice).toHaveTextContent(new RegExp(escape(SEAL_BLOCKED_EXAMPLE_ALERT.message)));
    expect(notice).toHaveTextContent(new RegExp(escape(SEAL_BLOCKED_DETAIL_SENTENCE[attention.detail])));
    expect(notice).toHaveTextContent(new RegExp(escape(SEAL_RECORDING_KEPT_SENTENCE)));
    expect(screen.getByTestId('finalizing-seal-who')).toHaveTextContent(/technician or the administrator of the Core/);
    expect(screen.getByTestId('finalizing-seal-stays-open')).toHaveTextContent(/stays open on the Core/);
    expect(screen.getByTestId('finalizing-seal-stays-open')).toHaveTextContent(/Sealing blocked/);

    // Nothing invented: no percentage, no restart claim, no "few seconds", no "closes by itself".
    expect(screen.queryByTestId('finalizing-progress')).toBeNull();
    expect(screen.queryByTestId('finalizing-resumed')).toBeNull();
    expect(screen.queryByTestId('finalizing-keep-open')).toBeNull();
    expect(texts()).not.toMatch(/% complete|Resumed after restart|takes a few seconds|closes by itself/);
    // The failed step is still shown as failed in the pipeline.
    expect(screen.getByTestId('finalizing-pipeline-step-0').props.accessibilityLabel).toMatch(/interrupted/);
  });

  it('can be left: "Go to Home" goes Home, and the hardware Back is not held', async () => {
    const h = renderFlowApp({ window, routeSync: false });
    await settle();
    coreSays(h, SEAL_BLOCKED_EXAMPLE_FINALIZATION, [SEAL_BLOCKED_EXAMPLE_ALERT]);
    await settle();
    // Back: not consumed by a "please wait" toast - with no route below it goes Home.
    expect(hardwareBack()).toBe(true);
    await settle();
    expect(h.app.getPathname()).toBe('/home');
    // The session is still open on the Core: nothing was ended by leaving.
    expect(h.sim.store.getState().session).toMatchObject({ id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING' });
  });

  it('"Go to Home" leaves the screen', async () => {
    const h = renderFlowApp({ window, routeSync: false });
    await settle();
    coreSays(h, SEAL_BLOCKED_EXAMPLE_FINALIZATION, [SEAL_BLOCKED_EXAMPLE_ALERT]);
    await settle();
    fireEvent.press(screen.getByTestId('finalizing-seal-home'));
    await settle();
    expect(h.app.getPathname()).toBe('/home');
  });
});

describe('G75b-02: a seal the Core RETRIES by itself', () => {
  it('says so in the Core\'s sentence, keeps the kept sentence, can be left, and claims no restart from the attempt count', async () => {
    const h = renderFlowApp({ window: 'tabletLandscape', routeSync: false });
    await settle();
    coreSays(h, SEAL_RETRYING_EXAMPLE_FINALIZATION, []);
    await settle();
    const attention = sealAttentionOf(h.sim.store.getState());
    expect(attention).toMatchObject({ kind: 'RETRYING', attempt: 2 });
    if (attention === null || attention.kind !== 'RETRYING' || attention.sentence === null) throw new Error('the contract example must read RETRYING with a sentence');
    expect(screen.getByTestId('finalizing-title')).toHaveTextContent('Sealing is being retried');
    const notice = screen.getByTestId('finalizing-seal-retrying');
    expect(notice).toHaveTextContent(new RegExp(escape(attention.sentence)));
    expect(notice).toHaveTextContent(new RegExp(escape(SEAL_RECORDING_KEPT_SENTENCE)));
    // Attempt 2 is a retry inside the same process, not a restart (contract note §4).
    expect(screen.queryByTestId('finalizing-resumed')).toBeNull();
    expect(screen.queryByTestId('finalizing-keep-open')).toBeNull();
    expect(texts()).not.toMatch(/Resumed after restart|takes a few seconds|closes by itself/);
    fireEvent.press(screen.getByTestId('finalizing-seal-home'));
    await settle();
    expect(h.app.getPathname()).toBe('/home');
  });
});

describe('CONTROL - a seal that simply runs', () => {
  it('reads as before: the title, the percent, "closes by itself", no blocked notice - and Back is held', async () => {
    const h = renderFlowApp({ window: 'phonePortrait', routeSync: false });
    await settle();
    expect(sealAttentionOf(h.sim.store.getState())).toBeNull();
    expect(screen.getByTestId('finalizing-title')).toHaveTextContent('Finalizing evidence');
    expect(screen.getByTestId('finalizing-progress')).toBeTruthy();
    expect(screen.getByTestId('finalizing-keep-open')).toBeTruthy();
    expect(screen.queryByTestId('finalizing-seal-blocked')).toBeNull();
    expect(screen.queryByTestId('finalizing-seal-home')).toBeNull();
    expect(hardwareBack()).toBe(true);
    await settle();
    expect(h.app.getPathname()).toBe('/session/finalizing');
  });
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-l-m-blocked-who-where.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave L, driver L-M - re-check 75 findings G75d-02 and G75d-01 (mobile halves; rulings D228 (1), (2)).
//
// | Finding | What the devices showed | Held here, on the REAL `/session/finalizing` route |
// |---|---|---|
// | G75d-02 | A blocked seal told the operator to "start recovery for the session"; no screen offered it | The Core's sentence stays as written; right under it the device says that sealing stopped after `SEAL_AUTOMATIC_RETRIES` automatic retries and is not run again by itself, who resolves the cause, and WHO RETRIES WHERE: the web console's Session Monitor, "Retry sealing", an investigator or a supervisor (`SEAL_RETRY_PERMISSION`) - and that this device has no retry control. No retry control is drawn |
// | G75d-01 | At the UNSEALABLE end the Finalizing screen showed the newest unsealable notice of ANY session | The screen shows the notice of the session it FOLLOWED only, in the plain sentence, with the cause as a detail, "recording is not blocked" and who closes it |
//
// The Core's payloads are the contract's OWN examples (`contract_wave_l.md` sections 1 and 2), imported by name.
describe('a blocked seal: who retries and where', () => {
unmountBeforeTheHooksOfThisGroup();
beforeEach(() => resetMissingKeys());
afterEach(() => {
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
});

function coreSays(h: FlowHarness, sessionId: string, finalization: ActiveSession['finalization'], alerts: readonly SimAlert[]): void {
  act(() =>
    h.sim.store.setState((s) => ({
      session: s.session === null ? null : { ...s.session, id: sessionId, state: 'FINALIZING', finalization },
      alerts: [...s.alerts, ...alerts],
    })),
  );
}
const texts = (): string => JSON.stringify(screen.toJSON());

describe('the contract of the retry (contract_wave_l.md section 2), read by name', () => {
  it('operation 33 is for an investigator and a supervisor; three automatic retries', () => {
    expect(SEAL_AUTOMATIC_RETRIES).toBe(3);
    expect(SEAL_RETRY_PERMISSION).toBeDefined();
    expect([OperatorRole.INVESTIGATOR, OperatorRole.SUPERVISOR].map(canRetryBlockedSeal)).toEqual([true, true]);
    expect(canRetryBlockedSeal(OperatorRole.TECHNICIAN)).toBe(false);
  });
});

// Fix wave J, JT-02 (decision D243 reverses ruling D228 (1)): REPLACES the wave L case "... and no retry control on
// the device". A tablet-only operator was stuck at a blocked seal; the devices now offer "Retry sealing" to the
// roles operation 33 allows, with a confirmation, and every other role reads who can.
describe.each(['tabletLandscape', 'phonePortrait'] as const)('JT-02 on %s: a BLOCKED seal can be retried from the device', (window) => {
  const blocked = async () => {
    const h = renderFlowApp({ window, routeSync: false });
    await settle();
    coreSays(h, SEAL_BLOCKED_EXAMPLE_SESSION_ID, SEAL_BLOCKED_EXAMPLE_FINALIZATION, [SEAL_BLOCKED_EXAMPLE_ALERT]);
    await settle();
    return h;
  };

  it('an investigator: what the Core does by itself, who resolves the cause, and "Retry sealing" - a confirmation that names the session, then operation 33', async () => {
    const h = await blocked();
    const recover = jest.spyOn(h.sim.actions, 'recover');
    const core = screen.getByTestId('finalizing-seal-blocked');
    expect(core).toHaveTextContent(SEAL_RETRY_HOW_SENTENCE, { exact: false });
    // Closing pass J4, item 4: the Core's sentence names THIS device's control too - it no longer sends the operator to the web console alone.
    expect(core).toHaveTextContent("on the session's screen of the tablet or phone", { exact: false });
    expect(texts()).not.toMatch(/start recovery|recovery named above|recovery action/i);
    expect(screen.getByTestId('finalizing-seal-stopped')).toHaveTextContent(sealStoppedSentence(SEAL_AUTOMATIC_RETRIES));
    expect(SEAL_BLOCKED_EXAMPLE_FINALIZATION!.steps[0]?.detail).toContain(sealStoppedSentence(SEAL_AUTOMATIC_RETRIES));
    expect(screen.getByTestId('finalizing-seal-who')).toHaveTextContent(/technician or the administrator of the Core/);
    // The sentence of wave L is gone, on every role.
    expect(texts()).not.toMatch(/no retry control/i);
    expect(screen.getByTestId('finalizing-seal-retry-who')).toHaveTextContent('You can retry the seal from this device once the cause is resolved.');
    // The press asks first: nothing is sent yet.
    fireEvent.press(screen.getByTestId('finalizing-seal-retry-button'));
    await settle();
    expect(recover).not.toHaveBeenCalled();
    expect(screen.getByText(`Retry sealing of session ${SEAL_BLOCKED_EXAMPLE_SESSION_ID}?`)).toBeTruthy();
    expect(screen.getByText(/The Core runs the seal of this session once more, now\./)).toBeTruthy();
    // "Not now" sends nothing.
    fireEvent.press(screen.getByTestId('finalizing-seal-retry-cancel'));
    await settle();
    expect(recover).not.toHaveBeenCalled();
    // Confirmed: operation 33, once.
    fireEvent.press(screen.getByTestId('finalizing-seal-retry-button'));
    await settle();
    fireEvent.press(screen.getByTestId('finalizing-seal-retry-confirm'));
    await settle();
    expect(recover).toHaveBeenCalledTimes(1);
    // The way out is still there.
    expect(screen.getByTestId('finalizing-seal-home')).toBeTruthy();
    expect(screen.queryByTestId('recovery-start')).toBeNull();
  });

  it('a technician (operation 33 is not theirs): no button, the sentence says who can', async () => {
    const h = await blocked();
    const recover = jest.spyOn(h.sim.actions, 'recover');
    const technician = OPERATORS.find((operator) => operator.role === OperatorRole.TECHNICIAN)!;
    act(() => {
      h.sim.actions.signOut();
      h.sim.actions.signIn(technician.username, DEMO_OPERATOR_PASSWORD);
    });
    coreSays(h, SEAL_BLOCKED_EXAMPLE_SESSION_ID, SEAL_BLOCKED_EXAMPLE_FINALIZATION, [SEAL_BLOCKED_EXAMPLE_ALERT]);
    await settle();
    expect(screen.queryByTestId('finalizing-seal-retry-button')).toBeNull();
    expect(screen.getByTestId('finalizing-seal-retry-who')).toHaveTextContent('An investigator or a supervisor can retry the seal, from a device or from the web console. Your role (Technician) cannot.');
    expect(texts()).not.toMatch(/no retry control/i);
    expect(recover).not.toHaveBeenCalled();
  });

  it('CONTROL - a seal that simply runs says none of it', async () => {
    renderFlowApp({ window, routeSync: false });
    await settle();
    expect(screen.queryByTestId('finalizing-seal-stopped')).toBeNull();
    expect(screen.queryByTestId('finalizing-seal-retry')).toBeNull();
    expect(texts()).not.toMatch(/Retry sealing|automatic retries/);
  });
});

describe('G75d-01: the UNSEALABLE end on the Finalizing screen is the notice of the session it followed', () => {
  it('the followed session ended UNSEALABLE: its own notice - plain sentence, cause as a detail, not blocking, who closes it', async () => {
    const h = renderFlowApp({ window: 'phonePortrait', routeSync: false });
    await settle();
    // The screen follows this session while it is being sealed ...
    act(() => h.sim.store.setState((s) => ({ session: s.session === null ? null : { ...s.session, id: SEAL_UNSEALABLE_EXAMPLE_SESSION_ID } })));
    await settle();
    // ... then the Core ends it as unsealable: the session leaves the store, the alert is raised.
    act(() => h.sim.store.setState((s) => ({ session: null, alerts: [...s.alerts, SEAL_UNSEALABLE_EXAMPLE_ALERT] })));
    await settle();
    const notice = screen.getByTestId('session-unsealable');
    expect(notice).toHaveTextContent(new RegExp(`Session ${SEAL_UNSEALABLE_EXAMPLE_SESSION_ID}`));
    expect(notice).toHaveTextContent(new RegExp(SEAL_UNSEALABLE_PLAIN_SENTENCE.replace(/\./g, '\\.')));
    expect(screen.getByTestId('session-unsealable-cause')).toHaveTextContent('Cause code: SESSION_KEY_NOT_OF_SESSION');
    expect(screen.getByTestId('session-unsealable-not-blocking')).toHaveTextContent(/Recording is not blocked/);
    expect(screen.getByTestId('session-unsealable-close')).toBeTruthy();
    expect(texts()).not.toMatch(/\(SESSION_KEY_NOT_OF_SESSION\)/);
  });

  it('CONTROL - the screen followed ANOTHER session: the open notice of that old session is not drawn here (Home states it)', async () => {
    const h = renderFlowApp({ window: 'phonePortrait', routeSync: false });
    await settle();
    act(() => h.sim.store.setState((s) => ({ session: s.session === null ? null : { ...s.session, id: 'SES-20261011-0099' } })));
    await settle();
    act(() => h.sim.store.setState((s) => ({ session: null, alerts: [...s.alerts, SEAL_UNSEALABLE_EXAMPLE_ALERT] })));
    await settle();
    expect(screen.queryByTestId('session-unsealable')).toBeNull();
  });
});
});
