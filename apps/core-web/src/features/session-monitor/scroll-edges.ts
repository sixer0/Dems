/**
 * Scroll-edge tracking for the kit ScrollShadow in panels Q and T.
 *
 * The kit's automatic mode watches its whole subtree with a MutationObserver (class, style and
 * text changes) and reads `scrollHeight` / `scrollTop` on every mutation. Inside the live lists that
 * means a forced layout on every animation frame of an insertion (Motion styles, the highlight
 * fade, TextScramble text), which the step-44 CPU profile showed as the largest non-React cost.
 * This hook computes the same visibility from `scroll` events and size changes only (one
 * ResizeObserver on the container and its content), and the page passes it to ScrollShadow as a
 * controlled `visibility`, which switches the kit's observers off.
 */
import { useEffect, useState, type RefObject } from 'react'

export type ScrollEdges = 'none' | 'top' | 'bottom' | 'both'

function edgesOf(el: HTMLElement): ScrollEdges {
  const before = el.scrollTop > 1
  const after = el.scrollTop + el.clientHeight < el.scrollHeight - 1
  return before && after ? 'both' : before ? 'top' : after ? 'bottom' : 'none'
}

/** `contentKey`: change it when the scrolling content element is replaced (for example empty → list). */
export function useScrollEdges(ref: RefObject<HTMLElement | null>, contentKey: unknown = null): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>('none')
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    let frame: number | null = null
    const update = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        setEdges(edgesOf(el))
      })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
    resize?.observe(el)
    const content = el.firstElementChild
    if (content) resize?.observe(content)
    return () => {
      el.removeEventListener('scroll', update)
      resize?.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [ref, contentKey])
  return edges
}
