// `ui-runtime-watch.ts` (fix wave J, JM-01 d): the error trap, the heartbeat, the guarded restart, and what
// `UiRuntimeBoundary` draws. Seen on the tablet (normal launch, the stepper defect still in place): the error of
// the UI runtime is taken, the app starts itself again and the Login is complete; a second error within a
// minute leaves the notice with its button.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { enterRise, crossFadeIn, crossFadeOut, exitUp } from './builders';
import { setMotionLogSink, type MotionLogRecord } from './log';
import { UI_RUNTIME_NOTICE, UiRuntimeBoundary } from './motion-policy-provider';
import { getMotionSettings, motionStore, reducedReasons, resetMotionStateForTests, resolvePolicy } from './policy';
import {
  UI_RUNTIME_BEAT_MS,
  UI_RUNTIME_BUSY_BEATS,
  UI_RUNTIME_MISSES,
  UI_RUNTIME_RELOAD_GUARD_MS,
  UI_RUNTIME_RELOAD_KEY,
  installUiRuntimeErrorTrap,
  markUiRuntimeStalled,
  restartAfterUiRuntimeStop,
  useUiRuntimeWatch,
} from './ui-runtime-watch';

const mockReload = jest.fn(async (_reason?: string) => undefined);
jest.mock('expo', () => ({ reloadAppAsync: (reason?: string) => mockReload(reason) }));

// The echo of the heartbeat crosses back to JS through `scheduleOnRN`: on by default (as on a healthy device); a
// test turns it off to model a runtime whose reactions no longer run. (The Worklets mock of `jest.setup.ts` is
// already instantiated when a test file loads, so its function is replaced on the module, not by `jest.mock`.)
//
// Fix wave Q (CT-01): a beat goes out two ways. `echoes` is the way through the reaction (the mapper loop);
// `uiRuns` is the UI runtime itself (the direct job of `scheduleOnUI`): off models a device too busy to run
// anything, where no way brings a beat back.
let echoes = true;
let uiRuns = true;
const worklets = jest.requireMock<{
  scheduleOnRN: (run: (...args: unknown[]) => void, ...args: unknown[]) => void;
  scheduleOnUI: (run: (...args: unknown[]) => void, ...args: unknown[]) => void;
}>('react-native-worklets');

const records: MotionLogRecord[] = [];
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await act(async () => undefined);
};

