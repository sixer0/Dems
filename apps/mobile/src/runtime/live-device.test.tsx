// Backend task W51: the app's Live source with its adapters (`createMobileLive`), mounted by the
// real `AppProviders`, over the contract-checked fake transport (04_client_integration_spec §9.1,
// §9.4 MP-9, MP-10, §6.3, §6.5, §6.6, §8.1; AC-C-49, AC-C-59, AC-C-78, AC-C-79; the Live source's
// brief list, rows 8 to 15, 25 to 27).
//
// The secure store is the in-memory one of `jest.setup.ts`. The credentials are the fake
// transport's own placeholders (`FAKE_CREDENTIALS`) and the contract's examples: no real value.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import {
  CORE_API_EXAMPLES,
  pickReplicatedState,
  type AuthSessionInfo,
  type DeviceRegistration,
  type PairingRedeemed,
  type ReplicatedState,
  type SignInResponse,
} from '@dems/shared/api';
import { CoreRefusalError, LiveTransportError, settle as settleAction, useCoreActions, useCorePermission } from '@dems/shared/live';
import { LIVE_SECRETS_TIMEOUT_MS } from '@dems/shared/live/source';
import { FAKE_CREDENTIALS, OUTAGE, createFakeTransport, rateLimited, refusal, type FakeConnection, type FakeHttpCall, type FakeReply, type FakeTransport } from '@dems/shared/live/testing';
import { useHeartbeat, type SocketLike } from '@dems/shared/realtime';
import { DEFAULT_SEED, createIdleState, roleHas, useSim, type SimState, type VisibilityAdapter } from '@dems/shared/sim';
import { AppProviders } from '@/providers';
import { useConnectionBanner } from './connection-banner';
import { isPairingBlocked, useCoreLink, usePairing, useRuntimeStatus } from './contract';
import { describeCoreError, resetCoreErrorPresenterForTests, useCoreErrorPresenter, type CoreErrorOutcome } from './core-errors';
import { DEFAULT_CORE_ADDRESS, coreOriginOf } from './core-address';
import { resetCoreLinkPrefsForTests } from './core-link';
import { resetDebugLaunchForTests } from './debug';
import { useRuntimeInternals } from './internals';
import { runtimeLog } from './log';
import { SECURE_ITEM_KEYS } from './secure-credentials';
import {
  DEVICE_CREDENTIAL_OPERATIONS,
  MOBILE_SECRETS_BUDGET_MS,
  createMobileLive,
  createMobileSocketFactory,
  mobileLiveOf,
  type LiveBiometricPort,
  type MobileLive,
} from './sim-adapters';
import { SimRuntimeProvider } from './sim-runtime-provider';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 411, height: 923 },
  insets: { top: 24, right: 0, bottom: 16, left: 0 },
};
const store = () => globalThis.__DEMS_SECURE_STORE_MOCK__;
/** The storage mock's own module (its name is put together, so that this file does not name the package: MP-1). */
const storeModule = () => jest.requireMock<{ getItemAsync: jest.MockedFunction<(key: string) => Promise<string | null>> }>(['expo', 'secure', 'store'].join('-'));
const PASSWORD = 'not-a-real-password';

const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
/** The credential the tablet holds: the fake transport's placeholder, in the shape of the contract. */
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
const REGISTRATION: DeviceRegistration = {
  deviceId: STORED.deviceId,
  name: 'Android device',
  state: 'PAIRED',
  pairedAt: STORED.pairedAt,
  credentialRotatedAt: null,
  core: { ...STORED.core, name: 'Interview Room 1 (confirmed)' },
};

class MockCoreSocket implements SocketLike {
  readyState = 0;
  closed = false;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.closed = true;
  }
}

/** What the Core server knows, and whether it answers: the model the fake's scripts read. */
interface CoreModel {
  /** The device credentials the registry holds, with their state. */
  devices: Map<string, 'PAIRED' | 'REVOKED'>;
  /** The open session of the tablet, by its token. */
  session: { token: string; info: AuthSessionInfo } | null;
  reachable: boolean;
  /** The state every OPERATOR socket gets as its snapshot. */
  state: SimState;
}

let fake: FakeTransport;
let core: CoreModel;
let mobile: MobileLive | undefined;
/** Every socket the mock-core heartbeat client of `HeartbeatProvider` opened. */
let mockCoreSockets: MockCoreSocket[] = [];
/** How often the runtime's resync bus was emitted (the "Resynced" banner and the route resync hang on it). */
let resyncs = 0;
let hidden = false;
let visibilityListeners: (() => void)[] = [];
const visibility: VisibilityAdapter = {
  isHidden: () => hidden,
  subscribe(onChange) {
    visibilityListeners.push(onChange);
    return () => {
      visibilityListeners = visibilityListeners.filter((listener) => listener !== onChange);
    };
  },
};

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState);
const bearerOf = (headers: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};
const requests = (operationId: string): readonly FakeHttpCall[] => fake.log.requestsOf(operationId);
const lastSocket = (): FakeConnection => fake.connection();

/** Promise jobs settle inside `act`: the fake's answers, the connect scripts, the storage mock. */
async function flush(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}
/** Moves the fake's clock (the Live source's timers run on it) in steps, with the promise jobs in between. */
async function elapse(ms: number, step = 250): Promise<void> {
  for (let done = 0; done < ms; done += step) {
    act(() => {
      fake.clock.advance(Math.min(step, ms - done));
    });
    await flush();
  }
}

function bootCore(): void {
  fake = createFakeTransport({ epoch: 2, revision: 10 });
  core = {
    devices: new Map(),
    session: null,
    reachable: true,
    state: createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }),
  };
  const sessionOf = (call: FakeHttpCall): CoreModel['session'] => (core.session !== null && bearerOf(call.headers) === core.session.token ? core.session : null);
  const deviceOf = (call: FakeHttpCall): 'PAIRED' | 'REVOKED' | null => {
    const bearer = bearerOf(call.headers);
    if (bearer === null) return null;
    if (core.session !== null && bearer === core.session.token) return 'PAIRED';
    return core.devices.get(bearer) ?? null;
  };
  const answered = (operationId: string, reply: (call: FakeHttpCall) => FakeReply): void => fake.answer(operationId, (call) => (core.reachable ? reply(call) : OUTAGE));

  answered('getAuthSession', (call) => {
    const session = sessionOf(call);
    return session ? { status: 200, body: { ...session.info, serverTime: fake.clock.now() } } : fake.example('getAuthSession', 401);
  });
  answered('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  answered('getServiceHealth', () => fake.example('getServiceHealth'));
  answered('getDeviceRegistration', (call) => {
    const device = deviceOf(call);
    if (device === 'PAIRED') return { status: 200, body: REGISTRATION };
    if (device === 'REVOKED') return refusal(403, 'DEVICE_REVOKED', 'This device was revoked.');
    return fake.example('getDeviceRegistration', 401);
  });
  answered('signIn', (call) => {
    if (deviceOf(call) !== 'PAIRED') return fake.example('signIn', 403, 'deviceNotPaired');
    const info: AuthSessionInfo = { ...DEVICE_SESSION, issuedAt: fake.clock.now(), lastActivityAt: fake.clock.now(), serverTime: fake.clock.now() };
    core.session = { token: FAKE_CREDENTIALS.sessionToken, info };
    return { status: 200, body: { session: info, sessionToken: FAKE_CREDENTIALS.sessionToken } satisfies SignInResponse };
  });
  answered('unpairDevice', (call) => {
    const bearer = bearerOf(call.headers);
    if (bearer === null || deviceOf(call) === null) return fake.example('unpairDevice', 401);
    core.devices.delete(bearer);
    return { status: 204 };
  });

  fake.onConnect((connection) => {
    // A socket the client already gave up gets no script.
    if (connection.state !== 'CONNECTING') return;
    if (!core.reachable) {
      connection.refuse();
      return;
    }
    const bearer = bearerOf(connection.headers);
    if (bearer === null) connection.startAnonymous().heartbeat();
    else if (core.session !== null && bearer === core.session.token) connection.startOperator(wire(core.state)).heartbeat();
    else if (core.devices.get(bearer) === 'PAIRED') connection.startDevice().heartbeat();
    else if (core.devices.get(bearer) === 'REVOKED') connection.accept().hello('ANONYMOUS', { reason: 'DEVICE_REVOKED' }).close(4403);
    // A bearer value that does not resolve: `hello` with the reason, then 4401.
    else connection.accept().hello('ANONYMOUS', { reason: 'SESSION_INVALID' }).close(4401);
  });
}

