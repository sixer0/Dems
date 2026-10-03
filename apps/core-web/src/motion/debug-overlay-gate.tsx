import { lazy, Suspense } from 'react'

// The overlay is its own chunk: it is fetched only when `?debug=1` is present, so it never ships
// in the entry chunk of a production build (03_motion_spec §9.5; AC-73 entry-chunk budget).
const MotionDebugOverlay = lazy(() => import('./debug-overlay'))

export function MotionDebugOverlayGate() {
  return (
    <Suspense fallback={null}>
      <MotionDebugOverlay />
    </Suspense>
  )
}
