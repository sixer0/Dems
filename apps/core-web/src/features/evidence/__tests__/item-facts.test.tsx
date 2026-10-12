/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// What the web item page states of an item: its media, its integrity rows, its metadata. Fed by the
// contract's own examples of operation 40; each block below keeps the note of its own finding.
import { describe, afterEach, beforeEach, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { configure, fireEvent, screen, waitFor, cleanup, render, within } from '@testing-library/react'
import { en } from '@dems/shared/i18n'
import { EVIDENCE_ITEM_KIND_VECTORS, type EvidenceItem, SimProvider, type Sim } from '@dems/shared/sim'
import { EXPORT_KINDS_EXAMPLE } from '@dems/shared/api'
import { exportKindOffer, isCoreSealedItem, isDemoItem, mediaKindOf, mediaReasonOf, playableFilesOf, readDetailFacts, readExportKinds, readItemFacts } from '../item-facts'
import { buildEvidenceRow } from '../model'
import { createDatasetSim, stopSims, diskAssets, findPage, installBrowserStubs, mountEvidence } from './harness'
import { EV, evidenceWith, findDetailBody, type LiveEvidence, clearToasts, demoPackage, installJsdomStubs, openLiveEvidence } from './live-evidence-bed'
import { asReal, contractDetail, contractDetailNames, openItem, pictures, setupPage, teardownPage, UI, type ContractItemName, H } from './real-item-bed'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { RECORDED_VERIFY_V2 } from './fixtures/verify-v2-recorded'
import { createTestSim } from '@/components/composed/__tests__/test-utils'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { MetadataTab } from '../metadata-tab'

// Wave H C2 (web): the source of the player and of every picture is decided ONLY by the item's media
// facts (gate findings G94-02 BLOCKER, G94-14 / G81-10, G94-01 client half), and an interrupted
// recording is named on the list row and the item header (G75-03 on the evidence surfaces).
//
// | Rule | Test |
// |------|------|
// | A v1 / simulated demo item is told from an item sealed on this Core by its own members | "the reader" |
// | REAL item, `NONE` + reason: no picture, no player, the state sentence and the reason; never "No DEMO media" | "G94-02 … NONE" |
// | REAL item for which operation 40 names a bundled package: still no bundled picture or player | "G94-02 … not a demo item" |
// | REAL item, no answer of operation 40: no picture and no player | "G94-02 … no answer" |
// | A demo item with `DEMO_PACKAGE`: the bundled media WITH its demo label | "G94-02 … demo item" |
// | `LIVE_STREAM`: the sealed player, for the files `media.fileIds` names; the header says no "No DEMO media" | "G94-01 … streamable" |
// | The Live list never joins a bundled thumbnail to a REAL item by its evidence number | "G94-14 … list" |
// | Every `getEvidence` 200 example of the shared contract classifies and renders; a streamable example is awaited | "the contract's examples" |
// | `interrupted: true` is named on the row and the header; absent draws nothing | "G75-03" |
describe("the media of an item: the reader, no bundled demo media for a REAL item, the sealed player, the contract's examples (G94-01, G94-02, G75-03)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 8_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  vi.setConfig({ testTimeout: 40_000 })

  const F = en.evidence.itemFacts
  const NONE = { source: 'NONE', packageSuffix: null }
  let opened: LiveEvidence | undefined

  beforeEach(setupPage)
  afterEach(async () => {
    await teardownPage(opened)
    opened = undefined
  })

  const noDemoWords = (element: HTMLElement) => {
    expect(element.textContent ?? '').not.toMatch(/No DEMO media|No DEMO package|DEMO excerpt|DEMO package/)
  }

  describe('the reader', () => {
    it('tells a v1 / simulated demo item from an item sealed on this Core by the item\'s own members (never by manifestVersion alone)', () => {
      const sim = createDatasetSim()
      const dataset = sim.store.getState().evidence[0] as EvidenceItem
      stopSims()
      expect(isDemoItem(dataset)).toBe(true)
      expect(isDemoItem({ ...dataset, manifestVersion: 2 })).toBe(true) // D-85-1: a frozen v1 demo item may read 2
      expect(isDemoItem({ ...dataset, integritySource: 'SIMULATED' })).toBe(true)
      const real = asReal()(dataset)
      expect([isDemoItem(real), isCoreSealedItem(real)]).toEqual([false, true])
      // Reconcile pass R: ONE rule in both apps, on the Core's own member `sealedPackage` - the shared vector
      // (tested once in packages/shared) read through THIS app's reader.
      for (const vector of EVIDENCE_ITEM_KIND_VECTORS) {
        expect([vector.name, isCoreSealedItem(vector.item), isDemoItem(vector.item)]).toEqual([vector.name, vector.kind === 'SEALED_HERE', vector.kind === 'DEMO'])
        expect([vector.name, readItemFacts(vector.item).interrupted, readItemFacts(vector.item).interruptedCause]).toEqual([vector.name, vector.interrupted, vector.cause])
      }
      // A seed-sealed demonstration item as the contract states it (decision D205): a package of this Core, never a bundled one.
      const seedSealed = contractDetail('seedSealedDemo')
      expect([isDemoItem(seedSealed.evidence), isCoreSealedItem(seedSealed.evidence), mediaKindOf(readDetailFacts(seedSealed), seedSealed.evidence)]).toEqual([false, true, 'STREAM'])
      // Not reported is never a guess.
      expect([isDemoItem({}), isDemoItem(null), isDemoItem({ integritySource: 'OTHER' })]).toEqual([false, false, false])
    })

    it('reads operation 40 defensively and decides the player source by the media facts only', () => {
      const demo = { integritySource: 'DEMO_PACKAGE', signature: { simulated: true } }
      const real = { integritySource: 'REAL', sealedPackage: 'PRESENT', signature: { simulated: false }, tracks: [{ trackId: 'VIDEO-01', sha256: 'a'.repeat(64) }, { trackId: 'AUDIO-01', sha256: 'b'.repeat(64) }] }
      const facts = (media: unknown, extra: Record<string, unknown> = {}) => readDetailFacts({ media, ...extra })
      expect(mediaKindOf(facts({ source: 'LIVE_STREAM', packageSuffix: null }), real)).toBe('STREAM')
      expect(mediaKindOf(facts({ source: 'DEMO_PACKAGE', packageSuffix: '0001' }), demo)).toBe('DEMO')
      expect(mediaKindOf(facts({ source: 'DEMO_PACKAGE', packageSuffix: '0001' }), real)).toBe('NONE')
      expect(mediaKindOf(facts(NONE), demo)).toBe('NONE')
      expect([mediaKindOf(facts(undefined), demo), mediaKindOf(null, demo), mediaKindOf(facts({ source: 'OTHER' }), demo)]).toEqual(['NONE', 'NONE', 'NONE'])
      expect(mediaReasonOf(facts({ ...NONE, reason: 'NOT_SEALED' }))).toEqual({ kind: 'WORDED', reason: 'NOT_SEALED' })
      expect(mediaReasonOf(facts({ ...NONE, reason: 'FRAGMENT_TABLE_INVALID' }))).toEqual({ kind: 'CODE', reason: 'FRAGMENT_TABLE_INVALID' })
      expect(mediaReasonOf(facts(undefined))).toEqual({ kind: 'NOT_REPORTED' })
      expect(mediaReasonOf(facts(NONE))).toBeNull()
      // The files: media.fileIds, else the VIDEO entries the item names, else not reported (never a constant pair).
      expect(playableFilesOf(facts({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-02'] }), real)).toEqual(['VIDEO-02'])
      expect(playableFilesOf(facts({ source: 'LIVE_STREAM', packageSuffix: null }), real)).toEqual(['VIDEO-01'])
      expect(playableFilesOf(facts({ source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['AUDIO-01'] }), {})).toBeNull()
      // access and exports: false is kept, absent is not reported, an unreadable export is dropped.
      const stated = facts(NONE, { access: { play: false, readTranscript: true }, exports: [{ exportId: 'EXP-000036', jobId: 'EXPJ-000036', kind: 'PACKAGE', completedAt: 5 }, { exportId: 7 }] })
      expect(stated.access).toEqual({ play: false, transcript: true, export: null })
      expect(stated.exports).toEqual([{ exportId: 'EXP-000036', jobId: 'EXPJ-000036', kind: 'PACKAGE', completedAt: 5 }])
      expect(facts(NONE).exports).toBeNull()
      // The names no Core sends are NOT read (the mismatch reconcile pass R closed): `media.files`, `access.transcript`.
      expect(facts({ source: 'LIVE_STREAM', packageSuffix: null, files: ['VIDEO-02'] }).mediaFiles).toBeNull()
      expect(facts(NONE, { access: { transcript: false } }).access.transcript).toBeNull()
      expect(readItemFacts(real).sealedFiles).toEqual([{ trackId: 'VIDEO-01', sha256: 'a'.repeat(64) }])
      expect(readItemFacts({ signature: { simulated: false } }).signature?.keyClass).toBe('NOT_REPORTED')
      expect(readItemFacts({ signature: { simulated: false, developmentKey: null } }).signature?.keyClass).toBe('NOT_ESTABLISHED')
    })

    it('G94-14: the row of a REAL item gets no bundled package, thumbnail or poster in Live mode; Simulated mode keeps the guarded join', () => {
      const sim = createDatasetSim()
      const state = sim.store.getState()
      const dataset = state.evidence.find((entry) => entry.id.endsWith('-0001')) as EvidenceItem
      stopSims()
      const real = asReal()(dataset)
      expect(buildEvidenceRow(dataset, state.operators).thumbPath).not.toBeNull()
      expect(buildEvidenceRow(dataset, state.operators, { live: true }).thumbPath).not.toBeNull()
      const row = buildEvidenceRow(real, state.operators, { live: true })
      expect([row.pkg, row.thumbPath, row.posterPath]).toEqual([null, null, null])
    })
  })

  describe('G94-02: no bundled demo media for an item that is not a v1 / simulated demo item', () => {
    it('G94-02 / G81-10: a REAL item with NONE + reason shows NO picture and NO player, the state sentence and the reason; never "No DEMO media"', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, { change: asReal(), media: { ...NONE, reason: 'NOT_SEALED' } })
      const body = await findDetailBody()
      const none = await screen.findByTestId('evidence-media-none', {}, UI)
      expect(none).toHaveTextContent(F.media.none)
      expect(none).toHaveTextContent(F.media.reason.NOT_SEALED)
      expect(none).toHaveAttribute('data-reason', 'NOT_SEALED')
      expect(screen.getByTestId('evidence-media-panel')).toHaveAttribute('data-playback', 'none')
      expect(pictures(body)).toEqual([])
      expect(screen.queryByTestId('evidence-media')).toBeNull()
      expect(screen.queryByTestId('evidence-playback')).toBeNull()
      expect(screen.getByTestId('evidence-play')).toBeDisabled()
      expect(screen.getByTestId('evidence-detail-still-empty')).toHaveTextContent(F.media.noneTitle)
      noDemoWords(body)
    })

    it('G94-02: a REAL item for which operation 40 names a bundled package is still not a demo item: no bundled picture, no bundled player', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, { change: asReal(), media: { source: 'DEMO_PACKAGE', packageSuffix: '0001' } })
      const body = await findDetailBody()
      await screen.findByTestId('evidence-media-none', {}, UI)
      expect(pictures(body)).toEqual([])
      expect(screen.queryByTestId('evidence-media')).toBeNull()
      expect(screen.getByTestId('evidence-play')).toBeDisabled()
      noDemoWords(body)
    })

    it('G94-02: a REAL item without an answer of operation 40 shows NO picture and NO player', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
        change: asReal(),
        before: (bed) => bed.fake.answer('getEvidence', () => bed.fake.example('getEvidence', 404, 'notFound')),
      })
      const body = await findDetailBody()
      expect(pictures(body)).toEqual([])
      expect(screen.queryByTestId('evidence-media')).toBeNull()
      expect(screen.queryByTestId('evidence-playback')).toBeNull()
      expect(screen.getByTestId('evidence-play')).toBeDisabled()
      noDemoWords(body)
    })

    it('G94-02: a v1 demo item with DEMO_PACKAGE plays the bundled demo media WITH its demo label', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, { media: { source: 'DEMO_PACKAGE', packageSuffix: '0001' } })
      await findDetailBody()
      await screen.findByTestId('evidence-media', {}, UI)
      expect(screen.getByTestId('evidence-demo-label')).toHaveTextContent(F.media.demoLabel)
      expect(screen.getByTestId('evidence-media-panel')).toHaveAttribute('data-playback', 'bundled')
      expect(screen.getByTestId('evidence-video')).toBeInTheDocument()
      expect(screen.getByTestId('evidence-play')).toBeEnabled()
    })
  })

  describe('G94-01, client half: the sealed player is shown when the item says streamable', () => {
    it('G94-01 / G94-14: LIVE_STREAM on a REAL item opens the sealed player for the files media.fileIds names; the header says no "No DEMO media"', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
        change: asReal(),
        media: { source: 'LIVE_STREAM', packageSuffix: null, fileIds: ['VIDEO-01'] },
        before: (bed) => {
          bed.fake.answer('createEvidenceMediaSession', (call) => ({ status: 201, body: { evidenceId: call.params.id ?? '', fileId: 'VIDEO-01', url: 'http://127.0.0.1:8443/media/mts_WAVEHc2one', expiresAt: bed.fake.clock.now() + 60_000, ranges: true } }) as never)
        },
      })
      const body = await findDetailBody()
      await screen.findByTestId('evidence-playback', {}, UI)
      expect(screen.getByTestId('evidence-media-panel')).toHaveAttribute('data-playback', 'sealed')
      expect(screen.getByTestId('evidence-play')).toBeEnabled()
      expect(screen.getByTestId('evidence-detail-still-empty')).toHaveTextContent(en.evidence.itemFacts.web.noPreview)
      expect(body.querySelectorAll('img')).toHaveLength(0)
      noDemoWords(body)
      // Nothing is asked on the page view; the press asks for the ONE file the package holds.
      expect(opened.bed.fake.log.requestsOf('createEvidenceMediaSession')).toHaveLength(0)
      fireEvent.click(screen.getByTestId('evidence-playback-open'))
      await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)
      expect(opened.bed.fake.log.requestsOf('createEvidenceMediaSession')).toHaveLength(1)
      expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-files', 'VIDEO-01')
      expect(screen.getByTestId('evidence-playback-one-camera')).toHaveTextContent('This recording has one camera file')
    })
  })

  describe("the contract's examples of getEvidence (packages/shared/src/api/evidence.ts), fed UNMODIFIED", () => {
    /** What the page must draw for each example: the Core's REAL shape decides, by the contract's own member names. */
    const EXPECTED: Record<ContractItemName, { playback: 'sealed' | 'bundled' | 'none'; files?: string; reason?: string; interrupted?: string; mayPlay?: boolean; mayRead?: boolean; exports?: number; demoLabel?: boolean }> = {
      withPackage: { playback: 'bundled', demoLabel: true },
      productSealed: { playback: 'sealed', files: 'VIDEO-01,VIDEO-02', mayPlay: true, mayRead: true, exports: 1 },
      productSealedInterrupted: { playback: 'sealed', files: 'VIDEO-01,VIDEO-02', interrupted: 'CAPTURE_FAULT', mayPlay: true, mayRead: true },
      productSealedOneCamera: { playback: 'sealed', files: 'VIDEO-01', mayPlay: true, mayRead: true },
      noMedia: { playback: 'none', reason: 'PACKAGE_MISSING', mayPlay: true, mayRead: true },
      outsideCaseScope: { playback: 'sealed', files: 'VIDEO-01,VIDEO-02', mayPlay: false, mayRead: false },
      seedSealedDemo: { playback: 'sealed', files: 'VIDEO-01,VIDEO-02', mayPlay: true, mayRead: true, exports: 0 },
      // Fix wave J (contract J-S 1, J-S 2): the two new examples of the contract - a never-sealed record and a demonstration record.
      neverSealed: { playback: 'none', reason: 'NOT_SEALED' },
      simulatedSealed: { playback: 'none', reason: 'DEMONSTRATION_RECORD' },
    }

    it('every 200 example of the contract has its expectation here (a new example cannot go unread)', () => {
      expect(contractDetailNames().sort()).toEqual(Object.keys(EXPECTED).sort())
    })

    it.each(Object.keys(EXPECTED) as ContractItemName[])('the 200 example "%s" is read by the contract\'s names and renders from the Core\'s own shape', async (name) => {
      const want = EXPECTED[name]
      const value = contractDetail(name)
      const facts = readDetailFacts(value)
      // The reader, on the example as it is: nothing renamed, nothing added.
      expect(facts.mediaSource).toBe(value.media.source)
      expect(facts.mediaFiles).toEqual(value.media.fileIds ?? null)
      expect(facts.mediaReason).toBe(value.media.reason ?? null)
      expect(facts.access).toEqual({ play: value.access?.play ?? null, transcript: value.access?.readTranscript ?? null, export: value.access?.export ?? null })
      expect(facts.exports?.map((entry) => entry.jobId) ?? null).toEqual(value.exports?.map((entry) => entry.jobId) ?? null)
      expect(readItemFacts(value.evidence).sealedPackage).toBe((value.evidence as { sealedPackage?: string }).sealedPackage ?? null)
      expect(readItemFacts(value.evidence).interrupted).toBe((value.evidence as { interrupted?: boolean }).interrupted ?? null)

      const id = value.evidence.id
      const asked: string[] = []
      opened = await openItem(`/evidence/${id}?tab=media`, id, {
        before: (bed) => {
          // The item on the page is the example's own item, as the Core sends it.
          bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, id, () => JSON.parse(JSON.stringify(value.evidence)) as EvidenceItem) }
          bed.fake.answer('getEvidence', () => ({ status: 200, body: JSON.parse(JSON.stringify(value)) }) as never)
          // Operation 88 answers whichever file it is asked for: what is ASKED is the page's own decision.
          bed.fake.answer('createEvidenceMediaSession', (call) => {
            const fileId = (call.body as { fileId?: string } | undefined)?.fileId ?? 'VIDEO-01'
            asked.push(fileId)
            return { status: 201, body: { evidenceId: call.params.id ?? '', fileId, url: `http://127.0.0.1:8443/media/mts_WAVEHr${fileId.slice(-2)}`, expiresAt: bed.fake.clock.now() + 60_000, ranges: true } } as never
          })
        },
      })
      const body = await findDetailBody()
      expect(screen.getByTestId('evidence-media-panel')).toHaveAttribute('data-playback', want.playback)
      if (want.playback === 'sealed') {
        await screen.findByTestId(want.mayPlay === false ? 'evidence-playback-not-permitted' : 'evidence-playback', {}, UI)
        // No bundled picture and no demo words for a package sealed on this Core - also for the seed-sealed demonstration item (D205).
        expect(body.querySelectorAll('img')).toHaveLength(0)
        expect(screen.queryByTestId('evidence-media')).toBeNull()
        noDemoWords(body)
        // A page view asks operation 88 for nothing.
        expect(asked).toEqual([])
        if (want.mayPlay === false) {
          expect(screen.getByTestId('evidence-playback-not-permitted')).toHaveTextContent(F.media.mayNotPlay)
          expect(screen.getByTestId('evidence-play')).toBeDisabled()
        } else {
          // The press asks for exactly the files `media.fileIds` names - one session each, never a constant pair.
          fireEvent.click(screen.getByTestId('evidence-playback-open'))
          await waitFor(() => expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-phase', 'ready'), UI)
          expect(asked.sort().join(',')).toBe(want.files)
          expect(screen.getByTestId('evidence-playback')).toHaveAttribute('data-files', want.files!.split(',').join(' '))
        }
      } else if (want.playback === 'bundled') {
        await screen.findByTestId('evidence-media', {}, UI)
        expect(screen.getByTestId('evidence-demo-label')).toHaveTextContent(F.media.demoLabel)
      } else {
        const none = await screen.findByTestId('evidence-media-none', {}, UI)
        expect(none).toHaveAttribute('data-reason', want.reason!)
        expect(pictures(body)).toEqual([])
        noDemoWords(body)
      }
      if (want.interrupted !== undefined) {
        const mark = await screen.findByTestId('evidence-interrupted', {}, UI)
        expect(mark).toHaveTextContent(F.interrupted.status)
        expect(mark).toHaveAttribute('data-cause', want.interrupted)
      } else {
        expect(screen.queryByTestId('evidence-interrupted')).toBeNull()
      }
    })
  })

  describe('G75-03 on the evidence surfaces: an interrupted recording is named', () => {
    it('G75-03: the item header says "Sealed — recording was interrupted" with the cause; the list row says it too', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, { change: asReal({ interrupted: true, interruptedCause: 'CAPTURE_FAULT' }), media: NONE })
      await findDetailBody()
      const mark = await screen.findByTestId('evidence-interrupted', {}, UI)
      expect(mark).toHaveTextContent(F.interrupted.status)
      // Fix wave J (JW-13 / JW-27): the cause by its name, not the raw code; the code stays on the element for a reader of the page.
      expect(mark).toHaveTextContent('Cause: Capture fault')
      expect(mark).not.toHaveTextContent('CAPTURE_FAULT')
      expect(mark).toHaveAttribute('data-cause', 'CAPTURE_FAULT')
    })

    it('G75-03 / G94-14: the list row of an interrupted REAL item says it, and carries no bundled thumbnail although its number joins a package', async () => {
      opened = await openItem('/evidence', EV.sealed7, { change: asReal({ interrupted: true }) })
      const row = await screen.findByTestId(`evidence-row-interrupted-${EV.sealed7}`, {}, UI)
      expect(row).toHaveTextContent(F.interrupted.status)
      expect(row).toHaveTextContent(F.interrupted.causeNotReported)
      const tableRow = document.querySelector(`[data-row-id="${EV.sealed7}"]`) as HTMLElement
      expect(tableRow.querySelector('.evi-thumb')).toHaveAttribute('data-has-media', 'false')
      expect(tableRow.querySelector('img')).toBeNull()
      // A demo row keeps its bundled thumbnail; a row that states nothing says nothing extra.
      const demoRow = document.querySelector(`[data-row-id="${EV.recorded}"]`) as HTMLElement
      expect(demoRow.querySelector('.evi-thumb')).toHaveAttribute('data-has-media', 'true')
      expect(screen.queryByTestId(`evidence-row-interrupted-${EV.recorded}`)).toBeNull()
    })

    it('D207: the custody entry RECORDING_INTERRUPTED alone (the member is not stated yet) names the SAME state with the same cause', async () => {
      const interrupted = contractDetail('productSealedInterrupted').evidence
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, { change: (item) => ({ ...asReal()(item), custody: interrupted.custody }) as EvidenceItem, media: NONE })
      await findDetailBody()
      const mark = await screen.findByTestId('evidence-interrupted', {}, UI)
      expect(mark).toHaveTextContent(F.interrupted.status)
      expect(mark).toHaveAttribute('data-cause', 'CAPTURE_FAULT')
    })

    it('D207: the sealed manifest wins - `interrupted: false` of the Core draws no mark although a custody entry says interrupted', async () => {
      const interrupted = contractDetail('productSealedInterrupted').evidence
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, { change: (item) => ({ ...asReal({ interrupted: false })(item), custody: interrupted.custody }) as EvidenceItem, media: NONE })
      await findDetailBody()
      await screen.findByTestId('evidence-media-none', {}, UI)
      expect(screen.queryByTestId('evidence-interrupted')).toBeNull()
    })

    it('G75-03: an item that does not say interrupted shows the plain status chip only', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, { change: asReal(), media: NONE })
      await findDetailBody()
      await screen.findByTestId('evidence-media-none', {}, UI)
      expect(screen.queryByTestId('evidence-interrupted')).toBeNull()
    })
  })
})

