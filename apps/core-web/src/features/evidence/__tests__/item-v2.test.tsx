// Blueprint row 92 (M8-W3): the schema-v2 members of an evidence item, read defensively, and the
// rule of the item badge "Development source" (R-11; UX §8f.2; decisions D83, D91).
//
// | What is held | Where |
// |--------------|-------|
// | A v1 item reads as "nothing stated"; a v2 item gives its files (both hashes), intervals, transcript summary | "the reader" |
// | `developmentSources`: only `true` / `false` as sent; everything else is null = not recorded | "developmentSources" |
// | The badge: only for `true`, only on Live data; `false` / `null` / absent draw nothing | "the item badge" |
// | A member that cannot be read is dropped, never guessed (a list with a hole is no list) | "malformed members" |
import { describe, expect, it, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { EvidenceItemSchema, CORE_API_EXAMPLES, EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE, TRANSCRIPT_REVISION_REASON_EXAMPLE, VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE } from '@dems/shared/api'
import { cameraFileOf, itemDevelopmentBadge, readItemV2, readTranscriptModel } from '../item-v2'
import { createDatasetSim, evidenceIdOf, stopSims } from './harness'
import { cleanup, render, screen, configure } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { en } from '@dems/shared/i18n'
import { createI18n } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { readTranscriptRevision, readTranscriptRevisions, revisionReasons } from '../transcript-model'
import { RevisionList, TranscriptModelFacts } from '../transcript-pane'
import { readVerifyV2, v2FilePartOutcome, type V2Check, type V2Row } from '../verify-v2'
import { ResultRow } from '../verify-v2-report'
import { PairAudio } from '../pair-audio'
import * as sharedRules from '@dems/shared/evidence-rules'

const H = (char: string) => char.repeat(64)
const V2_MEMBERS = {
  files: [
    { trackId: 'VIDEO-01', fileName: 'fragments/VIDEO-01.mp4', sizeBytes: 4_000, sha256: H('a'), sha256Plain: H('b'), fragmentCount: 5, fragmentChainHead: H('c') },
    { trackId: 'VIDEO-02', fileName: 'fragments/VIDEO-02.mp4', sizeBytes: 4_100, sha256: H('d'), fragmentCount: 5 },
  ],
  transcriptSha256: H('e'),
  manifestVersion: 2,
  labelsStatus: 'UNAVAILABLE',
  developmentSources: true,
  audioSourceIntervals: [
    { seq: 1, inputId: 'MIC-01', role: 'PRIMARY', fromMs: 0, toMs: 30_000, reason: 'START' },
    { seq: 2, inputId: 'MIC-02', role: 'STANDBY', fromMs: 30_000, toMs: null, reason: 'MANUAL' },
  ],
  transcript: { state: 'PARTIAL', sha256: H('e'), machineTranscriptHash: H('e'), labelsStatus: 'UNAVAILABLE', revision: 2, failedChunks: 3, backendUnreachable: true },
}

function datasetItem(): Record<string, unknown> {
  const sim = createDatasetSim()
  const id = evidenceIdOf(sim, '0001')
  const item = JSON.parse(JSON.stringify(sim.store.getState().evidence.find((entry) => entry.id === id))) as Record<string, unknown>
  stopSims()
  return item
}

describe('the reader', () => {
  it('a v1 item: not v2, no file, no interval, no transcript, sources NOT RECORDED', () => {
    const v1 = readItemV2(datasetItem())
    expect(v1).toMatchObject({ isV2: false, files: [], audioIntervals: [], transcript: null, developmentSources: null, manifestVersion: null })
  })

  it('a v2 item as the contract carries it: files with both hashes, intervals, the transcript summary', () => {
    const item = { ...datasetItem(), ...V2_MEMBERS }
    // The members used here are the contract's: the item parses with the registry schema.
    expect(EvidenceItemSchema.safeParse(item).success).toBe(true)
    const v2 = readItemV2(item)
    expect(v2.isV2).toBe(true)
    expect(cameraFileOf(v2, 'VIDEO-01')).toEqual({ trackId: 'VIDEO-01', fileName: 'fragments/VIDEO-01.mp4', sizeBytes: 4_000, sha256: H('a'), sha256Plain: H('b'), fragmentCount: 5, fragmentChainHead: H('c') })
    expect(cameraFileOf(v2, 'VIDEO-02')).toMatchObject({ sha256: H('d'), sha256Plain: null, fragmentChainHead: null })
    expect(v2.audioIntervals).toEqual([
      { seq: 1, inputId: 'MIC-01', fromMs: 0, toMs: 30_000, reason: 'START' },
      { seq: 2, inputId: 'MIC-02', fromMs: 30_000, toMs: null, reason: 'MANUAL' },
    ])
    expect(v2.transcript).toEqual({ state: 'PARTIAL', sha256: H('e'), machineTranscriptHash: H('e'), labelsStatus: 'UNAVAILABLE', revision: 2, failedChunks: 3, backendUnreachable: true })
    expect([v2.transcriptSha256, v2.labelsStatus, v2.manifestVersion, v2.developmentSources]).toEqual([H('e'), 'UNAVAILABLE', 2, true])
    expect(v2.signature).toMatchObject({ simulated: true })
  })

  it('never throws on anything', () => {
    for (const value of [null, undefined, 'EV-1', 7, [], { files: 'none', audioSourceIntervals: {}, transcript: [], signature: 1 }]) {
      expect(readItemV2(value)).toMatchObject({ isV2: false, files: [], audioIntervals: [], transcript: null, developmentSources: null })
    }
  })
})

describe('malformed members', () => {
  it('a file without a readable hash is dropped; a hash is never invented', () => {
    const v2 = readItemV2({ files: [{ trackId: 'VIDEO-01', sha256: 'abc' }, V2_MEMBERS.files[1], null] })
    expect(v2.files.map((file) => file.trackId)).toEqual(['VIDEO-02'])
  })

  it('one unreadable interval empties the list: a band with a hole would name the wrong microphone', () => {
    const good = V2_MEMBERS.audioSourceIntervals
    for (const bad of [{ seq: 3, inputId: 'CAM-01', fromMs: 0, toMs: 5 }, { seq: 3, inputId: 'MIC-01', fromMs: 9, toMs: 5 }, { seq: 3, inputId: 'MIC-01', fromMs: -1, toMs: 5 }, { inputId: 'MIC-01', fromMs: 0, toMs: 5 }, 'MIC-01', { seq: 3, inputId: 'MIC-01', fromMs: 0, toMs: 'end' }]) {
      expect(readItemV2({ audioSourceIntervals: [...good, bad] }).audioIntervals).toEqual([])
    }
    // CONTROL: the good ones alone are read, and an input beyond the pair (MIC-03) is an input.
    expect(readItemV2({ audioSourceIntervals: [...good, { seq: 3, inputId: 'MIC-03', fromMs: 40_000, toMs: 50_000, reason: 'MANUAL' }] }).audioIntervals).toHaveLength(3)
  })

  it('a transcript summary with an unknown state is not a summary', () => {
    expect(readItemV2({ transcript: { ...V2_MEMBERS.transcript, state: 'FINE' } }).transcript).toBeNull()
  })
})

describe('developmentSources (R-11): null is never production', () => {
  it('only the booleans are read; every other value is null', () => {
    expect(readItemV2({ developmentSources: true }).developmentSources).toBe(true)
    expect(readItemV2({ developmentSources: false }).developmentSources).toBe(false)
    for (const value of [null, undefined, 'true', 'false', 1, 0, 'PRODUCTION', {}]) expect(readItemV2({ developmentSources: value }).developmentSources).toBeNull()
    expect(readItemV2({}).developmentSources).toBeNull()
  })
})

describe('the item badge', () => {
  it('is drawn only for `true`, and only on Live data', () => {
    expect(itemDevelopmentBadge({ developmentSources: true }, true)).toBe(true)
    // Simulated client mode: no badge (D83, D91) — the mode banner says what the data is.
    expect(itemDevelopmentBadge({ developmentSources: true }, false)).toBe(false)
    for (const live of [true, false]) {
      expect(itemDevelopmentBadge({ developmentSources: false }, live)).toBe(false)
      expect(itemDevelopmentBadge({ developmentSources: null }, live)).toBe(false)
    }
  })
})

// Fix wave K, driver W: the evidence item of the web console (re-gates 81 and 89).
//
// | Finding | Rule | Member read BY NAME | Test |
// |---------|------|---------------------|------|
// | G81b-06 | The model that made the sealed transcript is shown on the item: name, the version the installation declared, quantisation, file hash; a server backend: the name and the Core's own sentence (D160) | `evidence.transcriptModel` (`EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE`, `EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE`; `contract_wave_k.md` S2 section 1) | "G81b-06" |
// | G81b-09 | The stated reason of a revision is shown in the revision list | the revision's `reason` of operations 85 / 86 (`TRANSCRIPT_REVISION_REASON_EXAMPLE`, the registry examples; `contract_wave_k.md` KR section 2) first; `details.reason` of the Core's `TRANSCRIPT_REVISED` row only for an entry without the member | "G81b-09" |
// | G89b-06 | The decrypted-bytes part of a file whose plaintext check did not run reads "Not run", never "FAIL" | `files[].plainChecked` of operation 41 (`VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE`; `contract_wave_k.md` KR section 1), else check `V-05` of the same result (S1 section 7) | "G89b-06" |
describe("members of the item a later contract added: the transcript model, the reason of a revision, a file part whose check did not run (G81b-06, G81b-09, G89b-06)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 1_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  const i18n = createI18n()
  const M = enWeb.web.transcript
  const show = (node: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{node}</I18nextProvider>)

  afterEach(cleanup)

  describe('G81b-06: the transcript model on the evidence item', () => {
    it('the item reader reads the member by its contract name; an item without it states none', () => {
      const item = readItemV2({ files: [], transcriptModel: EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE })
      expect(item.transcriptModel).toEqual(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE)
      expect(readItemV2({ files: [], transcriptModel: EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE }).transcriptModel).toEqual(EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE)
      expect(readItemV2({ files: [] }).transcriptModel).toBeNull()
      // R101-03 (ruling D241): the reader IS the shared one (its bounds and its "not stated" cases are held in
      // packages/shared/test/evidence-verify.test.ts, once for both clients); a member that does not read states no model here.
      expect(readTranscriptModel).toBe(sharedRules.readTranscriptModel)
      expect(readItemV2({ files: [], transcriptModel: { name: 'x' } }).transcriptModel).toBeNull()
    })

    it('a local backend: name, the DECLARED version, quantisation and the model file hash', () => {
      show(<TranscriptModelFacts model={readTranscriptModel(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE)} />)
      const block = screen.getByTestId('evidence-transcript-model')
      expect(block).toHaveAttribute('data-reported-by-server', 'false')
      expect(screen.getByTestId('evidence-transcript-model-name')).toHaveTextContent(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE.name)
      expect(screen.getByTestId('evidence-transcript-model-version')).toHaveTextContent(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE.version)
      expect(block).toHaveTextContent(M.model.version)
      expect(screen.getByTestId('evidence-transcript-model-quantisation')).toHaveTextContent(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE.quantisation)
      expect(screen.getByTestId('evidence-transcript-model-hash')).toHaveTextContent(EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE.modelSha256)
      expect(screen.queryByTestId('evidence-transcript-model-report')).toBeNull()
    })

    it('a server backend: the name and the Core\'s own sentence (D160) - no version, quantisation or hash row is drawn', () => {
      show(<TranscriptModelFacts model={readTranscriptModel(EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE)} />)
      expect(screen.getByTestId('evidence-transcript-model')).toHaveAttribute('data-reported-by-server', 'true')
      expect(screen.getByTestId('evidence-transcript-model-name')).toHaveTextContent(EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE.name)
      expect(screen.getByTestId('evidence-transcript-model-report')).toHaveTextContent(EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE.report)
      expect(screen.getByTestId('evidence-transcript-model-report')).toHaveTextContent('not verified')
      for (const row of ['version', 'quantisation', 'hash']) expect(screen.queryByTestId(`evidence-transcript-model-${row}`)).toBeNull()
    })

    it('control: an item that states no model draws nothing', () => {
      const { container } = show(<TranscriptModelFacts model={null} />)
      expect(container).toBeEmptyDOMElement()
    })
  })

  /** The contract's own examples of operations 85 (201) and 86 (200): the revision entry carries `reason` (KR section 2). */
  const exampleOf = (operationId: string, status: number): unknown => Object.values((CORE_API_EXAMPLES[operationId]?.responses[status] ?? {}) as Record<string, { value: unknown }>)[0]?.value
  const REVISION_201 = exampleOf('createTranscriptRevision', 201) as Record<string, unknown>
  const REVISION_PAGE_200 = exampleOf('listTranscriptRevisions', 200) as { items: Record<string, unknown>[] }

  describe('G81b-09: the reason of a revision in the revision list', () => {
    /** The contract's revision entry without its `reason` (an entry of a Core that states none), moved to revision `number`. */
    const wire = (number: number, extra: Record<string, unknown> = {}) => {
      const { reason: _reason, ...entry } = REVISION_PAGE_200.items[0]!
      return { ...entry, revisionId: `TRV-00000${number}`, number, baseRevision: number - 1, ...extra }
    }
    const audit = (revisionId: string, reason: string, evidenceId = 'EV-1') => ({ type: 'TRANSCRIPT_REVISED', evidenceId, details: { revisionId, reason } })

    it('operation 86 (contract example): the entry\'s own `reason` is read BY NAME and shown; an audit row of the same revision does not replace it', () => {
      expect(TRANSCRIPT_REVISION_REASON_EXAMPLE).toBeTruthy()
      expect(REVISION_PAGE_200.items[0]!.reason).toBe(TRANSCRIPT_REVISION_REASON_EXAMPLE)
      const read = readTranscriptRevisions(REVISION_PAGE_200)!
      expect(read).toHaveLength(1)
      expect(read[0]!.reason).toBe(TRANSCRIPT_REVISION_REASON_EXAMPLE)
      // Operation 85's answer (201) is the same shape and the same member.
      expect(readTranscriptRevision(REVISION_201)!.reason).toBe(TRANSCRIPT_REVISION_REASON_EXAMPLE)
      const revisionId = read[0]!.revisionId
      // A row of the audit slice that disagrees: the member of the revision wins.
      expect(revisionReasons(read, 'EV-1', [{ type: 'TRANSCRIPT_REVISED', evidenceId: 'EV-1', details: { revisionId, reason: 'a text from the audit row' } }]).get(revisionId)).toBe(TRANSCRIPT_REVISION_REASON_EXAMPLE)
      show(<RevisionList revisions={read} failed={false} nameOf={(id) => id} reasons={revisionReasons(read, 'EV-1', [])} />)
      expect(screen.getByTestId('evidence-transcript-revision-reason-1')).toHaveTextContent(`Reason: ${TRANSCRIPT_REVISION_REASON_EXAMPLE}`)
      expect(screen.getByTestId('evidence-transcript-revision-reason-1')).toHaveAttribute('data-reason', 'stated')
    })

    it('an entry WITHOUT the member (the contract example with `reason` removed) falls back to the audit row; with neither it reads "Reason: not reported"', () => {
      const { reason: _reason, ...withoutReason } = REVISION_PAGE_200.items[0]!
      const entry = readTranscriptRevision(withoutReason)!
      expect(entry.reason).toBeNull()
      expect(revisionReasons([entry], 'EV-1', [{ type: 'TRANSCRIPT_REVISED', evidenceId: 'EV-1', details: { revisionId: entry.revisionId, reason: 'from the audit row' } }]).get(entry.revisionId)).toBe('from the audit row')
      const none = revisionReasons([entry], 'EV-1', [])
      expect(none.size).toBe(0)
      show(<RevisionList revisions={[entry]} failed={false} nameOf={(id) => id} reasons={none} />)
      expect(screen.getByTestId('evidence-transcript-revision-reason-1')).toHaveTextContent(M.reasonNotReported)
      expect(screen.getByTestId('evidence-transcript-revision-reason-1')).toHaveAttribute('data-reason', 'none')
    })

    it('the reason comes from the revision itself when it carries one, else from the Core\'s audit row of the SAME item and revision', () => {
      const own = readTranscriptRevision(wire(2, { reason: 'Misheard name corrected' }))!
      const plain = readTranscriptRevision(wire(1))!
      expect(own.reason).toBe('Misheard name corrected')
      expect(plain.reason).toBeNull()
      // R101-03 (ruling D241): the reason is the SHARED reading (trimmed; bounded after trimming) - what the mobile apps read too.
      for (const reason of ['  Padded by the wire \n', ` ${'r'.repeat(500)} `, 'r'.repeat(501), '   ', 7]) {
        expect(readTranscriptRevision(wire(3, { reason }))!.reason, JSON.stringify(reason)).toBe(sharedRules.readRevisionReason({ reason }))
      }
      expect(readTranscriptRevision(wire(3, { reason: '  Padded by the wire \n' }))!.reason).toBe('Padded by the wire')
      const reasons = revisionReasons([own, plain], 'EV-1', [audit('TRV-000001', 'Speaker spelled the street name'), audit('TRV-000002', 'another text'), audit('TRV-000001', 'of another item', 'EV-9')])
      expect(reasons.get('TRV-000002')).toBe('Misheard name corrected')
      expect(reasons.get('TRV-000001')).toBe('Speaker spelled the street name')
      // Controls: a row of another item, of another type, or without a reason gives none.
      expect(revisionReasons([plain], 'EV-1', [audit('TRV-000001', 'x', 'EV-9')]).size).toBe(0)
      expect(revisionReasons([plain], 'EV-1', [{ type: 'EVIDENCE_VERIFIED', evidenceId: 'EV-1', details: { revisionId: 'TRV-000001', reason: 'x' } }]).size).toBe(0)
      expect(revisionReasons([plain], 'EV-1', [{ type: 'TRANSCRIPT_REVISED', evidenceId: 'EV-1', details: { revisionId: 'TRV-000001' } }]).size).toBe(0)
    })

    it('the list shows "Reason: ..." under each revision; a revision whose reason no source states reads "Reason: not reported"', () => {
      const revisions = [readTranscriptRevision(wire(2))!, readTranscriptRevision(wire(1))!]
      show(<RevisionList revisions={revisions} failed={false} nameOf={(id) => id} reasons={revisionReasons(revisions, 'EV-1', [audit('TRV-000002', 'Misheard name corrected')])} />)
      expect(screen.getByTestId('evidence-transcript-revision-reason-2')).toHaveTextContent('Reason: Misheard name corrected')
      expect(screen.getByTestId('evidence-transcript-revision-reason-2')).toHaveAttribute('data-reason', 'stated')
      expect(screen.getByTestId('evidence-transcript-revision-reason-1')).toHaveTextContent(M.reasonNotReported)
      expect(screen.getByTestId('evidence-transcript-revision-reason-1')).toHaveAttribute('data-reason', 'none')
    })
  })

  describe('G89b-06: a file part whose check did not run', () => {
    const file = { trackId: 'VIDEO-02', ok: false, storedOk: false, plainOk: false, chainOk: false, fragmentCount: 5 }
    const check = (id: string, status: V2Check['status']): V2Check => ({ id, status, failureClass: status === 'FAIL' ? 'TAMPERED' : null, skipped: status === 'SKIPPED' ? 'BLOCKED' : null, findings: [] })
    /** The tamper demonstration (gate 89): V-04 and V-06 FAIL on (VIDEO-02, 3); V-05 "Not run: an earlier check failed". */
    const TAMPER = [check('V-04', 'FAIL'), check('V-05', 'SKIPPED'), check('V-06', 'FAIL')]

    it('the contract member `files[].plainChecked` (VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE) is read by name: present and `false` on the row whose decrypted bytes were not checked, absent on the other', () => {
      const answer = readVerifyV2({ ok: false, at: 1_790_824_000_000, files: VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE })
      const rows = answer!.files
      expect(rows).toHaveLength(2)
      expect(rows.map((row) => [row.trackId, row.plainChecked, row.plainOk])).toEqual([
        ['VIDEO-01', undefined, true],
        ['VIDEO-02', false, false],
      ])
    })

    // R101-03 (ruling D241): the outcome of a part is the SHARED rule's. This view words it and does not decide it:
    // the rule's own vectors are in packages/shared/test/evidence-verify.test.ts.
    it('R101-03: the view draws the SHARED outcome of every part - the function is the shared one, and each drawn word follows it', () => {
      expect(v2FilePartOutcome).toBe(sharedRules.v2FilePartOutcome)
      const word = { PASS: en.evidence.verifyV2.outcome.PASS, FAIL: en.evidence.verifyV2.outcome.FAIL, NOT_RUN: en.evidence.verifyV2.outcome.SKIPPED } as const
      const notChecked = readVerifyV2({ ok: false, at: 1_790_824_000_000, files: VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE })!.files[1]!
      const cases: ReadonlyArray<readonly [typeof file | typeof notChecked, readonly V2Check[] | null]> = [
        [file, TAMPER],
        [file, null],
        [file, [check('V-04', 'SKIPPED'), check('V-05', 'SKIPPED'), check('V-06', 'SKIPPED')]],
        [file, [check('V-04', 'FAIL'), check('V-05', 'SKIPPED'), check('V-06', 'SKIPPED')]],
        [{ ...file, storedOk: true, plainOk: true, chainOk: true }, TAMPER],
        [notChecked, [check('V-05', 'FAIL')]],
      ]
      for (const [facts, checks] of cases) {
        const { unmount } = show(<ol><ResultRow row={{ id: 'file:VIDEO-02', ok: false, file: facts } as unknown as V2Row} checks={checks} /></ol>)
        const parts = document.querySelector('[data-part="stored"]')!
        const expected = (['stored', 'plain', 'chain'] as const).map((part) => sharedRules.v2FilePartOutcome(facts, part, checks))
        expect([parts.getAttribute('data-stored'), parts.getAttribute('data-plain'), parts.getAttribute('data-chain')]).toEqual(expected)
        expect(parts).toHaveTextContent(`Stored bytes ${word[expected[0]!]} · decrypted bytes ${word[expected[1]!]} · fragment chain ${word[expected[2]!]}`)
        unmount()
      }
    })

    it('R101-03, the case the two clients disagreed on: the chain check (V-06) SKIPPED in the result reads "fragment chain Not run" here too - never "FAIL"', () => {
      const row = { id: 'file:VIDEO-02', ok: false, file } as unknown as V2Row
      show(<ol><ResultRow row={row} checks={[check('V-04', 'FAIL'), check('V-05', 'SKIPPED'), check('V-06', 'SKIPPED')]} /></ol>)
      const parts = document.querySelector('[data-part="stored"]')!
      expect(parts).toHaveTextContent(`Stored bytes ${en.evidence.verifyV2.outcome.FAIL} · decrypted bytes ${en.evidence.verifyV2.outcome.SKIPPED} · fragment chain ${en.evidence.verifyV2.outcome.SKIPPED}`)
      expect(parts).toHaveAttribute('data-chain', 'NOT_RUN')
      expect(parts).not.toHaveTextContent('fragment chain FAIL')
    })

    it('the row of the tampered file reads "Stored bytes FAIL · decrypted bytes Not run · fragment chain FAIL"', () => {
      const row = { id: 'file:VIDEO-02', ok: false, file } as unknown as V2Row
      show(<ol><ResultRow row={row} checks={TAMPER} /></ol>)
      const parts = document.querySelector('[data-part="stored"]')!
      expect(parts).toHaveTextContent(`Stored bytes ${en.evidence.verifyV2.outcome.FAIL} · decrypted bytes ${en.evidence.verifyV2.outcome.SKIPPED} · fragment chain ${en.evidence.verifyV2.outcome.FAIL}`)
      expect(parts).toHaveAttribute('data-plain', 'NOT_RUN')
      expect(parts).not.toHaveTextContent('decrypted bytes FAIL')
    })

    it('control: a result without the per-check report keeps "decrypted bytes FAIL"', () => {
      const row = { id: 'file:VIDEO-02', ok: false, file } as unknown as V2Row
      show(<ol><ResultRow row={row} checks={null} /></ol>)
      expect(document.querySelector('[data-part="stored"]')).toHaveTextContent('decrypted bytes FAIL')
    })
  })
})