/** The tablet holds a credential the Core knows. */
function pairTablet(): void {
  store().seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
  core.devices.set(STORED.deviceCredential, 'PAIRED');
}

function createLive(): MobileLive {
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0, visibility });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  return created;
}

let mounts = 0;
/** Everything the tests look at, as one line of text. `mounts` counts mounts of the probe: a remount would be a reload. */
function Probe() {
  const [mount] = useState(() => {
    mounts += 1;
    return mounts;
  });
  const status = useRuntimeStatus();
  const link = useCoreLink();
  const pairing = usePairing();
  const banner = useConnectionBanner();
  const beat = useHeartbeat();
  const auth = useSim((s) => s.auth);
  const role = useSim((s) => s.operators.find((operator) => operator.id === s.auth.operatorId)?.role ?? null);
  const slice = useSim((s) => `${s.pairing.state}:${s.pairing.coreName || '-'}`);
  const mayExport = useCorePermission('EVIDENCE_EXPORT');
  return (
    <Text testID="probe">
      {[
        `mount=${mount}`,
        `ready=${status.ready}`,
        `link=${link.source}/${link.state}/${link.heartbeat ?? '-'}`,
        `pairing=${pairing.state}/${pairing.notice ?? '-'}/${pairing.deviceId ?? '-'}`,
        `blocked=${isPairingBlocked(pairing)}`,
        `banner=${banner.kind}`,
        `beat=${beat.state}`,
        `auth=${auth.status}/${auth.operatorId ?? '-'}`,
        `role=${role ?? '-'}`,
        // A gated control as the existing screens gate it (the static table on the replicated role) …
        `export=${roleHas(role, 'EVIDENCE_EXPORT') ? 'enabled' : 'disabled'}`,
        // … and as a new consumer gates it (the server's effective permission list).
        `hint=${mayExport ? 'yes' : 'no'}`,
        `slice=${slice}`,
      ].join(' ')}
    </Text>
  );
}
const probe = () => screen.getByTestId('probe').props.children as string;

const outcomes: CoreErrorOutcome[] = [];
const rejections: unknown[] = [];
/** A control that sends a command and hands a refusal to the presenter, as a call site of §8 does. */
function ArchiveButton() {
  const actions = useCoreActions();
  const present = useCoreErrorPresenter();
  return (
    <Pressable
      testID="archive"
      onPress={() =>
        settleAction(() => actions.archiveEvidence('EV-20260930-0004'), {
          fail: (error) => {
            rejections.push(error);
            outcomes.push(present.present(error));
          },
        })
      }
    >
      <Text>Archive</Text>
    </Pressable>
  );
}

/** Counts the emissions of the runtime's resync bus. */
function ResyncCounter() {
  const bus = useRuntimeInternals()?.resyncBus;
  useEffect(
    () =>
      bus?.subscribe(() => {
        resyncs += 1;
      }),
    [bus],
  );
  return null;
}

function mountLive(live: MobileLive = createLive(), extra: React.ReactNode = null) {
  return render(
    <AppProviders
      sim={live.sim}
      safeAreaMetrics={METRICS}
      heartbeatSocketFactory={() => {
        const socket = new MockCoreSocket();
        mockCoreSockets.push(socket);
        return socket;
      }}
    >
      <Probe />
      <ResyncCounter />
      {extra}
    </AppProviders>,
  );
}

async function signIn(live: MobileLive): Promise<void> {
  let result: unknown;
  await act(async () => {
    result = await live.live.actions.signIn('andi.pratama', PASSWORD);
  });
  expect(result).toMatchObject({ ok: true });
  await flush();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  storeModule().getItemAsync.mockClear();
  mockCoreSockets = [];
  resyncs = 0;
  mounts = 0;
  hidden = false;
  visibilityListeners = [];
  outcomes.length = 0;
  rejections.length = 0;
  bootCore();
});

afterEach(() => {
  mobile?.stop();
  mobile = undefined;
  // Every Live test ends here: what the client swallowed still fails the test.
  fake.assertNoViolations();
});

