// Plan row W44, Simulated isolation: 01_specs AC-B-63 and MC-2 ("a client in Simulated mode sends
// nothing to the server"); 04_client_integration_spec AC-C-06, MD-5, TS-2.
//
// The spies stand where a runtime keeps its request function and its connection classes. With the
// Live source module LOADED, a simulator is driven through the recording scenario by the call-site
// API of both modes (`coreActionsOf`, `settle`): the spies must count zero `fetch` calls and zero
// socket constructions. Two controls show that the spies can count: a Live source that is given no
// transport reaches them, and a Live source on injected transports does not.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickReplicatedState, type ReplicatedState } from '../src/api';
import { createCoreClient } from '../src/client';
import { coreActionsOf, coreModeOf, liveLinkOf, liveOf, settle } from '../src/live';
import * as liveSource from '../src/live/source';
import { createFakeTransport } from '../src/live/testing';
import {
  DEFAULT_SEED,
  DEMO_OPERATOR_PASSWORD,
  buildScenarioState,
  createIdleState,
  createManualClock,
  createSim,
  selectIsRecording,
  selectIsSignedIn,
  verifyAuditChain,
  type Sim,
} from '../src/sim';

const AT = Date.parse('2026-10-01T10:00:00+07:00');

const fetchSpy = vi.fn((..._input: unknown[]) => Promise.reject(new Error('no network in this test')));
const socketSpy = vi.fn();
const xhrSpy = vi.fn();
const eventSourceSpy = vi.fn();

/** A socket of the platform's shape that records its construction and never connects. */
class SpySocket {
  onopen: unknown = null;
  onmessage: unknown = null;
  onclose: unknown = null;
  onerror: unknown = null;
  constructor(...input: unknown[]) {
    socketSpy(...input);
  }
  send(): void {}
  close(): void {}
}
class SpyRequest {
  constructor() {
    xhrSpy();
  }
}
class SpyEventSource {
  constructor() {
    eventSourceSpy();
  }
}

