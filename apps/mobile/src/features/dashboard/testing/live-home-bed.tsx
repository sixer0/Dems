/**
 * Test-only bed of backend task W66 (never import from app code): Home and More over the app's own
 * Live source (`createMobileLive`) and the contract-checked fake transport, inside the real
 * `AppProviders` (implementation/51 §4 "Build a Live source in a test").
 *
 * The Core server is a small model the fake's scripts read: one paired tablet, one operator, the one
 * open session, the replicated state the operator socket sends as its snapshot, and a switch that
 * makes the server unreachable (every request an outage, every new socket refused after a second of
 * CONNECTING, so the reconnect attempts show). The credentials are the shared testing placeholders,
 * which open nothing; the password is a marker. Nothing here names the Core server's address.
 *
 * The test files keep their own module mocks (jest hoists `jest.mock` per file).
 */
import type { jest } from '@jest/globals';
import { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StrictMode, useEffect, type ReactElement, type ReactNode } from 'react';
import { Dimensions, Text } from 'react-native';
import type { Metrics } from 'react-native-safe-area-context';
import type { ReactTestInstance } from 'react-test-renderer';
import {
  CORE_API_EXAMPLES,
  EXAMPLE_ALERT,
  pickReplicatedState,
  type AuthSessionInfo,
  type DeviceRegistration,
  type PairingRedeemed,
  type ReplicatedState,
} from '@dems/shared/api';
import { FAKE_CREDENTIALS, OUTAGE, createFakeTransport, type FakeAnswer, type FakeConnection, type FakeHttpCall, type FakeReply, type FakeTransport } from '@dems/shared/live/testing';
import type { SocketLike } from '@dems/shared/realtime';
import { DEFAULT_SEED, createIdleState, type SimAlert, type SimState } from '@dems/shared/sim';
import { AppProviders } from '@/providers';
import { createMobileLive, useAuth, useCoreLink, type AuthContract, type MobileLive } from '@/runtime';

export const WINDOWS = {
  phonePortrait: { width: 411, height: 923 },
  phoneLandscape: { width: 923, height: 411 },
  tabletPortrait: { width: 800, height: 1280 },
  tabletLandscape: { width: 1280, height: 800 },
} as const;
export type WindowName = keyof typeof WINDOWS;

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 411, height: 923 },
  insets: { top: 24, right: 0, bottom: 16, left: 0 },
};

/** The secure-store item of the device credential (`runtime/secure-credentials.ts`; seeded through the mock, report 51 §4). */
const DEVICE_ITEM = 'dems.live.device.v1';
/** A marker, not a credential of anything. */
const MARKER_PASSWORD = ['MARKER', 'PW', 'w66', 'Hm7'].join('-');
const REDEEMED = CORE_API_EXAMPLES.redeemPairingCode?.responses[201]?.paired?.value as PairingRedeemed;
const DEVICE_SESSION = CORE_API_EXAMPLES.getAuthSession?.responses[200]?.pairedDevice?.value as AuthSessionInfo;
const STORED: PairingRedeemed = { ...REDEEMED, deviceCredential: FAKE_CREDENTIALS.deviceCredential };
export const OPERATOR = DEVICE_SESSION.operator;
const REGISTRATION: DeviceRegistration = {
  deviceId: STORED.deviceId,
  name: 'Android device',
  state: 'PAIRED',
  pairedAt: STORED.pairedAt,
  credentialRotatedAt: null,
  core: STORED.core,
};
/** The Core's name for this tablet, as the server sent it with the pairing. */
export const CORE_NAME = STORED.core.name;
const IDLE_MS = 15 * 60_000;
const ABSOLUTE_MS = 8 * 60 * 60_000;
/** How long a socket stays CONNECTING before an unreachable server refuses it. */
export const REFUSE_AFTER_MS = 1_000;

/** One unacknowledged alert, in the contract's own example form. */
export const ALERT: SimAlert = { ...(EXAMPLE_ALERT as SimAlert) };

class MockHeartbeatSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.readyState = 3;
  }
}

const bearerOf = (headers: Readonly<Record<string, unknown>> | undefined): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
};
/** Not narrowed by an earlier test of `state` (the state changes inside the calls between). */
const isOpen = (connection: FakeConnection): boolean => connection.state === 'OPEN';
const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState);

export interface HomeBed {
  readonly fake: FakeTransport;
  /** What the Core holds: the snapshot of an operator socket is built from it. */
  state: SimState;
  reachable: boolean;
  /** The heartbeat of the runtime's link, one entry per change (the outage tests read it). */
  readonly heartbeats: string[];
  /** Mounts `ui` (shown while an operator is signed in) over a new Live source; `strict` wraps `ui` alone in `<StrictMode>`. */
  mount(ui: ReactElement, window?: WindowName, options?: { strict?: boolean }): MobileLive;
  setWindow(window: WindowName): void;
  signIn(): Promise<void>;
  /** The Core server goes away: the open socket is lost, and every request and socket after it fails. */
  goDown(): void;
  /** The Core server is back: the next reconnect attempt is accepted. */
  comeBack(): void;
  /** Moves the fake clock in steps, letting the app react after each one; `sample` runs after every step. */
  elapse(ms: number, step?: number, sample?: () => void): Promise<void>;
  /** The operator socket that is open now. */
  operatorSocket(): FakeConnection;
  requestsOf(operationId: string): readonly FakeHttpCall[];
  stop(): void;
}

/** Sets the window the layout class is read from (the four classes of `@/layout`). */
export function setWindow(window: WindowName): void {
  const { width, height } = WINDOWS[window];
  act(() => {
    Dimensions.set({ window: { width, height, scale: 2, fontScale: 1 }, screen: { width, height, scale: 2, fontScale: 1 } });
  });
}

export async function flush(turns = 40): Promise<void> {
  await act(async () => {
    for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
  });
}

