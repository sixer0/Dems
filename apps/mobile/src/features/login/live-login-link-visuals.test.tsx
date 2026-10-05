// Row M2 follow-up (decision D180; findings L-1 and L-2 of gateway_check/09c §5): in LIVE mode the Login
// chip, the glow ring and the ambient loops read the runtime's notice and view of the Core link
// (`useCoreLinkNotice()` → `liveCoreLookOf`), not its two-valued `state`. Before, a cold start (the
// socket still connecting) showed "Core offline" and a critical ring while the offline Alert, which
// follows the runtime's rule, stayed hidden.
//
//  1. The look: every view × notice; the chip and the ring of every look; LIVE without a look reads
//     the view alone; SIMULATED and HEARTBEAT give exactly the answers of before (a verbatim copy of
//     the two former functions), whatever look is handed in.
//  2. L-2: the runtime never builds an ONLINE link with a STALE heartbeat, so the two `STALE` branches
//     are unreachable from it; they stay because step 75's test (a baseline file) pins them.
//  3. On the app's real Live source and the contract-checked fake transport (W59's harness):
//     a cold start shows no "Core offline" chip and no critical ring; a real outage shows both from the
//     first lost link and keeps them through a reconnect attempt (no flicker); the link back clears them.
//  4. Simulated and HEARTBEAT on the real providers: as before.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, within } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import { CORE_API_EXAMPLES, type PairingRedeemed } from '@dems/shared/api';
import type { HeartbeatState } from '@dems/shared/domain';
import { FAKE_CREDENTIALS, OUTAGE, createFakeTransport, type FakeConnection, type FakeHttpCall, type FakeReply, type FakeTransport } from '@dems/shared/live/testing';
import { GlowRing } from '@/components/composed/glow-ring';
import { TONE_ICONS } from '@/lib/tone-icons';
import type { GlowRingState } from '@/components/composed/glow-ring.math';
import { activeLoopNames, resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { AppProviders } from '@/providers';
import {
  coreLinkStateFor,
  createMobileLive,
  resetCoreErrorPresenterForTests,
  resetCoreLinkPrefsForTests,
  resetDebugLaunchForTests,
  setCoreLinkSource,
  useCoreLink,
  type CoreLinkInfo,
  type CoreLinkSource,
  type CoreLinkView,
  type MobileLive,
} from '@/runtime';
import { SECURE_ITEM_KEYS } from '@/runtime/secure-credentials';
import { FakeHeartbeatSocket, createTestSim, flushAsync } from '@/runtime/testing/test-sim';
import { LoginScreen } from './login-screen';
import { coreChipFor, liveCoreLookOf, ringStateFor, type CoreChip, type LiveCoreLook } from './login-model';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
  usePathname: () => '/login',
  useSegments: () => ['(app)'],
}));

const VIEWS: readonly CoreLinkView[] = ['up', 'settling', 'down', 'none'];
const LOOKS: readonly LiveCoreLook[] = ['up', 'connecting', 'offline'];
const HEARTBEATS: readonly HeartbeatState[] = ['CONNECTING', 'LIVE', 'STALE', 'OFFLINE'];

// ── 1. The look ──────────────────────────────────────────────────────────────────────────────

/** The two functions as they were before this row (`login-model.ts` at the M2b pre-image): the reference outside LIVE. */
function ringBefore({ coreLink, locked }: { coreLink: CoreLinkInfo; locked: boolean }): GlowRingState {
  if (locked) return 'attention';
  if (coreLink.state === 'OFFLINE') return 'critical';
  if (coreLink.heartbeat === 'STALE') return 'attention';
  return 'ready';
}
function chipBefore(coreLink: CoreLinkInfo): CoreChip {
  if (coreLink.state === 'OFFLINE') return { kind: 'OFFLINE', tone: 'danger' };
  if (coreLink.heartbeat === 'STALE') return { kind: 'STALE', tone: 'warning' };
  return { kind: 'ONLINE', tone: 'success' };
}

/** The runtime's LIVE link for a heartbeat (`sim-runtime-provider.tsx`, `LiveRuntime`). */
const liveLink = (heartbeat: HeartbeatState): CoreLinkInfo => ({ source: 'LIVE', state: coreLinkStateFor('LIVE', heartbeat, 'CONNECTED'), heartbeat });

