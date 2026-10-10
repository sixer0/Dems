// Shared helpers of the Live tests of the Evidence page (plan row W69): the page on W50's Live bed
// (the contract-checked fake transport, the real Live start-up, the real router), wrapped in the
// page's asset context so the bundled-package check reads the DEMO files from disk, as the folder's
// own tests do, instead of fetching them through the bed's fake `fetch`. Used only by
// `src/test/live-evidence-*.test.tsx`. No production file imports this folder.
import { createElement, StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { toast } from '@heroui/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { vi } from 'vitest'
import { CORE_API_OPERATIONS, CoreApiTag, type AuthSessionInfo, type EvidenceMediaRef } from '@dems/shared/api'
import type { EvidenceItem } from '@dems/shared/sim'
import { createAppRouter, type AppRouter } from '@/router'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed } from '@/runtime/testing/live-harness'
import { EvidenceAssetsContext } from '../demo-assets'
import { diskAssets } from './harness'

/**
 * An answer of the fake transport, named through the harness: only `runtime/testing/live-harness.ts`
 * imports the fake transport outside a test file (the TS-15 rule of `live-runtime-static.test.tsx`).
 */
type FakeAnswer = ReturnType<LiveTestBed['fake']['example']>

/** The address of the page in a Live test (the docblock of each file sets it too). */
export const PAGE_ADDRESS = 'http://127.0.0.1:5178/'

/** The served dataset's IDs (the bed's clock stands at 2026-10-01T10:00+07:00). */
export const EV = {
  /** SEALED, pristine package 0001. */
  sealed: 'EV-20260929-0001',
  /** SEALED, pristine package 0002. */
  sealed2: 'EV-20260929-0002',
  /** EXPORTED, package 0004 with the prebuilt export zip. */
  exported: 'EV-20260930-0004',
  /** SEALED, tampered on AUDIO-02 (in the simulator's record and in the package's stored copy). */
  tampered: 'EV-20260930-0005',
  /** RECORDED: never sealed. */
  recorded: 'EV-20260930-0006',
  sealed7: 'EV-20261001-0007',
} as const

/** The demo operations (the registry's tag `Demo`): none of them may be called by this page (D-1, AC-C-61). */
export const DEMO_OPERATIONS: readonly string[] = CORE_API_OPERATIONS.filter((operation) => operation.tag === CoreApiTag.DEMO).map(
  (operation) => operation.operationId,
)

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

/** jsdom has no media playback, no scrolling and no Web Animations. */
export function installJsdomStubs(): void {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn(() => Promise.resolve()) })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() })
  Element.prototype.scrollTo ??= function scrollTo() {}
  if (typeof Element.prototype.getAnimations !== 'function') {
    Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => [] })
  }
  window.scrollTo = (() => undefined) as typeof window.scrollTo
}

/** A served item as it travels (a plain JSON copy). */
export function servedItem(bed: LiveTestBed, evidenceId: string): EvidenceItem {
  const item = bed.core.served.evidence.find((entry) => entry.id === evidenceId)
  if (!item) throw new Error(`the served state holds no ${evidenceId}`)
  return JSON.parse(JSON.stringify(item)) as EvidenceItem
}

/** The served `evidence` slice with one item changed: the effect a command has on the Core. */
export function evidenceWith(bed: LiveTestBed, evidenceId: string, change: (item: EvidenceItem) => EvidenceItem): EvidenceItem[] {
  return (JSON.parse(JSON.stringify(bed.core.served.evidence)) as EvidenceItem[]).map((item) => (item.id === evidenceId ? change(item) : item))
}

/** The served `audit` slice with one row appended (a well-formed row of the chain's shape). */
export function auditWith(bed: LiveTestBed, row: { type: string; evidenceId: string; actorId: string; details: Record<string, string> }) {
  const audit = JSON.parse(JSON.stringify(bed.core.served.audit)) as typeof bed.core.served.audit
  const last = audit.rows.at(-1)!
  const seq = last.seq + 1
  const hash = (seq.toString(16).padStart(2, '0') + 'ab').repeat(16).slice(0, 64)
  const appended = {
    ...last,
    seq,
    id: `AUD-${String(seq).padStart(6, '0')}`,
    at: last.at + 60_000,
    type: row.type,
    category: 'EVIDENCE',
    severity: 'INFO',
    actorId: row.actorId,
    message: `${row.type} ${row.evidenceId}`,
    evidenceId: row.evidenceId,
    sessionId: null,
    details: row.details,
    prevHash: last.hash,
    hash,
  }
  return { ...audit, rows: [...audit.rows, appended], head: hash, total: audit.total + 1 } as typeof audit
}

