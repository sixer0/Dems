// Blueprint row 87 (M7-W6): the v2 verify view of the mobile app — the reader (`verify-v2.ts`) and the
// report it draws (`verify-v2-report.tsx`). The answers are RECORDED from the real verifier of row 85
// (`testing/verify-v2-recorded.ts`); the web console holds the same cases for its own copy.
//
// | What is held | Where |
// |--------------|-------|
// | The reader takes the contract of TODAY and the pending members; absent = nothing extra | "the reader" |
// | Nothing is a pass by default; a FAIL never reads as passed | "never a pass by default" |
// | A malformed pending member is dropped and named, never guessed | "malformed pending members" |
// | The tamper demo on ONE fragment names exactly that fragment (M7-TP-1, spec §F.3) | "the tamper demo" |
// | The transcript-state lines are row 119's fixed lines | "the wording" |
// | The report: rows, the fragment, the checks, the state; plain views, no Reanimated (E-13) | "the report" |
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { I18nextProvider } from 'react-i18next';
import { EvidenceVerifyResultSchema } from '@dems/shared/api';
import { TRANSCRIPT_STATE_REPORT, VERIFY_V2_CHECKS } from '@dems/shared/evidence-verify';
import { en } from '@dems/shared/i18n';
import { DEMO_TAMPERED_EVIDENCE_SEQ, DEMO_TAMPERED_FRAGMENT_SEQ, DEMO_TAMPERED_FRAGMENT_TRACK, DEMO_TAMPERED_TRACK } from '@dems/shared/sim';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { RECORDED_VERIFY_V2 } from './testing/verify-v2-recorded';
import {
  V2_KNOWN_CHECK_IDS,
  V2_TRANSCRIPT_STATES,
  readVerifyV2,
  v2CheckName,
  v2FailedNames,
  v2FragmentLine,
  v2Rows,
  verdictOfAnswer,
  type VerifyV2Answer,
} from './verify-v2';
import { VerifyV2Report } from './verify-v2-report';

const V2 = en.evidence.verifyV2;
const t = i18n.t.bind(i18n);
const SPEC_LINE = 'VIDEO-02 fragment 3 tampered (stored-bytes hash mismatch; chain broken from fragment 3)';

/** The answer of operation 41 once its schema gains the pending members: today's body plus the report's. */
function withPending(name: keyof typeof RECORDED_VERIFY_V2): Record<string, unknown> {
  const { body, report } = RECORDED_VERIFY_V2[name];
  return { ...body, overall: report.overall, interrupted: report.interrupted, checks: report.checks, fragments: report.fragments, transcriptState: report.transcriptState };
}
const today = (name: keyof typeof RECORDED_VERIFY_V2): Record<string, unknown> => ({ ...RECORDED_VERIFY_V2[name].body });
const read = (answer: unknown): VerifyV2Answer => {
  const result = readVerifyV2(answer);
  if (result === null) throw new Error('not a v2 answer');
  return result;
};

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

describe('the recorded answers are what the contract carries today', () => {
  it('every `body` parses with the registry schema of operation 41, and the pending members do not (they are pending)', () => {
    for (const name of ['pass', 'tamperedFragment', 'disabled'] as const) {
      expect(EvidenceVerifyResultSchema.safeParse(today(name)).success).toBe(true);
      expect(EvidenceVerifyResultSchema.safeParse(withPending(name)).success).toBe(false);
    }
  });
});

