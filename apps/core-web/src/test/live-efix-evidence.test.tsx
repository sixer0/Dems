/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// E-fix FX-W in Live mode (test/07a_e2e_web_supervisor.md §20, found on lane 3), on the contract-checked
// fake transport with the real Live start-up and router (W69's bed). Simulated mode and the component
// cases are in `features/evidence/__tests__/efix-integrity-metadata.test.tsx`.
//
// | Defect | Proven here |
// |--------|-------------|
// | E2E-W1-3: the card titled "Verdict of the Core server" opened "Not verified" although the Core's record held a PASS | "E2E-W1-3": the chip opens on the Core's PASS with time and operator and no request; a new Verify shows its verdict and the record's delta moves the line |
// | E2E-W1-4: `EV-20261006-0012` showed the manifest of the bundled package `EV-20261001-0012` as its metadata | "E2E-W1-4": the Core's record first, the notice, the package's documents labelled; the package's own record unchanged |
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EvidenceVerifyResultBody } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { formatUtcOffset } from '@dems/shared/realtime'
import type { FakeCommandOptions } from '@dems/shared/live/testing'
import { OPERATOR_IDS, OPERATORS, type EvidenceItem } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import type { LiveTestBed } from '@/runtime/testing/live-harness'
import { formatWibDateTime } from '@/features/evidence/model'
import {
  clearToasts,
  DEMO_OPERATIONS,
  demoPackage,
  EV,
  evidenceWith,
  findDetailBody,
  installJsdomStubs,
  openLiveEvidence,
  servedItem,
  type LiveEvidence,
} from '@/features/evidence/__tests__/live-evidence-bed'

vi.setConfig({ testTimeout: 40_000 })
const UI = { timeout: 15_000 }
const ANDI = OPERATORS.find((operator) => operator.id === OPERATOR_IDS.ANDI)!

let opened: LiveEvidence | undefined

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
  installJsdomStubs()
})

afterEach(async () => {
  cleanup()
  await clearToasts()
  opened?.bed.dispose()
  opened = undefined
  vi.restoreAllMocks()
})

/** The item as the Core holds it after a verification: its record and the custody entry. */
function verifiedOnCore(item: EvidenceItem, ok: boolean, at: number, actorId: string): EvidenceItem {
  return {
    ...item,
    verification: { status: ok ? 'PASS' : 'FAIL', at },
    custody: [...item.custody, { at, action: ok ? 'VERIFIED' : 'VERIFY_FAILED', actorId, detail: ok ? null : 'Mismatch: VIDEO-02' }],
  }
}

/** The Core's verdict of operation 41: every track as sealed, or VIDEO-02 with another found hash. */
function verdictBody(bed: LiveTestBed, evidenceId: string, ok: boolean): EvidenceVerifyResultBody {
  const item = servedItem(bed, evidenceId)
  return {
    evidenceId,
    ok,
    at: bed.fake.clock.now(),
    tracks: item.tracks.map((track) => ({
      trackId: track.trackId,
      expected: track.sha256,
      actual: !ok && track.trackId === 'VIDEO-02' ? 'f'.repeat(64) : track.sha256,
      ok: ok || track.trackId !== 'VIDEO-02',
    })),
    manifestOk: true,
    signatureOk: true,
  }
}

const lastLine = (status: string, at: number, actor: string) =>
  en.evidence.verify.last.full
    .replace('{{result}}', status)
    .replace('{{at}}', `${formatWibDateTime(at)} UTC${formatUtcOffset()}`)
    .replace('{{actor}}', actor)
const card = () => screen.getByTestId('evidence-verify-card')
const chip = () => within(card()).getByTestId('evidence-verdict')
const requests = (operationId: string) => opened!.bed.fake.log.requestsOf(operationId)
const demoRequests = () => opened!.bed.fake.log.requests.filter((call) => call.operationId !== null && DEMO_OPERATIONS.includes(call.operationId))

