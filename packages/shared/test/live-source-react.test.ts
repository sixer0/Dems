// Plan row W44 (HB-14), ADQ-2: a Live source behind the existing `useSim` contract.
// 04_client_integration_spec §2.3 ("put into the existing SimContext through one documented cast,
// so useSim, useSimInstance, useSimReady and useAudioChannel work on it without a change"), CL-12,
// CL-15, CL-16.
//
// Rendered for real: the simulator's own `SimProvider` and hooks, the light API's hooks, and a
// real Live source over the fake transport. Renderer: `react-test-renderer`, as the light API's
// hook tests use it (it needs no DOM).
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { pickReplicatedState, type DeltaMessage, type ReplicatedState } from '../src/api';
import { createCoreClient } from '../src/client';
import { settle, useCoreActions, useCoreMode, useCorePermission, useLive, useLiveLink, useLiveSelector } from '../src/live';
import { asSim, createLiveSim, type LiveSim } from '../src/live/source';
import { createFakeTransport, type FakeConnection, type FakeTransport } from '../src/live/testing';
import {
  DEFAULT_SEED,
  SimProvider,
  buildScenarioState,
  createIdleState,
  createManualClock,
  createSim,
  selectIsSignedIn,
  selectSessionState,
  useAudioChannel,
  useSim,
  useSimActions,
  useSimInstance,
  useSimReady,
  type AudioFrame,
  type SimState,
} from '../src/sim';

const DEPRECATION = 'react-test-renderer is deprecated';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let fake: FakeTransport;
let live: LiveSim | undefined;
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  live?.stop();
  live = undefined;
  // React reports misuse (an unstable snapshot, an update outside act) on this channel.
  const unexpected = consoleError.mock.calls.filter(([first]) => !String(first).startsWith(DEPRECATION));
  consoleError.mockRestore();
  expect(unexpected).toEqual([]);
  fake.assertNoViolations();
});

const wire = (state: SimState): ReplicatedState => pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState);
const flush = async (): Promise<void> => {
  for (let turn = 0; turn < 30; turn += 1) await Promise.resolve();
};

async function signedIn(): Promise<{ source: LiveSim; connection: FakeConnection; recording: SimState }> {
  fake = createFakeTransport({ epoch: 3, revision: 40 });
  const recording = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
  fake.scriptSignedInStart(wire(recording));
  const source = createLiveSim({
    client: createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: 'browser-cookie', fetch: fake.fetch }),
    socket: { url: 'ws://127.0.0.1:4420/ws', factory: fake.socketFactory },
    now: fake.clock.now,
    timers: fake.clock.timers,
    random: () => 0,
  });
  live = source;
  await source.ready;
  const connection = fake.connection();
  connection.beatEvery();
  return { source, connection, recording };
}

/** Renders `useValue` under the simulator's own `SimProvider`, holding the Live source, and records every render. */
function renderHook<T>(source: LiveSim, useValue: () => T) {
  const seen: T[] = [];
  function Probe(): null {
    seen.push(useValue());
    return null;
  }
  let root!: ReactTestRenderer;
  act(() => {
    root = create(createElement(SimProvider, { sim: asSim(source), autoStart: true }, createElement(Probe)));
  });
  return { seen, last: (): T => seen[seen.length - 1] as T, unmount: () => act(() => root.unmount()) };
}

