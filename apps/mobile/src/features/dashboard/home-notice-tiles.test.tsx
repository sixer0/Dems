// Fix wave L, driver L-M - Home (tablet and phone) on a Core in REAL capture, LIVE mode on the app's own
// Live source over the contract-checked fake transport (`testing/live-home-bed`).
//
// | Finding | Seen at the re-check | Held here |
// |---|---|---|
// | G75d-01 (ruling D228 (2)) | With the UNSEALABLE alert active, Home read "READY / SECURE • HEALTHY • OPERATIONAL / All systems operational" with a "1" on the bell | READY with an open unsealable notice is stated as an OPEN NOTICE that does not block recording: header chip, ring, title, the sentence of ITS session, who closes it. The bell offers the supervisor "Acknowledge and close" (operation 70) also for a notice somebody already acknowledged; the resolved alert brings plain READY back |
// | G70c-02 (mobile half) | Phone Home tiles "Cameras: 2 of 2 online. Online", "Microphones: 2 of 2 ready. Online"; tablet camera tiles "READY" | A Core in real capture: the tiles say what the Core REPORTED for the sources on the lines in force. Controller ruling: at rest, without a checked fact of the Core, "Not checked"; "n not reachable" for a negative fact; "Reachable" only with a checked fact; "Live" only while a session records |
//
// The Core's payloads are the contract's OWN examples (`contract_wave_l.md` section 1), imported by name.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import {
  SEAL_UNSEALABLE_EXAMPLE_ALERT,
  SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED,
  SEAL_UNSEALABLE_EXAMPLE_SESSION_ID,
  SEAL_UNSEALABLE_PLAIN_SENTENCE,
  alertBlocksRecording,
  canResolveUnsealable,
  openUnsealableNoticesOf,
  type SimState,
} from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests } from '@/runtime';
import { DashboardScreen } from './dashboard-screen';
import { realCaptureCameraTileFor, realCaptureMicTileFor, micTileFor } from './home-model';
import { tileStatement } from './status-tiles';
import { OPERATOR, createHomeBed, flush, label, layoutAncestors, shows, stubMeasure, textOf, wordsUnder, type HomeBed } from './testing/live-home-bed';

// Fix wave J round two (ruling (a), JA2-16): on the phone the bell and the account menu are bottom sheets. The real
// sheet library cannot run under jest (its worklet closes over the whole `react-native` module); the package's own
// mock renders sheet content inline (`session-live/testing/monitor-test-setup.ts` has the long form of this note).
jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock'),
}));

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => mockFocused,
}));
/** Whether Home is the screen in view (fix wave M, G75e-01); `mock`-named so the factory above may read it. */
let mockFocused = true;

let bed: HomeBed | null = null;
type Mark = Record<string, unknown>;
const FAKE: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' };
const REAL_CAPTURE: Readonly<Record<string, Mark>> = { 'CAM-01': FAKE, 'CAM-02': FAKE, 'MIC-01': FAKE, 'MIC-02': FAKE };
function marked(state: SimState, marks: Readonly<Record<string, Mark>>): SimState {
  return { ...state, captureDevices: { ...state.captureDevices, devices: state.captureDevices.devices.map((device) => ({ ...device, ...(marks[device.id] ?? {}) }) as typeof device) } };
}
const NOTICE = SEAL_UNSEALABLE_EXAMPLE_ALERT;
const DETAIL = `A recording could not be sealed (${SEAL_UNSEALABLE_EXAMPLE_SESSION_ID}). Its files were kept in quarantine on the Core. Recording is not blocked.`;

beforeAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
});
beforeEach(async () => {
  mockFocused = true;
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  resetLoopRegistryForTests();
  resetMissingKeys();
});
afterEach(() => {
  if (bed !== null) {
    bed.stop();
    bed.fake.assertNoViolations();
    bed = null;
  }
  cleanup();
  expect(getMissingKeys()).toEqual([]);
});

async function home(window: 'tabletLandscape' | 'phonePortrait', alerts: readonly typeof NOTICE[], marks: Readonly<Record<string, Mark>> = REAL_CAPTURE): Promise<HomeBed> {
  bed = createHomeBed({ alerts });
  bed.state = marked(bed.state, marks);
  bed.mount(<DashboardScreen />, window);
  await bed.signIn();
  return bed;
}

