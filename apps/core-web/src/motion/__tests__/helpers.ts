// Shared test helpers for the motion library (step 36).
import { createElement, useLayoutEffect } from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { MotionPolicyProvider, type MotionPolicyProviderProps } from '../motion-policy-provider'
import { REDUCED_MOTION_MEDIA_QUERY } from '../policy'
import { useMotionPolicy, type MotionPolicyValue } from '../use-motion-policy'

/** A controllable `matchMedia` whose reduced-motion query can be flipped at runtime. */
export function fakeMatchMedia(reduced: boolean) {
  let matches = reduced
  const listeners = new Set<() => void>()
  const list = {
    get matches() {
      return matches
    },
    media: REDUCED_MOTION_MEDIA_QUERY,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: () => false,
  } as unknown as MediaQueryList
  const matchMedia = vi.fn((query: string) => {
    void query
    return list
  })
  return {
    matchMedia,
    set(next: boolean) {
      matches = next
      for (const listener of listeners) listener()
    },
    listenerCount: () => listeners.size,
  }
}

export function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, String(value)),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size
    },
  }
}

/** Renders a provider around a probe and returns the latest `useMotionPolicy()` value. */
export function renderPolicy(props: Partial<Omit<MotionPolicyProviderProps, 'children'>> = {}) {
  const seen: { current: MotionPolicyValue | null } = { current: null }
  const record = (value: MotionPolicyValue) => {
    seen.current = value
  }
  function Probe() {
    const value = useMotionPolicy()
    useLayoutEffect(() => record(value))
    return null
  }
  const media = props.matchMedia ?? fakeMatchMedia(false).matchMedia
  const storage = props.storage === undefined ? memoryStorage() : props.storage
  const utils = render(
    createElement(
      MotionPolicyProvider,
      // `children` arrives as the third argument; the cast only drops it from the props shape.
      { search: '', ...props, matchMedia: media, storage } as MotionPolicyProviderProps,
      createElement(Probe),
    ),
  )
  const value = () => {
    if (!seen.current) throw new Error('probe did not render')
    return seen.current
  }
  return { ...utils, value }
}

/** Loosely typed view of a Motion transition, for assertions. */
export interface TransitionView {
  type?: string
  duration?: number
  delay?: number
  ease?: unknown
  stiffness?: number
  damping?: number
  mass?: number
  repeat?: number
  repeatType?: string
  delayChildren?: number | ((index: number, total: number) => number)
}

export function asTransition(value: unknown): TransitionView {
  return (value ?? {}) as TransitionView
}

/** Resolves a variant (object or `custom`-driven function) to a plain target. */
export function resolveTarget(variant: unknown, custom: number = 1): Record<string, unknown> {
  if (typeof variant === 'function') {
    return (variant as (c: number, a: object, b: object) => Record<string, unknown>)(custom, {}, {})
  }
  return (variant ?? {}) as Record<string, unknown>
}
