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
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { act, fireEvent, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import {
  SEAL_BLOCKED_DETAIL_SENTENCE,
  SEAL_BLOCKED_EXAMPLE_ALERT,
  SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  SEAL_BLOCKED_EXAMPLE_SESSION_ID,
  SEAL_RECORDING_KEPT_SENTENCE,
  SEAL_RETRYING_EXAMPLE_FINALIZATION,
  sealAttentionOf,
  type ActiveSession,
  type SimAlert,
} from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { renderFlowApp, settle, type FlowHarness } from './testing/flow-harness';

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
