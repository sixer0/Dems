// E-fix row FX-M2, ruling R2 (decision D201; E2E-P-5 and O-2) in LIVE mode: on the app's own Live
// source over the contract-checked fake transport (W66's `live-home-bed`), signed in once as the
// contract's INVESTIGATOR. The Core then changes the operator's role the way §6.3 says it does:
// `session.updated` on the operator socket and the `operators` delta of the same change. The Home
// Start, the Sessions hub Start and System Maintenance's Install update re-gate IN PLACE, without a
// new sign-in, both ways (INVESTIGATOR -> TECHNICIAN -> INVESTIGATOR), and the start entry guard
// refuses `/session/new` for the TECHNICIAN.
import 'react-native-gesture-handler/jestSetup';
import '@/features/sessions/testing/sessions-test-setup';

import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { DeltaMessage } from '@dems/shared/api';
import { Permission, ROLE_PERMISSIONS, type OperatorRole } from '@dems/shared/sim';
import { useRoleGate } from '@/features/rbac/use-role-gate';
import { QuickActions } from '@/features/dashboard/quick-actions';
import { OPERATOR, createHomeBed, flush, type HomeBed } from '@/features/dashboard/testing/live-home-bed';
import { usePrimaryAction } from '@/features/dashboard/use-home-data';
import { useStartEntryGuard } from '@/features/session-new/use-start-entry-guard';
import { HubTop } from '@/features/sessions/hub-top';
import { MaintenanceSection } from '@/features/settings/maintenance-section';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests } from '@/runtime';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
}));

/** Home's quick actions, the Sessions hub top, System Maintenance and a fresh start-entry guard per visit. */
function R2Panel() {
  const action = usePrimaryAction();
  const [visit, setVisit] = useState(0);
  return (
    <View>
      <QuickActions action={action} />
      <HubTop index={0} />
      <MaintenanceSection />
      <Pressable testID="guard-visit" onPress={() => setVisit((n) => n + 1)} />
      {visit > 0 ? <GuardProbe key={visit} /> : null}
    </View>
  );
}

/** M3-20: the CAPTURE_CONFIG gate the selector, camera search and capture notices read (callers unchanged). */
function CaptureGateProbe() {
  const gate = useRoleGate(Permission.CAPTURE_CONFIG);
  return <Text testID="capture-gate">{`allowed=${gate.allowed} locked=${gate.locked} hint=${gate.hint ?? '-'}`}</Text>;
}

function GuardProbe() {
  const to = useStartEntryGuard();
  return <Text testID="guard-result">{to ?? 'wizard'}</Text>;
}

let bed: HomeBed | null = null;

const disabled = (testID: string): boolean => screen.getByTestId(testID).props.accessibilityState?.disabled === true;

/**
 * The Core changes the signed-in operator's role (§6.3): `session.updated`, then the `operators` delta.
 * `extras` are the identity grants the Core adds to the session's effective list (D55: the vendor
 * `root` account's CAPTURE_CONFIG; M3-20).
 */
async function changeRole(b: HomeBed, role: OperatorRole, extras: readonly Permission[] = []): Promise<void> {
  b.state = { ...b.state, operators: b.state.operators.map((entry) => (entry.id === OPERATOR.id ? { ...entry, role } : entry)) };
  act(() => {
    const socket = b.operatorSocket();
    socket.sessionUpdated({ id: OPERATOR.id, role }, [...ROLE_PERMISSIONS[role], ...extras]);
    socket.delta([{ op: 'replace', slice: 'operators', value: JSON.parse(JSON.stringify(b.state.operators)) } as DeltaMessage['ops'][number]]);
  });
  await flush();
  await b.elapse(300);
}

async function guardVisit(b: HomeBed): Promise<string> {
  fireEvent.press(screen.getByTestId('guard-visit'));
  await flush();
  await b.elapse(100);
  return String(screen.getByTestId('guard-result').props.children);
}

beforeAll(async () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  resetMissingKeys();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  resetLoopRegistryForTests();
  mockPush.mockClear();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  cleanup();
  expect(getMissingKeys()).toEqual([]);
});

