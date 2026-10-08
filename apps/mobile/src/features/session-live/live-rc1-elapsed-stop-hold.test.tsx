// Backlog row 22 (B12/A4): RC-1 — the Sessions hub duration when a stop is learned late (re-check finding
// RC-1, decision D255; forward-only rule DEC-FXR-M-2), as re-ruled by D19(b) (audit AU-1, finding AU1-2;
// revision row RV-CODE): the forward-only hold applies ONLY while the Core still reports RECORDING. Once
// the Core reports the stop, the drawn duration is the Core's authoritative recorded duration
// (`stoppedAt - startedAt`): ONE correction at that moment, then no further step through FINALIZING and
// SEALED, and never above the sealed duration. Row 22's hold kept the ticker's larger second after the
// stop and only moved the step back to the seal (AU-1 probe: 1129 -> 1122).
//
// RC-1's mechanism, modelled on a fake clock with NO wall-clock waits (standing rule P-01..P-16), exactly
// as `components/composed/nav/live-mini-bar-core-clock.test.tsx` models RF-PH-1: in LIVE under load the
// store's clock lags (here: it is never advanced) while the runtime's shared ticker counts Core-clock
// seconds from the session start (`runtime/recording-elapsed.ts`, registered per test simulator as
// `createMobileLive` registers it for the Live source). The stop reaches this client late: the session
// leaves RECORDING and the store freezes `stoppedAt` at its LAGGING clock. Under D19(b) the ticker half
// ends there and the hub draws the store's frozen duration, which is the duration the sealed history
// entry records (`session-machine.ts` `historyEntry`: `endedAt = stoppedAt`). The full-screen check of the
// real hub row and detail pane through FINALIZING and SEALED is `features/sessions/live-d19b-stop-duration.test.tsx`.
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { useLiveElapsedSeconds } from '@/features/sessions/use-sessions-data';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { registerCoreClock, resetCoreLinkPrefsForTests, type CoreClock } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';

/** The duration the Sessions hub draws for the current session (`features/sessions/use-sessions-data.ts:139-142`). */
function HubElapsedProbe() {
  const seconds = useLiveElapsedSeconds();
  return <Text testID="hub-elapsed">{String(seconds)}</Text>;
}

/** A Core clock the test drives: `now()` is the store's start plus `elapsedMs`; plain timers run by `advance`. */
function manualCoreClock(startedAt: number) {
  let local = 0;
  let tasks: { at: number; run: () => void; id: number }[] = [];
  let id = 0;
  const clock: CoreClock = {
    now: () => startedAt + local,
    sample: () => undefined,
    timers: {
      setTimeout: (run, ms) => {
        id += 1;
        tasks.push({ at: local + ms, run, id });
        return id;
      },
      clearTimeout: (handle) => {
        tasks = tasks.filter((t) => t.id !== handle);
      },
    },
  };
  const advance = (ms: number): void => {
    const end = local + ms;
    for (;;) {
      const due = tasks.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      tasks = tasks.filter((t) => t !== due);
      local = Math.max(local, due.at);
      due.run();
    }
    local = end;
  };
  return { clock, advance, setLocal: (ms: number) => (local = ms), pending: () => tasks.length };
}

const drawn = (): number => Number(screen.getAllByTestId('hub-elapsed')[0]!.props.children);

/** The Core's authoritative recorded duration of the current session, whole seconds (`stoppedAt - startedAt`). */
function authoritativeSeconds(test: TestSim): number {
  const session = test.sim.store.getState().session!;
  expect(session.stoppedAt).not.toBeNull();
  return Math.floor((session.stoppedAt! - session.startedAt!) / 1000);
}

/**
 * The recorded state of RC-1's failure window: the hub is drawing `storeElapsed + 7` from the Core-clock
 * ticker while the store's own clock still shows `storeElapsed`. The stop is then learned late —
 * `stopRecording` stamps `stoppedAt` at the store's lagging clock, exactly as a late replica delta
 * freezes the store-derived duration below the time the ticker had already drawn.
 */
