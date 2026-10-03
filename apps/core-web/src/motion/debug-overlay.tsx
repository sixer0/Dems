import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Surface } from '@heroui/react'
import { useAnimationFrame } from 'motion/react'
import { drainMeterFrames } from './debug-metrics'
import { useAmbientSnapshot } from './use-ambient-loop'
import { useMotionPolicy } from './use-motion-policy'

export interface MotionDebugOverlayProps {
  /** Sampling window for fps and meter rates (default 1 s, 03_motion_spec §9.5). */
  sampleIntervalMs?: number
  /** Averages ignore this first stretch after mount (AC-71 "after the first 2 s"). */
  warmupMs?: number
}

/**
 * `?debug=1` measurement overlay (03_motion_spec §9.5; AC-61, AC-71, MS-04):
 * fps over 1 s windows (Motion frame loop) plus the post-warm-up average; long tasks over 50 ms
 * (PerformanceObserver, where the browser supports it); active ambient loops against the cap of
 * 4; meter frames per second per channel. Its text updates once per window, and it takes no
 * pointer input. The numbers are also exposed as `data-*` attributes for scripted checks.
 */
export default function MotionDebugOverlay({
  sampleIntervalMs = 1000,
  warmupMs = 2000,
}: MotionDebugOverlayProps) {
  const { policy, speed, timeScale } = useMotionPolicy()
  const fps = useFps(sampleIntervalMs, warmupMs)
  const longTasks = useLongTasks(warmupMs)
  const meters = useMeterRates(sampleIntervalMs)
  const ambient = useAmbientSnapshot()
  const videos = usePlayingVideos(sampleIntervalMs)
  // A shell loop yielding to four page loops is by design (§9.4), and so is decoration (`decor`,
  // `idle`) yielding to a page loop or to the shell's escalation signal (F45-02). A suppressed page
  // or escalation loop is a real budget breach (P3), so only that turns the row red.
  const breach = ambient.suppressed.some((loop) => loop.priority === 'page' || loop.priority === 'escalation')
  const yielded = !breach && ambient.suppressed.length > 0
  const shellYielded = yielded && ambient.suppressed.some((loop) => loop.priority === 'shell')
  const meterEntries = Object.entries(meters)

  return (
    <Surface
      variant="secondary"
      aria-hidden
      data-testid="motion-debug-overlay"
      data-fps={fps.current}
      data-fps-avg={fps.average}
      data-long-tasks={longTasks.total}
      data-long-tasks-after-warmup={longTasks.afterWarmup}
      data-ambient-running={ambient.slotsGranted}
      data-ambient-requested={ambient.slotsRequested}
      data-ambient-breach={breach}
      data-meter-rates={JSON.stringify(meters)}
      data-videos-playing={videos.playing}
      data-videos-total={videos.total}
      className="pointer-events-none fixed bottom-3 left-3 z-[1000] flex w-72 flex-col gap-1 rounded-lg p-3 shadow-glow-1"
    >
      <span className="text-label uppercase text-accent">Motion debug</span>
      <Row label="policy">
        {policy} · {speed} ×{timeScale}
      </Row>
      <Row label="fps">
        {fps.current} (avg {fps.average})
      </Row>
      <Row label="long tasks">
        {longTasks.supported ? `${longTasks.total} (${longTasks.afterWarmup} after warm-up)` : 'n/a'}
      </Row>
      <Row label="ambient" alert={breach}>
        {ambient.slotsGranted}/{ambient.cap}
        {breach
          ? ` (over budget: ${ambient.slotsRequested} requested)`
          : shellYielded
            ? ' (shell paused)'
            : yielded
              ? ' (decor paused)'
              : ''}
      </Row>
      {ambient.granted.length > 0 ? (
        <span className="font-mono text-data text-muted" data-testid="motion-debug-ambient-list">
          {ambient.granted.map((loop) => loop.label).join(', ')}
          {ambient.suppressed.length > 0
            ? ` | paused: ${ambient.suppressed.map((loop) => loop.label).join(', ')}`
            : ''}
        </span>
      ) : null}
      <Row label="videos" alert={videos.playing > 1}>
        {videos.playing} playing / {videos.total}
      </Row>
      <Row label="meters">
        {meterEntries.length === 0
          ? 'no frames'
          : meterEntries.map(([channel, rate]) => `${channel} ${rate}/s`).join(' · ')}
      </Row>
    </Surface>
  )
}

