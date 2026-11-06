// Post-review fix FXR-M, finding W93-6 (code review W93, decision D243; the RF-PH-3 residual of CF2-A, D236).
//
// The session flow's stack faded every screen (`stackAnimation('tabs')` = `fade`). Finalizing and the Summary
// are drawn IN PLACE by the screen before them (the monitor draws Finalizing in the commit that drops it; a
// sealed Finalizing draws the Summary), so the route change that follows swaps two identical screens, and the
// native fade showed one 30-70 ms empty frame at the Summary (RF2: 5/6 phone, 2/3 tablet). Those two routes now
// have `animation: 'none'`; the flow's other screens keep the fade. Jest has no native stack: this checks the
// options the stack is given, and that the names are real route files of `app/(app)/session` (a name that
// matches no route would be ignored by Expo Router). The frame itself is W94-W96's to confirm on a device.
import { describe, expect, it, jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const recorded: { screenOptions: Record<string, unknown> | null; screens: { name: string; options: Record<string, unknown> }[] } = {
  screenOptions: null,
  screens: [],
};

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function Screen({ name, options }: { name: string; options: Record<string, unknown> }) {
    recorded.screens.push({ name, options });
    return null;
  }
  function Stack({ screenOptions, children }: { screenOptions: Record<string, unknown>; children?: ReactNode }) {
    recorded.screenOptions = screenOptions;
    return React.createElement(React.Fragment, null, children);
  }
  Stack.Screen = Screen;
  return { Stack };
});
jest.mock('@/runtime', () => ({ useActiveSession: () => ({ state: 'FINALIZING', sessionId: 'SES-1' }) }));

// eslint-disable-next-line import/first -- the mocks above must be installed first
import { IN_PLACE_FLOW_ROUTES, SessionFlowStack } from '../stacks';

describe('W93-6: the in-place session-flow routes swap without a stack animation', () => {
  it('Finalizing and the Summary get `animation: none`; the flow keeps its fade for the other screens', () => {
    recorded.screens = [];
    render(<SessionFlowStack />);
    expect(recorded.screenOptions).toMatchObject({ headerShown: false, gestureEnabled: false });
    expect(recorded.screenOptions?.animation).not.toBe('none');
    const byName = Object.fromEntries(recorded.screens.map((s) => [s.name, s.options]));
    expect(Object.keys(byName).sort()).toEqual(['finalizing', 'summary/[sessionId]']);
    expect(byName.finalizing).toEqual({ animation: 'none' });
    expect(byName['summary/[sessionId]']).toEqual({ animation: 'none' });
  });

  it('every name is a route file of app/(app)/session (Expo Router ignores a name that matches no route)', () => {
    const dir = path.join(__dirname, '..', '..', 'app', '(app)', 'session');
    for (const name of IN_PLACE_FLOW_ROUTES) expect([name, fs.existsSync(path.join(dir, `${name}.tsx`))]).toEqual([name, true]);
  });
});
