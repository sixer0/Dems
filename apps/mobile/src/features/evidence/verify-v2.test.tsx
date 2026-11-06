// Blueprint rows 87 (M7-W6) and 92 (M8-W3): the v2 verify view of the mobile app — the reader (`verify-v2.ts`) and the
// report it draws (`verify-v2-report.tsx`). The answers are RECORDED from the real verifier of row 85
// (`testing/verify-v2-recorded.ts`); the web console holds the same cases for its own copy.
//
// | What is held | Where |
// |--------------|-------|
// | The reader takes the answer of operation 41 as it is since row 141 (15 checks, `sources`), and an answer without the report members; absent = nothing extra | "the reader" |
// | The source line is FIRST: development with its entries, declared production, "not trustworthy" for `null` / unreadable; nothing without `sources`; never production by default (M7-DEVSRC-EVID-T / -P, software part) | "the source line" |
// | Nothing is a pass by default; a FAIL never reads as passed | "never a pass by default" |
// | A malformed report member is dropped and named, never guessed | "malformed report members" |
// | The tamper demo on ONE fragment names exactly that fragment (M7-TP-1, spec §F.3) | "the tamper demo" |
// | The transcript-state lines are row 119's fixed lines | "the wording" |
// | The report: rows, the fragment, the checks, the state; plain views, no Reanimated (E-13) | "the report" |
// | Row 206 (M3-15, G-11, D163): the reader's bounds follow the contract - 10 notices (one per code), 4 source lines (one per camera file, D60) | "row 206" |
// | Row 208 (M3-16 R3, E6, E9): AUDIO-0N rows are pair audio files; AUDIO_FILE_* worded under "Where it failed"; AUDIO_TRACKS_MISSING under `statementsTitle` | "row 208" |
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { render, screen, within } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { I18nextProvider } from 'react-i18next';
import { EvidenceVerifyResultSchema, VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE, VERIFY_REPORT_SKIP_REASONS, VERIFY_REPORT_SOURCE_CLASSES } from '@dems/shared/api';
import * as sharedRules from '@dems/shared/evidence-rules';
import { VIDEO_TRACK_IDS } from '@dems/shared/domain';
import { SOURCES_STATE_REPORT, TRANSCRIPT_STATE_REPORT, VERIFY_NOTICE, VERIFY_V2_CHECKS } from '@dems/shared/evidence-verify';
import { en } from '@dems/shared/i18n';
import { DEMO_TAMPERED_EVIDENCE_SEQ, DEMO_TAMPERED_FRAGMENT_SEQ, DEMO_TAMPERED_FRAGMENT_TRACK, DEMO_TAMPERED_TRACK } from '@dems/shared/sim';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { RECORDED_VERIFY_V2, type RecordedVerifyName } from './testing/verify-v2-recorded';
import { RECORDED_VERIFY_V2_D5 } from './testing/verify-v2-recorded-d5';
import {
  V2_FILE_PART_CHECK,
  V2_KNOWN_CHECK_IDS,
  V2_SOURCES_LINE,
  V2_TRANSCRIPT_STATES,
  readVerifyV2,
  v2CheckName,
  v2FailedNames,
  v2FileFindingLine,
  v2FileLabel,
  v2FilePartOutcome,
  v2FragmentLine,
  v2Rows,
  verdictOfAnswer,
  type VerifyV2Answer,
} from './verify-v2';
import { VerifyV2Report } from './verify-v2-report';

const V2 = en.evidence.verifyV2;
const t = i18n.t.bind(i18n);
const SPEC_LINE = 'VIDEO-02 fragment 3 tampered (stored-bytes hash mismatch; chain broken from fragment 3)';

const REPORT_MEMBERS = ['overall', 'interrupted', 'checks', 'fragments', 'failedFragmentCount', 'transcriptState', 'sources'] as const;
const DEVELOPMENT_LINE = 'DEVELOPMENT SOURCES — this package was not recorded from production devices.';
const UNTRUSTED_LINE = 'Sources: not trustworthy — the manifest was altered';
const PRODUCTION_LINE = 'Sources: declared as production devices by the Core that sealed this package.';

/** The answer of operation 41 as the Core sends it for a v2 item: the file rows and the whole report. */
const withPending = (name: RecordedVerifyName): Record<string, unknown> => ({ ...RECORDED_VERIFY_V2[name].body });
/** The same answer without the report members (a Core before row 141): every one of them is optional. */
function today(name: RecordedVerifyName): Record<string, unknown> {
  const body = withPending(name);
  for (const member of REPORT_MEMBERS) delete body[member];
  return body;
}
const read = (answer: unknown): VerifyV2Answer => {
  const result = readVerifyV2(answer);
  if (result === null) throw new Error('not a v2 answer');
  return result;
};

