/**
 * Table row motion for the kit Table (03_motion_spec M-C-11; §9.2 composite-only).
 *
 * The kit Table (React Aria) owns its `<tr>` elements and commits them in its own render pass (after
 * its collection is built), so rows cannot be Motion components and a parent effect runs too early
 * to see them. This hook watches the rendered rows with a MutationObserver (delivered before the
 * next paint) and animates them with Motion's `animate()` (WAAPI transform and opacity):
 * - **First load:** rows rise `riseSm` (6 px) and fade in over `base` (240 ms), 30 ms apart; only the
 *   first 10 stagger, the rest enter with the 10th.
 * - **Filter and sort:** rows that stay FLIP from their old position (240 ms `standard`); rows that
 *   are new fade in (`fast`, 160 ms). A page change is all new rows, so it cross-fades.
 * - Rows leaving are removed by the kit without the 120 ms fade (DR-47-5).
 * - **Reduced motion:** nothing moves; rows simply appear (§8).
 * Rows are found by `data-row-id` inside the container.
 */
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { animate } from 'motion/react'
import { motion as tokens } from '@dems/shared/tokens'
import { ROW_STAGGER_CAP, ROW_STAGGER_MS, useMotionPolicy } from '@/motion'

type Animation = ReturnType<typeof animate>

export interface RowMotionOptions {
  /** ms before the first-load reveal starts (route enter + table beat + held beat). */
  revealDelayMs: number
}

export function useRowMotion(containerRef: RefObject<HTMLElement | null>, options: RowMotionOptions) {
  const m = useMotionPolicy()
  const latest = useRef({ m, options })
  useLayoutEffect(() => {
    latest.current = { m, options }
  })

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    let running: Animation[] = []
    let lastSignature: string | null = null
    let revealed = false
    let positions = new Map<string, number>()

    const process = () => {
      const rows = Array.from(container.querySelectorAll<HTMLElement>('tr[data-row-id]'))
      const signature = rows.map((row) => row.dataset.rowId ?? '').join('|')
      if (signature === lastSignature) return
      lastSignature = signature
      for (const animation of running) animation.stop()
      running = []

      const next = new Map<string, number>()
      for (const row of rows) {
        row.style.transform = ''
        row.style.opacity = ''
        next.set(row.dataset.rowId ?? '', row.getBoundingClientRect().top)
      }
      const { m, options } = latest.current
      if (rows.length > 0 && !m.reduced) {
        const seconds = (ms: number) => m.seconds(ms)
        const ease = tokens.easing.standard
        if (!revealed) {
          rows.forEach((row, index) => {
            const delay = options.revealDelayMs + ROW_STAGGER_MS * Math.min(index, ROW_STAGGER_CAP - 1)
            row.style.opacity = '0'
            running.push(
              animate(
                row,
                { opacity: [0, 1], transform: [`translateY(${tokens.distance.riseSm}px)`, 'translateY(0px)'] },
                { duration: seconds(tokens.duration.base), delay: seconds(delay), ease },
              ),
            )
          })
        } else {
          for (const row of rows) {
            const id = row.dataset.rowId ?? ''
            const before = positions.get(id)
            const after = next.get(id) ?? 0
            if (before === undefined) {
              running.push(animate(row, { opacity: [0, 1] }, { duration: seconds(tokens.duration.fast), ease }))
            } else if (Math.abs(before - after) > 0.5) {
              running.push(
                animate(row, { transform: [`translateY(${before - after}px)`, 'translateY(0px)'] }, { duration: seconds(tokens.duration.base), ease }),
              )
            }
          }
        }
      }
      if (rows.length > 0) revealed = true
      positions = next
    }

    process()
    const observer = new MutationObserver(process)
    observer.observe(container, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      for (const animation of running) animation.stop()
      // StrictMode re-mounts this effect: leave every row visible and let the next mount reveal again.
      for (const row of Array.from(container.querySelectorAll<HTMLElement>('tr[data-row-id]'))) {
        row.style.transform = ''
        row.style.opacity = ''
      }
    }
  }, [containerRef])
}