describe('the reader', () => {
  it('a v1 answer (no `files`) is not a v2 answer: the caller keeps the v1 view', () => {
    expect(readVerifyV2({ evidenceId: 'EV-1', ok: true, at: 1, tracks: [], manifestOk: true, signatureOk: true })).toBeNull();
    expect(readVerifyV2(null)).toBeNull();
    expect(readVerifyV2('PASS')).toBeNull();
  });

  it("today's contract, PASS: both camera files with their three parts, the transcript, the manifest, the signature; nothing extra", () => {
    const answer = read(today('pass'));
    expect(answer.verdict).toBe('PASS');
    expect(v2Rows(answer).map((row) => [row.id, row.ok])).toEqual([
      ['file:VIDEO-01', true],
      ['file:VIDEO-02', true],
      ['transcript', true],
      ['manifest', true],
      ['signature', true],
    ]);
    expect([answer.overall, answer.interrupted, answer.checks, answer.transcriptState]).toEqual([null, null, null, null]);
    expect(answer.failedFragments).toEqual([]);
    expect(answer.malformed).toEqual([]);
  });

  it('with the pending members: the 14 checks in order, the class, the transcript state', () => {
    const answer = read(withPending('pass'));
    expect(answer.checks?.map((check) => check.id)).toEqual([...V2_KNOWN_CHECK_IDS]);
    expect(answer.checks?.every((check) => check.status === 'PASS')).toBe(true);
    expect([answer.overall, answer.interrupted, answer.transcriptState]).toEqual(['PASS', false, 'READY']);
  });

  it('a package without a transcript document: no transcript row is invented; the state says why', () => {
    const answer = read(withPending('disabled'));
    expect(answer.verdict).toBe('PASS');
    expect(v2Rows(answer).map((row) => row.id)).toEqual(['file:VIDEO-01', 'file:VIDEO-02', 'manifest', 'signature']);
    expect(answer.transcriptState).toBe('DISABLED_BY_CONFIGURATION');
  });

  it('row 141 slot: a check this row does not know is kept and named by its ID; `sources` is not read', () => {
    const base = withPending('pass');
    const checks = [...(base.checks as unknown[]), { id: 'V-15', name: 'Source class', status: 'FAIL', failureClass: 'CORRUPT', skipped: null, findings: [] }];
    const answer = read({ ...base, checks, sources: { ok: false, development: true, tracks: [], audioIntervals: [] } });
    expect(answer.checks).toHaveLength(15);
    expect(answer.checks?.at(-1)).toMatchObject({ id: 'V-15', status: 'FAIL', failureClass: 'CORRUPT' });
    expect(v2CheckName('V-15', t)).toBe('V-15');
    expect(v2CheckName('V-04', t)).toBe(`V-04 · ${V2.checks['V-04']}`);
  });
});

describe('never a pass by default', () => {
  it('the verdict is PASS only for the boolean true (v2 and v1)', () => {
    for (const ok of [false, 'true', 1, null, undefined, {}, 'PASS']) expect(read({ ...today('pass'), ok }).verdict).toBe('FAIL');
    expect(read(today('pass')).verdict).toBe('PASS');
    expect(verdictOfAnswer({ ok: true }, null)).toBe('PASS');
    for (const ok of [false, 'true', 1, null, undefined]) expect(verdictOfAnswer({ ok }, null)).toBe('FAIL');
    expect(verdictOfAnswer(null, null)).toBe('FAIL');
  });

  it('a FAIL answer never reads PASS, whatever its rows say; a missing member is not passed; an unreadable file fails the verdict', () => {
    const failed = read({ ...today('pass'), ok: false });
    expect(verdictOfAnswer({ ...today('pass'), ok: false }, failed)).toBe('FAIL');
    const { manifestOk: _m, signatureOk: _s, ...without } = today('pass');
    expect([read(without).manifestOk, read(without).signatureOk]).toEqual([false, false]);
    expect(read({ ...today('pass'), files: [null] }).verdict).toBe('FAIL');
    expect(read({ ...today('pass'), files: [{ trackId: 'VIDEO-01', storedOk: 'yes', chainOk: true, ok: true }] }).files[0]).toMatchObject({ storedOk: false, plainOk: false, ok: false });
  });
});