describe('the pairing state at start (MP-9, MP-10)', () => {
  it('no stored credential: CHECKING, then UNPAIRED; the socket is anonymous and operation 21 is not asked', async () => {
    const live = createLive();
    expect(live.getPairing()).toEqual({ required: true, state: 'CHECKING', notice: null, deviceId: null });
    expect(live.isReady()).toBe(false);
    // Creating the source reads nothing and sends nothing.
    expect(fake.log.entries).toHaveLength(0);

    const { unmount } = mountLive(live);
    expect(probe()).toContain('ready=false link=LIVE/OFFLINE/CONNECTING pairing=CHECKING/-/- blocked=true');
    await flush();
    expect(probe()).toContain('ready=true link=LIVE/ONLINE/LIVE pairing=UNPAIRED/-/- blocked=true banner=hidden beat=LIVE auth=SIGNED_OUT/-');
    expect(bearerOf(lastSocket().headers)).toBeNull();
    expect(lastSocket().principal).toBe('ANONYMOUS');
    // CL-7: one socket. A Live source that is there from the first frame meets a mock-core client
    // that `HeartbeatProvider` starts in the same commit: it is stopped again right after.
    expect(mockCoreSockets.length).toBeGreaterThan(0);
    expect(mockCoreSockets.every((socket) => socket.closed)).toBe(true);
    expect(fake.connections).toHaveLength(1);
    expect(requests('getDeviceRegistration')).toHaveLength(0);
    // Without a credential the only calls are the two public reads of the bootstrap.
    expect([...fake.log.operationIds()].sort()).toEqual(['getAuthSession', 'getSignInStatus']);
    for (const call of fake.calls) expect(call.headers.authorization).toBeUndefined();
    unmount();
  });

  it('a stored credential: PAIRED at once, before the Core answers; the runtime is ready after the storage read alone', async () => {
    pairTablet();
    const session = fake.hold('getAuthSession');
    const registration = fake.hold('getDeviceRegistration');
    const { unmount } = mountLive();
    await flush();
    // MP-10: `ready` waits for step 1 only. Neither question has an answer yet.
    expect(session.settled).toBe(false);
    expect(registration.settled).toBe(false);
    expect(probe()).toContain(`ready=true link=LIVE/ONLINE/LIVE pairing=PAIRED/-/${STORED.deviceId} blocked=false`);
    // The stored Core identity fills the `pairing` slice at once: the trust line has it while offline too.
    expect(probe()).toContain(`slice=PAIRED:${STORED.core.name}`);
    expect(lastSocket().principal).toBe('DEVICE');

    act(() => {
      // Nobody is signed in on a cold start: the session token lives in memory only.
      session.release(fake.example('getAuthSession', 401));
      registration.release({ status: 200, body: REGISTRATION });
    });
    await flush();
    // 200: confirmed; the slice now holds what the Core says.
    expect(probe()).toContain(`pairing=PAIRED/-/${REGISTRATION.deviceId}`);
    expect(probe()).toContain(`slice=PAIRED:${REGISTRATION.core.name}`);
    expect(requests('getDeviceRegistration')).toHaveLength(1);
    unmount();
  });

  it('the credential is read ONCE: every request and every socket afterwards takes it from memory (D81)', async () => {
    pairTablet();
    const live = createLive();
    const { unmount } = mountLive(live);
    await flush();
    const readsAtStart = storeReads();
    expect(readsAtStart).toBe(1);

    for (let call = 0; call < 3; call += 1) {
      await act(async () => {
        await live.live.client.call('getServiceHealth');
      });
    }
    act(() => {
      live.live.reconnect('RETRY');
    });
    await flush();
    expect(fake.connections).toHaveLength(2);
    expect(bearerOf(lastSocket().headers)).toBe(STORED.deviceCredential);
    expect(requests('getServiceHealth')).toHaveLength(3);
    for (const call of requests('getServiceHealth')) {
      expect(bearerOf(call.headers)).toBe(STORED.deviceCredential);
      expect(call.credentials).toBe('omit');
      expect(call.headers.cookie).toBeUndefined();
    }
    // Still one read of the secure store: the request path never touches storage.
    expect(storeReads()).toBe(readsAtStart);
    unmount();
  });

  it('an item that cannot be used counts as absent (MP-4): UNPAIRED, no credential presented, the item left as it is', async () => {
    store().seed(SECURE_ITEM_KEYS.deviceCredential, '{"deviceId":"DEV-0002"');
    const { unmount } = mountLive();
    await flush();
    expect(probe()).toContain('ready=true link=LIVE/ONLINE/LIVE pairing=UNPAIRED/-/-');
    expect(bearerOf(lastSocket().headers)).toBeNull();
    expect(requests('getDeviceRegistration')).toHaveLength(0);
    unmount();
  });

  it('a storage that does not answer: the device counts as unpaired after the budget, and the runtime becomes ready', async () => {
    pairTablet();
    storeModule().getItemAsync.mockImplementationOnce(() => new Promise<string | null>(() => undefined));
    const { unmount } = mountLive();
    await flush();
    expect(probe()).toContain('ready=false');
    expect(fake.log.entries).toHaveLength(0);
    await elapse(MOBILE_SECRETS_BUDGET_MS);
    expect(probe()).toContain('ready=true');
    expect(probe()).toContain('pairing=UNPAIRED/-/-');
    expect(bearerOf(lastSocket().headers)).toBeNull();
    expect(runtimeLog.records().some((record) => record.source === 'runtime.live.credentials.read' && record.level === 'error')).toBe(true);
    unmount();
  });

  it('the Core unreachable at start: the device stays PAIRED, and operation 21 is asked again when the link is up', async () => {
    pairTablet();
    core.reachable = false;
    const { unmount } = mountLive();
    await flush();
    expect(probe()).toContain(`ready=true link=LIVE/OFFLINE/`);
    expect(probe()).toContain(`pairing=PAIRED/-/${STORED.deviceId} blocked=false`);
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    const asked = requests('getDeviceRegistration').length;
    expect(asked).toBe(1);

    core.reachable = true;
    await elapse(1_000);
    expect(probe()).toContain('link=LIVE/ONLINE/LIVE');
    expect(requests('getDeviceRegistration')).toHaveLength(asked + 1);
    expect(probe()).toContain(`slice=PAIRED:${REGISTRATION.core.name}`);
    // An answer ends the asking: later changes of the link do not ask again.
    act(() => {
      mobile?.live.reconnect('RETRY');
    });
    await flush();
    expect(requests('getDeviceRegistration')).toHaveLength(asked + 1);
    unmount();
  });
});

/** Reads of the device-credential item through the storage mock since the test began. */
function storeReads(): number {
  return storeModule().getItemAsync.mock.calls.filter(([key]) => key === SECURE_ITEM_KEYS.deviceCredential).length;
}

describe('a credential the Core does not know (AC-C-79, MP-10)', () => {
  it('401 on operation 21: the stored items are deleted, the gate is UNPAIRED with the notice `unknown`, and the socket is reopened without a credential', async () => {
    store().seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
    store().seed(SECURE_ITEM_KEYS.biometricToken, FAKE_CREDENTIALS.biometricToken);
    store().seed(SECURE_ITEM_KEYS.biometricMarker, JSON.stringify({ operatorId: 'OPR-001', displayName: 'AKP Budi Santoso', deviceId: STORED.deviceId, protected: false }));
    // The registry holds no such credential: another database, or a re-created one.
    const { unmount } = mountLive();
    await flush();

    expect(requests('getDeviceRegistration')).toHaveLength(1);
    expect(bearerOf(requests('getDeviceRegistration')[0]!.headers)).toBe(STORED.deviceCredential);
    expect(requests('getDeviceRegistration')[0]!.status).toBe(401);
    expect(store().keys()).toEqual([]);
    expect(probe()).toContain('pairing=UNPAIRED/unknown/- blocked=true');
    expect(probe()).toContain('slice=UNPAIRED:-');
    expect(probe()).toContain('auth=SIGNED_OUT/-');
    // The first socket presented the credential and was closed with 4401; the one opened after
    // the deletion presents nothing and stays.
    expect(bearerOf(fake.connection(0).headers)).toBe(STORED.deviceCredential);
    expect(fake.connection(0).closed).toMatchObject({ by: 'server', code: 4401 });
    expect(bearerOf(lastSocket().headers)).toBeNull();
    expect(lastSocket().state).toBe('OPEN');
    expect(probe()).toContain('link=LIVE/ONLINE/LIVE');
    // Nothing that left the tablet after the socket was reopened carries the credential.
    const reopenedAt = fake.log.sockets[fake.log.sockets.length - 1]!.seq;
    await act(async () => {
      await mobile?.live.client.call('getServiceHealth');
    });
    const later = fake.calls.filter((entry) => entry.seq > reopenedAt);
    expect(later.map((entry) => entry.operationId)).toContain('getServiceHealth');
    for (const call of later) expect(call.headers.authorization).toBeUndefined();
    expect(JSON.stringify(runtimeLog.records())).not.toContain(STORED.deviceCredential);
    unmount();
  });

  it('the socket alone says so (close 4401 with nobody signed in): operation 21 is asked, and its 401 deletes the credential', async () => {
    pairTablet();
    const { unmount } = mountLive();
    await flush();
    expect(probe()).toContain(`pairing=PAIRED/-/${REGISTRATION.deviceId}`);
    const asked = requests('getDeviceRegistration').length;

    // The Core forgets the device (its database was re-created) and closes the socket.
    core.devices.clear();
    act(() => {
      lastSocket().close(4401);
    });
    await flush();
    expect(requests('getDeviceRegistration')).toHaveLength(asked + 1);
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(false);
    expect(probe()).toContain('pairing=UNPAIRED/unknown/-');
    expect(bearerOf(lastSocket().headers)).toBeNull();
    unmount();
  });

  it('a 4401 while the Core cannot be asked deletes nothing: the device stays PAIRED', async () => {
    pairTablet();
    const { unmount } = mountLive();
    await flush();
    core.reachable = false;
    act(() => {
      lastSocket().close(4401);
    });
    await flush();
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    expect(probe()).toContain(`pairing=PAIRED/-/${REGISTRATION.deviceId}`);
    unmount();
  });
});

