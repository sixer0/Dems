// Plan row W87 (step 109): Live tests that name sites S1-8 and S2-5 (04_client_integration_spec §8.5,
// §8.6, §9.4 MP-5 to MP-7; AC-C-56, AC-C-75, AC-C-76, AC-C-80).
//
// S1-8 is `pair` (`features/pairing/use-pairing-flow.ts`): operation 18 at `commitAt`; on 201 the
// credential is stored before anything says "paired". S2-5 is `usePairingFlow.unpair` with its consumer
// `pairing-screen.tsx`: operation 22; on 204 the three items are deleted and the gate goes to UNPAIRED
// with the notice; while the link is down it is refused with the LB-6 toast and nothing is deleted.
// Each site with its success, its refusal and an outage, on the app's real Live source
// (`createMobileLive`) over the contract-checked fake transport, mounted by the real `AppProviders`.
// The model is W57's `pairing-live.test.tsx`, which proves the same flow in depth without the site IDs.
//
// THE CODE of these tests is a MARKER: six digits that are neither the simulator's demo code nor an
// example of the contract. The credentials are the contract's and the fake transport's placeholders.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import type { ReactTestInstance } from 'react-test-renderer';
import { CORE_API_EXAMPLES, type DeviceRegistration, type PairingRedeemed } from '@dems/shared/api';
import { OUTAGE, createFakeTransport, refusal, type FakeConnection, type FakeHttpCall, type FakeReply, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { AppProviders } from '@/providers';
import { createMobileLive, resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests, type MobileLive } from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { PAIR_TIMELINE } from './pairing-model';
import { PairingScreen } from './pairing-screen';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => false), canDismiss: jest.fn(() => false), dismissAll: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => true,
}));

/** The marker code. Put together here, so that a search of the tree for it finds this line only. */
const MARKER_CODE = ['718', '402'].join('');
const METRICS: Metrics = { frame: { x: 0, y: 0, width: 411, height: 923 }, insets: { top: 24, right: 0, bottom: 16, left: 0 } };
const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;

const store = () => globalThis.__DEMS_SECURE_STORE_MOCK__;

class MockCoreSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.readyState = 3;
  }
}

/** What the Core server knows, and whether it answers. */
interface CoreModel {
  devices: Map<string, { id: string; state: 'PAIRED' | 'REVOKED' }>;
  reachable: boolean;
  redeem: (call: FakeHttpCall) => FakeReply;
  unpair: ((call: FakeHttpCall) => FakeReply) | null;
}

let fake: FakeTransport;
let core: CoreModel;
let mobile: MobileLive | undefined;

const bearerOf = (headers: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};
const requests = (operationId: string): readonly FakeHttpCall[] => fake.log.requestsOf(operationId);
const lastSocket = (): FakeConnection => fake.connection();
const codeOf = (call: FakeHttpCall): unknown => (call.body as { code?: unknown } | undefined)?.code;

async function flush(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}
async function elapse(ms: number, step = 100): Promise<void> {
  for (let done = 0; done < ms; done += step) {
    act(() => {
      fake.clock.advance(Math.min(step, ms - done));
    });
    await flush();
  }
}
async function settleUi(ms = 40): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function bootCore(): void {
  fake = createFakeTransport({ epoch: 2, revision: 10 });
  core = { devices: new Map(), reachable: true, redeem: () => fake.example('redeemPairingCode', 401), unpair: null };
  const answered = (operationId: string, reply: (call: FakeHttpCall) => FakeReply): void => fake.answer(operationId, (call) => (core.reachable ? reply(call) : OUTAGE));
  answered('getAuthSession', () => fake.example('getAuthSession', 401));
  answered('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  answered('getDeviceRegistration', (call) => {
    const bearer = bearerOf(call.headers);
    const device = bearer === null ? null : (core.devices.get(bearer) ?? null);
    if (device === null) return fake.example('getDeviceRegistration', 401);
    if (device.state === 'REVOKED') return refusal(403, 'DEVICE_REVOKED', 'This device was revoked.');
    const body: DeviceRegistration = { deviceId: device.id, name: 'Android device', state: 'PAIRED', pairedAt: REDEEMED.pairedAt, credentialRotatedAt: null, core: REDEEMED.core };
    return { status: 200, body };
  });
  answered('redeemPairingCode', (call) => core.redeem(call));
  answered('unpairDevice', (call) => {
    if (core.unpair !== null) return core.unpair(call);
    const bearer = bearerOf(call.headers);
    if (bearer === null || !core.devices.has(bearer)) return fake.example('unpairDevice', 401);
    core.devices.delete(bearer);
    return { status: 204 };
  });
  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
    if (!core.reachable) {
      connection.refuse();
      return;
    }
    const bearer = bearerOf(connection.headers);
    const device = bearer === null ? null : (core.devices.get(bearer) ?? null);
    if (bearer === null) connection.startAnonymous().heartbeat();
    else if (device?.state === 'PAIRED') connection.startDevice().heartbeat();
    else {
      connection.accept().hello('ANONYMOUS', { reason: 'SESSION_INVALID' }).close(4401);
      return;
    }
    connection.beatEvery();
  });
}