beforeEach(() => resetMissingKeys());
afterEach(() => expect(getMissingKeys()).toEqual([]));

describe('the recorded answers are what the contract carries', () => {
  it('every recorded answer parses with the registry schema of operation 41, with the report members and without them', () => {
    for (const name of Object.keys(RECORDED_VERIFY_V2) as RecordedVerifyName[]) {
      expect(EvidenceVerifyResultSchema.safeParse(withPending(name)).success).toBe(true);
      expect(EvidenceVerifyResultSchema.safeParse(today(name)).success).toBe(true);
    }
    // CONTROL: the schema is strict, so a member it does not know does not parse.
    expect(EvidenceVerifyResultSchema.safeParse({ ...withPending('pass'), sourcesOk: true }).success).toBe(false);
  });
});

describe('the reader', () => {
  it('a v1 answer (no `files`) is not a v2 answer: the caller keeps the v1 view', () => {
    expect(readVerifyV2({ evidenceId: 'EV-1', ok: true, at: 1, tracks: [], manifestOk: true, signatureOk: true })).toBeNull();
    expect(readVerifyV2(null)).toBeNull();
    expect(readVerifyV2('PASS')).toBeNull();
  });

  it("without the report members, PASS: both camera files with their three parts, the transcript, the manifest, the signature; nothing extra", () => {
    const answer = read(today('pass'));
    expect(answer.verdict).toBe('PASS');
    expect(v2Rows(answer).map((row) => [row.id, row.ok])).toEqual([
      ['file:VIDEO-01', true],
      ['file:VIDEO-02', true],
      ['transcript', true],
      ['manifest', true],
      ['signature', true],
    ]);
    expect([answer.overall, answer.interrupted, answer.checks, answer.transcriptState, answer.sources, answer.failedFragmentCount]).toEqual([null, null, null, null, null, null]);
    expect(answer.failedFragments).toEqual([]);
    expect(answer.malformed).toEqual([]);
  });

  it('with the report members: the 15 checks in order, the class, the transcript state, the fragment count', () => {
    const answer = read(withPending('pass'));
    expect(answer.checks?.map((check) => check.id)).toEqual([...V2_KNOWN_CHECK_IDS]);
    expect(answer.checks?.every((check) => check.status === 'PASS')).toBe(true);
    expect([answer.overall, answer.interrupted, answer.transcriptState, answer.failedFragmentCount]).toEqual(['PASS', false, 'READY', 0]);
    expect(answer.checks).toHaveLength(15);
    expect(answer.malformed).toEqual([]);
  });

  it('a package without a transcript document: no transcript row is invented; the state says why', () => {
    const answer = read(withPending('disabled'));
    expect(answer.verdict).toBe('PASS');
    expect(v2Rows(answer).map((row) => row.id)).toEqual(['file:VIDEO-01', 'file:VIDEO-02', 'manifest', 'signature']);
    expect(answer.transcriptState).toBe('DISABLED_BY_CONFIGURATION');
  });

  it("V-15 is named by the verifier's wording; a check this reader does not know is kept and named by its ID; the third skip reason is read", () => {
    const base = withPending('pass');
    const checks = [...(base.checks as unknown[]), { id: 'V-16', name: 'Not known here', status: 'SKIPPED', failureClass: null, skipped: 'OUT_OF_SCOPE', findings: [] }];
    const answer = read({ ...base, checks });
    expect(answer.checks).toHaveLength(16);
    expect(answer.checks?.at(-1)).toMatchObject({ id: 'V-16', status: 'SKIPPED', skipped: 'OUT_OF_SCOPE' });
    expect(v2CheckName('V-16', t)).toBe('V-16');
    expect(v2CheckName('V-15', t)).toBe('V-15 · Source class');
    expect(v2CheckName('V-04', t)).toBe(`V-04 · ${V2.checks['V-04']}`);
    expect(answer.malformed).toEqual([]);
  });
});

