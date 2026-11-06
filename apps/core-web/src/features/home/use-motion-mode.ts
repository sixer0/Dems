import { useState } from 'react'
import type { MotionMode } from './motion-variants'

/** `'slow'` when the page was opened with `?motion=slow`, otherwise `'normal'` (read once). */
export function useMotionMode(): MotionMode {
  const [mode] = useState<MotionMode>(() =>
    new URLSearchParams(location.search).get('motion') === 'slow' ? 'slow' : 'normal',
  )
  return mode
}
