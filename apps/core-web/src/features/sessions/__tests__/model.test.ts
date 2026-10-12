// Fix wave J, driver J-W - finding JW-22: the Sessions page lists every finished session with its state, and the
// Evidence search names a session that has no item. A new module: its own test file, named after it.
import { describe, expect, it } from 'vitest'
import { SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE, type SessionHistoryPage } from '@dems/shared/api'
import { SEAL_UNSEALABLE_EXAMPLE_ALERT, type SessionHistoryEntry } from '@dems/shared/sim'
import { causesOfPage, sessionCausesQueryKey } from '../causes'
import { matchesSession, quarantinedSessionIds, sessionRows, sessionsWithoutItem, unsealableCauseOfRow } from '../model'
import { evidenceStatusOfHistory } from '../state'

const entry = (over: Partial<SessionHistoryEntry>): SessionHistoryEntry => ({
  id: 'SES-20261011-0001',
  outcome: 'SEALED',
  caseNumber: 'LP/2026/1011-0001',
  subjectName: 'Subject One',
  subjectType: 'SAKSI',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD',
  createdAt: 1_000,
  startedAt: 2_000,
  endedAt: 62_000,
  durationMs: 60_000,
  sizeBytes: 1,
  evidenceId: 'EV-20261011-0001',
  faultKind: null,
  ...over,
} as SessionHistoryEntry)

const SEALED = entry({})
const QUARANTINED = entry({ id: 'SES-20261011-0041', outcome: 'INCOMPLETE', evidenceId: null, faultKind: 'CAPTURE_FAULT' as never })
const INTERRUPTED = entry({ id: 'SES-20261011-0042', outcome: 'INCOMPLETE', evidenceId: 'EV-20261011-0015', faultKind: 'STORAGE_FULL' })
const NEVER = entry({ id: 'SES-20261011-0043', outcome: 'INCOMPLETE', evidenceId: null, startedAt: null, faultKind: null })
const HISTORY = [NEVER, INTERRUPTED, QUARANTINED, SEALED]

describe('Sessions page model (JW-22)', () => {
  it('the state of each session is the shared reader`s: sealed, quarantined, recorded but not sealed, never recorded', () => {
    expect(evidenceStatusOfHistory(SEALED)).toEqual({ kind: 'SEALED', evidenceId: 'EV-20261011-0001', cause: null })
    expect(evidenceStatusOfHistory(QUARANTINED)).toEqual({ kind: 'QUARANTINED', evidenceId: null, cause: 'CAPTURE_FAULT' })
    expect(evidenceStatusOfHistory(INTERRUPTED)).toEqual({ kind: 'RECORDED_NOT_SEALED', evidenceId: 'EV-20261011-0015', cause: 'STORAGE_FULL' })
    expect(evidenceStatusOfHistory(NEVER)).toEqual({ kind: 'NEVER_RECORDED', evidenceId: null, cause: null })
  })

  it('the filter: all, sealed only, not sealed only', () => {
    expect(sessionRows(HISTORY, 'ALL', undefined).map((row) => row.entry.id)).toEqual(HISTORY.map((item) => item.id))
    expect(sessionRows(HISTORY, 'SEALED', undefined).map((row) => row.entry.id)).toEqual([SEALED.id])
    expect(sessionRows(HISTORY, 'INCOMPLETE', undefined).map((row) => row.state.kind)).toEqual(['NEVER_RECORDED', 'RECORDED_NOT_SEALED', 'QUARANTINED'])
  })

  it('the search finds a session by its id, its evidence id, its case number and its subject', () => {
    expect(matchesSession(QUARANTINED, 'ses-20261011-0041')).toBe(true)
    expect(matchesSession(INTERRUPTED, 'EV-20261011-0015')).toBe(true)
    expect(matchesSession(SEALED, '1011-0001')).toBe(true)
    expect(matchesSession(SEALED, 'subject  one')).toBe(true)
    expect(matchesSession(SEALED, 'nothing')).toBe(false)
    expect(sessionRows(HISTORY, 'ALL', '0041').map((row) => row.entry.id)).toEqual([QUARANTINED.id])
  })

  it('the Evidence search names the sessions WITHOUT an item that match it (the judge`s query answered "No evidence matches")', () => {
    expect(sessionsWithoutItem(HISTORY, 'SES-20261011-0041').map((item) => item.id)).toEqual([QUARANTINED.id])
    // A session that HAS an item is the Evidence table's own row: not named twice.
    expect(sessionsWithoutItem(HISTORY, 'SES-20261011-0042')).toEqual([])
    // No query: no hint.
    expect(sessionsWithoutItem(HISTORY, undefined)).toEqual([])
    expect(sessionsWithoutItem(HISTORY, '  ')).toEqual([])
  })
})