// Wave H C2 (web): Hash & Integrity of an item sealed on this Core states the item's OWN members.
//
// | Rule | Test |
// |------|------|
// | G89-03 / G81-02: a REAL Ed25519 signature is never labelled simulated or demo; the only qualifier is the development-key mark of the item | "G89-03 … development key" |
// | The key class is "not reported" until the item or a verify result states it | "G89-03 … not reported" |
// | A simulated item keeps its simulated label (negative control) | "G89-03 … simulated item" |
// | G89-04: before a verify run a v2 item shows its own camera files, manifest hash and key - no AUDIO rows and none of the six v1 rows | "G89-04" |
// | G89-09: a v2 DEMO item (seed-sealed) shows no bundled v1 package values and no "Bundled demo package" panel, also after a verify | "G89-09" |
// | G89-05: a v1 result carries the sources line "Sources: not recorded (v1 package)" | "G89-05" |
describe("the integrity rows of an item: signature line, file / hash / key rows, sources line (G89-03, G89-04, G89-05, G89-09, G81-02)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 8_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  vi.setConfig({ testTimeout: 40_000 })

  const F = en.evidence.itemFacts
  const NONE = { source: 'NONE', packageSuffix: null }
  const SIMULATED_WORDS = /\(simulated\)|simulated signature|DEMO key|DEMO-KEY|proves nothing about real evidence/
  let opened: LiveEvidence | undefined

  beforeEach(setupPage)
  afterEach(async () => {
    await teardownPage(opened)
    opened = undefined
  })

  const hashes = () => screen.findByTestId('evidence-hashes', {}, UI)
  const hashRows = (card: HTMLElement) => Array.from(card.querySelectorAll('[data-hash]')).map((row) => (row as HTMLElement).dataset.hash)

  describe('G89-03 / G81-02: the signature line states what the item says', () => {
    it('G89-03: a REAL Ed25519 signature of a development key reads "Manifest signature (Ed25519, Core key …)" with the development-key mark; nothing says simulated or demo', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=integrity`, EV.sealed, { change: asReal({}, { developmentKey: true }), media: NONE })
      await findDetailBody()
      const card = await hashes()
      expect(card).toHaveAttribute('data-source', 'item')
      expect(card).toHaveTextContent('Manifest signature (Ed25519, Core key CORE-KEY-EVSIGN-01)')
      expect(screen.getByTestId('evidence-signature-key-item')).toHaveTextContent(F.signature.developmentKey)
      expect(card.textContent ?? '').not.toMatch(SIMULATED_WORDS)
      expect(card).not.toHaveTextContent('DEMO')
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('G89-03: the class of the key is "not reported" while neither the item nor a verify result states it', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=integrity`, EV.sealed, { change: asReal(), media: NONE })
      await findDetailBody()
      const card = await hashes()
      expect(screen.getByTestId('evidence-signature-key-item')).toHaveTextContent(F.signature.keyClassUnknown)
      expect(card).not.toHaveTextContent(F.signature.developmentKey)
      expect(card.textContent ?? '').not.toMatch(SIMULATED_WORDS)
    })

    it('G89-03, negative control: a simulated item keeps its simulated label and gets no Core-key line', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=integrity`, EV.sealed, { media: NONE })
      await findDetailBody()
      const card = await hashes()
      expect(card).toHaveTextContent('simulated')
      expect(card).not.toHaveTextContent('Core key')
      expect(screen.queryByTestId('evidence-signature-key-item')).toBeNull()
    })
  })

  describe('G89-04 / G89-09: the file, hash and key rows of a v2 item are the item\'s own', () => {
    it('G89-04: before a verify run a REAL item lists its camera files, its manifest hash and its signature - no AUDIO row and none of the six v1 rows', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=integrity`, EV.sealed, { change: asReal(), media: NONE })
      await findDetailBody()
      const card = await hashes()
      expect(hashRows(card)).toEqual(['VIDEO-01', 'VIDEO-02', 'manifest', 'manifestVersion', 'signature'])
      expect(card).toHaveTextContent(F.sealed.title)
      expect(card).toHaveTextContent('VIDEO-01 · sealed file')
      expect(card.textContent ?? '').not.toMatch(/AUDIO-0[12]|MIC [12]/)
      const verifyCard = screen.getByTestId('evidence-verify-card')
      expect(verifyCard.querySelectorAll('[data-check]')).toHaveLength(0)
      expect(verifyCard.textContent ?? '').not.toMatch(/AUDIO-0[12]|Pending/)
    })

    it('G89-09: a seed-sealed v2 DEMO item shows no bundled v1 package values and no "Bundled demo package" panel, before and after a verify run', async () => {
      const seedSealed = (item: EvidenceItem): EvidenceItem =>
        ({
          ...asReal()(item),
          integritySource: 'DEMO_PACKAGE',
          files: [
            { trackId: 'VIDEO-01', fileName: 'fragments/VIDEO-01.mp4', sizeBytes: 3_500, sha256: H('a'), fragmentCount: 5 },
            { trackId: 'VIDEO-02', fileName: 'fragments/VIDEO-02.mp4', sizeBytes: 3_500, sha256: H('b'), fragmentCount: 5 },
          ],
        }) as EvidenceItem
      opened = await openItem(`/evidence/${EV.sealed}?tab=integrity`, EV.sealed, {
        change: seedSealed,
        media: { source: 'DEMO_PACKAGE', packageSuffix: '0001' },
        before: (bed) => bed.fake.answer('verifyEvidence', (call) => ({ status: 200, body: { ...RECORDED_VERIFY_V2.pass.body, evidenceId: call.params.id ?? '', at: bed.fake.clock.now() } }) as never),
      })
      await findDetailBody()
      const card = await hashes()
      expect(card).toHaveAttribute('data-source', 'item')
      expect(hashRows(card)).toEqual(['VIDEO-01', 'VIDEO-02', 'manifest', 'manifestVersion', 'signature'])
      expect(card).toHaveTextContent(H('a').slice(0, 16))
      expect(card.textContent ?? '').not.toMatch(/DEMO-KEY|DEMO key|AUDIO-0[12]|certificate/i)
      fireEvent.click(screen.getByTestId('evidence-verify'))
      await waitFor(() => expect(screen.getByTestId('evidence-verdict')).toHaveAttribute('data-verdict', 'PASS'), UI)
      expect(screen.queryByTestId('evidence-bundled')).toBeNull()
      expect(screen.queryByTestId('evidence-bundled-differs')).toBeNull()
      expect(screen.getByTestId('evidence-hashes')).toHaveAttribute('data-source', 'item')
    })
  })

  describe('G89-05: the sources line of a v1 item', () => {
    it('G89-05: a v1 verify result carries "Sources: not recorded (v1 package)" where a v2 result shows its sources line', async () => {
      installBrowserStubs()
      const { sim } = mountEvidence('/evidence/EV-20260929-0001?tab=integrity', { assets: await diskAssets() })
      await findPage('page-evidence-detail')
      expect(sim.store.getState().evidence.some((entry) => entry.id === 'EV-20260929-0001')).toBe(true)
      expect(screen.queryByTestId('evidence-v1-sources')).toBeNull()
      fireEvent.click(screen.getByTestId('evidence-verify'))
      await waitFor(() => expect(screen.getByTestId('evidence-verdict')).toHaveAttribute('data-verdict', 'PASS'), { timeout: 20_000 })
      expect(screen.getByTestId('evidence-v1-sources')).toHaveTextContent(en.common.sourceClass.verify.v1)
      expect(screen.queryByTestId('evidence-v2-sources')).toBeNull()
    })
  })
})