describe('malformed pending members', () => {
  it('are dropped and named, and the rest of the answer is still drawn', () => {
    const base = withPending('tamperedFragment');
    const cases: [string, Record<string, unknown>][] = [
      ['checks', { checks: 'all passed' }],
      ['checks', { checks: [...(base.checks as unknown[]), { id: 'bogus', status: 'PASS' }] }],
      ['checks', { checks: [...(base.checks as unknown[]), (base.checks as unknown[])[0]] }],
      ['overall', { overall: 'FINE' }],
      ['interrupted', { interrupted: 'no' }],
      ['transcriptState', { transcriptState: { code: 'SEALED_AND_FINE' } }],
      ['fragments', { fragments: [{ trackId: 'VIDEO-02' }] }],
    ];
    for (const [member, patch] of cases) {
      const answer = read({ ...base, ...patch });
      expect(answer.malformed).toContain(member);
      expect(answer.verdict).toBe('FAIL');
      expect(answer.files).toHaveLength(2);
    }
    expect(read({ ...base, checks: [...(base.checks as unknown[]), { id: 'bogus', status: 'PASS' }] }).checks).toBeNull();
  });
});

describe('the tamper demo, re-scripted on ONE fragment (M7-TP-1; spec §F.2, §F.3)', () => {
  it('the script names one fragment of one camera file; the v1 packages keep their own tamper', () => {
    expect([DEMO_TAMPERED_EVIDENCE_SEQ, DEMO_TAMPERED_FRAGMENT_TRACK, DEMO_TAMPERED_FRAGMENT_SEQ, DEMO_TAMPERED_TRACK]).toEqual([5, 'VIDEO-02', 3, 'AUDIO-02']);
  });

  it('the real verifier, one byte of that fragment altered: exactly that fragment, the chain from it on, class TAMPERED, everything else passes', () => {
    const answer = read(withPending('tamperedFragment'));
    expect([answer.verdict, answer.overall]).toEqual(['FAIL', 'TAMPERED']);
    expect(answer.failedFragments).toEqual([
      { trackId: DEMO_TAMPERED_FRAGMENT_TRACK, seq: DEMO_TAMPERED_FRAGMENT_SEQ, reason: 'TAMPERED', storedMismatch: true, chainBrokenFromSeq: DEMO_TAMPERED_FRAGMENT_SEQ },
    ]);
    expect(answer.checks?.filter((check) => check.status === 'FAIL').map((check) => check.id)).toEqual(['V-04', 'V-06', 'V-08']);
    expect(answer.checks?.filter((check) => check.status === 'SKIPPED').map((check) => [check.id, check.skipped])).toEqual([['V-05', 'BLOCKED']]);
    expect(v2Rows(answer).filter((row) => !row.ok).map((row) => row.id)).toEqual(['file:VIDEO-02']);
    expect(v2FailedNames(answer, t)).toEqual(['VIDEO-02']);
    expect(v2FragmentLine(answer.failedFragments[0]!, t)).toBe(SPEC_LINE);
  });

  it("today's contract alone does not name the fragment: the file fails and nothing is invented", () => {
    const answer = read(today('tamperedFragment'));
    expect(answer.verdict).toBe('FAIL');
    expect(answer.failedFragments).toEqual([]);
    expect(answer.files[1]).toMatchObject({ trackId: 'VIDEO-02', storedOk: false, plainOk: false, chainOk: false, ok: false });
  });
});

describe('the wording', () => {
  it("the transcript-state lines are row 119's fixed lines; the check names are the verifier's", () => {
    expect(Object.keys(V2.transcriptState).sort()).toEqual([...V2_TRANSCRIPT_STATES].sort());
    for (const code of V2_TRANSCRIPT_STATES) expect(V2.transcriptState[code]).toBe(TRANSCRIPT_STATE_REPORT[code]);
    expect([...V2_KNOWN_CHECK_IDS]).toEqual(VERIFY_V2_CHECKS.map((check) => check.id));
    for (const check of VERIFY_V2_CHECKS) expect(V2.checks[check.id]).toBe(check.name);
  });
});

