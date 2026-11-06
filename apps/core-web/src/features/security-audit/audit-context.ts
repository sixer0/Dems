/**
 * The audit log as the page renders it (03_motion_spec §9.3 rendering discipline).
 *
 * The page subscribes to `s.audit` once and hands its panels a **deferred** copy through this
 * context (`useDeferredValue`): when an entry arrives, the urgent render bails out at the
 * memoised panels and React renders the new rows at transition priority, which yields to the
 * browser, so a live insertion (M-C-07) or a tamper escalation never becomes a long task. The
 * delay is one background render (well under a frame budget on the demo Mac).
 */
import { createContext, useContext } from 'react'
import type { AuditLogSlice } from '@dems/shared/sim'

export const AuditLogContext = createContext<AuditLogSlice | null>(null)

export function useAuditLog(): AuditLogSlice {
  const log = useContext(AuditLogContext)
  if (!log) throw new Error('useAuditLog must be used inside the Security & Audit page.')
  return log
}
