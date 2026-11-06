/**
 * "THERE IS MORE TO THE SIDE" for a container that scrolls sideways (fix wave J round three, driver
 * J3-W; the box check of round one: at 1280 px the audit table of Security & Audit is 1144 px wide in
 * 1008 px). A table whose columns do not fit may scroll; what it may not do is hide columns without
 * saying so - an overlay scroll bar is invisible until somebody scrolls.
 *
 * `sidewaysMoreOf` is the rule (pure); `useSidewaysMore` reads it from `scroll` events and size
 * changes only (one ResizeObserver on the container and its content), the way
 * `features/session-monitor/scroll-edges.ts` does for the vertical lists.
 */
import { useEffect, useState, type RefObject } from 'react'

export type SidewaysMore = 'none' | 'right' | 'left' | 'both'

/** One pixel of tolerance: sub-pixel layout must not raise a cue. */
export function sidewaysMoreOf(box: { readonly scrollLeft: number; readonly clientWidth: number; readonly scrollWidth: number }): SidewaysMore {
  const left = box.scrollLeft > 1
  const right = box.scrollLeft + box.clientWidth < box.scrollWidth - 1
  return left && right ? 'both' : left ? 'left' : right ? 'right' : 'none'
}

/** `contentKey`: change it when the scrolling content element is replaced. */
export function useSidewaysMore(ref: RefObject<HTMLElement | null>, contentKey: unknown = null): SidewaysMore {
  const [more, setMore] = useState<SidewaysMore>('none')
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    let frame: number | null = null
    const update = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        setMore(sidewaysMoreOf(el))
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
  return more
}
