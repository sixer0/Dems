// Row FX-M1, defect E2E-S-3 (decision D201): a run the Core ended on purpose (4403, 4401) is no
// outage. On the phone of E2E-S-3 the Pair screen said "Core server unreachable" for about 1 s after
// a revocation, while the app deleted the retired credential and before it reopened its socket.
//
// The pure mapping of `ended-link.ts`, then the app's real Live source in the real `AppProviders`
// over the contract-checked fake transport. The deletion of the credential is HELD (the secure
// store's delete waits for the test), which is what the device's Keystore did for about 3 s under
// load; the probe reads the runtime's link, banner and notice inside that window.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { CORE_API_EXAMPLES, type PairingRedeemed } from '@dems/shared/api';
import type { HeartbeatState } from '@dems/shared/domain';
import type { LiveLinkState } from '@dems/shared/live';
import { FAKE_CREDENTIALS, createFakeTransport, type FakeConnection, type FakeHttpCall, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { AppProviders } from '@/providers';
import { useConnectionBanner } from './connection-banner';
import { useCoreLink, usePairing } from './contract';
import { resetCoreLinkPrefsForTests } from './core-link';
import { resetDebugLaunchForTests } from './debug';
import { heartbeatWhileEnded, isRunEndedByCore, liveLinkWhileEnded, useNoticeLiveLink } from './ended-link';
import { SECURE_ITEM_KEYS } from './secure-credentials';
import { createMobileLive, type MobileLive } from './sim-adapters';
import { useCoreLinkNotice } from './use-core-link-notice';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));

describe('the mapping (pure)', () => {
  it('an end of the run is read from the socket status only, and never throws', () => {
    expect(isRunEndedByCore(null)).toBe(false);
    expect(isRunEndedByCore(undefined)).toBe(false);
    expect(isRunEndedByCore({} as never)).toBe(false);
    expect(isRunEndedByCore({ socketStatus: () => ({ end: null }) })).toBe(false);
    expect(isRunEndedByCore({ socketStatus: () => ({ end: undefined }) })).toBe(false);
    expect(isRunEndedByCore({ socketStatus: () => ({ end: { kind: 'DEVICE_REVOKED', closeCode: 4403 } }) })).toBe(true);
    expect(
      isRunEndedByCore({
        socketStatus: () => {
          throw new Error('status not readable');
        },
      }),
    ).toBe(false);
  });

  it('only OFFLINE changes, and only while the run was ended on purpose', () => {
    const links: LiveLinkState[] = ['ONLINE', 'CONNECTING', 'RESYNCING', 'STALE', 'OFFLINE'];
    for (const link of links) {
      expect([link, liveLinkWhileEnded(link, false)]).toEqual([link, link]);
      expect([link, liveLinkWhileEnded(link, true)]).toEqual([link, link === 'OFFLINE' ? 'CONNECTING' : link]);
    }
    expect(liveLinkWhileEnded(null, true)).toBeNull();
    const beats: HeartbeatState[] = ['LIVE', 'CONNECTING', 'STALE', 'OFFLINE'];
    for (const beat of beats) {
      expect([beat, heartbeatWhileEnded(beat, false)]).toEqual([beat, beat]);
      expect([beat, heartbeatWhileEnded(beat, true)]).toEqual([beat, beat === 'OFFLINE' ? 'CONNECTING' : beat]);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// The real Live source in the real AppProviders
// ---------------------------------------------------------------------------------------------

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 411, height: 923 }, insets: { top: 24, right: 0, bottom: 16, left: 0 } };
const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
const store = () => globalThis.__DEMS_SECURE_STORE_MOCK__;
const storeModule = () => jest.requireMock<{ deleteItemAsync: jest.MockedFunction<(key: string) => Promise<void>> }>(['expo', 'secure', 'store'].join('-'));

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

let fake: FakeTransport;
let mobile: MobileLive | undefined;
let revoked = false;
let reachable = true;
const lastSocket = (): FakeConnection => fake.connection();
const bearerOf = (headers: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};

async function flush(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}
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
  revoked = false;
  reachable = true;
  fake.answer('getAuthSession', () => fake.example('getAuthSession', 401));
  fake.answer('getSignInStatus', () => fake.example('getSignInStatus', 200, 'open'));
  fake.answer('getDeviceRegistration', (call: FakeHttpCall) =>
    bearerOf(call.headers) === STORED.deviceCredential && !revoked
      ? { status: 200, body: { deviceId: STORED.deviceId, name: 'Android device', state: 'PAIRED', pairedAt: STORED.pairedAt, credentialRotatedAt: null, core: STORED.core } }
      : fake.example('getDeviceRegistration', 401),
  );
  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
    if (!reachable) {
      connection.refuse();
      return;
    }
    const bearer = bearerOf(connection.headers);
    if (bearer === STORED.deviceCredential && revoked) {
      connection.accept().hello('ANONYMOUS', { reason: 'DEVICE_REVOKED' }).close(4403);
      return;
    }
    if (bearer === STORED.deviceCredential) connection.startDevice().heartbeat();
    else connection.startAnonymous().heartbeat();
    connection.beatEvery();
  });
}

