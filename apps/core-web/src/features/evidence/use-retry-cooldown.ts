/**
 * Rate-limited retry for failed network work (verification or download fetches): at least 3 s
 * between attempts, doubling each time (3 s → 6 s → 12 s), at most 3 retries before the operator
 * has to reload. The button shows the countdown while it is disabled.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export const RETRY_BASE_MS = 3_000
export const RETRY_MAX = 3

export interface RetryCooldown {
  /** Retries used since the last success. */
  attempts: number
  /** Whole seconds left before the next retry is allowed (0 = allowed). */
  cooldownSeconds: number
  canRetry: boolean
  exhausted: boolean
  /** Call when a retry starts; returns false (and does nothing) when a retry is not allowed. */
  consume: () => boolean
  /** Call after a success. */
  reset: () => void
}

export function useRetryCooldown(): RetryCooldown {
  const [attempts, setAttempts] = useState(0)
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (until <= now) return undefined
    timer.current = setInterval(() => setNow(Date.now()), 250)
    return () => {
      if (timer.current) clearInterval(timer.current)
      timer.current = null
    }
  }, [until, now])

  const cooldownSeconds = until > now ? Math.ceil((until - now) / 1000) : 0
  const exhausted = attempts >= RETRY_MAX
  const canRetry = cooldownSeconds === 0 && !exhausted

  const consume = useCallback(() => {
    const current = Date.now()
    if (current < until || attempts >= RETRY_MAX) return false
    const next = attempts + 1
    setAttempts(next)
    setUntil(current + RETRY_BASE_MS * 2 ** (next - 1))
    setNow(current)
    return true
  }, [attempts, until])

  const reset = useCallback(() => {
    setAttempts(0)
    setUntil(0)
  }, [])

  return { attempts, cooldownSeconds, canRetry, exhausted, consume, reset }
}
