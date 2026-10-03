// Step 47 (blueprint row 47; D50, D67 (b)(c); review 40 R2/M3/M4): the Hash & Integrity tab runs the
// REAL re-verification of the step-93 package in the page (SHA-256 of every stored track, the
// manifest digest, the audit chain, Ed25519 with WebCrypto) and shows PASS for a pristine package and
// FAIL on exactly one track (AUDIO-02) for the tampered EV 0005, with package data, not the
// simulator's synthetic hashes.
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEMO_DEVICE_CERTIFICATE_PEM,
  DEMO_EVIDENCE_INDEX,
  decodeUtf8,
  getDemoEvidencePackage,
  verifyDemoPackage,
  demoVerificationTrust,
} from '@dems/shared/demo-data'
import { createEvidenceItem, FaultKind, OPERATOR_IDS } from '@dems/shared/sim'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { createFetchLoader, demoAssetUrlFor, isCertificatePath } from '../demo-assets'
import { joinDemoPackage } from '../model'
import { withSimulatedTamper } from '../sim-adapter'
import { diskAssets, diskLoader, findPage, installBrowserStubs, mountEvidence, nodeSubtle, stopSims } from './harness'

/** UI verification runs real hashing plus the M-C-21 reveal pacing (≈ 160 ms per check). */
const UI_TIMEOUT = 30_000

const PKG_0001 = getDemoEvidencePackage('0001')
const PKG_0005 = getDemoEvidencePackage('0005')
if (!PKG_0001 || !PKG_0005) throw new Error('DEMO packages 0001 and 0005 are required')

function checkRows(): HTMLElement[] {
  return Array.from(screen.getByTestId('evidence-checks').querySelectorAll<HTMLElement>('[data-check]'))
}

beforeEach(() => {
  resetMissingI18nKeys()
  installBrowserStubs()
})

