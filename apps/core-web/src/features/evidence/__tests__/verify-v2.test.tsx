// Blueprint rows 87 (M7-W6) and 92 (M8-W3): the v2 verify view of the web console.
//
// | What is held | Where |
// |--------------|-------|
// | The reader takes the answer of operation 41 as it is since row 141 (15 checks, `sources`), and an answer without the report members; absent = nothing extra | "the reader" |
// | The source line is FIRST: development with its entries, declared production, "not trustworthy" for `null` / unreadable; nothing for an answer without `sources`; never production by default (M7-DEVSRC-EVID-W, software part) | "the source line" |
// | Nothing is a pass by default; a FAIL never reads as passed | "never a pass by default" |
// | A malformed report member is dropped and named, never guessed | "malformed pending members" |
// | The tamper demo on ONE fragment names exactly that fragment (M7-TP-1, spec §F.3) | "the tamper demo" |
// | The transcript-state lines are row 119's fixed lines | "the wording" |
// | The card: v2 rows instead of the six v1 rows; the per-check list; the pinned record line | "IntegrityTab" |
// | The v1 view is unchanged | "IntegrityTab › a v1 run" |
//
// The answers are RECORDED from the real verifier of row 85 (`fixtures/verify-v2-recorded.ts`).
// The Live path (operation 41 through the Live source) is `src/test/live-row87-verify-v2.test.tsx`.
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EvidenceVerifyResultSchema, VERIFY_REPORT_SKIP_REASONS, VERIFY_REPORT_SOURCE_CLASSES } from '@dems/shared/api'
import type { DemoCheckId } from '@dems/shared/demo-data'
import { SOURCES_STATE_REPORT, TRANSCRIPT_STATE_REPORT, VERIFY_V2_CHECKS } from '@dems/shared/evidence-verify'
import { en } from '@dems/shared/i18n'
import { DEMO_TAMPERED_EVIDENCE_SEQ, DEMO_TAMPERED_FRAGMENT_SEQ, DEMO_TAMPERED_FRAGMENT_TRACK, DEMO_TAMPERED_TRACK, OPERATOR_IDS, type EvidenceItem, type Sim } from '@dems/shared/sim'
import { withProviders } from '@/components/composed/__tests__/test-utils'
import { getMissingI18nKeys, i18n, resetMissingI18nKeys } from '@/i18n'
import { IntegrityTab } from '../integrity-tab'
import { buildEvidenceRow, type EvidenceRow } from '../model'
import type { EvidenceVerification, VerifyState } from '../use-verification'
import { isV2Item } from '../use-verification'
import {
  V2_KNOWN_CHECK_IDS,
  V2_SOURCES_LINE,
  V2_TRANSCRIPT_STATES,
  readVerifyV2,
  v2CheckName,
  v2FragmentLine,
  v2Rows,
  verdictOfAnswer,
  type VerifyV2Answer,
} from '../verify-v2'
import { RECORDED_VERIFY_V2, type RecordedVerifyName } from './fixtures/verify-v2-recorded'
import { createDatasetSim, evidenceIdOf, stopSims } from './harness'

const V2 = en.evidence.verifyV2
const t = i18n.t.bind(i18n)
const SPEC_LINE = 'VIDEO-02 fragment 3 tampered (stored-bytes hash mismatch; chain broken from fragment 3)'

const REPORT_MEMBERS = ['overall', 'interrupted', 'checks', 'fragments', 'failedFragmentCount', 'transcriptState', 'sources'] as const
const DEVELOPMENT_LINE = 'DEVELOPMENT SOURCES — this package was not recorded from production devices.'
const UNTRUSTED_LINE = 'Sources: not trustworthy — the manifest was altered'
const PRODUCTION_LINE = 'Sources: declared as production devices by the Core that sealed this package.'

/** The answer of operation 41 as the Core sends it for a v2 item: the file rows and the whole report. */
const withPending = (name: RecordedVerifyName): Record<string, unknown> => ({ ...RECORDED_VERIFY_V2[name].body })
/** The same answer without the report members (a Core before row 141): every one of them is optional. */
function today(name: RecordedVerifyName): Record<string, unknown> {
  const body = withPending(name)
  for (const member of REPORT_MEMBERS) delete body[member]
  return body
}
const read = (answer: unknown): VerifyV2Answer => {
  const result = readVerifyV2(answer)
  if (result === null) throw new Error('not a v2 answer')
  return result
}

beforeEach(() => resetMissingI18nKeys())
afterEach(() => {
  cleanup()
  stopSims()
})

