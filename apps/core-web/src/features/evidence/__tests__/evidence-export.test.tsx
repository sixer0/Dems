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
import {
  buildDemoExportManifest,
  consoleWritesExportFile,
  ExportFileNotForItemError,
  EXPORT_MANIFEST_NOTICE_OWN_CAPTURE_PACKAGE,
  EXPORT_MANIFEST_NOTICE_OWN_CAPTURE_RECORD,
  exportDownloadPlan,
  manifestSummaryDownload,
  prepareZipDownload,
} from '../export-download'
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

  // Fix wave J, pass J5 (truth rule 3f; note 174 decision 2): the export file the CONSOLE writes said `demo: true`, "the
  // DEMS demo console" and "SIMULATED data" also on a Core in its own capture, and nothing but the wizard's drawing kept it
  // from being written for a recording of that Core.
  describe('pass J5: what the console-written export file is on a Core', () => {
    const datasetRow = (suffix: '0001') => {
      const state = createDatasetSim(OPERATOR_IDS.ANDI).store.getState()
      const item = state.evidence.find((entry) => entry.id === getDemoEvidencePackage(suffix)!.evidenceId)
      if (!item) throw new Error(`EV ${suffix} missing`)
      return { state, row: buildEvidenceRow(item, state.operators) }
    }
    const inputOf = (row: ReturnType<typeof datasetRow>['row'], state: ReturnType<typeof datasetRow>['state']) => ({
      row,
      exportId: 'EXP-000032',
      exportedAt: state.clock.now,
      operator: { id: 'OPR-002', displayName: 'AKP Andi Pratama', role: 'SUPERVISOR' } as const,
      destination: 'Case file transfer',
      reason: 'Prosecutor request',
      authorizationRef: 'AUD-000999',
      device: state.device,
      verification: { report: null, simulated: null },
    })
    const parse = (text: string) => JSON.parse(text) as Record<string, unknown>

    it('CONTROL - the demonstration keeps its flag and its wording, word for word (with a package and without one)', () => {
      const { row, state } = datasetRow('0001')
      const packaged = parse(buildDemoExportManifest(inputOf(row, state)))
      expect(packaged.demo).toBe(true)
      expect(packaged.notice).toBe('DEMO export manifest built in the browser by the DEMS demo console from the sealed DEMO package. Not evidence.')
      // A Core in SIMULATED capture (Live mode, not its own capture) writes the same file as the in-browser simulator.
      expect(buildDemoExportManifest({ ...inputOf(row, state), live: true, ownCapture: false })).toBe(buildDemoExportManifest(inputOf(row, state)))
      const bare = parse(buildDemoExportManifest(inputOf({ ...row, pkg: null }, state)))
      expect(bare.demo).toBe(true)
      expect(bare.notice).toBe('DEMO export manifest built in the browser from SIMULATED data (no DEMO package for this item). Not evidence.')
      expect(bare.sessionManifest).toEqual({ file: null, sha256: row.item.manifestHash, simulated: true })
      expect(bare.signature).toMatchObject({ simulated: true })
      expect((bare.payload as { tracks: Record<string, unknown>[] }).tracks.every((track) => track.simulated === true)).toBe(true)
      expect('demonstrationItem' in packaged || 'demonstrationItem' in bare).toBe(false)
    })

    it('a Core in its own capture: no `demo` and no `simulated` member; the notice says what the file is; nothing else of it changes', () => {
      const { row, state } = datasetRow('0001')
      const demo = parse(buildDemoExportManifest(inputOf(row, state)))
      const own = parse(buildDemoExportManifest({ ...inputOf(row, state), live: true, ownCapture: true }))
      expect('demo' in own).toBe(false)
      expect(own.demonstrationItem).toBe(true)
      expect(own.notice).toBe(EXPORT_MANIFEST_NOTICE_OWN_CAPTURE_PACKAGE)
      const { demo: _flag, notice: _demoNotice, ...demoRest } = demo
      const { demonstrationItem: _item, notice: _ownNotice, ...ownRest } = own
      expect(ownRest).toEqual(demoRest)

      const bareText = buildDemoExportManifest({ ...inputOf({ ...row, pkg: null }, state), live: true, ownCapture: true })
      const bare = parse(bareText)
      expect('demo' in bare).toBe(false)
      expect(bare.notice).toBe(EXPORT_MANIFEST_NOTICE_OWN_CAPTURE_RECORD)
      expect(bareText).not.toMatch(/"simulated"/)
      expect(bare.sessionManifest).toEqual({ file: null, sha256: row.item.manifestHash, source: 'core-record' })
      for (const notice of [EXPORT_MANIFEST_NOTICE_OWN_CAPTURE_PACKAGE, EXPORT_MANIFEST_NOTICE_OWN_CAPTURE_RECORD]) {
        expect(notice).not.toMatch(/^DEMO|demo console|simulat|synthetic/i)
        expect(notice).toMatch(/demonstration item this DEMS Core server holds/)
        expect(notice).toMatch(/not evidence/)
      }
    })

    it('the console writes no export file for an item whose export is the archive of the Core - the rule, and the builder refuses', () => {
      const { row, state } = datasetRow('0001')
      const item = (change: Record<string, unknown>) => ({ ...row, item: { ...row.item, ...change } as typeof row.item })
      const real = item({ integritySource: 'REAL', sealedPackage: 'PRESENT' })
      const realRecord = item({ integritySource: 'REAL' })
      const seedSealed = item({ integritySource: 'DEMO_PACKAGE', sealedPackage: 'PRESENT' })
      const withFiles = item({ files: [{ trackId: 'VIDEO-01' }] })
      const notStated = item({ integritySource: undefined })
      // CONTROL: the v1 demonstration item, and anything in Simulated mode.
      expect(consoleWritesExportFile(row, true)).toBe(true)
      expect(consoleWritesExportFile(item({ integritySource: 'SIMULATED' }), true)).toBe(true)
      for (const refused of [real, realRecord, seedSealed, withFiles, notStated]) {
        expect(consoleWritesExportFile(refused, true)).toBe(false)
        expect(consoleWritesExportFile(refused, false)).toBe(true)
        for (const ownCapture of [true, false]) {
          expect(() => buildDemoExportManifest({ ...inputOf(refused, state), live: true, ownCapture })).toThrow(ExportFileNotForItemError)
        }
      }
    })

    it('the manifest summary of an item without a package: `simulated` on the demonstration (unchanged), the Core\'s record on a Core in its own capture', () => {
      const { row } = datasetRow('0001')
      const values = { evidenceId: row.id, manifestHash: row.item.manifestHash, tracks: row.item.tracks, signature: row.item.signature }
      const demo = manifestSummaryDownload(row, false)
      expect(demo.fileName).toBe(`${row.id}-manifest.simulated.json`)
      expect(demo.text).toBe(`${JSON.stringify({ simulated: true, ...values }, null, 2)}\n`)
      const own = manifestSummaryDownload(row, true)
      expect(own.fileName).toBe(`${row.id}-manifest.core-record.json`)
      const file = parse(own.text)
      expect(file).toMatchObject({ record: 'CORE', demonstrationItem: true, ...JSON.parse(JSON.stringify(values)) })
      expect(Object.keys(file)).not.toContain('simulated')
      expect(Object.keys(file)).not.toContain('demo')
      expect(String(file.note)).not.toMatch(/simulat|synthetic|\bDEMO\b/)
    })
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

  // Fix wave J (JW-14 (c)): this case REPLACES "denies an investigator ... and records EXPORT_DENIED". Export was enabled
  // for a role that may not export and refused two steps later; ONE rule now - the control is disabled WITH its visible
  // reason naming the role, the wizard does not open, and no attempt is made (so no EXPORT_DENIED row is written).
  it('an investigator: Export is disabled with the visible reason naming the Supervisor role; no wizard, no attempt', async () => {
    const { sim } = mountEvidence(`/evidence/${PKG_0001.evidenceId}`, { operatorId: OPERATOR_IDS.BUDI, assets: await diskAssets() })
    await findPage('page-evidence-detail')
    const rowsBefore = sim.store.getState().audit.rows.length
    const button = screen.getByTestId('evidence-export')
    expect(button).toBeDisabled()
    const reason = within(screen.getByTestId('evidence-role-reasons')).getByTestId('role-reason')
    expect(reason).toHaveTextContent('Requires the Supervisor role')
    expect(button).toHaveAttribute('aria-describedby', reason.id)
    fireEvent.click(button)
    expect(screen.queryByTestId('export-wizard')).not.toBeInTheDocument()
    expect(sim.store.getState().audit.rows).toHaveLength(rowsBefore)
    expect(getMissingI18nKeys()).toEqual([])
  }, UI_TIMEOUT)

  it('NEGATIVE CONTROL: a supervisor has Export enabled and no reason line', async () => {
    mountEvidence(`/evidence/${PKG_0001.evidenceId}`, { operatorId: OPERATOR_IDS.ANDI, assets: await diskAssets() })
    await findPage('page-evidence-detail')
    expect(screen.getByTestId('evidence-export')).not.toBeDisabled()
    expect(screen.queryByTestId('evidence-role-reasons')).toBeNull()
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
