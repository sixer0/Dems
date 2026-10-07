// Pairing screen (step 76; 04_mobile_specs §4.2, §6.5, §3.3 hand-off; blueprint row 76 AC: pair(code)
// and unpair() change the pairing state and emit audit rows). The screen renders inside the real
// AppProviders with an injected, hydrated test simulator (step 73's `renderWithRuntime`); the test
// drives the simulator clock itself, so the connection steps, the lockout and the hand-off are
// deterministic. expo-router's hooks are mocked; Skia is step 71's module mock.
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { DEMO_OPERATOR_PASSWORD, DEMO_PAIRING_CODE, PairingState, type SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { haptics, resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreLinkPrefsForTests } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { PAIR_TIMELINE } from './pairing-model';
import { PairingScreen } from './pairing-screen';

jest.mock('@shopify/react-native-skia', () =>
  jest
    .requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock')
    .createSkiaMock(),
);

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  navigate: jest.fn(),
  canGoBack: jest.fn(() => true),
  // Row FX-M1 (E2E-S-1): the signed-out hand-off resets the stack to the boot router.
  canDismiss: jest.fn(() => true),
  dismissAll: jest.fn(),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => true,
}));

const WINDOWS = {
  phonePortrait: { width: 411, height: 923 },
  tabletLandscape: { width: 1280, height: 800 },
} as const;

function setWindow(name: keyof typeof WINDOWS) {
  const { width, height } = WINDOWS[name];
  act(() => {
    Dimensions.set({ window: { width, height, scale: 2, fontScale: 1 }, screen: { width, height, scale: 2, fontScale: 1 } });
  });
}

const textOf = (testID: string) => {
  const parts: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(screen.getByTestId(testID));
  return parts.join('');
};

const pairing = (test: TestSim) => test.sim.store.getState().pairing;
const auditRows = (test: TestSim) => test.sim.store.getState().audit.rows;
const lastAudit = (test: TestSim) => {
  const rows = auditRows(test);
  return rows[rows.length - 1];
};

async function mount(options: { pairing?: PairingState; signIn?: boolean; window?: keyof typeof WINDOWS } = {}): Promise<TestSim> {
  setWindow(options.window ?? 'phonePortrait');
  const test = createTestSim({ initialPairing: options.pairing ?? PairingState.UNPAIRED });
  if (options.signIn) expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  renderWithRuntime(<PairingScreen />, { sim: test.sim });
  await flushAsync();
  return test;
}

/** Advances the simulator clock and lets the commit / hand-off microtasks run. */
async function advance(test: TestSim, ms: number) {
  await act(async () => {
    test.advance(ms);
    await Promise.resolve();
  });
}

function typeCode(code: string) {
  fireEvent.changeText(screen.getByTestId('pairing-code-input'), code);
}

const pairDisabled = () => screen.getByTestId('pairing-pair').props.accessibilityState?.disabled === true;