describe('the recorded answers are what the contract carries', () => {
  it('every recorded answer parses with the registry schema of operation 41, with the report members and without them', () => {
    for (const name of Object.keys(RECORDED_VERIFY_V2) as RecordedVerifyName[]) {
      expect(EvidenceVerifyResultSchema.safeParse(withPending(name)).success, name).toBe(true)
      expect(EvidenceVerifyResultSchema.safeParse(today(name)).success, name).toBe(true)
    }
    // CONTROL: the schema is strict, so a member it does not know does not parse.
    expect(EvidenceVerifyResultSchema.safeParse({ ...withPending('pass'), sourcesOk: true }).success).toBe(false)
  })
})

describe('the reader', () => {
  it('a v1 answer (no `files`) is not a v2 answer: the caller keeps the v1 view', () => {
    expect(readVerifyV2({ evidenceId: 'EV-1', ok: true, at: 1, tracks: [], manifestOk: true, signatureOk: true })).toBeNull()
    expect(readVerifyV2(null)).toBeNull()
    expect(readVerifyV2('PASS')).toBeNull()
    expect(readVerifyV2([])).toBeNull()
  })

  it("without the report members, PASS: both camera files with their three parts, the transcript, the manifest, the signature; nothing extra", () => {
    const answer = read(today('pass'))
    expect(answer.verdict).toBe('PASS')
    expect(v2Rows(answer).map((row) => [row.id, row.ok])).toEqual([
      ['file:VIDEO-01', true],
      ['file:VIDEO-02', true],
      ['transcript', true],
      ['manifest', true],
      ['signature', true],
    ])
    expect(answer.files.map((file) => [file.storedOk, file.plainOk, file.chainOk, file.fragmentCount])).toEqual([
      [true, true, true, 5],
      [true, true, true, 5],
    ])
    // Absent = show nothing extra.
    expect([answer.overall, answer.interrupted, answer.checks, answer.transcriptState, answer.sources, answer.failedFragmentCount]).toEqual([null, null, null, null, null, null])
    expect(answer.failedFragments).toEqual([])
    expect(answer.malformed).toEqual([])
  })

  it('with the report members: the 15 checks in order, the class, the transcript state, the fragment count', () => {
    const answer = read(withPending('pass'))
    expect(answer.checks?.map((check) => check.id)).toEqual([...V2_KNOWN_CHECK_IDS])
    expect(answer.checks?.every((check) => check.status === 'PASS')).toBe(true)
    expect(answer.overall).toBe('PASS')
    expect(answer.interrupted).toBe(false)
    expect(answer.transcriptState).toBe('READY')
    expect(answer.failedFragmentCount).toBe(0)
    expect(answer.checks).toHaveLength(15)
    expect(answer.malformed).toEqual([])
  })

  it('a package without a transcript document: no transcript row is invented; the state says why', () => {
    const answer = read(withPending('disabled'))
    expect(answer.verdict).toBe('PASS')
    expect(answer.transcriptOk).toBeNull()
    expect(v2Rows(answer).map((row) => row.id)).toEqual(['file:VIDEO-01', 'file:VIDEO-02', 'manifest', 'signature'])
    expect(answer.transcriptState).toBe('DISABLED_BY_CONFIGURATION')
  })

  it('V-15 is named by the verifier\'s wording; a check this reader does not know is kept and named by its ID; the third skip reason is read', () => {
    const base = withPending('pass')
    const checks = [...(base.checks as unknown[]), { id: 'V-16', name: 'Not known here', status: 'SKIPPED', failureClass: null, skipped: 'OUT_OF_SCOPE', findings: [] }]
    const answer = read({ ...base, checks })
    expect(answer.checks).toHaveLength(16)
    expect(answer.checks?.at(-1)).toMatchObject({ id: 'V-16', status: 'SKIPPED', skipped: 'OUT_OF_SCOPE' })
    expect(v2CheckName('V-16', t)).toBe('V-16')
    expect(v2CheckName('V-15', t)).toBe('V-15 · Source class')
    expect(v2CheckName('V-04', t)).toBe(`V-04 · ${V2.checks['V-04']}`)
    expect(answer.malformed).toEqual([])
  })
})