describe('the report (M7-VV-PHONE, software part)', () => {
  const draw = (answer: VerifyV2Answer) =>
    render(
      <I18nextProvider i18n={i18n}>
        <VerifyV2Report answer={answer} />
      </I18nextProvider>,
    );

  it('PASS: the five rows, the 14 checks, the transcript state; no fragment block', () => {
    draw(read(withPending('pass')));
    expect(screen.getByTestId('evidence-verify-v2-PASS')).toBeTruthy();
    for (const id of ['file:VIDEO-01', 'file:VIDEO-02', 'transcript', 'manifest', 'signature']) expect(screen.getByTestId(`evidence-v2-row-${id}-ok`)).toBeTruthy();
    for (const id of V2_KNOWN_CHECK_IDS) expect(screen.getByTestId(`evidence-v2-check-${id}-PASS`)).toBeTruthy();
    expect(screen.getByTestId('evidence-v2-checks')).toHaveTextContent(/14 of 14 checks passed/);
    expect(screen.getByTestId('evidence-v2-transcript-state-READY')).toHaveTextContent('Transcript sealed');
    expect(screen.getByTestId('evidence-v2-row-file:VIDEO-01-ok')).toHaveTextContent(/Stored bytes PASS · decrypted bytes PASS · fragment chain PASS · 5 fragments/);
    expect(screen.queryByTestId('evidence-v2-fragments')).toBeNull();
  });

  it('the tamper demo: the fragment by name, V-04 / V-06 / V-08 failed, V-05 not run, the transcript, signature and certificate PASS', () => {
    draw(read(withPending('tamperedFragment')));
    expect(screen.getByTestId('evidence-verify-v2-FAIL')).toBeTruthy();
    expect(screen.getByTestId('evidence-v2-fragment-VIDEO-02-3')).toHaveTextContent(SPEC_LINE);
    expect(screen.getByTestId('evidence-v2-row-file:VIDEO-02-fail')).toBeTruthy();
    expect(screen.queryByTestId('evidence-v2-row-file:VIDEO-02-ok')).toBeNull();
    for (const id of ['V-04', 'V-06', 'V-08']) expect(screen.getByTestId(`evidence-v2-check-${id}-FAIL`)).toBeTruthy();
    expect(screen.getByTestId('evidence-v2-check-V-05-SKIPPED')).toHaveTextContent(new RegExp(V2.skipped.BLOCKED));
    for (const id of ['V-09', 'V-10', 'V-11', 'V-13']) expect(screen.getByTestId(`evidence-v2-check-${id}-PASS`)).toBeTruthy();
  });

  it("today's contract alone: the file fails, the report says the answer names no fragment, and draws no check list", () => {
    draw(read(today('tamperedFragment')));
    expect(screen.getByTestId('evidence-v2-fragment-not-named')).toHaveTextContent(V2.fragment.notNamed);
    expect(screen.queryByTestId('evidence-v2-fragments')).toBeNull();
    expect(screen.queryByTestId('evidence-v2-checks')).toBeNull();
  });

  it('the transcript-state label, for each code the verifier reports', () => {
    for (const code of V2_TRANSCRIPT_STATES) {
      const view = draw(read({ ...withPending('disabled'), transcriptState: { code } }));
      expect(screen.getByTestId(`evidence-v2-transcript-state-${code}`)).toHaveTextContent(TRANSCRIPT_STATE_REPORT[code]);
      view.unmount();
    }
  });

  it('E-13 / E-15: the two files import no Reanimated, and a row keeps its 1 px border in both states', () => {
    for (const name of ['verify-v2.ts', 'verify-v2-report.tsx']) {
      const source = readFileSync(join(__dirname, name), 'utf8');
      expect(source).not.toMatch(/from 'react-native-reanimated'|\bAnimated\b\./);
      expect(source).not.toMatch(/setTimeout|setInterval|Date\.now/);
    }
    draw(read(withPending('tamperedFragment')));
    const border = (testID: string): unknown => {
      const style = screen.getByTestId(testID).props.style as unknown;
      const flat = (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style) as { borderWidth?: number };
      return flat.borderWidth;
    };
    expect([border('evidence-v2-row-file:VIDEO-01-ok'), border('evidence-v2-row-file:VIDEO-02-fail')]).toEqual([1, 1]);
  });
});