async function openHubWithCoreAheadOfTheStore(test: TestSim, core: ReturnType<typeof manualCoreClock>): Promise<{ storeElapsed: number; ticked: number }> {
  renderWithRuntime(<HubElapsedProbe />, { sim: test.sim });
  await flushAsync();
  act(() => core.advance(0));
  const storeElapsed = Math.floor((test.sim.store.getState().clock.now - test.sim.store.getState().session!.startedAt!) / 1000);
  expect(drawn()).toBe(storeElapsed); // the store holds here: the ticker is not ahead yet
  act(() => core.advance(7_000)); // 7 s of Core time; the store's clock is never advanced (the "hold")
  await flushAsync();
  const ticked = storeElapsed + 7; // under load the ticker leads the lagging store clock
  expect(drawn()).toBe(ticked);
  return { storeElapsed, ticked };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetMotionStateForTests();
  resetLoopRegistryForTests();
});

afterEach(() => {
  cleanup();
});

describe('RC-1 under D19(b): the hold applies while RECORDING; at the stop the Core\'s recorded duration wins once', () => {
  it('stop learned 7 s late while the ticker was 7 s ahead of the held store clock: ONE correction to the recorded duration', async () => {
    const test: TestSim = createTestSim({ scenario: 'recording' });
    // The scenario's store hydrates SIGNED_OUT (the memory persist merge); sign the recording's operator
    // in for real, as `home-live.test.tsx:240` does, so the stop is a signed-in operator's transition.
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const startedAt = test.sim.store.getState().session!.startedAt!;
    const core = manualCoreClock(startedAt);
    const storeElapsed = Math.floor((test.sim.store.getState().clock.now - startedAt) / 1000);
    core.setLocal(storeElapsed * 1000 + 100); // the Core clock reads just past the store's held second
    registerCoreClock(test.sim, core.clock);
    const { ticked } = await openHubWithCoreAheadOfTheStore(test, core);

    // The stop arrives here, 7 s of Core time after the real stop instant, at the store's lagging clock.
    act(() => test.sim.actions.stopRecording('Interview completed'));
    await flushAsync();

    // D19(b): the Core reported the stop, so the drawn value is exactly its recorded duration — the one
    // allowed correction (here 7 s down from the ticker's lead), never the ticker's larger second.
    expect(authoritativeSeconds(test)).toBe(storeElapsed);
    expect(drawn()).toBe(storeElapsed);
    expect(drawn()).toBe(ticked - 7);
  });

  it('after the stop the recorded duration never moves: Core-clock and store time advance, no timer stays armed', async () => {
    const test: TestSim = createTestSim({ scenario: 'recording' });
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const startedAt = test.sim.store.getState().session!.startedAt!;
    const core = manualCoreClock(startedAt);
    const storeElapsed = Math.floor((test.sim.store.getState().clock.now - startedAt) / 1000);
    core.setLocal(storeElapsed * 1000 + 100);
    registerCoreClock(test.sim, core.clock);
    const { ticked } = await openHubWithCoreAheadOfTheStore(test, core);

    act(() => test.sim.actions.stopRecording('Interview completed'));
    await flushAsync();
    const recorded = authoritativeSeconds(test);
    expect(drawn()).toBe(recorded);
    expect(recorded).toBe(ticked - 7);

    // The recording is over: the recorded duration stays put while the Core clock keeps moving.
    act(() => core.advance(6_000));
    await flushAsync();
    expect(drawn()).toBe(recorded);
    // And nothing of the stopped session keeps a timer armed.
    act(() => core.advance(2_000));
    await flushAsync();
    expect(drawn()).toBe(recorded);
    expect(core.pending()).toBe(0);
    // Through FINALIZING to SEALED on the store clock (STOPPING 1.5 s + six steps): no later step.
    for (let second = 0; second < 12; second += 1) {
      act(() => test.advance(1_000, 100));
      act(() => core.advance(1_000));
      await flushAsync();
      expect(drawn()).toBe(recorded);
    }
    expect(test.sim.store.getState().session?.state).toBe('SEALED');
    const sealed = test.sim.store.getState().sessionHistory.find((entry) => entry.id === test.sim.store.getState().session!.id)!;
    expect(Math.floor(sealed.durationMs / 1000)).toBe(recorded); // never above the sealed duration
    expect(core.pending()).toBe(0);
  });

  it('a stop instant known while the replica still says RECORDING already ends the ticker half (D19(b) "or a stop instant is known")', async () => {
    const test: TestSim = createTestSim({ scenario: 'recording' });
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const startedAt = test.sim.store.getState().session!.startedAt!;
    const core = manualCoreClock(startedAt);
    const storeElapsed = Math.floor((test.sim.store.getState().clock.now - startedAt) / 1000);
    core.setLocal(storeElapsed * 1000 + 100);
    registerCoreClock(test.sim, core.clock);
    const { ticked } = await openHubWithCoreAheadOfTheStore(test, core);

    // A replica delta that carries the Core's stop instant before the state change (state still RECORDING).
    act(() => test.sim.store.setState((s) => ({ session: { ...s.session!, stoppedAt: s.clock.now } })));
    await flushAsync();
    expect(test.sim.store.getState().session!.state).toBe('RECORDING');
    expect(drawn()).toBe(authoritativeSeconds(test));
    expect(drawn()).toBe(ticked - 7);
    act(() => core.advance(3_000));
    await flushAsync();
    expect(drawn()).toBe(ticked - 7);
    expect(core.pending()).toBe(0);
  });

  // Audit AU1-6: a ticker frozen at a stop is never handed out again. The session machine has a single
  // entry to RECORDING (a new `startedAt`), so this re-entry is forced on the store to pin the rule.
  it('AU1-6: if a stopped recording re-entered RECORDING it would count again on the Core clock, not show a frozen second', async () => {
    const test: TestSim = createTestSim({ scenario: 'recording' });
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const startedAt = test.sim.store.getState().session!.startedAt!;
    const core = manualCoreClock(startedAt);
    const storeElapsed = Math.floor((test.sim.store.getState().clock.now - startedAt) / 1000);
    core.setLocal(storeElapsed * 1000 + 100);
    registerCoreClock(test.sim, core.clock);
    const { ticked } = await openHubWithCoreAheadOfTheStore(test, core);
    act(() => test.sim.actions.stopRecording('Interview completed'));
    await flushAsync();
    expect(drawn()).toBe(ticked - 7);

    act(() => test.sim.store.setState((s) => ({ session: { ...s.session!, state: 'RECORDING' as never, stoppedAt: null } })));
    await flushAsync();
    act(() => core.advance(0));
    await flushAsync();
    expect(drawn()).toBe(ticked); // a fresh ticker reads the Core clock again
    act(() => core.advance(2_000));
    await flushAsync();
    expect(drawn()).toBe(ticked + 2); // and keeps counting: it is not the frozen one
  });

  it('SIMULATED (no Core clock): the hub draws the store value only, and it freezes at `stoppedAt` — the hold does not apply', async () => {
    const test: TestSim = createTestSim({ scenario: 'recording' });
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    renderWithRuntime(<HubElapsedProbe />, { sim: test.sim });
    await flushAsync();
    const before = drawn();
    act(() => test.advance(3_000, 100));
    await flushAsync();
    expect(drawn()).toBe(before + 3);
    const grown = drawn();
    act(() => test.sim.actions.stopRecording('Interview completed'));
    await flushAsync();
    expect(drawn()).toBe(grown); // `stoppedAt` stamps the same store instant: no move, forward-only trivially
    act(() => test.advance(2_000, 100));
    await flushAsync();
    expect(drawn()).toBe(grown); // frozen at `stoppedAt`, as `selectElapsedMs` dictates
  });

  // Row-26 review finding F2: the session boundary of the shared ticker (`sharedTicker`'s cache key and
  // `releaseStoppedTicker`'s session guard, `recording-elapsed.ts`) — a NEW session after a stop must draw
  // from its OWN start instant, never inherit the previous session's second.
  it('session boundary: a NEW session after a stop does not inherit the held second, it counts from its own start', async () => {
    const test: TestSim = createTestSim({ scenario: 'recording' });
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const sessionA = test.sim.store.getState().session!;
    const startedAt = sessionA.startedAt!;
    const idA = sessionA.id;
    const core = manualCoreClock(startedAt);
    const storeElapsed = Math.floor((test.sim.store.getState().clock.now - startedAt) / 1000);
    core.setLocal(storeElapsed * 1000 + 100);
    registerCoreClock(test.sim, core.clock);
    const { ticked } = await openHubWithCoreAheadOfTheStore(test, core);

    // The same late stop as tests 1-2: after it the hub draws A's recorded duration (D19(b)).
    act(() => test.sim.actions.stopRecording('Interview completed'));
    await flushAsync();
    const held = drawn();
    expect(held).toBe(ticked - 7);
    expect(held).toBe(authoritativeSeconds(test));

    // A is sealed through the real finalization (STOPPING 1.5 s + six steps, timed on the store clock),
    // which frees the session slot: only a SEALED session lets `createSession` through (S26).
    act(() => test.advance(12_000, 100));
    await flushAsync();
    expect(test.sim.store.getState().session?.state).toBe('SEALED');
    expect(drawn()).toBe(held); // the recorded duration persists while `s.session` stays the sealed session A

    // Session B: the full real lifecycle, the input shape of `features/audit/testing/audit-harness.tsx:58-66`.
    const created: { ok: boolean; sessionId: string | null } = { ok: false, sessionId: null };
    act(() => {
      const result = test.sim.actions.createSession({
        caseNumber: 'LP/2026/1001-0087',
        subjectType: 'SAKSI',
        subjectName: 'RC-1 boundary saksi',
        investigatorId: 'OPR-001',
        room: 'Interview Room 1',
        profileId: 'STANDARD_1080P25',
      });
      created.ok = result.ok;
      created.sessionId = result.sessionId;
    });
    expect(created.ok).toBe(true);
    expect(created.sessionId).not.toBe(idA);
    await flushAsync();
    // B is now the active session and has drawn nothing on this Core clock: A's retired ticker must not
    // leak into B (that would draw A's second here).
    expect(drawn()).toBe(0);
    act(() => test.sim.actions.beginPrecheck());
    act(() => test.advance(5_000, 100)); // the precheck's timed checks run on the store clock
    await flushAsync();
    if (test.sim.store.getState().session?.state === 'PRECHECK') act(() => test.sim.actions.acknowledgePrecheckWarnings());
    expect(drawn()).toBe(0); // through B's setup: still no bleed of A's held second
    act(() => test.sim.actions.startRecording());
    await flushAsync();

    const sessionB = test.sim.store.getState().session!;
    expect(sessionB.state).toBe('RECORDING');
    const startedAtB = sessionB.startedAt!;
    expect(startedAtB).toBeGreaterThan(startedAt);
    expect(drawn()).toBe(0); // B's fresh ticker computes from B's own instant: this Core clock still reads before it

    // B counts on this Core clock from its own start (the file's 100 ms boundary convention).
    act(() => core.setLocal(startedAtB - startedAt + 100));
    act(() => core.advance(3_000));
    await flushAsync();
    expect(drawn()).toBe(3); // grew from B's own start instant, not inherited from A
    expect(drawn()).toBeLessThan(held); // the held second of A never crossed into B
  });
});