describe('liveCoreLookOf: the runtime\'s notice and view of the link → the look of the LIVE chip and ring', () => {
  it('every view × notice: the notice or a down view is offline, up is up, settling without the notice is connecting', () => {
    for (const view of VIEWS) {
      for (const offline of [false, true]) {
        const expected: LiveCoreLook = offline || view === 'down' ? 'offline' : view === 'up' ? 'up' : 'connecting';
        expect([view, offline, liveCoreLookOf({ view, offline })]).toEqual([view, offline, expected]);
      }
    }
  });

  it('the chip and the ring of every look; a lockout still wins on the ring', () => {
    const link = liveLink('LIVE');
    expect(LOOKS.map((look) => [look, coreChipFor(link, look), ringStateFor({ coreLink: link, locked: false, liveLook: look })])).toEqual([
      ['up', { kind: 'ONLINE', tone: 'success' }, 'ready'],
      ['connecting', { kind: 'SETTLING', tone: 'warning' }, 'attention'],
      ['offline', { kind: 'OFFLINE', tone: 'danger' }, 'critical'],
    ]);
    for (const look of LOOKS) expect(ringStateFor({ coreLink: link, locked: true, liveLook: look })).toBe('attention');
  });

  it('LIVE: the look decides, not the two-valued state (a connecting link reads OFFLINE there)', () => {
    const connecting = liveLink('CONNECTING');
    expect(connecting.state).toBe('OFFLINE');
    expect(coreChipFor(connecting, 'connecting').kind).toBe('SETTLING');
    expect(ringStateFor({ coreLink: connecting, locked: false, liveLook: 'connecting' })).toBe('attention');
    // A reconnect attempt during an outage: the notice keeps the look offline.
    expect(coreChipFor(connecting, 'offline').kind).toBe('OFFLINE');
  });

  it('LIVE without a look reads the view alone: never critical while connecting', () => {
    expect(HEARTBEATS.map((heartbeat) => [heartbeat, coreChipFor(liveLink(heartbeat)).kind, ringStateFor({ coreLink: liveLink(heartbeat), locked: false })])).toEqual([
      ['CONNECTING', 'SETTLING', 'attention'],
      ['LIVE', 'ONLINE', 'ready'],
      ['STALE', 'OFFLINE', 'critical'],
      ['OFFLINE', 'OFFLINE', 'critical'],
    ]);
  });

  it('SIMULATED and HEARTBEAT: exactly the answers of before, for every state, heartbeat and lockout, whatever look is handed in', () => {
    const sources: readonly CoreLinkSource[] = ['SIMULATED', 'HEARTBEAT'];
    let cases = 0;
    for (const source of sources) {
      for (const state of ['ONLINE', 'OFFLINE'] as const) {
        for (const heartbeat of [undefined, ...HEARTBEATS]) {
          const coreLink: CoreLinkInfo = heartbeat === undefined ? { source, state } : { source, state, heartbeat };
          for (const look of [null, ...LOOKS]) {
            for (const locked of [false, true]) {
              cases += 1;
              expect([coreLink, look, locked, ringStateFor({ coreLink, locked, liveLook: look })]).toEqual([coreLink, look, locked, ringBefore({ coreLink, locked })]);
            }
            expect([coreLink, look, coreChipFor(coreLink, look)]).toEqual([coreLink, look, chipBefore(coreLink)]);
          }
        }
      }
    }
    expect(cases).toBe(2 * 2 * 5 * 4 * 2);
  });
});

// ── 2. L-2: the two STALE branches are unreachable from the runtime ────────────────────────────

describe('L-2: the runtime never builds an ONLINE link with a STALE heartbeat', () => {
  it('the state of every source × heartbeat × tablet link: a heartbeat that is not LIVE is OFFLINE in HEARTBEAT and LIVE', () => {
    for (const source of ['SIMULATED', 'HEARTBEAT', 'LIVE'] as const) {
      for (const heartbeat of HEARTBEATS) {
        for (const tablet of ['CONNECTED', 'OFFLINE'] as const) {
          const state = coreLinkStateFor(source, heartbeat, tablet);
          if (source !== 'SIMULATED') expect([source, heartbeat, tablet, state]).toEqual([source, heartbeat, tablet, heartbeat === 'LIVE' ? 'ONLINE' : 'OFFLINE']);
        }
      }
    }
  });

  it('the runtime builds a heartbeat into its link only for HEARTBEAT and LIVE, with the state of `coreLinkStateFor` (the only two places)', () => {
    const code = readFileSync(join(__dirname, '../../runtime/sim-runtime-provider.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(?<!:)\/\/.*$/gm, '');
    expect(code.match(/coreLinkStateFor\(/g)).toHaveLength(2);
    expect(code).toMatch(/state: coreLinkStateFor\(source, heartbeat, tabletLink\),\s*\.\.\.\(source === 'HEARTBEAT' \? \{ heartbeat \} : \{\}\),/);
    expect(code).toMatch(/\{ source: 'LIVE', state: coreLinkStateFor\('LIVE', heartbeat, tabletLink\), heartbeat \}/);
    const contract = readFileSync(join(__dirname, '../../runtime/contract.ts'), 'utf8');
    expect(contract).toMatch(/export const SIMULATED_ONLINE: CoreLinkInfo = \{ source: 'SIMULATED', state: 'ONLINE' \};/);
  });
});

// ── 3. LIVE on the real Live source ──────────────────────────────────────────────────────────

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 411, height: 923 }, insets: { top: 24, right: 0, bottom: 16, left: 0 } };
const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };

let fake: FakeTransport;
let mobile: MobileLive | undefined;
const core = { reachable: true, hold: false, held: [] as FakeConnection[] };

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
    act(() => fake.clock.advance(Math.min(step, ms - done)));
    await flush();
  }
}

/** The Core accepts the paired tablet's socket: hello DEVICE, then a heartbeat every interval. */
function serve(connection: FakeConnection): void {
  if (connection.state !== 'CONNECTING') return;
  if (!core.reachable) {
    connection.refuse();
    return;
  }
  if (bearerOf(connection.headers) === STORED.deviceCredential) connection.startDevice().heartbeat();
  else connection.startAnonymous().heartbeat();
  connection.beatEvery();
}

function bootCore(): void {
  fake = createFakeTransport({ epoch: 2, revision: 10 });
  core.reachable = true;
  core.hold = false;
  core.held = [];
  const answered = (operationId: Parameters<FakeTransport['answer']>[0], reply: (call: FakeHttpCall) => FakeReply): void =>
    fake.answer(operationId, (call) => (core.reachable ? reply(call) : OUTAGE));
  answered('getAuthSession', () => fake.example('getAuthSession', 401));
  answered('getSignInStatus', () => ({ status: 200, body: { locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 5, serverTime: fake.clock.now() } }));
  answered('getDeviceRegistration', (call) =>
    bearerOf(call.headers) === STORED.deviceCredential
      ? { status: 200, body: { deviceId: STORED.deviceId, name: 'Android device', state: 'PAIRED', pairedAt: STORED.pairedAt, credentialRotatedAt: null, core: STORED.core } }
      : fake.example('getDeviceRegistration', 401),
  );
  fake.onConnect((connection) => {
    if (core.hold && connection.state === 'CONNECTING') {
      core.held.push(connection);
      return;
    }
    serve(connection);
  });
}

function LinkProbe() {
  const link = useCoreLink();
  return <Text testID="link-probe">{`${link.source}/${link.state}/${link.heartbeat ?? '-'}`}</Text>;
}

async function mountLiveLogin(): Promise<void> {
  globalThis.__DEMS_SECURE_STORE_MOCK__.seed(SECURE_ITEM_KEYS.deviceCredential, JSON.stringify(STORED));
  const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
  if (created === null) throw new Error('jest is a debug build: a Live source is built');
  mobile = created;
  render(
    <AppProviders sim={created.sim} safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
      <LinkProbe />
      <LoginScreen />
    </AppProviders>,
  );
  await flush();
}

const link = (): string => screen.getByTestId('link-probe').props.children as string;
/** The chip's words (its label; the icon draws no text). */
const chipText = (): string =>
  within(screen.getByTestId('login-core-chip'))
    .UNSAFE_getAllByType(Text)
    .map((text) => String(text.props.children))
    .join(' ');
/** The chip's icon: the Wi-Fi mark or the alert triangle. */
const chipIcon = (): 'Wifi' | 'TriangleAlert' | 'other' => {
  const chip = within(screen.getByTestId('login-core-chip'));
  if (chip.UNSAFE_queryAllByType(TONE_ICONS.Wifi).length > 0) return 'Wifi';
  return chip.UNSAFE_queryAllByType(TONE_ICONS.TriangleAlert).length > 0 ? 'TriangleAlert' : 'other';
};
const ring = (): GlowRingState => screen.UNSAFE_getByType(GlowRing).props.state as GlowRingState;
const offlineAlert = (): boolean => screen.queryByTestId('login-alert-core-offline') !== null;

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
});

afterEach(() => {
  mobile?.stop();
  mobile = undefined;
});