describe('the source line (R-11; spec §D.1; M7-DEVSRC-EVID-W, software part)', () => {
  it('a development package: the state, one entry per camera file and per audio interval; the verdict is unchanged', () => {
    const answer = read(withPending('development'))
    expect(answer.verdict).toBe('PASS')
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
    })
    expect(t(V2_SOURCES_LINE.DEVELOPMENT)).toBe(DEVELOPMENT_LINE)
    // The mark never hides a failure, and a failure never hides the mark.
    const tampered = read(withPending('tamperedFragment'))
    expect([tampered.verdict, tampered.sources?.state]).toEqual(['FAIL', 'DEVELOPMENT'])
  })

  it('every source declared PRODUCTION: the declared line, never the development one', () => {
    const answer = read(withPending('production'))
    expect(answer.sources?.state).toBe('DECLARED_PRODUCTION')
    expect(answer.sources?.tracks.map((track) => track.sourceClass)).toEqual(['PRODUCTION', 'PRODUCTION'])
    expect(t(V2_SOURCES_LINE.DECLARED_PRODUCTION)).toBe(PRODUCTION_LINE)
  })

  it('an edited mark (`development: null`): "not trustworthy", no class is repeated', () => {
    const answer = read(withPending('untrusted'))
    expect(answer.verdict).toBe('FAIL')
    expect(answer.sources).toEqual({ state: 'NOT_TRUSTWORTHY', tracks: [], audioIntervals: [] })
    expect(t(V2_SOURCES_LINE.NOT_TRUSTWORTHY)).toBe(UNTRUSTED_LINE)
    expect(answer.malformed).toEqual([])
  })

  it('no `sources` member (a v1 item, an older Core): null, nothing is drawn', () => {
    expect(read(today('pass')).sources).toBeNull()
  })

  it('NEVER production by default: every unclear block reads NOT TRUSTWORTHY and is named', () => {
    const production = withPending('production').sources as Record<string, unknown>
    const development = withPending('development').sources as Record<string, unknown>
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
    ]
    for (const [label, sources] of cases) {
      const answer = read({ ...withPending('production'), sources })
      expect(answer.sources?.state, label).toBe('NOT_TRUSTWORTHY')
      expect(answer.sources?.tracks, label).toEqual([])
      expect(answer.malformed, label).toContain('sources')
      // The source line says nothing of the verdict: the Core's `ok` stands.
      expect(answer.verdict, label).toBe('PASS')
    }
    // CONTROL: the untouched block is read as declared production, and UNKNOWN with null is not "malformed".
    expect(read(withPending('production')).malformed).toEqual([])
    const unknown = read({ ...withPending('production'), sources: { ok: false, code: 'UNKNOWN', development: null, report: 'x', tracks: [], audioIntervals: [] } })
    expect([unknown.sources?.state, unknown.malformed]).toEqual(['NOT_TRUSTWORTHY', []])
  })
})

describe('never a pass by default', () => {
  it('the verdict is PASS only for the boolean true', () => {
    for (const ok of [false, 'true', 1, null, undefined, {}, 'PASS']) expect(read({ ...today('pass'), ok }).verdict).toBe('FAIL')
    expect(read(today('pass')).verdict).toBe('PASS')
    // The v1 mapping too.
    expect(verdictOfAnswer({ ok: true }, null)).toBe('PASS')
    for (const ok of [false, 'true', 1, null, undefined]) expect(verdictOfAnswer({ ok }, null)).toBe('FAIL')
    expect(verdictOfAnswer(null, null)).toBe('FAIL')
  })

  it('a FAIL answer never reads PASS, whatever its rows say (the verdict is not recombined)', () => {
    const answer = read({ ...today('pass'), ok: false })
    expect(answer.verdict).toBe('FAIL')
    expect(verdictOfAnswer({ ...today('pass'), ok: false }, answer)).toBe('FAIL')
  })

  it('a missing or mistyped member is not passed: manifest, signature, each part of a file', () => {
    const base = today('pass')
    const { manifestOk: _m, signatureOk: _s, ...without } = base
    const answer = read(without)
    expect([answer.manifestOk, answer.signatureOk]).toEqual([false, false])
    const files = [{ fileId: 'fragments/VIDEO-01.mp4', trackId: 'VIDEO-01', storedOk: 'yes', chainOk: true, fragmentCount: 5, ok: true }]
    const row = read({ ...base, files }).files[0]
    expect(row).toMatchObject({ storedOk: false, plainOk: false, chainOk: true, ok: false })
  })

  it('a file entry that cannot be read turns the verdict to FAIL', () => {
    expect(read({ ...today('pass'), files: [null] }).verdict).toBe('FAIL')
    expect(read({ ...today('pass'), files: [{ storedOk: true }] }).verdict).toBe('FAIL')
  })
})

