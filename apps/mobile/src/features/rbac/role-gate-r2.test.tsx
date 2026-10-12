// E-fix row FX-M2, ruling R2 (decision D201; defects E2E-P-5 and O-2): in SIMULATED mode, through a
// small Expo Router tree with the REAL route files of `/sessions` and `/session/new`, the real Home
// quick actions and the real System Maintenance section, inside the real `AppProviders` with a test
// simulator signed in as a demo operator:
//
// - Start Session (Home quick action, Sessions hub) is disabled with "Requires the Investigator or Supervisor role"
//   for the TECHNICIAN, and opens the wizard for the INVESTIGATOR;
// - `/session/new` reached any other way (a deep link) is refused for the TECHNICIAN: the route goes to
//   `/home` with ONE toast "Not permitted" / "Requires the Investigator or Supervisor role" and the wizard never renders;
// - Install update is disabled with "Requires the Technician role" for the INVESTIGATOR and the
//   SUPERVISOR, and enabled for the TECHNICIAN.
//
// Import order: the sessions setup (bottom-sheet and FlashList mocks), then the router harness (its first
// import prepares the module mocks the route tree needs).
import '@/features/sessions/testing/sessions-test-setup';
import { TEST_INSETS, WINDOWS, renderRoutes, resetShellState, setWindow } from '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { UPDATE_NOT_AVAILABLE_EXAMPLE } from '@dems/shared/api';
import { Stack, router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, OperatorRole, Permission, type Sim } from '@dems/shared/sim';
import SessionNewRoute from '@/app/(app)/session/new';
import SessionDetailRoute from '@/app/(app)/(tabs)/sessions/[sessionId]';
import SessionsLayout from '@/app/(app)/(tabs)/sessions/_layout';
import SessionsRoute from '@/app/(app)/(tabs)/sessions/index';
import { QuickActions } from '@/features/dashboard/quick-actions';
import { usePrimaryAction } from '@/features/dashboard/use-home-data';
import { MaintenanceSection } from '@/features/settings/maintenance-section';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { AppProviders } from '@/providers';
import { runtimeLog } from '@/runtime';
import { FakeHeartbeatSocket, createTestSim, flushAsync } from '@/runtime/testing/test-sim';
import { roleGateFor } from './use-role-gate';

// The wizard itself is step 78's and is tested there; here only whether it is shown matters.
jest.mock('@/features/session-new/session-new-screen', () => {
  const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SessionNewScreen: () => <MockText testID="wizard-open">wizard</MockText> };
});

type DemoUser = 'budi.santoso' | 'andi.pratama' | 'rina.wijaya';

function root(sim: Sim) {
  const { width, height } = WINDOWS.phonePortrait;
  const metrics: Metrics = { frame: { x: 0, y: 0, width, height }, insets: TEST_INSETS };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return function R2Root() {
    const tree: ReactNode = (
      <AppProviders sim={sim} safeAreaMetrics={metrics} queryClient={queryClient} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProviders>
    );
    return tree;
  };
}

function QuickRoute() {
  const action = usePrimaryAction();
  return <QuickActions action={action} />;
}