beforeEach(async () => {
  jest.useFakeTimers();
  echoes = true;
  uiRuns = true;
  jest.spyOn(worklets, 'scheduleOnRN').mockImplementation((run, ...args) => {
    // The reaction's echo is tagged 'mapper', the direct job's 'direct' (`onAnswer` of the watch).
    if (args[1] === 'direct' ? uiRuns : echoes && uiRuns) run(...args);
  });
  jest.spyOn(worklets, 'scheduleOnUI').mockImplementation((run, ...args) => {
    if (uiRuns) run(...args);
  });
  mockReload.mockClear();
  records.length = 0;
  setMotionLogSink((record) => records.push(record));
  resetMotionStateForTests();
  await AsyncStorage.clear();
});
afterEach(() => {
  setMotionLogSink(null);
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('the policy once the animation runtime has stopped', () => {
  it('is `reduced` with the reason `runtime` and `still` settings; the layout builders then start NO animation', () => {
    expect(resolvePolicy(motionStore.getState())).toBe('full');
    expect(enterRise(0, getMotionSettings())).toBeDefined();
    motionStore.getState().markUiRuntimeStalled();
    expect(resolvePolicy(motionStore.getState())).toBe('reduced');
    expect(reducedReasons(motionStore.getState())).toEqual(['runtime']);
    const settings = getMotionSettings();
    expect(settings).toEqual({ policy: 'reduced', slow: false, still: true });
    expect(enterRise(0, settings)).toBeUndefined();
    expect(exitUp(settings)).toBeUndefined();
    expect(crossFadeIn(settings)).toBeUndefined();
    expect(crossFadeOut(settings)).toBeUndefined();
  });

  it('CONTROL: an ordinary reduced policy keeps its short fades (they are played by a runtime that runs)', () => {
    const reduced = { policy: 'reduced', slow: false } as const;
    expect(enterRise(0, reduced)).toBeDefined();
    expect(crossFadeIn(reduced)).toBeDefined();
  });
});

describe('installUiRuntimeErrorTrap', () => {
  const globalsWith = (previous: jest.Mock) => {
    let handler: (error: unknown, isFatal?: boolean) => void = previous as never;
    const globals = {
      ErrorUtils: {
        getGlobalHandler: () => handler,
        setGlobalHandler: (next: (error: unknown, isFatal?: boolean) => void) => {
          handler = next;
        },
        reportFatalError: (error: unknown) => handler(error, true),
      },
      // As Worklets does it: the remote error goes to `ErrorUtils.reportFatalError`.
      __reportFatalRemoteError: (error: Error, _force: boolean): void => globals.ErrorUtils.reportFatalError(error),
    };
    return globals;
  };

  it('an error REPORTED BY THE UI RUNTIME marks the runtime stalled, is recorded, reaches the previous handler as NOT fatal, and the app restarts itself', async () => {
    const previous = jest.fn();
    const globals = globalsWith(previous);
    installUiRuntimeErrorTrap(globals);
    const error = new Error('[Worklets] Tried to synchronously call a Remote Function. Called "scaleFor" on the UI Runtime.');
    globals.__reportFatalRemoteError(error, false);
    expect(previous).toHaveBeenCalledTimes(1);
    expect(previous).toHaveBeenCalledWith(error, false);
    expect(motionStore.getState().uiRuntimeStalled).toBe(true);
    expect(motionStore.getState().uiRuntimeFault).toBe('restarting');
    expect(records.map((record) => [record.level, record.source, record.context?.cause])).toEqual([['error', 'motion.uiRuntime.stalled', 'error']]);
    await flush();
    expect(mockReload).toHaveBeenCalledTimes(1);
    expect(Number(await AsyncStorage.getItem(UI_RUNTIME_RELOAD_KEY))).toBeGreaterThan(0);
  });

  it('CONTROL: any other fatal error passes through unchanged (still fatal), and nothing is marked', () => {
    const previous = jest.fn();
    const globals = globalsWith(previous);
    installUiRuntimeErrorTrap(globals);
    const error = new Error('a render error');
    globals.ErrorUtils.reportFatalError(error);
    expect(previous).toHaveBeenCalledWith(error, true);
    expect(motionStore.getState().uiRuntimeStalled).toBe(false);
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('removing the trap puts both globals back; without the globals nothing is installed', () => {
    const previous = jest.fn();
    const globals = globalsWith(previous);
    const report = globals.__reportFatalRemoteError;
    const remove = installUiRuntimeErrorTrap(globals);
    expect(globals.__reportFatalRemoteError).not.toBe(report);
    remove();
    expect(globals.__reportFatalRemoteError).toBe(report);
    expect(globals.ErrorUtils.getGlobalHandler()).toBe(previous);
    expect(() => installUiRuntimeErrorTrap({})()).not.toThrow();
  });
});

describe('restartAfterUiRuntimeStop', () => {
  it('restarts once, and holds a second restart inside the guard time (no restart loop); after it, restarts again', async () => {
    const t0 = 1_800_000_000_000;
    await expect(restartAfterUiRuntimeStop(t0)).resolves.toBe('restarting');
    await expect(restartAfterUiRuntimeStop(t0 + UI_RUNTIME_RELOAD_GUARD_MS - 1)).resolves.toBe('held');
    expect(mockReload).toHaveBeenCalledTimes(1);
    await expect(restartAfterUiRuntimeStop(t0 + UI_RUNTIME_RELOAD_GUARD_MS)).resolves.toBe('restarting');
    expect(mockReload).toHaveBeenCalledTimes(2);
  });

  it('a second reported error inside the guard time leaves the fault `held`', async () => {
    await AsyncStorage.setItem(UI_RUNTIME_RELOAD_KEY, String(Date.now()));
    markUiRuntimeStalled('error', new Error('again'));
    expect(motionStore.getState().uiRuntimeFault).toBe('restarting');
    await flush();
    expect(motionStore.getState().uiRuntimeFault).toBe('held');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('a failing reload is recorded and holds; it never throws', async () => {
    mockReload.mockRejectedValueOnce(new Error('no reload here'));
    await expect(restartAfterUiRuntimeStop()).resolves.toBe('held');
    expect(records.map((record) => record.source)).toEqual(['motion.uiRuntime.restart']);
  });
});

describe('useUiRuntimeWatch (the heartbeat)', () => {
  it('a runtime that answers is never marked, however long the app runs', () => {
    renderHook(() => useUiRuntimeWatch());
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * 30);
    });
    expect(motionStore.getState().uiRuntimeStalled).toBe(false);
    expect(records).toEqual([]);
  });

  it(`a runtime whose reactions stopped is marked after ${UI_RUNTIME_MISSES} unanswered beats: still form, NO restart (a suspicion signs nobody out)`, async () => {
    renderHook(() => useUiRuntimeWatch());
    act(() => {
      // Two beats, and the frame in which the second one is answered.
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * 2 + 100);
    });
    echoes = false;
    act(() => {
      // The beat before the stop was answered; the next one is sent unanswered and judged at the three ticks after it.
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * UI_RUNTIME_MISSES - 100);
    });
    expect(motionStore.getState().uiRuntimeStalled).toBe(false);
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS);
    });
    expect(motionStore.getState().uiRuntimeStalled).toBe(true);
    expect(motionStore.getState().uiRuntimeFault).toBeNull();
    expect(records.map((record) => [record.source, record.context?.cause])).toEqual([['motion.uiRuntime.stalled', 'heartbeat']]);
    await flush();
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('a suspicion is taken back by the first beat that is answered (a starved device, seen on the emulator at host load 60)', () => {
    renderHook(() => useUiRuntimeWatch());
    echoes = false;
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * (UI_RUNTIME_MISSES + 2));
    });
    expect(motionStore.getState().uiRuntimeStalled).toBe(true);
    echoes = true;
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * 3);
    });
    expect(motionStore.getState().uiRuntimeStalled).toBe(false);
    expect(records.map((record) => record.source)).toEqual(['motion.uiRuntime.stalled', 'motion.uiRuntime.answered']);
  });

  it('CONTROL: after a REPORTED error an answered beat changes nothing (only a new process has a new runtime)', () => {
    renderHook(() => useUiRuntimeWatch());
    act(() => {
      motionStore.getState().markUiRuntimeStalled('held');
    });
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * 10);
    });
    expect(motionStore.getState().uiRuntimeStalled).toBe(true);
    expect(motionStore.getState().uiRuntimeFault).toBe('held');
  });

  it('one late answer is not a stall: the count starts again', () => {
    renderHook(() => useUiRuntimeWatch());
    echoes = false;
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * (UI_RUNTIME_MISSES - 1));
    });
    echoes = true;
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * 10);
    });
    expect(motionStore.getState().uiRuntimeStalled).toBe(false);
  });

  // Fix wave Q (CT-01). Measured on the tablet, quiet host, note 176: the detector fired twice inside one recording
  // and remounted every screen each time, while the runtime was alive and the UI thread merely busy.
  it(`CT-01: a BUSY device (nothing comes back, neither the reaction nor a direct job) is never marked, however long; it is recorded once as a warning after ${UI_RUNTIME_BUSY_BEATS} beats`, () => {
    renderHook(() => useUiRuntimeWatch());
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * 2 + 100);
    });
    uiRuns = false;
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * (UI_RUNTIME_MISSES + UI_RUNTIME_BUSY_BEATS) * 4);
    });
    expect(motionStore.getState().uiRuntimeStalled).toBe(false);
    expect(records.map((record) => [record.level, record.source])).toEqual([['warn', 'motion.uiRuntime.busy']]);
    // The device answers again: nothing to take back, and a later busy stretch is recorded anew.
    uiRuns = true;
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * 3);
    });
    uiRuns = false;
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * (UI_RUNTIME_BUSY_BEATS + 2));
    });
    expect(motionStore.getState().uiRuntimeStalled).toBe(false);
    expect(records.map((record) => record.source)).toEqual(['motion.uiRuntime.busy', 'motion.uiRuntime.busy']);
  });

  it('CT-01: busy beats between real misses neither add a miss nor clear one', () => {
    renderHook(() => useUiRuntimeWatch());
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * 2 + 100);
    });
    // The loop stops (direct jobs still run): misses are counted ...
    echoes = false;
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * (UI_RUNTIME_MISSES - 2));
    });
    // ... then the device is busy for a while: no judgement ...
    uiRuns = false;
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * 3);
    });
    expect(motionStore.getState().uiRuntimeStalled).toBe(false);
    // ... and when it runs again with the loop still stopped, the count goes on from where it was.
    uiRuns = true;
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * 4);
    });
    expect(motionStore.getState().uiRuntimeStalled).toBe(true);
    expect(records.filter((record) => record.source === 'motion.uiRuntime.stalled')).toHaveLength(1);
  });

  it('in the background no beat is judged (no frame runs there)', () => {
    renderHook(() => useUiRuntimeWatch());
    echoes = false;
    act(() => {
      motionStore.getState().setAppActive(false);
    });
    act(() => {
      jest.advanceTimersByTime(UI_RUNTIME_BEAT_MS * 20);
    });
    expect(motionStore.getState().uiRuntimeStalled).toBe(false);
  });
});

