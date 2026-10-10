// Fix wave H, gate 70 finding G70-04 (tablet and phone): after microphone "Search again" ended, the
// control's accessibility label kept reading "Search again for microphones, busy".
//
// CAUSE (React Native 0.86.3, Android, `BaseViewManager.setViewState`): the view's content description
// - where "busy" is appended to the label - is recomputed ONLY when the new `accessibilityState` holds
// the key `busy` (or `expanded`, or a text `checked`). The shared `busyState()` of `@/runtime` spreads
// NOTHING while idle, so the idle state the button sends is `{ disabled }` alone: the description is
// not recomputed and keeps ", busy". A control that ended a command must therefore SAY `busy: false`.
//
// What jest can show is the prop the native side receives: red before the fix (no `busy` key after the
// search ended), green after (`busy: false`). The native effect itself is a device check (re-gate).
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/devices-test-setup';
import '@/navigation/testing/router-harness';

import { fireEvent, screen } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { settledBusyState } from '@/features/capture-selector/settled-busy-state';
import { renderDevicesApp, settle } from './testing/devices-harness';

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

const ACTION = 'capture-selector-mic-rescan-action';
const stateOf = (testID: string) => screen.getByTestId(testID).props.accessibilityState as Record<string, unknown> | undefined;

describe('G70-04: a control whose command ended says so', () => {
  it('the helper always names `busy`, also while idle', () => {
    expect(settledBusyState(false)).toEqual({ accessibilityState: { busy: false, disabled: false } });
    expect(settledBusyState(false, true)).toEqual({ accessibilityState: { busy: false, disabled: true } });
    expect(settledBusyState(true, true)).toEqual({ accessibilityState: { busy: true, disabled: true } });
  });

  it.each(['tabletLandscape', 'phonePortrait'] as const)('%s: microphone "Search again" - after the result is drawn the state holds `busy: false` and the label is the plain one', async (window) => {
    renderDevicesApp({ user: 'andi.pratama', window });
    await settle();
    fireEvent.press(screen.getByTestId(ACTION));
    await settle();
    await settle();
    expect(screen.getByTestId('capture-selector-mic-rescan-result')).toBeTruthy();
    expect(stateOf(ACTION)).toEqual({ busy: false, disabled: false });
    expect(screen.getByTestId(ACTION).props.accessibilityLabel).toBe('Search again for microphones');
  });

  it('the camera search control, which stays on screen as well, names `busy` while idle', async () => {
    renderDevicesApp({ user: 'rina.wijaya', window: 'tabletLandscape' });
    await settle();
    expect(stateOf('camera-search-action')).toMatchObject({ busy: false });
  });
});
