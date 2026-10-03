/**
 * Ambient loop registry (03_motion_spec P3, §9.4; 04_mobile_specs §7.8 "loops register with
 * useMotionPolicy (the debug overlay lists them)").
 *
 * A running loop registers its name while it runs; the `?debug=1` overlay lists them and a dev
 * warning fires when more than `threshold.ambientMaxPerViewport` (4, including chrome) run at once.
 */
import { createStore } from 'zustand/vanilla';
import { motion } from '@dems/shared/tokens';
import { reportMotionIssue } from './log';

export interface AmbientLoopEntry {
  readonly id: number;
  readonly name: string;
}

export interface LoopRegistryState {
  readonly loops: readonly AmbientLoopEntry[];
}

export const AMBIENT_LOOP_CAP = motion.threshold.ambientMaxPerViewport;

export const loopRegistry = createStore<LoopRegistryState>()(() => ({ loops: [] }));

let nextLoopId = 1;

/** Registers a running ambient loop; returns the unregister function. */
export function registerAmbientLoop(name: string): () => void {
  const id = nextLoopId;
  nextLoopId += 1;
  const loops = [...loopRegistry.getState().loops, { id, name }];
  loopRegistry.setState({ loops });
  if (loops.length > AMBIENT_LOOP_CAP) {
    reportMotionIssue('warn', 'motion.loops.register', new Error('ambient loop cap exceeded (03M P3)'), {
      count: loops.length,
      cap: AMBIENT_LOOP_CAP,
      names: loops.map((l) => l.name),
    });
  }
  return () => {
    loopRegistry.setState({ loops: loopRegistry.getState().loops.filter((l) => l.id !== id) });
  };
}

export function activeLoopNames(): string[] {
  return loopRegistry.getState().loops.map((l) => l.name);
}

/** Test helper. */
export function resetLoopRegistryForTests(): void {
  loopRegistry.setState({ loops: [] });
}
