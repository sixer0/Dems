// Shared helpers for the step-39 composition and media tests.
import '@/i18n'
import { createElement, useLayoutEffect, type ReactNode } from 'react'
import { act } from '@testing-library/react'
import type { AudioTrackId } from '@dems/shared/domain'
import { ALWAYS_VISIBLE, createSim, MIC_INPUT_OF_CHANNEL, SimProvider, type AudioFrame, type ScenarioName, type Sim } from '@dems/shared/sim'
import {
  MotionPolicyProvider,
  useAmbientSnapshot,
  type AmbientSnapshot,
  type MotionPolicyProviderProps,
} from '@/motion'
import { fakeMatchMedia, memoryStorage } from '@/motion/__tests__/helpers'

/** A simulator that never ticks on its own (the tests drive state), with in-memory storage (D54(a)). */
export function createTestSim(scenario: ScenarioName = 'idle'): Sim {
  return createSim({
    scenario,
    storage: null,
    authStorage: null,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined,
  })
}

/** Writes one audio frame into the store, as the engine's 20 Hz audio subsystem does. */
export function pushAudioFrame(sim: Sim, channel: AudioTrackId, frame: Partial<AudioFrame>) {
  act(() => {
    sim.store.setState((state) => {
      // The meters slice is keyed by mic input since schema v2 (SH-17); the channel a caller names
      // writes the input that feeds it. The rest of the slice (activeInputId) is preserved.
      const input = MIC_INPUT_OF_CHANNEL[channel]
      const previous = state.audio.inputs[input]
      const next: AudioFrame = { ...previous, seq: previous.seq + 1, ...frame }
      return { audio: { ...state.audio, inputs: { ...state.audio.inputs, [input]: next } } }
    })
  })
}

let latestSnapshot: AmbientSnapshot | null = null
function SnapshotProbe() {
  const snapshot = useAmbientSnapshot()
  useLayoutEffect(() => {
    latestSnapshot = snapshot
  })
  return null
}

/** The ambient-loop registry as last rendered inside `withProviders`. */
export function ambientSnapshot(): AmbientSnapshot {
  if (!latestSnapshot) throw new Error('no ambient snapshot recorded')
  return latestSnapshot
}

export interface ProviderOptions {
  sim?: Sim | null
  /** `true`: the OS reduced-motion setting is on (§8). */
  reduced?: boolean
}

/** The motion policy (live, per test) and, unless `sim: null`, a SimProvider that does not start. */
export function withProviders(children: ReactNode, { sim, reduced = false }: ProviderOptions = {}) {
  const props: Omit<MotionPolicyProviderProps, 'children'> = {
    search: '',
    matchMedia: fakeMatchMedia(reduced).matchMedia,
    storage: memoryStorage(),
    debugOverlay: false,
  }
  // `children` arrives as the third argument; the cast only adds it to the props shape.
  const policy = createElement(MotionPolicyProvider, props as MotionPolicyProviderProps, children, createElement(SnapshotProbe))
  if (sim === null) return policy
  return createElement(SimProvider, { sim: sim ?? createTestSim(), autoStart: false }, policy)
}

/**
 * jsdom has no IntersectionObserver (setup.ts installs a no-op one); ambient loops observe their
 * element (R10), so suites that test loops report every observed element as on screen.
 */
export class OnScreenObserver {
  private readonly callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  observe(target: Element) {
    queueMicrotask(() =>
      this.callback(
        [{ isIntersecting: true, intersectionRatio: 1, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      ),
    )
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
