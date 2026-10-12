/**
 * Watch over the animation runtime (fix wave J, JM-01 d: "one failed animation can never take a screen away").
 *
 * What happened on the tablet (normal launch, motion on): one worklet threw on the UI runtime (the
 * stepper's `scaleFor`). Reanimated runs its style mappers in one self-rescheduling frame loop
 * (`react-native-reanimated/src/mappers.ts`, `scheduledMapperRun`: the reschedule is the statement AFTER
 * `mapperRun()`), so an error thrown by one mapper ends that loop for the life of the process. From then on
 * no animated style of ANY screen is applied again: every view that is mounted hidden and shown by an
 * animation stays hidden (Home was drawn empty, the export sheet kept its first height, the Login came up
 * without emblem, title and card), until the app is killed.
 *
 * The cause is fixed where it was (the worklet), and a suite-wide guard keeps the class out
 * (`./testing/worklet-closure`). This module is the containment for whatever else may stop that runtime:
 *
 * 1. `installUiRuntimeErrorTrap`: an error reported from the UI runtime is taken at the app's global error
 *    handler, recorded, and passed on as NOT fatal (a failed animation is not a reason to end the app);
 * 2. `useUiRuntimeWatch`: a heartbeat. JS writes a counter into a shared value; a reaction on the UI runtime
 *    sends it back. A reaction is a mapper, so the echo stops exactly when the loop above has stopped.
 *    `UI_RUNTIME_MISSES` beats in a row without an echo, while the app is in the foreground, mark the runtime
 *    as stalled.
 *
 * What follows depends on how certain the stop is:
 *
 * - A REPORTED error is certain. `UiRuntimeBoundary` takes the screens away and shows a plain notice (React
 *   Native views only, nothing animated), and the app starts itself again (`restartAfterUiRuntimeStop`, Expo's
 *   `reloadAppAsync`): a new JS context has a new animation runtime and the app comes back at its first screen
 *   with everything working. Seen on the tablet with the stepper defect still in place: Login, complete, a
 *   few seconds after the error. Not more than once per `UI_RUNTIME_RELOAD_GUARD_MS`: if the error comes back
 *   at once (a worklet of the first screen) the notice stays, with a "Restart the app" button, instead of a
 *   restart loop.
 * - A missed heartbeat alone (no error reported) is a suspicion: a slow device must not sign an operator out.
 *   The policy turns `reduced` with `still` settings for the rest of the process and the screens are mounted
 *   anew: the layout builders of `./builders` then start no animation at all, so whatever they enter is drawn
 *   by React. (Screens that fade themselves in through a shared value are not covered by this form.)
 *   The beats go on, and the FIRST one that is answered takes the suspicion back (`clearUiRuntimeSuspicion`):
 *   a runtime that has really stopped never answers again, so an answer proves the miss was a starved device.
 *   Seen on the tablet emulator with the host at a load of 60: screen captures hung, three beats (12 s) went
 *   unanswered, and the runtime was alive - hence five beats, and the way back.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import { useCallback, useEffect, useRef } from 'react';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { reportMotionIssue } from './log';
import { motionStore } from './policy';
import { useMotionState } from './use-motion-policy';

/** One heartbeat every this many ms. */
export const UI_RUNTIME_BEAT_MS = 4000;
/** Beats in a row without an echo before the runtime counts as stalled (20 s: a slow frame is not a stall). */
export const UI_RUNTIME_MISSES = 5;

/** Where the time of the last automatic restart is kept (ms since the epoch, as text). */
export const UI_RUNTIME_RELOAD_KEY = 'dems.mobile.uiRuntimeReload.v1';
/** No second automatic restart within this time of the last one. */
export const UI_RUNTIME_RELOAD_GUARD_MS = 60_000;

/**
 * Starts the app again after a reported error of the animation runtime, unless it did so less than
 * `UI_RUNTIME_RELOAD_GUARD_MS` ago. Never throws; `held` = no restart (the still form stays).
 */
