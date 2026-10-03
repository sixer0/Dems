/**
 * React bindings (masterplan/01_specs.md §14.7 `react.ts`; 04_mobile_specs.md §5.1, §5.4).
 *
 * - `SimProvider` owns or receives one `Sim`, starts it after hydration and stops it on
 *   unmount (by default only when it created the sim itself). Start and stop are
 *   idempotent, so React StrictMode's mount-unmount-mount cycle is safe.
 * - `useSim(selector)`: zustand `useStore` + `useShallow`.
 * - `useSimActions()`: the stable actions object.
 * - `useAudioChannel(channel, onFrame)`: a **transient** 20 Hz subscription that drives
 *   Motion values (web) or Reanimated shared values (mobile) with zero React renders per
 *   frame (03_motion_spec M-C-04, §9.3).
 *
 * Plain `createElement`, no JSX, so this file needs no JSX transform in any consumer.
 */
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { AudioTrackId } from '../domain';
import { createSim, type Sim } from './engine';
import type { AudioFrame, CreateSimOptions, SimActions, SimState } from './types';

export const SimContext = createContext<Sim | null>(null);

export interface SimProviderProps {
  /** An existing sim (mobile creates it with its adapters). Takes precedence over `options`. */
  sim?: Sim;
  /** Options for a sim the provider creates once on mount. */
  options?: CreateSimOptions;
  /**
   * Start the engine on mount (after hydration) and stop it on unmount.
   * Default: true when the provider created the sim, false for an injected one.
   */
  autoStart?: boolean;
  children?: ReactNode;
}

export function SimProvider({ sim, options, autoStart, children }: SimProviderProps) {
  const [owned] = useState<Sim | null>(() => (sim ? null : createSim(options)));
  const instance = sim ?? (owned as Sim);
  const shouldStart = autoStart ?? owned !== null;

  useEffect(() => {
    if (!shouldStart) return undefined;
    instance.start();
    return () => instance.stop();
  }, [instance, shouldStart]);

  return createElement(SimContext.Provider, { value: instance }, children);
}

/** The `Sim` from the nearest `SimProvider`. Throws outside one. */
export function useSimInstance(): Sim {
  const sim = useContext(SimContext);
  if (!sim) throw new Error('useSim* must be used inside <SimProvider>.');
  return sim;
}

/** Subscribes to a slice of the store; re-renders only when the result changes (shallow). */
export function useSim<T>(selector: (state: SimState) => T): T {
  const sim = useSimInstance();
  return useStore(sim.store, useShallow(selector));
}

export function useSimActions(): SimActions {
  return useSimInstance().actions;
}

/** True once the persisted snapshot has hydrated (mobile hydration gate, 04 §5.2). */
export function useSimReady(): boolean {
  const sim = useSimInstance();
  const [ready, setReady] = useState(() => sim.isReady());
  useEffect(() => {
    if (ready) return undefined;
    let active = true;
    void sim.ready.then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [sim, ready]);
  return ready;
}

/**
 * Calls `onFrame` with every audio frame of `channel` (20 Hz), plus the current frame on
 * subscribe. Never causes a React render; the latest `onFrame` is used without resubscribing.
 */
export function useAudioChannel(channel: AudioTrackId, onFrame: (frame: AudioFrame) => void): void {
  const sim = useSimInstance();
  const callback = useRef(onFrame);
  useEffect(() => {
    callback.current = onFrame;
  }, [onFrame]);
  useEffect(
    () =>
      sim.store.subscribe(
        (state) => state.audio.channels[channel],
        (frame) => callback.current(frame),
        { fireImmediately: true },
      ),
    [sim, channel],
  );
}