describe('UiRuntimeBoundary', () => {
  const screens = (
    <UiRuntimeBoundary>
      <Text testID="the-screens">screens</Text>
    </UiRuntimeBoundary>
  );

  it('draws the screens while the runtime runs', () => {
    render(screens);
    expect(screen.getByTestId('the-screens')).toBeTruthy();
    expect(screen.queryByTestId('ui-runtime-notice')).toBeNull();
  });

  it('a reported error: the screens are taken away and a plain notice says the app restarts; no button while it does', () => {
    render(screens);
    act(() => {
      motionStore.getState().markUiRuntimeStalled('restarting');
    });
    expect(screen.queryByTestId('the-screens')).toBeNull();
    expect(screen.getByText(UI_RUNTIME_NOTICE.title)).toBeTruthy();
    expect(screen.getByText(UI_RUNTIME_NOTICE.recording)).toBeTruthy();
    expect(screen.queryByTestId('ui-runtime-notice-restart')).toBeNull();
  });

  it('held (a second fault within a minute): the notice offers "Restart the app", and the press restarts', async () => {
    render(screens);
    act(() => {
      motionStore.getState().markUiRuntimeStalled('held');
    });
    expect(screen.getByText(UI_RUNTIME_NOTICE.heldTitle)).toBeTruthy();
    fireEvent.press(screen.getByTestId('ui-runtime-notice-restart'));
    await flush();
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('a missed heartbeat alone: the screens are mounted ANEW (still form), not replaced', () => {
    render(screens);
    const before = screen.getByTestId('the-screens');
    act(() => {
      motionStore.getState().markUiRuntimeStalled();
    });
    const after = screen.getByTestId('the-screens');
    expect(after).not.toBe(before);
    expect(screen.queryByTestId('ui-runtime-notice')).toBeNull();
  });
});
