/**
 * Login layout tier (01_specs §14.8 "Layout"; research/04 §5.8 "Responsive behaviour"):
 *
 * | Tier      | Width       | Layout |
 * |-----------|-------------|--------|
 * | `wide`    | ≥ 1280      | 7 \| 5 split: brand side, auth side |
 * | `split`   | 1024-1279   | 6 \| 6 split; ring about 260 px |
 * | `stacked` | 768-1023    | a 280 px brand band (ring, wordmark, one-line tagline) above the card |
 * | `compact` | < 768       | full-bleed backdrop with the card over it (mirrors the mobile Login) |
 *
 * `tall` (≥ 1000 px high) picks the 340 px ring over 320 px at `wide`, so 1440×900 keeps the
 * device strip on screen without scrolling.
 */
import { useCallback, useSyncExternalStore } from 'react'
import type { LoginTier } from './login-model'

const QUERIES = {
  wide: '(min-width: 1280px)',
  split: '(min-width: 1024px)',
  stacked: '(min-width: 768px)',
  tall: '(min-height: 1000px)',
} as const

function matches(query: string): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  } catch {
    return false
  }
}

function readTier(): LoginTier {
  if (matches(QUERIES.wide)) return 'wide'
  if (matches(QUERIES.split)) return 'split'
  if (matches(QUERIES.stacked)) return 'stacked'
  return 'compact'
}

function subscribeAll(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined
  const lists = Object.values(QUERIES).map((query) => window.matchMedia(query))
  for (const list of lists) list.addEventListener?.('change', onChange)
  return () => {
    for (const list of lists) list.removeEventListener?.('change', onChange)
  }
}

export function useLoginTier(): { tier: LoginTier; tall: boolean } {
  const subscribe = useCallback((onChange: () => void) => subscribeAll(onChange), [])
  const tier = useSyncExternalStore(subscribe, readTier, () => 'wide' as const)
  const tall = useSyncExternalStore(subscribe, () => matches(QUERIES.tall), () => true)
  return { tier, tall }
}