beforeEach(() => {
  for (const spy of [fetchSpy, socketSpy, xhrSpy, eventSourceSpy]) spy.mockClear();
  vi.stubGlobal('fetch', fetchSpy);
  vi.stubGlobal('WebSocket', SpySocket);
  vi.stubGlobal('XMLHttpRequest', SpyRequest);
  vi.stubGlobal('EventSource', SpyEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const expectNothingSent = (): void => {
  expect(fetchSpy).toHaveBeenCalledTimes(0);
  expect(socketSpy).toHaveBeenCalledTimes(0);
  expect(xhrSpy).toHaveBeenCalledTimes(0);
  expect(eventSourceSpy).toHaveBeenCalledTimes(0);
};

/** One simulator through a working session of the recording scenario, by the call-site API of both modes. */
function driveRecordingScenario(sim: Sim, advance: (ms: number) => void): string[] {
  const actions = coreActionsOf(sim);
  const log: string[] = [];
  const run = <T>(label: string, action: () => T | Promise<T>): void => {
    let ran = false;
    settle(action, {
      ok: (value) => {
        ran = true;
        log.push(`${label}: ok ${typeof value === 'object' && value !== null ? JSON.stringify(value).slice(0, 40) : String(value)}`);
      },
      fail: (error) => {
        ran = true;
        log.push(`${label}: fail ${error instanceof Error ? error.name : String(error)}`);
      },
    });
    // Simulated mode: the continuation ran before `settle` returned (TS-2). No promise, no later turn.
    expect(ran, label).toBe(true);
  };
  const tick = (ms: number): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      advance(50);
      sim.tick();
    }
  };

  run('signIn', () => actions.signIn('andi.pratama', DEMO_OPERATOR_PASSWORD));
  tick(1_000);
  run('touch', () => actions.touch());
  run('addMarker', () => actions.addMarker('Key statement'));
  run('addNote', () => actions.addNote('Subject confirms the timeline.'));
  run('snapshot', () => actions.snapshot());
  run('inject', () => actions.inject('MIC_CLIP'));
  tick(500);
  run('resetClip', () => actions.resetClip('AUDIO-02'));
  run('clearFault', () => actions.clearFault('MIC_CLIP'));
  run('setActiveCamera', () => actions.setActiveCamera('VIDEO-02'));
  run('verifyAuditChain', () => actions.verifyAuditChain());
  run('stopRecording too short', () => actions.stopRecording('no'));
  run('stopRecording', () => actions.stopRecording('Interview complete'));
  tick(14_000);
  const sealed = sim.store.getState().lastSealedSessionId ?? '';
  const evidenceId = sim.store.getState().evidence.find((item) => item.sessionId === sealed)?.id ?? '';
  run('acknowledgeSummary', () => actions.acknowledgeSummary(sealed));
  run('verify', () => actions.verify(evidenceId));
  run('exportEvidence', () => actions.exportEvidence(evidenceId, { reason: 'Prosecutor review', destination: 'Case file transfer' }));
  run('archiveEvidence', () => actions.archiveEvidence(evidenceId));
  run('exportAudit', () => actions.exportAudit({ reason: 'Monthly audit review' }));
  run('runDiagnostics', () => actions.runDiagnostics());
  tick(5_000);
  run('setPresentationMode', () => actions.setPresentationMode(true));
  run('pair', () => actions.pair('000000'));
  run('signOut', () => actions.signOut());
  return log;
}

describe('AC-B-63 and AC-C-06: in Simulated mode nothing reaches the network, with the Live source module loaded', () => {
  it('loading the Live source starts nothing: no request, no socket, no timer', async () => {
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const interval = vi.spyOn(globalThis, 'setInterval');
    vi.resetModules();
    const loaded = await import('../src/live/source');
    expect(typeof loaded.createLiveSim).toBe('function');
    expect(Object.keys(loaded).length).toBeGreaterThan(30);
    expectNothingSent();
    expect(timeout).toHaveBeenCalledTimes(0);
    expect(interval).toHaveBeenCalledTimes(0);
  });

  it('over the recording scenario the spies count zero fetch calls and zero socket constructions; the actions are the simulator\'s own', () => {
    // The heavy module is in this process (imported at the top of this file).
    expect(typeof liveSource.createLiveSim).toBe('function');
    const clock = createManualClock(AT);
    const sim = createSim({ clock, storage: null, authStorage: null, scenario: 'recording', seed: DEFAULT_SEED });
    expect(selectIsRecording(sim.store.getState())).toBe(true);

    // The mode is derived from the object: a simulator means SIMULATED, and no Live handle exists.
    expect(coreModeOf(sim)).toBe('SIMULATED');
    expect(liveOf(sim)).toBeNull();
    expect(liveLinkOf(sim)).toBeNull();
    // `coreActionsOf` returns `sim.actions` itself: no wrapper stands between a call site and the simulator.
    expect(coreActionsOf(sim)).toBe(sim.actions);

    const log = driveRecordingScenario(sim, (ms) => clock.advance(ms));
    expect(log).toHaveLength(21);
    expect(log.filter((entry) => entry.includes(': fail '))).toEqual(['stopRecording too short: fail SimTransitionError']);
    expect(log[0]).toMatch(/^signIn: ok \{"ok":true/);
    expect(log.at(-1)).toBe('signOut: ok undefined');
    expect(sim.store.getState().lastSealedSessionId).not.toBeNull();
    expect(verifyAuditChain(sim.store.getState().audit).ok).toBe(true);
    expect(selectIsSignedIn(sim.store.getState())).toBe(false);

    // The simulated REST surface and the engine's own life cycle reach nothing either.
    expect(sim.request({ method: 'GET', path: '/api/v1/session/current' }).status).toBe(200);
    sim.start();
    sim.stop();
    sim.flush();

    expectNothingSent();
  });

  it('control: a Live source that is given no transport DOES reach the spies, so the spies can count', async () => {
    const source = liveSource.createLiveSim({
      // No `fetch` and no socket factory: the two clients fall back to what the runtime holds.
      client: createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: 'browser-cookie' }),
      socket: { url: 'ws://127.0.0.1:4420/ws' },
    });
    try {
      await source.ready;
      expect(socketSpy).toHaveBeenCalledTimes(1);
      expect(socketSpy.mock.calls[0]?.[0]).toBe('ws://127.0.0.1:4420/ws');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(fetchSpy.mock.calls[0]?.[0])).toBe('http://127.0.0.1:4420/api/v1/auth/session');
      expect(selectIsSignedIn(source.store.getState())).toBe(false);
    } finally {
      source.stop();
    }
  });

  it('control: a Live source on injected transports never touches what the runtime holds', async () => {
    const fake = createFakeTransport();
    const state = buildScenarioState('recording', createIdleState({ now: fake.clock.now(), seed: DEFAULT_SEED }));
    fake.scriptSignedInStart(pickReplicatedState(JSON.parse(JSON.stringify(state)) as ReplicatedState));
    fake.answerAllFromExamples();
    const source = liveSource.createLiveSim({
      client: createCoreClient({ baseUrl: 'http://127.0.0.1:4420', credentials: 'browser-cookie', fetch: fake.fetch }),
      socket: { url: 'ws://127.0.0.1:4420/ws', factory: fake.socketFactory },
      now: fake.clock.now,
      timers: fake.clock.timers,
    });
    try {
      await source.ready;
      await source.actions.runDiagnostics();
      expect(selectIsSignedIn(source.store.getState())).toBe(true);
      expect(fake.calls.length).toBeGreaterThanOrEqual(2);
      expect(fake.connections).toHaveLength(1);
      expectNothingSent();
    } finally {
      source.stop();
      fake.assertNoViolations();
    }
  });
});