describe('row 159 (D5): the pair audio files and the missing-microphone statement of an item (S5 §6, F-5-11; D30 K-3, D45)', () => {
  // | Rule | Test |
  // |------|------|
  // | A D5 item (4 cameras + 4 audio files, contract shape): each AUDIO-0N is the audio of pair N, "in VIDEO-0N" | 1 |
  // | MIC-02 not assigned: three audio files + one statement (silent VIDEO-02) | 2 |
  // | An audio file whose camera file is not in the item is not said to be "in" it | 3 |
  // | A statement that cannot be read whole is no statement (never guessed) | 4 |
  // | LEGACY: a /2 item and a v1 item state neither; the camera reader is unchanged | 5 |
  // | The block draws the rows with their own hashes and the statement in words; a legacy item draws nothing | 6, 7 |
  const i18n = createI18n()
  const show = (node: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{node}</I18nextProvider>)
  afterEach(cleanup)
  const S = en.evidence.itemFacts.sealed
  const camera = (n: number) => ({ trackId: `VIDEO-0${n}`, fileName: `fragments/VIDEO-0${n}.mp4`, sizeBytes: 4_000 + n, sha256: H(String(n)), sha256Plain: H('b'), fragmentCount: 5, fragmentChainHead: H('c') })
  const audio = (n: number) => ({ trackId: `AUDIO-0${n}`, fileName: `fragments/AUDIO-0${n}.m4a`, sizeBytes: 900 + n, sha256: H(String.fromCharCode(96 + n)), sha256Plain: H('e'), fragmentCount: 5, fragmentChainHead: H('f') })
  const d5Item = (cameras: number[], audios: number[], audioTracksMissing?: unknown) => ({
    ...datasetItem(),
    ...V2_MEMBERS,
    sealedPackage: 'PRESENT',
    files: [...cameras.map(camera), ...audios.map(audio)],
    ...(audioTracksMissing === undefined ? {} : { audioTracksMissing }),
  })
  const MIC_02_NOT_ASSIGNED = [{ trackId: 'AUDIO-02', micDeviceId: null, silentIn: ['VIDEO-02'], reason: 'NOT_ASSIGNED' }]

  it('1 - a D5 item with four audio files: each AUDIO-0N is the audio of pair N, in VIDEO-0N; the camera reader still names four cameras', () => {
    const item = d5Item([1, 2, 3, 4], [1, 2, 3, 4])
    expect(EvidenceItemSchema.safeParse(item).success).toBe(true)
    const v2 = readItemV2(item)
    expect(v2.files).toHaveLength(8)
    expect(v2.pairAudioFiles.map((entry) => [entry.trackId, entry.pair, entry.camera, entry.inCamera, entry.file.sha256])).toEqual([
      ['AUDIO-01', 1, 'VIDEO-01', 'VIDEO-01', H('a')],
      ['AUDIO-02', 2, 'VIDEO-02', 'VIDEO-02', H('b')],
      ['AUDIO-03', 3, 'VIDEO-03', 'VIDEO-03', H('c')],
      ['AUDIO-04', 4, 'VIDEO-04', 'VIDEO-04', H('d')],
    ])
    expect(v2.audioTracksMissing).toEqual([])
    expect((['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'] as const).map((id) => cameraFileOf(v2, id)?.sha256)).toEqual([H('1'), H('2'), H('3'), H('4')])
  })

  it('2 - MIC-02 not assigned: three audio files and ONE statement, the silent track in VIDEO-02', () => {
    const item = d5Item([1, 2, 3, 4], [1, 3, 4], MIC_02_NOT_ASSIGNED)
    expect(EvidenceItemSchema.safeParse(item).success).toBe(true)
    const v2 = readItemV2(item)
    expect(v2.pairAudioFiles.map((entry) => entry.trackId)).toEqual(['AUDIO-01', 'AUDIO-03', 'AUDIO-04'])
    expect(v2.audioTracksMissing).toEqual([{ trackId: 'AUDIO-02', pair: 2, camera: 'VIDEO-02', micDeviceId: null, silentIn: 'VIDEO-02', reason: 'NOT_ASSIGNED' }])
  })

  it('3 - an audio file whose camera file is not in the item (VIDEO-03 omitted at the seal) is not said to be in it', () => {
    const v2 = readItemV2(d5Item([1, 2, 4], [1, 2, 3, 4]))
    expect(v2.pairAudioFiles.find((entry) => entry.trackId === 'AUDIO-03')).toMatchObject({ camera: 'VIDEO-03', inCamera: null })
  })

  it('4 - a statement that cannot be read whole is no statement', () => {
    const bad: unknown[] = [
      [{ trackId: 'AUDIO-02', micDeviceId: null, silentIn: ['VIDEO-03'], reason: 'NOT_ASSIGNED' }],
      [{ trackId: 'AUDIO-02', micDeviceId: 'MIC-04', silentIn: ['VIDEO-02'], reason: 'NOT_ASSIGNED' }],
      [{ trackId: 'AUDIO-02', micDeviceId: null, silentIn: ['VIDEO-02'], reason: 'NOT_OPENED' }],
      [{ trackId: 'AUDIO-02', micDeviceId: null, silentIn: ['VIDEO-02'], reason: 'FAILED' }],
      [{ trackId: 'VIDEO-02', micDeviceId: null, silentIn: [], reason: 'NOT_ASSIGNED' }],
      [...MIC_02_NOT_ASSIGNED, ...MIC_02_NOT_ASSIGNED],
      [...MIC_02_NOT_ASSIGNED, 'AUDIO-03'],
      'AUDIO-02',
    ]
    for (const value of bad) expect(readItemV2({ audioTracksMissing: value }).audioTracksMissing).toEqual([])
    // CONTROL: the good one is read.
    expect(readItemV2({ audioTracksMissing: [{ trackId: 'AUDIO-03', micDeviceId: 'MIC-05', silentIn: [], reason: 'NOT_OPENED' }] }).audioTracksMissing).toEqual([
      { trackId: 'AUDIO-03', pair: 3, camera: 'VIDEO-03', micDeviceId: 'MIC-05', silentIn: null, reason: 'NOT_OPENED' },
    ])
  })

  it('5 - LEGACY: a /2 item and a v1 item state no pair audio and no statement; the camera files are read as before', () => {
    const legacy = readItemV2({ ...datasetItem(), ...V2_MEMBERS })
    expect([legacy.pairAudioFiles, legacy.audioTracksMissing]).toEqual([[], []])
    expect(legacy.files.map((file) => file.trackId)).toEqual(['VIDEO-01', 'VIDEO-02'])
    const v1 = readItemV2(datasetItem())
    expect([v1.pairAudioFiles, v1.audioTracksMissing, v1.files]).toEqual([[], [], []])
  })

  it('6 - the block: one row per audio file "AUDIO-0N · audio of Pair N, in VIDEO-0N" with its own hash, and the MIC-02 statement in words', () => {
    const v2 = readItemV2(d5Item([1, 2, 3, 4], [1, 3, 4], MIC_02_NOT_ASSIGNED))
    show(<PairAudio item={v2} onCopy={() => undefined} />)
    const block = screen.getByTestId('evidence-pair-audio')
    const rows = Array.from(block.querySelectorAll<HTMLElement>('[data-hash]'))
    expect(rows.map((row) => row.dataset.hash)).toEqual(['AUDIO-01', 'AUDIO-03', 'AUDIO-04'])
    expect(rows[1]).toHaveTextContent('AUDIO-03 · audio of Pair 3, in VIDEO-03')
    expect(rows[1]).toHaveTextContent(H('c').slice(0, 16))
    const missing = screen.getByTestId('evidence-audio-missing')
    expect(missing).toHaveTextContent(S.missingTitle)
    expect(missing).toHaveTextContent('AUDIO-02 (Pair 2): no microphone was assigned to MIC-02. VIDEO-02 holds a silent audio track: that silence is not the sound of the room.')
    expect(missing).toHaveTextContent(S.missingNote)
    expect(missing.querySelector('[data-missing="AUDIO-02"]')).toHaveAttribute('data-reason', 'NOT_ASSIGNED')
  })

  it('6b - a microphone that did not open is named; an audio file without its camera file says so', () => {
    const v2 = readItemV2(d5Item([1, 2, 4], [1, 3], [{ trackId: 'AUDIO-02', micDeviceId: 'MIC-04', silentIn: ['VIDEO-02'], reason: 'NOT_OPENED' }]))
    show(<PairAudio item={v2} onCopy={() => undefined} />)
    expect(screen.getByTestId('evidence-audio-missing')).toHaveTextContent('AUDIO-02 (Pair 2): microphone MIC-04 on MIC-02 could not be opened at the start.')
    expect(screen.getByTestId('evidence-pair-audio').querySelector('[data-hash="AUDIO-03"]')).toHaveTextContent('AUDIO-03 · audio of Pair 3 (camera file VIDEO-03 is not in the package)')
  })

  it('7 - LEGACY: the block draws nothing for a /2 item', () => {
    const { container } = show(<PairAudio item={readItemV2({ ...datasetItem(), ...V2_MEMBERS })} onCopy={() => undefined} />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByTestId('evidence-pair-audio')).toBeNull()
  })
})