/** A redeem that accepts the marker code once; anything else is the Core's one refusal. */
function accepting(redeemed: PairingRedeemed): CoreModel['redeem'] {
  let used = false;
  return (call) => {
    if (used || codeOf(call) !== MARKER_CODE) return fake.example('redeemPairingCode', 401);
    used = true;
    core.devices.set(redeemed.deviceCredential, { id: redeemed.deviceId, state: 'PAIRED' });
    return { status: 201, body: redeemed };
  };
}

/** The tablet holds a credential the Core knows. */
function pairTablet(): void {
  store().seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(REDEEMED));
  core.devices.set(REDEEMED.deviceCredential, { id: REDEEMED.deviceId, state: 'PAIRED' });
}

async function mount(): Promise<{ live: MobileLive; unmount: () => void }> {
  act(() => {
    Dimensions.set({ window: { width: 411, height: 923, scale: 2, fontScale: 1 }, screen: { width: 411, height: 923, scale: 2, fontScale: 1 } });
  });
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  const { unmount } = render(
    <AppProviders
      sim={created.sim}
      queryClient={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } })}
      safeAreaMetrics={METRICS}
      heartbeatSocketFactory={() => new MockCoreSocket()}
    >
      <PairingScreen />
    </AppProviders>,
  );
  await flush();
  return { live: created, unmount };
}

const textOf = (testID: string): string => {
  const parts: string[] = [];
  const walk = (node: ReactTestInstance | string) => {
    if (typeof node === 'string') parts.push(node);
    else node.children.forEach(walk);
  };
  walk(screen.getByTestId(testID));
  return parts.join('');
};
const typeCode = (code: string): void => fireEvent.changeText(screen.getByTestId('pairing-code-input'), code);
const typedCode = (): unknown => screen.getByTestId('pairing-code-input').props.value;

/** Types the code, presses Pair and lets the connection steps run until the code has left and the answer landed. */
async function attempt(code: string): Promise<void> {
  typeCode(code);
  fireEvent.press(screen.getByTestId('pairing-pair'));
  await elapse(PAIR_TIMELINE.commitAt);
  await flush();
}

async function confirmUnpair(): Promise<void> {
  fireEvent.press(screen.getByTestId('pairing-unpair'));
  await settleUi();
  expect(screen.getByTestId('pairing-unpair-dialog')).toBeTruthy();
  fireEvent.press(screen.getByTestId('pairing-unpair-confirm'));
  await flush();
  await elapse(500);
  await settleUi(350);
}

beforeAll(async () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests();
  resetLoopRegistryForTests();
  resetMissingKeys();
  jest.clearAllMocks();
  mockRouter.canGoBack.mockImplementation(() => false);
  bootCore();
});

afterEach(() => {
  cleanup();
  mobile?.stop();
  expect(mobile?.live.errors().filter((report) => report.source.startsWith('live.misuse')) ?? []).toEqual([]);
  mobile = undefined;
  expect(getMissingKeys()).toEqual([]);
  fake.assertNoViolations();
});

