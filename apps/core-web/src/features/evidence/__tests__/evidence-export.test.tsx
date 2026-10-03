// Step 47 export wizard (01_specs §14.5.3; design book §19.2, §19.3; D50, D51, D67 (d)): mandatory
// reason, RBAC through the simulator (EXPORT_DENIED for an investigator), real source verification
// before export (a tampered source blocks it), the chain-of-custody audit row, and the download:
// EV 0004's prebuilt EXP-000031.zip (its bytes hash to the value its export manifest records) or,
// for other items, the DEMO export manifest JSON.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeUtf8, EXPORT_MANIFEST_ITEMS, getDemoEvidencePackage, sha256Hex } from '@dems/shared/demo-data'
import { OPERATOR_IDS, toWibIso } from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { buildDemoExportManifest, exportDownloadPlan, prepareZipDownload } from '../export-download'
import { buildEvidenceRow } from '../model'
import { createDatasetSim, diskAssets, diskLoader, findPage, installBrowserStubs, mountEvidence, stopSims } from './harness'

const UI_TIMEOUT = 40_000
const PKG_0001 = getDemoEvidencePackage('0001')
const PKG_0004 = getDemoEvidencePackage('0004')
const PKG_0005 = getDemoEvidencePackage('0005')
if (!PKG_0001 || !PKG_0004 || !PKG_0005) throw new Error('DEMO packages 0001, 0004 and 0005 are required')

let stubs: ReturnType<typeof installBrowserStubs>

beforeEach(() => {
  resetMissingI18nKeys()
  stubs = installBrowserStubs()
})