/** `user: null` leaves the store without a signed-in operator: the role is not known yet (W93-11). */
async function renderApp(user: DemoUser | null, initialUrl: string, options: { scenario?: 'recording' } = {}) {
  resetShellState();
  setWindow('phonePortrait');
  const test = createTestSim(options.scenario ? { scenario: options.scenario } : {});
  if (user !== null) {
    const operator = OPERATORS.find((candidate) => candidate.username === user)!;
    expect(test.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  }
  const app = renderRoutes(
    {
      _layout: root(test.sim),
      index: () => <Text testID="screen-index">index</Text>,
      home: () => <Text testID="screen-home-stub">home</Text>,
      quick: QuickRoute,
      maintenance: () => <MaintenanceSection />,
      'sessions/_layout': SessionsLayout,
      'sessions/index': SessionsRoute,
      'sessions/[sessionId]': SessionDetailRoute,
      'session/new': SessionNewRoute,
    },
    initialUrl,
  );
  await flushAsync();
  await flushAsync();
  return { ...test, app };
}

/** The guard's log records (one per refused visit; `info`, an expected state, never `console.warn`). */
const refusals = (): number => runtimeLog.records().filter((record) => record.source === 'features.sessionNew.entryRefused').length;
const disabled = (testID: string): boolean => screen.getByTestId(testID).props.accessibilityState?.disabled === true;

beforeEach(() => {
  resetMissingKeys();
});

afterEach(() => {
  cleanup();
  // MA-21: every string the screens render comes from an i18n key.
  expect(getMissingKeys()).toEqual([]);
});

describe('roleGateFor (pure): the permission, the role the sentence names, and an unknown role', () => {
  it('SESSION_START: INVESTIGATOR and SUPERVISOR hold it, TECHNICIAN is locked; the sentence names the Investigator role', () => {
    expect(roleGateFor(OperatorRole.INVESTIGATOR, Permission.SESSION_START)).toEqual({ allowed: true, known: true, locked: false, requiredRole: 'INVESTIGATOR', requiredRoles: ['INVESTIGATOR', 'SUPERVISOR'] });
    expect(roleGateFor(OperatorRole.SUPERVISOR, Permission.SESSION_START).locked).toBe(false);
    expect(roleGateFor(OperatorRole.TECHNICIAN, Permission.SESSION_START)).toEqual({ allowed: false, known: true, locked: true, requiredRole: 'INVESTIGATOR', requiredRoles: ['INVESTIGATOR', 'SUPERVISOR'] });
  });

  it('MAINTENANCE: only the TECHNICIAN holds it (the Core refuses startSoftwareUpdate to the others)', () => {
    expect(roleGateFor(OperatorRole.TECHNICIAN, Permission.MAINTENANCE).locked).toBe(false);
    expect(roleGateFor(OperatorRole.INVESTIGATOR, Permission.MAINTENANCE)).toEqual({ allowed: false, known: true, locked: true, requiredRole: 'TECHNICIAN', requiredRoles: ['TECHNICIAN'] });
    expect(roleGateFor(OperatorRole.SUPERVISOR, Permission.MAINTENANCE).locked).toBe(true);
  });

  it('no signed-in role yet: not allowed, but not "locked" (no sentence, and a route guard does not leave)', () => {
    expect(roleGateFor(null, Permission.SESSION_START)).toEqual({ allowed: false, known: false, locked: false, requiredRole: 'INVESTIGATOR', requiredRoles: ['INVESTIGATOR', 'SUPERVISOR'] });
  });
});

describe('Home quick action: Start Session needs SESSION_START (E2E-P-5)', () => {
  it('TECHNICIAN: the primary action is disabled with "Requires the Investigator or Supervisor role"; a press opens nothing', async () => {
    const t = await renderApp('rina.wijaya', '/quick');
    expect(disabled('home-action-primary')).toBe(true);
    expect(screen.getByTestId('home-action-primary-locked')).toHaveTextContent('Requires the Investigator or Supervisor role');
    expect(screen.getByTestId('home-action-primary').props.accessibilityHint).toBe('Requires the Investigator or Supervisor role');
    fireEvent.press(screen.getByTestId('home-action-primary'));
    await flushAsync();
    expect(t.app.getPathname()).toBe('/quick');
    expect(screen.queryByTestId('wizard-open')).toBeNull();
  });

  it('INVESTIGATOR: enabled, no sentence; a press opens the wizard', async () => {
    const t = await renderApp('budi.santoso', '/quick');
    expect(disabled('home-action-primary')).toBe(false);
    expect(screen.queryByTestId('home-action-primary-locked')).toBeNull();
    fireEvent.press(screen.getByTestId('home-action-primary'));
    await flushAsync();
    await flushAsync();
    expect(t.app.getPathname()).toBe('/session/new');
    expect(screen.getByTestId('wizard-open')).toBeTruthy();
  });

  it('the ways back to an active session are not gated (they open no session): a TECHNICIAN keeps "Return to live session"', async () => {
    await renderApp('rina.wijaya', '/quick', { scenario: 'recording' });
    expect(screen.getByTestId('home-action-primary').props.accessibilityLabel).toBe('Return to live session');
    expect(disabled('home-action-primary')).toBe(false);
    expect(screen.queryByTestId('home-action-primary-locked')).toBeNull();
  });
});

describe('Sessions hub: Start New Session needs SESSION_START (E2E-P-5)', () => {
  it('TECHNICIAN: disabled with "Requires the Investigator or Supervisor role"; a press opens nothing', async () => {
    const t = await renderApp('rina.wijaya', '/sessions');
    expect(screen.getByTestId('screen-sessions')).toBeTruthy();
    expect(disabled('sessions-start')).toBe(true);
    expect(screen.getByTestId('sessions-start-locked')).toHaveTextContent('Requires the Investigator or Supervisor role');
    expect(screen.queryByTestId('sessions-start-busy')).toBeNull();
    fireEvent.press(screen.getByTestId('sessions-start'));
    await flushAsync();
    expect(t.app.getPathname()).toBe('/sessions');
  });

  it('SUPERVISOR: enabled (SESSION_START is part of the role), no sentence', async () => {
    await renderApp('andi.pratama', '/sessions');
    expect(disabled('sessions-start')).toBe(false);
    expect(screen.queryByTestId('sessions-start-locked')).toBeNull();
  });
});

describe('/session/new by any other way: the route refuses a role without SESSION_START', () => {
  it('TECHNICIAN, a deep link: Home, ONE toast "Not permitted" / "Requires the Investigator or Supervisor role", the wizard never renders', async () => {
    const before = refusals();
    const t = await renderApp('rina.wijaya', '/session/new?step=1');
    await flushAsync();
    expect(t.app.getPathname()).toBe('/home');
    expect(screen.getByTestId('screen-home-stub')).toBeTruthy();
    expect(screen.queryByTestId('wizard-open')).toBeNull();
    // The kit's toast draws its label and description twice (measured with a single `toast.show`), so
    // "one toast" is counted on the guard's one log record per refused visit.
    expect(screen.queryAllByText('Not permitted').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Requires the Investigator or Supervisor role').length).toBeGreaterThan(0);
    expect(refusals() - before).toBe(1);
  });

  it('INVESTIGATOR, the same link: the wizard', async () => {
    const before = refusals();
    const t = await renderApp('budi.santoso', '/session/new?step=1');
    expect(t.app.getPathname()).toBe('/session/new');
    expect(screen.getByTestId('wizard-open')).toBeTruthy();
    expect(screen.queryByText('Not permitted')).toBeNull();
    expect(refusals() - before).toBe(0);
  });

  it('TECHNICIAN after a later push of the link (the guard decides per visit)', async () => {
    const t = await renderApp('rina.wijaya', '/home');
    const before = refusals();
    act(() => router.push('/session/new?step=1' as Href));
    await flushAsync();
    await flushAsync();
    expect(t.app.getPathname()).toBe('/home');
    expect(screen.queryByTestId('wizard-open')).toBeNull();
    expect(refusals() - before).toBe(1);
  });
});

describe('System Maintenance: Install update needs MAINTENANCE (O-2)', () => {
  it('INVESTIGATOR: disabled with "Requires the Technician role"; a press starts nothing', async () => {
    const t = await renderApp('budi.santoso', '/maintenance');
    expect(disabled('settings-update-install')).toBe(true);
    expect(screen.getByTestId('settings-update-install-locked')).toHaveTextContent('Requires the Technician role');
    fireEvent.press(screen.getByTestId('settings-update-install'));
    await flushAsync();
    expect(t.sim.store.getState().update.state).toBe('IDLE');
  });

  it('SUPERVISOR: disabled as well (the Core refuses the update to the role)', async () => {
    await renderApp('andi.pratama', '/maintenance');
    expect(disabled('settings-update-install')).toBe(true);
    expect(screen.getByTestId('settings-update-install-locked')).toHaveTextContent('Requires the Technician role');
  });

  // Fix wave J (JT-06, truth rule 3e): REPLACES "a press starts the update". The press asks first and says what
  // will happen; "Not now" starts nothing; the confirmation starts it.
  it('TECHNICIAN: enabled, no sentence; a press ASKS (the version, the slot, the restart) and starts nothing; "Not now" starts nothing; the confirmation starts the update', async () => {
    const t = await renderApp('rina.wijaya', '/maintenance');
    expect(disabled('settings-update-install')).toBe(false);
    expect(screen.queryByTestId('settings-update-install-locked')).toBeNull();
    fireEvent.press(screen.getByTestId('settings-update-install'));
    await flushAsync();
    expect(t.sim.store.getState().update.state).toBe('IDLE');
    const version = t.sim.store.getState().update.availableVersion;
    expect(screen.getByText(`Install update v${version}?`)).toBeTruthy();
    expect(screen.getByText(/installs it to the inactive system slot \([AB]\) and restarts into it/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-update-cancel'));
    await flushAsync();
    expect(t.sim.store.getState().update.state).toBe('IDLE');
    fireEvent.press(screen.getByTestId('settings-update-install'));
    await flushAsync();
    fireEvent.press(screen.getByTestId('settings-update-confirm'));
    await flushAsync();
    expect(t.sim.store.getState().update.state).toBe('RUNNING');
  });

  // JT-06 (contract_wave_j.md J-S 11): a Core in its own capture states `updaterNotAvailable`.
  it('a Core without an updater: the card says so, draws no version and offers no Install control - to any role', async () => {
    const t = await renderApp('rina.wijaya', '/maintenance');
    act(() => {
      t.sim.store.setState((state) => ({ ...state, update: { ...state.update, ...UPDATE_NOT_AVAILABLE_EXAMPLE } }));
    });
    await flushAsync();
    expect(screen.getByTestId('settings-update-not-available')).toHaveTextContent('Software update is not available on this Core.');
    expect(screen.queryByTestId('settings-update-install')).toBeNull();
    expect(screen.queryByTestId('settings-update-body')).toBeNull();
    expect(within(screen.getByTestId('settings-update')).queryByText(/v\d+\.\d+\.\d+/)).toBeNull();
  });
});

// Ruling W93-11 (decision D243; post-review fix FXR-M): while the operator's role is not yet known (Live mode
// before the first snapshot; here: no signed-in operator in the store), the Start Session entries are disabled
// WITH the reason "Checking your permissions…", and a deep link to the wizard waits for the role (a loading
// screen), then applies the same SESSION_START gate. One rule: the wizard never opens on an unknown role.
describe('W93-11: an unknown role — disabled with a reason, and the deep link waits for the role', () => {
  const signInAs = (t: { sim: Sim }, user: DemoUser): void => {
    const operator = OPERATORS.find((candidate) => candidate.username === user)!;
    act(() => {
      expect(t.sim.actions.signIn(operator.username, DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    });
  };

  it('Home quick action: disabled, with "Checking your permissions…" (it was disabled with no reason)', async () => {
    expect(roleGateFor(null, Permission.SESSION_START)).toMatchObject({ known: false, allowed: false, locked: false });
    await renderApp(null, '/quick');
    expect(disabled('home-action-primary')).toBe(true);
    expect(screen.getByTestId('home-action-primary-locked')).toHaveTextContent('Checking your permissions…');
    expect(screen.getByTestId('home-action-primary').props.accessibilityHint).toBe('Checking your permissions…');
  });

  it('Sessions hub Start: disabled, with "Checking your permissions…"', async () => {
    await renderApp(null, '/sessions');
    expect(disabled('sessions-start')).toBe(true);
    expect(screen.getByTestId('sessions-start-locked')).toHaveTextContent('Checking your permissions…');
  });

  // Fix wave J round two (RC-7 of note 163): the waiting screen has a visible exit.
  it('RC-7: the waiting screen offers "Back to Home", and it leaves for Home', async () => {
    const t = await renderApp(null, '/session/new?step=1');
    expect(screen.getByTestId('screen-session-new-checking')).toBeTruthy();
    fireEvent.press(screen.getByTestId('session-new-checking-home'));
    await flushAsync();
    expect(t.app.getPathname()).toBe('/home');
  });

  it('a deep link while the role is unknown: the waiting screen, never the wizard; INVESTIGATOR known -> the wizard', async () => {
    const before = refusals();
    const t = await renderApp(null, '/session/new?step=1');
    expect(t.app.getPathname()).toBe('/session/new');
    expect(screen.getByTestId('screen-session-new-checking')).toBeTruthy();
    expect(screen.getByTestId('session-new-checking-text')).toHaveTextContent('Checking your permissions…');
    expect(screen.queryByTestId('wizard-open')).toBeNull();
    signInAs(t, 'budi.santoso');
    await flushAsync();
    expect(t.app.getPathname()).toBe('/session/new');
    expect(screen.getByTestId('wizard-open')).toBeTruthy();
    expect(screen.queryByTestId('screen-session-new-checking')).toBeNull();
    expect(refusals() - before).toBe(0);
  });

  it('a deep link while the role is unknown, then TECHNICIAN known: Home, ONE refusal, the wizard never rendered', async () => {
    const before = refusals();
    const t = await renderApp(null, '/session/new?step=1');
    expect(screen.queryByTestId('wizard-open')).toBeNull();
    signInAs(t, 'rina.wijaya');
    await flushAsync();
    await flushAsync();
    expect(t.app.getPathname()).toBe('/home');
    expect(screen.queryByTestId('wizard-open')).toBeNull();
    expect(screen.queryAllByText('Requires the Investigator or Supervisor role').length).toBeGreaterThan(0);
    expect(refusals() - before).toBe(1);
  });
});
