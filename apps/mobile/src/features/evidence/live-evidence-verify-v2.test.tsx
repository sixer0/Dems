// Blueprint row 87 (M7-W6): the v2 verify view in LIVE mode on the app's real Live source over the
// contract-checked fake transport (the answers of operation 41 are checked against the registry schema,
// so they carry the contract of TODAY). The bodies are the ones the real verifier of row 85 produced
// (`testing/verify-v2-recorded.ts`).
//
// | Rule | Where |
// |------|-------|
// | Nothing moves without the Core: while it has not answered, no verdict, no row, no report | "while the Core has not answered" |
// | A v2 answer is shown whole when the "asking" state ends; nothing of it is scrambled or paced | "the answer" |
// | The v1 per-track rows are not marked for a v2 answer (it judges files, not tracks) | both |
// | A FAIL of the Core is FAIL on the chip, on the file's row and in the toast | "the tamper demo answer" |
//
// Import order: the test setup, then the router harness, then the bed (see their headers).
import './testing/evidence-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { en } from '@dems/shared/i18n';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { evidenceEn } from './i18n';
import { VERIFY_ASK_MS } from './integrity-tab';
import { renderLiveEvidence, resetLiveEvidenceBed, type LiveEvidenceBed } from './testing/live-evidence-bed';
import { RECORDED_VERIFY_V2 } from './testing/verify-v2-recorded';

let bed: LiveEvidenceBed | null = null;

beforeEach(async () => {
  resetMissingKeys();
  await resetLiveEvidenceBed();
});

afterEach(() => {
  bed?.stop();
  bed = null;
  expect(getMissingKeys()).toEqual([]);
});

const toastShown = (text: string) => screen.queryAllByText(text).length > 0;
const V1_MARKS = ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02'].flatMap((track) => [`evidence-track-${track}-ok`, `evidence-track-${track}-fail`]);
const drawn = () => ({
  pass: screen.queryByTestId('evidence-verdict-PASS') !== null,
  fail: screen.queryByTestId('evidence-verdict-FAIL') !== null,
  report: screen.queryByTestId('evidence-verify-v2-PASS') !== null || screen.queryByTestId('evidence-verify-v2-FAIL') !== null,
  rows: screen.queryByTestId('evidence-v2-rows') !== null,
  v1Marks: V1_MARKS.filter((testID) => screen.queryByTestId(testID) !== null),
});

async function openIntegrity(suffix: string): Promise<{ b: LiveEvidenceBed; id: string }> {
  const b = await renderLiveEvidence({});
  bed = b;
  // A recording of this phase has no bundled demo package.
  b.mediaRef = () => ({ source: 'NONE', packageSuffix: null });
  const id = b.idOf(suffix);
  await b.navigate(`/evidence/${id}`);
  fireEvent.press(screen.getByTestId('evidence-tab-integrity'));
  await b.flush();
  return { b, id };
}

const recorded = (b: LiveEvidenceBed, name: keyof typeof RECORDED_VERIFY_V2, evidenceId: string) => ({
  status: 200,
  body: { ...RECORDED_VERIFY_V2[name].body, evidenceId, at: b.fake.clock.now() },
});

describe('while the Core has not answered', () => {
  it('NEGATIVE CONTROL: ten seconds pass and nothing is drawn; then the answer is shown whole, with no scramble phase', async () => {
    const { b, id } = await openIntegrity('0001');
    const held = b.fake.hold('verifyEvidence');
    fireEvent.press(screen.getByTestId('evidence-verify'));
    await b.flush();
    expect(b.requests('verifyEvidence')).toHaveLength(1);
    const nothing = { pass: false, fail: false, report: false, rows: false, v1Marks: [] };
    expect(drawn()).toEqual(nothing);

    await b.elapse(10_000, 500);
    expect(drawn()).toEqual(nothing);

    held.release(recorded(b, 'pass', id));
    await b.flush();
    // The "asking" state has long passed its minimum: the whole result is there, without the 600 ms scramble.
    await b.elapse(50);
    expect(drawn()).toEqual({ pass: true, fail: false, report: true, rows: true, v1Marks: [] });
    for (const row of ['file:VIDEO-01', 'file:VIDEO-02', 'transcript', 'manifest', 'signature']) expect(screen.getByTestId(`evidence-v2-row-${row}-ok`)).toBeTruthy();
    expect(toastShown(evidenceEn.integrity.passToast.replace('{{id}}', id))).toBe(true);
    expect(b.requests('verifyEvidence')).toHaveLength(1);
  });
});

