// Fix pass F-M7 (review row 88; decision D178), the mobile verify view (tablet and phone):
//
//   R88-07   operation 41 answers `signature.developmentKey`; the view READS it: a package signed
//            with a development key says "Signed with a DEVELOPMENT key — not a production
//            signature" beside the result, never a plain pass; `null` reads "not established";
//   R88-06   the named notice `AUDIT_EXTRACT_NOT_SIGNED` is shown, never collapsed.
//
// Negative control per rule: a key without the mark draws no line; an answer without a notice draws none.
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { EvidenceVerifyResultSchema } from '@dems/shared/api';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { RECORDED_VERIFY_V2 } from './testing/verify-v2-recorded';
import { readVerifyV2, type VerifyV2Answer } from './verify-v2';
import { VerifyV2Report } from './verify-v2-report';

const NOTICE = { code: 'AUDIT_EXTRACT_NOT_SIGNED', report: 'Audit extract: present, NOT covered by the package signature.' };
const answerOf = (members: Record<string, unknown>): VerifyV2Answer => {
  const body = { ...RECORDED_VERIFY_V2.pass.body, ...members };
  // The answer is one the contract admits (so the view is tested against what the Core can send).
  expect(EvidenceVerifyResultSchema.safeParse(body).success).toBe(true);
  const answer = readVerifyV2(body);
  if (answer === null) throw new Error('not a v2 answer');
  return answer;
};
const without = (member: string): VerifyV2Answer => {
  const body = { ...RECORDED_VERIFY_V2.pass.body } as Record<string, unknown>;
  delete body[member];
  return readVerifyV2(body) as VerifyV2Answer;
};
const draw = (answer: VerifyV2Answer) =>
  render(
    <I18nextProvider i18n={i18n}>
      <VerifyV2Report answer={answer} />
    </I18nextProvider>,
  );

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

describe('R88-07: the signing key of the verified package is said beside the result', () => {
  it('the reader: true -> DEVELOPMENT, false -> NOT_DEVELOPMENT, null -> NOT_ESTABLISHED, no member -> null', () => {
    expect(answerOf({ signature: { developmentKey: true } }).signingKey).toBe('DEVELOPMENT');
    expect(answerOf({ signature: { developmentKey: false } }).signingKey).toBe('NOT_DEVELOPMENT');
    expect(answerOf({ signature: { developmentKey: null } }).signingKey).toBe('NOT_ESTABLISHED');
    expect(without('signature').signingKey).toBeNull();
  });

  it('a member that is there and unreadable is NOT "no development key": NOT_ESTABLISHED, and named as malformed', () => {
    const answer = readVerifyV2({ ...RECORDED_VERIFY_V2.pass.body, signature: { developmentKey: 'no' } });
    expect(answer?.signingKey).toBe('NOT_ESTABLISHED');
    expect(answer?.malformed).toContain('signature');
  });

  it('a development-key signature: the line of the verifier on a result that PASSED - never a plain pass', () => {
    draw(answerOf({ signature: { developmentKey: true } }));
    expect(screen.getByTestId('evidence-v2-signing-key-DEVELOPMENT')).toBeTruthy();
    expect(screen.getByText('Signed with a DEVELOPMENT key — not a production signature')).toBeTruthy();
    expect(screen.getByTestId('evidence-verify-v2-PASS')).toBeTruthy();
  });

  it('a key that is not established says so (never silence, never "development")', () => {
    draw(answerOf({ signature: { developmentKey: null } }));
    expect(screen.getByTestId('evidence-v2-signing-key-NOT_ESTABLISHED')).toBeTruthy();
    expect(screen.getByText('Signing key: not established — the signature or its certificate did not verify')).toBeTruthy();
    expect(screen.queryByText('Signed with a DEVELOPMENT key — not a production signature')).toBeNull();
  });

  it('CONTROL: a key without the mark, and an answer without the member, draw no signing-key line', () => {
    const first = draw(answerOf({ signature: { developmentKey: false } }));
    expect(screen.queryByTestId('evidence-v2-signing-key-DEVELOPMENT')).toBeNull();
    expect(screen.queryByTestId('evidence-v2-signing-key-NOT_ESTABLISHED')).toBeNull();
    first.unmount();
    draw(without('signature'));
    expect(screen.queryByTestId('evidence-v2-signing-key-DEVELOPMENT')).toBeNull();
    expect(screen.queryByTestId('evidence-v2-signing-key-NOT_ESTABLISHED')).toBeNull();
  });
});

describe('R88-06: what the package signature does not cover is shown', () => {
  it('the notice of the answer is read and drawn with its own sentence', () => {
    const answer = answerOf({ notices: [NOTICE] });
    expect(answer.notices).toEqual([NOTICE]);
    draw(answer);
    expect(screen.getByTestId('evidence-v2-notice-AUDIT_EXTRACT_NOT_SIGNED')).toBeTruthy();
    expect(screen.getByText('Audit extract: present, NOT covered by the package signature.')).toBeTruthy();
  });

  // Controller decision D185 (a): the export-folder notice is in the same list, beside the audit-extract one.
  it('EXPORT_FOLDER_UNEXPECTED_FILE is drawn in the same list, and the audit-extract notice stays beside it', () => {
    const stray = { code: 'EXPORT_FOLDER_UNEXPECTED_FILE', report: 'Export folder: 1 file that is no finished export (EXP-000007.zip.partial). It is not part of the sealed package.' };
    draw(answerOf({ notices: [NOTICE, stray] }));
    expect(screen.getByTestId('evidence-v2-notice-EXPORT_FOLDER_UNEXPECTED_FILE')).toBeTruthy();
    expect(screen.getByText(stray.report)).toBeTruthy();
    expect(screen.getByTestId('evidence-v2-notice-AUDIT_EXTRACT_NOT_SIGNED')).toBeTruthy();
  });

  it('a notice this build has no words for is shown with the line the Core sent, not dropped', () => {
    draw(answerOf({ notices: [{ code: 'SOME_LATER_NOTICE', report: 'A later statement of the verifier.' }] }));
    expect(screen.getByText('A later statement of the verifier.')).toBeTruthy();
  });

  it('CONTROL: an answer without notices draws none', () => {
    draw(without('notices'));
    expect(screen.queryByTestId('evidence-v2-notices')).toBeNull();
  });
});