// Fix wave J round three, driver J3-W (`contract_wave_j.md` J2-S 4; JW-22 remainder): WHY the seal of a
// quarantined session was given up. Operation 38 states it as the optional member `unsealableCause`
// (exported example `SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE`); the page reads it BY NAME through the
// shared reader `unsealableCauseOf(entry, alerts)`.
describe('Sessions page: the cause of a seal that was given up (J2-S 4)', () => {
  const EXAMPLE = SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE as unknown as SessionHistoryEntry
  /** The same session as the replicated slice holds it: without the member (no column). */
  const { unsealableCause: _member, ...WITHOUT } = SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE
  const SLICE_ENTRY = WITHOUT as unknown as SessionHistoryEntry
  const alertOf = (sessionId: string, cause: string) => ({ ...SEAL_UNSEALABLE_EXAMPLE_ALERT, target: sessionId, params: { ...SEAL_UNSEALABLE_EXAMPLE_ALERT.params, sessionId, cause } })

  it('the exported example is a quarantined session, and its row states the member\'s code', () => {
    const [row] = sessionRows([EXAMPLE], 'ALL', undefined)
    expect(row?.state.kind).toBe('QUARANTINED')
    expect(row?.unsealableCause).toBe('SIGNING_KEY_UNAVAILABLE')
    // `state.cause` stays the fault that ended the RECORDING (none here): the two are not one fact.
    expect(row?.state.cause).toBeNull()
  })

  it('the slice entry has no member: what operation 38 answered for the session is laid over it by the member\'s name', () => {
    expect(sessionRows([SLICE_ENTRY], 'ALL', undefined)[0]?.unsealableCause).toBeNull()
    const causes = causesOfPage({ items: [SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE], nextCursor: null } as unknown as SessionHistoryPage)
    expect(causes).toEqual({ [EXAMPLE.id]: 'SIGNING_KEY_UNAVAILABLE' })
    expect(sessionRows([SLICE_ENTRY], 'ALL', undefined, { causes })[0]?.unsealableCause).toBe('SIGNING_KEY_UNAVAILABLE')
  })

  it('without the operation\'s answer the session\'s alert states it (the shared reader\'s fallback); the member wins over the alert', () => {
    const alerts = [alertOf(EXAMPLE.id, 'NOTHING_SEALABLE')]
    expect(sessionRows([SLICE_ENTRY], 'ALL', undefined, { alerts })[0]?.unsealableCause).toBe('NOTHING_SEALABLE')
    expect(sessionRows([SLICE_ENTRY], 'ALL', undefined, { alerts, causes: { [EXAMPLE.id]: 'SIGNING_KEY_UNAVAILABLE' } })[0]?.unsealableCause).toBe('SIGNING_KEY_UNAVAILABLE')
  })

  it('CONTROLS - another session\'s alert or answer says nothing about this one; a sealed, an interrupted and a never-recorded session state none; a member that is not a code is not shown', () => {
    expect(sessionRows([SLICE_ENTRY], 'ALL', undefined, { alerts: [alertOf('SES-20261001-0099', 'NOTHING_SEALABLE')], causes: { 'SES-20261001-0099': 'MANIFEST_INVALID' } })[0]?.unsealableCause).toBeNull()
    const facts = { alerts: [alertOf(SEALED.id, 'X_Y'), alertOf(INTERRUPTED.id, 'X_Y'), alertOf(NEVER.id, 'X_Y')], causes: { [SEALED.id]: 'X_Y', [INTERRUPTED.id]: 'X_Y', [NEVER.id]: 'X_Y' } }
    for (const entry of [SEALED, INTERRUPTED, NEVER]) expect(unsealableCauseOfRow(entry, evidenceStatusOfHistory(entry), facts)).toBeNull()
    expect(causesOfPage({ items: [{ ...SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE, unsealableCause: 'free text, not a code' }], nextCursor: null } as unknown as SessionHistoryPage)).toEqual({})
    expect(causesOfPage({ items: [SLICE_ENTRY], nextCursor: null } as unknown as SessionHistoryPage)).toEqual({})
  })

  it('the Core is asked about the quarantined sessions only, and again when their set changes', () => {
    expect(quarantinedSessionIds(HISTORY)).toEqual([QUARANTINED.id])
    expect(quarantinedSessionIds([SEALED, INTERRUPTED, NEVER])).toEqual([])
    expect(sessionCausesQueryKey(['b', 'a'])).toEqual(sessionCausesQueryKey(['a', 'b']))
    expect(sessionCausesQueryKey(['a'])).not.toEqual(sessionCausesQueryKey(['a', 'b']))
  })
})
