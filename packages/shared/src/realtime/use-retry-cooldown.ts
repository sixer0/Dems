import { useCallback, useEffect, useRef, useState } from 'react';

const RETRY_BASE_INTERVAL_MS = 3000;
const RETRY_MAX_WAIT_MS = 15_000;
export const RETRY_MAX_ATTEMPTS = 3;

export interface RetryCooldown {
  retry: () => void;
  /** Seconds left before the next retry is allowed. */
  cooldown: number;
  retryCount: number;
  canRetry: boolean;
  /** True once RETRY_MAX_ATTEMPTS retries were used; a full reload is then required. */
  exhausted: boolean;
}

/**
 * Rate-limited retry for error states in both apps: after each attempt the control cools down
 * 3 s → 6 s → 12 s (capped at 15 s), with at most 3 retries.
 */
export function useRetryCooldown(action: () => void): RetryCooldown {
  const [retryCount, setRetryCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    },
    [],
  );

  const retry = useCallback(() => {
    if (cooldown > 0 || retryCount >= RETRY_MAX_ATTEMPTS) return;
    const attempt = retryCount + 1;
    setRetryCount(attempt);
    const waitMs = Math.min(RETRY_BASE_INTERVAL_MS * 2 ** (attempt - 1), RETRY_MAX_WAIT_MS);
    setCooldown(Math.ceil(waitMs / 1000));
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((seconds) => {
        if (seconds <= 1 && timerRef.current !== null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return Math.max(0, seconds - 1);
      });
    }, 1000);
    action();
  }, [action, cooldown, retryCount]);

  return {
    retry,
    cooldown,
    retryCount,
    canRetry: cooldown === 0 && retryCount < RETRY_MAX_ATTEMPTS,
    exhausted: retryCount >= RETRY_MAX_ATTEMPTS,
  };
}