describe('Pairing screen', () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  beforeEach(async () => {
    await AsyncStorage.clear();
    resetCoreLinkPrefsForTests();
    resetMotionStateForTests();
    resetLoopRegistryForTests();
    resetMissingKeys();
    jest.clearAllMocks();
    mockRouter.canGoBack.mockImplementation(() => true);
    mockRouter.canDismiss.mockImplementation(() => true);
  });

  afterEach(() => {
    cleanup();
  });

  it('unpaired phone: stepper, Core identity (DEMS-IR-01, fingerprint, SIMULATED), no demo code; Pair needs 6 digits', async () => {
    const test = await mount();
    expect(screen.getByTestId('screen-pair')).toBeTruthy();
    expect(screen.getByTestId('pairing-stepper')).toBeTruthy();
    expect(textOf('pairing-state-chip')).toBe('Not paired');
    expect(textOf('pairing-status-line')).toBe('Ready to pair with DEMS-IR-01.');
    expect(screen.getByTestId('pairing-identity-device').props.accessibilityLabel).toBe('Device, DEMS-IR-01');
    expect(screen.getByTestId('pairing-identity-room').props.accessibilityLabel).toBe('Room, Interview Room 1');
    expect(screen.getByTestId('pairing-fingerprint').props.accessibilityLabel).toBe(
      `Certificate fingerprint · SHA-256 (DEMO), ${pairing(test).certificateFingerprint}`,
    );
    expect(textOf('pairing-simulated-chip')).toBe('SIMULATED');
    // §4.2: the demo code appears only in the Login accordion.
    expect(screen.queryByText(new RegExp(DEMO_PAIRING_CODE))).toBeNull();
    expect(pairDisabled()).toBe(true);
    typeCode('48291');
    expect(pairDisabled()).toBe(true);
    // Non-digits are refused by the slots (REGEXP_ONLY_DIGITS).
    typeCode('4a8 2-913');
    expect(pairDisabled()).toBe(true);
    typeCode('123456');
    expect(pairDisabled()).toBe(false);
    expect(getMissingKeys()).toEqual([]);
  });

  it('pair(code): Discover → Verify on the simulator clock, then PAIRED with one PAIRING_SUCCESS audit row and the hand-off', async () => {
    const trigger = jest.spyOn(haptics, 'trigger');
    const test = await mount();
    const before = auditRows(test).length;
    typeCode(DEMO_PAIRING_CODE);
    fireEvent.press(screen.getByTestId('pairing-pair'));

    expect(textOf('pairing-status-line')).toBe('Discovering DEMS-IR-01 on the management network…');
    expect(textOf('pairing-state-chip')).toBe('Pairing…');
    expect(screen.getByTestId('pairing-pair').props.accessibilityState?.busy).toBe(true);
    await advance(test, PAIR_TIMELINE.verifyAt);
    expect(textOf('pairing-status-line')).toBe('Verifying the code and the Core certificate (DEMO)…');
    // Nothing reaches the simulator before the Verify step has run.
    expect(pairing(test).state).toBe('UNPAIRED');
    expect(auditRows(test).length).toBe(before);

    await advance(test, PAIR_TIMELINE.commitAt - PAIR_TIMELINE.verifyAt);
    expect(pairing(test).state).toBe('PAIRED');
    expect(auditRows(test).length).toBe(before + 1);
    expect(lastAudit(test)?.type).toBe('PAIRING_SUCCESS');
    expect(JSON.stringify(lastAudit(test))).not.toContain(DEMO_PAIRING_CODE);
    expect(textOf('pairing-state-chip')).toBe('Paired');
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    expect(screen.getByTestId('pairing-identity-last-audit').props.accessibilityLabel).toMatch(
      /^Last pairing audit, #\d+ Tablet paired · \d\d:\d\d:\d\d$/,
    );
    expect(trigger).toHaveBeenCalledWith('pairingSuccess');
    // Signed out: the hand-off goes on to sign-in.
    expect(textOf('pairing-continue')).toBe('Continue to sign-in');
    expect(screen.getByTestId('pairing-handoff')).toBeTruthy();

    expect(mockRouter.replace).not.toHaveBeenCalled();
    await advance(test, PAIR_TIMELINE.handoffAfter);
    // Row FX-M1 (E2E-S-1): never "back" to whatever lies underneath (it was Stack Check on the
    // phone); the stack is reset and the boot router opens Login.
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    expect(mockRouter.dismissAll.mock.invocationCallOrder[0]!).toBeLessThan(mockRouter.replace.mock.invocationCallOrder[0]!);
    // Done after the hand-off does not navigate twice.
    fireEvent.press(screen.getByTestId('pairing-continue'));
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).not.toHaveBeenCalled();
    trigger.mockRestore();
  });

  it('signed in, with Settings underneath: Done goes back to it (row FX-M1 keeps the signed-in hand-off)', async () => {
    const test = await mount({ signIn: true });
    typeCode(DEMO_PAIRING_CODE);
    fireEvent.press(screen.getByTestId('pairing-pair'));
    await advance(test, PAIR_TIMELINE.commitAt);
    expect(pairing(test).state).toBe('PAIRED');
    expect(textOf('pairing-continue')).toBe('Done');
    fireEvent.press(screen.getByTestId('pairing-continue'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.dismissAll).not.toHaveBeenCalled();
  });

  it('without a screen underneath (deep link) the hand-off replaces to the boot router', async () => {
    mockRouter.canGoBack.mockImplementation(() => false);
    mockRouter.canDismiss.mockImplementation(() => false);
    const test = await mount({ signIn: true });
    typeCode(DEMO_PAIRING_CODE);
    // The keypad's submit key pairs as well as the button.
    fireEvent(screen.getByTestId('pairing-code-input'), 'submitEditing');
    await advance(test, PAIR_TIMELINE.commitAt);
    expect(pairing(test).state).toBe('PAIRED');
    expect(textOf('pairing-continue')).toBe('Done');
    fireEvent.press(screen.getByTestId('pairing-continue'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('3 wrong codes: PAIRING_FAILED rows, attempts left, then the 60 s lockout on the simulator clock', async () => {
    const test = await mount();
    const before = auditRows(test).length;
    for (const [i, left] of [2, 1].entries()) {
      typeCode('111111');
      fireEvent.press(screen.getByTestId('pairing-pair'));
      await advance(test, PAIR_TIMELINE.commitAt);
      expect(auditRows(test).length).toBe(before + i + 1);
      expect(lastAudit(test)?.type).toBe('PAIRING_FAILED');
      expect(textOf('pairing-alert-body')).toBe(`${left} attempt${left === 1 ? '' : 's'} remaining`);
      expect(pairing(test).state).toBe('FAILED');
      // The rejected code is cleared.
      expect(pairDisabled()).toBe(true);
    }
    typeCode('222222');
    fireEvent.press(screen.getByTestId('pairing-pair'));
    await advance(test, PAIR_TIMELINE.commitAt);
    expect(auditRows(test).length).toBe(before + 3);
    expect(pairing(test).lockedUntil).not.toBeNull();
    expect(screen.getByTestId('pairing-alert-locked')).toBeTruthy();
    expect(textOf('pairing-status-line')).toBe('Pairing is locked after repeated failures.');
    expect(screen.getByTestId('pairing-alert-locked').findByProps({ accessibilityLiveRegion: 'polite' }).props.accessibilityLabel).toBe(
      'Pairing locked. Try again in 60 seconds.',
    );
    typeCode(DEMO_PAIRING_CODE);
    expect(pairDisabled()).toBe(true);

    await advance(test, 30_000);
    expect(screen.getByTestId('pairing-alert-locked').findByProps({ accessibilityLiveRegion: 'polite' }).props.accessibilityLabel).toBe(
      'Pairing locked. Try again in 30 seconds.',
    );
    await advance(test, 30_000);
    expect(screen.queryByTestId('pairing-alert-locked')).toBeNull();
    typeCode(DEMO_PAIRING_CODE);
    expect(pairDisabled()).toBe(false);
    fireEvent.press(screen.getByTestId('pairing-pair'));
    await advance(test, PAIR_TIMELINE.commitAt);
    expect(pairing(test).state).toBe('PAIRED');
    expect(lastAudit(test)?.type).toBe('PAIRING_SUCCESS');
  });

  it('Cancel during the connection steps commits nothing and leaves', async () => {
    const test = await mount();
    const before = auditRows(test).length;
    typeCode(DEMO_PAIRING_CODE);
    fireEvent.press(screen.getByTestId('pairing-pair'));
    await advance(test, PAIR_TIMELINE.verifyAt);
    fireEvent.press(screen.getByTestId('pairing-cancel'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    await advance(test, PAIR_TIMELINE.commitAt);
    expect(pairing(test).state).toBe('UNPAIRED');
    expect(auditRows(test).length).toBe(before);
  });

  it('unpair(): behind a Dialog, writes one UNPAIRED audit row and returns to the code prompt', async () => {
    const test = await mount({ pairing: PairingState.PAIRED, signIn: true });
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    expect(screen.queryByTestId('pairing-handoff')).toBeNull();
    expect(textOf('pairing-continue')).toBe('Done');
    expect(screen.queryByTestId('pairing-unpair-dialog')).toBeNull();

    fireEvent.press(screen.getByTestId('pairing-unpair'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(screen.getByTestId('pairing-unpair-dialog')).toBeTruthy();
    // Keep paired: nothing changes.
    fireEvent.press(screen.getByTestId('pairing-unpair-cancel'));
    expect(pairing(test).state).toBe('PAIRED');

    fireEvent.press(screen.getByTestId('pairing-unpair'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    const before = auditRows(test).length;
    fireEvent.press(screen.getByTestId('pairing-unpair-confirm'));
    expect(pairing(test).state).toBe('UNPAIRED');
    expect(auditRows(test).length).toBe(before + 1);
    expect(lastAudit(test)?.type).toBe('UNPAIRED');
    expect(lastAudit(test)?.actorId).toBe('OPR-001');
    expect(screen.getByTestId('pairing-code-card')).toBeTruthy();
    expect(textOf('pairing-state-chip')).toBe('Not paired');
    expect(screen.getByTestId('pairing-identity-paired-at').props.accessibilityLabel).toBe('Paired at, Not paired');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('tablet landscape: two panes side by side, vertical stepper with step descriptions', async () => {
    await mount({ window: 'tabletLandscape' });
    expect(screen.getByTestId('pane-connection')).toBeTruthy();
    expect(screen.getByTestId('pane-code')).toBeTruthy();
    const panes = screen.getByTestId('pairing-panes');
    const style = Object.assign({}, ...[panes.props.style].flat(3).filter(Boolean)) as { flexDirection?: string };
    expect(style.flexDirection).toBe('row');
    expect(screen.getByText('Find DEMS-IR-01 on the management network')).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });

  it('flat selectors only: an idle simulator tick does not re-render the screen into a loop', async () => {
    const test = await mount();
    const state: SimState = test.sim.store.getState();
    await advance(test, 1_000);
    expect(test.sim.store.getState().clock.now).toBe(state.clock.now + 1_000);
    expect(screen.getByTestId('screen-pair')).toBeTruthy();
  });
});