export function createHomeBed(options: { alerts?: readonly SimAlert[] } = {}): HomeBed {
  const fake = createFakeTransport({ epoch: 3, revision: 20 });
  const now = () => fake.clock.now();
  const idle = createIdleState({ now: now(), seed: DEFAULT_SEED });
  const latest: { auth: AuthContract | null } = { auth: null };
  let session: { token: string; info: AuthSessionInfo } | null = null;
  let mobile: MobileLive | null = null;

  const bed: HomeBed = {
    fake,
    state: { ...idle, alerts: [...idle.alerts, ...(options.alerts ?? [])] },
    reachable: true,
    heartbeats: [],
    mount,
    setWindow,
    signIn,
    goDown,
    comeBack,
    elapse,
    operatorSocket,
    requestsOf: (operationId) => fake.log.requestsOf(operationId),
    stop: () => {
      mobile?.stop();
      mobile = null;
    },
  };

  const sessionOf = (call: FakeHttpCall) => (session !== null && bearerOf(call.headers) === session.token ? session : null);
  const isDevice = (call: FakeHttpCall) => bearerOf(call.headers) === STORED.deviceCredential;
  const answered = (operationId: string, reply: (call: FakeHttpCall) => FakeReply): void => fake.answer(operationId, (call) => (bed.reachable ? reply(call) : OUTAGE));

  answered('getAuthSession', (call) => {
    const open = sessionOf(call);
    return open ? { status: 200, body: { ...open.info, serverTime: now() } } : fake.example('getAuthSession', 401);
  });
  answered('getSignInStatus', () => ({ status: 200, body: { locked: false, lockedUntil: null, retryInMs: 0, attemptsRemaining: 5, serverTime: now() } }));
  answered('getDeviceRegistration', (call) => (sessionOf(call) !== null || isDevice(call) ? { status: 200, body: REGISTRATION } : fake.example('getDeviceRegistration', 401)));
  answered('signIn', (call): FakeAnswer => {
    if (!isDevice(call)) return fake.example('signIn', 403, 'deviceNotPaired');
    if ((call.body as { password?: string }).password !== MARKER_PASSWORD) return fake.example('signIn', 401);
    const info: AuthSessionInfo = {
      ...DEVICE_SESSION,
      method: 'PASSWORD',
      deviceId: STORED.deviceId,
      issuedAt: now(),
      lastActivityAt: now(),
      idleExpiresAt: now() + IDLE_MS,
      absoluteExpiresAt: now() + ABSOLUTE_MS,
      serverTime: now(),
    };
    session = { token: FAKE_CREDENTIALS.sessionToken, info };
    return { status: 200, body: { session: info, sessionToken: session.token } };
  });
  answered('signOut', () => {
    session = null;
    return { status: 204 };
  });
  answered('touchSession', (call) => {
    const open = sessionOf(call);
    return open ? { status: 200, body: { idleExpiresAt: now() + IDLE_MS, absoluteExpiresAt: open.info.absoluteExpiresAt } } : fake.example('touchSession', 401);
  });
  // Operation 70, as the Core does it: the alert is acknowledged for every console (a delta), then 204.
  answered('acknowledgeAlert', (call) => {
    const id = call.params['id'];
    bed.state = { ...bed.state, alerts: bed.state.alerts.map((alert) => (alert.id === id ? { ...alert, acknowledged: true } : alert)) };
    operatorSocket().delta([{ op: 'replace', slice: 'alerts', value: wire(bed.state).alerts }]);
    return { status: 204 };
  });

  fake.onConnect((connection) => {
    if (connection.state !== 'CONNECTING') return;
    if (!bed.reachable) {
      // The reconnect attempt is visible for a moment (CONNECTING), then the upgrade fails.
      fake.clock.schedule(REFUSE_AFTER_MS, () => {
        if (connection.state === 'CONNECTING') connection.refuse();
      });
      return;
    }
    const bearer = bearerOf(connection.headers);
    if (bearer === null) connection.startAnonymous().heartbeat();
    else if (session !== null && bearer === session.token) connection.startOperator(wire(bed.state)).heartbeat();
    else if (bearer === STORED.deviceCredential) connection.startDevice().heartbeat();
    else connection.accept().hello('ANONYMOUS', { reason: 'SESSION_INVALID' }).close(4401);
    if (isOpen(connection)) connection.beatEvery();
  });

  function Probe() {
    const auth = useAuth();
    const link = useCoreLink();
    const seen = `${link.source}/${link.heartbeat ?? '-'}`;
    useEffect(() => {
      latest.auth = auth;
    });
    useEffect(() => {
      bed.heartbeats.push(seen);
    }, [seen]);
    return <Text testID="bed-probe">{`auth=${auth.isAuthenticated ? (auth.operator?.id ?? '?') : 'signed-out'} link=${link.source}/${link.state}/${link.heartbeat ?? '-'}`}</Text>;
  }

  function WhenSignedIn({ children }: { children: ReactNode }) {
    return useAuth().isAuthenticated ? children : null;
  }

  function mount(ui: ReactElement, window: WindowName = 'phonePortrait', options: { strict?: boolean } = {}): MobileLive {
    globalThis.__DEMS_SECURE_STORE_MOCK__.seed(DEVICE_ITEM, JSON.stringify(STORED));
    setWindow(window);
    const created = createMobileLive({ fetch: fake.fetch, socketFactory: fake.socketFactory, now: fake.clock.now, timers: fake.clock.timers, random: () => 0 });
    if (created === null) throw new Error('jest is a debug build: a Live source is built');
    mobile = created;
    render(
      <AppProviders
        sim={created.sim}
        queryClient={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } } })}
        safeAreaMetrics={METRICS}
        heartbeatSocketFactory={() => new MockHeartbeatSocket()}
      >
        <Probe />
        <WhenSignedIn>{options.strict === true ? <StrictMode>{ui}</StrictMode> : ui}</WhenSignedIn>
      </AppProviders>,
    );
    return created;
  }

  async function signIn(): Promise<void> {
    await flush();
    if (latest.auth === null) throw new Error('the bed is not mounted');
    const auth = latest.auth;
    let ok = false;
    await act(async () => {
      ok = (await auth.signIn(OPERATOR.username, MARKER_PASSWORD)).ok;
    });
    await flush();
    if (!ok) throw new Error('the bed could not sign in');
  }

  function operatorSocket(): FakeConnection {
    const found = [...fake.connections].reverse().find((connection) => connection.principal === 'OPERATOR' && connection.state === 'OPEN');
    if (!found) throw new Error('no open OPERATOR socket');
    return found;
  }

  function goDown(): void {
    bed.reachable = false;
    act(() => {
      operatorSocket().drop();
    });
  }

  function comeBack(): void {
    bed.reachable = true;
  }

  async function elapse(ms: number, step = 250, sample?: () => void): Promise<void> {
    for (let done = 0; done < ms; done += step) {
      act(() => {
        fake.clock.advance(Math.min(step, ms - done));
      });
      await flush();
      sample?.();
    }
  }

  return bed;
}