// Closing copy round (W83 ledger #95; observation of plan row W0, decision D165): in Live mode, when
// the Core's media reference (operation 40) does not answer, whether a DEMO package belongs to the item
// is unknown. The Metadata tab then says so with the header chip's words, "Media reference
// unavailable", instead of "No DEMO package for this item", and its record claims no absence.
//
// | Case | The tab's empty-state title | The record's note |
// |------|------------------------------|-------------------|
// | Simulated (unchanged, whatever the prop) | "No DEMO package for this item" | "SIMULATED record … no DEMO package joins this item." |
// | Live, operation 40 answers NONE (unchanged) | "No DEMO package for this item" | "… no DEMO package joins it." |
// | Live, operation 40 unanswered (new) | "Media reference unavailable" (the header chip's key) | "… its media reference is unavailable, so no DEMO package is shown." |
describe("the Metadata tab: Simulated mode keeps its words, Live mode says what is known", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 1_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  vi.setConfig({ testTimeout: 40_000 })
  const UI = { timeout: 15_000 }

  const NO_PACKAGE = en.evidence.metadata.noPackage
  const UNAVAILABLE = en.evidence.live.mediaUnavailable
  const NOTE_NONE = "The Core server's record of this item; no DEMO package joins it."
  const NOTE_UNKNOWN = "The Core server's record of this item; its media reference is unavailable, so no DEMO package is shown."

  let opened: LiveEvidence | undefined
  const sims: Sim[] = []

  beforeEach(() => {
    resetMissingI18nKeys()
    resetCoreErrorPresenter()
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
    for (const sim of sims.splice(0)) sim.stop()
    vi.restoreAllMocks()
  })

  /** The tab's empty state and its record (the JSON region), as the operator reads them. */
  async function metadataTab(): Promise<{ title: string; record: Record<string, unknown> }> {
    const metadata = await screen.findByTestId('evidence-metadata', {}, UI)
    const title = metadata.querySelector('.evi-empty-title')?.textContent ?? ''
    const record = JSON.parse(within(metadata).getByRole('region').textContent ?? '') as Record<string, unknown>
    return { title, record }
  }

  describe('Simulated mode keeps its words', () => {
    it('the prop changes nothing: "No DEMO package for this item" and the SIMULATED record', async () => {
      const sim = createTestSim()
      sims.push(sim)
      const state = sim.store.getState()
      const item = state.evidence[0]
      if (!item) throw new Error('the state holds no evidence item')
      const row = { ...buildEvidenceRow(item, state.operators), pkg: null }
      render(
        <SimProvider sim={sim}>
          <MetadataTab row={row} mediaUnavailable />
        </SimProvider>,
      )
      const { title, record } = await metadataTab()
      expect(title).toBe(NO_PACKAGE)
      expect(record.simulated).toBe(true)
      expect(record.note).toBe('SIMULATED record from the in-browser simulator; no DEMO package joins this item.')
      expect(getMissingI18nKeys()).toEqual([])
    })
  })

  describe('Live mode: the Metadata tab says what is known', () => {
    it('operation 40 answers NONE: "No DEMO package for this item", as before', async () => {
      opened = await openLiveEvidence(`/evidence/${EV.sealed7}?tab=metadata`)
      await findDetailBody()
      expect(screen.getByTestId('evidence-package-chip')).toHaveAttribute('data-package', 'core')
      const { title, record } = await metadataTab()
      expect(title).toBe(NO_PACKAGE)
      expect(record.note).toBe(NOTE_NONE)
      expect(getMissingI18nKeys()).toEqual([])
    })

    it('operation 40 unanswered: "Media reference unavailable", the header chip\'s words; nothing claims there is no package', async () => {
      opened = await openLiveEvidence(`/evidence/${EV.sealed}?tab=metadata`, {
        media: { [EV.sealed]: demoPackage('0001') },
        before: (created) => created.fake.failOnce('getEvidence'),
      })
      await findDetailBody()
      const chip = screen.getByTestId('evidence-package-chip')
      await waitFor(() => expect(chip).toHaveAttribute('data-package', 'unavailable'))
      expect(chip).toHaveTextContent(UNAVAILABLE)
      const { title, record } = await metadataTab()
      expect(title).toBe(UNAVAILABLE)
      expect(record.record).toBe('CORE')
      expect(record.note).toBe(NOTE_UNKNOWN)
      const metadata = screen.getByTestId('evidence-metadata')
      expect(metadata.textContent).not.toContain(NO_PACKAGE)
      expect(metadata.textContent).not.toContain('no DEMO package joins')
      expect(getMissingI18nKeys()).toEqual([])
    })
  })
})

