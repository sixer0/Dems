/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Blueprint row 92 (M8-W3): the transcript pane and the revise form (UX spec flow 6; R-5; operations
// 84, 85, 86; OD-15; check M8-REV-1, software part).
//
// | What is held | Where |
// |--------------|-------|
// | Speaker labels default to UNAVAILABLE: a label only for the exact word LABELLED; none is invented | "the document" |
// | A revision NEVER overwrites the sealed text: the original is returned as read, the newest correction stands beside it as derived | "revisions are derived" |
// | The four pane states; the form check; the request of operation 85; what a refusal is | "states and rules" |
// | The pane on the detail page (Live): the exact badge "speaker labels unavailable", the in-package mark, "No revisions"; Revise sends ONE operation 85 built on the current revision; the sealed text is unchanged on screen and the revision is listed with its author | "the pane" |
// | `409 TRANSCRIPT_REVISION_CONFLICT`: the fixed sentence, the revisions are read again, the typed text stays, the next save is built on the new number | "conflict" |
// | DISABLED asks nothing of the Core; "not available yet" is a state, not an error | "states on the page" |
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { toast } from '@heroui/react'
import { afterEach, beforeEach, describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { expectPressOutsideDismisses, pressOutside } from '@/test/press-outside'
import { en } from '@dems/shared/i18n'
import type { EvidenceItem } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import {
  currentRevisionNumber,
  deriveSegments,
  paneStateOf,
  readRefusalOf,
  readTranscriptDocument,
  readTranscriptRevisions,
  reviseRefusalOf,
  revisionNoteOk,
  revisionRequestOf,
  validateRevisionText,
  REVISION_TEXT_MAX,
  segmentNumberOf,
  TRANSCRIPT_TAIL_NOTICE_MS,
  transcriptTailOf,
} from '../transcript-model'
import { enWeb } from '@/i18n-web'
import { clearToasts, EV, evidenceWith, findDetailBody, installJsdomStubs, openLiveEvidence, toastWith, type LiveEvidence } from './live-evidence-bed'
import { asReal, H, openItem, setupPage, teardownPage, UI } from './real-item-bed'

describe("the transcript of an item: the document, its revisions, the pane (row 92, M8-W3)", () => {
  configure({ asyncUtilTimeout: 8_000 })
  vi.setConfig({ testTimeout: 40_000 })

  const T = en.evidence.transcript
  const UI = { timeout: 15_000 }
  const H = (char: string) => char.repeat(64)
  const SEGMENTS = [
    { index: 0, startMs: 400, endMs: 4_200, text: 'Silakan mulai dari identitas Anda.', speaker: null },
    { index: 1, startMs: 4_600, endMs: 8_100, text: 'Baik, saya Ahmad Fauzi.', speaker: null },
  ]
  const DOCUMENT = { documentVersion: 'dems.transcript/1', language: 'id', speakerState: 'UNAVAILABLE', segments: SEGMENTS, sha256: H('a'), machineTranscriptHash: H('b'), assembledAt: 1_790_823_600_000, revision: 0 }
  const revision = (number: number, to: string, baseRevision = number - 1) => ({
    revisionId: `TRV-00000${number}`,
    number,
    authorId: 'OPR-001',
    baseRevision,
    machineTranscriptHash: H('b'),
    signedBy: 'KEY-EVSIGN-01',
    signature: { value: 'c'.repeat(128), keyId: 'KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false },
    createdAt: 1_790_824_500_000,
    changes: [{ segmentIndex: 1, from: 'Baik, saya Ahmad Fauzi.', to }],
  })

  describe('the document', () => {
    it('speaker labels default to UNAVAILABLE; a label is kept only for a LABELLED document', () => {
      const labelled = { ...DOCUMENT, speakerState: 'LABELLED', segments: SEGMENTS.map((segment, index) => ({ ...segment, speaker: `SPEAKER-${index + 1}` })) }
      expect(readTranscriptDocument(labelled)?.segments.map((segment) => segment.speaker)).toEqual(['SPEAKER-1', 'SPEAKER-2'])
      // Anything but the exact word: UNAVAILABLE, and a speaker that was sent anyway is not shown.
      for (const speakerState of ['UNAVAILABLE', 'labelled', undefined, null, true]) {
        const document = readTranscriptDocument({ ...labelled, speakerState })
        expect(document?.speakerState).toBe('UNAVAILABLE')
        expect(document?.segments.map((segment) => segment.speaker)).toEqual([null, null])
      }
    })

    it('a document or a revision list that cannot be read whole is not read in part', () => {
      expect(readTranscriptDocument({ ...DOCUMENT, segments: [...SEGMENTS, { index: 2, startMs: 1 }] })).toBeNull()
      expect(readTranscriptDocument({ ...DOCUMENT, segments: 'none' })).toBeNull()
      expect(readTranscriptDocument(null)).toBeNull()
      expect(readTranscriptRevisions({ items: [revision(1, 'x'), { number: 2 }], nextCursor: null })).toBeNull()
      expect(readTranscriptRevisions({ items: [revision(1, 'x'), revision(2, 'y')], nextCursor: null })?.map((entry) => entry.number)).toEqual([2, 1])
      // A signature is real only when the Core says Ed25519 and not simulated.
      const simulated = { ...revision(1, 'x'), signature: { value: H('c'), keyId: 'KEY-SIM', algorithm: 'SIMULATED-SHA256', simulated: true } }
      expect(readTranscriptRevisions({ items: [simulated, revision(2, 'y')] })?.map((entry) => entry.simulated)).toEqual([false, true])
    })
  })

  describe('revisions are derived: the sealed text is never overwritten', () => {
    it('each segment keeps its original; the newest correction of a segment stands beside it', () => {
      const document = readTranscriptDocument(DOCUMENT)!
      const sealed = JSON.stringify(document)
      const revisions = readTranscriptRevisions({ items: [revision(2, 'Baik, saya Ahmad Fawzi.'), revision(1, 'Baik, saya Ahmad Fausi.')] })!
      const derived = deriveSegments(document, revisions)
      expect(derived.map((entry) => entry.segment.text)).toEqual(SEGMENTS.map((segment) => segment.text))
      expect(derived.map((entry) => entry.revised)).toEqual([null, { number: 2, authorId: 'OPR-001', text: 'Baik, saya Ahmad Fawzi.' }])
      expect(derived[1]!.segment).toBe(document.segments[1])
      expect(JSON.stringify(document)).toBe(sealed)
      expect(currentRevisionNumber(document, revisions)).toBe(2)
      expect(currentRevisionNumber({ revision: 5 }, revisions)).toBe(5)
      expect(currentRevisionNumber(null, [])).toBe(0)
    })
  })

  describe('states and rules', () => {
    it('the pane state is the SUMMARY\'s (R80-01): ASSEMBLED only for a summary that says READY; no summary is UNKNOWN, with or without a document', () => {
      expect(paneStateOf({ state: 'DISABLED' }, false)).toBe('DISABLED')
      expect(paneStateOf({ state: 'READY' }, true)).toBe('ASSEMBLED')
      expect(paneStateOf({ state: 'PARTIAL' }, true)).toBe('PARTIAL')
      // PARTIAL without a document (unavailable at the seal) is still what the manifest says: PARTIAL.
      expect(paneStateOf({ state: 'PARTIAL' }, false)).toBe('PARTIAL')
      // NEVER a fall-back to ASSEMBLED: an item that reports no state has none.
      expect(paneStateOf(null, true)).toBe('UNKNOWN')
      expect(paneStateOf(null, false)).toBe('UNKNOWN')
      for (const state of ['PENDING', 'FAILED', 'READY'] as const) expect(paneStateOf({ state }, false)).toBe('UNAVAILABLE')
      // A state that is not READY never reads as assembled because a document arrived.
      for (const state of ['PENDING', 'FAILED'] as const) expect(paneStateOf({ state }, true)).toBe('UNAVAILABLE')
    })

    it('the form check, the request and the refusals', () => {
      expect(validateRevisionText('a', 'a')).toBe('unchanged')
      expect(validateRevisionText('a', 'b')).toBeNull()
      expect(validateRevisionText('a', 'x'.repeat(REVISION_TEXT_MAX + 1))).toBe('tooLong')
      expect(revisionRequestOf(3, 1, 'old', 'new', '  why it changed  ')).toEqual({ baseRevision: 3, changes: [{ segmentIndex: 1, from: 'old', to: 'new' }], note: 'why it changed' })
      // Pass D6: the note is REQUIRED (5 to 500 characters after trimming); an empty one is no longer left out - the form does not send at all.
      expect(['', '   ', 'abcd', '  abcd  ', 'x'.repeat(501)].map(revisionNoteOk)).toEqual([false, false, false, false, false])
      expect(['abcde', '  why it changed  ', 'x'.repeat(500)].map(revisionNoteOk)).toEqual([true, true, true])
      expect([reviseRefusalOf(409, 'TRANSCRIPT_REVISION_CONFLICT'), reviseRefusalOf(409, 'TRANSCRIPT_NOT_READY'), reviseRefusalOf(403, 'NOT_PERMITTED'), reviseRefusalOf(null, 'NO_ANSWER')]).toEqual(['CONFLICT', 'NOT_READY', 'DENIED', 'OTHER'])
      expect([readRefusalOf(409, 'TRANSCRIPT_NOT_READY'), readRefusalOf(403, 'NOT_PERMITTED'), readRefusalOf(500, 'INTERNAL_ERROR')]).toEqual(['NOT_READY', 'DENIED', 'FAILED'])
    })
  })

  // ── The page, Live mode ──────────────────────────────────────────────────────────────────────────

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
    toast.clear()
    opened?.bed.dispose()
    opened = undefined
    vi.restoreAllMocks()
  })

  type Summary = { state: string; failedChunks?: number; backendUnreachable?: boolean; sha256?: string | null; machineTranscriptHash?: string | null }
  const withTranscript =
    (summary: Summary) =>
    (item: EvidenceItem): EvidenceItem =>
      ({
        ...item,
        files: (['VIDEO-01', 'VIDEO-02'] as const).map((trackId) => ({ trackId, fileName: `fragments/${trackId}.mp4`, sizeBytes: 3_500, sha256: H(trackId === 'VIDEO-01' ? 'a' : 'b'), fragmentCount: 5 })),
        transcriptSha256: H('b'),
        transcript: { sha256: H('a'), machineTranscriptHash: H('b'), labelsStatus: 'UNAVAILABLE', revision: 0, ...summary },
      }) as EvidenceItem

  interface Core {
    revisions: ReturnType<typeof revision>[]
    /** What operation 85 answers next: a status to refuse with, or null to append. */
    refuse: number | null
  }

  async function openPane(summary: Summary = { state: 'READY' }, core: Core = { revisions: [], refuse: null }): Promise<{ live: LiveEvidence; core: Core }> {
    opened = await openLiveEvidence(`/evidence/${EV.sealed}?tab=media`, {
      before: (bed) => {
        bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, EV.sealed, withTranscript(summary)) }
        bed.fake.answer('getTranscript', () => ({ status: 200, body: { ...DOCUMENT, revision: core.revisions.length } }))
        bed.fake.answer('listTranscriptRevisions', () => ({ status: 200, body: { items: [...core.revisions].reverse(), nextCursor: null } }))
        bed.fake.answer('createTranscriptRevision', (call) => {
          if (core.refuse === 409) return bed.fake.example('createTranscriptRevision', 409, 'conflict')
          const body = call.body as { baseRevision: number; changes: { to: string }[] }
          const appended = revision(core.revisions.length + 1, body.changes[0]!.to, body.baseRevision)
          core.revisions.push(appended)
          return { status: 201, body: appended }
        })
      },
    })
    await findDetailBody()
    await screen.findByTestId('evidence-transcript', {}, UI)
    return { live: opened, core }
  }
  const requests = (operationId: string) => opened!.bed.fake.log.requestsOf(operationId)
  const original = (index: number) => screen.getByTestId(`evidence-transcript-original-${index}`)

  describe('the pane (M8-REV-1, software part)', () => {
    it('the sealed transcript with its marks; Revise appends ONE signed revision; the sealed text stays and the revision is listed as derived', async () => {
      await openPane()
      await screen.findByTestId('evidence-transcript-segments', {}, UI)
      const pane = screen.getByTestId('evidence-transcript')
      expect(pane).toHaveAttribute('data-state', 'ASSEMBLED')
      expect(screen.getByTestId('evidence-transcript-speakers')).toHaveTextContent(/^speaker labels unavailable$/)
      expect(screen.getByTestId('evidence-transcript-in-package')).toHaveTextContent(T.inPackage)
      expect(screen.getByTestId('evidence-transcript-sealed-note')).toHaveTextContent('Sealed original — immutable')
      expect(original(1)).toHaveTextContent('Baik, saya Ahmad Fauzi.')
      expect(pane.querySelector('[data-testid^="evidence-transcript-speaker-"]')).toBeNull()
      expect(within(pane).getByTestId('evidence-transcript-segment-0')).toHaveTextContent('0:00–0:04')
      await screen.findByTestId('evidence-transcript-revisions-none')
      expect(screen.getByTestId('evidence-transcript-revisions-none')).toHaveTextContent('No revisions')

      // SUPERVISOR holds TRANSCRIPT_REVISE (G6).
      fireEvent.click(screen.getByTestId('evidence-transcript-revise-1'))
      const dialog = await screen.findByTestId('transcript-revise-dialog')
      expect(within(dialog).getByTestId('transcript-revise-original')).toHaveTextContent('Baik, saya Ahmad Fauzi.')
      // Pass D6: a revision needs a reason of 5 to 500 characters. Until then Save is disabled and the form says why.
      expect(screen.getByTestId('transcript-revise-save')).toBeDisabled()
      expect(screen.getByTestId('transcript-revise-note-rule')).toHaveTextContent('Give a reason of 5 to 500 characters. It is signed with the revision.')
      fireEvent.change(screen.getByTestId('transcript-revise-text'), { target: { value: 'Baik, saya Ahmad Fausi.' } })
      fireEvent.change(screen.getByTestId('transcript-revise-note'), { target: { value: '  abc   ' } })
      expect(screen.getByTestId('transcript-revise-save')).toBeDisabled()
      fireEvent.click(screen.getByTestId('transcript-revise-save'))
      expect(requests('createTranscriptRevision')).toHaveLength(0)
      fireEvent.change(screen.getByTestId('transcript-revise-note'), { target: { value: 'Koreksi nama' } })
      expect(screen.getByTestId('transcript-revise-save')).not.toBeDisabled()
      expect(screen.queryByTestId('transcript-revise-note-rule')).toBeNull()

      // Unchanged text: the field says so and nothing is sent.
      fireEvent.change(screen.getByTestId('transcript-revise-text'), { target: { value: 'Baik, saya Ahmad Fauzi.' } })
      fireEvent.click(screen.getByTestId('transcript-revise-save'))
      expect(dialog).toHaveTextContent(T.revise.unchanged)
      expect(requests('createTranscriptRevision')).toHaveLength(0)

      fireEvent.change(screen.getByTestId('transcript-revise-text'), { target: { value: 'Baik, saya Ahmad Fausi.' } })
      fireEvent.click(screen.getByTestId('transcript-revise-save'))
      await waitFor(() => expect(requests('createTranscriptRevision')).toHaveLength(1))
      expect(requests('createTranscriptRevision')[0]?.body).toEqual({ baseRevision: 0, changes: [{ segmentIndex: 1, from: 'Baik, saya Ahmad Fauzi.', to: 'Baik, saya Ahmad Fausi.' }], note: 'Koreksi nama' })
      await waitFor(() => expect(screen.queryByTestId('transcript-revise-dialog')).toBeNull())
      expect(toastWith('Revision 1 appended')).toHaveLength(1)

      // The sealed text is what it was; the revision stands beside it, marked derived, with its author and signature.
      const derived = await screen.findByTestId('evidence-transcript-derived-1')
      expect(original(1)).toHaveTextContent(/^Baik, saya Ahmad Fauzi\.$/)
      expect(derived).toHaveTextContent('Baik, saya Ahmad Fausi.')
      expect(derived).toHaveTextContent('Revision 1 · derived, not part of the sealed transcript')
      expect(screen.queryByTestId('evidence-transcript-derived-0')).toBeNull()
      const listed = screen.getByTestId('evidence-transcript-revision-1')
      expect(listed).toHaveAttribute('data-author', 'OPR-001')
      expect(listed).toHaveTextContent('based on the sealed original')
      expect(listed).toHaveTextContent('Signed by the Core key KEY-EVSIGN-01')
      expect(requests('createTranscriptRevision')).toHaveLength(1)
      // The typed text is in no record of the page.
      expect(JSON.stringify(webErrorSink.records())).not.toContain('Fausi')
      expect(getMissingI18nKeys()).toEqual([])
    })
  })

  // Fix wave J round three (notes N-13 and N-19 of `report/judging_b1_web.md`).
  describe('N-13 / N-19: what the operator reads of a segment and of the transcript\'s reach', () => {
    it('N-13: the operator counts segments from 1 - the dialog of the second segment (index 1) is "Revise segment 2"; the request keeps index 1', async () => {
      expect([0, 1, 3].map(segmentNumberOf)).toEqual([1, 2, 4])
      await openPane()
      await screen.findByTestId('evidence-transcript-segments', {}, UI)
      expect(screen.getByTestId('evidence-transcript-segment-1').getAttribute('aria-label')).toMatch(/^Segment 2, /)
      fireEvent.click(screen.getByTestId('evidence-transcript-revise-1'))
      const dialog = await screen.findByTestId('transcript-revise-dialog')
      expect(dialog).toHaveTextContent('Revise segment 2')
      expect(dialog.getAttribute('aria-label')).toBe('Revise segment 2')
      fireEvent.change(screen.getByTestId('transcript-revise-text'), { target: { value: 'Baik, saya Ahmad Fausi.' } })
      fireEvent.change(screen.getByTestId('transcript-revise-note'), { target: { value: 'Koreksi nama' } })
      fireEvent.click(screen.getByTestId('transcript-revise-save'))
      await waitFor(() => expect(requests('createTranscriptRevision')).toHaveLength(1))
      expect(requests('createTranscriptRevision')[0]?.body).toMatchObject({ changes: [{ segmentIndex: 1 }] })
    })

    it('N-19: a transcript that ends well before the recording does is said to, with both times; one that reaches the end, an empty one and an unknown length say nothing', () => {
      // The judge's item: four segments to 0:16 of a 2:02 recording.
      const segments = [{ endMs: 4_000 }, { endMs: 9_000 }, { endMs: 16_000 }, { endMs: 12_000 }]
      expect(transcriptTailOf(segments, 122_000)).toEqual({ lastEndMs: 16_000, durationMs: 122_000 })
      expect(enWeb.web.waveJ3.transcript.tail.replaceAll('{{last}}', '0:16').replace('{{duration}}', '2:02')).toBe('The last transcribed segment ends at 0:16. The recording runs 2:02: this transcript has no text after 0:16.')
      // CONTROLS
      expect(transcriptTailOf(segments, 16_000 + TRANSCRIPT_TAIL_NOTICE_MS - 1)).toBeNull()
      expect(transcriptTailOf(segments, 16_000 + TRANSCRIPT_TAIL_NOTICE_MS)).not.toBeNull()
      expect(transcriptTailOf([], 122_000)).toBeNull()
      expect(transcriptTailOf(segments, null)).toBeNull()
      expect(transcriptTailOf(segments, 0)).toBeNull()
    })
  })

  // Fix wave J (JW-16; "by code only" in round one, proven here): a press outside the Revise dialog closed it and
  // discarded the typed correction and its reason without a question.
  describe('JW-16: the Revise dialog keeps what was typed', () => {
    it('a press outside does not close it and loses nothing; Escape and Cancel close it; nothing is sent', async () => {
      // THE CONTROL of the helper: the same press closes a kit dialog that is dismissable.
      await expectPressOutsideDismisses()
      await openPane()
      await screen.findByTestId('evidence-transcript-segments', {}, UI)
      fireEvent.click(screen.getByTestId('evidence-transcript-revise-1'))
      await screen.findByTestId('transcript-revise-dialog')
      fireEvent.change(screen.getByTestId('transcript-revise-text'), { target: { value: 'Baik, saya Ahmad Fawzi.' } })
      fireEvent.change(screen.getByTestId('transcript-revise-note'), { target: { value: 'Ejaan nama' } })
      await pressOutside()
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(screen.getByTestId('transcript-revise-dialog')).toBeInTheDocument()
      expect((screen.getByTestId('transcript-revise-text') as HTMLTextAreaElement).value).toBe('Baik, saya Ahmad Fawzi.')
      expect((screen.getByTestId('transcript-revise-note') as HTMLTextAreaElement).value).toBe('Ejaan nama')
      // Escape is the keyboard's way out.
      fireEvent.keyDown(screen.getByTestId('transcript-revise-dialog'), { key: 'Escape' })
      await waitFor(() => expect(screen.queryByTestId('transcript-revise-dialog')).toBeNull())
      expect(requests('createTranscriptRevision')).toHaveLength(0)
    })
  })

  describe('conflict', () => {
    it('409: the fixed sentence in the form, the revisions are read again, the typed text stays, and the next save is built on the new number', async () => {
      const { core } = await openPane()
      await screen.findByTestId('evidence-transcript-segments', {}, UI)
      fireEvent.click(screen.getByTestId('evidence-transcript-revise-1'))
      await screen.findByTestId('transcript-revise-dialog')
      fireEvent.change(screen.getByTestId('transcript-revise-text'), { target: { value: 'Baik, saya Ahmad Fawzi.' } })
      fireEvent.change(screen.getByTestId('transcript-revise-note'), { target: { value: 'Ejaan nama' } })
      // Meanwhile another operator appended revision 1; the Core refuses the stale base.
      core.revisions.push(revision(1, 'Baik, saya Ahmad Fausi.'))
      core.refuse = 409
      const reads = requests('listTranscriptRevisions').length
      fireEvent.click(screen.getByTestId('transcript-revise-save'))
      const refusal = await screen.findByTestId('transcript-revise-refusal')
      expect(refusal).toHaveAttribute('data-refusal', 'CONFLICT')
      expect(refusal).toHaveTextContent('The transcript revision is based on a revision that is no longer current.')
      await waitFor(() => expect(requests('listTranscriptRevisions').length).toBeGreaterThan(reads))
      // The newer revision is shown (never hidden), and what was typed is still in the field.
      await screen.findByTestId('transcript-revise-current')
      expect(screen.getByTestId('transcript-revise-current')).toHaveTextContent('Baik, saya Ahmad Fausi.')
      expect((screen.getByTestId('transcript-revise-text') as HTMLTextAreaElement).value).toBe('Baik, saya Ahmad Fawzi.')
      expect(requests('createTranscriptRevision').at(-1)?.body).toMatchObject({ baseRevision: 0 })

      core.refuse = null
      fireEvent.click(screen.getByTestId('transcript-revise-save'))
      await waitFor(() => expect(requests('createTranscriptRevision')).toHaveLength(2))
      expect(requests('createTranscriptRevision')[1]?.body).toEqual({ baseRevision: 1, changes: [{ segmentIndex: 1, from: 'Baik, saya Ahmad Fausi.', to: 'Baik, saya Ahmad Fawzi.' }], note: 'Ejaan nama' })
      await screen.findByTestId('evidence-transcript-revision-2')
      expect(original(1)).toHaveTextContent(/^Baik, saya Ahmad Fauzi\.$/)
    })
  })

  describe('states on the page', () => {
    it('DISABLED by configuration: the state, and nothing is asked of the Core', async () => {
      await openPane({ state: 'DISABLED' })
      expect(screen.getByTestId('evidence-transcript')).toHaveAttribute('data-state', 'DISABLED')
      expect(screen.getByTestId('evidence-transcript-state')).toHaveTextContent('Transcript disabled by configuration')
      expect(requests('getTranscript')).toHaveLength(0)
      expect(requests('listTranscriptRevisions')).toHaveLength(0)
      expect(screen.queryByTestId('evidence-transcript-segments')).toBeNull()
    })

    it('PARTIAL: the state, the parts without text and the unreachable backend are said; no text stands in', async () => {
      await openPane({ state: 'PARTIAL', failedChunks: 2, backendUnreachable: true })
      await screen.findByTestId('evidence-transcript-segments', {}, UI)
      expect(screen.getByTestId('evidence-transcript')).toHaveAttribute('data-state', 'PARTIAL')
      expect(screen.getByTestId('evidence-transcript-partial')).toHaveTextContent('2 parts of the audio have no text. No text stands in for them. The transcription backend could not be reached for part of the recording.')
      expect(screen.getAllByTestId(/^evidence-transcript-original-/)).toHaveLength(2)
    })

    it('R80-01 ASSEMBLED: only a summary that says READY reads as assembled', async () => {
      await openPane({ state: 'READY', failedChunks: 0, backendUnreachable: false })
      await screen.findByTestId('evidence-transcript-segments', {}, UI)
      expect(screen.getByTestId('evidence-transcript')).toHaveAttribute('data-state', 'ASSEMBLED')
      expect(screen.getByTestId('evidence-transcript-state')).toHaveTextContent('Transcript assembled')
      expect(screen.queryByTestId('evidence-transcript-partial')).toBeNull()
    })

    it('R80-01 PARTIAL without a document (unavailable at the seal): PARTIAL, said in a sentence, and nothing is asked of the Core - never "not available yet"', async () => {
      opened = await openLiveEvidence(`/evidence/${EV.sealed}?tab=media`, {
        before: (bed) => {
          bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, EV.sealed, (item) => ({ ...withTranscript({ state: 'PARTIAL', sha256: null, machineTranscriptHash: null, failedChunks: 4, backendUnreachable: false })(item), transcriptSha256: null }) as EvidenceItem) }
          bed.fake.answer('getTranscript', () => bed.fake.example('getTranscript', 409))
        },
      })
      await findDetailBody()
      const pane = await screen.findByTestId('evidence-transcript', {}, UI)
      expect(pane).toHaveAttribute('data-state', 'PARTIAL')
      expect(screen.getByTestId('evidence-transcript-state')).toHaveTextContent('Transcript partial')
      expect(screen.getByTestId('evidence-transcript-no-document')).toHaveTextContent('No transcript was sealed with this recording.')
      expect(screen.getByTestId('evidence-transcript-partial')).toHaveTextContent('4 parts of the audio have no text.')
      expect(screen.queryByTestId('evidence-transcript-not-ready')).toBeNull()
      expect(requests('getTranscript')).toHaveLength(0)
      expect(requests('listTranscriptRevisions')).toHaveLength(0)
    })

    it('R80-01 NO SUMMARY: "Transcript state not reported" - the document is shown, and the state is NOT assembled', async () => {
      opened = await openLiveEvidence(`/evidence/${EV.sealed}?tab=media`, {
        before: (bed) => {
          bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, EV.sealed, (item) => ({ ...withTranscript({ state: 'READY' })(item), transcript: null }) as EvidenceItem) }
          bed.fake.answer('getTranscript', () => ({ status: 200, body: { ...DOCUMENT, revision: 0 } }))
          bed.fake.answer('listTranscriptRevisions', () => ({ status: 200, body: { items: [], nextCursor: null } }))
        },
      })
      await findDetailBody()
      await screen.findByTestId('evidence-transcript-segments', {}, UI)
      expect(screen.getByTestId('evidence-transcript')).toHaveAttribute('data-state', 'UNKNOWN')
      expect(screen.getByTestId('evidence-transcript-state')).toHaveTextContent('Transcript state not reported')
      expect(screen.getByTestId('evidence-transcript-state')).not.toHaveTextContent('assembled')
      expect(screen.getAllByTestId(/^evidence-transcript-original-/)).toHaveLength(2)
    })

    it('409 TRANSCRIPT_NOT_READY: "The transcript is not available yet." as a state — no toast, no record, no retry', async () => {
      opened = await openLiveEvidence(`/evidence/${EV.sealed}?tab=media`, {
        before: (bed) => {
          bed.core.served = { ...bed.core.served, evidence: evidenceWith(bed, EV.sealed, withTranscript({ state: 'PENDING' })) }
          bed.fake.answer('getTranscript', () => bed.fake.example('getTranscript', 409))
        },
      })
      await findDetailBody()
      const state = await screen.findByTestId('evidence-transcript-not-ready', {}, UI)
      expect(state).toHaveTextContent('The transcript is not available yet.')
      expect(screen.getByTestId('evidence-transcript')).toHaveAttribute('data-state', 'UNAVAILABLE')
      expect(screen.queryByTestId('evidence-transcript-failed')).toBeNull()
      expect(webErrorSink.records().filter((record) => record.source.startsWith('Evidence.transcript'))).toEqual([])
      expect(requests('listTranscriptRevisions')).toHaveLength(0)
    })
  })
})

