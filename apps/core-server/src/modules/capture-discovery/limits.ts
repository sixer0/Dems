/**
 * The bounds of a camera search (blueprint row 132; C3 §2.6 "Rate limits", §7; decisions D86 C-8,
 * D91; security review SEC35-39). Pure: the clock is a number the caller passes.
 *
 *   one RUNNING search per Core                 held by the search state, not here (single-flight)
 *   per operator session   10 s between starts  CAPTURE_DISCOVERY_MIN_INTERVAL_MS
 *   per Core                5 s between starts  CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS
 *   per Core               6 starts per minute  CAPTURE_DISCOVERY_MAX_PER_MINUTE
 *   per operator session  30 starts per hour    CAPTURE_DISCOVERY_MAX_PER_HOUR
 *
 * A search that was started counts, whatever became of it. A refused call counts nothing and
 * changes nothing. The search a pre-check runs has its own allowance (one per pre-check run) and
 * is outside these four bounds: it is neither refused by them nor counted into them, so one
 * operator's searching cannot silence another operator's pre-check (SEC35-39 (3)).
 */
import {
  CAPTURE_DISCOVERY_MAX_PER_HOUR,
  CAPTURE_DISCOVERY_MAX_PER_MINUTE,
  CAPTURE_DISCOVERY_MIN_INTERVAL_MS,
  CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS,
} from '@dems/shared/api';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export const SearchBound = {
  SESSION_SPACING: 'SESSION_SPACING',
  CORE_SPACING: 'CORE_SPACING',
  CORE_PER_MINUTE: 'CORE_PER_MINUTE',
  SESSION_PER_HOUR: 'SESSION_PER_HOUR',
} as const;
export type SearchBound = (typeof SearchBound)[keyof typeof SearchBound];

export type SearchAllowance = { readonly allowed: true } | { readonly allowed: false; readonly bound: SearchBound; readonly retryAfterMs: number };

export interface SearchLimiter {
  /** Asks without counting: the first bound a start at `now` would break, or `allowed`. */
  check(sessionId: string, now: number): SearchAllowance;
  /** Counts one started search of `sessionId` at `now`. */
  record(sessionId: string, now: number): void;
  /** Forgets a session (sign-out). The per-Core bounds keep its starts. */
  forgetSession(sessionId: string): void;
  /** Sessions the limiter still holds starts of: for the tests of its bounded memory. */
  heldSessions(): number;
  /** The sessions the limiter holds starts of. */
  sessionIds(): string[];
}

export function createSearchLimiter(): SearchLimiter {
  /** Start times of the last hour, oldest first, per session and for the Core. */
  const bySession = new Map<string, number[]>();
  let core: number[] = [];

  const prune = (now: number): void => {
    core = core.filter((at) => now - at < MINUTE_MS);
    for (const [sessionId, starts] of bySession) {
      const kept = starts.filter((at) => now - at < HOUR_MS);
      if (kept.length === 0) bySession.delete(sessionId);
      else bySession.set(sessionId, kept);
    }
  };
  const refuse = (bound: SearchBound, retryAfterMs: number): SearchAllowance => ({ allowed: false, bound, retryAfterMs: Math.max(1, retryAfterMs) });

  return {
    check(sessionId, now) {
      prune(now);
      const own = bySession.get(sessionId) ?? [];
      const lastOwn = own.at(-1);
      if (lastOwn !== undefined && now - lastOwn < CAPTURE_DISCOVERY_MIN_INTERVAL_MS) return refuse(SearchBound.SESSION_SPACING, lastOwn + CAPTURE_DISCOVERY_MIN_INTERVAL_MS - now);
      const lastCore = core.at(-1);
      if (lastCore !== undefined && now - lastCore < CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS) return refuse(SearchBound.CORE_SPACING, lastCore + CAPTURE_DISCOVERY_MIN_INTERVAL_PER_CORE_MS - now);
      if (core.length >= CAPTURE_DISCOVERY_MAX_PER_MINUTE) return refuse(SearchBound.CORE_PER_MINUTE, (core[core.length - CAPTURE_DISCOVERY_MAX_PER_MINUTE] ?? now) + MINUTE_MS - now);
      if (own.length >= CAPTURE_DISCOVERY_MAX_PER_HOUR) return refuse(SearchBound.SESSION_PER_HOUR, (own[own.length - CAPTURE_DISCOVERY_MAX_PER_HOUR] ?? now) + HOUR_MS - now);
      return { allowed: true };
    },
    record(sessionId, now) {
      prune(now);
      core.push(now);
      bySession.set(sessionId, [...(bySession.get(sessionId) ?? []), now]);
    },
    forgetSession(sessionId) {
      bySession.delete(sessionId);
    },
    heldSessions: () => bySession.size,
    sessionIds: () => [...bySession.keys()],
  };
}