describe('a revoked device (AC-C-78, §6.6)', () => {
  async function pairedAndSignedIn(): Promise<{ live: MobileLive; unmount: () => void }> {
    pairTablet();
    store().seed(SECURE_ITEM_KEYS.biometricToken, FAKE_CREDENTIALS.biometricToken);
    store().seed(SECURE_ITEM_KEYS.biometricMarker, JSON.stringify({ operatorId: DEVICE_SESSION.operator.id, displayName: 'AKP Budi Santoso', deviceId: STORED.deviceId, protected: false }));
    const live = createLive();
    const { unmount } = mountLive(live);
    await flush();
    await signIn(live);
    expect(probe()).toContain(`auth=SIGNED_IN/${DEVICE_SESSION.operator.id}`);
    // The sign-in answer's token is in memory before the socket is reopened: the new socket presents it.
    expect(bearerOf(lastSocket().headers)).toBe(FAKE_CREDENTIALS.sessionToken);
    expect(lastSocket().principal).toBe('OPERATOR');
    return { live, unmount };
  }

  /**
   * `sentBefore`: the number of requests the fake had seen when the revocation reached the tablet
   * (for the REST trigger: the refused call included).
   */
  async function expectRevoked(notice: 'revoked' | 'unpaired', sentBefore: number): Promise<void> {
    // The three items are gone, the operator is signed out, the gate is closed with the notice.
    expect(store().keys()).toEqual([]);
    expect(probe()).toContain('auth=SIGNED_OUT/-');
    expect(probe()).toContain(`pairing=UNPAIRED/${notice}/- blocked=true`);
    expect(probe()).toContain('slice=UNPAIRED:-');
    // Neither the session token nor the device credential is presented again: not by the socket
    // that was reopened, and not by ANY request after the revocation (decision D116: refused calls
    // with a retired credential would fill the denial budget the next pairing shares).
    expect(bearerOf(lastSocket().headers)).toBeNull();
    await act(async () => {
      await mobile?.live.client.call('getServiceHealth');
      await mobile?.live.client.call('getDeviceRegistration');
    });
    await elapse(3_000, 500);
    const after = fake.calls.slice(sentBefore);
    expect(after.length).toBeGreaterThan(0);
    for (const call of after) expect([call.operationId, call.headers.authorization]).toEqual([call.operationId, undefined]);
    for (const connection of fake.connections.filter((entry) => entry.state !== 'CLOSED')) expect(bearerOf(connection.headers)).toBeNull();
  }

  it('`device.revoked` REVOKED on the socket', async () => {
    const { unmount } = await pairedAndSignedIn();
    core.devices.set(STORED.deviceCredential, 'REVOKED');
    core.session = null;
    const sentBefore = fake.calls.length;
    act(() => {
      lastSocket().deviceRevoked('REVOKED');
    });
    await flush();
    await expectRevoked('revoked', sentBefore);
    expect(mobile?.live.lastSessionEnd).toMatchObject({ kind: 'DEVICE_REVOKED', reason: 'REVOKED', wasSignedIn: true });
    unmount();
  });

  it('a close with 4403 and no message before it', async () => {
    const { unmount } = await pairedAndSignedIn();
    core.devices.set(STORED.deviceCredential, 'REVOKED');
    core.session = null;
    const sentBefore = fake.calls.length;
    act(() => {
      lastSocket().close(4403);
    });
    await flush();
    await expectRevoked('revoked', sentBefore);
    unmount();
  });

  it('a 403 `DEVICE_REVOKED` on a REST call', async () => {
    const { live, unmount } = await pairedAndSignedIn();
    // The Core revoked the device and this tablet has not heard it on its socket yet: the next
    // call of a device operation is answered 403 DEVICE_REVOKED.
    fake.answerOnce('getDeviceRegistration', refusal(403, 'DEVICE_REVOKED', 'This device was revoked.'));
    core.devices.set(STORED.deviceCredential, 'REVOKED');
    core.session = null;
    let answer: { ok: boolean; status: number | null } | undefined;
    const sentBefore = fake.calls.length;
    await act(async () => {
      answer = await live.live.client.call('getDeviceRegistration');
    });
    await flush();
    expect(answer).toMatchObject({ ok: false, status: 403 });
    // The refused call is the last request that carried a credential.
    await expectRevoked('revoked', sentBefore + 1);
    expect(mobile?.live.lastSessionEnd).toMatchObject({ kind: 'DEVICE_REVOKED', source: 'REST' });
    unmount();
  });

  it('`device.revoked` UNPAIRED: the same deletion, with the notice `unpaired`', async () => {
    const { unmount } = await pairedAndSignedIn();
    core.devices.delete(STORED.deviceCredential);
    core.session = null;
    const sentBefore = fake.calls.length;
    act(() => {
      lastSocket().deviceRevoked('UNPAIRED');
    });
    await flush();
    await expectRevoked('unpaired', sentBefore);
    unmount();
  });

  it('a sign-out keeps the pairing: the session token is dropped, the device credential is presented again', async () => {
    const { live, unmount } = await pairedAndSignedIn();
    fake.answer('signOut', () => {
      core.session = null;
      return { status: 204 };
    });
    await act(async () => {
      await live.live.actions.signOut('USER');
    });
    await flush();
    expect(probe()).toContain('auth=SIGNED_OUT/-');
    expect(probe()).toContain(`pairing=PAIRED/-/${REGISTRATION.deviceId} blocked=false`);
    expect(bearerOf(lastSocket().headers)).toBe(STORED.deviceCredential);
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    unmount();
  });

  it('the clean-up that gave up (brief row 14): the credential is forgotten and the socket is asked for anew', async () => {
    const { unmount } = await pairedAndSignedIn();
    // The Core answers EVERY socket with 4403 from now on, whatever it presents.
    const stop = fake.onConnect((connection) => {
      if (connection.state === 'OPEN') connection.close(4403);
    });
    core.devices.set(STORED.deviceCredential, 'REVOKED');
    core.session = null;
    const sentBefore = fake.calls.length;
    act(() => {
      lastSocket().deviceRevoked('REVOKED');
    });
    // The source asks the app's storage again after 2 s, 4 s and 8 s, then gives up and says so once.
    await elapse(20_000, 500);
    const gaveUp = runtimeLog.records().filter((record) => record.source === 'live.secrets' && record.context?.errorCode === 'DEVICE_CLEANUP_GAVE_UP');
    expect(gaveUp).toHaveLength(1);
    stop();
    const before = fake.connections.length;
    await elapse(1_000);
    // `reconnect('CREDENTIAL')` after the report: a socket was opened, without a credential.
    expect(fake.connections.length).toBeGreaterThanOrEqual(before);
    expect(bearerOf(lastSocket().headers)).toBeNull();
    expect(mobile?.live.socketStatus().lastReconnectReason).toBe('CREDENTIAL');
    await expectRevoked('revoked', sentBefore);
    unmount();
  });
});