function Probe() {
  const link = useCoreLink();
  const banner = useConnectionBanner();
  const notice = useCoreLinkNotice();
  const pairLink = useNoticeLiveLink();
  const pairing = usePairing();
  return (
    <Text testID="probe">
      {[
        `link=${link.state}/${link.heartbeat ?? '-'}`,
        `banner=${banner.kind}`,
        `offline=${notice.offline}`,
        `view=${notice.view}`,
        `pair=${pairLink ?? '-'}`,
        `pairing=${pairing.state}/${pairing.notice ?? '-'}`,
      ].join(' ')}
    </Text>
  );
}
const probe = (): string => screen.getByTestId('probe').props.children as string;

async function mountPaired(): Promise<MobileLive> {
  store().seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  render(
    <AppProviders sim={created.sim} safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new MockCoreSocket()}>
      <Probe />
    </AppProviders>,
  );
  await flush();
  await elapse(1000);
  expect(probe()).toBe('link=ONLINE/LIVE banner=hidden offline=false view=up pair=ONLINE pairing=PAIRED/-');
  return created;
}

/** Holds every delete of the secure store until `release()`: the slow Keystore of the device. */
function holdDeletes(): { release: () => Promise<void>; restore: () => void } {
  const mock = storeModule().deleteItemAsync;
  const original = mock.getMockImplementation();
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  mock.mockImplementation(async (key: string) => {
    await gate;
    await original?.(key);
  });
  return {
    release: async () => {
      open();
      await flush();
    },
    restore: () => {
      if (original) mock.mockImplementation(original);
    },
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  store().reset();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  bootCore();
});

afterEach(() => {
  mobile?.stop();
  mobile = undefined;
  fake.assertNoViolations();
});

describe('E2E-S-3: a revocation (4403) is not drawn as an outage while the app reopens its socket', () => {
  it('revoked by `device.revoked` then 4403, the credential still being deleted: the link reads CONNECTING, no notice, no banner', async () => {
    const live = await mountPaired();
    const held = holdDeletes();
    try {
      revoked = true;
      act(() => {
        lastSocket().deviceRevoked('REVOKED');
      });
      await flush();
      act(() => {
        if (lastSocket().state === 'OPEN') lastSocket().close(4403);
      });
      await flush();
      // The window of E2E-S-3: the socket ENDED, the deletion not done, nothing reopened.
      expect(isRunEndedByCore(live.live)).toBe(true);
      expect(live.live.link).toBe('OFFLINE');
      expect(probe()).toBe('link=OFFLINE/CONNECTING banner=hidden offline=false view=settling pair=CONNECTING pairing=UNPAIRED/revoked');
      await elapse(1000);
      expect(probe()).toContain('offline=false');
      expect(probe()).toContain('banner=hidden');

      // The deletion lands; the Live source reopens the socket without the credential: ONLINE again.
      await held.release();
      await elapse(1000);
      expect(isRunEndedByCore(live.live)).toBe(false);
      expect(store().keys()).toEqual([]);
      expect(probe()).toBe('link=ONLINE/LIVE banner=hidden offline=false view=up pair=ONLINE pairing=UNPAIRED/revoked');
    } finally {
      held.restore();
    }
  });

  it('a lost socket is still an outage at once: the notice and the banner show (M0’s rule is untouched)', async () => {
    const live = await mountPaired();
    reachable = false;
    act(() => {
      lastSocket().close(1001, 'server going away');
    });
    await flush();
    expect(isRunEndedByCore(live.live)).toBe(false);
    expect(probe()).toBe('link=OFFLINE/OFFLINE banner=offline offline=true view=down pair=OFFLINE pairing=PAIRED/-');
    // The Core comes back: the reconnect answers, the notice goes.
    reachable = true;
    await elapse(10_000);
    expect(probe()).toContain('link=ONLINE/LIVE');
    expect(probe()).toContain('offline=false');
  });

  it('when the reopened socket cannot connect, the next OFFLINE shows the notice (the end is over once it reconnects)', async () => {
    const live = await mountPaired();
    const held = holdDeletes();
    try {
      revoked = true;
      act(() => {
        lastSocket().close(4403);
      });
      await flush();
      expect(probe()).toContain('offline=false');
      // The Core goes away while the credential is deleted.
      reachable = false;
      await held.release();
      await elapse(2000);
      expect(isRunEndedByCore(live.live)).toBe(false);
      expect(probe()).toContain('offline=true');
      expect(probe()).toContain('banner=offline');
    } finally {
      held.restore();
    }
  });
});