/**
 * Scripts operation 40 (`getEvidence`) by the served state: the media reference of each item is the
 * one named in `refs`, `NONE` otherwise; an unknown ID answers 404.
 */
export function scriptMedia(bed: LiveTestBed, refs: Readonly<Record<string, EvidenceMediaRef>> = {}): void {
  bed.fake.answer('getEvidence', (call): FakeAnswer => {
    const id = call.params.id ?? ''
    const item = bed.core.served.evidence.find((entry) => entry.id === id)
    if (!item) return bed.fake.example('getEvidence', 404, 'notFound')
    return { status: 200, body: { evidence: JSON.parse(JSON.stringify(item)), media: refs[id] ?? { source: 'NONE', packageSuffix: null } } }
  })
}

export const demoPackage = (suffix: string): EvidenceMediaRef => ({ source: 'DEMO_PACKAGE', packageSuffix: suffix })

/**
 * Scripts operation 87 (`getEvidenceExportJob`; blueprint row 92): the bed's Core finishes every
 * export at once, as the simulator does — any job ID answers a COMPLETE package job. The export
 * wizard reads the job of every export the Core accepted, so every Live test that exports needs an
 * answer; a test about the job itself scripts its own in `before`.
 */
export function scriptExportJobs(bed: LiveTestBed): void {
  bed.fake.answer('getEvidenceExportJob', (call): FakeAnswer => {
    const now = bed.fake.clock.now()
    const evidenceId = bed.core.served.evidence[0]?.id ?? EV.sealed
    return {
      status: 200,
      body: { jobId: call.params.id ?? 'EXPJ-000000', evidenceId, kind: 'PACKAGE', status: 'COMPLETE', progressPct: 100, etaMs: 0, manifestHash: 'ab'.repeat(32), signature: 'cd'.repeat(64), derived: false, createdAt: now, completedAt: now },
    }
  })
}

export interface LiveEvidence {
  readonly bed: LiveTestBed
  readonly page: LivePage
  readonly router: AppRouter
  /** The page's query client (a test reads its cache: what a page may and may not keep there). */
  readonly queryClient: QueryClient
}

export interface LiveEvidenceOptions {
  readonly session?: Pick<AuthSessionInfo, 'operator' | 'permissions'>
  /** The media references operation 40 answers. Default: `NONE` for every item. */
  readonly media?: Readonly<Record<string, EvidenceMediaRef>>
  /** Called after the bed exists and before the page loads (to script more answers). */
  readonly before?: (bed: LiveTestBed) => void
  /** The router in `StrictMode`, as `main.tsx` renders it (every dev build, where Live mode lives). */
  readonly strict?: boolean
}

/**
 * One page load in Live mode at `path`, signed in (default: the SUPERVISOR). The router is built as
 * the bed's `mount` builds it (the same factory, a real query client), inside the page's asset
 * context with the DEMO files read from disk.
 */
export async function openLiveEvidence(path: string, options: LiveEvidenceOptions = {}): Promise<LiveEvidence> {
  const bed = createLiveTestBed({ session: options.session ?? SUPERVISOR_SESSION })
  scriptMedia(bed, options.media)
  scriptExportJobs(bed)
  options.before?.(bed)
  const page = await bed.load()
  const assets = await diskAssets()
  const queryClient = new QueryClient()
  const router = createAppRouter(
    { sim: page.runtime.sim, queryClient },
    { history: createMemoryHistory({ initialEntries: [path] }) },
  )
  const app = createElement(EvidenceAssetsContext.Provider, { value: assets }, createElement(RouterProvider, { router }))
  render(options.strict ? createElement(StrictMode, null, app) : app)
  await act(async () => {
    await router.load()
  })
  await bed.flush()
  return { bed, page, router, queryClient }
}

/** Waits for the detail page and its body (the lazy chunk, then the Core's media reference). */
export async function findDetailBody(): Promise<HTMLElement> {
  await screen.findByTestId('page-evidence-detail', {}, { timeout: 15_000 })
  return screen.findByTestId('evidence-detail-body', {}, { timeout: 15_000 })
}

export { SUPERVISOR_SESSION }