describe('malformed report members', () => {
  it('are dropped and named, and the rest of the answer is still drawn', () => {
    const base = withPending('tamperedFragment')
    const cases: [string, Record<string, unknown>][] = [
      ['checks', { checks: 'all passed' }],
      ['checks', { checks: [] }],
      ['checks', { checks: [...(base.checks as unknown[]), { id: 'bogus', status: 'PASS' }] }],
      ['checks', { checks: [...(base.checks as unknown[]), (base.checks as unknown[])[0]] }],
      ['checks', { checks: (base.checks as Record<string, unknown>[]).map((check, index) => (index === 3 ? { ...check, status: 'MAYBE' } : check)) }],
      ['checks', { checks: Array.from({ length: 40 }, (_, index) => ({ id: `V-${String(index + 10)}`, status: 'PASS', findings: [] })) }],
      ['overall', { overall: 'FINE' }],
      ['interrupted', { interrupted: 'no' }],
      ['transcriptState', { transcriptState: { code: 'SEALED_AND_FINE' } }],
      ['transcriptState', { transcriptState: 'READY' }],
      ['fragments', { fragments: [{ trackId: 'VIDEO-02' }] }],
      ['fragments', { fragments: 'VIDEO-02#3' }],
      ['failedFragmentCount', { failedFragmentCount: 'one' }],
      ['sources', { sources: [] }],
    ]
    for (const [member, patch] of cases) {
      const answer = read({ ...base, ...patch })
      expect(answer.malformed, JSON.stringify(patch).slice(0, 60)).toContain(member)
      expect(answer.verdict).toBe('FAIL')
      expect(answer.files).toHaveLength(2)
    }
    // A report with a hole is not drawn at all: a partial list could hide a failure.
    expect(read({ ...base, checks: [...(base.checks as unknown[]), { id: 'bogus', status: 'PASS' }] }).checks).toBeNull()
  })
})

describe('the tamper demo, re-scripted on ONE fragment (M7-TP-1; spec §F.2, §F.3)', () => {
  it('the script names one fragment of one camera file; the v1 packages keep their own tamper', () => {
    expect(DEMO_TAMPERED_EVIDENCE_SEQ).toBe(5)
    expect([DEMO_TAMPERED_FRAGMENT_TRACK, DEMO_TAMPERED_FRAGMENT_SEQ]).toEqual(['VIDEO-02', 3])
    expect(DEMO_TAMPERED_TRACK).toBe('AUDIO-02')
  })

  it('the real verifier, one byte of that fragment altered: exactly that fragment, the chain from it on, class TAMPERED, everything else passes', () => {
    const answer = read(withPending('tamperedFragment'))
    expect(answer.verdict).toBe('FAIL')
    expect(answer.overall).toBe('TAMPERED')
    expect(answer.failedFragments).toEqual([
      { trackId: DEMO_TAMPERED_FRAGMENT_TRACK, seq: DEMO_TAMPERED_FRAGMENT_SEQ, reason: 'TAMPERED', storedMismatch: true, chainBrokenFromSeq: DEMO_TAMPERED_FRAGMENT_SEQ },
    ])
    expect(answer.chainBreaks).toEqual([])
    expect(answer.checks?.filter((check) => check.status === 'FAIL').map((check) => [check.id, check.failureClass])).toEqual([
      ['V-04', 'TAMPERED'],
      ['V-06', 'TAMPERED'],
      ['V-08', 'TAMPERED'],
    ])
    expect(answer.checks?.filter((check) => check.status === 'SKIPPED').map((check) => [check.id, check.skipped])).toEqual([['V-05', 'BLOCKED']])
    expect(answer.checks?.filter((check) => check.status === 'PASS').map((check) => check.id)).toEqual(['V-01', 'V-02', 'V-03', 'V-07', 'V-09', 'V-10', 'V-11', 'V-12', 'V-13', 'V-14', 'V-15'])
    expect(answer.failedFragmentCount).toBe(1)
    expect(v2Rows(answer).filter((row) => !row.ok).map((row) => row.id)).toEqual(['file:VIDEO-02'])
    // The sentence of the spec, word for word.
    expect(v2FragmentLine(answer.failedFragments[0]!, t)).toBe(SPEC_LINE)
  })

  it('"tampered" is said only for the class TAMPERED; a chain break without a failed fragment of its own is still named', () => {
    const corrupt = { trackId: 'VIDEO-01', seq: 2, reason: 'CORRUPT' as const, storedMismatch: true, chainBrokenFromSeq: null }
    expect(v2FragmentLine(corrupt, t)).toBe('VIDEO-01 fragment 2 did not verify (Corrupt)')
    expect(v2FragmentLine({ ...corrupt, reason: 'TAMPERED' }, t)).toBe('VIDEO-01 fragment 2 tampered (stored-bytes hash mismatch)')
    const checks = [{ id: 'V-06', status: 'FAIL', failureClass: 'TAMPERED', skipped: null, findings: [{ code: 'CHAIN_BROKEN', failureClass: 'TAMPERED', trackId: 'VIDEO-01', seq: 4 }] }]
    const answer = read({ ...today('tamperedFragment'), checks })
    expect(answer.failedFragments).toEqual([])
    expect(answer.chainBreaks).toEqual([{ trackId: 'VIDEO-01', fromSeq: 4 }])
  })

  it('an answer without the report members does not name the fragment: the file fails and nothing is invented', () => {
    const answer = read(today('tamperedFragment'))
    expect(answer.verdict).toBe('FAIL')
    expect(answer.failedFragments).toEqual([])
    expect(answer.files[1]).toMatchObject({ trackId: 'VIDEO-02', storedOk: false, plainOk: false, chainOk: false, ok: false })
  })
})