describe('the contract of the open notice (contract_wave_l.md section 1), read by name', () => {
  it('the example alert IS an open notice that does not block recording; the resolved example is none', () => {
    expect(openUnsealableNoticesOf({ alerts: [NOTICE] })).toEqual([expect.objectContaining({ alertId: NOTICE.id, sessionId: SEAL_UNSEALABLE_EXAMPLE_SESSION_ID, acknowledged: false })]);
    expect(alertBlocksRecording(NOTICE)).toBe(false);
    expect(openUnsealableNoticesOf({ alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED] })).toEqual([]);
  });
});

describe.each(['tabletLandscape', 'phonePortrait'] as const)('G75d-01 on %s: READY with an open unsealable notice', (window) => {
  it('is stated as an open notice that does not block recording - never plain "Ready for Recording / All systems operational"', async () => {
    await home(window, [NOTICE]);
    expect(textOf('home-status-title')).toBe('Ready for Recording · open notice');
    expect(textOf('home-status-subtitle')).toBe(DETAIL);
    expect(textOf('home-status-subtitle')).not.toMatch(/All systems operational/);
    expect(label('home-status-ring')).toBe('System status: Ready, with an open notice');
    // Who closes it, as the signed-in role reads it.
    expect(textOf('home-status-notice-close')).toBe(canResolveUnsealable(OPERATOR.role) ? 'Acknowledge this notice to close it: open the alerts (the bell).' : 'A supervisor acknowledges this notice to close it.');
    if (window === 'tabletLandscape') {
      expect(label('home-header-state')).toBe('OPEN NOTICE');
      expect(textOf('home-status-ring-sub')).toBe('OPEN NOTICE • RECORDING NOT BLOCKED');
      expect(textOf('home-status-ring-sub')).not.toMatch(/SECURE|OPERATIONAL/);
    }
    // It blocks nothing: the primary action is still "Start Session".
    expect(screen.getByTestId('home-action-primary').props.accessibilityState?.disabled).not.toBe(true);
  });

  it('CONTROL - the acknowledgement that resolved it (the contract\'s resolved example): plain READY again', async () => {
    await home(window, [SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED]);
    expect(textOf('home-status-title')).toBe('Ready for Recording');
    expect(textOf('home-status-subtitle')).toBe('All systems operational');
    expect(screen.queryByTestId('home-status-notice-close')).toBeNull();
    if (window === 'tabletLandscape') expect(label('home-header-state')).toBe('READY');
  });

  it('a notice somebody ACKNOWLEDGED without closing it is still open: Home states it and the bell still counts it', async () => {
    await home(window, [{ ...NOTICE, acknowledged: true }]);
    expect(textOf('home-status-title')).toBe('Ready for Recording · open notice');
    expect(textOf('home-bell-count')).toBe('1');
  });
});

describe('G75d-01: the bell - where the app acknowledges alerts', () => {
  it('lists the notice of ITS session in the plain sentence (no code as a sentence), the code as a detail, and who closes it', async () => {
    await home('phonePortrait', [{ ...NOTICE, acknowledged: true }]);
    stubMeasure('home-bell');
    fireEvent.press(screen.getByTestId('home-bell'));
    await flush();
    layoutAncestors(`home-alert-${NOTICE.id}`);
    const row = textOf(`home-alert-${NOTICE.id}`);
    expect(row).toContain(`Session ${SEAL_UNSEALABLE_EXAMPLE_SESSION_ID}: ${SEAL_UNSEALABLE_PLAIN_SENTENCE}`);
    expect(row).not.toContain('(SESSION_KEY_NOT_OF_SESSION)');
    expect(textOf(`home-alert-${NOTICE.id}-notice`)).toContain('Cause code: SESSION_KEY_NOT_OF_SESSION');
    const closes = canResolveUnsealable(OPERATOR.role);
    if (closes) {
      // The supervisor's acknowledgement closes it - offered although the alert is already acknowledged.
      fireEvent.press(screen.getByTestId(`home-alert-${NOTICE.id}-acknowledge`));
      await flush();
      expect(bed!.requestsOf('acknowledgeAlert').map((call) => [call.method, call.params['id']])).toEqual([['POST', NOTICE.id]]);
    } else {
      expect(textOf(`home-alert-${NOTICE.id}-notice`)).toContain('A supervisor acknowledges this notice to close it.');
      expect(screen.queryByTestId(`home-alert-${NOTICE.id}-acknowledge`)).toBeNull();
    }
  });
});