// Fix wave J, driver J-W - JW-03 (truth rule 3d; contract J-S 3): an export output is offered ENABLED only when the Core's
// `exportKinds` says `available: true`. The contract's exported example is fed unmodified.
describe('wave J: the export outputs the Core states (JW-03)', () => {
  it('the contract`s example: Package enabled, Composite drawn disabled with its reason code', () => {
    const kinds = readDetailFacts({ exportKinds: EXPORT_KINDS_EXAMPLE }).exportKinds
    expect(kinds).toEqual([
      { kind: 'PACKAGE', available: true, reason: null },
      { kind: 'COMPOSITE', available: false, reason: 'COMPOSITE_ENCODER_NOT_SELECTED' },
    ])
    expect(exportKindOffer(kinds, 'PACKAGE')).toBe('ENABLED')
    expect(exportKindOffer(kinds, 'COMPOSITE')).toBe('DISABLED')
  })
  it('member absent (the in-app simulator, an older Core): only Package is offered', () => {
    expect(readDetailFacts({}).exportKinds).toBeNull()
    expect(exportKindOffer(null, 'PACKAGE')).toBe('ENABLED')
    expect(exportKindOffer(null, 'COMPOSITE')).toBe('NOT_OFFERED')
  })
  it('NEGATIVE CONTROL: a Core that states Composite available gets it enabled; a member that is no list is not read', () => {
    expect(exportKindOffer(readExportKinds([{ kind: 'COMPOSITE', available: true }]), 'COMPOSITE')).toBe('ENABLED')
    expect(readExportKinds('COMPOSITE')).toBeNull()
    expect(readExportKinds([{ kind: 'OTHER', available: true }, { kind: 'COMPOSITE' }])).toBeNull()
  })
})