afterEach(() => {
  cleanup()
  stopSims()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function openWizard(evidenceId: string, operatorId: string) {
  const harness = mountEvidence(`/evidence/${evidenceId}`, { operatorId, assets: await diskAssets() })
  await findPage('page-evidence-detail')
  fireEvent.click(screen.getByTestId('evidence-export'))
  const wizard = await screen.findByTestId('export-wizard')
  return { ...harness, wizard }
}

function enterReason(text: string) {
  const field = screen.getByTestId('export-reason')
  fireEvent.change(field, { target: { value: text } })
  fireEvent.click(screen.getByTestId('export-next'))
}

describe('prebuilt export package (EV 0004)', () => {
  it('hashes the EXP-000031.zip bytes to the SHA-256 its export manifest records', async () => {
    const zip = await diskLoader(PKG_0004.export?.zip.path ?? '')
    const manifest = JSON.parse(decodeUtf8(await diskLoader(PKG_0004.export?.manifest.path ?? ''))) as { package: { sha256: string } }
    expect(zip.byteLength).toBe(PKG_0004.export?.zip.bytes)
    expect(sha256Hex(zip)).toBe(manifest.package.sha256)

    const plan = exportDownloadPlan({ id: PKG_0004.evidenceId, pkg: PKG_0004 }, 'EXP-000099')
    expect(plan).toMatchObject({ kind: 'zip', fileName: 'EXP-000031.zip', prebuiltExportId: 'EXP-000031' })
    if (plan.kind !== 'zip') throw new Error('expected a zip plan')
    const prepared = await prepareZipDownload(diskLoader, plan)
    expect(prepared.check).toMatchObject({ id: 'exportPackage', ok: true, actual: manifest.package.sha256 })
  })

  it('builds a DEMO export manifest with the eight §19.2 items for other items', () => {
    const sim = createDatasetSim(OPERATOR_IDS.ANDI)
    const state = sim.store.getState()
    const item = state.evidence.find((entry) => entry.id === PKG_0001.evidenceId)
    if (!item) throw new Error('EV 0001 missing')
    const row = buildEvidenceRow(item, state.operators)
    expect(exportDownloadPlan(row, 'EXP-000032')).toEqual({ kind: 'manifest', fileName: `EXP-000032-${row.id}-export-manifest.demo.json` })
    const json = JSON.parse(
      buildDemoExportManifest({
        row,
        exportId: 'EXP-000032',
        exportedAt: state.clock.now,
        operator: { id: 'OPR-002', displayName: 'AKP Andi Pratama', role: 'SUPERVISOR' },
        destination: 'Case file transfer (simulated)',
        reason: 'Prosecutor request',
        authorizationRef: 'AUD-000999',
        device: state.device,
        verification: { report: null, simulated: null },
      }),
    ) as Record<string, unknown>
    expect(json.demo).toBe(true)
    expect(String(json.notice)).toMatch(/^DEMO/)
    for (const entry of EXPORT_MANIFEST_ITEMS) expect(json, entry.key).toHaveProperty(entry.key)
    expect(json.sessionManifest).toMatchObject({ sha256: PKG_0001.signature.signedDigest })
    expect(json.export).toMatchObject({ exportId: 'EXP-000032', exportedAt: toWibIso(state.clock.now) })
    expect(json.authorization).toEqual({ purpose: 'Prosecutor request', reference: 'AUD-000999' })
  })
})

describe('export wizard', () => {
  it('requires a reason of at least 5 characters', async () => {
    await openWizard(PKG_0001.evidenceId, OPERATOR_IDS.ANDI)
    fireEvent.click(screen.getByTestId('export-next'))
    expect(await screen.findByText('Enter a reason of at least 5 characters.')).toBeInTheDocument()
    expect(screen.getByTestId('export-step-reason')).toBeInTheDocument()
    enterReason('ok')
    expect(screen.getByTestId('export-step-reason')).toBeInTheDocument()
    enterReason('Prosecutor request')
    expect(await screen.findByTestId('export-step-authorise')).toBeInTheDocument()
  }, UI_TIMEOUT)

  it('denies an investigator (RBAC through the simulator) and records EXPORT_DENIED', async () => {
    const { sim } = await openWizard(PKG_0001.evidenceId, OPERATOR_IDS.BUDI)
    enterReason('Prosecutor request')
    await screen.findByTestId('export-step-authorise')
    fireEvent.click(screen.getByTestId('export-authorise'))
    const alert = await screen.findByTestId('export-denied')
    expect(alert).toHaveTextContent('Export not permitted')
    expect(within(alert).getByTestId('lock-shackle')).toBeInTheDocument()
    const last = sim.store.getState().audit.rows.at(-1)
    expect(last).toMatchObject({ type: 'EXPORT_DENIED', evidenceId: PKG_0001.evidenceId, actorId: OPERATOR_IDS.BUDI })
    expect(screen.queryByTestId('export-next')).not.toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  }, UI_TIMEOUT)

  it('exports EV 0004 for a supervisor: verified source, custody audit row, then the prebuilt zip download', async () => {
    const { sim } = await openWizard(PKG_0004.evidenceId, OPERATOR_IDS.ANDI)
    enterReason('Prosecutor request')
    await screen.findByTestId('export-step-authorise')
    fireEvent.click(screen.getByTestId('export-authorise'))
    fireEvent.click(await screen.findByTestId('export-next'))
    const source = await screen.findByTestId(`export-source-${PKG_0004.evidenceId}`)
    await waitFor(() => expect(source).toHaveAttribute('data-verdict', 'PASS'), { timeout: 25_000 })
    // The export package itself is part of the source check for an exported item.
    expect(source.querySelector('[data-check="exportPackage"]')).toHaveAttribute('data-phase', 'pass')
    fireEvent.click(screen.getByTestId('export-next'))
    fireEvent.click(await screen.findByTestId('export-submit'))

    const results = await screen.findByTestId('export-results')
    const result = results.querySelector<HTMLElement>('[data-export-id]')
    const exportId = result?.dataset.exportId ?? ''
    expect(exportId).toMatch(/^EXP-\d{6}$/)
    expect(result).toHaveAttribute('data-plan', 'zip')
    const state = sim.store.getState()
    const custody = state.evidence.find((item) => item.id === PKG_0004.evidenceId)?.custody.at(-1)
    expect(custody).toMatchObject({ action: 'EXPORTED', actorId: OPERATOR_IDS.ANDI })
    const exported = state.audit.rows.filter((row) => row.type === 'EVIDENCE_EXPORTED' && row.evidenceId === PKG_0004.evidenceId).at(-1)
    expect(exported?.details).toMatchObject({ exportId, reason: 'Prosecutor request' })

    fireEvent.click(screen.getByTestId(`export-download-${PKG_0004.evidenceId}`))
    const check = await screen.findByTestId('export-zip-check')
    expect(check).toHaveAttribute('data-ok', 'true')
    await waitFor(() => expect(stubs.createObjectURL).toHaveBeenCalledTimes(1))
    const blob = stubs.createObjectURL.mock.calls[0]?.[0 as never] as unknown as Blob
    expect(blob.type).toBe('application/zip')
    expect(blob.size).toBe(PKG_0004.export?.zip.bytes)
    expect(stubs.click).toHaveBeenCalled()
    const anchor = stubs.click.mock.contexts.at(-1) as HTMLAnchorElement
    expect(anchor.download).toBe('EXP-000031.zip')
  }, UI_TIMEOUT)

  it('downloads the DEMO export manifest JSON for an item without a prebuilt zip', async () => {
    await openWizard(PKG_0001.evidenceId, OPERATOR_IDS.ANDI)
    enterReason('Case file review')
    await screen.findByTestId('export-step-authorise')
    fireEvent.click(screen.getByTestId('export-authorise'))
    fireEvent.click(await screen.findByTestId('export-next'))
    const source = await screen.findByTestId(`export-source-${PKG_0001.evidenceId}`)
    await waitFor(() => expect(source).toHaveAttribute('data-verdict', 'PASS'), { timeout: 25_000 })
    fireEvent.click(screen.getByTestId('export-next'))
    fireEvent.click(await screen.findByTestId('export-submit'))
    const results = await screen.findByTestId('export-results')
    expect(results.querySelector('[data-plan]')).toHaveAttribute('data-plan', 'manifest')
    await act(async () => {
      fireEvent.click(screen.getByTestId(`export-download-${PKG_0001.evidenceId}`))
    })
    await waitFor(() => expect(stubs.createObjectURL).toHaveBeenCalledTimes(1))
    const blob = stubs.createObjectURL.mock.calls[0]?.[0 as never] as unknown as Blob
    expect(blob.type).toBe('application/json')
    const text = await blob.text()
    const json = JSON.parse(text) as { demo: boolean; authorization: { purpose: string; reference: string | null } }
    expect(json.demo).toBe(true)
    expect(json.authorization.purpose).toBe('Case file review')
    expect(json.authorization.reference).toMatch(/^AUD-\d{6}$/)
  }, UI_TIMEOUT)

  it('blocks the export of the tampered EV 0005 after its source verification fails', async () => {
    const { sim } = await openWizard(PKG_0005.evidenceId, OPERATOR_IDS.ANDI)
    enterReason('Prosecutor request')
    await screen.findByTestId('export-step-authorise')
    fireEvent.click(screen.getByTestId('export-authorise'))
    fireEvent.click(await screen.findByTestId('export-next'))
    const source = await screen.findByTestId(`export-source-${PKG_0005.evidenceId}`)
    await waitFor(() => expect(source).toHaveAttribute('data-verdict', 'FAIL'), { timeout: 25_000 })
    expect(await screen.findByTestId('export-blocked')).toHaveTextContent('Export blocked')
    expect(screen.getByTestId('export-next')).toBeDisabled()
    expect(sim.store.getState().audit.rows.some((row) => row.type === 'EVIDENCE_EXPORTED' && row.evidenceId === PKG_0005.evidenceId)).toBe(false)
  }, UI_TIMEOUT)
})