describe('the tamper demo answer (one fragment of VIDEO-02 altered)', () => {
  it("the Core's FAIL is FAIL on the chip, on the file's row and in the toast; no v1 track is marked; the answer names the fragment", async () => {
    const { b, id } = await openIntegrity('0005');
    b.fake.answerOnce('verifyEvidence', recorded(b, 'tamperedFragment', id));
    fireEvent.press(screen.getByTestId('evidence-verify'));
    await b.flush();
    // LB-2: the paced "asking" state still shows; no part of the verdict yet.
    await b.elapse(VERIFY_ASK_MS - 150);
    expect(drawn()).toMatchObject({ pass: false, fail: false, report: false });
    await b.elapse(300);
    expect(drawn()).toEqual({ pass: false, fail: true, report: true, rows: true, v1Marks: [] });
    expect(screen.getByTestId('evidence-verdict-FAIL')).toHaveTextContent(/VIDEO-02/);
    expect(screen.getByTestId('evidence-verify-v2-FAIL')).toBeTruthy();
    // Fix wave K (G89b-06): V-05 of this recorded answer is SKIPPED ("an earlier check failed") - the decrypted bytes were
    // not checked, so the part reads "Not run", never FAIL.
    expect(screen.getByTestId('evidence-v2-row-file:VIDEO-02-fail')).toHaveTextContent(/Stored bytes FAIL · decrypted bytes Not run · fragment chain FAIL/);
    for (const row of ['file:VIDEO-01', 'transcript', 'manifest', 'signature']) expect(screen.getByTestId(`evidence-v2-row-${row}-ok`)).toBeTruthy();
    expect(screen.getByTestId('evidence-v2-fragment-VIDEO-02-3')).toHaveTextContent('VIDEO-02 fragment 3 tampered (stored-bytes hash mismatch; chain broken from fragment 3)');
    expect(screen.queryByTestId('evidence-v2-fragment-not-named')).toBeNull();
    for (const check of ['V-04', 'V-06', 'V-08']) expect(screen.getByTestId(`evidence-v2-check-${check}-FAIL`)).toBeTruthy();
    // Row 92: the source line of the package is drawn with the result.
    expect(screen.getByTestId('evidence-v2-sources-line')).toHaveTextContent(en.common.sourceClass.verify.development);
    expect(toastShown(evidenceEn.integrity.failToast.replace('{{id}}', id))).toBe(true);
    expect(toastShown(evidenceEn.integrity.passToast.replace('{{id}}', id))).toBe(false);
    expect(screen.getByTestId('evidence-integrity-heading-FAIL')).toBeTruthy();
  });
});

// ── Fix pass F-M7 (review row 88, R88-07; decision D178) ─────────────────────────────────────────
describe('F-M7 R88-07: a development-key answer is said beside the result and on the signature line of the detail', () => {
  const answered = async (signature: unknown) => {
    const { b, id } = await openIntegrity('0001');
    b.fake.answerOnce('verifyEvidence', { status: 200, body: { ...RECORDED_VERIFY_V2.pass.body, evidenceId: id, at: b.fake.clock.now(), signature } });
    fireEvent.press(screen.getByTestId('evidence-verify'));
    await b.flush();
    await b.elapse(VERIFY_ASK_MS + 200);
  };

  it('the Core answers `developmentKey: true` on a PASS: the result carries the line, and so does the signature section - never a plain pass', async () => {
    await answered({ developmentKey: true });
    expect(drawn()).toMatchObject({ pass: true, report: true });
    expect(screen.getByTestId('evidence-v2-signing-key-DEVELOPMENT')).toHaveTextContent(en.evidence.verifyV2Key.development);
    expect(screen.getByTestId('evidence-signature-key-DEVELOPMENT')).toHaveTextContent('Signed with a DEVELOPMENT key — not a production signature');
  });

  it('CONTROL: `developmentKey: false` draws neither line', async () => {
    await answered({ developmentKey: false });
    expect(drawn()).toMatchObject({ pass: true, report: true });
    expect(screen.queryByTestId('evidence-v2-signing-key-DEVELOPMENT')).toBeNull();
    expect(screen.queryByTestId('evidence-signature-key-DEVELOPMENT')).toBeNull();
    expect(screen.queryByTestId('evidence-signature-key-NOT_ESTABLISHED')).toBeNull();
  });
});