describe('the source line (R-11; spec §D.1; M7-DEVSRC-EVID-T / -P, software part)', () => {
  it('a development package: the state, one entry per camera file and per audio interval; the verdict is unchanged', () => {
    const answer = read(withPending('development'));
    expect(answer.verdict).toBe('PASS');
    expect(answer.sources).toEqual({
      state: 'DEVELOPMENT',
      tracks: [
        { trackId: 'VIDEO-01', deviceId: 'CAM-03', sourceClass: 'LOCAL_DEVICE' },
        { trackId: 'VIDEO-02', deviceId: 'CAM-02', sourceClass: 'FAKE' },
      ],
      audioIntervals: [
        { seq: 1, micDeviceId: 'MIC-03', sourceClass: 'LOCAL_DEVICE' },
        { seq: 2, micDeviceId: 'MIC-02', sourceClass: 'FAKE' },
      ],
    });
    const tampered = read(withPending('tamperedFragment'));
    expect([tampered.verdict, tampered.sources?.state]).toEqual(['FAIL', 'DEVELOPMENT']);
  });

  it('declared production; an edited mark is "not trustworthy" and repeats no class; no `sources` member is null', () => {
    const production = read(withPending('production'));
    expect(production.sources?.state).toBe('DECLARED_PRODUCTION');
    expect(production.sources?.tracks.map((track) => track.sourceClass)).toEqual(['PRODUCTION', 'PRODUCTION']);
    const untrusted = read(withPending('untrusted'));
    expect(untrusted.verdict).toBe('FAIL');
    expect(untrusted.sources).toEqual({ state: 'NOT_TRUSTWORTHY', tracks: [], audioIntervals: [] });
    expect(untrusted.malformed).toEqual([]);
    expect(read(today('pass')).sources).toBeNull();
  });

  it('NEVER production by default: every unclear block reads NOT TRUSTWORTHY and is named', () => {
    const production = withPending('production').sources as Record<string, unknown>;
    const development = withPending('development').sources as Record<string, unknown>;
    const cases: [string, unknown][] = [
      ['null', null],
      ['a text', 'DECLARED_PRODUCTION'],
      ['production code with development null', { ...production, development: null }],
      ['production code with development true', { ...production, development: true }],
      ['development code with development false', { ...development, development: false }],
      ['an unknown code', { ...production, code: 'PRODUCTION' }],
      ['no development member', { ok: true, code: 'DECLARED_PRODUCTION', tracks: [], audioIntervals: [] }],
      ['production that lists a FAKE track', { ...production, tracks: [{ trackId: 'VIDEO-01', deviceId: 'CAM-02', sourceClass: 'FAKE' }] }],
      ['an unknown class', { ...production, tracks: [{ trackId: 'VIDEO-01', deviceId: 'CAM-07', sourceClass: 'REAL' }] }],
      ['an entry that cannot be read', { ...development, audioIntervals: [{ seq: 1 }] }],
      ['tracks that are no list', { ...production, tracks: 'none' }],
      ['NOT_TRUSTWORTHY that still claims a value', { ok: true, code: 'NOT_TRUSTWORTHY', development: false, tracks: [], audioIntervals: [] }],
    ];
    for (const [, sources] of cases) {
      const answer = read({ ...withPending('production'), sources });
      expect(answer.sources?.state).toBe('NOT_TRUSTWORTHY');
      expect(answer.sources?.tracks).toEqual([]);
      expect(answer.malformed).toContain('sources');
      // The source line says nothing of the verdict: the Core's `ok` stands.
      expect(answer.verdict).toBe('PASS');
    }
    // CONTROL: the untouched block is read as declared production, and UNKNOWN with null is not "malformed".
    expect(read(withPending('production')).malformed).toEqual([]);
    const unknown = read({ ...withPending('production'), sources: { ok: false, code: 'UNKNOWN', development: null, report: 'x', tracks: [], audioIntervals: [] } });
    expect([unknown.sources?.state, unknown.malformed]).toEqual(['NOT_TRUSTWORTHY', []]);
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

describe('malformed report members', () => {
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
      ['failedFragmentCount', { failedFragmentCount: 'one' }],
      ['sources', { sources: [] }],
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

  it('an answer without the report members does not name the fragment: the file fails and nothing is invented', () => {
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
    expect(V2_KNOWN_CHECK_IDS).toHaveLength(15);
    for (const check of VERIFY_V2_CHECKS) expect(V2.checks[check.id]).toBe(check.name);
    expect(V2.checks['V-15']).toBe('Source class');
  });

  it("the source lines are the verifier's own (`SOURCES_STATE_REPORT`); every skip reason and source class of the contract has a word", () => {
    expect(t(V2_SOURCES_LINE.DEVELOPMENT)).toBe(SOURCES_STATE_REPORT.DEVELOPMENT);
    expect(t(V2_SOURCES_LINE.DEVELOPMENT)).toBe(DEVELOPMENT_LINE);
    expect(t(V2_SOURCES_LINE.DECLARED_PRODUCTION)).toBe(SOURCES_STATE_REPORT.DECLARED_PRODUCTION);
    expect(t(V2_SOURCES_LINE.NOT_TRUSTWORTHY)).toBe(SOURCES_STATE_REPORT.NOT_TRUSTWORTHY);
    expect(Object.keys(V2.skipped).sort()).toEqual([...VERIFY_REPORT_SKIP_REASONS].sort());
    expect(Object.keys(en.evidence.sources.kind).sort()).toEqual([...VERIFY_REPORT_SOURCE_CLASSES].sort());
  });
});

describe('the report (M7-VV-PHONE, software part)', () => {
  const draw = (answer: VerifyV2Answer) =>
    render(
      <I18nextProvider i18n={i18n}>
        <VerifyV2Report answer={answer} />
      </I18nextProvider>,
    );

  /** The test ID of the first thing drawn inside the result (compared as a text: an instance is never handed to `expect`). */
  const firstChildId = (rootId: string): unknown => {
    let node = screen.getByTestId(rootId).children[0];
    // The first child is the component; its own first host view carries the test ID.
    while (typeof node === 'object' && (node.props as { testID?: string }).testID === undefined) node = node.children[0];
    return typeof node === 'object' ? (node.props as { testID?: string }).testID : node;
  };

  it('PASS: the five rows, the 15 checks, the transcript state; no fragment block', () => {
    draw(read(withPending('pass')));
    expect(screen.getByTestId('evidence-verify-v2-PASS')).toBeTruthy();
    for (const id of ['file:VIDEO-01', 'file:VIDEO-02', 'transcript', 'manifest', 'signature']) expect(screen.getByTestId(`evidence-v2-row-${id}-ok`)).toBeTruthy();
    for (const id of V2_KNOWN_CHECK_IDS) expect(screen.getByTestId(`evidence-v2-check-${id}-PASS`)).toBeTruthy();
    expect(screen.getByTestId('evidence-v2-checks')).toHaveTextContent(/15 of 15 checks passed/);
    expect(screen.getByTestId('evidence-v2-check-V-15-PASS')).toHaveTextContent(/V-15 · Source class/);
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

  // Batch N (final code review R101-03; ruling D241): the outcome of a part of a file row is the SHARED rule's
  // (`@dems/shared/evidence-rules`, vectors in packages/shared/test/evidence-verify.test.ts). This view words it.
  it('R101-03: the file rows draw the SHARED outcome of every part - the function is the shared one, and each drawn word follows it (contract example; every part\'s check skipped; no report)', () => {
    expect(v2FilePartOutcome).toBe(sharedRules.v2FilePartOutcome);
    expect(V2_FILE_PART_CHECK).toBe(sharedRules.V2_FILE_PART_CHECK);
    const word = { PASS: V2.outcome.PASS, FAIL: V2.outcome.FAIL, NOT_RUN: V2.outcome.SKIPPED } as const;
    expect(word.NOT_RUN).toBe('Not run');
    const check = (id: string, status: 'PASS' | 'FAIL' | 'SKIPPED') => ({ id, name: id, status, failureClass: status === 'FAIL' ? 'TAMPERED' : null, skipped: status === 'SKIPPED' ? 'BLOCKED' : null, findings: [] });
    const reports = [
      undefined,
      [check('V-04', 'FAIL'), check('V-05', 'SKIPPED'), check('V-06', 'FAIL')],
      [check('V-04', 'FAIL'), check('V-05', 'SKIPPED'), check('V-06', 'SKIPPED')],
      [check('V-04', 'SKIPPED'), check('V-05', 'SKIPPED'), check('V-06', 'SKIPPED')],
    ];
    for (const checks of reports) {
      const answer = read({ ok: false, at: 1_790_824_000_000, files: VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE, manifestOk: true, signatureOk: true, ...(checks === undefined ? {} : { checks }) });
      const drawn = draw(answer);
      for (const file of answer.files) {
        const expected = (['stored', 'plain', 'chain'] as const).map((part) => sharedRules.v2FilePartOutcome(file, part, answer.checks));
        const line = `Stored bytes ${word[expected[0] ?? 'FAIL']} · decrypted bytes ${word[expected[1] ?? 'FAIL']} · fragment chain ${word[expected[2] ?? 'FAIL']}`;
        expect(screen.getByTestId(`evidence-v2-row-file:${file.trackId}-${file.ok ? 'ok' : 'fail'}`)).toHaveTextContent(new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
      drawn.unmount();
    }
    // The case the two clients disagreed on, by its words: V-06 skipped reads "fragment chain Not run", never "FAIL".
    draw(read({ ok: false, at: 1_790_824_000_000, files: VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE, manifestOk: true, signatureOk: true, checks: reports[2] }));
    expect(screen.getByTestId('evidence-v2-row-file:VIDEO-02-fail')).toHaveTextContent(/Stored bytes FAIL · decrypted bytes Not run · fragment chain Not run/);
    expect(screen.getByTestId('evidence-v2-row-file:VIDEO-01-ok')).toHaveTextContent(/Stored bytes PASS · decrypted bytes PASS · fragment chain PASS/);
  });

  it('an answer without the report members: the file fails, the report says the answer names no fragment, and draws no check list and no source line', () => {
    draw(read(today('tamperedFragment')));
    expect(screen.getByTestId('evidence-v2-fragment-not-named')).toHaveTextContent(V2.fragment.notNamed);
    expect(screen.queryByTestId('evidence-v2-fragments')).toBeNull();
    expect(screen.queryByTestId('evidence-v2-checks')).toBeNull();
    expect(screen.queryByTestId(/^evidence-v2-sources-/)).toBeNull();
  });

  it('the development line is the FIRST thing of the result, with its entries, on a PASS verdict; it is no control', () => {
    draw(read(withPending('development')));
    const line = screen.getByTestId('evidence-v2-sources-DEVELOPMENT');
    expect(firstChildId('evidence-verify-v2-PASS')).toBe('evidence-v2-sources-DEVELOPMENT');
    expect(screen.getByTestId('evidence-v2-sources-line')).toHaveTextContent(DEVELOPMENT_LINE);
    expect(line.props.onPress).toBeUndefined();
    expect(line.props.accessibilityRole).toBe('text');
    expect(screen.getByTestId('evidence-v2-source-track-VIDEO-01')).toHaveTextContent('VIDEO-01: CAM-03 · Local device of the Core Mac');
    expect(screen.getByTestId('evidence-v2-source-track-VIDEO-02')).toHaveTextContent('VIDEO-02: CAM-02 · Test source');
    expect(screen.getByTestId('evidence-v2-source-interval-1')).toHaveTextContent('Audio interval 1: MIC-03 · Local device of the Core Mac');
    expect(screen.getByTestId('evidence-v2-source-interval-2')).toHaveTextContent('Audio interval 2: MIC-02 · Test source');
  });

  it('declared production: the declared line first, no entries; an edited mark: "not trustworthy" on a FAIL verdict with V-03 failed', () => {
    const first = draw(read(withPending('production')));
    expect(firstChildId('evidence-verify-v2-PASS')).toBe('evidence-v2-sources-DECLARED_PRODUCTION');
    expect(screen.getByTestId('evidence-v2-sources-DECLARED_PRODUCTION')).toHaveTextContent(PRODUCTION_LINE);
    expect(screen.queryByTestId('evidence-v2-source-entries')).toBeNull();
    first.unmount();
    draw(read(withPending('untrusted')));
    expect(firstChildId('evidence-verify-v2-FAIL')).toBe('evidence-v2-sources-NOT_TRUSTWORTHY');
    expect(screen.getByTestId('evidence-v2-sources-line')).toHaveTextContent(UNTRUSTED_LINE);
    expect(screen.queryByTestId('evidence-v2-source-entries')).toBeNull();
    expect(screen.getByTestId('evidence-v2-check-V-03-FAIL')).toBeTruthy();
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

describe('row 206 (M3-15; G-11, D163): the bounds of the reader follow the contract - 10 notices, 4 source lines (D60 domino)', () => {
  // RECORDED answers of the real verifier over row 154's D5 builder, COPIED from the web's RECORDED_VERIFY_V2_D5
  // (row 159, R159-7) into testing/verify-v2-recorded-d5.ts. Nothing here is hand-written except the edits each case names.
  //
  // | Rule | Test |
  // |------|------|
  // | The copied D5 answers are what the contract carries | 1 |
  // | G-11: the recorded 4-camera answer reads its 4 source lines (DEVELOPMENT), nothing is malformed; before row 206 it read NOT_TRUSTWORTHY + malformed 'sources' | 2 |
  // | E4: 4 lines DECLARED_PRODUCTION are read, 'sources' is not malformed; a fifth line is malformed and NOT_TRUSTWORTHY | 3 |
  // | E3: 10 notices (one per VERIFY_NOTICE code) are read whole; an eleventh is malformed; the contract holds the same bound | 4 |
  const D5 = RECORDED_VERIFY_V2_D5;
  type SourcesBlock = { tracks: Record<string, unknown>[]; audioIntervals: Record<string, unknown>[] } & Record<string, unknown>;
  const d5Sources = (): SourcesBlock => JSON.parse(JSON.stringify(D5.d5Pass.body.sources)) as SourcesBlock;

  it('1 - the copied D5 answers are what the contract carries', () => {
    expect(Object.keys(D5)).toEqual(['d5Pass', 'd5MicMissing', 'd5AudioFileMissing']);
    for (const [name, recorded] of Object.entries(D5)) expect([name, EvidenceVerifyResultSchema.safeParse(recorded.body).success]).toEqual([name, true]);
  });

  it('2 - G-11: the recorded 4-camera answer reads its four source lines; nothing is malformed', () => {
    const answer = read(D5.d5Pass.body);
    expect(answer.malformed).toEqual([]);
    expect(answer.verdict).toBe('PASS');
    expect(answer.sources?.state).toBe('DEVELOPMENT');
    expect(answer.sources?.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04']);
  });

  it('3 - E4: four lines declared PRODUCTION are read as such; a fifth line is malformed and never production', () => {
    // EDIT of the recorded d5Pass block (no builder seals PRODUCTION sources): its four recorded lines keep their track
    // and device ids, the class becomes PRODUCTION, and code / development / report are the recorded `production` answer's.
    const production = RECORDED_VERIFY_V2.production.body.sources as Record<string, unknown>;
    const block = d5Sources();
    const declared: SourcesBlock = {
      ...block,
      code: production.code,
      development: production.development,
      report: production.report,
      tracks: block.tracks.map((line) => ({ ...line, sourceClass: 'PRODUCTION' })),
      audioIntervals: block.audioIntervals.map((line) => ({ ...line, sourceClass: 'PRODUCTION' })),
    };
    expect([declared.code, declared.development, declared.tracks.length]).toEqual(['DECLARED_PRODUCTION', false, VIDEO_TRACK_IDS.length]);
    const four = read({ ...D5.d5Pass.body, sources: declared });
    expect(four.sources?.state).toBe('DECLARED_PRODUCTION');
    expect(four.sources?.tracks.map((track) => [track.trackId, track.sourceClass])).toEqual(VIDEO_TRACK_IDS.map((id) => [id, 'PRODUCTION']));
    expect(four.malformed).not.toContain('sources');
    // A fifth line (a copy of the first) is more lines than a package has camera files.
    const five = read({ ...D5.d5Pass.body, sources: { ...declared, tracks: [...declared.tracks, { ...declared.tracks[0] }] } });
    expect(five.sources).toEqual({ state: 'NOT_TRUSTWORTHY', tracks: [], audioIntervals: [] });
    expect(five.malformed).toContain('sources');
    expect(five.verdict).toBe('PASS');
  });

  it('4 - E3: ten notices, one per code, are read whole; an eleventh entry is malformed; the contract holds the same bound', () => {
    const codes = Object.values(VERIFY_NOTICE);
    expect(codes).toHaveLength(10);
    const all = codes.map((code) => ({ code, report: `The ${code} line.` }));
    const whole = read({ ...D5.d5MicMissing.body, notices: all });
    expect(whole.malformed).not.toContain('notices');
    expect(whole.notices.map((notice) => notice.code)).toEqual(codes);
    const eleven = [...all, all[0]];
    expect(read({ ...D5.d5MicMissing.body, notices: eleven }).malformed).toContain('notices');
    // The reader's 10 is the contract's `.max(10)` (shared api/evidence.ts): 10 parse, 11 do not.
    expect(EvidenceVerifyResultSchema.safeParse({ ...D5.d5MicMissing.body, notices: all }).success).toBe(true);
    expect(EvidenceVerifyResultSchema.safeParse({ ...D5.d5MicMissing.body, notices: eleven }).success).toBe(false);
    // CONTROL: the recorded statement answer is read without loss.
    const recorded = read(D5.d5MicMissing.body);
    expect(recorded.malformed).toEqual([]);
    expect(recorded.notices.map((notice) => notice.code)).toContain('AUDIO_TRACKS_MISSING');
  });
});

describe('row 208 (M3-16 R3; E6, E9): pair audio files, the AUDIO_FILE_* findings and the missing-microphone statement in the verify report', () => {
  // RECORDED answers (testing/verify-v2-recorded-d5.ts, row 206's byte-equal copy of the web's RECORDED_VERIFY_V2_D5, R159-7).
  // The web holds the same rules in its row 159 describe; the sentences are the SHARED catalogue's (E6), quoted verbatim here.
  //
  // | Rule | Test |
  // |------|------|
  // | 4+4: eight file rows; an AUDIO-0N row reads "AUDIO-0N audio file · in VIDEO-0N", never a camera file (E6 `audioFile`) | 1 |
  // | An audio row whose camera file is not listed names its pair (E6 `audioFileNoCamera`) | 2 |
  // | AUDIO_FILE_MISSING: FAIL, "The audio file AUDIO-03 of Pair 3 is missing from the package." under "Where it failed"; no "fragment not named" line | 3 |
  // | AUDIO_FILE_UNREADABLE: "... is in the package but could not be read." under "Where it failed" | 4 |
  // | E9: AUDIO_TRACKS_MISSING is listed under "Stated in the signed manifest" (`statementsTitle`), NOT under "Not covered by the package signature" | 5 |
  // | LEGACY: a /2 answer has no audio row, no file finding, no statement; a notice of it stays under "Not covered" | 6 |
  const D5 = RECORDED_VERIFY_V2_D5;
  const AUDIO_FILE_MISSING_LINE = 'The audio file AUDIO-03 of Pair 3 is missing from the package.';
  const AUDIO_FILE_UNREADABLE_LINE = 'The audio file AUDIO-03 of Pair 3 is in the package but could not be read.';
  const MIC_MISSING_REPORT = 'Audio: 1 PAIR MICROPHONE NOT RECORDED. AUDIO-02 not assigned, VIDEO-02 silent. Its silent track is no sound of the room.';
  const draw = (answer: VerifyV2Answer) =>
    render(
      <I18nextProvider i18n={i18n}>
        <VerifyV2Report answer={answer} />
      </I18nextProvider>,
    );
  const rowIds = (): string[] =>
    within(screen.getByTestId('evidence-v2-rows'))
      .getAllByTestId(/^evidence-v2-row-/)
      .map((node) => String(node.props.testID));

  it('1 - the 4+4 package: PASS, eight file rows, each AUDIO-0N "in VIDEO-0N"; no finding, no statement', () => {
    const answer = read(D5.d5Pass.body);
    expect(answer.malformed).toEqual([]);
    expect(answer.fileFindings).toEqual([]);
    draw(answer);
    expect(rowIds().slice(0, 8)).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'].map((id) => `evidence-v2-row-file:${id}-ok`));
    expect(within(screen.getByTestId('evidence-v2-row-file:VIDEO-03-ok')).getByText('VIDEO-03 file')).toBeTruthy();
    for (const n of [1, 2, 3, 4]) {
      expect(within(screen.getByTestId(`evidence-v2-row-file:AUDIO-0${n}-ok`)).getByText(`AUDIO-0${n} audio file · in VIDEO-0${n}`)).toBeTruthy();
      expect(within(screen.getByTestId(`evidence-v2-row-file:AUDIO-0${n}-ok`)).queryByText(`AUDIO-0${n} file`)).toBeNull();
    }
    expect(screen.queryByTestId('evidence-v2-file-findings')).toBeNull();
    expect(screen.queryByTestId('evidence-v2-statements')).toBeNull();
  });

  it('2 - an audio row whose camera file the answer does not list names its pair instead; a camera row keeps its words', () => {
    expect(v2FileLabel({ trackId: 'AUDIO-03' }, { files: [] }, t)).toBe('AUDIO-03 audio file · Pair 3');
    expect(v2FileLabel({ trackId: 'VIDEO-03' }, { files: [] }, t)).toBe('VIDEO-03 file');
  });

  it('3 - AUDIO_FILE_MISSING: FAIL, the sentence verbatim under "Where it failed", and no "fragment not named" line', () => {
    const answer = read(D5.d5AudioFileMissing.body);
    expect(answer.verdict).toBe('FAIL');
    expect(answer.fileFindings).toEqual([{ code: 'AUDIO_FILE_MISSING', trackId: 'AUDIO-03' }]);
    // The sentence is the shared catalogue's (E6), not a mobile copy.
    expect(V2.fileFinding.AUDIO_FILE_MISSING).toBe('The audio file {{track}} of Pair {{pair}} is missing from the package.');
    expect(v2FileFindingLine(answer.fileFindings[0]!, t)).toBe(AUDIO_FILE_MISSING_LINE);
    draw(answer);
    expect(screen.getByTestId('evidence-v2-row-file:AUDIO-03-fail')).toBeTruthy();
    const block = screen.getByTestId('evidence-v2-file-findings');
    expect(within(block).getByText(V2.fragment.title)).toBeTruthy();
    expect(V2.fragment.title).toBe('Where it failed');
    expect(screen.getByTestId('evidence-v2-file-finding-AUDIO-03-AUDIO_FILE_MISSING')).toHaveTextContent(AUDIO_FILE_MISSING_LINE);
    expect(screen.queryByTestId('evidence-v2-fragment-not-named')).toBeNull();
  });

  it('4 - AUDIO_FILE_UNREADABLE is worded as a file that is there and could not be read, under "Where it failed"', () => {
    // EDIT of the recorded d5AudioFileMissing answer (no builder seals an unreadable audio file): V-04's AUDIO finding becomes UNREADABLE.
    const body = JSON.parse(JSON.stringify(D5.d5AudioFileMissing.body)) as { checks: { id: string; findings: { code: string; failureClass: string }[] }[] };
    const v04 = body.checks.find((check) => check.id === 'V-04');
    if (v04 === undefined) throw new Error('no V-04');
    v04.findings = v04.findings.map((finding) => (finding.code === 'AUDIO_FILE_MISSING' ? { ...finding, code: 'AUDIO_FILE_UNREADABLE', failureClass: 'UNREADABLE' } : finding));
    const answer = read(body);
    expect(answer.fileFindings).toEqual([{ code: 'AUDIO_FILE_UNREADABLE', trackId: 'AUDIO-03' }]);
    draw(answer);
    expect(within(screen.getByTestId('evidence-v2-file-findings')).getByText(V2.fragment.title)).toBeTruthy();
    expect(screen.getByTestId('evidence-v2-file-finding-AUDIO-03-AUDIO_FILE_UNREADABLE')).toHaveTextContent(AUDIO_FILE_UNREADABLE_LINE);
  });

  it('5 - E9: AUDIO_TRACKS_MISSING is listed under "Stated in the signed manifest" with the Core\'s own line, not under "Not covered"', () => {
    const answer = read(D5.d5MicMissing.body);
    expect(answer.verdict).toBe('PASS');
    expect(answer.files.map((file) => file.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-03', 'AUDIO-04']);
    draw(answer);
    const statements = screen.getByTestId('evidence-v2-statements');
    expect(V2.statementsTitle).toBe('Stated in the signed manifest');
    expect(within(statements).getByText(V2.statementsTitle)).toBeTruthy();
    expect(within(statements).getByTestId('evidence-v2-notice-AUDIO_TRACKS_MISSING')).toHaveTextContent(MIC_MISSING_REPORT);
    const notCovered = screen.getByTestId('evidence-v2-notices');
    expect(within(notCovered).getByText(en.evidence.verifyV2Key.noticesTitle)).toBeTruthy();
    expect(within(notCovered).queryByTestId('evidence-v2-notice-AUDIO_TRACKS_MISSING')).toBeNull();
    expect(within(notCovered).getByTestId('evidence-v2-notice-AUDIT_EXTRACT_NOT_SIGNED')).toBeTruthy();
    // Drawn once: the statement is not ALSO listed among what the signature does not cover.
    expect(screen.getAllByTestId('evidence-v2-notice-AUDIO_TRACKS_MISSING')).toHaveLength(1);
  });

  it('6 - LEGACY: a /2 answer has no audio row, no file finding and no statement; its notice stays under "Not covered"', () => {
    const answer = read({ ...withPending('pass'), notices: [{ code: 'AUDIT_EXTRACT_NOT_SIGNED', report: 'Audit extract: present, NOT covered by the package signature.' }] });
    expect(answer.fileFindings).toEqual([]);
    draw(answer);
    expect(within(screen.getByTestId('evidence-v2-row-file:VIDEO-01-ok')).getByText('VIDEO-01 file')).toBeTruthy();
    expect(within(screen.getByTestId('evidence-v2-row-file:VIDEO-02-ok')).getByText('VIDEO-02 file')).toBeTruthy();
    expect(rowIds().some((id) => id.includes('AUDIO-0'))).toBe(false);
    expect(screen.queryByTestId('evidence-v2-file-findings')).toBeNull();
    expect(screen.queryByTestId('evidence-v2-statements')).toBeNull();
    expect(within(screen.getByTestId('evidence-v2-notices')).getByTestId('evidence-v2-notice-AUDIT_EXTRACT_NOT_SIGNED')).toBeTruthy();
  });
});
