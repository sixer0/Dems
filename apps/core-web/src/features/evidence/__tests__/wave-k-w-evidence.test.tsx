/**
 * @vitest-environment jsdom
 */
// Fix wave K, driver W: the evidence item of the web console (re-gates 81 and 89).
//
// | Finding | Rule | Member read BY NAME | Test |
// |---------|------|---------------------|------|
// | G81b-06 | The model that made the sealed transcript is shown on the item: name, the version the installation declared, quantisation, file hash; a server backend: the name and the Core's own sentence (D160) | `evidence.transcriptModel` (`EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE`, `EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE`; `contract_wave_k.md` S2 section 1) | "G81b-06" |
// | G81b-09 | The stated reason of a revision is shown in the revision list | the revision's `reason` of operations 85 / 86 (`TRANSCRIPT_REVISION_REASON_EXAMPLE`, the registry examples; `contract_wave_k.md` KR section 2) first; `details.reason` of the Core's `TRANSCRIPT_REVISED` row only for an entry without the member | "G81b-09" |
// | G89b-06 | The decrypted-bytes part of a file whose plaintext check did not run reads "Not run", never "FAIL" | `files[].plainChecked` of operation 41 (`VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE`; `contract_wave_k.md` KR section 1), else check `V-05` of the same result (S1 section 7) | "G89b-06" |
import { cleanup, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import { CORE_API_EXAMPLES, EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, EVIDENCE_TRANSCRIPT_MODEL_SERVER_EXAMPLE, TRANSCRIPT_REVISION_REASON_EXAMPLE, VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { createI18n } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { readItemV2, readTranscriptModel } from '../item-v2'
import { readTranscriptRevision, readTranscriptRevisions, revisionReasons } from '../transcript-model'
import { RevisionList, TranscriptModelFacts } from '../transcript-pane'
import { readVerifyV2, v2FilePartOutcome, type V2Check, type V2Row } from '../verify-v2'
import { ResultRow } from '../verify-v2-report'

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
    // A member that is not the contract's shape is "not stated" - never a default model.
    expect(readTranscriptModel({ name: 'x' })).toBeNull()
    expect(readTranscriptModel({ ...EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE, reportedByServer: 'no' })).toBeNull()
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

  it('the contract member `files[].plainChecked` (VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE), read by name: `false` = the decrypted bytes of THAT file were not checked', () => {
    const answer = readVerifyV2({ ok: false, at: 1_790_824_000_000, files: VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE })
    const rows = answer!.files
    expect(rows).toHaveLength(2)
    const notChecked = rows.find((row) => row.plainChecked === false)!
    const checked = rows.find((row) => row.plainChecked === undefined)!
    expect(notChecked.plainOk).toBe(false)
    // Per FILE, whatever check V-05 says for the result as a whole (it can FAIL for the other file).
    expect(v2FilePartOutcome(notChecked, 'plain', [check('V-05', 'FAIL')])).toBe('NOT_RUN')
    expect(v2FilePartOutcome(notChecked, 'plain', null)).toBe('NOT_RUN')
    expect(v2FilePartOutcome(checked, 'plain', null)).toBe(checked.plainOk ? 'PASS' : 'FAIL')
  })

  it('a Core that answers no such member: NOT_RUN only when check V-05 of the same result is skipped; stored bytes and chain are always the answer\'s own flags', () => {
    expect(v2FilePartOutcome(file, 'stored', TAMPER)).toBe('FAIL')
    expect(v2FilePartOutcome(file, 'plain', TAMPER)).toBe('NOT_RUN')
    expect(v2FilePartOutcome(file, 'chain', TAMPER)).toBe('FAIL')
    expect(v2FilePartOutcome(file, 'chain', [check('V-06', 'SKIPPED')])).toBe('FAIL')
    expect(v2FilePartOutcome(file, 'plain', null)).toBe('FAIL')
    expect(v2FilePartOutcome(file, 'plain', [check('V-05', 'FAIL')])).toBe('FAIL')
    expect(v2FilePartOutcome({ ...file, plainOk: true }, 'plain', TAMPER)).toBe('PASS')
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