describe('the wording', () => {
  it("the transcript-state lines are row 119's fixed lines, one per code", () => {
    expect(Object.keys(V2.transcriptState).sort()).toEqual([...V2_TRANSCRIPT_STATES].sort())
    expect(Object.keys(TRANSCRIPT_STATE_REPORT).sort()).toEqual([...V2_TRANSCRIPT_STATES].sort())
    for (const code of V2_TRANSCRIPT_STATES) expect(V2.transcriptState[code]).toBe(TRANSCRIPT_STATE_REPORT[code])
    expect(V2.transcriptState.DISABLED_BY_CONFIGURATION).toBe('Transcript disabled by configuration')
    expect(V2.transcriptState.PARTIAL_BACKEND_UNREACHABLE).toBe('Transcript partial — backend unreachable')
    expect(V2.transcriptState.UNAVAILABLE_AT_SEAL).toBe('Transcript unavailable at seal')
  })

  it("the check names are the verifier's, V-01 to V-15", () => {
    expect([...V2_KNOWN_CHECK_IDS]).toEqual(VERIFY_V2_CHECKS.map((check) => check.id))
    expect(V2_KNOWN_CHECK_IDS).toHaveLength(15)
    for (const check of VERIFY_V2_CHECKS) expect(V2.checks[check.id]).toBe(check.name)
    expect(V2.checks['V-15']).toBe('Source class')
  })

  it("the source lines are the verifier's own (`SOURCES_STATE_REPORT`), and every skip reason of the contract has a line", () => {
    expect(t(V2_SOURCES_LINE.DEVELOPMENT)).toBe(SOURCES_STATE_REPORT.DEVELOPMENT)
    expect(t(V2_SOURCES_LINE.DECLARED_PRODUCTION)).toBe(SOURCES_STATE_REPORT.DECLARED_PRODUCTION)
    expect(t(V2_SOURCES_LINE.NOT_TRUSTWORTHY)).toBe(SOURCES_STATE_REPORT.NOT_TRUSTWORTHY)
    expect(Object.keys(V2.skipped).sort()).toEqual([...VERIFY_REPORT_SKIP_REASONS].sort())
    expect(Object.keys(en.evidence.sources.kind).sort()).toEqual([...VERIFY_REPORT_SOURCE_CLASSES].sort())
  })
})

// ── The card ─────────────────────────────────────────────────────────────────────────────────

const SIX: DemoCheckId[] = ['track:VIDEO-01', 'track:VIDEO-02', 'track:AUDIO-01', 'track:AUDIO-02', 'manifest', 'signature']

function datasetItem(sim: Sim, suffix: string): EvidenceItem {
  const id = evidenceIdOf(sim, suffix)
  return JSON.parse(JSON.stringify(sim.store.getState().evidence.find((entry) => entry.id === id))) as EvidenceItem
}
const rowOf = (sim: Sim, item: EvidenceItem): EvidenceRow => buildEvidenceRow(item, sim.store.getState().operators)

function coreState(patch: Partial<VerifyState> = {}): VerifyState {
  return { phase: 'done', mode: 'core', checks: [], verdict: null, label: null, report: null, runId: 1, bundled: null, differs: false, v2: null, awaitsV2: true, ...patch }
}
function renderCard(sim: Sim, row: EvidenceRow, state: VerifyState) {
  const verification: EvidenceVerification = { state, run: async () => null }
  return render(withProviders(<IntegrityTab row={row} verification={verification} />, { sim }))
}
const card = () => screen.getByTestId('evidence-verify-card')
const chip = () => within(card()).getByTestId('evidence-verdict')
const rowPhases = () => Array.from(screen.getByTestId('evidence-v2-rows').querySelectorAll<HTMLElement>('[data-check]')).map((row) => [row.dataset.check, row.dataset.phase])