describe('R2 in LIVE mode: a role change pushed by the Core re-gates the controls in place, without a sign-in', () => {
  it('INVESTIGATOR -> TECHNICIAN -> INVESTIGATOR: Start locks and unlocks; Install update unlocks and locks; one sign-in only', async () => {
    const b = createHomeBed();
    bed = b;
    b.mount(<R2Panel />);
    await b.signIn();
    expect(OPERATOR.role).toBe('INVESTIGATOR');
    const signIns = b.requestsOf('signIn').length;
    expect(signIns).toBe(1);

    // INVESTIGATOR: Start enabled in both places; Install update locked (MAINTENANCE is the TECHNICIAN's).
    expect(disabled('home-action-primary')).toBe(false);
    expect(disabled('sessions-start')).toBe(false);
    expect(screen.queryByTestId('home-action-primary-locked')).toBeNull();
    expect(screen.queryByTestId('sessions-start-locked')).toBeNull();
    expect(disabled('settings-update-install')).toBe(true);
    expect(screen.getByTestId('settings-update-install-locked')).toHaveTextContent('Requires the Technician role');
    expect(await guardVisit(b)).toBe('wizard');

    // The Core makes the operator a TECHNICIAN (E2E-P-5's step: "change budi.santoso to TECHNICIAN").
    await changeRole(b, 'TECHNICIAN');
    expect(screen.getByTestId('bed-probe').props.children).toMatch(/^auth=\S+ link=LIVE\/ONLINE\/LIVE$/);
    expect(disabled('home-action-primary')).toBe(true);
    expect(screen.getByTestId('home-action-primary-locked')).toHaveTextContent('Requires the Investigator or Supervisor role');
    expect(disabled('sessions-start')).toBe(true);
    expect(screen.getByTestId('sessions-start-locked')).toHaveTextContent('Requires the Investigator or Supervisor role');
    expect(disabled('settings-update-install')).toBe(false);
    expect(screen.queryByTestId('settings-update-install-locked')).toBeNull();
    fireEvent.press(screen.getByTestId('home-action-primary'));
    fireEvent.press(screen.getByTestId('sessions-start'));
    await flush();
    expect(mockPush).not.toHaveBeenCalled();
    expect(b.requestsOf('createSession')).toHaveLength(0);
    // A start entry that is not a button (a deep link) is refused for this visit.
    expect(await guardVisit(b)).toBe('/home');

    // And back: the role is the INVESTIGATOR's again.
    await changeRole(b, 'INVESTIGATOR');
    expect(disabled('home-action-primary')).toBe(false);
    expect(disabled('sessions-start')).toBe(false);
    expect(screen.queryByTestId('home-action-primary-locked')).toBeNull();
    expect(disabled('settings-update-install')).toBe(true);
    expect(await guardVisit(b)).toBe('wizard');
    fireEvent.press(screen.getByTestId('home-action-primary'));
    await flush();
    expect(mockPush).toHaveBeenCalledWith('/session/new?step=1');

    // Nobody signed in again: the gates followed the push.
    expect(b.requestsOf('signIn')).toHaveLength(signIns);
  });
});

// M3-20 (G-12, D163; row 212): in Live mode the gate reads the session's own permission list (V5),
// which holds the identity extras (D55), so the vendor `root` account gets CAPTURE_CONFIG on the tablet.
describe('M3-20 in LIVE mode: the gate follows the session permission list, not the role alone', () => {
  it('SUPERVISOR without CAPTURE_CONFIG is locked; the same SUPERVISOR role with the root identity extra is allowed; and back', async () => {
    const b = createHomeBed();
    bed = b;
    b.mount(<CaptureGateProbe />);
    await b.signIn();
    const signIns = b.requestsOf('signIn').length;

    await changeRole(b, 'SUPERVISOR');
    expect(screen.getByTestId('capture-gate')).toHaveTextContent('allowed=false locked=true hint=Requires the Technician role');

    // The Core's effective list of the vendor root (role SUPERVISOR, CAPTURE_CONFIG by identity).
    await changeRole(b, 'SUPERVISOR', [Permission.CAPTURE_CONFIG]);
    expect(screen.getByTestId('capture-gate')).toHaveTextContent('allowed=true locked=false hint=-');

    await changeRole(b, 'SUPERVISOR');
    expect(screen.getByTestId('capture-gate')).toHaveTextContent('allowed=false locked=true hint=Requires the Technician role');
    expect(b.requestsOf('signIn')).toHaveLength(signIns);
  });
});