describe('operations that want the device itself (decision D118)', () => {
  it('the biometric sign-in carries the DEVICE credential while a session token is in memory; every other call carries the session token', async () => {
    pairTablet();
    const live = createLive();
    live.setBiometricPort({ token: () => FAKE_CREDENTIALS.biometricToken });
    const { unmount } = mountLive(live);
    await flush();
    await signIn(live);
    // A session token is in memory now.
    await act(async () => {
      await live.live.client.call('getServiceHealth');
    });
    expect(bearerOf(requests('getServiceHealth')[0]!.headers)).toBe(FAKE_CREDENTIALS.sessionToken);

    // The other operation of the list, called as a page would call it: the device credential.
    fake.answer('rotateDeviceCredential', fake.example('rotateDeviceCredential'));
    await act(async () => {
      await live.live.client.call('rotateDeviceCredential');
    });
    expect(bearerOf(requests('rotateDeviceCredential')[0]!.headers)).toBe(STORED.deviceCredential);
    expect([...DEVICE_CREDENTIAL_OPERATIONS].sort()).toEqual(['rotateDeviceCredential', 'signInWithBiometric']);
    // A call right after it is the session's again: the choice is per operation, not a switch.
    await act(async () => {
      await live.live.client.call('getServiceHealth');
    });
    expect(bearerOf(requests('getServiceHealth')[1]!.headers)).toBe(FAKE_CREDENTIALS.sessionToken);
    expect(probe()).toContain(`auth=SIGNED_IN/${DEVICE_SESSION.operator.id}`);

    // The biometric sign-in, sent while that session token is still in memory.
    fake.answer('signInWithBiometric', fake.example('signInWithBiometric', 401));
    await act(async () => {
      await live.live.actions.signInWithBiometric(DEVICE_SESSION.operator.id).then(
        () => undefined,
        () => undefined,
      );
    });
    await flush();
    const sent = requests('signInWithBiometric');
    expect(sent).toHaveLength(1);
    expect(bearerOf(sent[0]!.headers)).toBe(STORED.deviceCredential);
    expect(bearerOf(sent[0]!.headers)).not.toBe(FAKE_CREDENTIALS.sessionToken);
    expect(sent[0]!.body).toEqual({ token: FAKE_CREDENTIALS.biometricToken });
    expect(sent[0]!.credentials).toBe('omit');
    unmount();
  });

  it('403 `DEVICE_NOT_PAIRED` with `details.reason: DEVICE_CREDENTIAL_REQUIRED` is an ordinary failed action: the credential stays, the gate stays PAIRED, nobody is signed out', async () => {
    pairTablet();
    const live = createLive();
    live.setBiometricPort({ token: () => FAKE_CREDENTIALS.biometricToken });
    const { unmount } = mountLive(live);
    await flush();
    await signIn(live);
    const sockets = fake.connections.length;
    const required = refusal(403, 'DEVICE_NOT_PAIRED', 'This operation needs the device credential.', { reason: 'DEVICE_CREDENTIAL_REQUIRED' });

    // As an action …
    fake.answer('signInWithBiometric', required);
    let failure: unknown;
    let outcome: unknown;
    await act(async () => {
      await live.live.actions.signInWithBiometric(DEVICE_SESSION.operator.id).then(
        (value) => {
          outcome = value;
        },
        (error: unknown) => {
          failure = error;
        },
      );
    });
    // … and as a call of a page.
    fake.answer('rotateDeviceCredential', required);
    let answer: { ok: boolean; status: number | null; error?: { code: string } } | undefined;
    await act(async () => {
      answer = await live.live.client.call('rotateDeviceCredential');
    });
    await flush();
    await elapse(3_000, 500);

    expect(outcome).toBeUndefined();
    expect(failure).toBeInstanceOf(CoreRefusalError);
    expect(failure).toMatchObject({ code: 'DEVICE_NOT_PAIRED', status: 403 });
    expect(answer).toMatchObject({ ok: false, status: 403, error: { code: 'DEVICE_NOT_PAIRED' } });
    // It reads as a refused action, never as "this tablet is not paired".
    expect(describeCoreError(failure)).toMatchObject({ kind: 'REFUSED', label: { key: 'mobile.live.refusal.refused' } });

    // Nothing of the pairing moved: the stored credential, the gate, the replica's slice, the session.
    expect(store().has(SECURE_ITEM_KEYS.deviceCredential)).toBe(true);
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.deviceCredential)!)).toEqual(STORED);
    expect(probe()).toContain(`pairing=PAIRED/-/${REGISTRATION.deviceId} blocked=false`);
    expect(probe()).toContain(`slice=PAIRED:${REGISTRATION.core.name}`);
    expect(probe()).toContain(`auth=SIGNED_IN/${DEVICE_SESSION.operator.id}`);
    expect(live.live.lastSessionEnd).toBeNull();
    expect(fake.connections).toHaveLength(sockets);
    // The device credential is still what the device operations present.
    await act(async () => {
      await live.live.client.call('rotateDeviceCredential');
    });
    expect(bearerOf(requests('rotateDeviceCredential')[1]!.headers)).toBe(STORED.deviceCredential);
    unmount();
  });
});

describe('a 429 on redeem (decision D116)', () => {
  it('means "wait `retry-after`", never "wrong code": the action rejects as a limit and no failed attempt is counted', async () => {
    const live = createLive();
    const { unmount } = mountLive(live);
    await flush();
    const before = live.live.store.getState().pairing;
    fake.answer('redeemPairingCode', rateLimited(41));

    let failure: unknown;
    let outcome: unknown;
    await act(async () => {
      await live.live.actions.pair('000000').then(
        (value) => {
          outcome = value;
        },
        (error: unknown) => {
          failure = error;
        },
      );
    });
    await flush();
    // Not the result union of a wrong code: a transport error that keeps the status and the seconds.
    expect(outcome).toBeUndefined();
    expect(failure).toBeInstanceOf(LiveTransportError);
    expect(failure).toMatchObject({ reason: 'UNAVAILABLE', status: 429, retryAfterSeconds: 41 });
    expect(describeCoreError(failure)).toMatchObject({ kind: 'LIMIT', retryAfterSeconds: 41, outage: false });
    // The replica's pairing slice counts no failed attempt and shows no lock.
    expect(live.live.store.getState().pairing).toEqual(before);
    expect(probe()).toContain('pairing=UNPAIRED/-/- blocked=true');
    expect(probe()).toContain('link=LIVE/ONLINE/LIVE');
    expect(store().keys()).toEqual([]);
    // One request: nothing was retried by itself.
    expect(requests('redeemPairingCode')).toHaveLength(1);
    unmount();
  });
});