describe('S1-8 `pair` (operation 18, §9.4 MP-5, MP-6)', () => {
  it('success: one redeem at `commitAt`, with no credential; on 201 the credential is stored and the gate is PAIRED', async () => {
    core.redeem = accepting(REDEEMED);
    const { live, unmount } = await mount();
    typeCode(MARKER_CODE);
    fireEvent.press(screen.getByTestId('pairing-pair'));
    await elapse(PAIR_TIMELINE.commitAt - 100);
    expect(requests('redeemPairingCode')).toHaveLength(0);
    await elapse(100);
    await flush();
    expect(requests('redeemPairingCode')).toHaveLength(1);
    expect(codeOf(requests('redeemPairingCode')[0]!)).toBe(MARKER_CODE);
    expect(bearerOf(requests('redeemPairingCode')[0]!.headers)).toBeNull();
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.deviceCredential)!)).toEqual(REDEEMED);
    expect(live.getPairing()).toEqual({ required: true, state: 'PAIRED', notice: null, deviceId: REDEEMED.deviceId });
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    expect(textOf('pairing-state-chip')).toBe('Paired');
    unmount();
  });

  it('refusal: 401 `INVALID_CODE` → "Code not accepted"; nothing stored; the gate stays UNPAIRED; the slots cleared', async () => {
    const { live, unmount } = await mount();
    await attempt(MARKER_CODE);
    expect(requests('redeemPairingCode')).toHaveLength(1);
    expect(screen.getByTestId('pairing-alert-invalid')).toBeTruthy();
    expect(screen.getByText('Code not accepted')).toBeTruthy();
    expect(typedCode()).toBe('');
    expect(store().keys()).toEqual([]);
    expect(live.getPairing()).toMatchObject({ state: 'UNPAIRED' });
    unmount();
  });

  it('outage: the request left and got no answer → the screen says the code may be used up; nothing stored; the code kept', async () => {
    core.redeem = () => OUTAGE;
    const { live, unmount } = await mount();
    await attempt(MARKER_CODE);
    expect(requests('redeemPairingCode')).toHaveLength(1);
    expect(screen.getByTestId('pairing-alert-unavailable')).toBeTruthy();
    expect(textOf('pairing-alert-body')).toBe('The Core server did not answer. If this code is refused now, ask a supervisor for a new one.');
    expect(typedCode()).toBe(MARKER_CODE);
    expect(store().keys()).toEqual([]);
    expect(live.getPairing()).toMatchObject({ state: 'UNPAIRED' });
    unmount();
  });
});

describe('S2-5 `usePairingFlow.unpair` with its consumer `pairing-screen.tsx` (operation 22, §9.4 MP-7)', () => {
  it('success: one unpair under the device credential; on 204 the credential is deleted and the gate is UNPAIRED with the notice', async () => {
    pairTablet();
    const { live, unmount } = await mount();
    expect(screen.getByTestId('pairing-paired-card')).toBeTruthy();
    await confirmUnpair();
    expect(requests('unpairDevice')).toHaveLength(1);
    expect(bearerOf(requests('unpairDevice')[0]!.headers)).toBe(REDEEMED.deviceCredential);
    expect(store().keys()).toEqual([]);
    expect(live.getPairing()).toEqual({ required: true, state: 'UNPAIRED', notice: 'unpaired', deviceId: null });
    expect(screen.getByTestId('pairing-notice-unpaired')).toBeTruthy();
    unmount();
  });

  it('refusal: the Core refuses the unpair (403 `DEVICE_REVOKED`) → the dialog closes and the gate shows the revocation of §6.6, never the "unpaired" notice of a success', async () => {
    pairTablet();
    core.unpair = () => refusal(403, 'DEVICE_REVOKED', 'This device was revoked.');
    const { live, unmount } = await mount();
    await confirmUnpair();
    expect(requests('unpairDevice')).toHaveLength(1);
    expect(screen.queryByTestId('pairing-unpair-dialog')).toBeNull();
    // The success path did not run: the screen never says the tablet was unpaired by this press.
    expect(screen.queryByTestId('pairing-notice-unpaired')).toBeNull();
    // The Core's answer is the revocation of §6.6, and the gate says so (not "unpaired").
    expect(live.getPairing()).toMatchObject({ required: true, notice: 'revoked' });
    expect(screen.getByTestId('pairing-notice-revoked')).toBeTruthy();
    unmount();
  });

  it('outage: with the link down the press is refused with the LB-6 toast; no request; nothing deleted; still PAIRED', async () => {
    pairTablet();
    const { live, unmount } = await mount();
    core.reachable = false;
    act(() => {
      lastSocket().drop();
    });
    await flush();
    await confirmUnpair();
    expect(screen.getAllByText('Core server unreachable').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nothing was changed.').length).toBeGreaterThan(0);
    expect(requests('unpairDevice')).toHaveLength(0);
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.deviceCredential)!)).toEqual(REDEEMED);
    expect(live.getPairing()).toMatchObject({ state: 'PAIRED', notice: null, deviceId: REDEEMED.deviceId });
    unmount();
  });
});