afterEach(() => {
  cleanup()
  stopSims()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('integrity tab: real package verification', () => {
  it('gives PASS for a pristine package, every check recomputed, and records it in the chain of custody', async () => {
    const { sim } = mountEvidence(`/evidence/${PKG_0001.evidenceId}?tab=integrity`, { assets: await diskAssets() })
    await findPage('page-evidence-detail')
    expect(screen.getByTestId('evidence-integrity')).toHaveAttribute('data-mode', 'package')
    // Package data is shown (sealed hashes of the package). Since step 54 the simulator carries the
    // same sealed hashes (review 40 §5.c), so both agree.
    const hashes = screen.getByTestId('evidence-hashes')
    expect(hashes).toHaveAttribute('data-source', 'package')
    const simItem = sim.store.getState().evidence.find((item) => item.id === PKG_0001.evidenceId)
    expect(simItem?.tracks[0]?.sha256).toBe(PKG_0001.tracks[0]?.sealedSha256)
    expect(simItem?.integritySource).toBe('DEMO_PACKAGE')
    expect(within(hashes).getByText(PKG_0001.tracks[0]?.sealedSha256.slice(0, 16) ?? '', { exact: false })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(screen.getByTestId('evidence-verdict')).toHaveAttribute('data-verdict', 'PASS'), { timeout: 20_000 })
    const rows = checkRows()
    expect(rows.map((row) => row.dataset.check)).toEqual([
      'track:VIDEO-01',
      'track:VIDEO-02',
      'track:AUDIO-01',
      'track:AUDIO-02',
      'manifest',
      'signature',
      'certificate',
      'auditChain',
    ])
    expect(rows.every((row) => row.dataset.phase === 'pass')).toBe(true)
    // Node's WebCrypto verifies Ed25519, so nothing falls back to the precomputed result.
    expect(rows.every((row) => row.dataset.source === 'computed')).toBe(true)
    expect(screen.getByTestId('evidence-verify-label')).toHaveTextContent('DEMO - recomputed')

    const state = sim.store.getState()
    const item = state.evidence.find((entry) => entry.id === PKG_0001.evidenceId)
    expect(item?.verification.status).toBe('PASS')
    expect(item?.custody.at(-1)?.action).toBe('VERIFIED')
    expect(state.audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_VERIFIED', evidenceId: PKG_0001.evidenceId })
    expect(getMissingI18nKeys()).toEqual([])
  }, UI_TIMEOUT)

  it('gives FAIL on exactly one track (AUDIO-02) for the tampered EV 0005, and the audit trail agrees', async () => {
    const { sim } = mountEvidence(`/evidence/${PKG_0005.evidenceId}?tab=integrity`, { assets: await diskAssets() })
    await findPage('page-evidence-detail')
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(screen.getByTestId('evidence-verdict')).toHaveAttribute('data-verdict', 'FAIL'), { timeout: 20_000 })

    const failed = checkRows().filter((row) => row.dataset.phase === 'fail')
    expect(failed.map((row) => row.dataset.check)).toEqual(['track:AUDIO-02'])
    expect(checkRows().filter((row) => row.dataset.phase === 'pass')).toHaveLength(7)
    // The FAIL row shows the sealed hash next to the found one.
    expect(within(failed[0] as HTMLElement).getByText('Sealed')).toBeInTheDocument()

    // The simulator's record matches the package verdict (EV 0005 is tampered on AUDIO-02 at load since step 54).
    const state = sim.store.getState()
    const item = state.evidence.find((entry) => entry.id === PKG_0005.evidenceId)
    expect(item?.tampered).toBe(true)
    expect(item?.tamperedTrackId).toBe('AUDIO-02')
    expect(item?.verification.status).toBe('FAIL')
    expect(state.audit.rows.at(-1)).toMatchObject({ type: 'EVIDENCE_VERIFY_FAILED', evidenceId: PKG_0005.evidenceId })
    expect(state.audit.rows.some((row) => row.type === 'EVIDENCE_VERIFIED' && row.evidenceId === PKG_0005.evidenceId)).toBe(false)
  }, UI_TIMEOUT)

  it('a Demo Control Panel tamper on a pristine package fails on exactly that track', async () => {
    const { sim } = mountEvidence(`/evidence/${PKG_0001.evidenceId}?tab=integrity`, { assets: await diskAssets() })
    await findPage('page-evidence-detail')
    act(() => sim.actions.inject(FaultKind.TAMPER, { evidenceId: PKG_0001.evidenceId, trackId: 'VIDEO-02' }))
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(screen.getByTestId('evidence-verdict')).toHaveAttribute('data-verdict', 'FAIL'), { timeout: 20_000 })
    expect(checkRows().filter((row) => row.dataset.phase === 'fail').map((row) => row.dataset.check)).toEqual(['track:VIDEO-02'])
  }, UI_TIMEOUT)

  it('falls back to the labelled precomputed result where WebCrypto cannot check Ed25519', async () => {
    const report = await verifyDemoPackage(PKG_0005, diskLoader, { trust: demoVerificationTrust(), subtle: null })
    expect(report.result).toBe('FAIL')
    expect(report.failed).toEqual(['track:AUDIO-02'])
    expect(report.label).toBe('DEMO - recomputed (some checks precomputed)')
    expect(report.checks.filter((check) => check.source === 'precomputed').map((check) => check.id)).toEqual(['signature', 'certificate'])
  })

  it('the in-memory tamper alters exactly one stored file of the package', async () => {
    const load = withSimulatedTamper(diskLoader, PKG_0001, 'AUDIO-01')
    const report = await verifyDemoPackage(PKG_0001, load, { trust: demoVerificationTrust(), subtle: await nodeSubtle() })
    expect(report.failed).toEqual(['track:AUDIO-01'])
    // The tampered package already carries its altered copy: no second alteration.
    expect(withSimulatedTamper(diskLoader, PKG_0005, 'AUDIO-02')).toBe(diskLoader)
  })
})

describe('package join guard (review 40 M4)', () => {
  it('accepts a package only when case number, subject and session suffix match', () => {
    const pkg = getDemoEvidencePackage('0014')
    if (!pkg) throw new Error('recording-scenario package missing')
    expect(joinDemoPackage({ id: pkg.evidenceId, caseNumber: pkg.caseNumber, subjectName: pkg.subjectName, sessionId: pkg.sessionId })).toBe(pkg)
    // A presenter-created session that seals as EV 0014 with another case or subject gets none.
    expect(joinDemoPackage({ id: pkg.evidenceId, caseNumber: 'LP/2026/1001-0008', subjectName: pkg.subjectName, sessionId: pkg.sessionId })).toBeNull()
    expect(joinDemoPackage({ id: pkg.evidenceId, caseNumber: pkg.caseNumber, subjectName: 'Someone Else', sessionId: pkg.sessionId })).toBeNull()
    expect(joinDemoPackage({ id: pkg.evidenceId, caseNumber: pkg.caseNumber, subjectName: pkg.subjectName, sessionId: 'SES-20261001-0031' })).toBeNull()
  })

  it('shows simulator data, labelled SIMULATED, and verifies through the simulator when no package joins', async () => {
    const { sim, router } = mountEvidence('/evidence', { assets: await diskAssets(), operatorId: OPERATOR_IDS.BUDI })
    await findPage('page-evidence')
    const source = sim.store.getState().evidence.find((item) => item.id.endsWith('-0002'))
    if (!source) throw new Error('EV 0002 missing')
    // A live item on a suffix with a package but another subject: the M4 guard rejects the package.
    const liveId = source.id.replace(/-0002$/, '-0014')
    const live = createEvidenceItem({ ...source, evidenceId: liveId, sessionId: 'SES-20261001-0024', subjectName: 'Presenter Subject' })
    act(() => {
      sim.store.setState((state) => ({ evidence: [...state.evidence, live] }))
    })
    await act(async () => {
      await router.navigate({ to: '/evidence/$evidenceId', params: { evidenceId: liveId }, search: { tab: 'integrity' } })
    })
    await findPage('page-evidence-detail')
    expect(screen.getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'simulated')
    expect(screen.getByTestId('evidence-integrity')).toHaveAttribute('data-mode', 'simulated')
    expect(screen.getByTestId('evidence-hashes')).toHaveAttribute('data-source', 'simulated')

    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(screen.getByTestId('evidence-verdict')).toHaveAttribute('data-verdict', 'PASS'), { timeout: 20_000 })
    expect(checkRows().every((row) => row.dataset.source === 'simulated')).toBe(true)

    fireEvent.click(screen.getByTestId('evidence-tab-media'))
    expect(await screen.findByTestId('evidence-media-empty')).toBeInTheDocument()
    expect(getMissingI18nKeys()).toEqual([])
  }, UI_TIMEOUT)
})

