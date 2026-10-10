// Shared helpers of the wave H C2 tests (evidence clients, web): one Live page on the Live test bed
// with operation 40 scripted WHOLE (media, access, exports), and the shapes of a REAL item as a
// Core sends it. No production file imports this folder.
import { cleanup } from '@testing-library/react'
import { toast } from '@heroui/react'
import { vi } from 'vitest'
import { CORE_API_EXAMPLES, EvidenceDetailSchema, type EvidenceDetail } from '@dems/shared/api'
import type { EvidenceItem } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { stopSims } from './harness'
import { clearToasts, evidenceWith, installJsdomStubs, openLiveEvidence, type LiveEvidence, type LiveEvidenceOptions } from './live-evidence-bed'

export const UI = { timeout: 15_000 }
export const H = (char: string) => char.repeat(64)

/**
 * Reconcile pass R: WHAT A REAL ITEM LOOKS LIKE IS THE CONTRACT'S, never a hand-written object. The
 * `getEvidence` 200 examples of `packages/shared/src/api/evidence.ts`, each checked against the strict
 * schema of operation 40 and handed out as a fresh copy.
 */
export type ContractItemName = 'withPackage' | 'productSealed' | 'productSealedInterrupted' | 'productSealedOneCamera' | 'noMedia' | 'outsideCaseScope' | 'seedSealedDemo'
export function contractDetail(name: ContractItemName): EvidenceDetail {
  const example = (CORE_API_EXAMPLES.getEvidence?.responses[200] as Record<string, { value: unknown }> | undefined)?.[name]
  if (example === undefined) throw new Error(`the contract has no getEvidence 200 example "${name}"`)
  return EvidenceDetailSchema.parse(JSON.parse(JSON.stringify(example.value)))
}
/** Every `getEvidence` 200 example of the contract, by name. */
export const contractDetailNames = (): string[] => Object.keys(CORE_API_EXAMPLES.getEvidence?.responses[200] ?? {})

/**
 * A REAL item as a Core serves it, on an item of the bed (its identity, tracks and custody stay the
 * bed's): the members that make it a product-sealed item are TAKEN FROM the contract's
 * `productSealed` example (integrity source, manifest version, the Ed25519 signature, `sealedPackage`).
 * `developmentKey` is left to the case (the key-class cases state each of its values).
 */
export const asReal =
  (extra: Record<string, unknown> = {}, signature: Record<string, unknown> = {}) =>
  (item: EvidenceItem): EvidenceItem => {
    const sealed = contractDetail('productSealed').evidence
    const { developmentKey: _developmentKey, ...sealedSignature } = sealed.signature as Record<string, unknown>
    return {
      ...item,
      integritySource: sealed.integritySource,
      manifestVersion: sealed.manifestVersion,
      transcriptSha256: sealed.transcriptSha256,
      labelsStatus: sealed.labelsStatus,
      developmentSources: sealed.developmentSources,
      sealedPackage: sealed.sealedPackage,
      durationMs: 120_000,
      tracks: item.tracks.filter((track) => track.trackId === 'VIDEO-01' || track.trackId === 'VIDEO-02'),
      signature: { ...sealedSignature, ...signature },
      ...extra,
    } as unknown as EvidenceItem
  }

export type Op40Extra = Record<string, unknown>

/** Scripts operation 40 for one item: the served item with `media` and whatever else the Core states (`access`, `exports`). */
export function scriptDetail(bed: LiveEvidence['bed'], evidenceId: string, media: Record<string, unknown>, extra: Op40Extra = {}): void {
  bed.fake.answer('getEvidence', (call) => {
    const item = bed.core.served.evidence.find((entry) => entry.id === (call.params.id ?? ''))
    if (!item) return bed.fake.example('getEvidence', 404, 'notFound')
    const body = call.params.id === evidenceId ? { evidence: JSON.parse(JSON.stringify(item)), media, ...extra } : { evidence: JSON.parse(JSON.stringify(item)), media: { source: 'NONE', packageSuffix: null } }
    // Reconcile pass R: a scripted answer of operation 40 is held to the contract's STRICT schema - a member
    // name no Core sends (`media.files`, `access.transcript`) fails the test here instead of passing unseen.
    const checked = EvidenceDetailSchema.safeParse(body)
    if (!checked.success) throw new Error(`the scripted answer of operation 40 is not the contract's shape: ${checked.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`)
    return { status: 200, body } as never
  })
}

export interface OpenItemOptions {
  readonly change?: (item: EvidenceItem) => EvidenceItem
  readonly media?: Record<string, unknown>
  readonly extra?: Op40Extra
  readonly before?: (bed: LiveEvidence['bed']) => void
  readonly session?: LiveEvidenceOptions['session']
}

/** Opens `path` in Live mode with the item changed in the served state and operation 40 scripted for it. */
export async function openItem(path: string, evidenceId: string, options: OpenItemOptions = {}): Promise<LiveEvidence> {
  return openLiveEvidence(path, {
    ...(options.session ? { session: options.session } : {}),
    before: (bed) => {
      if (options.change) bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, evidenceId, options.change) }
      if (options.media) scriptDetail(bed, evidenceId, options.media, options.extra)
      options.before?.(bed)
    },
  })
}

export function setupPage(): void {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  installJsdomStubs()
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: vi.fn() })
}

export async function teardownPage(opened: LiveEvidence | undefined): Promise<void> {
  cleanup()
  await clearToasts()
  toast.clear()
  opened?.bed.dispose()
  stopSims()
  vi.restoreAllMocks()
}

/** Every `<img>` and bundled-media element inside a container (a picture or a player that must not be there). */
export const pictures = (container: HTMLElement): Element[] => Array.from(container.querySelectorAll('img, video, audio'))
