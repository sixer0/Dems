// Shared harness for the step-47 Evidence tests. Every test builds the real router (route tree,
// guards, providers) around its own simulator (D54(a): in-memory storage), pinned to the DEMO
// packages' `datasetNow` with a manual clock, so the simulator's IDs, case numbers and subjects
// are the ones the step-93 packages were generated for (the review-40 M4 join guard then holds on
// any calendar day). DEMO files are read from disk and Ed25519 is checked with Node's WebCrypto.
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { vi } from 'vitest'
import type { SocketLike } from '@dems/shared/realtime'
import { DEMO_EVIDENCE_INDEX, type DemoAssetLoader, type SubtleLike } from '@dems/shared/demo-data'
import {
  ALWAYS_VISIBLE,
  createManualClock,
  createMemoryAuthStorage,
  createSim,
  OPERATOR_IDS,
  type Sim,
} from '@dems/shared/sim'
import { createAppRouter, type AppRouter } from '@/router'
import { demoAssetUrlFor, EvidenceAssetsContext, type EvidenceAssetsValue } from '../demo-assets'

/** The instant the DEMO packages describe (2026-10-01T10:00+07:00 for the step-93 run). */
export const DATASET_NOW = Date.parse(DEMO_EVIDENCE_INDEX.datasetNow)

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

interface NodeFs {
  readFile(path: string): Promise<Uint8Array>
}

interface NodeCrypto {
  webcrypto: { subtle: SubtleLike }
}

/** Node built-ins through non-literal specifiers: core-web's app tsconfig carries no Node types. */
async function nodeModule<T>(name: string): Promise<T> {
  const specifier = `node:${name}`
  return (await import(/* @vite-ignore */ specifier)) as T
}

/**
 * packages/shared/assets/ as a file-system path. `import.meta.dirname` (Node, via Vitest) is used
 * instead of `new URL(…, import.meta.url)`, which Vite rewrites into a dev-server URL.
 */
const ASSET_ROOT = `${(import.meta as { dirname?: string }).dirname ?? '.'}/../../../../../../packages/shared/assets/`

/** Reads a DEMO asset (a path relative to packages/shared/assets/) from disk. */
export const diskLoader: DemoAssetLoader = async (assetPath) => {
  const fs = await nodeModule<NodeFs>('fs/promises')
  return new Uint8Array(await fs.readFile(`${ASSET_ROOT}${assetPath.replace(/^\/+/, '')}`))
}

export async function nodeSubtle(): Promise<SubtleLike> {
  return (await nodeModule<NodeCrypto>('crypto')).webcrypto.subtle
}

/** Assets for the tests: disk bytes, Node WebCrypto, the page's own URL map for `src` attributes. */
export async function diskAssets(overrides: Partial<EvidenceAssetsValue> = {}): Promise<EvidenceAssetsValue> {
  return { load: diskLoader, subtle: await nodeSubtle(), urlFor: demoAssetUrlFor, ...overrides }
}

export interface EvidenceHarness {
  sim: Sim
  router: AppRouter
}

const sims: Sim[] = []

export function createDatasetSim(operatorId: string | null = OPERATOR_IDS.BUDI): Sim {
  const authStorage = createMemoryAuthStorage()
  if (operatorId) authStorage.save({ operatorId, issuedAt: DATASET_NOW })
  const sim = createSim({
    clock: createManualClock(DATASET_NOW),
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined, // no engine ticks: the tests drive state directly
  })
  sims.push(sim)
  return sim
}

export function mountEvidence(path: string, options: { operatorId?: string | null; assets?: EvidenceAssetsValue } = {}): EvidenceHarness {
  const sim = createDatasetSim(options.operatorId === undefined ? OPERATOR_IDS.BUDI : options.operatorId)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createAppRouter(
    { sim, queryClient, socketFactory: () => new SilentSocket() },
    { history: createMemoryHistory({ initialEntries: [path] }) },
  )
  const app = createElement(RouterProvider, { router })
  render(options.assets ? createElement(EvidenceAssetsContext.Provider, { value: options.assets }, app) : app)
  return { sim, router }
}

export function stopSims(): void {
  for (const sim of sims.splice(0)) sim.stop()
}

/** jsdom lacks media playback, scrolling and Blob URLs; these stubs record the calls. */
export function installBrowserStubs() {
  const play = vi.fn(() => Promise.resolve())
  const pause = vi.fn()
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pause })
  Element.prototype.scrollTo ??= function scrollTo() {}
  // React Aria's SharedElementTransition (the kit Tabs indicator) reads running animations.
  if (typeof Element.prototype.getAnimations !== 'function') {
    Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => [] })
  }
  window.scrollTo = (() => undefined) as typeof window.scrollTo
  const createObjectURL = vi.fn(() => 'blob:evidence-test')
  const revokeObjectURL = vi.fn()
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
  )
  return { play, pause, createObjectURL, revokeObjectURL, click }
}

/** The evidence ID of a DEMO package suffix in the dataset simulator. */
export function evidenceIdOf(sim: Sim, suffix: string): string {
  const item = sim.store.getState().evidence.find((entry) => entry.id.endsWith(`-${suffix}`))
  if (!item) throw new Error(`No evidence with suffix ${suffix}`)
  return item.id
}

/**
 * Waits for a page and its lazily loaded body. The first render of a test file loads the lazy route
 * chunk and the body chunk (the page, the DEMO index and its documents), which can take longer than
 * Testing Library's 1 s default on a loaded machine.
 */
export async function findPage(testId: 'page-evidence' | 'page-evidence-detail'): Promise<HTMLElement> {
  const page = await screen.findByTestId(testId, {}, { timeout: 15_000 })
  if (page.dataset.found !== 'false') {
    await screen.findByTestId(testId === 'page-evidence' ? 'evidence-list-body' : 'evidence-detail-body', {}, { timeout: 15_000 })
  }
  return page
}