describe('LIVE: the chip and the ring follow the runtime\'s view of the link (L-1)', () => {
  beforeEach(() => bootCore());
  afterEach(() => fake.assertNoViolations());

  it('a cold start (the socket still connecting) shows no "Core offline" chip and no critical ring; the first heartbeat makes them ready', async () => {
    core.hold = true;
    await mountLiveLogin();
    expect(core.held).toHaveLength(1);
    // The runtime's two-valued state reads OFFLINE, which is what the chip and the ring read before.
    expect(link()).toBe('LIVE/OFFLINE/CONNECTING');
    expect(chipText()).toBe('Connecting to Core…');
    expect(chipText()).not.toMatch(/offline/i);
    // The Wi-Fi mark in the warning tone, not the alert triangle of "Core offline".
    expect(chipIcon()).toBe('Wifi');
    expect(ring()).toBe('attention');
    expect(offlineAlert()).toBe(false);
    // Sign In stays disabled while the link is not ONLINE (L-3, unchanged).
    expect(screen.getByTestId('login-submit')).toBeDisabled();

    core.hold = false;
    act(() => serve(core.held[0]!));
    await flush();
    expect(link()).toBe('LIVE/ONLINE/LIVE');
    expect(chipText()).toBe('Core online');
    expect(ring()).toBe('ready');
    expect(offlineAlert()).toBe(false);
  });

  it('a real outage shows the "Core offline" chip and the critical ring with the Alert, keeps them through a reconnect attempt, and the link back clears them', async () => {
    await mountLiveLogin();
    expect(link()).toBe('LIVE/ONLINE/LIVE');
    expect([chipText(), ring(), offlineAlert()]).toEqual(['Core online', 'ready', false]);

    // The Core goes away: the socket is lost without a close frame.
    core.reachable = false;
    act(() => {
      fake.connection().drop();
    });
    await flush();
    expect(link()).toBe('LIVE/OFFLINE/OFFLINE');
    expect([chipText(), ring(), offlineAlert()]).toEqual(['Core offline', 'critical', true]);
    expect(chipIcon()).toBe('TriangleAlert');

    // A reconnect attempt that hangs in CONNECTING: the notice keeps the look offline (no flicker).
    core.hold = true;
    await elapse(1_000);
    expect(core.held.length).toBeGreaterThan(0);
    expect(link()).toBe('LIVE/OFFLINE/CONNECTING');
    expect([chipText(), ring(), offlineAlert()]).toEqual(['Core offline', 'critical', true]);

    // The Core is back and answers that attempt.
    core.reachable = true;
    core.hold = false;
    act(() => serve(core.held.at(-1)!));
    await flush();
    expect(link()).toBe('LIVE/ONLINE/LIVE');
    expect([chipText(), ring(), offlineAlert()]).toEqual(['Core online', 'ready', false]);
  });

  it('the ambient loops (full motion): at a cold start the gold dust runs and the chip does not breathe; in an outage the chip breathes and the dust yields', async () => {
    resetMotionStateForTests({ prefsHydrated: true });
    resetLoopRegistryForTests();
    core.hold = true;
    await mountLiveLogin();
    expect(link()).toBe('LIVE/OFFLINE/CONNECTING');
    expect(activeLoopNames()).toContain('login-gold-dust');
    expect(activeLoopNames()).not.toContain('login-core-breath');

    core.hold = false;
    act(() => serve(core.held[0]!));
    await flush();
    core.reachable = false;
    act(() => {
      fake.connection().drop();
    });
    await flush();
    expect(link()).toBe('LIVE/OFFLINE/OFFLINE');
    expect(activeLoopNames()).toContain('login-core-breath');
    expect(activeLoopNames()).not.toContain('login-gold-dust');
    core.reachable = true;
    await elapse(1_000);
    expect(link()).toBe('LIVE/ONLINE/LIVE');
    expect(activeLoopNames()).toContain('login-gold-dust');
    expect(activeLoopNames()).not.toContain('login-core-breath');
  });
});

// ── 4. Simulated and HEARTBEAT on the real providers ─────────────────────────────────────────

describe('SIMULATED and HEARTBEAT on the real providers: as before', () => {
  it('SIMULATED: "Core online" and a ready ring; the simulator\'s tablet link dropped: "Core offline" and a critical ring', async () => {
    const test = createTestSim();
    render(
      <AppProviders sim={test.sim} safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
        <LinkProbe />
        <LoginScreen />
      </AppProviders>,
    );
    await flushAsync();
    expect(link()).toBe('SIMULATED/ONLINE/-');
    expect([chipText(), ring()]).toEqual(['Core online', 'ready']);
    act(() => test.sim.actions.setTabletLink('OFFLINE'));
    await flushAsync();
    expect(link()).toBe('SIMULATED/OFFLINE/-');
    expect([chipText(), ring()]).toEqual(['Core offline', 'critical']);
  });

  it('HEARTBEAT: a heartbeat that is still connecting reads "Core offline" and a critical ring, as before (only LIVE changed)', async () => {
    setCoreLinkSource('HEARTBEAT');
    const test = createTestSim();
    render(
      <AppProviders sim={test.sim} safeAreaMetrics={METRICS} heartbeatSocketFactory={() => new FakeHeartbeatSocket()}>
        <LinkProbe />
        <LoginScreen />
      </AppProviders>,
    );
    await flushAsync();
    expect(link()).toBe('HEARTBEAT/OFFLINE/CONNECTING');
    expect([chipText(), ring()]).toEqual(['Core offline', 'critical']);
  });
});
