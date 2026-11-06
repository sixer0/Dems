// Revision row RV-CODE, audit AU-1 finding AU1-2, ruling D19(b) (refines RC-1/D255).
//
// The REAL Sessions hub row and the REAL session detail pane (tablet landscape: list and detail on one
// screen, `sessions-harness.tsx`), in LIVE's failure window modelled on a fake clock with no wall-clock
// waits: the runtime's shared ticker counts Core-clock seconds while the store's clock lags (it is not
// advanced), so the screens draw the ticker's lead. The stop then reaches this client late.
//
// D19(b): while the Core reports RECORDING the drawn duration never steps back (the forward-only hold);
// once the Core reports the stop, the row and the detail draw the Core's authoritative recorded duration
// (`stoppedAt - startedAt`): ONE correction at that moment, then exactly that value through STOPPING,
// FINALIZING and SEALED (when the row becomes the sealed history entry) — never above the sealed duration.
// AU-1's probe of row 22's hold showed FINALIZING|1129 -> SEALED|1122; this file pins that no step happens
// after the stop.
//
// Import order: the feature setup, then the router harness (see their headers).
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import './testing/sessions-test-setup';
import '@/navigation/testing/router-harness';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, screen } from '@testing-library/react-native';
import { formatDuration } from '@dems/shared/realtime';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { registerCoreClock, resetCoreLinkPrefsForTests, type CoreClock } from '@/runtime';
import { renderSessionsApp, settle, type SessionsHarness } from './testing/sessions-harness';

/** A Core clock the test drives: `now()` is the session start plus `local`; plain timers run by `advance`. */
function manualCoreClock() {
  let origin = 0;
  let local = 0;
  let tasks: { at: number; run: () => void; id: number }[] = [];
  let id = 0;
  const clock: CoreClock = {
    now: () => origin + local,
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
  return { clock, advance, place: (at: number, ms: number) => ((origin = at), (local = ms)), pending: () => tasks.length };
}

const rowText = (id: string): string => textOf(screen.getAllByTestId(`session-row-duration-${id}`)[0]!);
const detailText = (): string => textOf(screen.getAllByTestId('session-detail-duration')[0]!);
function textOf(node: { props: { children?: unknown }; children: unknown[] }): string {
  const parts: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === 'string' || typeof n === 'number') parts.push(String(n));
    else if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object' && 'children' in n) walk((n as { children: unknown[] }).children);
  };
  walk(node);
  return parts.join('').replace(/^.*?(\d{2}:\d{2}:\d{2}).*$/s, '$1');
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetMissingKeys();
});
afterEach(() => expect(getMissingKeys()).toEqual([]));

describe('D19(b): after the stop the hub row and the detail draw the Core\'s recorded duration, with no later step', () => {
  it('RECORDING (ticker 7 s ahead, no step back) -> late stop: one correction -> FINALIZING -> SEALED: exactly the recorded duration', async () => {
    const core = manualCoreClock();
    let sessionId = '';
    let startedAt = 0;
    let storeElapsed = 0;
    const h: SessionsHarness = renderSessionsApp({
      window: 'tabletLandscape',
      prepare: (test) => {
        test.sim.actions.loadScenario('recording');
        if (test.sim.store.getState().auth?.status !== 'SIGNED_IN') test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
        const session = test.sim.store.getState().session!;
        sessionId = session.id;
        startedAt = session.startedAt!;
        storeElapsed = Math.floor((test.sim.store.getState().clock.now - startedAt) / 1000);
        core.place(startedAt, storeElapsed * 1000 + 100); // the Core clock reads just past the store's held second
        registerCoreClock(test.sim, core.clock);
      },
      initialUrl: '/sessions',
    });
    await settle();
    expect(h.sim.store.getState().session!.state).toBe('RECORDING');
    h.navigate(`/sessions/${sessionId}`);
    await settle();
    act(() => core.advance(0));
    await settle();
    expect(rowText(sessionId)).toBe(formatDuration(storeElapsed * 1000));
    expect(detailText()).toBe(formatDuration(storeElapsed * 1000));

    // RECORDING: the Core clock leads the lagging store by 7 s; the screens follow it and never step back.
    const drawnWhileRecording: string[] = [];
    for (let second = 1; second <= 7; second += 1) {
      act(() => core.advance(1_000));
      await settle();
      drawnWhileRecording.push(rowText(sessionId));
      expect(detailText()).toBe(rowText(sessionId));
    }
    const ticked = storeElapsed + 7;
    expect(rowText(sessionId)).toBe(formatDuration(ticked * 1000));
    expect([...drawnWhileRecording].sort()).toEqual(drawnWhileRecording); // forward only while RECORDING

    // The stop arrives late, stamped at the store's lagging clock (the Core's recorded stop instant).
    act(() => h.sim.actions.stopRecording('Interview completed'));
    await settle();
    const stopped = h.sim.store.getState().session!;
    expect(stopped.state).toBe('STOPPING');
    const recordedMs = stopped.stoppedAt! - stopped.startedAt!;
    const recorded = formatDuration(recordedMs);
    expect(Math.floor(recordedMs / 1000)).toBe(storeElapsed); // one correction: 7 s down from the ticker's lead
    expect(rowText(sessionId)).toBe(recorded);
    expect(detailText()).toBe(recorded);

    // STOPPING -> FINALIZING -> SEALED on the store clock, with the Core clock moving too: no later step.
    const states = new Set<string>();
    for (let second = 0; second < 14; second += 1) {
      act(() => h.advance(1_000, 100));
      act(() => core.advance(1_000));
      await settle();
      states.add(h.sim.store.getState().session!.state);
      expect(rowText(sessionId)).toBe(recorded);
      expect(detailText()).toBe(recorded);
    }
    expect(states.has('FINALIZING')).toBe(true);
    expect(h.sim.store.getState().session!.state).toBe('SEALED');

    // SEALED: the row and the detail now draw the history entry; it records exactly the same duration.
    const sealed = h.history().find((entry) => entry.id === sessionId)!;
    expect(sealed.durationMs).toBe(recordedMs);
    expect(formatDuration(sealed.durationMs)).toBe(recorded);
    expect(screen.getByTestId(`session-row-status-${sessionId}`).props.accessibilityLabel).toBe('Sealed');
    expect(rowText(sessionId)).toBe(recorded);
    expect(detailText()).toBe(recorded);
    expect(core.pending()).toBe(0); // the stopped session's ticker is retired: no timer armed
  });
});
