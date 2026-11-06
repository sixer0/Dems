// Plan row W81: the memory of the pairing code (`code-memory.ts`) with a real query client and the
// real query bridge's clearing (PG-6a, AC-C-106): one entry per client, the subscription made with
// the code and released when the memory is empty.
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { PairingCodeIssued } from '@dems/shared/api'
import { clearCoreQueries } from '@/runtime/query-bridge'
import { CORE_QUERY_KEYS } from '@/runtime'
import {
  clearOutcome,
  codeCancelledHere,
  codeEnded,
  codeMemoryOf,
  codeReplaced,
  EMPTY_CODE_MEMORY,
  forgetCodes,
  holdCode,
  markRevealed,
  subscribeCodeMemory,
} from '../code-memory'

const T0 = 1_790_823_600_000
const issued = (code: string, codeId = 'PCD-000101'): PairingCodeIssued => ({
  codeId,
  code,
  qrPayload: `DEMS-PAIR:1:${code}`,
  issuedAt: T0,
  expiresAt: T0 + 300_000,
  attemptsAllowed: 5,
})

describe('code memory', () => {
  it('one entry per query client: a second page load (another client) sees nothing of the first', () => {
    const first = new QueryClient()
    const second = new QueryClient()
    holdCode(first, issued('861204'))
    expect(codeMemoryOf(first).held?.code).toBe('861204')
    expect(codeMemoryOf(second)).toBe(EMPTY_CODE_MEMORY)
  })

  it('the bridge\'s clearing drops everything of the client in the same turn, and only once subscribed', () => {
    const queryClient = new QueryClient()
    holdCode(queryClient, issued('861204'))
    clearCoreQueries(queryClient)
    expect(codeMemoryOf(queryClient)).toEqual(EMPTY_CODE_MEMORY)
    // After the drop the subscription is gone: a later hold subscribes again and is dropped again.
    holdCode(queryClient, issued('861205', 'PCD-000102'))
    clearCoreQueries(queryClient)
    expect(codeMemoryOf(queryClient).held).toBeNull()
  })

  it('holds the issue answer\'s members and the status count; a new code replaces the old and any outcome', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(CORE_QUERY_KEYS.pairingCode, { active: null })
    queryClient.setQueryData(CORE_QUERY_KEYS.pairingCode, { active: null })
    holdCode(queryClient, issued('861204'))
    expect(codeMemoryOf(queryClient).held).toMatchObject({ codeId: 'PCD-000101', code: '861204', qrPayload: 'DEMS-PAIR:1:861204', statusCount: 2, revealed: false })
    codeEnded(queryClient, { kind: 'EXHAUSTED', codeId: 'PCD-000101', at: T0 })
    expect(codeMemoryOf(queryClient)).toMatchObject({ held: null, outcome: { kind: 'EXHAUSTED' } })
    holdCode(queryClient, issued('861205', 'PCD-000102'))
    expect(codeMemoryOf(queryClient)).toMatchObject({ held: { codeId: 'PCD-000102' }, outcome: null, cancelledHere: null })
  })

  it('reveal, cancel, replace, end and forget each change only what they name', () => {
    const queryClient = new QueryClient()
    holdCode(queryClient, issued('861204'))
    markRevealed(queryClient, 'PCD-000999')
    expect(codeMemoryOf(queryClient).held?.revealed).toBe(false)
    markRevealed(queryClient, 'PCD-000101')
    expect(codeMemoryOf(queryClient).held?.revealed).toBe(true)
    codeReplaced(queryClient, 'PCD-000999')
    expect(codeMemoryOf(queryClient).held).not.toBeNull()
    codeEnded(queryClient, { kind: 'CANCELLED_ELSEWHERE', codeId: 'PCD-000999', at: T0 })
    expect(codeMemoryOf(queryClient).held).not.toBeNull()
    codeReplaced(queryClient, 'PCD-000101')
    expect(codeMemoryOf(queryClient).held).toBeNull()

    holdCode(queryClient, issued('861204'))
    codeCancelledHere(queryClient, 'PCD-000101')
    expect(codeMemoryOf(queryClient)).toEqual({ held: null, outcome: null, cancelledHere: 'PCD-000101' })
    forgetCodes(queryClient)
    expect(codeMemoryOf(queryClient)).toBe(EMPTY_CODE_MEMORY)

    holdCode(queryClient, issued('861204'))
    codeEnded(queryClient, { kind: 'REDEEMED', codeId: 'PCD-000101', deviceId: 'DEV-0002', deviceName: 'New', at: T0 })
    clearOutcome(queryClient)
    expect(codeMemoryOf(queryClient).outcome).toBeNull()
  })

  it('tells its subscribers of every change, and an unsubscribed listener no more', () => {
    const queryClient = new QueryClient()
    const listener = vi.fn()
    const stop = subscribeCodeMemory(queryClient, listener)
    holdCode(queryClient, issued('861204'))
    forgetCodes(queryClient)
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
    holdCode(queryClient, issued('861204'))
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