describe('DEMO asset loading', () => {
  it('serves the certificate from the demo-data module, byte-identical to every package file (DR-47-3)', async () => {
    expect(isCertificatePath(PKG_0001.files.certificate.path)).toBe(true)
    const file = decodeUtf8(await diskLoader(PKG_0001.files.certificate.path))
    expect(file).toBe(DEMO_DEVICE_CERTIFICATE_PEM)
    const fromLoader = await createFetchLoader(async () => {
      throw new Error('must not fetch the certificate')
    })(PKG_0005.files.certificate.path)
    expect(decodeUtf8(fromLoader)).toBe(DEMO_DEVICE_CERTIFICATE_PEM)
  })

  it('resolves every package path the verification and the player need (one glob, review 40 R2)', () => {
    for (const pkg of DEMO_EVIDENCE_INDEX.packages) {
      for (const track of pkg.tracks) expect(demoAssetUrlFor(track.stored.path), track.stored.path).not.toBeNull()
      for (const key of ['manifest', 'metadata', 'signature', 'auditExtract', 'container'] as const) {
        expect(demoAssetUrlFor(pkg.files[key].path), pkg.files[key].path).not.toBeNull()
      }
      if (pkg.export) {
        expect(demoAssetUrlFor(pkg.export.zip.path)).not.toBeNull()
        expect(demoAssetUrlFor(pkg.export.manifest.path)).not.toBeNull()
      }
    }
    // EV 0005's AUDIO-02 resolves to the package's altered copy, not the pristine media folder.
    expect(PKG_0005.tracks[3]?.stored.path).toMatch(/^demo-evidence\/SESSION-.*\/media\/AUDIO-02\.m4a$/)
  })
})
