/**
 * Test-only helpers for the runtime and screen suites (never import from app code).
 *
 * `createTestSim()` builds the shared simulator the way `createMobileSim` does, but with a manual
 * clock, a manual scheduler and in-memory storage by default, so `ready` is immediate and a test
 * drives time itself (`clock.advance(ms)` then `sim.tick()`). Pass an AsyncStorage-backed storage
 * to test persistence (T-M07).
 *
 * `renderWithRuntime()` renders UI inside the real `AppProviders` with that simulator, a fake
 * heartbeat socket and fixed safe-area metrics. With an injected, already-hydrated simulator the
 * runtime's hydration gate is open from the first render.
 */
import { QueryClient } from '@tanstack/react-query';
import { act, render, type RenderOptions } from '@testing-library/react-native';
import { useState, type ReactElement, type ReactNode } from 'react';
import type { Metrics } from 'react-native-safe-area-context';
import type { SocketLike } from '@dems/shared/realtime';
import {
  createManualClock,
  createSim,
  type ControllableClock,
  type CreateSimOptions,
  type Sim,
  type SimScheduler,
  type TimerAdapter,
  type VisibilityAdapter,
} from '@dems/shared/sim';
import { AppProviders } from '@/providers';

/** 2026-10-01 10:00 WIB, the moment the dataset figures are measured at (13_sim_engine §2.6). */
export const TEST_START = Date.UTC(2026, 9, 1, 3, 0, 0);

export const TEST_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 411, height: 923 },
  insets: { top: 24, right: 0, bottom: 16, left: 0 },
};

/**
 * The query client of a test tree that brings none of its own.
 *
 * The app's client (`createAppQueryClient`) keeps an unobserved query for five minutes and removes
 * it on a timer (`gcTime`, TanStack Query's default). In a test that timer outlives the tree: Jest
 * reported it as an open handle (six from one file in `test/12_precommit_wave_m.md`) and the worker
 * "failed to exit gracefully". No test asserts a removal by that timer, so a test client never sets
 * one. Nothing else differs from the app's client: retries and stale times are the defaults.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { gcTime: Number.POSITIVE_INFINITY }, mutations: { gcTime: Number.POSITIVE_INFINITY } } });
}

/** A scheduler that hands the tick to the test instead of `setInterval`. */
export function createManualScheduler() {
  const state: { tick: (() => void) | null; intervalMs: number | null; starts: number } = { tick: null, intervalMs: null, starts: 0 };
  const scheduler: SimScheduler = (tick, intervalMs) => {
    state.tick = tick;
    state.intervalMs = intervalMs;
    state.starts += 1;
    return () => {
      state.tick = null;
    };
  };
  return { scheduler, state };
}

export interface TestSim {
  sim: Sim;
  clock: ControllableClock;
  scheduler: ReturnType<typeof createManualScheduler>;
  /** Advances the clock by `ms` in engine-sized steps, ticking after each (like the real 50 ms loop). */
  advance(ms: number, stepMs?: number): void;
}

export function createTestSim(options: Omit<CreateSimOptions, 'clock' | 'scheduler'> & { start?: number } = {}): TestSim {
  const { start = TEST_START, ...rest } = options;
  const clock = createManualClock(start);
  const scheduler = createManualScheduler();
  const sim = createSim({
    storage: null,
    authStorage: null,
    visibility: ALWAYS_VISIBLE_FOR_TESTS,
    timers: TEST_SIM_TIMERS,
    ...rest,
    clock,
    scheduler: scheduler.scheduler,
  });
  const advance = (ms: number, stepMs = 100) => {
    let left = ms;
    while (left > 0) {
      const step = Math.min(stepMs, left);
      clock.advance(step);
      sim.tick();
      left -= step;
    }
  };
  return { sim, clock, scheduler, advance };
}

const ALWAYS_VISIBLE_FOR_TESTS: VisibilityAdapter = { isHidden: () => false, subscribe: () => () => undefined };

/**
 * The simulator's one-shot timers (the store's snapshot write, throttled to 1 s) for a test simulator:
 * the global timers, looked up at call time as the default ones are (so Jest's fake timers apply), but
 * a pending one does not keep the process alive. With the default timers every test simulator that
 * changed its store left a referenced 1 s timer behind; a Jest worker whose last file was one of the
 * 54 such files did not exit within Jest's half second and was "force exited" - the line every whole
 * run of the mobile suite printed (measured in `test/14_consolidation_mobile.md`). The timer still
 * fires while the process lives, so nothing a test can observe changes.
 */
const TEST_SIM_TIMERS: TimerAdapter = {
  setTimeout: (callback, ms) => {
    const handle = globalThis.setTimeout(callback, ms);
    (handle as { unref?: () => void }).unref?.();
    return handle;
  },
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

/** A heartbeat socket the test drives (`open`, `beat`, `drop`). */
export class FakeHeartbeatSocket implements SocketLike {
  readyState = 0;
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  close() {
    this.readyState = 3;
  }
  beat(seq: number) {
    this.readyState = 1;
    this.onmessage?.({
      data: JSON.stringify({
        type: 'heartbeat',
        v: 1,
        seq,
        serverTime: '2026-10-01T03:00:00.000Z',
        uptimeMs: seq * 1000,
        intervalMs: 1000,
        clients: 1,
        sessionState: null,
      }),
    });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
}

export interface RenderWithRuntimeOptions extends Omit<RenderOptions, 'wrapper'> {
  sim: Sim;
  /** Every socket the heartbeat client opens, newest last. */
  sockets?: FakeHeartbeatSocket[];
  onHeartbeatResync?: () => void;
}

export function RuntimeTestProviders({ sim, sockets, onHeartbeatResync, children }: { sim: Sim; sockets?: FakeHeartbeatSocket[]; onHeartbeatResync?: () => void; children: ReactNode }) {
  // One client per mounted tree (as `AppProviders` keeps its own), without the removal timer.
  const [queryClient] = useState(createTestQueryClient);
  return (
    <AppProviders
      sim={sim}
      queryClient={queryClient}
      safeAreaMetrics={TEST_METRICS}
      heartbeatSocketFactory={() => {
        const socket = new FakeHeartbeatSocket();
        sockets?.push(socket);
        return socket;
      }}
      {...(onHeartbeatResync ? { onHeartbeatResync } : {})}
    >
      {children}
    </AppProviders>
  );
}

export function renderWithRuntime(ui: ReactElement, { sim, sockets, onHeartbeatResync, ...options }: RenderWithRuntimeOptions) {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => (
      <RuntimeTestProviders sim={sim} {...(sockets ? { sockets } : {})} {...(onHeartbeatResync ? { onHeartbeatResync } : {})}>
        {children}
      </RuntimeTestProviders>
    ),
  });
}

/** Lets pending promise work (hydration, prefs reads) settle inside `act`. */
export async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}