describe('`session.updated`: a role change while signed in (AC-C-49, §6.3)', () => {
  it('the gated controls change in place and one notice names the new role; nobody is signed out, nothing is reloaded', async () => {
    pairTablet();
    const live = createLive();
    const { unmount } = mountLive(live);
    await flush();
    await signIn(live);
    const operatorId = DEVICE_SESSION.operator.id;
    expect(probe()).toContain(`mount=1 `);
    expect(probe()).toContain(`auth=SIGNED_IN/${operatorId} role=INVESTIGATOR export=disabled hint=no`);
    expect(screen.queryByText('Your role is now Supervisor. The available actions have changed.')).toBeNull();
    const signIns = requests('signIn').length;
    const sockets = fake.connections.length;

    // The supervisor of the portal assigns another role: the Core tells this session and replaces the `operators` slice.
    const operators = live.live.store.getState().operators.map((operator) => (operator.id === operatorId ? { ...operator, role: 'SUPERVISOR' as const } : operator));
    act(() => {
      lastSocket().sessionUpdated({ id: operatorId, role: 'SUPERVISOR' }, ['SESSION_START', 'SESSION_NOTE', 'EVIDENCE_VIEW', 'DIAGNOSTICS_RUN', 'EVIDENCE_REVIEW', 'EVIDENCE_EXPORT', 'AUDIT_EXPORT']);
      lastSocket().delta([{ op: 'replace', slice: 'operators', value: operators }]);
    });
    await flush();

    expect(probe()).toContain(`auth=SIGNED_IN/${operatorId} role=SUPERVISOR export=enabled hint=yes`);
    // The notice, once.
    expect(screen.getAllByText('Your role is now Supervisor. The available actions have changed.').length).toBeGreaterThan(0);
    // No reload (the probe was not mounted again), no sign-in, no new socket.
    expect(probe()).toContain('mount=1 ');
    expect(requests('signIn')).toHaveLength(signIns);
    expect(fake.connections).toHaveLength(sockets);
    expect(live.live.lastSessionEnd).toBeNull();

    // The other direction: back to Investigator, the control is disabled again.
    act(() => {
      lastSocket().sessionUpdated({ id: operatorId, role: 'INVESTIGATOR' }, ['SESSION_START', 'SESSION_NOTE', 'EVIDENCE_VIEW', 'DIAGNOSTICS_RUN']);
      lastSocket().delta([{ op: 'replace', slice: 'operators', value: operators.map((operator) => (operator.id === operatorId ? { ...operator, role: 'INVESTIGATOR' as const } : operator)) }]);
    });
    await flush();
    expect(probe()).toContain('role=INVESTIGATOR export=disabled hint=no');
    expect(screen.getAllByText('Your role is now Investigator. The available actions have changed.').length).toBeGreaterThan(0);
    unmount();
  });
});

