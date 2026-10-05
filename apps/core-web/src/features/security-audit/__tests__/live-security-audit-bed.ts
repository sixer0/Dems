// Plan row W75: the Live helpers of the three test files `src/test/live-security-audit-*.test.tsx`,
// built on W50's harness (`@/runtime/testing/live-harness`). No production file imports this folder,
// and this file imports no test double itself (TS-15 of `live-runtime-static.test.tsx`: the harness
// is the one non-test file that imports the fake transport).
import { createElement } from 'react'
import { act, render, screen } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import type { AuditChainStatus, AuthSessionInfo } from '@dems/shared/api'
import type { SocketLike } from '@dems/shared/realtime'
import {
  ALWAYS_VISIBLE,
  appendAudit,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  GENESIS_HASH,
  type AuditLogSlice,
  type AuditRow,
  type Sim,
  type SimState,
} from '@dems/shared/sim'
import { createAppRouter } from '@/router'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed, type MountedPage } from '@/runtime/testing/live-harness'

/** The page's route. */
export const SECURITY_AUDIT_PATH = '/security-audit'

const originalMatchMedia = window.matchMedia

/** Empties the kit's toast queue, which is one per page and outlives a test (F76-9). */
export async function clearToasts(): Promise<void> {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

/** The toasts on screen, by their text (scoped to the kit's toast slot, F76-9). */
export const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
export const toastWith = (text: string): string[] => toastTexts().filter((entry) => entry.includes(text))

/**
 * React Aria's Virtualizer treats an unmocked jsdom viewport as infinite and renders every row; a
 * 600 × 1600 viewport makes the audit table virtualise as in the browser (the folder's own test does
 * the same). Returns the undo.
 */
export function stubViewport(): () => void {
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1600 })
  Element.prototype.scrollTo ??= function scrollTo() {}
  Element.prototype.scrollIntoView ??= function scrollIntoView() {}
  return () => {
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
  }
}

export interface LiveSecurityAudit {
  readonly bed: LiveTestBed
  readonly page: LivePage
  readonly mounted: MountedPage
}

export interface LiveSecurityAuditOptions {
  readonly session?: Pick<AuthSessionInfo, 'operator' | 'permissions'>
  /** The state the Core serves as the snapshot (default: the harness's idle state). */
  readonly served?: (idle: SimState) => SimState
  /** Script operation 10 with the contract's seeded matrix (default true). */
  readonly matrix?: boolean
  readonly strict?: boolean
  /** Scripts of the test, before the page loads (one-shot answers are taken before repeating ones). */
  readonly prepare?: (bed: LiveTestBed) => void
}

/** A signed-in operator on the Security & Audit page in Live mode, every panel mounted. */
export async function liveSecurityAudit(options: LiveSecurityAuditOptions = {}): Promise<LiveSecurityAudit> {
  const bed = createLiveTestBed({ session: options.session ?? SUPERVISOR_SESSION })
  if (options.served) bed.core.served = options.served(bed.core.served)
  options.prepare?.(bed)
  if (options.matrix !== false) bed.fake.answer('getRoleMatrix', bed.fake.example('getRoleMatrix', 200, 'seeded'))
  const page = await bed.load()
  const mounted = await bed.mount(page, SECURITY_AUDIT_PATH, options.strict ? { strict: true } : {})
  await screen.findByTestId('page-security-audit', {}, { timeout: 15_000 })
  // The audit table, the lenses and access control mount in two transitions (staged mount).
  await screen.findByTestId('panel-rbac', {}, { timeout: 15_000 })
  await bed.flush()
  return { bed, page, mounted }
}

/** An audit chain of `count` rows from the genesis hash (the Core's stored table), one row a second up to `end`. */
export function auditChain(count: number, end: number): AuditLogSlice {
  let log: AuditLogSlice = { rows: [], head: GENESIS_HASH, total: 0, dropped: 0 }
  for (let index = 0; index < count; index += 1) {
    log = appendAudit(
      log,
      { type: 'DIAGNOSTICS_RUN', message: 'Diagnostics run', actorId: 'OPR-003', details: { checks: 6 } },
      end - (count - index) * 1_000,
      100_000,
    ).log
  }
  return log
}

/** The ring a socket holds of a longer stored chain: the newest `keep` rows, the rest dropped off the front. */
export function ringOf(table: AuditLogSlice, keep: number): AuditLogSlice {
  const rows = table.rows.slice(-keep)
  return { rows, head: table.head, total: table.total, dropped: table.total - rows.length }
}

/** The cursor form of the Core's audit list: the row's ID and the first 16 digits of its hash (implementation/39 §5.3). */
export const cursorOf = (row: AuditRow): string => `${row.id}-${row.hash.slice(0, 16)}`

/** One answer of `verifyAuditChain` built from the contract's intact example with the given changes. */
export function chainStatus(intact: AuditChainStatus, change: Partial<AuditChainStatus>): AuditChainStatus {
  return { ...intact, ...change }
}

// ── Simulated mode: the page over a simulator, as the folder's own test mounts it ───────────────

class SilentSocket implements SocketLike {
  readyState = 0
  onopen: SocketLike['onopen'] = null
  onmessage: SocketLike['onmessage'] = null
  onclose: SocketLike['onclose'] = null
  onerror: SocketLike['onerror'] = null
  close() {
    this.readyState = 3
  }
}

/** The simulator's fixed "now" (as the folder's own test, so the dataset joins the DEMO packages). */
export const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')

/** A simulator with `operatorId` signed in, no engine ticks. */
export function makeSim(operatorId: string, prepare?: (sim: Sim) => void): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: DEMO_NOW })
  const sim = createSim({
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    clock: createManualClock(DEMO_NOW),
    scheduler: () => () => undefined,
  })
  prepare?.(sim)
  return sim
}

/** The page in Simulated mode around `sim` (the router of the app, no Live source). */
export async function simulatedSecurityAudit(sim: Sim): Promise<void> {
  const router = createAppRouter(
    { sim, queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }), socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: [SECURITY_AUDIT_PATH] }) },
  )
  render(createElement(RouterProvider, { router }))
  await screen.findByTestId('page-security-audit', {}, { timeout: 15_000 })
  await screen.findByTestId('panel-rbac', {}, { timeout: 15_000 })
  await act(async () => {
    await Promise.resolve()
  })
}