describe("E2E-W1-3: the integrity card opens on the Core's last verification", () => {
  it("the Core's record holds a PASS: the chip is PASS on open, with the time and the operator, and nothing was sent", async () => {
    let at = 0
    opened = await openLiveEvidence(`/evidence/${EV.sealed}?tab=integrity`, {
      before: (bed) => {
        at = bed.fake.clock.now() - 3 * 60_000
        bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, EV.sealed, (item) => verifiedOnCore(item, true, at, OPERATOR_IDS.ANDI)) }
      },
    })
    await findDetailBody()
    await screen.findByTestId('evidence-verify-card', {}, UI)
    expect(chip()).toHaveAttribute('data-verdict', 'PASS')
    expect(card()).toHaveAttribute('data-verdict-source', 'record')
    expect(screen.getByTestId('evidence-verify-last')).toHaveTextContent(lastLine('PASS', at, ANDI.displayName))
    expect(card()).toHaveTextContent(en.evidence.live.verify.mode)
    expect(card().textContent ?? '').not.toMatch(/simulat/i)
    expect(screen.getByTestId('evidence-verify')).toHaveTextContent(en.evidence.verify.again)
    expect(requests('verifyEvidence')).toHaveLength(0)
    expect(demoRequests()).toHaveLength(0)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it("a new Verify shows the Core's new verdict, and the record's delta moves the last line to that run", async () => {
    opened = await openLiveEvidence(`/evidence/${EV.sealed}?tab=integrity`, {
      before: (bed) => {
        bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, EV.sealed, (item) => verifiedOnCore(item, true, bed.fake.clock.now() - 60_000, OPERATOR_IDS.BUDI)) }
      },
    })
    const { bed } = opened
    await findDetailBody()
    await screen.findByTestId('evidence-verify-card', {}, UI)
    expect(chip()).toHaveAttribute('data-verdict', 'PASS')
    const runAt = bed.fake.clock.now()
    bed.fake.scriptCommand('verifyEvidence', {
      ops: [{ op: 'replace', slice: 'evidence', value: evidenceWith(bed, EV.sealed, (item) => verifiedOnCore(item, false, runAt, OPERATOR_IDS.ANDI)) }] as FakeCommandOptions['ops'],
      order: 'delta-first',
      answer: { status: 200, body: verdictBody(bed, EV.sealed, false) },
    })
    fireEvent.click(screen.getByTestId('evidence-verify'))
    await waitFor(() => expect(chip()).toHaveAttribute('data-verdict', 'FAIL'), UI)
    expect(card()).toHaveAttribute('data-verdict-source', 'run')
    await waitFor(() => expect(screen.getByTestId('evidence-verify-last')).toHaveTextContent(lastLine('FAIL', runAt, ANDI.displayName)), UI)
    expect(requests('verifyEvidence')).toHaveLength(1)
    expect(demoRequests()).toHaveLength(0)
  })
})

describe('FXR-W W92-11 (D217): the header placeholder agrees with the chip when the media lookup fails', () => {
  it('operation 40 fails: the poster placeholder says "Media reference unavailable", like the chip, never "No DEMO media"', async () => {
    opened = await openLiveEvidence(`/evidence/${EV.sealed}`, {
      before: (bed) => bed.fake.answer('getEvidence', bed.fake.example('getEvidence', 404, 'notFound')),
    })
    await findDetailBody()
    const header = screen.getByTestId('evidence-detail-header')
    await waitFor(() => expect(within(header).getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'unavailable'), UI)
    const placeholder = within(header).getByTestId('evidence-detail-still-empty')
    expect(placeholder).toHaveTextContent(en.evidence.live.mediaUnavailable)
    expect(header).not.toHaveTextContent(en.evidence.media.noMedia)
  })

  it('the Core answers NONE: the placeholder keeps its words (the chip says "Core record")', async () => {
    opened = await openLiveEvidence(`/evidence/${EV.sealed}`)
    await findDetailBody()
    const header = screen.getByTestId('evidence-detail-header')
    await waitFor(() => expect(within(header).getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'core'), UI)
    expect(within(header).getByTestId('evidence-detail-still-empty')).toHaveTextContent(en.evidence.media.noMedia)
  })
})

describe('FXR-W W92-10 (D227 O-RF-T-3): the "Last verification" line holds still while a Verify runs', () => {
  it("the Core's delta lands before the run reveals its checks: the line keeps the record of the press until the run ends, then moves to the new run", async () => {
    let earlier = 0
    opened = await openLiveEvidence(`/evidence/${EV.sealed}?tab=integrity`, {
      before: (bed) => {
        earlier = bed.fake.clock.now() - 60_000
        bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, EV.sealed, (item) => verifiedOnCore(item, true, earlier, OPERATOR_IDS.BUDI)) }
      },
    })
    const { bed, page } = opened
    await findDetailBody()
    await screen.findByTestId('evidence-verify-card', {}, UI)
    const budi = OPERATORS.find((operator) => operator.id === OPERATOR_IDS.BUDI)!
    const before = lastLine('PASS', earlier, budi.displayName)
    expect(screen.getByTestId('evidence-verify-last')).toHaveTextContent(before)
    const runAt = bed.fake.clock.now()
    bed.fake.scriptCommand('verifyEvidence', {
      ops: [{ op: 'replace', slice: 'evidence', value: evidenceWith(bed, EV.sealed, (item) => verifiedOnCore(item, false, runAt, OPERATOR_IDS.ANDI)) }] as FakeCommandOptions['ops'],
      order: 'delta-first',
      answer: { status: 200, body: verdictBody(bed, EV.sealed, false) },
    })
    const recordOnPage = () => page.runtime.sim.store.getState().evidence.find((item) => item.id === EV.sealed)?.verification?.status
    fireEvent.click(screen.getByTestId('evidence-verify'))
    // Mid-run: the replica already holds the new FAIL (the delta came first), the run is still revealing.
    await vi.waitFor(() => expect(recordOnPage()).toBe('FAIL'), { timeout: 15_000, interval: 5 })
    expect(chip()).toHaveAttribute('data-verdict', 'RUNNING')
    expect(screen.getByTestId('evidence-verify-last')).toHaveTextContent(before)
    expect(screen.getByTestId('evidence-verify-last')).toHaveAttribute('data-status', 'PASS')
    // The run ends: its own verdict, and the line follows the record (the new run).
    await waitFor(() => expect(chip()).toHaveAttribute('data-verdict', 'FAIL'), UI)
    await waitFor(() => expect(screen.getByTestId('evidence-verify-last')).toHaveTextContent(lastLine('FAIL', runAt, ANDI.displayName)), UI)
    expect(requests('verifyEvidence')).toHaveLength(1)
  })
})