describe('offline, and a limit (AC-C-59, LB-6, LB-10, CL-22)', () => {
  it('link down: a command rejects at once, five presses show 1 toast (one drawn toast, outcomes shown + 4 coalesced), and no request is sent', async () => {
    pairTablet();
    const live = createLive();
    const { unmount } = mountLive(live, <ArchiveButton />);
    await flush();
    await signIn(live);

    // The Core goes away: the socket is lost.
    core.reachable = false;
    act(() => {
      lastSocket().drop();
    });
    await flush();
    expect(probe()).toContain('link=LIVE/OFFLINE/');
    expect(probe()).toContain('banner=offline');
    const sent = fake.calls.length;

    expect(screen.queryByText('Core server unreachable')).toBeNull();
    fireEvent.press(screen.getByTestId('archive'));
    // "At once": the press was refused in its own turn, before any promise job.
    expect(rejections).toHaveLength(1);
    await flush();
    // One toast is on screen (the kit draws its text more than once: count what one toast draws).
    const drawnByOneToast = screen.getAllByText('Core server unreachable').length;
    expect(drawnByOneToast).toBeGreaterThan(0);
    expect(screen.getAllByText('Nothing was changed.')).toHaveLength(drawnByOneToast);

    for (let press = 1; press < 5; press += 1) fireEvent.press(screen.getByTestId('archive'));
    expect(rejections).toHaveLength(5);
    for (const error of rejections) {
      expect(error).toBeInstanceOf(LiveTransportError);
      expect((error as LiveTransportError).reason).toBe('CORE_OFFLINE');
      expect((error as LiveTransportError).status).toBeNull();
    }
    await flush();
    // Five presses, one toast.
    expect(outcomes).toEqual(['shown', 'coalesced', 'coalesced', 'coalesced', 'coalesced']);
    expect(screen.getAllByText('Core server unreachable')).toHaveLength(drawnByOneToast);
    // No request left the tablet for any of the five.
    expect(fake.calls).toHaveLength(sent);
    expect(requests('archiveEvidence')).toHaveLength(0);
    unmount();
  });

  it('a 429 is worded as a limit, with the seconds of `retry-after`; the link, the banner and the mode stay as they are', async () => {
    pairTablet();
    const live = createLive();
    const { unmount } = mountLive(live, <ArchiveButton />);
    await flush();
    await signIn(live);
    fake.answer('archiveEvidence', rateLimited(37));
    const before = probe();

    await act(async () => {
      fireEvent.press(screen.getByTestId('archive'));
      await Promise.resolve();
    });
    await flush();
    expect(requests('archiveEvidence')).toHaveLength(1);
    expect(rejections[0]).toBeInstanceOf(LiveTransportError);
    expect(rejections[0]).toMatchObject({ reason: 'UNAVAILABLE', status: 429, retryAfterSeconds: 37 });
    expect(outcomes).toEqual(['shown']);
    expect(screen.getAllByText('The Core server is limiting requests from this device').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Try again in 37 s.').length).toBeGreaterThan(0);
    // Never the offline wording, never a changed link.
    expect(screen.queryByText('Core server unreachable')).toBeNull();
    expect(probe()).toBe(before);
    expect(probe()).toContain('link=LIVE/ONLINE/LIVE');
    expect(probe()).toContain('banner=hidden');
    unmount();
  });
});

describe('the link comes back ([CS:§3.5])', () => {
  it('the resync bus is emitted once when the Live socket is back: the "Resynced" banner, and the route resync that hangs on the bus', async () => {
    pairTablet();
    const { unmount } = mountLive();
    await flush();
    expect(resyncs).toBe(0);
    expect(probe()).toContain('banner=hidden');

    act(() => {
      lastSocket().drop();
    });
    await flush();
    expect(probe()).toContain('link=LIVE/OFFLINE/');
    expect(probe()).toContain('banner=offline');
    expect(resyncs).toBe(0);

    // The first reconnect delay is 500 ms.
    await elapse(1_000);
    expect(fake.connections).toHaveLength(2);
    expect(probe()).toContain('link=LIVE/ONLINE/LIVE');
    expect(probe()).toContain('banner=resynced');
    expect(resyncs).toBe(1);
    unmount();
  });
});

describe('coming back to the foreground (brief row 15)', () => {
  it('a STALE link is reconnected at once; an ONLINE link is left alone', async () => {
    pairTablet();
    const live = createLive();
    const { unmount } = mountLive(live);
    await flush();
    expect(fake.connections).toHaveLength(1);

    // In the background and back while the link is ONLINE: nothing happens.
    hidden = true;
    act(() => visibilityListeners.forEach((listener) => listener()));
    hidden = false;
    act(() => visibilityListeners.forEach((listener) => listener()));
    await flush();
    expect(fake.connections).toHaveLength(1);

    // No heartbeat for longer than the stale limit, while the app is in the background.
    hidden = true;
    act(() => visibilityListeners.forEach((listener) => listener()));
    await elapse(3_500, 500);
    expect(live.live.link).toBe('STALE');
    expect(probe()).toContain('link=LIVE/OFFLINE/STALE');
    expect(fake.connections).toHaveLength(1);

    hidden = false;
    act(() => visibilityListeners.forEach((listener) => listener()));
    await flush();
    expect(fake.connections).toHaveLength(2);
    expect(live.live.socketStatus().lastReconnectReason).toBe('RETRY');
    expect(probe()).toContain('link=LIVE/ONLINE/LIVE');
    unmount();
  });
});

describe('the secrets port of a device (brief rows 11 to 13)', () => {
  it('`pair`: the credential is in the secure store before the action settles; the gate opens; the next socket presents it', async () => {
    const live = createLive();
    const { unmount } = mountLive(live);
    await flush();
    expect(probe()).toContain('pairing=UNPAIRED/-/-');
    let storedWhenAnswered: boolean | null = null;
    fake.answer('redeemPairingCode', () => {
      core.devices.set(REDEEMED.deviceCredential, 'PAIRED');
      return fake.example('redeemPairingCode', 201);
    });

    let settledWith: unknown;
    await act(async () => {
      const result = live.live.actions.pair('000000');
      void result.then((value) => {
        storedWhenAnswered = store().has(SECURE_ITEM_KEYS.deviceCredential);
        settledWith = value;
      });
      await result;
    });
    await flush();
    expect(settledWith).toMatchObject({ ok: true });
    expect(storedWhenAnswered).toBe(true);
    expect(JSON.parse(store().peek(SECURE_ITEM_KEYS.deviceCredential)!)).toEqual(REDEEMED);
    expect(store().isProtected(SECURE_ITEM_KEYS.deviceCredential)).toBe(false);
    expect(probe()).toContain(`pairing=PAIRED/-/${REDEEMED.deviceId} blocked=false`);
    expect(bearerOf(lastSocket().headers)).toBe(REDEEMED.deviceCredential);
    expect(lastSocket().principal).toBe('DEVICE');
    // The redeem request named the device, without a hardware identifier (MP-5).
    expect(requests('redeemPairingCode')[0]!.body).toEqual({ code: '000000', deviceName: expect.any(String), platform: 'android', appVersion: expect.any(String) });
    // The redeem answer is the Core's own word: operation 21 is not asked on top of it.
    expect(requests('getDeviceRegistration')).toHaveLength(0);
    unmount();
  });

  it('a credential that cannot be stored: the action is refused as NOT_AVAILABLE, the registration is removed with ONE unpair, and nothing is kept', async () => {
    const live = createLive();
    const { unmount } = mountLive(live);
    await flush();
    fake.answer('redeemPairingCode', () => {
      core.devices.set(REDEEMED.deviceCredential, 'PAIRED');
      return fake.example('redeemPairingCode', 201);
    });
    store().failNext('write');

    let failure: unknown;
    await act(async () => {
      await live.live.actions.pair('000000').then(
        () => undefined,
        (error: unknown) => {
          failure = error;
        },
      );
    });
    await flush();
    expect(failure).toBeInstanceOf(CoreRefusalError);
    expect((failure as CoreRefusalError).code).toBe('NOT_AVAILABLE');
    // One unpair, with the credential that could not be kept; the Core's registry is clean again.
    expect(requests('unpairDevice')).toHaveLength(1);
    expect(bearerOf(requests('unpairDevice')[0]!.headers)).toBe(REDEEMED.deviceCredential);
    expect(core.devices.size).toBe(0);
    expect(store().keys()).toEqual([]);
    expect(probe()).toContain('pairing=UNPAIRED/-/- blocked=true');
    // Memory is empty again: a later request presents nothing.
    await act(async () => {
      await live.live.client.call('getServiceHealth');
    });
    expect(requests('getServiceHealth')[0]!.headers.authorization).toBeUndefined();
    // The failure is in the log by the port's name; the credential is not.
    expect(JSON.stringify(runtimeLog.records())).not.toContain(REDEEMED.deviceCredential);
    unmount();
  });

  it('a biometric storage that fails, or does not answer, never costs the session', async () => {
    pairTablet();
    const live = createLive();
    live.setBiometricPort({
      token: () => null,
      sessionIssued: () => {
        throw new Error('MARKER-STORAGE-TEXT');
      },
    });
    const { unmount } = mountLive(live);
    await flush();
    await signIn(live);
    expect(probe()).toContain(`auth=SIGNED_IN/${DEVICE_SESSION.operator.id}`);
    const failed = runtimeLog.records().filter((record) => record.source === 'runtime.live.biometricPort');
    expect(failed.length).toBeGreaterThan(0);
    // By the name of the error only: the storage's own text is not passed on.
    expect(JSON.stringify(failed)).not.toContain('MARKER-STORAGE-TEXT');
    expect(failed[0]!.context).toEqual({ errorName: 'Error' });

    // One that never answers: the port gives up inside the Live source's own wait, and the sign-in stands.
    fake.answer('signOut', () => {
      core.session = null;
      return { status: 204 };
    });
    await act(async () => {
      await live.live.actions.signOut('USER');
    });
    await flush();
    live.setBiometricPort({ token: () => null, sessionIssued: () => new Promise<void>(() => undefined) });
    let result: unknown;
    await act(async () => {
      const pending = live.live.actions.signIn('andi.pratama', PASSWORD);
      void pending.then((value) => {
        result = value;
      });
      for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
      fake.clock.advance(MOBILE_SECRETS_BUDGET_MS);
      for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
    });
    await flush();
    expect(result).toMatchObject({ ok: true });
    expect(probe()).toContain(`auth=SIGNED_IN/${DEVICE_SESSION.operator.id}`);
    unmount();
  });

  it('W93-16 (FXR-M): a credential write slower than the budget — the late outcome is logged with its time, and a write that lands after the failure is removed again', async () => {
    const live = createLive();
    const { unmount } = mountLive(live);
    await flush();
    fake.answer('redeemPairingCode', () => {
      core.devices.set(REDEEMED.deviceCredential, 'PAIRED');
      return fake.example('redeemPairingCode', 201);
    });
    // The keystore answers only when the test releases it (a real slow write, not a starved thread).
    const credentials = jest.requireActual<typeof import('./secure-credentials')>('./secure-credentials');
    const original = credentials.writeDeviceCredential;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = jest.spyOn(credentials, 'writeDeviceCredential').mockImplementation(async (value) => {
      await gate;
      return original(value);
    });
    const from = runtimeLog.records().length;
    let failure: unknown;
    try {
      await act(async () => {
        const pending = live.live.actions.pair('000000').then(
          () => undefined,
          (error: unknown) => {
            failure = error;
          },
        );
        for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
        fake.clock.advance(MOBILE_SECRETS_BUDGET_MS + 1_500); // the write is 5.5 s in when it lands
        for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
        release();
        await pending;
      });
      await flush();
      await flush();
    } finally {
      spy.mockRestore();
    }
    expect(failure).toBeInstanceOf(CoreRefusalError);
    const records = runtimeLog.records().slice(from);
    const budget = records.filter((r) => r.source === 'runtime.live.credentials.write');
    expect(budget[0]).toMatchObject({ level: 'error', context: expect.objectContaining({ budgetMs: MOBILE_SECRETS_BUDGET_MS, elapsedAtBudgetMs: expect.any(Number) }) });
    const late = records.filter((r) => r.source === 'runtime.live.credentials.lateWrite');
    expect(late).toHaveLength(1);
    expect(late[0]!.context).toMatchObject({ late: true, ok: true, budgetMs: MOBILE_SECRETS_BUDGET_MS, deviceId: REDEEMED.deviceId });
    expect(Number(late[0]!.context?.elapsedMs)).toBeGreaterThanOrEqual(MOBILE_SECRETS_BUDGET_MS);
    // Nothing is kept that the app says it does not hold; the credential is never in the log.
    expect(store().keys()).toEqual([]);
    expect(JSON.stringify(records)).not.toContain(REDEEMED.deviceCredential);
    unmount();
  });

  it('the budget of a storage call is inside the wait of the Live source', () => {
    expect(MOBILE_SECRETS_BUDGET_MS).toBeGreaterThan(0);
    expect(MOBILE_SECRETS_BUDGET_MS).toBeLessThan(LIVE_SECRETS_TIMEOUT_MS);
  });

  it('the biometric port of the sign-in row is passed the rotated token, after the session token is in memory', async () => {
    pairTablet();
    const live = createLive();
    const seen: { biometricToken: string | null; operatorId: string; socketBearerNext: string | null }[] = [];
    const port: LiveBiometricPort = {
      token: () => null,
      sessionIssued: (issued) => {
        seen.push({ ...issued, socketBearerNext: null });
      },
    };
    live.setBiometricPort(port);
    const { unmount } = mountLive(live);
    await flush();
    await signIn(live);
    expect(seen).toEqual([{ biometricToken: null, operatorId: DEVICE_SESSION.operator.id, socketBearerNext: null }]);
    expect(bearerOf(lastSocket().headers)).toBe(FAKE_CREDENTIALS.sessionToken);

    // Without a stored token a biometric sign-in sends nothing.
    let failure: unknown;
    const signInsBefore = fake.calls.length;
    live.setBiometricPort(null);
    await act(async () => {
      await live.live.actions.signInWithBiometric(DEVICE_SESSION.operator.id).then(
        () => undefined,
        (error: unknown) => {
          failure = error;
        },
      );
    });
    expect(failure).toBeInstanceOf(CoreRefusalError);
    expect(fake.calls).toHaveLength(signInsBefore);
    unmount();
  });
});

describe('what the runtime exposes (MP-3)', () => {
  it('the adapters object has no member that returns a credential; the Live source is found behind its `Sim`', () => {
    pairTablet();
    const live = createLive();
    expect(Object.keys(live).sort()).toEqual(['getPairing', 'isReady', 'live', 'ready', 'setBiometricPort', 'sim', 'start', 'stop', 'subscribe']);
    expect(mobileLiveOf(live.sim)).toBe(live);
    expect(live.sim).toBe(live.live);
  });

  it('nothing the app can read back holds the credential: the pairing gate, the store of the replica, the log', async () => {
    pairTablet();
    const live = createLive();
    const { unmount } = mountLive(live);
    await flush();
    await signIn(live);
    const visible = JSON.stringify([live.getPairing(), live.live.store.getState(), live.live.session, live.live.socketStatus(), live.live.errors(), runtimeLog.records()]);
    expect(visible).not.toContain(STORED.deviceCredential);
    expect(visible).not.toContain(FAKE_CREDENTIALS.sessionToken);
    expect(visible).not.toMatch(/(?:dvc|ses|bio)_/);
    unmount();
  });

  it('pass D5, `mediaTransport()`: null without an operator session (the device credential is never offered); then the Core origin + the session header, which does not print, serialise or reach the log; null again after sign-out', async () => {
    pairTablet();
    const live = createLive();
    const { unmount } = mountLive(live);
    await flush();
    // Paired, nobody signed in: the device credential is in memory and is NOT handed out.
    expect(live.live.mediaTransport()).toBeNull();
    await signIn(live);
    const transport = live.live.mediaTransport();
    // D263 (row 236): the origin of the runtime's address source (its default here). Moved pin: was CORE_SERVER_HTTP_ORIGIN.
    expect(transport?.origin).toBe(coreOriginOf(DEFAULT_CORE_ADDRESS).http);
    // NEGATIVE CONTROL: the header is there, read by name.
    expect(transport?.headers).toEqual({ Authorization: `Bearer ${FAKE_CREDENTIALS.sessionToken}` });
    expect(Object.keys(transport ?? {})).toEqual(['origin']);
    const visible = [JSON.stringify(transport), String(transport), JSON.stringify({ ...transport }), JSON.stringify([live.live.store.getState(), live.live.errors(), runtimeLog.records()])].join('\n');
    expect(visible).not.toContain(FAKE_CREDENTIALS.sessionToken);
    expect(visible).not.toContain(STORED.deviceCredential);
    fake.answer('signOut', () => {
      core.session = null;
      return { status: 204 };
    });
    await act(async () => {
      await live.live.actions.signOut('USER');
    });
    await flush();
    expect(live.live.mediaTransport()).toBeNull();
    unmount();
  });

  it('the socket factory of the app passes the headers as React Native takes them, and offers no subprotocol', () => {
    const factory = createMobileSocketFactory(fake.WebSocket as never);
    factory('ws://127.0.0.1:4420/ws', { Authorization: `Bearer ${FAKE_CREDENTIALS.deviceCredential}` });
    factory('ws://127.0.0.1:4420/ws', undefined);
    expect(fake.connections).toHaveLength(2);
    expect(bearerOf(fake.connection(0).headers)).toBe(FAKE_CREDENTIALS.deviceCredential);
    expect(fake.connection(0).protocols).toEqual([]);
    expect(fake.connection(1).headers).toEqual({});
    for (const connection of fake.connections) connection.accept().hello('ANONYMOUS').close(1001);
  });

  it('a Live source that was built without the adapters is refused by the provider, with a message that says what to inject', async () => {
    const { asSim, createLiveSim } = jest.requireActual<typeof import('@dems/shared/live/source')>('@dems/shared/live/source');
    const { createCoreClient } = jest.requireActual<typeof import('@dems/shared/client')>('@dems/shared/client');
    const bare = createLiveSim({
      client: createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: () => null, fetch: fake.fetch }),
      socket: { url: 'ws://127.0.0.1:4420/ws', factory: fake.socketFactory },
      now: fake.clock.now,
      timers: fake.clock.timers,
      autoStart: false,
    });
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <SimRuntimeProvider sim={asSim(bare)}>
          <Text>never</Text>
        </SimRuntimeProvider>,
      ),
    ).toThrow(/createMobileLive\(options\)\.sim/);
    error.mockRestore();
    expect(fake.log.entries).toHaveLength(0);
  });
});
