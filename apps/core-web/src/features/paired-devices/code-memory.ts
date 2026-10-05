/**
 * The memory of the pairing code (backend task 04_client_integration_spec §10.3, PG-6a, WS-12,
 * RC-3; AC-C-96, AC-C-106; security design review SD-20; plan row W81).
 *
 * The Core returns a code ONCE, in the answer of operation 15. The page keeps it here and nowhere
 * else:
 *
 * | Where the code could go | Here |
 * |-------------------------|------|
 * | Web storage, the URL, the clipboard | Never |
 * | The TanStack Query cache (queries and mutations) | Never: the issue is no `useMutation`, and `['core','pairing-code']` holds operation 16's status, which has no code |
 * | A toast, a record of the page's log, a translation | Never: the panel renders the digits as plain text, nothing else receives them |
 * | This memory | From the issue's answer until the first of: a new issue, "Cancel code", the code redeemed or closed, and the PG-6a clearing |
 *
 * **One entry per query client.** The console builds one query client per page load (`main.tsx`), so
 * an entry lives at most as long as the page load ("a reload does not show it again", §10.3), and
 * survives a visit to another page of the console ("leaving the page and coming back shows it
 * again"). It is keyed by the client in a `WeakMap`, so it is never global to the module and goes
 * with its client.
 *
 * **PG-6a.** Holding a code subscribes to `onCoreQueriesCleared(queryClient, …)` (rule 3 of the page
 * rows): the query bridge calls it in the same turn in which it empties the cache — a sign-out of
 * this console, `session.ended` with any reason, a session that loses `PAIRING_MANAGE` (or
 * `USER_ADMIN`), another operator on the session. The entry is then dropped whole, so a second
 * operator who signs in on the same page load finds no digit of the first. The subscription is
 * made with the code, not with the page: it holds while the operator is on another page.
 */
import { useCallback, useSyncExternalStore } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import type { PairingCodeIssued } from '@dems/shared/api'
import { CORE_QUERY_KEYS, onCoreQueriesCleared } from '@/runtime'
import type { CodeOutcome, HeldCodeFacts } from './model'

/** The code this page load issued: the answer of operation 15 as it arrived. */
export interface HeldCode extends HeldCodeFacts {
  readonly code: string
  readonly qrPayload: string
  /** The digits have been revealed once (`TextScramble`); a later visit shows them at once. */
  readonly revealed: boolean
}

/** What the page shows of the codes of this page load. Replaced as a whole on every change. */
export interface CodeMemory {
  readonly held: HeldCode | null
  readonly outcome: CodeOutcome | null
  /** The code this page cancelled itself, so its own `CANCELLED` row is not "cancelled elsewhere". */
  readonly cancelledHere: string | null
}

export const EMPTY_CODE_MEMORY: CodeMemory = { held: null, outcome: null, cancelledHere: null }

interface Entry {
  memory: CodeMemory
  readonly listeners: Set<() => void>
  /** The PG-6a subscription while something is held; `null` when the memory is empty. */
  stopClearing: (() => void) | null
}

const entries = new WeakMap<QueryClient, Entry>()

function entryOf(queryClient: QueryClient): Entry {
  let entry = entries.get(queryClient)
  if (entry === undefined) {
    entry = { memory: EMPTY_CODE_MEMORY, listeners: new Set(), stopClearing: null }
    entries.set(queryClient, entry)
  }
  return entry
}

function isEmpty(memory: CodeMemory): boolean {
  return memory.held === null && memory.outcome === null && memory.cancelledHere === null
}

function write(queryClient: QueryClient, next: CodeMemory): void {
  const entry = entryOf(queryClient)
  if (entry.memory === next) return
  entry.memory = next
  if (isEmpty(next)) {
    entry.stopClearing?.()
    entry.stopClearing = null
  } else if (entry.stopClearing === null) {
    entry.stopClearing = onCoreQueriesCleared(queryClient, () => forgetCodes(queryClient))
  }
  for (const listener of Array.from(entry.listeners)) listener()
}

/** What is held for `queryClient` now. */
export function codeMemoryOf(queryClient: QueryClient): CodeMemory {
  return entries.get(queryClient)?.memory ?? EMPTY_CODE_MEMORY
}

/** For `useSyncExternalStore`. */
export function subscribeCodeMemory(queryClient: QueryClient, listener: () => void): () => void {
  const entry = entryOf(queryClient)
  entry.listeners.add(listener)
  return () => {
    entry.listeners.delete(listener)
  }
}

/**
 * Keeps the answer of operation 15. A new code replaces the previous one, and any outcome. It notes
 * how many status answers the cache had taken, so a status read before this issue is not taken for
 * news about it (`issuePanelState`, rule 2).
 */
export function holdCode(queryClient: QueryClient, issued: PairingCodeIssued): void {
  const statusCount = queryClient.getQueryState(CORE_QUERY_KEYS.pairingCode)?.dataUpdateCount ?? 0
  write(queryClient, {
    held: {
      codeId: issued.codeId,
      code: issued.code,
      qrPayload: issued.qrPayload,
      issuedAt: issued.issuedAt,
      expiresAt: issued.expiresAt,
      attemptsAllowed: issued.attemptsAllowed,
      statusCount,
      revealed: false,
    },
    outcome: null,
    cancelledHere: null,
  })
}

/** The digits of `codeId` have been revealed once. */
export function markRevealed(queryClient: QueryClient, codeId: string): void {
  const memory = codeMemoryOf(queryClient)
  if (memory.held === null || memory.held.codeId !== codeId || memory.held.revealed) return
  write(queryClient, { ...memory, held: { ...memory.held, revealed: true } })
}

/** "Cancel code" was answered: the code is gone, and its `CANCELLED` row is this page's own. */
export function codeCancelledHere(queryClient: QueryClient, codeId: string): void {
  write(queryClient, { held: null, outcome: null, cancelledHere: codeId })
}

/** The held code ended (redeemed, exhausted, cancelled elsewhere): the digits go, the outcome stays. */
export function codeEnded(queryClient: QueryClient, outcome: CodeOutcome): void {
  const memory = codeMemoryOf(queryClient)
  if (memory.held === null || memory.held.codeId !== outcome.codeId) return
  write(queryClient, { held: null, outcome, cancelledHere: memory.cancelledHere })
}

/** An issue elsewhere replaced the held code: the digits go, nothing is kept about it. */
export function codeReplaced(queryClient: QueryClient, codeId: string): void {
  const memory = codeMemoryOf(queryClient)
  if (memory.held === null || memory.held.codeId !== codeId) return
  write(queryClient, { ...memory, held: null })
}

/** The outcome was shown long enough (Redeemed returns to Idle after 4 s). */
export function clearOutcome(queryClient: QueryClient): void {
  const memory = codeMemoryOf(queryClient)
  if (memory.outcome === null) return
  write(queryClient, { ...memory, outcome: null })
}

/** PG-6a: everything of this page load's codes is dropped at once. */
export function forgetCodes(queryClient: QueryClient): void {
  write(queryClient, EMPTY_CODE_MEMORY)
}

/** The memory of the page's query client, as React state. */
export function useCodeMemory(queryClient: QueryClient): CodeMemory {
  const subscribe = useCallback((listener: () => void) => subscribeCodeMemory(queryClient, listener), [queryClient])
  const snapshot = useCallback(() => codeMemoryOf(queryClient), [queryClient])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
