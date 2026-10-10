// Fix pass F-M7 (review row 88; decision D178), the web verify view:
//
//   R88-07   operation 41 answers `signature.developmentKey`; the view READS it: a package signed
//            with a development key says "Signed with a DEVELOPMENT key — not a production
//            signature" beside the result, never a plain pass; `null` reads "not established";
//   R88-06   the named notice `AUDIT_EXTRACT_NOT_SIGNED` is shown, never collapsed.
//
// Negative control per rule: a key without the mark draws no line; an answer without a notice draws none.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EvidenceVerifyResultSchema } from '@dems/shared/api'
import { DEVELOPMENT_KEY_REPORT_LINE } from '@dems/shared/evidence-verify'
import { withProviders } from '@/components/composed/__tests__/test-utils'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { readVerifyV2, type VerifyV2Answer } from '../verify-v2'
import { VerifyV2Report } from '../verify-v2-report'
import { RECORDED_VERIFY_V2 } from './fixtures/verify-v2-recorded'

const NOTICE = { code: 'AUDIT_EXTRACT_NOT_SIGNED', report: 'Audit extract: present, NOT covered by the package signature.' }
const answerOf = (members: Record<string, unknown>): VerifyV2Answer => {
  const body = { ...RECORDED_VERIFY_V2.pass.body, ...members }
  // The answer is one the contract admits (so the view is tested against what the Core can send).
  expect(EvidenceVerifyResultSchema.safeParse(body).success).toBe(true)
  const answer = readVerifyV2(body)
  if (answer === null) throw new Error('not a v2 answer')
  return answer
}
const draw = (answer: VerifyV2Answer) => render(withProviders(<VerifyV2Report answer={answer} />))

beforeEach(() => resetMissingI18nKeys())
afterEach(() => {
  cleanup()
  expect(getMissingI18nKeys()).toEqual([])
})

describe('R88-07: the signing key of the verified package is said beside the result', () => {
  it('the reader: true -> DEVELOPMENT, false -> NOT_DEVELOPMENT, null -> NOT_ESTABLISHED, no member -> null (nothing is drawn for a v1 answer or an older Core)', () => {
    expect(answerOf({ signature: { developmentKey: true } }).signingKey).toBe('DEVELOPMENT')
    expect(answerOf({ signature: { developmentKey: false } }).signingKey).toBe('NOT_DEVELOPMENT')
    expect(answerOf({ signature: { developmentKey: null } }).signingKey).toBe('NOT_ESTABLISHED')
    const without = { ...RECORDED_VERIFY_V2.pass.body } as Record<string, unknown>
    delete without.signature
    expect(readVerifyV2(without)?.signingKey).toBeNull()
  })

  it('a member that is there and unreadable is NOT "no development key": NOT_ESTABLISHED, and named as malformed', () => {
    const answer = readVerifyV2({ ...RECORDED_VERIFY_V2.pass.body, signature: { developmentKey: 'no' } })
    expect(answer).toMatchObject({ signingKey: 'NOT_ESTABLISHED' })
    expect(answer?.malformed).toContain('signature')
  })

  it('a development-key signature: the line of the verifier, as a warning, on a result that PASSED - never a plain pass', () => {
    draw(answerOf({ signature: { developmentKey: true } }))
    const line = screen.getByTestId('evidence-v2-signing-key')
    expect(line.getAttribute('data-signing-key')).toBe('DEVELOPMENT')
    expect(line.textContent).toContain('Signed with a DEVELOPMENT key — not a production signature')
    // The words are the verifier's own report line (one wording on every surface).
    expect(DEVELOPMENT_KEY_REPORT_LINE).toBe('Signed with a DEVELOPMENT key — not a production signature.')
    expect(screen.getByTestId('evidence-verify-v2').getAttribute('data-verdict')).toBe('PASS')
  })

  it('a key that is not established says so (never silence, never "development", never "production")', () => {
    draw(answerOf({ signature: { developmentKey: null } }))
    const line = screen.getByTestId('evidence-v2-signing-key')
    expect(line.getAttribute('data-signing-key')).toBe('NOT_ESTABLISHED')
    expect(line.textContent).toContain('Signing key: not established')
    expect(line.textContent).not.toContain('DEVELOPMENT')
  })

  it('CONTROL: a key without the mark, and an answer without the member, draw no signing-key line', () => {
    draw(answerOf({ signature: { developmentKey: false } }))
    expect(screen.queryByTestId('evidence-v2-signing-key')).toBeNull()
    cleanup()
    const without = { ...RECORDED_VERIFY_V2.pass.body } as Record<string, unknown>
    delete without.signature
    draw(readVerifyV2(without) as VerifyV2Answer)
    expect(screen.queryByTestId('evidence-v2-signing-key')).toBeNull()
  })
})

describe('R88-06: what the package signature does not cover is shown', () => {
  it('the notice of the answer is read and drawn with its own sentence', () => {
    const answer = answerOf({ notices: [NOTICE] })
    expect(answer.notices).toEqual([NOTICE])
    draw(answer)
    const shown = screen.getByTestId('evidence-v2-notice-AUDIT_EXTRACT_NOT_SIGNED')
    expect(shown.textContent).toContain('Audit extract: present, NOT covered by the package signature')
  })

  // Controller decision D185 (a): the export-folder notice is in the same list, beside the audit-extract one.
  it('EXPORT_FOLDER_UNEXPECTED_FILE is drawn in the same list, and the audit-extract notice stays beside it', () => {
    const stray = { code: 'EXPORT_FOLDER_UNEXPECTED_FILE', report: 'Export folder: 1 file that is no finished export (EXP-000007.zip.partial). It is not part of the sealed package.' }
    draw(answerOf({ notices: [NOTICE, stray] }))
    expect(screen.getByTestId('evidence-v2-notice-EXPORT_FOLDER_UNEXPECTED_FILE').textContent).toBe(stray.report)
    expect(screen.getByTestId('evidence-v2-notice-AUDIT_EXTRACT_NOT_SIGNED')).toBeTruthy()
  })

  it('a notice this build has no words for is shown with the line the Core sent, not dropped', () => {
    draw(answerOf({ notices: [{ code: 'SOME_LATER_NOTICE', report: 'A later statement of the verifier.' }] }))
    expect(screen.getByTestId('evidence-v2-notice-SOME_LATER_NOTICE').textContent).toContain('A later statement of the verifier.')
  })

  it('CONTROL: an answer without notices draws none', () => {
    const without = { ...RECORDED_VERIFY_V2.pass.body } as Record<string, unknown>
    delete without.notices
    draw(readVerifyV2(without) as VerifyV2Answer)
    expect(screen.queryByTestId('evidence-v2-notices')).toBeNull()
  })
})