describe('IntegrityTab, a v2 run', () => {
  it('PASS: the five rows of the answer, no v1 row, no "n of 6 checks", every string from a key (M7-VV-WEB, software part)', () => {
    const sim = createDatasetSim()
    const answer = read(withPending('pass'))
    renderCard(sim, rowOf(sim, datasetItem(sim, '0001')), coreState({ verdict: answer.verdict, v2: answer }))
    expect(chip()).toHaveAttribute('data-verdict', 'PASS')
    expect(rowPhases()).toEqual([
      ['file:VIDEO-01', 'pass'],
      ['file:VIDEO-02', 'pass'],
      ['transcript', 'pass'],
      ['manifest', 'pass'],
      ['signature', 'pass'],
    ])
    expect(screen.queryByTestId('evidence-checks')).toBeNull()
    expect(card().textContent).not.toMatch(/of \d+ checks$|\d of 6 checks/)
    expect(card().querySelector('[role="progressbar"]')).toBeNull()
    expect(screen.getByTestId('evidence-v2-rows')).toHaveTextContent('Stored bytes PASS · decrypted bytes PASS · fragment chain PASS')
    expect(screen.getByTestId('evidence-v2-rows')).toHaveTextContent('5 fragments')
    // The per-check list: 15 rows, all PASS (both file hashes V-04/V-05, transcript V-10/V-11, signature V-09, certificate V-13, source class V-15).
    const checks = Array.from(screen.getByTestId('evidence-v2-checks').querySelectorAll<HTMLElement>('[data-check]'))
    expect(checks.map((row) => row.dataset.check)).toEqual([...V2_KNOWN_CHECK_IDS])
    expect(checks.map((row) => row.dataset.status)).toEqual(Array.from({ length: 15 }, () => 'PASS'))
    expect(screen.getByTestId('evidence-v2-checks')).toHaveTextContent('15 of 15 checks passed')
    expect(screen.getByTestId('evidence-v2-checks')).toHaveTextContent('V-15 · Source class')
    expect(screen.getByTestId('evidence-v2-checks')).toHaveTextContent(`V-13 · ${V2.checks['V-13']}`)
    expect(screen.getByTestId('evidence-v2-transcript-state')).toHaveTextContent('Transcript sealed')
    expect(screen.queryByTestId('evidence-v2-fragments')).toBeNull()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the tamper demo: FAIL, the fragment by name, V-04 / V-06 / V-08 failed, the transcript, signature and certificate rows PASS', () => {
    const sim = createDatasetSim()
    const answer = read(withPending('tamperedFragment'))
    renderCard(sim, rowOf(sim, datasetItem(sim, '0005')), coreState({ verdict: answer.verdict, v2: answer }))
    expect(chip()).toHaveAttribute('data-verdict', 'FAIL')
    expect(screen.getByTestId('evidence-verify-v2')).toHaveAttribute('data-overall', 'TAMPERED')
    expect(screen.getByTestId('evidence-v2-fragments')).toHaveTextContent(SPEC_LINE)
    expect(screen.getByTestId('evidence-v2-fragments').querySelectorAll('[data-fragment]')).toHaveLength(1)
    expect(rowPhases()).toEqual([
      ['file:VIDEO-01', 'pass'],
      ['file:VIDEO-02', 'fail'],
      ['transcript', 'pass'],
      ['manifest', 'pass'],
      ['signature', 'pass'],
    ])
    const status = (id: string) => screen.getByTestId('evidence-v2-checks').querySelector<HTMLElement>(`[data-check="${id}"]`)?.dataset.status
    expect(['V-04', 'V-06', 'V-08'].map(status)).toEqual(['FAIL', 'FAIL', 'FAIL'])
    expect(status('V-05')).toBe('SKIPPED')
    expect(['V-09', 'V-10', 'V-11', 'V-13'].map(status)).toEqual(['PASS', 'PASS', 'PASS', 'PASS'])
    expect(screen.getByTestId('evidence-v2-checks')).toHaveTextContent(V2.skipped.BLOCKED)
    expect(screen.getByTestId('evidence-v2-checks')).toHaveTextContent('11 of 15 checks passed')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('an answer without the report members: the file fails, the card says the answer names no fragment, and draws no check list and no source line', () => {
    const sim = createDatasetSim()
    const answer = read(today('tamperedFragment'))
    renderCard(sim, rowOf(sim, datasetItem(sim, '0005')), coreState({ verdict: answer.verdict, v2: answer }))
    expect(chip()).toHaveAttribute('data-verdict', 'FAIL')
    expect(screen.getByTestId('evidence-v2-fragment-not-named')).toHaveTextContent(V2.fragment.notNamed)
    expect(screen.queryByTestId('evidence-v2-fragments')).toBeNull()
    expect(screen.queryByTestId('evidence-v2-checks')).toBeNull()
    expect(screen.queryByTestId('evidence-v2-transcript-state')).toBeNull()
    expect(screen.queryByTestId('evidence-v2-sources')).toBeNull()
  })

  it('the development line is the FIRST thing of the result, with its entries, on a PASS verdict; it is not collapsible', () => {
    const sim = createDatasetSim()
    const answer = read(withPending('development'))
    renderCard(sim, rowOf(sim, datasetItem(sim, '0001')), coreState({ verdict: answer.verdict, v2: answer }))
    expect(chip()).toHaveAttribute('data-verdict', 'PASS')
    const result = screen.getByTestId('evidence-verify-v2')
    const line = screen.getByTestId('evidence-v2-sources')
    expect(result.firstElementChild).toBe(line)
    expect(line).toHaveAttribute('data-sources', 'DEVELOPMENT')
    expect(line).toHaveTextContent(DEVELOPMENT_LINE)
    expect(line.querySelector('button, details, summary, [aria-expanded]')).toBeNull()
    const entries = Array.from(screen.getByTestId('evidence-v2-source-entries').querySelectorAll('li')).map((entry) => entry.textContent)
    expect(entries).toEqual([
      'VIDEO-01: CAM-03 · Local device of the Core Mac',
      'VIDEO-02: CAM-02 · Test source',
      'Audio interval 1: MIC-03 · Local device of the Core Mac',
      'Audio interval 2: MIC-02 · Test source',
    ])
    // The line stands before the rows and before the checks in document order.
    expect(line.compareDocumentPosition(screen.getByTestId('evidence-v2-rows')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(line.compareDocumentPosition(screen.getByTestId('evidence-v2-checks')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('declared production: the declared line first and no entry list; an edited mark: "not trustworthy" on a FAIL verdict, V-03 failed', () => {
    const sim = createDatasetSim()
    const row = rowOf(sim, datasetItem(sim, '0001'))
    const production = read(withPending('production'))
    const first = renderCard(sim, row, coreState({ verdict: production.verdict, v2: production }))
    expect(screen.getByTestId('evidence-verify-v2').firstElementChild).toBe(screen.getByTestId('evidence-v2-sources'))
    expect(screen.getByTestId('evidence-v2-sources')).toHaveTextContent(PRODUCTION_LINE)
    expect(screen.getByTestId('evidence-v2-sources')).not.toHaveTextContent('DEVELOPMENT')
    expect(screen.queryByTestId('evidence-v2-source-entries')).toBeNull()
    first.unmount()
    const untrusted = read(withPending('untrusted'))
    renderCard(sim, row, coreState({ verdict: untrusted.verdict, v2: untrusted }))
    expect(chip()).toHaveAttribute('data-verdict', 'FAIL')
    expect(screen.getByTestId('evidence-verify-v2').firstElementChild).toBe(screen.getByTestId('evidence-v2-sources'))
    expect(screen.getByTestId('evidence-v2-sources')).toHaveAttribute('data-sources', 'NOT_TRUSTWORTHY')
    expect(screen.getByTestId('evidence-v2-sources')).toHaveTextContent(UNTRUSTED_LINE)
    expect(screen.getByTestId('evidence-v2-sources')).not.toHaveTextContent(/production/i)
    expect(screen.queryByTestId('evidence-v2-source-entries')).toBeNull()
    expect(screen.getByTestId('evidence-v2-checks').querySelector<HTMLElement>('[data-check="V-03"]')?.dataset.status).toBe('FAIL')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('the transcript-state label, for each code the verifier reports', () => {
    const sim = createDatasetSim()
    const row = rowOf(sim, datasetItem(sim, '0001'))
    for (const code of V2_TRANSCRIPT_STATES) {
      const answer = read({ ...withPending('disabled'), transcriptState: { code } })
      const view = renderCard(sim, row, coreState({ verdict: answer.verdict, v2: answer }))
      expect(screen.getByTestId('evidence-v2-transcript-state')).toHaveAttribute('data-code', code)
      expect(screen.getByTestId('evidence-v2-transcript-state')).toHaveTextContent(TRANSCRIPT_STATE_REPORT[code])
      view.unmount()
    }
  })

  it('while the request is out: the card says it waits; no row, no bar, no count (the Core reports no progress of a verification)', () => {
    const sim = createDatasetSim()
    renderCard(sim, rowOf(sim, datasetItem(sim, '0001')), coreState({ phase: 'running' }))
    expect(chip()).toHaveAttribute('data-verdict', 'RUNNING')
    expect(screen.getByTestId('evidence-verify-v2-waiting')).toHaveTextContent(V2.waiting)
    expect(card().querySelectorAll('[data-check]')).toHaveLength(0)
    expect(card().querySelector('[role="progressbar"]')).toBeNull()
    expect(card().textContent).not.toMatch(/\d+ of \d+ checks/)
  })

  it('the verdict of record is pinned for the run: a delta that arrives while it runs does not move the line (W92-10, P-16)', () => {
    const sim = createDatasetSim()
    const item = datasetItem(sim, '0001')
    const at = item.sealedAt! + 60_000
    const before: EvidenceItem = { ...item, verification: { status: 'PASS', at }, custody: [...item.custody, { at, action: 'VERIFIED', actorId: OPERATOR_IDS.ANDI, detail: null }] }
    const after: EvidenceItem = { ...before, verification: { status: 'FAIL', at: at + 5_000 }, custody: [...before.custody, { at: at + 5_000, action: 'VERIFY_FAILED', actorId: OPERATOR_IDS.ANDI, detail: 'Mismatch: VIDEO-02 fragment 3' }] }
    const running = coreState({ phase: 'running', runId: 7 })
    const view = renderCard(sim, rowOf(sim, before), running)
    expect(screen.getByTestId('evidence-verify-last')).toHaveAttribute('data-status', 'PASS')
    // The Core's delta (the new record) arrives before the run ends: the line stays on the record of the press.
    view.rerender(withProviders(<IntegrityTab row={rowOf(sim, after)} verification={{ state: running, run: async () => null }} />, { sim }))
    expect(screen.getByTestId('evidence-verify-last')).toHaveAttribute('data-status', 'PASS')
    expect(chip()).toHaveAttribute('data-verdict', 'RUNNING')
    // The run ends: the chip is the run's verdict, and the line follows the record.
    const answer = read(withPending('tamperedFragment'))
    view.rerender(withProviders(<IntegrityTab row={rowOf(sim, after)} verification={{ state: coreState({ verdict: answer.verdict, v2: answer, runId: 7 }), run: async () => null }} />, { sim }))
    expect(chip()).toHaveAttribute('data-verdict', 'FAIL')
    expect(screen.getByTestId('evidence-verify-last')).toHaveAttribute('data-status', 'FAIL')
  })
})

describe('IntegrityTab, a v1 run is unchanged', () => {
  it('the six rows, the bar and "0 of 6 checks"; no v2 part', () => {
    const sim = createDatasetSim()
    const item = datasetItem(sim, '0001')
    expect(isV2Item(rowOf(sim, item))).toBe(false)
    const state: VerifyState = {
      phase: 'idle',
      mode: 'package',
      checks: SIX.map((id) => ({ id, phase: 'pending', expected: null, actual: null, source: null })),
      verdict: null,
      label: null,
      report: null,
      runId: 0,
      bundled: null,
      differs: false,
    }
    renderCard(sim, rowOf(sim, item), state)
    expect(Array.from(screen.getByTestId('evidence-checks').querySelectorAll<HTMLElement>('[data-check]')).map((row) => row.dataset.check)).toEqual(SIX)
    expect(card().textContent).toContain('0 of 6 checks')
    expect(card().querySelector('[role="progressbar"]')).not.toBeNull()
    expect(screen.queryByTestId('evidence-verify-v2')).toBeNull()
    expect(screen.queryByTestId('evidence-verify-v2-waiting')).toBeNull()
  })

  it('an item with sealed files is a v2 item', () => {
    const sim = createDatasetSim()
    const item = datasetItem(sim, '0001')
    const files = [{ trackId: 'VIDEO-01' as const, fileName: 'fragments/VIDEO-01.mp4', sizeBytes: 10, sha256: 'a'.repeat(64), fragmentCount: 5 }]
    expect(isV2Item(rowOf(sim, { ...item, files }))).toBe(true)
    expect(isV2Item(rowOf(sim, { ...item, files: [] }))).toBe(false)
    expect(isV2Item(null)).toBe(false)
  })
})
