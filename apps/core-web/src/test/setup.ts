import '@testing-library/jest-dom/vitest'
import { MotionGlobalConfig } from 'motion/react'

// Finish Motion animations instantly: jsdom has no compositor, and the enter transition starts at opacity 0.
MotionGlobalConfig.skipAnimations = true

// jsdom lacks these browser APIs; react-use-measure (SlidingNumber) needs ResizeObserver,
// Motion checks IntersectionObserver and matchMedia (reduced motion).
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

const g = globalThis as unknown as Record<string, unknown>
g.ResizeObserver ??= NoopObserver
g.IntersectionObserver ??= NoopObserver

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}