describe('G70c-02 on Home: a Core in real capture says what it reported, never "Online" (controller ruling: "Not checked" at rest)', () => {
  it('phone tiles at rest: "Not checked" (the Core states no checked fact of the sources) - not "Online", not "Reachable"', async () => {
    await home('phonePortrait', []);
    expect(textOf('home-tile-camera-state')).toBe('Not checked');
    expect(label('home-tile-camera')).toBe('Cameras: 2 of 2. Not checked');
    expect(textOf('home-tile-microphone-state')).toBe('Primary not checked');
    expect(label('home-tile-microphone')).toBe('Microphones: 2 of 2. Primary not checked');
  });

  it('phone tiles: a camera the Core reports gone is "1 not reachable"', async () => {
    await home('phonePortrait', [], { ...REAL_CAPTURE, 'CAM-02': { ...FAKE, online: false } });
    expect(textOf('home-tile-camera-state')).toBe('1 not reachable');
    expect(label('home-tile-camera')).toBe('Cameras: 1 of 2. 1 not reachable');
  });

  // Fix wave J (JT-01 (b); truth rule 3c): "SYSTEM READY / All systems operational" stood beside a camera tile "Not reachable".
  it.each(['phonePortrait', 'tabletLandscape'] as const)('JT-01 (b) %s: a camera on a line the Core reports gone - Home says "Attention Needed" and names it, never "Ready"', async (window) => {
    await home(window, [], { ...REAL_CAPTURE, 'CAM-02': { ...FAKE, online: false } });
    expect(textOf('home-status-title')).toBe('Attention Needed');
    expect(textOf('home-flag-UNREACHABLE_VIDEO-02')).toBe('• Camera 2 (CAM-02): not reachable');
    expect(wordsUnder('home-status').join(' ')).not.toMatch(/Ready for Recording|All systems operational|OPERATIONAL/);
    expect(label('home-status-ring')).toBe('System status: ATTENTION');
    if (window === 'tabletLandscape') expect(textOf('home-header-state')).toBe('ATTENTION');
  });

  it('JT-01 (b) CONTROL: every source on the lines reachable - "Ready for Recording"', async () => {
    await home('phonePortrait', []);
    expect(textOf('home-status-title')).toBe('Ready for Recording');
    expect(shows('home-flag-UNREACHABLE_VIDEO-02')).toBe(false);
  });

  // "Not checked" (`checkedAt: null`) is held by the pure rule below: the member is not in the shared schema, so the
  // contract-checked transport of this bed cannot carry it.

  it('tablet camera tiles: the chip reads "Not checked" at rest - not the track\'s "READY", not "Reachable"', async () => {
    await home('tabletLandscape', []);
    expect(label('home-device-VIDEO-01-state-chip')).toBe('Not checked');
    expect(label('home-device-VIDEO-02-state-chip')).toBe('Not checked');
  });

  it('CONTROL - a Core in SIMULATED capture keeps "Online" and "n of m online"', async () => {
    await home('phonePortrait', [], {});
    expect(textOf('home-tile-camera-state')).toBe('Online');
    expect(label('home-tile-camera')).toBe('Cameras: 2 of 2 online. Online');
  });

  it('the pure rule: "Live" only while a session records; the microphone tile says "Reachable" where it said "Online"', () => {
    const reachable = [{ state: 'REACHABLE' as const }, { state: 'REACHABLE' as const }];
    expect(realCaptureCameraTileFor(reachable, false)).toMatchObject({ value: 2, total: 2, tone: 'success', stateKey: 'features.capture-selector.sourceState.reachable', reported: true });
    expect(realCaptureCameraTileFor(reachable, true)).toMatchObject({ stateKey: 'features.capture-selector.selector.stream.LIVE' });
    expect(realCaptureCameraTileFor([{ state: 'REACHABLE' }, { state: 'NOT_REACHABLE' }], true)).toMatchObject({ value: 1, tone: 'danger', count: 1, stateKey: 'features.capture-selector.sourceState.notReachableCount' });
    expect(realCaptureCameraTileFor([{ state: 'REACHABLE' }, { state: 'NOT_CHECKED' }], false)).toMatchObject({ value: 2, tone: 'default', stateKey: 'features.capture-selector.sourceState.notChecked' });
    const signal = micTileFor([{ state: 'READY', clipLatched: false }, { state: 'READY', clipLatched: false }]);
    expect(signal.stateKey).toBe('online');
    expect(realCaptureMicTileFor([{ primary: true, state: 'REACHABLE' }, { primary: false, state: 'REACHABLE' }], signal)).toMatchObject({ stateKey: 'features.capture-selector.sourceState.reachable', reported: true });
    // The track's own signal words stay.
    const noSignal = micTileFor([{ state: 'NO_SIGNAL', clipLatched: false }, { state: 'READY', clipLatched: false }]);
    expect(realCaptureMicTileFor([{ primary: true, state: 'REACHABLE' }, { primary: false, state: 'REACHABLE' }], noSignal).stateKey).toBe('noSignal');
  });
});