export async function restartAfterUiRuntimeStop(now: number = Date.now()): Promise<'restarting' | 'held'> {
  try {
    const last = Number(await AsyncStorage.getItem(UI_RUNTIME_RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < UI_RUNTIME_RELOAD_GUARD_MS) {
      reportMotionIssue('warn', 'motion.uiRuntime.restart', new Error('The animation runtime stopped again shortly after a restart; staying up in the still form.'), { sinceMs: now - last });
      return 'held';
    }
    await AsyncStorage.setItem(UI_RUNTIME_RELOAD_KEY, String(now));
    await reloadAppAsync('The animation runtime stopped');
    return 'restarting';
  } catch (error) {
    reportMotionIssue('warn', 'motion.uiRuntime.restart', error);
    return 'held';
  }
}

type FatalHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorGlobals {
  __reportFatalRemoteError?: (error: Error, force: boolean) => void;
  ErrorUtils?: { getGlobalHandler(): FatalHandler; setGlobalHandler(handler: FatalHandler): void };
}

/** Marks the runtime stalled, once, with one record. */
export function markUiRuntimeStalled(cause: 'error' | 'heartbeat', error?: unknown): void {
  const state = motionStore.getState();
  // A heartbeat miss after anything, or a second error: already handled. An error after a mere suspicion is new.
  if (state.uiRuntimeStalled && (cause === 'heartbeat' || state.uiRuntimeFault !== null)) return;
  reportMotionIssue('error', 'motion.uiRuntime.stalled', error ?? new Error('The animation runtime stopped answering its heartbeat.'), {
    cause,
    beatMs: UI_RUNTIME_BEAT_MS,
    misses: UI_RUNTIME_MISSES,
    fallback: cause === 'error' ? 'notice instead of the screens, then one restart of the app' : 'still form for the rest of the process',
  });
  if (cause === 'heartbeat') {
    motionStore.getState().markUiRuntimeStalled();
    return;
  }
  motionStore.getState().markUiRuntimeStalled('restarting');
  void restartAfterUiRuntimeStop().then((outcome) => {
    if (outcome === 'held') motionStore.getState().markUiRuntimeStalled('held');
  });
}

/** The operator's own restart from the notice (no guard: it was asked for). Never throws. */
export async function restartNow(): Promise<void> {
  try {
    await AsyncStorage.setItem(UI_RUNTIME_RELOAD_KEY, String(Date.now()));
    await reloadAppAsync('Restart asked for after the animation runtime stopped');
  } catch (error) {
    reportMotionIssue('error', 'motion.uiRuntime.restartNow', error);
  }
}

/**
 * Takes the errors the UI runtime reports (Worklets hands them to `ErrorUtils.reportFatalError`): marks the
 * runtime stalled and passes the error on as not fatal. Any other error reaches the previous handler
 * unchanged. Returns the function that removes the trap. Without the two globals (another library version, a
 * test environment) it installs nothing: the heartbeat is then the only watch.
 */
export function installUiRuntimeErrorTrap(globals: ErrorGlobals = globalThis as ErrorGlobals): () => void {
  const report = globals.__reportFatalRemoteError;
  const utils = globals.ErrorUtils;
  if (typeof report !== 'function' || !utils) return () => undefined;
  let fromUiRuntime = false;
  const trappedReport = (error: Error, force: boolean): void => {
    fromUiRuntime = true;
    try {
      report(error, force);
    } finally {
      fromUiRuntime = false;
    }
  };
  const previous = utils.getGlobalHandler();
  const handler: FatalHandler = (error, isFatal) => {
    if (!fromUiRuntime) {
      previous(error, isFatal);
      return;
    }
    markUiRuntimeStalled('error', error);
    previous(error, false);
  };
  globals.__reportFatalRemoteError = trappedReport;
  utils.setGlobalHandler(handler);
  return () => {
    if (globals.__reportFatalRemoteError === trappedReport) globals.__reportFatalRemoteError = report;
    if (utils.getGlobalHandler() === handler) utils.setGlobalHandler(previous);
  };
}

/**
 * The heartbeat (see the header). Mounted once, by `MotionPolicyProvider`. Returns whether the runtime is
 * marked stalled.
 */
export function useUiRuntimeWatch(): boolean {
  const stalled = useMotionState((s) => s.uiRuntimeStalled);
  const appActive = useMotionState((s) => s.appActive);
  const fault = useMotionState((s) => s.uiRuntimeFault);
  const beat = useSharedValue(0);
  const echoed = useRef(0);
  const counter = useRef(0);
  const onEcho = useCallback((value: number) => {
    echoed.current = value;
  }, []);
  useAnimatedReaction(
    () => beat.get(),
    (now, previous) => {
      if (now !== previous) scheduleOnRN(onEcho, now);
    },
    [beat],
  );

  useEffect(() => installUiRuntimeErrorTrap(), []);

  useEffect(() => {
    // In the background no frame runs, so no echo comes: the watch rests and starts afresh in the foreground.
    // After a REPORTED error nothing is left to watch.
    if (fault !== null || !appActive) return undefined;
    let sent: number | null = null;
    let misses = 0;
    const timer = setInterval(() => {
      if (sent !== null) misses = echoed.current === sent ? 0 : misses + 1;
      if (stalled && sent !== null && misses === 0) {
        // The suspected runtime answered: it is alive. (The effect starts a new watch when the state changes.)
        clearInterval(timer);
        reportMotionIssue('info', 'motion.uiRuntime.answered', new Error('The animation runtime answers its heartbeat again; the still form is taken back.'));
        motionStore.getState().clearUiRuntimeSuspicion();
        return;
      }
      if (!stalled && misses >= UI_RUNTIME_MISSES) {
        clearInterval(timer);
        markUiRuntimeStalled('heartbeat');
        return;
      }
      // A new number each beat (never one this process used before): a late echo of an old beat is no answer.
      counter.current += 1;
      sent = counter.current;
      beat.set(sent);
    }, UI_RUNTIME_BEAT_MS);
    return () => clearInterval(timer);
  }, [stalled, fault, appActive, beat]);

  return stalled;
}