function Row({ label, alert = false, children }: { label: string; alert?: boolean; children: ReactNode }) {
  return (
    <span className="flex justify-between gap-3">
      <span className="font-mono text-data text-muted">{label}</span>
      <span className={alert ? 'font-mono text-data text-danger' : 'font-mono text-data text-foreground'}>
        {children}
      </span>
    </span>
  )
}

function useFps(windowMs: number, warmupMs: number) {
  const [state, setState] = useState({ current: 0, average: 0 })
  const counters = useRef({ frames: 0, windowStart: -1, warmFrames: 0, warmStart: -1 })

  const onFrame = useCallback(
    (elapsed: number) => {
      const c = counters.current
      if (c.windowStart < 0) c.windowStart = elapsed
      c.frames += 1
      if (elapsed >= warmupMs) {
        if (c.warmStart < 0) c.warmStart = elapsed
        c.warmFrames += 1
      }
      const span = elapsed - c.windowStart
      if (span >= windowMs) {
        const current = Math.round((c.frames * 1000) / span)
        const warmSpan = c.warmStart < 0 ? 0 : elapsed - c.warmStart
        const average = warmSpan > 0 ? Math.round((c.warmFrames * 1000) / warmSpan) : current
        c.frames = 0
        c.windowStart = elapsed
        setState({ current, average })
      }
    },
    [windowMs, warmupMs],
  )
  useAnimationFrame(onFrame)
  return state
}

function useLongTasks(warmupMs: number) {
  const supported =
    typeof PerformanceObserver !== 'undefined' &&
    (PerformanceObserver.supportedEntryTypes ?? []).includes('longtask')
  const [counts, setCounts] = useState({ total: 0, afterWarmup: 0 })

  useEffect(() => {
    if (!supported) return undefined
    const warmupEnd = performance.now() + warmupMs
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const late = entries.filter((entry) => entry.startTime >= warmupEnd).length
      setCounts((prev) => ({ total: prev.total + entries.length, afterWarmup: prev.afterWarmup + late }))
    })
    try {
      observer.observe({ type: 'longtask', buffered: false })
    } catch {
      return undefined
    }
    return () => observer.disconnect()
  }, [supported, warmupMs])

  return { supported, ...counts }
}

/**
 * `<video>` elements decoding now (playing, with data) against all on the page: the F45-01 decode
 * budget allows one live tile video per page (a second one caps windowed GPU Chrome at 30 fps).
 */
function usePlayingVideos(windowMs: number) {
  const [counts, setCounts] = useState({ playing: 0, total: 0 })

  useEffect(() => {
    const sample = () => {
      const videos = Array.from(document.querySelectorAll('video'))
      const playing = videos.filter((video) => !video.paused && !video.ended && video.readyState >= 2).length
      setCounts((prev) => (prev.playing === playing && prev.total === videos.length ? prev : { playing, total: videos.length }))
    }
    sample()
    const timer = window.setInterval(sample, windowMs)
    return () => window.clearInterval(timer)
  }, [windowMs])

  return counts
}

function useMeterRates(windowMs: number): Record<string, number> {
  const [rates, setRates] = useState<Record<string, number>>({})

  useEffect(() => {
    drainMeterFrames()
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const seconds = Math.max(now - last, 1) / 1000
      last = now
      const counts = drainMeterFrames()
      setRates(
        Object.fromEntries(
          Object.entries(counts).map(([channel, frames]) => [channel, Math.round(frames / seconds)]),
        ),
      )
    }, windowMs)
    return () => window.clearInterval(timer)
  }, [windowMs])

  return rates
}