// Fix wave M (re-check 75 finding G75e-01): the phone's Camera tile was an EMPTY BOX while a session recorded -
// whenever the recording started while Home was not the tab in view. On the device the tile's views were patched
// while their screen was detached and came back with nothing inside. The two rules of `StatusTiles`: a change is
// applied only while the screen is in view, and a tile whose statement changed is a NEW tile.
describe('G75e-01: the phone tiles while a session records - never an empty box', () => {
  type Live = ReturnType<HomeBed['mount']>;
  /** The phone's Home on a Core in real capture, with the replica's store in hand. */
  async function phoneHome(): Promise<Live> {
    bed = createHomeBed({ alerts: [] });
    bed.state = marked(bed.state, REAL_CAPTURE);
    const live = bed.mount(<DashboardScreen />, 'phonePortrait');
    await bed.signIn();
    return live;
  }
  const record = (b: Live) =>
    act(() => b.sim.store.setState((s) => ({ session: { ...(s.session ?? {}), id: 'SES-TEST-0001', state: 'RECORDING', captureConfig: s.captureConfig, captureDurable: true } as unknown as SimState['session'] })));
  const tileParts = () => ({ name: within(screen.getByTestId('home-tile-camera')).queryByText('Camera'), state: textOf('home-tile-camera-state'), value: screen.getByTestId('home-tile-camera-value').props.accessibilityLabel });

  it('in view: the tile reads "Camera / Live / 2/2" while the session records, and it is a new tile, not the patched one', async () => {
    const b = await phoneHome();
    const before = screen.getByTestId('home-tile-camera');
    expect(tileStatement({ id: 'camera', value: 2, total: 2, tone: 'default', stateKey: 'a', href: '/devices' })).not.toBe(tileStatement({ id: 'camera', value: 2, total: 2, tone: 'success', stateKey: 'b', href: '/devices' }));
    record(b);
    await flush();
    const parts = tileParts();
    expect(parts.name).not.toBeNull();
    expect(parts.state).toBe('Live');
    expect(parts.value).toBe('2/2');
    expect(label('home-tile-camera')).toBe('Cameras: 2 of 2. Live');
    expect(screen.getByTestId('home-tile-camera')).not.toBe(before);
  });

  it('NOT in view when the recording starts: the tile is not touched; back in view it is drawn whole with "Live"', async () => {
    const b = await phoneHome();
    mockFocused = false;
    record(b);
    await flush();
    // Held: the drawn tile is still the tile of before, whole.
    expect(textOf('home-tile-camera-state')).toBe('Not checked');
    mockFocused = true;
    // The focus hook re-renders the screen in the app; here another fact of the Core does (the status card names the session).
    act(() => b.sim.store.setState((s) => ({ session: { ...(s.session ?? {}), id: 'SES-TEST-0002' } as unknown as SimState['session'] })));
    await flush();
    const parts = tileParts();
    expect(parts.name).not.toBeNull();
    expect(parts.state).toBe('Live');
    expect(parts.value).toBe('2/2');
    expect(textOf('home-tile-microphone-state')).toBe('Reachable');
  });

  it('CONTROL: a value that moves inside the same statement keeps its tile (the storage percentage rolls in place)', () => {
    const tile = { id: 'storage' as const, value: 55, total: null, tone: 'success' as const, stateKey: 'healthy', href: '/storage' as const };
    expect(tileStatement({ ...tile, value: 56 })).toBe(tileStatement(tile));
  });
});
