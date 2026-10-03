import { useCallback, useMemo, useSyncExternalStore } from 'react'

export type MatchMedia = (query: string) => MediaQueryList

export function browserMatchMedia(): MatchMedia | undefined {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia.bind(window)
    : undefined
}

/**
 * A live media-query match. Motion's own `useReducedMotion()` reads the OS setting once and does
 * not follow later changes, so the policy subscribes to the query itself; toggling "Emulate
 * prefers-reduced-motion" in DevTools therefore applies without a reload (AC-70, MS-06).
 */
export function useMediaQuery(query: string, matchMedia: MatchMedia | undefined): boolean {
  const list = useMemo(() => {
    try {
      return matchMedia?.(query) ?? null
    } catch {
      return null
    }
  }, [query, matchMedia])

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!list) return () => undefined
      if (typeof list.addEventListener === 'function') {
        list.addEventListener('change', onChange)
        return () => list.removeEventListener('change', onChange)
      }
      // Safari < 14 only has the deprecated listener API.
      list.addListener(onChange)
      return () => list.removeListener(onChange)
    },
    [list],
  )

  return useSyncExternalStore(
    subscribe,
    () => list?.matches ?? false,
    () => false,
  )
}