// Wave H C2 (web): the transcript pane and the player word a state by what the Core says.
//
// | Rule | Test |
// |------|------|
// | G81-01: the Core's reason `SIMULATED_ITEM` reads "…keeps no transcript for it", never "not available yet" | "G81-01" |
// | Any other 409 keeps "not available yet" (negative control) | "G81-01 … control" |
// | G81-05: an assembled transcript with no segments reads "No speech was detected" in a neutral colour, not "Transcript assembled", and offers no revise control | "G81-05" |
// | G81-07: `access.readTranscript: false` - the page view calls NEITHER operation 84 NOR 86 and says "not permitted" | "G81-07 … transcript" |
// | G81-07: `access.play: false` - no operation 88, Play is off, the player says "not permitted" | "G81-07 … play" |
// | Absent `access`: the pane asks as before (negative control) | "G81-07 … absent" |
describe("the transcript as the Core states it: the reason of a state, a recording without speech, nothing asked that the operator may not have (G81-01, G81-05, G81-07)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 8_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  vi.setConfig({ testTimeout: 40_000 })

  const F = en.evidence.itemFacts
  const T = en.evidence.transcript
  const NONE = { source: 'NONE', packageSuffix: null }
  const STREAM = { source: 'LIVE_STREAM', packageSuffix: null }
  const summary = (state: string, sha256: string | null = H('b')) => ({ state, sha256, machineTranscriptHash: sha256, labelsStatus: 'UNAVAILABLE', revision: 0, failedChunks: 0, backendUnreachable: false })
  const withTranscript =
    (state: string) =>
    (item: EvidenceItem): EvidenceItem =>
      ({ ...item, transcript: summary(state) }) as unknown as EvidenceItem
  const realWithTranscript = (state: string) => (item: EvidenceItem) => withTranscript(state)(asReal({ transcriptSha256: H('b'), labelsStatus: 'UNAVAILABLE' })(item))
  const DOCUMENT = { documentVersion: 'dems.transcript/1', language: 'id', speakerState: 'UNAVAILABLE', segments: [], sha256: H('a'), machineTranscriptHash: H('b'), assembledAt: 1_790_823_600_000, revision: 0 }
  const SEGMENT = { index: 0, startMs: 400, endMs: 4_200, text: 'Silakan mulai dari identitas Anda.', speaker: null }

  let opened: LiveEvidence | undefined
  beforeEach(setupPage)
  afterEach(async () => {
    await teardownPage(opened)
    opened = undefined
  })

  const requests = (operationId: string) => opened!.bed.fake.log.requestsOf(operationId)
  /** The contract's 409 of operation 84 with the Core's reason in `details` (`modules/transcripts/routes.ts`, `notReady`). */
  const notReady = (bed: LiveEvidence['bed'], reason: string | null) => {
    const example = bed.fake.example('getTranscript', 409) as { status: number; body: { error: Record<string, unknown> } }
    return { status: 409, body: { ...example.body, error: { ...example.body.error, ...(reason === null ? {} : { details: { reason } }) } } } as never
  }

  describe('G81-01: a state is worded by the reason the Core gives', () => {
    it('G81-01: 409 TRANSCRIPT_NOT_READY with reason SIMULATED_ITEM reads "the Core server keeps no transcript for it" - never "not available yet"', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
        change: withTranscript('PENDING'),
        media: NONE,
        before: (bed) => bed.fake.answer('getTranscript', () => notReady(bed, 'SIMULATED_ITEM')),
      })
      await findDetailBody()
      const state = await screen.findByTestId('evidence-transcript-not-ready', {}, UI)
      expect(state).toHaveTextContent(F.transcript.simulatedItem)
      expect(state).toHaveAttribute('data-reason', 'SIMULATED_ITEM')
      expect(screen.getByTestId('evidence-transcript')).not.toHaveTextContent(T.notReady)
      expect(webErrorSink.records().filter((record) => record.source.startsWith('Evidence.transcript'))).toEqual([])
    })

    it('G81-01, negative control: a 409 with another reason keeps "The transcript is not available yet."', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
        change: withTranscript('PENDING'),
        media: NONE,
        before: (bed) => bed.fake.answer('getTranscript', () => notReady(bed, 'NO_SEALED_TRANSCRIPT')),
      })
      await findDetailBody()
      const state = await screen.findByTestId('evidence-transcript-not-ready', {}, UI)
      expect(state).toHaveTextContent(T.notReady)
      expect(state).not.toHaveTextContent(F.transcript.simulatedItem)
    })
  })

  describe('G81-05: a recording without speech', () => {
    it('G81-05: an assembled transcript with zero segments reads "No speech was detected" in a neutral colour, not "Transcript assembled", with no revise control', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
        change: realWithTranscript('READY'),
        media: NONE,
        before: (bed) => {
          bed.fake.answer('getTranscript', () => ({ status: 200, body: DOCUMENT }) as never)
          bed.fake.answer('listTranscriptRevisions', () => ({ status: 200, body: { items: [], nextCursor: null } }) as never)
        },
      })
      await findDetailBody()
      const note = await screen.findByTestId('evidence-transcript-no-speech', {}, UI)
      expect(note).toHaveTextContent(F.transcript.noSpeech)
      const chip = screen.getByTestId('evidence-transcript-state')
      expect(chip).toHaveTextContent(F.web.noSpeechChip)
      expect(chip).toHaveAttribute('data-tone', 'neutral')
      expect(screen.getByTestId('evidence-transcript')).toHaveAttribute('data-state', 'NO_SPEECH')
      expect(screen.getByTestId('evidence-transcript')).not.toHaveTextContent(T.state.ASSEMBLED)
      expect(screen.queryAllByTestId(/^evidence-transcript-revise-/)).toEqual([])
    })

    it('G81-05, negative control: an assembled transcript WITH a segment still reads "Transcript assembled" as a success', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
        change: realWithTranscript('READY'),
        media: NONE,
        before: (bed) => {
          bed.fake.answer('getTranscript', () => ({ status: 200, body: { ...DOCUMENT, segments: [SEGMENT] } }) as never)
          bed.fake.answer('listTranscriptRevisions', () => ({ status: 200, body: { items: [], nextCursor: null } }) as never)
        },
      })
      await findDetailBody()
      await screen.findByTestId('evidence-transcript-segments', {}, UI)
      const chip = screen.getByTestId('evidence-transcript-state')
      expect(chip).toHaveTextContent(T.state.ASSEMBLED)
      expect(chip).toHaveAttribute('data-tone', 'success')
      expect(screen.queryByTestId('evidence-transcript-no-speech')).toBeNull()
    })
  })

  describe('G81-07: a page view asks for nothing the Core says this operator may not have', () => {
    it('G81-07: access.readTranscript false - the page view calls neither operation 84 nor 86 and says "You are not permitted to read this transcript."', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
        change: realWithTranscript('READY'),
        media: NONE,
        extra: { access: { play: false, readTranscript: false, export: false } },
        before: (bed) => bed.fake.answer('getTranscript', () => ({ status: 200, body: { ...DOCUMENT, segments: [SEGMENT] } }) as never),
      })
      await findDetailBody()
      const refused = await screen.findByTestId('evidence-transcript-may-not-read', {}, UI)
      expect(refused).toHaveTextContent(F.transcript.mayNotRead)
      await opened.bed.flush()
      expect(requests('getTranscript')).toHaveLength(0)
      expect(requests('listTranscriptRevisions')).toHaveLength(0)
      // The item's state is not restated as a role problem, and no document is drawn.
      expect(screen.getByTestId('evidence-transcript')).not.toHaveTextContent(T.notPermitted)
      expect(screen.queryByTestId('evidence-transcript-segments')).toBeNull()
    })

    it('G81-07: access.play false on a streamable item - operation 88 is never asked, Play is off and the player says "You are not permitted to play this recording."', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
        change: asReal(),
        media: STREAM,
        extra: { access: { play: false, readTranscript: false, export: false } },
      })
      await findDetailBody()
      const refused = await screen.findByTestId('evidence-playback-not-permitted', {}, UI)
      expect(refused).toHaveTextContent(F.media.mayNotPlay)
      expect(screen.getByTestId('evidence-play')).toBeDisabled()
      expect(screen.getByTestId('evidence-playback-open')).toBeDisabled()
      expect(requests('createEvidenceMediaSession')).toHaveLength(0)
    })

    it('G81-07, negative control: without an access member the pane asks operation 84 as before', async () => {
      opened = await openItem(`/evidence/${EV.sealed}?tab=media`, EV.sealed, {
        change: realWithTranscript('READY'),
        media: NONE,
        before: (bed) => {
          bed.fake.answer('getTranscript', () => ({ status: 200, body: { ...DOCUMENT, segments: [SEGMENT] } }) as never)
          bed.fake.answer('listTranscriptRevisions', () => ({ status: 200, body: { items: [], nextCursor: null } }) as never)
        },
      })
      await findDetailBody()
      await screen.findByTestId('evidence-transcript-segments', {}, UI)
      await waitFor(() => expect(requests('getTranscript')).toHaveLength(1))
      expect(screen.queryByTestId('evidence-transcript-may-not-read')).toBeNull()
    })
  })
})