describe('ADQ-2: the Live source in the existing SimContext', () => {
  it('the simulator\'s hooks and the light API\'s hooks read it: the selectors, the actions, the mode, the link, the permission hint', async () => {
    const { source } = await signedIn();
    const hook = renderHook(source, () => ({
      instance: useSimInstance(),
      ready: useSimReady(),
      state: useSim(selectSessionState),
      signedIn: useSim(selectIsSignedIn),
      operators: useSim((state) => state.operators.length),
      actions: useCoreActions(),
      simActions: useSimActions(),
      mode: useCoreMode(),
      handle: useLive<LiveSim>(),
      link: useLiveLink(),
      userAdmin: useCorePermission('USER_ADMIN'),
    }));
    expect(hook.last()).toMatchObject({ ready: true, state: 'RECORDING', signedIn: true, operators: 3, mode: 'LIVE', link: 'ONLINE', userAdmin: true });
    expect(hook.last().instance).toBe(source);
    expect(hook.last().handle).toBe(source);
    // One actions object, whichever hook hands it out; the call sites of the feature folders use useCoreActions().
    expect(hook.last().actions).toBe(source.actions);
    expect(hook.last().simActions).toBe(source.actions);
    hook.unmount();
    // SimProvider stopped the source it started (autoStart), as it stops a simulator.
    expect(source.isRunning()).toBe(false);
  });

  it('a delta renders the hooks that read its slice, once; a delta of another slice renders nothing (CL-13)', async () => {
    const { source, connection } = await signedIn();
    const session = renderHook(source, () => useSim((state) => state.session?.markerCount ?? -1));
    const link = renderHook(source, () => useSim((state) => state.tabletLink.state));
    const before = { session: session.seen.length, link: link.seen.length };
    const open = source.store.getState().session;
    if (!open) throw new Error('the replica holds an open session');

    act(() => {
      connection.delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: fake.clock.now() } }]);
    });
    expect(link.last()).toBe('OFFLINE');
    expect(link.seen.length).toBe(before.link + 1);
    expect(session.seen.length).toBe(before.session);

    act(() => {
      connection.delta([{ op: 'replace', slice: 'session', value: { ...open, markerCount: open.markerCount + 1 } }] as DeltaMessage['ops']);
    });
    expect(session.last()).toBe(open.markerCount + 1);
    expect(session.seen.length).toBe(before.session + 1);
    expect(link.seen.length).toBe(before.link + 1);

    // A snapshot equal to the state renders nothing at all.
    act(() => {
      connection.snapshot(wire({ ...source.store.getState() } as SimState));
    });
    expect([session.seen.length, link.seen.length]).toEqual([before.session + 1, before.link + 1]);
    session.unmount();
    link.unmount();
  });

  it('CL-16: no render happens between the store update that holds a command\'s effect and its continuation', async () => {
    const { source, connection } = await signedIn();
    const open = source.store.getState().session;
    if (!open) throw new Error('the replica holds an open session');
    const hook = renderHook(source, () => ({ markers: useSim((state) => state.session?.markerCount ?? -1), actions: useCoreActions() }));
    const log: string[] = [];
    const answer = fake.hold('addSessionMarker');

    act(() => {
      settle(() => hook.last().actions.addMarker('Key statement'), {
        // The continuation: the store holds the effect, and the screen has not rendered it yet.
        ok: () => log.push(`ok store=${source.store.getState().session?.markerCount} rendered=${hook.last().markers} renders=${hook.seen.length}`),
        fail: () => log.push('fail'),
      });
    });
    await act(async () => {
      await fake.arrived();
      answer.release({ status: 204, revision: fake.position.revision + 1 });
      await flush();
    });
    const renders = hook.seen.length;
    expect(log).toEqual([]);

    act(() => {
      connection.delta([{ op: 'replace', slice: 'session', value: { ...open, markerCount: open.markerCount + 1 } }] as DeltaMessage['ops']);
      // Inside the turn of the delta: the continuation already ran, and React has not rendered.
      expect(log).toEqual([`ok store=${open.markerCount + 1} rendered=${open.markerCount} renders=${renders}`]);
    });
    // Afterwards the screen renders the effect, once.
    expect(hook.last().markers).toBe(open.markerCount + 1);
    expect(hook.seen.length).toBe(renders + 1);
    hook.unmount();
  });

  it('useLiveLink() and useCorePermission() follow the source: a lost link, a role change', async () => {
    const { source, connection } = await signedIn();
    const hook = renderHook(source, () => ({ link: useLiveLink(), admin: useCorePermission('USER_ADMIN'), review: useCorePermission('EVIDENCE_REVIEW') }));
    expect(hook.last()).toEqual({ link: 'ONLINE', admin: true, review: true });
    act(() => {
      connection.sessionUpdated({ id: 'OPR-002', role: 'INVESTIGATOR' }, ['SESSION_START', 'SESSION_NOTE', 'EVIDENCE_VIEW', 'DIAGNOSTICS_RUN']);
    });
    expect(hook.last()).toEqual({ link: 'ONLINE', admin: false, review: false });
    act(() => {
      connection.close(1001);
    });
    expect(hook.last().link).toBe('OFFLINE');
    hook.unmount();
  });

  it('useAudioChannel() receives the meter frames of the socket without a render', async () => {
    const { source, connection } = await signedIn();
    const frames: AudioFrame[] = [];
    let renders = 0;
    const hook = renderHook(source, () => {
      renders += 1;
      useAudioChannel('AUDIO-01', (frame) => frames.push(frame));
      return null;
    });
    const rendered = renders;
    const frame = { seq: 9, at: fake.clock.now(), dbfs: -21, peak: -15, clip: false, noSignal: false };
    act(() => {
      connection.meters({ channels: { 'AUDIO-01': frame, 'AUDIO-02': { ...frame, dbfs: -44 } } });
    });
    // The frame on subscribe (no signal yet), then the one of the socket.
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ noSignal: true });
    expect(frames[1]).toEqual(frame);
    expect(renders).toBe(rendered);
    hook.unmount();
  });

  it('CPC1-13: useLiveSelector() reads the session, why the last session ended and the audit chain check, and renders on their changes only', async () => {
    const { source, connection } = await signedIn();
    fake.answerFromExample('verifyAuditChain');
    fake.answerFromExample('getAuthSession', 401);
    const hook = renderHook(source, () => ({
      operator: useLiveSelector((handle: LiveSim | null) => handle?.session?.operator.id ?? null),
      session: useLiveSelector((handle: LiveSim | null) => handle?.session ?? null),
      end: useLiveSelector((handle: LiveSim | null) => handle?.lastSessionEnd ?? null),
      chain: useLiveSelector((handle: LiveSim | null) => handle?.auditChain ?? null),
    }));
    expect(hook.last()).toMatchObject({ operator: 'OPR-002', end: null, chain: null });
    expect(hook.last().session).toBe(source.session);
    const renders = hook.seen.length;

    // A delta is no change of the Live handle: nothing renders.
    act(() => {
      connection.delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: fake.clock.now() } }]);
    });
    expect(hook.seen.length).toBe(renders);

    await act(async () => {
      await source.actions.verifyAuditChain();
      await flush();
    });
    expect(hook.last().chain).toBe(source.auditChain);
    expect(hook.last().chain).not.toBeNull();

    act(() => {
      connection.sessionEnded('TOKEN_REUSE');
    });
    expect(hook.last()).toMatchObject({ operator: null, session: null, chain: null });
    expect(hook.last().end).toBe(source.lastSessionEnd);
    expect(hook.last().end).toMatchObject({ kind: 'SESSION_ENDED', reason: 'TOKEN_REUSE' });
    hook.unmount();
    await flush();
  });

  it('CPC1-13: useLiveSelector() gets null in Simulated mode and subscribes to nothing', () => {
    fake = createFakeTransport();
    const sim = createSim({ clock: createManualClock(0), storage: null, authStorage: null, seed: DEFAULT_SEED });
    const seen: (string | null)[] = [];
    function Probe(): null {
      seen.push(useLiveSelector((handle) => (handle === null ? null : handle.link)));
      return null;
    }
    let root!: ReactTestRenderer;
    act(() => {
      root = create(createElement(SimProvider, { sim }, createElement(Probe)));
    });
    expect(seen).toEqual([null]);
    act(() => {
      sim.actions.setPresentationMode(true);
    });
    expect(seen).toEqual([null]);
    act(() => root.unmount());
  });

  it('useSimReady() turns true when the bootstrap is over', async () => {
    fake = createFakeTransport();
    fake.scriptAnonymousStart();
    const source = createLiveSim({
      client: createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: 'browser-cookie', fetch: fake.fetch }),
      socket: { url: 'ws://127.0.0.1:4420/ws', factory: fake.socketFactory },
      now: fake.clock.now,
      timers: fake.clock.timers,
      autoStart: false,
    });
    live = source;
    // SimProvider starts the source, as it starts a simulator.
    const hook = renderHook(source, () => ({ ready: useSimReady(), signedIn: useSim(selectIsSignedIn), link: useLiveLink() }));
    expect(hook.last()).toMatchObject({ ready: false, signedIn: false });
    expect(source.isRunning()).toBe(true);
    await act(async () => {
      await source.ready;
      await flush();
    });
    expect(hook.last()).toEqual({ ready: true, signedIn: false, link: 'ONLINE' });
    hook.unmount();
  });
});