// ── Reading the screen ────────────────────────────────────────────────────────────────────────

export const label = (testID: string): string => screen.getByTestId(testID).props.accessibilityLabel as string;

/** The `tone` a kit `StatusChip` was given (read from the composite element that carries the test ID). */
export function toneOf(testID: string): string | undefined {
  const tones = screen.UNSAFE_getAllByProps({ testID }).map((node) => node.props.tone as unknown).filter((tone): tone is string => typeof tone === 'string');
  return tones[0];
}

/** Whether an element is on screen, as a plain boolean (a failed match never prints a whole render tree). */
export const shows = (testID: string): boolean => screen.queryByTestId(testID) !== null;

export function textOf(testID: string): string {
  const parts: string[] = [];
  const walk = (node: ReactTestInstance | string) => {
    if (typeof node === 'string') parts.push(node);
    else node.children.forEach(walk);
  };
  walk(screen.getByTestId(testID));
  return parts.join('');
}

/** Every text and every accessibility label inside `testID`: what the operator can read or hear. */
export function wordsUnder(testID: string): string[] {
  const words: string[] = [];
  const walk = (node: ReactTestInstance | string) => {
    if (typeof node === 'string') {
      words.push(node);
      return;
    }
    for (const key of ['accessibilityLabel', 'accessibilityHint', 'aria-label', 'placeholder'] as const) {
      const value: unknown = node.props?.[key];
      if (typeof value === 'string') words.push(value);
    }
    node.children.forEach(walk);
  };
  walk(screen.getByTestId(testID));
  return words;
}

/**
 * The kit's Popover opens only after measuring its trigger; React Native's Jest mocks `measure` as a
 * no-op, so give the trigger's native instance a layout (the pattern of `dashboard-screen.test.tsx`).
 */
export function stubMeasure(testID: string): void {
  let node: ReactTestInstance | null = screen.getByTestId(testID);
  while (node) {
    const instance = node.instance as { measure?: jest.Mock } | null;
    if (instance && typeof instance.measure === 'function' && 'mockImplementation' in instance.measure) {
      instance.measure.mockImplementation((...args: unknown[]) => {
        const callback = args[0] as (x: number, y: number, w: number, h: number, px: number, py: number) => void;
        callback(0, 0, 48, 48, 300, 40);
      });
    }
    node = node.parent;
  }
}

/** Popover content is interactive once laid out; Jest emits no layout events, so emit one on every listening ancestor. */
export function layoutAncestors(testID: string): void {
  let node: ReactTestInstance | null = screen.getByTestId(testID);
  while (node) {
    if (typeof node.props?.onLayout === 'function') {
      fireEvent(node, 'layout', { nativeEvent: { layout: { x: 16, y: 96, width: 280, height: 200 } } });
    }
    node = node.parent;
  }
}