describe('E2E-W1-4: the Metadata tab of an item joined to another record\'s bundled package', () => {
  /** The served dataset's item of package 0012, moved to another day: the case sequence, session suffix and subject stay. */
  const rebase = (item: EvidenceItem): EvidenceItem => ({
    ...item,
    id: item.id.replace(/^EV-\d{8}-/, 'EV-20261006-'),
    sessionId: item.sessionId.replace(/^SES-\d{8}-/, 'SES-20261006-'),
    caseNumber: item.caseNumber.replace(/\/\d{4}-(\d+)$/, '/1005-$1'),
  })

  it("the Core names package 0012 for EV-20261006-0012: the Core's record first, the notice, the package's documents labelled as that other record", async () => {
    let own: EvidenceItem | null = null
    let moved: EvidenceItem | null = null
    opened = await openLiveEvidence('/evidence/EV-20261006-0012?tab=metadata', {
      media: { 'EV-20261006-0012': demoPackage('0012') },
      before: (bed) => {
        own = bed.core.served.evidence.find((item) => item.id.endsWith('-0012')) ?? null
        if (!own) throw new Error('the served dataset holds no item 0012')
        moved = rebase(JSON.parse(JSON.stringify(own)) as EvidenceItem)
        expect(moved.id).toBe('EV-20261006-0012')
        bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, own.id, () => moved!) }
      },
    })
    await findDetailBody()
    const metadata = await screen.findByTestId('evidence-metadata', {}, UI)
    // The header still says a DEMO package plays: MS-2 is unchanged (the media belong to the demo interview).
    expect(screen.getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'demo')
    expect(metadata).toHaveAttribute('data-package', 'foreign')
    expect(metadata).toHaveAttribute('data-package-id', own!.id)
    expect(within(metadata).queryByTestId('evidence-manifest-fields')).toBeNull()
    expect(within(metadata).getByTestId('evidence-foreign-package')).toHaveTextContent(own!.id)
    const [record, documents] = within(metadata).getAllByTestId('evidence-json')
    expect(record).toHaveAccessibleName(en.evidence.live.coreRecord)
    expect(JSON.parse(record!.textContent ?? '')).toMatchObject({ record: 'CORE', evidenceId: moved!.id, sessionId: moved!.sessionId, caseNumber: moved!.caseNumber })
    expect(documents).toHaveAccessibleName(`${en.evidence.metadata.foreign.packageTitle.replace('{{id}}', own!.id)} · ${en.evidence.metadata.documents.manifest}`)
    // §3.2: the console's own words in Live mode never say "simulated" (the record's values and the bundled
    // documents are data, shown as they are).
    const words = [within(metadata).getByTestId('evidence-foreign-package'), ...metadata.querySelectorAll('h3')].map((element) => element.textContent ?? '')
    expect(words.join(' ')).not.toMatch(/simulat/i)
    expect(words.join(' ')).toContain(en.evidence.live.coreRecord)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it("the package's own record (the Core names 0012 for EV-20261001-0012) keeps the manifest fields", async () => {
    let ownId = ''
    opened = await openLiveEvidence('/evidence/EV-20261001-0012?tab=metadata', {
      media: { 'EV-20261001-0012': demoPackage('0012') },
      before: (bed) => {
        ownId = bed.core.served.evidence.find((item) => item.id.endsWith('-0012'))?.id ?? ''
      },
    })
    expect(ownId).toBe('EV-20261001-0012')
    await findDetailBody()
    const metadata = await screen.findByTestId('evidence-metadata', {}, UI)
    expect(metadata).toHaveAttribute('data-package', 'demo')
    expect(within(metadata).getByTestId('evidence-manifest-fields')).toBeInTheDocument()
    expect(within(metadata).queryByTestId('evidence-foreign-package')).toBeNull()
  })
})
